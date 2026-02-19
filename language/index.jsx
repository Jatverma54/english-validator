// utils/languageDetector.js
import { francAll } from "franc";
import { englishDictionary, wordsToRemove } from "./dictionary";
 
// Memoization cache for franc results
const francCache = new Map();
const FRANC_CACHE_LIMIT = 1000;
 
// Memoization cache for word checks
const wordCache = new Map();
const WORD_CACHE_LIMIT = 5000;
 
function francLanguageAnalysis(cleanText) {
  // Check cache first
  if (francCache.has(cleanText)) {
    const detectedLanguage = francCache.get(cleanText);
    const [language, confidence] = detectedLanguage;
    return { language, confidence };
  }
 
  const detectedLanguage = francAll(cleanText);
 
  // Check top 5 results for English with 0.9+ confidence
  const top5Results = detectedLanguage.slice(0, 5);
  for (const [lang, conf] of top5Results) {
    if (lang === "eng" && conf >= 0.9) {
      // Cache management
      if (francCache.size >= FRANC_CACHE_LIMIT) {
        const firstKey = francCache.keys().next().value;
        francCache.delete(firstKey);
      }
      francCache.set(cleanText, [lang, conf]);
 
      return { language: lang, confidence: conf };
    }
  }
 
  // If no English with 0.9+ confidence found, use the top result
  const [language, confidence] = detectedLanguage[0];
 
  // Cache management
  if (francCache.size >= FRANC_CACHE_LIMIT) {
    const firstKey = francCache.keys().next().value;
    francCache.delete(firstKey);
  }
  francCache.set(cleanText, detectedLanguage[0]);
 
  return { language, confidence };
}
 
/**
 * Checks if a string matches document ID patterns like:
 * - AEM01-WI-DSU06-SD01
 * - AURG340-SF06
 *
 * @param {string} text - The text to check for document patterns
 * @returns {boolean} - True if the text contains a document ID pattern
 */
