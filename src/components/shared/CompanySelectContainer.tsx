import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import CompanySelect from "@/components/shared/CompanySelect";
import { useAuth } from "@/context/AuthContext";
import { fetchCompanies } from "@/lib/api";
import type { CompanyOption } from "@/lib/types";

interface CompanySelectContainerProps {
  value: string;
  onChange: (company: CompanyOption | null) => void;
  label?: string;
  disabled?: boolean;
}

export default function CompanySelectContainer({
  value,
  onChange,
  label,
  disabled,
}: CompanySelectContainerProps) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  const { data: companies = [], isLoading, isError, error } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await fetchCompanies();
      return response.result.map((item) => ({
        code: item.BRANCH,
        name: item.COMPANY?.trim() || item.BRANCH,
      }));
    },
    enabled: isAuthenticated && !isBootstrapping,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load companies");
    }
  }, [isError, error]);

  useEffect(() => {
    if (value || companies.length !== 1) return;
    onChange(companies[0] ?? null);
  }, [companies, onChange, value]);

  return (
    <CompanySelect
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      companies={companies}
      isLoading={isLoading || isBootstrapping}
      isError={isError}
    />
  );
}
