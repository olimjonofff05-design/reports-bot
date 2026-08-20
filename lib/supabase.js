const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
}

export async function insertReport({ chatId, messageId, employeeName, conversationsCount, topicText, rawText }) {
  const res = await fetch(`${BASE}/rest/v1/daily_reports`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
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
