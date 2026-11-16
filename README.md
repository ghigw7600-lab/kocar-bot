# KOCAR 봇 — 한국 중고차 직구 (우즈벡 B2C)

## 처음 설치 (GIEC 봇과 같은 순서)
1. 폴더 압축 풀기 → cmd 에서 `cd` 로 폴더 이동 → `npm install`
2. BotFather 에서 새 봇 만들고 토큰 받기 → `.env.example` 을 복사해 `.env` 로 이름 바꾸고 값 채우기
3. GitHub 에 새 저장소(예: kocar-bot) → 맨 위 화면에 폴더째 끌어 올리기 (`.env`, `node_modules` 는 빼기)
4. Vercel → Import → 환경변수 입력 → Deploy
5. Redis: GIEC 와 같은 REDIS_URL 을 써도 됨 (KOCAR 는 `kocar:` 로 따로 저장)
6. 내 컴퓨터에서 `npm run setup` 한 번 (소개문·명령어·웹훅·KOCAR 메뉴 버튼)
7. 상담방: 슈퍼그룹 만들고 주제(Topics) 켜기 → 봇을 관리자로(주제 관리) → 그룹에서 /myid 로 ID 확인 → CONSULT_GROUP_ID 에 넣고 Redeploy
8. BotFather /newapp → URL `https://<프로젝트>.vercel.app/app/`, Short name `app`

## 환경변수
| 이름 | 내용 |
|---|---|
| BOT_TOKEN | 봇 토큰 |
| WEBHOOK_URL | `https://<프로젝트>.vercel.app/api/webhook` |
| WEBHOOK_SECRET | 영문·숫자 아무거나 |
| REDIS_URL | Redis 주소 |
| CONSULT_GROUP_ID | 상담방 ID (-100…) |
| KOREAN_IDS | 대표 텔레그램 ID (쉼표로 여러 명) — 매물 올리기·설정 |
| STAFF_IDS | 직원 ID — 상담방 답장만 |
| BOT_USERNAME | 봇 아이디 (@ 없이) |
| TRANSLATE | `off` 면 손님 글 한국어 번역 끔 |

## 쓰는 법 (대표)
- 엔카·케이카 매물 주소를 봇에 보내기 → 차종 버튼 → `2022 4.8만 2150 1999` (연식 · km · 가격 만원 · cc) → 연료 → [✅ 올리기]
- `/cars` 팔림·다시 올림·삭제 · `/settings` 계산 기준 · `/set shipUsd 1800` · `/customs 3 9500` (3번 차 통관비 직접) · `/test` 손님 화면
- 상담방 주제에 쓰면 손님에게 감, `//` 로 시작하면 메모

## 원칙
- 엔카·케이카의 사진·글은 가져오지 않음. 대표가 입력한 정보 + 원본 링크만.
- 도착가 기본값은 인터넷 자료(2026-11) 기준 → 현지 관세사 확인 후 `/set` 으로 고치기.
