# english-validator

> Detect whether a sentence is English or non-English. Returns `true` / `false` with high accuracy.

[![npm version](https://img.shields.io/npm/v/english-validator.svg)](https://www.npmjs.com/package/english-validator)
[![license](https://img.shields.io/npm/l/english-validator.svg)](https://github.com/Jatverma54/english-validator/blob/main/LICENSE)

## Features

- **Dictionary-powered** — 274k+ English word dictionary for accurate word-level checks
- **Trigram analysis** — uses [franc](https://github.com/wooorm/franc) as a secondary signal for statistical language detection
- **Lightweight API** — single function call, returns a boolean
- **Configurable** — adjustable thresholds, minimum word length, number handling
- **Built-in caching** — LRU-style memoization for fast repeated lookups
- **TypeScript support** — ships with full type declarations and JSDoc
- **ESM & CJS** — works with `import` and `require` (zero runtime dependencies)

## Installation

```bash
npm install english-validator
```

## Quick Start

### ESM (React, Next.js, Vite, modern Node.js)

```ts
import { isEnglish, detectNonEnglishText } from "english-validator";

isEnglish("The quick brown fox jumps over the lazy dog");
// => true

isEnglish("Ceci est une phrase en français");
// => false

// Or use the inverse API:
detectNonEnglishText("Das ist ein deutscher Satz");
// => true  (it IS non-English)

detectNonEnglishText("Hello, how are you?");
// => false (it is NOT non-English)
```

### CommonJS (Node.js)

```js
const { isEnglish, detectNonEnglishText } = require("english-validator");

console.log(isEnglish("Hello world")); // true
```

### TypeScript

The package ships with full type declarations. Import types directly:

```ts
import {
  isEnglish,
  detectNonEnglishText,
  matchesDocumentPattern,
  clearLanguageDetectorCaches,
} from "english-validator";
import type { DetectionOptions } from "english-validator";

// Use DetectionOptions for custom configuration
const options: DetectionOptions = {
  englishThreshold: 0.7,
  minWordLength: 3,
  allowNumbers: false,
};

const result: boolean = isEnglish("Check this text", options);
```

## API

### `isEnglish(text, options?)`

Returns `true` if the text is English, `false` otherwise.

| Parameter | Type               | Description                        |
| --------- | ------------------ | ---------------------------------- |
| `text`    | `string \| null`   | Text to analyse                    |
| `options` | `DetectionOptions` | Optional configuration (see below) |

```ts
isEnglish("Hello world");          // true
isEnglish("Bonjour le monde");     // false
isEnglish("", { englishThreshold: 0.5 }); // false (empty)
```

### `detectNonEnglishText(text, options?)`

Returns `true` if the text is **non-English**, `false` if English. Inverse of `isEnglish`.

```ts
detectNonEnglishText("Das ist Deutsch");   // true
detectNonEnglishText("This is English");   // false
```

### `matchesDocumentPattern(text)`

Returns `true` if the text matches document ID patterns like `AEM01-WI-DSU06-SD01`.

```ts
matchesDocumentPattern("AEM01-WI-DSU06-SD01"); // true
matchesDocumentPattern("Hello world");          // false
```

### `clearLanguageDetectorCaches()`

Clears the internal LRU memoization caches. Call this in long-running applications to free memory or to reset state between independent detection sessions.

```ts
clearLanguageDetectorCaches(); // frees all cached results
```

### `DetectionOptions`

Configuration object accepted by `isEnglish` and `detectNonEnglishText`:

| Option              | Type      | Default | Description                                          |
| ------------------- | --------- | ------- | ---------------------------------------------------- |
| `englishThreshold`  | `number`  | `0.8`   | Ratio of English words needed to classify as English (0.0–1.0) |
| `minWordLength`     | `number`  | `2`     | Words shorter than this are skipped during analysis   |
| `allowNumbers`      | `boolean` | `true`  | Treat standalone numbers as valid English tokens      |
| `allowAbbreviations`| `boolean` | `true`  | Allow abbreviations as valid English tokens           |

> **Note:** Short texts (4 words or fewer) automatically use a relaxed threshold of `0.6` regardless of the configured `englishThreshold`, to avoid false positives on English fragments.

## Usage Examples

### React Component

```tsx
import { isEnglish } from "english-validator";

function LanguageCheck({ text }: { text: string }) {
  return (
    <div>
      {isEnglish(text) ? "✅ English" : "❌ Not English"}
    </div>
  );
}
```

### Node.js API Middleware

```ts
import { detectNonEnglishText } from "english-validator";

app.post("/api/comment", (req, res) => {
  if (detectNonEnglishText(req.body.text)) {
    return res.status(400).json({ error: "Only English text is accepted" });
  }
  // proceed...
});
```

### Custom Threshold

```ts
import { isEnglish } from "english-validator";
import type { DetectionOptions } from "english-validator";

// More lenient — allows mixed-language text
const lenient: DetectionOptions = { englishThreshold: 0.5 };
isEnglish("Hello mundo", lenient); // true (50%+ English)

// Stricter — requires almost all words to be English
const strict: DetectionOptions = { englishThreshold: 0.95 };
isEnglish("Hello mundo", strict);  // false
```

## How It Works

1. **Preprocessing** — strips document IDs, geographical terms, and special characters
2. **Dictionary lookup** — each word is checked against a 274k+ English word set
3. **Non-English screening** — detects European characters (ä, ö, ü, ñ, etc.), word suffixes (-keit, -ción, -zione), and function words (le, la, der, die, das)
4. **English ratio** — calculates the percentage of recognized English words
5. **Trigram fallback** — if the ratio is below the threshold, [franc](https://github.com/wooorm/franc) provides a statistical language classification as a tiebreaker
6. **Result** — returns a boolean

## Supported Non-English Language Detection

Detects non-English text across many languages including German, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, and Scandinavian languages — both via character/word patterns and trigram analysis.

## Running Tests

```bash
npm test
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) © nuvayutech
