const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
const email = 'admin@chromora.local';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
  db.prepare('INSERT INTO users (id, full_name, email, password_hash, role, employee_id, department) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), 'Chromora Administrator', email, bcrypt.hashSync('Chromora123!', 12), 'ADMIN', 'CHROMORA-ADMIN', 'Narcotics Control Bureau');
  console.log('Created local development admin: admin@chromora.local / Chromora123!');
}
if (!db.prepare('SELECT id FROM test_profiles WHERE code = ?').get('GENERAL_COLORIMETRIC_DEMO')) {
  db.prepare('INSERT INTO test_profiles (id, code, display_name, status, description) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), 'GENERAL_COLORIMETRIC_DEMO', 'General colourimetric field test', 'DEMO_PROFILE_ONLY', 'Workflow placeholder only. It is not a validated test profile or classifier.');
}
