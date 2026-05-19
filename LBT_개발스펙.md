# LBT 언어유형 테스트 — 개발 스펙 문서

> 이하영 작가 북콘서트 『언어의 선물』 홍보용 바이럴 테스트 사이트

---

## 📁 파일 구조 (권장)

```
lbt-test/
├── index.html          # 인트로 페이지
├── test.html           # 질문 페이지
├── result.html         # 결과 페이지
├── admin.html          # 어드민 페이지
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── test.js         # 질문 로직 / 점수 계산
│   │   ├── result.js       # 결과 렌더링
│   │   └── share.js        # 공유 / 캡처 기능
│   └── images/
│       └── og-image.png    # SNS 공유 썸네일
└── data/
    └── lbt_data.json       # 전체 데이터 (별첨)
```

---

## 🔢 점수 계산 로직

### 축별 점수 집계

| 축 | A 선택 시 | B 선택 시 | 문항 번호 |
|----|-----------|-----------|-----------|
| 감정 해소법 | P +1 | E +1 | Q1~Q5 |
| 마음의 초점 | S +1 | A +1 | Q6~Q10 |
| 삶의 주도권 | R +1 | C +1 | Q11~Q15 |
| 관계의 방식 | J +1 | M +1 | Q16~Q20 |

### 유형 결정 규칙

```
각 축마다 A/B 중 더 많이 선택된 쪽의 코드를 채택
동점(5문항 중 2.5 → 불가, 홀수 문항이므로 항상 우열이 결정됨)
→ 4개 코드를 순서대로 조합 → 유형 코드 완성

예시) P:3 E:2 → P 채택
      S:1 A:4 → A 채택
      R:3 C:2 → R 채택
      J:2 M:3 → M 채택
      결과 → PARM (봄날의 동반자)
```

### JavaScript 구현 예시

```javascript
function calculateType(answers) {
  // answers = { 1: 'A', 2: 'B', 3: 'A', ... } (질문번호: 선택)
  
  const scores = { P: 0, E: 0, S: 0, A: 0, R: 0, C: 0, J: 0, M: 0 };

  answers.forEach((answer, index) => {
    const q = questions[index]; // lbt_data.json의 questions 배열
    const score = answer === 'A' ? q.scoreA : q.scoreB;
    scores[score]++;
  });

  const axis1 = scores.P >= scores.E ? 'P' : 'E';
  const axis2 = scores.S >= scores.A ? 'S' : 'A';
  const axis3 = scores.R >= scores.C ? 'R' : 'C';
  const axis4 = scores.J >= scores.M ? 'J' : 'M';

  return `${axis1}${axis2}${axis3}${axis4}`;
}
```

---

## 📄 페이지별 스펙

### 1. 인트로 페이지 (`index.html`)

**구성 요소**
- 헤드라인: "나의 언어 습관은 어떤 유형일까요?"
- 부제: "20개의 질문으로 알아보는 나의 언어 유형"
- 소요 시간 안내: "약 3분 소요"
- 시작하기 버튼 → `test.html`로 이동

**URL 파라미터**
- 없음

---

### 2. 질문 페이지 (`test.html`)

**구성 요소**
- 상단 진행 바: `현재 문항 / 20` 표시
- 축 카테고리 레이블 (Q1~5: 감정 해소법, Q6~10: 마음의 초점 등)
- 질문 텍스트
- (A) / (B) 선택 버튼
- 이전/다음 네비게이션

**동작 로직**
```
선택 즉시 다음 문항으로 자동 이동 (또는 '다음' 버튼)
20문항 완료 → 점수 계산 → result.html?type=XXXX 로 이동
답변 임시 저장: sessionStorage 사용 권장
```

**sessionStorage 키**
```javascript
sessionStorage.setItem('lbt_answers', JSON.stringify(answers));
// answers = [{ id: 1, selected: 'A' }, { id: 2, selected: 'B' }, ...]
```

---

### 3. 결과 페이지 (`result.html`)

