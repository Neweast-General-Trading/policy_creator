import sql from "mssql";
import type { BiUser } from "./bi-users.js";

let pool: sql.ConnectionPool | null = null;
let designationCache: { loadedAt: number; map: Map<string, string> } | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000;

function sqlConfig(): sql.config {
  const password = String(process.env.SQL_DB_PASSWORD ?? "").replace(/^"|"$/g, "");
  return {
    user: process.env.SQL_DB_USER,
    password,
    server: process.env.SQL_DB_SERVER ?? "",
    database: process.env.SQL_DB_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

async function getPool() {
  if (!process.env.SQL_DB_SERVER || !process.env.SQL_DB_DATABASE) {
    throw new Error("SQL payroll database is not configured");
  }
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(sqlConfig()).connect();
  return pool;
}

export async function getPayrollDesignationMap() {
  if (designationCache && Date.now() - designationCache.loadedAt < CACHE_TTL_MS) {
    return designationCache.map;
  }

  const db = await getPool();
  const result = await db.request().query(`
    SELECT
      LTRIM(RTRIM(EmpId)) AS EmpId,
      LTRIM(RTRIM(DesignationName)) AS DesignationName
    FROM Payroll_Employee
    WHERE EmpActive = 'Y'
      AND DesignationName IS NOT NULL
      AND LTRIM(RTRIM(DesignationName)) <> ''
  `);

  const map = new Map<string, string>();
  for (const row of result.recordset ?? []) {
    const empId = String(row.EmpId ?? "").trim();
    const designation = String(row.DesignationName ?? "").trim();
    if (!empId || !designation) continue;
    if (!map.has(empId)) {
      map.set(empId, designation);
    }
  }

  designationCache = { loadedAt: Date.now(), map };
  return map;
}

export function resolvePayrollDesignation(
  user: Pick<BiUser, "USER_ID" | "EMP_ID" | "ORACLEEMPID" | "DESIGNATION">,
  map: Map<string, string>,
) {
  const fromBi = String(user.DESIGNATION ?? "").trim();
  if (fromBi) return fromBi;

  const candidates = [
    String(user.USER_ID ?? "").trim(),
    String(user.EMP_ID ?? "").trim(),
    String(user.ORACLEEMPID ?? "").trim(),
  ].filter((value) => value && value !== "0");

  for (const key of candidates) {
    const designation = map.get(key);
    if (designation) return designation;
  }

  return "";
}

export async function enrichBiUsersWithPayrollDesignations<T extends BiUser>(users: T[]) {
  if (users.length === 0) return users;

  try {
    const map = await getPayrollDesignationMap();
    return users.map((user) => {
      const designation = resolvePayrollDesignation(user, map);
      if (!designation) return user;
      return { ...user, DESIGNATION: designation };
    });
  } catch (error) {
    console.warn(
      "Payroll designation enrichment failed:",
      error instanceof Error ? error.message : error,
    );
    return users;
  }
}
