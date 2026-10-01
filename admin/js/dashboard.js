/* ===========================================================
   WorkRedesign.sg Admin — dashboard.js
   =========================================================== */

(async function () {
  const profile = await requireStaff(); // any staff role can view the dashboard
  if (!profile) return;

  const [pendingTalent, pendingHirers, openIntros, publishedTalent] = await Promise.all([
    supabase.from("talent_profiles").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "hirer").eq("hirer_status", "pending"),
    supabase.from("intro_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("talent_profiles").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_published", true),
  ]);

  const tiles = document.querySelectorAll("#statRow .stat-tile .num");
  tiles[0].textContent = pendingTalent.count ?? "—";
  tiles[1].textContent = pendingHirers.count ?? "—";
  tiles[2].textContent = openIntros.count ?? "—";
  tiles[3].textContent = publishedTalent.count ?? "—";

  renderReviewQueue();
})();

async function renderReviewQueue() {
  const el = document.getElementById("reviewQueue");
  const items = [];

  if (currentProfile.staff_role === "super_admin" || currentProfile.staff_role === "talent_manager") {
    const { data } = await supabase
      .from("talent_profiles")
      .select("id, card_code, created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(5);
    (data || []).forEach((row) =>
      items.push(`<div class="checkbox-row"><span>Talent profile <strong>${row.card_code}</strong> submitted</span>
        <a href="talent.html" class="btn btn-small btn-outline" style="margin-left:auto;">Review &rarr;</a></div>`)
    );
  }

  if (currentProfile.staff_role === "super_admin" || currentProfile.staff_role === "approver" || currentProfile.staff_role === "talent_manager") {
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, email, created_at")
      .eq("account_type", "hirer")
      .eq("hirer_status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);
    (data || []).forEach((row) =>
      items.push(`<div class="checkbox-row"><span>Hirer signup: <strong>${row.company_name || row.email}</strong></span>
        <a href="accounts.html" class="btn btn-small btn-outline" style="margin-left:auto;">Review &rarr;</a></div>`)
    );
  }

  el.innerHTML = items.length
    ? items.join("")
    : `<div class="empty-state">Nothing waiting on you right now.</div>`;
}
