import { sendMessage } from "../lib/telegram.js";
import { getAllChatsWithMembers, buildReminderForChat } from "../lib/reminder.js";

// Vercel Cron kuniga 3 marta chaqiradi (vercel.json'dagi "crons": 18:00,
// 19:15, 20:30 Toshkent vaqti). Har chaqiruvda ma'lumotlar YANGIDAN
// hisoblanadi — shu oraliqda kimdir hisobot yuborib ulgurgan bo'lsa,
// u keyingi eslatmada endi tag qilinmaydi. Agar hammasi hisobot yuborgan
// bo'lsa, shu chat uchun hech qanday xabar yuborilmaydi.
export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }

  const chatIds = await getAllChatsWithMembers();
  let sentCount = 0;

  for (const chatId of chatIds) {
    try {
      const text = await buildReminderForChat(chatId);
      if (text) {
        await sendMessage(chatId, text);
        sentCount++;
      }
    } catch (err) {
      console.error(`Reminder failed for chat ${chatId}:`, err);
    }
  }

  res.status(200).send(`OK, ${sentCount} ta guruhga eslatma yuborildi`);
}
