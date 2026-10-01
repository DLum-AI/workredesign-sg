/* ===========================================================
   WorkRedesign.sg — Stage 1 (evaluation) ↔ Skills Framework link.
   Lets a hirer optionally ground their quiz answers in a real
   official job role; the chosen role is carried forward via
   localStorage (see role-search-widget.js) so the Task Map tool
   (Stage 2/3) can prefill from its official tasks and show its
   official required skills.
   =========================================================== */
function initRoleLink() {
  const input = document.getElementById("roleSearchInput");
  const results = document.getElementById("roleSearchResults");
  const display = document.getElementById("linkedRoleDisplay");
  const searchWrap = document.getElementById("roleSearchWrap");
  if (!input || !results || !display) return;

  const existing = getLinkedRole();
  if (existing) showLinked(existing);

  attachRoleSearch(input, results, (role) => {
    saveLinkedRole(role);
    showLinked(role);
  });

  function showLinked(role) {
    searchWrap.classList.add("hidden");
    display.innerHTML = renderLinkedRoleCard(role);
    document.getElementById("unlinkRoleBtn").addEventListener("click", () => {
      clearLinkedRole();
      display.innerHTML = "";
      searchWrap.classList.remove("hidden");
      input.value = "";
    });
  }
}
