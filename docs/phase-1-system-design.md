# Employee Attendance and HR Management System

## 1. Phase 1 outcome

This document is the source of truth for the first phase of the academic project. It defines:

- the users and permissions
- the functional modules
- the system and AWS architecture
- the responsibility of each data store
- the initial relational database design
- the application folder structure
- the development sequence and phase exit criteria

Implementation and AWS provisioning start only after this design is accepted and stable.

## 2. Product scope

The system is a cloud-hosted web application for employee attendance and basic HR operations.

### In scope for the first complete demonstration

1. Secure employee and HR/Admin sign-in.
2. Role-based access control.
3. Employee profiles and employee administration.
4. Daily check-in and check-out.
5. Attendance history and working-hours calculation.
6. Leave application, approval, rejection, and status history.
7. Employee and HR dashboards.
8. Authorized document upload and download.
9. Daily, monthly, employee, and leave reports.
10. AWS deployment using VPC, EC2, RDS MySQL, DynamoDB, S3, ALB, Auto Scaling, IAM, Security Groups, and CloudWatch.

### Deliberately out of scope for the first version

- payroll and salary processing
- biometric devices
- GPS tracking
- shift rostering
- public employee self-registration without HR approval
- multi-company tenancy
- mobile apps
- payroll tax and statutory compliance

These can be listed as future enhancements in the project report.

## 3. Users and permissions

### Employee

An employee can:

- sign in and sign out
- view their own profile and employment details
- check in once per local work date
- check out only after checking in
- view their own attendance and working hours
- submit leave requests
- view their own leave history and decision status
- upload documents when the HR configuration permits it

An employee cannot:

- view another employee's profile or attendance
- approve or reject leave
- create, deactivate, or edit another employee
- view HR-only documents or reports

### HR/Admin

An HR/Admin user can:

- sign in and sign out
- view the HR dashboard
- create, update, view, and deactivate employees
- view daily and individual attendance
- identify present, absent, and on-leave employees
- review, approve, or reject leave requests
- generate and download authorized reports
- access employee documents according to authorization

The first version uses one administrative role. A separate super-admin role is not required until the project needs multiple levels of administration.

## 4. Functional modules

### Authentication and authorization

- Login with email and password.
- Passwords stored only as secure hashes.
- Server-side authorization on every protected endpoint.
- Session/token handling must not depend on a browser-only role flag.
- Inactive users cannot sign in.
- Logout invalidates the active session.

### Employee management

- Employee ID, name, email, phone, department, designation, joining date, and status.
- Department selection from controlled department records.
- Deactivation instead of destructive deletion so historical attendance and leave remain explainable.
- Email and employee ID uniqueness.

### Attendance

- One attendance record per employee per local work date.
- Check-in records the server time.
- Check-out requires an existing open record.
- Working hours are calculated on the server from timestamps.
- A duplicate request is rejected safely, including two requests arriving at nearly the same time.
- Attendance status is derived from the workflow: `PRESENT`, `COMPLETED`, or `INCOMPLETE`.

### Leave management

- Employee selects a leave type, date range, and reason.
- The server validates date order and prevents invalid overlapping pending/approved requests.
- HR sees pending requests and can approve or reject them.
- Every decision stores the approving HR user and decision time.
- Employees see the current status and decision information for their own requests.

### Documents

- Files are stored privately in S3.
- The database stores metadata and the S3 object key, not the file contents.
- Downloads use authorized, short-lived access rather than public bucket URLs.
- File type, size, owner, and category are validated before upload.

### Reports

- Daily attendance report.
- Monthly attendance summary.
- Individual employee attendance history.
- Leave report.
- Generated files are stored privately in S3 and tracked in the relational database.

### Dashboards

The HR dashboard shows total active employees, present today, absent today, employees on approved leave, pending leave requests, and recent attendance activity.

The employee dashboard shows the employee identity, department, today's attendance state, check-in, check-out, working hours, recent leave status, and attendance history.

