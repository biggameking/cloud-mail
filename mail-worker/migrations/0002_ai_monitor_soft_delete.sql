ALTER TABLE ai_monitor ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_ai_monitor_due;
CREATE INDEX IF NOT EXISTS idx_ai_monitor_due ON ai_monitor(is_deleted, enabled, next_run_at);
