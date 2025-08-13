module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['server.js', '!node_modules/**'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
};
