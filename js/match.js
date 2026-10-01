/* ===========================================================
   WorkRedesign.sg — Stage 5 match request form
   Ships with a zero-backend mailto: fallback. To collect
   submissions properly, set SITE.matchFormEndpoint in
   js/data.js to a Formspree/Netlify Forms endpoint and this
   will POST there instead automatically.
   =========================================================== */

let skillsNeededPicker = null; // chip picker backed by SkillsMap's Skills Framework taxonomy

function initMatchForm() {
  skillsNeededPicker = createSkillPicker(document.getElementById("skillsNeededMount"), {
    initial: skillsFromLinkedRole(),
  });
  prefillFromTaskMap();
  document.getElementById("matchForm").addEventListener("submit", handleSubmit);
}

// If a role was linked back on the evaluation / job-redesign pages, use its
// official required skills as a starting point for "skills needed" here —
// the hirer can still add, remove, or free-type to adjust.
function skillsFromLinkedRole() {
  const role = typeof getLinkedRole === "function" ? getLinkedRole() : null;
  if (!role) return [];
  return role.skills.map((s) => s.title);
}

function prefillFromTaskMap() {
  const raw = localStorage.getItem("wr_task_map_result");
  if (!raw) return;
  const result = JSON.parse(raw);

  const banner = document.getElementById("taskMapSummary");
  const text = document.getElementById("taskMapSummaryText");
  text.innerHTML = `Carried over from your task map: <strong>${result.role}</strong>, roughly
    <strong>${Math.round(result.remainingHours * 10) / 10} hrs/week</strong> of judgement/relationship
    work remaining — recommended as <strong>${result.recommendation.type}</strong>.`;
  banner.classList.remove("hidden");

  document.getElementById("hoursWeek").value = Math.round(result.remainingHours);

  const arrangementSelect = document.getElementById("arrangementType");
  const typeMap = { "Fractional": "Fractional", "Job-share": "Job-share", "Project-based or full-time": "Project-based" };
  const mapped = typeMap[result.recommendation.type];
  if (mapped) arrangementSelect.value = mapped;

  document.getElementById("message").value =
    `Role: ${result.role}\nRemaining hours/week (judgement + relationship work): ${Math.round(result.remainingHours * 10) / 10}\n\n`;
}

function handleSubmit(e) {
  e.preventDefault();

  const data = {
    companyName: document.getElementById("companyName").value,
    contactEmail: document.getElementById("contactEmail").value,
    functionArea: document.getElementById("functionArea").value,
    arrangementType: document.getElementById("arrangementType").value,
    hoursWeek: document.getElementById("hoursWeek").value,
    skillsNeeded: skillsNeededPicker.getValues(),
    message: document.getElementById("message").value,
  };

  if (SITE.matchFormEndpoint) {
    // Real backend path — swap in a Formspree/Netlify Forms endpoint in js/data.js
    fetch(SITE.matchFormEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    })
      .then(() => showSuccess())
      .catch(() => {
        alert("Something went wrong sending your request — please try the email fallback or contact us directly.");
      });
    return;
  }

  // Zero-backend fallback: compose a pre-filled email
  const subject = encodeURIComponent(`Talent match request: ${data.companyName || "New enquiry"}`);
  const body = encodeURIComponent(
    `Company: ${data.companyName}\n` +
      `Contact email: ${data.contactEmail}\n` +
      `Function area: ${data.functionArea}\n` +
      `Arrangement type: ${data.arrangementType}\n` +
      `Hours/week: ${data.hoursWeek}\n` +
      `Skills needed: ${data.skillsNeeded.join(", ") || "(none specified)"}\n\n` +
      `${data.message}`
  );
  window.location.href = `mailto:${SITE.contactEmail}?subject=${subject}&body=${body}`;
  showSuccess();
}

function showSuccess() {
  document.getElementById("matchForm").classList.add("hidden");
  document.getElementById("formSuccess").classList.remove("hidden");
}
