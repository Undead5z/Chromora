const path = require('path');
require('dotenv').config();
const rootDir = path.resolve(__dirname, '../..');
module.exports = {
  rootDir,
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'chromora-local-development-only-change-me',
  databasePath: path.join(rootDir, 'data', 'chromora.db'),
  uploadDir: path.join(rootDir, 'uploads'),
  reportDir: path.join(rootDir, 'uploads', 'reports'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim())
};
