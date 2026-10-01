/* ===========================================================
   WorkRedesign.sg — SkillsMap.sg data bridge.

   Reads the same static Skills Framework data that powers
   SkillsMap.sg (data/skillsmap/*.json — 39 sectors, ~2,030 job
   roles, 2,388-skill taxonomy) so hirers and PMETs on this site
   can ground their inputs in the official Skills Framework
   instead of free text.

   No backend involved — these are static JSON files fetched with
   fetch(), exactly like the rest of this site's "no build step"
   approach. Must be served over http(s), not opened as file://.
   =========================================================== */
const SkillsMapData = (() => {
  // Resolve data paths relative to THIS script (js/skillsmap-data.js) so it
  // works from any page depth (public pages and admin/ pages alike).
  const BASE = document.currentScript
    ? new URL("../data/skillsmap/", document.currentScript.src).href
    : "data/skillsmap/";
  let sectorsPromise = null;
  const sectorRolePromises = {}; // slug -> promise<role[]>
  let uniqueSkillsPromise = null;

  async function getSectors() {
    if (!sectorsPromise) sectorsPromise = fetch(BASE + "sectors.json").then((r) => r.json());
    return sectorsPromise;
  }

  async function getRolesForSector(slug) {
    if (!sectorRolePromises[slug]) {
      sectorRolePromises[slug] = fetch(`${BASE}roles/${slug}.json`).then((r) => r.json());
    }
    return sectorRolePromises[slug];
  }

  async function getUniqueSkills() {
    if (!uniqueSkillsPromise) uniqueSkillsPromise = fetch(BASE + "unique_skills.json").then((r) => r.json());
    return uniqueSkillsPromise;
  }

  // Fetch sectors in parallel batches rather than one at a time —
  // a strictly sequential scan can leave a query whose matches are
  // scattered across many sectors stuck waiting on dozens of
  // sequential network round trips.
  const SEARCH_BATCH_SIZE = 8;

  async function searchRoles(query, limit = 20) {
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

  return { getSectors, getRolesForSector, getUniqueSkills, searchRoles };
})();

function proficiencyLabel(p) {
  return p == null ? "—" : String(p);
}

// Shared by every widget built on SkillsMapData (role search, skill picker).
function escapeHtmlSF(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
