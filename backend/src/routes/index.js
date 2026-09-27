const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const { z } = require('zod');
const db = require('../db/database');
const env = require('../config/env');
const { requireAuth, roles, currentUser } = require('../middleware/auth');
const { AppError } = require('../utils/http');
const { sha256File, signRecord, verifyRecord } = require('../services/integrity.service');

const router = express.Router();
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const audit = (action, actor, record = null, metadata = null) => db.prepare('INSERT INTO audit_logs (id,actor_user_id,test_record_id,action,metadata_json) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), actor, record, action, metadata ? JSON.stringify(metadata) : null);
const safeUser = user => ({ id: user.id, fullName: user.full_name, email: user.email, role: user.role, accountStatus: user.account_status, employeeId: user.employee_id, department: user.department });
const recordWithOperator = id => db.prepare('SELECT t.*, u.full_name operator_name, u.email operator_email FROM test_records t JOIN users u ON u.id=t.operator_id WHERE t.id=?').get(id);
const imagePathFor = record => path.resolve(env.rootDir, record.original_image_path || '');
const usableEvidencePath = record => { const file = imagePathFor(record); const root = path.resolve(env.uploadDir); if (!record.original_image_path || path.relative(root, file).startsWith('..') || !fs.existsSync(file)) throw new AppError(404, 'Evidence image unavailable.'); return file; };
const canAccess = (req, record) => ['ADMIN','MASTER_ADMIN'].includes(req.user.role) || record.operator_id === req.user.sub;
const requireRecordAccess = (req, record) => { if (!record) throw new AppError(404, 'Test record not found.'); if (!canAccess(req, record)) throw new AppError(403, 'You do not have permission to access this field test.'); return record; };
const reSign = (id, actor, action) => { const record = recordWithOperator(id); if (!record.image_sha256) return record; const signed = signRecord(record); db.prepare('UPDATE test_records SET record_signature=?,signature_algorithm=?,signed_payload_version=?,integrity_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(signed.signature,signed.algorithm,signed.signedPayloadVersion,'VERIFIED',id); audit(action,actor,id,{ signedPayloadVersion:signed.signedPayloadVersion }); return recordWithOperator(id); };

router.post('/auth/login', asyncHandler((req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1), application: z.enum(['WEB', 'MOBILE']) }).parse(req.body);
  const user = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(input.email);
  if (!user || !bcrypt.compareSync(input.password, user.password_hash)) throw new AppError(401, 'Invalid email or password.');
  if (user.account_status !== 'APPROVED') throw new AppError(403, 'Your account is not approved for access.');
  const allowed = input.application === 'WEB' ? ['MASTER_ADMIN','ADMIN'] : ['FIELD_OFFICER'];
  if (!allowed.includes(user.role)) throw new AppError(403, input.application === 'WEB' ? 'Field Officer accounts must use the Chromora mobile companion.' : 'Administrator accounts must use the Chromora Web Command Centre.');
  const token = jwt.sign({ sub: user.id, role: user.role, application: input.application }, env.jwtSecret, { expiresIn: '8h' });
  audit('LOGIN_SUCCESS', user.id);
  res.json({ token, user: safeUser(user) });
}));
router.get('/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(currentUser(req)) }));

fs.mkdirSync(env.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: env.uploadDir, filename: (req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, done) => /^image\/(jpeg|png|webp)$/.test(file.mimetype) ? done(null, true) : done(new AppError(400, 'Only JPEG, PNG, and WebP evidence images are supported.'))
});

