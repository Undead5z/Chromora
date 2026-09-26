const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const keyDirectory = path.join(env.rootDir, 'data', 'keys');
const privateKeyPath = path.join(keyDirectory, 'chromora-dev-private.pem');
const publicKeyPath = path.join(keyDirectory, 'chromora-dev-public.pem');

function ensureDevelopmentKeyPair() {
  fs.mkdirSync(keyDirectory, { recursive: true });
  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    fs.writeFileSync(privateKeyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(publicKeyPath, pair.publicKey.export({ type: 'spki', format: 'pem' }));
  }
  return { privateKey: fs.readFileSync(privateKeyPath), publicKey: fs.readFileSync(publicKeyPath) };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function canonicalRecord(record) {
  return JSON.stringify({
    version: 1,
    testNumber: record.test_number,
    operatorId: record.operator_id,
    capturedAt: record.captured_at,
    latitude: record.latitude,
    longitude: record.longitude,
    locationAccuracy: record.location_accuracy,
    imageSha256: record.image_sha256,
    testProfile: record.test_profile,
    presumptiveResult: record.presumptive_result
  });
}

function signRecord(record) {
  const { privateKey } = ensureDevelopmentKeyPair();
  const signature = crypto.sign('sha256', Buffer.from(canonicalRecord(record)), privateKey).toString('base64');
  return { signature, algorithm: 'ECDSA_P256_SHA256' };
}

function verifyRecord(record, imagePath) {
  if (!record.image_sha256 || !record.record_signature) return { status: 'PENDING', hashMatches: false, signatureValid: false };
  const currentHash = sha256File(imagePath);
  if (currentHash !== record.image_sha256) return { status: 'HASH_MISMATCH', hashMatches: false, signatureValid: false, currentHash };
  const { publicKey } = ensureDevelopmentKeyPair();
  const signatureValid = crypto.verify('sha256', Buffer.from(canonicalRecord(record)), publicKey, Buffer.from(record.record_signature, 'base64'));
  return { status: signatureValid ? 'VERIFIED' : 'SIGNATURE_INVALID', hashMatches: true, signatureValid, currentHash };
}

module.exports = { sha256File, signRecord, verifyRecord, canonicalRecord };
