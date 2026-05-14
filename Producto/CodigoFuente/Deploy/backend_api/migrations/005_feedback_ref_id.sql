ALTER TABLE feedback_ia ADD COLUMN IF NOT EXISTS ref_id TEXT;

CREATE INDEX IF NOT EXISTS idx_feedback_ia_usuario_ref ON feedback_ia(fk_usuario, ref_id);
