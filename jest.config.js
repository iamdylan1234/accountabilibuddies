const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  moduleNameMapper: {
    '^@/app/dashboard/rematch-actions$': '<rootDir>/__mocks__/rematch-actions.ts',
    '^next/cache$': '<rootDir>/node_modules/next/dist/build/jest/__mocks__/empty.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
})
