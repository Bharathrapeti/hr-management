package com.example.employeehr.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        Duration sessionTtl,
        Duration otpTtl,
        int otpMaxAttempts,
        int otpResendSeconds,
        int otpMaxRequestsPerHour,
        String mailFrom,
        boolean sessionCookieSecure,
        boolean bootstrapHrEnabled,
        String bootstrapHrName,
        String bootstrapHrEmail,
        String bootstrapHrPassword) {
}
