# WorkRedesign.sg Admin Portal — Setup Guide

This extends the public WorkRedesign.sg site with a real backend (Supabase:
Postgres + Auth + Row Level Security) and an admin/CMS layer on top of it —
content and menu management, a talent profile library with tiered public/
private/contact visibility, hirer and staff account approval workflows, and
feature flags for adding functionality later without a code deploy.

Everything here is still plain HTML/CSS/vanilla JS with no build step — the
admin portal is deployed exactly like the public site (GitHub Pages), and
Supabase is the only new moving part.

## What's new in this layer

```
workredesign-sg/
├── supabase/
│   ├── schema.sql          Full DB schema, roles, and RLS policies — run this first
│   └── seed.sql            Optional starter content (the 3 real grants, default menu)
├── admin/
│   ├── login.html           Staff sign-in
│   ├── dashboard.html        Overview + what needs review
│   ├── content.html          Edit site copy + nav menu
│   ├── grants.html            Manage grants + their readiness checklists
│   ├── talent.html            Review/approve PMET submissions, manage published profiles, decide intro requests
│   ├── accounts.html          Approve hirer accounts, manage staff accounts + roles
│   ├── settings.html          Feature flags + audit log (super_admin only)
│   ├── css/admin.css
│   └── js/ (auth.js, dashboard.js, content.js, grants.js, talent.js, accounts.js, settings.js)
├── account.html              Public: hirer/PMET sign up & sign in
├── talent-submit.html         Public: PMET self-submits their own profile
├── directory.html             Public: browse the anonymised talent library
└── js/supabaseClient.js       Fill in your Supabase project URL + anon key here
```

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
3. Open `js/supabaseClient.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://your-project-ref.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-public-key";
   ```
   The anon key is safe to expose in client-side code — it has no power beyond
   what the Row Level Security policies in `schema.sql` allow it to do. **Never**
   put your Supabase **service_role** key in any file in this repository.

## 2. Run the database schema

1. In your Supabase project, go to **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and run it.
3. (Optional but recommended) Run `supabase/seed.sql` next to pre-populate the
   three real Singapore workforce grants, a default menu, and starter content
   blocks, instead of starting from empty tables.

Both files are idempotent-ish but not fully re-runnable — `schema.sql` will
error if run twice against the same database (tables already exist). If you
need to start over, drop the tables/types it created, or spin up a fresh
Supabase project.

### What the schema enforces (so you don't have to trust the app code alone)

- **Four-tier talent visibility**, enforced at the database level via Row
  Level Security, not just hidden in the UI:
  1. **Public card** (`talent_public_info`) — anyone, no login, anonymised.
  2. **Private detail** (`talent_private_info`) — only hirers your team has
     approved for full library access.
  3. **Contact info** (`talent_contacts`) — only released for a specific
     hirer + profile pair after your team approves an introduction request.
  4. **Workflow/status** (`talent_profiles`) — staff and the owning PMET only.
- **Role separation between staff types** — a `content_editor` genuinely
  cannot touch talent data or approve accounts; a `talent_manager` genuinely
  cannot edit site content; only `super_admin` can grant staff roles or
  change another account's `hirer_status` outside the `approver` role's
  narrow permission to do exactly that.
- **No self-escalation** — a hirer cannot grant themselves full library
  access by editing their own account, and a public signup can never create
  a staff account, however it crafts its signup request.

This was verified by seeding representative accounts of every role and type
and running real queries against a live Postgres instance under each role —
including the two adversarial cases that matter most: *does an approved_full
hirer without an approved introduction still leak contact details?* (no) and
*can a lower-privileged staff role touch data outside its own area?* (no,
after two real bugs found in that testing were fixed before this shipped).

## 3. Bootstrap your first super_admin

There's no self-service way to create a staff account — that's deliberate.
1. Open `account.html` on your deployed site (or run it locally) and sign up
   once as **any** account type, using the email you want as your first admin.
2. Back in the Supabase SQL Editor, run:
   ```sql
   update public.profiles
   set account_type = 'staff', staff_role = 'super_admin'
   where email = 'you@yourorg.sg';
   ```
3. Sign in at `admin/login.html` with that same email/password. You now have
   full access, including promoting other staff from `admin/accounts.html`
   going forward — you won't need to touch SQL again for that.

