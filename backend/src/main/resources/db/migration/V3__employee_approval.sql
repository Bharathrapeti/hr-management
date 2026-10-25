ALTER TABLE users
    MODIFY status ENUM('ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'REJECTED') NOT NULL DEFAULT 'INACTIVE',
    ADD COLUMN reviewed_by_hr_user_id BIGINT NULL,
    ADD COLUMN reviewed_at TIMESTAMP NULL,
    ADD COLUMN review_reason VARCHAR(500) NULL,
    ADD CONSTRAINT fk_users_reviewer FOREIGN KEY (reviewed_by_hr_user_id) REFERENCES users(user_id),
    ADD INDEX idx_users_status_created (status, created_at);
