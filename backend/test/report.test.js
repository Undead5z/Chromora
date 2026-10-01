const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('../src/db/init');
const app = require('../src/app');
const db = require('../src/db/database');
const env = require('../src/config/env');

const start = () => new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
const login = async base => {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@chromora.local', password: 'Admin@123!', application: 'WEB' }) });
  assert.equal(response.status, 200); return (await response.json()).token;
};

test('report generation and regeneration keep one report row for a synthetic record', async () => {
  const record = db.prepare("SELECT id,test_number FROM test_records WHERE data_origin='DEMO_SEED' ORDER BY captured_at DESC LIMIT 1").get();
  assert.ok(record, 'a synthetic prototype record is required');
  const existing = db.prepare('SELECT * FROM reports WHERE test_record_id=?').get(record.id);
  if (existing) { const file = path.resolve(env.rootDir, existing.file_path); if (fs.existsSync(file)) fs.rmSync(file); db.prepare('DELETE FROM reports WHERE id=?').run(existing.id); }
  db.prepare("DELETE FROM audit_logs WHERE test_record_id=? AND action IN ('REPORT_GENERATED','REPORT_REGENERATED','REPORT_DELETED')").run(record.id);
  const server = await start(); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const token = await login(base);
    const request = () => fetch(`${base}/api/test-records/${record.id}/report`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const first = await request(); assert.equal(first.status, 200); const firstData = await first.json();
    const row = db.prepare('SELECT * FROM reports WHERE test_record_id=?').get(record.id);
    assert.ok(row); assert.equal(row.id, firstData.report.id); assert.ok(row.generated_by); assert.ok(row.generated_at); assert.ok(row.updated_at);
    const file = path.resolve(env.rootDir, row.file_path); assert.ok(fs.existsSync(file)); assert.ok(fs.statSync(file).size > 0);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE test_record_id=? AND action='REPORT_GENERATED'").get(record.id).count, 1);
    const second = await request(); assert.equal(second.status, 200); const secondData = await second.json();
    assert.equal(secondData.report.id, row.id); assert.equal(db.prepare('SELECT count(*) count FROM reports WHERE test_record_id=?').get(record.id).count, 1);
    assert.ok(fs.existsSync(file)); assert.ok(fs.statSync(file).size > 0);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE test_record_id=? AND action='REPORT_REGENERATED'").get(record.id).count, 1);
    assert.ok(db.prepare('SELECT id FROM test_records WHERE id=?').get(record.id), 'report operations preserve test record');
    const list = await fetch(`${base}/api/reports?search=${record.test_number}`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(list.status, 200); const listed = await list.json(); assert.equal(listed.reports.length, 1); assert.equal(listed.reports[0].test_number, record.test_number); assert.equal('file_path' in listed.reports[0], false);
    const meta = await fetch(`${base}/api/reports/${row.id}`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(meta.status, 200); assert.equal((await meta.json()).report.id, row.id);
    const inline = await fetch(`${base}/api/reports/${row.id}/file`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(inline.status, 200); assert.match(inline.headers.get('content-type'), /application\/pdf/); assert.match(inline.headers.get('content-disposition'), /inline/); assert.ok((await inline.arrayBuffer()).byteLength > 0);
    const download = await fetch(`${base}/api/reports/${row.id}/download`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /attachment/);
    const unauth = async (url, options = {}) => { const response = await fetch(`${base}${url}`, options); assert.equal(response.status, 401); assert.equal((await response.arrayBuffer()).byteLength > 0, true); };
    await unauth('/api/reports');
    await unauth(`/api/reports/${row.id}`);
    await unauth(`/api/reports/${row.id}/file`);
    await unauth(`/api/reports/${row.id}/download`);
    await unauth(`/api/reports/${row.id}`, { method: 'DELETE' }); assert.ok(db.prepare('SELECT id FROM reports WHERE id=?').get(row.id));
    await unauth(`/api/test-records/${record.id}/report`, { method: 'POST' }); assert.equal(db.prepare('SELECT count(*) count FROM reports WHERE test_record_id=?').get(record.id).count, 1);
    const evidence = db.prepare('SELECT original_image_path FROM test_records WHERE id=?').get(record.id).original_image_path; const evidenceFile = path.resolve(env.rootDir, evidence); const remove = await fetch(`${base}/api/reports/${row.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); assert.equal(remove.status, 200); assert.equal(db.prepare('SELECT count(*) count FROM reports WHERE test_record_id=?').get(record.id).count, 0); assert.equal(fs.existsSync(file), false); assert.ok(db.prepare('SELECT id FROM test_records WHERE id=?').get(record.id)); assert.ok(fs.existsSync(evidenceFile)); assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE test_record_id=? AND action='REPORT_DELETED'").get(record.id).count, 1);
  } finally { server.close(); const report = db.prepare('SELECT * FROM reports WHERE test_record_id=?').get(record.id); if (report) { const file = path.resolve(env.rootDir, report.file_path); if (fs.existsSync(file)) fs.rmSync(file); db.prepare('DELETE FROM reports WHERE id=?').run(report.id); } db.prepare("DELETE FROM audit_logs WHERE test_record_id=? AND action IN ('REPORT_GENERATED','REPORT_REGENERATED','REPORT_DELETED')").run(record.id); }
});
