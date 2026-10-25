ALTER TABLE auth_otps
    MODIFY purpose ENUM('SIGNUP', 'PASSWORD_RESET', 'HR_INVITATION') NOT NULL;

ALTER TABLE auth_otp_requests
    MODIFY purpose ENUM('SIGNUP', 'PASSWORD_RESET', 'HR_INVITATION') NOT NULL;

CREATE TABLE manager_access_requests (
    request_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    requesting_user_id BIGINT NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by_hr_user_id BIGINT NULL,
    reviewed_at TIMESTAMP NULL,
    review_reason VARCHAR(500) NULL,
    pending_user_id BIGINT GENERATED ALWAYS AS (
        CASE WHEN status = 'PENDING' THEN requesting_user_id ELSE NULL END
    ) STORED UNIQUE,
    CONSTRAINT fk_manager_requests_user FOREIGN KEY (requesting_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_requests_reviewer FOREIGN KEY (reviewed_by_hr_user_id) REFERENCES users(user_id),
    INDEX idx_manager_requests_status (status, submitted_at),
    INDEX idx_manager_requests_user (requesting_user_id, status)
);

CREATE TABLE manager_permissions (
    permission_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    manager_user_id BIGINT NOT NULL,
    permission_code VARCHAR(80) NOT NULL,
    granted_by_hr_user_id BIGINT NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    revoked_by_hr_user_id BIGINT NULL,
    revoke_reason VARCHAR(500) NULL,
    active_permission_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN revoked_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    CONSTRAINT fk_manager_permissions_manager FOREIGN KEY (manager_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_permissions_granter FOREIGN KEY (granted_by_hr_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_permissions_revoker FOREIGN KEY (revoked_by_hr_user_id) REFERENCES users(user_id),
    UNIQUE KEY uq_manager_active_permission (manager_user_id, permission_code, active_permission_key),
    INDEX idx_manager_permissions_lookup (manager_user_id, revoked_at)
);

CREATE TABLE manager_employee_assignments (
    assignment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    manager_user_id BIGINT NOT NULL,
    employee_user_id BIGINT NOT NULL,
    assigned_by_hr_user_id BIGINT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    revoked_by_hr_user_id BIGINT NULL,
    revoke_reason VARCHAR(500) NULL,
    active_assignment_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN revoked_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    CONSTRAINT fk_manager_assignments_manager FOREIGN KEY (manager_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_assignments_employee FOREIGN KEY (employee_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_assignments_granter FOREIGN KEY (assigned_by_hr_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_assignments_revoker FOREIGN KEY (revoked_by_hr_user_id) REFERENCES users(user_id),
    UNIQUE KEY uq_manager_active_assignment (manager_user_id, employee_user_id, active_assignment_key),
    INDEX idx_manager_assignments_manager (manager_user_id, revoked_at),
    INDEX idx_manager_assignments_employee (employee_user_id, revoked_at)
);

CREATE TABLE manager_permission_audit (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    manager_user_id BIGINT NOT NULL,
    permission_code VARCHAR(80) NOT NULL,
    action ENUM('GRANTED', 'REVOKED') NOT NULL,
    changed_by_hr_user_id BIGINT NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(500) NULL,
    CONSTRAINT fk_manager_permission_audit_manager FOREIGN KEY (manager_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_permission_audit_actor FOREIGN KEY (changed_by_hr_user_id) REFERENCES users(user_id),
    INDEX idx_manager_permission_audit_manager (manager_user_id, changed_at)
);

CREATE TABLE manager_assignment_audit (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    manager_user_id BIGINT NOT NULL,
    employee_user_id BIGINT NOT NULL,
    action ENUM('ASSIGNED', 'REVOKED') NOT NULL,
    changed_by_hr_user_id BIGINT NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(500) NULL,
    CONSTRAINT fk_manager_assignment_audit_manager FOREIGN KEY (manager_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_assignment_audit_employee FOREIGN KEY (employee_user_id) REFERENCES users(user_id),
    CONSTRAINT fk_manager_assignment_audit_actor FOREIGN KEY (changed_by_hr_user_id) REFERENCES users(user_id),
    INDEX idx_manager_assignment_audit_manager (manager_user_id, changed_at)
);
