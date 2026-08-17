// Bitta "Daily report" xabarini tahlil qiladi va undan:
//   - xodim ismi (iloji bo'lsa)
//   - suhbatlar/murojaatlar soni
//   - "Top mavzu" matni
// larni ajratib oladi.

// Xabar "hisobot" ekanligini aniqlash uchun signatura: ichida "mavzu" (yoki
// "мавзу") va kamida bitta raqam bo'lishi kerak. Oddiy chat-suhbatlar bunga
// mos kelmaydi, shuning uchun avtomatik filtr vazifasini o'taydi.
export function looksLikeReport(text) {
  if (!text) return false;
  const hasTopicWord = /mavzu|мавзу/i.test(text);
  const hasDigit = /\d/.test(text);
  return hasTopicWord && hasDigit;
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
  // "Suhbat(lar)"/"сухбат(лар)" so'zidan keyingi 120 belgi ichidagi barcha
  // raqamlarni yig'amiz — bu "kiruvchi 66 chiquvchi 24" yoki
  // "Исходящие 86 Входящие 10" kabi bo'lingan holatlarni ham qamrab oladi.
  const regex = /(?:suhbat\w*|сухбат\w*|сут+бат\w*)/gi;
  let match;
  let total = 0;
  let found = false;

  while ((match = regex.exec(text)) !== null) {
    let chunk = text.slice(match.index, match.index + 130);
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
  const match = text.match(
    /(?:top\s*mavzu|топ\s*мавзу|to'?p\s*mavzu)[^\n:;\-]*[:;\-]?\s*([\s\S]*)/i
  );
  if (!match) return "";
  return match[1].trim().slice(0, 800);
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
