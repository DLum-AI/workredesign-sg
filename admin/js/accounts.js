/* ===========================================================
   WorkRedesign.sg Admin — accounts.js
   (Hirer approval queue + staff account/role management)
   =========================================================== */

(async function () {
  // Page-level access: the approver role owns hirer approvals.
  // The staff-management tab is further gated to super_admin only,
  // client-side here for UX and server-side by the protect_role_fields
  // trigger (schema.sql) as the real enforcement.
  const profile = await requireStaff(["approver"]);
  if (!profile) return;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-hirers").classList.toggle("hidden", btn.dataset.tab !== "hirers");
      document.getElementById("tab-staff").classList.toggle("hidden", btn.dataset.tab !== "staff");
    });
  });

  await loadHirers();

  if (currentProfile.staff_role === "super_admin") {
    await loadStaff();
  } else {
    document.getElementById("staffList").innerHTML = `<div class="card empty-state">Only super admins can manage staff accounts and roles.</div>`;
  }
})();

// ---- Hirer accounts ----
async function loadHirers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, company_name, hirer_status, created_at")
    .eq("account_type", "hirer")
    .order("created_at", { ascending: false });

  const el = document.getElementById("hirersList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { el.innerHTML = `<div class="card empty-state">No hirer accounts yet.</div>`; return; }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Company</th><th>Email</th><th>Status</th><th>Signed up</th><th></th></tr></thead>
      <tbody>
        ${data
          .map(
            (row) => `
          <tr data-id="${row.id}">
            <td>${escapeHtml(row.company_name || "—")}</td>
            <td>${escapeHtml(row.email || "—")}</td>
            <td><span class="status-chip status-${row.hirer_status}">${(row.hirer_status || "").replace("_", " ")}</span></td>
            <td>${new Date(row.created_at).toLocaleDateString()}</td>
            <td class="actions">
              <button class="btn btn-small btn-outline" data-set="approved_summary">Summary access</button>
              <button class="btn btn-small btn-secondary" data-set="approved_full">Full access</button>
              <button class="btn btn-small btn-danger" data-set="rejected">Reject</button>
              <button class="btn btn-small btn-outline" data-set="suspended">Suspend</button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll("[data-set]").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const newStatus = btn.dataset.set;
      const { error } = await supabase.from("profiles").update({ hirer_status: newStatus }).eq("id", id);
      if (error) { alert("Failed: " + error.message); return; }
      await logAudit("set_hirer_status", "profiles", id, { hirer_status: newStatus });
      loadHirers();
    })
  );
}

// ---- Staff accounts (super_admin only) ----
async function loadStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, account_type, staff_role, created_at")
    .eq("account_type", "staff")
    .order("created_at");

  const el = document.getElementById("staffList");
  if (error) { el.innerHTML = `<p>Error: ${error.message}</p>`; return; }

  const rows = (data || [])
    .map(
      (row) => `
    <tr data-id="${row.id}">
      <td>${escapeHtml(row.display_name || "—")}</td>
      <td>${escapeHtml(row.email || "—")}</td>
      <td>
        <select class="role-select">
          ${["super_admin", "content_editor", "talent_manager", "approver"]
            .map((r) => `<option value="${r}" ${row.staff_role === r ? "selected" : ""}>${r}</option>`)
            .join("")}
        </select>
      </td>
      <td class="actions">
        <button class="btn btn-small btn-secondary save-role-btn">Save role</button>
        <button class="btn btn-small btn-danger remove-staff-btn">Remove staff access</button>
      </td>
    </tr>`
    )
    .join("");

  el.innerHTML = `
    <div class="card">
      <h2>Promote an existing account to staff</h2>
      <p class="muted">The person must have already signed up once at account.html (as a hirer or PMET) before you can promote them.</p>
      <div class="inline-form-row">
        <div class="field"><label>Their email</label><input type="email" id="promoteEmail" /></div>
        <div class="field"><label>Role</label>
          <select id="promoteRole">
            <option value="content_editor">content_editor</option>
            <option value="talent_manager">talent_manager</option>
            <option value="approver">approver</option>
            <option value="super_admin">super_admin</option>
          </select>
        </div>
        <button class="btn btn-primary" id="promoteBtn">Promote to staff</button>
      </div>
      <div id="promoteMsg" class="mt-24"></div>
    </div>

    <div class="card mt-24">
      <h2>Current staff</h2>
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="empty-state">No staff accounts yet besides you.</td></tr>`}</tbody>
      </table>
    </div>
  `;

  document.getElementById("promoteBtn").addEventListener("click", promoteToStaff);

  el.querySelectorAll(".save-role-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      const newRole = row.querySelector(".role-select").value;
      const { error } = await supabase.from("profiles").update({ staff_role: newRole }).eq("id", id);
      if (error) { alert("Failed: " + error.message); return; }
      await logAudit("set_staff_role", "profiles", id, { staff_role: newRole });
      loadStaff();
    })
  );

  el.querySelectorAll(".remove-staff-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      if (!confirm("Remove staff access for this account? They'll revert to a regular hirer account.")) return;
      const id = e.target.closest("tr").dataset.id;
      const { error } = await supabase
        .from("profiles")
        .update({ account_type: "hirer", staff_role: null, hirer_status: "pending" })
        .eq("id", id);
      if (error) { alert("Failed: " + error.message); return; }
      await logAudit("remove_staff_access", "profiles", id, null);
      loadStaff();
    })
  );
}

async function promoteToStaff() {
  const email = document.getElementById("promoteEmail").value.trim();
  const role = document.getElementById("promoteRole").value;
  const msg = document.getElementById("promoteMsg");
  msg.innerHTML = "";

  const { data: found, error: findError } = await supabase.from("profiles").select("id, account_type").eq("email", email).maybeSingle();
  if (findError || !found) {
    msg.innerHTML = `<div class="note-box">No existing account found for ${escapeHtml(email)} — ask them to sign up at account.html first.</div>`;
    return;
  }

  const { error } = await supabase.from("profiles").update({ account_type: "staff", staff_role: role }).eq("id", found.id);
  if (error) {
    msg.innerHTML = `<div class="note-box">Failed: ${escapeHtml(error.message)}</div>`;
    return;
  }
  await logAudit("promote_to_staff", "profiles", found.id, { staff_role: role });
  msg.innerHTML = `<div class="verdict high"><p class="mb-0">Done — ${escapeHtml(email)} is now staff (${role}).</p></div>`;
  loadStaff();
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
