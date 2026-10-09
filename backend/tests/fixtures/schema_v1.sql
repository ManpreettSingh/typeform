-- Schema of the previous release (commit 3f880e4), generated from the models before Phase 1.
-- tests/test_migrations.py loads it to prove that migrate() upgrades a real old database in place.
CREATE TABLE answers (
	id INTEGER NOT NULL, 
	response_id INTEGER NOT NULL, 
	question_id INTEGER NOT NULL, 
	value JSON NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_answers_response_question UNIQUE (response_id, question_id), 
	FOREIGN KEY(response_id) REFERENCES responses (id) ON DELETE CASCADE, 
	FOREIGN KEY(question_id) REFERENCES questions (id) ON DELETE CASCADE
);
CREATE TABLE forms (
	id INTEGER NOT NULL, 
	slug VARCHAR(32) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	status VARCHAR(16) NOT NULL, 
	theme JSON NOT NULL, 
	thank_you JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	published_at DATETIME, 
	views INTEGER DEFAULT '0' NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_forms_status CHECK (status IN ('draft', 'published')), 
	UNIQUE (slug)
);
CREATE TABLE questions (
	id INTEGER NOT NULL, 
	form_id INTEGER NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	title TEXT NOT NULL, 
	description TEXT, 
	required BOOLEAN NOT NULL, 
	position INTEGER NOT NULL, 
	properties JSON NOT NULL, 
	logic JSON, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_questions_type CHECK (type IN ('short_text', 'long_text', 'multiple_choice', 'dropdown', 'email', 'number', 'yes_no', 'rating')), 
	CONSTRAINT ck_questions_position CHECK (position >= 0), 
	CONSTRAINT uq_questions_form_position UNIQUE (form_id, position), 
	FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
);
CREATE TABLE responses (
	id INTEGER NOT NULL, 
	form_id INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at DATETIME NOT NULL, 
	submitted_at DATETIME, 
	meta JSON, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_responses_status CHECK (status IN ('partial', 'completed')), 
	FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
);
CREATE INDEX ix_answers_question_id ON answers (question_id);
CREATE INDEX ix_responses_form_status ON responses (form_id, status);
