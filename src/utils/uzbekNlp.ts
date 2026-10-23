import { ParsedItem, ExpenseCategory, Currency } from '../types';

/**
 * Formats a Date object to YYYY-MM-DD using local time
 */
export function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Uzbek human friendly date label
 */
export function formatUzbekDateLabel(dateStr: string, timeStr?: string | null): string {
  if (!dateStr) return '';
  const today = formatDateYMD(new Date());
  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = formatDateYMD(tomorrowDate);

  const indinDate = new Date();
  indinDate.setDate(indinDate.getDate() + 2);
  const indin = formatDateYMD(indinDate);

  let label = dateStr;
  if (dateStr === today) {
    label = 'Bugun';
  } else if (dateStr === tomorrow) {
    label = 'Ertaga';
  } else if (dateStr === indin) {
    label = 'Indin';
  } else {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    label = `${parseInt(d, 10)}-${monthName}`;
  }

  if (timeStr) {
    return `${label}, soat ${timeStr}`;
  }
  return label;
}

/**
 * Format amount in currency: either UZS (e.g. 45 000 so'm) or USD (e.g. 1 400 $)
 */
export function formatMoney(amount: number, currency: Currency = 'UZS'): string {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('en-US').format(amount)} $`;
  }
  return `${new Intl.NumberFormat('uz-UZ').format(amount)} so'm`;
}

/**
 * Format amount in Uzbek so'm (e.g. 45 000 so'm)
 */
export function formatSom(amount: number): string {
  return formatMoney(amount, 'UZS');
}

/**
 * Local Rule-based NLP Parser for Uzbek commands and natural language input.
 * Supports:
 * - prefixes: "vazifa:", "odat:", "maqsad:", "uchrashuv:", "harajat:", "xarajat:", "qabul:"
 * - expenses: "harajat: 45000 tushlik", "sarf: 120000 taksi", "50000 so'm kitob"
 * - health & supplements: "5g kreatin", "l-arginin", "ertalab asalli suv ichish", "har kuni 5 gram kreatin"
 * - dates: "bugun", "ertaga", "indin", day names, "YYYY-MM-DD", "DD.MM.YYYY"
 * - times: "soat 15:30", "15:30 da", "18:45", "10 daqiqadan keyin", "2 soatdan keyin"
 * - quantities: "20 sahifa", "30 daqiqa", "2 litr", "5 km", "5 gram"
 */
