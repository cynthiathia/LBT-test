/* ────────── 상수 ────────── */

/* ADMIN_PASSWORD 는 admin-config.js (gitignore) 에서 로드됩니다 */

const TYPE_NAMES = {
  PSRJ: '마음속 편집장',
  PSRM: '조용한 응원자',
  PSCJ: '침묵의 개척자',
  PSCM: '고요한 수호자',
  PARJ: '따뜻한 심판관',
  PARM: '봄날의 동반자',
  PACJ: '온화한 결단자',
  PACM: '고요한 창조자',
  ESRJ: '열정적인 중재자',
  ESRM: '다정한 이야기꾼',
  ESCJ: '당찬 선언자',
  ESCM: '빛나는 탐험가',
  EARJ: '활기찬 안내자',
  EARM: '포근한 격려자',
  EACJ: '열정적인 건축가',
  EACM: '언어의 연금술사',
};

/* ────────── DOM 참조 ────────── */

const loginWrap  = document.getElementById('login-wrap');
const dashboard  = document.getElementById('dashboard');
const loginForm  = document.getElementById('login-form');
const pwInput    = document.getElementById('pw-input');
const pwError    = document.getElementById('pw-error');
const logoutBtn  = document.getElementById('logout-btn');

/* ────────── 인증 ────────── */

function showDashboard() {
  loginWrap.style.display = 'none';
  dashboard.removeAttribute('hidden');
  dashboard.style.display = 'block';
  // hidden 속성 제거 후 브라우저가 레이아웃을 계산할 시간을 준 뒤 차트 초기화
  requestAnimationFrame(() => requestAnimationFrame(() => initDashboard()));
}

function showLogin() {
  dashboard.style.display = 'none';
  loginWrap.style.display = 'flex';
  pwInput.value = '';
  sessionStorage.removeItem('lbt_admin');
}

// 초기 상태: 대시보드 숨김
dashboard.style.display = 'none';

// 세션 유지
if (sessionStorage.getItem('lbt_admin') === '1') {
  showDashboard();
}

function tryLogin() {
  const entered = pwInput.value;
  console.log('입력값:', entered, '/ 길이:', entered.length);
  if (entered === ADMIN_PASSWORD) {
    sessionStorage.setItem('lbt_admin', '1');
    pwError.hidden = true;
    showDashboard();
  } else {
    pwError.hidden = false;
    pwInput.value = '';
    pwInput.focus();
  }
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  tryLogin();
});

document.getElementById('login-btn').addEventListener('click', (e) => {
  e.preventDefault();
  tryLogin();
});

logoutBtn.addEventListener('click', showLogin);

/* ────────── 대시보드 초기화 ────────── */

let trendChart = null;
let typeChart  = null;
let configSaveHandler = null;
let currentPeriod     = '14';
let cachedByDate      = {};
let cachedClicksByDate = {};
let cachedTotal       = 0;
let cachedTodayCount  = 0;

function initDashboard() {
  // Firebase 실시간 리스너
  db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    renderStats(data.stats || {});
    renderConfig(data.config || {});
    updateTimestamp();
  }, (err) => {
    console.error('Firebase 읽기 오류:', err);
    alert('Firebase 연결에 실패했습니다.\nfirebase-config.js 설정을 확인해 주세요.');
  });

  // 링크 저장 버튼 (중복 등록 방지)
  const saveBtn = document.getElementById('save-config-btn');
  if (configSaveHandler) saveBtn.removeEventListener('click', configSaveHandler);
  configSaveHandler = saveConfig;
  saveBtn.addEventListener('click', configSaveHandler);

  // 기간 필터 버튼
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      renderTrendChart(cachedByDate, cachedClicksByDate);
    });
  });
}

/* ────────── 통계 렌더링 ────────── */

