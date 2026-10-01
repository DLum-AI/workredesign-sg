/* ===========================================================
   WorkRedesign.sg — Stage 1 quiz logic
   =========================================================== */

let quizState = { current: 0, answers: [] };

function initQuiz() {
  const saved = localStorage.getItem("wr_quiz_answers");
  quizState = { current: 0, answers: saved ? JSON.parse(saved) : [] };
  renderQuiz();
}

function renderQuiz() {
  const container = document.getElementById("quizContainer");
  const resultBox = document.getElementById("quizResult");
  const total = QUIZ_QUESTIONS.length;

  if (quizState.current >= total) {
    container.classList.add("hidden");
    resultBox.classList.remove("hidden");
    document.getElementById("progressFill").style.width = "100%";
    showVerdict();
    return;
  }

  container.classList.remove("hidden");
  resultBox.classList.add("hidden");
  document.getElementById("progressFill").style.width =
    Math.round((quizState.current / total) * 100) + "%";

  const q = QUIZ_QUESTIONS[quizState.current];
  const selected = quizState.answers[quizState.current];

  container.innerHTML = `
    <p class="muted">Question ${quizState.current + 1} of ${total}</p>
    <h2>${q.q}</h2>
    <div class="quiz-options">
      ${q.options
        .map(
          (opt, i) => `
        <div class="quiz-option ${selected === i ? "selected" : ""}" data-index="${i}">
          ${opt.label}
        </div>`
        )
        .join("")}
    </div>
  `;

  container.querySelectorAll(".quiz-option").forEach((el) => {
    el.addEventListener("click", () => {
      const i = parseInt(el.dataset.index, 10);
      quizState.answers[quizState.current] = i;
      localStorage.setItem("wr_quiz_answers", JSON.stringify(quizState.answers));
      quizState.current += 1;
      renderQuiz();
    });
  });
}

function showVerdict() {
  const score = quizState.answers.reduce((sum, ansIndex, qIndex) => {
    const opt = QUIZ_QUESTIONS[qIndex].options[ansIndex];
    return sum + (opt ? opt.points : 0);
  }, 0);
  const maxScore = QUIZ_QUESTIONS.length * 2;

  let tier, title, body;
  if (score >= maxScore * 0.6) {
    tier = "high";
    title = "This role looks like a strong redesign candidate.";
    body = "Several signals point to real redesign potential — automation-ready admin, hiring friction, or uneven workload. The next step turns this into something concrete: a task-by-task map of exactly what could change.";
  } else if (score >= maxScore * 0.3) {
    tier = "medium";
    title = "There's some redesign potential worth exploring.";
    body = "Not every signal is there, but there's enough friction to make a closer look worthwhile. The task map tool will show you specifically which parts of the job could shift.";
  } else {
    tier = "low";
    title = "This particular role may be fine as-is — for now.";
    body = "That's a useful answer too. Job redesign isn't right for every role, every time. If anything changes — new hires, new software, a hiring struggle — it's worth revisiting. You're welcome to try the task map tool anyway to see the fuller picture.";
  }

  document.getElementById("verdictBanner").innerHTML = `
    <div class="verdict ${tier}">
      <h2>${title}</h2>
      <p class="mb-0">${body}</p>
    </div>
  `;
}

function restartQuiz(e) {
  e.preventDefault();
  localStorage.removeItem("wr_quiz_answers");
  quizState = { current: 0, answers: [] };
  renderQuiz();
}
