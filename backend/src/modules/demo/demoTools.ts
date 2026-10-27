import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response';

export const demoRouter = Router();

// ==========================================
// 1. Text Translator Demo
// ==========================================
const translateSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  targetLanguage: z.string().min(2, 'Target language is required (e.g. es, fr, de, hi)'),
});

const translations: Record<string, Record<string, string>> = {
  hello: { es: 'hola', fr: 'bonjour', de: 'hallo', hi: 'नमस्ते', it: 'ciao' },
  world: { es: 'mundo', fr: 'monde', de: 'Welt', hi: 'दुनिया', it: 'mondo' },
  'thank you': { es: 'gracias', fr: 'merci', de: 'danke', hi: 'धन्यवाद', it: 'grazie' },
  goodbye: { es: 'adiós', fr: 'au revoir', de: 'auf Wiedersehen', hi: 'अलविदा', it: 'arrivederci' },
  please: { es: 'por favor', fr: "s'il vous plaît", de: 'bitte', hi: 'कृपया', it: 'per favore' },
  yes: { es: 'sí', fr: 'oui', de: 'ja', hi: 'हाँ', it: 'sì' },
  no: { es: 'no', fr: 'non', de: 'nein', hi: 'नहीं', it: 'no' },
};

demoRouter.post('/translate', (req: Request, res: Response) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Invalid translation parameters', 400, 'VALIDATION_ERROR', parsed.error.format());
  }

  const { text, targetLanguage } = parsed.data;
  const lang = targetLanguage.toLowerCase().slice(0, 2);
  const words = text.toLowerCase().split(/\b/);
  
  const translatedWords = words.map((word) => {
    const cleanWord = word.trim();
    if (translations[cleanWord] && translations[cleanWord][lang]) {
      return translations[cleanWord][lang];
    }
    return word;
  });

  return sendSuccess(res, {
    originalText: text,
    translatedText: translatedWords.join(''),
    targetLanguage: lang,
    detectedSourceLanguage: 'en',
    providerNote: 'Demo translation: uses local dictionary with limited vocabulary',
  });
});

// ==========================================
// 2. Scam Message Risk Analyzer Demo
// ==========================================
const scamSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(urgent|immediate action required|act now|hurry)\b/i, reason: 'Creates artificial urgency' },
  { pattern: /\b(won a lottery|claim your prize|winner|million dollars|congratulations)\b/i, reason: 'Unrealistic financial reward promised' },
  { pattern: /\b(send your password|verify your pin|ssn|social security|credit card number|cvv)\b/i, reason: 'Requests sensitive security credentials' },
  { pattern: /\b(wire transfer|crypto|western union|gift card|itunes card|bitcoin)\b/i, reason: 'Requests untraceable payment method' },
  { pattern: /\b(bank account suspended|account locked|unauthorized transaction)\b/i, reason: 'Fabricated threat or panic-inducing security warning' },
  { pattern: /https?:\/\/(?:bit\.ly|tinyurl|is\.gd|goo\.gl|t\.co)\/\S+/i, reason: 'Contains shortened or obfuscated URL' },
];

demoRouter.post('/scam-risk', (req: Request, res: Response) => {
  const parsed = scamSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Message text is required', 400, 'VALIDATION_ERROR', parsed.error.format());
  }

  const { message } = parsed.data;
  const matchedReasons: string[] = [];

  for (const item of SUSPICIOUS_PATTERNS) {
    if (item.pattern.test(message)) {
      matchedReasons.push(item.reason);
    }
  }

  const riskScore = Math.min(100, matchedReasons.length * 28);
  const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 35 ? 'medium' : 'low';

  return sendSuccess(res, {
    riskScore,
    riskLevel,
    reasons: matchedReasons.length > 0 ? matchedReasons : ['No overt high-risk heuristic triggers detected'],
    isDemo: true,
    disclaimer:
      'This heuristic risk assessment is generated for informational/demonstration purposes only. It does not constitute a definitive determination that any message or entity is fraudulent.',
  });
});

// ==========================================
// 3. Sentiment Analyzer Demo
// ==========================================
const sentimentSchema = z.object({
  text: z.string().min(1, 'Text is required'),
});

const POSITIVE_WORDS = new Set(['good', 'great', 'excellent', 'amazing', 'happy', 'love', 'fast', 'reliable', 'superb', 'awesome', 'best', 'fantastic']);
const NEGATIVE_WORDS = new Set(['bad', 'terrible', 'horrible', 'poor', 'sad', 'hate', 'slow', 'broken', 'worst', 'awful', 'angry', 'fail', 'buggy']);

demoRouter.post('/sentiment', (req: Request, res: Response) => {
  const parsed = sentimentSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Text is required', 400, 'VALIDATION_ERROR', parsed.error.format());
  }

  const words = parsed.data.text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  let score = 0;
  const keywordsMatched: string[] = [];

  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) {
      score += 1;
      keywordsMatched.push(`+${w}`);
    } else if (NEGATIVE_WORDS.has(w)) {
      score -= 1;
      keywordsMatched.push(`-${w}`);
    }
  }

  const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';

  return sendSuccess(res, {
    sentiment,
    score,
    keywordsMatched,
    analyzedWordCount: words.length,
    isDemo: true,
  });
});
