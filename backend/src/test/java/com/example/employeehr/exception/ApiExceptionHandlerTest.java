package com.example.employeehr.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailSendException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class ApiExceptionHandlerTest {
    private ApiExceptionHandler handler;
    private MethodParameter methodParameter;

    void dummyMethod(String param) {}

    @BeforeEach
    void setUp() throws NoSuchMethodException {
        handler = new ApiExceptionHandler();
        Method method = getClass().getDeclaredMethod("dummyMethod", String.class);
        methodParameter = new MethodParameter(method, 0);
    }

    @Test
    void validationReturnsFieldErrorAndReasonWithoutValue() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "signupRequest");
        bindingResult.addError(new FieldError("signupRequest", "password", "secretPassword123", false, null, null, "size must be between 8 and 128"));

        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);
        ResponseEntity<Map<String, String>> response = handler.validation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("password: size must be between 8 and 128");
        assertThat(response.getBody().get("error")).doesNotContain("secretPassword123");
    }

    @Test
    void validationHandlesMissingReasonGracefully() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "signupRequest");
        bindingResult.addError(new FieldError("signupRequest", "email", null));

        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);
        ResponseEntity<Map<String, String>> response = handler.validation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Invalid value for email.");
    }

    @Test
    void validationHandlesGlobalErrorFallback() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "signupRequest");
        bindingResult.addError(new ObjectError("signupRequest", "Passwords do not match."));

        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);
        ResponseEntity<Map<String, String>> response = handler.validation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Passwords do not match.");
    }

    @Test
    void validationFallsBackWhenNoErrorsPresent() {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "signupRequest");

        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);
        ResponseEntity<Map<String, String>> response = handler.validation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Request validation failed.");
    }

    @Test
    void badRequestReturnsErrorMessageForIllegalArgumentException() {
        ResponseEntity<Map<String, String>> response =
                handler.badRequest(new IllegalArgumentException("Invalid email or password."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Invalid email or password.");
    }

    @Test
    void mailUnavailableReturnsServiceUnavailableForMailException() {
        ResponseEntity<Map<String, String>> response =
                handler.mailUnavailable(new MailSendException("Connection failed"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error"))
                .isEqualTo("Authentication email service is temporarily unavailable. Please try again shortly.");
    }

    @Test
    void deniedReturnsForbiddenForAccessDeniedException() {
        ResponseEntity<Map<String, String>> response =
                handler.denied(new org.springframework.security.access.AccessDeniedException("CSRF or permission failed"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("You are not authorized for this action.");
    }

    @Test
    void unauthenticatedReturnsUnauthorizedForAuthenticationException() {
        ResponseEntity<Map<String, String>> response =
                handler.unauthenticated(new org.springframework.security.authentication.BadCredentialsException("Auth failed"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Authentication is required.");
    }
}
