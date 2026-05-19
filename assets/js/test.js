/* ────────── 상수 ────────── */

const AXIS_NAMES = {
  axis1: '감정 해소법',
  axis2: '마음의 초점',
  axis3: '삶의 주도권',
  axis4: '관계의 방식',
};

/* ────────── 상태 ────────── */

let questions = [];   // 섞인 문항 배열 (scoreA/B도 A/B 스왑에 맞게 조정됨)
let answers   = [];   // [{ id, selected:'A'|'B' }, ...]  인덱스 = 표시 순서
let current   = 0;

/* ────────── DOM ────────── */

const loadingEl      = document.getElementById('loading');
const testScreenEl   = document.getElementById('test-screen');
const progressFillEl = document.getElementById('progress-fill');
const progressCatEl  = document.getElementById('progress-category');
const progressCntEl  = document.getElementById('progress-count');
const questionNumEl  = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const optionAEl      = document.getElementById('option-a');
const optionBEl      = document.getElementById('option-b');
const optionATextEl  = document.getElementById('option-a-text');
const optionBTextEl  = document.getElementById('option-b-text');
const btnBackEl      = document.getElementById('btn-back');

/* ────────── 유틸 ────────── */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomizeQuestions(rawQuestions) {
  const shuffled = shuffleArray(rawQuestions);
  return shuffled.map(q => {
    if (Math.random() < 0.5) {
      // A/B 선택지 및 점수 교체
      return {
        ...q,
        optionA: q.optionB,
        optionB: q.optionA,
        scoreA:  q.scoreB,
        scoreB:  q.scoreA,
      };
    }
    return { ...q };
  });
}

/* ────────── 초기화 ────────── */

async function init() {
  const res  = await fetch('lbt_data.json');
  const data = await res.json();

  // 세션 내 동일 순서 유지 (새로고침해도 동일한 순서)
  const savedQ = sessionStorage.getItem('lbt_questions');
  if (savedQ) {
    try {
      questions = JSON.parse(savedQ);
    } catch {
      questions = randomizeQuestions(data.questions);
      sessionStorage.setItem('lbt_questions', JSON.stringify(questions));
    }
  } else {
    questions = randomizeQuestions(data.questions);
    sessionStorage.setItem('lbt_questions', JSON.stringify(questions));
  }

  // 이전 답변 복구
  const savedA = sessionStorage.getItem('lbt_answers');
  if (savedA) {
    try { answers = JSON.parse(savedA); } catch { answers = []; }
  }

  // 마지막으로 답한 문항에서 시작
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
  progressCatEl.textContent  = AXIS_NAMES[q.axis] || '';
  progressCntEl.textContent  = `${idx + 1} / ${questions.length}`;

  questionNumEl.textContent  = `Q${idx + 1}`;
  questionTextEl.textContent = q.question;
  optionATextEl.textContent  = q.optionA;
  optionBTextEl.textContent  = q.optionB;

  const existing = answers[idx];
  optionAEl.classList.toggle('selected', existing?.selected === 'A');
  optionBEl.classList.toggle('selected', existing?.selected === 'B');

  btnBackEl.disabled = idx === 0;

  testScreenEl.classList.remove('fade-in');
  void testScreenEl.offsetWidth;
  testScreenEl.classList.add('fade-in');
}

/* ────────── 선택 처리 ────────── */

function selectOption(choice) {
  optionAEl.classList.toggle('selected', choice === 'A');
  optionBEl.classList.toggle('selected', choice === 'B');

  // 버튼 중복 클릭 방지
  optionAEl.disabled = true;
  optionBEl.disabled = true;

  answers[current] = { id: questions[current].id, selected: choice };
  sessionStorage.setItem('lbt_answers', JSON.stringify(answers));

  setTimeout(() => {
    optionAEl.disabled = false;
    optionBEl.disabled = false;

    if (current < questions.length - 1) {
      current++;
      renderQuestion(current);
    } else {
      finishTest();
    }
  }, 380);
}

optionAEl.addEventListener('click', () => selectOption('A'));
optionBEl.addEventListener('click', () => selectOption('B'));

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
  for (let i = 0; i < questions.length; i++) {
    const ans = answers[i];
    if (!ans) continue;
    const q     = questions[i];
    const score = ans.selected === 'A' ? q.scoreA : q.scoreB;
    if (score in scores) scores[score]++;
  }
  return scores;
}

function calculateType() {
  const s = calculateScores();
  return `${s.P >= s.E ? 'P':'E'}${s.S >= s.A ? 'S':'A'}${s.R >= s.C ? 'R':'C'}${s.J >= s.M ? 'J':'M'}`;
}

/* ────────── 완료 ────────── */

function finishTest() {
  const scores   = calculateScores();
  const typeCode = `${scores.P >= scores.E ? 'P':'E'}${scores.S >= scores.A ? 'S':'A'}${scores.R >= scores.C ? 'R':'C'}${scores.J >= scores.M ? 'J':'M'}`;

  sessionStorage.setItem('lbt_result_type', typeCode);
  sessionStorage.setItem('lbt_scores', JSON.stringify(scores));
  sessionStorage.removeItem('lbt_answers');
  sessionStorage.removeItem('lbt_questions');

  // 점수를 URL 파라미터로도 전달 (직접 링크 공유 대비)
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
