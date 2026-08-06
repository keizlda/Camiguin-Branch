# Mark Gadgets CGN

A standalone POS/inventory system forked from the main Mark Gadgets store's
codebase, for CGN's own branch. Same app, same features — but CGN is "the
store" here, not a bulk buyer of someone else's inventory.

**Displayed store name**: as of 2026-08-07, every customer/user-facing
occurrence of the brand (Sidebar, Login footer, receipts, Reports/Financial
print headers, the Financial Excel export, the browser tab title) reads
"MARK Gadgets & Accessories Shop" — the actual trading name — not "Mark
Gadgets CGN". "Mark Gadgets CGN" is still fine to use as this project's own
internal/repo identity (folder name, git remote, this doc's own title,
Supabase project name) since "CGN" (Camiguin branch) is what distinguishes
this codebase from the sibling `mark-gadgets-pos` project it was forked
from — just don't reintroduce it into UI text a customer would see.

## Tech Stack

- React 19 + Vite 8 + Tailwind v4
- Supabase (Postgres + Auth) called directly from the frontend — no custom
  backend server
- Deploy target: GitHub → Vercel, auto-deploy on push to `main` (not wired
  up yet — no remote configured)

## How this differs from the main Mark Gadgets store

The main store tracks CGN as a wholesale bulk buyer: a "CGN Ledger" in
Financial, a `cgn_resales` table for what CGN resells to their own
customers, and a Reports filter that excludes any sale to "CGN" as a
customer. None of that exists here:

- No `cgn_resales` table, no CGN Ledger, no Store/CGN toggle in Financial —
  Financial has one ledger, period.
- No CGN-exclusion filter in Reports — every sale counts.
- The generic Bulk Buyer / Bulk Order features ARE kept (any wholesale sale
  to any buyer, tracked via `sales.order_type = 'Bulk'`) since CGN sells
  wholesale to its own buyers too.

When porting a feature over from the main store project, check whether it
touches CGN-Ledger/`cgn_resales` concepts first — those don't translate
here and need to be dropped, not adapted.

## Status (update this section as things change)

- Code is complete and caught up with the main store's feature set as of
  2026-08-05 — lint and build both pass clean.
- Git: pushed to GitHub at github.com/keizlda/Camiguin-Branch (public),
  local branch renamed `master` → `main` to match. Deployed on Vercel,
  auto-deploys on push to `main`.
- Supabase: **set up and live** — project "Camiguin Branch", schema.sql has
  been run, RLS confirmed working, first admin user created and promoted.
  `.env` has real values (still gitignored, never committed).
- `supabase/schema.sql` is the single source of truth to run in a fresh
  Supabase project's SQL Editor — there is no `supabase/migrations/`
  history here to replay; schema.sql already reflects the current desired
  end state. Since the project now has a live database, changes past this
  point need a hand-run migration against the live DB too (idempotent,
  additive-only) — schema.sql alone no longer brings an existing project
  up to date, only a fresh one.
- As of 2026-08-06: product categories/brands moved from a hardcoded list
  (`referenceData.js`) into a `categories` DB table, admin-editable at
  runtime via Add Device → Manage Catalog → Categories & Brands. Batch
  codes are now brand-prefixed (`<PREFIX>MMDDYY-###`, e.g. `SS080626-001`),
  generated via a button on Add Device using each category's own prefix.
  Also added: barcode label printing (Code128, Add Device + All Devices,
  single or batch via row checkboxes), phone/webcam camera barcode
  scanning (`ScanBarcodeModal`, wired into every batch-code search/entry
  field plus scan-to-cart on New Sale), and a printable sales receipt (New
  Sale post-sale + Sales History row action, gathers every unit in a sale
  even though Sales History itself is one row per unit).

## Architecture Patterns

- **Any operation that must be atomic lives in a Postgres RPC function**,
  not client-side multi-step calls. A dropped connection between step 1 and
  step 2 of a client-side "transaction" leaves data half-done — e.g. a sale
  recorded but the device never marked Sold. RPCs use:
  ```sql
  create function public.some_action(...)
  returns void
  language plpgsql
  security invoker
  set search_path = public
  as $$ ... $$;
  ```
- **RLS on every table**, one permissive policy (`for all using (auth.role()
  = 'authenticated')`), enforced at the RPC layer via `security invoker` —
  admin-only gating happens in the UI (hide the control), not in the RPC
  itself.
- Every schema change should be reflected directly in `supabase/schema.sql`
  since that's the only source of truth right now (no migrations folder).

## Hard-Won Gotchas

1. **`create or replace function` with a changed parameter list creates a
   SECOND overload, it does not replace the old one.** Symptom: "Could not
   choose the best candidate function." Fix: `drop function` the exact old
   signature first before creating the new one.

2. **When writing a "delete X" or "undo Y" RPC, enumerate every table with a
   foreign key pointing at the row being touched — not just the obvious
   one.** A missed reference throws a raw `foreign key violation` (Postgres
   `23503`), not a clean error. Grep the schema for every
   `references public.<table> (id)` before writing the cleanup order.

3. **Every `promise.then(setState)` in a data-loading hook needs a
   `.catch()`.** Without one, a failed query leaves the UI showing an empty
   list with no error — which reads to a user as "my data got deleted," not
   "a query failed."

4. **Don't trust a remembered third-party API shape — verify it before
   wiring it into something a user will click blind.** Write a throwaway
   smoke test that actually calls the library the way the real code will.

## Data Safety (once this holds real, live data)

Once real users are actively adding data through the app, every fix
changes character:

- **Idempotent**: safe to re-run.
- **Targeted**: touches only the specific rows in question, never a blanket
  `update`/`delete` across a whole table.
- **Additive-only**: never `truncate`, never a destructive rewrite.
- **Verify current state before writing a fix** — query live data fresh
  rather than assuming from an earlier conversation.

## Workflow

- Prefer terse, direct responses — state what changed and what's next, skip
  the recap.
- Run lint + build before every commit; fix what breaks rather than
  guessing.
- New commits over amends, unless explicitly asked to amend.
- Before any destructive git operation, or before touching git remotes,
  Vercel, or anything that looks like a real deploy/production step —
  confirm first. Nothing about this project is deployed yet; don't assume
  that's changed without checking.
