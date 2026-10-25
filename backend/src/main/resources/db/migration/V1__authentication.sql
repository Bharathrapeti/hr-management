CREATE TABLE users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    employee_id VARCHAR(64) NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('EMPLOYEE', 'HR_ADMIN') NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'INACTIVE',
    email_verified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL
);

CREATE TABLE auth_otps (
    otp_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    purpose ENUM('SIGNUP', 'PASSWORD_RESET') NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_otps_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_auth_otps_lookup (user_id, purpose, created_at),
    INDEX idx_auth_otps_expiry (expires_at)
);

CREATE TABLE auth_otp_requests (
    request_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    purpose ENUM('SIGNUP', 'PASSWORD_RESET') NOT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_otp_requests_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_auth_otp_requests_rate (user_id, purpose, requested_at)
);

CREATE TABLE auth_sessions (
    session_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_auth_sessions_active (token_hash, expires_at, revoked_at)
);

CREATE TABLE auth_login_attempts (
    attempt_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(320) NOT NULL,
    client_ip VARCHAR(64) NOT NULL,
    succeeded BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auth_login_attempts (email, client_ip, attempted_at)
);
