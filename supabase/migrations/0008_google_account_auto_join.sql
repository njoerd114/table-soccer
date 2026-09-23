-- Google-account auto-join: newly created Supabase Auth users are matched to
-- a company by allowlisted email (hashed, never plaintext) or email domain,
-- and auto-added as a member. No allowlist match => no auto-join; the user
-- falls back to the existing manual create/join company flow already in the
-- UI. This table is never read from the browser: RLS is enabled+forced with
-- zero grants, and the trigger function is SECURITY DEFINER so it can
-- read/write despite that.
--
-- identity_hash intentionally replaces a plaintext email column: this project's
-- security model (see src/security.test.ts) forbids persisting email as a
-- column in any public-schema app table, even server-only ones. Hashing with
-- a per-row random salt keeps single-email allowlisting possible without
-- reintroducing a reversible PII column.

create table public.company_auth_allowlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  identity_hash text,
  identity_salt text,
  signup_domain text,
  created_at timestamptz not null default now(),
  constraint company_auth_allowlist_target check ((identity_hash is not null and identity_salt is not null) or (signup_domain is not null)),
  constraint company_auth_allowlist_domain_lowercase check (signup_domain is null or signup_domain = lower(signup_domain))
);

comment on table public.company_auth_allowlist is
  'Server-only auto-join rules: matches a new auth.users.email (salted-hash exact match, or plain domain match) to a company. No client access, no plaintext email persisted.';
comment on column public.company_auth_allowlist.identity_hash is
  'sha256(identity_salt || lower(email)), hex-encoded. Never store plaintext email here.';
comment on column public.company_auth_allowlist.identity_salt is
  'Random per-row salt paired with identity_hash; generated via gen_random_bytes.';
comment on column public.company_auth_allowlist.signup_domain is
  'Lowercase email domain (no @) allowed to auto-join company_id, e.g. an entire workspace. Not PII.';

create unique index company_auth_allowlist_domain_unique_idx
  on public.company_auth_allowlist (signup_domain)
  where signup_domain is not null;

-- Deny-by-default: this table is a server-only auto-join rule set, never
-- queried by the browser client directly.
revoke all on table public.company_auth_allowlist from public;
revoke all on table public.company_auth_allowlist from anon;
revoke all on table public.company_auth_allowlist from authenticated;

alter table public.company_auth_allowlist enable row level security;
alter table public.company_auth_allowlist force row level security;

-- SECURITY DEFINER helper so operators can add a single-email allowlist entry
-- from the SQL editor without ever writing a plaintext email into a table:
-- select public.allowlist_add_email('<company-uuid>', 'name@example.com');
create or replace function public.allowlist_add_email(
  target_company_id uuid,
  target_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_salt text := encode(gen_random_bytes(16), 'hex');
  new_id uuid;
begin
  insert into public.company_auth_allowlist (company_id, identity_hash, identity_salt)
  values (
    target_company_id,
    encode(digest(new_salt || lower(target_email), 'sha256'), 'hex'),
    new_salt
  )
  returning id into new_id;

  return new_id;
end;
$$;

comment on function public.allowlist_add_email(uuid, text) is
  'Operator helper: hashes+salts an email before storing it as an allowlist row. Call from SQL editor only.';

revoke all on function public.allowlist_add_email(uuid, text) from public;
revoke all on function public.allowlist_add_email(uuid, text) from anon;
revoke all on function public.allowlist_add_email(uuid, text) from authenticated;

-- SECURITY DEFINER: runs as the migration owner so it can read the allowlist
-- and insert company_members despite the trigger firing before any session
-- context exists for the brand-new auth user. search_path is pinned to
-- prevent search-path hijacking.
create or replace function public.handle_new_user_company_autojoin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  matched_company_id uuid;
  new_user_domain text := split_part(lower(new.email), '@', 2);
begin
  if new.email is null then
    return new;
  end if;

  select company_id
  into matched_company_id
  from public.company_auth_allowlist
  where signup_domain = new_user_domain
     or (
       identity_hash is not null
       and identity_hash = encode(digest(identity_salt || lower(new.email), 'sha256'), 'hex')
     )
  limit 1;

  if matched_company_id is not null then
    insert into public.company_members (company_id, user_id, role)
    values (matched_company_id, new.id, 'member')
    on conflict (company_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user_company_autojoin() is
  'Auto-joins a new auth user to an allowlisted company by salted-hash email match or plain domain match.';

revoke all on function public.handle_new_user_company_autojoin() from public;
revoke all on function public.handle_new_user_company_autojoin() from anon;
revoke all on function public.handle_new_user_company_autojoin() from authenticated;

create trigger on_auth_user_created_company_autojoin
after insert on auth.users
for each row
execute function public.handle_new_user_company_autojoin();
