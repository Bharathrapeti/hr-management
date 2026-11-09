package com.example.employeehr.hr.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.employeehr.auth.service.EmailService;
import com.example.employeehr.auth.service.OtpService;
import com.example.employeehr.manager.service.ManagerAccessService;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class HrManagementServiceSchemaFallbackTest {

    private JdbcTemplate jdbc;
    private ManagerAccessService managerAccessService;
    private OtpService otpService;
    private EmailService emailService;
    private HrManagementService hrService;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        managerAccessService = mock(ManagerAccessService.class);
        otpService = mock(OtpService.class);
        emailService = mock(EmailService.class);
        hrService = new HrManagementService(jdbc, managerAccessService, otpService, emailService);
    }

    @Test
    void registrationsFallsBackWhenAssignedManagerColumnIsMissing() {
        SQLException sqlException = new SQLException("Unknown column 'u.assigned_manager_user_id' in 'field list'", "42S22", 1054);
        BadSqlGrammarException grammarException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(argThat((String sql) -> sql != null && sql.contains("assigned_manager_user_id")), any(RowMapper.class)))
                .thenThrow(grammarException);

        Instant now = Instant.now();
        when(jdbc.query(argThat((String sql) -> sql != null && !sql.contains("assigned_manager_user_id")), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(101L);
                    when(rs.getString(2)).thenReturn("Alice Employee");
                    when(rs.getString(3)).thenReturn("alice@example.com");
                    when(rs.getString(4)).thenReturn("EMPLOYEE");
                    when(rs.getString(5)).thenReturn("PENDING_APPROVAL");
                    when(rs.getTimestamp(6)).thenReturn(Timestamp.from(now));
                    when(rs.getTimestamp(7)).thenReturn(null);
                    when(rs.getObject(8)).thenReturn(null);
                    when(rs.getString(9)).thenReturn(null);
                    when(rs.getTimestamp(10)).thenReturn(null);
                    when(rs.getString(11)).thenReturn(null);
                    return List.of(mapper.mapRow(rs, 1));
                });

        List<HrManagementService.RegistrationView> result = hrService.registrations();

        assertThat(result).hasSize(1);
        HrManagementService.RegistrationView reg = result.getFirst();
        assertThat(reg.id()).isEqualTo(101L);
        assertThat(reg.name()).isEqualTo("Alice Employee");
        assertThat(reg.email()).isEqualTo("alice@example.com");
        assertThat(reg.status()).isEqualTo("PENDING_APPROVAL");
        assertThat(reg.assignedManagerUserId()).isNull();
        assertThat(reg.assignedManagerName()).isNull();
        assertThat(reg.needsHrReview()).isTrue();
    }

    @Test
    void registrationsRethrowsWhenUnrelatedDatabaseErrorOccurs() {
        SQLException sqlException = new SQLException("You have an error in your SQL syntax", "42000", 1064);
        BadSqlGrammarException syntaxException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(contains("u.assigned_manager_user_id"), any(RowMapper.class)))
                .thenThrow(syntaxException);

        assertThatThrownBy(() -> hrService.registrations())
                .isSameAs(syntaxException);
    }

    @Test
    void allCorrectionRequestsReturnsEmptyListWhenTableIsMissing() {
        SQLException sqlException = new SQLException("Table 'employee_hr_db.employee_correction_requests' doesn't exist", "42S02", 1146);
        BadSqlGrammarException missingTableException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(contains("FROM employee_correction_requests"), any(RowMapper.class)))
                .thenThrow(missingTableException);

        List<HrManagementService.CorrectionRequestView> result = hrService.allCorrectionRequests();

        assertThat(result).isEmpty();
    }

    @Test
    void allCorrectionRequestsRethrowsWhenUnrelatedDatabaseErrorOccurs() {
        SQLException sqlException = new SQLException("Syntax error near 'FROM'", "42000", 1064);
        BadSqlGrammarException syntaxException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(contains("FROM employee_correction_requests"), any(RowMapper.class)))
                .thenThrow(syntaxException);

        assertThatThrownBy(() -> hrService.allCorrectionRequests())
                .isSameAs(syntaxException);
    }

    @Test
    void employeeCorrectionRequestsReturnsEmptyListWhenTableIsMissing() {
        SQLException sqlException = new SQLException("Table 'employee_hr_db.employee_correction_requests' doesn't exist", "42S02", 1146);
        BadSqlGrammarException missingTableException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(contains("WHERE c.employee_user_id = ?"), any(RowMapper.class), eq(50L)))
                .thenThrow(missingTableException);

        List<HrManagementService.CorrectionRequestView> result = hrService.employeeCorrectionRequests(50L);

        assertThat(result).isEmpty();
    }

    @Test
    void getPersonalDetailsFallsBackWhenPersonalColumnsAreMissing() {
        SQLException sqlException = new SQLException("Unknown column 'gender' in 'field list'", "42S22", 1054);
        BadSqlGrammarException missingColumnException = new BadSqlGrammarException("query", "SELECT ...", sqlException);

        when(jdbc.query(contains("gender, date_of_birth"), any(RowMapper.class), eq(10L)))
                .thenThrow(missingColumnException);

        when(jdbc.query(contains("SELECT user_id, employee_id, name, email, role, status FROM users WHERE user_id = ?"),
                any(RowMapper.class), eq(10L)))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
                    when(rs.getLong(1)).thenReturn(10L);
                    when(rs.getString(2)).thenReturn("EMP-001");
                    when(rs.getString(3)).thenReturn("John PreV4");
                    when(rs.getString(4)).thenReturn("john@example.com");
                    when(rs.getString(5)).thenReturn("EMPLOYEE");
                    when(rs.getString(6)).thenReturn("ACTIVE");
                    return List.of(mapper.mapRow(rs, 1));
                });

        HrManagementService.PersonalDetailsView details = hrService.getPersonalDetails(10L);

        assertThat(details.userId()).isEqualTo(10L);
        assertThat(details.name()).isEqualTo("John PreV4");
        assertThat(details.gender()).isNull();
        assertThat(details.dateOfBirth()).isNull();
        assertThat(details.age()).isNull();
        assertThat(details.residentialAddress()).isNull();
        assertThat(details.mobileNumber()).isNull();
        assertThat(details.role()).isEqualTo("EMPLOYEE");
        assertThat(details.status()).isEqualTo("ACTIVE");
    }

    @Test
    void isMissingColumnErrorIdentifiesErrorCodeAndSqlState() {
        SQLException mysql1054 = new SQLException("Unknown column 'col' in 'field list'", "42S22", 1054);
        BadSqlGrammarException ex1054 = new BadSqlGrammarException("task", "sql", mysql1054);
        assertThat(HrManagementService.isMissingColumnError(ex1054, "col")).isTrue();

        SQLException syntaxError = new SQLException("Syntax error", "42000", 1064);
        BadSqlGrammarException exSyntax = new BadSqlGrammarException("task", "sql", syntaxError);
        assertThat(HrManagementService.isMissingColumnError(exSyntax, "col")).isFalse();
    }

    @Test
    void isMissingTableErrorIdentifiesErrorCodeAndSqlState() {
        SQLException mysql1146 = new SQLException("Table 'test.tbl' doesn't exist", "42S02", 1146);
        BadSqlGrammarException ex1146 = new BadSqlGrammarException("task", "sql", mysql1146);
        assertThat(HrManagementService.isMissingTableError(ex1146, "tbl")).isTrue();

        SQLException syntaxError = new SQLException("Syntax error", "42000", 1064);
        BadSqlGrammarException exSyntax = new BadSqlGrammarException("task", "sql", syntaxError);
        assertThat(HrManagementService.isMissingTableError(exSyntax, "tbl")).isFalse();
    }
}