Dashboard values are read from server endpoints. The frontend must not calculate authoritative HR totals from partial browser data.

## 5. Time and date rules

These rules prevent inconsistent attendance records across EC2 instances and future scaling:

1. The server records timestamps in UTC.
2. The business timezone is configured explicitly as `Asia/Kolkata` for the academic demonstration.
3. A "work date" is the business date in `Asia/Kolkata`, not the EC2 machine's local date.
4. The UI displays timestamps in the configured business timezone.
5. A future production deployment should make the business timezone a configuration value rather than hard-code it in business logic.
6. Working hours are calculated from UTC instants, then displayed as hours and minutes.

## 6. Target architecture

```text
Browser
   |
   | HTTPS
   v
Internet Gateway
   |
   v
Application Load Balancer
   |
   | forwards only to healthy application targets
   v
Private application subnets
   |----------------------|----------------------|
   v                      v                      v
EC2 app instance 1   EC2 app instance 2   EC2 app instance N
   |                      |                      |
   | IAM instance role    | IAM instance role    | IAM instance role
   |----------------------|----------------------|
             Spring Boot application
             |          |          |
             v          v          v
       RDS MySQL   DynamoDB       Private S3 bucket
       (HR data)   (attendance)   (documents/reports)
```

### Network placement

- The VPC is the private network boundary.
- Public subnets contain the Application Load Balancer and the route to the Internet Gateway.
- EC2 application instances are placed in private subnets and receive traffic from the ALB only.
- RDS is placed in private database subnets and is not publicly accessible.
- DynamoDB and S3 are AWS-managed services. Private access should use VPC endpoints where practical so application traffic does not need public internet routing.
- NAT Gateway is optional for the smallest academic setup. If private EC2 instances need outbound package updates or external calls, add a NAT Gateway deliberately because it creates additional cost.

### Security group flow

| Source | Destination | Port | Reason |
|---|---|---:|---|
| Internet | ALB | 443 | Public HTTPS application traffic |
| ALB security group | EC2 security group | Application port | Forwarded user requests |
| EC2 security group | RDS security group | 3306 | Spring Boot to MySQL |
| EC2 security group | DynamoDB/S3 endpoints | HTTPS | AWS SDK service access |
| Administrator workstation | EC2 | No direct application access by default | Avoid bypassing the ALB |

SSH should be restricted to a controlled administrative path and should not be opened to the entire internet.

### Request and data flow

1. The browser sends an HTTPS request to the ALB.
2. The ALB forwards the request to a healthy EC2 instance.
3. Spring Boot authenticates the request and checks the user's role.
4. HR/profile/leave data is read from or written to RDS MySQL.
5. Attendance check-in/check-out is written to DynamoDB with a conditional write or update.
6. Document and report objects are uploaded to private S3.
7. The application returns only the data the current user is authorized to see.
8. CloudWatch receives infrastructure and application logs/metrics.

## 7. Data ownership

| Data | System of record | Why |
|---|---|---|
| Users, roles, credentials, status | RDS MySQL | Relational integrity and authorization queries |
| Employee profiles | RDS MySQL | Relationships to users, departments, leave, and document metadata |
| Departments | RDS MySQL | Controlled relational reference data |
| Leave requests | RDS MySQL | Workflow state, approver, and date-range queries |
| Attendance events | DynamoDB | High-volume date/employee access and conditional writes |
| Document/report binary content | S3 | Durable private object storage |
| Document/report metadata | RDS MySQL | Ownership, category, object key, and audit queries |
| Dashboard aggregates | Computed by the application | Avoids a second source of truth in the first version |

RDS and DynamoDB are intentionally not duplicated for the same attendance record. The relational database can receive report metadata or future summary tables later, but DynamoDB remains the attendance source of truth.

## 8. Relational database design

Database name: `employee_hr_db`

