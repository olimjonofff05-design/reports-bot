import { deleteOldReports } from "../lib/supabase.js";

// Vercel Cron (vercel.json'dagi "crons") har kuni shu endpoint'ni chaqiradi
// va bazadagi 2 oydan katta yozuvlarni o'chiradi — joy band bo'lib
// qolmasligi uchun.
//
// Vercel Cron so'rovlariga avtomatik "Authorization: Bearer <CRON_SECRET>"
// header'i qo'shadi (CRON_SECRET environment variable orqali). Shu yerda
// tekshiramiz — tashqaridan kimdir bu endpoint'ni chaqirib, ma'lumotlarni
// bexosdan o'chirib yubormasligi uchun.
export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send("Unauthorized");
    return;
  }

  const ok = await deleteOldReports(2);
  res.status(ok ? 200 : 500).send(ok ? "OK" : "Cleanup failed");
}
