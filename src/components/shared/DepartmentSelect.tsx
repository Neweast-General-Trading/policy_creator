import { useQuery } from "@tanstack/react-query";
import { SelectField } from "@/components/ui/select-field";
import { fetchDepartments } from "@/lib/api";
import type { Department } from "@/lib/types";

interface DepartmentSelectProps {
  value: number | null;
  companyCode?: string;
  onChange: (department: Department | null) => void;
  label?: string;
  disabled?: boolean;
}

export default function DepartmentSelect({
  value,
  companyCode,
  onChange,
  label = "Department",
  disabled = false,
}: DepartmentSelectProps) {
  const canLoad = companyCode === undefined || Boolean(companyCode);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments", companyCode ?? "default"],
    queryFn: () => fetchDepartments(companyCode),
    enabled: canLoad,
  });

  return (
    <SelectField
      label={label}
      value={value ?? ""}
      disabled={disabled || isLoading || (companyCode !== undefined && !companyCode)}
      onChange={(event) => {
        const code = Number(event.target.value);
        const department =
          departments.find((item) => item.code === code) ?? null;
        onChange(department);
      }}
    >
      <option value="">
        {companyCode !== undefined && !companyCode
          ? "Select company first"
          : isLoading
            ? "Loading departments..."
            : "Select department"}
      </option>
      {departments.map((department) => (
        <option key={department.code} value={department.code}>
          {department.name}
        </option>
      ))}
    </SelectField>
  );
}
