import { FileStack, GitBranch, LayoutDashboard, LogOut, Menu, PenLine, ShieldUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentPage:
    | "dashboard"
    | "policies-list"
    | "templates"
    | "approval-setup"
    | "create-entry"
    | "create"
    | "edit"
    | "view"
    | "duplicate";
  canManageApprovalSetup?: boolean;
  onNavigateDashboard: () => void;
  onNavigateCreate: () => void;
  onNavigateTemplates: () => void;
  onNavigateApprovalSetup?: () => void;
}

export default function TopBar({
  onToggleSidebar,
  currentPage,
  canManageApprovalSetup = false,
  onNavigateDashboard,
  onNavigateCreate,
  onNavigateTemplates,
  onNavigateApprovalSetup,
}: TopBarProps) {
  const { user, logout } = useAuth();

  const navButtonClass = (active: boolean) =>
    cn(
      "gap-2",
      active && "bg-red-50 text-red-700 hover:bg-red-50 hover:text-red-700",
    );

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldUser className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Policy Creator</h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              Create and manage internal policy documents
            </p>
          </div>
        </div>
        <nav className="ms-2 hidden items-center gap-1 md:flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={navButtonClass(currentPage === "dashboard" || currentPage === "policies-list")}
            onClick={onNavigateDashboard}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={navButtonClass(currentPage === "templates")}
            onClick={onNavigateTemplates}
          >
            <FileStack className="h-4 w-4" />
            Templates
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={navButtonClass(
              currentPage === "create-entry" ||
              currentPage === "create" ||
              currentPage === "edit" ||
              currentPage === "duplicate",
            )}
            onClick={onNavigateCreate}
          >
            <PenLine className="h-4 w-4" />
            Create Policy
          </Button>
          {canManageApprovalSetup && onNavigateApprovalSetup ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={navButtonClass(currentPage === "approval-setup")}
              onClick={onNavigateApprovalSetup}
            >
              <GitBranch className="h-4 w-4" />
              Approval Setup
            </Button>
          ) : null}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium text-slate-900">{user?.name}</div>
          <div className="text-xs text-slate-500">{user?.email}</div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => logout()}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
