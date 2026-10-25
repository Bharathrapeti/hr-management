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
});
