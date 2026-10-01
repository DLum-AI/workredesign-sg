# WorkRedesign.sg

A free, static web tool that walks Singapore hirers through five stages:
**Awareness → Education → Execution → Grant Mapping → Talent Match** —
turning "we have a staffing headache" into "here's a fractional/job-share
role, here's what funds it, here's who could fill it."

No backend, no build step, no database. Pure HTML/CSS/vanilla JS, using
the browser's `localStorage` to carry a hirer's answers between pages.
This matches the MVP scope: fast to publish, free to run, nothing to
maintain beyond the content in `js/data.js`.

> **Admin portal and talent library added.** This site now also has an
> optional backend (Supabase) and admin/CMS layer for managing content, the
> talent profile library, and account approvals — see
> **[README-ADMIN.md](./README-ADMIN.md)** for that setup. The public site
> below still works standalone without it.

> **Grounded in the real Skills Framework.** Stage 1, Stage 2/3, and the PMET
> profile form now all draw on the same official SkillsFuture Skills
> Framework data that powers [SkillsMap.sg](https://github.com/DLum-AI) —
> 39 sectors, ~2,030 job roles, and a 2,388-skill taxonomy — instead of free
> text. See **"Skills Framework integration"** below for how this works and
> what to re-run if the underlying dataset is ever refreshed.

## Folder structure

```
workredesign-sg/
├── index.html          Stage 1 — "Is this job ready for redesign?" quiz
├── task-map.html        Stage 2/3 — task deconstruction + classification tool
├── grants.html           Stage 4 — grant info + application-readiness checklists
├── match.html            Stage 5 — talent match request form
├── about.html            Framework explainer / credibility page
├── data/
│   └── skillsmap/          Static Skills Framework data (sectors, roles, unique skills)
│       — see "Skills Framework integration" below
├── css/
│   └── styles.css        All shared styling (one file, CSS variables at the top)
├── js/
│   ├── data.js            ← EDIT THIS FIRST: org name, contact email, grant text, quiz questions
│   ├── layout.js          Renders the shared header/nav/footer on every page
│   ├── quiz.js            Stage 1 logic
│   ├── evaluation-link.js  Stage 1 ↔ Skills Framework role link
│   ├── taskmap.js         Stage 2/3 logic (task classification + recommendation engine)
│   ├── skillsmap-data.js  Fetches/searches the Skills Framework data in data/skillsmap/
│   ├── role-search-widget.js  Reusable "search for an official job role" widget
│   ├── skill-picker-widget.js Reusable chip-based skill picker (PMET form, match request, directory filter)
│   ├── grants.js          Stage 4 checklist logic
│   └── match.js           Stage 5 form handling (mailto fallback, or POST to a form endpoint)
└── README.md              This file
```

## Skills Framework integration

Stage 1 (`index.html`), Stage 2/3 (`task-map.html`), and the PMET profile form
(`talent-submit.html`) are grounded in the same official SkillsFuture Skills
Framework data used by the companion SkillsMap.sg tool, instead of free text:

- **Stage 1 (evaluation)** — after the readiness quiz, a hirer can optionally
  search for and link the closest matching official job role. This is purely
  additive to the quiz's own verdict, and carries forward to Stage 2/3.
- **Stage 2/3 (job redesign)** — the same role search is available on the
  Task Map page (either standalone, or picking up a role linked in Stage 1).
  Linking a role adds a **"+ Add official tasks for linked role"** button
  that appends that role's official Critical Work Functions/Key Tasks as new
  task rows (append-only — it never overwrites what a hirer has already
  typed, and defaults each added task's nature to "needs judgement" rather
  than "rules-based", since these are the Framework's own described duties,
  not rote admin — review and re-tag each one for how your team actually
  performs it). After analysis, a linked role also shows a **"Required
  skills"** panel grouped by category, straight from the Skills Framework.
- **Talent profile skills selection (`talent-submit.html`)** — the PMET
  profile form's "Skills / tools" field is a type-to-search, click-to-add
  chip picker against the same 2,388-skill taxonomy, rather than a free-text,
  comma-separated box. Pressing Enter still adds free text for a skill that
  isn't in the taxonomy. The underlying stored value is unchanged (an array
  of skill-title strings in `talent_public_info.skills_tags`) — no database
  schema change was needed.

- **Talent match request (`match.html`)** — a "Skills needed" chip picker so
  the hirer states required skills from the official taxonomy. It is
  pre-filled from a role linked in Stage 1 / 2-3 (editable), and the selected
  skills are included in the request (both the email fallback and the form
  endpoint payload as `skillsNeeded`).
- **Talent directory (`directory.html`)** — a "Filter by skills" chip picker
  alongside the existing text search; a profile shows if it has *any* selected
  skill, and the filter combines with the function/arrangement filters.
