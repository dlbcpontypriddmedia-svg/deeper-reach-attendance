-- Create app_settings table for dynamic system configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- Policies: Everyone authenticated can view settings (e.g. check maintenance mode), only admins can modify
CREATE POLICY "Allow authenticated read access on app_settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins write access on app_settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings
INSERT INTO public.app_settings (id, description, value)
VALUES
  ('general', 'General Application Configuration', '{
    "pastor_email": "stedarol@gmail.com",
    "church_name": "Deeper Life Bible Church Pontypridd",
    "maintenance_mode": false,
    "maintenance_message": "System is currently undergoing scheduled maintenance. Please check back shortly."
  }'::jsonb),
  ('cron_jobs', 'Scheduled Automation & Summary Settings', '{
    "sunday_summary_enabled": true,
    "sunday_summary_time": "17:20",
    "sunday_reminder_enabled": true,
    "sunday_reminder_time": "15:00",
    "monthly_report_enabled": true,
    "monthly_report_prioritize_workers": true
  }'::jsonb),
  ('follow_up', 'Urgent Follow-Up Criteria Configuration', '{
    "consecutive_absence_threshold": 3,
    "popup_alert_enabled": true,
    "chronic_absence_rate_percent": 40
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;
