ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS ck_questions_type;

ALTER TABLE questions
ADD CONSTRAINT ck_questions_type
CHECK (type IN ('free_text', 'yes_no', 'likert_5'));
