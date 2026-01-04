-- Refactor batches schema to support multi-tile submissions

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS memo_b64 TEXT;

CREATE TABLE IF NOT EXISTS batch_tiles (
  signature TEXT NOT NULL REFERENCES batches(signature) ON DELETE CASCADE,
  tile INTEGER NOT NULL,
  commit TEXT NOT NULL,
  pixel_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (signature, tile)
);

CREATE TABLE IF NOT EXISTS batch_tile_bytes (
  signature TEXT NOT NULL,
  tile INTEGER NOT NULL,
  batch_bytes BYTEA NOT NULL,
  PRIMARY KEY (signature, tile),
  FOREIGN KEY (signature, tile) REFERENCES batch_tiles(signature, tile) ON DELETE CASCADE
);

-- Only migrate data if the old columns still exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batches' AND column_name = 'tile'
  ) THEN
    INSERT INTO batch_tiles (signature, tile, commit, pixel_count)
    SELECT signature, tile, commit, 0
    FROM batches
    ON CONFLICT (signature, tile) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'batch_bytes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batches' AND column_name = 'tile'
  ) THEN
    INSERT INTO batch_tile_bytes (signature, tile, batch_bytes)
    SELECT b.signature, b.tile, bb.batch_bytes
    FROM batches b
    JOIN batch_bytes bb ON bb.signature = b.signature
    ON CONFLICT (signature, tile) DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS batch_bytes;

ALTER TABLE batches
  DROP COLUMN IF EXISTS tile,
  DROP COLUMN IF EXISTS commit;
