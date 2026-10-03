-- Attraction facts columns (founder page rework, 2026-10-02). RUN ONCE —
-- SQLite has no ADD COLUMN IF NOT EXISTS; a second run errors harmlessly.
ALTER TABLE attractions ADD COLUMN website TEXT;
ALTER TABLE attractions ADD COLUMN ticket_price TEXT;
ALTER TABLE attractions ADD COLUMN ticket_url TEXT;
ALTER TABLE attractions ADD COLUMN parking_text TEXT;
