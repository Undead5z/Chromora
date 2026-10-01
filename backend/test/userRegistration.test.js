const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/init');
const app = require('../src/app');
const db = require('../src/db/database');

const start = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
const request = (base, path, options = {}) => fetch(`${base}${path}`, options);
const login = async (base, email, password, application) => {
  const response = await request(base, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, application }) });
  return { response, data: await response.json() };
};

test('registration requires approval and preserves generated employee IDs', async () => {
  const server = await start();
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `pending-${Date.now()}@chromora.local`;
  let userId;
  try {
    const registration = await request(base, '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        fullName: 'Pending Field Officer', officialEmail: email, phone: '+91 9876543210', department: 'Narcotics Control Bureau', designation: 'Field Officer', requestedRole: 'FIELD_OFFICER', jurisdictionRegion: 'Pune Region', password: 'Pending@123!', confirmPassword: 'Pending@123!'
      })
    });
    assert.equal(registration.status, 201);
    const registered = await registration.json();
    userId = registered.user.id;
    assert.equal(registered.user.accountStatus, 'PENDING_APPROVAL');
    assert.match(registered.user.employeeId, /^CHR-USER-\d{4}-\d{4}$/);

    const pendingLogin = await login(base, email, 'Pending@123!', 'MOBILE');
    assert.equal(pendingLogin.response.status, 403);
    assert.equal(pendingLogin.data.error.message, 'Your registration is pending approval.');

    const master = await login(base, 'admin@chromora.local', 'Admin@123!', 'WEB');
    assert.equal(master.response.status, 200);
    const approval = await request(base, `/api/users/${userId}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${master.data.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalNote: 'Approved for field use.' }) });
    assert.equal(approval.status, 200);
    const approved = await approval.json();
    assert.equal(approved.user.accountStatus, 'APPROVED');
    assert.equal(approved.user.employeeId, registered.user.employeeId);

    const mobileLogin = await login(base, email, 'Pending@123!', 'MOBILE');
    assert.equal(mobileLogin.response.status, 200);
    const masterSelfApprove = await request(base, `/api/users/${master.data.user.id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${master.data.token}` } });
    assert.equal(masterSelfApprove.status, 403);
    const suspend = await request(base, `/api/users/${userId}/suspend`, { method: 'POST', headers: { Authorization: `Bearer ${master.data.token}` } });
    assert.equal(suspend.status, 200);
    const suspendedLogin = await login(base, email, 'Pending@123!', 'MOBILE');
    assert.equal(suspendedLogin.response.status, 403);
    assert.equal(suspendedLogin.data.error.message, 'Your account has been suspended.');
    const reactivate = await request(base, `/api/users/${userId}/reactivate`, { method: 'POST', headers: { Authorization: `Bearer ${master.data.token}` } });
    assert.equal(reactivate.status, 200);
    const originalEmployeeId = registered.user.employeeId;
    const edit = await request(base, `/api/users/${userId}`, { method: 'PUT', headers: { Authorization: `Bearer ${master.data.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ department: 'Updated Office', employeeId: 'MUST-NOT-CHANGE' }) });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).user.employeeId, originalEmployeeId);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE action='USER_REGISTERED' AND metadata_json LIKE ?").get(`%${userId}%`).count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE action='USER_APPROVED' AND metadata_json LIKE ?").get(`%${userId}%`).count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE action='USER_SUSPENDED' AND metadata_json LIKE ?").get(`%${userId}%`).count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM audit_logs WHERE action='USER_REACTIVATED' AND metadata_json LIKE ?").get(`%${userId}%`).count, 1);
  } finally {
    if (userId) {
      db.prepare("DELETE FROM audit_logs WHERE metadata_json LIKE ?").run(`%${userId}%`);
      db.prepare('DELETE FROM users WHERE id=?').run(userId);
    }
    server.close();
  }
});
