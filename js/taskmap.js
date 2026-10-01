/* ===========================================================
   WorkRedesign.sg — Stage 2/3 task deconstruction + classification
   =========================================================== */

let tasks = [];
let linkedRole = null; // the official Skills Framework role, if linked

function initTaskMap() {
  const saved = localStorage.getItem("wr_task_map");
  const savedRole = localStorage.getItem("wr_role_name");
  if (saved) {
    tasks = JSON.parse(saved);
  } else {
    // seed with 2 blank rows so the form isn't empty on first visit
    tasks = [emptyTask(), emptyTask()];
  }
  if (savedRole) document.getElementById("roleName").value = savedRole;

  renderTaskRows();
  initRoleLinkForTaskMap();

  document.getElementById("addTaskBtn").addEventListener("click", () => {
    tasks.push(emptyTask());
    renderTaskRows();
  });

  document.getElementById("analyzeBtn").addEventListener("click", analyzeRole);
  document.getElementById("roleName").addEventListener("input", (e) => {
    localStorage.setItem("wr_role_name", e.target.value);
  });
}

// Wires the "search the official Skills Framework" box on this page,
// shows the linked-role card (required skills / work functions / key
// tasks counts) when one is linked, and powers the "add official tasks"
// prefill button. Shares the same localStorage key as the evaluation
// page (index.html), so a role linked there shows up here too.
function initRoleLinkForTaskMap() {
  const input = document.getElementById("roleSearchInput");
  const results = document.getElementById("roleSearchResults");
  const display = document.getElementById("linkedRoleDisplay");
  const searchWrap = document.getElementById("roleSearchWrap");
  const prefillBtn = document.getElementById("prefillTasksBtn");
  if (!input || !results || !display) return;

  const existing = getLinkedRole();
  if (existing) showLinked(existing);

  attachRoleSearch(input, results, (role) => {
    saveLinkedRole(role);
    if (!document.getElementById("roleName").value.trim()) {
      document.getElementById("roleName").value = role.job_role;
      localStorage.setItem("wr_role_name", role.job_role);
    }
    showLinked(role);
  });

  prefillBtn.addEventListener("click", () => {
    if (!linkedRole) return;
    addOfficialTasks(linkedRole);
  });

  function showLinked(role) {
    linkedRole = role;
    searchWrap.classList.add("hidden");
    display.innerHTML = renderLinkedRoleCard(role);
    prefillBtn.classList.remove("hidden");
    document.getElementById("unlinkRoleBtn").addEventListener("click", () => {
      clearLinkedRole();
      linkedRole = null;
      display.innerHTML = "";
      searchWrap.classList.remove("hidden");
      input.value = "";
      prefillBtn.classList.add("hidden");
    });
  }
}

// Adds the linked role's official key tasks as new rows (append-only —
// never overwrites what the hirer has already typed). The two placeholder
// blank rows seeded on first visit are cleared out first since they're
// not real user content, not a destructive edit.
function addOfficialTasks(role) {
  const existingNames = new Set(tasks.map((t) => t.name.trim().toLowerCase()).filter(Boolean));
  const stillBlankSeed = tasks.length > 0 && tasks.every((t) => !t.name.trim() && !t.hours);
  if (stillBlankSeed) tasks = [];

  const officialTaskNames = [];
  role.cwf.forEach((c) => c.key_tasks.forEach((kt) => officialTaskNames.push(kt)));

  let added = 0;
  officialTaskNames.forEach((name) => {
    const key = name.trim().toLowerCase();
    if (!key || existingNames.has(key)) return;
    existingNames.add(key);
    // Default to "needs judgement" rather than "rules-based" — these are
    // the Skills Framework's own described duties for the role, not rote
    // admin, so defaulting them to auto-eliminate would be a bad nudge.
    // The hirer should still review and re-tag each one for how their
    // team actually performs it.
    tasks.push({ name, hours: "", nature: "judgement", value: "medium" });
    added += 1;
  });

  if (tasks.length === 0) tasks = [emptyTask(), emptyTask()];
  renderTaskRows();
  persistTasks();

  if (added === 0) {
    alert("All of this role's official tasks are already in your list.");
  }
}

function emptyTask() {
  return { name: "", hours: "", nature: "rules", value: "medium" };
}

function renderTaskRows() {
  const el = document.getElementById("taskRows");
  el.innerHTML = tasks
    .map(
      (t, i) => `
    <div class="field-row" data-index="${i}">
      <div class="field mb-0">
        <label>Task</label>
        <input type="text" class="task-name" value="${escapeHtml(t.name)}" placeholder="e.g. Data entry into spreadsheet" />
      </div>
      <div class="field mb-0">
        <label>Hrs / week</label>
        <input type="number" class="task-hours" min="0" step="0.5" value="${t.hours}" placeholder="5" />
      </div>
      <div class="field mb-0">
        <label>Nature</label>
        <select class="task-nature">
          <option value="rules" ${t.nature === "rules" ? "selected" : ""}>Rules-based / repetitive</option>
          <option value="judgement" ${t.nature === "judgement" ? "selected" : ""}>Needs judgement</option>
          <option value="relationship" ${t.nature === "relationship" ? "selected" : ""}>Relationship / leadership</option>
        </select>
      </div>
      <button type="button" class="btn btn-outline remove-task" title="Remove task">✕</button>
    </div>
  `
    )
    .join("");

  el.querySelectorAll(".field-row").forEach((row) => {
    const i = parseInt(row.dataset.index, 10);
    row.querySelector(".task-name").addEventListener("input", (e) => {
      tasks[i].name = e.target.value;
      persistTasks();
    });
    row.querySelector(".task-hours").addEventListener("input", (e) => {
      tasks[i].hours = e.target.value;
      persistTasks();
    });
    row.querySelector(".task-nature").addEventListener("change", (e) => {
      tasks[i].nature = e.target.value;
      persistTasks();
    });
    row.querySelector(".remove-task").addEventListener("click", () => {
      tasks.splice(i, 1);
      renderTaskRows();
      persistTasks();
    });
  });
}

