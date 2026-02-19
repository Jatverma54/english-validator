import { francAll } from "franc";
import { englishDictionary, wordsToRemove } from "./dictionary";

// ─── Public Interfaces ────────────────────────────────────────────────────────

/** Configuration options for text detection functions. */
export interface DetectionOptions {
  /** Minimum ratio of English words required (0.0–1.0). Default: 0.8 */
  englishThreshold?: number;
  /** Words shorter than this are skipped during analysis. Default: 2 */
  minWordLength?: number;
  /** Whether standalone numbers count as English words. Default: true */
  allowNumbers?: boolean;
  /** Whether abbreviations are allowed. Default: true */
  allowAbbreviations?: boolean;
}

/** Internal result from franc trigram-based language analysis. */
interface LanguageResult {
  language: string;
  confidence: number;
}

/** Internal options for word-level English checks. */
interface WordOptions {
  allowNumbers: boolean;
  allowAbbreviations: boolean;
}

// ─── Module-Level Constants & Precompiled Patterns ────────────────────────────

const FRANC_CACHE_LIMIT = 1000;
const WORD_CACHE_LIMIT = 5000;

/** LRU-style cache for franc language analysis results. */
const francCache = new Map<string, [string, number]>();

/** LRU-style cache for individual word English-check results. */
const wordCache = new Map<string, boolean>();

/** Document ID patterns used for matching (non-global). */
const DOCUMENT_PATTERNS_MATCH: readonly RegExp[] = [
  /\b[A-Z]{2,6}\d{1,4}(-[A-Z]{1,3}\d{1,4}){1,3}\b/,
  /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/,
  /\b[A-Z]{2,6}\d{1,4}\b/,
];

/** Document ID patterns used for removal (global flag). */
const DOCUMENT_PATTERNS_REMOVE: readonly RegExp[] = [
  /\b[A-Z]{2,6}\d{0,4}(-[A-Z]{2,6}\d{0,4}){1,4}\b/g,
  /\b[A-Z]{2,6}\d{2,4}-[A-Z]{1,3}\d{1,3}\b/g,
  /\b[A-Z]{2,6}\d{1,4}\b/g,
  /\b[A-Z]{2,4}-[A-Z]{2,4}\d{2,4}\b/g,
];

/**
 * Single combined regex for non-English European characters.
 * Covers German (äöüß), French (éèêë), Spanish (ñ), Italian (ìò),
 * Scandinavian (åøæ), Polish (łńś), and Turkish (şğı).
 */
const NON_ENGLISH_CHARS_REGEX =
  /[äöüßéèêëàâçùûÿæœáíóúñ¡¿ìòåøąćęłńśźżşğı]/i;

/**
 * Single combined regex for word suffixes typical of non-English languages.
 * German (-keit, -schaft), Spanish (-ción), Italian (-zione),
 * Dutch (-baar, -lijk), Portuguese (-agem, -ção), French (-eur).
 */
const NON_ENGLISH_ENDINGS_REGEX =
  /(?:keit|schaft|ción|zione|mente|baar|lijk|eur|agem|ção)$/i;

/** Non-English articles and prepositions from multiple European languages. */
const NON_ENGLISH_FUNCTION_WORDS_REGEX =
  /^(le|la|les|du|des|dans|avec|sans|sur|sous|entre|el|los|las|del|al|con|sin|por|der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|mit|il|lo|gli|het|een|op|aan|voor|met|door|os|dos|das|nos|nas|um|uma)$/i;

