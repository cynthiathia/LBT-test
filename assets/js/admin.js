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
  requestAnimationFrame(() => requestAnimationFrame(() => initDashboard()));
}

function showLogin() {
  dashboard.style.display = 'none';
  loginWrap.style.display = 'flex';
  pwInput.value = '';
  sessionStorage.removeItem('lbt_admin');
}

dashboard.style.display = 'none';

if (sessionStorage.getItem('lbt_admin') === '1') {
  showDashboard();
}

function tryLogin() {
  const entered = pwInput.value;
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

loginForm.addEventListener('submit', (e) => { e.preventDefault(); tryLogin(); });
document.getElementById('login-btn').addEventListener('click', (e) => { e.preventDefault(); tryLogin(); });
logoutBtn.addEventListener('click', showLogin);

/* ────────── 대시보드 상태 ────────── */

let trendChart = null;
let typeChart  = null;
let configSaveHandler = null;

let currentPeriod    = '30';     // 'day' | '7' | '30' | 'monthly' | 'custom'
let customStart      = null;     // 'YYYY-MM-DD'
let customEnd        = null;
let cachedStatsV2    = {};
let cachedClicks     = {};

/* ────────── 초기화 ────────── */

function initDashboard() {
  db.ref('/').on('value', (snapshot) => {
    const data  = snapshot.val() || {};
    const stats = data.stats   || {};
    cachedStatsV2 = stats.v2     || {};
    cachedClicks  = stats.clicks || {};
    renderAll();
    renderConfig(data.config || {});
    updateTimestamp();
  }, (err) => {
    console.error('Firebase 읽기 오류:', err);
    alert('Firebase 연결에 실패했습니다.\nfirebase-config.js 설정을 확인해 주세요.');
  });

  // 링크 저장 버튼
  const saveBtn = document.getElementById('save-config-btn');
  if (configSaveHandler) saveBtn.removeEventListener('click', configSaveHandler);
  configSaveHandler = saveConfig;
  saveBtn.addEventListener('click', configSaveHandler);

  // 글로벌 기간 필터 버튼
  document.querySelectorAll('.period-btn-global').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn-global').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      const customRange = document.getElementById('custom-range');
      if (currentPeriod === 'custom') {
        customRange.hidden = false;
        if (!customStart) {
          const today = new Date();
          const ago   = new Date(); ago.setDate(today.getDate() - 6);
          customStart = getDateKey(ago);
          customEnd   = getDateKey(today);
          document.getElementById('custom-start').value = customStart;
          document.getElementById('custom-end').value   = customEnd;
        }
      } else {
        customRange.hidden = true;
      }
      renderAll();
    });
  });

  // 사용자지정 적용
  document.getElementById('custom-apply').addEventListener('click', () => {
    const s = document.getElementById('custom-start').value;
    const e = document.getElementById('custom-end').value;
    if (!s || !e) return;
    if (s > e) { alert('시작일이 종료일보다 늦을 수 없습니다.'); return; }
    customStart = s;
    customEnd   = e;
    renderAll();
  });
}

/* ────────── 기간 범위 계산 ────────── */

function getDateRange() {
  const today = new Date();
  const todayKey = getDateKey(today);

  if (currentPeriod === 'day') {
    return { start: todayKey, end: todayKey, days: 1, mode: 'day' };
  }
  if (currentPeriod === '7' || currentPeriod === '30') {
    const num = parseInt(currentPeriod);
    const s = new Date(today); s.setDate(today.getDate() - (num - 1));
    return { start: getDateKey(s), end: todayKey, days: num, mode: 'day' };
  }
  if (currentPeriod === 'monthly') {
    const s = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { start: getDateKey(s), end: todayKey, days: daysBetween(s, today) + 1, mode: 'monthly' };
  }
  if (currentPeriod === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd, days: dateKeyDiff(customStart, customEnd) + 1, mode: 'day' };
  }
  // fallback
  return { start: todayKey, end: todayKey, days: 1, mode: 'day' };
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

function dateKeyDiff(s, e) {
  return daysBetween(new Date(s), new Date(e));
}

function inRange(dateKey, range) {
  return dateKey >= range.start && dateKey <= range.end;
}

/* ────────── 데이터 집계 ────────── */

function aggregateData() {
  const range        = getDateRange();
  const byDate       = cachedStatsV2.byDate       || {};
  const byTypeDate   = cachedStatsV2.byTypeDate   || {};
  const uniqueByDate = cachedStatsV2.uniqueByDate || {};
  const clicks       = cachedClicks;

  // 응답 수 일별 집계
  const participantsByDate = {};
  let responseTotal        = 0;
  Object.entries(byDate).forEach(([date, cnt]) => {
    if (inRange(date, range)) {
      participantsByDate[date] = (participantsByDate[date] || 0) + cnt;
      responseTotal += cnt;
    }
  });

  // 유형별 집계 (byTypeDate 기반)
  const typeCounts = {};
  Object.entries(byTypeDate).forEach(([date, types]) => {
    if (!inRange(date, range)) return;
    Object.entries(types).forEach(([code, cnt]) => {
      typeCounts[code] = (typeCounts[code] || 0) + cnt;
    });
  });

  // 고유 참여자 집계 (uniqueByDate 기반, userId 합집합)
  const uniqueUsers = new Set();
  Object.entries(uniqueByDate).forEach(([date, users]) => {
    if (!inRange(date, range)) return;
    Object.keys(users || {}).forEach(uid => uniqueUsers.add(uid));
  });
  const uniqueCount = uniqueUsers.size;

  // 클릭 집계
  const clicksByDate = {};
  let clickTotal     = 0;
  const clickRows    = [];
  Object.entries(clicks).forEach(([linkKey, data]) => {
    let linkPeriodTotal = 0;
    Object.entries(data.byDate || {}).forEach(([date, cnt]) => {
      if (inRange(date, range)) {
        clicksByDate[date] = (clicksByDate[date] || 0) + cnt;
        linkPeriodTotal   += cnt;
        clickTotal        += cnt;
      }
    });
    clickRows.push({ key: linkKey, total: linkPeriodTotal });
  });

  return { range, responseTotal, uniqueCount, participantsByDate, typeCounts, clickTotal, clicksByDate, clickRows };
}

