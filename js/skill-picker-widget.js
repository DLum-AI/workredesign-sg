/* ===========================================================
   WorkRedesign.sg — reusable skill-picker widget.

   Replaces a free-text "comma-separated skills" field with a
   type-to-search, click-to-add chip picker backed by SkillsMap's
   2,388-entry Skills Framework taxonomy (SkillsMapData). Chosen
   skills are still plain strings (skill titles), so it's a drop-in
   replacement wherever skills_tags was a comma-separated string —
   no data-shape change needed downstream.

   Usage:
     const picker = createSkillPicker(mountEl, { initial: ["Xero", "Budgeting"] });
     picker.getValues();          // -> ["Xero", "Budgeting", ...]
     picker.setValues(["A","B"]); // replace current selection
   =========================================================== */
function createSkillPicker(mountEl, opts = {}) {
  const selected = []; // array of skill-title strings, in add order
  let allSkills = null; // lazy-loaded from SkillsMapData
  let loadError = false;

  mountEl.innerHTML = `
    <div class="skill-picker">
      <div class="skill-chip-row" id="skillChipRow"></div>
      <input type="text" class="skill-picker-input" placeholder="Type to search official skills (e.g. Budgeting, Xero, Data Analytics)…" autocomplete="off" />
      <div class="sf-result-list hidden" id="skillPickerResults"></div>
      <p class="muted skill-picker-hint">Search the national Skills Framework taxonomy, or press Enter to add free text if a skill isn't listed.</p>
    </div>`;

  const input = mountEl.querySelector(".skill-picker-input");
  const resultsEl = mountEl.querySelector("#skillPickerResults");
  const chipRow = mountEl.querySelector("#skillChipRow");

  (opts.initial || []).forEach((s) => selected.push(s));
  renderChips();

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value;
    debounceTimer = setTimeout(() => runSearch(q), 150);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (val) addSkill(val);
    } else if (e.key === "Backspace" && !input.value && selected.length) {
      removeSkill(selected[selected.length - 1]);
    }
  });
  document.addEventListener("click", (e) => {
    if (!mountEl.contains(e.target)) resultsEl.classList.add("hidden");
  });

  async function runSearch(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 1) {
      resultsEl.innerHTML = "";
      resultsEl.classList.add("hidden");
      return;
    }
    if (!allSkills && !loadError) {
      resultsEl.innerHTML = `<div class="sf-result-item muted">Loading skills taxonomy…</div>`;
      resultsEl.classList.remove("hidden");
      try {
        allSkills = await SkillsMapData.getUniqueSkills();
      } catch (err) {
        loadError = true;
        resultsEl.innerHTML = `<div class="sf-result-item muted">Couldn't load the skills taxonomy — you can still type a skill and press Enter to add it as free text.</div>`;
        return;
      }
    }
    if (loadError || !allSkills) return;

    const matches = allSkills
      .filter((s) => s.title.toLowerCase().includes(q) && !selected.includes(s.title))
      .slice(0, 12);

    if (!matches.length) {
      resultsEl.innerHTML = `<div class="sf-result-item muted">No matching official skill. Press Enter to add "${escapeHtmlSF(query.trim())}" as free text.</div>`;
      resultsEl.classList.remove("hidden");
      return;
    }
    resultsEl.innerHTML = matches
      .map(
        (s, i) => `
      <div class="sf-result-item" data-idx="${i}">
        <div class="sf-result-title">${escapeHtmlSF(s.title)} <span class="badge ${s.skill_type === "ccs" ? "badge-elevate" : "badge-automate"}" style="vertical-align:1px;">${s.skill_type.toUpperCase()}</span></div>
        ${s.description ? `<div class="sf-result-sector">${escapeHtmlSF(s.description)}</div>` : ""}
      </div>`
      )
      .join("");
    resultsEl.classList.remove("hidden");
    resultsEl.querySelectorAll(".sf-result-item[data-idx]").forEach((item) => {
      item.addEventListener("click", () => {
        addSkill(matches[Number(item.dataset.idx)].title);
      });
    });
  }

  function addSkill(title) {
    if (!title || selected.includes(title)) return;
    selected.push(title);
    input.value = "";
    resultsEl.innerHTML = "";
    resultsEl.classList.add("hidden");
    renderChips();
    if (opts.onChange) opts.onChange(selected.slice());
  }

  function removeSkill(title) {
    const idx = selected.indexOf(title);
    if (idx === -1) return;
    selected.splice(idx, 1);
    renderChips();
    if (opts.onChange) opts.onChange(selected.slice());
  }

  function renderChips() {
    chipRow.innerHTML = selected
      .map(
        (s) => `
      <span class="skill-chip">${escapeHtmlSF(s)}<button type="button" class="skill-chip-remove" data-skill="${escapeHtmlSF(s)}" aria-label="Remove ${escapeHtmlSF(s)}">&times;</button></span>`
      )
      .join("");
    chipRow.querySelectorAll(".skill-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => removeSkill(btn.dataset.skill));
    });
  }

  return {
    getValues: () => selected.slice(),
    setValues: (arr) => {
      selected.length = 0;
      (arr || []).forEach((s) => selected.push(s));
      renderChips();
    },
  };
}
