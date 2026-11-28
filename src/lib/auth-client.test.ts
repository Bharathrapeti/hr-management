import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureCsrf,
  authRequest,
  getInMemoryCsrfToken,
  setInMemoryCsrfToken,
  resetCsrfState,
} from './auth-client.ts';

test('CSRF lifecycle and synchronization regression tests', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
    resetCsrfState();
  });

  await t.test('ensureCsrf fetches from /api/auth/csrf and caches in-memory token', async () => {
    let fetchCalled = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      fetchCalled++;
      assert.match(url.toString(), /\/api\/auth\/csrf$/);
      return new Response(
        JSON.stringify({
          token: 'csrf-token-123',
          parameterName: '_csrf',
          headerName: 'X-XSRF-TOKEN',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const token = await ensureCsrf(true);
    assert.equal(token, 'csrf-token-123');
    assert.equal(getInMemoryCsrfToken(), 'csrf-token-123');
    assert.equal(fetchCalled, 1);

    // Subsequent call without force reuses cached token without additional fetch
    const cached = await ensureCsrf(false);
    assert.equal(cached, 'csrf-token-123');
    assert.equal(fetchCalled, 1);
  });

  await t.test('concurrent calls to ensureCsrf share the same in-flight promise', async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(
        JSON.stringify({
          token: 'shared-csrf-token',
          parameterName: '_csrf',
          headerName: 'X-XSRF-TOKEN',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const [t1, t2, t3] = await Promise.all([
      ensureCsrf(true),
      ensureCsrf(true),
      ensureCsrf(true),
    ]);

    assert.equal(t1, 'shared-csrf-token');
    assert.equal(t2, 'shared-csrf-token');
    assert.equal(t3, 'shared-csrf-token');
    assert.equal(fetchCount, 1, 'Only one fetch should be dispatched for concurrent callers');
  });

  await t.test('startup sequencing: ensureCsrf completes before /api/auth/me is called', async () => {
    const callOrder: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/csrf')) {
        callOrder.push('csrf');
        return new Response(
          JSON.stringify({ token: 'initial-csrf-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/auth/me')) {
        callOrder.push('me');
        // Unauthenticated session returns 403
        return new Response('', { status: 403 });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    // Simulate startup sequence in AppContent
    await ensureCsrf(true);
    try {
      await authRequest('/api/auth/me');
    } catch {
      // Expected unauthenticated rejection
    }

    assert.deepEqual(callOrder, ['csrf', 'me'], 'CSRF initialization must complete before /api/auth/me');
    assert.equal(getInMemoryCsrfToken(), 'initial-csrf-token', 'GET /api/auth/me 403 must not wipe CSRF token');
  });

  await t.test('mutating requests attach X-XSRF-TOKEN header matching cached token', async () => {
    setInMemoryCsrfToken('active-token-abc');
    let capturedHeader: string | null = null;

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      capturedHeader = headers.get('X-XSRF-TOKEN');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await authRequest('/api/test', { method: 'POST', body: '{}' });
    assert.equal(capturedHeader, 'active-token-abc');

    // GET requests must NOT attach X-XSRF-TOKEN
    capturedHeader = null;
    await authRequest('/api/test', { method: 'GET' });
    assert.equal(capturedHeader, null);
  });

  await t.test('mutating request automatically fetches CSRF token if in-memory token is absent', async () => {
    resetCsrfState();
    let csrfFetched = false;
    let mutationHeader: string | null = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/csrf')) {
        csrfFetched = true;
        return new Response(
          JSON.stringify({ token: 'auto-fetched-token-999' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/test-mutation')) {
        const headers = new Headers(init?.headers);
        mutationHeader = headers.get('X-XSRF-TOKEN');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const res = await authRequest<{ ok: boolean }>('/api/test-mutation', { method: 'POST', body: '{}' });
    assert.equal(res.ok, true);
    assert.equal(csrfFetched, true, 'Must have auto-fetched CSRF token before mutating request');
    assert.equal(mutationHeader, 'auto-fetched-token-999', 'Must attach auto-fetched CSRF token');
    assert.equal(getInMemoryCsrfToken(), 'auto-fetched-token-999');
  });

  await t.test('login with retryOnCsrf=true retries once on confirmed CSRF 403', async () => {
    let attempt = 0;
    setInMemoryCsrfToken('stale-token');

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/csrf')) {
        return new Response(
          JSON.stringify({ token: 'fresh-synchronized-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/auth/login')) {
        attempt++;
        const headers = new Headers(init?.headers);
        if (headers.get('X-XSRF-TOKEN') === 'stale-token') {
          // First attempt with stale token produces 403 without body
          return new Response('', { status: 403 });
        }
        if (headers.get('X-XSRF-TOKEN') === 'fresh-synchronized-token') {
          return new Response(
            JSON.stringify({ id: 1, name: 'Maya', email: 'maya@example.com', role: 'EMPLOYEE' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const result = await authRequest<{ id: number }>('/api/auth/login', { method: 'POST', body: '{}' }, true);
    assert.equal(result.id, 1);
    assert.equal(attempt, 2, 'Login should retry once after refreshing CSRF token');
    assert.equal(getInMemoryCsrfToken(), 'fresh-synchronized-token');
  });

  await t.test('signup with retryOnCsrf=false does NOT retry on CSRF 403 to prevent duplicate side-effects', async () => {
    let signupAttempts = 0;
    setInMemoryCsrfToken('mismatched-token');

    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/signup')) {
        signupAttempts++;
        return new Response('', { status: 403 });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await authRequest('/api/auth/signup', { method: 'POST', body: '{}' }, false);
      },
      /Security validation failed/
    );

    assert.equal(signupAttempts, 1, 'Mutating operations like signup must not auto-retry');
    assert.equal(getInMemoryCsrfToken(), null, 'Stale token must be cleared upon CSRF failure');
  });

  await t.test('password forgot with retryOnCsrf=true retries once on confirmed CSRF 403', async () => {
    let attempt = 0;
    setInMemoryCsrfToken('stale-forgot-token');

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/csrf')) {
        return new Response(
          JSON.stringify({ token: 'fresh-forgot-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/auth/password/forgot')) {
        attempt++;
        const headers = new Headers(init?.headers);
        if (headers.get('X-XSRF-TOKEN') === 'stale-forgot-token') {
          return new Response('', { status: 403 });
        }
        if (headers.get('X-XSRF-TOKEN') === 'fresh-forgot-token') {
          return new Response(
            JSON.stringify({ message: 'If the account exists, a password reset code has been sent.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const result = await authRequest<{ message: string }>(
      '/api/auth/password/forgot',
      { method: 'POST', body: JSON.stringify({ email: 'user@example.com' }) },
      true
    );
    assert.equal(result.message, 'If the account exists, a password reset code has been sent.');
    assert.equal(attempt, 2, 'Forgot-password should retry once after refreshing CSRF token');
    assert.equal(getInMemoryCsrfToken(), 'fresh-forgot-token');
  });

  await t.test('personal details: employee can view details and HR can update details', async () => {
    setInMemoryCsrfToken('valid-csrf-token');
    let putCalled = false;
    let putPayload = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/employee/personal-details')) {
        return new Response(
          JSON.stringify({
            id: 10,
            fullName: 'Alex Smith',
            email: 'alex@northstar.edu',
            gender: 'Non-binary',
            dateOfBirth: '1995-05-15',
            age: 30,
            residentialAddress: '123 Pine St',
            mobileNumber: '+1 555-0123',
            role: 'EMPLOYEE',
            status: 'ACTIVE',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/hr/employees/10/personal-details') && init?.method === 'PUT') {
        putCalled = true;
        putPayload = init?.body as string;
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('X-XSRF-TOKEN'), 'valid-csrf-token');
        return new Response(
          JSON.stringify({ message: 'Personal details updated successfully.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const details = await authRequest<{ id: number; fullName: string; age: number }>('/api/employee/personal-details');
    assert.equal(details.id, 10);
    assert.equal(details.fullName, 'Alex Smith');
    assert.equal(details.age, 30);

    const updateRes = await authRequest<{ message: string }>(
      '/api/hr/employees/10/personal-details',
      {
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Alex Smith',
          gender: 'Non-binary',
          dateOfBirth: '1995-05-15',
          residentialAddress: '456 Oak Ave',
          mobileNumber: '+1 555-9876',
        }),
      }
    );
    assert.equal(putCalled, true);
    assert.match(putPayload, /456 Oak Ave/);
    assert.equal(updateRes.message, 'Personal details updated successfully.');
  });

  await t.test('manager approval workflow: manager can review, approve, and reject assigned registrations', async () => {
    setInMemoryCsrfToken('valid-manager-token');
    let approvedId: string | null = null;
    let rejectedId: string | null = null;
    let rejectBody = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/manager/pending-registrations') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify([
            { id: 25, name: 'Taylor Swift', email: 'taylor@northstar.edu', role: 'EMPLOYEE', status: 'PENDING_APPROVAL' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.includes('/api/manager/pending-registrations/25/approve') && init?.method === 'POST') {
        approvedId = '25';
        return new Response(
          JSON.stringify({ message: 'Employee registration approved.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.includes('/api/manager/pending-registrations/26/reject') && init?.method === 'POST') {
        rejectedId = '26';
        rejectBody = init?.body as string;
        return new Response(
          JSON.stringify({ message: 'Employee registration rejected.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const list = await authRequest<Array<{ id: number; name: string }>>('/api/manager/pending-registrations');
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Taylor Swift');

    await authRequest('/api/manager/pending-registrations/25/approve', { method: 'POST', body: '{}' });
    assert.equal(approvedId, '25');

    await authRequest('/api/manager/pending-registrations/26/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Unverified ID' }),
    });
    assert.equal(rejectedId, '26');
    assert.match(rejectBody, /Unverified ID/);
  });

  await t.test('employee correction request and HR assignment workflows', async () => {
    setInMemoryCsrfToken('valid-token');
    let correctionSubmitted = false;
    let managerAssigned = false;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/employee/correction-requests') && init?.method === 'POST') {
        correctionSubmitted = true;
        assert.match(init?.body as string, /Update phone number/);
        return new Response(
          JSON.stringify({ message: 'Correction request submitted for HR review.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (path.endsWith('/api/hr/employee-registrations/35/assign-manager') && init?.method === 'POST') {
        managerAssigned = true;
        assert.match(init?.body as string, /"managerUserId":50/);
        return new Response(
          JSON.stringify({ message: 'Manager assigned to employee registration.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await authRequest('/api/employee/correction-requests', {
      method: 'POST',
      body: JSON.stringify({ requestedChanges: 'Update phone number' }),
    });
    assert.equal(correctionSubmitted, true);

    await authRequest('/api/hr/employee-registrations/35/assign-manager', {
      method: 'POST',
      body: JSON.stringify({ managerUserId: 50 }),
    });
    assert.equal(managerAssigned, true);
  });

  await t.test('error classification: GET 403 reports authorization failure, not CSRF', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/hr/employee-registrations')) {
        return new Response('', { status: 403 });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await authRequest('/api/hr/employee-registrations', { method: 'GET' });
      },
      (err: Error) => {
        assert.equal(err.message, 'You do not have permission to perform this action.');
        assert.doesNotMatch(err.message, /Security validation failed/);
        return true;
      }
    );
  });

  await t.test('error classification: 401 reports authentication required or session expired', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/me')) {
        return new Response('', { status: 401 });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await authRequest('/api/auth/me', { method: 'GET' });
      },
      (err: Error) => {
        assert.equal(err.message, 'Authentication is required or the session is no longer valid. Please sign in again.');
        return true;
      }
    );
  });

  await t.test('error classification: preserves backend application errors (e.g. pending approval, invalid credentials)', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/login')) {
        return new Response(
          JSON.stringify({ error: 'Your account is pending HR administrator approval.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await authRequest('/api/auth/login', { method: 'POST', body: '{}' });
      },
      (err: Error) => {
        assert.equal(err.message, 'Your account is pending HR administrator approval.');
        return true;
      }
    );
  });

  await t.test('employee identity isolation: /api/auth/me returns unique employeeId for new account', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/me')) {
        return new Response(
          JSON.stringify({
            id: 88,
            name: 'New Employee',
            email: 'new.employee@northstar.edu',
            role: 'EMPLOYEE',
            effectiveRoles: ['EMPLOYEE'],
            permissions: [],
            employeeId: 'EMP-1043',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const user = await authRequest<any>('/api/auth/me', { method: 'GET' });
    assert.equal(user.name, 'New Employee');
    assert.equal(user.email, 'new.employee@northstar.edu');
    assert.equal(user.employeeId, 'EMP-1043');
    // Must never match Maya Chen, Jon Bell, Priya Nair, or Elliot Hart
    assert.notEqual(user.employeeId, 'EMP-1042');
    assert.notEqual(user.employeeId, 'EMP-1037');
    assert.notEqual(user.employeeId, 'EMP-1028');
    assert.notEqual(user.employeeId, 'EMP-0991');
  });

  await t.test('employee self-deletion: /api/employee/account/delete sends confirmation word Delete', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    let called = false;
    let receivedPayload = '';
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/employee/account/delete')) {
        called = true;
        assert.equal(init?.method, 'POST');
        receivedPayload = init?.body as string;
        return new Response(JSON.stringify({ message: 'Account deleted successfully.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const res = await authRequest<{ message: string }>('/api/employee/account/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Delete' }),
    });
    assert.equal(called, true);
    assert.match(receivedPayload, /"confirmation":"Delete"/);
    assert.match(res.message, /deleted/i);
  });

  await t.test('HR account deletion for employees and managers with Delete confirmation', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    const deletedTargets: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      assert.equal(init?.method, 'POST');
      const body = JSON.parse((init?.body as string) || '{}');
      assert.equal(body.confirmation, 'Delete');
      if (path.includes('/api/hr/employees/15/delete')) {
        deletedTargets.push('employee-15');
        return new Response(JSON.stringify({ message: 'User account permanently deleted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/api/hr/users/22/delete')) {
        deletedTargets.push('manager-22');
        return new Response(JSON.stringify({ message: 'User account permanently deleted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await authRequest('/api/hr/employees/15/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Delete' }),
    });
    await authRequest('/api/hr/users/22/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Delete' }),
    });

    assert.deepEqual(deletedTargets, ['employee-15', 'manager-22']);
  });

  await t.test('HR account deletion accepts string employee-id and email identifiers', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    const deletedTargets: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      assert.equal(init?.method, 'POST');
      const body = JSON.parse((init?.body as string) || '{}');
      assert.equal(body.confirmation, 'Delete');
      if (path.includes('/api/hr/employees/EMP-1042/delete')) {
        deletedTargets.push('EMP-1042');
        return new Response(JSON.stringify({ message: 'User account permanently deleted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/api/hr/employees/maya.chen%40northstar.edu/delete')) {
        deletedTargets.push('maya.chen@northstar.edu');
        return new Response(JSON.stringify({ message: 'User account permanently deleted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await authRequest('/api/hr/employees/EMP-1042/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Delete' }),
    });
    await authRequest('/api/hr/employees/maya.chen%40northstar.edu/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Delete' }),
    });

    assert.deepEqual(deletedTargets, ['EMP-1042', 'maya.chen@northstar.edu']);
  });

  await t.test('HR employee deactivation and activation endpoints', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    const actionsCalled: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.includes('/api/hr/employees/5/deactivate')) {
        actionsCalled.push('deactivate');
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify({ message: 'Employee deactivated.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.includes('/api/hr/employees/5/activate')) {
        actionsCalled.push('activate');
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify({ message: 'Employee activated.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await authRequest('/api/hr/employees/5/deactivate', { method: 'POST', body: '{}' });
    await authRequest('/api/hr/employees/5/activate', { method: 'POST', body: '{}' });
    assert.deepEqual(actionsCalled, ['deactivate', 'activate']);
  });

  await t.test('manager access request with optional reason and HR access control card query', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    let sentReason: string | null = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/manager-access/requests') && init?.method === 'POST') {
        const parsed = JSON.parse((init?.body as string) || '{}');
        sentReason = parsed.reason || null;
        return new Response(JSON.stringify({ message: 'Manager-access request submitted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (path.endsWith('/api/hr/manager-access/requests') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              status: 'PENDING',
              submittedAt: '2026-11-23T01:00:00Z',
              reviewedAt: null,
              reviewReason: 'Leading team coordinates',
              requesterUserId: 15,
              requesterName: 'Alex Morgan',
              requesterEmail: 'alex.morgan@northstar.edu',
              requesterEmployeeId: 'EMP-1050',
              reviewerHrUserId: null,
              reviewerName: null,
              requestType: 'Manager Access Request',
              requestedPermissions: 'Standard Manager Access',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    await authRequest('/api/manager-access/requests', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Leading team coordinates' }),
    });
    assert.equal(sentReason, 'Leading team coordinates');

    const requests = await authRequest<any[]>('/api/hr/manager-access/requests');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].requesterName, 'Alex Morgan');
    assert.equal(requests[0].requesterEmail, 'alex.morgan@northstar.edu');
    assert.equal(requests[0].requesterEmployeeId, 'EMP-1050');
    assert.equal(requests[0].requestType, 'Manager Access Request');
    assert.equal(requests[0].reviewReason, 'Leading team coordinates');
    assert.equal(requests[0].status, 'PENDING');
  });

  await t.test('HR managers directory listing, team assignment, and permission scopes', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    const calledEndpoints: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      calledEndpoints.push(`${init?.method || 'GET'} ${path}`);

      if (path.endsWith('/api/hr/managers') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify([
            {
              id: 40,
              name: 'Jon Bell',
              email: 'jon.bell@northstar.edu',
              role: 'EMPLOYEE',
              status: 'ACTIVE',
              employeeId: 'EMP-1037',
              assignedCount: 2,
              permissions: ['VIEW_ASSIGNED_EMPLOYEES', 'REVIEW_ASSIGNED_LEAVE'],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (path.endsWith('/api/hr/managers') && init?.method === 'POST') {
        const body = JSON.parse((init?.body as string) || '{}');
        assert.equal(body.name, 'Elena Rostova');
        assert.equal(body.email, 'elena.rostova@northstar.edu');
        return new Response(JSON.stringify({ message: 'Manager profile configured.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.includes('/api/hr/managers/40/assignments') && init?.method === 'POST') {
        const body = JSON.parse((init?.body as string) || '{}');
        assert.equal(body.employeeId, 15);
        return new Response(JSON.stringify({ message: 'Employee assigned to manager.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.includes('/api/hr/managers/40/permissions') && init?.method === 'POST') {
        const body = JSON.parse((init?.body as string) || '{}');
        assert.equal(body.permission, 'VIEW_ASSIGNED_ATTENDANCE');
        return new Response(JSON.stringify({ message: 'Manager permission granted.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected url: ${path}`);
    }) as typeof fetch;

    const list = await authRequest<any[]>('/api/hr/managers');
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Jon Bell');
    assert.equal(list[0].assignedCount, 2);
    assert.deepEqual(list[0].permissions, ['VIEW_ASSIGNED_EMPLOYEES', 'REVIEW_ASSIGNED_LEAVE']);

    const createRes = await authRequest<{ message: string }>('/api/hr/managers', {
      method: 'POST',
      body: JSON.stringify({ name: 'Elena Rostova', email: 'elena.rostova@northstar.edu', department: 'Operations' }),
    });
    assert.equal(createRes.message, 'Manager profile configured.');

    const assignRes = await authRequest<{ message: string }>('/api/hr/managers/40/assignments', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 15 }),
    });
    assert.equal(assignRes.message, 'Employee assigned to manager.');

    const permRes = await authRequest<{ message: string }>('/api/hr/managers/40/permissions', {
      method: 'POST',
      body: JSON.stringify({ permission: 'VIEW_ASSIGNED_ATTENDANCE' }),
    });
    assert.equal(permRes.message, 'Manager permission granted.');
  });

  await t.test('Employee and Manager signup submits complete profile details and resume payload', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    const receivedBodies: any[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const path = url.toString();
      if (path.endsWith('/api/auth/signup') && init?.method === 'POST') {
        const body = JSON.parse((init?.body as string) || '{}');
        receivedBodies.push(body);
        return new Response(JSON.stringify({ message: 'Verification OTP sent if SMTP is configured.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected endpoint: ${path}`);
    }) as typeof fetch;

    // Test Employee signup payload
    const empPayload = {
      name: 'Alex Rawles',
      firstName: 'Alex',
      lastName: 'Rawles',
      email: 'alex.rawles@northstar.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      accountType: 'EMPLOYEE',
      jobRole: 'Software Developer',
      age: 26,
      gender: 'Male',
      resumeFileName: 'alex_rawles_resume.pdf',
      resumeContentType: 'application/pdf',
      resumeFileSize: 1048576,
      resumeData: 'data:application/pdf;base64,JVBERi0xLjQK...',
    };

    const empRes = await authRequest<{ message: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(empPayload),
    });
    assert.equal(empRes.message, 'Verification OTP sent if SMTP is configured.');

    // Test Manager signup payload
    const mgrPayload = {
      name: 'Sarah Connor',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@northstar.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      accountType: 'MANAGER',
      jobRole: 'Operations Manager',
      age: 34,
      gender: 'Female',
      resumeFileName: 'sarah_connor_cv.pdf',
      resumeContentType: 'application/pdf',
      resumeFileSize: 2097152,
      resumeData: 'data:application/pdf;base64,JVBERi0xLjQK...',
    };

    const mgrRes = await authRequest<{ message: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(mgrPayload),
    });
    assert.equal(mgrRes.message, 'Verification OTP sent if SMTP is configured.');

    assert.equal(receivedBodies.length, 2);
    assert.equal(receivedBodies[0].firstName, 'Alex');
    assert.equal(receivedBodies[0].lastName, 'Rawles');
    assert.equal(receivedBodies[0].jobRole, 'Software Developer');
    assert.equal(receivedBodies[0].age, 26);
    assert.equal(receivedBodies[0].gender, 'Male');
    assert.equal(receivedBodies[0].resumeFileName, 'alex_rawles_resume.pdf');

    assert.equal(receivedBodies[1].firstName, 'Sarah');
    assert.equal(receivedBodies[1].lastName, 'Connor');
    assert.equal(receivedBodies[1].accountType, 'MANAGER');
    assert.equal(receivedBodies[1].jobRole, 'Operations Manager');
    assert.equal(receivedBodies[1].age, 34);
    assert.equal(receivedBodies[1].gender, 'Female');
    assert.equal(receivedBodies[1].resumeFileName, 'sarah_connor_cv.pdf');
  });

  await t.test('HR and Employee resume retrieval endpoint integration', async () => {
    setInMemoryCsrfToken('mock-csrf-token');
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = url.toString();
      if (path.includes('/api/hr/users/55/resume') || path.includes('/api/auth/users/55/resume')) {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="alex_rawles_resume.pdf"',
          },
        });
      }
      throw new Error(`Unexpected endpoint: ${path}`);
    }) as typeof fetch;

    const res = await fetch('http://localhost:8080/api/hr/users/55/resume');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/pdf');
    const disposition = res.headers.get('Content-Disposition');
    assert.ok(disposition?.includes('alex_rawles_resume.pdf'));
  });
});
