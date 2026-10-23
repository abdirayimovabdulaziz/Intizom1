# Kunlik Yordamchi — Zamonaviy Telegram Mini App Dizayni va UX Arxitekturasi

Kunlik Yordamchi ilovasini rasmiy Telegram Mini App (TMA) standartlariga to'liq moslashtirgan holda, bir qo'l bilan boshqarishga (thumb-friendly ergonomics) mo'ljallangan, toza quyuq (Deep Slate & Sky Blue) vizual tilda va blokli qulay vidjetlar tizimida yangilash.

### User Review & Critical Decisions

> [!IMPORTANT] 
> Foydalanuvchi bilan quyidagi asosiy dizayn qarorlari kelishib olindi va tasdiqlandi:

- **Ranglar palitrasi va mavzu**: Telegram ekotizimiga mos, ko'zni toliqtirmaydigan Deep Slate (#0B1120 / #0F172A) fon, havorang (Sky-500) asosiy urg'u, salomatlik qabullari uchun zumrad (Emerald-500) va xarajatlar uchun binafsharang (Indigo/Violet) aksentlar.
- **Bosh sahifa tartibi**: Mutaxassis tavsiyasiga ko'ra **Blokli va vidjetli tartib** — ekranning yuqori qismida kunlik tezkor hisobot kartasi, pastroqda esa 4 ta ixcham vidjet: (1) Bugungi eng muhim vazifalar, (2) Kunlik qabullar (Kreatin, Arginin, Asalli suv), (3) Katta maqsadlar qoldig'i (300 - 30 = 270 qoldi), (4) Bugungi xarajatlar monitoringi.
- **Navigatsiya**: Telegram mobil ilovalarining oltin standarti hisoblangan **Pastki suzuvchi menyu (Floating Bottom Navigation Bar)** — barcha asosiy bo'limlarga (`Bosh sahifa`, `Vazifalar`, `Odatlar`, `Xarajatlar`, `Maqsadlar`) bir harakat bilan o'tish imkoniyati.

---

### 1. Overview & Core Concept

- **Nima beradi**: Foydalanuvchiga Telegram Mini App ichida chalg'ituvchi ortiqcha elementlarsiz, bir qarashda bugungi kunning bor holatini ko'rish, bir marta bosish (1-tap) bilan odat yoki vazifani bajarish, maqsadlar qoldig'ini kuzatish imkonini beruvchi silliq va yengil interfeys.
- **Maqsadli auditoriya**: Telegram orqali kundalik ishlarini, odatlarini (kreatin, sport, kitob) va shaxsiy byudjetini intizom bilan boshqarishni xohlovchi o'zbekzabon foydalanuvchilar.
- **Asosiy qulaylik**: Minimal chertishlar soni (Zero-friction UX) — hech qanday ortiqcha sahifa yuklanishlarisiz barcha asosiy amallar to'g'ridan-to'g'ri bosh sahifada yoki pastki tablar orqali hal bo'ladi.

---

### 2. User Experience & Visual Design

#### A. Vizual uslub va ranglar tizimi (60-30-10 qoidasi)
- **60% Asosiy fon (Canvas)**: Chuqur qorong'i slate (`#0B132B` / `#0F172A`), tungi va kunduzgi sharoitda ko'zga qulay.
- **30% Strukturaviy yuzalar (Cards & Surfaces)**: Yumshoq chegarali silliq kartalar (`#1E293B`, `border-slate-800/80`), `rounded-2xl` (16px) va `rounded-3xl` (24px) radiuslar.
- **10% Maqsadli aksentlar**:
  - Havorang (`Sky-500` / `#0EA5E9`): Asosiy navigatsiya, faol tablar va vazifalar;
  - Zumrad yashil (`Emerald-400` / `#10B981`): Salomatlik qabullari (Kreatin, Arginin, Asalli suv) va muvaffaqiyat holatlari;
  - Amber sariq (`Amber-400` / `#F59E0B`): Ketma-ketlik olovi (Streak 🔥) va eslatmalar;
  - Qizg'ish pushti (`Rose-400` / `#F43F5E`): Kamaytirish/ozish maqsadlari va shoshilinch vazifalar.

