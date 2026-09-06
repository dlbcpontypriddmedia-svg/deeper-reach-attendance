-- Enable extensions for scheduling and HTTP requests if available
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create an audit action enum value check comment / schema update if needed
-- audit_logs table supports any string action including 'reminder_sent'

-- Cron schedule to trigger attendance reminder edge function
-- Every 20 minutes on Sundays between 15:00 and 20:00 UTC (0,20,40 15-20 * * 0)
-- Note: Replace <PROJECT_REF> and <ANON_KEY_OR_SERVICE_KEY> with project secrets or configure via Supabase Dashboard > Edge Functions > Schedules.

-- Example cron registration:
-- SELECT cron.schedule(
--   'sunday-attendance-reminder',
--   '*/20 14-20 * * 0',
--   $$
--   SELECT net.http_post(
--     url := 'https://rntxinxyttftzhlxpucr.supabase.co/functions/v1/attendance-reminder',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"force": false}'::jsonb
--   ) AS request_id;
--   $$
-- );

