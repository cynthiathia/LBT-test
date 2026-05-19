/* ────────── 유형별 이미지 매핑 ────────── */

const TYPE_IMAGES = {
  PSRJ: 'type_img/마음속_편집장.png',
  PSRM: 'type_img/조용한_응원자.png',
  PSCJ: 'type_img/침묵의_개척자.png',
  PSCM: 'type_img/고요한_수호자.png',
  PARJ: 'type_img/따뜻한_심판관.png',
  PARM: 'type_img/봄날의_동반자.png',
  PACJ: 'type_img/온화한_결단자.png',
  PACM: 'type_img/고요한_창조자.png',
  ESRJ: 'type_img/열정적인_중재자.png',
  ESRM: 'type_img/다정한_이야기꾼.png',
  ESCJ: 'type_img/당찬_선언자.png',
  ESCM: 'type_img/빛나는_탐험가.png',
  EARJ: 'type_img/활기찬_안내자.png',
  EARM: 'type_img/포근한_격려자.png',
  EACJ: 'type_img/열정적인_건축가.png',
  EACM: 'type_img/언어의_연금술사.png',
};

/* ────────── URL 파라미터 ────────── */

const params   = new URLSearchParams(window.location.search);
const typeCode = (
  params.get('type') ||
  sessionStorage.getItem('lbt_result_type') ||
  ''
).toUpperCase();

const loadingEl      = document.getElementById('loading');
const resultScreenEl = document.getElementById('result-screen');

/* ────────── 초기화 ────────── */

async function init() {
  console.log('[LBT] typeCode:', typeCode);

  if (!typeCode) {
    window.location.replace('index.html');
    return;
  }

  // lbt_data.json 로드
  const res  = await fetch('lbt_data.json?v=9');
  const data = await res.json();
  const type = data.types[typeCode];

  if (!type) {
    window.location.replace('index.html');
    return;
  }

  renderResult(type, data.meta);
  renderAxesChart();
  await loadExternalLinks();
  loadConcertVideo();
  trackStat(typeCode);
  loadLiveCounter();
  sessionStorage.removeItem('lbt_result_type');

  loadingEl.style.display       = 'none';
  resultScreenEl.style.display  = 'block';
  resultScreenEl.classList.add('fade-in');
}


/* ────────── 결과 렌더링 ────────── */

function renderResult(type, meta) {
  // OG 태그 동적 설정
  document.title = `나는 ${type.name} (${type.code})형입니다 — LBT`;
  document.getElementById('og-title').content =
    `나는 ${type.name} (${type.code})형입니다`;
  document.getElementById('og-description').content = type.features[0];

  // 유형 코드
  document.getElementById('result-type-code').textContent = type.code;

  // 이미지
  const imgWrap = document.getElementById('result-img-wrap');
  const imgSrc  = TYPE_IMAGES[type.code];
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = type.name;
    imgWrap.appendChild(img);
    document.getElementById('og-image').content = `${window.location.origin}/type_img/${type.code}.png`;
  } else {
    imgWrap.style.display = 'none';
  }

  // 유형명 + 한 줄 정의
  document.getElementById('result-type-name').textContent = type.name;
  document.getElementById('result-tagline').textContent   = type.tagline || '';

  // 특징 / 장점 / 단점 / 자주 하는 말 / 반복하는 고민
  renderList('result-features', type.features);
  renderList('result-pros',     type.pros);
  renderList('result-cons',     type.cons);
  renderList('result-phrases',  type.phrases  || []);
  renderList('result-concern',  type.recurringConcern || []);

  // 공통 CTA — meta.cta (16개 유형 동일)
  const cta = (meta && meta.cta) || {};
  document.getElementById('cta-intro').innerHTML =
    (cta.intro || '').replace(/\n/g, '<br>');
  document.getElementById('cta-highlight').textContent = cta.highlight || '';
}

function renderList(id, items) {
  document.getElementById(id).innerHTML =
    items.map(text => `<li>${text}</li>`).join('');
}

/* ────────── 축 분석 차트 ────────── */

