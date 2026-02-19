module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "babel-jest",
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: ["/node_modules/(?!franc|trigram-utils|n-gram|collapse-white-space)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 79,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
