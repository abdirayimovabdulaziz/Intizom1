import { ParsedItem, ExpenseCategory, Currency, HabitFrequency } from '../types';
import {
  getDateStringInTimezone,
  addDaysToYMD,
  getDayOfWeekFromYMD,
  isValidYMD,
  validateDaysOfWeek,
} from './domainCalculations';

export interface ParseNlpOptions {
  referenceDate?: Date;
  timezone?: string;
  aiEnabled?: boolean;
}

/**
 * Normalizes Uzbek text:
 * - Unifies all apostrophe variants (', ‘, ’, ʻ, ʼ, `, ´) to standard ASCII '
 * - Normalizes Unicode spaces (\u00A0 non-breaking, etc.) to standard space
 * - Collapses consecutive whitespace and trims
 */
export function normalizeUzbekText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[‘’ʻʼ\u02BB\u02BC\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
export function formatUzbekDateLabel(dateStr: string, timeStr?: string | null, referenceDateStr?: string): string {
  if (!dateStr) return '';
  const today = referenceDateStr || formatDateYMD(new Date());
  const tomorrow = addDaysToYMD(today, 1);
  const indin = addDaysToYMD(today, 2);

  let label = dateStr;
  if (dateStr === today) {
    label = 'Bugun';
  } else if (dateStr === tomorrow) {
    label = 'Ertaga';
  } else if (dateStr === indin) {
    label = 'Indin';
  } else {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [, m, d] = parts;
      const months = [
        'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
        'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
      ];
      const monthName = months[parseInt(m, 10) - 1] || m;
      label = `${parseInt(d, 10)}-${monthName}`;
    }
  }

  if (timeStr) {
    return `${label}, soat ${timeStr}`;
  }
  return label;
}

/**
 * Format amount in currency: either UZS (e.g. 45 000 so'm) or USD (e.g. 12.50 $)
 */
