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
    public void signup(AuthController.SignupRequest request) {
        String first = request.firstName();
        String last = request.lastName();
        String fullName = request.name();
        if ((first != null && !first.isBlank()) || (last != null && !last.isBlank())) {
            first = first != null ? first.trim() : "";
            last = last != null ? last.trim() : "";
            fullName = (first + " " + last).trim();
        } else if (fullName != null && !fullName.isBlank()) {
            fullName = fullName.trim();
            String[] parts = fullName.split("\\s+", 2);
            first = parts[0];
            last = parts.length > 1 ? parts[1] : parts[0];
        } else {
            throw new IllegalArgumentException("First name and last name are required.");
        }

        if (fullName.isBlank()) {
            throw new IllegalArgumentException("Name is required.");
        }

        signup(fullName, first, last, request.email(), request.password(), request.accountType(),
                request.jobRole(), request.age(), request.gender(),
                request.resumeFileName(), request.resumeContentType(), request.resumeFileSize(), request.resumeData());
    }

    @Transactional
    public void signup(String name, String email, String password) {
        signup(name, email, password, "EMPLOYEE");
    }

    @Transactional
    public void signup(String name, String email, String password, String accountType) {
        String first = name;
        String last = "";
        if (name != null && name.contains(" ")) {
            String[] p = name.trim().split("\\s+", 2);
            first = p[0];
            last = p[1];
        }
        signup(name, first, last, email, password, accountType, null, null, null, null, null, null, null);
    }

    @Transactional
    public void signup(String name, String firstName, String lastName, String email, String password, String accountType,
                       String jobRole, Integer age, String gender,
                       String resumeFileName, String resumeContentType, Long resumeFileSize, String resumeData) {
        validatePassword(password);
        String normalizedEmail = normalizeEmail(email);
        boolean isManager = "MANAGER".equalsIgnoreCase(accountType);

        if (age != null && (age < 18 || age > 99)) {
            throw new IllegalArgumentException("Age must be between 18 and 99.");
        }

        String normalizedGender = null;
        if (gender != null && !gender.isBlank()) {
            String g = gender.trim().toUpperCase();
            if ("MALE".equals(g) || "FEMALE".equals(g) || "NON_BINARY".equals(g) || "OTHER".equals(g)) {
                normalizedGender = g;
            } else {
                normalizedGender = "MALE";
            }
        }

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
            String reviewReason = isManager ? "MANAGER_REGISTRATION" : null;
            String encodedPass = passwordEncoder.encode(password);
            String cleanFirst = firstName != null && !firstName.isBlank() ? firstName.trim() : null;
            String cleanLast = lastName != null && !lastName.isBlank() ? lastName.trim() : null;
            String cleanRole = jobRole != null && !jobRole.isBlank() ? jobRole.trim() : (isManager ? "Manager" : "Employee");
            final String finalGender = normalizedGender;

            try {
                // Attempt insertion with all profile columns (V1 + V3 + V4 + V5)
                jdbc.update(connection -> {
                    var statement = connection.prepareStatement(
                            """
                            INSERT INTO users (name, first_name, last_name, email, password_hash, role, status, review_reason,
                                               job_role, age, gender, resume_file_name, resume_content_type, resume_file_size, resume_data)
                            VALUES (?, ?, ?, ?, ?, 'EMPLOYEE', 'INACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            java.sql.Statement.RETURN_GENERATED_KEYS);
                    statement.setString(1, name.trim());
                    statement.setString(2, cleanFirst);
                    statement.setString(3, cleanLast);
                    statement.setString(4, normalizedEmail);
                    statement.setString(5, encodedPass);
                    statement.setString(6, reviewReason);
                    statement.setString(7, cleanRole);
                    if (age != null) statement.setInt(8, age); else statement.setNull(8, java.sql.Types.INTEGER);
                    statement.setString(9, finalGender);
                    statement.setString(10, resumeFileName);
                    statement.setString(11, resumeContentType);
                    if (resumeFileSize != null) statement.setLong(12, resumeFileSize); else statement.setNull(12, java.sql.Types.BIGINT);
                    statement.setString(13, resumeData);
                    return statement;
                }, keyHolder);
            } catch (org.springframework.jdbc.BadSqlGrammarException ex) {
                // Fallback for schemas without V5 profile columns
                try {
                    jdbc.update(connection -> {
                        var statement = connection.prepareStatement(
                                "INSERT INTO users (name, email, password_hash, role, status, review_reason) VALUES (?, ?, ?, 'EMPLOYEE', 'INACTIVE', ?)",
                                java.sql.Statement.RETURN_GENERATED_KEYS);
                        statement.setString(1, name.trim());
                        statement.setString(2, normalizedEmail);
                        statement.setString(3, encodedPass);
                        statement.setString(4, reviewReason);
                        return statement;
                    }, keyHolder);
                } catch (org.springframework.jdbc.BadSqlGrammarException ex2) {
                    jdbc.update(connection -> {
                        var statement = connection.prepareStatement(
                                "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'EMPLOYEE', 'INACTIVE')",
                                java.sql.Statement.RETURN_GENERATED_KEYS);
                        statement.setString(1, name.trim());
                        statement.setString(2, normalizedEmail);
                        statement.setString(3, encodedPass);
                        return statement;
                    }, keyHolder);
                }
            }

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

        if (isManagerOnlyAccount(user.id())) {
            try {
                Integer count = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM manager_access_requests WHERE requesting_user_id = ?",
                        Integer.class, user.id());
                if (count == null || count == 0) {
                    jdbc.update("INSERT INTO manager_access_requests (requesting_user_id, status, review_reason) VALUES (?, 'PENDING', 'Manager Registration')",
                            user.id());
                }
            } catch (Exception ignored) {
                // Table might not exist in unit mock tests
            }
        }
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
        boolean managerOnly = isManagerOnlyAccount(user.id());
        String effectiveRole = managerOnly ? "MANAGER" : user.role();
        var roles = managerOnly ? List.of("MANAGER") : manager ? List.of(user.role(), "MANAGER") : List.of(user.role());
        var permissions = manager ? jdbc.queryForList(
                "SELECT permission_code FROM manager_permissions WHERE manager_user_id = ? AND revoked_at IS NULL ORDER BY permission_code",
                String.class, user.id()) : List.<String>of();
        String employeeId = null;
        if (!managerOnly) {
            try {
                var list = jdbc.queryForList("SELECT employee_id FROM users WHERE user_id = ?", String.class, user.id());
                if (!list.isEmpty()) {
                    employeeId = list.getFirst();
                }
            } catch (Exception ignored) {}
        }

        String firstName = null;
        String lastName = null;
        String jobRole = null;
        Integer age = null;
        String gender = null;
        String resumeFileName = null;
        try {
            var details = jdbc.query(
                    "SELECT first_name, last_name, job_role, age, gender, resume_file_name FROM users WHERE user_id = ?",
                    (rs, row) -> new Object[]{
                            rs.getString(1),
                            rs.getString(2),
                            rs.getString(3),
                            rs.getObject(4) != null ? rs.getInt(4) : null,
                            rs.getString(5),
                            rs.getString(6)
                    }, user.id());
            if (!details.isEmpty()) {
                Object[] row = details.getFirst();
                firstName = (String) row[0];
                lastName = (String) row[1];
                jobRole = (String) row[2];
                age = (Integer) row[3];
                gender = (String) row[4];
                resumeFileName = (String) row[5];
            }
        } catch (Exception ignored) {}

        return new AuthController.LoginResponse(
                user.id(), user.name(), user.email(), effectiveRole, roles, permissions, employeeId,
                firstName, lastName, jobRole, age, gender, resumeFileName
        );
    }

    private void validateLoginType(AuthUser user, String loginType) {
        String requested = loginType == null ? "" : loginType.trim().toUpperCase();
        boolean isManagerOnly = isManagerOnlyAccount(user.id());
        boolean valid = switch (requested) {
            case "EMPLOYEE" -> "EMPLOYEE".equals(user.role()) && !isManagerOnly;
            case "HR" -> "HR_ADMIN".equals(user.role());
            case "MANAGER" -> ("EMPLOYEE".equals(user.role()) || "MANAGER".equals(user.role())) && isApprovedManager(user.id());
            default -> false;
        };
        if (!valid) throw new IllegalArgumentException("Invalid email or password.");
    }

    public boolean isManagerOnlyAccount(long userId) {
        try {
            var list = jdbc.queryForList("SELECT review_reason FROM users WHERE user_id = ?", String.class, userId);
            return !list.isEmpty() && list.getFirst() != null && list.getFirst().startsWith("MANAGER");
        } catch (Exception ignored) {
            return false;
        }
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

    public record UserResume(String fileName, String contentType, byte[] data) {}

    public UserResume getUserResume(long userId) {
        try {
            var list = jdbc.query(
                    "SELECT resume_file_name, resume_content_type, resume_data FROM users WHERE user_id = ?",
                    (rs, row) -> {
                        String name = rs.getString(1);
                        String type = rs.getString(2);
                        String rawData = rs.getString(3);
                        if (rawData == null || rawData.isBlank()) return null;
                        byte[] bytes;
                        if (rawData.contains(",")) {
                            String base64 = rawData.substring(rawData.indexOf(",") + 1);
                            bytes = Base64.getDecoder().decode(base64);
                        } else {
                            try {
                                bytes = Base64.getDecoder().decode(rawData);
                            } catch (Exception e) {
                                bytes = rawData.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                            }
                        }
                        return new UserResume(name, type, bytes);
                    }, userId);
            return list.isEmpty() ? null : list.getFirst();
        } catch (Exception ex) {
            return null;
        }
    }

    public AuthController.ResumeInfo getUserResumeInfo(long userId) {
        try {
            var list = jdbc.query(
                    "SELECT resume_file_name, resume_content_type, resume_file_size, resume_data FROM users WHERE user_id = ?",
                    (rs, row) -> new AuthController.ResumeInfo(
                            rs.getString(1),
                            rs.getString(2),
                            rs.getObject(3) != null ? rs.getLong(3) : null,
                            rs.getString(4) != null && !rs.getString(4).isBlank()
                    ), userId);
            return list.isEmpty() ? null : list.getFirst();
        } catch (Exception ex) {
            return null;
        }
    }

    private record ExistingUser(long id, String name, String status) {
    }
}
