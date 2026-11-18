-- Adds reply details to new founder enquiries. Existing anonymous responses stay intact.
ALTER TABLE public.lippi_survey_responses
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS fintech_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS work_email VARCHAR(254);
