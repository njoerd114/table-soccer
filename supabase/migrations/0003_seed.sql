/*
Demo-only inserts. Keep this block commented: migrations must not create fake
auth users or public player/game data.

-- Signed in as a real Supabase Auth user:
-- insert into public.players (id, display_name, avatar_url)
-- values (auth.uid(), 'Demo Player', 'https://cdn.example.com/avatar.png');

-- After four real player profiles exist:
-- insert into public.games (
--   startdate,
--   duration,
--   players,
--   scores,
--   timeline,
--   created_by
-- ) values (
--   1720000000000,
--   600,
--   array[
--     '<player-1-uuid>',
--     '<player-2-uuid>',
--     '<player-3-uuid>',
--     '<player-4-uuid>'
--   ],
--   array[5, 3, 2, 1, 0, 0, 1, 0],
--   '[{"player_id":"<player-1-uuid>","index":0,"position":"STRIKER","time":12,"own_goal":false}]'::jsonb,
--   auth.uid()
-- );
*/
