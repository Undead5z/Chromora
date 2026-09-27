const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
for (const column of [
  "analysis_source TEXT NOT NULL DEFAULT 'LIVE_CAPTURE'",
  "data_origin TEXT NOT NULL DEFAULT 'LIVE_CAPTURE'",
  'demo_scenario TEXT',
  'signed_payload_version INTEGER NOT NULL DEFAULT 1'
]) { try { db.exec(`ALTER TABLE test_records ADD COLUMN ${column}`); } catch (error) { if (!/duplicate column/i.test(error.message)) throw error; } }
function ensureUser({ fullName, email, password, role, employeeId }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) db.prepare('UPDATE users SET full_name=?,password_hash=?,role=?,account_status=?,employee_id=?,department=? WHERE id=?')
    .run(fullName, bcrypt.hashSync(password, 12), role, 'APPROVED', employeeId, 'Narcotics Control Bureau', existing.id);
  else db.prepare('INSERT INTO users (id,full_name,email,password_hash,role,account_status,employee_id,department) VALUES (?,?,?,?,?,?,?,?)')
    .run(crypto.randomUUID(), fullName, email, bcrypt.hashSync(password, 12), role, 'APPROVED', employeeId, 'Narcotics Control Bureau');
}
ensureUser({ fullName: 'Chromora Administrator', email: 'admin@chromora.local', password: 'Admin@123!', role: 'ADMIN', employeeId: 'CHROMORA-ADMIN' });
ensureUser({ fullName: 'Arjun Rao', email: 'officer1@chromora.local', password: 'Officer@123!', role: 'FIELD_OFFICER', employeeId: 'NCB-DEMO-FO-01' });
ensureUser({ fullName: 'Meera Singh', email: 'officer2@chromora.local', password: 'Officer@123!', role: 'FIELD_OFFICER', employeeId: 'NCB-DEMO-FO-02' });
for (const profile of [
  ['GENERAL_COLORIMETRIC_DEMO', 'General colourimetric field test', 'Workflow placeholder only. It is not a validated test profile or classifier.'],
  ['DEMO_COLORIMETRIC_A', 'Chromora Demonstration Profile A', 'Synthetic profile used only to demonstrate the Chromora workflow. Not validated for any operational field drug-testing kit.']
]) if (!db.prepare('SELECT id FROM test_profiles WHERE code=?').get(profile[0])) db.prepare('INSERT INTO test_profiles (id,code,display_name,status,description) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), profile[0], profile[1], 'DEMO_PROFILE_ONLY', profile[2]);
