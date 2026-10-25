package com.example.employeehr.auth.service;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.auth.controller.AuthController;
import com.example.employeehr.config.AuthProperties;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final AuthProperties properties;
    private final SecureRandom random = new SecureRandom();

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            OtpService otpService,
            AuthProperties properties) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.otpService = otpService;
        this.properties = properties;
    }

    @Transactional
    public void signup(String name, String email, String password) {
        validatePassword(password);
        String normalizedEmail = normalizeEmail(email);
        var existing = jdbc.query("SELECT user_id, name, status FROM users WHERE email = ?",
                (rs, row) -> new ExistingUser(rs.getLong(1), rs.getString(2), rs.getString(3)), normalizedEmail);
        if (!existing.isEmpty()) {
            ExistingUser user = existing.getFirst();
            if ("INACTIVE".equals(user.status())) {
                otpService.issue(user.id(), normalizedEmail, "SIGNUP", user.name());
                return;
            }
            if ("PENDING_APPROVAL".equals(user.status())) {
                throw new IllegalArgumentException("An account with that email has already been registered and is pending HR approval.");
            }
            throw new IllegalArgumentException("An account with that email already exists.");
        }
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'EMPLOYEE', 'INACTIVE')",
                        java.sql.Statement.RETURN_GENERATED_KEYS);
                statement.setString(1, name.trim());
                statement.setString(2, normalizedEmail);
                statement.setString(3, passwordEncoder.encode(password));
                return statement;
            }, keyHolder);
            Number key = keyHolder.getKey();
            if (key == null) throw new IllegalStateException("Unable to create user.");
            long userId = key.longValue();
            otpService.issue(userId, normalizedEmail, "SIGNUP", name.trim());
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("An account with that email already exists.");
        }
    }

    @Transactional
    public void verifySignup(String email, String otp) {
        AuthUser user = findUser(normalizeEmail(email));
        if (!"INACTIVE".equals(user.status())) {
            if ("PENDING_APPROVAL".equals(user.status())) {
                throw new IllegalArgumentException("Account email is already verified and is pending HR approval.");
            }
            throw new IllegalArgumentException("Account is already verified.");
        }
        otpService.verify(user.id(), "SIGNUP", otp);
        jdbc.update("UPDATE users SET status = 'PENDING_APPROVAL', email_verified_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE user_id = ?", user.id());
    }

    @Transactional
    public void activateInvitation(String email, String otp, String password, String confirmPassword) {
        validatePassword(password);
        if (!password.equals(confirmPassword)) throw new IllegalArgumentException("Passwords do not match.");
        AuthUser user = findUser(normalizeEmail(email));
        if (!"EMPLOYEE".equals(user.role()) || !"INACTIVE".equals(user.status())) {
            throw new IllegalArgumentException("Invitation is invalid or has expired.");
        }
        otpService.verify(user.id(), "HR_INVITATION", otp);
        jdbc.update("UPDATE users SET password_hash = ?, status = 'ACTIVE', email_verified_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE user_id = ?",
                passwordEncoder.encode(password), user.id());
    }

    public AuthUser login(String email, String password, String loginType, String clientIp) {
        String normalizedEmail = normalizeEmail(email);
        String safeClientIp = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp;
        Long recentFailures = jdbc.queryForObject(
                "SELECT COUNT(*) FROM auth_login_attempts WHERE email = ? AND client_ip = ? AND succeeded = FALSE AND attempted_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE",
                Long.class, normalizedEmail, safeClientIp);
        if (recentFailures != null && recentFailures >= 10) {
            throw new IllegalArgumentException("Too many login attempts. Please try again later.");
        }
        AuthUser user;
        try {
            user = findUser(normalizedEmail);
        } catch (IllegalArgumentException exception) {
            jdbc.update("INSERT INTO auth_login_attempts (email, client_ip, succeeded) VALUES (?, ?, FALSE)",
                    normalizedEmail, safeClientIp);
            throw exception;
        }
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE user_id = ?", String.class, user.id());
        if (!passwordEncoder.matches(password, hash)) {
            jdbc.update("INSERT INTO auth_login_attempts (email, client_ip, succeeded) VALUES (?, ?, FALSE)",
                    normalizedEmail, safeClientIp);
            throw new IllegalArgumentException("Invalid email or password.");
        }
        if ("PENDING_APPROVAL".equals(user.status())) {
            throw new IllegalArgumentException("Your account is pending HR administrator approval.");
        }
        if ("REJECTED".equals(user.status())) {
            throw new IllegalArgumentException("Your registration request was rejected by HR.");
        }
        if (!"ACTIVE".equals(user.status())) {
            throw new IllegalArgumentException("Your account is not active. Please complete email verification or contact HR.");
        }
        validateLoginType(user, loginType);
        jdbc.update("INSERT INTO auth_login_attempts (email, client_ip, succeeded) VALUES (?, ?, TRUE)",
                normalizedEmail, safeClientIp);
        jdbc.update("DELETE FROM auth_login_attempts WHERE email = ? AND client_ip = ? AND succeeded = FALSE",
                normalizedEmail, safeClientIp);
        jdbc.update("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE user_id = ?", user.id());
        return user;
    }

    public AuthUser login(String email, String password, String clientIp) {
        return login(email, password, "EMPLOYEE", clientIp);
    }

    public AuthController.LoginResponse toLoginResponse(AuthUser user) {
        boolean manager = isApprovedManager(user.id());
        var roles = manager ? List.of(user.role(), "MANAGER") : List.of(user.role());
        var permissions = manager ? jdbc.queryForList(
                "SELECT permission_code FROM manager_permissions WHERE manager_user_id = ? AND revoked_at IS NULL ORDER BY permission_code",
                String.class, user.id()) : List.<String>of();
        return new AuthController.LoginResponse(user.id(), user.name(), user.email(), user.role(), roles, permissions);
    }

    private void validateLoginType(AuthUser user, String loginType) {
        String requested = loginType == null ? "" : loginType.trim().toUpperCase();
        boolean valid = switch (requested) {
            case "EMPLOYEE" -> "EMPLOYEE".equals(user.role());
            case "HR" -> "HR_ADMIN".equals(user.role());
            case "MANAGER" -> "EMPLOYEE".equals(user.role()) && isApprovedManager(user.id());
            default -> false;
        };
        if (!valid) throw new IllegalArgumentException("Invalid email or password.");
    }

    private boolean isApprovedManager(long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM manager_access_requests WHERE requesting_user_id = ? AND status = 'APPROVED'",
                Integer.class, userId);
        return count != null && count > 0;
    }

    @Transactional
    public void requestPasswordReset(String email) {
        var users = jdbc.query("SELECT user_id, name, status FROM users WHERE email = ?",
                (rs, row) -> new ExistingUser(rs.getLong(1), rs.getString(2), rs.getString(3)), normalizeEmail(email));
        if (!users.isEmpty() && "ACTIVE".equals(users.getFirst().status())) {
            otpService.issue(users.getFirst().id(), normalizeEmail(email), "PASSWORD_RESET", users.getFirst().name());
        }
    }

    @Transactional
    public void resetPassword(String email, String otp, String newPassword, String confirmPassword) {
        validatePassword(newPassword);
        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("Passwords do not match.");
        }
        AuthUser user = findUser(normalizeEmail(email));
        if (!"ACTIVE".equals(user.status())) throw new IllegalArgumentException("Account is not active.");
        otpService.verify(user.id(), "PASSWORD_RESET", otp);
        jdbc.update("UPDATE users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?",
                passwordEncoder.encode(newPassword), user.id());
        jdbc.update("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL",
                user.id());
    }

    @Transactional
    public String createSession(AuthUser user) {
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        jdbc.update("INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
                user.id(), hash(token), java.sql.Timestamp.from(Instant.now().plus(properties.sessionTtl())));
        return token;
    }

    @Transactional
    public void revokeSession(String token) {
        if (token != null && !token.isBlank()) {
            jdbc.update("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = ? AND revoked_at IS NULL",
                    hash(token));
        }
    }

    public boolean sessionCookieSecure() {
        return properties.sessionCookieSecure();
    }

    public Duration sessionTtl() {
        return properties.sessionTtl();
    }

    private AuthUser findUser(String email) {
        var users = jdbc.query("SELECT user_id, name, email, role, status FROM users WHERE email = ?",
                (rs, row) -> new AuthUser(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)),
                email);
        if (users.isEmpty()) throw new IllegalArgumentException("Invalid email or password.");
        return users.getFirst();
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Email is required.");
        return email.trim().toLowerCase();
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new IllegalArgumentException("Password must be between 8 and 128 characters.");
        }
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash session token", exception);
        }
    }

    private record ExistingUser(long id, String name, String status) {
    }
}
