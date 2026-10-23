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

Matndan quyidagilarni ajrating va FAQAT belgilangan JSON formatida qaytaring:
- category:
  * "harajat" (pul sarfi, xarajat, masalan: "harajat: 45000 tushlik", "sarf: 120000 taksi", "50000 so'm kitob")
  * "qabul" (kunlik salomatlik, dori, vitamin, qo'shimchalar, masalan: "5g kreatin", "l-arginin", "ertalab asalli suv", "vitamin D")
  * "vazifa" (bir marta bajariladigan ish, topshiriq)
  * "odat" (takrorlanadigan umumiy odat)
  * "maqsad" (uzoq muddatli strategik natija)
  * "uchrashuv" (aniq uchrashuv tadbiri)
  * "noaniq"
- title: toza nomi (soat, sana, summa va kalit so'zlarsiz)
- amount: raqam (agar harajat bo'lsa so'm miqdori, masalan 45000 yoki null)
- expenseCategory: agar harajat bo'lsa "oziq_ovqat" | "transport" | "salomatlik" | "sport" | "talim" | "shaxsiy" | "boshqa" yoki null
- dosage: qabul bo'lsa miqdori (masalan: "5 gram", "1 stakan", "3 kapsula" yoki null)
- timeSlot: qabul vaqti (masalan: "Ertalab nahorga", "Mashg'ulotdan oldin", "Mashg'ulotdan keyin", "Kechqurun" yoki null)
- date: "YYYY-MM-DD" formati
- time: "HH:mm" 24-soatlik vaqt yoki null
- quantity: raqam yoki null
- unit: o'lchov birligi (sahifa, daqiqa, litr, gram, km, yoki null)
- explanationUz: Foydalanuvchiga tushunarli o'zbekcha qisqa izoh
- confidence: 0 dan 1 gacha

Qat'iy faqat JSON qaytaring:
{
  "category": "harajat" | "qabul" | "vazifa" | "odat" | "maqsad" | "uchrashuv" | "noaniq",
  "title": string,
  "amount": number | null,
  "expenseCategory": string | null,
  "dosage": string | null,
  "timeSlot": string | null,
  "date": string | null,
  "time": string | null,
  "quantity": number | null,
  "unit": string | null,
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

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI tahlilida vaqt tugadi (timeout)')), 3000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const parsedJson = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      parsed: parsedJson,
      source: 'gemini-ai',
    });
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
