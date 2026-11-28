package com.example.employeehr.auth.controller;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.auth.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public Message signup(@Valid @RequestBody SignupRequest request) {
        if (request.confirmPassword() != null && !request.confirmPassword().isBlank()
                && !request.password().equals(request.confirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match.");
        }
        if (request.firstName() != null || request.jobRole() != null || request.resumeFileName() != null
                || request.age() != null || request.gender() != null) {
            authService.signup(request);
        } else if (request.accountType() != null && !request.accountType().isBlank() && !"EMPLOYEE".equalsIgnoreCase(request.accountType())) {
            authService.signup(request.name(), request.email(), request.password(), request.accountType());
        } else {
            authService.signup(request.name(), request.email(), request.password());
        }
        return new Message("Verification OTP sent if SMTP is configured.");
    }

    @PostMapping("/signup/verify")
    public Message verifySignup(@Valid @RequestBody OtpRequest request) {
        authService.verifySignup(request.email(), request.otp());
        return new Message("Email verified successfully. Your account is pending HR administrator approval before you can sign in.");
    }

    @PostMapping("/invitation/activate")
    public Message activateInvitation(@Valid @RequestBody InvitationActivationRequest request) {
        authService.activateInvitation(request.email(), request.otp(), request.password(), request.confirmPassword());
        return new Message("Employee account activated successfully.");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        AuthUser user = "EMPLOYEE".equalsIgnoreCase(request.loginType())
                ? authService.login(request.email(), request.password(), httpRequest.getRemoteAddr())
                : authService.login(request.email(), request.password(), request.loginType(), httpRequest.getRemoteAddr());
        String token = authService.createSession(user);
        ResponseCookie cookie = ResponseCookie.from("employee_hr_session", token)
                .httpOnly(true).secure(authService.sessionCookieSecure()).sameSite("Lax").path("/")
                .maxAge(authService.sessionTtl()).build();
        LoginResponse response = authService.toLoginResponse(user);
        if (response == null) {
            response = new LoginResponse(user.id(), user.name(), user.email(), user.role(),
                    java.util.List.of(user.role()), java.util.List.of());
        }
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(response);
    }

    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }

    @GetMapping("/me")
    public LoginResponse me(Authentication authentication) {
        AuthUser user = (AuthUser) authentication.getPrincipal();
        LoginResponse response = authService.toLoginResponse(user);
        return response == null
                ? new LoginResponse(user.id(), user.name(), user.email(), user.role(),
                        java.util.List.of(user.role()), java.util.List.of())
                : response;
    }

    @PostMapping("/logout")
    public ResponseEntity<Message> logout(@CookieValue(value = "employee_hr_session", required = false) String token) {
        authService.revokeSession(token);
        ResponseCookie cookie = ResponseCookie.from("employee_hr_session", "")
                .httpOnly(true).secure(authService.sessionCookieSecure()).sameSite("Lax").path("/")
                .maxAge(0).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new Message("Signed out."));
    }

    @PostMapping("/password/forgot")
    public Message forgotPassword(@Valid @RequestBody EmailRequest request) {
        authService.requestPasswordReset(request.email());
        return new Message("If the account exists, a password reset OTP has been sent.");
    }

    @PostMapping("/password/reset")
    public Message resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.email(), request.otp(), request.newPassword(), request.confirmPassword());
        return new Message("Password reset successfully.");
    }

    @GetMapping("/users/{id}/resume")
    public ResponseEntity<byte[]> getResume(@PathVariable long id, Authentication authentication) {
        AuthUser currentUser = authentication != null && authentication.getPrincipal() instanceof AuthUser au ? au : null;
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean isHr = "HR_ADMIN".equalsIgnoreCase(currentUser.role());
        boolean isSelf = currentUser.id() == id;
        if (!isHr && !isSelf) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        var fileData = authService.getUserResume(id);
        if (fileData == null || fileData.data() == null) {
            return ResponseEntity.notFound().build();
        }
        String contentType = fileData.contentType() != null && !fileData.contentType().isBlank()
                ? fileData.contentType() : "application/pdf";
        String fileName = fileData.fileName() != null && !fileData.fileName().isBlank()
                ? fileData.fileName() : "resume.pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(fileData.data());
    }

    @GetMapping("/users/{id}/resume-info")
    public ResponseEntity<ResumeInfo> getResumeInfo(@PathVariable long id, Authentication authentication) {
        AuthUser currentUser = authentication != null && authentication.getPrincipal() instanceof AuthUser au ? au : null;
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean isHr = "HR_ADMIN".equalsIgnoreCase(currentUser.role());
        boolean isSelf = currentUser.id() == id;
        if (!isHr && !isSelf) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        var info = authService.getUserResumeInfo(id);
        if (info == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(info);
    }

    public record SignupRequest(
            String name,
            String firstName,
            String lastName,
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            String confirmPassword,
            String accountType,
            String jobRole,
            Integer age,
            String gender,
            String resumeFileName,
            String resumeContentType,
            Long resumeFileSize,
            String resumeData) {
        public SignupRequest(String name, String email, String password, String accountType) {
            this(name, null, null, email, password, null, accountType, null, null, null, null, null, null, null);
        }

        public SignupRequest(String name, String email, String password) {
            this(name, email, password, null);
        }

        private static String splitFirst(String name) {
            if (name == null || name.isBlank()) return null;
            String[] parts = name.trim().split("\\s+", 2);
            return parts[0];
        }

        private static String splitLast(String name) {
            if (name == null || name.isBlank()) return null;
            String[] parts = name.trim().split("\\s+", 2);
            return parts.length > 1 ? parts[1] : parts[0];
        }
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password,
            @NotBlank String loginType) {
        public LoginRequest(String email, String password) {
            this(email, password, "EMPLOYEE");
        }
    }

    public record EmailRequest(@NotBlank @Email String email) {
    }

    public record OtpRequest(@NotBlank @Email String email, @NotBlank @Size(min = 6, max = 6) String otp) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 6) String otp,
            @NotBlank @Size(min = 8, max = 128) String newPassword,
            @NotBlank @Size(min = 8, max = 128) String confirmPassword) {
    }

    public record InvitationActivationRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 6) String otp,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotBlank @Size(min = 8, max = 128) String confirmPassword) {
    }

    public record LoginResponse(long id, String name, String email, String role,
            java.util.List<String> effectiveRoles, java.util.List<String> permissions, String employeeId,
            String firstName, String lastName, String jobRole, Integer age, String gender, String resumeFileName) {
        public LoginResponse(long id, String name, String email, String role,
                java.util.List<String> effectiveRoles, java.util.List<String> permissions, String employeeId) {
            this(id, name, email, role, effectiveRoles, permissions, employeeId, null, null, null, null, null, null);
        }

        public LoginResponse(long id, String name, String email, String role,
                java.util.List<String> effectiveRoles, java.util.List<String> permissions) {
            this(id, name, email, role, effectiveRoles, permissions, null, null, null, null, null, null, null);
        }
    }

    public record ResumeInfo(String fileName, String contentType, Long fileSize, boolean hasResume) {}

    public record Message(String message) {
    }
}
