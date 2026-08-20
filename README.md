# IMAN Reports Bot — guruhdagi kunlik hisobotlarni avtomatik tahlil qiluvchi bot

Botni Telegram guruhingizga a'zo qilib qo'yasiz. U guruhdagi har bir "Top mavzu" formatidagi
xabarni **avtomatik, jimgina** o'qib, bazaga yozib boradi. Keyin istalgan vaqt oralig'i uchun
`/hisobot` buyrug'i bilan — nechta hisobot kelgani, jami nechta murojaat bo'lgani va
TOP mavzular foiz nisbatida qanday ekanini so'raysiz.

## Qanday ishlaydi

```
Guruhdagi har bir xabar
        │
        ▼
Telegram → Vercel /api/webhook
        │
        ├─ "mavzu" so'zi va raqam bormi? Yo'q bo'lsa — e'tiborsiz qoldiriladi.
        └─ Bor bo'lsa: ism, suhbatlar soni, "Top mavzu" matni ajratib olinadi
           va Supabase'ga jimgina saqlanadi (guruhga javob yozilmaydi).

Xuddi shu xabarga reaktsiya bosilsa/olinsa
        │
        ▼
Telegram → Vercel /api/webhook (message_reaction)
        │
        └─ Supabase'dagi shu yozuv "reacted = true/false" qilib yangilanadi.

/hisobot bugun | hafta | oy | "01.08.2026 15.08.2026"
        │
        ▼
Supabase'dan shu davrdagi hisobotlar olinadi → jamlanadi → reaktsiyasiz qolganlar
soni va barcha mavzular foiz bilan hisoblanadi → guruhga chiroyli formatda javob yoziladi.

Har kuni 00:00 (Vercel Cron)
        │
        ▼
/api/cleanup → Supabase'dagi 2 oydan katta yozuvlar o'chiriladi.
```

## 1-qadam: Yangi Telegram bot yaratish

1. @BotFather'ga `/newbot` yozing, nom va username bering, tokenni saqlab qo'ying.

## 2-qadam: MUHIM — Privacy Mode'ni o'chiring

Standart holatda Telegram botlari guruhdagi **barcha** xabarlarni ko'ra olmaydi — faqat
o'ziga yo'llangan buyruqlarni. Bizga esa bot **har bir xabarni** ko'rishi kerak. Buni
o'zgartirish shart:

1. @BotFather'ga qayting, `/mybots` → botingizni tanlang
2. **Bot Settings** → **Group Privacy** → **Turn off**

⚠️ **Bu qadamni botni guruhga qo'shishdan OLDIN bajaring.** Agar bot allaqachon guruhga
qo'shilgan bo'lsa, privacy'ni o'chirgandan keyin botni guruhdan chiqarib, qayta qo'shish kerak
bo'ladi (Telegram'ning o'zi shunday talab qiladi).

## 3-qadam: Supabase jadvali

Mavjud Supabase loyihangizning **SQL Editor**'ida `sql/schema.sql` faylining butun matnini
ishga tushiring (yangi Supabase loyihasi shart emas).

## 4-qadam: Kodni GitHub'ga joylash

```bash
cd reports-bot
git add -A
git commit -m "Initial commit: reports analytics bot"
```

GitHub'da yangi bo'sh repository yarating, so'ng:
```bash
git remote add origin https://github.com/<username>/<repo-nomi>.git
git branch -M main
git push -u origin main
```

## 5-qadam: Vercel'ga deploy

1. vercel.com → Add New → Project → shu repo → Import
2. Environment Variables qo'shing: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
3. Deploy

## 6-qadam: Webhookni ulash

Brauzerda oching (TOKEN va domeningizni almashtiring). `allowed_updates`ga e'tibor
bering — u bo'lmasa, bot reaktsiyalar haqida umuman xabar olmaydi:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domeningiz>.vercel.app/api/webhook&secret_token=<SECRET>&allowed_updates=["message","message_reaction"]
```

## 7-qadam: Botni guruhga qo'shish va ADMIN qilish

Botni guruhingizga qo'shing.

⚠️ **Reaktsiyalarni kuzatish uchun bot ADMIN bo'lishi SHART.** Oddiy a'zolikda Telegram
reaktsiya update'larini botga umuman yubormaydi — bu Telegram'ning o'z cheklovi, koddagi
sozlamaga bog'liq emas. Guruh a'zolari ro'yxatidan botni administrator qiling (maxsus
huquqlar berish shart emas — faqat administrator ro'yxatida bo'lishi kifoya).

## 8-qadam: CRON_SECRET (avtomatik tozalash uchun)

Vercel loyihasiga yana bitta Environment Variable qo'shing: `CRON_SECRET` (istalgan uzun
tasodifiy qator, masalan parol generatoridan). Vercel buni `/api/cleanup`ga har kunlik
chaqiruvda avtomatik `Authorization: Bearer <CRON_SECRET>` header'i sifatida qo'shadi —
shu orqali bu endpoint faqat Vercel Cron'dan chaqirilishini ta'minlaymiz.

## Foydalanish

- Guruhda kimdir "Top mavzu: ..." formatidagi hisobot yuborsa — bot uni jimgina qabul qiladi.
- Kimdir shu xabarga Telegram reaktsiya (❤️👍✅ va h.k.) qo'ysa — bot buni ham jimgina
  qayd etadi (bot guruhda ADMIN bo'lishi shart, 7-qadamga qarang).
- Istalgan vaqt: `/hisobot bugun`, `/hisobot hafta`, `/hisobot oy`, yoki
  `/hisobot 01.08.2026 15.08.2026` — shu davr uchun jami murojaatlar, reaktsiyasiz qolgan
  hisobotlar soni va **barcha** aniqlangan mavzular foiz bilan (cheklovsiz) chiqadi.

## Eski ma'lumotlarni avtomatik o'chirish

Bazada joy band bo'lib qolmasligi uchun `daily_reports` jadvalidagi **2 oydan katta**
yozuvlar avtomatik o'chiriladi. Buni Vercel Cron (`vercel.json`dagi `crons`) har kuni
soat 00:00'da `/api/cleanup` endpoint'ini chaqirish orqali bajaradi — qo'lda hech narsa
qilish shart emas, faqat 8-qadamdagi `CRON_SECRET`ni sozlab qo'yishni unutmang.

> Eslatma: Vercel Hobby (bepul) tarifida Cron Jobs kuniga 1 marta ishlaydi — bu bizga
> yetarli. Agar Vercel'da Cron Jobs funksiyasi loyihangizda o'chirilgan bo'lsa, uni
> Project → Settings → Cron Jobs bo'limidan yoqib qo'ying.

## Muhim eslatma: tahlil sifatining chegarasi

Xodimlarning "Top mavzu" yozish uslubi juda xilma-xil (imlo xatolari, turli formatlar,
o'zbek/rus aralash). Bot kalit so'zlar (katm, exit, limit, ortiqcha to'lov va h.k.) bo'yicha
avtomatik moslashtiradi — bu iyun/iyul oylarida qo'lda qilingan tahlil bilan bir xil mantiq,
lekin 100% aniqlik kafolatlanmaydi. Agar yangi, hozircha tanilmagan mavzu turi ko'p
takrorlana boshlasa, `lib/parser.js` faylidagi `CATEGORIES` ro'yxatiga yangi qator qo'shish
orqali kengaytirish mumkin.
