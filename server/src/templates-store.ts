import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { StoredTemplate, TemplateSection } from "./template-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "templates.json");

function migrateSection(raw: Partial<TemplateSection> & { title: string }): TemplateSection {
  return {
    id: raw.id ?? randomUUID(),
    title: raw.title,
    content: raw.content ?? "<p></p>",
  };
}

function migrateTemplate(raw: Partial<StoredTemplate> & { id: string }): StoredTemplate {
  const now = new Date().toISOString();
  return {
    id: raw.id,
    name: raw.name ?? "Untitled Template",
    description: raw.description ?? "",
    departmentCode: Number(raw.departmentCode ?? 0),
    departmentName: raw.departmentName ?? "",
    sections: (raw.sections ?? []).map(migrateSection),
    source: raw.source === "word" ? "word" : "manual",
    createdByEmail: raw.createdByEmail ?? "",
    createdByName: raw.createdByName ?? "",
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

async function readAll(): Promise<StoredTemplate[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<Partial<StoredTemplate> & { id: string }>;
    return (parsed ?? []).map(migrateTemplate);
  } catch {
    return [];
  }
}

async function writeAll(templates: StoredTemplate[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(templates, null, 2), "utf8");
}

export async function listTemplates(filters?: { departmentCode?: number }) {
  let templates = await readAll();
  if (filters?.departmentCode != null) {
    templates = templates.filter(
      (item) => item.departmentCode === filters.departmentCode,
    );
  }
  return templates.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getTemplateById(id: string) {
  const templates = await readAll();
  const template = templates.find((item) => item.id === id);
  return template ? migrateTemplate(template) : null;
}

export async function saveTemplate(input: StoredTemplate) {
  const templates = await readAll();
  const template = migrateTemplate(input);
  const index = templates.findIndex((item) => item.id === template.id);
  if (index >= 0) templates[index] = template;
  else templates.unshift(template);
  await writeAll(templates);
  return template;
}

export async function deleteTemplate(id: string) {
  const templates = await readAll();
  await writeAll(templates.filter((item) => item.id !== id));
}

export async function ensureTemplateStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeAll([]);
  }
}
