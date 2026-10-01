/* ===========================================================
   WorkRedesign.sg — Stage 4 grant checklists
   =========================================================== */

function initGrants() {
  showTaskMapBanner();
  renderGrantCards();
  loadChecklistState();
}

function showTaskMapBanner() {
  const raw = localStorage.getItem("wr_task_map_result");
  if (!raw) return;
  const result = JSON.parse(raw);
  const banner = document.getElementById("taskMapBanner");
  const text = document.getElementById("taskMapBannerText");
  text.innerHTML = `Based on your task map for <strong>${result.role}</strong>, you're looking at a
    <strong>${result.recommendation.type}</strong> arrangement — start with
    <strong>WDG(JR+)</strong> if you want funded help redesigning it, or
    <strong>Career Conversion Programmes</strong> if you're ready to hire into it now.`;
  banner.classList.remove("hidden");
}

function renderGrantCards() {
  const container = document.getElementById("grantsContainer");
  container.innerHTML = GRANTS.map((grant, gi) => `
    <div class="card">
      <h2>${grant.name}</h2>
      <p>${grant.short}</p>
      <div class="pill-row">
        <span class="pill">${grant.fundingSummary}</span>
      </div>
      <p class="muted"><strong>Best for:</strong> ${grant.bestFor}</p>
      <p><a href="${grant.url}" target="_blank" rel="noopener">View official programme page &rarr;</a></p>

      <h3 class="mt-24">Are you application-ready?</h3>
      <div id="checklist-${grant.id}">
        ${grant.checklist
          .map(
            (item, ii) => `
          <div class="checkbox-row">
            <input type="checkbox" id="${grant.id}-${ii}" data-grant="${grant.id}" data-index="${ii}" />
            <label for="${grant.id}-${ii}">${item}</label>
          </div>`
          )
          .join("")}
      </div>
      <div class="flex-between mt-24">
        <span class="muted" id="progress-${grant.id}">0 of ${grant.checklist.length} confirmed</span>
      </div>
    </div>
  `).join("");

  container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      saveChecklistState();
      updateProgress(cb.dataset.grant);
    });
  });

  GRANTS.forEach((g) => updateProgress(g.id));
}

function updateProgress(grantId) {
  const grant = GRANTS.find((g) => g.id === grantId);
  const checked = document.querySelectorAll(
    `input[data-grant="${grantId}"]:checked`
  ).length;
  const el = document.getElementById(`progress-${grantId}`);
  el.textContent = `${checked} of ${grant.checklist.length} confirmed`;
  el.style.color = checked === grant.checklist.length ? "var(--success)" : "";
  el.style.fontWeight = checked === grant.checklist.length ? "700" : "400";
}

function saveChecklistState() {
  const state = {};
  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    state[cb.id] = cb.checked;
  });
  localStorage.setItem("wr_grant_checklists", JSON.stringify(state));
}

function loadChecklistState() {
  const raw = localStorage.getItem("wr_grant_checklists");
  if (!raw) return;
  const state = JSON.parse(raw);
  Object.keys(state).forEach((id) => {
    const cb = document.getElementById(id);
    if (cb) cb.checked = state[id];
  });
  GRANTS.forEach((g) => updateProgress(g.id));
}