router.get('/test-profiles', requireAuth, (req, res) => res.json({ profiles: db.prepare('SELECT code, display_name, status, description FROM test_profiles ORDER BY display_name').all() }));
router.get('/dashboard', requireAuth, roles('ADMIN', 'MASTER_ADMIN'), (req, res) => {
  const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 7;
  const totalRecords = db.prepare('SELECT count(*) count FROM test_records').get().count;
  const analysisPending = db.prepare("SELECT count(*) count FROM test_records WHERE presumptive_result='ANALYSIS_PENDING'").get().count;
  const integrityVerified = db.prepare("SELECT count(*) count FROM test_records WHERE integrity_status='VERIFIED'").get().count;
  const integrityIssues = db.prepare("SELECT count(*) count FROM test_records WHERE integrity_status IN ('HASH_MISMATCH','SIGNATURE_INVALID')").get().count;
  const byResult = db.prepare('SELECT presumptive_result result, count(*) count FROM test_records GROUP BY presumptive_result').all();
  const locations = db.prepare('SELECT id, test_number, latitude, longitude, location_accuracy, captured_at FROM test_records WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY captured_at DESC LIMIT 50').all();
  const recent = db.prepare('SELECT t.id,t.test_number,t.presumptive_result,t.integrity_status,t.data_origin,t.demo_scenario,t.captured_at,u.full_name operator_name FROM test_records t JOIN users u ON u.id=t.operator_id ORDER BY t.created_at DESC LIMIT 8').all();
  const dailyActivity = db.prepare(`WITH RECURSIVE days(day) AS (SELECT date('now','-${range - 1} days') UNION ALL SELECT date(day,'+1 day') FROM days WHERE day < date('now')) SELECT day date, count(t.id) count FROM days LEFT JOIN test_records t ON date(t.captured_at)=day GROUP BY day ORDER BY day`).all();
  const demoActive = db.prepare("SELECT count(*) count FROM test_records WHERE data_origin='DEMO_SEED'").get().count > 0;
  const presentation = demoActive ? {
    summary: { totalRecords: 48, positive: 12, negative: 28, inconclusive: 8, integrityVerified: 11, integrityTotal: 11, excludedTamperScenario: true },
    dailyActivity: [10, 10, 17, 18, 8, 20, 30].map((count, index) => ({ date: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], count })),
    locations: [
      { label: 'Delhi', latitude: 28.6139, longitude: 77.2090 },
      { label: 'Mumbai', latitude: 19.0760, longitude: 72.8777 },
      { label: 'Jaipur', latitude: 26.9124, longitude: 75.7873 }
    ],
    recent: recent.slice(0, 3).map((record, index) => ({ ...record, test_number: ['FT-2024-001', 'FT-2024-002', 'FT-2024-003'][index], location_label: ['Delhi', 'Mumbai', 'Jaipur'][index], presumptive_result: ['NEGATIVE', 'INCONCLUSIVE', 'POSITIVE'][index], captured_label: ['12 Dec 2024, 14:32', '12 Dec 2024, 11:20', '12 Dec 2024, 09:15'][index] }))
  } : null;
  res.json({ range, summary: { totalRecords, analysisPending, integrityVerified, integrityTotal: totalRecords, integrityIssues }, byResult, locations, recent, dailyActivity, demoActive, presentation });
});

