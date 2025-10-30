module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  transform: {},
  collectCoverage: true,
  collectCoverageFrom: [
    'src/utils/**/*.js'
  ],
  coverageDirectory: 'coverage',
};