export function formatMoney(amount: number, currency: Currency = 'UZS'): string {
  if (currency === 'USD') {
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)} $`;
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
 * Validates and normalizes runtime ParsedItem against strict domain contract
 */
export function validateAndNormalizeParsedItem(
  raw: any,
  fallbackText: string = '',
  contextDateStr: string = formatDateYMD(new Date()),
  _timezone: string = 'Asia/Tashkent'
): ParsedItem {
  if (!raw || typeof raw !== 'object') {
    return parseUzbekTextLocal(fallbackText, { referenceDate: new Date(), timezone: _timezone });
  }

  const validCategories = ['vazifa', 'odat', 'maqsad', 'uchrashuv', 'harajat', 'qabul', 'noaniq'];
  let category: ParsedItem['category'] = validCategories.includes(raw.category) ? raw.category : 'noaniq';

  let title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackText.trim();
  title = normalizeUzbekText(title);

  // Validate date (must be real calendar date)
  let date: string | null = null;
  if (typeof raw.date === 'string' && isValidYMD(raw.date.trim())) {
    date = raw.date.trim();
  } else if (category === 'vazifa' || category === 'uchrashuv' || category === 'harajat') {
    date = contextDateStr;
  }

  // Validate time (must be valid 24-hr HH:mm)
  let time: string | null = null;
  if (typeof raw.time === 'string') {
    const timeMatch = raw.time.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  // Validate amount & currency
  let amount: number | null = null;
  if (typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount > 0) {
    amount = raw.amount;
  }
  let currency: Currency = raw.currency === 'USD' ? 'USD' : 'UZS';

  // Validate days of week
  let daysOfWeek: number[] | null = null;
  if (Array.isArray(raw.daysOfWeek) && raw.daysOfWeek.length > 0) {
    daysOfWeek = validateDaysOfWeek(raw.daysOfWeek);
  }

  // Validate recurrence frequency & targetDaysPerWeek
  let frequency: HabitFrequency | null = null;
  if (raw.frequency === 'daily' || raw.frequency === 'weekly_target' || raw.frequency === 'specific_days') {
    frequency = raw.frequency;
  }
  let targetDaysPerWeek: number | null = null;
  if (typeof raw.targetDaysPerWeek === 'number' && Number.isInteger(raw.targetDaysPerWeek) && raw.targetDaysPerWeek >= 1 && raw.targetDaysPerWeek <= 7) {
    targetDaysPerWeek = raw.targetDaysPerWeek;
  }

  const isIncomeBlocked = !!raw.isIncome || !!raw.isIncomeBlocked;
  const isIntervalBlocked = !!raw.isInterval || !!raw.isIntervalBlocked;
  const isMultipleActionsBlocked = !!raw.isMultipleActions || !!raw.isMultipleActionsBlocked;

  if (isIncomeBlocked || isIntervalBlocked || isMultipleActionsBlocked) {
    category = 'noaniq';
  }

  return {
    category,
    title,
    date,
    time,
    amount,
    currency,
    expenseCategory: raw.expenseCategory || null,
    dosage: typeof raw.dosage === 'string' && raw.dosage.trim() ? raw.dosage.trim() : null,
    timeSlot: typeof raw.timeSlot === 'string' && raw.timeSlot.trim() ? raw.timeSlot.trim() : null,
    quantity: typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) && raw.quantity > 0 ? raw.quantity : null,
    unit: typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : null,
    frequency,
    targetDaysPerWeek,
    daysOfWeek,
    isIncomeBlocked,
    isIntervalBlocked,
    isMultipleActionsBlocked,
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : 0.8,
    explanationUz: typeof raw.explanationUz === 'string' && raw.explanationUz.trim() ? raw.explanationUz.trim() : title,
    source: raw.source === 'gemini-ai' ? 'gemini-ai' : 'local-rules',
  };
}

/**
 * Local Rule-based NLP Parser for Uzbek commands and natural language input.
 * Strictly adheres to non-fabrication of amounts, dosages, or unmentioned dates.
 */
export function parseUzbekTextLocal(
  rawText: string,
  optionsOrDate: ParseNlpOptions | Date = new Date()
): ParsedItem {
  const options: ParseNlpOptions = optionsOrDate instanceof Date
    ? { referenceDate: optionsOrDate, timezone: 'Asia/Tashkent' }
    : (optionsOrDate || {});

  const refDate = options.referenceDate || new Date();
  const timezone = options.timezone || 'Asia/Tashkent';
  const todayStr = getDateStringInTimezone(refDate, timezone);

  const normalized = normalizeUzbekText(rawText);
  const lower = normalized.toLowerCase();

  // 1. Check for Income (daromad) blocking rule
  const isIncome = /(?:^|\s)(?:daromad|ish\s*haqi|oylik\s*(?:tushdi|oldi|oldim)|kirim)(?:\s*:|\s|$)/i.test(lower);
  if (isIncome) {
    return {
      category: 'noaniq',
      title: normalized,
      isIncomeBlocked: true,
      confidence: 0.9,
      explanationUz: "ℹ️ Hozircha ilovada faqat xarajatlarni hisobga olish mavjud, daromadlar (kirim) funksiyasi hali qo'llab-quvvatlanmaydi.",
      source: 'local-rules',
    };
  }

  // 2. Check for Multiple Actions in one prompt (e.g. joined by " va " or " hamda ")
  if (/\s+(?:va|hamda)\s+/i.test(normalized)) {
    const parts = normalized.split(/\s+(?:va|hamda)\s+/i);
    if (parts.length >= 2) {
      const hasActionSignature = (s: string) =>
        /(?:so'?m|\$|dollar|usd|kreatin|arginin|zal|kitob|majlis|uchrashuv|vazifa|harajat|xarajat|yugurish)/i.test(s) ||
        /\d{1,2}:\d{2}/.test(s) ||
        /\d+\s*(?:ming|ta|bet|sahifa|daqiqa|km|litr|gram|g)/i.test(s);

      if (hasActionSignature(parts[0]) && hasActionSignature(parts[1])) {
        return {
          category: 'noaniq',
          title: normalized,
          isMultipleActionsBlocked: true,
          confidence: 0.85,
          explanationUz: "⚠️ Bir vaqtda bir nechta amal aniqlandi. Iltimos, har bir vazifa yoki xarajatni alohida xabar sifatida yuboring.",
          source: 'local-rules',
        };
      }
    }
  }

  // 3. Check for Kunora (interval schedule) blocking rule
  const isKunora = /\b(?:kunora|kun\s+ora)\b/i.test(lower);
  if (isKunora) {
    return {
      category: 'noaniq',
      title: normalized.replace(/\b(?:kunora|kun\s+ora)\b/gi, '').trim() || normalized,
      isIntervalBlocked: true,
      confidence: 0.9,
      explanationUz: "⚠️ Kunora (interval) jadvali hozircha qo'llab-quvvatlanmaydi. Iltimos, 'har kuni', 'haftasiga N kun' yoki muayyan kunlarni (masalan: dushanba, chorshanba, juma) tanlang.",
      source: 'local-rules',
    };
  }

  let workingText = normalized;

  // 4. Time & Date token extraction BEFORE money parsing to prevent number collision (e.g. 17:00 -> 17)
  let targetTime: string | null = null;
  let targetDate: string | null = null;
  let hasInvalidDate = false;
  let hasInvalidTime = false;

  // Time extraction: HH:mm with validation (00..23, 00..59)
  const timeRegex = /(?:soat\s*)?(\b\d{1,2}):(\d{2})(?:\s*da)?\b/i;
  const timeMatch = workingText.match(timeRegex);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      targetTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else {
      hasInvalidTime = true;
    }
    // Remove the time token so the hour number is never mistaken for money or quantity
    workingText = workingText.replace(timeMatch[0], ' ');
  }

  // Relative minutes extraction: e.g. "20 daqiqadan keyin"
  const relMinMatch = workingText.match(/(\d+)\s*daqiqadan\s+keyin/i);
  if (relMinMatch) {
    const mins = parseInt(relMinMatch[1], 10);
    if (mins >= 0 && mins < 1440) {
      const futureDate = new Date(refDate.getTime() + mins * 60000);
      targetDate = getDateStringInTimezone(futureDate, timezone);
      const hStr = String(futureDate.getHours()).padStart(2, '0');
      const mStr = String(futureDate.getMinutes()).padStart(2, '0');
      targetTime = `${hStr}:${mStr}`;
    }
    workingText = workingText.replace(relMinMatch[0], ' ');
  }

  // Date extraction: ISO YYYY-MM-DD
  const isoMatch = workingText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    if (isValidYMD(isoMatch[0])) {
      targetDate = isoMatch[0];
    } else {
      hasInvalidDate = true;
    }
    workingText = workingText.replace(isoMatch[0], ' ');
  }

  // Relative words: bugun, ertaga, indin
  if (/\bindin\b/i.test(workingText)) {
    targetDate = addDaysToYMD(todayStr, 2);
    workingText = workingText.replace(/\bindin\b/gi, ' ');
  } else if (/\bertaga\b/i.test(workingText)) {
    targetDate = addDaysToYMD(todayStr, 1);
    workingText = workingText.replace(/\bertaga\b/gi, ' ');
  } else if (/\bbugun\b/i.test(workingText)) {
    targetDate = todayStr;
    workingText = workingText.replace(/\bbugun\b/gi, ' ');
  }

  // 5. Recurrence patterns (weekly target & specific days)
  let frequency: HabitFrequency | null = null;
  let targetDaysPerWeek: number | null = null;
  let daysOfWeek: number[] | null = null;

  // "haftasiga 3 kun zal", "haftada 2 kun", "haftasiga 3 marta"
  const weeklyTargetMatch = workingText.match(/(?:haftasiga|haftada)\s*(\d+)\s*(?:kun|marta|martta)/i);
  if (weeklyTargetMatch) {
    const num = parseInt(weeklyTargetMatch[1], 10);
    if (num >= 1 && num <= 7) {
      frequency = 'weekly_target';
      targetDaysPerWeek = num;
      workingText = workingText.replace(weeklyTargetMatch[0], ' ');
    }
  }

  // Day names for specific days recurrence or single date target
  const dayNamesMap: Record<string, number> = {
    dushanba: 1,
    seshanba: 2,
    chorshanba: 3,
    payshanba: 4,
    juma: 5,
    shanba: 6,
    yakshanba: 7,
  };

  const detectedDays: number[] = [];
  for (const [dayName, dayNum] of Object.entries(dayNamesMap)) {
    const rx = new RegExp(`\\b${dayName}\\b`, 'i');
    if (rx.test(workingText)) {
      detectedDays.push(dayNum);
      workingText = workingText.replace(rx, ' ');
    }
  }

  const isRecurringContext = /\bhar\s+/i.test(lower) || lower.startsWith('odat:') || frequency !== null;

  if (detectedDays.length > 0) {
    if (isRecurringContext || lower.includes('har ')) {
      frequency = 'specific_days';
      daysOfWeek = validateDaysOfWeek(detectedDays);
    } else if (!targetDate) {
      // Single upcoming target day
      const currentIsoDay = getDayOfWeekFromYMD(todayStr);
      let diff = detectedDays[0] - currentIsoDay;
      if (diff <= 0) diff += 7;
      targetDate = addDaysToYMD(todayStr, diff);
    }
  }

  if (/\bhar\s+kuni\b/i.test(workingText) || /\bhar\s+kun\b/i.test(workingText)) {
    frequency = 'daily';
    daysOfWeek = [1, 2, 3, 4, 5, 6, 7];
    workingText = workingText.replace(/\bhar\s+kun(?:i)?\b/gi, ' ');
  }

  // 6. Category Prefix detection
  let category: ParsedItem['category'] = 'noaniq';
  let isExpensePrefix = false;

  if (/^(harajat|xarajat|sarf|to'lov):/i.test(workingText)) {
    category = 'harajat';
    isExpensePrefix = true;
    workingText = workingText.replace(/^(harajat|xarajat|sarf|to'lov):\s*/i, '');
  } else if (/^(qabul|ichish|dori):/i.test(workingText)) {
    category = 'qabul';
    workingText = workingText.replace(/^(qabul|ichish|dori):\s*/i, '');
  } else if (/^(vazifa|topshiriq|ish):/i.test(workingText)) {
    category = 'vazifa';
    workingText = workingText.replace(/^(vazifa|topshiriq|ish):\s*/i, '');
  } else if (/^(odat|odatlanish):/i.test(workingText)) {
    category = 'odat';
    workingText = workingText.replace(/^(odat|odatlanish):\s*/i, '');
  } else if (/^maqsad:/i.test(workingText)) {
    category = 'maqsad';
    workingText = workingText.replace(/^maqsad:\s*/i, '');
  } else if (/^(uchrashuv|meet):/i.test(workingText)) {
    category = 'uchrashuv';
    workingText = workingText.replace(/^(uchrashuv|meet):\s*/i, '');
  }

  // 7. Money & Currency parsing
  let amount: number | null = null;
  let currency: Currency = 'UZS';
  let clarificationNeeded: string | null = null;

  // Check for ambiguous multiple dots/commas (e.g. 45..000 or contradictory delimiters)
  if (/\d+\.\.\d+/.test(workingText) || /\d+\.\d+\.\d+\.\d+/.test(workingText)) {
    clarificationNeeded = "Summa yozilishida xatolik bor. Iltimos, summani aniqroq yozing (masalan: 45 000 so'm yoki 1500 so'm).";
  }

  // 7.1 "1.5 ming so'm" or "1,5 ming so'm" or "45 ming so'm"
  const mingMatch = workingText.match(/(\d+(?:[.,]\d+)?)\s*ming(?:\s*(?:so'?m|som|uzs))?/i);
  if (mingMatch) {
    const base = parseFloat(mingMatch[1].replace(',', '.'));
    if (Number.isFinite(base) && base > 0) {
      amount = Math.round(base * 1000);
      currency = 'UZS';
      category = 'harajat';
      workingText = workingText.replace(mingMatch[0], ' ');
    }
  }

  // 7.2 USD currency ($12.50, 12.50 dollar, 12,50 dollar, 12.5 usd)
  if (amount === null) {
    const usdPrefixMatch = workingText.match(/\$\s*(\d+(?:[.,]\d+)?)\b/);
    const usdSuffixMatch = workingText.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|dollar|usd)\b/i);
    const usdMatch = usdPrefixMatch || usdSuffixMatch;
    if (usdMatch) {
      const val = parseFloat(usdMatch[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0) {
        amount = val;
        currency = 'USD';
        category = 'harajat';
        workingText = workingText.replace(usdMatch[0], ' ');
      }
    }
  }

  // 7.3 Spaced thousands: "45 000 so'm"
  if (amount === null) {
    const spacedThousandsMatch = workingText.match(/(\d{1,3}(?:\s\d{3})+)\s*(?:so'?m|som|uzs)\b/i);
    if (spacedThousandsMatch) {
      const cleanNum = parseInt(spacedThousandsMatch[1].replace(/\s/g, ''), 10);
      if (Number.isFinite(cleanNum) && cleanNum > 0) {
        amount = cleanNum;
        currency = 'UZS';
        category = 'harajat';
        workingText = workingText.replace(spacedThousandsMatch[0], ' ');
      }
    }
  }

  // 7.4 Plain integer with explicit currency: "45000 so'm", "45000som", "45000 uzs"
  if (amount === null) {
    const plainCurrencyMatch = workingText.match(/(\d+)\s*(?:so'?m|som|uzs)\b/i);
    if (plainCurrencyMatch) {
      const val = parseInt(plainCurrencyMatch[1], 10);
      if (Number.isFinite(val) && val > 0) {
        amount = val;
        currency = 'UZS';
        category = 'harajat';
        workingText = workingText.replace(plainCurrencyMatch[0], ' ');
      }
    }
  }

  // 7.5 Number with explicit expense prefix or keyword (without explicit currency token)
  if (amount === null && (isExpensePrefix || /\b(?:sarfladim|to'ladim|sarf)\b/i.test(lower))) {
    const standaloneNumMatch = workingText.match(/\b(\d{1,3}(?:\s\d{3})+|\d+)\b/);
    if (standaloneNumMatch) {
      const val = parseInt(standaloneNumMatch[1].replace(/\s/g, ''), 10);
      if (Number.isFinite(val) && val > 0) {
        amount = val;
        currency = 'UZS';
        category = 'harajat';
        workingText = workingText.replace(standaloneNumMatch[0], ' ');
      }
    }
  }

  // Expense Category classification
  let expenseCategory: ExpenseCategory | null = null;
  if (category === 'harajat' || amount !== null) {
    const expLower = normalized.toLowerCase();
    if (/(tushlik|nonushta|ovqat|kechki|kofe|choy|osh|kafe|restoran|bozor|supermarket|go'sht|non|shirinlik)/.test(expLower)) {
      expenseCategory = 'oziq_ovqat';
    } else if (/(taksi|yandex|benzin|metron?|avtobus|yo'l|zapravka|samolyot|poyezd)/.test(expLower)) {
      expenseCategory = 'transport';
    } else if (/(sport|zal|fitnes|trenirovka)/.test(expLower)) {
      expenseCategory = 'sport';
    } else if (/(dori|apteka|doktor|vrach|tahlil|analiz|vitamin|davolanish)/.test(expLower)) {
      expenseCategory = 'salomatlik';
    } else if (/(kitob|kurs|dars|kitoblar|repetitor|talim|universitet)/.test(expLower)) {
      expenseCategory = 'talim';
    } else {
      expenseCategory = 'shaxsiy';
    }
  }

  // 8. Health & Supplements (Qabul) detection
  const isCreatine = /(creatin|kreatin)/i.test(lower);
  const isArginine = /(l\s*[-_]?\s*arginin|arginin)/i.test(lower);
  const isHoneyWater = /(asalli\s+suv|asal\s+suv|iliq\s+suv)/i.test(lower);
  const isSupplement = isCreatine || isArginine || isHoneyWater || /(vitamin|omega|protein|dori|kapsula|magniy|sink)/i.test(lower);

  let dosage: string | null = null;
  let timeSlot: string | null = null;
  let quantity: number | null = null;
  let unit: string | null = null;

  // Extract explicit dosage if stated by user (NEVER fabricate 5g for unmentioned creatine!)
  const dosageMatch = workingText.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|gramm|kapsula|stakan|qoshiq|dona|ml|litr|tabletka)\b/i);
  if (dosageMatch) {
    const val = parseFloat(dosageMatch[1].replace(',', '.'));
    const u = dosageMatch[2].toLowerCase();
    dosage = dosageMatch[0].trim();
    quantity = val;
    unit = u;
    workingText = workingText.replace(dosageMatch[0], ' ');
  }

  // Extract timeSlot only if explicitly mentioned
  if (/\b(?:nahorga|och\s+qoringa)\b/i.test(workingText)) {
    timeSlot = 'Ertalab nahorga';
    workingText = workingText.replace(/\b(?:nahorga|och\s+qoringa)\b/gi, ' ');
  } else if (/mashg'ulotdan\s+oldin|mashqdan\s+oldin/i.test(workingText)) {
    timeSlot = "Mashg'ulotdan oldin";
    workingText = workingText.replace(/mashg'ulotdan\s+oldin|mashqdan\s+oldin/gi, ' ');
  } else if (/mashg'ulotdan\s+(?:keyin|so'ng)|mashqdan\s+(?:keyin|so'ng)/i.test(workingText)) {
    timeSlot = "Mashg'ulotdan so'ng";
    workingText = workingText.replace(/mashg'ulotdan\s+(?:keyin|so'ng)|mashqdan\s+(?:keyin|so'ng)/gi, ' ');
  } else if (/kechqurun|yotishdan\s+oldin/i.test(workingText)) {
    timeSlot = 'Kechqurun yotishdan oldin';
    workingText = workingText.replace(/kechqurun|yotishdan\s+oldin/gi, ' ');
  }

  if (category === 'noaniq' && isSupplement) {
    category = 'qabul';
  }

  // 9. General quantity & unit for habits/tasks (e.g. "60 daqiqa yurish", "20 bet kitob")
  if (!quantity) {
    const qtyMatch = workingText.match(/(\d+(?:[.,]\d+)?)\s*(sahifa|bet|varaq|daqiqa|minut|litr|km|kilometr|martta|marta|soat|ta dars|dars|qadam)\b/i);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1].replace(',', '.'));
      let rawUnit = qtyMatch[2].toLowerCase();
      if (rawUnit === 'bet' || rawUnit === 'varaq') rawUnit = 'sahifa';
      if (rawUnit === 'minut') rawUnit = 'daqiqa';
      if (rawUnit === 'kilometr') rawUnit = 'km';
      if (rawUnit === 'martta') rawUnit = 'marta';
      unit = rawUnit;
      workingText = workingText.replace(qtyMatch[0], ' ');
    }
  }

  // 10. Category Inference
  if (category === 'noaniq') {
    if (amount !== null) {
      category = 'harajat';
    } else if (isSupplement) {
      category = 'qabul';
    } else if (frequency !== null || daysOfWeek !== null || lower.includes('har kuni')) {
      category = 'odat';
    } else if (lower.includes('oy oxirigacha') || lower.includes('yil oxirigacha')) {
      category = 'maqsad';
    } else if (lower.includes('uchrashuv') || lower.includes('suhbat') || lower.includes('majlis')) {
      category = 'uchrashuv';
    } else if (targetDate || targetTime || /(yuborish|qilish|borish|yozish|topshirish|tayyorlash)/i.test(lower)) {
      category = 'vazifa';
    }
  }

  if (!targetDate && !hasInvalidDate && (category === 'vazifa' || category === 'uchrashuv' || category === 'harajat')) {
    targetDate = todayStr;
  }

  // Reject invalid explicit dates or times
  if (hasInvalidDate || hasInvalidTime) {
    category = 'noaniq';
    if (hasInvalidDate) {
      clarificationNeeded = "Kiritilgan sana mavjud emas yoki noto'g'ri (masalan: 2026-02-31). Iltimos, haqiqiy kalendar sanasini kiriting.";
      targetDate = null;
    }
    if (hasInvalidTime) {
      clarificationNeeded = "Kiritilgan vaqt noto'g'ri (masalan: 25:90). Iltimos, to'g'ri vaqtni kiriting.";
      targetTime = null;
    }
  }

  // 11. Clean Title
  let title = workingText
    .replace(/\b(?:da|uchun|bilan|har|haftasiga|haftada|kun|kunlik|soat)\b/gi, ' ')
    .replace(/[^\w\s'ʻʼ-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    if (category === 'qabul') {
      if (isCreatine) title = 'Kreatin qabul qilish';
      else if (isArginine) title = 'L-Arginin qabul qilish';
      else if (isHoneyWater) title = 'Ertalab asalli suv ichish';
      else title = 'Salomatlik qabuli';
    } else if (category === 'harajat') {
      title = expenseCategory ? `${expenseCategory.toUpperCase()} xarajati` : 'Kundalik xarajat';
    } else {
      title = normalized;
    }
  }

  // 12. Human friendly explanation
  let explanationUz = '';
  if (category === 'harajat') {
    explanationUz = `💸 Xarajat: "${title}" (${amount !== null ? formatMoney(amount, currency) : "Summa ko'rsatilmagan"})`;
  } else if (category === 'qabul') {
    explanationUz = `💊 Kunlik qabul: "${title}"${dosage ? ` (${dosage})` : ''}${timeSlot ? ` [${timeSlot}]` : ''}`;
  } else if (category === 'vazifa') {
    explanationUz = `📌 Vazifa: "${title}" (${formatUzbekDateLabel(targetDate || todayStr, targetTime, todayStr)})`;
  } else if (category === 'odat') {
    explanationUz = `🔁 Odat: "${title}"`;
    if (quantity && unit) explanationUz += ` (${quantity} ${unit})`;
    if (frequency === 'weekly_target') explanationUz += ` [Haftasiga ${targetDaysPerWeek || 3} kun]`;
  } else if (category === 'maqsad') {
    explanationUz = `🎯 Maqsad: "${title}" (Muddati: ${targetDate || todayStr})`;
  } else if (category === 'uchrashuv') {
    explanationUz = `🤝 Uchrashuv: "${title}" (${formatUzbekDateLabel(targetDate || todayStr, targetTime, todayStr)})`;
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
    daysOfWeek: daysOfWeek || (frequency === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : null),
    frequency: frequency || (category === 'odat' ? 'daily' : null),
    targetDaysPerWeek,
    habitType: category === 'qabul' ? 'supplement_health' : 'general',
    clarificationNeeded,
    confidence: 0.85,
    explanationUz,
    source: 'local-rules',
  };
}

export const parseLocalUzbekIntent = parseUzbekTextLocal;

/**
 * High-level NLP parser with timeout protection, aiEnabled check, and runtime validation
 */
export async function parseUzbekIntent(
  text: string,
  options?: ParseNlpOptions
): Promise<ParsedItem> {
  const refDate = options?.referenceDate || new Date();
  const tz = options?.timezone || 'Asia/Tashkent';
  const aiEnabled = options?.aiEnabled !== false;
  const todayStr = getDateStringInTimezone(refDate, tz);

  // If AI is disabled in settings, do NOT issue any fetch call
  if (!aiEnabled) {
    return parseUzbekTextLocal(text, options);
  }

  let timeoutId: any;
  try {
    const controller = new AbortController();
    // 3500ms client timeout (gracefully accounts for server 3000ms timeout)
    timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('/api/parse-nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        currentDate: todayStr,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.parsed) {
        return validateAndNormalizeParsedItem(data.parsed, text, todayStr, tz);
      }
    }
  } catch {
    // Timeout, network error, or server fallback -> smoothly use local rules
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  return parseUzbekTextLocal(text, options);
}
