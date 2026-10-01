/* ===========================================================
   WorkRedesign.sg — directory.js (public talent browsing)
   =========================================================== */

let session = null;
let hirerStatus = null; // null if not a hirer / not logged in
let myIntros = {}; // talent_profile_id -> status, for the current hirer
let allCards = [];
let skillFilterPicker = null; // official-skill filter chips (Skills Framework taxonomy)

(async function () {
  renderHeader("directory");
  renderFooter();
  skillFilterPicker = createSkillPicker(document.getElementById("skillFilterMount"), {
    onChange: () => renderCards(),
  });

  const { data } = await supabase.auth.getSession();
  session = data.session;

  if (session) {
    const { data: profile } = await supabase.from("profiles").select("account_type, hirer_status").eq("id", session.user.id).single();
    if (profile && profile.account_type === "hirer") hirerStatus = profile.hirer_status;

    const { data: intros } = await supabase.from("intro_requests").select("talent_profile_id, status").eq("hirer_id", session.user.id);
    (intros || []).forEach((i) => (myIntros[i.talent_profile_id] = i.status));
  }

  renderAccessNote();
  await loadCards();

  document.getElementById("searchInput").addEventListener("input", renderCards);
  document.getElementById("functionFilter").addEventListener("change", renderCards);
  document.getElementById("arrangementFilter").addEventListener("change", renderCards);
})();

function renderAccessNote() {
  const el = document.getElementById("accessNote");
  if (!session) {
    el.innerHTML = `<a href="account.html">Sign in</a> to request introductions or unlock fuller profile detail.`;
  } else if (hirerStatus === "approved_full") {
    el.textContent = "Your account has full library access.";
  } else if (hirerStatus === "approved_summary") {
    el.innerHTML = `Your account can browse and request introductions. <a href="match.html">Ask our team</a> for full detail access.`;
  } else if (hirerStatus === "pending") {
    el.textContent = "Your account is awaiting approval — you can still browse public cards.";
  }
}

async function loadCards() {
  const { data, error } = await supabase
    .from("talent_public_info")
    .select("talent_profile_id, headline, function_area, skills_tags, arrangement_types, years_experience_band, availability_hours_per_week")
    .order("updated_at", { ascending: false });

  if (error) {
    document.getElementById("cardsGrid").innerHTML = `<p>Couldn't load the directory: ${error.message}</p>`;
    return;
  }

  allCards = data || [];

  const functions = [...new Set(allCards.map((c) => c.function_area).filter(Boolean))].sort();
  const functionSelect = document.getElementById("functionFilter");
  functions.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f; opt.textContent = f;
    functionSelect.appendChild(opt);
  });

  renderCards();
}

function renderCards() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const fn = document.getElementById("functionFilter").value;
  const arr = document.getElementById("arrangementFilter").value;

  const wantedSkills = skillFilterPicker ? skillFilterPicker.getValues().map((x) => x.toLowerCase()) : [];

  const filtered = allCards.filter((c) => {
    const matchesSkills =
      wantedSkills.length === 0 ||
      (c.skills_tags || []).some((t) => wantedSkills.includes(t.toLowerCase()));
    const matchesQuery =
      !q ||
      (c.headline || "").toLowerCase().includes(q) ||
      (c.skills_tags || []).some((t) => t.toLowerCase().includes(q));
    const matchesFn = !fn || c.function_area === fn;
    const matchesArr = !arr || (c.arrangement_types || []).includes(arr);
    return matchesQuery && matchesSkills && matchesFn && matchesArr;
  });

  document.getElementById("resultsCount").textContent = `${filtered.length} profile${filtered.length === 1 ? "" : "s"}`;
  document.getElementById("cardsGrid").innerHTML = filtered.map(renderCard).join("") || `<div class="card empty-state">No matches — try a different filter.</div>`;

  document.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => showDetail(btn.dataset.detail))
  );
  document.querySelectorAll("[data-intro]").forEach((btn) =>
    btn.addEventListener("click", () => requestIntro(btn.dataset.intro))
  );
}

function renderCard(c) {
  const introStatus = myIntros[c.talent_profile_id];
  let introBtn;
  if (!session) {
    introBtn = `<a href="account.html" class="btn btn-outline btn-small btn-block">Sign in to request intro</a>`;
  } else if (introStatus) {
    introBtn = `<span class="status-chip status-${introStatus}">Intro ${introStatus}</span>`;
  } else if (hirerStatus === "approved_summary" || hirerStatus === "approved_full") {
    introBtn = `<button class="btn btn-secondary btn-small btn-block" data-intro="${c.talent_profile_id}">Request introduction</button>`;
  } else {
    introBtn = `<span class="muted" style="font-size:0.82rem;">Awaiting account approval</span>`;
  }

  return `
    <div class="talent-card">
      <h3>${escapeHtml(c.headline || "Untitled profile")}</h3>
      <div class="pill-row">
        <span class="pill">${escapeHtml(c.function_area || "—")}</span>
        <span class="pill">${escapeHtml(c.years_experience_band || "—")}</span>
      </div>
      <p class="muted" style="font-size:0.88rem;">${(c.arrangement_types || []).map(escapeHtml).join(" · ")} · ${c.availability_hours_per_week || "?"} hrs/week</p>
      <p style="font-size:0.85rem;">${(c.skills_tags || []).slice(0, 5).map(escapeHtml).join(", ")}</p>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
        ${hirerStatus === "approved_full" ? `<button class="btn btn-outline btn-small btn-block" data-detail="${c.talent_profile_id}">See fuller detail</button>` : ""}
        ${introBtn}
      </div>
    </div>
  `;
}

async function showDetail(talentProfileId) {
  const { data, error } = await supabase
    .from("talent_private_info")
    .select("bio_private, tools_software, indicative_rate_band, case_study_summary")
    .eq("talent_profile_id", talentProfileId)
    .maybeSingle();

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  if (error || !data) {
    modal.innerHTML = `<div class="modal-box"><button class="close-btn">&times;</button>
      <p>This detail isn't available to your account yet.</p></div>`;
  } else {
    modal.innerHTML = `
      <div class="modal-box">
        <button class="close-btn">&times;</button>
        <h2>Fuller profile detail</h2>
        <p>${escapeHtml(data.bio_private || "")}</p>
        <p><strong>Tools:</strong> ${(data.tools_software || []).map(escapeHtml).join(", ") || "—"}</p>
        <p><strong>Indicative rate:</strong> ${escapeHtml(data.indicative_rate_band || "—")}</p>
        <p><strong>Case study:</strong> ${escapeHtml(data.case_study_summary || "—")}</p>
        <button class="btn btn-secondary btn-block" data-intro="${talentProfileId}">Request introduction</button>
      </div>
    `;
  }
  document.getElementById("modalRoot").appendChild(modal);
  modal.querySelector(".close-btn").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  const introBtn = modal.querySelector("[data-intro]");
  if (introBtn) introBtn.addEventListener("click", () => requestIntro(talentProfileId));
}

async function requestIntro(talentProfileId) {
  if (!session) { window.location.href = "account.html"; return; }
  const { error } = await supabase.from("intro_requests").insert({
    hirer_id: session.user.id,
    talent_profile_id: talentProfileId,
    status: "requested",
  });
  if (error) { alert("Couldn't send that request: " + error.message); return; }
  myIntros[talentProfileId] = "requested";
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
  renderCards();
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
