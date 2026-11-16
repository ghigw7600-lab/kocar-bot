// ═════════════════════════════════════════════════════════════
//  KOCAR 봇 — 한국 중고차 직구 (우즈벡 B2C)
//   손님: /start → 인사 + [🚗 Mashinalar = 미니앱] [🔎 Mashina topib bering] [🌐 Til]
//         미니앱에서 차를 고르면 ?start=car-<id> 로 돌아와 상담방에 "이 차 문의" 카드
//         아무 글이나 쓰면 상담방 주제로 (+ 🇰🇷 번역)
//   대표(KOREAN_IDS): 봇에 엔카·케이카 링크를 보내면 매물 올리기 시작
//         /cars 목록·팔림 처리, /settings·/set 계산 기준, /customs 차별 통관비, /test
//   상담방: 직원·대표가 주제에 쓴 글 → 손님에게 ( "//" 로 시작 = 메모 )
// ═════════════════════════════════════════════════════════════
import { Bot, Composer, InlineKeyboard, Keyboard, session } from "grammy";
import { kv, sessionStorage } from "./storage.js";
import { T, t, detectLang, allLabels, BUDGETS, YEARS } from "./i18n.js";
import { MODELS, FUELS, sourceOf, findUrl, saveCar, getCar, allCars, removeCar, newId, parseSpecs } from "./cars.js";
import { getSettings, setSetting, calcTotal, SETTING_LABELS } from "./calc.js";
import { groupId, esc, getCustomer, saveCustomer, touchCustomer, customerOfThread, inTopic, postCard } from "./customers.js";
import { toKorean } from "./translate.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN 이 없습니다.");
export const bot = new Bot(token);

const ids = (v) => String(v ?? "").split(",").map((s) => Number(s.trim())).filter(Boolean);
const KOREAN = ids(process.env.KOREAN_IDS);
const STAFF = ids(process.env.STAFF_IDS);
const isKorean = (id) => KOREAN.includes(id);
const isTeam = (id) => isKorean(id) || STAFF.includes(id);

