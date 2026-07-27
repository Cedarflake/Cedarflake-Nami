CREATE TABLE i0c_data_document (
  kind TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  checksum CHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT i0c_data_document_kind_check
    CHECK (kind IN ('config', 'redirects')),
  CONSTRAINT i0c_data_document_revision_check
    CHECK (revision > 0),
  CONSTRAINT i0c_data_document_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$')
);
