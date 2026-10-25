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
        authService.signup(request.name(), request.email(), request.password());
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

    public record SignupRequest(
            @NotBlank @Size(max = 160) String name,
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 128) String password) {
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
            java.util.List<String> effectiveRoles, java.util.List<String> permissions) {
    }

    public record Message(String message) {
    }
}
