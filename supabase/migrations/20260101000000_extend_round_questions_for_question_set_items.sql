-- Extend round_questions to support question_set_items as source
-- Add question_set_item_id and snapshot columns (question_text, answer_text, note)
-- Keep question_id nullable for backward compatibility

ALTER TABLE olympia.round_questions
ADD COLUMN question_set_item_id uuid,
ADD COLUMN question_text text,
ADD COLUMN answer_text text,
ADD COLUMN note text;

-- Add FK for question_set_item_id
ALTER TABLE olympia.round_questions
ADD CONSTRAINT round_questions_question_set_item_id_fkey 
FOREIGN KEY (question_set_item_id) REFERENCES olympia.question_set_items(id);

-- Index for faster lookups
CREATE INDEX idx_round_questions_question_set_item_id 
ON olympia.round_questions(question_set_item_id);