All tables use a primary key, foreign keys where relationships exist, timestamps, and status constraints. Exact SQL types and indexes will be finalized in Phase 2.

### `users`

| Column | Purpose |
|---|---|
| `user_id` | Primary key |
| `employee_id` | Nullable foreign key for an employee-linked login; unique when present |
| `email` | Unique login identifier |
| `password_hash` | Secure password hash; never plaintext |
| `role` | `EMPLOYEE` or `HR_ADMIN` |
| `status` | `ACTIVE` or `INACTIVE` |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |
| `last_login_at` | Optional audit timestamp |

The initial HR/Admin seed user may have no employee record, because HR users are system operators rather than ordinary employees.

### `departments`

| Column | Purpose |
|---|---|
| `department_id` | Primary key |
| `department_name` | Unique department name |
| `status` | `ACTIVE` or `INACTIVE` |
| `created_at` | Creation timestamp |

### `employees`

| Column | Purpose |
|---|---|
| `employee_id` | Primary key and human-readable employee identifier |
| `name` | Employee display name |
| `email` | Unique work email |
| `phone` | Optional contact number |
| `department_id` | Foreign key to `departments` |
| `designation` | Job title |
| `joining_date` | Employment start date |
| `status` | `ACTIVE` or `INACTIVE` |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

### `leave_requests`

| Column | Purpose |
|---|---|
| `leave_id` | Primary key |
| `employee_id` | Foreign key to `employees` |
| `leave_type` | Controlled value such as `ANNUAL`, `SICK`, or `PERSONAL` |
| `from_date` | Inclusive start date |
| `to_date` | Inclusive end date |
| `reason` | Employee explanation |
| `status` | `PENDING`, `APPROVED`, `REJECTED`, or `CANCELLED` |
| `applied_at` | Submission timestamp |
| `decided_at` | Optional HR decision timestamp |
| `approved_by` | Nullable foreign key to `users` |
| `decision_note` | Optional HR explanation |

Validation rules: `from_date <= to_date`, an active employee is required, and overlapping pending/approved requests for the same employee are rejected.

### `documents`

| Column | Purpose |
|---|---|
| `document_id` | Primary key |
| `employee_id` | Foreign key to `employees`; nullable for HR-owned documents |
| `uploaded_by` | Foreign key to `users` |
| `category` | Document category |
| `original_filename` | Display name only |
| `object_key` | Private S3 key |
| `content_type` | Validated MIME type |
| `size_bytes` | Validated file size |
| `created_at` | Upload timestamp |

### `reports`

| Column | Purpose |
|---|---|
| `report_id` | Primary key |
| `report_type` | Daily, monthly, employee, or leave report |
| `requested_by` | Foreign key to `users` |
| `object_key` | Private S3 key |
| `from_date` | Report range start |
| `to_date` | Report range end |
| `created_at` | Generation timestamp |

### Relationships

```text
departments 1 ---- * employees
employees   1 ---- 0..1 users
employees   1 ---- * leave_requests
users       1 ---- * leave_requests (approved_by)
employees   1 ---- * documents
users       1 ---- * documents (uploaded_by)
users       1 ---- * reports (requested_by)
```

Attendance is stored separately in DynamoDB:

- Table name: `Employee_Attendance`
- Partition key: `EmployeeID` (string)
- Sort key: `WorkDate` (string, `YYYY-MM-DD` in `Asia/Kolkata`)
- Attributes: `CheckInUtc`, `CheckOutUtc`, `Status`, `WorkingSeconds`, `CreatedAtUtc`, `UpdatedAtUtc`
- Global secondary index: `WorkDateIndex` with `WorkDate` as partition key and `EmployeeID` as sort key for HR daily views

The partition/sort key prevents duplicate records for one employee and one work date. Check-in uses a conditional put that succeeds only when the key does not already exist. Check-out updates only an existing record whose `CheckInUtc` exists and whose `CheckOutUtc` is absent.

