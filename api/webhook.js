import { sendMessage, getChatMember, escapeHtml } from "../lib/telegram.js";
import { looksLikeReport, parseReport } from "../lib/parser.js";
import {
  insertReport,
  markReacted,
  upsertGroupMember,
  setMemberExcluded,
  getGroupMembers,
} from "../lib/supabase.js";
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

    // --- Xabarga bosilgan/olib tashlangan reaktsiya ---
    // Buni olish uchun bot guruhda ADMIN bo'lishi va webhook
    // allowed_updates ro'yxatida "message_reaction" bo'lishi shart
    // (README'dagi 6-qadamga qarang).
    if (update.message_reaction) {
      await handleReaction(update.message_reaction);
      res.status(200).send("OK");
      return;
    }

    const message = update.message;

    if (!message || !message.from || message.from.is_bot) {
      res.status(200).send("OK");
      return;
    }

    const chatId = message.chat.id;
    const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";

    // --- A'zolar ro'yxatini yangilab boramiz ---
    // "Hisobot yubormaganlarga eslatma" funksiyasi shu ro'yxatga tayanadi,
    // shuning uchun guruhda yozgan HAR bir odamni (buyruq bo'lsa ham,
    // hisobot bo'lsa ham, oddiy suhbat bo'lsa ham) shu yerda qayd etamiz.
    if (isGroup) {
      await upsertGroupMember({
        chatId,
        userId: message.from.id,
        username: message.from.username,
        fullName: fullNameOf(message.from),
      });
    }

    // Guruhga yangi odam(lar) qo'shilganda ham darhol ro'yxatga olamiz —
    // shunda ular hali birorta xabar yozmagan bo'lsa ham eslatmaga tushadi.
    if (isGroup && message.new_chat_members?.length) {
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;
        await upsertGroupMember({
          chatId,
          userId: member.id,
          username: member.username,
          fullName: fullNameOf(member),
        });
      }
    }

    if (!message.text) {
      res.status(200).send("OK");
      return;
    }

    const text = message.text.trim();

    // Telegram buyrug'ining aniq nomini ajratib olamiz ("/notag" va
    // "/notaglist" kabi bir-biriga o'xshash buyruqlar aralashib
    // ketmasligi uchun startsWith() emas, aniq mos kelishni tekshiramiz).
    // "@BotName" qo'shimchasi (guruhda botni chaqirishda qo'shilishi
    // mumkin) ham hisobga olinadi.
    const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();

    // --- Buyruqlar ---
    if (command === "/start") {
      await sendMessage(
        chatId,
        `Salom! 👋 Meni guruhingizga a'zo qilib qo'ysangiz, "Top mavzu" formatidagi ` +
          `har bir hisobotni avtomatik kuzatib, bazaga yozib boraman.\n\n` +
          `📊 Hisobot olish uchun:\n` +
          `/hisobot bugun\n/hisobot hafta\n/hisobot oy\n` +
          `/hisobot 01.08.2026 15.08.2026 (istalgan sana oralig'i)\n\n` +
          `🔕 Kimnidir kunlik eslatmalarda tag qilinmaydigan qilish uchun ` +
          `(masalan rahbarlar): o'sha odamning xabariga REPLY qilib /notag deb yozing ` +
          `(faqat adminlar uchun). Qaytarish — /tagback. Ro'yxatni ko'rish — /notaglist.`
      );
      res.status(200).send("OK");
      return;
    }

    if (command === "/hisobot") {
      const args = text.replace(/^\/hisobot(@\w+)?/i, "").trim();
      const report = await buildReport(chatId, args);
      await sendMessage(chatId, report);
      res.status(200).send("OK");
      return;
    }

    if (command === "/notag") {
      await handleExcludeCommand(chatId, message, true);
      res.status(200).send("OK");
      return;
    }

    if (command === "/tagback") {
      await handleExcludeCommand(chatId, message, false);
      res.status(200).send("OK");
      return;
    }

    if (command === "/notaglist") {
      await handleNotagList(chatId);
      res.status(200).send("OK");
      return;
    }

    // --- Oddiy xabar: hisobotga o'xshaydimi, tekshiramiz ---
    if (looksLikeReport(text)) {
      const parsed = parseReport(text);
      await insertReport({
        chatId,
        messageId: message.message_id,
        telegramUserId: message.from.id,
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

// Telegram "message_reaction" update'i:
// { chat, message_id, date, old_reaction: [...], new_reaction: [...] }
// new_reaction bo'sh bo'lsa — foydalanuvchi reaktsiyani olib tashlagan.
async function handleReaction(reaction) {
  const chatId = reaction.chat?.id;
  const messageId = reaction.message_id;
  if (!chatId || !messageId) return;

  const newReaction = reaction.new_reaction || [];
  const reacted = newReaction.length > 0;
  const emojiList = newReaction
    .map((r) => r.emoji || r.custom_emoji_id || r.type)
    .filter(Boolean)
    .join(",");

  await markReacted(chatId, messageId, reacted, emojiList);
}

function fullNameOf(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

// /notag va /tagback — shu odamning xabariga REPLY qilib yuborilishi
// shart ("kimni" ekanini shu orqali bilamiz). Faqat guruh administratori
// yoki egasi ishlata oladi — bo'lmasa xodimlarning o'zi bir-birini
// eslatmadan yashirib qo'yishi mumkin bo'lardi.
async function handleExcludeCommand(chatId, message, excluded) {
  const target = message.reply_to_message?.from;
  if (!target) {
    await sendMessage(
      chatId,
      excluded
        ? "❗️ Kimnidir tag ro'yxatidan chiqarish uchun o'sha odamning xabariga REPLY qilib /notag deb yozing."
        : "❗️ Kimnidir qayta tag ro'yxatiga qo'shish uchun o'sha odamning xabariga REPLY qilib /tagback deb yozing."
    );
    return;
  }

  if (target.is_bot) {
    await sendMessage(chatId, "❗️ Botlarni ro'yxatga qo'shib/chiqarib bo'lmaydi.");
    return;
  }

  const requester = await getChatMember(chatId, message.from.id);
  const isAdmin = requester && ["creator", "administrator"].includes(requester.status);
  if (!isAdmin) {
    await sendMessage(chatId, "❌ Bu buyruqni faqat guruh administratorlari ishlata oladi.");
    return;
  }

  const fullName = fullNameOf(target) || target.username || `id${target.id}`;

  // Agar bu odam hali group_members'da bo'lmasa (masalan hech qachon
  // o'zi yozmagan, faqat shu bir marta xabar yuborgan bo'lsa), avval
  // ro'yxatga qo'shib olamiz, shundan keyingina belgilaymiz.
  await upsertGroupMember({ chatId, userId: target.id, username: target.username, fullName });
  await setMemberExcluded(chatId, target.id, excluded);

  await sendMessage(
    chatId,
    excluded
      ? `✅ ${escapeHtml(fullName)} endi kunlik eslatma xabarlarida tag qilinmaydi.`
      : `✅ ${escapeHtml(fullName)} endi kunlik eslatma xabarlarida qayta tag qilinadi.`
  );
}

async function handleNotagList(chatId) {
  const members = await getGroupMembers(chatId);
  const excluded = members.filter((m) => m.is_excluded);
  if (!excluded.length) {
    await sendMessage(chatId, "Hozircha tag qilinmaydigan ro'yxatda hech kim yo'q.");
    return;
  }
  const lines = excluded.map((m) => `• ${escapeHtml(m.full_name || m.username || `id${m.user_id}`)}`);
  await sendMessage(chatId, `🔕 <b>Tag qilinmaydigan foydalanuvchilar:</b>\n${lines.join("\n")}`);
}
