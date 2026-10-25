package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.employeehr.auth.controller.AuthController;
import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.auth.service.AuthService;
import com.example.employeehr.auth.service.EmailService;
import com.example.employeehr.auth.service.OtpService;
import com.example.employeehr.config.AuthProperties;
import com.example.employeehr.hr.controller.HrManagementController;
import com.example.employeehr.hr.service.HrManagementService;
import com.example.employeehr.manager.service.ManagerAccessService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

class HrApprovalWorkflowTest {

    private JdbcTemplate jdbc;
    private PasswordEncoder passwordEncoder;
    private OtpService otpService;
    private EmailService emailService;
    private ManagerAccessService managerAccessService;
    private AuthProperties properties;
    private AuthService authService;
    private HrManagementService hrService;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        passwordEncoder = mock(PasswordEncoder.class);
        otpService = mock(OtpService.class);
        emailService = mock(EmailService.class);
        managerAccessService = mock(ManagerAccessService.class);
        properties = mock(AuthProperties.class);

        authService = new AuthService(jdbc, passwordEncoder, otpService, properties);
        hrService = new HrManagementService(jdbc, managerAccessService, otpService, emailService);
    }

    @Test
    void authControllerVerifySignupReturnsPendingMessage() {
        AuthService mockAuth = mock(AuthService.class);
        AuthController controller = new AuthController(mockAuth);
        var response = controller.verifySignup(new AuthController.OtpRequest("employee@example.com", "123456"));

        verify(mockAuth).verifySignup("employee@example.com", "123456");
        assertThat(response.message())
                .contains("pending HR administrator approval");
    }

    @Test
    void verifySignupUpdatesUserStatusToPendingApproval() {
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE email = ?"),
                any(RowMapper.class), eq("employee@example.com")))
                .thenReturn(List.of(new AuthUser(10L, "Employee One", "employee@example.com", "EMPLOYEE", "INACTIVE")));

        authService.verifySignup("employee@example.com", "123456");

        verify(otpService).verify(10L, "SIGNUP", "123456");
        verify(jdbc).update(contains("UPDATE users SET status = 'PENDING_APPROVAL'"), eq(10L));
    }

    @Test
    void loginRejectsPendingApprovalWithClearMessage() {
        when(jdbc.queryForObject(contains("COUNT(*) FROM auth_login_attempts"), eq(Long.class), anyString(), anyString()))
                .thenReturn(0L);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE email = ?"),
                any(RowMapper.class), eq("pending@example.com")))
                .thenReturn(List.of(new AuthUser(12L, "Pending User", "pending@example.com", "EMPLOYEE", "PENDING_APPROVAL")));
        when(jdbc.queryForObject(contains("SELECT password_hash FROM users WHERE user_id = ?"), eq(String.class), eq(12L)))
                .thenReturn("hashed-password");
        when(passwordEncoder.matches("ValidPassword123", "hashed-password")).thenReturn(true);

        assertThatThrownBy(() -> authService.login("pending@example.com", "ValidPassword123", "EMPLOYEE", "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Your account is pending HR administrator approval.");
    }

    @Test
    void loginRejectsRejectedAccountWithClearMessage() {
        when(jdbc.queryForObject(contains("COUNT(*) FROM auth_login_attempts"), eq(Long.class), anyString(), anyString()))
                .thenReturn(0L);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE email = ?"),
                any(RowMapper.class), eq("rejected@example.com")))
                .thenReturn(List.of(new AuthUser(15L, "Rejected User", "rejected@example.com", "EMPLOYEE", "REJECTED")));
        when(jdbc.queryForObject(contains("SELECT password_hash FROM users WHERE user_id = ?"), eq(String.class), eq(15L)))
                .thenReturn("hashed-password");
        when(passwordEncoder.matches("ValidPassword123", "hashed-password")).thenReturn(true);

        assertThatThrownBy(() -> authService.login("rejected@example.com", "ValidPassword123", "EMPLOYEE", "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Your registration request was rejected by HR.");
    }

    @Test
    void loginPreventsStatusEnumerationWithInvalidPassword() {
        when(jdbc.queryForObject(contains("COUNT(*) FROM auth_login_attempts"), eq(Long.class), anyString(), anyString()))
                .thenReturn(0L);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE email = ?"),
                any(RowMapper.class), eq("pending@example.com")))
                .thenReturn(List.of(new AuthUser(12L, "Pending User", "pending@example.com", "EMPLOYEE", "PENDING_APPROVAL")));
        when(jdbc.queryForObject(contains("SELECT password_hash FROM users WHERE user_id = ?"), eq(String.class), eq(12L)))
                .thenReturn("hashed-password");
        when(passwordEncoder.matches("WrongPassword", "hashed-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login("pending@example.com", "WrongPassword", "EMPLOYEE", "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or password.");
    }

    @Test
    void hrCanApproveEligiblePendingEmployeeRegistration() {
        long hrUserId = 1L;
        long targetUserId = 20L;

        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(hrUserId))).thenReturn(1);

        when(jdbc.query(contains("FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(targetUserId)))
                .thenReturn(List.of(new HrManagementService.UserView(targetUserId, "Alex Ray", "alex@example.com", "EMPLOYEE", "PENDING_APPROVAL", null)));

        when(jdbc.update(contains("UPDATE users SET status = 'ACTIVE'"), eq(hrUserId), eq(targetUserId)))
                .thenReturn(1);

        hrService.approveEmployee(targetUserId, hrUserId);

        verify(jdbc).update(contains("UPDATE users SET status = 'ACTIVE'"), eq(hrUserId), eq(targetUserId));
        verify(emailService).sendApprovalNotification("alex@example.com", "Alex Ray");
    }

    @Test
    void hrCanRejectPendingEmployeeRegistrationAndRevokeSessions() {
        long hrUserId = 1L;
        long targetUserId = 25L;

        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(hrUserId))).thenReturn(1);

        when(jdbc.query(contains("FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(targetUserId)))
                .thenReturn(List.of(new HrManagementService.UserView(targetUserId, "Chris Dane", "chris@example.com", "EMPLOYEE", "PENDING_APPROVAL", null)));

        when(jdbc.update(contains("UPDATE users SET status = 'REJECTED'"), eq(hrUserId), eq("Ineligible domain"), eq(targetUserId)))
                .thenReturn(1);

        hrService.rejectEmployee(targetUserId, hrUserId, "Ineligible domain");

        verify(jdbc).update(contains("UPDATE users SET status = 'REJECTED'"), eq(hrUserId), eq("Ineligible domain"), eq(targetUserId));
        verify(jdbc).update(contains("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()"), eq(targetUserId));
        verify(emailService).sendRejectionNotification("chris@example.com", "Chris Dane", "Ineligible domain");
    }

    @Test
    void rejectEmployeePreventsRejectingHRAdmin() {
        long hrUserId = 1L;
        long targetHrId = 2L;

        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(hrUserId))).thenReturn(1);
        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(targetHrId))).thenReturn(1);

        assertThatThrownBy(() -> hrService.rejectEmployee(targetHrId, hrUserId, "Cannot reject HR"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("HR administrator accounts cannot be rejected.");
    }

    @Test
    void deactivatePreventsRemovingLastActiveHR() {
        long hrUserId = 1L;

        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(hrUserId))).thenReturn(1);
        when(jdbc.queryForObject(contains("SELECT COUNT(*) FROM users WHERE role = 'HR_ADMIN' AND status = 'ACTIVE' AND user_id <> ?"),
                eq(Integer.class), eq(hrUserId))).thenReturn(0);

        assertThatThrownBy(() -> hrService.deactivate(hrUserId, hrUserId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("The last active HR account cannot be deactivated.");
    }

    @Test
    void hrManagementControllerEndpointsDelegateProperly() {
        HrManagementService mockHrService = mock(HrManagementService.class);
        HrManagementController controller = new HrManagementController(mockHrService);
        AuthUser hrUser = new AuthUser(1L, "HR Admin", "hr@example.com", "HR_ADMIN", "ACTIVE");
        var auth = new UsernamePasswordAuthenticationToken(hrUser, null, List.of());

        controller.approveRegistration(33L, auth);
        verify(mockHrService).approveEmployee(33L, 1L);

        controller.rejectRegistration(44L, new HrManagementController.Decision("Not eligible"), auth);
        verify(mockHrService).rejectEmployee(44L, 1L, "Not eligible");

        controller.registrations();
        verify(mockHrService).registrations();
    }
}