## 9. Application folder structure

The target Spring Boot/Maven application will use a feature-oriented package structure while keeping the requested Controller, Service, Repository, Model, DTO, Configuration, Exception Handling, and Security layers visible.

```text
employee-hr-system/
├── pom.xml
├── README.md
├── docs/
│   ├── phase-1-system-design.md
│   ├── database/
│   │   └── relational-schema.sql
│   ├── aws/
│   │   ├── vpc-setup.md
│   │   ├── ec2-deployment.md
│   │   ├── rds-setup.md
│   │   ├── dynamodb-setup.md
│   │   ├── s3-setup.md
│   │   ├── load-balancer.md
│   │   ├── auto-scaling.md
│   │   └── monitoring-and-iam.md
│   └── presentation/
│       ├── project-report-outline.md
│       └── viva-questions.md
├── src/
│   ├── main/
│   │   ├── java/com/example/employeehr/
│   │   │   ├── EmployeeHrApplication.java
│   │   │   ├── config/
│   │   │   ├── security/
│   │   │   ├── exception/
│   │   │   ├── common/
│   │   │   ├── employee/
│   │   │   │   ├── controller/
│   │   │   │   ├── dto/
│   │   │   │   ├── model/
│   │   │   │   ├── repository/
│   │   │   │   └── service/
│   │   │   ├── attendance/
│   │   │   │   ├── controller/
│   │   │   │   ├── dto/
│   │   │   │   ├── model/
│   │   │   │   ├── repository/
│   │   │   │   └── service/
│   │   │   ├── leave/
│   │   │   ├── department/
│   │   │   ├── document/
│   │   │   ├── report/
│   │   │   └── dashboard/
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-local.yml
│   │       ├── application-aws.yml
│   │       ├── db/migration/
│   │       ├── static/
│   │       │   ├── css/
│   │       │   ├── js/
│   │       │   └── img/
│   │       └── templates/
│   │           ├── auth/
│   │           ├── employee/
│   │           └── hr/
│   └── test/
│       ├── java/com/example/employeehr/
│       └── resources/
├── scripts/
│   ├── seed-local-data.sh
│   └── package-application.sh
└── .gitignore
```

The frontend will use HTML, CSS, JavaScript, and Bootstrap as requested. Spring Boot serves the frontend assets and exposes the protected application endpoints.

## 10. Configuration and secrets

Configuration is environment-specific and must not contain credentials:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_DYNAMODB_ATTENDANCE_TABLE`
- `APP_TIMEZONE`
- session/signing secret managed through the deployment environment

On AWS, the EC2 instance profile supplies DynamoDB and S3 permissions. AWS access keys must not be committed to source code, application properties, or shell scripts.

## 11. Development order

The project will proceed in this order:

1. Requirements and architecture — this document.
2. Database schema, keys, constraints, and indexes.
3. Spring Boot/Maven project skeleton.
4. Bootstrap pages and navigation.
5. Authentication and role authorization.
6. Employee management.
7. Attendance with DynamoDB conditional operations.
8. Leave workflow.
9. RDS integration.
10. DynamoDB integration.
11. S3 document/report integration.
12. Local testing and verification.
13. AWS VPC.
14. EC2 deployment.
15. ALB and health checks.
16. Auto Scaling.
17. IAM and network hardening.
18. CloudWatch monitoring and alarms.
19. Complete functional/security testing.
20. Report, presentation, architecture diagram, expected results, limitations, and viva questions.

## 12. Phase 1 exit criteria

Phase 1 is complete when:

- all user roles and permissions are documented
- each feature has an owning module
- each data type has one defined system of record
- RDS, DynamoDB, and S3 responsibilities do not overlap ambiguously
- the AWS network flow and security-group flow are documented
- the relational entities and relationships are agreed
- the attendance key design prevents duplicate daily check-ins
- the project folder structure is fixed before implementation begins