- **Admin talent review (`admin/talent.html`)** — skills a PMET typed that are
  not in the official taxonomy are flagged "free text" so reviewers can vet
  them before approving.

All of this is still static JSON fetched client-side (`data/skillsmap/`), so
it works the same way the rest of the site does: no backend, no build step,
must be served over `http(s)://` (not opened as a `file://` URL — browsers
block `fetch()` of local files entirely, which would otherwise leave these
search boxes stuck on "Searching…" with no explanation).

**Refreshing the Skills Framework data:** `data/skillsmap/` is a straight copy
of SkillsMap.sg's own generated `data/` folder (`sectors.json`,
`roles/<sector>.json`, `unique_skills.json` — `skill_index.json` is skipped
here since nothing on this site needs the reverse skill→roles lookup). If
SSG/WSG publish an updated dataset, re-run SkillsMap.sg's own ETL
(`etl/build_data.py` in that project) and copy its output over this folder;
nothing in this repo needs to change unless SkillsMap.sg's JSON *shape*
changes (sector/role/skill field names), in which case `js/skillsmap-data.js`
would need the same kind of update.

## Before you publish: things to customise

Everything content-specific lives in **`js/data.js`** — you shouldn't need
to touch the HTML files for day-to-day updates:

- `SITE.orgName` — your social enterprise's real name
- `SITE.contactEmail` — the inbox that should receive match requests
- `SITE.matchFormEndpoint` — leave blank to use the built-in `mailto:` fallback
  on the Stage 5 form, or set it to a [Formspree](https://formspree.io) or
  [Netlify Forms](https://www.netlify.com/platform/core/forms/) endpoint to
  collect submissions properly instead of relying on the hirer's email client
- `GRANTS` — grant names, funding figures, and checklist items. **Verify these
  against the official pages before publishing** — scheme terms are updated
  periodically:
  - [Career Conversion Programmes](https://www.ourworkforce.gov.sg/programmes-directory/programme/career-conversion-programmes)
  - [Workforce Development Grant (Job Redesign+)](https://www.ourworkforce.gov.sg/programmes-directory/programme/workforce-development-grant-job-redesign-plus)
  - [Mid-Career Pathways Programme](https://www.ourworkforce.gov.sg/programmes-directory/programme/mid-career-pathways-programme)
- `QUIZ_QUESTIONS` — the Stage 1 awareness quiz questions/scoring

## Publishing on GitHub Pages

1. Create a new repository on GitHub (e.g. `workredesign-sg`) and push this
   folder's contents to its `main` branch:

   ```bash
   cd workredesign-sg
   git init
   git add .
   git commit -m "Initial WorkRedesign.sg portal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose `main` and folder `/ (root)`, then **Save**.
5. GitHub will publish the site at `https://<your-username>.github.io/<your-repo>/`
   within a minute or two — refresh the Pages settings page for the link.

No GitHub Actions workflow, Jekyll config, or build step is required — this
is a plain static site and GitHub Pages serves it as-is.

### Using a custom domain (optional)

If you want this at your own domain (e.g. `workredesign.sg`):
1. Add a `CNAME` file to the repo root containing just your domain name.
2. In your DNS provider, point the domain at GitHub Pages per
   [GitHub's custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
3. Re-enable HTTPS in **Settings → Pages** once DNS has propagated.

## What's intentionally NOT included (per the MVP scope)

- **No login/accounts** — the tool is fully usable without signing up.
- **No payment processing** — nothing on this site charges anyone.
- **No live talent directory / fuzzy search** — Stage 5 is a request form
  routed to your team for manual matching, matching the "Stage A: don't build
  search yet" recommendation for early-stage pool sizes. See the phased
  scaling plan (Postgres + `pg_trgm` fuzzy search, then `pgvector` semantic
  matching) for when to add this as the PMET pool and match-request volume grow.
- **No CorpPass or government API integration** — none is publicly offered
  for this use case; the grants pages link out to the official application
  channels rather than trying to replicate them.

## Data privacy note

This MVP collects no PMET personal data at all — Stage 5 only captures
hirer-side contact details, sent by the hirer's own email client (or your
chosen form endpoint) directly to your team. If you extend this into a
self-serve talent directory later, build in explicit PMET consent tracking
and a gated-reveal flow before publishing any PMET-identifying information,
per Singapore's Personal Data Protection Act (PDPA).

## Local preview before publishing

Because the site uses `fetch`-free, inline JS data (no JSON fetching), you
can preview it by simply opening `index.html` in a browser — no local server
required. If you later add features that do require a server (e.g. testing
a form endpoint), any simple static server works:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```
