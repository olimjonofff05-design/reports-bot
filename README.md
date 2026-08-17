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

/hisobot bugun | hafta | oy | "01.08.2026 15.08.2026"
        │
        ▼
Supabase'dan shu davrdagi hisobotlar olinadi → jamlanadi → TOP 5 mavzu
foiz bilan hisoblanadi → guruhga chiroyli formatda javob yoziladi.
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

Brauzerda oching (TOKEN va domeningizni almashtiring):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domeningiz>.vercel.app/api/webhook&secret_token=<SECRET>
```

## 7-qadam: Botni guruhga qo'shish

Botni guruhingizga oddiy a'zo sifatida qo'shing (admin qilish shart emas — Privacy Mode
o'chirilgan bo'lsa, oddiy a'zolik yetarli).

## Foydalanish

- Guruhda kimdir "Top mavzu: ..." formatidagi hisobot yuborsa — bot uni jimgina qabul qiladi.
- Istalgan vaqt: `/hisobot bugun`, `/hisobot hafta`, `/hisobot oy`, yoki
  `/hisobot 01.08.2026 15.08.2026` — shu davr uchun jami murojaatlar va TOP 5 mavzu
  foiz bilan chiqadi.

## Muhim eslatma: tahlil sifatining chegarasi

Xodimlarning "Top mavzu" yozish uslubi juda xilma-xil (imlo xatolari, turli formatlar,
o'zbek/rus aralash). Bot kalit so'zlar (katm, exit, limit, ortiqcha to'lov va h.k.) bo'yicha
avtomatik moslashtiradi — bu iyun/iyul oylarida qo'lda qilingan tahlil bilan bir xil mantiq,
lekin 100% aniqlik kafolatlanmaydi. Agar yangi, hozircha tanilmagan mavzu turi ko'p
takrorlana boshlasa, `lib/parser.js` faylidagi `CATEGORIES` ro'yxatiga yangi qator qo'shish
orqali kengaytirish mumkin.
