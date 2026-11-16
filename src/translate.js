// ═════════════════════════════════════════════════════════════
//  🇰🇷 학생 글 → 한국어 번역 (2026-11-10, 칸 퇴사 후 대표가 직접 상담)
//   상담방 주제에 학생 글이 올라오면 바로 아래에 회색 답글로 한국어 뜻을 붙임
//   - 무료 구글 번역 주소 사용 (열쇠 필요 없음). 실패하면 조용히 건너뜀
//   - 끄려면 Vercel 환경변수 TRANSLATE=off
// ═════════════════════════════════════════════════════════════
const URL_BASE = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=ko&sl=auto&q=";

export async function toKorean(text) {
  const src = String(text ?? "").trim();
  if (!src || process.env.TRANSLATE === "off") return null;
  if (/^[\p{P}\p{S}\p{N}\s]+$/u.test(src)) return null; // 숫자·이모지·기호만 있으면 번역할 게 없음
  try {
    const res = await fetch(URL_BASE + encodeURIComponent(src.slice(0, 1500)), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[2] === "ko") return null; // 이미 한국어
    const ko = (data?.[0] ?? []).map((part) => part?.[0] ?? "").join("").trim();
    return ko && ko !== src ? ko : null;
  } catch {
    return null;
  }
}
