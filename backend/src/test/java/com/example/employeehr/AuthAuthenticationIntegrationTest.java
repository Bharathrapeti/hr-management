package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.employeehr.auth.service.AuthService;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import jakarta.servlet.http.Cookie;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Tag("integration")
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@Import(AuthAuthenticationIntegrationTest.ProtectedController.class)
class AuthAuthenticationIntegrationTest {
    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("employee_hr_db")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.mail.host", () -> "localhost");
        registry.add("app.auth.mail-from", () -> "no-reply@example.test");
        registry.add("app.auth.otp-ttl", () -> "PT10M");
        registry.add("app.auth.otp-max-attempts", () -> "5");
        registry.add("app.auth.otp-resend-seconds", () -> "60");
        registry.add("app.auth.otp-max-requests-per-hour", () -> "5");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService authService;
    @MockBean JavaMailSender mailSender;

    private SimpleMailMessage lastMail;

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM auth_login_attempts");
        jdbc.update("DELETE FROM auth_sessions");
        jdbc.update("DELETE FROM auth_otp_requests");
        jdbc.update("DELETE FROM auth_otps");
        jdbc.update("DELETE FROM users");
        org.mockito.Mockito.doAnswer(invocation -> {
            lastMail = invocation.getArgument(0);
            return null;
        }).when(mailSender).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void signupVerificationAndLoginWork() throws Exception {
        mvc.perform(post("/api/auth/signup")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Maya Chen","email":"maya@example.com","password":"StrongPass1"}
                                """))
                .andExpect(status().isOk());
        verify("maya@example.com", otpFromMail());
        mvc.perform(post("/api/auth/login")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"maya@example.com","password":"StrongPass1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getCookie("employee_hr_session")).isNotNull());
    }

    @Test
    void incorrectExpiredAndReusedOtpAreRejectedAndAttemptsAreLimited() {
        signup("otp@example.com");
        for (int attempt = 0; attempt < 5; attempt++) {
            assertThatThrownBy(() -> verify("otp@example.com", "000000")).hasMessage("Invalid OTP.");
        }
        assertThatThrownBy(() -> verify("otp@example.com", "000000"))
                .hasMessage("Too many invalid OTP attempts.");
        jdbc.update("UPDATE auth_otps SET attempts = 0 WHERE user_id = (SELECT user_id FROM users WHERE email = ?)", "otp@example.com");
        verify("otp@example.com", otpFromMail());
        assertThatThrownBy(() -> verify("otp@example.com", otpFromMail()))
                .hasMessage("Account is already verified.");

        signup("expired@example.com");
        jdbc.update("UPDATE auth_otps SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE user_id = (SELECT user_id FROM users WHERE email = ?)", "expired@example.com");
        assertThatThrownBy(() -> verify("expired@example.com", otpFromMail()))
                .hasMessage("OTP has expired.");
    }

    @Test
    void resendThrottlingAndLoginRejectionWork() {
        signup("login@example.com");
        assertThatThrownBy(() -> signup("login@example.com"))
                .hasMessage("Please wait before requesting another OTP.");
        assertThatThrownBy(() -> authService.login("login@example.com", "StrongPass1", "127.0.0.1"))
                .hasMessage("Invalid email or password.");
        assertThatThrownBy(() -> authService.login("missing@example.com", "wrong", "127.0.0.1"))
                .hasMessage("Invalid email or password.");
    }

    @Test
    void passwordResetRevokesExistingSessions() {
        signup("reset@example.com");
        verify("reset@example.com", otpFromMail());
        String token = login("reset@example.com", "StrongPass1");
        authService.requestPasswordReset("reset@example.com");
        authService.resetPassword("reset@example.com", otpFromMail(), "NewStrong1", "NewStrong1");
        assertThat(jdbc.queryForObject(
                "SELECT revoked_at IS NOT NULL FROM auth_sessions WHERE token_hash = SHA2(?, 256)",
                Boolean.class, token)).isTrue();
    }

    @Test
    void forgotPasswordDoesNotRevealWhetherAnAccountExists() throws Exception {
        signup("known@example.com");
        verify("known@example.com", otpFromMail());
        String known = mvc.perform(post("/api/auth/password/forgot")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"known@example.com\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String unknown = mvc.perform(post("/api/auth/password/forgot")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unknown@example.com\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(known).isEqualTo(unknown);
    }

    @Test
    void logoutRevokesSessionAndClearsCookie() throws Exception {
        signup("logout@example.com");
        verify("logout@example.com", otpFromMail());
        String token = login("logout@example.com", "StrongPass1");
        var response = mvc.perform(post("/api/auth/logout")
                        .with(SecurityMockMvcRequestPostProcessors.csrf())
                        .cookie(new Cookie("employee_hr_session", token)))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        assertThat(response.getCookie("employee_hr_session").getMaxAge()).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT revoked_at IS NOT NULL FROM auth_sessions WHERE token_hash = SHA2(?, 256)",
                Boolean.class, token)).isTrue();
    }

    @Test
    void publicSignupAlwaysCreatesEmployeeRole() {
        signup("employee-role@example.com");
        assertThat(jdbc.queryForObject(
                "SELECT role FROM users WHERE email = ?", String.class, "employee-role@example.com"))
                .isEqualTo("EMPLOYEE");
    }

    @Test
    void csrfAndProtectedRoutesAreEnforced() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"x@example.com","password":"StrongPass1"}
                                """))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/protected")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk());
    }

    private void signup(String email) {
        authService.signup("Test User", email, "StrongPass1");
    }

    private void verify(String email, String otp) {
        authService.verifySignup(email, otp);
    }

    private String login(String email, String password) {
        var user = authService.login(email, password, "127.0.0.1");
        return authService.createSession(user);
    }

    private String otpFromMail() {
        return Pattern.compile("\\b\\d{6}\\b").matcher(lastMail.getText()).results()
                .map(match -> match.group()).findFirst().orElseThrow();
    }

    @org.springframework.web.bind.annotation.RestController
    static class ProtectedController {
        @org.springframework.web.bind.annotation.GetMapping("/api/protected")
        String protectedRoute() {
            return "ok";
        }
    }
}
