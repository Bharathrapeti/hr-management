package com.example.employeehr.auth.model;

public record AuthUser(long id, String name, String email, String role, String status) {
}
