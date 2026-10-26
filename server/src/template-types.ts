export interface TemplateSection {
  id: string;
  title: string;
  content: string;
  businessRules?: string[];
  applyToApplications?: Array<{ id: string; name: string }>;
}

export interface StoredTemplate {
  id: string;
  name: string;
  description: string;
  departmentCode: number;
  departmentName: string;
  sections: TemplateSection[];
  source: "manual" | "word";
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
