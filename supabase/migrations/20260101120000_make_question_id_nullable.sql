-- Make question_id nullable in round_questions since we're using question_set_item_id now
ALTER TABLE olympia.round_questions
ALTER COLUMN question_id DROP NOT NULL;
