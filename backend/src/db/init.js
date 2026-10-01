const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
for (const column of [
  'requested_role TEXT',
  'phone TEXT',
  'designation TEXT',
  'jurisdiction_region TEXT',
  "registered_at TEXT",
  'approved_by TEXT',
  'approved_at TEXT',
  'rejected_by TEXT',
  'rejected_at TEXT',
  'approval_note TEXT'
]) { try { db.exec(`ALTER TABLE users ADD COLUMN ${column}`); } catch (error) { if (!/duplicate column/i.test(error.message)) throw error; } }
db.exec("UPDATE users SET registered_at=coalesce(registered_at,created_at,CURRENT_TIMESTAMP), requested_role=coalesce(requested_role,role), account_status=coalesce(nullif(account_status,''),'APPROVED')");
for (const column of [
  "analysis_source TEXT NOT NULL DEFAULT 'LIVE_CAPTURE'",
  "data_origin TEXT NOT NULL DEFAULT 'LIVE_CAPTURE'",
  "workflow_status TEXT NOT NULL DEFAULT 'ACTIVE'",
  'demo_scenario TEXT',
  'signed_payload_version INTEGER NOT NULL DEFAULT 1',
  'location_label TEXT',
  "lab_review_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED'",
  'lab_review_requested_at TEXT',
  'lab_review_requested_by TEXT',
  'lab_review_note TEXT',
  'last_analysis_at TEXT'
]) { try { db.exec(`ALTER TABLE test_records ADD COLUMN ${column}`); } catch (error) { if (!/duplicate column/i.test(error.message)) throw error; } }
const MASTER_ADMIN_EMAIL = 'admin@chromora.local';
function ensureUser({ fullName, email, password, role, employeeId, designation }) {
  const existing = db.prepare('SELECT id FROM users WHERE lower(email)=lower(?)').get(email);
  const values=[fullName,bcrypt.hashSync(password,12),role,role,'APPROVED',employeeId,'Narcotics Control Bureau',designation||null,existing?.id];
  if (existing) db.prepare('UPDATE users SET full_name=?,password_hash=?,role=?,requested_role=?,account_status=?,employee_id=?,department=?,designation=?,registered_at=coalesce(registered_at,CURRENT_TIMESTAMP) WHERE id=?').run(...values);
  else db.prepare('INSERT INTO users (id,full_name,email,password_hash,role,requested_role,account_status,employee_id,department,designation,registered_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)').run(crypto.randomUUID(),fullName,email,bcrypt.hashSync(password,12),role,role,'APPROVED',employeeId,'Narcotics Control Bureau',designation||null);
}
db.prepare("UPDATE users SET role='ADMIN' WHERE role='MASTER_ADMIN' AND lower(email)<>lower(?)").run(MASTER_ADMIN_EMAIL);
ensureUser({ fullName: 'Chromora Administrator', email: MASTER_ADMIN_EMAIL, password: 'Admin@123!', role: 'MASTER_ADMIN', employeeId: 'CHROMORA-ADMIN', designation: 'Command Centre Administrator' });
db.prepare("UPDATE users SET email='officer@chromora.local' WHERE lower(email)=lower('officer@chomora.local') AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email)=lower('officer@chromora.local'))").run();
ensureUser({ fullName: 'Senior Field Officer', email: 'officer@chromora.local', password: 'Officer@123!', role: 'FIELD_OFFICER', employeeId: 'NCB-SFO-001', designation: 'Senior Field Officer' });
db.exec(`CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, test_record_id TEXT NOT NULL UNIQUE, file_path TEXT NOT NULL, generated_by TEXT, generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(test_record_id) REFERENCES test_records(id))`);
for (const profile of [
  ['GENERAL_COLORIMETRIC_DEMO', 'General colourimetric field test', 'Workflow placeholder only. It is not a validated test profile or classifier.'],
  ['DEMO_COLORIMETRIC_A', 'Chromora Demonstration Profile A', 'Synthetic profile used only to demonstrate the Chromora workflow. Not validated for any operational field drug-testing kit.']
]) if (!db.prepare('SELECT id FROM test_profiles WHERE code=?').get(profile[0])) db.prepare('INSERT INTO test_profiles (id,code,display_name,status,description) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), profile[0], profile[1], 'DEMO_PROFILE_ONLY', profile[2]);
