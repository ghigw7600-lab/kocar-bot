// 봇 소개문·명령어·웹훅·메뉴 버튼을 한 번에 설정 — 실행: npm run setup
import { Bot } from "grammy";

const { BOT_TOKEN, WEBHOOK_URL, WEBHOOK_SECRET, KOREAN_IDS } = process.env;
if (!BOT_TOKEN) throw new Error(".env 에 BOT_TOKEN 이 없습니다.");
const api = new Bot(BOT_TOKEN).api;

const desc = {
  uz: "🚗 KOCAR — Koreyadan mashina olib berish.\nKia, Hyundai — Encar va K Car'dagi mashinalar, Toshkentgacha jami narxi bilan.\n\n👇 Boshlash tugmasini bosing",
  ru: "🚗 KOCAR — авто из Кореи под заказ.\nKia, Hyundai с Encar и K Car — с итоговой ценой до Ташкента.\n\n👇 Нажмите «Старт»",
};
const cmds = {
  uz: [{ command: "start", description: "Boshlash" }],
  ru: [{ command: "start", description: "Начать" }],
};
for (const lang of ["uz", "ru"]) {
  await api.setMyDescription(desc[lang], { language_code: lang });
  await api.setMyCommands(cmds[lang], { language_code: lang });
}
await api.setMyDescription(`${desc.uz}\n\n— — —\n\n${desc.ru}`.slice(0, 512));
await api.setMyShortDescription("🚗 Koreyadan mashina · Авто из Кореи — KOCAR");
await api.setMyCommands(cmds.uz);
console.log("✅ 소개문·명령어");

// 대표에게만 보이는 관리 명령어
const adminCmds = [
  { command: "cars", description: "올린 매물 (팔림·삭제)" },
  { command: "settings", description: "도착가 계산 기준" },
  { command: "set", description: "기준 바꾸기" },
  { command: "customs", description: "차별 통관비 직접 입력" },
  { command: "test", description: "손님 화면 테스트 모드" },
  { command: "help", description: "도움말" },
];
for (const id of String(KOREAN_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
  await api.setMyCommands(adminCmds, { scope: { type: "chat", chat_id: Number(id) } }).catch((e) => console.log(`⚠️ ${id}: ${e.message} (봇에 먼저 /start 를 보내세요)`));
}
console.log("✅ 관리 명령어");

if (WEBHOOK_URL) {
  await api.setWebhook(WEBHOOK_URL, { secret_token: WEBHOOK_SECRET || undefined, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  const app = new URL("/app/", WEBHOOK_URL).href;
  await api.setChatMenuButton({ menu_button: { type: "web_app", text: "KOCAR", web_app: { url: app } } });
  console.log(`✅ 웹훅·메뉴 버튼: ${app}`);
} else console.log("ℹ️ WEBHOOK_URL 이 없어 웹훅은 건너뜀");

const me = await api.getMe();
console.log(`\n완료! https://t.me/${me.username}`);