/** Non-English vocabulary patterns grouped by language family. */
const NON_ENGLISH_WORD_PATTERNS: readonly RegExp[] = [
  /^(und|oder|Wann|aber|Kann|wenn|weil|dass|ob|für|nicht|kein|keine|nur|sehr|schon|noch|jetzt|immer|wieder|möchte|würde|hätte|könnte|sollte|müsste|dürfte)$/i,
  /^(que|como|porque|pero|cuando|donde|quien|cual|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas)$/i,
  /^(est|sont|était|être|avoir|faire|dire|voir|pouvoir|vouloir|devoir|falloir|savoir|quand|où|pourquoi|qui|quel|quelle|quels|quelles|ce|cette|ces|cet)$/i,
  /^(sono|sei|è|siamo|siete|sono|essere|avere|fare|dire|andare|vedere|dare|sapere|potere|volere|come|quando|dove|perché|chi|quale|quali)$/i,
  /^(en|hoe|es|Er|Wanneer|je|stel|kritiek|et|kritisk|maar|want|omdat|hoewel|terwijl|tenzij|indien|toen|totdat|voordat|nadat|zodat|mits|toch|dus|immers|namelijk)$/i,
  /^(eu|tu|ele|ela|nós|vós|eles|elas|isto|isso|aquilo|mesmo|mesma|mesmos|mesmas|próprio|própria|próprios|próprias)$/i,
  /^(ben|sen|biz|siz|onlar|bana|sana|ona|bize|size|onlara|benim|senin|onun|bizim|sizin|onların)$/i,
  /^(jeg|mig|min|mit|mine|dig|din|dit|dine|han|ham|hans|hun|hende|hendes|den|det|de|dem|deres|denne|dette|disse)$/i,
];

/** Precompiled geographical term patterns — built once at module load. */
const GEO_TERM_PATTERNS: readonly RegExp[] = wordsToRemove.map(
  ([word]: [string, boolean]) =>
    new RegExp(`\\b${word}\\b|\\b${word}s\\b`, "i")
);

