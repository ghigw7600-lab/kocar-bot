// 내 컴퓨터에서 테스트할 때 쓰는 파일 (폴링 방식)
// 실행: npm run dev
import { bot } from "./src/bot.js";

// 웹훅이 걸려 있으면 폴링이 안 되므로 먼저 해제
await bot.api.deleteWebhook();
console.log("봇 실행 중... (종료: Ctrl+C)");
bot.start();
