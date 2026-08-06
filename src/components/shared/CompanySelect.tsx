import { SelectField } from "@/components/ui/select-field";
import type { CompanyOption } from "@/lib/types";

interface CompanySelectProps {
  value: string;
  onChange: (company: CompanyOption | null) => void;
  label?: string;
  disabled?: boolean;
  companies: CompanyOption[];
  isLoading?: boolean;
  isError?: boolean;
}

export default function CompanySelect({
  value,
  onChange,
  label = "Company",
  disabled = false,
  companies,
  isLoading = false,
  isError = false,
}: CompanySelectProps) {
  return (
    <SelectField
      label={label}
      value={value}
      disabled={disabled || isLoading}
      onChange={(event) => {
        const company = companies.find((item) => item.code === event.target.value);
        onChange(company ?? null);
      }}
    >
      <option value="">
        {isLoading
          ? "Loading companies..."
          : isError
            ? "Failed to load companies"
            : companies.length === 0
              ? "No companies available"
              : "Select company"}
      </option>
      {companies.map((company) => (
        <option key={company.code} value={company.code}>
          {company.name}
        </option>
      ))}
    </SelectField>
  );
}
