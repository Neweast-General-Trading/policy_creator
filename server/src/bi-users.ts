import hana from "@sap/hana-client";
import type { Connection } from "@sap/hana-client";
import { enrichBiUsersWithPayrollDesignations } from "./payroll-designations.js";

export interface BiUser {
  USER_ID: string;
  USER_NAME: string;
  USER_EMAIL: string;
  EMP_FULLNAME: string;
  EMP_ID: number;
  REPORTINGTOID: string;
  DEPTCODE: number;
  DEPARTMENT: string;
  ORACLEEMPID?: number | null;
  DESIGNATION?: string | null;
}

function hanaConfig(schema: string) {
  return {
    serverNode: process.env.SERVER_NODE!,
    uid: process.env.SAP_HANA_USER!,
    pwd: process.env.SAP_HANA_PASSWORD!,
    currentSchema: schema,
    pooling: true,
    connectionLifetime: 1800,
  };
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function withConnection<T>(schema: string, run: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = hana.createConnection();
  return new Promise((resolve, reject) => {
    conn.connect(hanaConfig(schema), async (err) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        resolve(await run(conn));
      } catch (error) {
        reject(error);
      } finally {
        conn.disconnect();
      }
    });
  });
}

function exec<T>(conn: Connection, sql: string): Promise<T> {
  return new Promise((resolve, reject) => {
    conn.exec(sql, [], (err, result) => {
      if (err) reject(err);
      else resolve(result as T);
    });
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sameIdentifier(left?: string | number | null, right?: string | number | null) {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  return !!a && !!b && a === b;
}

export async function getBiUserByEmail(email: string, companyCode: string) {
  const safeEmail = escapeSql(normalizeEmail(email));
  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE LOWER(USER_EMAIL) = LOWER('${safeEmail}')
      AND USERTYPE = 'U'
      AND USER_ACTIVE = 'Y'
      AND EMP_ID != '0'
  `;
  const rows = await withConnection<BiUser[]>(companyCode, (conn) => exec(conn, sql));
  return rows?.[0] ?? null;
}

export async function getBiUserByIdentifier(id: string, companyCode: string) {
  const safeId = escapeSql(String(id).trim());
  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND (
        USER_ID = '${safeId}'
        OR TO_NVARCHAR(EMP_ID) = '${safeId}'
        OR TO_NVARCHAR(SLNO) = '${safeId}'
      )
  `;
  const rows = await withConnection<BiUser[]>(companyCode, (conn) => exec(conn, sql));
  return rows?.[0] ?? null;
}

/** Validate Intranet menu OTP link (uSrId + LoTp + co). */
export async function verifyIntranetLinkOtp(
  userId: string,
  otp: string,
  companyCode: string,
): Promise<BiUser | null> {
  const safeUserId = escapeSql(String(userId).trim());
  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT, PWDOTP
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND USER_ID = '${safeUserId}'
  `;
  const rows = await withConnection<
    Array<BiUser & { PWDOTP?: string | number | null }>
  >(companyCode, (conn) => exec(conn, sql));
  const row = rows?.[0];
  if (!row) return null;

  const expectedOtp = String(row.PWDOTP ?? "").trim();
  const providedOtp = String(otp).trim();
  if (!expectedOtp || expectedOtp !== providedOtp) return null;

  return {
    USER_ID: row.USER_ID,
    USER_NAME: row.USER_NAME,
    USER_EMAIL: row.USER_EMAIL,
    EMP_FULLNAME: row.EMP_FULLNAME,
    EMP_ID: row.EMP_ID,
    REPORTINGTOID: row.REPORTINGTOID,
    DEPTCODE: row.DEPTCODE,
    DEPARTMENT: row.DEPARTMENT,
  };
}

export async function getAuditTeamMembers(companyCode: string) {
  const auditDeptCode = Number(process.env.AUDIT_DEPT_CODE ?? 4);
  const auditManagerId = process.env.AUDIT_MANAGER_USER_ID?.trim() || "AUD01";
  const safeManagerId = escapeSql(auditManagerId);

  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND DEPTCODE = ${auditDeptCode}
      AND USER_ID <> '${safeManagerId}'
      AND REPORTINGTOID = '${safeManagerId}'
    ORDER BY USER_NAME
  `;
  return withConnection<BiUser[]>(companyCode, (conn) => exec(conn, sql));
}

export async function getAuditManager(companyCode: string) {
  const auditManagerId = process.env.AUDIT_MANAGER_USER_ID?.trim() || "AUD01";
  return getBiUserByIdentifier(auditManagerId, companyCode);
}

async function lookupManagerById(conn: Connection, id: string) {
  const safeId = escapeSql(String(id).trim());
  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND (
        USER_ID = '${safeId}'
        OR TO_NVARCHAR(EMP_ID) = '${safeId}'
        OR TO_NVARCHAR(SLNO) = '${safeId}'
      )
  `;
  const rows = await exec<BiUser[]>(conn, sql);
  return rows?.[0] ?? null;
}

/** Direct reporting manager (REPORTINGTOID), regardless of department. */
export async function getDirectReportingManager(requester: BiUser, companyCode: string) {
  if (!requester.REPORTINGTOID?.trim()) return null;
  return getBiUserByIdentifier(requester.REPORTINGTOID, companyCode);
}

/**
 * From a starting manager, walk up the chain and return the first manager
 * whose DEPTCODE matches the policy department (for second-level approval).
 */
export function findNextManagerInDepartment(
  startFrom: BiUser,
  departmentCode: number,
  companyCode: string,
) {
  return withConnection<BiUser | null>(companyCode, async (conn) => {
    let currentId = startFrom.REPORTINGTOID;
    const seen = new Set<string>();

    while (currentId) {
      const key = String(currentId).trim();
      if (!key || seen.has(key)) break;
      seen.add(key);

      const manager = await lookupManagerById(conn, key);
      if (!manager) break;

      if (Number(manager.DEPTCODE) === Number(departmentCode)) {
        return manager;
      }

      currentId = manager.REPORTINGTOID;
    }

    return null;
  });
}

export async function resolveDepartmentManagerChain(
  requester: BiUser,
  departmentCode: number,
  companyCode: string,
) {
  const direct = await getDirectReportingManager(requester, companyCode);
  const managers: BiUser[] = [];

  if (direct) {
    managers.push(direct);
    const second = await findNextManagerInDepartment(direct, departmentCode, companyCode);
    if (second && second.USER_ID !== direct.USER_ID) {
      managers.push(second);
    }
  }

  return managers;
}

export async function getUsersInDepartment(companyCode: string, departmentCode: number) {
  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT, ORACLEEMPID, DESIGNATION
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND DEPTCODE = ${Number(departmentCode)}
    ORDER BY EMP_FULLNAME, USER_NAME
  `;
  const rows = await withConnection<BiUser[]>(companyCode, (conn) => exec(conn, sql));
  return enrichBiUsersWithPayrollDesignations(rows ?? []);
}

export async function getDepartmentDesignations(companyCode: string, departmentCode: number) {
  const users = await getUsersInDepartment(companyCode, departmentCode);
  const fromPayroll = [
    ...new Set(
      users
        .map((user) => user.DESIGNATION?.trim() ?? "")
        .filter(Boolean),
    ),
  ];

  if (fromPayroll.length > 0) {
    return fromPayroll.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  const sql = `
    SELECT DISTINCT DESIGNATION
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      AND DEPTCODE = ${Number(departmentCode)}
      AND DESIGNATION IS NOT NULL
      AND TO_NVARCHAR(DESIGNATION) <> ''
    ORDER BY DESIGNATION
  `;
  const rows = await withConnection<Array<{ DESIGNATION: string }>>(companyCode, (conn) =>
    exec(conn, sql),
  );
  return (rows ?? []).map((row) => String(row.DESIGNATION).trim()).filter(Boolean);
}

/** Managers in same department only, walking up from requester (direct → top). */
export async function buildSameDepartmentManagerChain(
  requester: BiUser,
  departmentCode: number,
  companyCode: string,
) {
  return withConnection<BiUser[]>(companyCode, async (conn) => {
    const chain: BiUser[] = [];
    let currentId = requester.REPORTINGTOID;
    const seen = new Set<string>();

    while (currentId) {
      const key = String(currentId).trim();
      if (!key || seen.has(key)) break;
      seen.add(key);

      const manager = await lookupManagerById(conn, key);
      if (!manager) break;

      if (Number(manager.DEPTCODE) === Number(departmentCode)) {
        chain.push(manager);
        currentId = manager.REPORTINGTOID;
        continue;
      }
      break;
    }

    return chain;
  });
}

export async function isHeadOfDepartment(
  user: BiUser,
  departmentCode: number,
  companyCode: string,
) {
  if (Number(user.DEPTCODE) !== Number(departmentCode)) return false;
  const chain = await buildSameDepartmentManagerChain(user, departmentCode, companyCode);
  return chain.length === 0;
}

/** Approval levels inside a department from lowest (staff) to highest (leadership). */
export async function getDepartmentHierarchyLevels(
  companyCode: string,
  departmentCode: number,
) {
  const users = await getUsersInDepartment(companyCode, departmentCode);
  const { buildDepartmentHierarchyTiers } = await import("./department-hierarchy.js");
  return buildDepartmentHierarchyTiers(users);
}

export async function searchCompanyEmployees(
  companyCode: string,
  query = "",
  limit = 40,
  departmentCode?: number,
) {
  const safeQuery = escapeSql(query.trim().toLowerCase());
  const deptFilter =
    departmentCode != null && Number.isFinite(Number(departmentCode))
      ? `AND DEPTCODE = ${Number(departmentCode)}`
      : "";
  const filter = safeQuery
    ? `AND (
        LOWER(USER_NAME) LIKE '%${safeQuery}%'
        OR LOWER(USER_EMAIL) LIKE '%${safeQuery}%'
        OR LOWER(EMP_FULLNAME) LIKE '%${safeQuery}%'
        OR LOWER(USER_ID) LIKE '%${safeQuery}%'
      )`
    : "";

  const sql = `
    SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND EMP_ID != '0'
      ${deptFilter}
      ${filter}
    ORDER BY EMP_FULLNAME, USER_NAME
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;

  return withConnection<BiUser[]>(companyCode, (conn) => exec(conn, sql));
}

export function findManagersInDepartment(
  requester: BiUser,
  departmentCode: number,
  companyCode: string,
) {
  return withConnection<BiUser[]>(companyCode, async (conn) => {
    const managers: BiUser[] = [];
    let currentId = requester.REPORTINGTOID;
    const seen = new Set<string>();

    while (currentId && managers.length < 2) {
      const key = String(currentId).trim();
      if (!key || seen.has(key)) break;
      seen.add(key);

      const safeId = escapeSql(key);
      const sql = `
        SELECT USER_ID, USER_NAME, USER_EMAIL, EMP_FULLNAME, EMP_ID, REPORTINGTOID, DEPTCODE, DEPARTMENT
        FROM BI_USERMASTER
        WHERE USER_ACTIVE = 'Y'
          AND USERTYPE = 'U'
          AND EMP_ID != '0'
          AND (
            USER_ID = '${safeId}'
            OR TO_NVARCHAR(EMP_ID) = '${safeId}'
            OR TO_NVARCHAR(SLNO) = '${safeId}'
          )
      `;
      const rows = await exec<BiUser[]>(conn, sql);
      const manager = rows?.[0];
      if (!manager) break;

      if (Number(manager.DEPTCODE) === Number(departmentCode)) {
        managers.push(manager);
      }

      currentId = manager.REPORTINGTOID;
    }

    return managers;
  });
}

export { sameIdentifier, normalizeEmail };