function renderStats(stats) {
  const total  = stats.total  || 0;
  const byType = stats.byType || {};
  const byDate = stats.byDate || {};
  const clicks = stats.clicks || {};

  const today      = getDateKey();
  const todayCount = byDate[today] || 0;

  cachedByDate     = byDate;
  cachedTotal      = total;
  cachedTodayCount = todayCount;

  document.getElementById('total-count').textContent = total.toLocaleString('ko-KR');
  document.getElementById('today-count').textContent = todayCount.toLocaleString('ko-KR');

  // 최다 / 최소 유형
  const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  if (sortedTypes.length > 0) {
    const [topCode, topVal] = sortedTypes[0];
    const [botCode, botVal] = sortedTypes[sortedTypes.length - 1];
    document.getElementById('top-type').textContent =
      `${topCode}\n${TYPE_NAMES[topCode] || ''} (${topVal.toLocaleString('ko-KR')}명)`;
    document.getElementById('bottom-type').textContent =
      `${botCode}\n${TYPE_NAMES[botCode] || ''} (${botVal.toLocaleString('ko-KR')}명)`;
  }

  // 클릭 통계 집계
  let totalClicks = 0;
  let todayClicks = 0;
  const clicksByDate = {};
  const clickRows    = [];

  Object.entries(clicks).forEach(([key, data]) => {
    const linkTotal = data.total || 0;
    const linkToday = (data.byDate || {})[today] || 0;
    totalClicks += linkTotal;
    todayClicks += linkToday;
    Object.entries(data.byDate || {}).forEach(([date, cnt]) => {
      clicksByDate[date] = (clicksByDate[date] || 0) + cnt;
    });
    clickRows.push({ key, total: linkTotal, today: linkToday });
  });

  cachedClicksByDate = clicksByDate;

  const ctr      = total     > 0 ? ((totalClicks / total)     * 100).toFixed(1) + '%' : '—';
  const todayCtr = todayCount > 0 ? ((todayClicks / todayCount) * 100).toFixed(1) + '%' : '—';

  document.getElementById('total-clicks').textContent = totalClicks.toLocaleString('ko-KR');
  document.getElementById('click-ctr').textContent    = ctr;
  document.getElementById('today-clicks').textContent = todayClicks.toLocaleString('ko-KR');
  document.getElementById('today-ctr').textContent    = todayCtr;

  renderClickTable(clickRows, total);
  renderTypeTable(byType, total);
  renderTypeChart(byType);
  renderTrendChart(byDate, clicksByDate);
}

/* ────────── 유형 테이블 ────────── */

