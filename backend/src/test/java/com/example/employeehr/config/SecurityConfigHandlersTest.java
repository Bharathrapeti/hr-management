package com.example.employeehr.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;

class SecurityConfigHandlersTest {

    @Test
    void authenticationEntryPointReturns401WithConsistentJson() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        SecurityConfig.authenticationEntryPoint()
                .commence(request, response, new BadCredentialsException("Session missing"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"code\":\"UNAUTHORIZED\"");
        assertThat(response.getContentAsString()).contains("Authentication is required or the session is no longer valid.");
    }

    @Test
    void accessDeniedHandlerReturns403WithCsrfErrorWhenCsrfExceptionThrown() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        DefaultCsrfToken expectedToken = new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "expected-token");
        SecurityConfig.accessDeniedHandler()
                .handle(request, response, new InvalidCsrfTokenException(expectedToken, "invalid-token"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"code\":\"CSRF_ERROR\"");
        assertThat(response.getContentAsString()).contains("Security validation failed. Please refresh the page and try again.");
    }

    @Test
    void accessDeniedHandlerReturns403WithCsrfErrorWhenMissingCsrfToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        SecurityConfig.accessDeniedHandler()
                .handle(request, response, new MissingCsrfTokenException("missing-token"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"code\":\"CSRF_ERROR\"");
        assertThat(response.getContentAsString()).contains("Security validation failed. Please refresh the page and try again.");
    }

    @Test
    void accessDeniedHandlerReturns403WithAccessDeniedForRoleOrPermissionDenial() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        SecurityConfig.accessDeniedHandler()
                .handle(request, response, new AccessDeniedException("Access is denied"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("\"code\":\"ACCESS_DENIED\"");
        assertThat(response.getContentAsString()).contains("You do not have permission to perform this action.");
        assertThat(response.getContentAsString()).doesNotContain("CSRF_ERROR");
    }
}
