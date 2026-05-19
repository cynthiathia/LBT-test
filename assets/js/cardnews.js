/* ────────── LBT 카드뉴스 — 이미지 저장 (1080 × 1350) ────────── */

(function () {
  const CARD_W = 1080;
  const CARD_H = 1350;

  async function captureCard(cardEl) {
    // 1) 캡처용 임시 컨테이너 — 화면 밖, 원본 크기 그대로 렌더
    const stage = document.createElement('div');
    stage.style.cssText = `
      position: fixed;
      top: 0;
      left: -99999px;
      width: ${CARD_W}px;
      height: ${CARD_H}px;
      z-index: -1;
      pointer-events: none;
    `;

    // 2) 카드 클론 — transform/scale 풀린 원본 크기 상태
    const clone = cardEl.cloneNode(true);
    clone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${CARD_W}px;
      height: ${CARD_H}px;
      transform: none;
    `;
    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      const canvas = await html2canvas(clone, {
        width:        CARD_W,
        height:       CARD_H,
        windowWidth:  CARD_W,
        windowHeight: CARD_H,
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      return canvas;
    } finally {
      document.body.removeChild(stage);
    }
  }

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* 개별 저장 버튼 */
  document.querySelectorAll('.cn-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cardId = btn.dataset.card;
      const name   = btn.dataset.name || cardId;
      const card   = document.getElementById(cardId);
      if (!card) return;

      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = '저장 중...';

      try {
        const canvas = await captureCard(card);
        downloadCanvas(canvas, `LBT_카드뉴스_${name}.png`);
      } catch (e) {
        console.error(e);
        alert('이미지 저장 실패: ' + (e.message || e));
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  /* 전체 다운로드 */
  const allBtn = document.getElementById('download-all-btn');
  if (allBtn) {
    allBtn.addEventListener('click', async () => {
      const buttons = Array.from(document.querySelectorAll('.cn-save-btn'));
      if (buttons.length === 0) return;

      const original = allBtn.textContent;
      allBtn.disabled = true;
      allBtn.textContent = '저장 중...';

      try {
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          allBtn.textContent = `저장 중 ${i + 1}/${buttons.length}...`;
          const cardId = btn.dataset.card;
          const name   = btn.dataset.name || cardId;
          const card   = document.getElementById(cardId);
          if (!card) continue;
          const canvas = await captureCard(card);
          downloadCanvas(canvas, `LBT_카드뉴스_${name}.png`);
          // 브라우저 다운로드 큐 부담 줄이려고 살짝 텀
          await sleep(250);
        }
        allBtn.textContent = '✓ 6장 모두 저장 완료';
        await sleep(2000);
      } catch (e) {
        console.error(e);
        alert('전체 저장 중 오류: ' + (e.message || e));
      } finally {
        allBtn.disabled = false;
        allBtn.textContent = original;
      }
    });
  }
})();
