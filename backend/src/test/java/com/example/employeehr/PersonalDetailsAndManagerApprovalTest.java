package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.employeehr.auth.service.EmailService;
import com.example.employeehr.auth.service.OtpService;
import com.example.employeehr.hr.service.HrManagementService;
import com.example.employeehr.manager.service.ManagerAccessService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.access.AccessDeniedException;

class PersonalDetailsAndManagerApprovalTest {

    private JdbcTemplate jdbc;
    private ManagerAccessService managerAccessService;
    private OtpService otpService;
    private EmailService emailService;
    private HrManagementService hrService;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        emailService = mock(EmailService.class);
        otpService = mock(OtpService.class);
        managerAccessService = new ManagerAccessService(jdbc, emailService);
        hrService = new HrManagementService(jdbc, managerAccessService, otpService, emailService);
    }

    private void mockHrUser(long actorId, boolean isHr) {
        when(jdbc.queryForObject(contains("COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'"),
                eq(Integer.class), eq(actorId)))
                .thenReturn(isHr ? 1 : 0);
    }

    @Test
    void getPersonalDetailsCalculatesAgeCorrectly() {
        LocalDate dob = LocalDate.now().minusYears(28).minusMonths(2);
        java.sql.Date sqlDob = java.sql.Date.valueOf(dob);

        when(jdbc.query(contains("SELECT user_id, employee_id, name, email, gender, date_of_birth, residential_address, mobile_number, role, status FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(10L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(10L);
                    when(rs.getString(2)).thenReturn("EMP-1042");
                    when(rs.getString(3)).thenReturn("Maya Chen");
                    when(rs.getString(4)).thenReturn("maya@example.com");
                    when(rs.getString(5)).thenReturn("FEMALE");
                    when(rs.getDate(6)).thenReturn(sqlDob);
                    when(rs.getString(7)).thenReturn("123 Orchard Road, London");
                    when(rs.getString(8)).thenReturn("+44 20 7946 0991");
                    when(rs.getString(9)).thenReturn("EMPLOYEE");
                    when(rs.getString(10)).thenReturn("ACTIVE");
                    return List.of(mapper.mapRow(rs, 1));
                });

        HrManagementService.PersonalDetailsView details = hrService.getPersonalDetails(10L);
        assertThat(details.name()).isEqualTo("Maya Chen");
        assertThat(details.gender()).isEqualTo("FEMALE");
        assertThat(details.dateOfBirth()).isEqualTo(dob);
        assertThat(details.age()).isEqualTo(28);
        assertThat(details.residentialAddress()).isEqualTo("123 Orchard Road, London");
        assertThat(details.mobileNumber()).isEqualTo("+44 20 7946 0991");
    }

    @Test
    void updatePersonalDetailsByHrSucceeds() {
        mockHrUser(1L, true);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(10L)))
                .thenReturn(List.of(new HrManagementService.UserView(10L, "Maya Chen", "maya@example.com", "EMPLOYEE", "ACTIVE", "EMP-1042")));

        LocalDate dob = LocalDate.of(1996, 5, 15);
        hrService.updatePersonalDetails(10L, "Maya Chen Updated", "FEMALE", dob, "456 High Street", "+44 7700 900123", 1L);

        verify(jdbc).update(contains("UPDATE users SET name = ?, gender = ?, date_of_birth = ?, residential_address = ?, mobile_number = ?"),
                eq("Maya Chen Updated"), eq("FEMALE"), eq(java.sql.Date.valueOf(dob)), eq("456 High Street"), eq("+44 7700 900123"), eq(10L));
    }

    @Test
    void updatePersonalDetailsRejectsFutureDateOfBirth() {
        mockHrUser(1L, true);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(10L)))
                .thenReturn(List.of(new HrManagementService.UserView(10L, "Maya Chen", "maya@example.com", "EMPLOYEE", "ACTIVE", "EMP-1042")));

        LocalDate futureDob = LocalDate.now().plusDays(1);
        assertThatThrownBy(() -> hrService.updatePersonalDetails(10L, "Maya Chen", "FEMALE", futureDob, "Address", "+123456789", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Date of birth must be in the past.");
    }

    @Test
    void updatePersonalDetailsRejectsInvalidMobileNumber() {
        mockHrUser(1L, true);
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(10L)))
                .thenReturn(List.of(new HrManagementService.UserView(10L, "Maya Chen", "maya@example.com", "EMPLOYEE", "ACTIVE", "EMP-1042")));

        assertThatThrownBy(() -> hrService.updatePersonalDetails(10L, "Maya Chen", "FEMALE", LocalDate.of(1990, 1, 1), "Address", "invalid-phone!", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Mobile number format is invalid.");
    }

    @Test
    void updatePersonalDetailsFailsForNonHr() {
        mockHrUser(5L, false);
        assertThatThrownBy(() -> hrService.updatePersonalDetails(10L, "Name", "MALE", LocalDate.of(1990, 1, 1), "Address", "+123456789", 5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void assignRegistrationManagerValidatesManagerEligibility() {
        mockHrUser(1L, true);
        // Target employee
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(20L)))
                .thenReturn(List.of(new HrManagementService.UserView(20L, "Pending Emp", "pending@example.com", "EMPLOYEE", "PENDING_APPROVAL", null)));
        // Ineligible manager (not active or not approved)
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(30L)))
                .thenReturn(List.of(new HrManagementService.UserView(30L, "Inactive Mgr", "mgr@example.com", "EMPLOYEE", "INACTIVE", null)));

        assertThatThrownBy(() -> hrService.assignRegistrationManager(20L, 30L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Assigned manager must be an active employee.");
    }

    @Test
    void assignRegistrationManagerSucceedsAndDispatchesNotification() {
        mockHrUser(1L, true);
        // Target employee
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(20L)))
                .thenReturn(List.of(new HrManagementService.UserView(20L, "Pending Emp", "pending@example.com", "EMPLOYEE", "PENDING_APPROVAL", null)));
        // Active manager
        when(jdbc.query(contains("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(30L)))
                .thenReturn(List.of(new HrManagementService.UserView(30L, "Active Mgr", "mgr@example.com", "EMPLOYEE", "ACTIVE", "EMP-30")));
        // Approved manager access check
        when(jdbc.queryForObject(contains("COUNT(*) FROM manager_access_requests r JOIN users u"), eq(Integer.class), eq(30L)))
                .thenReturn(1);

        when(jdbc.update(contains("UPDATE users SET assigned_manager_user_id = ?"), eq(30L), eq(20L)))
                .thenReturn(1);

        hrService.assignRegistrationManager(20L, 30L, 1L);

        verify(jdbc).update(contains("UPDATE users SET assigned_manager_user_id = ?"), eq(30L), eq(20L));
        verify(emailService).sendManagerAssignmentNotification("mgr@example.com", "Active Mgr", "Pending Emp", "pending@example.com");
    }

    @Test
    void managerApproveRegistrationActivatesAccountAndCreatesAssignment() {
        // Manager 30 is approved
        when(jdbc.queryForObject(contains("COUNT(*) FROM manager_access_requests r JOIN users u"), eq(Integer.class), eq(30L)))
                .thenReturn(1);

        // Target employee assigned to manager 30
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE user_id = ? AND assigned_manager_user_id = ?"),
                any(RowMapper.class), eq(20L), eq(30L)))
                .thenReturn(List.of(new ManagerAccessService.EmployeeView(20L, "Pending Emp", "pending@example.com", null, "PENDING_APPROVAL")));

        when(jdbc.update(contains("UPDATE users SET status = 'ACTIVE', reviewed_by_hr_user_id = ?"), eq(30L), eq(20L), eq(30L)))
                .thenReturn(1);

        managerAccessService.approveRegistration(30L, 20L);

        verify(jdbc).update(contains("UPDATE users SET status = 'ACTIVE'"), eq(30L), eq(20L), eq(30L));
        verify(jdbc).update(contains("INSERT INTO manager_employee_assignments"), eq(30L), eq(20L), eq(30L));
        verify(emailService).sendApprovalNotification("pending@example.com", "Pending Emp");
    }

    @Test
    void managerCannotApproveRegistrationAssignedToDifferentManager() {
        // Manager 30 is approved
        when(jdbc.queryForObject(contains("COUNT(*) FROM manager_access_requests r JOIN users u"), eq(Integer.class), eq(30L)))
                .thenReturn(1);

        // Target employee not assigned to manager 30
        when(jdbc.query(contains("SELECT user_id, name, email, role, status FROM users WHERE user_id = ? AND assigned_manager_user_id = ?"),
                any(RowMapper.class), eq(20L), eq(30L)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> managerAccessService.approveRegistration(30L, 20L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Registration not found or not assigned to this manager.");
    }

    @Test
    void submitAndResolveCorrectionRequestFlow() {
        mockHrUser(1L, true);

        hrService.submitCorrectionRequest(10L, "Please update residential address to 789 Park Lane");
        verify(jdbc).update(contains("INSERT INTO employee_correction_requests"), eq(10L), eq("Please update residential address to 789 Park Lane"));

        when(jdbc.update(contains("UPDATE employee_correction_requests SET status = 'RESOLVED'"), eq(1L), eq("Updated in HR records."), eq(101L)))
                .thenReturn(1);

        hrService.resolveCorrectionRequest(101L, "Updated in HR records.", 1L);
        verify(jdbc).update(contains("UPDATE employee_correction_requests SET status = 'RESOLVED'"), eq(1L), eq("Updated in HR records."), eq(101L));
    }

    @Test
    void listEligibleManagers() {
        when(jdbc.query(contains("SELECT DISTINCT u.user_id, u.name, u.email, u.role, u.status, u.employee_id"), any(RowMapper.class)))
                .thenReturn(List.of(new HrManagementService.UserView(30L, "Manager Jane", "jane@northstar.edu", "EMPLOYEE", "ACTIVE", "EMP-30")));

        var eligible = hrService.eligibleManagers();
        assertThat(eligible).hasSize(1);
        assertThat(eligible.get(0).name()).isEqualTo("Manager Jane");
    }
}
