CREATE TABLE i0c_data_document (
  kind TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  checksum TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  CHECK (kind IN ('config', 'redirects')),
  CHECK (revision > 0),
  CHECK (
    LENGTH(checksum) = 64
    AND checksum NOT GLOB '*[^0-9a-f]*'
  )
);
