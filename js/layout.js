/* Shared header/footer for SkillsMap.sg */

// This site loads its data as JSON files via fetch(). Browsers refuse
// fetch() entirely when a page is opened directly (double-clicked) as a
// file:// URL, which silently breaks every data-driven feature (role
// search, skills library, etc.) with no visible error. Warn loudly and
// immediately rather than letting things hang on "Searching..." forever.
(function warnIfFileProtocol() {
  if (window.location.protocol !== "file:") return;
  const show = () => {
    const banner = document.createElement("div");
    banner.className = "file-protocol-warning";
    banner.innerHTML = `
      <strong>This page won't load its data here.</strong>
      You opened this file directly, but browsers block the data files this
      site needs (fetch of local JSON) unless it's served over
      <code>http://</code>. Search boxes and role lookups will hang or stay
      empty. From a terminal, in this folder run
      <code>python3 -m http.server 8000</code>, then open
      <code>http://localhost:8000</code> in your browser instead.`;
    document.body.insertBefore(banner, document.body.firstChild);
  };
  if (document.body) show();
  else document.addEventListener("DOMContentLoaded", show);
})();

function renderHeader(active) {
  const links = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "redesign.html", label: "Redesign & Validate a Role", key: "redesign" },
    { href: "skills-library.html", label: "Skills Library", key: "skills" },
    { href: "about.html", label: "About the data", key: "about" },
  ];
  const nav = links
    .map((l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`)
    .join("");
  document.getElementById("site-header").outerHTML = `
    <header class="site-header">
      <div class="nav-row">
        <a href="index.html" class="brand">SkillsMap<span class="accent">.sg</span></a>
        <nav class="main-nav">${nav}</nav>
      </div>
    </header>`;
}

function renderFooter() {
  document.getElementById("site-footer").outerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div>Built on the Singapore SkillsFuture Skills Framework (SSG/WSG) &mdash; an independent, unofficial tool. Nothing you enter here is uploaded anywhere; it stays in your browser.</div>
        <div><a href="https://www.myskillsfuture.gov.sg/content/portal/en/career-resources/career-resources/browse-industry-sector.html" target="_blank" rel="noopener">Official Skills Framework &#8599;</a></div>
      </div>
    </footer>`;
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
