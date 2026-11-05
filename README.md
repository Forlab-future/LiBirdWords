# LiBird Words

일본어(완전 초급, 히라가나부터) · 영어(학술 어휘·논문 표현·SOFC 전공어휘) 단어 학습 웹앱.

- 접속: https://forlab-future.github.io/LiBirdWords/
- 간격 반복(SRS) · 하루 새 항목 수 조절 · 복습이 밀리면 새 항목 자동 감소
- 가나 퀴즈 · 헷갈리는 글자 비교 · 가나표 · 발음 듣기(Web Speech API)
- 학습 기록은 동기화 비밀번호로 암호화(AES-GCM)해서 `progress` 브랜치에 기기별 파일로 저장
- 다른 기기는 설정 → 「다른 기기 연결 (QR)」로 연결

## 파일

| 파일 | 내용 |
|---|---|
| `index.html`, `style.css`, `app.js` | 앱 |
| `data/kana.js` | 히라가나(가타카나는 자동 생성), 외우는 팁, 헷갈리는 글자 |
| `data/ja.js` | 일본어 단어 (히라가나 단어, 가타카나 단어, N5 한자 단어) |
| `data/en.js` | 영어 (AWL sublist 1–2, 논문 표현, SOFC 전공어휘) |
| `sw.js`, `manifest.webmanifest` | 오프라인 · 홈 화면 설치 |

단어를 추가하려면 `data/*.js`에 같은 형식으로 줄을 더하면 됩니다. 카드 id를 바꾸면 그 카드의 학습 기록이 끊기니 id는 바꾸지 마세요.