**URL 파라미터**
```
result.html?type=PACM
```

**구성 요소 (순서대로)**

```
① 유형 코드 (크게 표시) — 예: PACM
② 유형 이름 — 예: 고요한 창조자
③ 특징 (3문장)
④ 장점 (2문장)
⑤ 단점 (2문장)
⑥ 이하영 작가의 처방 (강조 박스)
⑦ 콘서트 연결 문구 + 예매 링크 버튼
⑧ 신간 구매 링크 버튼
⑨ 공유 버튼 (캡처 / 카카오 / 인스타)
⑩ 다시하기 버튼
```

**결과 데이터 로딩**
```javascript
const params = new URLSearchParams(window.location.search);
const typeCode = params.get('type'); // 예: 'PACM'
const typeData = lbtData.types[typeCode];
```

**OG 태그 (SNS 공유용) — 동적 생성 필요 시 서버사이드 렌더링 권장**
```html
<meta property="og:title" content="나는 고요한 창조자 (PACM)형입니다" />
<meta property="og:description" content="말이 없어도 삶이 풍요롭습니다. 나의 언어 유형을 알아보세요." />
<meta property="og:image" content="assets/images/result-PACM.png" />
```

---

### 4. 공유 기능 (`share.js`)

#### 캡처 버튼
```javascript
// html2canvas 라이브러리 사용 권장
// npm install html2canvas

import html2canvas from 'html2canvas';

async function captureResult() {
  const element = document.getElementById('result-card'); // 캡처할 영역 지정
  const canvas = await html2canvas(element);
  const link = document.createElement('a');
  link.download = `LBT_${typeCode}_결과.png`;
  link.href = canvas.toDataURL();
  link.click();
}
```

#### 카카오 공유
```javascript
// Kakao SDK 사용
// https://developers.kakao.com/

Kakao.Share.sendDefault({
  objectType: 'feed',
  content: {
    title: `나는 ${typeName} (${typeCode})형입니다`,
    description: features[0],
    imageUrl: `${BASE_URL}/assets/images/result-${typeCode}.png`,
    link: {
      mobileWebUrl: `${BASE_URL}/result.html?type=${typeCode}`,
      webUrl: `${BASE_URL}/result.html?type=${typeCode}`,
    },
  },
  buttons: [
    {
      title: '나도 테스트하기',
      link: {
        mobileWebUrl: `${BASE_URL}/index.html`,
        webUrl: `${BASE_URL}/index.html`,
      },
    },
    {
      title: '콘서트 예매하기',
      link: {
        mobileWebUrl: concert.ticketUrl,
        webUrl: concert.ticketUrl,
      },
    },
  ],
});
```

#### URL 복사
```javascript
function copyLink() {
  const url = `${BASE_URL}/result.html?type=${typeCode}`;
  navigator.clipboard.writeText(url);
  alert('링크가 복사되었습니다!');
}
```

---

### 5. 어드민 페이지 (`admin.html`)

**접근 제한**
```javascript
// 간단한 비밀번호 보호 (기본)
const ADMIN_PASSWORD = 'YOUR_PASSWORD_HERE';
const input = prompt('관리자 비밀번호를 입력하세요');
if (input !== ADMIN_PASSWORD) {
  window.location.href = '/';
}
```

**표시 데이터**

| 항목 | 설명 |
|------|------|
| 총 참여자 수 | 테스트 완료 기준 |
| 유형별 분포 | 16개 유형 각각 몇 명 / 퍼센트 |
| 일별 참여자 추이 | 차트 (Chart.js 권장) |
| 링크 수정 | 콘서트 예매 URL / 신간 구매 URL 변경 |

**데이터 저장 방식 (선택)**

| 방식 | 장점 | 단점 |
|------|------|------|
| Firebase Realtime DB | 무료, 빠른 셋업 | 구글 계정 필요 |
| Google Sheets API | 스프레드시트로 바로 확인 | 설정 복잡 |
| 로컬 JSON (간이) | 셋업 없음 | 기기 간 공유 불가 |

