-- ==============================================================================
-- Migration: V5__signup_profile_details_and_resume.sql
-- Store First Name, Last Name, Job Role, Age, and Resume for Employee and Manager Signup
-- ==============================================================================

ALTER TABLE users
    ADD COLUMN first_name VARCHAR(80) NULL,
    ADD COLUMN last_name VARCHAR(80) NULL,
    ADD COLUMN job_role VARCHAR(120) NULL,
    ADD COLUMN age INT NULL,
    ADD COLUMN resume_file_name VARCHAR(255) NULL,
    ADD COLUMN resume_content_type VARCHAR(100) NULL,
    ADD COLUMN resume_file_size BIGINT NULL,
    ADD COLUMN resume_data LONGTEXT NULL;
