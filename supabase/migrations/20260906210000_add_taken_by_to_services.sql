ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS taken_by_name TEXT,
  ADD COLUMN IF NOT EXISTS taken_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

UPDATE public.services s
SET
  taken_by_id = sub.recorded_by,
  taken_by_name = COALESCE(p.name, p.username)
FROM (
  SELECT service_id, recorded_by
  FROM public.attendance_records
  WHERE recorded_by IS NOT NULL
  GROUP BY service_id, recorded_by
) sub
LEFT JOIN public.profiles p ON p.id = sub.recorded_by
WHERE s.id = sub.service_id
  AND (s.taken_by_name IS NULL OR s.taken_by_id IS NULL);