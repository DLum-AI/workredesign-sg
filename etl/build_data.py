#!/usr/bin/env python3
"""
ETL: SkillsFuture Skills Framework dataset -> lightweight JSON for
SkillsMap.sg (a static, client-side, no-backend web portal).

Sources (as uploaded, v2 — Sep 2026 refresh):
  - jobsandskills-skillsfuture-skills-framework-dataset.xlsx
      Job Role_Description, Job Role_CWF_KT, Job Role_TSC_CCS,
      TSC_CCS_Key
  - jobsandskills-skillsfuture-tsc-to-unique-skills-mapping.xlsx
      sheet "data" — uses the "_updated" columns (updated skill title/
      type/SFS(emerging)/CASL status), not the "_previous" ones, since
      those reflect the current, current taxonomy after SSG's skills
      revision.
  - jobsandskills-skillsfuture-unique-skills-list.xlsx
      Unique Skills List

Output (all under outputs/skillsmap-sg/data/):
  - sectors.json            index of sectors -> role counts, slug
  - roles/<sector-slug>.json  full role detail for that sector
  - unique_skills.json      the 2,183 unique-skill taxonomy entries
  - skill_index.json        unique_skill -> [{sector, job_role, proficiency}]
                            (reverse lookup: "who needs this skill")
"""
import json
import re
import openpyxl
from pathlib import Path
from collections import defaultdict

SRC = "/root/.claude/uploads/9317e3ec-a89d-538f-9a7b-1f92ff21c6c7"
FRAMEWORK = f"{SRC}/c7973b80-jobsandskills-skillsfuture-skills-framework-dataset.xlsx"
TSC_MAP = f"{SRC}/682a7a26-jobsandskills-skillsfuture-tsc-to-unique-skills-mapping.xlsx"
UNIQUE_SKILLS = f"{SRC}/c3e1a824-jobsandskills-skillsfuture-unique-skills-list.xlsx"

OUT = Path("/home/claude/outputs/skillsmap-sg/data")
OUT_ROLES = OUT / "roles"
OUT_ROLES.mkdir(parents=True, exist_ok=True)


def slugify(s):
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def rows_of(path, sheet):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    it = ws.iter_rows(values_only=True)
    header = next(it)
    return header, list(it)


def to_bool(v):
    return str(v).strip().lower() == "true"


def proficiency_sort_key(p):
    order = {"basic": 0, "1": 1, "2": 2, "intermediate": 3, "3": 3, "4": 4,
             "advanced": 5, "5": 5, "6": 6}
    return order.get(str(p).strip().lower(), 99)


print("Loading TSC_CCS_Key (title/description/category per code)...")
_, key_rows = rows_of(FRAMEWORK, "TSC_CCS_Key")
tsc_key = {}
for code, sector, category, title, desc, typ, _updated in key_rows:
    if not code:
        continue
    tsc_key[code] = {
        "category": category, "title": title, "description": desc, "type": typ,
    }
print(f"  {len(tsc_key):,} TSC/CCS codes")

print("Loading TSC to Unique Skill Mapping...")
# Columns: skills_framework_skill_code, ...skill_title/desc/pl/pl_desc,
# Unique skill_previous_* (x5), Unique skill_updated_* (x6). We use the
# "_updated" fields throughout -- they reflect SSG's current taxonomy
# after their skills revision, not the superseded "_previous" ones.
_, tsc_map_rows = rows_of(TSC_MAP, "data")
tsc_to_skill = {}
for (code, _sf_title, _sf_desc, _sf_pl, _sf_pl_desc,
     _prev_title, _prev_desc, _prev_sfs, _prev_casl, _prev_type,
     updated_title, _updated_desc, updated_sfs, updated_casl, updated_type,
     _updated_sector) in tsc_map_rows:
    if not code:
        continue
    tsc_to_skill[code] = {
        "parent_skill_title": updated_title,
        "skill_type": updated_type,
        "emerging": to_bool(updated_sfs),
        "casl": to_bool(updated_casl),
    }
print(f"  {len(tsc_to_skill):,} code -> unique-skill rows")

print("Loading Unique Skills List...")
# Columns: skill_transaction_id, skill_id, skill_title, skill_description,
# skill_type, Emerging Skills, CASL Skills.
_, unique_rows = rows_of(UNIQUE_SKILLS, "Unique Skills List")
unique_skills = []
for _txn_id, _skill_id, title, desc, skill_type, emerging, casl in unique_rows:
    if not title:
        continue
    unique_skills.append({
        "title": title, "description": desc, "skill_type": skill_type,
        "emerging": to_bool(emerging), "casl": to_bool(casl),
    })
