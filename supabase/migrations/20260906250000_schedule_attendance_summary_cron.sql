-- Enable extensions for scheduling and HTTP requests if available
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Sunday Attendance Summary at 5:20 PM (17:20 Europe/London / UTC)
-- Runs every Sunday at 17:20
--
-- SELECT cron.schedule(
--   'sunday-attendance-summary-520pm',
--   '20 17 * * 0',
--   $$
--   SELECT net.http_post(
--     url := 'https://rntxinxyttftzhlxpucr.supabase.co/functions/v1/attendance-summary',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"type": "sunday", "targetEmail": "stedarol@gmail.com"}'::jsonb
--   ) AS request_id;
--   $$
-- );

-- 2. Monthly Attendance Breakdown at the end of every month (e.g. 23:00 on the 28th-31st or 1st of next month)
-- Runs at 21:00 on the last day of every month:
--
-- SELECT cron.schedule(
--   'monthly-attendance-summary',
--   '0 21 28-31 * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://rntxinxyttftzhlxpucr.supabase.co/functions/v1/attendance-summary',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"type": "monthly", "targetEmail": "stedarol@gmail.com"}'::jsonb
--   ) AS request_id;
--   $$
-- );
