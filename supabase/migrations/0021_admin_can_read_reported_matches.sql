-- Fix: the moderation path built in 0020 could never work.
--
-- messages_select_participant_or_open_report lets an admin read the MESSAGES of
-- a reported conversation, but matches_select_involving_own still restricted the
-- MATCHES row to the two participants. /matches/[id] loads the match first and
-- calls notFound() when it is missing, so an admin following "Read the
-- conversation" from the report queue got a 404 before reaching a single
-- message. Verified against the live database: admin_can_see_match_row = 0
-- while admin_can_see_messages = 1.
--
-- Scoped exactly like the messages policy rather than a blanket is_admin():
-- visibility begins when a report is filed and ends when it is closed, so the
-- privacy policy's promise holds for the match row too, not just its contents.

create policy matches_select_admin_reported on public.matches
  for select to authenticated using (
    public.is_admin()
    and exists (
      select 1 from public.match_reports r
      where r.match_id = matches.id
        and r.status in ('open', 'reviewing')
    )
  );