router.get('/test-records', requireAuth, asyncHandler((req, res) => {
  const params=[]; let where='WHERE (t.test_number LIKE ? OR u.full_name LIKE ?)'; const search=`%${String(req.query.search||'').trim()}%`; params.push(search,search);
  if (req.user.role === 'FIELD_OFFICER') { where+=' AND t.operator_id=?'; params.push(req.user.sub); }
  for (const [field,key] of [['t.presumptive_result','result'],['t.integrity_status','integrity'],['t.data_origin','origin']]) if (req.query[key] && req.query[key] !== 'ALL') { where+=` AND ${field}=?`; params.push(req.query[key]); }
  if (req.query.from) { where+=' AND date(t.captured_at)>=date(?)'; params.push(req.query.from); } if (req.query.to) { where+=' AND date(t.captured_at)<=date(?)'; params.push(req.query.to); }
  const records=db.prepare(`SELECT t.*,u.full_name operator_name FROM test_records t JOIN users u ON u.id=t.operator_id ${where} ORDER BY t.captured_at DESC`).all(...params); res.json({records});
}));
router.get('/test-records/:id', requireAuth, asyncHandler((req, res) => {
  const record = requireRecordAccess(req, recordWithOperator(req.params.id));
  res.json({ record });
}));
router.post('/test-records', requireAuth, roles('FIELD_OFFICER', 'ADMIN', 'MASTER_ADMIN'), asyncHandler((req, res) => {
  const data = z.object({
    testProfile: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(),
    capturedAt: z.string().datetime().optional(), latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(), locationAccuracy: z.number().nonnegative().nullable().optional()
  }).parse(req.body);
  const id = crypto.randomUUID();
  const testNumber = `FT-${new Date().getFullYear()}-${String(db.prepare('SELECT count(*) count FROM test_records').get().count + 1).padStart(4, '0')}`;
  db.prepare('INSERT INTO test_records (id,test_number,test_profile,operator_id,notes,captured_at,latitude,longitude,location_accuracy) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, testNumber, data.testProfile || null, req.user.sub, data.notes || null, data.capturedAt || new Date().toISOString(), data.latitude ?? null, data.longitude ?? null, data.locationAccuracy ?? null);
  audit('FIELD_TEST_STARTED', req.user.sub, id, { locationCaptured: data.latitude != null && data.longitude != null });
  res.status(201).json({ record: recordWithOperator(id) });
}));
router.post('/test-records/:id/evidence', requireAuth, roles('FIELD_OFFICER', 'ADMIN', 'MASTER_ADMIN'), upload.single('image'), asyncHandler(async (req, res) => {
  const record = requireRecordAccess(req, recordWithOperator(req.params.id));
  if (!req.file) throw new AppError(400, 'An evidence image is required.');
  const metadata = await sharp(req.file.path).metadata();
  const quality = metadata.width >= 800 && metadata.height >= 600 ? 'ACCEPTABLE' : 'REVIEW_RECOMMENDED';
  const relativePath = path.relative(env.rootDir, req.file.path).replace(/\\/g, '/');
  const imageHash = sha256File(req.file.path);
  db.prepare('UPDATE test_records SET original_image_path=?, image_sha256=?, capture_quality=?, integrity_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(relativePath, imageHash, quality, 'PENDING', record.id);
  const reSigned = reSign(record.id, req.user.sub, 'TEST_EVIDENCE_HASHED_AND_SIGNED');
  audit('TEST_EVIDENCE_STORED', req.user.sub, record.id, { width: metadata.width, height: metadata.height, quality, hashAlgorithm: 'SHA-256', signatureAlgorithm: reSigned.signature_algorithm });
  res.json({ record: reSigned, imageQuality: { state: quality, message: quality === 'ACCEPTABLE' ? 'Basic image dimensions are acceptable.' : 'Image may be too small; a retake is recommended.' } });
}));
router.get('/test-records/:id/evidence', requireAuth, asyncHandler((req, res) => { const record = requireRecordAccess(req, recordWithOperator(req.params.id)); res.sendFile(usableEvidencePath(record)); }));
router.post('/test-records/:id/verify-integrity', requireAuth, asyncHandler((req, res) => {
  const record = requireRecordAccess(req, recordWithOperator(req.params.id));
  const verification = verifyRecord(record, usableEvidencePath(record));
  db.prepare('UPDATE test_records SET integrity_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(verification.status, record.id);
  audit('EVIDENCE_INTEGRITY_VERIFIED', req.user.sub, record.id, { status: verification.status });
  res.json({ verification, record: recordWithOperator(record.id) });
}));
router.get('/test-records/:id/verification', requireAuth, asyncHandler((req, res) => {
  const record = requireRecordAccess(req, recordWithOperator(req.params.id));
  res.json({ verification: { testNumber: record.test_number, integrityStatus: record.integrity_status, imageSha256: record.image_sha256, signatureAlgorithm: record.signature_algorithm, verificationCode: `CHR:${record.id}` } });
}));
router.post('/test-records/:id/analyze', requireAuth, asyncHandler((req, res) => {
  const record = requireRecordAccess(req, recordWithOperator(req.params.id));
  const steps = [
    { key: 'IMAGE_QUALITY', state: record.capture_quality === 'ACCEPTABLE' ? 'COMPLETE' : record.capture_quality === 'REVIEW_RECOMMENDED' ? 'WARNING' : 'PENDING', detail: 'Basic capture dimensions checked.' },
    { key: 'REFERENCE_CARD', state: 'NOT_IMPLEMENTED', detail: 'Reference-card detection is not implemented.' },
    { key: 'COLOUR_CALIBRATION', state: 'NOT_IMPLEMENTED', detail: 'Colour calibration is not implemented.' },
    { key: 'REACTION_REGION', state: 'NOT_IMPLEMENTED', detail: 'Reaction-region extraction is not implemented.' },
    { key: 'CLASSIFICATION', state: 'NOT_IMPLEMENTED', detail: 'No presumptive classification is generated.' }
  ];
  audit('ANALYSIS_STATE_VIEWED', req.user.sub, record.id);
  res.json({ record: recordWithOperator(record.id), steps });
}));
router.get('/users', requireAuth, roles('ADMIN', 'MASTER_ADMIN'), (req, res) => res.json({ users: db.prepare('SELECT id,full_name,email,role,account_status,employee_id,department,created_at FROM users ORDER BY created_at DESC').all() }));
router.get('/audit-activity', requireAuth, roles('ADMIN', 'MASTER_ADMIN'), (req, res) => res.json({ events: db.prepare('SELECT a.*, u.full_name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 100').all() }));
module.exports = router;
