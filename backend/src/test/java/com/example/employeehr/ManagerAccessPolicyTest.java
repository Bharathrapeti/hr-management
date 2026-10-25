package com.example.employeehr;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.employeehr.manager.service.ManagerAccessService;
import org.junit.jupiter.api.Test;

class ManagerAccessPolicyTest {
    @Test
    void exposesOnlyTheExplicitManagerPermissionAllowlist() {
        assertThat(ManagerAccessService.PERMISSIONS)
                .containsExactlyInAnyOrder(
                        "VIEW_ASSIGNED_EMPLOYEES",
                        "UPDATE_ASSIGNED_EMPLOYEE_PROFILE",
                        "VIEW_ASSIGNED_ATTENDANCE",
                        "REVIEW_ASSIGNED_LEAVE")
                .doesNotContain("*", "ADMIN", "APPROVE_LEAVE");
    }
}
