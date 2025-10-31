module.exports = {
  // Use jsdom to provide a browser-like environment for popup/options tests
  testEnvironment: 'jsdom',
  // Use babel-jest to transform ESM JavaScript for Jest
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/utils/**/*.js'
  ],
  coverageDirectory: 'coverage',
  // Tests moved from `__tests__` to `tests/` to avoid packaging issues (extensions may reject folders
  // starting with an underscore). Jest should search the `tests` folder as the root for test files.
  roots: ['<rootDir>/tests'],
};
