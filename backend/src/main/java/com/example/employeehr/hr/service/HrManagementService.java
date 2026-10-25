package com.example.employeehr.hr.service;

import com.example.employeehr.auth.service.EmailService;
import com.example.employeehr.auth.service.OtpService;
import com.example.employeehr.manager.service.ManagerAccessService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HrManagementService {
    private final JdbcTemplate jdbc;
    private final ManagerAccessService managerAccessService;
    private final OtpService otpService;
    private final EmailService emailService;

    public HrManagementService(JdbcTemplate jdbc, ManagerAccessService managerAccessService,
            OtpService otpService, EmailService emailService) {
        this.jdbc = jdbc;
        this.managerAccessService = managerAccessService;
        this.otpService = otpService;
        this.emailService = emailService;
    }

    public List<UserView> users() {
        return jdbc.query("SELECT user_id, name, email, role, status, employee_id FROM users ORDER BY name",
                (rs, row) -> new UserView(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6)));
    }

    public List<UserView> eligibleManagers() {
        return jdbc.query("""
                SELECT DISTINCT u.user_id, u.name, u.email, u.role, u.status, u.employee_id
                FROM users u
                JOIN manager_access_requests r ON r.requesting_user_id = u.user_id
                WHERE u.role = 'EMPLOYEE' AND u.status = 'ACTIVE' AND r.status = 'APPROVED'
                ORDER BY u.name
                """, (rs, row) -> new UserView(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6)));
    }

    public UserView user(long userId) {
        var users = jdbc.query("SELECT user_id, name, email, role, status, employee_id FROM users WHERE user_id = ?",
                (rs, row) -> new UserView(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6)), userId);
        if (users.isEmpty()) throw new IllegalArgumentException("User not found.");
        return users.getFirst();
    }

    public List<String> permissions(long managerId) {
        return managerAccessService.permissions(managerId);
    }

    public PersonalDetailsView getPersonalDetails(long userId) {
        var list = jdbc.query(
                "SELECT user_id, employee_id, name, email, gender, date_of_birth, residential_address, mobile_number, role, status FROM users WHERE user_id = ?",
                (rs, row) -> {
                    java.sql.Date dob = rs.getDate(6);
                    LocalDate localDob = dob != null ? dob.toLocalDate() : null;
                    Integer age = localDob != null ? Period.between(localDob, LocalDate.now()).getYears() : null;
                    return new PersonalDetailsView(
                            rs.getLong(1),
                            rs.getString(2),
                            rs.getString(3),
                            rs.getString(4),
                            rs.getString(5),
                            localDob,
                            age,
                            rs.getString(7),
                            rs.getString(8),
                            rs.getString(9),
                            rs.getString(10)
                    );
                }, userId);
        if (list.isEmpty()) throw new IllegalArgumentException("User not found.");
        return list.getFirst();
    }

    @Transactional
    public void updatePersonalDetails(long targetUserId, String name, String gender, LocalDate dateOfBirth, String residentialAddress, String mobileNumber, long actorId) {
        ensureHr(actorId);
        user(targetUserId); // Verify user exists
        if (name == null || name.isBlank() || name.length() > 160) {
            throw new IllegalArgumentException("Name is invalid.");
        }
        if (dateOfBirth != null && (dateOfBirth.isEqual(LocalDate.now()) || dateOfBirth.isAfter(LocalDate.now()))) {
            throw new IllegalArgumentException("Date of birth must be in the past.");
        }
        if (residentialAddress != null && residentialAddress.length() > 500) {
            throw new IllegalArgumentException("Residential address must be 500 characters or fewer.");
        }
        if (mobileNumber != null && !mobileNumber.isBlank()) {
            if (!mobileNumber.matches("^[+0-9\\s\\-\\(\\)]{7,32}$")) {
                throw new IllegalArgumentException("Mobile number format is invalid.");
            }
        }
        String cleanGender = (gender != null && !gender.isBlank()) ? gender.trim().toUpperCase() : null;
        if (cleanGender != null && !List.of("MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY", "OTHER").contains(cleanGender)) {
            throw new IllegalArgumentException("Gender value is invalid.");
        }

        jdbc.update(
                "UPDATE users SET name = ?, gender = ?, date_of_birth = ?, residential_address = ?, mobile_number = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ?",
                name.trim(),
                cleanGender,
                dateOfBirth != null ? java.sql.Date.valueOf(dateOfBirth) : null,
                residentialAddress != null && !residentialAddress.isBlank() ? residentialAddress.trim() : null,
                mobileNumber != null && !mobileNumber.isBlank() ? mobileNumber.trim() : null,
                targetUserId
        );
    }

    @Transactional
    public void updateEmployee(long userId, String name, String employeeId, long actorId) {
        ensureHr(actorId);
        if (name == null || name.isBlank() || name.length() > 160) throw new IllegalArgumentException("Name is invalid.");
        if (employeeId != null && employeeId.length() > 64) throw new IllegalArgumentException("Employee ID is invalid.");
        jdbc.update("UPDATE users SET name = ?, employee_id = ? WHERE user_id = ? AND role = 'EMPLOYEE'",
                name.trim(), employeeId == null || employeeId.isBlank() ? null : employeeId.trim(), userId);
    }

    @Transactional
    public void createEmployee(String name, String email, long actorId) {
        if (name == null || name.isBlank() || name.length() > 160) throw new IllegalArgumentException("Name is invalid.");
        if (email == null || email.isBlank() || email.length() > 320) throw new IllegalArgumentException("Email is invalid.");
        try {
            var key = new org.springframework.jdbc.support.GeneratedKeyHolder();
            jdbc.update(connection -> {
                var statement = connection.prepareStatement(
                        "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'EMPLOYEE', 'INACTIVE')",
                        java.sql.Statement.RETURN_GENERATED_KEYS);
                statement.setString(1, name.trim());
                statement.setString(2, email.trim().toLowerCase());
                statement.setString(3, "INVITATION_PENDING");
                return statement;
            }, key);
            if (key.getKey() == null) throw new IllegalStateException("Unable to create employee.");
            otpService.issue(key.getKey().longValue(), email.trim().toLowerCase(), "HR_INVITATION");
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("Unable to create employee account.");
        }
    }

    public List<RegistrationView> registrations() {
        return jdbc.query("""
                SELECT u.user_id, u.name, u.email, u.role, u.status, u.created_at, u.email_verified_at,
                       u.reviewed_by_hr_user_id, r.name, u.reviewed_at, u.review_reason,
                       u.assigned_manager_user_id, m.name,
                       CASE
                           WHEN u.status <> 'PENDING_APPROVAL' THEN FALSE
                           WHEN u.assigned_manager_user_id IS NULL THEN TRUE
                           WHEN m.status <> 'ACTIVE' THEN TRUE
                           WHEN (SELECT COUNT(*) FROM manager_access_requests mar WHERE mar.requesting_user_id = u.assigned_manager_user_id AND mar.status = 'APPROVED') = 0 THEN TRUE
                           ELSE FALSE
                       END AS needs_hr_review
                FROM users u
                LEFT JOIN users r ON r.user_id = u.reviewed_by_hr_user_id
                LEFT JOIN users m ON m.user_id = u.assigned_manager_user_id
                WHERE u.role = 'EMPLOYEE'
                ORDER BY
                    CASE WHEN u.status = 'PENDING_APPROVAL' THEN 1 ELSE 2 END,
                    u.created_at DESC
                """,
                (rs, row) -> new RegistrationView(
                        rs.getLong(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getTimestamp(6) != null ? rs.getTimestamp(6).toInstant() : null,
                        rs.getTimestamp(7) != null ? rs.getTimestamp(7).toInstant() : null,
                        rs.getObject(8) != null ? rs.getLong(8) : null,
                        rs.getString(9),
                        rs.getTimestamp(10) != null ? rs.getTimestamp(10).toInstant() : null,
                        rs.getString(11),
                        rs.getObject(12) != null ? rs.getLong(12) : null,
                        rs.getString(13),
                        rs.getBoolean(14)
                ));
    }

    @Transactional
    public void assignRegistrationManager(long employeeUserId, long managerUserId, long actorId) {
        ensureHr(actorId);
        if (employeeUserId == managerUserId) {
            throw new IllegalArgumentException("A manager cannot be assigned to review their own registration.");
        }
        UserView employee = user(employeeUserId);
        if (!"EMPLOYEE".equals(employee.role())) {
            throw new IllegalArgumentException("Only employee accounts can be assigned to a manager.");
        }
        if (!"PENDING_APPROVAL".equals(employee.status())) {
            throw new IllegalArgumentException("Only registrations in pending approval status can be assigned.");
        }
        UserView manager = user(managerUserId);
        if (!"EMPLOYEE".equals(manager.role()) || !"ACTIVE".equals(manager.status())) {
            throw new IllegalArgumentException("Assigned manager must be an active employee.");
        }
        if (!managerAccessService.isApprovedManager(managerUserId)) {
            throw new IllegalArgumentException("Assigned manager must have approved manager access.");
        }

        int updated = jdbc.update(
                "UPDATE users SET assigned_manager_user_id = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND status = 'PENDING_APPROVAL'",
                managerUserId, employeeUserId);
        if (updated == 0) {
            throw new IllegalArgumentException("Registration is not pending or cannot be assigned.");
        }

        // Send non-blocking notification to the manager
        try {
            emailService.sendManagerAssignmentNotification(manager.email(), manager.name(), employee.name(), employee.email());
        } catch (Exception ignored) {
            // Non-blocking: Email failure must not rollback assignment or activate employee
        }
    }

    @Transactional
    public void approveEmployee(long userId, long actorId) {
        ensureHr(actorId);
        UserView target = user(userId);
        if (!"EMPLOYEE".equals(target.role())) {
            throw new IllegalArgumentException("Only employee accounts can be approved through employee registrations.");
        }
        if (!"PENDING_APPROVAL".equals(target.status())) {
            throw new IllegalArgumentException("Only registrations in pending approval status can be approved.");
        }
        int updated = jdbc.update(
                "UPDATE users SET status = 'ACTIVE', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = NULL, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                actorId, userId);
        if (updated == 0) {
            throw new IllegalArgumentException("Registration is not pending or cannot be approved.");
        }
        sendSafeApprovalNotification(target.email(), target.name());
    }

    @Transactional
    public void rejectEmployee(long userId, long actorId, String reason) {
        ensureHr(actorId);
        if (userId == actorId || isHr(userId)) {
            throw new IllegalArgumentException("HR administrator accounts cannot be rejected.");
        }
        UserView target = user(userId);
        if (!"EMPLOYEE".equals(target.role())) {
            throw new IllegalArgumentException("Only employee registrations can be rejected.");
        }
        if (!"PENDING_APPROVAL".equals(target.status())) {
            throw new IllegalArgumentException("Only registrations in pending approval status can be rejected.");
        }
        String cleanReason = (reason != null && !reason.isBlank()) ? reason.trim() : "Registration request was not approved by HR.";
        if (cleanReason.length() > 500) {
            cleanReason = cleanReason.substring(0, 500);
        }
        int updated = jdbc.update(
                "UPDATE users SET status = 'REJECTED', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                actorId, cleanReason, userId);
        if (updated == 0) {
            throw new IllegalArgumentException("Registration is not pending or cannot be rejected.");
        }
        jdbc.update("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", userId);
        sendSafeRejectionNotification(target.email(), target.name(), cleanReason);
    }

    @Transactional
    public void submitCorrectionRequest(long employeeUserId, String requestedChanges) {
        if (requestedChanges == null || requestedChanges.isBlank() || requestedChanges.length() > 2000) {
            throw new IllegalArgumentException("Requested changes description is required (up to 2000 characters).");
        }
        jdbc.update("INSERT INTO employee_correction_requests (employee_user_id, requested_changes, status) VALUES (?, ?, 'PENDING')",
                employeeUserId, requestedChanges.trim());
    }

    public List<CorrectionRequestView> employeeCorrectionRequests(long employeeUserId) {
        return jdbc.query("""
                SELECT c.request_id, c.employee_user_id, u.name, u.email, c.requested_changes, c.status,
                       c.created_at, c.resolved_by_hr_user_id, r.name, c.resolved_at, c.resolution_note
                FROM employee_correction_requests c
                JOIN users u ON u.user_id = c.employee_user_id
                LEFT JOIN users r ON r.user_id = c.resolved_by_hr_user_id
                WHERE c.employee_user_id = ?
                ORDER BY c.created_at DESC
                """,
                (rs, row) -> new CorrectionRequestView(
                        rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6),
                        rs.getTimestamp(7) != null ? rs.getTimestamp(7).toInstant() : null,
                        rs.getObject(8) != null ? rs.getLong(8) : null,
                        rs.getString(9),
                        rs.getTimestamp(10) != null ? rs.getTimestamp(10).toInstant() : null,
                        rs.getString(11)
                ), employeeUserId);
    }

    public List<CorrectionRequestView> allCorrectionRequests() {
        return jdbc.query("""
                SELECT c.request_id, c.employee_user_id, u.name, u.email, c.requested_changes, c.status,
                       c.created_at, c.resolved_by_hr_user_id, r.name, c.resolved_at, c.resolution_note
                FROM employee_correction_requests c
                JOIN users u ON u.user_id = c.employee_user_id
                LEFT JOIN users r ON r.user_id = c.resolved_by_hr_user_id
                ORDER BY
                    CASE WHEN c.status = 'PENDING' THEN 1 ELSE 2 END,
                    c.created_at DESC
                """,
                (rs, row) -> new CorrectionRequestView(
                        rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6),
                        rs.getTimestamp(7) != null ? rs.getTimestamp(7).toInstant() : null,
                        rs.getObject(8) != null ? rs.getLong(8) : null,
                        rs.getString(9),
                        rs.getTimestamp(10) != null ? rs.getTimestamp(10).toInstant() : null,
                        rs.getString(11)
                ));
    }

    @Transactional
    public void resolveCorrectionRequest(long requestId, String resolutionNote, long actorId) {
        ensureHr(actorId);
        String cleanNote = (resolutionNote != null && !resolutionNote.isBlank()) ? resolutionNote.trim() : "Resolved by HR.";
        if (cleanNote.length() > 500) cleanNote = cleanNote.substring(0, 500);
        int updated = jdbc.update(
                "UPDATE employee_correction_requests SET status = 'RESOLVED', resolved_by_hr_user_id = ?, resolved_at = UTC_TIMESTAMP(), resolution_note = ? WHERE request_id = ? AND status = 'PENDING'",
                actorId, cleanNote, requestId);
        if (updated == 0) throw new IllegalArgumentException("Correction request is not pending or not found.");
    }

    @Transactional
    public void dismissCorrectionRequest(long requestId, String resolutionNote, long actorId) {
        ensureHr(actorId);
        String cleanNote = (resolutionNote != null && !resolutionNote.isBlank()) ? resolutionNote.trim() : "Dismissed by HR.";
        if (cleanNote.length() > 500) cleanNote = cleanNote.substring(0, 500);
        int updated = jdbc.update(
                "UPDATE employee_correction_requests SET status = 'DISMISSED', resolved_by_hr_user_id = ?, resolved_at = UTC_TIMESTAMP(), resolution_note = ? WHERE request_id = ? AND status = 'PENDING'",
                actorId, cleanNote, requestId);
        if (updated == 0) throw new IllegalArgumentException("Correction request is not pending or not found.");
    }

    private void sendSafeApprovalNotification(String email, String name) {
        try {
            emailService.sendApprovalNotification(email, name);
        } catch (Exception ignored) {
            // Email failure must never rollback database decision
        }
    }

    private void sendSafeRejectionNotification(String email, String name, String reason) {
        try {
            emailService.sendRejectionNotification(email, name, reason);
        } catch (Exception ignored) {
            // Email failure must never rollback database decision
        }
    }

    @Transactional
    public void approve(long requestId, long actorId) {
        ensureHr(actorId);
        int updated = jdbc.update(
                "UPDATE manager_access_requests SET status = 'APPROVED', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP() WHERE request_id = ? AND status = 'PENDING' AND requesting_user_id <> ?",
                actorId, requestId, actorId);
        if (updated == 0) throw new IllegalArgumentException("Request is not pending or cannot be approved.");
    }

    @Transactional
    public void reject(long requestId, long actorId, String reason) {
        ensureHr(actorId);
        int updated = jdbc.update(
                "UPDATE manager_access_requests SET status = 'REJECTED', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = ? WHERE request_id = ? AND status = 'PENDING' AND requesting_user_id <> ?",
                actorId, reason, requestId, actorId);
        if (updated == 0) throw new IllegalArgumentException("Request is not pending or cannot be rejected.");
    }

    @Transactional
    public void revoke(long userId, long actorId, String reason) {
        ensureHr(actorId);
        int updated = jdbc.update(
                "UPDATE manager_access_requests SET status = 'REVOKED', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = ? WHERE requesting_user_id = ? AND status = 'APPROVED'",
                actorId, reason, userId);
        if (updated == 0) throw new IllegalArgumentException("Active manager access was not found.");
    }

    @Transactional
    public void grantPermission(long managerId, String permission, long actorId) {
        ensureHr(actorId);
        ensureApprovedManager(managerId);
        if (!ManagerAccessService.PERMISSIONS.contains(permission)) throw new IllegalArgumentException("Permission is not allowed.");
        try {
            jdbc.update("INSERT INTO manager_permissions (manager_user_id, permission_code, granted_by_hr_user_id) VALUES (?, ?, ?)",
                    managerId, permission, actorId);
            jdbc.update("INSERT INTO manager_permission_audit (manager_user_id, permission_code, action, changed_by_hr_user_id) VALUES (?, ?, 'GRANTED', ?)",
                    managerId, permission, actorId);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("Permission is already active.");
        }
    }

    @Transactional
    public void revokePermission(long managerId, String permission, long actorId, String reason) {
        ensureHr(actorId);
        int updated = jdbc.update(
                "UPDATE manager_permissions SET revoked_at = UTC_TIMESTAMP(), revoked_by_hr_user_id = ?, revoke_reason = ? WHERE manager_user_id = ? AND permission_code = ? AND revoked_at IS NULL",
                actorId, reason, managerId, permission);
        if (updated == 0) throw new IllegalArgumentException("Active permission was not found.");
        jdbc.update("INSERT INTO manager_permission_audit (manager_user_id, permission_code, action, changed_by_hr_user_id, reason) VALUES (?, ?, 'REVOKED', ?, ?)",
                managerId, permission, actorId, reason);
    }

    @Transactional
    public void assign(long managerId, long employeeId, long actorId) {
        ensureHr(actorId);
        ensureApprovedManager(managerId);
        if (managerId == employeeId) throw new IllegalArgumentException("A manager cannot be assigned to themselves.");
        try {
            jdbc.update("INSERT INTO manager_employee_assignments (manager_user_id, employee_user_id, assigned_by_hr_user_id) VALUES (?, ?, ?)",
                    managerId, employeeId, actorId);
            jdbc.update("INSERT INTO manager_assignment_audit (manager_user_id, employee_user_id, action, changed_by_hr_user_id) VALUES (?, ?, 'ASSIGNED', ?)",
                    managerId, employeeId, actorId);
        } catch (DuplicateKeyException exception) {
            throw new IllegalArgumentException("Assignment is already active.");
        }
    }

    @Transactional
    public void unassign(long managerId, long employeeId, long actorId, String reason) {
        ensureHr(actorId);
        int updated = jdbc.update(
                "UPDATE manager_employee_assignments SET revoked_at = UTC_TIMESTAMP(), revoked_by_hr_user_id = ?, revoke_reason = ? WHERE manager_user_id = ? AND employee_user_id = ? AND revoked_at IS NULL",
                actorId, reason, managerId, employeeId);
        if (updated == 0) throw new IllegalArgumentException("Active assignment was not found.");
        jdbc.update("INSERT INTO manager_assignment_audit (manager_user_id, employee_user_id, action, changed_by_hr_user_id, reason) VALUES (?, ?, 'REVOKED', ?, ?)",
                managerId, employeeId, actorId, reason);
    }

    @Transactional
    public void deactivate(long userId, long actorId) {
        ensureHr(actorId);
        Integer lastHr = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE role = 'HR_ADMIN' AND status = 'ACTIVE' AND user_id <> ?",
                Integer.class, userId);
        if (isHr(userId) && (lastHr == null || lastHr == 0)) throw new IllegalArgumentException("The last active HR account cannot be deactivated.");
        jdbc.update("UPDATE users SET status = 'INACTIVE', updated_at = UTC_TIMESTAMP() WHERE user_id = ?", userId);
        jdbc.update("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", userId);
    }

    @Transactional
    public void activate(long userId, long actorId) {
        ensureHr(actorId);
        var users = jdbc.query("SELECT status FROM users WHERE user_id = ?", (rs, row) -> rs.getString(1), userId);
        if (users.isEmpty()) throw new IllegalArgumentException("User not found.");
        if ("PENDING_APPROVAL".equals(users.getFirst())) {
            approveEmployee(userId, actorId);
            return;
        }
        jdbc.update("UPDATE users SET status = 'ACTIVE', updated_at = UTC_TIMESTAMP() WHERE user_id = ?", userId);
    }

    public List<ManagerAccessService.AccessRequest> requests() {
        return jdbc.query("SELECT request_id, status, submitted_at, reviewed_at, review_reason FROM manager_access_requests ORDER BY submitted_at DESC",
                (rs, row) -> new ManagerAccessService.AccessRequest(rs.getLong(1), rs.getString(2),
                        rs.getTimestamp(3).toInstant(), rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant(), rs.getString(5)));
    }

    public List<ManagerAccessService.EmployeeView> assignments(long managerId) {
        return jdbc.query("SELECT u.user_id, u.name, u.email, u.employee_id, u.status FROM users u JOIN manager_employee_assignments a ON a.employee_user_id = u.user_id WHERE a.manager_user_id = ? AND a.revoked_at IS NULL",
                (rs, row) -> new ManagerAccessService.EmployeeView(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)), managerId);
    }

    private void ensureHr(long actorId) {
        if (!isHr(actorId)) throw new org.springframework.security.access.AccessDeniedException("HR authorization required.");
    }

    private boolean isHr(long userId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE user_id = ? AND role = 'HR_ADMIN' AND status = 'ACTIVE'", Integer.class, userId);
        return count != null && count > 0;
    }

    private void ensureApprovedManager(long userId) {
        if (!managerAccessService.isApprovedManager(userId)) throw new IllegalArgumentException("Manager access is not approved.");
    }

    public record UserView(long id, String name, String email, String role, String status, String employeeId) {}
    public record RegistrationView(long id, String name, String email, String role, String status, Instant createdAt, Instant emailVerifiedAt, Long reviewedByHrUserId, String reviewerName, Instant reviewedAt, String reviewReason, Long assignedManagerUserId, String assignedManagerName, boolean needsHrReview) {}
    public record PersonalDetailsView(long userId, String employeeId, String name, String email, String gender, LocalDate dateOfBirth, Integer age, String residentialAddress, String mobileNumber, String role, String status) {}
    public record CorrectionRequestView(long requestId, long employeeUserId, String employeeName, String employeeEmail, String requestedChanges, String status, Instant createdAt, Long resolvedByHrUserId, String resolverName, Instant resolvedAt, String resolutionNote) {}
}
