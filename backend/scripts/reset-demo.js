require('../src/db/init');
const fs=require('fs'); const path=require('path'); const db=require('../src/db/database'); const env=require('../src/config/env');
const records=db.prepare("SELECT id,original_image_path FROM test_records WHERE data_origin='DEMO_SEED'").all();
const ids=records.map(r=>r.id); for(const record of records){const file=path.resolve(env.rootDir,record.original_image_path||'');if(file.startsWith(path.resolve(env.uploadDir))&&fs.existsSync(file))fs.rmSync(file,{force:true});}
if(ids.length){const q=ids.map(()=>'?').join(',');db.prepare(`DELETE FROM audit_logs WHERE test_record_id IN (${q})`).run(...ids);db.prepare(`DELETE FROM test_records WHERE id IN (${q})`).run(...ids);}
console.log(`Removed ${ids.length} synthetic DEMO_SEED record(s). LIVE_CAPTURE records were not changed.`);
