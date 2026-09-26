const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sha256File, signRecord, verifyRecord } = require('../src/services/integrity.service');

test('signs and verifies the original evidence fingerprint', () => {
  const evidence = path.join(os.tmpdir(), `chromora-integrity-${process.pid}.bin`);
  fs.writeFileSync(evidence, 'chromora integrity test');
  const record = { test_number: 'FT-TEST-0001', operator_id: 'operator-1', captured_at: '2026-01-01T00:00:00.000Z', latitude: null, longitude: null, location_accuracy: null, image_sha256: sha256File(evidence), test_profile: 'GENERAL_COLORIMETRIC_DEMO', presumptive_result: 'ANALYSIS_PENDING' };
  const signed = signRecord(record);
  record.record_signature = signed.signature;
  const verified = verifyRecord(record, evidence);
  assert.equal(signed.algorithm, 'ECDSA_P256_SHA256');
  assert.equal(verified.status, 'VERIFIED');
  fs.rmSync(evidence, { force: true });
});
