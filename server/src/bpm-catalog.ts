import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    host: process.env.BPM_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.BPM_DB_PORT ?? 55432),
    user: process.env.BPM_DB_USER ?? "postgres",
    password: process.env.BPM_DB_PASSWORD ?? "postgres",
    database: process.env.BPM_DB_NAME ?? "bpm",
    max: 5,
  });
  return pool;
}

const POLICY_TO_BPM_COMPANY: Record<string, string> = {
  BI_NEGT: "FZCO",
  BI_NEGTLLC: "LLC",
  BI_NESA: "NESA",
  BI_NEGT_AUTOLLC: "FZCO",
  BI_NEGT_KSAISUZU: "ISUZU",
  BI_NEGT_KSAPARTS: "ISUZU",
};

/** HANA department name → BPM org / process-function name hints */
const HANA_DEPT_ORG_ALIASES: Record<string, string[]> = {
  planning: ["planning and procurement", "planning procurement", "planning & procurement"],
  "purchase procurement": [
    "planning and procurement",
    "planning procurement",
    "planning & procurement",
  ],
  "hr administration": ["hr", "human resources"],
  "internal audit risk compliance": ["internal audit", "audit"],
  "business alliance": ["business & it", "business and it"],
  administration: ["master data", "hr"],
  "domestic sales uae": ["sales"],
  "international sales baniyas": ["sales"],
  operations: ["operation"],
  it: ["business & it", "business and it"],
  finance: ["finance", "finance & accounts"],
};

export function mapPolicyCompanyToBpm(companyCode: string) {
  return POLICY_TO_BPM_COMPANY[companyCode] ?? companyCode.replace(/^BI_/, "").slice(0, 16);
}

export interface BpmProcessFunction {
  id: string;
  code: string;
  name: string;
  companyCode: string;
  orgDepartmentName: string | null;
}

export interface BpmProcess {
  id: string;
  code: string;
  processName: string;
  name: string;
  departmentId: string;
}

export interface BpmSubProcess {
  id: string;
  code: string;
  activityName: string;
  parentActivityId: string | null;
}

function normalizeDeptToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function tokenSet(value: string) {
  return new Set(normalizeDeptToken(value).split(" ").filter(Boolean));
}

function aliasMatchesTarget(target: string, candidate: string) {
  const aliases = HANA_DEPT_ORG_ALIASES[target] ?? [];
  return aliases.some(
    (alias) => candidate === alias || candidate.includes(alias) || alias.includes(candidate),
  );
}

function departmentMatchScore(
  deptName: string,
  bpmName: string,
  orgName: string | null,
): number {
  const target = normalizeDeptToken(deptName);
  if (!target) return 0;

  let best = 0;
  for (const rawCandidate of [bpmName, orgName ?? ""]) {
    const candidate = normalizeDeptToken(rawCandidate);
    if (!candidate) continue;

    if (candidate === target) {
      return 100;
    }

    if (candidate.includes(target) || target.includes(candidate)) {
      best = Math.max(best, 85);
    }

    if (aliasMatchesTarget(target, candidate)) {
      best = Math.max(best, 90);
    }

    const left = tokenSet(target);
    const right = tokenSet(candidate);
    const shared = [...left].filter((token) => right.has(token)).length;
    if (shared > 0) {
      const overlap = shared / Math.max(left.size, right.size, 1);
      best = Math.max(best, Math.round(overlap * 75));
    }
  }

  return best;
}

async function loadProcessFunctions(companyCode: string) {
  const bpmCompany = mapPolicyCompanyToBpm(companyCode);
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{
      id: string;
      code: string;
      name: string;
      companyCode: string;
      orgDepartmentName: string | null;
    }>(
      `
      SELECT d.id, d.code, d.name, d."companyCode", od.name AS "orgDepartmentName"
      FROM departments d
      LEFT JOIN org_departments od ON od.id = d."orgDepartmentId"
      WHERE d."companyCode" = $1
      ORDER BY d.code, d.name
      `,
      [bpmCompany],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function resolveProcessFunctionForDepartment(
  companyCode: string,
  departmentName: string,
): Promise<BpmProcessFunction | null> {
  const rows = await loadProcessFunctions(companyCode);
  const scored = rows
    .map((row) => ({
      row,
      score: departmentMatchScore(departmentName, row.name, row.orgDepartmentName),
    }))
    .filter((item) => item.score >= 35)
    .sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code));

  const best = scored[0]?.row;
  if (!best) return null;

  return {
    id: best.id,
    code: best.code,
    name: best.name,
    companyCode: best.companyCode,
    orgDepartmentName: best.orgDepartmentName,
  };
}

export async function listProcessFunctionsForDepartment(
  companyCode: string,
  departmentName: string,
): Promise<BpmProcessFunction[]> {
  const match = await resolveProcessFunctionForDepartment(companyCode, departmentName);
  return match ? [match] : [];
}

export async function listProcessesForFunction(departmentId: string): Promise<BpmProcess[]> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{
      id: string;
      code: string;
      processName: string;
      name: string;
      departmentId: string;
    }>(
      `
      SELECT id, code, "processName", name, "departmentId"
      FROM processes
      WHERE "departmentId" = $1
      ORDER BY code, "processName"
      `,
      [departmentId],
    );
    return rows;
  } finally {
    client.release();
  }
}

export interface BpmApplication {
  id: string;
  name: string;
  vendor: string | null;
  category: string;
  status: string;
}

export async function listApplications(): Promise<BpmApplication[]> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<BpmApplication>(
      `
      SELECT id, name, vendor, category, status
      FROM applications
      WHERE status = 'Active'
      ORDER BY name
      `,
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function listSubProcessesForProcess(processId: string): Promise<BpmSubProcess[]> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{
      id: string;
      code: string;
      activityName: string;
      parentActivityId: string | null;
    }>(
      `
      SELECT id, code, "activityName", "parentActivityId"
      FROM activities
      WHERE "processId" = $1
      ORDER BY sln, code
      `,
      [processId],
    );
    return rows;
  } finally {
    client.release();
  }
}
