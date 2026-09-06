import { supabase } from "@/integrations/supabase/client";

export interface GeneralSettings {
  pastor_email: string;
  church_name: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

export interface CronJobSettings {
  sunday_summary_enabled: boolean;
  sunday_summary_time: string;
  sunday_reminder_enabled: boolean;
  sunday_reminder_time: string;
  monthly_report_enabled: boolean;
  monthly_report_prioritize_workers: boolean;
}

export interface FollowUpSettings {
  consecutive_absence_threshold: number;
  popup_alert_enabled: boolean;
  chronic_absence_rate_percent: number;
}

export interface AppSettingsMap {
  general: GeneralSettings;
  cron_jobs: CronJobSettings;
  follow_up: FollowUpSettings;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  pastor_email: "stedarol@gmail.com",
  church_name: "Deeper Life Bible Church Pontypridd",
  maintenance_mode: false,
  maintenance_message: "System is currently undergoing scheduled maintenance. Please check back shortly.",
};

export const DEFAULT_CRON_SETTINGS: CronJobSettings = {
  sunday_summary_enabled: true,
  sunday_summary_time: "17:20",
  sunday_reminder_enabled: true,
  sunday_reminder_time: "15:00",
  monthly_report_enabled: true,
  monthly_report_prioritize_workers: true,
};

export const DEFAULT_FOLLOW_UP_SETTINGS: FollowUpSettings = {
  consecutive_absence_threshold: 3,
  popup_alert_enabled: true,
  chronic_absence_rate_percent: 40,
};

export async function fetchAllSettings(): Promise<AppSettingsMap> {
  const { data, error } = await supabase.from("app_settings" as any).select("*");

  const result: AppSettingsMap = {
    general: { ...DEFAULT_GENERAL_SETTINGS },
    cron_jobs: { ...DEFAULT_CRON_SETTINGS },
    follow_up: { ...DEFAULT_FOLLOW_UP_SETTINGS },
  };

  if (!error && data) {
    for (const row of data as any[]) {
      if (row.id === "general") result.general = { ...DEFAULT_GENERAL_SETTINGS, ...row.value };
      if (row.id === "cron_jobs") result.cron_jobs = { ...DEFAULT_CRON_SETTINGS, ...row.value };
      if (row.id === "follow_up") result.follow_up = { ...DEFAULT_FOLLOW_UP_SETTINGS, ...row.value };
    }
  }

  return result;
}

export async function updateSetting<K extends keyof AppSettingsMap>(
  key: K,
  value: AppSettingsMap[K],
  userId?: string | null,
): Promise<void> {
  const { error } = await supabase.from("app_settings" as any).upsert(
    {
      id: key,
      value: value as any,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Failed to save ${key} settings: ${error.message}`);
  }
}
