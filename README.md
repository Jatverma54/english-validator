# english-validator

> Detect whether a sentence is English or non-English. Returns `true` / `false` with high accuracy.

[![npm version](https://img.shields.io/npm/v/english-validator.svg)](https://www.npmjs.com/package/english-validator)
[![license](https://img.shields.io/npm/l/english-validator.svg)](https://github.com/Jatverma54/english-text-validator/blob/main/LICENSE)

## Features

- **Dictionary-powered** — 270k+ English word dictionary for accurate word-level checks
- **Trigram analysis** — uses [franc](https://github.com/wooorm/franc) as a secondary signal for statistical language detection
- **Lightweight API** — single function call, returns a boolean
- **Configurable** — adjustable thresholds, minimum word length, number handling
- **Built-in caching** — memoizes results for fast repeated lookups
- **TypeScript support** — ships with type declarations
- **ESM & CJS** — works with `import` and `require`

## Installation

```bash
npm install english-validator
```

## Quick Start

```js
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

### CommonJS

```js
const { isEnglish, detectNonEnglishText } = require("english-validator");
```

## API

### `isEnglish(text, options?)`

Returns `true` if the text is English, `false` otherwise.

### `detectNonEnglishText(text, options?)`

Returns `true` if the text is **non-English**, `false` if English.

### `matchesDocumentPattern(text)`

Returns `true` if the text matches document ID patterns like `AEM01-WI-DSU06-SD01`.

### `clearLanguageDetectorCaches()`

Clears the internal memoization caches. Useful for long-running applications.

### Options

| Option              | Type      | Default | Description                                          |
| ------------------- | --------- | ------- | ---------------------------------------------------- |
| `englishThreshold`  | `number`  | `0.8`   | Ratio of English words needed to classify as English  |
| `minWordLength`     | `number`  | `2`     | Minimum word length to consider during analysis       |
| `allowNumbers`      | `boolean` | `true`  | Treat standalone numbers as valid English tokens      |
| `allowAbbreviations`| `boolean` | `true`  | Allow abbreviations as valid English tokens           |

## How It Works

1. **Preprocessing** — strips document IDs, geographical terms, and special characters
2. **Dictionary lookup** — each word is checked against a 270k+ English word set
3. **English ratio** — calculates the percentage of recognized English words
4. **Trigram fallback** — if the ratio is below the threshold, [franc](https://github.com/wooorm/franc) provides a statistical language classification as a tiebreaker
5. **Result** — returns a boolean

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

[MIT](LICENSE) © Jatverma54