function persistTasks() {
  localStorage.setItem("wr_task_map", JSON.stringify(tasks));
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function analyzeRole() {
  const validTasks = tasks.filter((t) => t.name.trim() !== "" && t.hours !== "");
  if (validTasks.length === 0) {
    alert("Add at least one task with a name and hours/week before analyzing.");
    return;
  }

  // Value defaults to "medium" for every task in this lightweight MVP tool —
  // teams wanting finer control can extend the task-nature dropdown with a value field.
  const classified = validTasks.map((t) => ({
    ...t,
    hours: parseFloat(t.hours) || 0,
    bucket: classifyTask({ nature: t.nature, value: t.value || "medium" }),
  }));

  const totalHours = classified.reduce((s, t) => s + t.hours, 0);
  const byBucket = { eliminate: 0, automate: 0, augment: 0, elevate: 0 };
  classified.forEach((t) => (byBucket[t.bucket] += t.hours));

  const remainingHours = byBucket.augment + byBucket.elevate;
  const recommendation = recommendArrangement(Math.round(remainingHours * 10) / 10);

  renderResults(classified, totalHours, byBucket, remainingHours, recommendation);

  localStorage.setItem(
    "wr_task_map_result",
    JSON.stringify({
      role: document.getElementById("roleName").value || "This role",
      totalHours,
      byBucket,
      remainingHours,
      recommendation,
      tasks: classified,
    })
  );

  document.getElementById("resultsSection").classList.remove("hidden");
  document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
}

function renderResults(classified, totalHours, byBucket, remainingHours, recommendation) {
  const roleName = document.getElementById("roleName").value || "This role";

  const rows = classified
    .map((t) => {
      const info = BUCKET_INFO[t.bucket];
      return `
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td>${t.hours} hrs/wk</td>
        <td><span class="badge ${info.badgeClass}">${info.label}</span></td>
      </tr>`;
    })
    .join("");

  document.getElementById("resultsBody").innerHTML = `
    <div class="grid cols-3">
      <div class="stat-tile">
        <div class="num">${totalHours}</div>
        <div class="label">Total hrs/week mapped</div>
      </div>
      <div class="stat-tile">
        <div class="num">${Math.round(byBucket.eliminate + byBucket.automate)}</div>
        <div class="label">Hrs/week removable</div>
      </div>
      <div class="stat-tile">
        <div class="num">${Math.round(remainingHours * 10) / 10}</div>
        <div class="label">Hrs/week left (judgement + relationship)</div>
      </div>
    </div>

    <h3 class="mt-24">Task breakdown</h3>
    <table class="task-table">
      <thead><tr><th>Task</th><th>Hours</th><th>Classification</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="verdict high mt-24">
      <span class="badge badge-elevate">Recommendation</span>
      <h2>${recommendation.type}</h2>
      <p class="mb-0">${roleName}: ${recommendation.detail}</p>
    </div>

    ${renderRequiredSkillsPanel()}

    <div class="flex-between mt-24">
      <a href="grants.html" class="btn btn-secondary">See which grants fund this &rarr;</a>
      <a href="match.html" class="btn btn-primary">Find matching talent &rarr;</a>
    </div>
  `;
}

// Shows the linked role's official required skills (from the Skills
// Framework) grouped by category, so a hirer can see concretely what
// skills the redesigned role still needs — the bridge into Stage 5
// talent matching, which now also draws on the same taxonomy.
function renderRequiredSkillsPanel() {
  if (!linkedRole) return "";
  const byCategory = {};
  linkedRole.skills.forEach((s) => {
    const cat = s.category || (s.type === "ccs" ? "Critical Core Skills" : "Other");
    (byCategory[cat] = byCategory[cat] || []).push(s);
  });

  const groups = Object.entries(byCategory)
    .map(
      ([cat, skills]) => `
      <div class="mt-16">
        <strong>${escapeHtml(cat)}</strong>
        <div class="pill-row">
          ${skills.map((s) => `<span class="pill" title="Required proficiency: ${escapeHtml(proficiencyLabel(s.proficiency))}">${escapeHtml(s.title)}</span>`).join("")}
        </div>
      </div>`
    )
    .join("");

  return `
    <div class="card mt-24" style="background:var(--teal-light); border-color:var(--teal);">
      <h3 class="mb-0">Required skills for ${escapeHtml(linkedRole.job_role)} <span class="muted" style="font-weight:400;">(official Skills Framework)</span></h3>
      <p class="muted">What the redesigned role still needs, according to the national Skills Framework —
      useful for the grant application's training plan, and for checking the talent library against real requirements.</p>
      ${groups}
    </div>`;
}