unique_skills.sort(key=lambda r: r["title"].lower())
with open(OUT / "unique_skills.json", "w") as f:
    json.dump(unique_skills, f, separators=(",", ":"))
print(f"  wrote {len(unique_skills):,} unique skills")

print("Loading Job Role_Description...")
_, desc_rows = rows_of(FRAMEWORK, "Job Role_Description")
roles = {}  # (sector, track, job_role) -> role dict
role_order = []
for sector, track, job_role, description, perf in desc_rows:
    if not sector or not job_role:
        continue
    key = (sector, track, job_role)
    if key not in roles:
        roles[key] = {
            "sector": sector, "track": track, "job_role": job_role,
            "description": description, "performance_expectation": perf,
            "cwf": [], "skills": [],
        }
        role_order.append(key)
print(f"  {len(roles):,} job roles")

print("Loading Job Role_CWF_KT (critical work functions / key tasks)...")
_, cwf_rows = rows_of(FRAMEWORK, "Job Role_CWF_KT")
cwf_by_role = defaultdict(lambda: defaultdict(list))
for sector, track, job_role, cwf, key_task in cwf_rows:
    key = (sector, track, job_role)
    if key not in roles or not cwf:
        continue
    cwf_by_role[key][cwf].append(key_task)
for key, cwf_map in cwf_by_role.items():
    roles[key]["cwf"] = [
        {"critical_work_function": cwf, "key_tasks": [t for t in tasks if t]}
        for cwf, tasks in cwf_map.items()
    ]
print(f"  attached CWF/KT to {len(cwf_by_role):,} roles")

print("Loading Job Role_TSC_CCS (required TSC/CCS per role)...")
_, tcs_rows = rows_of(FRAMEWORK, "Job Role_TSC_CCS")
skipped_no_key = 0
for sector, track, job_role, skill_sector_title, typ, prof, code in tcs_rows:
    key = (sector, track, job_role)
    if key not in roles or not code:
        continue
    k = tsc_key.get(code)
    m = tsc_to_skill.get(code)
    if not k:
        skipped_no_key += 1
        continue
    roles[key]["skills"].append({
        "code": code,
        "type": typ,
        "proficiency": prof,
        "category": k["category"],
        "title": k["title"],
        "description": k["description"],
        "unique_skill": (m or {}).get("parent_skill_title"),
        "skill_type": (m or {}).get("skill_type"),
        "emerging": (m or {}).get("emerging", False),
        "casl": (m or {}).get("casl", False),
    })
print(f"  attached skills (skipped {skipped_no_key:,} rows with no TSC_CCS_Key match)")

# Sort each role's skills for a stable, readable order: CCS first (core/critical
# core skills apply org-wide), then TSC grouped by category, then by proficiency.
for key in roles:
    roles[key]["skills"].sort(
        key=lambda s: (0 if s["type"] == "ccs" else 1, s["category"] or "", proficiency_sort_key(s["proficiency"]))
    )
    for c in roles[key]["cwf"]:
        c["key_tasks"] = [t for t in c["key_tasks"] if t]

print("Writing per-sector role files + sector index...")
by_sector = defaultdict(list)
for key in role_order:
    by_sector[roles[key]["sector"]].append(roles[key])

sector_index = []
for sector, role_list in sorted(by_sector.items()):
    role_list.sort(key=lambda r: (r["track"] or "", r["job_role"]))
    slug = slugify(sector)
    tracks = sorted(set(r["track"] for r in role_list if r["track"]))
    with open(OUT_ROLES / f"{slug}.json", "w") as f:
        json.dump(role_list, f, separators=(",", ":"))
    sector_index.append({
        "sector": sector, "slug": slug, "role_count": len(role_list), "tracks": tracks,
    })

with open(OUT / "sectors.json", "w") as f:
    json.dump(sector_index, f, separators=(",", ":"), ensure_ascii=False)
print(f"  wrote {len(sector_index)} sector files")

print("Building reverse skill index (unique skill -> roles that need it)...")
skill_index = defaultdict(list)
for key in role_order:
    r = roles[key]
    seen_for_role = set()
    for s in r["skills"]:
        usk = s["unique_skill"]
        if not usk:
            continue
        dedupe = (usk, r["sector"], r["job_role"])
        if dedupe in seen_for_role:
            # keep the highest proficiency already recorded; skip duplicate add
            continue
        seen_for_role.add(dedupe)
        skill_index[usk].append({
            "sector": r["sector"], "job_role": r["job_role"], "track": r["track"],
            "proficiency": s["proficiency"], "code": s["code"],
        })

with open(OUT / "skill_index.json", "w") as f:
    json.dump(skill_index, f, separators=(",", ":"), ensure_ascii=False)
print(f"  wrote reverse index for {len(skill_index):,} unique skills")

print("Done.")
