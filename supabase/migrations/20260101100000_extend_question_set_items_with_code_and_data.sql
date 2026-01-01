-- Extend question_set_items to store code and question/answer data directly
-- This allows question_set_items to be the single source of truth for questions

ALTER TABLE olympia.question_set_items
ADD COLUMN code text,
ADD COLUMN question_text text NOT NULL DEFAULT '',
ADD COLUMN answer_text text NOT NULL DEFAULT '',
ADD COLUMN note text,
ADD COLUMN category text;

-- Create index on code for faster lookups
CREATE INDEX idx_question_set_items_code 
ON olympia.question_set_items(code);

-- Create index on question_set_id + code for partition logic
CREATE INDEX idx_question_set_items_set_and_code 
ON olympia.question_set_items(question_set_id, code);
