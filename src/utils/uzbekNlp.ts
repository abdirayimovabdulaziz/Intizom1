import { ParsedItem, ExpenseCategory, EXPENSE_CATEGORIES, Currency, HabitFrequency, HabitType } from '../types';
import {
  getDateStringInTimezone,
  getTimeStringInTimezone,
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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  item: ParsedItem | null;
}

export interface HabitCreatePayload {
  title: string;
  category: 'odat';
  habitType: HabitType;
  frequency: HabitFrequency;
  daysOfWeek: number[];
  targetDaysPerWeek?: number;
  hasQuantity: boolean;
  targetQuantity?: number;
  unit?: string;
  dosage?: string;
  timeSlot?: string;
}

export interface ExpenseCreatePayload {
  title: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  date: string;
  time: string;
  source: 'bot' | 'miniapp';
}

export interface TaskCreatePayload {
  title: string;
  category: 'vazifa' | 'uchrashuv';
  date: string;
  time?: string;
  status: 'pending';
  priority: 'low' | 'medium' | 'high';
  source: 'bot' | 'miniapp';
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
 * Raw money match token helper
 */
interface RawMoneyMatch {
  amount: number;
  currency: Currency;
  fullToken: string;
}

/**
 * Scans text for all money patterns and returns structured matches
 */
function findRawMoneyMatches(text: string): { matches: RawMoneyMatch[]; hasAmbiguousFormat: boolean } {
  const matches: RawMoneyMatch[] = [];
  let hasAmbiguousFormat = false;

  // 1. Suffix dollar: "1400$", "12.50$"
  const suffixDollarRegex = /(\b\d+(?:[.,]\d+)?)\s*\$/g;
  let m: RegExpExecArray | null;
  while ((m = suffixDollarRegex.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(num) && num > 0) {
      matches.push({ amount: num, currency: 'USD', fullToken: m[0] });
    }
  }

  // 2. Prefix dollar: "$1400", "$12.50"
  const prefixDollarRegex = /\$\s*(\d+(?:[.,]\d+)?)\b/g;
  while ((m = prefixDollarRegex.exec(text)) !== null) {
    // Avoid double counting if already matched by suffix
    if (!matches.some(x => x.fullToken.includes(m![0]))) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (Number.isFinite(num) && num > 0) {
        matches.push({ amount: num, currency: 'USD', fullToken: m[0] });
      }
    }
  }

  // 3. Word dollar / USD: "12.50 dollar", "1400 usd"
  const wordDollarRegex = /(\b\d+(?:[.,]\d+)?)\s*(?:dollar|dollor|usd)\b/gi;
  while ((m = wordDollarRegex.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(num) && num > 0) {
      matches.push({ amount: num, currency: 'USD', fullToken: m[0] });
    }
  }

  // 4. Uzbek so'm with thousand & decimal grouping
  // European format: "1.234,56 so'm" -> 1234.56
  const eurSomRegex = /\b(\d{1,3}(?:\.\d{3})+),(\d{1,2})\s*so'?m\b/gi;
  while ((m = eurSomRegex.exec(text)) !== null) {
    const fullNum = parseFloat(m[1].replace(/\./g, '') + '.' + m[2]);
    if (Number.isFinite(fullNum) && fullNum > 0) {
      matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
    }
  }

  // Standard format: "1,234.56 so'm" -> 1234.56
  const stdSomRegex = /\b(\d{1,3}(?:,\d{3})+)\.(\d{1,2})\s*so'?m\b/gi;
  while ((m = stdSomRegex.exec(text)) !== null) {
    const fullNum = parseFloat(m[1].replace(/,/g, '') + '.' + m[2]);
    if (Number.isFinite(fullNum) && fullNum > 0) {
      matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
    }
  }

  // Dot thousand grouping: "45.000 so'm" -> 45000
  const dotSomRegex = /\b(\d{1,3}(?:\.\d{3})+)\s*so'?m\b/gi;
  while ((m = dotSomRegex.exec(text)) !== null) {
    if (!matches.some(x => x.fullToken.includes(m![0]))) {
      const fullNum = parseInt(m[1].replace(/\./g, ''), 10);
      if (Number.isFinite(fullNum) && fullNum > 0) {
        matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
      }
    }
  }

  // Comma thousand grouping: "45,000 so'm" -> 45000
  const commaSomRegex = /\b(\d{1,3}(?:,\d{3})+)\s*so'?m\b/gi;
  while ((m = commaSomRegex.exec(text)) !== null) {
    if (!matches.some(x => x.fullToken.includes(m![0]))) {
      const fullNum = parseInt(m[1].replace(/,/g, ''), 10);
      if (Number.isFinite(fullNum) && fullNum > 0) {
        matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
      }
    }
  }

