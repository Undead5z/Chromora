require('../src/db/init');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const db = require('../src/db/database');
const env = require('../src/config/env');
const { sha256File, signRecord, verifyRecord } = require('../src/services/integrity.service');

const records = [
  ['NEGATIVE','Bengaluru',12.9716,77.5946,0],['POSITIVE','Pune',18.5204,73.8567,0],['INCONCLUSIVE','Chennai',13.0827,80.2707,0],['ANALYSIS_PENDING','Hyderabad',17.3850,78.4867,0],
  ['NEGATIVE','Bengaluru',12.9716,77.5946,1],['POSITIVE','Pune',18.5204,73.8567,1],['NEGATIVE','Chennai',13.0827,80.2707,2],['INCONCLUSIVE','Hyderabad',17.3850,78.4867,2],
  ['NEGATIVE','Kochi',9.9312,76.2673,3],['POSITIVE','Bengaluru',12.9716,77.5946,4],['NEGATIVE','Pune',18.5204,73.8567,5],['ANALYSIS_PENDING','Chennai',13.0827,80.2707,6],
  ['INCONCLUSIVE','Hyderabad',17.3850,78.4867,7],['NEGATIVE','Kochi',9.9312,76.2673,10],['POSITIVE','Bengaluru',12.9716,77.5946,14],['NEGATIVE','Pune',18.5204,73.8567,20],
  ['INCONCLUSIVE','Chennai',13.0827,80.2707,29],['ANALYSIS_PENDING','Hyderabad',17.3850,78.4867,45],['NEGATIVE','Kochi',9.9312,76.2673,60],['POSITIVE','Bengaluru',12.9716,77.5946,80]
];
const evidence = (number, result) => `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="800" fill="#e7edf3"/><rect x="55" y="55" width="1090" height="690" rx="28" fill="#fff" stroke="#24344D" stroke-width="8"/><text x="100" y="140" font-family="Arial" font-size="42" fill="#142238">CHROMORA PROTOTYPE</text><text x="100" y="195" font-family="Arial" font-size="28" fill="#142238">SYNTHETIC TEST EVIDENCE · ${number}</text><rect x="120" y="280" width="570" height="160" rx="16" fill="#dbeafe"/><rect x="170" y="325" width="470" height="70" rx="12" fill="#A78BFA"/><text x="760" y="280" font-family="Arial" font-size="24" fill="#142238">REFERENCE SWATCHES</text><rect x="760" y="315" width="260" height="45" fill="#22C7E8"/><rect x="760" y="380" width="260" height="45" fill="#A78BFA"/><rect x="760" y="445" width="260" height="45" fill="#F59E0B"/><text x="100" y="680" font-family="Arial" font-size="24" fill="#EF4444">SYNTHETIC PROTOTYPE EVIDENCE · RESULT STATE: ${result}</text></svg>`;

(async () => {
  fs.mkdirSync(env.uploadDir, { recursive: true }); fs.mkdirSync(env.reportDir, { recursive: true });
  const old = db.prepare('SELECT id,original_image_path FROM test_records').all();
  const reports = db.prepare('SELECT file_path FROM reports').all();
  for (const item of [...old, ...reports]) { const file = path.resolve(env.rootDir, item.original_image_path || item.file_path || ''); if (file.startsWith(path.resolve(env.uploadDir)) && fs.existsSync(file)) fs.rmSync(file, { force: true }); }
  db.transaction(() => { db.exec('DELETE FROM reports'); db.exec('DELETE FROM audit_logs'); db.exec('DELETE FROM test_records'); db.prepare("DELETE FROM users WHERE role='FIELD_OFFICER'").run(); })();
  const officerId = crypto.randomUUID();
  db.prepare('INSERT INTO users (id,full_name,email,password_hash,role,account_status,employee_id,department) VALUES (?,?,?,?,?,?,?,?)').run(officerId,'Senior Field Officer','officer@chomora.local',bcrypt.hashSync('Officer@123!',12),'FIELD_OFFICER','APPROVED','NCB-SFO-001','Narcotics Control Bureau');
  for (let index=0; index<records.length; index++) {
    const [result,label,latitude,longitude,daysAgo] = records[index]; const id=crypto.randomUUID(); const number=`FT-2026-${String(index+1).padStart(4,'0')}`; const file=path.join(env.uploadDir,`${id}.png`); await sharp(Buffer.from(evidence(number,result))).png().toFile(file);
    const capturedAt=new Date(Date.now()-daysAgo*86400000-index*3600000).toISOString(); const relative=path.relative(env.rootDir,file).replace(/\\/g,'/');
    db.prepare('INSERT INTO test_records (id,test_number,test_profile,operator_id,captured_at,latitude,longitude,location_label,location_accuracy,original_image_path,image_sha256,capture_quality,reference_card_status,presumptive_result,analysis_source,data_origin,demo_scenario,signed_payload_version,integrity_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,number,'DEMO_COLORIMETRIC_A',officerId,capturedAt,latitude,longitude,label,8,relative,sha256File(file),'ACCEPTABLE','NOT_IMPLEMENTED',result,'DEMO_SEED','DEMO_SEED',`PROTOTYPE-${index+1}`,1,'PENDING');
    let record=db.prepare('SELECT * FROM test_records WHERE id=?').get(id); const signed=signRecord(record); db.prepare('UPDATE test_records SET record_signature=?,signature_algorithm=?,integrity_status=? WHERE id=?').run(signed.signature,signed.algorithm,'VERIFIED',id);
    if(index===16){ fs.appendFileSync(file,'\nTAMPERED'); const verification=verifyRecord(db.prepare('SELECT * FROM test_records WHERE id=?').get(id),file); db.prepare('UPDATE test_records SET integrity_status=? WHERE id=?').run(verification.status,id); }
    if(index===17){ db.prepare("UPDATE test_records SET captured_at=? WHERE id=?").run(new Date(Date.now() - 46 * 86400000).toISOString(), id); const verification=verifyRecord(db.prepare('SELECT * FROM test_records WHERE id=?').get(id),file); db.prepare('UPDATE test_records SET integrity_status=? WHERE id=?').run(verification.status,id); }
    if(index===18||index===19) db.prepare("UPDATE test_records SET integrity_status='PENDING' WHERE id=?").run(id);
    db.prepare('INSERT INTO audit_logs (id,actor_user_id,test_record_id,action,metadata_json) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),officerId,id,'DEMO_RECORD_RESEEDED',JSON.stringify({synthetic:true}));
  }
  console.log('Reseeded 20 synthetic prototype records for Senior Field Officer.');
})();
