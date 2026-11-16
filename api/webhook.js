// Vercel 서버리스 함수: 텔레그램이 메시지를 이 주소로 보내줍니다 (웹훅 방식)
import { webhookCallback } from "grammy";
import { bot } from "../src/bot.js";

export default webhookCallback(bot, "https", {
  secretToken: process.env.WEBHOOK_SECRET, // 텔레그램이 보낸 요청인지 확인
  timeoutMilliseconds: 50_000, // 느린 작업(엑셀 등)도 끝까지 처리
  onTimeout: "return", // 시간이 넘어도 텔레그램이 같은 메시지를 계속 다시 보내지 않게
});
