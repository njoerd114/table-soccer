-- Given: the session is anonymous. When: players are queried. Then: access fails.
begin;
set local role anon;
select * from public.players;
rollback;

-- Given: public table metadata. Then: players has no email or uid columns.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'players'
order by ordinal_position;

-- Given: table privileges. Then: anon has no privileges on app tables.
select *
from information_schema.table_privileges
where grantee = 'anon';
