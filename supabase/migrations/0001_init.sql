-- ============================================================
-- BOW — Let's Connect · Initial schema
-- Tables: categories, products, product_plans, product_features,
--         faqs, contact_settings
-- ============================================================

-- Extensions ---------------------------------------------------
create extension if not exists "pgcrypto";

-- Enum for product type ---------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_type') then
    create type product_type as enum ('ai-tool', 'premium-app', 'product');
  end if;
end$$;

-- updated_at trigger helper -----------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ============================================================
-- categories
-- ============================================================
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  type        product_type not null,
  description text,
  icon        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- products
-- ============================================================
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references categories(id) on delete set null,
  name              text not null,
  slug              text not null unique,
  short_description text,
  description       text,
  logo_url          text,
  banner_url        text,
  type              product_type not null,
  -- display fields (keep existing UI identical) ---------------
  accent            text default '#06b6d4',
  badge             text,
  base_price        numeric(12,0) default 0,
  original_price    numeric(12,0),
  rating            numeric(2,1) default 5.0,
  sold              int default 0,
  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists products_type_idx on products(type);
create index if not exists products_category_idx on products(category_id);
create index if not exists products_featured_idx on products(is_featured);

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ============================================================
-- product_plans
-- ============================================================
create table if not exists product_plans (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id) on delete cascade,
  name           text not null,
  duration       text,
  price          numeric(12,0) not null default 0,
  original_price numeric(12,0),
  description    text,
  is_highlight   boolean not null default false,
  sort_order     int not null default 0,
  is_active      boolean not null default true
);

create index if not exists product_plans_product_idx on product_plans(product_id);

-- ============================================================
-- product_features
-- ============================================================
create table if not exists product_features (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  feature    text not null,
  sort_order int not null default 0
);

create index if not exists product_features_product_idx on product_features(product_id);

-- ============================================================
-- faqs
-- ============================================================
create table if not exists faqs (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  question   text not null,
  answer     text not null,
  sort_order int not null default 0
);

create index if not exists faqs_product_idx on faqs(product_id);

-- ============================================================
-- contact_settings (single row)
-- ============================================================
create table if not exists contact_settings (
  id            uuid primary key default gen_random_uuid(),
  facebook_url  text,
  zalo_url      text,
  support_phone text,
  support_email text,
  updated_at    timestamptz not null default now()
);

drop trigger if exists contact_settings_set_updated_at on contact_settings;
create trigger contact_settings_set_updated_at
  before update on contact_settings
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security — public read-only access
-- ============================================================
alter table categories       enable row level security;
alter table products         enable row level security;
alter table product_plans    enable row level security;
alter table product_features enable row level security;
alter table faqs             enable row level security;
alter table contact_settings enable row level security;

-- Public (anon) may SELECT everything; writes reserved for
-- service_role / authenticated admin (added in a later step).
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_plans',
    'product_features','faqs','contact_settings'
  ]
  loop
    execute format(
      'drop policy if exists "public read %1$s" on %1$s;', t
    );
    execute format(
      'create policy "public read %1$s" on %1$s for select using (true);', t
    );
  end loop;
end$$;