/** Regex to strip punctuation from individual words. */
const WORD_PUNCTUATION_REGEX =
  /['''\-""`~!@#$%^&*()+={}[\]|\\:";'<>?,./]/g;

/** Regex for collapsing whitespace runs. */
const WHITESPACE_REGEX = /\s+/g;

/** Regex to strip non-letter/non-whitespace Unicode characters. */
const NON_LETTER_REGEX = /[^\p{L}\s.,!?:;'"()-]/gu;

/** Regex that matches only English-compatible characters. */
const ENGLISH_CHARS_REGEX = /^[a-zA-Z0-9'-]+$/;

/** Regex for standalone numeric strings. */
const NUMBERS_ONLY_REGEX = /^\d+$/;

// ─── Utility Helpers (DRY) ───────────────────────────────────────────────────

/**
 * Inserts a key-value pair into an LRU-style Map cache. When the cache
 * reaches its size limit, the oldest entry (first key) is evicted before
 * the new entry is added.
 *
 * Extracted to eliminate duplicated eviction logic across caches (DRY).
 *
 * @typeParam K - Cache key type
 * @typeParam V - Cache value type
 * @param cache - The Map to manage
 * @param limit - Maximum number of entries before eviction triggers
 * @param key   - Key for the new entry
 * @param value - Value for the new entry
 */
function cacheSet<K, V>(
  cache: Map<K, V>,
  limit: number,
  key: K,
  value: V
): void {
  if (cache.size >= limit) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, value);
}

/**
 * Type-guard that validates a value is a non-empty string.
 * Replaces repeated `!text || typeof text !== "string"` checks (DRY).
 *
 * @param value - The value to check
 * @returns true if value is a string with length > 0
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Collapses consecutive whitespace to a single space and trims
 * leading/trailing whitespace. Centralises a pattern used by
 * multiple preprocessing functions (DRY).
 *
 * @param text - The text to normalise
 * @returns Whitespace-normalised text
 */
function normalizeWhitespace(text: string): string {
  return text.replace(WHITESPACE_REGEX, " ").trim();
}

// ─── Core Language Analysis ───────────────────────────────────────────────────

/**
 * Analyses text using the franc trigram-based language detection library.
 * Inspects the top 5 results for English with >= 0.9 confidence before
 * falling back to the top overall result.
 *
 * Results are memoised in an LRU-style cache (max {@link FRANC_CACHE_LIMIT}
 * entries) so repeated lookups for the same text are O(1).
 *
 * @param cleanText - Preprocessed text to analyse
 * @returns Detected language ISO 639-3 code and its confidence score
 */
function francLanguageAnalysis(cleanText: string): LanguageResult {
  if (francCache.has(cleanText)) {
    const [language, confidence] = francCache.get(cleanText)!;
    return { language, confidence };
  }

  const detectedLanguage = francAll(cleanText);

  for (const [lang, conf] of detectedLanguage.slice(0, 5)) {
    if (lang === "eng" && conf >= 0.9) {
      cacheSet(francCache, FRANC_CACHE_LIMIT, cleanText, [lang, conf]);
      return { language: lang, confidence: conf };
    }
  }

  const [language, confidence] = detectedLanguage[0];
  cacheSet(francCache, FRANC_CACHE_LIMIT, cleanText, detectedLanguage[0]);
  return { language, confidence };
}

// ─── Document Pattern Operations ──────────────────────────────────────────────

/**
 * Tests whether text contains a document ID pattern such as
 * AEM01-WI-DSU06-SD01, AURG340-SF06, or AEM01. Uses the shared
 * {@link DOCUMENT_PATTERNS_MATCH} constant (DRY with removeDocumentPatterns).
 *
 * @param text - The text to check for document ID patterns
 * @returns true if at least one document ID pattern is found
 */
export const matchesDocumentPattern = (
  text: string | null | undefined
): boolean => {
  if (!isNonEmptyString(text)) return false;
  return DOCUMENT_PATTERNS_MATCH.some((pattern) => pattern.test(text));
};

/**
 * Strips document ID patterns from text so they don't interfere with
 * language detection. Uses the shared {@link DOCUMENT_PATTERNS_REMOVE}
 * constant with global flags for replacement.
 *
 * @param text - Input text potentially containing document IDs
 * @returns Text with document patterns removed and whitespace normalised
 */
function removeDocumentPatterns(text: string): string {
  let cleaned = text;
  for (const pattern of DOCUMENT_PATTERNS_REMOVE) {
    cleaned = cleaned.replace(pattern, "");
  }
  return normalizeWhitespace(cleaned);
}

// ─── Geographical Term Removal ────────────────────────────────────────────────

/**
 * Removes geographical terms (country names, regions, cities) that appear
 * as standalone words to prevent false positives during detection.
 *
 * Patterns are precompiled once at module load via {@link GEO_TERM_PATTERNS}
 * rather than rebuilt on every call (optimisation).
 *
 * @param inputText - Input text containing potential geographical terms
 * @returns Text with geographical terms removed and whitespace normalised
 */
function removeGeographicalTerms(
  inputText: string | null | undefined
): string {
  if (!isNonEmptyString(inputText)) return (inputText as unknown as string);

  let result = inputText;
  for (const pattern of GEO_TERM_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return normalizeWhitespace(result);
}

// ─── Non-English Indicator Checks ─────────────────────────────────────────────

/**
 * Checks whether a word contains characters typical of non-English
 * European languages using the precompiled {@link NON_ENGLISH_CHARS_REGEX}.
 *
 * Covers: German (äöüß), French (éèêë), Spanish (ñ), Italian (ìò),
 * Scandinavian (åøæ), Polish (łńś), Turkish (şğı).
 *
 * @param text - Single word to inspect
 * @returns true if non-English characters are present
 */
function hasNonEnglishCharacters(text: string): boolean {
  return NON_ENGLISH_CHARS_REGEX.test(text);
}

/**
 * Checks whether a word has a suffix typical of non-English languages
 * using the precompiled {@link NON_ENGLISH_ENDINGS_REGEX}.
 *
 * Detects: German (-keit, -schaft), Spanish (-cion), Italian (-zione),
 * Dutch (-baar, -lijk), Portuguese (-agem, -cao), French (-eur).
 *
 * @param text - Single word to inspect
 * @returns true if a non-English suffix is found
 */
function hasNonEnglishEndings(text: string): boolean {
  return NON_ENGLISH_ENDINGS_REGEX.test(text);
}

/**
 * Checks whether a word matches common non-English vocabulary from German,
 * Spanish, French, Italian, Dutch, Portuguese, Turkish, or Scandinavian
 * using the precompiled {@link NON_ENGLISH_WORD_PATTERNS} array.
 *
 * @param text - Single word to check
 * @returns true if the word matches a known non-English vocabulary word
 */
function hasNonEnglishWordPatterns(text: string): boolean {
  return NON_ENGLISH_WORD_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Multi-heuristic check for obvious non-English indicators on a single
 * word or short phrase. Applies checks in order of ascending cost:
 *
 * 1. Character analysis (cheapest — single regex)
 * 2. Suffix analysis (single regex)
 * 3. Vocabulary matching (pattern array)
 * 4. Function-word detection (single regex)
 *
 * @param text - Word or short phrase to evaluate
 * @returns true if obvious non-English indicators are found
 */
function hasObviousNonEnglishIndicators(
  text: string | null | undefined
): boolean {
  if (!isNonEmptyString(text) || text.length < 2) return false;

  if (!text.includes(" ")) {
    if (hasNonEnglishCharacters(text) || hasNonEnglishEndings(text)) {
      return true;
    }
  }

  return (
    hasNonEnglishWordPatterns(text) ||
    NON_ENGLISH_FUNCTION_WORDS_REGEX.test(text)
  );
}

// ─── Word-Level Analysis ──────────────────────────────────────────────────────

/**
 * Validates that a word contains only English-compatible characters:
 * ASCII letters (a-z, A-Z), digits (0-9), apostrophes, and hyphens.
 *
 * @param word - The word to validate
 * @returns true if every character is English-compatible
 */
function hasOnlyEnglishCharacters(word: string): boolean {
  return ENGLISH_CHARS_REGEX.test(word);
}

/**
 * Determines whether a single word is English through a layered pipeline:
 *
 * 1. **Character filter** — rejects words with non-ASCII characters
 * 2. **Number detection** — standalone digits pass when allowNumbers is true
 * 3. **Non-English screening** — rejects obvious non-English indicators
 * 4. **Dictionary lookup** — checks the 270k+ English word Set
 * 5. **Contraction resolution** — splits on apostrophe and rechecks base
 *
 * Each layer short-circuits to avoid unnecessary work (optimised).
 *
 * @param word    - Lowercase word to evaluate
 * @param options - Controls number handling
 * @returns true if the word is recognised as English
 */
function isEnglishWord(word: string, options: WordOptions): boolean {
  if (!hasOnlyEnglishCharacters(word)) return false;
  if (options.allowNumbers && NUMBERS_ONLY_REGEX.test(word)) return true;
  if (hasObviousNonEnglishIndicators(word)) return false;
  if (englishDictionary.has(word)) return true;

  if (word.includes("'")) {
    const contractionBase = word.split("'")[0];
    if (englishDictionary.has(contractionBase)) return true;
  }

  return false;
}

/**
 * Cached wrapper around {@link isEnglishWord}. Uses an LRU-style Map
 * cache (max {@link WORD_CACHE_LIMIT} entries) keyed on word + options
 * to avoid redundant dictionary lookups for previously checked words.
 *
 * Follows the Single Responsibility Principle: caching logic is
 * separated from word-evaluation logic.
 *
 * @param word    - Lowercase word to check
 * @param options - Controls number and abbreviation handling
 * @returns true if the word is recognised as English
 */
function isEnglishWordCached(word: string, options: WordOptions): boolean {
  const cacheKey = `${word}_${options.allowNumbers}_${options.allowAbbreviations}`;

  if (wordCache.has(cacheKey)) return wordCache.get(cacheKey)!;

  const result = isEnglishWord(word, options);
  cacheSet(wordCache, WORD_CACHE_LIMIT, cacheKey, result);
  return result;
}

// ─── Text Preprocessing (SRP) ─────────────────────────────────────────────────

/**
 * Preprocesses raw input text for language detection by applying
 * a three-stage cleaning pipeline:
 *
 * 1. Remove document ID patterns (e.g. AEM01-WI-DSU06-SD01)
 * 2. Remove geographical terms that cause false positives
 * 3. Strip non-letter Unicode characters and normalise whitespace
 *
 * Extracted as a separate function following the Single Responsibility
 * Principle — keeps cleaning logic decoupled from detection logic.
 *
 * @param text - Raw input text
 * @returns Cleaned, normalised text ready for word and trigram analysis
 */
function preprocessText(text: string): string {
  let processed = removeDocumentPatterns(text);
  processed = removeGeographicalTerms(processed);
  processed = processed.replace(NON_LETTER_REGEX, " ");
  return normalizeWhitespace(processed);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detects whether the given text is **non-English**.
 *
 * Uses a multi-layered detection strategy:
 * 1. **Preprocessing** — strips document IDs, geographical terms, and
 *    special characters to reduce noise
 * 2. **Word-level analysis** — checks each word against a 270k+ English
 *    dictionary with heuristic non-English screening
 * 3. **Trigram analysis** — falls back to franc language detection for
 *    ambiguous cases where word ratio alone is insufficient
 *
 * Short texts (4 words or fewer) use a relaxed threshold (0.6) to avoid
 * false positives on English abbreviations and fragments.
 *
 * @param inputText - The text to analyse (null/undefined/empty returns false)
 * @param options   - Detection configuration (thresholds, word length, etc.)
 * @returns true if the text is non-English, false if English or empty
 *
 * @example
 * detectNonEnglishText("Hello world");                      // false
 * detectNonEnglishText("Bonjour le monde");                 // true
 * detectNonEnglishText("", { englishThreshold: 0.5 });      // false
 * detectNonEnglishText("AEM01-WI-DSU06 is ready");          // false
 */
export const detectNonEnglishText = (
  inputText: string | null | undefined,
  options: DetectionOptions = {}
): boolean => {
  const {
    minWordLength = 2,
    allowNumbers = true,
    allowAbbreviations = true,
  } = options;
  let { englishThreshold = 0.8 } = options;

  if (!isNonEmptyString(inputText) || inputText.trim().length === 0) {
    return false;
  }

  const francInputText = inputText;
  const processedText = preprocessText(inputText);
  const words = processedText.toLowerCase().split(" ");

  if (words.length === 0) return false;
  if (words.length <= 4) englishThreshold = 0.6;

  let englishWordCount = 0;
  let totalRelevantWords = 0;

  for (const word of words) {
    const cleanWord = word.replace(WORD_PUNCTUATION_REGEX, "").trim();
    if (cleanWord.length < minWordLength) continue;

    totalRelevantWords++;
    if (isEnglishWordCached(cleanWord, { allowNumbers, allowAbbreviations })) {
      englishWordCount++;
    }
  }

  const englishRatio =
    totalRelevantWords > 0 ? englishWordCount / totalRelevantWords : 1.0;

  if (englishRatio >= englishThreshold) return false;

  const { language, confidence } = francLanguageAnalysis(francInputText);

  if (language === "eng" && confidence >= 0.9 && englishRatio >= 0.7) {
    return false;
  }

  return true;
};

/**
 * Convenience inverse of {@link detectNonEnglishText}.
 * Returns true when the text IS English.
 *
 * @param inputText - The text to analyse
 * @param options   - Same configuration as detectNonEnglishText
 * @returns true if English, false if non-English
 *
 * @example
 * isEnglish("The sky is blue");   // true
 * isEnglish("Le ciel est bleu");  // false
 */
export const isEnglish = (
  inputText: string | null | undefined,
  options: DetectionOptions = {}
): boolean => {
  return !detectNonEnglishText(inputText, options);
};

/**
 * Clears both the franc language-analysis cache and the word-lookup cache.
 * Call this in long-running applications to free memory or to reset state
 * between independent detection sessions.
 *
 * @example
 * clearLanguageDetectorCaches(); // frees all cached results
 */
export const clearLanguageDetectorCaches = (): void => {
  francCache.clear();
  wordCache.clear();
};
