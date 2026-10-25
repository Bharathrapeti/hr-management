# Employee HR authentication backend

This Spring Boot backend provides server-side authentication and role-based access for the existing React application. It implements:

- Employee signup with email verification OTP
- Email/password login
- Database-backed server-side sessions using an HttpOnly cookie
- Forgot-password OTP and password reset
- BCrypt password hashes
- Single-use, expiring, attempt-limited OTPs
- OTP resend limits and login-attempt throttling
- CSRF protection for browser requests
- HR, employee, and derived manager access controls
- HR-controlled manager requests, explicit permissions, and employee assignments
- Disabled-by-default environment-based HR bootstrap provisioning

The backend uses the RDS MySQL architecture described in `../docs/phase-1-system-design.md`. The existing React app uses these authentication endpoints when `VITE_API_BASE_URL` is configured.

## Required configuration

Set these environment variables before starting:

```text
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/employee_hr_db
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
AUTH_MAIL_FROM=...
```

Spring resolves these values from environment variables first. The `${NAME:}`
form in `application.yml` supplies an empty or documented default only; it does
not contain credentials. An operator may provide equivalent placeholder values
through a deployment-specific `application-*.yml` or secret manager, but secret
files must remain outside source control.

Optional security settings include `SESSION_COOKIE_SECURE`, `AUTH_OTP_TTL`,
`AUTH_OTP_MAX_ATTEMPTS`, `AUTH_OTP_RESEND_SECONDS`, and
`AUTH_OTP_MAX_REQUESTS_PER_HOUR`.

Optional bootstrap settings are disabled by default:

```text
AUTH_BOOTSTRAP_HR_ENABLED=false
AUTH_BOOTSTRAP_HR_NAME=...
AUTH_BOOTSTRAP_HR_EMAIL=...
AUTH_BOOTSTRAP_HR_PASSWORD=...
```

When deliberately enabled by an authorized deployment operator, bootstrap creates
one active `HR_ADMIN` account transactionally, never resets an existing password,
and must be disabled again after successful provisioning. No credentials or OTP
values are stored in source code or logs. Email delivery is not available until
the SMTP variables are configured and tested.

## Endpoints

Before POST requests, call `GET /api/auth/csrf` and send the returned token in
the `X-XSRF-TOKEN` header. The CSRF cookie is issued by Spring Security.

```text
GET  /api/auth/csrf
GET  /api/auth/me
POST /api/auth/signup
POST /api/auth/signup/verify
POST /api/auth/invitation/activate
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/password/forgot
POST /api/auth/password/reset
```

`/api/auth/password/reset` requires `email`, `otp`, `newPassword`, and
`confirmPassword`.

The signup endpoint creates employee accounts only. HR accounts are created only
through the disabled-by-default bootstrap mechanism. Manager access is derived
from an approved employee request, explicit HR-granted permissions, and HR-managed
employee assignments; it is not a persisted primary role.

Manager permissions are limited to `VIEW_ASSIGNED_EMPLOYEES`,
`UPDATE_ASSIGNED_EMPLOYEE_PROFILE`, `VIEW_ASSIGNED_ATTENDANCE`, and
`REVIEW_ASSIGNED_LEAVE`. Leave access is read-only.

The manager-access schema is in `V2__manager_access.sql`. This migration is
forward-only source code and must be reviewed and explicitly approved before it
is applied to any database.

## Run

Maven is required:

```powershell
cd backend
mvn spring-boot:run
```

Do not enable HR bootstrap, start the application against a configured database,
or apply Flyway migrations as part of source review. No real HR account is
provisioned by default.

## Tests

The normal Maven test command runs non-Docker contract tests and compiles the
integration suite:

```powershell
mvn test
```

The MySQL integration suite is tagged `integration` and excluded by default.
Run it explicitly after installing Docker Desktop:

```powershell
mvn -DskipIntegrationTests= -Dtest=AuthAuthenticationIntegrationTest test
```

The integration suite uses Testcontainers with MySQL 8.4 and covers signup,
OTP verification, expiry, reuse, attempt limits, resend throttling, login,
forgot-password response consistency, password reset, session revocation,
logout cookie clearing, CSRF, unauthorized routes, and public employee-role
signup.
