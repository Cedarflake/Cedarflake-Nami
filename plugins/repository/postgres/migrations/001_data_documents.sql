CREATE TABLE nami_data_document (
  kind TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  checksum CHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nami_data_document_kind_check
    CHECK (kind IN ('config', 'redirects')),
  CONSTRAINT nami_data_document_revision_check
    CHECK (revision > 0),
  CONSTRAINT nami_data_document_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$')
);
