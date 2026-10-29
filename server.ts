import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini SDK if API key is present
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    aiConfigured: !!ai,
    timestamp: new Date().toISOString(),
    appName: 'Kunlik Yordamchi API',
  });
});

// NLP parsing endpoint using Gemini 3.8 Flash
app.post('/api/parse-nlp', async (req: Request, res: Response) => {
  try {
    const { text, currentDate } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text kiritilishi shart' });
      return;
    }

    if (!ai) {
      // Server-side fallback flag to prompt client rule parser
      res.json({
        success: false,
        fallbackToLocal: true,
        message: 'Gemini API kaliti aniqlanmadi, lokal qoidalar ishlatiladi',
      });
      return;
    }

    const referenceDate = currentDate || new Date().toISOString().split('T')[0];
    const prompt = `
Siz o'zbek tilidagi shaxsiy yordamchi ("Kunlik Yordamchi") uchun matnlarni tahlil qiluvchi AI tizimisiz.
Bugungi sana: ${referenceDate}. Vaqt zonasi: Asia/Tashkent (UTC+5).

Foydalanuvchi quyidagi matnni kiritdi: "${text}"

QOIDALAR:
1. Foydalanuvchi aytmagan summa, doza, vaqt yoki takrorlanish qoidasini o'ylab topmang (masalan: "kreatin" yozilgan bo'lsa, dosage: null qoldiring, "5 gram" yasab olmang).
2. Daromad ("daromad: 500000 ish haqi", "oylik tushdi", "kirim:") kiritilsa, isIncome: true belgilang va uni harajat qilib yaratmang.
3. "kunora" kiritilsa, isInterval: true belgilang va uni daily deb saqlamang.
4. Bir matnda bir nechta amal bo'lsa (masalan: "tushlik 45000 va 5g kreatin"), isMultipleActions: true belgilang.
5. Pul va valyuta: UZS (so'm) yoki USD ($ / dollar). Masalan: "12.50 dollar" -> amount: 12.5, currency: "USD".
6. Takrorlanish:
   - "haftasiga 3 kun zal" -> category: "odat", frequency: "weekly_target", targetDaysPerWeek: 3
   - "har dushanba va juma 20 bet kitob" -> category: "odat", frequency: "specific_days", daysOfWeek: [1, 5], quantity: 20, unit: "sahifa"
   - "har kuni 60 daqiqa yurish" -> category: "odat", frequency: "daily", quantity: 60, unit: "daqiqa"

Qat'iy faqat quyidagi JSON formatida qaytaring:
{
  "category": "harajat" | "qabul" | "vazifa" | "odat" | "maqsad" | "uchrashuv" | "noaniq",
  "title": string,
  "amount": number | null,
  "currency": "UZS" | "USD" | null,
  "expenseCategory": string | null,
  "dosage": string | null,
  "timeSlot": string | null,
  "date": string | null,
  "time": string | null,
  "quantity": number | null,
  "unit": string | null,
  "frequency": "daily" | "weekly_target" | "specific_days" | null,
  "targetDaysPerWeek": number | null,
  "daysOfWeek": number[] | null,
  "isIncome": boolean,
  "isInterval": boolean,
  "isMultipleActions": boolean,
  "explanationUz": string,
  "confidence": number
}
`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI tahlilida vaqt tugadi (timeout)')), 3000);
    });

    try {
      const response = await Promise.race([generatePromise, timeoutPromise]);
      const parsedJson = JSON.parse(response.text || '{}');
      res.json({
        success: true,
        parsed: parsedJson,
        source: 'gemini-ai',
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error: any) {
    console.warn('NLP parse using local fallback:', error?.message);
    res.json({
      success: false,
      fallbackToLocal: true,
      message: 'Lokal qoidalar ishlatiladi',
    });
  }
});

// Weekly review and smart insights endpoint
app.post('/api/weekly-review', async (req: Request, res: Response) => {
  try {
    const { completedTasksCount, pendingTasksCount, habitStats, goalStats } = req.body;

    if (!ai) {
      res.json({
        success: false,
        fallbackToLocal: true,
        summary: `Hafta davomida ${completedTasksCount || 0} ta vazifa bajarildi, ${pendingTasksCount || 0} ta vazifa qoldi. Odatlar bo'yicha intizom davom etmoqda. Omad!`,
      });
      return;
    }

    const prompt = `
Siz "Kunlik Yordamchi" ilovasining shaxsiy murabbiyisiz (coach).
Foydalanuvchining so'nggi haftalik natijalari:
- Bajarilgan vazifalar: ${completedTasksCount || 0} ta
- Qoldirilgan/kutilayotgan vazifalar: ${pendingTasksCount || 0} ta
- Odatlar holati: ${JSON.stringify(habitStats || [])}
- Maqsadlar holati: ${JSON.stringify(goalStats || [])}

O'zbek tilida ilhomlantiruvchi, samimiy va amaliy 3-4 jumlali haftalik sarhisob (Weekly Review) va kelasi hafta uchun 2 ta aniq maslahat yozib bering. Markdown formatida qaytaring.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      reviewText: response.text,
    });
  } catch (error: any) {
    console.error('Weekly review error:', error);
    res.status(500).json({
      success: false,
      fallbackToLocal: true,
      error: error?.message,
    });
  }
});

// Serve frontend in dev using Vite middlewares, or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kunlik Yordamchi server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