function renderTypeTable(byType, total) {
  const rows = Object.keys(TYPE_NAMES)
    .map(code => ({ code, name: TYPE_NAMES[code], count: byType[code] || 0 }))
    .sort((a, b) => b.count - a.count);

  const maxCount = rows[0]?.count || 1;

  document.getElementById('type-table-body').innerHTML = rows.map(({ code, name, count }) => {
    const pct      = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    const barWidth = Math.round((count / maxCount) * 100);
    return `<tr>
      <td>${code}</td>
      <td>${name}</td>
      <td>${count.toLocaleString('ko-KR')}</td>
      <td>
        <div class="pct-bar-wrap">
          <div class="pct-bar-track">
            <div class="pct-bar" style="width:${barWidth}%"></div>
          </div>
          <span class="pct-text">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ────────── 유형 분포 차트 ────────── */

function renderTypeChart(byType) {
  const labels = Object.keys(TYPE_NAMES);
  const data   = labels.map(code => byType[code] || 0);

  const ctx = document.getElementById('type-chart').getContext('2d');
  if (typeChart) typeChart.destroy();

  typeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(201,169,110,0.65)',
        borderColor:     'rgba(201,169,110,1)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].label} — ${TYPE_NAMES[items[0].label] || ''}`,
            label: (item)  => ` ${item.raw.toLocaleString('ko-KR')}명`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#7A6A58', font: { size: 10, family: "'Noto Sans KR'" } },
          grid:  { color: 'rgba(201,169,110,0.07)' },
        },
        y: {
          ticks: { color: '#7A6A58', font: { size: 11 } },
          grid:  { color: 'rgba(201,169,110,0.07)' },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ────────── 링크 클릭 테이블 ────────── */

function renderClickTable(clickRows, total) {
  const tbody = document.getElementById('click-table-body');
  if (!tbody) return;

  if (clickRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#7A6A58;padding:20px;">클릭 데이터 없음</td></tr>';
    return;
  }

  tbody.innerHTML = clickRows
    .sort((a, b) => b.total - a.total)
    .map(({ key, total: cnt, today: todayCnt }) => {
      const ctr      = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';
      const barWidth = Math.min(parseFloat(ctr) * 2, 100);
      const label    = key.replace(/_/g, ' ');
      return `<tr>
        <td>${label}</td>
        <td>${cnt.toLocaleString('ko-KR')}</td>
        <td>${todayCnt.toLocaleString('ko-KR')}</td>
        <td>
          <div class="pct-bar-wrap">
            <div class="pct-bar-track">
              <div class="pct-bar" style="width:${barWidth}%;background:#81C784"></div>
            </div>
            <span class="pct-text">${ctr}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');
}

/* ────────── 일별 추이 차트 ────────── */

function renderTrendChart(byDate, byClickDate = {}) {
  const days        = [];
  const counts      = [];
  const clickCounts = [];

  if (currentPeriod === 'monthly') {
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      days.push(monthKey.slice(5) + '월');
      let mTotal = 0, mClicks = 0;
      Object.entries(byDate).forEach(([date, cnt]) => {
        if (date.startsWith(monthKey)) mTotal += cnt;
      });
      Object.entries(byClickDate).forEach(([date, cnt]) => {
        if (date.startsWith(monthKey)) mClicks += cnt;
      });
      counts.push(mTotal);
      clickCounts.push(mClicks);
    }
  } else {
    const numDays = parseInt(currentPeriod) || 14;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      days.push(key.slice(5).replace('-', '/'));
      counts.push(byDate[key] || 0);
      clickCounts.push(byClickDate[key] || 0);
    }
  }

  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: '참여자 수',
          data: counts,
          borderColor:          '#C9A96E',
          backgroundColor:      'rgba(201,169,110,0.08)',
          pointBackgroundColor: '#C9A96E',
          pointBorderColor:     '#0F0E0C',
          pointBorderWidth:     2,
          pointRadius:          5,
          pointHoverRadius:     7,
          tension: 0.35,
          fill: true,
        },
        {
          label: '링크 클릭',
          data: clickCounts,
          borderColor:          '#81C784',
          backgroundColor:      'rgba(129,199,132,0.06)',
          pointBackgroundColor: '#81C784',
          pointBorderColor:     '#0F0E0C',
          pointBorderWidth:     2,
          pointRadius:          4,
          pointHoverRadius:     6,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#7A6A58', font: { size: 12, family: "'Noto Sans KR'" }, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw.toLocaleString('ko-KR')}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#7A6A58', font: { size: 11 } },
          grid:  { color: 'rgba(201,169,110,0.07)' },
        },
        y: {
          ticks: { color: '#7A6A58', font: { size: 11 } },
          grid:  { color: 'rgba(201,169,110,0.07)' },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ────────── 링크 설정 ────────── */

const linkRowsEl = document.getElementById('link-rows');
const addLinkBtn = document.getElementById('add-link-btn');

function createLinkRow(label = '', url = '') {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text"  class="link-label" placeholder="버튼 텍스트" value="${escapeAttr(label)}">
    <input type="url"   class="link-url"   placeholder="https://..." value="${escapeAttr(url)}">
    <button class="btn-delete-link" title="삭제">×</button>
  `;
  row.querySelector('.btn-delete-link').addEventListener('click', () => row.remove());
  return row;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

addLinkBtn.addEventListener('click', () => {
  linkRowsEl.appendChild(createLinkRow());
  linkRowsEl.lastElementChild.querySelector('.link-label').focus();
});

function renderConfig(config) {
  linkRowsEl.innerHTML = '';
  const links = Array.isArray(config.links) ? config.links : [];

  // 저장된 링크가 없으면 기본 행 2개
  if (links.length === 0) {
    linkRowsEl.appendChild(createLinkRow('콘서트 예매', ''));
    linkRowsEl.appendChild(createLinkRow('신간 구매', ''));
  } else {
    links.forEach(({ label, url }) => linkRowsEl.appendChild(createLinkRow(label, url)));
  }
}

function saveConfig() {
  const rows  = linkRowsEl.querySelectorAll('.link-row');
  const links = Array.from(rows).map(row => ({
    label: row.querySelector('.link-label').value.trim(),
    url:   row.querySelector('.link-url').value.trim(),
  })).filter(item => item.label || item.url);

  const saveMsg = document.getElementById('save-msg');
  const saveBtn = document.getElementById('save-config-btn');

  saveBtn.disabled = true;

  db.ref('/config').set({ links })
    .then(() => {
      saveMsg.hidden = false;
      setTimeout(() => { saveMsg.hidden = true; }, 2500);
    })
    .catch((err) => {
      alert('저장 실패: ' + err.message);
    })
    .finally(() => {
      saveBtn.disabled = false;
    });
}

/* ────────── 유틸 ────────── */

function getDateKey(date = new Date()) {
  // YYYY-MM-DD (로컬 시간 기준)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updateTimestamp() {
  document.getElementById('last-updated').textContent =
    `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
}
