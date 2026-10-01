/* ===========================================================
   WorkRedesign.sg Admin — settings.js (feature flags + audit log)
   =========================================================== */

(async function () {
  const profile = await requireStaff(["super_admin"]);
  if (!profile) return;

  document.getElementById("newFlagBtn").addEventListener("click", () => openFlagModal(null));
  await loadFlags();
  await loadAudit();
})();

async function loadFlags() {
  const { data, error } = await supabase.from("feature_flags").select("*").order("flag_key");
  const tbody = document.getElementById("flagRows");
  if (error) { tbody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`; return; }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No feature flags yet. Add one for any new capability you want to roll out gradually — e.g. "directory_search_v2" or "pmet_self_editing".</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (f) => `
    <tr>
      <td><code>${escapeHtml(f.flag_key)}</code></td>
      <td>${escapeHtml(f.label)}</td>
      <td>${escapeHtml(f.description || "")}</td>
      <td>
        <label style="display:flex; align-items:center; gap:6px; font-weight:400;">
          <input type="checkbox" class="flag-toggle" data-id="${f.id}" ${f.is_enabled ? "checked" : ""} />
          ${f.is_enabled ? "On" : "Off"}
        </label>
      </td>
      <td class="actions">
        <button class="btn btn-small btn-danger" data-delete="${f.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll(".flag-toggle").forEach((cb) =>
    cb.addEventListener("change", async () => {
      const { error } = await supabase.from("feature_flags").update({ is_enabled: cb.checked, updated_by: currentProfile.id }).eq("id", cb.dataset.id);
      if (error) { alert("Failed: " + error.message); cb.checked = !cb.checked; return; }
      await logAudit("toggle_feature_flag", "feature_flags", cb.dataset.id, { is_enabled: cb.checked });
      loadFlags();
    })
  );
  tbody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this feature flag?")) return;
      const { error } = await supabase.from("feature_flags").delete().eq("id", btn.dataset.delete);
      if (error) { alert("Failed: " + error.message); return; }
      await logAudit("delete_feature_flag", "feature_flags", btn.dataset.delete, null);
      loadFlags();
    })
  );
}

function openFlagModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <button class="close-btn">&times;</button>
      <h2>New feature flag</h2>
      <form id="flagForm">
        <div class="field"><label>Flag key (e.g. directory_search_v2)</label><input type="text" id="f_key" required /></div>
        <div class="field"><label>Label</label><input type="text" id="f_label" required /></div>
        <div class="field"><label>Description</label><textarea id="f_desc" rows="2"></textarea></div>
        <div class="checkbox-row"><input type="checkbox" id="f_enabled" /><label for="f_enabled" style="font-weight:400;">Enabled immediately</label></div>
        <button type="submit" class="btn btn-primary btn-block mt-24">Create flag</button>
      </form>
    </div>
  `;
  document.getElementById("modalRoot").appendChild(modal);
  modal.querySelector(".close-btn").addEventListener("click", () => modal.remove());

  modal.querySelector("#flagForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      flag_key: document.getElementById("f_key").value.trim(),
      label: document.getElementById("f_label").value.trim(),
      description: document.getElementById("f_desc").value.trim(),
      is_enabled: document.getElementById("f_enabled").checked,
      updated_by: currentProfile.id,
    };
    const { error } = await supabase.from("feature_flags").insert(payload);
    if (error) { alert("Failed: " + error.message); return; }
    await logAudit("create_feature_flag", "feature_flags", payload.flag_key, payload);
    modal.remove();
    loadFlags();
  });
}

async function loadAudit() {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, target_table, target_id, created_at, actor:actor_id ( display_name, email )")
    .order("created_at", { ascending: false })
    .limit(50);
  const tbody = document.getElementById("auditRows");
  if (error) { tbody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No actions logged yet.</td></tr>`; return; }

  tbody.innerHTML = data
    .map((row) => {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      return `<tr>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>${escapeHtml((actor && (actor.display_name || actor.email)) || "—")}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.target_table)}${row.target_id ? " · " + escapeHtml(row.target_id) : ""}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
