CREATE TABLE i0c_data_document_revision (
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL,
  content TEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  operation TEXT NOT NULL,
  actor_github_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, revision),
  CONSTRAINT i0c_data_document_revision_kind_check
    CHECK (kind IN ('config', 'redirects')),
  CONSTRAINT i0c_data_document_revision_number_check
    CHECK (revision > 0),
  CONSTRAINT i0c_data_document_revision_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT i0c_data_document_revision_operation_check
    CHECK (operation IN ('import', 'initialize', 'migration', 'rollback', 'save')),
  CONSTRAINT i0c_data_document_revision_actor_check
    CHECK (
      actor_github_user_id IS NULL
      OR actor_github_user_id ~ '^[1-9][0-9]*$'
    )
);

CREATE INDEX i0c_data_document_revision_created_at_idx
  ON i0c_data_document_revision (kind, created_at DESC);

INSERT INTO i0c_data_document_revision (
  kind,
  revision,
  content,
  checksum,
  operation,
  created_at
)
SELECT
  kind,
  revision,
  content,
  checksum,
  'migration',
  updated_at
FROM i0c_data_document
ON CONFLICT (kind, revision) DO NOTHING;
