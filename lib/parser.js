// Bitta "Daily report" xabarini tahlil qiladi va undan:
//   - xodim ismi (iloji bo'lsa)
//   - suhbatlar/murojaatlar soni
//   - "Top mavzu" matni
// larni ajratib oladi.

// Xabar "hisobot" ekanligini aniqlash uchun signatura: ichida "Sana:"
// (yoki "Дата:") yorlig'i VA "Suhbat(lar)" so'zi bo'lishi kerak — bular
// shablonning doim mavjud bo'ladigan ikkita qismi. "Top mavzu:" yorlig'i
// esa ATAYLAB talab QILINMAYDI — ba'zi xodimlar muammolarni "Top mavzu:"
// deb belgilamasdan, to'g'ridan-to'g'ri ro'yxat qilib yozib yuboradi, va
// bunday xabarlar avval noto'g'ri "hisobot emas" deb o'tkazib yuborilgan.
export function looksLikeReport(text) {
  if (!text) return false;
  const hasSanaWord = /sana\s*[:;]|сана\s*[:;]|дата\s*[:;]/i.test(text);
  const hasSuhbatWord = /suha?bat\w*|суха?бат\w*|сут+бат\w*/i.test(text);
  return hasSanaWord && hasSuhbatWord;
}

export function parseReport(text) {
  const employeeName = extractEmployeeName(text);
  const conversationsCount = extractConversationsCount(text);
  const topicText = extractTopicText(text);
  return { employeeName, conversationsCount, topicText };
}

function extractEmployeeName(text) {
  // "Sana" so'zidan oldingi birinchi mazmunli qatorni ism deb olamiz
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (/sana|сана|дата/i.test(line)) break;
    if (/^ism\s*[:;]/i.test(line)) return line.replace(/^ism\s*[:;]/i, "").trim();
    if (line.length > 1 && line.length < 60 && !/^\d/.test(line)) {
      return line;
    }
  }
  return null;
}

function extractConversationsCount(text) {
  // "Suhbat(lar)"/"сухбат(лар)" so'zi joylashgan qatordan va undan keyingi
  // yana bitta qatordan (jami eng ko'pi bilan 2 qator) raqamlarni yig'amiz
  // — bu "kiruvchi 66 chiquvchi 24" yoki "Исходящие 86 Входящие 10" kabi
  // ikkiga bo'lingan holatlarni ham qamrab oladi. Atayin faqat 2 qator
  // bilan chegaralanadi: "Top mavzu:" yorlig'i bo'lmagan hisobotlarda
  // (masalan muammolar to'g'ridan-to'g'ri ro'yxat qilinganda) pastdagi
  // erkin matndagi raqamlar (masalan "1) ...") sonni noto'g'ri
  // oshirib yubormasligi uchun.
  // "suha?bat"/"суха?бат" — "h"/"х" dan keyin ortiqcha "a" qo'shib yozish
  // ("Suhabatlar") xodimlar orasida uchraydigan keng tarqalgan xato,
  // shuning uchun bu variant ham tanilsin deb ixtiyoriy qilib qo'yilgan.
  const regex = /(?:suha?bat\w*|суха?бат\w*|сут+бат\w*)/gi;
  let match;
  let total = 0;
  let found = false;

  while ((match = regex.exec(text)) !== null) {
    let chunk = text.slice(match.index).split("\n").slice(0, 2).join("\n");
    // "Top mavzu" boshlangan joydan kesib tashlaymiz — mavzu matnidagi
    // raqamlar (masalan ro'yxat belgilari "1).") aralashib ketmasligi uchun.
    const topicStart = chunk.search(/top\s*mavzu|топ\s*мавзу|to'?p\s*mavzu/i);
    if (topicStart !== -1) chunk = chunk.slice(0, topicStart);

    const numbers = chunk.match(/\d+/g);
    if (numbers) {
      found = true;
      total += numbers.slice(0, 2).reduce((sum, n) => sum + parseInt(n, 10), 0);
    }
  }

  return found ? total : 0;
}

function extractTopicText(text) {
  const explicitMatch = text.match(
    /(?:top\s*mavzu|топ\s*мавзу|to'?p\s*mavzu)[^\n:;\-]*[:;\-]?\s*([\s\S]*)/i
  );
  if (explicitMatch) return explicitMatch[1].trim().slice(0, 800);

  // "Top mavzu:" yorlig'i topilmasa (Odinaning misolidagi kabi) — "Suhbat"
  // qatoridan keyingi QOLGAN BARCHA matnni (odatda muammolar ro'yxati)
  // mavzu matni sifatida olamiz, aks holda bunday hisobotlar statistikada
  // "mavzu aniqlanmagan" bo'lib butunlay yo'qolib qolar edi.
  const suhbatMatch = text.match(/suha?bat\w*|суха?бат\w*|сут+бат\w*/i);
  if (!suhbatMatch) return "";
  const lineEnd = text.indexOf("\n", suhbatMatch.index);
  if (lineEnd === -1) return "";
  return text.slice(lineEnd + 1).trim().slice(0, 800);
}

// Toifalar bo'yicha kalit so'zlar — iyun/iyul tahlillarida ishlatilgan
// bir xil mantiq. Kerak bo'lsa shu ro'yxatga yangi toifa qo'shish kifoya.
export const CATEGORIES = [
  { key: "KATM", patterns: [/katm/i, /ktm/i, /катм/i, /ктм/i] },
  {
    key: "Exit (investorlar puli)",
    patterns: [/exit/i, /investor/i, /инвест/i, /инв\b/i],
  },
  {
    key: "To'lov ko'rinmasligi / yechib olinmasligi",
    patterns: [/ko'?rinm/i, /korinm/i, /куринма/i, /корин/i, /yech/i, /йеч/i],
  },
  {
    key: "Ortiqcha to'lov",
    patterns: [/ortiqcha/i, /ортикча/i, /ортиқча/i, /коп пул/i, /куп пул/i],
  },
  { key: "Limit muammolari", patterns: [/limit/i] },
];

export function matchedCategories(topicText) {
  return CATEGORIES.filter((cat) => cat.patterns.some((p) => p.test(topicText)));
}