export const appUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.WEBHOOK_URL) return new URL("/app/", process.env.WEBHOOK_URL).href;
  return null;
};
const won = (n) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만 원`;
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const kmText = (km) => (km >= 10000 ? `${(km / 10000).toFixed(1).replace(/\.0$/, "")}만 km` : `${km} km`);

// ── 공통: 중복 업데이트 무시 + 세션 ──
bot.use(async (ctx, next) => {
  if (!(await kv.setNX(`upd:${ctx.update.update_id}`, 1, 600))) return;
  return next();
});
bot.use(session({ initial: () => ({}), storage: sessionStorage }));

const pm = bot.chatType("private");
const admin = pm.filter((ctx) => isKorean(ctx.from.id) && !ctx.session.testMode);
const pmAny = pm; // 손님 화면 (테스트 모드인 대표 포함)

// ═════════ 손님 ═════════
const menu = (lang) => {
  const kb = new Keyboard();
  const app = appUrl();
  if (app) kb.webApp(t(lang, "btnCars"), `${app}?lang=${lang}`);
  return kb.text(t(lang, "btnFind")).row().text(t(lang, "btnLang")).resized().persistent();
};

async function home(ctx) {
  const lang = ctx.session.lang;
  await ctx.reply(t(lang, "welcome"), { reply_markup: menu(lang) });
}

pmAny.command("start", async (ctx, next) => {
  if (isKorean(ctx.from.id) && !ctx.session.testMode) return next(); // 대표는 아래 관리자 /start
  ctx.session.lang ??= detectLang(ctx.from.language_code);
  ctx.session.find = null;
  const c = await touchCustomer(ctx.from, ctx.session.lang);
  const p = ctx.match ?? "";
  if (p.startsWith("car-")) return askCar(ctx, c, p.slice(4));
  await home(ctx);
  if (p === "find") return startFind(ctx);
});

async function askCar(ctx, c, id) {
  const lang = ctx.session.lang;
  const car = await getCar(id);
  if (!car || car.status === "sold") {
    await ctx.reply(t(lang, "carGone"), { reply_markup: menu(lang) });
    if (car) await postCard(ctx.api, c, `🚗 <b>팔린 차 문의</b>\n${carLine(car)}\n→ 비슷한 차 찾아 주세요`);
    return;
  }
  const s = await getSettings();
  const r = calcTotal(car, s);
  await ctx.reply(`${t(lang, "carAsked")}\n\n🚗 ${car.model} · ${car.year}\n💵 ${t(lang, "total")}: ≈ ${usd(r.total)}`, {
    reply_markup: menu(lang),
  });
  await postCard(
    ctx.api,
    c,
    `🔔 <b>이 차 문의</b>\n${carLine(car)}\n한국가 ${won(car.priceWon)} → 타슈켄트 ≈ <b>${usd(r.total)}</b>\n🔗 <a href="${esc(car.url)}">${sourceOf(car.url)} 원본</a>`
  );
  await saveCustomer({ ...(await getCustomer(c.id)), lastInAt: Date.now() });
}

const carLine = (car) =>
  `${esc(car.model)} · ${car.year} · ${kmText(car.km)} · ${FUELS[car.fuel]?.ko ?? ""}${car.cc ? ` · ${car.cc}cc` : ""}`;

// 언어
pmAny.hears(allLabels("btnLang"), (ctx) =>
  ctx.reply(t(ctx.session.lang, "chooseLang"), {
    reply_markup: new InlineKeyboard().text("🇺🇿 Oʻzbekcha", "l:uz").text("🇷🇺 Русский", "l:ru"),
  })
);
pmAny.callbackQuery(/^l:(uz|ru)$/, async (ctx) => {
  ctx.session.lang = ctx.match[1];
  await ctx.answerCallbackQuery();
  await ctx.deleteMessage().catch(() => {});
  if (!isKorean(ctx.from.id) || ctx.session.testMode) await touchCustomer(ctx.from, ctx.session.lang);
  return home(ctx);
});

// 원하는 차 찾아 주기: 차종 → 예산 → 연식
async function startFind(ctx) {
  const lang = ctx.session.lang ?? "uz";
  ctx.session.find = { step: "model" };
  const kb = new InlineKeyboard();
  ["Kia K5", "Kia K8", "Kia Sorento", "Kia Carnival", "Hyundai Sonata", "Hyundai Grandeur"].forEach((m, i) => {
    kb.text(m.replace(/^(Kia|Hyundai) /, ""), `f:m:${m}`);
    if (i % 3 === 2) kb.row();
  });
  kb.text(t(lang, "other"), "f:m:other");
  return ctx.reply(t(lang, "findModel"), { reply_markup: kb });
}
pmAny.hears(allLabels("btnFind"), (ctx) => {
  if (isKorean(ctx.from.id) && !ctx.session.testMode) return ctx.reply("ℹ️ 손님 화면은 /test 로 테스트 모드를 켜고 보세요.");
  return startFind(ctx);
});

const askBudget = (ctx, edit) => {
  const lang = ctx.session.lang ?? "uz";
  ctx.session.find.step = "budget";
  const kb = new InlineKeyboard();
  BUDGETS.forEach((b, i) => kb.text(b, `f:b:${i}`));
  return edit ? ctx.editMessageText(t(lang, "findBudget"), { reply_markup: kb }) : ctx.reply(t(lang, "findBudget"), { reply_markup: kb });
};

pmAny.callbackQuery(/^f:(m|b|y):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const f = ctx.session.find;
  if (!f) return;
  const lang = ctx.session.lang ?? "uz";
  const [, kind, v] = ctx.match;
  if (kind === "m" && f.step === "model") {
    if (v === "other") {
      f.step = "modeltype";
      return ctx.editMessageText(t(lang, "findModelType"));
    }
    f.model = v;
    return askBudget(ctx, true);
  }
  if (kind === "b" && f.step === "budget") {
    f.budget = BUDGETS[Number(v)];
    f.step = "year";
    const kb = new InlineKeyboard();
    YEARS.forEach((y, i) => kb.text(y, `f:y:${i}`));
    kb.row().text(t(lang, "any"), "f:y:any");
    return ctx.editMessageText(t(lang, "findYear"), { reply_markup: kb });
  }
  if (kind === "y" && f.step === "year") {
    f.year = v === "any" ? "상관없음" : YEARS[Number(v)];
    ctx.session.find = null;
    await ctx.editMessageText(t(lang, "findDone"));
    const c = await touchCustomer(ctx.from, lang);
    await postCard(
      ctx.api,
      c,
      `🔔 <b>차 찾아 주세요</b>\n차종: ${esc(f.model)}\n예산(타슈켄트 총액): ${esc(f.budget)}\n연식: ${esc(f.year)}`
    );
    await saveCustomer({ ...(await getCustomer(c.id)), lastInAt: Date.now() });
  }
});

// ═════════ 대표 (관리자) ═════════
const ADMIN_HELP = [
  "🛠 <b>KOCAR 관리</b>",
  "• 엔카·케이카 링크를 보내면 → 매물 올리기",
  "/cars — 올린 매물 (팔림·다시 올림·삭제)",
  "/settings — 도착가 계산 기준 보기",
  "/set 이름 값 — 기준 바꾸기 (예: /set shipUsd 1800)",
  "/customs 번호 금액 — 이 차 통관비를 직접 입력 ($, 0 = 자동 계산)",
  "/test — 손님 화면 테스트 모드 켜기/끄기",
  "/myid — 내 텔레그램 ID",
].join("\n");

bot.command("myid", (ctx) => ctx.reply(`ID: <code>${ctx.from.id}</code>\n채팅: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));

