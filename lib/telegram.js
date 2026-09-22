const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId, text, options = {}) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("sendMessage failed:", data);
  }
  return data;
}

// /notag va /tagback buyrug'ini faqat guruh administratorlari ishlata
// olishini tekshirish uchun.
export async function getChatMember(chatId, userId) {
  const res = await fetch(`${TELEGRAM_API}/getChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("getChatMember failed:", data);
    return null;
  }
  return data.result; // { status: "creator" | "administrator" | "member" | ..., user: {...} }
}

// Xabarlarni parse_mode "HTML" bilan yuboramiz, shuning uchun
// foydalanuvchi ismi/username ichida "<", ">", "&" bo'lib qolsa, butun
// xabar Telegram tomonidan rad etilib qolmasligi uchun ekranlaymiz.
export function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
