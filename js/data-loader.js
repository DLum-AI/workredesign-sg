/* ===========================================================
   SkillsMap.sg — data loading helpers (all client-side, static
   JSON files generated from the SkillsFuture Skills Framework).
   =========================================================== */
const DataStore = (() => {
  let sectorsPromise = null;
  const sectorRolePromises = {}; // slug -> promise<role[]>
  let uniqueSkillsPromise = null;
  let skillIndexPromise = null;

  async function getSectors() {
    if (!sectorsPromise) sectorsPromise = fetch("data/sectors.json").then((r) => r.json());
    return sectorsPromise;
  }

  async function getRolesForSector(slug) {
    if (!sectorRolePromises[slug]) {
      sectorRolePromises[slug] = fetch(`data/roles/${slug}.json`).then((r) => r.json());
    }
    return sectorRolePromises[slug];
  }

  async function getUniqueSkills() {
    if (!uniqueSkillsPromise) uniqueSkillsPromise = fetch("data/unique_skills.json").then((r) => r.json());
    return uniqueSkillsPromise;
  }

  async function getSkillIndex() {
    if (!skillIndexPromise) skillIndexPromise = fetch("data/skill_index.json").then((r) => r.json());
    return skillIndexPromise;
  }

  // Search across ALL sectors by role name / description keyword.
  // Loads sector files lazily as needed and caches them, so a second
  // search over the same sectors is instant. Sector files are fetched
  // in parallel batches (rather than one network round-trip at a time)
  // so a query whose matches are scattered across many sectors doesn't
  // leave the search stuck waiting on 39 sequential requests.
  const SEARCH_BATCH_SIZE = 8;

  async function searchRoles(query, limit = 25) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const sectors = await getSectors();
    const results = [];
    for (let i = 0; i < sectors.length; i += SEARCH_BATCH_SIZE) {
      const batch = sectors.slice(i, i + SEARCH_BATCH_SIZE);
      const batchRoles = await Promise.all(batch.map((s) => getRolesForSector(s.slug)));
      batch.forEach((s, idx) => {
        for (const r of batchRoles[idx]) {
          if (
            r.job_role.toLowerCase().includes(q) ||
            (r.track || "").toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q)
          ) {
            results.push(r);
          }
        }
      });
      if (results.length >= limit) return results.slice(0, limit);
    }
    return results;
  }

  return { getSectors, getRolesForSector, getUniqueSkills, getSkillIndex, searchRoles };
})();

function proficiencyRank(p) {
  const order = { basic: 0, "1": 1, "2": 2, intermediate: 3, "3": 3, "4": 4, advanced: 5, "5": 5, "6": 6 };
  return order[String(p).trim().toLowerCase()] ?? -1;
}

function proficiencyLabel(p) {
  return p == null ? "—" : String(p);
}
