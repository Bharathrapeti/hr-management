package com.example.employeehr.manager.controller;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.manager.service.ManagerAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ManagerAccessController {
    private final ManagerAccessService service;

    public ManagerAccessController(ManagerAccessService service) {
        this.service = service;
    }

    @PostMapping("/manager-access/requests")
    public Message request(Authentication authentication) {
        service.request(user(authentication).id());
        return new Message("Manager-access request submitted.");
    }

    @GetMapping("/manager-access/me")
    public List<ManagerAccessService.AccessRequest> ownRequests(Authentication authentication) {
        return service.ownRequests(user(authentication).id());
    }

    @GetMapping("/manager/employees")
    public List<ManagerAccessService.EmployeeView> employees(Authentication authentication) {
        return service.assignedEmployees(user(authentication).id());
    }

    @GetMapping("/manager/employees/{employeeId}")
    public ManagerAccessService.EmployeeView employee(Authentication authentication, @PathVariable long employeeId) {
        return service.assignedEmployee(user(authentication).id(), employeeId);
    }

    @PatchMapping("/manager/employees/{employeeId}")
    public Message updateEmployee(Authentication authentication, @PathVariable long employeeId,
            @Valid @RequestBody ProfileUpdate request) {
        service.updateAssignedEmployee(user(authentication).id(), employeeId, request.name(), request.employeeId());
        return new Message("Employee profile updated.");
    }

    @GetMapping("/manager/pending-registrations")
    public List<ManagerAccessService.PendingRegistrationView> pendingRegistrations(Authentication authentication) {
        return service.pendingRegistrations(user(authentication).id());
    }

    @PostMapping("/manager/pending-registrations/{id}/approve")
    public Message approveRegistration(@PathVariable long id, Authentication authentication) {
        service.approveRegistration(user(authentication).id(), id);
        return new Message("Registration approved.");
    }

    @PostMapping("/manager/pending-registrations/{id}/reject")
    public Message rejectRegistration(@PathVariable long id, @RequestBody(required = false) Decision request, Authentication authentication) {
        service.rejectRegistration(user(authentication).id(), id, request == null ? null : request.reason());
        return new Message("Registration rejected.");
    }

    @GetMapping("/manager/employees/{employeeId}/attendance")
    public List<Object> attendance(Authentication authentication, @PathVariable long employeeId) {
        service.requirePermission(user(authentication).id(), "VIEW_ASSIGNED_ATTENDANCE");
        requireAssignment(service, user(authentication).id(), employeeId);
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                "Attendance records are not persisted by the current backend.");
    }

    @GetMapping("/manager/employees/{employeeId}/leave")
    public List<Object> leave(Authentication authentication, @PathVariable long employeeId) {
        service.requirePermission(user(authentication).id(), "REVIEW_ASSIGNED_LEAVE");
        requireAssignment(service, user(authentication).id(), employeeId);
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                "Leave records are not persisted by the current backend.");
    }

    private void requireAssignment(ManagerAccessService service, long managerId, long employeeId) {
        if (!service.isAssigned(managerId, employeeId)) {
            throw new org.springframework.security.access.AccessDeniedException("Employee is not assigned to this manager.");
        }
    }

    private AuthUser user(Authentication authentication) {
        return (AuthUser) authentication.getPrincipal();
    }

    public record ProfileUpdate(@Size(max = 160) String name, @Size(max = 64) String employeeId) {}
    public record Decision(@Size(max = 500) String reason) {}
    public record Message(String message) {}
}
