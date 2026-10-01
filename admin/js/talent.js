/* ===========================================================
   WorkRedesign.sg Admin — talent.js
   (Talent Library: review queue, published profiles, intro requests)
   =========================================================== */

const TALENT_SELECT = `
  id, status, is_published, card_code, consent_public_card, consent_private_detail,
  review_notes, created_at,
  pmet:pmet_user_id ( display_name, email ),
  talent_public_info ( headline, function_area, skills_tags, arrangement_types, years_experience_band, availability_hours_per_week ),
  talent_private_info ( bio_private, tools_software, indicative_rate_band, case_study_summary ),
  talent_contacts ( full_name, contact_email, contact_phone )
`;

// Lowercased titles of the official Skills Framework taxonomy, used to flag
// free-text skills a PMET typed that aren't in it (so reviewers can vet them).
let officialSkillSet = null;

function renderSkillList(skills) {
  if (!skills || !skills.length) return "—";
  return skills
    .map((s) => {
      const isOfficial = officialSkillSet && officialSkillSet.has(String(s).toLowerCase());
      return officialSkillSet && !isOfficial
        ? `${escapeHtml(s)} <span class="pill" style="background:#fff6e9;color:#a1651a;" title="Not in the official Skills Framework taxonomy — free text entered by the PMET">free text</span>`
        : escapeHtml(s);
    })
    .join(", ");
}

(async function () {
  const profile = await requireStaff(["talent_manager"]);
  if (!profile) return;

  try {
    const all = await SkillsMapData.getUniqueSkills();
    officialSkillSet = new Set(all.map((x) => x.title.toLowerCase()));
  } catch (err) {
    officialSkillSet = null; // taxonomy unavailable — show skills unflagged
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      ["pending", "published", "intros"].forEach((t) =>
        document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== btn.dataset.tab)
      );
    });
  });

  await loadPending();
  await loadPublished();
  await loadIntros();
})();

function tierRow(row) {
  // Supabase returns the 1:1 embedded relation as an object OR an array
  // depending on client version — normalize to a plain object here.
  const one = (x) => (Array.isArray(x) ? x[0] : x) || {};
  return {
    ...row,
    pub: one(row.talent_public_info),
    priv: one(row.talent_private_info),
    contact: one(row.talent_contacts),
    pmet: one(row.pmet),
  };
}