**Firebase 권장 구조**
```json
{
  "stats": {
    "total": 1523,
    "byType": {
      "PACM": 87,
      "EACM": 134,
      "PSRJ": 201
    },
    "byDate": {
      "2026-06-01": 45,
      "2026-06-02": 78
    }
  },
  "config": {
    "ticketUrl": "https://interpark.com/...",
    "bookUrl": "https://..."
  }
}
```

---

## 🎨 디자인 가이드

### 색상

```css
:root {
  --color-bg: #0F0E0C;          /* 메인 배경 (다크) */
  --color-gold: #C9A96E;        /* 포인트 골드 */
  --color-gold-light: #F0E0C0;  /* 골드 연하게 */
  --color-cream: #FAF6F0;       /* 텍스트 밝은 색 */
  --color-ink: #1A1410;         /* 텍스트 어두운 색 */
  --color-ink-light: #7A6A58;   /* 보조 텍스트 */

  /* 결과지 섹션 색상 */
  --color-feature-bg: #D6E4F0;  /* 특징 - 파랑 */
  --color-pros-bg: #E8F5E9;     /* 장점 - 초록 */
  --color-cons-bg: #FFF3E0;     /* 단점 - 주황 */
  --color-rx-bg: #F3E5F5;       /* 처방 - 보라 */
}
```

### 폰트

```css
/* 권장 Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

--font-serif: 'Noto Serif KR', serif;   /* 제목, 유형명 */
--font-sans: 'Noto Sans KR', sans-serif; /* 본문, 버튼 */
```

### 반응형 기준점

```css
/* 모바일 우선 설계 권장 (주 사용 디바이스: 스마트폰) */
@media (max-width: 480px) { /* 모바일 */ }
@media (min-width: 481px) and (max-width: 768px) { /* 태블릿 */ }
@media (min-width: 769px) { /* 데스크탑 */ }
```

---

## 📦 권장 라이브러리

```json
{
  "dependencies": {
    "html2canvas": "^1.4.1",
    "chart.js": "^4.4.0",
    "firebase": "^10.0.0"
  }
}
```

| 라이브러리 | 용도 | CDN |
|-----------|------|-----|
| html2canvas | 결과 카드 캡처 | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |
| Chart.js | 어드민 통계 차트 | `https://cdn.jsdelivr.net/npm/chart.js` |
| Kakao SDK | 카카오 공유 | `https://developers.kakao.com/sdk/js/kakao.js` |

---

## 🔗 외부 연동 URL (개발 전 확인 필요)

```javascript
const CONFIG = {
  concertTicketUrl: 'INTERPARK_URL_HERE',   // 인터파크 예매 링크
  bookPurchaseUrl: 'BOOK_URL_HERE',          // 신간 구매 링크
  kakaoAppKey: 'KAKAO_APP_KEY_HERE',         // 카카오 개발자 앱 키
  baseUrl: 'https://YOUR_DOMAIN_HERE',       // 배포 도메인
};
```

---

## ✅ 개발 체크리스트

### 기본 기능
- [ ] 인트로 페이지 구현
- [ ] 20문항 질문 페이지 구현
- [ ] 진행 바 (progress bar) 구현
- [ ] 점수 계산 로직 구현
- [ ] 16개 유형 결과 페이지 구현
- [ ] 결과 카드 캡처 기능
- [ ] 카카오 공유 기능
- [ ] URL 복사 기능
- [ ] 다시하기 버튼

### 어드민
- [ ] 참여자 수 집계
- [ ] 유형별 분포 차트
- [ ] 링크 수정 기능

### SEO / 공유 최적화
- [ ] OG 태그 설정
- [ ] 유형별 공유 이미지 제작 (16개)
- [ ] 모바일 반응형 확인

### 배포 전 확인
- [ ] 콘서트 예매 링크 삽입
- [ ] 신간 구매 링크 삽입
- [ ] 카카오 앱 키 삽입
- [ ] 도메인 설정
