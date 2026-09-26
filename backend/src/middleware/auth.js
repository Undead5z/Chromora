const jwt = require('jsonwebtoken');
const db = require('../db/database');
const env = require('../config/env');
const { AppError } = require('../utils/http');
function requireAuth(req, res, next) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); if (!token) return next(new AppError(401, 'Authentication is required.')); try { req.user = jwt.verify(token, env.jwtSecret); return next(); } catch { return next(new AppError(401, 'Your session is invalid or has expired.')); } }
function roles(...allowed) { return (req, res, next) => allowed.includes(req.user.role) ? next() : next(new AppError(403, 'You do not have permission to perform this action.')); }
function currentUser(req) { return db.prepare('SELECT id, full_name, email, role, account_status, employee_id, department FROM users WHERE id = ?').get(req.user.sub); }
module.exports = { requireAuth, roles, currentUser };