pm.command("test", (ctx) => {
  if (!isKorean(ctx.from.id)) return;
  ctx.session.testMode = !ctx.session.testMode;
  ctx.session.add = null;
  return ctx.reply(ctx.session.testMode ? "🧪 테스트 모드 켬 — 이제 손님처럼 보여요. /start 를 눌러 보세요. (끄기: /test)" : "🛠 테스트 모드 끔 — 관리자 화면이에요.");
});

admin.command(["start", "help"], (ctx) => ctx.reply(ADMIN_HELP, { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }));

admin.command("settings", async (ctx) => {
  const s = await getSettings();
  const lines = Object.entries(SETTING_LABELS).map(([k, label]) => `• ${label}\n   <code>${k}</code> = ${Array.isArray(s[k]) ? s[k].join(" ") : s[k]}`);
  return ctx.reply(`🧮 <b>도착가 계산 기준</b>\n⚠️ 기본값은 인터넷 자료 기준 — 현지 관세사에게 확인 후 고치세요\n\n${lines.join("\n")}\n\n바꾸기: /set 이름 값`, { parse_mode: "HTML" });
});

admin.command("set", async (ctx) => {
  const [key, ...rest] = (ctx.match ?? "").trim().split(/\s+/);
  if (!key || !rest.length) return ctx.reply("예: /set shipUsd 1800\n예: /set utilOld 90 210 315 420 525\n(이름 목록: /settings)");
  const v = await setSetting(key, rest.join(" "));
  if (v === null) return ctx.reply("❌ 이름이나 값이 맞지 않아요. /settings 에서 이름을 확인하세요.");
  return ctx.reply(`✅ ${SETTING_LABELS[key]} = ${Array.isArray(v) ? v.join(" ") : v}\n미니앱 가격에 1분 안에 반영돼요.`);
});

admin.command("customs", async (ctx) => {
  const [no, amount] = (ctx.match ?? "").trim().split(/\s+/);
  const cars = await allCars({ withSold: true });
  const car = cars.find((c) => String(c.no) === no);
  if (!car || amount === undefined) return ctx.reply("예: /customs 3 9500  (3번 차 통관비 $9,500)\n0 을 넣으면 다시 자동 계산");
  car.customsUsd = Number(amount) || null;
  await saveCar(car);
  const r = calcTotal(car, await getSettings());
  return ctx.reply(`✅ ${car.no}번 ${car.model} 통관비 ${car.customsUsd ? usd(car.customsUsd) : "자동 계산"} → 총액 ≈ ${usd(r.total)}`);
});

// 매물 목록
async function showCars(ctx) {
  const cars = await allCars({ withSold: true });
  if (!cars.length) return ctx.reply("아직 올린 매물이 없어요. 엔카·케이카 링크를 보내 주세요.");
  const s = await getSettings();
  for (const car of cars.slice(0, 20)) {
    const r = calcTotal(car, s);
    const kb = new InlineKeyboard();
    if (car.status === "sold") kb.text("↩️ 다시 올림", `c:on:${car.id}`);
    else kb.text("✅ 팔림", `c:sold:${car.id}`);
    kb.text("🗑 삭제", `c:del:${car.id}`).url("🔗 원본", car.url);
    await ctx.reply(
      `${car.status === "sold" ? "⚫ 팔림 · " : ""}<b>${car.no}번</b> ${carLine(car)}\n한국가 ${won(car.priceWon)} → ≈ <b>${usd(r.total)}</b>${car.customsUsd ? " (통관비 직접 입력)" : ""}`,
      { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } }
    );
  }
}
admin.command("cars", showCars);

