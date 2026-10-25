package com.example.employeehr.hr.controller;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.hr.service.HrManagementService;
import com.example.employeehr.manager.service.ManagerAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hr")
public class HrManagementController {
    private final HrManagementService service;

    public HrManagementController(HrManagementService service) {
        this.service = service;
    }

    @GetMapping("/users")
    public List<HrManagementService.UserView> users() { return service.users(); }

    @GetMapping("/eligible-managers")
    public List<HrManagementService.UserView> eligibleManagers() { return service.eligibleManagers(); }

    @GetMapping("/users/{id}")
    public HrManagementService.UserView user(@PathVariable long id) { return service.user(id); }

    @GetMapping("/employee-registrations")
    public List<HrManagementService.RegistrationView> registrations() {
        return service.registrations();
    }

    @PostMapping("/employee-registrations/{id}/assign-manager")
    public Message assignManager(@PathVariable long id, @Valid @RequestBody AssignManagerRequest request, Authentication authentication) {
        service.assignRegistrationManager(id, request.managerUserId(), user(authentication).id());
        return new Message("Manager assigned to employee registration.");
    }

    @PostMapping("/employee-registrations/{id}/approve")
    public Message approveRegistration(@PathVariable long id, Authentication authentication) {
        service.approveEmployee(id, user(authentication).id());
        return new Message("Employee registration approved.");
    }

    @PostMapping("/employee-registrations/{id}/reject")
    public Message rejectRegistration(@PathVariable long id, @RequestBody(required = false) Decision request, Authentication authentication) {
        service.rejectEmployee(id, user(authentication).id(), request == null ? null : request.reason());
        return new Message("Employee registration rejected.");
    }

    @GetMapping("/employees/{id}/personal-details")
    public HrManagementService.PersonalDetailsView getPersonalDetails(@PathVariable long id) {
        return service.getPersonalDetails(id);
    }

    @PutMapping("/employees/{id}/personal-details")
    public Message updatePersonalDetails(@PathVariable long id, @Valid @RequestBody UpdatePersonalDetailsRequest request, Authentication authentication) {
        service.updatePersonalDetails(id, request.name(), request.gender(), request.dateOfBirth(), request.residentialAddress(), request.mobileNumber(), user(authentication).id());
        return new Message("Employee personal details updated.");
    }

    @GetMapping("/correction-requests")
    public List<HrManagementService.CorrectionRequestView> correctionRequests() {
        return service.allCorrectionRequests();
    }

    @PostMapping("/correction-requests/{id}/resolve")
    public Message resolveCorrectionRequest(@PathVariable long id, @RequestBody(required = false) CorrectionDecision request, Authentication authentication) {
        service.resolveCorrectionRequest(id, request == null ? null : request.note(), user(authentication).id());
        return new Message("Correction request marked as resolved.");
    }

    @PostMapping("/correction-requests/{id}/dismiss")
    public Message dismissCorrectionRequest(@PathVariable long id, @RequestBody(required = false) CorrectionDecision request, Authentication authentication) {
        service.dismissCorrectionRequest(id, request == null ? null : request.note(), user(authentication).id());
        return new Message("Correction request dismissed.");
    }

    @PostMapping("/employees")
    public Message create(@Valid @RequestBody CreateEmployee request, Authentication authentication) {
        service.createEmployee(request.name(), request.email(), user(authentication).id());
        return new Message("Employee invitation created.");
    }

    @PatchMapping("/employees/{id}")
    public Message update(@PathVariable long id, @Valid @RequestBody ProfileUpdate request, Authentication authentication) {
        service.updateEmployee(id, request.name(), request.employeeId(), user(authentication).id());
        return new Message("Employee account updated.");
    }

    @GetMapping("/manager-access/requests")
    public List<ManagerAccessService.AccessRequest> requests() { return service.requests(); }

    @GetMapping("/manager-access/requests/{id}")
    public ManagerAccessService.AccessRequest request(@PathVariable long id) {
        return service.requests().stream().filter(item -> item.id() == id).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Manager-access request not found."));
    }

