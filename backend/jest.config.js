/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/setupEnv.ts'],
  clearMocks: true,
  testTimeout: 10000,
  collectCoverageFrom: ['src/**/*.ts', '!src/db/migrations/**', '!src/db/seeders/**'],
};
