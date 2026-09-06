import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  Users,
  CalendarDays,
  BarChart3,
  KeyRound,
  History,
  Bell,
  AlertTriangle,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useAttendanceReminders } from "@/hooks/use-attendance-reminders";
import { initials } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "./Brand";
import { NotificationPromptModal, triggerNotificationModal } from "./NotificationPromptModal";
import { UrgentFollowUpModal } from "./UrgentFollowUpModal";

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
  const {
    isReminderActive,
    pendingService,
    permission,
    requestNotificationPermission,
    dismissReminder,
  } = useAttendanceReminders();

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
            {permission !== "granted" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Enable notifications"
                title="Enable attendance reminders"
                onClick={() => triggerNotificationModal()}
                className="relative text-depth-foreground hover:bg-sidebar-accent"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400" />
              </Button>
            )}
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

      {/* Urgent Sunday Attendance Reminder Banner */}
      {isReminderActive && pendingService && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-rose-500 text-white rounded-lg p-1.5 shrink-0 animate-pulse">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-rose-950 dark:text-rose-200">
                <strong className="font-semibold">Sunday Attendance Reminder:</strong> Attendance
                for <span className="underline font-semibold">{pendingService.name}</span> has not
                been submitted yet!
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {permission !== "granted" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestNotificationPermission()}
                  className="h-8 text-xs bg-background/80 border-rose-300 dark:border-rose-800 hover:bg-background text-foreground"
                >
                  <Bell className="mr-1.5 h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  Enable Browser Push
                </Button>
              )}
              <Link to="/attendance/$serviceId" params={{ serviceId: pendingService.id }}>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-sm font-semibold"
                >
                  Take Attendance Now →
                </Button>
              </Link>
              <button
                type="button"
                onClick={dismissReminder}
                aria-label="Dismiss banner"
                className="text-rose-700 dark:text-rose-300 hover:opacity-75 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      {/* Pop-up Dialog Prompting User to Enable Notifications */}
      <NotificationPromptModal />

      {/* Pop-up Alert Modal for Urgent Follow-ups */}
      <UrgentFollowUpModal />
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