#### B. Typografiya va kontrast
- Shrift: Zamonaviy geometrik sans-serif (`system-ui, -apple-system, sans-serif`), sonlar uchun tabular proporsiya (`font-mono tabular-nums`).
- Ierarxiya:
  - Bosh sarlavha: `text-xl font-bold tracking-tight text-white`;
  - Blok sarlavhalari: `text-sm font-semibold text-slate-200`;
  - Asosiy matn: `text-xs text-slate-300`;
  - Yordamchi metama'lumot: `text-[11px] text-slate-400` (hech qanday keraksiz tabletka/pill qoplamalarsiz, nuqtali `·` ajratuvchilar bilan).

#### C. Bosh sahifa vidjetlar arxitekturasi (Dashboard Layout)
1. **Header (Yuqori bar)**:
   - Chapda: Foydalanuvchi ismi va bugungi sana (masalan: `Abdulaziz · Juma, 24-oktabr`);
   - O'ngda: Telegram bot rejimiga tezkor o'tish tugmasi va mini bildirishnoma qo'ng'irog'i.
2. **Bugungi xulosa stantsiyasi (Hero KPI Strip)**:
   - Bajarilgan vazifalar: `3/5 ta`;
   - Kunlik qabullar: `100% bajarildi (3/3)`;
   - Bugungi xarajat: `67 000 so'm`;
   - Maqsad sarlavhasi: `270 bet qoldi`.
3. **1-vidjet: "Bugungi Vazifalar"**:
   - Vaqti bo'yicha tartiblangan, bitta bosishda checkbox bilan bajariladigan, kechiktirish imkoniga ega kartalar.
4. **2-vidjet: "Salomatlik & Qabullar"**:
   - `5g Kreatin`, `L-Arginin`, `Nahorga asalli suv` — har biri uchun tezkor "Qabul qilindi" tugmasi va streak hisoblagichi.
5. **3-vidjet: "Katta Maqsadlar Qoldig'i"**:
   - Masalan: *O'tgan kunlar* (300 - 30 = 270 bet qoldi) va *Vazn tashlash* (90kg -> 88kg, 3kg qoldi).
6. **4-vidjet: "Kunlik Xarajatlar"**:
   - Bugungi sarflangan summa, toifalar va "+ Yangi xarajat" tezkor kiritish maydoni.

