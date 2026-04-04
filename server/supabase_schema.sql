-- cofin database schema
-- Run this in your Supabase SQL editor

-- ─── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── WORKSPACES ───────────────────────────────────────────────
create table workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table workspace_members (
  workspace_id  uuid references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text default 'member', -- 'owner' | 'member'
  joined_at     timestamptz default now(),
  primary key (workspace_id, user_id)
);

create table workspace_invites (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references workspaces(id) on delete cascade,
  invited_email   text not null,
  created_at      timestamptz default now(),
  expires_at      timestamptz default now() + interval '7 days'
);

-- ─── ACCOUNTS ─────────────────────────────────────────────────
create table accounts (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  type          text not null, -- 'checking' | 'savings' | 'credit' | 'investment' | 'cash'
  institution   text,
  last_four     text,
  currency      text default 'USD',
  is_joint      boolean default false,
  created_at    timestamptz default now()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────
create table transactions (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  account_id    uuid references accounts(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  date          date not null,
  description   text not null,
  amount        numeric(12, 2) not null,
  type          text not null,         -- 'income' | 'expense'
  category      text default 'Uncategorized',
  is_joint      boolean default false, -- split between partners
  settled       boolean default false,
  settled_at    timestamptz,
  notes         text,
  source        text default 'manual', -- 'manual' | 'pdf' | 'csv' | 'paste'
  institution   text,
  raw           text,                  -- original unparsed row for debugging
  created_at    timestamptz default now()
);

create index idx_transactions_workspace on transactions(workspace_id);
create index idx_transactions_date on transactions(date desc);
create index idx_transactions_category on transactions(category);
create index idx_transactions_joint on transactions(workspace_id, is_joint, settled);

-- ─── SETTLEMENTS ──────────────────────────────────────────────
create table settlements (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid references workspaces(id) on delete cascade,
  settled_by        uuid references auth.users(id) on delete set null,
  amount            numeric(12, 2) not null,
  notes             text,
  transaction_count int default 0,
  created_at        timestamptz default now()
);

-- ─── BUDGETS ──────────────────────────────────────────────────
create table budgets (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  category      text not null,
  amount        numeric(12, 2) not null,
  year          int not null,
  month         int,              -- null = annual budget for category
  is_recurring  boolean default true,
  created_at    timestamptz default now(),
  unique (workspace_id, category, year, month)
);

-- ─── GOALS ────────────────────────────────────────────────────
create table goals (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  name          text not null,
  target_amount numeric(12, 2) not null,
  current_amount numeric(12, 2) default 0,
  target_date   date,
  category      text,
  notes         text,
  completed     boolean default false,
  created_at    timestamptz default now()
);

-- ─── IMPORT LOG ───────────────────────────────────────────────
create table import_log (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid references workspaces(id) on delete cascade,
  imported_by       uuid references auth.users(id) on delete set null,
  source            text not null,   -- 'pdf' | 'csv' | 'paste'
  institution       text,
  transaction_count int default 0,
  created_at        timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table workspaces          enable row level security;
alter table workspace_members   enable row level security;
alter table workspace_invites   enable row level security;
alter table accounts            enable row level security;
alter table transactions        enable row level security;
alter table settlements         enable row level security;
alter table budgets             enable row level security;
alter table goals               enable row level security;
alter table import_log          enable row level security;

-- Helper: is the current user a member of this workspace?
create or replace function is_workspace_member(wsid uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = wsid and user_id = auth.uid()
    union
    select 1 from workspaces
    where id = wsid and owner_id = auth.uid()
  );
$$ language sql security definer;

-- Workspaces: owner or member can read
create policy "workspace_select" on workspaces for select
  using (owner_id = auth.uid() or is_workspace_member(id));

-- Accounts
create policy "accounts_all" on accounts for all
  using (is_workspace_member(workspace_id));

-- Transactions
create policy "transactions_all" on transactions for all
  using (is_workspace_member(workspace_id));

-- Settlements
create policy "settlements_all" on settlements for all
  using (is_workspace_member(workspace_id));

-- Budgets
create policy "budgets_all" on budgets for all
  using (is_workspace_member(workspace_id));

-- Goals
create policy "goals_all" on goals for all
  using (is_workspace_member(workspace_id));

-- Import log
create policy "import_log_all" on import_log for all
  using (is_workspace_member(workspace_id));

-- ─── USEFUL VIEWS ─────────────────────────────────────────────

-- Monthly spending summary per category
create or replace view monthly_category_summary as
select
  workspace_id,
  date_trunc('month', date) as month,
  category,
  type,
  count(*) as transaction_count,
  sum(amount) as total
from transactions
group by workspace_id, date_trunc('month', date), category, type;

-- Unsettled joint transactions
create or replace view unsettled_joint as
select * from transactions
where is_joint = true and settled = false;

-- Budget vs actual (current year)
create or replace view budget_vs_actual as
select
  b.workspace_id,
  b.category,
  b.year,
  b.month,
  b.amount as budgeted,
  coalesce(sum(t.amount), 0) as actual,
  b.amount - coalesce(sum(t.amount), 0) as remaining
from budgets b
left join transactions t
  on t.workspace_id = b.workspace_id
  and t.category = b.category
  and t.type = 'expense'
  and extract(year from t.date) = b.year
  and (b.month is null or extract(month from t.date) = b.month)
group by b.workspace_id, b.category, b.year, b.month, b.amount;
