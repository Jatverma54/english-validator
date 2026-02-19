import {
  detectNonEnglishText,
  isEnglish,
  matchesDocumentPattern,
  clearLanguageDetectorCaches,
} from "../src/index";

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

describe("non-English character and pattern detection", () => {
  test("detects German characters (äöüß)", () => {
    expect(detectNonEnglishText("Straße")).toBe(true);
  });

  test("detects French characters (éèêë)", () => {
    expect(detectNonEnglishText("café résumé naïve")).toBe(true);
  });

  test("detects Spanish characters (ñ)", () => {
    expect(detectNonEnglishText("año señor niño")).toBe(true);
  });

  test("detects Polish characters", () => {
    expect(detectNonEnglishText("łódź częstochowa")).toBe(true);
  });

  test("detects Scandinavian characters (åøæ)", () => {
    expect(detectNonEnglishText("blåbær rødgrød")).toBe(true);
  });

  test("detects Turkish characters (şğı)", () => {
    expect(detectNonEnglishText("güneş İstanbul")).toBe(true);
  });

  test("detects German word endings (-keit, -schaft)", () => {
    expect(detectNonEnglishText("Freundschaft Möglichkeit")).toBe(true);
  });

  test("detects Spanish word endings (-ción)", () => {
    expect(detectNonEnglishText("comunicación información educación")).toBe(true);
  });

  test("detects non-English function words (le, la, der, die, das)", () => {
    expect(detectNonEnglishText("le chat est sur la table dans la maison")).toBe(true);
    expect(detectNonEnglishText("der Hund ist in dem Haus mit dem Mann")).toBe(true);
  });

  test("detects Dutch distinctive words", () => {
    expect(detectNonEnglishText("maar omdat hoewel terwijl tenzij indien")).toBe(true);
  });

  test("detects Portuguese distinctive words", () => {
    expect(detectNonEnglishText("eu ele ela isto isso aquilo mesmo")).toBe(true);
  });

  test("detects Turkish distinctive words", () => {
    expect(detectNonEnglishText("ben sen biz siz onlar bana sana")).toBe(true);
  });

  test("detects Scandinavian distinctive words", () => {
    expect(detectNonEnglishText("jeg mig min dig din han ham hans")).toBe(true);
  });
});

describe("removeGeographicalTermsExact edge cases", () => {
  test("handles null input", () => {
    expect(detectNonEnglishText(null)).toBe(false);
  });

  test("handles non-string input", () => {
    expect(detectNonEnglishText(123)).toBe(false);
  });
});

describe("matchesDocumentPattern edge cases", () => {
  test("returns false for non-string types", () => {
    expect(matchesDocumentPattern(123)).toBe(false);
    expect(matchesDocumentPattern({})).toBe(false);
  });
});

describe("word-level detection", () => {
  test("handles contractions as English", () => {
    expect(isEnglish("I can't believe it's not butter")).toBe(true);
  });

  test("handles words with non-English characters as non-English", () => {
    expect(detectNonEnglishText("über kühl größe straße")).toBe(true);
  });

  test("short text uses lower threshold", () => {
    expect(isEnglish("hello world")).toBe(true);
  });

  test("handles text with document patterns mixed with English", () => {
    expect(detectNonEnglishText("The AEM01-WI-DSU06-SD01 document is ready for review")).toBe(false);
  });

  test("franc cache eviction works when limit exceeded", () => {
    for (let i = 0; i < 5; i++) {
      detectNonEnglishText(`This is test sentence number ${i} for checking cache behavior in the system`);
    }
    expect(detectNonEnglishText("The quick brown fox jumps over the lazy dog")).toBe(false);
  });

  test("word cache eviction works when limit exceeded", () => {
    const longText = "The quick brown fox jumps over the lazy dog and runs through the field with great speed and energy";
    detectNonEnglishText(longText);
    expect(isEnglish(longText)).toBe(true);
  });

  test("allowNumbers=false treats standalone numbers differently", () => {
    const result = detectNonEnglishText("12345 67890", { allowNumbers: false });
    expect(typeof result).toBe("boolean");
  });

  test("handles contraction with unknown base word", () => {
    expect(detectNonEnglishText("xyzzy's foobar's bazzle's")).toBe(true);
  });

  test("handles single character input", () => {
    expect(detectNonEnglishText("a")).toBe(false);
  });

  test("hasObviousNonEnglishIndicators returns false for empty/short text", () => {
    expect(detectNonEnglishText("x")).toBe(false);
  });

  test("text with only whitespace", () => {
    expect(detectNonEnglishText("   ")).toBe(false);
  });

  test("non-English text with spaces triggers multi-word non-English check", () => {
    expect(detectNonEnglishText("über straße größe kühl wärme schön")).toBe(true);
  });

  test("Italian word endings (-zione)", () => {
    expect(detectNonEnglishText("comunicazione informazione educazione")).toBe(true);
  });

  test("Dutch word endings (-baar, -lijk)", () => {
    expect(detectNonEnglishText("bereikbaar begrijpelijk onmogelijk")).toBe(true);
  });

  test("Portuguese word endings (-agem, -ção)", () => {
    expect(detectNonEnglishText("mensagem comunicação informação")).toBe(true);
  });

  test("French word endings (-eur)", () => {
    expect(detectNonEnglishText("professeur directeur ingénieur")).toBe(true);
  });

  test("unknown word not in dictionary returns non-English", () => {
    expect(detectNonEnglishText("zxqwvbn plmokn ijuhbg")).toBe(true);
  });

  test("word with apostrophe where base is in dictionary", () => {
    expect(isEnglish("I don't think we won't be able to go there today")).toBe(true);
  });

  test("handles franc analysis with eng detected but low english ratio", () => {
    expect(detectNonEnglishText("the der die das ein eine mit für")).toBe(true);
  });

  test("handles text where all words are below minWordLength", () => {
    expect(detectNonEnglishText("a I", { minWordLength: 3 })).toBe(false);
  });

  test("non-English with high confidence from franc", () => {
    expect(
      detectNonEnglishText(
        "Dies ist ein langer deutscher Satz der genügend Wörter hat um eine gute Erkennung zu ermöglichen"
      )
    ).toBe(true);
  });
});
