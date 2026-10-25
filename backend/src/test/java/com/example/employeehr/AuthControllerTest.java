package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.employeehr.auth.controller.AuthController;
import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class AuthControllerTest {
    private final AuthService authService = org.mockito.Mockito.mock(AuthService.class);
    private final AuthController controller = new AuthController(authService);

    @Test
    void signupDelegatesWithoutRoleInput() {
        controller.signup(new AuthController.SignupRequest("Maya Chen", "maya@example.com", "StrongPass1"));

        verify(authService).signup("Maya Chen", "maya@example.com", "StrongPass1");
    }

    @Test
    void passwordResetPassesConfirmationPasswordToService() {
        controller.resetPassword(new AuthController.ResetPasswordRequest(
                "maya@example.com", "123456", "NewStrong1", "NewStrong1"));

        verify(authService).resetPassword("maya@example.com", "123456", "NewStrong1", "NewStrong1");
    }

    @Test
    void forgotPasswordReturnsGenericMessage() {
        AuthController.Message response = controller.forgotPassword(
                new AuthController.EmailRequest("maya@example.com"));

        verify(authService).requestPasswordReset("maya@example.com");
        assertThat(response.message())
                .isEqualTo("If the account exists, a password reset OTP has been sent.");
    }

    @Test
    void loginSetsHttpOnlySessionCookie() {
        AuthUser user = new AuthUser(7L, "Maya Chen", "maya@example.com", "EMPLOYEE", "ACTIVE");
        when(authService.login("maya@example.com", "StrongPass1", "127.0.0.1")).thenReturn(user);
        when(authService.createSession(user)).thenReturn("opaque-session-token");
        when(authService.sessionCookieSecure()).thenReturn(false);
        when(authService.sessionTtl()).thenReturn(java.time.Duration.ofHours(8));

        ResponseEntity<AuthController.LoginResponse> response = controller.login(
                new AuthController.LoginRequest("maya@example.com", "StrongPass1"),
                new org.springframework.mock.web.MockHttpServletRequest());

        assertThat(response.getHeaders().getFirst("Set-Cookie"))
                .contains("employee_hr_session=opaque-session-token")
                .contains("HttpOnly")
                .contains("SameSite=Lax");
        assertThat(response.getBody().role()).isEqualTo("EMPLOYEE");
    }

    @Test
    void logoutRevokesSessionAndClearsCookie() {
        when(authService.sessionCookieSecure()).thenReturn(false);

        ResponseEntity<AuthController.Message> response = controller.logout("opaque-session-token");

        verify(authService).revokeSession("opaque-session-token");
        assertThat(response.getHeaders().getFirst("Set-Cookie"))
                .contains("employee_hr_session=")
                .contains("Max-Age=0");
    }

    @Test
    void csrfReturnsProvidedToken() {
        org.springframework.security.web.csrf.CsrfToken token =
                new org.springframework.security.web.csrf.DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "test-token-value");
        org.springframework.security.web.csrf.CsrfToken result = controller.csrf(token);
        assertThat(result.getToken()).isEqualTo("test-token-value");
        assertThat(result.getHeaderName()).isEqualTo("X-XSRF-TOKEN");
    }
}
