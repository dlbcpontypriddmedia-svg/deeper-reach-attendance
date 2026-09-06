-- Migration: Add submission_count to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;

-- Backfill submission_count = 1 for existing services that have attendance records
UPDATE public.services s
SET submission_count = 1
WHERE s.submission_count = 0
  AND EXISTS (
    SELECT 1 FROM public.attendance_records ar
    WHERE ar.service_id = s.id
  );

