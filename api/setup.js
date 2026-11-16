// 브라우저에서 한 번 열면 봇 설정 끝 (npm run setup 대신)
//   https://<프로젝트>.vercel.app/api/setup?key=<WEBHOOK_SECRET>
//   하는 일: 소개문·명령어, 대표 전용 명령어, 웹훅 연결, KOCAR 메뉴 버튼(미니앱)
import { Bot } from "grammy";

const desc = {
  uz: "🚗 KOCAR — Koreyadan mashina olib berish.\nKia, Hyundai — Encar va K Car'dagi mashinalar, Toshkentgacha jami narxi bilan.\n\n👇 Boshlash tugmasini bosing",
  ru: "🚗 KOCAR — авто из Кореи под заказ.\nKia, Hyundai с Encar и K Car — с итоговой ценой до Ташкента.\n\n👇 Нажмите «Старт»",
};
const adminCmds = [
  { command: "cars", description: "올린 매물 (팔림·삭제)" },
  { command: "settings", description: "도착가 계산 기준" },
  { command: "set", description: "기준 바꾸기" },
  { command: "customs", description: "차별 통관비 직접 입력" },
  { command: "test", description: "손님 화면 테스트 모드" },
  { command: "myid", description: "내 텔레그램 ID" },
  { command: "help", description: "도움말" },
];

export default async function handler(req, res) {
  const { BOT_TOKEN, WEBHOOK_SECRET, KOREAN_IDS } = process.env;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (!BOT_TOKEN) return res.status(500).send("❌ BOT_TOKEN 환경변수가 없어요");
  if (WEBHOOK_SECRET && req.query.key !== WEBHOOK_SECRET) return res.status(403).send("❌ 주소 끝 ?key= 값이 WEBHOOK_SECRET 과 달라요");

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = process.env.WEBHOOK_URL ? new URL("/", process.env.WEBHOOK_URL).href : `https://${host}/`;
  const api = new Bot(BOT_TOKEN.trim().replace(/^BOT_TOKEN\s*=\s*/i, "")).api;
  const log = [];
  // 토큰 점검 (비밀 부분은 안 보여 줌): 봇 번호 · 글자 수 · 띄어쓰기/앞에 붙은 글자
  const raw = BOT_TOKEN;
  const tk = raw.trim().replace(/^BOT_TOKEN\s*=\s*/i, "");
  log.push(`ℹ️ Vercel 토큰: 봇 번호 ${tk.split(":")[0]} · ${tk.length}글자${raw !== raw.trim() ? " · ⚠️ 앞뒤에 띄어쓰기/줄바꿈 있음" : ""}${/^BOT_TOKEN/i.test(raw.trim()) ? " · ⚠️ 앞에 BOT_TOKEN= 이 붙어 있음" : ""}${/^\d+:[\w-]{30,}$/.test(tk) ? "" : " · ⚠️ 토큰 모양이 아님"}`);
  log.push("   → BotFather /mybots → 봇 → API Token 의 앞 숫자와 같은지 비교\n");
  const step = async (label, fn) => {
    try { await fn(); log.push(`✅ ${label}`); } catch (e) { log.push(`❌ ${label}: ${e.description ?? e.message}`); }
  };

  for (const lang of ["uz", "ru"]) {
    await step(`${lang} 소개문`, () => api.setMyDescription(desc[lang], { language_code: lang }));
    await step(`${lang} 명령어`, () => api.setMyCommands([{ command: "start", description: lang === "ru" ? "Начать" : "Boshlash" }], { language_code: lang }));
  }
  await step("기본 소개문", () => api.setMyDescription(`${desc.uz}\n\n— — —\n\n${desc.ru}`.slice(0, 512)));
  await step("짧은 소개", () => api.setMyShortDescription("🚗 Koreyadan mashina · Авто из Кореи — KOCAR"));
  await step("기본 명령어", () => api.setMyCommands([{ command: "start", description: "Boshlash" }]));
  for (const id of String(KOREAN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    await step(`대표 명령어 (${id}) — 실패하면 그 계정으로 봇에 /start 먼저`, () =>
      api.setMyCommands(adminCmds, { scope: { type: "chat", chat_id: Number(id) } })
    );
  }
  await step(`웹훅 연결: ${base}api/webhook`, () =>
    api.setWebhook(`${base}api/webhook`, { secret_token: WEBHOOK_SECRET || undefined, allowed_updates: ["message", "callback_query"] })
  );
  await step(`메뉴 버튼 → 미니앱 ${base}app/`, () =>
    api.setChatMenuButton({ menu_button: { type: "web_app", text: "KOCAR", web_app: { url: `${base}app/` } } })
  );
  let me = "";
  await step("봇 확인", async () => { me = (await api.getMe()).username; });
  res.status(200).send(`${log.join("\n")}\n\n완료! https://t.me/${me}\n(설정이 바뀌거나 주소가 바뀌면 이 주소를 다시 열면 돼요)`);
}
