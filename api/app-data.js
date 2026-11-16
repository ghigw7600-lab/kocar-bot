// 미니앱 데이터: 판매 중인 매물 + 차마다 타슈켄트 도착가 계산 결과
import { allCars, sourceOf } from "../src/cars.js";
import { getSettings, calcTotal } from "../src/calc.js";

// 봇 아이디는 텔레그램에 직접 물어서 씀 (환경변수 철자가 틀려도 버튼이 엉뚱한 봇으로 가지 않게)
let botName = null;
async function botUsername() {
  if (botName) return botName;
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`).then((x) => x.json());
    botName = r.result?.username ?? null;
  } catch {}
  return botName ?? process.env.BOT_USERNAME ?? null;
}

export default async function handler(req, res) {
  try {
    const [cars, s, bot] = await Promise.all([allCars(), getSettings(), botUsername()]);
    const list = cars.map((c) => ({
      id: c.id,
      no: c.no,
      model: c.model,
      brand: c.model.split(" ")[0],
      year: c.year,
      km: c.km,
      fuel: c.fuel,
      cc: c.cc,
      priceWon: c.priceWon,
      url: c.url,
      source: sourceOf(c.url),
      checkedAt: c.checkedAt,
      calc: calcTotal(c, s),
    }));
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ bot, usdKrw: s.usdKrw, cars: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
}
