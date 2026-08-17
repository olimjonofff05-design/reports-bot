import { sendMessage } from "../lib/telegram.js";
import { looksLikeReport, parseReport } from "../lib/parser.js";
import { insertReport } from "../lib/supabase.js";
import { buildReport } from "../lib/report.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const update = req.body;
    const message = update.message;

    if (!message || !message.text || message.from?.is_bot) {
      res.status(200).send("OK");
      return;
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // --- Buyruqlar ---
    if (text.startsWith("/start")) {
      await sendMessage(
        chatId,
        `Salom! 👋 Meni guruhingizga a'zo qilib qo'ysangiz, "Top mavzu" formatidagi ` +
          `har bir hisobotni avtomatik kuzatib, bazaga yozib boraman.\n\n` +
          `📊 Hisobot olish uchun:\n` +
          `/hisobot bugun\n/hisobot hafta\n/hisobot oy\n` +
          `/hisobot 01.08.2026 15.08.2026 (istalgan sana oralig'i)`
      );
      res.status(200).send("OK");
      return;
    }

    if (text.startsWith("/hisobot")) {
      const args = text.replace(/^\/hisobot(@\w+)?/i, "").trim();
      const report = await buildReport(chatId, args);
      await sendMessage(chatId, report);
      res.status(200).send("OK");
      return;
    }

    // --- Oddiy xabar: hisobotga o'xshaydimi, tekshiramiz ---
    if (looksLikeReport(text)) {
      const parsed = parseReport(text);
      await insertReport({
        chatId,
        employeeName: parsed.employeeName,
        conversationsCount: parsed.conversationsCount,
        topicText: parsed.topicText,
        rawText: text,
      });
      // Guruhda ortiqcha shovqin qilmaslik uchun javob yozmaymiz — jim qabul qilamiz.
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
}
