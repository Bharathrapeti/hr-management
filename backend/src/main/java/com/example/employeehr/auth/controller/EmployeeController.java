package com.example.employeehr.auth.controller;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.hr.controller.HrManagementController;
import com.example.employeehr.hr.service.HrManagementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employee")
public class EmployeeController {
    private final HrManagementService hrManagementService;

    public EmployeeController(HrManagementService hrManagementService) {
        this.hrManagementService = hrManagementService;
    }

    @GetMapping("/me")
    public EmployeeProfile me(Authentication authentication) {
        AuthUser user = (AuthUser) authentication.getPrincipal();
        return new EmployeeProfile(user.id(), user.name(), user.email(), user.role(), user.status());
    }

    @GetMapping("/personal-details")
    public HrManagementService.PersonalDetailsView personalDetails(Authentication authentication) {
        AuthUser user = (AuthUser) authentication.getPrincipal();
        return hrManagementService.getPersonalDetails(user.id());
    }

    @PostMapping("/correction-requests")
    public HrManagementController.Message submitCorrectionRequest(
            @Valid @RequestBody CorrectionRequestDto request,
            Authentication authentication) {
        AuthUser user = (AuthUser) authentication.getPrincipal();
        hrManagementService.submitCorrectionRequest(user.id(), request.requestedChanges());
        return new HrManagementController.Message("Correction request submitted to HR.");
    }

    @GetMapping("/correction-requests")
    public List<HrManagementService.CorrectionRequestView> correctionRequests(Authentication authentication) {
        AuthUser user = (AuthUser) authentication.getPrincipal();
        return hrManagementService.employeeCorrectionRequests(user.id());
    }

    public record EmployeeProfile(long id, String name, String email, String role, String status) {}
    public record CorrectionRequestDto(@NotBlank @Size(max = 2000) String requestedChanges) {}
}