admin.callbackQuery(/^c:(sold|on|del):(.+)$/, async (ctx) => {
  const [, act, id] = ctx.match;
  const car = await getCar(id);
  if (!car) return ctx.answerCallbackQuery("이미 없는 매물이에요");
  if (act === "del") {
    await removeCar(id);
    await ctx.answerCallbackQuery("삭제했어요");
    return ctx.editMessageText(`🗑 ${car.no}번 ${car.model} 삭제됨`);
  }
  car.status = act === "sold" ? "sold" : "on";
  car.checkedAt = Date.now();
  await saveCar(car);
  await ctx.answerCallbackQuery(act === "sold" ? "팔림 처리 — 미니앱에서 내려갔어요" : "다시 올렸어요");
  return ctx.editMessageText(`${act === "sold" ? "⚫ 팔림" : "🟢 판매 중"} · ${car.no}번 ${car.model} ${car.year}`);
});

// 매물 올리기: 링크 → 차종 → "연식 km 가격 cc" → 연료 → 확인
const modelKb = () => {
  const kb = new InlineKeyboard();
  MODELS.forEach((m, i) => {
    kb.text(m.replace(/^(Kia|Hyundai) /, ""), `a:m:${i}`);
    if (i % 4 === 3) kb.row();
  });
  if (kb.inline_keyboard.at(-1).length) kb.row();
  return kb.text("✍️ 직접 입력", "a:m:type").text("❌ 취소", "a:cancel");
};
const askSpecs = (ctx) => {
  ctx.session.add.step = "specs";
  return ctx.reply(`🚗 ${ctx.session.add.model}\n\n연식 · 주행거리 · 가격(만원) · 배기량(cc) 을 한 줄로 보내 주세요.\n예: <code>2022 4.8만 2150 1999</code>\n(전기차는 배기량 생략)`, { parse_mode: "HTML" });
};

admin.callbackQuery(/^a:(m|f):(.+)$|^a:(ok|redo|cancel)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const a = ctx.session.add;
  const act = ctx.match[3];
  if (act === "cancel") {
    ctx.session.add = null;
    return ctx.editMessageText("❌ 취소했어요.");
  }
  if (!a) return ctx.editMessageText("⏱ 오래된 버튼이에요. 링크를 다시 보내 주세요.");
  if (act === "redo") {
    a.step = "model";
    return ctx.editMessageText("차종을 다시 골라 주세요:", { reply_markup: modelKb() });
  }
  if (act === "ok") {
    const cars = await allCars({ withSold: true });
    const no = Math.max(0, ...cars.map((c) => c.no ?? 0)) + 1;
    const car = await saveCar({
      id: newId(), no, url: a.url, model: a.model, ...a.specs, fuel: a.fuel,
      status: "on", createdAt: Date.now(), checkedAt: Date.now(),
    });
    ctx.session.add = null;
    return ctx.editMessageText(`✅ ${car.no}번으로 올렸어요. 미니앱에 1분 안에 보여요.\n팔리면 /cars 에서 [팔림] 을 눌러 주세요.`);
  }
  const [kind, v] = [ctx.match[1], ctx.match[2]];
  if (kind === "m" && a.step === "model") {
    if (v === "type") {
      a.step = "modeltype";
      return ctx.editMessageText("차종을 영어로 적어 주세요 (예: Kia K5 2.0 Prestige)");
    }
    a.model = MODELS[Number(v)];
    await ctx.editMessageText(`🚗 ${a.model}`);
    return askSpecs(ctx);
  }
  if (kind === "f" && a.step === "fuel" && FUELS[v]) {
    a.fuel = v;
    a.step = "confirm";
    const r = calcTotal({ ...a.specs, fuel: v }, await getSettings());
    const p = r.customsParts;
    return ctx.editMessageText(
      [
        `📋 <b>확인</b>`,
        `${esc(a.model)} · ${a.specs.year} · ${kmText(a.specs.km)} · ${FUELS[v].ko}${a.specs.cc ? ` · ${a.specs.cc}cc` : ""}`,
        `한국가 ${won(a.specs.priceWon)} (${usd(r.car)})`,
        ``,
        `한국 쪽 비용 ${usd(r.korea)} · 운송 ${usd(r.ship)}`,
        `통관 ${usd(r.customs)} (관세 ${usd(p.duty)} · 부가세 ${usd(p.vat)} · 재활용세 ${usd(p.util)} · 수수료·인증 ${usd(p.fee + p.cert)})`,
        `KOCAR 수수료 ${usd(r.kocar)}`,
        `<b>타슈켄트 도착 ≈ ${usd(r.total)}</b> (차 나이 ${r.age}년)`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("✅ 올리기", "a:ok").text("✏️ 다시", "a:redo").text("❌ 취소", "a:cancel") }
    );
  }
});