function renderAxesChart() {
  // sessionStorage 우선, 없으면 URL 파라미터에서 복원
  let scores = null;
  const saved = sessionStorage.getItem('lbt_scores');
  if (saved) {
    try { scores = JSON.parse(saved); } catch { /* ignore */ }
  }
  if (!scores) {
    const sc = params.get('sc');
    if (sc) {
      const [P,E,S,A,R,C,J,M] = sc.split(',').map(Number);
      scores = { P,E,S,A,R,C,J,M };
    }
  }
  if (!scores) {
    const section = document.querySelector('.axes-section');
    if (section) section.style.display = 'none';
    return;
  }

  const axes = [
    {
      name: '감정 해소법',
      desc: '감정이 쌓일 때 혼자 삭히는 편인지, 말로 꺼내는 편인지',
      left: 'P', leftLabel: '숙고형',
      right: 'E', rightLabel: '표현형',
    },
    {
      name: '마음의 초점',
      desc: '일상에서 없는 것에 시선이 가는지, 있는 것에 감사하는지',
      left: 'S', leftLabel: '결핍형',
      right: 'A', rightLabel: '풍요형',
    },
    {
      name: '삶의 주도권',
      desc: '주어진 상황에 적응하는 편인지, 스스로 상황을 만들어가는 편인지',
      left: 'R', leftLabel: '수용형',
      right: 'C', rightLabel: '창조형',
    },
    {
      name: '관계의 방식',
      desc: '관계에서 기준을 세우는 편인지, 유연하게 받아들이는 편인지',
      left: 'J', leftLabel: '판단형',
      right: 'M', rightLabel: '허용형',
    },
  ];

  const container = document.getElementById('axes-chart');
  if (!container) return;

  axes.forEach(axis => {
    const lScore = scores[axis.left]  || 0;
    const rScore = scores[axis.right] || 0;
    const total  = lScore + rScore;
    const leftPct  = total > 0 ? Math.round(lScore / total * 100) : 50;
    const rightPct = 100 - leftPct;
    const domLeft  = leftPct >= rightPct;

    const leftColor  = domLeft  ? '#C9A96E' : 'rgba(201,169,110,0.18)';
    const rightColor = !domLeft ? '#C9A96E' : 'rgba(201,169,110,0.18)';

    const item = document.createElement('div');
    item.className = 'axis-item';
    item.innerHTML = `
      <div class="axis-meta">
        <span class="axis-meta-name">${axis.name}</span>
        <span class="axis-meta-desc">${axis.desc}</span>
      </div>
      <div class="axis-bar-row">
        <div class="axis-side axis-side-left ${domLeft ? 'dominant' : ''}">
          <span class="axis-pct">${leftPct}%</span>
          <span class="axis-label">${axis.leftLabel}</span>
          <span class="axis-code">${axis.left}</span>
        </div>
        <div class="axis-track">
          <div class="axis-fill" style="flex:${leftPct};background:${leftColor}"></div>
          <div class="axis-fill" style="flex:${rightPct};background:${rightColor}"></div>
        </div>
        <div class="axis-side axis-side-right ${!domLeft ? 'dominant' : ''}">
          <span class="axis-pct">${rightPct}%</span>
          <span class="axis-label">${axis.rightLabel}</span>
          <span class="axis-code">${axis.right}</span>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

/* ────────── 외부 링크 (Firebase config) ────────── */

async function loadExternalLinks() {
  try {
    const snap   = await db.ref('/config').once('value');
    const config = snap.val() || {};
    const links  = Array.isArray(config.links) ? config.links : [];

    const container = document.getElementById('external-links');
    if (links.length === 0) return;

    links.forEach((item, i) => {
      if (!item.url) return;
      const a = document.createElement('a');
      a.href      = item.url;
      a.target    = '_blank';
      a.rel       = 'noopener noreferrer';
      a.className = `btn-link ${i === 0 ? 'btn-link-primary' : 'btn-link-secondary'}`;
      a.style.marginBottom = '10px';
      a.textContent = item.label || item.url;

      // 클릭 트래킹
      a.addEventListener('click', () => {
        try {
          const key   = (item.label || 'link').replace(/[.#$\[\]/]/g, '_');
          const today = getDateKey();
          const updates = {};
          updates[`stats/clicks/${key}/total`]           = firebase.database.ServerValue.increment(1);
          updates[`stats/clicks/${key}/byDate/${today}`] = firebase.database.ServerValue.increment(1);
          db.ref().update(updates);
        } catch (e) { /* ignore */ }
      });

      container.appendChild(a);
    });
  } catch (e) {
    // Firebase 미설정 시 무시
  }
}

/* ────────── 통계 기록 ────────── */

function getUserId() {
  let id = localStorage.getItem('lbt_user_id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
         ('u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    localStorage.setItem('lbt_user_id', id);
  }
  return id;
}

function trackStat(code) {
  try {
    const today   = getDateKey();
    const userId  = getUserId();
    const updates = {};
    updates[`stats/v2/byType/${code}`]                  = firebase.database.ServerValue.increment(1);
    updates[`stats/v2/byDate/${today}`]                 = firebase.database.ServerValue.increment(1);
    updates[`stats/v2/byTypeDate/${today}/${code}`]     = firebase.database.ServerValue.increment(1);
    updates['stats/v2/total']                           = firebase.database.ServerValue.increment(1);
    updates[`stats/v2/uniqueByDate/${today}/${userId}`] = true;
    db.ref().update(updates);
  } catch (e) {
    // 통계 기록 실패 시 무시
  }
}

/* ────────── 콘서트 홍보 영상 (YouTube) ────────── */

function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  // 이미 ID만 입력한 경우 (11자)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function loadConcertVideo() {
  const wrap      = document.getElementById('video-wrap');
  const container = document.getElementById('concert-video');
  if (!wrap || !container) return;
  try {
    const snap = await db.ref('/config/concertVideoUrl').once('value');
    const url  = snap.val();
    const id   = extractYouTubeId(url);
    if (!id) { container.hidden = true; return; }

    const iframe = document.createElement('iframe');
    iframe.src   = `https://www.youtube.com/embed/${id}?rel=0`;
    iframe.title = '콘서트 홍보 영상';
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;

    wrap.innerHTML = '';
    wrap.appendChild(iframe);
    container.hidden = false;
  } catch (e) {
    container.hidden = true;
  }
}

/* ────────── LIVE 카운터 ────────── */

function loadLiveCounter() {
  const container = document.getElementById('live-counter');
  if (!container) return;

  let initialized = false;
  let reservationCount = 0;

  // 예매자 수 (수동 입력 / config) — 단발성
  db.ref('/config/reservation').once('value').then(snap => {
    reservationCount = (snap.val() || {}).count || 0;
  }).catch(() => {});

  // 테스트 참여자 수 (legacy + v2) — 실시간 리스너
  db.ref('/stats').on('value', snap => {
    const stats = snap.val() || {};
    const testCount = (stats.total || 0) + (stats.v2 && stats.v2.total || 0);

    if (testCount < 1 && reservationCount < 1) {
      container.hidden = true;
      return;
    }
    container.hidden = false;

    if (!initialized) {
      animateCount('live-test-count',        testCount);
      animateCount('live-reservation-count', reservationCount);
      initialized = true;
    } else {
      // 이후 업데이트는 부드럽게 갱신만 (애니메이션 없이)
      document.getElementById('live-test-count').textContent =
        testCount.toLocaleString('ko-KR');
    }
  }, err => {
    container.hidden = true;
  });
}

function animateCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (target <= 0) {
    el.textContent = '0';
    return;
  }
  const duration = 800;
  const start    = performance.now();
  function tick(now) {
    const t      = Math.min((now - start) / duration, 1);
    const eased  = 1 - Math.pow(1 - t, 3);
    const value  = Math.round(target * eased);
    el.textContent = value.toLocaleString('ko-KR');
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ────────── 유틸 ────────── */

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ────────── 시작 ────────── */

init().catch(err => {
  console.error(err);
  loadingEl.innerHTML =
    '<p style="color:#E57373; font-size:14px">결과를 불러오지 못했습니다.<br>다시 시도해 주세요.</p>';
});
