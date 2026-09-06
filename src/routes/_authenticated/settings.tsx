import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Clock,
  Hammer,
  Mail,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-session";
import {
  fetchAllSettings,
  updateSetting,
  type AppSettingsMap,
  type GeneralSettings,
  type AutomationSettings,
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
      { name: "description", content: "Configure automated summary schedules, pastor email, and maintenance mode." },
      { property: "og:title", content: "System Settings | Deeper Life Attendance" },
      { property: "og:description", content: "Configure automated summary schedules, pastor email, and maintenance mode." },
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
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);

  // Synchronize state when query loads
  useEffect(() => {
    if (settingsQuery.data) {
      setGeneral(settingsQuery.data.general);
      setAutomation(settingsQuery.data.automation);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: AppSettingsMap) => {
      await Promise.all([
        updateSetting("general", payload.general, userId),
        updateSetting("automation", payload.automation, userId),
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
          sunday_summary_time: payload.automation.sunday_summary_time,
          sunday_reminder_time: payload.automation.sunday_reminder_time,
          sunday_summary_enabled: payload.automation.sunday_summary_enabled,
          monthly_report_enabled: payload.automation.monthly_report_enabled,
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

  if (loading || settingsQuery.isLoading || !general || !automation) {
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
      automation,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeading
        title="System Settings"
        subtitle="Manage automation delivery times, pastor email destination, and maintenance mode."
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

      <div className="grid gap-6">
        {/* 1. Automated Schedules & Dispatch Times */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 text-primary p-2 rounded-xl">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Automated Reports & Delivery Times</CardTitle>
                <CardDescription className="text-xs">
                  Configure when attendance summaries and taker reminders are sent.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            {/* Sunday Summary Time & Toggle */}
            <div className="surface p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Sunday Attendance Summary</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sends the exact breakdown (Adults M/F, Youth M/F, Children M/F, and Total) directly to pastor email.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sunday_time" className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Delivery Time
                  </Label>
                  <Input
                    id="sunday_time"
                    type="time"
                    value={automation.sunday_summary_time}
                    onChange={(e) =>
                      setAutomation({ ...automation, sunday_summary_time: e.target.value })
                    }
                    className="h-9 w-28 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Status
                  </Label>
                  <Switch
                    checked={automation.sunday_summary_enabled}
                    onCheckedChange={(val) =>
                      setAutomation({ ...automation, sunday_summary_enabled: val })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Sunday Reminder Time & Toggle */}
            <div className="surface p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-sm">Sunday Attendance Pending Reminder</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alerts attendance takers if Sunday service attendance has not been submitted yet.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reminder_time" className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Reminder Time
                  </Label>
                  <Input
                    id="reminder_time"
                    type="time"
                    value={automation.sunday_reminder_time}
                    onChange={(e) =>
                      setAutomation({ ...automation, sunday_reminder_time: e.target.value })
                    }
                    className="h-9 w-28 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Status
                  </Label>
                  <Switch
                    checked={automation.sunday_reminder_enabled}
                    onCheckedChange={(val) =>
                      setAutomation({ ...automation, sunday_reminder_enabled: val })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Monthly Breakdown Report */}
            <div className="surface p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold text-sm">Monthly Attendance Report (End of Month)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sends comprehensive monthly breakdown to pastor email with church worker fidelity prioritized at the top.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-1 flex flex-col items-center">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Status
                  </Label>
                  <Switch
                    checked={automation.monthly_report_enabled}
                    onCheckedChange={(val) =>
                      setAutomation({ ...automation, monthly_report_enabled: val })
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Email Destination & Church Details */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded-xl">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Leadership Email & Church Information</CardTitle>
                <CardDescription className="text-xs">
                  Where automated attendance reports and summaries will be sent.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pastor_email" className="text-xs font-semibold">
                  Pastor / Leadership Email Address
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
                  All Sunday summaries and monthly reports are delivered directly to this address.
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
            </div>
          </CardContent>
        </Card>

        {/* 3. Maintenance Mode */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-xl">
                <Hammer className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Maintenance Mode</CardTitle>
                <CardDescription className="text-xs">
                  Temporarily pause non-admin attendance entry while performing maintenance.
                </CardDescription>
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
                  Displays maintenance notice to attendance takers during database or system upgrades.
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
