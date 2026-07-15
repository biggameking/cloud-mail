CREATE TABLE IF NOT EXISTS ai_monitor (
  monitor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_time TEXT NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  language TEXT NOT NULL DEFAULT 'zh-CN',
  destination_key TEXT NOT NULL DEFAULT '',
  include_read INTEGER NOT NULL DEFAULT 1,
  sender_allowlist TEXT NOT NULL DEFAULT '[]',
  sender_blocklist TEXT NOT NULL DEFAULT '[]',
  subject_keywords TEXT NOT NULL DEFAULT '[]',
  category_filter TEXT NOT NULL DEFAULT '[]',
  max_emails_per_run INTEGER NOT NULL DEFAULT 100,
  max_chars_per_email INTEGER NOT NULL DEFAULT 8000,
  last_processed_email_id INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_monitor_due ON ai_monitor(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_ai_monitor_owner ON ai_monitor(owner_user_id);

CREATE TABLE IF NOT EXISTS ai_monitor_account (
  monitor_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(monitor_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_monitor_account_account ON ai_monitor_account(account_id);

CREATE TABLE IF NOT EXISTS ai_digest_run (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason_code TEXT NOT NULL DEFAULT '',
  email_count INTEGER NOT NULL DEFAULT 0,
  filtered_count INTEGER NOT NULL DEFAULT 0,
  backlog_count INTEGER NOT NULL DEFAULT 0,
  input_chars INTEGER NOT NULL DEFAULT 0,
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  error_class TEXT NOT NULL DEFAULT '',
  UNIQUE(monitor_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_ai_digest_run_monitor ON ai_digest_run(monitor_id, run_id DESC);

CREATE TABLE IF NOT EXISTS ai_digest (
  digest_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL UNIQUE,
  monitor_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  overview TEXT NOT NULL,
  content_json TEXT NOT NULL,
  important_count INTEGER NOT NULL DEFAULT 0,
  action_count INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'not_requested',
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  retained INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ai_digest_monitor ON ai_digest(monitor_id, digest_id DESC);

CREATE TABLE IF NOT EXISTS ai_digest_source (
  digest_id INTEGER NOT NULL,
  email_id INTEGER NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  action_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(digest_id, email_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_digest_source_email ON ai_digest_source(email_id);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  usage_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_neurons INTEGER NOT NULL DEFAULT 0,
  skipped_runs INTEGER NOT NULL DEFAULT 0,
  UNIQUE(usage_date, provider, model)
);

CREATE TABLE IF NOT EXISTS ai_system_config (
  config_id INTEGER PRIMARY KEY CHECK (config_id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  delivery_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO ai_system_config (config_id, enabled, delivery_enabled) VALUES (1, 0, 0);
