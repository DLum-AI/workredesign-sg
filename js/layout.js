/* ===========================================================
   WorkRedesign.sg — shared header/footer injector
   Renders the nav + footer into any page that includes a
   <div id="site-header"></div> and <div id="site-footer"></div>.
   =========================================================== */

function renderHeader(activePage) {
  const el = document.getElementById("site-header");
  if (!el) return;
  const links = [
    { href: "index.html", label: "Is Your Job Ready?", key: "index" },
    { href: "task-map.html", label: "Task Map Tool", key: "task-map" },
    { href: "grants.html", label: "Grants & Checklists", key: "grants" },
    { href: "match.html", label: "Find Talent", key: "match" },
    { href: "directory.html", label: "Talent Directory", key: "directory" },
    { href: "about.html", label: "About", key: "about" },
    { href: "account.html", label: "Sign In", key: "account" },
  ];
  const navHtml = links
    .map(
      (l) =>
        `<a href="${l.href}" class="${l.key === activePage ? "active" : ""}">${l.label}</a>`
    )
    .join("");
  el.innerHTML = `
    <header class="site-header">
      <div class="container">
        <a href="index.html" class="logo">${SITE.name.replace(".sg", "")}<span class="dot">.sg</span></a>
        <nav class="main-nav">${navHtml}</nav>
      </div>
    </header>
  `;
}

function renderFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <p><strong>${SITE.name}</strong> is a free tool from <strong>${SITE.orgName}</strong> to help
        Singapore hirers spot job-redesign opportunities, understand what grants can fund them, and
        connect with fractional / job-share / project-based talent.</p>
        <p class="mt-24">Grant information reflects publicly available sources as of the last update to this
        site and may not be current — always verify eligibility and funding details directly on
        <a href="https://www.ourworkforce.gov.sg" target="_blank" rel="noopener">OurWorkforce.gov.sg</a>
        before applying or committing to any spend.</p>
        <p class="mb-0">© <span id="year"></span> ${SITE.orgName}. Contact:
        <a href="mailto:${SITE.contactEmail}">${SITE.contactEmail}</a></p>
      </div>
    </footer>
  `;
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}
