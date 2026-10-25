package com.example.employeehr.auth.service;

import com.example.employeehr.config.AuthProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class OtpService {
    private final JdbcTemplate jdbc;
    private final AuthProperties properties;
    private final EmailService emailService;
    private final SecureRandom random = new SecureRandom();

    public OtpService(JdbcTemplate jdbc, AuthProperties properties, EmailService emailService) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.emailService = emailService;
    }

    public void issue(long userId, String email, String purpose, String userName) {
        var recent = jdbc.queryForObject(
                "SELECT COUNT(*) FROM auth_otp_requests WHERE user_id = ? AND purpose = ? AND requested_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR",
                Integer.class, userId, purpose);
        if (recent != null && recent >= properties.otpMaxRequestsPerHour()) {
            throw new IllegalArgumentException("Too many OTP requests. Please try again later.");
        }
        var last = jdbc.query(
                "SELECT requested_at FROM auth_otp_requests WHERE user_id = ? AND purpose = ? ORDER BY requested_at DESC LIMIT 1",
                (rs, row) -> rs.getTimestamp(1).toInstant(), userId, purpose);
        if (!last.isEmpty() && last.getFirst().plusSeconds(properties.otpResendSeconds()).isAfter(Instant.now())) {
            throw new IllegalArgumentException("Please wait before requesting another OTP.");
        }

        String otp = String.format("%06d", random.nextInt(1_000_000));
        jdbc.update("UPDATE auth_otps SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
                userId, purpose);
        jdbc.update("INSERT INTO auth_otp_requests (user_id, purpose) VALUES (?, ?)", userId, purpose);
        jdbc.update("INSERT INTO auth_otps (user_id, purpose, otp_hash, expires_at) VALUES (?, ?, ?, ?)",
                userId, purpose, hash(otp), Timestamp.from(Instant.now().plus(properties.otpTtl())));
        emailService.sendOtp(email, userName, purpose, otp);
    }

    public void issue(long userId, String email, String purpose) {
        String userName = null;
        try {
            userName = jdbc.queryForObject("SELECT name FROM users WHERE user_id = ?", String.class, userId);
        } catch (Exception ignored) {
        }
        issue(userId, email, purpose, userName);
    }

    public void verify(long userId, String purpose, String otp) {
        var rows = jdbc.query(
                "SELECT otp_id, otp_hash, expires_at, attempts FROM auth_otps WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
                (rs, row) -> new OtpRow(rs.getLong(1), rs.getString(2), rs.getTimestamp(3).toInstant(), rs.getInt(4)),
                userId, purpose);
        if (rows.isEmpty()) throw new IllegalArgumentException("Invalid or expired OTP.");
        OtpRow row = rows.getFirst();
        if (row.expiresAt().isBefore(Instant.now())) throw new IllegalArgumentException("OTP has expired.");
        if (row.attempts() >= properties.otpMaxAttempts()) throw new IllegalArgumentException("Too many invalid OTP attempts.");
        if (!MessageDigest.isEqual(row.hash().getBytes(StandardCharsets.UTF_8), hash(otp).getBytes(StandardCharsets.UTF_8))) {
            jdbc.update("UPDATE auth_otps SET attempts = attempts + 1 WHERE otp_id = ?", row.id());
            throw new IllegalArgumentException("Invalid OTP.");
        }
        jdbc.update("UPDATE auth_otps SET used_at = UTC_TIMESTAMP() WHERE otp_id = ?", row.id());
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash OTP", exception);
        }
    }

    private record OtpRow(long id, String hash, Instant expiresAt, int attempts) {
    }
}