#### D. Pastki suzuvchi menyu (Ergonomik 5 ta asosiy bo'lim — Yangilangan)
- Ekranning eng quyi qismida, barmog'ingiz osongina yetadigan qulay zonada (Thumb-zone) joylashadi:
  - 🏠 **Bosh sahifa** (Asosiy xulosa, bugungi qabullar, tezkor statistika)
  - ✅ **Vazifalar** (Kunlik ishlar va bugun bajarilishi kerak bo'lgan odatlar/qabullar tezkor belgilanadi)
  - 📅 **Kalendar** (To'liq oylik reja taqvimi, sanalar bo'yicha vazifalar)
  - 💰 **Xarajatlar** (Kunlik sarflar va oylik byudjet tahlili)
  - 🎯 **Maqsad & Odat** (Katta maqsadlar qoldig'i 300 - 30 = 270 va kunlik odatlar bazasi bitta bo'limda)
- **Sozlamalar (⚙️)**: Pastki menyudan yuqori o'ng Header burchagiga va Bosh sahifaning profil vidjetiga ko'chirildi. Bu mobil UX standartida barmoq adashishini bartaraf etadi.
- **Odatlarni Vazifalarda belgilash**: Foydalanuvchi Vazifalar sahifasiga kirishi bilanoq bugun qabul qilinishi kerak bo'lgan kreatin, asalli suv, mutolaa kabi odatlarni bitta bosish (1-tap checkbox) bilan belgilay oladi, boshqa bo'limga o'tib yurish talab etilmaydi.
- Har bir tab uchun teng 20% en va kamida 46px o'lchamdagi qulay bosish maydoni (touch target), faol holatda yorqin havorang indikator.

---

### 3. Key Product Decisions & Trade-Offs

- **Qaror 1: Pastki suzuvchi menyu vs Yuqori gorizontal tablar**
  - *Tanlangan yondashuv*: Pastki suzuvchi navigatsiya paneli (Bottom Navigation Bar).
  - *Sababi*: Telegram mobil foydalanuvchilarining 90% dan ortig'i bir qo'lda (bosh barmoq bilan) ishlatadi. Yuqori gorizontal menyularga barmog' yetkazish noqulaylik tug'diradi.
- **Qaror 2: "Hammasi birda" bosh sahifa vs Alohida bo'lingan sahifalar**
  - *Tanlangan yondashuv*: Bosh sahifada 4 ta yo'nalishning (Vazifa, Qabul, Maqsad, Xarajat) eng dolzarb qismi jamlangan vidjetlar, chuqur tahlil va to'liq ro'yxatlar esa pastki tablar orqali ochiladi.
  - *Sababi*: Foydalanuvchi ilovani ochishi bilan barcha bugungi rejalarini 3 soniya ichida ko'radi, har bir bo'limga alohida kirib chiqishga majbur bo'lmaydi.
- **Qaror 3: Qorong'i mavzu (Deep Slate)**
  - *Tanlangan yondashuv*: Yuqori kontrastli qorong'i rejim.
  - *Sababi*: Telegram qorong'i mavzusi bilan uyg'unlashadi, batareyani tejaydi va kechki payt ko'zga qulay.

---

### 4. Technical Architecture & Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Telegram Mini App Shell                      │
├─────────────────────────────────────────────────────────────────┤
│ Top App Bar: [Foydalanuvchi profili] · [Telegram Botga o'tish]  │
├─────────────────────────────────────────────────────────────────┤
│                      Asosiy Kontent Maydoni                     │
│                                                                 │
│  ┌─ TabBoshSahifa (Dashboard) ───────────────────────────────┐  │
│  │  ├─ Kunlik Xulosa Strip (Vazifa, Odat, Xarajat foizi)     │  │
│  │  ├─ 1. Bugungi Vazifalar Vidjeti (Tezkor Check)           │  │
│  │  ├─ 2. Salomatlik & Qabullar Vidjeti (Kreatin, Suv)       │  │
│  │  ├─ 3. Katta Maqsadlar Qoldiq Vidjeti (300-30=270 qoldi)  │  │
│  │  └─ 4. Bugungi Xarajatlar Vidjeti (Summa va toifalar)     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ TabVazifalar (Bir martalik ishlar, muddat, kechiktirish)─┐  │
│  ┌─ TabOdatlar (Kreatin, salomatlik, streak, haftalik grid) ─┐  │
│  ┌─ TabHarajatlar (Kategoriya, limit shkalasi, kunlik/oylik) ┐  │
│  ┌─ TabMaqsadlar (Sub-habits, progress tarixi, undo, qoldiq) ┐  │
│  └─ TabSozlamalar (JSON zaxira, vaqt mintaqasi, bot sozlama) ┘  │
├─────────────────────────────────────────────────────────────────┤
│ Floating Bottom Navigation Bar (44px+ hitboxes, blur-md)        │
│ [🏠 Asosiy]  [✅ Ishlar]  [🔁 Odatlar]  [💰 Xarajat]  [🎯 Maqsad]│
└─────────────────────────────────────────────────────────────────┘
```

#### Komponentlar va holat boshqaruvi:
- `src/components/miniapp/MiniAppShell.tsx`: Telegram mobil ekrani ramkasi, yangilangan Top Bar va pastki suzuvchi `BottomNavigation` paneli.
- `src/components/miniapp/TabBoshSahifa.tsx`: 4 ta blokli zamonaviy vidjetlardan iborat mukammal bosh sahifa.
- `src/components/miniapp/TabVazifalar.tsx`: Vazifalar uchun yangilangan kartalar va kechiktirish (snooze) menyusi.
- `src/components/miniapp/TabOdatlar.tsx`: Salomatlik qabullari (kreatin, arginin, nahorga suv) uchun alohida e'tibor qaratilgan zamonaviy kartalar.
- `src/components/miniapp/TabMaqsadlar.tsx`: Katta maqsadlar qoldig'i, sub-habits va bekor qilish (undo) tarixi bilan boyitilgan interfeys.
- `src/components/miniapp/TabHarajatlar.tsx`: Xarajatlar dinamikasi va toifalar bo'yicha chiroyli diagrammali ko'rinish.
