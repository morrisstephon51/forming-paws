-- Final whole-branch review found create_match_on_mutual_interest() (0011)
-- still had the default PUBLIC EXECUTE grant that 0010 was written to close
-- for browse_dogs/dog_is_baseline_verified. Not practically exploitable
-- (it's a trigger function, so direct RPC invocation fails with "trigger
-- functions can only be called as triggers" — same as the pre-existing
-- handle_new_user), but this branch established anon-grant hygiene as the
-- bar, so closing it for consistency. Confirmed the trigger itself still
-- fires correctly after this revoke (re-ran the full e2e match-flow test).
revoke execute on function public.create_match_on_mutual_interest from anon, public;
