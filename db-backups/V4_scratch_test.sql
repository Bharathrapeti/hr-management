-- ==============================================================================
-- Migration: V4__employee_personal_details_and_manager_approval.sql
-- Status: PROPOSED ONLY (NOT APPLIED)
-- Forward-only additions for HR Personal Details and Option A Manager Approval
-- ==============================================================================

-- 1. Add HR-managed personal detail fields and registration manager assignment to users table
ALTER TABLE users
    ADD COLUMN gender VARCHAR(32) NULL AFTER name,
    ADD COLUMN date_of_birth DATE NULL AFTER gender,
    ADD COLUMN residential_address VARCHAR(500) NULL AFTER date_of_birth,
    ADD COLUMN mobile_number VARCHAR(32) NULL AFTER residential_address,
    ADD COLUMN assigned_manager_user_id BIGINT NULL AFTER review_reason,
    ADD CONSTRAINT fk_users_assigned_manager FOREIGN KEY (assigned_manager_user_id) REFERENCES users(user_id),
    ADD INDEX idx_users_assigned_manager_status (assigned_manager_user_id, status);

-- 2. Create in-app correction requests table for employee profile changes
CREATE TABLE employee_correction_requests (
    request_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    employee_user_id BIGINT NOT NULL,
    requested_changes TEXT NOT NULL,
    status ENUM('PENDING', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by_hr_user_id BIGINT NULL,
    resolved_at TIMESTAMP NULL,
    resolution_note VARCHAR(500) NULL,
    CONSTRAINT fk_correction_employee FOREIGN KEY (employee_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_correction_resolver FOREIGN KEY (resolved_by_hr_user_id) REFERENCES users(user_id),
    INDEX idx_correction_status (status, created_at),
    INDEX idx_correction_employee (employee_user_id, status)
);
