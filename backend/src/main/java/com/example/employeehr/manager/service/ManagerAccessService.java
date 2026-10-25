package com.example.employeehr.manager.service;

import com.example.employeehr.auth.service.EmailService;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManagerAccessService {
    public static final Set<String> PERMISSIONS = Set.of(
            "VIEW_ASSIGNED_EMPLOYEES",
            "UPDATE_ASSIGNED_EMPLOYEE_PROFILE",
            "VIEW_ASSIGNED_ATTENDANCE",
            "REVIEW_ASSIGNED_LEAVE");

    private final JdbcTemplate jdbc;
    private final EmailService emailService;

    public ManagerAccessService(JdbcTemplate jdbc, EmailService emailService) {
        this.jdbc = jdbc;
        this.emailService = emailService;
    }

    public ManagerAccessService(JdbcTemplate jdbc) {
        this(jdbc, null);
    }

    public boolean isApprovedManager(long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM manager_access_requests r JOIN users u ON u.user_id = r.requesting_user_id " +
                        "WHERE r.requesting_user_id = ? AND r.status = 'APPROVED' AND u.status = 'ACTIVE'",
                Integer.class, userId);
        return count != null && count > 0;
    }

    public List<String> permissions(long managerId) {
        return jdbc.queryForList(
                "SELECT permission_code FROM manager_permissions WHERE manager_user_id = ? AND revoked_at IS NULL ORDER BY permission_code",
                String.class, managerId);
    }

    public boolean hasPermission(long managerId, String permission) {
        return PERMISSIONS.contains(permission) && isApprovedManager(managerId)
                && !jdbc.queryForList(
                        "SELECT permission_code FROM manager_permissions WHERE manager_user_id = ? AND permission_code = ? AND revoked_at IS NULL",
                        String.class, managerId, permission).isEmpty();
    }

    public boolean isAssigned(long managerId, long employeeId) {
        return !jdbc.queryForList(
                "SELECT assignment_id FROM manager_employee_assignments WHERE manager_user_id = ? AND employee_user_id = ? AND revoked_at IS NULL",
                Long.class, managerId, employeeId).isEmpty();
    }

    @Transactional
    public void request(long userId) {
        if (!isActiveEmployee(userId)) throw new IllegalArgumentException("Only active employees may request manager access.");
        Integer pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM manager_access_requests WHERE requesting_user_id = ? AND status = 'PENDING'",
                Integer.class, userId);
        if (pending != null && pending > 0) throw new IllegalArgumentException("A manager-access request is already pending.");
        jdbc.update("INSERT INTO manager_access_requests (requesting_user_id, status) VALUES (?, 'PENDING')", userId);
    }

    public List<AccessRequest> ownRequests(long userId) {
        return jdbc.query(
                "SELECT request_id, status, submitted_at, reviewed_at, review_reason FROM manager_access_requests WHERE requesting_user_id = ? ORDER BY submitted_at DESC",
                (rs, row) -> new AccessRequest(rs.getLong(1), rs.getString(2),
                        rs.getTimestamp(3).toInstant(), rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant(),
                        rs.getString(5)), userId);
    }

    public List<EmployeeView> assignedEmployees(long managerId) {
        requirePermission(managerId, "VIEW_ASSIGNED_EMPLOYEES");
        return jdbc.query(
                "SELECT u.user_id, u.name, u.email, u.employee_id, u.status FROM users u " +
                        "JOIN manager_employee_assignments a ON a.employee_user_id = u.user_id " +
                        "WHERE a.manager_user_id = ? AND a.revoked_at IS NULL ORDER BY u.name",
                (rs, row) -> new EmployeeView(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5)), managerId);
    }

    public EmployeeView assignedEmployee(long managerId, long employeeId) {
        requireAssigned(managerId, employeeId, "VIEW_ASSIGNED_EMPLOYEES");
        var employees = jdbc.query(
                "SELECT user_id, name, email, employee_id, status FROM users WHERE user_id = ?",
                (rs, row) -> new EmployeeView(rs.getLong(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5)), employeeId);
        if (employees.isEmpty()) throw new IllegalArgumentException("Employee not found.");
        return employees.getFirst();
    }

    @Transactional
    public void updateAssignedEmployee(long managerId, long employeeId, String name, String employeeIdValue) {
        requireAssigned(managerId, employeeId, "UPDATE_ASSIGNED_EMPLOYEE_PROFILE");
        if (name == null || name.isBlank() || name.length() > 160) throw new IllegalArgumentException("Name is invalid.");
        if (employeeIdValue != null && employeeIdValue.length() > 64) throw new IllegalArgumentException("Employee ID is invalid.");
        jdbc.update("UPDATE users SET name = ?, employee_id = ? WHERE user_id = ? AND role = 'EMPLOYEE'",
                name.trim(), employeeIdValue == null || employeeIdValue.isBlank() ? null : employeeIdValue.trim(), employeeId);
    }

    public List<PendingRegistrationView> pendingRegistrations(long managerId) {
        if (!isApprovedManager(managerId)) {
            throw new org.springframework.security.access.AccessDeniedException("Approved manager access required.");
        }
        return jdbc.query("""
                SELECT user_id, name, email, role, status, created_at, email_verified_at
                FROM users
                WHERE assigned_manager_user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'
                ORDER BY created_at ASC
                """,
                (rs, row) -> new PendingRegistrationView(
                        rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                        rs.getTimestamp(6) != null ? rs.getTimestamp(6).toInstant() : null,
                        rs.getTimestamp(7) != null ? rs.getTimestamp(7).toInstant() : null
                ), managerId);
    }

    @Transactional
    public void approveRegistration(long managerId, long employeeId) {
        if (!isApprovedManager(managerId)) {
            throw new org.springframework.security.access.AccessDeniedException("Approved manager access required.");
        }
        var employees = jdbc.query(
                "SELECT user_id, name, email, role, status FROM users WHERE user_id = ? AND assigned_manager_user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                (rs, row) -> new EmployeeView(rs.getLong(1), rs.getString(2), rs.getString(3), null, rs.getString(5)),
                employeeId, managerId);
        if (employees.isEmpty()) {
            throw new IllegalArgumentException("Registration not found or not assigned to this manager.");
        }
        EmployeeView target = employees.getFirst();

        int updated = jdbc.update(
                "UPDATE users SET status = 'ACTIVE', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = NULL, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND assigned_manager_user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                managerId, employeeId, managerId);
        if (updated == 0) {
            throw new IllegalArgumentException("Registration is not pending or cannot be approved.");
        }

        // Establish the formal manager-employee assignment without granting any new manager permissions
        try {
            jdbc.update(
                    "INSERT INTO manager_employee_assignments (manager_user_id, employee_user_id, assigned_by_hr_user_id) VALUES (?, ?, ?)",
                    managerId, employeeId, managerId);
        } catch (DuplicateKeyException ignored) {
            // Assignment already exists
        }

        if (emailService != null) {
            try {
                emailService.sendApprovalNotification(target.email(), target.name());
            } catch (Exception ignored) {
                // Non-blocking email
            }
        }
    }

    @Transactional
    public void rejectRegistration(long managerId, long employeeId, String reason) {
        if (!isApprovedManager(managerId)) {
            throw new org.springframework.security.access.AccessDeniedException("Approved manager access required.");
        }
        var employees = jdbc.query(
                "SELECT user_id, name, email, role, status FROM users WHERE user_id = ? AND assigned_manager_user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                (rs, row) -> new EmployeeView(rs.getLong(1), rs.getString(2), rs.getString(3), null, rs.getString(5)),
                employeeId, managerId);
        if (employees.isEmpty()) {
            throw new IllegalArgumentException("Registration not found or not assigned to this manager.");
        }
        EmployeeView target = employees.getFirst();
        String cleanReason = (reason != null && !reason.isBlank()) ? reason.trim() : "Registration not approved by assigned manager.";
        if (cleanReason.length() > 500) cleanReason = cleanReason.substring(0, 500);

        int updated = jdbc.update(
                "UPDATE users SET status = 'REJECTED', reviewed_by_hr_user_id = ?, reviewed_at = UTC_TIMESTAMP(), review_reason = ?, updated_at = UTC_TIMESTAMP() WHERE user_id = ? AND assigned_manager_user_id = ? AND status = 'PENDING_APPROVAL' AND role = 'EMPLOYEE'",
                managerId, cleanReason, employeeId, managerId);
        if (updated == 0) {
            throw new IllegalArgumentException("Registration is not pending or cannot be rejected.");
        }
        jdbc.update("UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", employeeId);

        if (emailService != null) {
            try {
                emailService.sendRejectionNotification(target.email(), target.name(), cleanReason);
            } catch (Exception ignored) {
                // Non-blocking email
            }
        }
    }

    public void requirePermission(long managerId, String permission) {
        if (!hasPermission(managerId, permission)) throw new org.springframework.security.access.AccessDeniedException("Manager permission required.");
    }

    private void requireAssigned(long managerId, long employeeId, String permission) {
        requirePermission(managerId, permission);
        if (!isAssigned(managerId, employeeId)) throw new org.springframework.security.access.AccessDeniedException("Employee is not assigned to this manager.");
    }

    private boolean isActiveEmployee(long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE user_id = ? AND role = 'EMPLOYEE' AND status = 'ACTIVE'",
                Integer.class, userId);
        return count != null && count > 0;
    }

    public record AccessRequest(long id, String status, Instant submittedAt,
            Instant reviewedAt, String reviewReason) {}

    public record EmployeeView(long id, String name, String email, String employeeId, String status) {}

    public record PendingRegistrationView(long id, String name, String email, String role, String status,
            Instant createdAt, Instant emailVerifiedAt) {}
}
