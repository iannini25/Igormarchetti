-- Lippi website: training interest and newsletter storage.
-- Run once as the existing database owner, using a trusted SQL client.
-- The application keeps its existing restricted database role.
-- With psql, supply its existing role name (not a password):
--   psql --set=lippi_runtime_role=EXISTING_APP_ROLE --file=scripts/lippi-storage-migration.sql
-- Connect through your normal authenticated database session. Do not put credentials in Git.
-- This script creates only the two new tables and grants only the required data permissions.
-- It does not change the existing founder survey table or its stored responses.

\set ON_ERROR_STOP on
\if :{?lippi_runtime_role}
\else
  \echo 'Set lippi_runtime_role to the existing application database role before running.'
  \quit 3
\endif

BEGIN;

CREATE TABLE IF NOT EXISTS public.lippi_training_interest (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  survey_version TEXT NOT NULL DEFAULT 'training-v1',
  notice_version TEXT NOT NULL DEFAULT '2026-11-17',
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX IF NOT EXISTS lippi_training_interest_created_at_idx
  ON public.lippi_training_interest (created_at);

CREATE TABLE IF NOT EXISTS public.lippi_newsletter_signups (
  email TEXT PRIMARY KEY CHECK (char_length(email) <= 254),
  language VARCHAR(2) NOT NULL CHECK (language IN ('en','pt','es')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notice_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','unsubscribed'))
);

GRANT SELECT, INSERT, DELETE
  ON public.lippi_training_interest TO :"lippi_runtime_role";
GRANT SELECT, INSERT, UPDATE
  ON public.lippi_newsletter_signups TO :"lippi_runtime_role";

COMMIT;

-- The live APIs will detect these tables on the next request. No environment
-- variables, new passwords, elevated runtime privileges or further deployment are needed.
-- Verify GET /api/training-interest/health and GET /api/newsletter/health return ready:true.
