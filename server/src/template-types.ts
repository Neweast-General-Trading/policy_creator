export interface TemplateSection {
  id: string;
  title: string;
  content: string;
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
