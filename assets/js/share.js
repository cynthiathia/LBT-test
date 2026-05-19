/* ────────── 공유 기능 ────────── */

const BASE_URL   = window.location.origin + window.location.pathname.replace('result.html', '');
const resultUrl  = window.location.href;

/* ── 링크 복사 ── */

document.getElementById('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultUrl);
    showToast('링크가 복사되었습니다!');
  } catch {
    prompt('아래 링크를 복사하세요:', resultUrl);
  }
});

/* ── 이미지 저장 (html2canvas) ── */

document.getElementById('btn-download').addEventListener('click', async () => {
  const btn = document.getElementById('btn-download');
  btn.textContent = '저장 중...';
  btn.disabled    = true;

  try {
    const card    = document.getElementById('capture-area');
    const axes    = document.getElementById('axes-section');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bgColor = isLight ? '#FAF6F0' : '#0F0E0C';

    const opts = {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
      allowTaint: true,
    };

    const cardCanvas = await html2canvas(card, opts);
    const axesCanvas = axes ? await html2canvas(axes, opts) : null;

    let finalCanvas = cardCanvas;
    if (axesCanvas) {
      const width  = Math.max(cardCanvas.width, axesCanvas.width);
      const height = cardCanvas.height + axesCanvas.height;
      const merged = document.createElement('canvas');
      merged.width  = width;
      merged.height = height;
      const ctx = merged.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(cardCanvas, (width - cardCanvas.width) / 2, 0);
      ctx.drawImage(axesCanvas, (width - axesCanvas.width) / 2, cardCanvas.height);
      finalCanvas = merged;
    }

    const link      = document.createElement('a');
    link.download   = `LBT_${typeCode}_결과.png`;
    link.href       = finalCanvas.toDataURL('image/png');
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

  const imgUrl = `${window.location.origin}/type_img/${typeCode}.png`;

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
          mobileWebUrl: resultUrl,
          webUrl:       resultUrl,
        },
      },
      buttons: [
        {
          title: '나도 테스트하기',
          link: { mobileWebUrl: `${BASE_URL}index.html`, webUrl: `${BASE_URL}index.html` },
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
