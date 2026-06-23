-- Phase 1 hardening. Resolves the Supabase advisor "function_search_path_mutable"
-- warning by pinning a fixed search_path on the updated_at trigger function.
-- (handle_new_user already sets search_path; touch_updated_at did not.)
alter function public.touch_updated_at() set search_path = public;
