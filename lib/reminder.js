import { getAllChatIds, getGroupMembers, getReportedUserIds } from "./supabase.js";
import { escapeHtml } from "./telegram.js";

// O'zbekiston (Asia/Tashkent, UTC+5) bo'yicha "bugun"ning boshlanishini va
// hozirgi vaqtni UTC ISO satr qilib qaytaradi. Vercel funksiyalari UTC'da
// ishlaydi, shuning uchun bu offset serverning o'z vaqt zonasidan
// qat'i nazar to'g'ri natija berishi uchun qo'lda hisoblanadi.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function getTashkentTodayRangeUTC() {
  const now = new Date();
  const tashkentNow = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  const y = tashkentNow.getUTCFullYear();
  const m = tashkentNow.getUTCMonth();
  const d = tashkentNow.getUTCDate();
  const tashkentMidnightUTC = new Date(Date.UTC(y, m, d) - TASHKENT_OFFSET_MS);
  return { from: tashkentMidnightUTC.toISOString(), to: now.toISOString() };
}

// members: group_members qatorlari, reportedUserIds: shu kunda hisobot
// yuborgan telegram_user_id'lar to'plami. is_excluded=true (masalan
// rahbarlar) bo'lganlar har doim chiqarib tashlanadi.
export function findMissingMembers(members, reportedUserIds) {
  return members.filter((m) => !m.is_excluded && !reportedUserIds.has(m.user_id));
}

// Har bir odamni Telegram'ning "tap-to-mention" havolasi orqali tag
// qiladi (tg://user?id=...) — bu username bo'lmagan foydalanuvchilarda
// ham ishlaydi va odamga bildirishnoma keladi.
export function formatReminderMessage(missingMembers) {
  const mentions = missingMembers
    .map((m) => {
      const name = escapeHtml(m.full_name || m.username || `id${m.user_id}`);
      return `<a href="tg://user?id=${m.user_id}">${name}</a>`;
    })
    .join(", ");

  return (
    `Hurmatli ))) :\n${mentions}\n\n` +
    `Bugungi kun uchun hisobot yubormadingiz, yubormasangiz tushuntirish xati yozishga majbur bo'lasiz!\n` +
    `Iltifotli bo'lib yuborib qo'ying iltimos )))`
  );
}

// Bitta chat uchun: kim hali hisobot yubormaganini aniqlaydi va shularga
// mo'ljallangan eslatma matnini qaytaradi. Hech kim qolmagan bo'lsa (yoki
// bu chatda umuman a'zo qayd etilmagan bo'lsa) — null qaytaradi, ya'ni
// xabar yuborilmaydi.
export async function buildReminderForChat(chatId) {
  const members = await getGroupMembers(chatId);
  if (!members.length) return null;

  const { from, to } = getTashkentTodayRangeUTC();
  const reportedUserIds = await getReportedUserIds(chatId, from, to);

  const missing = findMissingMembers(members, reportedUserIds);
  if (!missing.length) return null;

  return formatReminderMessage(missing);
}

export async function getAllChatsWithMembers() {
  return getAllChatIds();
}
