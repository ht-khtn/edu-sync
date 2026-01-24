-- Allow NULL for seat_index to support atomic updates
-- This prevents duplicate key constraint violations during seat_index reordering
ALTER TABLE olympia.match_players
ALTER COLUMN seat_index DROP NOT NULL;

-- Update the constraint to allow NULL
ALTER TABLE olympia.match_players
DROP CONSTRAINT IF EXISTS match_players_seat_index_check;

ALTER TABLE olympia.match_players
ADD CONSTRAINT match_players_seat_index_check 
CHECK (seat_index IS NULL OR (seat_index BETWEEN 1 AND 4));