## 4. The role model

| Role | Can do |
|---|---|
| `super_admin` | Everything — including granting/changing any staff role, and everything below |
| `content_editor` | Edit site content blocks, the nav menu, and grants + their checklists |
| `talent_manager` | Review/approve/reject PMET submissions, publish/pause profiles, decide introduction requests |
| `approver` | Approve/reject/suspend hirer accounts (summary vs. full library access) — nothing else |

Hirer and PMET accounts are not "staff" at all — they're regular signups at
`account.html`, gated by `hirer_status` (`pending` → `approved_summary` /
`approved_full`, or `rejected`/`suspended`) for hirers, and by
`talent_profiles.status` (`pending_review` → `approved`/`rejected`) for PMETs.

## 5. Day-to-day use

- **Content & Menu** (`content.html`): edit any text block or nav item; changes
  are live on the public site immediately (the public pages currently still
  read their copy from `js/data.js` — see "Wiring the public site" below to
  fully switch them over to reading from Supabase).
- **Grants** (`grants.html`): add, edit, or unpublish a grant and its
  checklist without touching code.
- **Talent Library** (`talent.html`): three tabs — pending review (approve or
  reject a PMET's self-submission, with full contact visibility since you're
  staff), published profiles (pause/republish), and introduction requests
  (approve or decline a hirer's request to be introduced to a specific PMET).
- **Accounts & Approvals** (`accounts.html`): approve hirer signups for
  summary or full access, and (super_admin only) promote an existing account
  to staff or change someone's staff role.
- **Settings** (`settings.html`, super_admin only): feature flags for rolling
  out new functionality gradually, and an audit log of every admin action for
  accountability and PDPA-relevant traceability.

## 6. Wiring the public site to the CMS content (optional next step)

Right now, `content.html` and `grants.html` in the admin portal write to real
database tables, but the **public** pages (`index.html`, `grants.html`, etc.)
still read their copy from the static `js/data.js` file, exactly as before
this admin layer was added — so editing content in the admin portal doesn't
yet change what visitors see until you take one more step: have the public
pages fetch from Supabase (`content_blocks`, `menu_items`, `grants` — all
readable by `anon` per the RLS policies) instead of `js/data.js`, falling
back to the bundled defaults if the fetch fails. This is a deliberately
separate step so the public site keeps working standalone even before you've
set up Supabase at all.

## 7. Using feature flags to scale

`feature_flags` exists specifically so you can add new functionality without
redeploying: check `feature_flags.is_enabled` for a given `flag_key` from any
page's JS before showing a new feature, and toggle it from
`admin/settings.html` once you're ready. Two flags are seeded as examples:
`directory_fuzzy_search` (for the pg_trgm/pgvector upgrade path described
earlier) and `pmet_self_editing_after_approval`.

## 8. What was tested, and what wasn't

- **Database schema and RLS policies**: tested end-to-end against a real,
  local Postgres instance — seeded with one account of every role and type,
  and 10 explicit test scenarios covering every visibility tier and every
  role boundary, including two real bugs this testing caught and fixed
  before delivery (a staff-role permission leak, and a non-functional
  `approver` role).
- **Admin/public UI logic**: tested against a mocked Supabase client running
  the actual shipped JS files in a real browser (Playwright), covering every
  admin page, the approve/reject/publish workflows, and role-based access
  gating in both directions. This validates the application logic and DOM
  rendering; it does not validate your live Supabase project's exact
  configuration.
- **Not yet tested**: the real, live Supabase project you create — do one
  pass through the flows yourself after setup (sign up as a hirer, submit a
  PMET profile, approve both, request and approve an introduction) before
  pointing real users at it.

## 9. Security notes

- Never commit or expose your Supabase **service_role** key — it bypasses
  RLS entirely. Only the anon key belongs in this codebase.
- Consent tracking (`consent_public_card`, `consent_private_detail`,
  `consent_date` on `talent_profiles`) is collected at submission time — if
  you change what's shown at each tier, revisit whether existing consent
  still covers the new disclosure.
- The audit log (`settings.html`) records every content edit, approval,
  rejection, and role change — useful both operationally and if you ever
  need to demonstrate PDPA-compliant handling of the talent pool's data.
