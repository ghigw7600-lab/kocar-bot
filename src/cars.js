// 매물 저장 — 대표가 올린 엔카·케이카 링크 + 대표가 입력한 정보만 (사진·글은 긁어 오지 않음)
import { kv } from "./storage.js";

export const FUELS = {
  gasoline: { ko: "가솔린", uz: "Benzin", ru: "Бензин" },
  lpg: { ko: "LPG", uz: "Gaz (LPG)", ru: "Газ (LPG)" },
  hybrid: { ko: "하이브리드", uz: "Gibrid", ru: "Гибрид" },
  ev: { ko: "전기", uz: "Elektr", ru: "Электро" },
  diesel: { ko: "디젤", uz: "Dizel", ru: "Дизель" },
};

// 자주 쓰는 차종 버튼 (브랜드는 앞 단어로 미니앱 필터)
export const MODELS = [
  "Kia K5", "Kia K8", "Kia K3", "Kia Sorento", "Kia Carnival", "Kia Sportage", "Kia EV6", "Kia Niro EV",
  "Hyundai Sonata", "Hyundai Grandeur", "Hyundai Avante", "Hyundai Tucson", "Hyundai Santa Fe", "Hyundai Ioniq 5",
];

export function sourceOf(url) {
  if (/encar\.com/i.test(url)) return "Encar";
  if (/kcar\.com/i.test(url)) return "K Car";
  return "Link";
}

export const findUrl = (text = "") => text.match(/https?:\/\/[^\s]+/i)?.[0] ?? null;

export async function saveCar(car) {
  await kv.set(`car:${car.id}`, car);
  await kv.sadd("cars", car.id);
  return car;
}
export const getCar = (id) => kv.get(`car:${id}`);

export async function allCars({ withSold = false } = {}) {
  const ids = await kv.smembers("cars");
  const list = (await kv.mget(ids.map((id) => `car:${id}`))).filter(Boolean);
  return list
    .filter((c) => withSold || c.status !== "sold")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function removeCar(id) {
  await kv.del(`car:${id}`);
  await kv.srem("cars", id);
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// "2022 4.8만 2150 1999" / "2022 48000km 2,150만 1999cc" → 숫자로
export function parseSpecs(text) {
  const nums = [];
  for (const m of String(text).replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(만)?/g)) {
    nums.push(m[2] ? Number(m[1]) * 10000 : Number(m[1]));
  }
  if (nums.length < 3) return null;
  const [year, km, price, cc] = nums;
  if (year < 1990 || year > 2100) return null;
  // 가격: 만원 단위로 적었으면 (예: 2150) 원으로 바꿈
  const priceWon = price < 100000 ? price * 10000 : price;
  return { year, km, priceWon, cc: cc ?? null };
}
