/* ===========================================================
   WorkRedesign.sg Admin — content.js (Content & Menu CMS)
   =========================================================== */

(async function () {
  const profile = await requireStaff(["content_editor"]);
  if (!profile) return;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-content").classList.toggle("hidden", btn.dataset.tab !== "content");
      document.getElementById("tab-menu").classList.toggle("hidden", btn.dataset.tab !== "menu");
    });
  });

  document.getElementById("newContentBtn").addEventListener("click", () => openContentModal(null));
  document.getElementById("newMenuBtn").addEventListener("click", () => openMenuModal(null));

  await loadContent();
  await loadMenu();
})();

// ---- Content blocks ----
async function loadContent() {
  const { data, error } = await supabase.from("content_blocks").select("*").order("page").order("block_key");
  const tbody = document.getElementById("contentRows");
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Error loading content: ${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No content blocks yet. Add one to get started.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (row) => `
    <tr>
      <td><code>${escapeHtml(row.block_key)}</code></td>
      <td>${escapeHtml(row.page)}</td>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml((row.content_value || "").slice(0, 60))}${(row.content_value || "").length > 60 ? "…" : ""}</td>
      <td class="actions">
        <button class="btn btn-small btn-outline" data-edit="${row.id}">Edit</button>
        <button class="btn btn-small btn-danger" data-delete="${row.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openContentModal(data.find((r) => r.id === b.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => deleteContent(b.dataset.delete))
  );
}

function openContentModal(row) {
  const isNew = !row;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <button class="close-btn">&times;</button>
      <h2>${isNew ? "New content block" : "Edit content block"}</h2>
      <form id="contentForm">
        <div class="field">
          <label>Key (unique identifier, e.g. hero.index.title)</label>
          <input type="text" id="cb_key" value="${row ? escapeHtml(row.block_key) : ""}" ${isNew ? "" : "readonly"} required />
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Page</label><input type="text" id="cb_page" value="${row ? escapeHtml(row.page) : ""}" required /></div>
          <div class="field"><label>Label</label><input type="text" id="cb_label" value="${row ? escapeHtml(row.label) : ""}" required /></div>
        </div>
        <div class="field">
          <label>Value</label>
          <textarea id="cb_value" rows="5">${row ? escapeHtml(row.content_value || "") : ""}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Save</button>
      </form>
    </div>
  `;
  document.getElementById("modalRoot").appendChild(modal);
  modal.querySelector(".close-btn").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector("#contentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      block_key: document.getElementById("cb_key").value.trim(),
      page: document.getElementById("cb_page").value.trim(),
      label: document.getElementById("cb_label").value.trim(),
      content_value: document.getElementById("cb_value").value,
      updated_by: currentProfile.id,
    };
    const { error } = isNew
      ? await supabase.from("content_blocks").insert(payload)
      : await supabase.from("content_blocks").update(payload).eq("id", row.id);

    if (error) { alert("Save failed: " + error.message); return; }
    await logAudit(isNew ? "create" : "update", "content_blocks", row ? row.id : payload.block_key, payload);
    modal.remove();
    loadContent();
  });
}

async function deleteContent(id) {
  if (!confirm("Delete this content block? This can't be undone.")) return;
  const { error } = await supabase.from("content_blocks").delete().eq("id", id);
  if (error) { alert("Delete failed: " + error.message); return; }
  await logAudit("delete", "content_blocks", id, null);
  loadContent();
}

// ---- Menu items ----
async function loadMenu() {
  const { data, error } = await supabase.from("menu_items").select("*").order("sort_order");
  const tbody = document.getElementById("menuRows");
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Error loading menu: ${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No menu items yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (row) => `
    <tr>
      <td>${row.sort_order}</td>
      <td>${escapeHtml(row.label)}</td>
      <td><code>${escapeHtml(row.href)}</code></td>
      <td>${row.is_visible ? "✅" : "🚫"}</td>
      <td class="actions">
        <button class="btn btn-small btn-outline" data-edit="${row.id}">Edit</button>
        <button class="btn btn-small btn-danger" data-delete="${row.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openMenuModal(data.find((r) => r.id === b.dataset.edit)))
  );
  tbody.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => deleteMenu(b.dataset.delete))
  );
}

function openMenuModal(row) {
  const isNew = !row;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <button class="close-btn">&times;</button>
      <h2>${isNew ? "New menu item" : "Edit menu item"}</h2>
      <form id="menuForm">
        <div class="grid cols-2">
          <div class="field"><label>Label</label><input type="text" id="mi_label" value="${row ? escapeHtml(row.label) : ""}" required /></div>
          <div class="field"><label>Link (href)</label><input type="text" id="mi_href" value="${row ? escapeHtml(row.href) : ""}" required /></div>
        </div>
        <div class="grid cols-2">
          <div class="field"><label>Sort order</label><input type="number" id="mi_order" value="${row ? row.sort_order : 0}" /></div>
          <div class="field">
            <label>&nbsp;</label>
            <div class="checkbox-row" style="border:none; padding:0;">
              <input type="checkbox" id="mi_visible" ${!row || row.is_visible ? "checked" : ""} />
              <label for="mi_visible" style="font-weight:400;">Visible in nav</label>
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

  modal.querySelector("#menuForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      label: document.getElementById("mi_label").value.trim(),
      href: document.getElementById("mi_href").value.trim(),
      sort_order: parseInt(document.getElementById("mi_order").value, 10) || 0,
      is_visible: document.getElementById("mi_visible").checked,
    };
    const { error } = isNew
      ? await supabase.from("menu_items").insert(payload)
      : await supabase.from("menu_items").update(payload).eq("id", row.id);

    if (error) { alert("Save failed: " + error.message); return; }
    await logAudit(isNew ? "create" : "update", "menu_items", row ? row.id : null, payload);
    modal.remove();
    loadMenu();
  });
}

async function deleteMenu(id) {
  if (!confirm("Delete this menu item?")) return;
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) { alert("Delete failed: " + error.message); return; }
  await logAudit("delete", "menu_items", id, null);
  loadMenu();
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
