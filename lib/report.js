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

  if (allCategories.length > 0) {
    text += `\n<b>Mavzular bo'yicha taqsimot:</b>\n`;
    for (const [name, count] of allCategories) {
      const pct = Math.round((count / totalReports) * 100);
      text += `• ${name} — ${pct}% (${count} ta hisobotda)\n`;
    }
  }

  return text;
}
