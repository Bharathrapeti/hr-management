package com.example.employeehr.security;

import com.example.employeehr.auth.model.AuthUser;
import com.example.employeehr.manager.service.ManagerAccessService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthSessionFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;
    private final ManagerAccessService managerAccessService;

    public AuthSessionFilter(JdbcTemplate jdbc, ManagerAccessService managerAccessService) {
        this.jdbc = jdbc;
        this.managerAccessService = managerAccessService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = readCookie(request, "employee_hr_session");
        if (token != null) {
            var users = jdbc.query(
                    "SELECT u.user_id, u.name, u.email, u.role, u.status FROM auth_sessions s JOIN users u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP() AND u.status = 'ACTIVE'",
                    (rs, row) -> new AuthUser(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)),
                    hash(token));
            if (!users.isEmpty()) {
                AuthUser user = users.getFirst();
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + user.role()));
                if ("EMPLOYEE".equals(user.role()) && managerAccessService.isApprovedManager(user.id())) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_MANAGER"));
                    managerAccessService.permissions(user.id()).forEach(permission ->
                            authorities.add(new SimpleGrantedAuthority("PERM_" + permission)));
                }
                var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        chain.doFilter(request, response);
    }

    private String readCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash session token", exception);
        }
    }
}
