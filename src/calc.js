// ═════════════════════════════════════════════════════════════
//  🧮 타슈켄트 도착가 계산기
//   차값 + 한국 쪽 비용 + 운송 + 우즈벡 통관(관세·부가세·재활용세·수수료·인증) + KOCAR 수수료
//
//   ⚠️ 기본값은 인터넷 자료(2026-11 확인) 기준이라 현지 관세사에게 꼭 확인할 것.
//      대표가 봇에서 /set 으로 바꾸면 그 값이 저장됨 (코드 수정 필요 없음)
//   관세 = 차값(달러) × % + 배기량 × $/cc  (둘을 더함 — vc.ru 2026 계산 예시 기준)
//   부가세 = (차값 + 관세) × 12%
//   재활용세 = BRV × 개수 (배기량·연식별) ÷ 환율(숨/달러)
// ═════════════════════════════════════════════════════════════
import { kv } from "./storage.js";

export const DEFAULTS = {
  usdKrw: 1400, // 원/달러
  uzsUsd: 11900, // 숨/달러
  brvUzs: 440000, // 1 BRV (2026-09-01부터, vc.ru)
  koreaWon: 500000, // 한국 쪽 비용: 수출말소·탁송·관세사 등 (확인 필요)
  shipUsd: 2000, // 한국 → 타슈켄트 운송 (확인 필요)
  kocarUsd: 1000, // KOCAR 수수료 (대표가 정할 것)
  certUsd: 350, // 인증·검사
  feeBrv: 1, // 통관 수수료 (BRV)
  vatPct: 12,
  // 연식별 관세: 1년 이하 / 1~3년 / 3년 초과
  dutyPctNew: 15, dutyCcNew: 1.0,
  dutyPctMid: 30, dutyCcMid: 2.0,
  dutyPctOld: 40, dutyCcOld: 3.0,
  // 재활용세 BRV — 배기량 1000 / 2000 / 3000 / 3500 / 그 이상 (3년 이하, 3년 초과)
  utilNew: [30, 120, 180, 240, 300],
  utilOld: [90, 210, 315, 420, 525], // 1000·2000 은 vc.ru, 나머지는 추정 (확인 필요)
  utilEv: 30,
};

// 대표가 고칠 수 있는 항목 (봇 /set 이름 → 설명)
export const SETTING_LABELS = {
  usdKrw: "환율 원/달러",
  uzsUsd: "환율 숨/달러",
  brvUzs: "1 BRV (숨)",
  koreaWon: "한국 쪽 비용 (원)",
  shipUsd: "운송비 ($)",
  kocarUsd: "KOCAR 수수료 ($)",
  certUsd: "인증·검사 ($)",
  feeBrv: "통관 수수료 (BRV)",
  vatPct: "부가세 (%)",
  dutyPctNew: "관세 % (1년 이하)", dutyCcNew: "관세 $/cc (1년 이하)",
  dutyPctMid: "관세 % (1~3년)", dutyCcMid: "관세 $/cc (1~3년)",
  dutyPctOld: "관세 % (3년 초과)", dutyCcOld: "관세 $/cc (3년 초과)",
  utilNew: "재활용세 BRV 3년 이하 (1000/2000/3000/3500/초과cc)",
  utilOld: "재활용세 BRV 3년 초과 (1000/2000/3000/3500/초과cc)",
  utilEv: "재활용세 BRV 전기차",
};

export async function getSettings() {
  return { ...DEFAULTS, ...((await kv.get("settings")) ?? {}) };
}

export async function setSetting(key, raw) {
  if (!(key in DEFAULTS)) return null;
  let value;
  if (Array.isArray(DEFAULTS[key])) {
    value = String(raw).split(/[\s,/]+/).filter(Boolean).map(Number);
    if (value.length !== DEFAULTS[key].length || value.some((n) => !Number.isFinite(n))) return null;
  } else {
    value = Number(String(raw).replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 0) return null;
  }
  const cur = (await kv.get("settings")) ?? {};
  await kv.set("settings", { ...cur, [key]: value });
  return value;
}

const ccIndex = (cc) => (cc <= 1000 ? 0 : cc <= 2000 ? 1 : cc <= 3000 ? 2 : cc <= 3500 ? 3 : 4);
const r = (n) => Math.round(n);

// car: { priceWon, year, cc, fuel, customsUsd? }
export function calcTotal(car, s, now = new Date()) {
  const age = Math.max(0, now.getFullYear() - Number(car.year || now.getFullYear()));
  const tier = age <= 1 ? "New" : age <= 3 ? "Mid" : "Old";
  const ev = car.fuel === "ev";
  const carUsd = car.priceWon / s.usdKrw;
  const koreaUsd = s.koreaWon / s.usdKrw;

  let customs;
  if (Number(car.customsUsd) > 0) {
    customs = { duty: 0, vat: 0, util: 0, fee: 0, cert: 0, total: Number(car.customsUsd), manual: true };
  } else {
    const cc = Number(car.cc) || 0;
    const duty = ev ? 0 : carUsd * (s[`dutyPct${tier}`] / 100) + cc * s[`dutyCc${tier}`];
    const vat = (carUsd + duty) * (s.vatPct / 100);
    const brv = ev ? s.utilEv : (tier === "Old" ? s.utilOld : s.utilNew)[ccIndex(cc)];
    const util = (brv * s.brvUzs) / s.uzsUsd;
    const fee = (s.feeBrv * s.brvUzs) / s.uzsUsd;
    customs = { duty, vat, util, fee, cert: s.certUsd, total: duty + vat + util + fee + s.certUsd, manual: false };
  }
  const total = carUsd + koreaUsd + s.shipUsd + customs.total + s.kocarUsd;
  return {
    age,
    car: r(carUsd),
    korea: r(koreaUsd),
    ship: r(s.shipUsd),
    customs: r(customs.total),
    customsParts: { duty: r(customs.duty), vat: r(customs.vat), util: r(customs.util), fee: r(customs.fee), cert: r(customs.cert) },
    customsManual: customs.manual,
    kocar: r(s.kocarUsd),
    total: Math.round(total / 100) * 100, // 100달러 단위로 (어림값)
  };
}
