export default {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  extensionsToTreatAsEsm: [".ts"],
  collectCoverageFrom: [
    "lib/**/*.ts",
    "!lib/**/*.d.ts",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "index\\.cjs$",
  ],
};