/* ────────── 전체 렌더 ────────── */

function renderAll() {
  const agg = aggregateData();
  renderPeriodInfo(agg.range);
  renderStatCards(agg);
  renderTypeTable(agg.typeCounts, agg.responseTotal);
  renderTypeChart(agg.typeCounts);
  renderClickTable(agg.clickRows, agg.responseTotal);
  renderTrendChart(agg);
}

function renderPeriodInfo(range) {
  const el = document.getElementById('period-info');
  if (!el) return;
  if (range.start === range.end) {
    el.textContent = `${range.start} (${range.days}일)`;
  } else {
    el.textContent = `${range.start} ~ ${range.end} (${range.days}일)`;
  }
}

/* ────────── 통계 카드 ────────── */

function renderStatCards(agg) {
  const { responseTotal, uniqueCount, typeCounts, clickTotal, range } = agg;

  document.getElementById('period-responses').textContent     = responseTotal.toLocaleString('ko-KR');
  document.getElementById('period-unique-users').textContent  = uniqueCount.toLocaleString('ko-KR');

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const [topCode, topVal] = sorted[0];
    const [botCode, botVal] = sorted[sorted.length - 1];
    document.getElementById('period-top-type').textContent =
      `${topCode}\n${TYPE_NAMES[topCode] || ''} (${topVal.toLocaleString('ko-KR')}명)`;
    document.getElementById('period-bottom-type').textContent =
      `${botCode}\n${TYPE_NAMES[botCode] || ''} (${botVal.toLocaleString('ko-KR')}명)`;
  } else {
    document.getElementById('period-top-type').textContent    = '데이터 없음';
    document.getElementById('period-bottom-type').textContent = '데이터 없음';
  }

  const avgResponses = range.days > 0 ? (responseTotal / range.days).toFixed(1) : '0';
  document.getElementById('period-avg-responses').textContent = avgResponses;

  document.getElementById('period-clicks').textContent = clickTotal.toLocaleString('ko-KR');

  const ctr = responseTotal > 0
    ? ((clickTotal / responseTotal) * 100).toFixed(1) + '%'
    : '—';
  document.getElementById('period-ctr').textContent = ctr;

  const avgClicks = range.days > 0 ? (clickTotal / range.days).toFixed(1) : '0';
  document.getElementById('period-avg-clicks').textContent = avgClicks;
}

/* ────────── 유형 테이블 ────────── */

function renderTypeTable(typeCounts, total) {
  const rows = Object.keys(TYPE_NAMES)
    .map(code => ({ code, name: TYPE_NAMES[code], count: typeCounts[code] || 0 }))
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

function renderTypeChart(typeCounts) {
  const labels = Object.keys(TYPE_NAMES);
  const data   = labels.map(code => typeCounts[code] || 0);

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

  const filtered = clickRows.filter(r => r.total > 0);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#7A6A58;padding:20px;">기간 내 클릭 데이터 없음</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .sort((a, b) => b.total - a.total)
    .map(({ key, total: cnt }) => {
      const ctr      = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';
      const barWidth = Math.min(parseFloat(ctr) * 2, 100);
      const label    = key.replace(/_/g, ' ');
      return `<tr>
        <td>${label}</td>
        <td>${cnt.toLocaleString('ko-KR')}</td>
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

function renderTrendChart(agg) {
  const { range, participantsByDate, clicksByDate } = agg;
  const labels      = [];
  const counts      = [];
  const clickCounts = [];

  if (range.mode === 'monthly') {
    // 최근 6개월 월별 집계
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(monthKey.slice(5) + '월');
      let mTotal = 0, mClicks = 0;
      Object.entries(participantsByDate).forEach(([date, cnt]) => {
        if (date.startsWith(monthKey)) mTotal += cnt;
      });
      Object.entries(clicksByDate).forEach(([date, cnt]) => {
        if (date.startsWith(monthKey)) mClicks += cnt;
      });
      counts.push(mTotal);
      clickCounts.push(mClicks);
    }
  } else {
    // 일별
    const start = new Date(range.start);
    const end   = new Date(range.end);
    const days  = daysBetween(start, end) + 1;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = getDateKey(d);
      labels.push(key.slice(5).replace('-', '/'));
      counts.push(participantsByDate[key] || 0);
      clickCounts.push(clicksByDate[key] || 0);
    }
  }

  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updateTimestamp() {
  document.getElementById('last-updated').textContent =
    `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
}
