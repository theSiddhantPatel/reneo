-- Reneo Live schema, RLS policies, and table permissions.
-- Run this in Supabase SQL editor, then create a public storage bucket named
-- product-images if it does not already exist.

create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar text,
  role text not null check (role in ('seller', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. PRODUCTS TABLE
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at timestamptz not null default now()
);

-- 3. LIVE SESSIONS TABLE
create table if not exists public.live_sessions (
  live_id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 4. LIVE MESSAGES TABLE (Realtime Chat)
create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(live_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

-- 5. CART ITEMS TABLE
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- 6. GRANT TABLE PRIVILEGES TO AUTHENTICATED & ANON ROLES
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- 7. AUTOMATIC PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('seller', 'customer')
      then new.raw_user_meta_data->>'role'
      else 'customer'
    end,
    new.raw_user_meta_data->>'avatar'
  )
  on conflict (id) do update set
    name = excluded.name,
    role = excluded.role,
    avatar = excluded.avatar;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8. ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_messages enable row level security;
alter table public.cart_items enable row level security;

-- PROFILES POLICIES
drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- PRODUCTS POLICIES
drop policy if exists "sellers read own products" on public.products;
create policy "sellers read own products"
on public.products for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "customers read active products" on public.products;
drop policy if exists "authenticated read active products" on public.products;
create policy "authenticated read active products"
on public.products for select
to authenticated
using (status = 'active');

drop policy if exists "sellers insert own products" on public.products;
create policy "sellers insert own products"
on public.products for insert
to authenticated
with check (
  seller_id = auth.uid()
);

drop policy if exists "sellers update own products" on public.products;
create policy "sellers update own products"
on public.products for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "sellers delete own products" on public.products;
create policy "sellers delete own products"
on public.products for delete
to authenticated
using (seller_id = auth.uid());

-- LIVE SESSIONS POLICIES
drop policy if exists "signed in users read live sessions" on public.live_sessions;
create policy "signed in users read live sessions"
on public.live_sessions for select
to authenticated
using (true);

drop policy if exists "sellers insert own live sessions" on public.live_sessions;
create policy "sellers insert own live sessions"
on public.live_sessions for insert
to authenticated
with check (
  host_id = auth.uid()
);

drop policy if exists "hosts update own live sessions" on public.live_sessions;
create policy "hosts update own live sessions"
on public.live_sessions for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

-- LIVE MESSAGES POLICIES (Chat)
drop policy if exists "signed in users read live messages" on public.live_messages;
create policy "signed in users read live messages"
on public.live_messages for select
to authenticated
using (true);

drop policy if exists "signed in users post to active lives" on public.live_messages;
create policy "signed in users post to active lives"
on public.live_messages for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- CART ITEMS POLICIES
drop policy if exists "users read own cart" on public.cart_items;
create policy "users read own cart"
on public.cart_items for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users insert own cart" on public.cart_items;
create policy "users insert own cart"
on public.cart_items for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users update own cart" on public.cart_items;
create policy "users update own cart"
on public.cart_items for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users delete own cart" on public.cart_items;
create policy "users delete own cart"
on public.cart_items for delete
to authenticated
using (user_id = auth.uid());

-- STORAGE POLICIES (Bucket: product-images)
drop policy if exists "product images are public" on storage.objects;
create policy "product images are public"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "sellers upload own product images" on storage.objects;
create policy "sellers upload own product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sellers manage own product images" on storage.objects;
create policy "sellers manage own product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 9. ENABLE REALTIME BROADCASTING
do $$
begin
  alter publication supabase_realtime add table public.live_messages;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_sessions;
exception when others then null;
end $$;