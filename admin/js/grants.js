/* ===========================================================
   WorkRedesign.sg Admin — grants.js
   =========================================================== */

(async function () {
  const profile = await requireStaff(["content_editor"]);
  if (!profile) return;

  document.getElementById("newGrantBtn").addEventListener("click", () => openGrantModal(null));
  await loadGrants();
})();

async function loadGrants() {
  const { data, error } = await supabase.from("grants").select("*").order("sort_order");
  const el = document.getElementById("grantsList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) {
    el.innerHTML = `<div class="card empty-state">No grants yet. Add one to populate the public grants page.</div>`;
    return;
  }

  el.innerHTML = data
    .map(
      (g) => `
    <div class="card">
      <div class="flex-between">
        <h2 class="mb-0">${escapeHtml(g.name)} ${g.is_published ? "" : '<span class="status-chip status-paused">Unpublished</span>'}</h2>
        <div class="actions">
          <button class="btn btn-small btn-outline" data-edit="${g.id}">Edit</button>
          <button class="btn btn-small btn-danger" data-delete="${g.id}">Delete</button>
        </div>
      </div>
      <p class="muted">${escapeHtml(g.short_desc || "")}</p>
      <p><strong>Checklist items:</strong> ${(g.checklist_items || []).length}</p>
    </div>`
    )
    .join("");

  el.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openGrantModal(data.find((g) => g.id === b.dataset.edit)))
  );
  el.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => deleteGrant(b.dataset.delete))
  );
}

function openGrantModal(grant) {
  const isNew = !grant;
  const checklistText = grant ? (grant.checklist_items || []).join("\n") : "";
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box" style="max-width:720px;">
      <button class="close-btn">&times;</button>
      <h2>${isNew ? "New grant" : "Edit grant"}</h2>
      <form id="grantForm">
        <div class="grid cols-2">
          <div class="field"><label>Grant key (unique, e.g. wdgjr)</label>
            <input type="text" id="g_key" value="${grant ? escapeHtml(grant.grant_key) : ""}" ${isNew ? "" : "readonly"} required /></div>
          <div class="field"><label>Name</label><input type="text" id="g_name" value="${grant ? escapeHtml(grant.name) : ""}" required /></div>
        </div>
        <div class="field"><label>Short description</label><input type="text" id="g_short" value="${grant ? escapeHtml(grant.short_desc || "") : ""}" /></div>
        <div class="field"><label>Official URL</label><input type="text" id="g_url" value="${grant ? escapeHtml(grant.url || "") : ""}" /></div>
        <div class="field"><label>Funding summary</label><input type="text" id="g_funding" value="${grant ? escapeHtml(grant.funding_summary || "") : ""}" /></div>
        <div class="field"><label>Best for</label><input type="text" id="g_bestfor" value="${grant ? escapeHtml(grant.best_for || "") : ""}" /></div>
        <div class="field">
          <label>Checklist items (one per line)</label>
          <textarea id="g_checklist" rows="6" class="mono">${escapeHtml(checklistText)}</textarea>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Sort order</label><input type="number" id="g_order" value="${grant ? grant.sort_order : 0}" /></div>
          <div class="field">
            <label>&nbsp;</label>
            <div class="checkbox-row" style="border:none; padding:0;">
              <input type="checkbox" id="g_published" ${!grant || grant.is_published ? "checked" : ""} />
              <label for="g_published" style="font-weight:400;">Published (visible on public site)</label>
            </div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Save</button>
      </form>
    </div>
  `;
  document.getElementById("modalRoot").appendChild(modal);
  modal.querySelector(".close-btn").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector("#grantForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const checklist_items = document
      .getElementById("g_checklist").value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      grant_key: document.getElementById("g_key").value.trim(),
      name: document.getElementById("g_name").value.trim(),
      short_desc: document.getElementById("g_short").value.trim(),
      url: document.getElementById("g_url").value.trim(),
      funding_summary: document.getElementById("g_funding").value.trim(),
      best_for: document.getElementById("g_bestfor").value.trim(),
      checklist_items,
      sort_order: parseInt(document.getElementById("g_order").value, 10) || 0,
      is_published: document.getElementById("g_published").checked,
      updated_by: currentProfile.id,
    };

    const { error } = isNew
      ? await supabase.from("grants").insert(payload)
      : await supabase.from("grants").update(payload).eq("id", grant.id);

    if (error) { alert("Save failed: " + error.message); return; }
    await logAudit(isNew ? "create" : "update", "grants", grant ? grant.id : payload.grant_key, payload);
    modal.remove();
    loadGrants();
  });
}

async function deleteGrant(id) {
  if (!confirm("Delete this grant? This can't be undone.")) return;
  const { error } = await supabase.from("grants").delete().eq("id", id);
  if (error) { alert("Delete failed: " + error.message); return; }
  await logAudit("delete", "grants", id, null);
  loadGrants();
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
