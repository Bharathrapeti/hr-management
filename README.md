# Employee HR Management System

This is the local academic prototype for the Employee Attendance and HR Management System.

## Run locally

From the repository root:

```bash
pnpm install
pnpm --filter @workspace/employee-hr-system run dev
```

The Replit workflow supplies `PORT` and `BASE_PATH`. If running outside the workflow, use:

```bash
PORT=20453 BASE_PATH=/ pnpm --filter @workspace/employee-hr-system run dev
```

Open:

```text
http://localhost:20453/
```

## Local demo behavior

The existing dashboard prototype still uses browser `localStorage` for unrelated
seeded attendance and leave views. Authentication and role authority are handled
by the Spring Boot backend when it is configured. It includes:

- Employee and HR/Admin demo entry
- Employee dashboard, profile, attendance, and leave workflows
- HR dashboard, employee management, leave review, attendance view, and reports
- Persistent check-in, check-out, leave, approval, and status changes
- Local demo reset in Settings

### Google Sign-In setup

The login page includes an optional Google Identity Services button. To enable it locally:

1. Create a Web OAuth client ID in Google Cloud Console.
2. Add `http://localhost:20453` as an authorized JavaScript origin.
3. Create `.env.local` in this app folder with:

```text
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

4. Restart the Vite server after changing the environment file.

This prototype reads the Google credential in the browser and routes successful sign-in to the employee demo. It does not verify tokens on a server, so it must not be used as production authentication until a backend performs token verification and account/role mapping.

The local email/password demo accounts are:

```text
Employee: employee@northstar.edu / Employee@123
HR:       hr@northstar.edu       / HrAdmin@123
```

Signup, OTP verification, login, manager access, and password reset use the
Spring Boot API when `VITE_API_BASE_URL` is configured. The browser does not
authoritatively store roles, permissions, passwords, OTPs, or sessions.

This is not production authentication. The next implementation stage will connect the user interface to Spring Boot, RDS MySQL, DynamoDB, and private S3 according to `docs/phase-1-system-design.md`.

## Main source files

```text
src/
├── App.tsx                 # Application state, routes, demo data, and screens
├── index.css               # Product theme and responsive styling
├── main.tsx                # React entry point
├── components/
│   ├── error-boundary.tsx
│   └── ui/                 # Reusable interface primitives
├── hooks/                  # Shared React hooks
├── lib/utils.ts            # Shared class-name helper
└── pages/not-found.tsx     # Fallback route
```
