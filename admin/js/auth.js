/* ===========================================================
   WorkRedesign.sg Admin — auth guard, shared across every
   admin/*.html page. Client-side gating is for UX only; the
   real security boundary is the RLS policies in schema.sql —
   this just avoids showing a staff member a screen they can't
   actually use, and redirects anyone who isn't staff at all.
   =========================================================== */

let currentProfile = null;

/**
 * Call at the top of every admin page. Redirects to login.html if
 * there's no session or the account isn't staff. Optionally pass an
 * array of allowed staff_roles to further restrict a specific page
 * (e.g. ['super_admin', 'content_editor'] for content.html).
 * Resolves with the profile row on success.
 */
async function requireStaff(allowedRoles) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, account_type, staff_role, display_name, email")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || profile.account_type !== "staff") {
    await supabase.auth.signOut();
    window.location.href = "login.html?error=not_staff";
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const allowed = profile.staff_role === "super_admin" || allowedRoles.includes(profile.staff_role);
    if (!allowed) {
      document.body.innerHTML = `
        <div style="max-width:520px;margin:80px auto;text-align:center;font-family:sans-serif;">
          <h1 style="color:#10263e;">Not authorized</h1>
          <p>Your role (<strong>${profile.staff_role}</strong>) doesn't have access to this page.</p>
          <a href="dashboard.html">&larr; Back to dashboard</a>
        </div>`;
      return null;
    }
  }

  currentProfile = profile;
  renderAdminBar(profile);
  return profile;
}

function renderAdminBar(profile) {
  const el = document.getElementById("admin-bar");
  if (!el) return;
  const nav = [
    { href: "dashboard.html", label: "Dashboard", roles: null },
    { href: "content.html", label: "Content & Menu", roles: ["content_editor"] },
    { href: "grants.html", label: "Grants", roles: ["content_editor"] },
    { href: "talent.html", label: "Talent Library", roles: ["talent_manager"] },
    { href: "accounts.html", label: "Accounts & Approvals", roles: ["approver", "talent_manager"] },
    { href: "settings.html", label: "Settings", roles: ["super_admin"] },
  ];
  const visible = nav.filter(
    (n) => !n.roles || profile.staff_role === "super_admin" || n.roles.includes(profile.staff_role)
  );
  const current = location.pathname.split("/").pop();

  el.innerHTML = `
    <div class="admin-topbar">
      <div class="admin-topbar-inner">
        <span class="admin-logo">WorkRedesign<span class="dot">.sg</span> <span class="admin-tag">admin</span></span>
        <nav class="admin-nav">
          ${visible.map((n) => `<a href="${n.href}" class="${n.href === current ? "active" : ""}">${n.label}</a>`).join("")}
        </nav>
        <div class="admin-user">
          <span>${profile.display_name || profile.email} <em>(${profile.staff_role})</em></span>
          <button id="logoutBtn" class="btn btn-outline btn-small">Log out</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

/** Writes one row to audit_log. Never blocks the calling action if it fails. */
async function logAudit(action, targetTable, targetId, details) {
  try {
    await supabase.from("audit_log").insert({
      actor_id: currentProfile ? currentProfile.id : null,
      action,
      target_table: targetTable,
      target_id: targetId ? String(targetId) : null,
      details: details || null,
    });
  } catch (e) {
    console.warn("audit log failed (non-blocking):", e);
  }
}
