CREATE TABLE nami_data_document_revision (
  kind TEXT NOT NULL,
  revision BIGINT NOT NULL,
  content TEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  operation TEXT NOT NULL,
  actor_github_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, revision),
  CONSTRAINT nami_data_document_revision_kind_check
    CHECK (kind IN ('config', 'redirects')),
  CONSTRAINT nami_data_document_revision_number_check
    CHECK (revision > 0),
  CONSTRAINT nami_data_document_revision_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT nami_data_document_revision_operation_check
    CHECK (operation IN ('import', 'initialize', 'migration', 'rollback', 'save')),
  CONSTRAINT nami_data_document_revision_actor_check
    CHECK (
      actor_github_user_id IS NULL
      OR actor_github_user_id ~ '^[1-9][0-9]*$'
    )
);

CREATE INDEX nami_data_document_revision_created_at_idx
  ON nami_data_document_revision (kind, created_at DESC);

INSERT INTO nami_data_document_revision (
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
FROM nami_data_document
ON CONFLICT (kind, revision) DO NOTHING;
