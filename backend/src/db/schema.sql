CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('MASTER_ADMIN','ADMIN','FIELD_OFFICER')), account_status TEXT NOT NULL DEFAULT 'APPROVED',
  employee_id TEXT, department TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS test_records (
  id TEXT PRIMARY KEY, test_number TEXT NOT NULL UNIQUE, test_profile TEXT, operator_id TEXT NOT NULL,
  captured_at TEXT, latitude REAL, longitude REAL, location_accuracy REAL, original_image_path TEXT,
  image_sha256 TEXT, record_signature TEXT, signature_algorithm TEXT, integrity_status TEXT NOT NULL DEFAULT 'PENDING',
  reference_card_status TEXT NOT NULL DEFAULT 'NOT_IMPLEMENTED', capture_quality TEXT NOT NULL DEFAULT 'PENDING',
  classification_confidence REAL, presumptive_result TEXT NOT NULL DEFAULT 'ANALYSIS_PENDING', notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(operator_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS test_profiles (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, status TEXT NOT NULL,
 description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, actor_user_id TEXT, test_record_id TEXT, action TEXT NOT NULL, metadata_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
