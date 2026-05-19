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
let cachedStats      = {};       // legacy + v2 merged
let cachedClicks     = {};

/* ────────── 초기화 ────────── */

function initDashboard() {
  db.ref('/').on('value', (snapshot) => {
    const data     = snapshot.val() || {};
    const statsRaw = data.stats     || {};
    const v2       = statsRaw.v2    || {};

    // legacy + v2 — 응답 수는 머지된 byDate, 유형 분포는 비례 추정용으로 분리 보관
    cachedStats = {
      byDate:           mergeMaps(statsRaw.byDate || {}, v2.byDate || {}),
      legacyByDate:     statsRaw.byDate || {},
      legacyByType:     statsRaw.byType || {},
      v2ByDate:         v2.byDate       || {},
      v2ByType:         v2.byType       || {},
      uniqueByDate:     v2.uniqueByDate || {},
      referrersByDate:  v2.referrersByDate || {},
    };
    cachedClicks = statsRaw.clicks || {};

    renderAll();
    renderConfig(data.config || {});
    renderReservation(data.config || {});
    renderConcertVideo(data.config || {});
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

  // 예매자 수 저장 버튼
  const resBtn = document.getElementById('save-reservation-btn');
  if (resBtn) {
    resBtn.onclick = saveReservation;
  }

  // 영상 URL 저장 버튼
  const vidBtn = document.getElementById('save-video-btn');
  if (vidBtn) {
    vidBtn.onclick = saveConcertVideo;
  }

  // UTM 생성기 바인딩
  initUtmBuilder();

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
    // 사용자지정 모드로 강제 전환
    currentPeriod = 'custom';
    document.querySelectorAll('.period-btn-global').forEach(b => {
      b.classList.toggle('active', b.dataset.period === 'custom');
    });
    document.getElementById('custom-range').hidden = false;
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

function mergeMaps(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([k, v]) => {
    if (typeof v === 'number') out[k] = (out[k] || 0) + v;
    else out[k] = v;
  });
  return out;
}

function aggregateData() {
  const range        = getDateRange();
  const byDate       = cachedStats.byDate       || {};
  const legacyByDate = cachedStats.legacyByDate || {};
  const legacyByType = cachedStats.legacyByType || {};
  const v2ByDate     = cachedStats.v2ByDate     || {};
  const v2ByType     = cachedStats.v2ByType     || {};
  const uniqueByDate = cachedStats.uniqueByDate || {};
  const clicks       = cachedClicks;

  // 응답 수 (legacy + v2 머지된 byDate)
  const participantsByDate = {};
  let responseTotal        = 0;
  Object.entries(byDate).forEach(([date, cnt]) => {
    if (inRange(date, range)) {
      participantsByDate[date] = (participantsByDate[date] || 0) + cnt;
      responseTotal += cnt;
    }
  });

  // 유형별 분포 — 비례 추정
  // legacy/v2 각각: 해당 기간에 들어온 응답 수 × (유형 누적 / 전체 누적)
  const typeCounts = {};

  const legacyTotal = Object.values(legacyByType).reduce((s, n) => s + n, 0);
  const v2Total     = Object.values(v2ByType).reduce((s, n) => s + n, 0);

  let legacyInRange = 0;
  Object.entries(legacyByDate).forEach(([date, cnt]) => {
    if (inRange(date, range)) legacyInRange += cnt;
  });
  let v2InRange = 0;
  Object.entries(v2ByDate).forEach(([date, cnt]) => {
    if (inRange(date, range)) v2InRange += cnt;
  });

  if (legacyTotal > 0 && legacyInRange > 0) {
    const ratio = legacyInRange / legacyTotal;
    Object.entries(legacyByType).forEach(([code, cnt]) => {
      typeCounts[code] = (typeCounts[code] || 0) + cnt * ratio;
    });
  }
  if (v2Total > 0 && v2InRange > 0) {
    const ratio = v2InRange / v2Total;
    Object.entries(v2ByType).forEach(([code, cnt]) => {
      typeCounts[code] = (typeCounts[code] || 0) + cnt * ratio;
    });
  }

  // 반올림 + 0 제거
  Object.keys(typeCounts).forEach(code => {
    typeCounts[code] = Math.round(typeCounts[code]);
    if (typeCounts[code] === 0) delete typeCounts[code];
  });

  // 고유 참여자 (v2-only)
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

  // 유입 경로 집계
  const referrersByDate = cachedStats.referrersByDate || {};
  const referrerCounts  = {};
  let   referrerTotal   = 0;
  Object.entries(referrersByDate).forEach(([date, sources]) => {
    if (!inRange(date, range)) return;
    Object.entries(sources || {}).forEach(([src, cnt]) => {
      referrerCounts[src] = (referrerCounts[src] || 0) + cnt;
      referrerTotal      += cnt;
    });
  });

  return {
    range, responseTotal, uniqueCount, participantsByDate, typeCounts,
    clickTotal, clicksByDate, clickRows,
    referrerCounts, referrerTotal,
  };
}

/* ────────── 전체 렌더 ────────── */

function renderAll() {
  const agg = aggregateData();
  renderPeriodInfo(agg.range);
  renderStatCards(agg);
  renderTypeTable(agg.typeCounts, agg.responseTotal);
  renderTypeChart(agg.typeCounts);
  renderClickTable(agg.clickRows, agg.responseTotal);
  renderReferrerTable(agg.referrerCounts, agg.referrerTotal);
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
        <td>${cnt.toLocaleString('ko-KR')} / ${total.toLocaleString('ko-KR')}</td>
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

/* ────────── 유입 경로 표 ────────── */

const REFERRER_LABELS = {
  direct:    '직접 / 북마크',
  kakao:     '카카오톡',
  naver:     '네이버',
  google:    '구글',
  instagram: '인스타그램',
  facebook:  '페이스북',
  youtube:   '유튜브',
  twitter:   '트위터 / X',
  threads:   '스레드',
  tiktok:    '틱톡',
  daum:      '다음',
  bing:      '빙',
  linkedin:  '링크드인',
  unknown:   '알 수 없음',
};

function formatReferrerLabel(key) {
  if (REFERRER_LABELS[key]) return REFERRER_LABELS[key];
  if (key.startsWith('utm_')) return 'UTM: ' + key.slice(4);
  return key.replace(/_/g, '.');
}

function renderReferrerTable(counts, total) {
  const tbody = document.getElementById('referrer-table-body');
  if (!tbody) return;

  const rows = Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#7A6A58;padding:20px;">기간 내 유입 데이터 없음</td></tr>';
    return;
  }

  const maxCount = rows[0][1];

  tbody.innerHTML = rows.map(([key, cnt]) => {
    const pct      = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';
    const barWidth = Math.round((cnt / maxCount) * 100);
    return `<tr>
      <td>${formatReferrerLabel(key)}</td>
      <td>${cnt.toLocaleString('ko-KR')}</td>
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

  // 기존 reservation 값을 보존하면서 links만 갱신
  db.ref('/config/links').set(links)
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

/* ────────── 예매자 수 (LIVE 카운터) ────────── */

function renderReservation(config) {
  const input = document.getElementById('reservation-input');
  if (!input) return;
  if (document.activeElement === input) return; // 입력 중이면 덮어쓰지 않음
  const count = (config.reservation && config.reservation.count) || 0;
  input.value = count;
}

function saveReservation() {
  const input = document.getElementById('reservation-input');
  const btn   = document.getElementById('save-reservation-btn');
  const msg   = document.getElementById('reservation-save-msg');
  const count = Math.max(0, parseInt(input.value, 10) || 0);

  btn.disabled = true;
  db.ref('/config/reservation').set({
    count,
    lastUpdate: firebase.database.ServerValue.TIMESTAMP,
  })
    .then(() => {
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 2500);
    })
    .catch((err) => {
      alert('저장 실패: ' + err.message);
    })
    .finally(() => {
      btn.disabled = false;
    });
}

/* ────────── 콘서트 영상 URL ────────── */

function renderConcertVideo(config) {
  const input = document.getElementById('video-url-input');
  if (!input) return;
  if (document.activeElement === input) return; // 입력 중이면 덮어쓰지 않음
  input.value = config.concertVideoUrl || '';
}

function saveConcertVideo() {
  const input = document.getElementById('video-url-input');
  const btn   = document.getElementById('save-video-btn');
  const msg   = document.getElementById('video-save-msg');
  const url   = input.value.trim();

  btn.disabled = true;
  db.ref('/config/concertVideoUrl').set(url || null)
    .then(() => {
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 2500);
    })
    .catch((err) => {
      alert('저장 실패: ' + err.message);
    })
    .finally(() => {
      btn.disabled = false;
    });
}

/* ────────── UTM 마케팅 링크 생성기 ────────── */

const UTM_BASE_URL = 'https://test.kkkstudio.com/';

function initUtmBuilder() {
  const select       = document.getElementById('utm-source-select');
  const customRow    = document.getElementById('utm-custom-row');
  const customInput  = document.getElementById('utm-custom-input');
  const campaignInput= document.getElementById('utm-campaign-input');
  const previewEl    = document.getElementById('utm-preview-url');
  const copyBtn      = document.getElementById('utm-copy-btn');
  const copyMsg      = document.getElementById('utm-copy-msg');
  if (!select || !previewEl || !copyBtn) return;

  function sanitize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40);
  }

  function update() {
    const isCustom = select.value === '__custom__';
    customRow.hidden = !isCustom;

    const rawSource = isCustom ? customInput.value : select.value;
    const source    = sanitize(rawSource);
    const campaign  = sanitize(campaignInput.value);

    if (!source) {
      previewEl.textContent = UTM_BASE_URL;
      return;
    }

    const params = new URLSearchParams();
    params.set('utm_source', source);
    if (campaign) params.set('utm_campaign', campaign);
    previewEl.textContent = `${UTM_BASE_URL}?${params.toString()}`;
  }

  select.addEventListener('change', update);
  customInput.addEventListener('input', update);
  campaignInput.addEventListener('input', update);

  copyBtn.addEventListener('click', async () => {
    const url = previewEl.textContent;
    try {
      await navigator.clipboard.writeText(url);
      copyMsg.hidden = false;
      setTimeout(() => { copyMsg.hidden = true; }, 2000);
    } catch (e) {
      // 폴백: textarea 선택
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      copyMsg.hidden = false;
      setTimeout(() => { copyMsg.hidden = true; }, 2000);
    }
  });

  update();
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
