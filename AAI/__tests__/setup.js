// Test setup - silence logger during tests
const logger = require('../lib/logger');

// Mock logger to reduce noise during tests
logger.silent = true;