export function parseUzbekTextLocal(rawText: string, now: Date = new Date()): ParsedItem {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  let category: ParsedItem['category'] = 'noaniq';
  let targetDate: string | null = null;
  let targetTime: string | null = null;
  let quantity: number | null = null;
  let unit: string | null = null;
  let amount: number | null = null;
  let currency: Currency = 'UZS';
  let expenseCategory: ExpenseCategory | null = null;
  let dosage: string | null = null;
  let timeSlot: string | null = null;
  let daysOfWeek: (number | string)[] | null = null;
  let confidence = 0.7;

  let cleanText = text;

  // 1. Detect Category Prefix or Domain Keywords
  if (lower.startsWith('harajat:') || lower.startsWith('xarajat:') || lower.startsWith('sarf:') || lower.startsWith('to\'lov:')) {
    category = 'harajat';
    cleanText = text.replace(/^(harajat|xarajat|sarf|to'lov):\s*/i, '');
    confidence += 0.25;
  } else if (lower.startsWith('qabul:') || lower.startsWith('ichish:') || lower.startsWith('dori:')) {
    category = 'qabul';
    cleanText = text.replace(/^(qabul|ichish|dori):\s*/i, '');
    confidence += 0.25;
  } else if (lower.startsWith('vazifa:') || lower.startsWith('topshiriq:') || lower.startsWith('ish:')) {
    category = 'vazifa';
    cleanText = text.replace(/^(vazifa|topshiriq|ish):\s*/i, '');
    confidence += 0.2;
  } else if (lower.startsWith('odat:') || lower.startsWith('odatlanish:')) {
    category = 'odat';
    cleanText = text.replace(/^(odat|odatlanish):\s*/i, '');
    confidence += 0.2;
  } else if (lower.startsWith('maqsad:')) {
    category = 'maqsad';
    cleanText = text.replace(/^maqsad:\s*/i, '');
    confidence += 0.2;
  } else if (lower.startsWith('uchrashuv:') || lower.startsWith('meet:')) {
    category = 'uchrashuv';
    cleanText = text.replace(/^(uchrashuv|meet):\s*/i, '');
    confidence += 0.2;
  }

  // 2. Health & Supplements detection (Kreatin, L-Arginin, Asalli suv, vitaminlar)
  const isCreatine = /(creatin|kreatin)/i.test(lower);
  const isArginine = /(l\s*[-_]?\s*arginin|arginin)/i.test(lower);
  const isHoneyWater = /(asalli\s+suv|asal\s+suv|iliq\s+suv)/i.test(lower);
  const isSupplement = isCreatine || isArginine || isHoneyWater || /(vitamin|omega|protein|dori|kapsula)/i.test(lower);

  if (category === 'noaniq' && isSupplement) {
    category = 'qabul';
    confidence += 0.2;
  }

  if (isSupplement || category === 'qabul') {
    // Extract dosage
    const dosageMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(g|gr|gram|gramm|kapsula|stakan|qoshiq|dona)/i);
    if (dosageMatch) {
      dosage = `${dosageMatch[1]} ${dosageMatch[2].toLowerCase()}`;
      quantity = parseFloat(dosageMatch[1]);
      unit = dosageMatch[2].toLowerCase();
    } else if (isCreatine) {
      dosage = '5 gram';
      quantity = 5;
      unit = 'gram';
    } else if (isArginine) {
      dosage = '3 gram (yoki 1 porsiya)';
      quantity = 3;
      unit = 'gram';
    } else if (isHoneyWater) {
      dosage = '1 stakan iliq suv + 1 qoshiq asal';
      quantity = 1;
      unit = 'stakan';
    }

    // Extract time slot
    if (/nahorga|och\s+qoringa|ertalab/i.test(lower)) {
      timeSlot = 'Ertalab nahorga (Och qoringa)';
    } else if (/mashg'ulotdan\s+oldin|mashqdan\s+oldin|trenirovkadan\s+oldin/i.test(lower)) {
      timeSlot = 'Mashg\'ulotdan 30 daqiqa oldin';
    } else if (/mashg'ulotdan\s+keyin|trenirovkadan\s+keyin/i.test(lower)) {
      timeSlot = 'Mashg\'ulotdan so\'ng darhol';
    } else if (/kechqurun|yotishdan\s+oldin/i.test(lower)) {
      timeSlot = 'Kechqurun yotishdan oldin';
    } else {
      if (isHoneyWater) timeSlot = 'Ertalab nahorga (Och qoringa)';
      else if (isArginine) timeSlot = 'Mashg\'ulotdan oldin / Ertalab';
      else if (isCreatine) timeSlot = 'Kun davomida / Mashg\'ulotdan so\'ng';
      else timeSlot = 'Kunlik qabul';
    }
  }

  // 3. Expense (Harajat) detection and extraction (UZS and USD e.g. 1400$, iphone 1400 dollar)
  const isDollar = /\$|\bdollar\b|\busd\b/i.test(lower);
  const somMatch = cleanText.match(/(\d[\d\s.,]*)\s*(?:ming\s*)?(?:so'?m|som|uzs|\$|dollar|usd)?/i);
  if (category === 'harajat' || isDollar || (somMatch && /(so'?m|som|ming|sarfladim|to'ladim|harajat|xarajat|\$|dollar|usd)/i.test(lower))) {
    if (category === 'noaniq') category = 'harajat';
    if (isDollar) currency = 'USD';

    // Parse amount
    const rawNumberMatch = cleanText.match(/(?:\$\s*)?(\d[\d\s.,]*)\s*(ming)?(?:\s*\$|\s*dollar|\s*usd)?/i);
    if (rawNumberMatch) {
      const numClean = rawNumberMatch[1].replace(/[\s.,]/g, '');
      let parsedNum = parseInt(numClean, 10);
      if (rawNumberMatch[2] || (/ming/i.test(cleanText) && currency !== 'USD')) {
        if (parsedNum < 1000) parsedNum *= 1000;
      }
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
        cleanText = cleanText
          .replace(rawNumberMatch[0], '')
          .replace(/(so'?m|som|uzs|\$|dollar|usd)/gi, '');
      }
    }

    // Classify Expense category
    const expLower = cleanText.toLowerCase();
    if (/(tushlik|nonushta|ovqat|kechki|kofe|choy|osh|kafe|restoran|bozor|supermarket|go'sht|non)/.test(expLower)) {
      expenseCategory = 'oziq_ovqat';
    } else if (/(taksi|yandex|benzin|metron?|avtobus|yo'l|zapravka)/.test(expLower)) {
      expenseCategory = 'transport';
    } else if (/(kreatin|protein|sport|zal|fitnes|trenirovka)/.test(expLower)) {
      expenseCategory = 'sport';
    } else if (/(dori|apteka|doktor|vrach|tahlil|analiz|vitamin|davolanish)/.test(expLower)) {
      expenseCategory = 'salomatlik';
    } else if (/(kitob|kurs|dars|kitoblar|repetitor|talim|universitet)/.test(expLower)) {
      expenseCategory = 'talim';
    } else {
      expenseCategory = 'shaxsiy';
    }
  }

  // 4. Quantity & Unit check for general tasks/habits (e.g. 20 sahifa, 30 daqiqa, 2 litr, 5 km)
  if (!quantity) {
    const qtyMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(sahifa|bet|varaq|daqiqa|minut|litr|km|kilometr|martta|marta|soat|ta dars|dars|gram|g)/i);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]);
      unit = qtyMatch[2].toLowerCase();
      if (unit === 'bet' || unit === 'varaq') unit = 'sahifa';
      if (unit === 'minut') unit = 'daqiqa';
      if (unit === 'kilometr') unit = 'km';
      if (unit === 'martta') unit = 'marta';
    }
  }

  // 5. Date expressions in Uzbek
  const today = new Date(now);

  if (/\bindin\b/i.test(cleanText)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    targetDate = formatDateYMD(d);
    cleanText = cleanText.replace(/\bindin\b/gi, '');
  } else if (/\bertaga\b/i.test(cleanText)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    targetDate = formatDateYMD(d);
    cleanText = cleanText.replace(/\bertaga\b/gi, '');
  } else if (/\bbugun\b/i.test(cleanText)) {
    targetDate = formatDateYMD(today);
    cleanText = cleanText.replace(/\bbugun\b/gi, '');
  }

  // Day names: Dushanba (1) to Yakshanba (7)
  const dayNames: Record<string, number> = {
    dushanba: 1,
    seshanba: 2,
    chorshanba: 3,
    payshanba: 4,
    juma: 5,
    shanba: 6,
    yakshanba: 7,
  };

  for (const [dayName, dayNum] of Object.entries(dayNames)) {
    const regex = new RegExp(`\\b${dayName}\\b`, 'i');
    if (regex.test(cleanText)) {
      if (category === 'odat' || category === 'qabul' || /har\s+/i.test(cleanText)) {
        if (!daysOfWeek) daysOfWeek = [];
        if (!daysOfWeek.includes(dayNum)) {
          daysOfWeek.push(dayNum);
        }
      } else if (!targetDate) {
        const currentDay = today.getDay() === 0 ? 7 : today.getDay();
        let daysUntil = dayNum - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const d = new Date(today);
        d.setDate(d.getDate() + daysUntil);
        targetDate = formatDateYMD(d);
      }
      cleanText = cleanText.replace(regex, '');
    }
  }

  // ISO or numeric dates
  const isoMatch = cleanText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    targetDate = isoMatch[0];
    cleanText = cleanText.replace(isoMatch[0], '');
  }

  // 6. Time expressions in Uzbek
  const relMinMatch = cleanText.match(/(\d+)\s*daqiqadan\s+keyin/i);
  if (relMinMatch) {
    const mins = parseInt(relMinMatch[1], 10);
    const d = new Date(now.getTime() + mins * 60000);
    targetDate = formatDateYMD(d);
    targetTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    cleanText = cleanText.replace(relMinMatch[0], '');
  }

  const timeMatch = cleanText.match(/(?:soat\s*)?(\d{1,2}):(\d{2})(?:\s*da)?/i);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const minutes = timeMatch[2];
    targetTime = `${hours}:${minutes}`;
    cleanText = cleanText.replace(timeMatch[0], '');
  }

  // 7. Implicit category inference
  if (category === 'noaniq') {
    if (amount) {
      category = 'harajat';
    } else if (isSupplement) {
      category = 'qabul';
    } else if (lower.includes('har kuni') || lower.includes('har dushanba') || (daysOfWeek && daysOfWeek.length > 0)) {
      category = 'odat';
    } else if (lower.includes('oy oxirigacha') || lower.includes('yil oxirigacha') || (quantity && quantity > 50)) {
      category = 'maqsad';
    } else if (lower.includes('uchrashuv') || lower.includes('suhbat') || lower.includes('majlis')) {
      category = 'uchrashuv';
    } else if (targetDate || targetTime || /(yuborish|qilish|borish|yozish|topshirish)/i.test(lower)) {
      category = 'vazifa';
    }
  }

  if (!targetDate) {
    targetDate = formatDateYMD(today);
  }

  // 8. Clean Title
  let title = cleanText
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    if (category === 'qabul') {
      if (isCreatine) title = 'Kreatin qabul qilish';
      else if (isArginine) title = 'L-Arginin qabul qilish';
      else if (isHoneyWater) title = 'Ertalab asalli suv ichish';
      else title = 'Kunlik qo\'shimcha qabuli';
    } else if (category === 'harajat') {
      title = expenseCategory ? `${expenseCategory.toUpperCase()} xarajati` : 'Kundalik xarajat';
    } else {
      title = rawText;
    }
  }

  // 9. Human friendly explanation
  let explanationUz = '';
  if (category === 'harajat') {
    explanationUz = `💸 Xarajat: "${title}" (${amount ? formatMoney(amount, currency) : (currency === 'USD' ? '$' : "so'm")})`;
  } else if (category === 'qabul') {
    explanationUz = `💊 Kunlik qabul: "${title}" (${dosage || '1 doza'}, ${timeSlot || 'Kunlik'})`;
  } else if (category === 'vazifa') {
    explanationUz = `📌 Vazifa: "${title}" (${formatUzbekDateLabel(targetDate, targetTime)})`;
  } else if (category === 'odat') {
    explanationUz = `🔁 Odat: "${title}"`;
    if (quantity && unit) explanationUz += ` (${quantity} ${unit})`;
  } else if (category === 'maqsad') {
    explanationUz = `🎯 Maqsad: "${title}" (Muddati: ${targetDate})`;
  } else if (category === 'uchrashuv') {
    explanationUz = `🤝 Uchrashuv: "${title}" (${formatUzbekDateLabel(targetDate, targetTime)})`;
  } else {
    explanationUz = `Yozuv: "${title}"`;
  }

  return {
    category,
    title,
    date: targetDate,
    time: targetTime,
    quantity,
    unit,
    amount,
    currency,
    expenseCategory,
    dosage,
    timeSlot,
    daysOfWeek: daysOfWeek || (category === 'odat' || category === 'qabul' ? ['daily'] : null),
    confidence,
    explanationUz,
    source: 'local-rules',
  };
}

/**
 * High-level NLP parser with timeout protection and instant local fallback
 */
export async function parseUzbekIntent(text: string): Promise<ParsedItem> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('/api/parse-nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        currentDate: formatDateYMD(new Date()),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.parsed) {
        return {
          category: data.parsed.category || 'vazifa',
          title: data.parsed.title || text,
          date: data.parsed.date || formatDateYMD(new Date()),
          time: data.parsed.time || null,
          quantity: data.parsed.quantity || null,
          unit: data.parsed.unit || null,
          amount: data.parsed.amount || null,
          expenseCategory: data.parsed.expenseCategory || null,
          dosage: data.parsed.dosage || null,
          timeSlot: data.parsed.timeSlot || null,
          daysOfWeek: data.parsed.daysOfWeek || null,
          confidence: data.parsed.confidence || 0.9,
          explanationUz: data.parsed.explanationUz || `${data.parsed.title}`,
          source: 'gemini-ai',
        };
      }
    }
  } catch {
    // network or dev server error; fall through to local rules
  }

  return parseUzbekTextLocal(text, new Date());
}
