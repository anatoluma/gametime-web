-- Optional YouTube recording of a game, shown embedded on the game page.
ALTER TABLE games ADD COLUMN IF NOT EXISTS youtube_url text;