  // Space thousand grouping: "45 000 so'm" -> 45000
  const spaceSomRegex = /\b(\d{1,3}(?:\s+\d{3})+)\s*so'?m\b/gi;
  while ((m = spaceSomRegex.exec(text)) !== null) {
    if (!matches.some(x => x.fullToken.includes(m![0]))) {
      const fullNum = parseInt(m[1].replace(/\s+/g, ''), 10);
      if (Number.isFinite(fullNum) && fullNum > 0) {
        matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
      }
    }
  }

  // Ming suffix: "1.5 ming so'm", "1,5 ming so'm" -> 1500
  const mingSomRegex = /(\b\d+(?:[.,]\d+)?)\s*ming\s*so'?m\b/gi;
  while ((m = mingSomRegex.exec(text)) !== null) {
    const mult = parseFloat(m[1].replace(',', '.'));
    if (Number.isFinite(mult) && mult > 0) {
      matches.push({ amount: Math.round(mult * 1000), currency: 'UZS', fullToken: m[0] });
    }
  }

  // Plain integer: "45000 so'm"
  const plainSomRegex = /\b(\d+)\s*so'?m\b/gi;
  while ((m = plainSomRegex.exec(text)) !== null) {
    if (!matches.some(x => x.fullToken.includes(m![0]))) {
      const fullNum = parseInt(m[1], 10);
      if (Number.isFinite(fullNum) && fullNum > 0) {
        matches.push({ amount: fullNum, currency: 'UZS', fullToken: m[0] });
      }
    }
  }

  // Detect irregular/ambiguous money tokens (e.g. "12.34.56 so'm" or numbers with irregular groups)
  // only if not already successfully matched as a valid format
  let remainingForIrregular = text;
  for (const match of matches) {
    remainingForIrregular = remainingForIrregular.replace(match.fullToken, ' ');
  }
  const irregularSomRegex = /\b\d+(?:[.,]\d+){2,}\s*so'?m\b/gi;
  if (irregularSomRegex.test(remainingForIrregular)) {
    hasAmbiguousFormat = true;
  }

  return { matches, hasAmbiguousFormat };
}

/**
 * Deterministic preflight check:
 * Runs BEFORE AI and CANNOT be bypassed by AI under any circumstances.
 * Specifically guards against:
 * 1. Income (daromad)
 * 2. Unsupported interval schedule ("kunora")
 * 3. Reliably detected multiple actions (multiple expenses or independent clauses)
 */
