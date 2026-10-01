/* ===========================================================
   WorkRedesign.sg — talent-submit.js (PMET self-submission)
   =========================================================== */

let existingProfile = null; // the pmet's own talent_profiles row, if any
let skillsPicker = null; // chip picker backed by SkillsMap's Skills Framework taxonomy

(async function () {
  renderHeader("");
  renderFooter();
  skillsPicker = createSkillPicker(document.getElementById("skillsPickerMount"));

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    document.getElementById("notLoggedIn").classList.remove("hidden");
    return;
  }

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", session.user.id).single();
  if (!profile || profile.account_type !== "pmet") {
    document.getElementById("notLoggedIn").innerHTML = `
      <h2>PMET accounts only</h2>
      <p class="mb-0">This form is for mid-career PMETs submitting their own profile. If you're a hirer,
      head to <a href="directory.html">the talent directory</a> instead.</p>`;
    document.getElementById("notLoggedIn").classList.remove("hidden");
    return;
  }

  document.getElementById("formWrap").classList.remove("hidden");
  await loadExisting(session.user.id);
  document.getElementById("submitBtn").addEventListener("click", () => submitProfile(session.user.id));
})();

async function loadExisting(userId) {
  const { data, error } = await supabase
    .from("talent_profiles")
    .select(`
      id, status, review_notes, consent_public_card, consent_private_detail,
      talent_public_info ( * ), talent_private_info ( * ), talent_contacts ( * )
    `)
    .eq("pmet_user_id", userId)
    .maybeSingle();

  if (error || !data) return;
  existingProfile = data;

  const pub = Array.isArray(data.talent_public_info) ? data.talent_public_info[0] : data.talent_public_info;
  const priv = Array.isArray(data.talent_private_info) ? data.talent_private_info[0] : data.talent_private_info;
  const contact = Array.isArray(data.talent_contacts) ? data.talent_contacts[0] : data.talent_contacts;

  if (pub) {
    document.getElementById("headline").value = pub.headline || "";
    document.getElementById("function_area").value = pub.function_area || "Finance / Accounting";
    document.getElementById("years_band").value = pub.years_experience_band || "3-5 years";
    document.getElementById("availability").value = pub.availability_hours_per_week || "";
    skillsPicker.setValues(pub.skills_tags || []);
    Array.from(document.getElementById("arrangement_types").options).forEach((opt) => {
      opt.selected = (pub.arrangement_types || []).includes(opt.value);
    });
  }
  if (priv) {
    document.getElementById("bio_private").value = priv.bio_private || "";
    document.getElementById("tools_software").value = (priv.tools_software || []).join(", ");
    document.getElementById("rate_band").value = priv.indicative_rate_band || "";
    document.getElementById("case_study").value = priv.case_study_summary || "";
  }
  if (contact) {
    document.getElementById("full_name").value = contact.full_name || "";
    document.getElementById("contact_email").value = contact.contact_email || "";
    document.getElementById("contact_phone").value = contact.contact_phone || "";
  }
  document.getElementById("consent_public").checked = !!data.consent_public_card;
  document.getElementById("consent_private").checked = !!data.consent_private_detail;

  const banner = document.getElementById("statusBanner");
  const tierClass = { approved: "high", rejected: "low", pending_review: "medium", draft: "low", paused: "medium" }[data.status] || "medium";
  banner.className = `verdict ${tierClass}`;
  banner.innerHTML = `<h2>Status: ${data.status.replace("_", " ")}</h2>
    ${data.review_notes ? `<p class="mb-0">Reviewer notes: ${escapeHtml(data.review_notes)}</p>` : ""}`;
  banner.classList.remove("hidden");

  if (data.status === "approved") {
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("submitBtn").textContent = "Already approved — contact us to make changes";
  }
}

async function submitProfile(userId) {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const skills_tags = skillsPicker.getValues();
  const arrangement_types = Array.from(document.getElementById("arrangement_types").selectedOptions).map((o) => o.value);
  const tools_software = splitList(document.getElementById("tools_software").value);

  try {
    let talentProfileId = existingProfile ? existingProfile.id : null;

    if (!talentProfileId) {
      const { data: newRow, error: insErr } = await supabase
        .from("talent_profiles")
        .insert({
          pmet_user_id: userId,
          status: "pending_review",
          consent_public_card: document.getElementById("consent_public").checked,
          consent_private_detail: document.getElementById("consent_private").checked,
          consent_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (insErr) throw insErr;
      talentProfileId = newRow.id;
    } else {
      const { error: updErr } = await supabase
        .from("talent_profiles")
        .update({
          status: "pending_review", // re-submitting counts as a fresh review request
          consent_public_card: document.getElementById("consent_public").checked,
          consent_private_detail: document.getElementById("consent_private").checked,
          consent_date: new Date().toISOString(),
        })
        .eq("id", talentProfileId);
      if (updErr) throw updErr;
    }

    await supabase.from("talent_public_info").upsert({
      talent_profile_id: talentProfileId,
      headline: document.getElementById("headline").value,
      function_area: document.getElementById("function_area").value,
      years_experience_band: document.getElementById("years_band").value,
      availability_hours_per_week: parseInt(document.getElementById("availability").value, 10) || null,
      skills_tags,
      arrangement_types,
    });

    await supabase.from("talent_private_info").upsert({
      talent_profile_id: talentProfileId,
      bio_private: document.getElementById("bio_private").value,
      tools_software,
      indicative_rate_band: document.getElementById("rate_band").value,
      case_study_summary: document.getElementById("case_study").value,
    });

    await supabase.from("talent_contacts").upsert({
      talent_profile_id: talentProfileId,
      full_name: document.getElementById("full_name").value,
      contact_email: document.getElementById("contact_email").value,
      contact_phone: document.getElementById("contact_phone").value,
    });

    const banner = document.getElementById("statusBanner");
    banner.className = "verdict high";
    banner.innerHTML = `<h2>Submitted for review</h2><p class="mb-0">Our team will review your profile shortly. You can come back to this page any time to check its status or update your details.</p>`;
    banner.classList.remove("hidden");
    banner.scrollIntoView({ behavior: "smooth" });
    btn.textContent = "Submitted ✓";
  } catch (err) {
    alert("Something went wrong: " + err.message);
    btn.disabled = false;
    btn.textContent = "Submit for review";
  }
}

function splitList(str) {
  return (str || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
