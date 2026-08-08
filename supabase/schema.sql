-- MARK Gadgets & Accessories Shop POS — initial schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to run once against a fresh project. Re-running will error on
-- "already exists" — that's expected, not a bug.

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_info text,
  -- Archived (not deleted) once the admin removes it — suppliers are
  -- referenced by id from devices/bulk_order_shells/supplier_defective_records,
  -- so a hard delete would either fail on the FK or orphan history. Archiving
  -- just hides it from future picks in SupplierSelect.
  active boolean not null default true,
  -- Accessories/Repair Parts are sourced from different vendors than
  -- iPhones/iPads/Apple Watches/MacBooks — SupplierSelect filters its list
  -- to this instead of showing one flat list for every category. Null
  -- means "shows for every category" — a generic source like 'Walk-in'
  -- isn't a dedicated vendor of either.
  supplier_type text check (supplier_type in ('Device', 'Accessory')),
  created_at timestamptz not null default now()
);

-- Product categories/brands — editable by the admin at runtime (Add Device
-- → Manage Catalog → Categories) instead of requiring a code deploy to add
-- a new brand. name is the canonical form (matches product_models.category
-- below); db_value is what actually gets stored in devices.category, which
-- differs from name only for the four original Apple categories (they kept
-- their historical plural spelling — 'iPhones' not 'iPhone' — since existing
-- device rows already use it and are never touched; every category added
-- from here on just uses the same spelling in both places). prefix drives
-- batch-code generation (see add_device's caller in AddDevice.jsx) — kept
-- unique so two categories can never generate colliding batch codes.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  db_value text not null,
  brand text not null,
  prefix text not null unique check (prefix = upper(prefix)),
  storages text[] not null default '{}',
  -- Accessories/Repair Parts (and any future non-serialized-device category)
  -- set this true — mirrors isAccessoryLikeCategory in referenceData.js,
  -- which still hardcodes just those two by name for the small bit of
  -- non-catalog UI (SupplierSelect's Device/Accessory split) that doesn't
  -- have a category object handy.
  is_accessory_like boolean not null default false,
  -- Archived (not deleted) once the admin removes it — same reasoning as
  -- suppliers.active: product_models/devices reference a category by name
  -- as free text, not a foreign key, so a hard delete would either orphan
  -- history or silently break nothing while still losing the prefix/brand
  -- info for anything already on file. Archiving just hides it from future
  -- picks without touching past records.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The Add Device / Quick Add catalog — models and their colors, editable by
-- the admin at runtime instead of requiring a code deploy. device_name/color
-- on devices are free text, not foreign keys, so removing a model or color
-- here never touches existing inventory rows, only future selections.
-- category is free text (not a foreign key to categories.name) for the same
-- reason — matches categories.name, but isn't enforced as one so removing a
-- category never orphans/breaks existing product_models rows either.
create table public.product_models (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  colors text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (category, name)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  -- Not `unique` here — see devices_batch_code_unique_serialized below, a
  -- partial unique index instead. Bulk-identical accessories (headsets,
  -- cases) are added as one row per physical unit (same as everything
  -- else, so status/Sales/Reports all keep working per-unit unchanged)
  -- but deliberately share one batch code across the whole batch, since
  -- they're interchangeable and only need one printed barcode between
  -- them — a plain unique constraint would reject that outright.
  -- Serialized devices (phones etc.) still can't collide.
  batch_code text not null,
  device_name text not null,
  -- Free text, not a foreign key or CHECK-constrained enum — matches
  -- categories.db_value, but see the comment on that table for why it
  -- isn't formally enforced as one.
  category text not null,
  storage text,
  color text,
  -- Only meaningful for Accessories/Repair Parts — those categories are
  -- generic ("Accessories") but hold many different real-world brands
  -- (Anker vs a no-name power bank), unlike phone categories which are
  -- already brand-named categories themselves (Samsung, Redmi, ...) and
  -- so have no separate use for this. Free text, not a catalog/dropdown —
  -- "Various" is a plain typed value for a mixed-brand batch, not a
  -- special case the schema enforces.
  brand text,
  status text not null default 'Available'
    check (status in ('Available', 'Reserved', 'Sold', 'Customer Returned', 'Supplier Defective', 'Returned')),
  supplier_id uuid references public.suppliers (id),
  purchase_price numeric(12, 2) check (purchase_price is null or purchase_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  condition text check (condition in ('Brand New', 'Pre-owned', 'Genuine', 'Used')),
  notes text,
  date_added timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Bulk shipment placeholders — staff can log "a shipment arrived" (supplier,
-- model, quantity, date) the same night without entering every serial, then
-- link each individual unit back to it the next morning via Add Device.
create table public.bulk_order_shells (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id),
  device_name text not null,
  storage text,
  color text,
  quantity_expected int not null check (quantity_expected > 0),
  date_arrived timestamptz not null,
  status text not null default 'Pending' check (status in ('Pending', 'Completed')),
  notes text,
  -- What the store owes the supplier for this shipment — unit_cost times
  -- the agreed quantity_expected, not however many units have been logged
  -- so far (see bulk_order_shell_progress_view.amount_payable).
  unit_cost numeric(12, 2) check (unit_cost is null or unit_cost >= 0),
  supplier_payment_status text not null default 'Unpaid' check (supplier_payment_status in ('Unpaid', 'Paid')),
  supplier_paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.devices add column bulk_order_shell_id uuid references public.bulk_order_shells (id);
alter table public.devices add column date_arrived timestamptz;

-- Reorder threshold is set per model (device_name), not per unit — the owner
-- configures this from the Low Stock page rather than at Add Device time.
create table public.reorder_settings (
  id uuid primary key default gen_random_uuid(),
  device_name text not null unique,
  reorder_level integer not null check (reorder_level >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_phone text,
  salesperson_id uuid references public.profiles (id),
  -- Home Credit is no longer offered for new sales (replaced by PayJoy,
  -- see NewSale.jsx's installmentOptions) but stays allowed here so old
  -- rows that used it remain valid — never rewritten, only added to.
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Credit Card', 'Bank Transfer', 'Check', 'Skyro', 'Home Credit', 'PayJoy', 'Swap')),
  reference_number text,
  notes text,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'Completed' check (status in ('Completed', 'Refunded')),
  -- A sale with more than 3 total units (summed across its sale_items) is
  -- classified Bulk and starts Pending — bulk buyers usually pay by check,
  -- which isn't confirmed the moment the sale is rung up. Lives here (not
  -- per sale_item) since every unit in one sale shares this one sales row —
  -- marking it Paid naturally reflects across every unit in the order.
  order_type text not null default 'Regular' check (order_type in ('Regular', 'Bulk')),
  payment_status text not null default 'Paid' check (payment_status in ('Paid', 'Pending')),
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Financing detail for Skyro sales — replaces the reference number for
  -- that payment method, since a financed sale doesn't have one the way a
  -- bank transfer or GCash payment does.
  down_payment numeric(12, 2) check (down_payment is null or down_payment >= 0),
  balance numeric(12, 2) check (balance is null or balance >= 0)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  device_id uuid not null references public.devices (id),
  price_at_sale numeric(12, 2) not null check (price_at_sale >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

-- No cash refunds — every return is either Rejected or resolved by handing
-- the customer a replacement unit of the same model (replacement_device_id).
-- A sold item can only ever be returned once (unique sale_item_id) — this is
-- the invariant that stops "Return" from being submitted twice on one item.
create table public.customer_returns (
  id uuid primary key default gen_random_uuid(),
  -- Not `unique` here — see customer_returns_one_pending_per_item below,
  -- a partial unique index instead. A plain unique constraint would allow
  -- only ONE return ever per sale_item, permanently blocking a genuine new
  -- return once an old one had been Rejected or Replaced.
  sale_item_id uuid not null references public.sale_items (id),
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Replaced', 'Rejected')),
  replacement_device_id uuid references public.devices (id),
  returned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.supplier_defective_records (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id),
  supplier_id uuid references public.suppliers (id),
  issue_description text not null,
  status text not null default 'Pending Return'
    check (status in ('Pending Return', 'Returned to Supplier', 'Resolved')),
  action_taken text,
  date_detected timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id),
  customer_name text not null,
  customer_phone text,
  salesperson_id uuid references public.profiles (id),
  reserved_until timestamptz not null,
  status text not null default 'Active'
    check (status in ('Active', 'Expiring Soon', 'Expired', 'Cancelled', 'Converted')),
  total_price numeric(12, 2) not null check (total_price >= 0),
  down_payment numeric(12, 2) not null default 0 check (down_payment >= 0 and down_payment <= total_price),
  created_at timestamptz not null default now()
);

-- Reports' expense log. A plain date (not timestamptz) — an expense is tied
-- to a calendar day, not a moment, so there's no timezone-midnight footgun
-- when filtering by report date range.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  -- Expenses logged from the admin-only Financial page stay out of
  -- Reports, which any role can open — Reports only shows what staff
  -- themselves have logged.
  admin_only boolean not null default false,
  -- Cargo (shipping/rider/courier fees) is tracked separately from general
  -- expenses so Financial can total it on its own line instead of it being
  -- buried in the lump Total Expenses figure.
  category text not null default 'General' check (category in ('General', 'Cargo', 'Prulife', 'Personal')),
  created_at timestamptz not null default now()
);

create index on public.expenses (expense_date);

-- ============================================================
-- VIEWS
-- ============================================================

-- Groups available units by model (across all storage/color/supplier
-- variants) and flags models below their configured reorder level.
-- security_invoker means it respects the querying user's own RLS on devices,
-- rather than running with the view owner's privileges.
--
-- left join, not join — a reorder setting can (and often should) be
-- configured for a model with zero units currently in devices at all, the
-- most urgent case to want a low-stock alert for (see getDeviceModelNames
-- in reorderService.js, which deliberately offers the whole catalog, not
-- just models already in stock). A plain join dropped that reorder_settings
-- row entirely — before the having clause ever ran — the moment its model
-- had no matching devices rows, so a second/third configured model with no
-- stock yet silently never appeared. product_models is joined too, only to
-- fill in category for that same zero-stock case, where devices has
-- nothing to read a category from.
create view public.low_stock_view
with (security_invoker = true) as
select
  rs.device_name,
  coalesce(d.category, pm.category) as category,
  rs.reorder_level,
  count(d.id) filter (where d.status = 'Available') as available,
  coalesce(sum(d.selling_price) filter (where d.status = 'Available'), 0) as estimated_value,
  max(d.date_added) as last_updated
from public.reorder_settings rs
left join public.devices d on d.device_name = rs.device_name
left join public.product_models pm on pm.name = rs.device_name
where rs.enabled = true
group by rs.device_name, rs.reorder_level, coalesce(d.category, pm.category)
having count(d.id) filter (where d.status = 'Available') < rs.reorder_level;

-- How many units have been linked back to each shipment shell so far — used
-- by Add Device's "Link to Pending Shipment" dropdown and the All Devices
-- progress display.
create view public.bulk_order_shell_progress_view
with (security_invoker = true) as
select
  s.id,
  s.supplier_id,
  sup.name as supplier_name,
  s.device_name,
  s.storage,
  s.color,
  s.quantity_expected,
  s.date_arrived,
  s.status,
  count(d.id) as linked_count,
  s.unit_cost,
  s.unit_cost * s.quantity_expected as amount_payable,
  s.supplier_payment_status,
  s.supplier_paid_at
from public.bulk_order_shells s
left join public.suppliers sup on sup.id = s.supplier_id
left join public.devices d on d.bulk_order_shell_id = s.id
group by s.id, sup.name;

-- Monthly completed-sales totals, for the Dashboard trend chart. Excludes
-- a still-Pending Bulk order's revenue the same way Reports/Financial's own
-- isPendingBulk check does (a Bulk order starts payment_status='Pending'
-- until confirmed paid, see process_sale) -- otherwise unconfirmed Bulk
-- revenue showed up here immediately while Reports/Financial for the same
-- month excluded it, giving two different revenue figures for one period.
create view public.sales_by_month_view
with (security_invoker = true) as
select
  date_trunc('month', sold_at) as month_start,
  to_char(date_trunc('month', sold_at), 'Mon') as month,
  sum(total_amount) as sales
from public.sales
where status = 'Completed'
  and not (order_type = 'Bulk' and payment_status = 'Pending')
group by date_trunc('month', sold_at);

-- Recent devices with whichever customer they're most associated with right
-- now (their most recent sale, falling back to their most recent reservation).
-- Used by the Dashboard's "Recent Device Activity" widget.
create view public.recent_device_activity_view
with (security_invoker = true) as
select
  d.batch_code,
  d.device_name,
  d.storage,
  d.color,
  d.status,
  d.date_added,
  coalesce(sale_customer.customer_name, res.customer_name) as customer_name,
  coalesce(sale_customer.customer_phone, res.customer_phone) as customer_phone
from public.devices d
left join lateral (
  select s.customer_name, s.customer_phone
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where si.device_id = d.id
  order by s.sold_at desc
  limit 1
) sale_customer on true
left join lateral (
  select r.customer_name, r.customer_phone
  from public.reservations r
  where r.device_id = d.id
  order by r.created_at desc
  limit 1
) res on true;

-- ============================================================
-- INDEXES (foreign keys aren't auto-indexed in Postgres)
-- ============================================================

create index on public.devices (supplier_id);
create index on public.devices (status);
-- Enforces batch_code uniqueness for every serialized device (phones,
-- tablets, etc.) same as before, but exempts Accessories/Repair Parts —
-- a bulk-added batch of identical accessories deliberately shares one
-- code across every unit in it. Mirrors the same hardcoded pair
-- isAccessoryLikeCategory checks in referenceData.js/AddDevice.jsx —
-- devices.category stores categories.db_value, which is identical to
-- categories.name for these two specifically (unlike the four original
-- Apple categories), so the literal string match here is exact.
create unique index devices_batch_code_unique_serialized
  on public.devices (batch_code)
  where category not in ('Accessories', 'Repair Parts');
create index on public.devices (batch_code);
create index on public.sales (salesperson_id);
create index on public.sale_items (sale_id);
create index on public.sale_items (device_id);
create index on public.customer_returns (sale_item_id);
-- Only one ACTIVE (Pending) return can exist per sale_item at a time, not
-- "ever" — replaces the old plain unique constraint on this column.
create unique index customer_returns_one_pending_per_item
  on public.customer_returns (sale_item_id)
  where status = 'Pending';
create index on public.supplier_defective_records (device_id);
create index on public.supplier_defective_records (supplier_id);
create index on public.reservations (device_id);
create index on public.reservations (salesperson_id);
create index on public.bulk_order_shells (supplier_id);
create index on public.devices (bulk_order_shell_id);

-- ============================================================
-- TRANSACTIONAL RPCs
--
-- Every multi-table write in the app used to be several separate round
-- trips from the browser (insert sale, insert sale_items, update devices,
-- ...). If the connection dropped between calls, you could end up with a
-- sale recorded but the device still "Available", or similar half-done
-- states — silent data corruption, not an error message. A single
-- plpgsql function body is one implicit transaction: if anything inside
-- raises, everything the function did is rolled back. security invoker
-- (the default, made explicit here) means these still run under the
-- calling user's own RLS, not elevated privileges.
-- ============================================================

-- More than 3 total units (cart items, since each is always quantity 1)
-- classifies the sale as Bulk and starts it Pending — bulk buyers usually
-- pay by check, which isn't confirmed the moment the sale is rung up.
-- p_force_bulk lets staff opt a smaller sale into the same treatment (e.g.
-- a single-unit wholesale sale) instead of relying on the count alone.
--
-- balance is derived here (total minus down payment, floored at 0) rather
-- than taken from the client — a single source of truth for the formula
-- means NewSale and edit_sale can't ever compute it differently or drift
-- out of sync with each other.
--
-- Signature changed (dropped p_balance) from the version this replaced —
-- create or replace doesn't swap in a changed parameter list, it adds a
-- second overload, so the old signature is dropped first.
drop function if exists public.process_sale(text, uuid, text, text, text, numeric, jsonb, numeric, numeric, boolean);

create function public.process_sale(
  p_customer_name text,
  p_salesperson_id uuid,
  p_payment_method text,
  p_reference_number text,
  p_notes text,
  p_total_amount numeric,
  p_cart_items jsonb, -- [{"device_id": "...", "price": 123.45}, ...]
  p_down_payment numeric default null,
  p_force_bulk boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_device_id uuid;
  v_item_count int;
  v_order_type text;
  v_payment_status text;
begin
  v_item_count := jsonb_array_length(p_cart_items);
  v_order_type := case when v_item_count > 3 or p_force_bulk then 'Bulk' else 'Regular' end;
  v_payment_status := case when v_item_count > 3 or p_force_bulk then 'Pending' else 'Paid' end;

  insert into public.sales (
    customer_name, salesperson_id, payment_method, reference_number, notes,
    total_amount, status, order_type, payment_status, down_payment, balance
  )
  values (
    p_customer_name, p_salesperson_id, p_payment_method, p_reference_number, p_notes,
    p_total_amount, 'Completed', v_order_type, v_payment_status, p_down_payment,
    case when p_down_payment is not null then greatest(p_total_amount - p_down_payment, 0) else null end
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_cart_items)
  loop
    v_device_id := (v_item->>'device_id')::uuid;

    -- Guards against two concurrent sales both grabbing the same device
    -- from a stale client-side product list — raising here rolls back the
    -- whole sale (including the sales row just inserted above), not just
    -- this one item, since nothing catches the exception.
    if not exists (select 1 from public.devices where id = v_device_id and status = 'Available') then
      raise exception 'One of these devices is no longer available — someone else may have just sold or reserved it. Refresh and try again.';
    end if;

    insert into public.sale_items (sale_id, device_id, price_at_sale, quantity)
    values (v_sale_id, v_device_id, (v_item->>'price')::numeric, 1);

    update public.devices set status = 'Sold' where id = v_device_id;
  end loop;

  return v_sale_id;
end;
$$;

create function public.convert_reservation_to_sale(
  p_reservation_id uuid,
  p_device_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_total_price numeric,
  p_payment_method text,
  p_reference_number text,
  p_notes text,
  p_salesperson_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
begin
  -- Guards against a stale "Convert to Sale" racing an already-completed
  -- cancel/convert/expire on the same reservation (e.g. two staff acting
  -- on the same Reserved page at once) — without this, a second, stale
  -- action could silently clobber the outcome of whichever happened first.
  if not exists (select 1 from public.reservations where id = p_reservation_id and status = 'Active') then
    raise exception 'This reservation is no longer active — it may have already been converted, cancelled, or expired.';
  end if;

  if not exists (select 1 from public.devices where id = p_device_id and status = 'Reserved') then
    raise exception 'This device is no longer in Reserved status.';
  end if;

  insert into public.sales (customer_name, customer_phone, salesperson_id, payment_method, reference_number, total_amount, notes, status)
  values (p_customer_name, p_customer_phone, p_salesperson_id, p_payment_method, p_reference_number, p_total_price, p_notes, 'Completed')
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, device_id, price_at_sale, quantity)
  values (v_sale_id, p_device_id, p_total_price, 1);

  update public.devices set status = 'Sold' where id = p_device_id;

  update public.reservations set status = 'Converted' where id = p_reservation_id;

  return v_sale_id;
end;
$$;

-- Original (broken) unit goes straight to Supplier Defective, carrying the
-- return reason over as the issue description; replacement unit is sold.
-- Starting a return actually moves the device to "Customer Returned" (it
-- used to only insert the customer_returns row, leaving the device showing
-- Sold the whole time a return sat Pending — "Customer Returned" was a
-- status value every dropdown/filter/badge had, but nothing ever set it).
create function public.create_return(p_sale_item_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  select device_id into v_device_id from public.sale_items where id = p_sale_item_id;

  insert into public.customer_returns (sale_item_id, reason, status)
  values (p_sale_item_id, p_reason, 'Pending');

  update public.devices set status = 'Customer Returned' where id = v_device_id;
end;
$$;

-- Customer keeps the unit after a rejected return, so it goes back to
-- Sold — not stuck at "Customer Returned" forever.
create function public.reject_return(p_return_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  select device_id into v_device_id
  from public.sale_items
  where id = (select sale_item_id from public.customer_returns where id = p_return_id);

  update public.customer_returns set status = 'Rejected' where id = p_return_id;
  update public.devices set status = 'Sold' where id = v_device_id;
end;
$$;

create function public.replace_return(
  p_return_id uuid,
  p_original_device_id uuid,
  p_replacement_device_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_sale_item_id uuid;
begin
  select sale_item_id into v_sale_item_id from public.customer_returns where id = p_return_id;

  update public.customer_returns
  set status = 'Replaced', replacement_device_id = p_replacement_device_id
  where id = p_return_id;

  select supplier_id into v_supplier_id from public.devices where id = p_original_device_id;

  update public.devices set status = 'Supplier Defective' where id = p_original_device_id;

  insert into public.supplier_defective_records (device_id, supplier_id, issue_description)
  values (p_original_device_id, v_supplier_id, p_reason);

  update public.devices set status = 'Sold' where id = p_replacement_device_id;

  -- Repoint the original sale's line item to the replacement unit, so its
  -- capital/profit are the ones from the unit the customer actually walked
  -- out with this time — otherwise the replacement's cost never appears
  -- anywhere in Sales History/Reports/Financial.
  update public.sale_items set device_id = p_replacement_device_id where id = v_sale_item_id;
end;
$$;

create function public.create_reservation(
  p_device_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_salesperson_id uuid,
  p_reserved_until timestamptz,
  p_total_price numeric,
  p_down_payment numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation_id uuid;
begin
  -- Guards against two staff both reserving the same device from a stale
  -- client-side list before either's page refreshes.
  if not exists (select 1 from public.devices where id = p_device_id and status = 'Available') then
    raise exception 'This device is no longer available to reserve — someone else may have just reserved or sold it. Refresh and try again.';
  end if;

  insert into public.reservations (device_id, customer_name, customer_phone, salesperson_id, reserved_until, total_price, down_payment, status)
  values (p_device_id, p_customer_name, p_customer_phone, p_salesperson_id, p_reserved_until, p_total_price, coalesce(p_down_payment, 0), 'Active')
  returning id into v_reservation_id;

  update public.devices set status = 'Reserved' where id = p_device_id;

  return v_reservation_id;
end;
$$;

create function public.cancel_reservation(p_reservation_id uuid, p_device_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Guards against cancelling a reservation that's already been converted
  -- to a sale (or expired) by a concurrent action — without this, a stale
  -- "Cancel" click could free a device that's already been sold and paid
  -- for back to Available.
  if not exists (select 1 from public.reservations where id = p_reservation_id and status = 'Active') then
    raise exception 'This reservation is no longer active — it may have already been converted, cancelled, or expired.';
  end if;

  update public.reservations set status = 'Cancelled' where id = p_reservation_id;
  update public.devices set status = 'Available' where id = p_device_id and status = 'Reserved';
end;
$$;

-- A reservation is valid through the whole of its reserved_until day, so it
-- only expires once we're a full day past that (local) midnight. The
-- update...returning CTE feeding the second update means this sweeps and
-- frees devices in one atomic statement instead of a select-then-two-updates.
create function public.expire_overdue_reservations()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  with overdue as (
    update public.reservations
    set status = 'Expired'
    where status = 'Active'
      and reserved_until <= now() - interval '1 day'
    returning device_id
  )
  update public.devices
  set status = 'Available'
  where id in (select device_id from overdue);
end;
$$;

-- Marking Resolved puts the device back to Available. Undoing that (moving
-- the record back off Resolved) puts it back to Supplier Defective — but
-- only if the device is still sitting Available untouched since then; if
-- it's since been reserved/sold/whatever else, leave it alone rather than
-- clobbering newer state.
create function public.update_supplier_defective_status(
  p_id uuid,
  p_status text,
  p_action_taken text,
  p_device_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_status text;
  v_current_device_status text;
begin
  select status into v_previous_status from public.supplier_defective_records where id = p_id;

  update public.supplier_defective_records
  set status = p_status, action_taken = p_action_taken
  where id = p_id;

  if p_device_id is not null then
    if p_status = 'Resolved' then
      update public.devices set status = 'Available' where id = p_device_id;
    elsif v_previous_status = 'Resolved' and p_status <> 'Resolved' then
      select status into v_current_device_status from public.devices where id = p_device_id;
      if v_current_device_status = 'Available' then
        update public.devices set status = 'Supplier Defective' where id = p_device_id;
      end if;
    end if;
  end if;
end;
$$;

-- Admin-only correction for a supplier defective record's own fields
-- (issue description, supplier, date detected) — separate from
-- update_supplier_defective_status, which only ever touched status/action
-- taken. Those three fields are the ones that live on
-- supplier_defective_records itself; batch code/device details are already
-- editable via the existing Edit Device flow on All Devices.
create function public.edit_supplier_defective_record(
  p_id uuid,
  p_issue_description text,
  p_supplier_name text,
  p_date_detected timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier_id uuid;
begin
  if p_supplier_name is null or p_supplier_name = '' then
    v_supplier_id := null;
  else
    select id into v_supplier_id from public.suppliers where name = p_supplier_name;
  end if;

  update public.supplier_defective_records
  set issue_description = p_issue_description,
      supplier_id = v_supplier_id,
      date_detected = p_date_detected
  where id = p_id;
end;
$$;

create function public.mark_bulk_order_shell_paid(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.bulk_order_shells
  set supplier_payment_status = 'Paid', supplier_paid_at = now()
  where id = p_id;
end;
$$;

-- Mirrors the "un-resolve" pattern already used for supplier defective
-- records — corrects a mistaken Mark as Paid without losing history on the
-- shell itself.
create function public.mark_bulk_order_shell_unpaid(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.bulk_order_shells
  set supplier_payment_status = 'Unpaid', supplier_paid_at = null
  where id = p_id;
end;
$$;

-- Deletes a shipment placeholder logged in error (e.g. wrong category
-- picked in Log Shipment Arrival, so it went through the one-by-one
-- placeholder path instead of the direct bulk-accessory add). Any devices
-- already linked to it (devices.bulk_order_shell_id — the only FK pointing
-- at this table) are unlinked rather than deleted — those are real units
-- already in inventory; removing the shipment record shouldn't remove them,
-- only the "which shipment this came from" traceability.
create function public.delete_bulk_order_shell(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.devices set bulk_order_shell_id = null where bulk_order_shell_id = p_id;
  delete from public.bulk_order_shells where id = p_id;
end;
$$;

-- Folds in the "report as Supplier Defective" record creation that used to
-- be a separate follow-up call from Add Device. p_bulk_order_shell_id/
-- p_date_arrived link this unit back to an overnight shipment placeholder
-- (see bulk_order_shells) — both optional, unrelated to a device's normal
-- date_added. When linking pushes a shell's logged count up to its
-- quantity_expected, the shell flips to Completed in the same atomic call.
--
-- p_quantity inserts that many identical rows in one atomic call instead
-- of one — for bulk-identical accessories (headsets, cases) sharing a
-- single batch code (see devices_batch_code_unique_serialized), so
-- logging 20 of the same case is one action, not 20, and can't leave a
-- half-logged batch if the connection drops partway through like 20
-- separate client-side calls could. Returns the first row's id — plenty
-- for the "Print Label" prompt after saving, since the whole batch prints
-- as a single shared label, not one per unit.
--
-- Signature changed (added p_brand) from the version this replaced —
-- create or replace doesn't swap in a changed parameter list, it adds a
-- second overload, so the old signature is dropped first.
drop function if exists public.add_device(text, text, text, text, text, text, text, numeric, text, timestamptz, text, uuid, timestamptz, numeric, text, int);

create function public.add_device(
  p_batch_code text,
  p_device_name text,
  p_category text,
  p_storage text,
  p_color text,
  p_status text,
  p_supplier_name text,
  p_price numeric,
  p_notes text,
  p_date_added timestamptz,
  p_issue_description text default null,
  p_bulk_order_shell_id uuid default null,
  p_date_arrived timestamptz default null,
  p_purchase_price numeric default null,
  p_condition text default null,
  p_quantity int default 1,
  p_brand text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_device_id uuid;
  v_first_device_id uuid;
  v_linked_count int;
  v_quantity_expected int;
  v_i int;
begin
  if p_supplier_name is null or p_supplier_name = '' then
    v_supplier_id := null;
  else
    select id into v_supplier_id from public.suppliers where name = p_supplier_name;
  end if;

  for v_i in 1..greatest(p_quantity, 1) loop
    insert into public.devices (batch_code, device_name, category, storage, color, brand, status, supplier_id, selling_price, purchase_price, condition, notes, date_added, bulk_order_shell_id, date_arrived)
    values (p_batch_code, p_device_name, p_category, p_storage, p_color, p_brand, p_status, v_supplier_id, p_price, p_purchase_price, p_condition, p_notes, p_date_added, p_bulk_order_shell_id, p_date_arrived)
    returning id into v_device_id;

    if v_first_device_id is null then
      v_first_device_id := v_device_id;
    end if;

    if p_status = 'Supplier Defective' and p_issue_description is not null then
      insert into public.supplier_defective_records (device_id, supplier_id, issue_description)
      values (v_device_id, v_supplier_id, p_issue_description);
    end if;
  end loop;

  if p_bulk_order_shell_id is not null then
    select count(*) into v_linked_count from public.devices where bulk_order_shell_id = p_bulk_order_shell_id;
    select quantity_expected into v_quantity_expected from public.bulk_order_shells where id = p_bulk_order_shell_id;
    if v_linked_count >= v_quantity_expected then
      update public.bulk_order_shells set status = 'Completed' where id = p_bulk_order_shell_id;
    end if;
  end if;

  return v_first_device_id;
end;
$$;

-- Folds in the same "report as Supplier Defective" record creation for the
-- Edit Device flow. Checks the device's OWN previous status server-side
-- (not a value handed in by the client) so it only creates a record on a
-- genuine transition into Supplier Defective.
--
-- Signature changed (added p_brand) from the version this replaced —
-- create or replace doesn't swap in a changed parameter list, it adds a
-- second overload, so the old signature is dropped first.
drop function if exists public.update_device(uuid, text, text, text, text, text, text, text, numeric, text, text, numeric, text);

create function public.update_device(
  p_id uuid,
  p_batch_code text,
  p_device_name text,
  p_category text,
  p_storage text,
  p_color text,
  p_status text,
  p_supplier_name text,
  p_price numeric,
  p_notes text,
  p_issue_description text default null,
  p_purchase_price numeric default null,
  p_condition text default null,
  p_brand text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_previous_status text;
  v_affected_sale_ids uuid[];
begin
  select status into v_previous_status from public.devices where id = p_id;

  if p_supplier_name is null or p_supplier_name = '' then
    v_supplier_id := null;
  else
    select id into v_supplier_id from public.suppliers where name = p_supplier_name;
  end if;

  update public.devices
  set batch_code = p_batch_code,
      device_name = p_device_name,
      category = p_category,
      storage = p_storage,
      color = p_color,
      brand = p_brand,
      status = p_status,
      supplier_id = v_supplier_id,
      selling_price = p_price,
      purchase_price = p_purchase_price,
      condition = p_condition,
      notes = p_notes
  where id = p_id;

  if p_status = 'Supplier Defective' and v_previous_status <> 'Supplier Defective' and p_issue_description is not null then
    insert into public.supplier_defective_records (device_id, supplier_id, issue_description)
    values (p_id, v_supplier_id, p_issue_description);
  end if;

  -- Sold -> Available means the sale is being undone (taking the unit
  -- back into sellable stock), not a return — the sale_item for this
  -- device is deleted outright so it's gone from Sales History/Reports/
  -- Financial entirely, same as if it were never sold. Scoped to just
  -- this device's own sale_item(s), so a bulk order's other units are
  -- untouched.
  if v_previous_status = 'Sold' and p_status = 'Available' then
    select array_agg(distinct sale_id) into v_affected_sale_ids
    from public.sale_items where device_id = p_id;

    delete from public.sale_items where device_id = p_id;

    delete from public.sales
    where id = any(v_affected_sale_ids)
      and id not in (select distinct sale_id from public.sale_items);
  end if;

  -- Editing a Reserved device to any other status cancels the reservation
  -- behind it, so it doesn't stay Active against a device no longer held
  -- for anyone.
  if v_previous_status = 'Reserved' and p_status <> 'Reserved' then
    update public.reservations
    set status = 'Cancelled'
    where device_id = p_id and status in ('Active', 'Expiring Soon');
  end if;
end;
$$;

-- Deletes one unit's sale_item directly (Sales History's Delete action) —
-- same "undo this sale" operation as the Sold -> Available path above,
-- just triggered from Sales History instead of Edit Device. Frees the
-- device back to Available and cleans up the parent sale if this was its
-- last remaining item.
create function public.delete_sale_item(p_sale_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_device_id uuid;
  v_sale_id uuid;
begin
  select device_id, sale_id into v_device_id, v_sale_id
  from public.sale_items where id = p_sale_item_id;

  -- A return filed against this exact sale would otherwise block the
  -- sale_items delete below with a foreign-key violation — undoing the
  -- sale undoes the return filed on it too.
  delete from public.customer_returns where sale_item_id = p_sale_item_id;

  delete from public.sale_items where id = p_sale_item_id;

  -- A unit with a pending return sits at 'Customer Returned', not 'Sold' —
  -- undoing the sale needs to free it back to Available from either state,
  -- not just the more common Sold one, or it's left stranded with no sale,
  -- no return record, and no path back to Available.
  update public.devices set status = 'Available'
  where id = v_device_id and status in ('Sold', 'Customer Returned');

  delete from public.sales
  where id = v_sale_id
    and id not in (select distinct sale_id from public.sale_items);

  -- If the parent sale still has other items, its total needs to shrink by
  -- the deleted item's price — otherwise it keeps counting a unit that's
  -- no longer part of it. No-op if the sale itself was just deleted above
  -- (this WHERE then matches nothing). Same recompute edit_sale already
  -- does after a price edit.
  update public.sales
  set total_amount = coalesce((select sum(price_at_sale * quantity) from public.sale_items where sale_id = v_sale_id), 0)
  where id = v_sale_id;
end;
$$;

-- Lets an admin delete a device outright even if it's Sold (or has other
-- history) — the plain `delete from devices` AllDevices already used only
-- works for a device with no history at all, since sale_items/reservations/
-- supplier_defective_records all reference devices without cascading. This
-- cleans up that history first, then removes the device — same
-- sale/parent-sale cleanup as delete_sale_item, just followed through to
-- actually removing the unit instead of reverting it to Available.
--
-- Deliberately still refuses to touch a unit that's currently out with a
-- customer as someone else's return replacement — nulling that reference
-- would leave the OTHER customer's return record silently broken.
create function public.admin_delete_device(p_device_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from public.devices where id = p_device_id) then
    raise exception 'Device not found';
  end if;

  if exists (select 1 from public.customer_returns where replacement_device_id = p_device_id) then
    raise exception 'This unit is on record as a replacement for a customer return — resolve that first.';
  end if;

  delete from public.customer_returns
  where sale_item_id in (select id from public.sale_items where device_id = p_device_id);

  delete from public.sales
  where id in (select sale_id from public.sale_items where device_id = p_device_id)
    and id not in (select distinct sale_id from public.sale_items where device_id <> p_device_id);

  delete from public.sale_items where device_id = p_device_id;
  delete from public.supplier_defective_records where device_id = p_device_id;
  delete from public.reservations where device_id = p_device_id;

  delete from public.devices where id = p_device_id;
end;
$$;

-- Lets an admin correct a sale after the fact from Sales History — customer
-- info, payment method, the price this specific unit sold for, notes,
-- financing/reference detail, and the sale/received dates. Which device was
-- sold stays locked (changing that is really a delete + a new sale, not an
-- edit) — Swap also stays locked, since it's tied to a specific trade-in
-- device logged elsewhere, not just a payment_method string (see the UI's
-- own gating in EditSaleModal.jsx; this RPC itself doesn't re-check that,
-- consistent with admin-only gating living in the UI everywhere else here).
--
-- customer_name/phone/notes/payment_method/reference_number/down_payment/
-- balance/sold_at all live once per sale (not per unit) — editing any of
-- them from one row of a Bulk order updates every sibling row in that same
-- order, since they all share the same sales record. price_at_sale and
-- date_added are per-device, so only the specific unit being edited is
-- touched.
--
-- balance is derived here (recomputed total minus down payment, floored at
-- 0), not taken from the client — same reasoning as process_sale, one
-- formula in one place so the two entry points can't disagree.
--
-- Signature changed (added p_payment_method, dropped p_balance) from the
-- version this replaced — create or replace doesn't swap in a changed
-- parameter list, it adds a second overload, so the old signature is
-- dropped first.
drop function if exists public.edit_sale(uuid, text, text, text, text, numeric, numeric, numeric, timestamptz, timestamptz);

create function public.edit_sale(
  p_sale_item_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_payment_method text,
  p_reference_number text,
  p_down_payment numeric,
  p_price_at_sale numeric,
  p_sold_at timestamptz,
  p_date_added timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_device_id uuid;
  v_total_amount numeric;
begin
  select sale_id, device_id into v_sale_id, v_device_id
  from public.sale_items where id = p_sale_item_id;

  update public.sale_items
  set price_at_sale = p_price_at_sale
  where id = p_sale_item_id;

  select sum(price_at_sale * quantity) into v_total_amount
  from public.sale_items where sale_id = v_sale_id;

  update public.sales
  set customer_name = p_customer_name,
      customer_phone = p_customer_phone,
      notes = p_notes,
      payment_method = p_payment_method,
      reference_number = p_reference_number,
      down_payment = p_down_payment,
      balance = case when p_down_payment is not null then greatest(v_total_amount - p_down_payment, 0) else null end,
      sold_at = p_sold_at,
      total_amount = v_total_amount
  where id = v_sale_id;

  update public.devices
  set date_added = p_date_added
  where id = v_device_id;
end;
$$;

grant execute on all functions in schema public to authenticated;

-- ============================================================
-- AUTO-CREATE PROFILE ROW ON SIGNUP
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY — basic authenticated-access policies.
-- Tighten these to per-role checks later (e.g. only 'admin' can delete).
-- ============================================================

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.categories enable row level security;
alter table public.product_models enable row level security;
alter table public.devices enable row level security;
alter table public.reorder_settings enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.customer_returns enable row level security;
alter table public.supplier_defective_records enable row level security;
alter table public.reservations enable row level security;
alter table public.expenses enable row level security;
alter table public.bulk_order_shells enable row level security;

-- profiles: everyone authenticated can view (needed for salesperson lookups),
-- but a user can only update their own row.
-- The with check here is load-bearing, not decorative: an UPDATE policy's
-- using clause alone only restricts WHICH row can be touched (their own),
-- not what it can be changed to. Without with check, a plain using clause
-- is reused for that too, and since 'admin' is a valid value of the role
-- check constraint, any authenticated user could otherwise run
-- `update profiles set role = 'admin' where id = auth.uid()` from the
-- client SDK and grant themselves admin. Comparing role to its own current
-- value (via the subquery) is what actually blocks that, while still
-- allowing a user to update their own name.
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Every other table: full CRUD for any authenticated user, for now.
create policy "suppliers_all_authenticated" on public.suppliers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "categories_all_authenticated" on public.categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "product_models_all_authenticated" on public.product_models
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "devices_all_authenticated" on public.devices
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "reorder_settings_all_authenticated" on public.reorder_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "sales_all_authenticated" on public.sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "sale_items_all_authenticated" on public.sale_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "customer_returns_all_authenticated" on public.customer_returns
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "supplier_defective_records_all_authenticated" on public.supplier_defective_records
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "reservations_all_authenticated" on public.reservations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "expenses_all_authenticated" on public.expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "bulk_order_shells_all_authenticated" on public.bulk_order_shells
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- SEED — categories (brand/prefix/storage catalog)
-- ============================================================
-- The four original Apple categories keep their historical plural
-- db_value ('iPhones' etc.) since existing device rows already use that
-- exact spelling. Every category from here on (Accessories/Repair Parts
-- included, plus every Android brand) uses the same spelling in both name
-- and db_value — there's no plural-form quirk to carry forward for those.
-- Android brand storages are RAM+Storage combo labels (e.g. '4GB+128GB'),
-- not storage-only — these budget models are commonly stocked in several
-- RAM variants of the same storage size, which a storage-only label can't
-- distinguish. Set from the store's actual 2026-08-07 stock list; adjust
-- via Manage Catalog as new combos come in rather than editing here.
-- Android brands' storages below are the union of every real RAM+storage
-- combo actually sold for that brand's specific catalogued models (see the
-- product_models seed below) -- researched per-model rather than guessed,
-- since this one shared list is what every model in the brand's dropdown
-- draws from (the schema doesn't have a per-model storage override, only
-- per-brand). Itel keeps 'N/A' deliberately: the Itel Power 120 in its
-- lineup is a real 2G feature phone with MB-scale memory, not a
-- GB-storage smartphone, so it doesn't have a real RAM+storage combo to
-- offer -- forcing one would misrepresent the actual hardware.
insert into public.categories (name, db_value, brand, prefix, storages, is_accessory_like) values
  ('iPhone', 'iPhones', 'Apple', 'IP', ARRAY['32GB','128GB','256GB','512GB','1TB'], false),
  ('iPad', 'iPads', 'Apple', 'IPD', ARRAY['64GB','128GB','256GB','512GB'], false),
  ('Apple Watch', 'Apple Watches', 'Apple', 'AW', ARRAY['-'], false),
  ('MacBook', 'MacBooks', 'Apple', 'MB', ARRAY['256GB','512GB','1TB','2TB'], false),
  ('Accessories', 'Accessories', 'Various', 'AC', ARRAY['N/A'], true),
  ('Repair Parts', 'Repair Parts', 'Various', 'RP', ARRAY['N/A'], true),
  ('Samsung', 'Samsung', 'Samsung', 'SS', ARRAY['4GB+64GB','4GB+128GB','6GB+128GB','8GB+128GB','6GB+256GB','8GB+256GB','12GB+256GB','12GB+512GB'], false),
  ('Vivo', 'Vivo', 'Vivo', 'VV', ARRAY['4GB+64GB','4GB+128GB','8GB+256GB','12GB+256GB'], false),
  ('Realme', 'Realme', 'Realme', 'RM', ARRAY['4GB+64GB','4GB+128GB','6GB+128GB','4GB+256GB','6GB+256GB','8GB+128GB','8GB+256GB'], false),
  ('Redmi', 'Redmi', 'Redmi', 'RD', ARRAY['3GB+64GB','4GB+64GB','4GB+128GB','4GB+256GB','6GB+128GB','8GB+128GB','8GB+256GB'], false),
  ('Infinix', 'Infinix', 'Infinix', 'IF', ARRAY['4GB+64GB','4GB+128GB','6GB+128GB','8GB+128GB','6GB+256GB','8GB+256GB','12GB+256GB','12GB+512GB'], false),
  ('Tecno', 'Tecno', 'Tecno', 'TC', ARRAY['4GB+64GB','4GB+128GB','6GB+128GB','8GB+128GB','12GB+128GB','4GB+256GB','8GB+256GB','12GB+256GB','12GB+512GB'], false),
  ('Honor', 'Honor', 'Honor', 'HN', ARRAY['6GB+128GB','8GB+128GB','8GB+256GB','8GB+512GB'], false),
  ('Itel', 'Itel', 'Itel', 'IT', ARRAY['N/A','2GB+64GB','3GB+64GB','4GB+64GB','4GB+128GB'], false),
  ('POCO', 'POCO', 'POCO', 'PC', ARRAY['3GB+64GB','4GB+128GB','6GB+128GB','8GB+256GB','8GB+512GB','12GB+512GB'], false),
  ('OPPO', 'OPPO', 'OPPO', 'OP', ARRAY['4GB+64GB','4GB+128GB','6GB+128GB','8GB+128GB','4GB+256GB','8GB+256GB','12GB+256GB','12GB+512GB'], false)
on conflict (name) do update set storages = excluded.storages;

-- ============================================================
-- SEED — default product catalog (models + colors)
-- ============================================================
insert into public.product_models (category, name, colors) values
  ('iPhone', 'iPhone XR', ARRAY['Black','White','Blue','Coral','Yellow','(Product)Red']),
  ('iPhone', 'iPhone 11', ARRAY['Black','Green','Yellow','Purple','White','(Product)Red']),
  ('iPhone', 'iPhone 11 Pro', ARRAY['Midnight Green','Space Gray','Silver','Gold']),
  ('iPhone', 'iPhone 11 Pro Max', ARRAY['Midnight Green','Space Gray','Silver','Gold']),
  ('iPhone', 'iPhone 12 mini', ARRAY['Black','White','(Product)Red','Green','Blue','Purple']),
  ('iPhone', 'iPhone 12', ARRAY['Black','White','(Product)Red','Green','Blue','Purple']),
  ('iPhone', 'iPhone 12 Pro', ARRAY['Graphite','Silver','Gold','Pacific Blue']),
  ('iPhone', 'iPhone 12 Pro Max', ARRAY['Graphite','Silver','Gold','Pacific Blue']),
  ('iPhone', 'iPhone 13 mini', ARRAY['Pink','Blue','Midnight','Starlight','(Product)Red','Green']),
  ('iPhone', 'iPhone 13', ARRAY['Pink','Blue','Midnight','Starlight','(Product)Red','Green']),
  ('iPhone', 'iPhone 13 Pro', ARRAY['Graphite','Gold','Silver','Sierra Blue','Alpine Green']),
  ('iPhone', 'iPhone 13 Pro Max', ARRAY['Graphite','Gold','Silver','Sierra Blue','Alpine Green']),
  ('iPhone', 'iPhone 14', ARRAY['Midnight','Starlight','(Product)Red','Blue','Purple','Yellow']),
  ('iPhone', 'iPhone 14 Plus', ARRAY['Midnight','Starlight','(Product)Red','Blue','Purple','Yellow']),
  ('iPhone', 'iPhone 14 Pro', ARRAY['Space Black','Silver','Gold','Deep Purple']),
  ('iPhone', 'iPhone 14 Pro Max', ARRAY['Space Black','Silver','Gold','Deep Purple']),
  ('iPhone', 'iPhone 15', ARRAY['Black','Blue','Green','Yellow','Pink']),
  ('iPhone', 'iPhone 15 Plus', ARRAY['Black','Blue','Green','Yellow','Pink']),
  ('iPhone', 'iPhone 15 Pro', ARRAY['Black Titanium','White Titanium','Blue Titanium','Natural Titanium']),
  ('iPhone', 'iPhone 15 Pro Max', ARRAY['Black Titanium','White Titanium','Blue Titanium','Natural Titanium']),
  ('iPhone', 'iPhone 16', ARRAY['Black','White','Pink','Teal','Ultramarine']),
  ('iPhone', 'iPhone 16 Plus', ARRAY['Black','White','Pink','Teal','Ultramarine']),
  ('iPhone', 'iPhone 16 Pro', ARRAY['Black Titanium','White Titanium','Natural Titanium','Desert Titanium']),
  ('iPhone', 'iPhone 16 Pro Max', ARRAY['Black Titanium','White Titanium','Natural Titanium','Desert Titanium']),
  ('iPhone', 'iPhone 16e', ARRAY['Black','White']),
  ('iPhone', 'iPhone 17', ARRAY['Black','White','Lavender','Sage','Mist Blue']),
  ('iPhone', 'iPhone Air', ARRAY['Space Black','Cloud White','Sky Blue','Light Gold']),
  ('iPhone', 'iPhone 17 Pro', ARRAY['Silver','Cosmic Orange','Deep Blue']),
  ('iPhone', 'iPhone 17 Pro Max', ARRAY['Silver','Cosmic Orange','Deep Blue']),

  ('iPad', 'iPad Pro M4', ARRAY['Space Black','Silver']),
  ('iPad', 'iPad Air 6', ARRAY['Space Gray','Blue','Purple','Starlight']),
  ('iPad', 'iPad 10th Gen', ARRAY['Blue','Pink','Yellow','Silver']),

  ('Apple Watch', 'Apple Watch Series 9', ARRAY['Midnight','Starlight','Silver','Pink','(Product)Red']),
  ('Apple Watch', 'Apple Watch Ultra 2', ARRAY['Natural Titanium']),
  ('Apple Watch', 'Apple Watch SE', ARRAY['Midnight','Starlight','Silver']),

  ('MacBook', 'MacBook Air M4', ARRAY['Sky Blue','Silver','Starlight','Midnight']),
  ('MacBook', 'MacBook Air M3', ARRAY['Midnight','Starlight','Space Gray','Silver']),
  ('MacBook', 'MacBook Pro 14" M4', ARRAY['Space Black','Silver']),
  ('MacBook', 'MacBook Pro 16" M4', ARRAY['Space Black','Silver']),

  ('Accessories', 'Phone Case', ARRAY['Black','Clear','Blue','Pink','Red','White']),
  ('Accessories', 'Screen Protector (Tempered Glass)', ARRAY['N/A']),
  ('Accessories', 'Charger / Power Adapter', ARRAY['White','Black']),
  ('Accessories', 'Lightning Cable', ARRAY['White','Black']),
  ('Accessories', 'USB-C Cable', ARRAY['White','Black']),
  ('Accessories', 'Wireless Earbuds', ARRAY['White','Black']),
  ('Accessories', 'Power Bank', ARRAY['Black','White']),
  ('Accessories', 'Wireless Charger', ARRAY['Black','White']),

  ('Repair Parts', 'iPhone LCD Screen', ARRAY['N/A']),
  ('Repair Parts', 'iPhone Battery', ARRAY['N/A']),
  ('Repair Parts', 'iPhone Charging Port Flex', ARRAY['N/A']),
  ('Repair Parts', 'iPhone Back Glass', ARRAY['N/A']),
  ('Repair Parts', 'iPad LCD Screen', ARRAY['N/A']),
  ('Repair Parts', 'iPad Battery', ARRAY['N/A']),
  ('Repair Parts', 'MacBook Battery', ARRAY['N/A']),
  ('Repair Parts', 'Apple Watch Battery', ARRAY['N/A'])
on conflict (category, name) do nothing;

-- Real stock as of 2026-08-07. Colors below are researched real retail
-- options per model (Philippines market where confirmed, since that's
-- where this shop sells) rather than the earlier ['N/A'] placeholder —
-- see the categories block above for how each brand's shared storage
-- dropdown was derived from the same research.
-- "Realme 16" / "Realme Techlife Neo Pad" are renamed to their real
-- official names (Realme 16 5G / realme TechLife Pad Neo) below this
-- insert — the names here were close but not what the device is actually
-- sold as.
insert into public.product_models (category, name, colors) values
  ('iPhone', 'iPhone 7', ARRAY['N/A']),

  ('Redmi', 'Redmi A7', ARRAY['Black','Sky Blue','Orchid Purple']),
  ('Redmi', 'Redmi A7 Pro', ARRAY['Black','Mist Blue','Palm Green','Sunset Orange']),
  ('Redmi', 'Redmi 15C 5G', ARRAY['Midnight Black','Mint Green','Dusk Purple']),
  ('Redmi', 'Redmi Note 15', ARRAY['Black','Glacier Blue','Purple']),
  ('Redmi', 'Redmi Pad 2', ARRAY['Graphite Gray','Mint Green','Lavender Purple']),

  ('Vivo', 'Vivo Y05', ARRAY['Voyage Black','Haze Blue','Summit Platinum']),
  ('Vivo', 'Vivo Y11d', ARRAY['Summit Platinum','Voyage Black']),
  ('Vivo', 'Vivo V70 FE', ARRAY['Ocean Blue','Muse Purple','Urban Silver']),

  ('Samsung', 'Galaxy A07', ARRAY['Black','Light Violet']),
  ('Samsung', 'Galaxy A17', ARRAY['Black','Gray','Light Blue']),
  ('Samsung', 'Galaxy A27', ARRAY['Black','Blue','Light Green','Light Pink']),
  ('Samsung', 'Galaxy A16', ARRAY['Blue Black','Light Gray','Gold','Light Green']),
  ('Samsung', 'Galaxy A37', ARRAY['Awesome Charcoal','Awesome Graygreen','Awesome Lavender','Awesome White']),
  ('Samsung', 'Galaxy A57', ARRAY['Awesome Navy','Awesome Gray','Awesome Icyblue','Awesome Lilac']),

  ('Infinix', 'Infinix Smart 20', ARRAY['Shadow Black','Cloudline Blue','Polaris Titanium','Sunlike Orange']),
  ('Infinix', 'Infinix Hot 70', ARRAY['Night Pulse','Dive Blue','Silver Dancer','Thermo Orange','Green Texture','Quiet Violet']),
  ('Infinix', 'Infinix Hot 60 Pro+', ARRAY['Titanium Silver','Sleek Black','Coral Tides','Misty Violet']),
  ('Infinix', 'Infinix Note Edge', ARRAY['Lunar Titanium','Silk Green','Stellar Blue','Shadow Black']),
  ('Infinix', 'Infinix Note 60 Pro', ARRAY['Mist Titanium','Deep Ocean Blue','Solar Orange','Mocha Brown','Torino Black','Frost Silver']),
  ('Infinix', 'Infinix GT 50 Pro', ARRAY['Black Abyss','Red Blaze','Silver Glacier']),

  ('Realme', 'Realme Note 80', ARRAY['Glacier Blue','Storm Black']),
  ('Realme', 'Realme Note 70', ARRAY['Beach Gold','Obsidian Black']),
  ('Realme', 'Realme C100i', ARRAY['Grey','Purple']),
  ('Realme', 'Realme C85 5G', ARRAY['Parrot Purple','Peacock Green']),
  ('Realme', 'Realme C100', ARRAY['Eternal Brown','Triumphant Purple','Glory White']),
  ('Realme', 'Realme 16', ARRAY['Air Black','Air White']),
  ('Realme', 'Realme Techlife Neo Pad', ARRAY['Sky Blue','Storm Grey']),

  ('Honor', 'Honor X8D', ARRAY['Light Blue','Velvet Grey','Velvet Black']),
  ('Honor', 'Honor Pad X9a', ARRAY['Gray']),

  -- Itel Power 120 is a real 2G feature phone, not a smartphone (4MB
  -- RAM/storage, no Android) — 'N/A' here isn't a placeholder, it's
  -- accurate: forcing a GB-scale color/storage pick onto it would
  -- misrepresent the actual device.
  ('Itel', 'Itel Power 120', ARRAY['Blue','Green','Ice Blue']),
  ('Itel', 'Itel A100c', ARRAY['Pure Black','Titanium Gold','Blaze Blue','Silk Green']),
  ('Itel', 'Itel Vista Tab 30s', ARRAY['Deep Grey']),

  -- Tecno had a category/prefix set up but no real models were ever
  -- added to it — these six are researched current PH-market stock,
  -- spanning the same budget-to-lower-midrange range as its Transsion
  -- sibling brands (Infinix, Itel) already in this catalog.
  ('Tecno', 'Tecno Spark Go 3', ARRAY['Titanium Grey','Ink Black','Galaxy Blue','Aurora Purple']),
  ('Tecno', 'Tecno Spark 40C', ARRAY['Ink Black','Titanium Grey','Ripple Blue','Veil White']),
  ('Tecno', 'Tecno Spark 40', ARRAY['Ink Black','Titanium Grey','Veil White','Mirage Blue','Sun Orange']),
  ('Tecno', 'Tecno Camon 40', ARRAY['Galaxy Black','Glacier White','Emerald Lake Green','Emerald Glow Green']),
  ('Tecno', 'Tecno Pova 7', ARRAY['Geek Black','Magic Silver','Oasis Green']),
  ('Tecno', 'Tecno Camon 40 Pro 5G', ARRAY['Galaxy Black','Emerald Lake Green','Glacier White','Sandy Titanium']),
  ('Tecno', 'Tecno Camon 50 Ultra 5G', ARRAY['Moonshadow Black','Cypress Green','Nebula Titanium','Luminous Orange','Misty Purple']),
  -- Plain "Spark 50" is the 4G model specifically -- a separate "Spark 50
  -- 5G" (different chipset, different color lineup) is also sold in PH;
  -- this is the base model per the name alone, same convention used for
  -- every other ambiguous name in this catalog. "Dynamic Orange" added
  -- per the shop's own confirmation (an actual unit on hand), not from
  -- the earlier web research.
  ('Tecno', 'Tecno Spark 50', ARRAY['Halo Blue','Titanium Grey','Ink Black','Aurora Purple','Bloom Pink','Dynamic Orange']),

  -- POCO (Xiaomi's sub-brand, same market segment as Redmi) and OPPO
  -- (BBK sibling to Vivo/Realme, already stocked) -- researched current
  -- PH-market models. Both brands have heavy same-family name collisions
  -- (e.g. POCO M8 / M8 Pro / M8s are three different phones with
  -- different color sets; OPPO A5 / A5 5G and A6 / A6 Pro / A6x / A6s /
  -- A6c / A6t are all separate current SKUs) -- these are specifically
  -- the plain, non-Pro/non-5G-suffixed base models unless the name says
  -- otherwise, since that's what the model name alone unambiguously
  -- refers to.
  ('POCO', 'POCO C71', ARRAY['Power Black','Cool Blue','Desert Gold']),
  ('POCO', 'POCO C75', ARRAY['Black','Green','Gold']),
  ('POCO', 'POCO M8 5G', ARRAY['Black','Green','Silver']),
  ('POCO', 'POCO M8 Pro 5G', ARRAY['Black','Silver','Green']),
  ('POCO', 'POCO M8s 5G', ARRAY['Black','White']),
  ('POCO', 'POCO X8 Pro', ARRAY['Black','White','Mint Green']),

  ('OPPO', 'OPPO A3x', ARRAY['Nebula Red','Ocean Blue']),
  ('OPPO', 'OPPO A5i', ARRAY['Starry Purple','Nebula Red']),
  ('OPPO', 'OPPO A5', ARRAY['Mist White','Aurora Green']),
  ('OPPO', 'OPPO A60', ARRAY['Midnight Purple','Ripple Blue']),
  ('OPPO', 'OPPO A6', ARRAY['Sakura Pink','Sapphire Blue','Aurora Gold']),
  ('OPPO', 'OPPO Reno14 F 5G', ARRAY['Opal Blue','Luminous Green','Glossy Pink'])
on conflict (category, name) do update set colors = excluded.colors;

-- Renamed to what these devices are actually sold as -- "Realme 16" and
-- "Realme Techlife Neo Pad" were close but not the real official names.
-- Renaming (not just adding a new row) so Manage Catalog doesn't end up
-- with both an old, inaccurate entry and a new correct one side by side.
-- Existing devices already logged under the old name are untouched
-- (device_name is free text, not a foreign key to this table) -- this
-- only changes what new dropdown selections produce going forward.
update public.product_models set name = 'Realme 16 5G'
where category = 'Realme' and name = 'Realme 16';

update public.product_models set name = 'realme TechLife Pad Neo'
where category = 'Realme' and name = 'Realme Techlife Neo Pad';
