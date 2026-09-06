-- Add visitor / guest count columns and notes to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS visitor_adult_male INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_adult_female INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_youth_male INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_youth_female INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_child_male INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_child_female INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_notes TEXT;
