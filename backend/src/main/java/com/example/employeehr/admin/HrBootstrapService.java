package com.example.employeehr.admin;

import com.example.employeehr.config.AuthProperties;
import java.util.Locale;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class HrBootstrapService implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final AuthProperties properties;

    public HrBootstrapService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, AuthProperties properties) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.bootstrapHrEnabled()) return;
        String name = required(properties.bootstrapHrName(), "AUTH_BOOTSTRAP_HR_NAME");
        String email = required(properties.bootstrapHrEmail(), "AUTH_BOOTSTRAP_HR_EMAIL").trim().toLowerCase(Locale.ROOT);
        String password = required(properties.bootstrapHrPassword(), "AUTH_BOOTSTRAP_HR_PASSWORD");
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalStateException("Bootstrap HR email is invalid.");
        if (password.length() < 8 || password.length() > 128) throw new IllegalStateException("Bootstrap HR password is invalid.");

        var existing = jdbc.query("SELECT role, status FROM users WHERE email = ?",
                (rs, row) -> new Existing(rs.getString(1), rs.getString(2)), email);
        if (!existing.isEmpty()) {
            Existing account = existing.getFirst();
            if ("HR_ADMIN".equals(account.role()) && "ACTIVE".equals(account.status())) return;
            throw new IllegalStateException("Bootstrap HR email conflicts with an existing account.");
        }
        try {
            jdbc.update("INSERT INTO users (name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, 'HR_ADMIN', 'ACTIVE', UTC_TIMESTAMP())",
                    name.trim(), email, passwordEncoder.encode(password));
        } catch (DuplicateKeyException exception) {
            throw new IllegalStateException("Bootstrap HR account could not be created safely.", exception);
        }
    }

    private String required(String value, String setting) {
        if (value == null || value.isBlank()) throw new IllegalStateException(setting + " is required when HR bootstrap is enabled.");
        return value;
    }

    private record Existing(String role, String status) {}
}