export const matchesDocumentPattern = (text) => {
  if (!text || typeof text !== "string") {
    return false;
  }
 
  // Document ID patterns:
  // 1. Alpha prefix followed by numbers and optional section identifiers separated by hyphens
  // 2. Allow combinations of letters and numbers with hyphens
  const documentPatterns = [
    /\b[A-Z]{2,6}\d{1,4}(-[A-Z]{1,3}\d{1,4}){1,3}\b/, // Pattern like AEM01-WI-DSU06-SD01
    /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/, // Pattern like AURG340-SF06
    /\b[A-Z]{2,6}\d{1,4}\b/ // Simple pattern like AEM01, AURG340
  ];
 
  // Check if any pattern matches
  for (const pattern of documentPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
 
  return false;
};
 
const removeDocumentPatterns = (text) => {
  const documentPatterns = [
    // More flexible pattern to handle mixed cases like AEM01-WI-DSU06-SD01, AEM01-WI123-DSU06-SD01
    /\b[A-Z]{2,6}\d{0,4}(-[A-Z]{2,6}\d{0,4}){1,4}\b/g, // Handles any combination with/without digits
    /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/g, // AURG340-SF06
    /\b[A-Z]{2,6}\d{1,4}\b/g, // ARG03, WI035
    /\b[A-Z]{2,4}-[A-Z]{2,4}\d{2,4}\b/g // WI-SER035
  ];
 
  let cleanedText = text;
  for (const pattern of documentPatterns) {
    cleanedText = cleanedText.replace(pattern, "");
  }
 
  // Clean up extra spaces
  return cleanedText.replace(/\s+/g, " ").trim();
};
 
 
/**
 * Removes geographical terms only when they appear as standalone words
 */
const removeGeographicalTermsExact = (inputText) => {
  if (!inputText || typeof inputText !== 'string') {
    return inputText;
  }
 
  // Create a regex pattern to match whole words only (with word boundaries)
  const wordRegexPatterns = wordsToRemove.map(([word]) =>
    new RegExp(`\\b${word}\\b|\\b${word}s\\b`, 'i')
  );
 
  let result = inputText;
 
  // Replace each word to remove with an empty string
  // This preserves surrounding punctuation and special characters
  for (const pattern of wordRegexPatterns) {
    result = result.replace(pattern, '');
  }
 
  // Clean up multiple spaces that might have been created
  return result.replace(/\s+/g, ' ').trim();
};
 
/**
 * Detects if text is non-English using comprehensive built-in word patterns
 * @param {string} inputText - Text to analyze
 * @param {object} options - Configuration options
 * @returns {boolean} - true if NON-English, false if English
 */
export const detectNonEnglishText = (inputText, options = {}) => {
  let { englishThreshold = 0.8, minWordLength = 2, allowNumbers = true, allowAbbreviations = true } = options;
  const francInputText = inputText;
  // Input validation
  if (!inputText || typeof inputText !== "string" || inputText.trim().length === 0) {
    return false;
  }
  // Check if the input text is likely a document reference
  inputText = removeDocumentPatterns(inputText);
  inputText = removeGeographicalTermsExact(inputText);
  inputText = inputText
    .replace(/[^\p{L}\s.,!?:;'"()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
 
  // Extract words from input text
  const words = inputText.toLowerCase().split(" ");
 
  if (words.length === 0) {
    return false;
  } else if (words.length <= 4) {
    englishThreshold = 0.6; // Lower threshold for very short texts
  }
 
  let englishWordCount = 0;
  let totalRelevantWords = 0;
 
  // Analyze each word
  for (const word of words) {
    const cleanWord = word.replace(/['''\-""`~!@#$%^&*()+={}[\]|\\:";'<>?,./]/g, "").trim();
 
    // Skip very short words
    if (cleanWord.length < minWordLength) {
      continue;
    }
 
    totalRelevantWords++;
 
    // Check if word is English with caching
    if (isEnglishWordCached(cleanWord, { allowNumbers, allowAbbreviations })) {
      englishWordCount++;
    }
  }
 
  // Calculate English ratio
  const englishRatio = totalRelevantWords > 0 ? englishWordCount / totalRelevantWords : 1.0;
  if (englishRatio >= englishThreshold) {
    return false; // Definitely English
  }
 
  const { language, confidence } = francLanguageAnalysis(francInputText);
  if (language === "eng" && confidence >= 0.9 && englishRatio >= 0.7) {
    return false;
  } else if (language != "eng" && confidence >= 0.9) {
    return true;
  } else {
    return true;
  }
};
 
// Cached version of isEnglishWord
const isEnglishWordCached = (word, options) => {
  const cacheKey = `${word}_${options.allowNumbers}_${options.allowAbbreviations}`;
 
  if (wordCache.has(cacheKey)) {
    return wordCache.get(cacheKey);
  }
 
  const result = isEnglishWord(word, options);
  // Cache management
  if (wordCache.size >= WORD_CACHE_LIMIT) {
    const firstKey = wordCache.keys().next().value;
    wordCache.delete(firstKey);
  }
  wordCache.set(cacheKey, result);
 
  return result;
};
 
// Helper function to check character patterns (reduces main function complexity)
const hasNonEnglishCharacters = (text) => {
  const nonEnglishCharCombos = [
    /[äöüß]/i, // German
    /[éèêëàâçùûüÿæœ]/i, // French
    /[áéíóúüñ¡¿]/i, // Spanish
    /[àèìòùé]/i, // Italian
    /[åøæ]/i, // Scandinavian
    /[ąćęłńóśźż]/i, // Polish
    /[şğçıöü]/i // Turkish
  ];
 
  return nonEnglishCharCombos.some(pattern => pattern.test(text));
};
 
// Helper function to check word endings (reduces main function complexity)
const hasNonEnglishEndings = (text) => {
  const nonEnglishEndings = [
    /keit$/i, // German
    /schaft$/i, // German
    /ción$/i, // Spanish
    /zione$/i, // Italian
    /mente$/i, // Spanish/Italian
    /baar$/i, // Dutch
    /lijk$/i, // Dutch
    /eur$/i, // French
    /agem$/i, // Portuguese
    /ção$/i // Portuguese
  ];
 
  return nonEnglishEndings.some(pattern => pattern.test(text));
};
 
// Helper function to check word patterns (reduces main function complexity)
const hasNonEnglishWordPatterns = (text) => {
  const singleWordNonEnglishPatterns = [
    // German distinctive words (not found in English)
    /^(und|oder|Wann|aber|Kann|wenn|weil|dass|ob|für|nicht|kein|keine|nur|sehr|schon|noch|jetzt|immer|wieder|möchte|würde|hätte|könnte|sollte|müsste|dürfte)$/i,
   
    // Spanish distinctive words
    /^(que|como|porque|pero|cuando|donde|quien|cual|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas)$/i,
   
    // French distinctive words
    /^(est|sont|était|être|avoir|faire|dire|voir|pouvoir|vouloir|devoir|falloir|savoir|quand|où|pourquoi|qui|quel|quelle|quels|quelles|ce|cette|ces|cet)$/i,
   
    // Italian distinctive words
    /^(sono|sei|è|siamo|siete|sono|essere|avere|fare|dire|andare|vedere|dare|sapere|potere|volere|come|quando|dove|perché|chi|quale|quali)$/i,
   
    // Dutch distinctive words (carefully selected to avoid English overlaps)
    /^(en|hoe|es|Er|Wanneer|je|stel|kritiek|et|kritisk|maar|want|omdat|hoewel|terwijl|tenzij|indien|toen|totdat|voordat|nadat|zodat|mits|toch|dus|immers|namelijk)$/i,
   
    // Portuguese distinctive words
    /^(eu|tu|ele|ela|nós|vós|eles|elas|isto|isso|aquilo|mesmo|mesma|mesmos|mesmas|próprio|própria|próprios|próprias)$/i,
   
    // Turkish distinctive words
    /^(ben|sen|biz|siz|onlar|bana|sana|ona|bize|size|onlara|benim|senin|onun|bizim|sizin|onların)$/i,
   
    // Scandinavian distinctive words
    /^(jeg|mig|min|mit|mine|dig|din|dit|dine|han|ham|hans|hun|hende|hendes|den|det|de|dem|deres|denne|dette|disse)$/i
  ];
 
  return singleWordNonEnglishPatterns.some(pattern => pattern.test(text));
};
 
const hasObviousNonEnglishIndicators = (text) => {
  // Quick exit if we're dealing with a very short string or empty
  if (!text || typeof text !== 'string' || text.length < 2) {
    return false;
  }
 
  // Special case for single-word analysis
  if (!text.includes(' ')) {
    if (hasNonEnglishCharacters(text) || hasNonEnglishEndings(text)) {
      return true;
    }
  }
 
  // For single words, check against core non-English word lists
  if (hasNonEnglishWordPatterns(text)) {
    return true;
  }
 
  // Non-English language definite articles and common short prepositions
  const nonEnglishFunctionWords = /^(le|la|les|du|des|dans|avec|sans|sur|sous|entre|el|los|las|del|al|con|sin|por|der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|mit|il|lo|gli|het|een|op|aan|voor|met|door|os|dos|das|nos|nas|um|uma)$/i;
 
  return nonEnglishFunctionWords.test(text);
};
 
// Check if a single word is English
const isEnglishWord = (word, options) => {
  const { allowNumbers } = options;
  // Validate that word contains only English characters
  if (!hasOnlyEnglishCharacters(word)) {
    return false;
  }
 
  // Numbers are considered valid
  if (allowNumbers && /^\d+$/.test(word)) {
    return true;
  }
 
  if (hasObviousNonEnglishIndicators(word)) {
    return false;
  }
 
  // Direct dictionary lookup (most common case first)
  if (englishDictionary.has(word)) {
    return true;
  }
 
  // Handle common contractions
  if (word.includes("'")) {
    const contractionBase = word.split("'")[0];
    if (englishDictionary.has(contractionBase)) {
      return true;
    }
  }
 
  return false;
};
 
// Validation function to check if word contains only English characters
const hasOnlyEnglishCharacters = (word) => {
  // Allow only English letters (a-z, A-Z), numbers (0-9), apostrophes, and hyphens
  return /^[a-zA-Z0-9'-]+$/.test(word);
};
 
// Optional: Clear caches if needed (useful for memory management in long-running apps)
export const clearLanguageDetectorCaches = () => {
  francCache.clear();
  wordCache.clear();
};