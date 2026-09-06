import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Users, CalendarDays, BarChart3, KeyRound, History } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { initials } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "./Brand";

const NAV = [
  { to: "/dashboard", label: "Services", icon: CalendarDays },
  { to: "/members", label: "Members", icon: Users },
  { to: "/reports", label: "Analysis", icon: BarChart3 },
  { to: "/audit", label: "Audit Log", icon: History },
  { to: "/accounts", label: "Accounts", icon: KeyRound, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { name, role, isAdmin } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Auto logout after 10 minutes of inactivity
  useIdleTimeout(10 * 60 * 1000);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const items = NAV.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-depth-gradient text-depth-foreground sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/dashboard">
            <BrandLockup compact />
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm leading-tight font-semibold">{name}</div>
              <div className="text-[10px] tracking-[0.18em] uppercase opacity-65">
                {role === "admin" ? "Admin" : "Attendance taker"}
              </div>
            </div>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground font-display grid h-9 w-9 place-items-center rounded-full text-sm font-semibold">
              {initials(name)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={signOut}
              className="text-depth-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-medium opacity-65 transition-colors data-[status=active]:bg-[var(--background)] data-[status=active]:text-[var(--foreground)] data-[status=active]:opacity-100"
                activeProps={{ className: "opacity-100" }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
