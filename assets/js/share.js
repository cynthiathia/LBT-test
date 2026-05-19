/* ────────── 공유 기능 ────────── */

const BASE_URL   = window.location.origin + window.location.pathname.replace('result.html', '');
const resultUrl  = window.location.href;

/* 사용자 자발 공유 URL에 utm_source 자동 부착 */
function withUtm(url, source) {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('utm_source', source);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_source=${encodeURIComponent(source)}`;
  }
}

/* ── 링크 복사 ── */

document.getElementById('btn-copy').addEventListener('click', async () => {
  const shareUrl = withUtm(resultUrl, 'user_link');
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('링크가 복사되었습니다!');
  } catch {
    prompt('아래 링크를 복사하세요:', shareUrl);
  }
});

/* ── 이미지 저장 (html2canvas) ── */

document.getElementById('btn-download').addEventListener('click', async () => {
  const btn = document.getElementById('btn-download');
  btn.textContent = '저장 중...';
  btn.disabled    = true;

  try {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bgColor = isLight ? '#FAF6F0' : '#0F0E0C';

    const opts = {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
      allowTaint: true,
    };

    // 캡처할 영역들 (순서대로 위→아래)
    const sections = [
      document.getElementById('capture-area'),
      document.getElementById('cta-section'),
      document.getElementById('axes-section'),
    ].filter(Boolean);

    const canvases = [];
    for (const el of sections) {
      canvases.push(await html2canvas(el, opts));
    }

    // 세로 합성 (가로폭은 최댓값, 작은 캔버스는 가운데 정렬)
    const width  = Math.max(...canvases.map(c => c.width));
    const height = canvases.reduce((s, c) => s + c.height, 0);
    const merged = document.createElement('canvas');
    merged.width  = width;
    merged.height = height;
    const ctx = merged.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    let y = 0;
    for (const c of canvases) {
      ctx.drawImage(c, (width - c.width) / 2, y);
      y += c.height;
    }

    const link      = document.createElement('a');
    link.download   = `LBT_${typeCode}_결과.png`;
    link.href       = merged.toDataURL('image/png');
    link.click();
  } catch (e) {
    alert('이미지 저장에 실패했습니다. 스크린샷을 사용해 주세요.');
  } finally {
    btn.innerHTML = '<span class="share-btn-icon">📷</span><span>이미지 저장</span>';
    btn.disabled  = false;
  }
});

/* ── 카카오 공유 ── */

document.getElementById('btn-kakao').addEventListener('click', () => {
  const KAKAO_KEY = 'c169ee8b4f3d73cd5221af560ff6d94b';

  if (!window.Kakao?.isInitialized()) {
    window.Kakao.init(KAKAO_KEY);
  }

  const typeNameEl = document.getElementById('result-type-name');
  const typeName   = typeNameEl ? typeNameEl.textContent : '';
  const featuresEl = document.querySelector('#result-features li');
  const firstFeat  = featuresEl ? featuresEl.textContent : '';

  const imgUrl       = `${window.location.origin}/type_img/${typeCode}.png`;
  const sharedResult = withUtm(resultUrl, 'user_kakao');
  const sharedIntro  = withUtm(`${BASE_URL}index.html`, 'user_kakao');

  const doShare = (w, h) => {
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `나는 ${typeName} (${typeCode})형입니다`,
        description: firstFeat,
        imageUrl: imgUrl,
        imageWidth:  w,
        imageHeight: h,
        link: {
          mobileWebUrl: sharedResult,
          webUrl:       sharedResult,
        },
      },
      buttons: [
        {
          title: '나도 테스트하기',
          link: { mobileWebUrl: sharedIntro, webUrl: sharedIntro },
        },
      ],
    });
  };

  const probe = new Image();
  probe.onload  = () => doShare(probe.naturalWidth, probe.naturalHeight);
  probe.onerror = () => doShare(1200, 1200);
  probe.src = imgUrl;
});

/* ── 토스트 메시지 ── */

function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '32px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   '#C9A96E',
    color:        '#1A1410',
    padding:      '12px 24px',
    borderRadius: '100px',
    fontSize:     '14px',
    fontWeight:   '600',
    zIndex:       '9999',
    animation:    'fadeIn 0.3s ease',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}