    @PostMapping("/manager-access/requests/{id}/approve")
    public Message approve(@PathVariable long id, Authentication authentication) {
        service.approve(id, user(authentication).id());
        return new Message("Manager-access request approved.");
    }

    @PostMapping("/manager-access/requests/{id}/reject")
    public Message reject(@PathVariable long id, @RequestBody(required = false) Decision request, Authentication authentication) {
        service.reject(id, user(authentication).id(), request == null ? null : request.reason());
        return new Message("Manager-access request rejected.");
    }

    @PostMapping("/manager-access/users/{id}/revoke")
    public Message revoke(@PathVariable long id, @RequestBody(required = false) Decision request, Authentication authentication) {
        service.revoke(id, user(authentication).id(), request == null ? null : request.reason());
        return new Message("Manager access revoked.");
    }

    @PostMapping("/managers/{id}/permissions")
    public Message grantPermission(@PathVariable long id, @Valid @RequestBody PermissionRequest request, Authentication authentication) {
        service.grantPermission(id, request.permission(), user(authentication).id());
        return new Message("Manager permission granted.");
    }

    @DeleteMapping("/managers/{id}/permissions/{permission}")
    public Message revokePermission(@PathVariable long id, @PathVariable String permission,
            @RequestBody(required = false) Decision request, Authentication authentication) {
        service.revokePermission(id, permission, user(authentication).id(), request == null ? null : request.reason());
        return new Message("Manager permission revoked.");
    }

    @GetMapping("/managers/{id}/assignments")
    public List<ManagerAccessService.EmployeeView> assignments(@PathVariable long id) { return service.assignments(id); }

    @GetMapping("/managers/{id}/permissions")
    public List<String> permissions(@PathVariable long id) { return service.permissions(id); }

    @PostMapping("/managers/{id}/assignments")
    public Message assign(@PathVariable long id, @Valid @RequestBody AssignmentRequest request, Authentication authentication) {
        service.assign(id, request.employeeId(), user(authentication).id());
        return new Message("Employee assigned to manager.");
    }

    @DeleteMapping("/managers/{id}/assignments/{employeeId}")
    public Message unassign(@PathVariable long id, @PathVariable long employeeId,
            @RequestBody(required = false) Decision request, Authentication authentication) {
        service.unassign(id, employeeId, user(authentication).id(), request == null ? null : request.reason());
        return new Message("Manager assignment removed.");
    }

    @PostMapping("/employees/{id}/activate")
    public Message activate(@PathVariable long id, Authentication authentication) {
        service.activate(id, user(authentication).id());
        return new Message("Account activated.");
    }

    @PostMapping("/employees/{id}/deactivate")
    public Message deactivate(@PathVariable long id, Authentication authentication) {
        service.deactivate(id, user(authentication).id());
        return new Message("Account deactivated.");
    }

    private AuthUser user(Authentication authentication) { return (AuthUser) authentication.getPrincipal(); }
    public record CreateEmployee(@NotBlank @Size(max = 160) String name, @NotBlank @Email @Size(max = 320) String email) {}
    public record ProfileUpdate(@NotBlank @Size(max = 160) String name, @Size(max = 64) String employeeId) {}
    public record Decision(@Size(max = 500) String reason) {}
    public record PermissionRequest(@NotBlank String permission) {}
    public record AssignmentRequest(long employeeId) {}
    public record AssignManagerRequest(long managerUserId) {}
    public record UpdatePersonalDetailsRequest(
            @NotBlank @Size(max = 160) String name,
            String gender,
            @Past(message = "Date of birth must be in the past.") LocalDate dateOfBirth,
            @Size(max = 500) String residentialAddress,
            @Pattern(regexp = "^[+0-9\\s\\-\\(\\)]{7,32}$", message = "Invalid mobile number format.") String mobileNumber) {}
    public record CorrectionDecision(@Size(max = 500) String note) {}
    public record Message(String message) {}
}
