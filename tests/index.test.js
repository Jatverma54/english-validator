import {
  detectNonEnglishText,
  isEnglish,
  matchesDocumentPattern,
  clearLanguageDetectorCaches,
} from "../src/index.js";

afterEach(() => {
  clearLanguageDetectorCaches();
});

describe("isEnglish", () => {
  test("returns true for a simple English sentence", () => {
    expect(isEnglish("The quick brown fox jumps over the lazy dog")).toBe(true);
  });

  test("returns true for common English phrases", () => {
    expect(isEnglish("Hello, how are you today?")).toBe(true);
    expect(isEnglish("I went to the store to buy some groceries")).toBe(true);
  });

  test("returns false for French text", () => {
    expect(isEnglish("Ceci est une phrase en français")).toBe(false);
  });

  test("returns false for German text", () => {
    expect(isEnglish("Das ist ein deutscher Satz und er ist lang genug")).toBe(false);
  });

  test("returns false for Spanish text", () => {
    expect(isEnglish("Esta es una frase en español que es bastante larga")).toBe(false);
  });

  test("returns false for Italian text", () => {
    expect(isEnglish("Questa è una frase in italiano che è abbastanza lunga")).toBe(false);
  });

  test("handles empty/null input gracefully", () => {
    expect(isEnglish("")).toBe(true);
    expect(isEnglish(null)).toBe(true);
    expect(isEnglish(undefined)).toBe(true);
  });

  test("handles numbers correctly", () => {
    expect(isEnglish("There are 42 apples")).toBe(true);
  });
});

describe("detectNonEnglishText", () => {
  test("returns false for English text", () => {
    expect(detectNonEnglishText("This is a normal English sentence")).toBe(false);
  });

  test("returns true for non-English text", () => {
    expect(detectNonEnglishText("Dies ist ein deutscher Satz und er ist lang genug")).toBe(true);
  });

  test("returns false for empty input", () => {
    expect(detectNonEnglishText("")).toBe(false);
    expect(detectNonEnglishText(null)).toBe(false);
    expect(detectNonEnglishText("   ")).toBe(false);
  });

  test("respects custom englishThreshold option", () => {
    expect(
      detectNonEnglishText("The quick brown fox jumps", { englishThreshold: 0.9 })
    ).toBe(false);
  });

  test("respects minWordLength option", () => {
    expect(
      detectNonEnglishText("I am a big fan of this project", { minWordLength: 1 })
    ).toBe(false);
  });

  test("handles text with document patterns", () => {
    expect(detectNonEnglishText("AEM01-WI-DSU06-SD01 is a valid reference")).toBe(false);
  });

  test("handles single words", () => {
    expect(detectNonEnglishText("hello")).toBe(false);
  });
});

describe("matchesDocumentPattern", () => {
  test("matches pattern like AEM01-WI-DSU06-SD01", () => {
    expect(matchesDocumentPattern("AEM01-WI-DSU06-SD01")).toBe(true);
  });

  test("matches pattern like AURG340-SF06", () => {
    expect(matchesDocumentPattern("AURG340-SF06")).toBe(true);
  });

  test("matches simple pattern like AEM01", () => {
    expect(matchesDocumentPattern("AEM01")).toBe(true);
  });

  test("returns false for regular text", () => {
    expect(matchesDocumentPattern("hello world")).toBe(false);
  });

  test("returns false for null/undefined", () => {
    expect(matchesDocumentPattern(null)).toBe(false);
    expect(matchesDocumentPattern(undefined)).toBe(false);
    expect(matchesDocumentPattern("")).toBe(false);
  });
});

describe("clearLanguageDetectorCaches", () => {
  test("does not throw when called", () => {
    expect(() => clearLanguageDetectorCaches()).not.toThrow();
  });

  test("can be called after detection without errors", () => {
    detectNonEnglishText("some test text here");
    expect(() => clearLanguageDetectorCaches()).not.toThrow();
  });
});

describe("edge cases", () => {
  test("handles mixed language text", () => {
    const result = detectNonEnglishText("Hello, this is mostly English with a bit of bonjour");
    expect(typeof result).toBe("boolean");
  });

  test("handles special characters", () => {
    expect(detectNonEnglishText("Hello!!! How are you???")).toBe(false);
  });

  test("handles text with only numbers", () => {
    expect(detectNonEnglishText("12345")).toBe(false);
  });

  test("caching works across repeated calls", () => {
    const text = "The weather is nice today in the park";
    const result1 = detectNonEnglishText(text);
    const result2 = detectNonEnglishText(text);
    expect(result1).toBe(result2);
    expect(result1).toBe(false);
  });
});
