// 손님 기록 + 상담방 주제 (손님 한 명 = 주제 하나) — GIEC 봇 방식을 줄인 것
import { kv } from "./storage.js";

export const groupId = () => Number(process.env.CONSULT_GROUP_ID) || null;
export const esc = (s = "") => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const getCustomer = (id) => kv.get(`cust:${id}`);
export async function saveCustomer(c) {
  await kv.set(`cust:${c.id}`, c);
  return c;
}
export const customerOfThread = (tid) => kv.get(`thread:${tid}`);

export async function touchCustomer(from, lang) {
  const cur = (await getCustomer(from.id)) ?? { id: from.id, createdAt: Date.now() };
  return saveCustomer({
    ...cur,
    name: [from.first_name, from.last_name].filter(Boolean).join(" ") || "—",
    username: from.username ?? null,
    lang: lang ?? cur.lang ?? "uz",
  });
}

async function ensureTopic(api, c) {
  if (c.threadId) return c;
  if (!(await kv.setNX(`lock:${c.id}`, 1, 15))) {
    for (let i = 0; i < 6; i++) {
      await sleep(700);
      const again = await getCustomer(c.id);
      if (again?.threadId) return again;
    }
  }
  const gid = groupId();
  if (!gid) throw new Error("CONSULT_GROUP_ID 가 없어요");
  const flag = c.lang === "ru" ? "🇷🇺" : "🇺🇿";
  const topic = await api.createForumTopic(gid, `${flag} ${c.name}`.slice(0, 120));
  const saved = await saveCustomer({ ...((await getCustomer(c.id)) ?? c), threadId: topic.message_thread_id });
  await kv.set(`thread:${topic.message_thread_id}`, c.id);
  await kv.del(`lock:${c.id}`);
  let head = `👤 <a href="tg://user?id=${c.id}">${esc(c.name)}</a>`;
  if (c.username) head += ` (@${esc(c.username)})`;
  head += `\n🌐 ${c.lang === "ru" ? "러시아어" : "우즈벡어"}`;
  await api.sendMessage(gid, head, { message_thread_id: topic.message_thread_id, parse_mode: "HTML" });
  return saved;
}

// 주제에 보내기 (주제가 지워졌으면 새로 만들어 다시)
export async function inTopic(api, c, send) {
  c = await ensureTopic(api, c);
  try {
    return await send(c.threadId);
  } catch (err) {
    if (!/thread not found|TOPIC_DELETED|TOPIC_ID_INVALID/i.test(err.description ?? err.message)) throw err;
    await kv.del(`thread:${c.threadId}`);
    c = await ensureTopic(api, await saveCustomer({ ...c, threadId: null }));
    return send(c.threadId);
  }
}

export const postCard = (api, c, html) =>
  inTopic(api, c, (tid) => api.sendMessage(groupId(), html, { message_thread_id: tid, parse_mode: "HTML" }));
