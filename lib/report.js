import { getReports } from "./supabase.js";
import { matchedCategories } from "./parser.js";

// "bugun" | "hafta" | "oy" | "DD.MM.YYYY DD.MM.YYYY" -> { from, to, label }
export function resolvePeriod(argsText) {
  const now = new Date();
  const trimmed = (argsText || "").trim();

  // Ikkita sana berilgan bo'lsa: 01.08.2026 15.08.2026
  const rangeMatch = trimmed.match(
    /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2})\.(\d{2})\.(\d{4})/
  );
  if (rangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
    const from = new Date(`${y1}-${m1}-${d1}T00:00:00`);
    const to = new Date(`${y2}-${m2}-${d2}T23:59:59`);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${d1}.${m1}.${y1} — ${d2}.${m2}.${y2}`,
    };
  }

  const keyword = trimmed.toLowerCase() || "bugun";

  if (keyword === "hafta") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString(), to: now.toISOString(), label: "Oxirgi 7 kun" };
  }

  if (keyword === "oy") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString(), to: now.toISOString(), label: "Shu oy" };
  }

  // default: bugun
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: from.toISOString(), to: now.toISOString(), label: "Bugun" };
}

export async function buildReport(chatId, argsText) {
  const { from, to, label } = resolvePeriod(argsText);
  const rows = await getReports(chatId, from, to);

  if (!rows.length) {
    return `📊 <b>${label}</b> uchun hali hech qanday hisobot qabul qilinmagan.`;
  }

  const totalReports = rows.length;
  const totalConversations = rows.reduce(
    (sum, r) => sum + (r.conversations_count || 0),
    0
  );

  const noReactionCount = rows.filter((r) => !r.reacted).length;
  const noReactionPct = Math.round((noReactionCount / totalReports) * 100);

  const categoryCounts = {};
  for (const row of rows) {
    const cats = matchedCategories(row.topic_text || "");
    for (const cat of cats) {
      categoryCounts[cat.key] = (categoryCounts[cat.key] || 0) + 1;
    }
  }

  // Barcha aniqlangan mavzular — cheklovsiz, ko'p uchraganidan kamiga qarab.
  const allCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  let text = `📊 <b>${label}</b> bo'yicha hisobot\n\n`;
  text += `🗂 Jami hisobotlar soni: <b>${totalReports}</b>\n`;
  text += `💬 Jami murojaatlar (suhbatlar) soni: <b>${totalConversations}</b>\n`;
  text += `👀 Reaktsiyasiz qolgan hisobotlar: <b>${noReactionCount} ta (${noReactionPct}%)</b>\n`;

  const leaderboard = buildLeaderboard(rows);
  if (leaderboard.length > 0) {
    text += `\n🏆 <b>Faollik reytingi (suhbatlar soni bo'yicha):</b>\n`;
    text += formatLeaderboard(leaderboard);
  }

  if (allCategories.length > 0) {
    text += `\n<b>Mavzular bo'yicha taqsimot:</b>\n`;
    for (const [name, count] of allCategories) {
      const pct = Math.round((count / totalReports) * 100);
      text += `• ${name} — ${pct}% (${count} ta hisobotda)\n`;
    }
  }

  return text;
}

// Har bir hodim bo'yicha davr ichidagi hisobotlardagi suhbatlar sonini
// yig'ib, kamayish tartibida reyting tuzadi. Ism aniqlanmagan (null/bo'sh)
// hisobotlar reytingga kiritilmaydi — ular jami statistikada baribir bor.
//
// Bir xil hodim turli xabarlarda ozgina boshqacha yozilishi mumkin
// ("Muxlis", "muxlis", " Muxlis "), shuning uchun kichik harf + probelsiz
// ko'rinishi bo'yicha guruhlaymiz, lekin ko'rsatishda eng ko'p uchragan
// yozilish variantini ishlatamiz.
function buildLeaderboard(rows) {
  const byEmployee = new Map();

  for (const row of rows) {
    const rawName = (row.employee_name || "").trim();
    if (!rawName) continue;

    const key = rawName.toLowerCase();
    if (!byEmployee.has(key)) {
      byEmployee.set(key, { total: 0, reportsCount: 0, nameVariants: new Map() });
    }
    const entry = byEmployee.get(key);
    entry.total += row.conversations_count || 0;
    entry.reportsCount += 1;
    entry.nameVariants.set(rawName, (entry.nameVariants.get(rawName) || 0) + 1);
  }

  const list = [];
  for (const entry of byEmployee.values()) {
    let displayName = "";
    let bestCount = -1;
    for (const [variant, count] of entry.nameVariants) {
      if (count > bestCount) {
        bestCount = count;
        displayName = variant;
      }
    }
    list.push({ displayName, total: entry.total, reportsCount: entry.reportsCount });
  }

  list.sort((a, b) => b.total - a.total);
  return list;
}

const MEDALS = ["🥇", "🥈", "🥉"];

// Reytingni matn qilib formatlaydi. Maqsad — top'ni maqtash, pastda
// turganlarni esa urushtirmasdan, do'stona yo'naltirish (jazolash emas).
function formatLeaderboard(list) {
  let out = "";
  list.forEach((item, i) => {
    const marker = MEDALS[i] || `${i + 1}.`;
    out += `${marker} ${item.displayName} — ${item.total} ta suhbat (${item.reportsCount} kunlik hisobot)\n`;
  });

  if (list.length > 3) {
    out += `\n💡 Rahmat, hammaga! Har bir suhbat — mijozga bir qadam yaqinlashish. Keyingi davrda yana yuqoriga intilamiz 🙌\n`;
  }

  return out;
}
