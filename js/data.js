/* ===========================================================
   WorkRedesign.sg — shared data
   Edit this file to update grant details, checklist items,
   and site-wide constants without touching page HTML.
   =========================================================== */

const SITE = {
  name: "WorkRedesign.sg",
  orgName: "Fractional Careers SG", // <-- replace with your social enterprise's actual name
  tagline: "Learn it. Fund it. Fill it.",
  contactEmail: "hello@example.org", // <-- replace with your real inbox
  // Replace with a real form endpoint (e.g. https://formspree.io/f/xxxxxxx) to receive
  // Stage 5 match requests directly, instead of the mailto: fallback used by default.
  matchFormEndpoint: "",
};

// ---- Grant reference data (Stage 4) ------------------------
// Source: OurWorkforce.gov.sg / WSG.gov.sg programme pages, as of Sep 2026.
// Verify current terms before quoting figures to hirers — schemes are updated periodically.
const GRANTS = [
  {
    id: "ccp",
    name: "Career Conversion Programmes (CCP)",
    short: "Salary support to hire or retrain a mid-career PMET into a new role.",
    url: "https://www.ourworkforce.gov.sg/programmes-directory/programme/career-conversion-programmes",
    fundingSummary: "Government co-funds salary during structured on-the-job training (plus course-fee top-ups where eligible). Not a lump-sum grant.",
    bestFor: "Hiring a mid-career PMET into a genuinely new / redesigned role, or reskilling an existing employee into one.",
    checklist: [
      "Company is registered/incorporated in Singapore with a valid UEN (ACRA, or MAS-licensed/exempt for financial firms)",
      "Complies with the Employment Act 1968 for all trainees placed under the programme",
      "Have identified the specific growth job role the candidate will train for (CCPs are sector- and role-specific)",
      "For a NEW HIRE: candidate has not started work yet, or CCP commencement is within 3 months of their start date",
      "For an EXISTING EMPLOYEE: they've been with the company ≥ 1 year and are being reskilled into a new/redesigned role",
      "The new role is “substantially different” from the trainee's previous role — not just a title change",
      "Have NOT started the training/conversion before securing programme approval",
    ],
  },
  {
    id: "wdgjr",
    name: "SkillsFuture Workforce Development Grant — Job Redesign+ (WDG(JR+))",
    short: "Up to 70% funding (cap $150,000) for job-redesign consultancy, capability building, and workforce tech.",
    url: "https://www.ourworkforce.gov.sg/programmes-directory/programme/workforce-development-grant-job-redesign-plus",
    fundingSummary: "Workforce consultancy (up to $50,000), capability building (up to $60,000), workforce tech (up to $90,000, must be combined with one of the above). Overall cap $150,000 per enterprise at up to 70% (SME rate).",
    bestFor: "Funding the job-redesign process itself — the diagnostic, the training, and/or the tech that supports the redesigned roles.",
    checklist: [
      "Company is registered/operating in Singapore",
      "Employs at least 3 local employees (Singapore Citizens or PRs)",
      "Have NOT signed any contract or purchase order, and have NOT made any payment, for job-redesign or workforce-related consultancy — this is the most important box on this list",
      "Have picked (or are shortlisting) a pre-approved consultant from the official OurWorkforce/WSG panel",
      "Know which component(s) are needed: consultancy / capability building / workforce tech (tech alone cannot be claimed — must pair with one of the other two)",
      "Total funding ask fits within the $150,000 overall cap",
      "Have a rough scope in mind for what's being redesigned (a function, a process, a set of roles)",
    ],
  },
  {
    id: "mcpp",
    name: "Mid-Career Pathways Programme",
    short: "Structured 4–6 month attachments (re-ternships) for mature/mid-career individuals, government co-funds 70% of the training allowance.",
    url: "https://www.ourworkforce.gov.sg/programmes-directory/programme/mid-career-pathways-programme",
    fundingSummary: "Monthly allowance range $1,800–$3,800; government covers 70%, host organisation covers 30% throughout the attachment.",
    bestFor: "Hosting a mature/mid-career individual on a structured attachment that leads to a genuine permanent (or ongoing fractional/job-share) role.",
    checklist: [
      "Organisation is registered or incorporated in Singapore",
      "Able to commit to an attachment lasting 4 to 6 months",
      "Have a genuine, budgeted position the attachment is building toward — not subsidised short-term labour with no hiring intent",
      "Able to pay the same salary or higher if converting the individual early or at the end of the attachment",
      "Can prepare a documented training plan and development strategy for programme-manager approval before the attachment starts",
      "Understand the 70/30 co-funding split on the training allowance",
    ],
  },
];

