import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Hammer,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-session";
import {
  fetchAllSettings,
  updateSetting,
  type AppSettingsMap,
  type GeneralSettings,
  type CronJobSettings,
  type FollowUpSettings,
} from "@/lib/settings";
import { logActivity } from "@/lib/audit";
import { PageHeading } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "System Settings | Deeper Life Attendance" },
      { name: "description", content: "Configure cron jobs, pastor email, maintenance mode, and app preferences." },
      { property: "og:title", content: "System Settings | Deeper Life Attendance" },
      { property: "og:description", content: "Configure cron jobs, pastor email, maintenance mode, and app preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading, userId, name, email } = useSession();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["app_settings"],
    queryFn: fetchAllSettings,
    enabled: isAdmin,
  });

  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJobSettings | null>(null);
  const [followUp, setFollowUp] = useState<FollowUpSettings | null>(null);

  // Synchronize state when query loads
  useEffect(() => {
    if (settingsQuery.data) {
      setGeneral(settingsQuery.data.general);
      setCronJobs(settingsQuery.data.cron_jobs);
      setFollowUp(settingsQuery.data.follow_up);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: AppSettingsMap) => {
      await Promise.all([
        updateSetting("general", payload.general, userId),
        updateSetting("cron_jobs", payload.cron_jobs, userId),
        updateSetting("follow_up", payload.follow_up, userId),
      ]);

      await logActivity({
        action: "updated_system_settings",
        entityType: "settings",
        entityId: "system",
        entityTitle: "Application System Settings",
        actor: { id: userId || "", name, email },
        details: {
          pastor_email: payload.general.pastor_email,
          maintenance_mode: payload.general.maintenance_mode,
          sunday_summary_enabled: payload.cron_jobs.sunday_summary_enabled,
          monthly_report_enabled: payload.cron_jobs.monthly_report_enabled,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save settings.");
    },
  });

  if (loading || settingsQuery.isLoading || !general || !cronJobs || !followUp) {
    return (
      <div>
        <PageHeading title="System Settings" subtitle="Configure automated reports, crons, maintenance mode, and notifications." />
        <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
          Loading system settings...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md text-center py-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Only church system administrators have permission to modify automation and system settings.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    saveMutation.mutate({
      general,
      cron_jobs: cronJobs,
      follow_up: followUp,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeading
        title="System Settings"
        subtitle="Manage automation crons, pastor email destination, maintenance mode, and follow-up thresholds."
        action={
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2 bg-primary text-primary-foreground font-semibold shadow-xs"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving Changes..." : "Save Settings"}
          </Button>
        }
      />

      {/* Maintenance Mode Warning if Active */}
      {general.maintenance_mode && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
          <div className="bg-amber-500 text-white rounded-xl p-2 shrink-0">
            <Hammer className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-950 dark:text-amber-200">
              Maintenance Mode is Currently Active
            </h4>
            <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-300/80 mt-0.5">
              Attendance takers will see a maintenance notice upon logging in. System admins retain full access.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* General & Email Destination */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 text-primary p-2 rounded-xl">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Leadership Email & Church Details</CardTitle>
                <CardDescription className="text-xs">Destination email for attendance reports and summaries.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pastor_email" className="text-xs font-semibold">
                Pastor / Leadership Email
              </Label>
              <Input
                id="pastor_email"
                type="email"
                value={general.pastor_email}
                onChange={(e) => setGeneral({ ...general, pastor_email: e.target.value })}
                placeholder="pastor@example.com"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                All scheduled Sunday attendance summaries and monthly reports will be dispatched directly to this email address.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="church_name" className="text-xs font-semibold">
                Church / Branch Name
              </Label>
              <Input
                id="church_name"
                value={general.church_name}
                onChange={(e) => setGeneral({ ...general, church_name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Mode & Operations */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-xl">
                <Hammer className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Maintenance Mode</CardTitle>
                <CardDescription className="text-xs">Temporarily pause non-admin app usage for updates.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between gap-4 p-3 surface rounded-xl border border-border/60">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance_toggle" className="text-sm font-semibold cursor-pointer">
                  Enable Maintenance Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Restricts attendance submissions while you perform audits or upgrades.
                </p>
              </div>
              <Switch
                id="maintenance_toggle"
                checked={general.maintenance_mode}
                onCheckedChange={(checked) => setGeneral({ ...general, maintenance_mode: checked })}
              />
            </div>

            {general.maintenance_mode && (
              <div className="space-y-1.5">
                <Label htmlFor="maintenance_msg" className="text-xs font-semibold">
                  Notice Message for Users
                </Label>
                <Textarea
                  id="maintenance_msg"
                  value={general.maintenance_message}
                  onChange={(e) => setGeneral({ ...general, maintenance_message: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Automation & Cron Schedulers */}
        <Card className="rounded-2xl border-border/70 shadow-xs md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Automated Cron Jobs & Reports</CardTitle>
                <CardDescription className="text-xs">Turn specific background schedules on or off.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Sunday 5:20 PM Summary */}
              <div className="surface p-4 rounded-xl border border-border/60 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Sunday 5:20 PM Summary</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dispatches exact breakdown text: Adults (M/F), Youth (M/F), Children (M/F) + Total to pastor email.
                  </p>
                </div>
                <Switch
                  checked={cronJobs.sunday_summary_enabled}
                  onCheckedChange={(val) => setCronJobs({ ...cronJobs, sunday_summary_enabled: val })}
                />
              </div>

              {/* Sunday 3:00 PM Reminder */}
              <div className="surface p-4 rounded-xl border border-border/60 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm">Sunday 3:00 PM Reminder</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notifies attendance takers if Sunday attendance is still pending at 3:00 PM.
                  </p>
                </div>
                <Switch
                  checked={cronJobs.sunday_reminder_enabled}
                  onCheckedChange={(val) => setCronJobs({ ...cronJobs, sunday_reminder_enabled: val })}
                />
              </div>

              {/* Monthly Attendance Breakdown */}
              <div className="surface p-4 rounded-xl border border-border/60 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span className="font-semibold text-sm">Monthly End-of-Month Report</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sends detailed monthly member fidelity statistics and participation rates.
                  </p>
                </div>
                <Switch
                  checked={cronJobs.monthly_report_enabled}
                  onCheckedChange={(val) => setCronJobs({ ...cronJobs, monthly_report_enabled: val })}
                />
              </div>

              {/* Worker Prioritization */}
              <div className="surface p-4 rounded-xl border border-border/60 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-sm">Prioritize Workers in Monthly Report</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Groups church workers into a prominent top section in the report with [WORKER] tags.
                  </p>
                </div>
                <Switch
                  checked={cronJobs.monthly_report_prioritize_workers}
                  onCheckedChange={(val) => setCronJobs({ ...cronJobs, monthly_report_prioritize_workers: val })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Urgent Follow-Up Config */}
        <Card className="rounded-2xl border-border/70 shadow-xs md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-2 rounded-xl">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Urgent Follow-Up Preferences</CardTitle>
                <CardDescription className="text-xs">Configure criteria for urgent member alerts and ads-style modal popup.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-4 p-3 surface rounded-xl border border-border/60">
                <div className="space-y-0.5">
                  <Label htmlFor="popup_toggle" className="text-sm font-semibold cursor-pointer">
                    Urgent Alert Modal Popup
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically prompt taker/admin on session load when members have missed 3+ consecutive services.
                  </p>
                </div>
                <Switch
                  id="popup_toggle"
                  checked={followUp.popup_alert_enabled}
                  onCheckedChange={(checked) => setFollowUp({ ...followUp, popup_alert_enabled: checked })}
                />
              </div>

              <div className="p-3 surface rounded-xl border border-border/60 space-y-1.5">
                <Label htmlFor="threshold_input" className="text-xs font-semibold">
                  Consecutive Absences to Trigger Alert
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="threshold_input"
                    type="number"
                    min={2}
                    max={10}
                    value={followUp.consecutive_absence_threshold}
                    onChange={(e) =>
                      setFollowUp({
                        ...followUp,
                        consecutive_absence_threshold: parseInt(e.target.value || "3", 10),
                      })
                    }
                    className="h-8 text-sm w-24"
                  />
                  <span className="text-xs text-muted-foreground">services in a row</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          size="lg"
          className="gap-2 bg-primary text-primary-foreground font-semibold px-6 shadow-md"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving Changes..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}
