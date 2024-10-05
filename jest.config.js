/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>**/__tests__/*.test.ts'],
  testTimeout: 5 * 60 * 1000,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest', {
        useESM: true,
        isolatedModules: true,
        diagnostics: {
          ignoreCodes: [1343],
        },
        astTransformers: {
          before: [
            {
              path: 'node_modules/ts-jest-mock-import-meta',
              options: {metaObjectReplacement: {env: '.env.development'}},
            }
          ],
        },
      }],
  }
};