// ---- Pending review ----
async function loadPending() {
  const { data, error } = await supabase.from("talent_profiles").select(TALENT_SELECT).eq("status", "pending_review").order("created_at");
  const el = document.getElementById("pendingList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { el.innerHTML = `<div class="card empty-state">Nothing pending review.</div>`; return; }

  el.innerHTML = data.map((r) => renderReviewCard(tierRow(r))).join("");
  attachReviewHandlers(data.map(tierRow));
}

function renderReviewCard(r) {
  return `
    <div class="card" data-id="${r.id}">
      <div class="flex-between">
        <h2 class="mb-0">${escapeHtml(r.pub.headline || "(no headline)")} <span class="muted">— ${escapeHtml(r.card_code)}</span></h2>
        <span class="status-chip status-${r.status}">${r.status.replace("_", " ")}</span>
      </div>
      <p class="muted">Submitted by ${escapeHtml(r.pmet.display_name || r.pmet.email || "unknown")}</p>

      <div class="grid cols-2">
        <div>
          <h3>Public card</h3>
          <p><strong>Function:</strong> ${escapeHtml(r.pub.function_area || "—")}</p>
          <p><strong>Experience:</strong> ${escapeHtml(r.pub.years_experience_band || "—")}</p>
          <p><strong>Availability:</strong> ${r.pub.availability_hours_per_week || "—"} hrs/week</p>
          <p><strong>Skills:</strong> ${renderSkillList(r.pub.skills_tags)}</p>
          <p><strong>Arrangement:</strong> ${(r.pub.arrangement_types || []).map(escapeHtml).join(", ") || "—"}</p>
        </div>
        <div>
          <h3>Private detail</h3>
          <p>${escapeHtml(r.priv.bio_private || "—")}</p>
          <p><strong>Tools:</strong> ${(r.priv.tools_software || []).map(escapeHtml).join(", ") || "—"}</p>
          <p><strong>Rate band:</strong> ${escapeHtml(r.priv.indicative_rate_band || "—")}</p>
        </div>
      </div>

      <div class="note-box mt-24">
        <strong>Contact (staff-only view):</strong> ${escapeHtml(r.contact.full_name || "—")} ·
        ${escapeHtml(r.contact.contact_email || "—")} · ${escapeHtml(r.contact.contact_phone || "—")}
      </div>

      <div class="field mt-24">
        <label>Review notes (visible to your team only)</label>
        <textarea class="review-notes" rows="2">${escapeHtml(r.review_notes || "")}</textarea>
      </div>

      <div class="flex-between mt-24">
        <span class="muted">Consent on file: public card ${r.consent_public_card ? "✅" : "❌"}, private detail ${r.consent_private_detail ? "✅" : "❌"}</span>
        <div class="actions">
          <button class="btn btn-danger reject-btn">Reject</button>
          <button class="btn btn-secondary approve-btn">Approve &amp; publish</button>
        </div>
      </div>
    </div>
  `;
}

function attachReviewHandlers(rows) {
  rows.forEach((r) => {
    const card = document.querySelector(`[data-id="${r.id}"]`);
    if (!card) return;
    card.querySelector(".approve-btn").addEventListener("click", () => decideTalent(r.id, "approved", card));
    card.querySelector(".reject-btn").addEventListener("click", () => decideTalent(r.id, "rejected", card));
  });
}

async function decideTalent(id, status, card) {
  const notes = card.querySelector(".review-notes").value;
  const { error } = await supabase
    .from("talent_profiles")
    .update({
      status,
      is_published: status === "approved",
      review_notes: notes,
      reviewed_by: currentProfile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) { alert("Failed: " + error.message); return; }
  await logAudit(status === "approved" ? "approve_talent" : "reject_talent", "talent_profiles", id, { notes });
  loadPending();
  loadPublished();
}

// ---- Published profiles ----
async function loadPublished() {
  const { data, error } = await supabase.from("talent_profiles").select(TALENT_SELECT).eq("status", "approved").order("created_at", { ascending: false });
  const el = document.getElementById("publishedList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { el.innerHTML = `<div class="card empty-state">No approved profiles yet.</div>`; return; }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Card</th><th>Function</th><th>Published</th><th></th></tr></thead>
      <tbody>
        ${data
          .map((row) => {
            const r = tierRow(row);
            return `<tr>
              <td>${escapeHtml(r.pub.headline || r.card_code)}</td>
              <td>${escapeHtml(r.pub.function_area || "—")}</td>
              <td>${r.is_published ? '<span class="status-chip status-approved">Live</span>' : '<span class="status-chip status-paused">Paused</span>'}</td>
              <td class="actions">
                <button class="btn btn-small btn-outline" data-toggle="${r.id}" data-current="${r.is_published}">
                  ${r.is_published ? "Pause" : "Publish"}
                </button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const newVal = btn.dataset.current !== "true";
      const { error } = await supabase.from("talent_profiles").update({ is_published: newVal }).eq("id", btn.dataset.toggle);
      if (error) { alert("Failed: " + error.message); return; }
      await logAudit(newVal ? "publish_talent" : "pause_talent", "talent_profiles", btn.dataset.toggle, null);
      loadPublished();
    })
  );
}

// ---- Introduction requests ----
async function loadIntros() {
  const { data, error } = await supabase
    .from("intro_requests")
    .select(`
      id, status, message, created_at,
      hirer:hirer_id ( company_name, email ),
      talent:talent_profile_id ( card_code, talent_public_info ( headline ) )
    `)
    .order("created_at", { ascending: false });

  const el = document.getElementById("introsList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { el.innerHTML = `<div class="card empty-state">No introduction requests yet.</div>`; return; }

  el.innerHTML = data
    .map((row) => {
      const hirer = Array.isArray(row.hirer) ? row.hirer[0] : row.hirer;
      const talent = Array.isArray(row.talent) ? row.talent[0] : row.talent;
      const pub = talent && (Array.isArray(talent.talent_public_info) ? talent.talent_public_info[0] : talent.talent_public_info);
      return `
      <div class="card" data-id="${row.id}">
        <div class="flex-between">
          <h3 class="mb-0">${escapeHtml((hirer && hirer.company_name) || "Unknown hirer")} &rarr; ${escapeHtml((pub && pub.headline) || (talent && talent.card_code) || "profile")}</h3>
          <span class="status-chip status-${row.status}">${row.status}</span>
        </div>
        <p class="muted">${escapeHtml(row.message || "")}</p>
        ${row.status === "requested" ? `
          <div class="actions">
            <button class="btn btn-danger decline-btn">Decline</button>
            <button class="btn btn-secondary approve-btn">Approve introduction</button>
          </div>` : ""}
      </div>`;
    })
    .join("");

  el.querySelectorAll(".approve-btn").forEach((b) =>
    b.addEventListener("click", (e) => decideIntro(e.target.closest("[data-id]").dataset.id, "approved"))
  );
  el.querySelectorAll(".decline-btn").forEach((b) =>
    b.addEventListener("click", (e) => decideIntro(e.target.closest("[data-id]").dataset.id, "declined"))
  );
}

async function decideIntro(id, status) {
  const { error } = await supabase
    .from("intro_requests")
    .update({ status, decided_by: currentProfile.id, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { alert("Failed: " + error.message); return; }
  await logAudit(`intro_${status}`, "intro_requests", id, null);
  loadIntros();
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
