/* ===========================================================
   WorkRedesign.sg — reusable "search the official Skills
   Framework for a job role" widget, backed by SkillsMapData.
   Used on the evaluation (index.html) and job-redesign
   (task-map.html) pages so both link to the same real role data.
   =========================================================== */

// Wires a text <input> to a results <div>, showing matching job
// roles from the Skills Framework as the person types, and calling
// onPick(role) when they choose one. Debounced + guards against
// stale out-of-order responses.
function attachRoleSearch(inputEl, resultsEl, onPick) {
  let debounceTimer = null;
  let requestSeq = 0;

  inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = inputEl.value;
    debounceTimer = setTimeout(() => runRoleSearch(query), 220);
  });

  inputEl.addEventListener("focus", () => {
    if (resultsEl.innerHTML.trim()) resultsEl.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!resultsEl.contains(e.target) && e.target !== inputEl) resultsEl.classList.add("hidden");
  });

  async function runRoleSearch(query) {
    const q = query.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = "";
      resultsEl.classList.add("hidden");
      return;
    }
    const mySeq = ++requestSeq;
    resultsEl.innerHTML = `<div class="sf-result-item muted">Searching…</div>`;
    resultsEl.classList.remove("hidden");

    let results;
    try {
      results = await SkillsMapData.searchRoles(q, 15);
    } catch (err) {
      if (mySeq !== requestSeq) return;
      resultsEl.innerHTML = `<div class="sf-result-item muted">Couldn't load Skills Framework data. If you opened this page directly as a file, run a local server instead.</div>`;
      return;
    }
    if (mySeq !== requestSeq) return; // a newer keystroke's search has already landed

    if (!results.length) {
      resultsEl.innerHTML = `<div class="sf-result-item muted">No official role matches "${escapeHtmlSF(q)}". You can still type a custom title above.</div>`;
      return;
    }
    resultsEl.innerHTML = results
      .map(
        (r, i) => `
      <div class="sf-result-item" data-idx="${i}">
        <div class="sf-result-title">${escapeHtmlSF(r.job_role)}</div>
        <div class="sf-result-sector">${escapeHtmlSF(r.sector)}${r.track ? " &middot; " + escapeHtmlSF(r.track) : ""} &middot; ${r.skills.length} required skills</div>
      </div>`
      )
      .join("");
    resultsEl.querySelectorAll(".sf-result-item[data-idx]").forEach((item) => {
      item.addEventListener("click", () => {
        const role = results[Number(item.dataset.idx)];
        resultsEl.classList.add("hidden");
        onPick(role);
      });
    });
  }
}

// Shared localStorage bridge so a role linked on the evaluation page
// (index.html) carries forward to the job-redesign page (task-map.html),
// and vice versa — either page can set or clear it.
const LINKED_ROLE_KEY = "wr_linked_role";

function getLinkedRole() {
  try {
    const raw = localStorage.getItem(LINKED_ROLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveLinkedRole(role) {
  localStorage.setItem(LINKED_ROLE_KEY, JSON.stringify(role));
}

function clearLinkedRole() {
  localStorage.removeItem(LINKED_ROLE_KEY);
}

// A compact read-out of a linked role, reused wherever we show
// "here's the official role you've linked" (evaluation + job-redesign pages).
function renderLinkedRoleCard(role) {
  return `
    <div class="linked-role-card">
      <div class="flex-between">
        <div>
          <span class="pill">Linked to Skills Framework</span>
          <h3 class="mt-8 mb-0">${escapeHtmlSF(role.job_role)}</h3>
          <p class="muted mb-0">${escapeHtmlSF(role.sector)}${role.track ? " &middot; " + escapeHtmlSF(role.track) : ""}</p>
        </div>
        <button type="button" class="btn btn-outline btn-small" id="unlinkRoleBtn">Unlink</button>
      </div>
      <div class="grid cols-3 mt-16">
        <div class="stat-tile">
          <div class="num">${role.skills.length}</div>
          <div class="label">Required skills</div>
        </div>
        <div class="stat-tile">
          <div class="num">${role.cwf.length}</div>
          <div class="label">Work functions</div>
        </div>
        <div class="stat-tile">
          <div class="num">${role.cwf.reduce((n, c) => n + c.key_tasks.length, 0)}</div>
          <div class="label">Official key tasks</div>
        </div>
      </div>
    </div>`;
}