// ---- Stage 1 awareness quiz -------------------------------
const QUIZ_QUESTIONS = [
  {
    q: "Is someone on your team drowning in admin most days?",
    options: [
      { label: "Yes, constantly", points: 2 },
      { label: "Sometimes, in busy periods", points: 1 },
      { label: "Not really", points: 0 },
    ],
  },
  {
    q: "Have you had trouble hiring or retaining people for this role?",
    options: [
      { label: "Yes — it's a recurring headache", points: 2 },
      { label: "Once or twice", points: 1 },
      { label: "No, it's stable", points: 0 },
    ],
  },
  {
    q: "Are you paying for full-time work that actually spikes and dips?",
    options: [
      { label: "Yes, clearly seasonal or project-based", points: 2 },
      { label: "A bit uneven, but mostly steady", points: 1 },
      { label: "No, it's consistently full-time work", points: 0 },
    ],
  },
  {
    q: "Have you introduced (or are you considering) any automation or new software for this role?",
    options: [
      { label: "Yes, and the job hasn't been re-thought since", points: 2 },
      { label: "Thinking about it", points: 1 },
      { label: "No plans to", points: 0 },
    ],
  },
  {
    q: "If you're honest — does this role really need one full-time person, or could it be a few focused hours a week?",
    options: [
      { label: "Probably could be part-time / fractional", points: 2 },
      { label: "Not sure", points: 1 },
      { label: "Definitely needs to be full-time", points: 0 },
    ],
  },
];

// ---- Stage 2/3 task classification rules -------------------
// nature: "rules" | "judgement" | "relationship"
// value: "low" | "medium" | "high"
function classifyTask(task) {
  if (task.value === "low" && task.nature === "rules") return "eliminate";
  if (task.nature === "rules") return "automate";
  if (task.nature === "judgement") return "augment";
  return "elevate"; // relationship / leadership
}

const BUCKET_INFO = {
  eliminate: { label: "Eliminate", badgeClass: "badge-eliminate", desc: "Low-value, rules-based — candidate to drop entirely." },
  automate: { label: "Automate", badgeClass: "badge-automate", desc: "Rules-based and repeatable — candidate for a tool or script." },
  augment: { label: "Augment", badgeClass: "badge-augment", desc: "Needs human judgement, but tools can speed it up." },
  elevate: { label: "Elevate / Retain", badgeClass: "badge-elevate", desc: "Relationship- or leadership-driven — keep and prioritise." },
};

function recommendArrangement(remainingHours) {
  if (remainingHours <= 0) {
    return { type: "Fully automatable", detail: "Almost all of this role's remaining work can be removed or automated. Consider whether this role needs a dedicated person at all, or folding the remainder into an existing role." };
  }
  if (remainingHours <= 20) {
    return { type: "Fractional", detail: `About ${remainingHours} hrs/week of genuine judgement or relationship work is left — a strong candidate for a fractional hire (a few days a week, not full-time).` };
  }
  if (remainingHours <= 32) {
    return { type: "Job-share", detail: `About ${remainingHours} hrs/week remains — this comfortably fits a job-share between two part-time PMETs, or one fractional hire at higher hours.` };
  }
  return { type: "Project-based or full-time", detail: `${remainingHours} hrs/week is close to a full role. Consider a project-based engagement for a defined scope, or accept this may still warrant a full-time hire — but revisit after automating the Eliminate/Automate tasks.` };
}
