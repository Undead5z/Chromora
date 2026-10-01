const jwt = require('jsonwebtoken');
const db = require('../db/database');
const env = require('../config/env');
const { AppError } = require('../utils/http');
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return next(new AppError(401, 'Authentication is required.'));
  try {
    const claims = jwt.verify(token, env.jwtSecret);
    const user = db.prepare('SELECT id,full_name,email,phone,role,requested_role,account_status,employee_id,department,designation,jurisdiction_region,registered_at,approved_at,rejected_at FROM users WHERE id=?').get(claims.sub);
    if (!user) return next(new AppError(401, 'Your account is no longer available.'));
    if (user.account_status !== 'APPROVED') return next(new AppError(403, 'Your account is not approved for access.'));
    req.user = { sub: user.id, role: user.role, email: user.email, fullName: user.full_name };
    return next();
  } catch (error) { return next(error.status ? error : new AppError(401, 'Your session is invalid or has expired.')); }
}
function roles(...allowed) { return (req, res, next) => allowed.includes(req.user.role) ? next() : next(new AppError(403, 'You do not have permission to perform this action.')); }
function currentUser(req) { return db.prepare('SELECT id,full_name,email,phone,role,requested_role,account_status,employee_id,department,designation,jurisdiction_region,registered_at,approved_at,rejected_at FROM users WHERE id=?').get(req.user.sub); }
module.exports = { requireAuth, roles, currentUser };