export function runDeterministicPreflight(
  rawText: string,
  _options?: ParseNlpOptions
): ParsedItem | null {
  const normalized = normalizeUzbekText(rawText);
  const lower = normalized.toLowerCase();

  // 1. Income (daromad) guard
  const isIncome = /(?:^|\s)(?:daromad|ish\s*haqi|oylik\s*(?:tushdi|oldi|oldim)|kirim)(?:\s*:|\s|$)/i.test(lower);
  if (isIncome) {
    return {
      category: 'noaniq',
      title: normalized,
      isIncomeBlocked: true,
      confidence: 0.95,
      explanationUz: "ℹ️ Hozircha ilovada faqat xarajatlarni hisobga olish mavjud, daromadlar (kirim) funksiyasi hali qo'llab-quvvatlanmaydi.",
      source: 'local-rules',
    };
  }

  // 2. Unsupported interval schedule ("kunora") guard
  const isKunora = /\b(?:kunora|kun\s+ora)\b/i.test(lower);
  if (isKunora) {
    return {
      category: 'noaniq',
      title: normalized.replace(/\b(?:kunora|kun\s+ora)\b/gi, '').trim() || normalized,
      isIntervalBlocked: true,
      confidence: 0.95,
      explanationUz: "⚠️ Kunora (interval) jadvali hozircha qo'llab-quvvatlanmaydi. Iltimos, 'har kuni', 'haftasiga N kun' yoki muayyan kunlarni (masalan: dushanba, chorshanba, juma) tanlang.",
      source: 'local-rules',
    };
  }

  // 3. Check for multiple distinct money amounts (e.g. "tushlik 45000 so'm taksi 20000 so'm")
  const { matches: moneyMatches, hasAmbiguousFormat } = findRawMoneyMatches(normalized);
  if (hasAmbiguousFormat) {
    return {
      category: 'noaniq',
      title: normalized,
      clarificationNeeded: "Kiritilgan pul summasi formati noaniq. Iltimos, aniq summani kiriting (masalan: 45000 so'm yoki 45.000 so'm).",
      confidence: 0.5,
      explanationUz: "Pul summasi formati noaniq.",
      source: 'local-rules',
    };
  }

  if (moneyMatches.length >= 2) {
    return {
      category: 'noaniq',
      title: normalized,
      isMultipleActionsBlocked: true,
      confidence: 0.95,
      explanationUz: "⚠️ Matnda bir nechta pul miqdori aniqlandi. Iltimos, har bir xarajatni alohida xabar sifatida yuboring.",
      source: 'local-rules',
    };
  }

  // 4. Reliable Multiple Actions guard (independent clauses joined by "va" / "hamda")
  // NOTE: Simple conjunctions ("dushanba va juma", "ertaga va indin", "kitob va daftar", "tushlik va choy") are NOT multiple actions.
  if (/\s+(?:va|hamda)\s+/i.test(normalized)) {
    const isDaysPairing = /(?:dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)\s+(?:va|hamda)\s+(?:dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)/i.test(lower);
    const isDatesPairing = /(?:bugun|ertaga|indin)\s+(?:va|hamda)\s+(?:bugun|ertaga|indin)/i.test(lower);

    if (!isDaysPairing && !isDatesPairing) {
      const parts = normalized.split(/\s+(?:va|hamda)\s+/i);
      if (parts.length >= 2) {
        const hasActionSignature = (s: string) => {
          const hasMoney = /(?:so'?m|\$|dollar|usd)/i.test(s);
          const hasTime = /\b\d{1,2}:\d{2}\b/.test(s);
          const hasActionVerb = /(?:oldim|berdim|qildim|yubordim|bording|ichdim|o'qidim|qilish|yuborish|topshirish)/i.test(s);
          const hasHabitQty = /\b\d+\s*(?:bet|sahifa|daqiqa|km|qadam)\b/i.test(s);
          const hasSupplement = /\b(?:kreatin|arginin|vitamin)\b/i.test(s);
          return (hasMoney ? 1 : 0) + (hasTime ? 1 : 0) + (hasActionVerb ? 1 : 0) + (hasHabitQty ? 1 : 0) + (hasSupplement ? 1 : 0) >= 1;
        };

        if (hasActionSignature(parts[0]) && hasActionSignature(parts[1])) {
          const isSingleExpenseFood = moneyMatches.length === 1 && /(?:tushlik|ovqat|choy|kofe|non)/i.test(parts[0]) && /(?:choy|kofe|suv|shirinlik|non)/i.test(parts[1]);
          if (!isSingleExpenseFood) {
            return {
              category: 'noaniq',
              title: normalized,
              isMultipleActionsBlocked: true,
              confidence: 0.95,
              explanationUz: "⚠️ Bir vaqtda bir nechta amal aniqlandi. Iltimos, har bir vazifa yoki xarajatni alohida xabar sifatida yuboring.",
              source: 'local-rules',
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Validates runtime ParsedItem against strict domain contract.
 * Returns explicit ValidationResult with success flag and error descriptions.
 * Never silently substitutes invalid dates with today, or invalid times with null.
 */
export function validateParsedItemContract(
  raw: any,
  contextDateStr: string = formatDateYMD(new Date())
): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['Natija obyekti topilmadi yoki yaroqsiz formatda'], item: null };
  }

  const validCategories = ['vazifa', 'odat', 'maqsad', 'uchrashuv', 'harajat', 'qabul', 'noaniq'];
  if (!raw.category || !validCategories.includes(raw.category)) {
    errors.push(`Kategoriya noto'g'ri: ${raw.category}`);
  }

  // Date validation: distinguish MISSING vs INVALID
  let date: string | null = null;
  if (raw.date !== undefined && raw.date !== null && String(raw.date).trim() !== '') {
    const trimmedDate = String(raw.date).trim();
    if (!isValidYMD(trimmedDate)) {
      errors.push(`Kiritilgan sana haqiqiy emas: "${trimmedDate}"`);
    } else {
      date = trimmedDate;
    }
  }

  // Time validation: distinguish MISSING vs INVALID
  let time: string | null = null;
  if (raw.time !== undefined && raw.time !== null && String(raw.time).trim() !== '') {
    const trimmedTime = String(raw.time).trim();
    const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      errors.push(`Vaqt formati noto'g'ri (HH:mm bo'lishi kerak): "${trimmedTime}"`);
    } else {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        errors.push(`Vaqt diapazoni noto'g'ri (00:00 - 23:59 bo'lishi kerak): "${trimmedTime}"`);
      } else {
        time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  // Currency validation: strict check, do not silently convert unknown to UZS
  let currency: Currency | null = null;
  if (raw.currency !== undefined && raw.currency !== null && String(raw.currency).trim() !== '') {
    const curUpper = String(raw.currency).trim().toUpperCase();
    if (curUpper === 'UZS' || curUpper === 'USD') {
      currency = curUpper as Currency;
    } else {
      errors.push(`Noma'lum valyuta turi: "${raw.currency}"`);
    }
  }

  // Harajat specific validation
  let amount: number | null = null;
  let expenseCategory: ExpenseCategory | null = null;

  if (raw.category === 'harajat') {
    if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) {
      errors.push(`Xarajat summasi musbat chekli son bo'lishi shart, olingan: ${raw.amount}`);
    } else {
      amount = raw.amount;
    }

    if (!currency) {
      errors.push("Xarajat uchun valyuta aniqlanmadi (faqat UZS yoki USD qabul qilinadi)");
    }

    if (raw.expenseCategory) {
      if (!(EXPENSE_CATEGORIES as readonly string[]).includes(raw.expenseCategory)) {
        errors.push(`Xarajat toifasi noma'lum: ${raw.expenseCategory}`);
      } else {
        expenseCategory = raw.expenseCategory;
      }
    } else {
      expenseCategory = 'shaxsiy';
    }
  } else if (raw.amount !== undefined && raw.amount !== null) {
    if (typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount > 0) {
      amount = raw.amount;
    }
  }

  // Recurrence validation
  let frequency: HabitFrequency | null = null;
  let targetDaysPerWeek: number | null = null;
  let daysOfWeek: number[] | null = null;

  if (raw.frequency) {
    if (raw.frequency === 'daily' || raw.frequency === 'weekly_target' || raw.frequency === 'specific_days') {
      frequency = raw.frequency;
    } else {
      errors.push(`Noma'lum takrorlanish chastotasi: ${raw.frequency}`);
    }
  }

  if (frequency === 'specific_days') {
    if (!Array.isArray(raw.daysOfWeek) || raw.daysOfWeek.length === 0) {
      errors.push("specific_days jadvali uchun daysOfWeek talab qilinadi");
    } else {
      const validDays: number[] = raw.daysOfWeek.filter((d: any): d is number => Number.isInteger(d) && d >= 1 && d <= 7);
      if (validDays.length === 0) {
        errors.push("specific_days uchun kamida bitta 1..7 oralig'idagi butun kun talab qilinadi");
      } else {
        daysOfWeek = Array.from(new Set(validDays)).sort((a, b) => a - b);
      }
    }
  } else if (frequency === 'weekly_target') {
    if (typeof raw.targetDaysPerWeek !== 'number' || !Number.isInteger(raw.targetDaysPerWeek) || raw.targetDaysPerWeek < 1 || raw.targetDaysPerWeek > 7) {
      errors.push("weekly_target uchun targetDaysPerWeek 1..7 oralig'idagi butun son bo'lishi shart");
    } else {
      targetDaysPerWeek = raw.targetDaysPerWeek;
    }
  } else if (Array.isArray(raw.daysOfWeek) && raw.daysOfWeek.length > 0) {
    const validDays: number[] = raw.daysOfWeek.filter((d: any): d is number => Number.isInteger(d) && d >= 1 && d <= 7);
    if (validDays.length > 0) {
      daysOfWeek = Array.from(new Set(validDays)).sort((a, b) => a - b);
    }
  }

  const isIncomeBlocked = !!raw.isIncome || !!raw.isIncomeBlocked;
  const isIntervalBlocked = !!raw.isInterval || !!raw.isIntervalBlocked;
  const isMultipleActionsBlocked = !!raw.isMultipleActions || !!raw.isMultipleActionsBlocked;

  let title = typeof raw.title === 'string' ? normalizeUzbekText(raw.title) : '';
  if (!title && raw.category !== 'noaniq') {
    errors.push("Sarlavha (title) kiritilishi shart");
  }

  const isValid = errors.length === 0;

  const item: ParsedItem = {
    category: isValid ? raw.category : 'noaniq',
    title: title || 'Noma\'lum yozuv',
    date,
    time,
    amount,
    currency,
    expenseCategory,
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
    clarificationNeeded: raw.clarificationNeeded || (errors.length > 0 ? errors.join('. ') : null),
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : (isValid ? 0.9 : 0.4),
    explanationUz: typeof raw.explanationUz === 'string' && raw.explanationUz.trim() ? raw.explanationUz.trim() : title,
    source: raw.source === 'gemini-ai' ? 'gemini-ai' : 'local-rules',
  };

  return { isValid, errors, item };
}

/**
 * Validates and normalizes runtime ParsedItem against strict domain contract.
 * Used for AI response parsing with fallback to local rules if invalid.
 */
export function validateAndNormalizeParsedItem(
  raw: any,
  fallbackText: string = '',
  contextDateStr: string = formatDateYMD(new Date()),
  _timezone: string = 'Asia/Tashkent'
): ParsedItem {
  const result = validateParsedItemContract(raw, contextDateStr);
  if (result.isValid && result.item) {
    return result.item;
  }
  // If invalid, fall back to local rule parser using the original raw text
  return parseUzbekTextLocal(fallbackText, { referenceDate: new Date(), timezone: _timezone });
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

  // 1. Run deterministic preflight check first
  const preflightBlocked = runDeterministicPreflight(normalized, options);
  if (preflightBlocked) {
    return preflightBlocked;
  }

  let workingText = normalized;

  // 2. Time & Date token extraction BEFORE money parsing to prevent number collision (e.g. 17:00 -> 17)
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
  // MUST calculate both date and time using user's IANA timezone
  const relMinMatch = workingText.match(/(\d+)\s*daqiqadan\s+keyin/i);
  if (relMinMatch) {
    const mins = parseInt(relMinMatch[1], 10);
    if (mins >= 0 && mins < 1440) {
      const futureDate = new Date(refDate.getTime() + mins * 60000);
      targetDate = getDateStringInTimezone(futureDate, timezone);
      targetTime = getTimeStringInTimezone(futureDate, timezone);
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

  // 3. Recurrence patterns (weekly target & specific days)
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

  // Specific days: "har dushanba va juma", "payshanba kunlari"
  const dayMap: Record<string, number> = {
    dushanba: 1,
    seshanba: 2,
    chorshanba: 3,
    payshanba: 4,
    juma: 5,
    shanba: 6,
    yakshanba: 7,
  };

  const detectedDays: number[] = [];
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    const dayRegex = new RegExp(`\\b${dayName}(?:da|gi|lari)?\\b`, 'i');
    if (dayRegex.test(workingText)) {
      detectedDays.push(dayNum);
      workingText = workingText.replace(dayRegex, ' ');
    }
  }

  if (detectedDays.length > 0) {
    frequency = 'specific_days';
    daysOfWeek = Array.from(new Set(detectedDays)).sort((a, b) => a - b);
  } else if (/\bhar\s+kuni\b/i.test(workingText)) {
    frequency = 'daily';
    daysOfWeek = [1, 2, 3, 4, 5, 6, 7];
    workingText = workingText.replace(/\bhar\s+kuni\b/gi, ' ');
  }

  // 4. Money & Currency Extraction
  let amount: number | null = null;
  let currency: Currency | null = null;
  let clarificationNeeded: string | null = null;

  const { matches: moneyMatches, hasAmbiguousFormat } = findRawMoneyMatches(workingText);
  if (hasAmbiguousFormat) {
    clarificationNeeded = "Kiritilgan pul summasi formati noaniq. Iltimos, aniq summani kiriting (masalan: 45000 so'm yoki 45.000 so'm).";
  } else if (moneyMatches.length >= 2) {
    return {
      category: 'noaniq',
      title: normalized,
      isMultipleActionsBlocked: true,
      confidence: 0.95,
      explanationUz: "⚠️ Matnda bir nechta pul miqdori aniqlandi. Iltimos, har bir xarajatni alohida xabar sifatida yuboring.",
      source: 'local-rules',
    };
  } else if (moneyMatches.length === 1) {
    amount = moneyMatches[0].amount;
    currency = moneyMatches[0].currency;
    workingText = workingText.replace(moneyMatches[0].fullToken, ' ');
  }

  // If no currency found, only parse bare number if explicit expense prefix is present
  const hasExpensePrefix = /^(?:harajat|xarajat|sarf|rasxod)(?:\s*:|\s+)/i.test(normalized);
  if (amount === null && hasExpensePrefix) {
    const bareNumMatch = workingText.match(/\b(\d+)\b/);
    if (bareNumMatch) {
      const num = parseInt(bareNumMatch[1], 10);
      if (Number.isFinite(num) && num > 0) {
        amount = num;
        currency = 'UZS';
        workingText = workingText.replace(bareNumMatch[0], ' ');
      }
    }
  }

  // Clean expense prefix
  workingText = workingText.replace(/^(?:harajat|xarajat|sarf|rasxod|vazifa|maqsad|odat)(?:\s*:|\s+)/i, ' ');

  // 5. Category Determination
  let category: ParsedItem['category'] = 'noaniq';

  if (/^(?:harajat|xarajat|sarf|rasxod)/i.test(normalized) || (amount !== null && currency !== null)) {
    category = 'harajat';
  } else if (/^vazifa/i.test(normalized)) {
    category = 'vazifa';
  } else if (/^odat/i.test(normalized)) {
    category = 'odat';
  } else if (/^maqsad/i.test(normalized)) {
    category = 'maqsad';
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

  // 6. Health & Supplements (Qabul) detection
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

  // 7. General quantity & unit for habits/tasks (e.g. "60 daqiqa yurish", "20 bet kitob")
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

  // 8. Category Inference
  if (category === 'noaniq') {
    if (amount !== null && currency !== null) {
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

  // 9. Clean Title
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

  // 10. Human friendly explanation
  let explanationUz = '';
  if (category === 'harajat') {
    explanationUz = `💸 Xarajat: "${title}" (${amount !== null && currency ? formatMoney(amount, currency) : "Summa ko'rsatilmagan"})`;
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
 * High-level NLP parser with deterministic preflight protection, timeout management,
 * aiEnabled flag handling, and strict runtime contract validation.
 */
export async function parseUzbekIntent(
  text: string,
  options?: ParseNlpOptions
): Promise<ParsedItem> {
  const refDate = options?.referenceDate || new Date();
  const tz = options?.timezone || 'Asia/Tashkent';
  const aiEnabled = options?.aiEnabled !== false;
  const todayStr = getDateStringInTimezone(refDate, tz);
  const currentTimeStr = getTimeStringInTimezone(refDate, tz);

  // 1. DETERMINISTIC PREFLIGHT:
  // Strictly blocks Income, unsupported interval schedules ("kunora"), and reliable multiple actions.
  // This CANNOT be bypassed by AI under any circumstances!
  const preflightBlocked = runDeterministicPreflight(text, options);
  if (preflightBlocked) {
    return preflightBlocked;
  }

  // 2. If AI is disabled in settings, smoothly run local rule parser
  if (!aiEnabled) {
    return parseUzbekTextLocal(text, options);
  }

  let timeoutId: any;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('/api/parse-nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        currentDate: todayStr,
        currentTime: currentTimeStr,
        timezone: tz,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.parsed) {
        // Enforce strict runtime contract validation
        const valResult = validateParsedItemContract(data.parsed, todayStr);
        if (valResult.isValid && valResult.item) {
          // Double check deterministic preflight rules against the AI item as well!
          if (valResult.item.isIncomeBlocked || valResult.item.isIntervalBlocked || valResult.item.isMultipleActionsBlocked) {
            valResult.item.category = 'noaniq';
            return valResult.item;
          }
          return valResult.item;
        }
      }
    }
  } catch {
    // Timeout, network error, or server fallback -> smoothly use local rules
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  // If AI was invalid, corrupted, or failed, fall back to local rule-based parsing with the same refDate & tz
  return parseUzbekTextLocal(text, options);
}

/**
 * Creation boundary builders:
 * Protect entity creation by validating required fields and preventing creation with invalid states.
 */
export function buildHabitCreatePayload(
  parsed: ParsedItem
): { success: true; payload: HabitCreatePayload } | { success: false; error: string } {
  if (parsed.isIncomeBlocked) {
    return { success: false, error: "Daromad yozuvidan odat yaratib bo'lmaydi." };
  }
  if (parsed.isIntervalBlocked) {
    return { success: false, error: "Kunora jadvali qo'llab-quvvatlanmaydi. Iltimos, boshqa jadval tanlang." };
  }
  if (parsed.isMultipleActionsBlocked) {
    return { success: false, error: "Bir nechta amal bir vaqtda aniqlangan. Alohida yuboring." };
  }
  if (parsed.clarificationNeeded) {
    return { success: false, error: parsed.clarificationNeeded };
  }

  const title = parsed.title?.trim();
  if (!title) {
    return { success: false, error: "Odat nomi ko'rsatilmagan." };
  }

  let frequency: HabitFrequency = 'daily';
  let daysOfWeek: number[] = [1, 2, 3, 4, 5, 6, 7];
  let targetDaysPerWeek: number | undefined = undefined;

  if (parsed.frequency === 'weekly_target') {
    if (!parsed.targetDaysPerWeek || !Number.isInteger(parsed.targetDaysPerWeek) || parsed.targetDaysPerWeek < 1 || parsed.targetDaysPerWeek > 7) {
      return { success: false, error: "Haftalik maqsadli kunlar soni (1..7) ko'rsatilmagan yoki noto'g'ri." };
    }
    frequency = 'weekly_target';
    targetDaysPerWeek = parsed.targetDaysPerWeek;
    daysOfWeek = [1, 2, 3, 4, 5, 6, 7];
  } else if (parsed.frequency === 'specific_days') {
    if (!parsed.daysOfWeek || !Array.isArray(parsed.daysOfWeek) || parsed.daysOfWeek.length === 0) {
      return { success: false, error: "Tanlangan kunlar jadvali ko'rsatilmagan." };
    }
    const validDays = parsed.daysOfWeek.filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
    if (validDays.length === 0) {
      return { success: false, error: "Yaroqli hafta kunlari (1..7) topilmadi." };
    }
    frequency = 'specific_days';
    daysOfWeek = Array.from(new Set(validDays)).sort((a, b) => a - b);
  } else {
    frequency = 'daily';
    daysOfWeek = [1, 2, 3, 4, 5, 6, 7];
  }

  return {
    success: true,
    payload: {
      title,
      category: 'odat',
      habitType: parsed.habitType || (parsed.category === 'qabul' ? 'supplement_health' : 'general'),
      frequency,
      daysOfWeek,
      targetDaysPerWeek,
      hasQuantity: !!parsed.quantity,
      targetQuantity: parsed.quantity || undefined,
      unit: parsed.unit || (parsed.dosage ? undefined : 'qabul'),
      dosage: parsed.dosage || undefined,
      timeSlot: parsed.timeSlot || undefined,
    },
  };
}

export function buildExpenseCreatePayload(
  parsed: ParsedItem,
  defaultDate: string,
  defaultTime: string
): { success: true; payload: ExpenseCreatePayload } | { success: false; error: string } {
  if (parsed.isIncomeBlocked) {
    return { success: false, error: "Daromad yozuvi xarajat sifatida kiritilmaydi." };
  }
  if (parsed.isIntervalBlocked || parsed.isMultipleActionsBlocked || parsed.clarificationNeeded) {
    return { success: false, error: parsed.clarificationNeeded || "Amalni aniqlashtirish zarur." };
  }

  const title = parsed.title?.trim();
  if (!title) {
    return { success: false, error: "Xarajat nomi kiritilmagan." };
  }

  if (typeof parsed.amount !== 'number' || !Number.isFinite(parsed.amount) || parsed.amount <= 0) {
    return { success: false, error: "Xarajat summasi musbat chekli son bo'lishi shart." };
  }

  if (parsed.currency !== 'UZS' && parsed.currency !== 'USD') {
    return { success: false, error: "Valyuta turi noto'g'ri yoki noma'lum." };
  }

  if (parsed.date !== undefined && parsed.date !== null && String(parsed.date).trim() !== '') {
    if (!isValidYMD(String(parsed.date).trim())) {
      return { success: false, error: `Kiritilgan sana haqiqiy emas: "${parsed.date}"` };
    }
  }

  if (parsed.time !== undefined && parsed.time !== null && String(parsed.time).trim() !== '') {
    const timeStr = String(parsed.time).trim();
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return { success: false, error: `Kiritilgan vaqt noto'g'ri: "${parsed.time}"` };
    }
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return { success: false, error: `Kiritilgan vaqt noto'g'ri: "${parsed.time}"` };
    }
  }

  const category: ExpenseCategory = parsed.expenseCategory && (EXPENSE_CATEGORIES as readonly string[]).includes(parsed.expenseCategory) ? parsed.expenseCategory : 'shaxsiy';

  const date = parsed.date && isValidYMD(parsed.date) ? parsed.date : defaultDate;

  return {
    success: true,
    payload: {
      title,
      amount: parsed.amount,
      currency: parsed.currency,
      category,
      date,
      time: parsed.time || defaultTime,
      source: 'bot',
    },
  };
}

export function buildTaskCreatePayload(
  parsed: ParsedItem,
  defaultDate: string
): { success: true; payload: TaskCreatePayload } | { success: false; error: string } {
  if (parsed.isIncomeBlocked || parsed.isIntervalBlocked || parsed.isMultipleActionsBlocked || parsed.clarificationNeeded) {
    return { success: false, error: parsed.clarificationNeeded || "Amalni aniqlashtirish zarur." };
  }

  const title = parsed.title?.trim();
  if (!title) {
    return { success: false, error: "Vazifa nomi kiritilmagan." };
  }

  if (parsed.date !== undefined && parsed.date !== null && String(parsed.date).trim() !== '') {
    if (!isValidYMD(String(parsed.date).trim())) {
      return { success: false, error: `Kiritilgan sana haqiqiy emas: "${parsed.date}"` };
    }
  }

  if (parsed.time !== undefined && parsed.time !== null && String(parsed.time).trim() !== '') {
    const timeStr = String(parsed.time).trim();
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return { success: false, error: `Kiritilgan vaqt noto'g'ri: "${parsed.time}"` };
    }
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return { success: false, error: `Kiritilgan vaqt noto'g'ri: "${parsed.time}"` };
    }
  }

  const date = parsed.date && isValidYMD(parsed.date) ? parsed.date : defaultDate;

  return {
    success: true,
    payload: {
      title,
      category: parsed.category === 'uchrashuv' ? 'uchrashuv' : 'vazifa',
      date,
      time: parsed.time || undefined,
      status: 'pending',
      priority: 'medium',
      source: 'bot',
    },
  };
}

export type ProcessEntityResult =
  | { success: true; entityType: 'harajat'; payload: ExpenseCreatePayload; feedbackText: string }
  | { success: true; entityType: 'odat'; payload: HabitCreatePayload; feedbackText: string }
  | { success: true; entityType: 'qabul'; payload: HabitCreatePayload; feedbackText: string; markDoneToday?: boolean }
  | { success: true; entityType: 'vazifa' | 'uchrashuv'; payload: TaskCreatePayload; feedbackText: string }
  | { success: false; error: string; promptClarification?: boolean };

/**
 * Universal entity creation processor:
 * Used by both confirm_create and clarify_type flows to enforce strict production validation.
 */
export function processEntityCreationFromParsed(
  parsed: ParsedItem & { markDoneToday?: boolean },
  defaultDate: string,
  defaultTime: string
): ProcessEntityResult {
  if (parsed.isIncomeBlocked) {
    return {
      success: false,
      error: "ℹ️ Daromad hisobi: Hozircha ilovada faqat xarajatlar tahlili mavjud. Daromadlar keyingi versiyalarda qo'shiladi.",
    };
  }

  if (parsed.isIntervalBlocked) {
    return {
      success: false,
      error: "⚠️ Kunora takrorlanish jadvali hozircha avtomatik qo'llab-quvvatlanmaydi. Iltimos, boshqa jadval tanlang.",
    };
  }

  if (parsed.isMultipleActionsBlocked) {
    return {
      success: false,
      error: "⚠️ Bir nechta amal aniqlandi. Iltimos, har bir amalni alohida xabar sifatida yuboring.",
    };
  }

  if (parsed.clarificationNeeded) {
    return {
      success: false,
      error: parsed.clarificationNeeded,
      promptClarification: true,
    };
  }

  if (parsed.category === 'harajat') {
    if (parsed.amount === undefined || parsed.amount === null) {
      return {
        success: false,
        error: `Iltimos, "${parsed.title}" uchun xarajat summasini kiriting (masalan: "${parsed.title} 45000 so'm").`,
        promptClarification: true,
      };
    }

    const expBuild = buildExpenseCreatePayload(parsed, defaultDate, defaultTime);
    if (!expBuild.success) {
      return { success: false, error: expBuild.error, promptClarification: true };
    }

    const moneyStr = formatMoney(expBuild.payload.amount, expBuild.payload.currency);
    return {
      success: true,
      entityType: 'harajat',
      payload: expBuild.payload,
      feedbackText: `💸 Xarajat saqlandi: **${moneyStr}** - "${expBuild.payload.title}"`,
    };
  }

  if (parsed.category === 'qabul') {
    const habitBuild = buildHabitCreatePayload(parsed);
    if (!habitBuild.success) {
      return { success: false, error: habitBuild.error, promptClarification: true };
    }

    return {
      success: true,
      entityType: 'qabul',
      payload: habitBuild.payload,
      markDoneToday: parsed.markDoneToday === true,
      feedbackText: `💊 Salomatlik qabuli saqlandi: **"${habitBuild.payload.title}"**`,
    };
  }

  if (parsed.category === 'odat') {
    const habitBuild = buildHabitCreatePayload(parsed);
    if (!habitBuild.success) {
      return { success: false, error: habitBuild.error, promptClarification: true };
    }

    return {
      success: true,
      entityType: 'odat',
      payload: habitBuild.payload,
      feedbackText: `🔁 Odat saqlandi: **"${habitBuild.payload.title}"**`,
    };
  }

  if (parsed.category === 'vazifa' || parsed.category === 'uchrashuv') {
    const taskBuild = buildTaskCreatePayload(parsed, defaultDate);
    if (!taskBuild.success) {
      return { success: false, error: taskBuild.error, promptClarification: true };
    }

    const dateLabel = formatUzbekDateLabel(taskBuild.payload.date, taskBuild.payload.time);
    return {
      success: true,
      entityType: taskBuild.payload.category,
      payload: taskBuild.payload,
      feedbackText: `✅ ${taskBuild.payload.category === 'uchrashuv' ? 'Uchrashuv' : 'Vazifa'} saqlandi: **"${taskBuild.payload.title}"** (${dateLabel})`,
    };
  }

  return {
    success: false,
    error: `Noma'lum kategoriya: "${parsed.category}". Iltimos, toifani aniqlashtiring.`,
    promptClarification: true,
  };
}
