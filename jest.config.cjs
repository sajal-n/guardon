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
};