// 대표가 보낸 글: 링크면 올리기 시작, 올리는 중이면 다음 단계
admin.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const url = findUrl(text);
  if (url) {
    ctx.session.add = { url, step: "model" };
    return ctx.reply(`🔗 ${sourceOf(url)} 링크 받았어요. 차종은?`, { reply_markup: modelKb(), link_preview_options: { is_disabled: true } });
  }
  const a = ctx.session.add;
  if (a?.step === "modeltype") {
    a.model = text.trim().slice(0, 60);
    return askSpecs(ctx);
  }
  if (a?.step === "specs") {
    const specs = parseSpecs(text);
    if (!specs) return ctx.reply("❌ 숫자를 못 읽었어요. 예: <code>2022 4.8만 2150 1999</code>", { parse_mode: "HTML" });
    a.specs = specs;
    a.step = "fuel";
    const kb = new InlineKeyboard();
    Object.entries(FUELS).forEach(([k, f]) => kb.text(f.ko, `a:f:${k}`));
    return ctx.reply(`연식 ${specs.year} · ${kmText(specs.km)} · ${won(specs.priceWon)}${specs.cc ? ` · ${specs.cc}cc` : ""}\n연료는?`, { reply_markup: kb });
  }
  return ctx.reply(ADMIN_HELP, { parse_mode: "HTML" });
});
admin.on("message", (ctx) => ctx.reply(ADMIN_HELP, { parse_mode: "HTML" }));

// ═════════ 손님 글 → 상담방 ═════════
pmAny.on("message", async (ctx) => {
  if (isTeam(ctx.from.id) && !isKorean(ctx.from.id)) return ctx.reply("ℹ️ 손님 상담은 상담방 주제 안에서 해 주세요.");
  ctx.session.lang ??= detectLang(ctx.from.language_code);
  const lang = ctx.session.lang;
  const f = ctx.session.find;
  if (f?.step === "modeltype" && ctx.message.text) {
    f.model = ctx.message.text.trim().slice(0, 60);
    return askBudget(ctx, false);
  }
  ctx.session.find = null;
  let c = await touchCustomer(ctx.from, lang);
  if (!groupId()) return ctx.reply(t(lang, "msgSent"));
  const copied = await inTopic(ctx.api, c, (tid) => ctx.api.copyMessage(groupId(), ctx.chat.id, ctx.message.message_id, { message_thread_id: tid }));
  c = (await getCustomer(c.id)) ?? c;
  const ko = await toKorean(ctx.message.text ?? ctx.message.caption);
  if (ko && copied?.message_id) {
    await ctx.api
      .sendMessage(groupId(), `🇰🇷 ${esc(ko)}`, {
        message_thread_id: c.threadId, parse_mode: "HTML", disable_notification: true,
        reply_parameters: { message_id: copied.message_id, allow_sending_without_reply: true },
      })
      .catch(() => {});
  }
  const first = !c.everWrote;
  const hourly = !c.lastAckAt || Date.now() - c.lastAckAt > 3600_000;
  await saveCustomer({ ...c, everWrote: true, lastInAt: Date.now(), ...(first || hourly ? { lastAckAt: Date.now() } : {}) });
  if (first) await ctx.reply(t(lang, "msgFirst"), { reply_markup: menu(lang) });
  else if (hourly) await ctx.reply(t(lang, "msgSent"));
});

// ═════════ 상담방: 직원·대표 답장 → 손님 ═════════
bot.on("message", async (ctx) => {
  if (ctx.chat.id !== groupId() || !ctx.message.is_topic_message) return;
  if (!isTeam(ctx.from?.id)) return;
  const text = ctx.message.text ?? ctx.message.caption ?? "";
  if (text.startsWith("//") || text.startsWith("/")) return; // 메모·명령
  const custId = await customerOfThread(ctx.message.message_thread_id);
  if (!custId) return;
  try {
    await ctx.api.copyMessage(custId, ctx.chat.id, ctx.message.message_id);
    await ctx.react("👍").catch(() => {});
  } catch (err) {
    await ctx.reply(`⚠️ 손님에게 못 보냈어요 (봇을 차단했을 수 있어요): ${err.description ?? err.message}`, {
      message_thread_id: ctx.message.message_thread_id,
    });
  }
});

bot.catch((err) => console.error("봇 오류:", err.error?.description ?? err.error?.message ?? err.message));
