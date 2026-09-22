const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
}

export async function insertReport({ chatId, messageId, telegramUserId, employeeName, conversationsCount, topicText, rawText }) {
  const res = await fetch(`${BASE}/rest/v1/daily_reports`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      telegram_user_id: telegramUserId,
      employee_name: employeeName,
      conversations_count: conversationsCount,
      topic_text: topicText,
      raw_text: rawText,
    }),
  });
  if (!res.ok) {
    console.error("insertReport failed:", await res.text());
  }
  return res.ok;
}

// Telegram'dan "message_reaction" update kelganda chaqiriladi. reacted'ni
// belgilaydi (yoki hamma reaktsiya olib tashlansa — qaytadan false qiladi,
// chunki Telegram bo'sh new_reaction bilan ham shu update'ni yuboradi).
export async function markReacted(chatId, messageId, reacted, reactionTypes) {
  const url =
    `${BASE}/rest/v1/daily_reports?chat_id=eq.${chatId}` +
    `&message_id=eq.${messageId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      reacted,
      reaction_types: reactionTypes || null,
    }),
  });
  if (!res.ok) {
    console.error("markReacted failed:", await res.text());
  }
  return res.ok;
}

// 2 oydan katta yozuvlarni o'chiradi — bazada joy band qilib turmasligi
// uchun /api/cleanup (Vercel Cron) tomonidan har kuni chaqiriladi.
export async function deleteOldReports(monthsAgo = 2) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);

  const url = `${BASE}/rest/v1/daily_reports?created_at=lt.${encodeURIComponent(
    cutoff.toISOString()
  )}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...headers(), Prefer: "return=minimal" },
  });
  if (!res.ok) {
    console.error("deleteOldReports failed:", await res.text());
  }
  return res.ok;
}

// from/to: ISO date-time string oralig'i
export async function getReports(chatId, from, to) {
  const url =
    `${BASE}/rest/v1/daily_reports?chat_id=eq.${chatId}` +
    `&created_at=gte.${encodeURIComponent(from)}` +
    `&created_at=lte.${encodeURIComponent(to)}` +
    `&order=created_at.asc`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.error("getReports failed:", await res.text());
    return [];
  }
  return res.json();
}

// Berilgan davrda hisobot yuborgan (telegram_user_id aniq bo'lgan)
// foydalanuvchilarning ID to'plamini qaytaradi — "kim hali yubormadi"
// eslatmasi uchun ishlatiladi.
export async function getReportedUserIds(chatId, from, to) {
  const url =
    `${BASE}/rest/v1/daily_reports?chat_id=eq.${chatId}` +
    `&created_at=gte.${encodeURIComponent(from)}` +
    `&created_at=lte.${encodeURIComponent(to)}` +
    `&telegram_user_id=not.is.null&select=telegram_user_id`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.error("getReportedUserIds failed:", await res.text());
    return new Set();
  }
  const rows = await res.json();
  return new Set(rows.map((r) => r.telegram_user_id));
}

// --- group_members: eslatma/tag funksiyasi uchun guruh a'zolari ro'yxati ---

// Guruhdan xabar kelgan har safar chaqiriladi — yuboruvchini ro'yxatga
// qo'shadi yoki ism/username'ini yangilaydi. is_excluded ustuni bu yerda
// JO'NATILMAYDI, shuning uchun mavjud qiymati (admin /notag orqali
// qo'ygan belgi) upsert paytida qayta yozilmaydi/o'chmaydi.
export async function upsertGroupMember({ chatId, userId, username, fullName }) {
  const res = await fetch(`${BASE}/rest/v1/group_members`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
      username: username || null,
      full_name: fullName || null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    console.error("upsertGroupMember failed:", await res.text());
  }
  return res.ok;
}

// /notag (excluded=true) yoki /tagback (excluded=false) buyrug'i orqali
// chaqiriladi. Foydalanuvchi hali ro'yxatda bo'lmasa (hech qachon
// yozmagan), hech narsa yangilanmaydi — shuning uchun bu funksiyani
// chaqirishdan oldin webhook.js avval upsertGroupMember'ni chaqiradi.
export async function setMemberExcluded(chatId, userId, excluded) {
  const url = `${BASE}/rest/v1/group_members?chat_id=eq.${chatId}&user_id=eq.${userId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ is_excluded: excluded, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    console.error("setMemberExcluded failed:", await res.text());
  }
  return res.ok;
}

export async function getGroupMembers(chatId) {
  const url = `${BASE}/rest/v1/group_members?chat_id=eq.${chatId}&order=full_name.asc`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.error("getGroupMembers failed:", await res.text());
    return [];
  }
  return res.json();
}

// Eslatma cron'i qaysi guruh(lar)ga xabar yuborishi kerakligini bilishi
// uchun — group_members jadvalida qatnashgan barcha chat_id'lar.
export async function getAllChatIds() {
  const url = `${BASE}/rest/v1/group_members?select=chat_id`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.error("getAllChatIds failed:", await res.text());
    return [];
  }
  const rows = await res.json();
  return [...new Set(rows.map((r) => r.chat_id))];
}
