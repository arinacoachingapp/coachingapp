-- Conversational interview state for Professional Role interviewer (P1 + bank v1.1)
alter table career_sessions
  add column if not exists interview_state jsonb;

comment on column career_sessions.interview_state is
  'Running interview state: phase, turns, probe budget, role_name, tense, route, etc.';

-- Progress now lives in interview_state; keep current_step as a coarse 0–24 mirror
-- for the legacy check constraint (do not raise the upper bound without dropping it).
