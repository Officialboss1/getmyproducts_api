module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/app.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 10000,
  verbose: true,
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  transformIgnorePatterns: [
    "node_modules/(?!(mongodb-memory-server|nanoid)/)"
  ]
};