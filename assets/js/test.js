/* ────────── 상태 ────────── */

let questions = [];
let answers   = [];   // [{ id, codes: ['X','Y'] }, ...]
let current   = 0;

/* ────────── DOM ────────── */

const loadingEl      = document.getElementById('loading');
const testScreenEl   = document.getElementById('test-screen');
const progressFillEl = document.getElementById('progress-fill');
const progressCatEl  = document.getElementById('progress-category');
const progressCntEl  = document.getElementById('progress-count');
const questionNumEl  = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const btnBackEl      = document.getElementById('btn-back');

const optionEls = ['a', 'b', 'c', 'd'].map(id => document.getElementById(`option-${id}`));
const optionTextEls = ['a', 'b', 'c', 'd'].map(id => document.getElementById(`option-${id}-text`));

/* ────────── 유틸 ────────── */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ────────── 초기화 ────────── */

async function init() {
  const res  = await fetch('lbt_data.json?v=6');
  const data = await res.json();

  const savedQ = sessionStorage.getItem('lbt_questions');
  if (savedQ) {
    try {
      questions = JSON.parse(savedQ);
    } catch {
      questions = shuffleArray(data.questions);
      sessionStorage.setItem('lbt_questions', JSON.stringify(questions));
    }
  } else {
    questions = shuffleArray(data.questions);
    sessionStorage.setItem('lbt_questions', JSON.stringify(questions));
  }

  const savedA = sessionStorage.getItem('lbt_answers');
  if (savedA) {
    try { answers = JSON.parse(savedA); } catch { answers = []; }
  }

  current = Math.min(answers.length, questions.length - 1);

  loadingEl.style.display    = 'none';
  testScreenEl.style.display = 'flex';
  renderQuestion(current);
}

/* ────────── 문항 렌더링 ────────── */

function renderQuestion(idx) {
  const q   = questions[idx];
  const pct = (idx / questions.length) * 100;

  progressFillEl.style.width = pct + '%';
  progressCatEl.textContent  = '';
  progressCntEl.textContent  = `${idx + 1} / ${questions.length}`;

  questionNumEl.textContent  = `Q${idx + 1}`;
  questionTextEl.textContent = q.question;

  q.options.forEach((opt, i) => {
    optionTextEls[i].textContent = opt.text;
  });

  const existing = answers[idx];
  optionEls.forEach((el, i) => {
    const isSelected = existing?.label === q.options[i].label;
    el.classList.toggle('selected', isSelected);
  });

  btnBackEl.disabled = idx === 0;

  testScreenEl.classList.remove('fade-in');
  void testScreenEl.offsetWidth;
  testScreenEl.classList.add('fade-in');
}

/* ────────── 선택 처리 ────────── */

function selectOption(optionIdx) {
  const opt = questions[current].options[optionIdx];

  optionEls.forEach((el, i) => el.classList.toggle('selected', i === optionIdx));
  optionEls.forEach(el => { el.disabled = true; });

  answers[current] = { id: questions[current].id, label: opt.label, codes: opt.codes };
  sessionStorage.setItem('lbt_answers', JSON.stringify(answers));

  setTimeout(() => {
    optionEls.forEach(el => { el.disabled = false; });

    if (current < questions.length - 1) {
      current++;
      renderQuestion(current);
    } else {
      finishTest();
    }
  }, 380);
}

optionEls.forEach((el, i) => el.addEventListener('click', () => selectOption(i)));

/* ────────── 이전 버튼 ────────── */

btnBackEl.addEventListener('click', () => {
  if (current > 0) {
    current--;
    renderQuestion(current);
  }
});

/* ────────── 결과 계산 ────────── */

function calculateScores() {
  const scores = { P:0, E:0, S:0, A:0, R:0, C:0, J:0, M:0 };
  for (const ans of answers) {
    if (!ans?.codes) continue;
    for (const code of ans.codes) {
      if (code in scores) scores[code]++;
    }
  }
  return scores;
}

/* ────────── 완료 ────────── */

function finishTest() {
  const scores   = calculateScores();
  const typeCode = `${scores.P >= scores.E ? 'P':'E'}${scores.S >= scores.A ? 'S':'A'}${scores.R >= scores.C ? 'R':'C'}${scores.J >= scores.M ? 'J':'M'}`;

  sessionStorage.setItem('lbt_result_type', typeCode);
  sessionStorage.setItem('lbt_scores', JSON.stringify(scores));
  sessionStorage.removeItem('lbt_answers');
  sessionStorage.removeItem('lbt_questions');

  const s = scores;
  const scoresParam = `${s.P},${s.E},${s.S},${s.A},${s.R},${s.C},${s.J},${s.M}`;
  window.location.replace(`result.html?type=${typeCode}&sc=${scoresParam}`);
}

/* ────────── 시작 ────────── */

init().catch(err => {
  console.error('테스트 초기화 오류:', err);
  loadingEl.innerHTML =
    '<p style="color:#E57373; font-size:14px; text-align:center">데이터를 불러오지 못했습니다.<br>새로고침 해주세요.</p>';
});
