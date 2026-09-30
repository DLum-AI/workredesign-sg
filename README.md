# SkillsMap.sg

A free, static, self-service tool for Singapore businesses to redesign a
job role and validate the skills it needs, built directly on the national
**Skills Framework** dataset (SkillsFuture Singapore / Workforce Singapore):
39 sectors, ~2,000 job roles, 12,000+ Technical Skills & Competencies (TSC)
and Critical Core Skills (CCS), mapped to a 2,182-skill taxonomy.

No backend, no accounts, no database. Pure HTML/CSS/vanilla JS, reading
static JSON data files and keeping everything you enter in the browser's
`localStorage` on your own device.

## What it does

1. **Pick a role** &mdash; search any job role in the framework and see its
   official description, critical work functions, key tasks, and required
   skills with proficiency levels.
2. **Shape the redesign** &mdash; flag tasks being automated or redistributed,
   and optionally blend in a second "target" role to model a broader or
   more senior redesign.
3. **Choose the required skills** &mdash; keep, drop, or add skills from
   either role to land on the redesigned role's actual skill set.
4. **Validate your team** &mdash; self-assess your team's current level
   against each required skill.
5. **Get a report** &mdash; a readiness score, a prioritised skills-gap list,
   and a printable/CSV-exportable summary.

A separate **Skills Library** page lets you search any of the 2,182 unique
skills and see every role/sector that needs it &mdash; useful for spotting
internal redeployment options.

## Folder structure

```
skillsmap-sg/
├── index.html              Landing page
├── redesign.html            The 5-step redesign & validation wizard
├── skills-library.html      Reverse skill lookup
├── about.html               Data sources, methodology, limits
├── css/styles.css
├── js/
│   ├── layout.js             Shared header/footer
│   ├── data-loader.js        Fetches + caches the JSON data files
│   ├── redesign.js           Wizard logic (state kept in localStorage)
│   └── skills-library.js     Reverse lookup logic
└── data/
    ├── sectors.json          39 sectors, role counts, tracks
    ├── roles/<sector>.json    Full role detail per sector (loaded on demand)
    ├── unique_skills.json     The 2,182-entry skills taxonomy
    └── skill_index.json       Reverse index: skill -> roles that need it
```

## Publishing on GitHub Pages

Same as any static site:

```bash
cd skillsmap-sg
git init
git add .
git commit -m "Initial SkillsMap.sg portal"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: Deploy
from a branch → Branch: main, folder / (root) → Save**. The site will be
live at `https://<your-username>.github.io/<your-repo>/` within a minute
or two.

## Local preview

The data files are fetched with `fetch()`, which most browsers block for
local `file://` pages — so unlike a fully inline site, this one needs a
local server to preview before publishing:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Data provenance & attribution

Built from three datasets published by SkillsFuture Singapore / Workforce
Singapore as part of the national Skills Framework:
- Skills Framework dataset (job roles, tasks, required TSC/CCS)
- TSC-to-unique-skills mapping
- Unique Skills List

See `about.html` for full attribution, the skills-based-hiring research
this tool's flow is based on, and what the tool deliberately does not do
(it doesn't verify actual proficiency, and isn't an official SkillsFuture
or WSG product — always check the
[official Skills Framework portal](https://www.myskillsfuture.gov.sg/content/portal/en/career-resources/career-resources/browse-industry-sector.html)
for the authoritative, current version of any role).

## Updating the underlying data

If SSG/WSG publish an updated Skills Framework dataset, re-run the ETL
that generated `data/` — it's included at `etl/build_data.py`:

```bash
pip install openpyxl
# edit the 3 source file paths at the top of the script, then:
python3 etl/build_data.py
```

It re-reads the three source `.xlsx` files, joins them by TSC/CCS code,
and overwrites everything under `data/`.
