CREATE TABLE i0c_data_document_revision (
  kind TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  checksum TEXT NOT NULL,
  operation TEXT NOT NULL,
  actor_github_user_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (kind, revision),
  CHECK (kind IN ('config', 'redirects')),
  CHECK (revision > 0),
  CHECK (
    LENGTH(checksum) = 64
    AND checksum NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (operation IN ('import', 'initialize', 'migration', 'rollback', 'save')),
  CHECK (
    actor_github_user_id IS NULL
    OR (
      LENGTH(actor_github_user_id) > 0
      AND actor_github_user_id NOT LIKE '0%'
      AND actor_github_user_id NOT GLOB '*[^0-9]*'
    )
  )
);

-- d1-statement-breakpoint
CREATE INDEX i0c_data_document_revision_created_at_idx
  ON i0c_data_document_revision (kind, created_at DESC);

-- d1-statement-breakpoint
INSERT OR IGNORE INTO i0c_data_document_revision (
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
;
