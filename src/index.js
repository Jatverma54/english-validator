import { francAll } from "franc";
import { englishDictionary, wordsToRemove } from "./dictionary.js";

const francCache = new Map();
const FRANC_CACHE_LIMIT = 1000;

const wordCache = new Map();
const WORD_CACHE_LIMIT = 5000;

function francLanguageAnalysis(cleanText) {
  if (francCache.has(cleanText)) {
    const detectedLanguage = francCache.get(cleanText);
    const [language, confidence] = detectedLanguage;
    return { language, confidence };
  }

  const detectedLanguage = francAll(cleanText);

  const top5Results = detectedLanguage.slice(0, 5);
  for (const [lang, conf] of top5Results) {
    if (lang === "eng" && conf >= 0.9) {
      if (francCache.size >= FRANC_CACHE_LIMIT) {
        const firstKey = francCache.keys().next().value;
        francCache.delete(firstKey);
      }
      francCache.set(cleanText, [lang, conf]);
      return { language: lang, confidence: conf };
    }
  }

  const [language, confidence] = detectedLanguage[0];

  if (francCache.size >= FRANC_CACHE_LIMIT) {
    const firstKey = francCache.keys().next().value;
    francCache.delete(firstKey);
  }
  francCache.set(cleanText, detectedLanguage[0]);

  return { language, confidence };
}

