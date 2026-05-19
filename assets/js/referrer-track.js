/* ────────── 유입 경로 추적 ──────────
   - URL UTM 파라미터 우선
   - 없으면 document.referrer 도메인 분류
   - 세션 1회만 기록 (sessionStorage)
   - Firebase: stats/v2/referrers/{source}, referrersByDate/{date}/{source}
*/

(function () {
  if (typeof db === 'undefined' || typeof firebase === 'undefined') return;
  if (sessionStorage.getItem('lbt_referrer_tracked')) return;

  const source = classifyReferrer();
  if (!source) return; // 내부 이동이면 기록 X

  const today = getTodayKey();
  const safe  = source.replace(/[.#$\[\]/]/g, '_').slice(0, 60);

  const updates = {};
  updates[`stats/v2/referrers/${safe}`]                 = firebase.database.ServerValue.increment(1);
  updates[`stats/v2/referrersByDate/${today}/${safe}`]  = firebase.database.ServerValue.increment(1);

  db.ref().update(updates).catch(() => {});
  sessionStorage.setItem('lbt_referrer_tracked', '1');

  function classifyReferrer() {
    // 1) UTM 우선
    try {
      const params = new URLSearchParams(window.location.search);
      const utm    = params.get('utm_source');
      if (utm) return 'utm_' + utm.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
    } catch (e) { /* ignore */ }

    // 2) referrer
    const ref = document.referrer;
    if (!ref) return 'direct';

    let host;
    try { host = new URL(ref).hostname.toLowerCase(); } catch (e) { return 'unknown'; }

    // 내부 이동(같은 도메인)은 무시
    if (host === window.location.hostname) return null;

    // 알려진 플랫폼 매핑
    if (/kakao/.test(host))                  return 'kakao';
    if (/naver/.test(host))                  return 'naver';
    if (/(^|\.)google\./.test(host))         return 'google';
    if (/instagram/.test(host))              return 'instagram';
    if (/facebook|fb\.com/.test(host))       return 'facebook';
    if (/youtube|youtu\.be/.test(host))      return 'youtube';
    if (/twitter|x\.com|t\.co/.test(host))   return 'twitter';
    if (/threads/.test(host))                return 'threads';
    if (/tiktok/.test(host))                 return 'tiktok';
    if (/daum/.test(host))                   return 'daum';
    if (/bing/.test(host))                   return 'bing';
    if (/linkedin/.test(host))               return 'linkedin';

    // 그 외 도메인은 호스트명 그대로
    return host;
  }

  function getTodayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
})();
