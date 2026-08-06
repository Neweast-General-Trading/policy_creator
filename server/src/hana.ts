import hana from "@sap/hana-client";
import type { Connection } from "@sap/hana-client";

const hanaConfig = (schema?: string) => ({
  serverNode: process.env.SERVER_NODE!,
  uid: process.env.SAP_HANA_USER!,
  pwd: process.env.SAP_HANA_PASSWORD!,
  currentSchema: schema ?? process.env.SAP_HANA_SCHEMA ?? "BI_NEGT",
  pooling: true,
  connectionLifetime: 1800,
});

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

export type CompanyRow = {
  USER_ID: string;
  USER_NAME: string;
  BRANCH: string;
  COMPANY: string;
  LEGISLATIONCODE: string;
};

export type DepartmentRow = {
  DEPTCODE: number;
  DEPARTMENT: string;
};

export async function fetchCompanies(email: string): Promise<CompanyRow[]> {
  const safeEmail = email.replace(/'/g, "''");
  const sql = `CALL BI_INTRA_MENU('GETBRANCH','','${safeEmail}')`;
  const defaultSchema = process.env.SAP_HANA_SCHEMA ?? "BI_NEGT";

  return withConnection(defaultSchema, async (conn) => {
    const rows = await exec<CompanyRow[]>(conn, sql);
    const seen = new Set<string>();
    return (rows ?? []).filter((row) => {
      if (!row?.BRANCH || seen.has(row.BRANCH)) return false;
      seen.add(row.BRANCH);
      return true;
    });
  });
}

export async function resolveCompaniesForUser(candidates: string[]) {
  const tried = new Set<string>();
  for (const candidate of candidates) {
    const email = candidate.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);

    const companies = await fetchCompanies(email);
    if (companies.length > 0) {
      return { email, companies };
    }
  }

  return { email: candidates.find((item) => item.trim())?.trim() ?? "", companies: [] as CompanyRow[] };
}

export type IntranetMenuItem = {
  GROUPNAME?: string;
  GROUPNAMEAR?: string;
  ADDRESS?: string;
  MENUICON?: string;
};

export async function fetchIntranetMenu(
  userId: string,
  companyCode: string,
): Promise<IntranetMenuItem[]> {
  const safeUserId = userId.replace(/'/g, "''");
  const safeCompanyCode = companyCode.replace(/'/g, "''");
  const sql = `CALL BI_INTRA_MENU('IntranetMenu','${safeCompanyCode}','${safeUserId}')`;
  const defaultSchema = process.env.SAP_HANA_SCHEMA ?? "BI_NEGT";

  return withConnection(defaultSchema, async (conn) => {
    const rows = await exec<IntranetMenuItem[]>(conn, sql);
    return rows ?? [];
  });
}

export async function fetchDepartments(companyCode?: string): Promise<DepartmentRow[]> {
  const schema = companyCode?.trim() || process.env.SAP_HANA_SCHEMA || "BI_NEGT";
  const sql = `
    SELECT DISTINCT DEPTCODE, DEPARTMENT
    FROM BI_USERMASTER
    WHERE USER_ACTIVE = 'Y'
      AND USERTYPE = 'U'
      AND DEPARTMENT IS NOT NULL
      AND TO_NVARCHAR(DEPARTMENT) <> ''
    ORDER BY DEPARTMENT
  `;

  return withConnection(schema, async (conn) => {
    const rows = await exec<DepartmentRow[]>(conn, sql);
    const seen = new Set<number>();
    return (rows ?? []).filter((row) => {
      if (!row?.DEPTCODE || seen.has(row.DEPTCODE)) return false;
      seen.add(row.DEPTCODE);
      return true;
    });
  });
}
