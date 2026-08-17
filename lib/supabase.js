const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
}

export async function insertReport({ chatId, employeeName, conversationsCount, topicText, rawText }) {
  const res = await fetch(`${BASE}/rest/v1/daily_reports`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      chat_id: chatId,
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