export const matchesDocumentPattern = (text) => {
  if (!text || typeof text !== "string") {
    return false;
  }

  const documentPatterns = [
    /\b[A-Z]{2,6}\d{1,4}(-[A-Z]{1,3}\d{1,4}){1,3}\b/,
    /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/,
    /\b[A-Z]{2,6}\d{1,4}\b/,
  ];

  for (const pattern of documentPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
};

const removeDocumentPatterns = (text) => {
  const documentPatterns = [
    /\b[A-Z]{2,6}\d{0,4}(-[A-Z]{2,6}\d{0,4}){1,4}\b/g,
    /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/g,
    /\b[A-Z]{2,6}\d{1,4}\b/g,
    /\b[A-Z]{2,4}-[A-Z]{2,4}\d{2,4}\b/g,
  ];

  let cleanedText = text;
  for (const pattern of documentPatterns) {
    cleanedText = cleanedText.replace(pattern, "");
  }

  return cleanedText.replace(/\s+/g, " ").trim();
};

const removeGeographicalTermsExact = (inputText) => {
  if (!inputText || typeof inputText !== "string") {
    return inputText;
  }

  const wordRegexPatterns = wordsToRemove.map(
    ([word]) => new RegExp(`\\b${word}\\b|\\b${word}s\\b`, "i")
  );

  let result = inputText;

  for (const pattern of wordRegexPatterns) {
    result = result.replace(pattern, "");
  }

  return result.replace(/\s+/g, " ").trim();
};

/**
 * Detects if text is non-English.
 * @param {string} inputText - Text to analyze
 * @param {object} [options] - Configuration options
 * @param {number} [options.englishThreshold=0.8] - Ratio of English words needed to classify as English (0-1)
 * @param {number} [options.minWordLength=2] - Minimum word length to consider
 * @param {boolean} [options.allowNumbers=true] - Whether to treat numbers as valid English tokens
 * @param {boolean} [options.allowAbbreviations=true] - Whether to allow abbreviations
 * @returns {boolean} true if NON-English, false if English
 */
export const detectNonEnglishText = (inputText, options = {}) => {
  let {
    englishThreshold = 0.8,
    minWordLength = 2,
    allowNumbers = true,
    allowAbbreviations = true,
  } = options;

  const francInputText = inputText;

  if (
    !inputText ||
    typeof inputText !== "string" ||
    inputText.trim().length === 0
  ) {
    return false;
  }

  inputText = removeDocumentPatterns(inputText);
  inputText = removeGeographicalTermsExact(inputText);
  inputText = inputText
    .replace(/[^\p{L}\s.,!?:;'"()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = inputText.toLowerCase().split(" ");

  if (words.length === 0) {
    return false;
  } else if (words.length <= 4) {
    englishThreshold = 0.6;
  }

  let englishWordCount = 0;
  let totalRelevantWords = 0;

  for (const word of words) {
    const cleanWord = word
      .replace(/['''\-""`~!@#$%^&*()+={}[\]|\\:";'<>?,./]/g, "")
      .trim();

    if (cleanWord.length < minWordLength) {
      continue;
    }

    totalRelevantWords++;

    if (isEnglishWordCached(cleanWord, { allowNumbers, allowAbbreviations })) {
      englishWordCount++;
    }
  }

  const englishRatio =
    totalRelevantWords > 0 ? englishWordCount / totalRelevantWords : 1.0;

  if (englishRatio >= englishThreshold) {
    return false;
  }

  const { language, confidence } = francLanguageAnalysis(francInputText);

  if (language === "eng" && confidence >= 0.9 && englishRatio >= 0.7) {
    return false;
  } else if (language !== "eng" && confidence >= 0.9) {
    return true;
  } else {
    return true;
  }
};

/**
 * Convenience wrapper: returns true if text IS English, false otherwise.
 * @param {string} inputText - Text to analyze
 * @param {object} [options] - Same options as detectNonEnglishText
 * @returns {boolean} true if English, false if non-English
 */
export const isEnglish = (inputText, options = {}) => {
  return !detectNonEnglishText(inputText, options);
};

const isEnglishWordCached = (word, options) => {
  const cacheKey = `${word}_${options.allowNumbers}_${options.allowAbbreviations}`;

  if (wordCache.has(cacheKey)) {
    return wordCache.get(cacheKey);
  }

  const result = isEnglishWord(word, options);

  if (wordCache.size >= WORD_CACHE_LIMIT) {
    const firstKey = wordCache.keys().next().value;
    wordCache.delete(firstKey);
  }
  wordCache.set(cacheKey, result);

  return result;
};

const hasNonEnglishCharacters = (text) => {
  const nonEnglishCharCombos = [
    /[äöüß]/i,
    /[éèêëàâçùûüÿæœ]/i,
    /[áéíóúüñ¡¿]/i,
    /[àèìòùé]/i,
    /[åøæ]/i,
    /[ąćęłńóśźż]/i,
    /[şğçıöü]/i,
  ];

  return nonEnglishCharCombos.some((pattern) => pattern.test(text));
};

const hasNonEnglishEndings = (text) => {
  const nonEnglishEndings = [
    /keit$/i,
    /schaft$/i,
    /ción$/i,
    /zione$/i,
    /mente$/i,
    /baar$/i,
    /lijk$/i,
    /eur$/i,
    /agem$/i,
    /ção$/i,
  ];

  return nonEnglishEndings.some((pattern) => pattern.test(text));
};

const hasNonEnglishWordPatterns = (text) => {
  const singleWordNonEnglishPatterns = [
    /^(und|oder|Wann|aber|Kann|wenn|weil|dass|ob|für|nicht|kein|keine|nur|sehr|schon|noch|jetzt|immer|wieder|möchte|würde|hätte|könnte|sollte|müsste|dürfte)$/i,
    /^(que|como|porque|pero|cuando|donde|quien|cual|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas)$/i,
    /^(est|sont|était|être|avoir|faire|dire|voir|pouvoir|vouloir|devoir|falloir|savoir|quand|où|pourquoi|qui|quel|quelle|quels|quelles|ce|cette|ces|cet)$/i,
    /^(sono|sei|è|siamo|siete|sono|essere|avere|fare|dire|andare|vedere|dare|sapere|potere|volere|come|quando|dove|perché|chi|quale|quali)$/i,
    /^(en|hoe|es|Er|Wanneer|je|stel|kritiek|et|kritisk|maar|want|omdat|hoewel|terwijl|tenzij|indien|toen|totdat|voordat|nadat|zodat|mits|toch|dus|immers|namelijk)$/i,
    /^(eu|tu|ele|ela|nós|vós|eles|elas|isto|isso|aquilo|mesmo|mesma|mesmos|mesmas|próprio|própria|próprios|próprias)$/i,
    /^(ben|sen|biz|siz|onlar|bana|sana|ona|bize|size|onlara|benim|senin|onun|bizim|sizin|onların)$/i,
    /^(jeg|mig|min|mit|mine|dig|din|dit|dine|han|ham|hans|hun|hende|hendes|den|det|de|dem|deres|denne|dette|disse)$/i,
  ];

  return singleWordNonEnglishPatterns.some((pattern) => pattern.test(text));
};

const hasObviousNonEnglishIndicators = (text) => {
  if (!text || typeof text !== "string" || text.length < 2) {
    return false;
  }

  if (!text.includes(" ")) {
    if (hasNonEnglishCharacters(text) || hasNonEnglishEndings(text)) {
      return true;
    }
  }

  if (hasNonEnglishWordPatterns(text)) {
    return true;
  }

  const nonEnglishFunctionWords =
    /^(le|la|les|du|des|dans|avec|sans|sur|sous|entre|el|los|las|del|al|con|sin|por|der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|mit|il|lo|gli|het|een|op|aan|voor|met|door|os|dos|das|nos|nas|um|uma)$/i;

  return nonEnglishFunctionWords.test(text);
};

const isEnglishWord = (word, options) => {
  const { allowNumbers } = options;

  if (!hasOnlyEnglishCharacters(word)) {
    return false;
  }

  if (allowNumbers && /^\d+$/.test(word)) {
    return true;
  }

  if (hasObviousNonEnglishIndicators(word)) {
    return false;
  }

  if (englishDictionary.has(word)) {
    return true;
  }

  if (word.includes("'")) {
    const contractionBase = word.split("'")[0];
    if (englishDictionary.has(contractionBase)) {
      return true;
    }
  }

  return false;
};

const hasOnlyEnglishCharacters = (word) => {
  return /^[a-zA-Z0-9'-]+$/.test(word);
};

export const clearLanguageDetectorCaches = () => {
  francCache.clear();
  wordCache.clear();
};
