import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, ArrowRight, BarChart3, Bell, CalendarCheck2,
  CalendarDays, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download,
  FileText, Filter, LayoutDashboard, ListFilter, LogOut, Menu, Pencil, Plus,
  Search, Settings, ShieldCheck, UserCheck, UserCog, UserRound, Users,
  X, XCircle
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

import {
  type Role,
  type LoginMode,
  type AuthUser,
  type AuthMessage,
  authBaseUrl,
  ensureCsrf,
  authRequest,
  csrfCookie,
} from '@/lib/auth-client';

type Status = 'Active' | 'Inactive';
type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On leave';
type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
type User = { id: string; name: string; email: string; role: Role; status: Status };
type Employee = { id: string; name: string; email: string; phone: string; department: string; designation: string; joiningDate: string; status: Status };
type Attendance = { employeeId: string; workDate: string; checkIn: string; checkOut: string; status: AttendanceStatus; workingHours: string };
type LeaveRequest = { id: string; employeeId: string; employeeName: string; leaveType: string; fromDate: string; toDate: string; reason: string; status: LeaveStatus; appliedDate: string; approvedBy: string };
type Department = { id: string; name: string; employeeCount: number };
type DemoAccount = { email: string; password: string; role: Role };

type PersonalDetails = {
  id: number;
  fullName: string;
  email: string;
  gender: string | null;
  dateOfBirth: string | null;
  age: number | null;
  residentialAddress: string | null;
  mobileNumber: string | null;
  role: string;
  status: string;
};

type CorrectionRequest = {
  id: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
  requestedChanges: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  submittedAt: string;
  resolvedByHrUserId?: number | null;
  resolverName?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
};

type EligibleManager = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  employeeId?: string | null;
};

type BackendUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  employeeId?: string | null;
};

function computeAge(dobStr: string | null | undefined): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

const demoAccounts: DemoAccount[] = [];

const today = new Date().toISOString().slice(0, 10);
const seedEmployees: Employee[] = [
  { id: 'EMP-1042', name: 'Maya Chen', email: 'maya.chen@northstar.edu', phone: '+1 (415) 555-0193', department: 'Student Services', designation: 'Program Coordinator', joiningDate: '2023-08-14', status: 'Active' },
  { id: 'EMP-1037', name: 'Jon Bell', email: 'jon.bell@northstar.edu', phone: '+1 (415) 555-0158', department: 'Admissions', designation: 'Admissions Specialist', joiningDate: '2022-04-11', status: 'Active' },
  { id: 'EMP-1028', name: 'Priya Nair', email: 'priya.nair@northstar.edu', phone: '+1 (415) 555-0114', department: 'Academic Affairs', designation: 'Department Assistant', joiningDate: '2021-09-06', status: 'Active' },
  { id: 'EMP-0991', name: 'Elliot Hart', email: 'elliot.hart@northstar.edu', phone: '+1 (415) 555-0132', department: 'Library Services', designation: 'Library Associate', joiningDate: '2020-01-20', status: 'Inactive' },
];
const seedAttendance: Attendance[] = [
  { employeeId: 'EMP-1042', workDate: today, checkIn: '08:47', checkOut: '', status: 'Present', workingHours: '—' },
  { employeeId: 'EMP-1037', workDate: today, checkIn: '08:56', checkOut: '', status: 'Present', workingHours: '—' },
  { employeeId: 'EMP-1028', workDate: today, checkIn: '09:18', checkOut: '', status: 'Late', workingHours: '—' },
  { employeeId: 'EMP-0991', workDate: today, checkIn: '', checkOut: '', status: 'Absent', workingHours: '—' },
  { employeeId: 'EMP-1042', workDate: '2025-03-18', checkIn: '08:51', checkOut: '17:12', status: 'Present', workingHours: '8h 21m' },
  { employeeId: 'EMP-1042', workDate: '2025-03-17', checkIn: '08:43', checkOut: '17:04', status: 'Present', workingHours: '8h 21m' },
  { employeeId: 'EMP-1042', workDate: '2025-03-14', checkIn: '09:06', checkOut: '17:20', status: 'Late', workingHours: '8h 14m' },
];
const seedLeaves: LeaveRequest[] = [
  { id: 'LV-2208', employeeId: 'EMP-1037', employeeName: 'Jon Bell', leaveType: 'Personal leave', fromDate: '2025-03-24', toDate: '2025-03-24', reason: 'Family appointment', status: 'Pending', appliedDate: '2025-03-19', approvedBy: '—' },
  { id: 'LV-2207', employeeId: 'EMP-1042', employeeName: 'Maya Chen', leaveType: 'Annual leave', fromDate: '2025-04-03', toDate: '2025-04-04', reason: 'Personal travel', status: 'Approved', appliedDate: '2025-03-12', approvedBy: 'Avery Morgan' },
  { id: 'LV-2202', employeeId: 'EMP-1028', employeeName: 'Priya Nair', leaveType: 'Sick leave', fromDate: '2025-03-10', toDate: '2025-03-10', reason: 'Not feeling well', status: 'Approved', appliedDate: '2025-03-10', approvedBy: 'Avery Morgan' },
];
const seedDepartments: Department[] = [
  { id: 'D-01', name: 'Student Services', employeeCount: 18 },
  { id: 'D-02', name: 'Admissions', employeeCount: 12 },
  { id: 'D-03', name: 'Academic Affairs', employeeCount: 9 },
  { id: 'D-04', name: 'Library Services', employeeCount: 7 },
];

function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    try { return JSON.parse(saved) as T; } catch { return fallback; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}
function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function cx(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700', tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700', tone === 'danger' && 'border-rose-200 bg-rose-50 text-rose-700', tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-700', tone === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-600')}>{children}</span>;
}
function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'present' || s === 'active') return 'success';
  if (s === 'pending' || s === 'pending_approval' || s === 'late') return 'warning';
  if (s === 'rejected' || s === 'absent' || s === 'inactive') return 'danger';
  return 'neutral';
}
function Button({ children, variant = 'primary', className, onClick, type = 'button', disabled, testId }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; testId: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={cx('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-md', variant === 'secondary' && 'border border-border bg-card text-foreground hover:bg-muted', variant === 'ghost' && 'text-muted-foreground hover:bg-muted hover:text-foreground', variant === 'danger' && 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100', className)}>{children}</button>;
}
function SectionTitle({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mono mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="text-2xl font-bold tracking-[-.03em] text-foreground md:text-3xl">{title}</h1>{detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}</div>{action}</div>;
}
function StatCard({ label, value, detail, icon: Icon, accent = 'teal' }: { label: string; value: string; detail: string; icon: typeof Activity; accent?: 'teal' | 'amber' | 'sky' | 'rose' }) {
  const colors = { teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700', sky: 'bg-sky-50 text-sky-700', rose: 'bg-rose-50 text-rose-700' };
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tracking-[-.04em]">{value}</p></div><div className={cx('rounded-xl p-2.5', colors[accent])}><Icon size={19} /></div></div><p className="mt-4 text-xs text-muted-foreground">{detail}</p></div>;
}

function LogoMark() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md"><Clock3 size={21} strokeWidth={2.5} /></div><div><p className="text-[15px] font-bold leading-none tracking-tight text-white">Meridian</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">People operations</p></div></div>;
}

function Shell({ role, setRole, onSignOut, children }: { role: Role; setRole: (role: Role) => void; onSignOut: () => void; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const employeeNav = [{ href: '/employee/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/employee/attendance', label: 'My attendance', icon: CalendarCheck2 }, { href: '/employee/leave', label: 'Leave', icon: FileText }, { href: '/employee/profile', label: 'Profile', icon: UserRound }];
  const hrNav = [{ href: '/hr/dashboard', label: 'Overview', icon: LayoutDashboard }, { href: '/hr/registrations', label: 'Registrations', icon: UserCheck }, { href: '/hr/employees', label: 'Employees', icon: Users }, { href: '/hr/access', label: 'Access control', icon: ShieldCheck }, { href: '/hr/leave-requests', label: 'Leave requests', icon: FileText }, { href: '/hr/attendance', label: 'Attendance', icon: CalendarCheck2 }, { href: '/hr/reports', label: 'Reports', icon: BarChart3 }];
  const managerNav = [{ href: '/manager/dashboard', label: 'Assigned employees', icon: Users }];
  const nav = role === 'hr' ? hrNav : role === 'manager' ? managerNav : employeeNav;
  const active = (href: string) => location === href;
  const navigate = (href: string) => { setLocation(href); setMenuOpen(false); };
  return <div className="grain min-h-[100dvh] bg-background">
    <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 transition-transform duration-300 lg:translate-x-0', menuOpen ? 'translate-x-0' : '-translate-x-full')}>
      <LogoMark />
      <div className="mt-9 flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5"><div className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">{role === 'hr' ? 'AM' : 'MC'}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-sidebar-foreground">{role === 'hr' ? 'Avery Morgan' : 'Maya Chen'}</p><p className="text-[10px] text-slate-400">{role === 'hr' ? 'HR administrator' : role === 'manager' ? 'Manager' : 'Employee'}</p></div><ChevronDown size={15} className="ml-auto text-slate-400" /></div>
      <div className="mono mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{role === 'hr' ? 'Workspace' : role === 'manager' ? 'Manager workspace' : 'My workspace'}</div>
      <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active(href) ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-slate-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Icon size={18} /><span>{label}</span>{label === 'Leave requests' && <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">1</span>}</Link>)}</nav>
      <div className="mono mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Account</div>
      <nav className="space-y-1"><Link href="/settings" data-testid="link-settings" className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active('/settings') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-slate-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Settings size={18} /><span>Settings</span></Link></nav>
      <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-3.5"><div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><ShieldCheck size={15} className="text-sidebar-primary" /> Local demo mode</div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">Data stays in this browser. No production authentication is connected.</p></div>
      <button data-testid="button-sign-out" onClick={() => { onSignOut(); navigate('/'); }} className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><LogOut size={18} /> Sign out</button>
    </aside>
    {menuOpen && <button aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}
    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md md:px-8"><button data-testid="button-open-menu" onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu size={21} /></button><div className="hidden text-sm text-muted-foreground lg:block">{role === 'hr' ? 'People operations / Overview' : role === 'manager' ? 'Manager workspace / Assigned employees' : 'Employee workspace / Overview'}</div><div className="ml-auto flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Backend session</div><button data-testid="button-notifications" onClick={() => window.alert('No new notifications in this local demo.')} className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" /></button><div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{role === 'hr' ? 'AM' : 'MC'}</div></div></header>
      <main className="mx-auto max-w-[1440px] p-5 md:p-8">{children}</main>
    </div>
  </div>;
}

function SignIn({ setRole, onSignIn }: { setRole: (role: Role) => void; onSignIn: () => void }) {
  const [, setLocation] = useLocation();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleMessage, setGoogleMessage] = useState('');
  const [mode, setMode] = useState<LoginMode>('login');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [selectedRole, setSelectedRole] = useState<Role>('employee');
  const [loginMessage, setLoginMessage] = useState('');
  const enter = (role: Role) => { setRole(role); onSignIn(); setLocation(role === 'hr' ? '/hr/dashboard' : '/employee/dashboard'); };
  const getAccounts = (): DemoAccount[] => [];
  const saveAccounts = (_accounts: DemoAccount[]) => undefined;
  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    const account = getAccounts().find((item) => item.email.toLowerCase() === credentials.email.trim().toLowerCase() && item.password === credentials.password);
    if (!account) {
      setLoginMessage('Invalid email or password. Use one of the demo accounts below.');
      return;
    }
    setLoginMessage('');
    enter(account.role);
  };
  const submitSignup = (event: FormEvent) => {
    event.preventDefault();
    const email = credentials.email.trim().toLowerCase();
    if (getAccounts().some((account) => account.email.toLowerCase() === email)) {
      setLoginMessage('An account with this email already exists.');
      return;
    }
    if (credentials.password.length < 8) {
      setLoginMessage('Password must be at least 8 characters.');
      return;
    }
    saveAccounts([]);
    setLoginMessage('');
    enter(selectedRole);
  };
  const submitReset = (event: FormEvent) => {
    event.preventDefault();
    const email = credentials.email.trim().toLowerCase();
    const account = getAccounts().find((item) => item.email.toLowerCase() === email);
    if (!account) {
      setLoginMessage('No account was found for that email address.');
      return;
    }
    if (credentials.password.length < 8) {
      setLoginMessage('Enter a new password with at least 8 characters.');
      return;
    }
    saveAccounts([]);
    setLoginMessage('Password updated. You can now sign in.');
    setMode('login');
    setCredentials({ email, password: '' });
  };
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGoogleMessage('Google Sign-In is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.');
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          try {
            const payload = response.credential.split('.')[1];
            const profile = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            if (!profile.email || !profile.name) throw new Error('Google did not return a usable profile.');
            localStorage.setItem('meridian-google-profile', JSON.stringify({
              name: profile.name,
              email: profile.email,
              picture: profile.picture || '',
            }));
            enter(profile.email.toLowerCase() === 'hr@northstar.edu' ? 'hr' : 'employee');
          } catch (error) {
            console.error('Google Sign-In response could not be read.', error);
            setGoogleMessage('Google Sign-In could not be completed. Please try again.');
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 408,
        text: 'continue_with',
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setGoogleMessage('Google Sign-In could not load. Check your network connection.');
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);
  return <div className="grain min-h-[100dvh] bg-[#eff4f0]"><div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
    <div className="relative hidden overflow-hidden bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between"><div><LogoMark /><div className="mt-28 max-w-lg"><div className="mono mb-5 text-xs font-bold uppercase tracking-[.2em] text-sidebar-primary">A better rhythm for work</div><h1 className="text-6xl font-bold leading-[.96] tracking-[-.065em] text-white">Every hour,<br /><span className="text-sidebar-primary">accounted for.</span></h1><p className="mt-7 max-w-md text-base leading-7 text-slate-400">A clear, human way to keep attendance, leave, and people records moving together.</p></div></div><div className="flex items-center justify-between text-xs text-slate-500"><span>Meridian HR · Local prototype</span><span className="flex items-center gap-2"><ShieldCheck size={14} /> Private by design</span></div><div className="absolute -right-28 top-40 h-72 w-72 rounded-full border border-sidebar-primary/20" /><div className="absolute -right-10 top-58 h-52 w-52 rounded-full border border-sidebar-primary/10" /></div>
    <div className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-[440px]"><div className="mb-12 lg:hidden"><LogoMark /></div><div className="mb-9"><Badge tone="info"><Activity size={12} /> Secure sign in</Badge><h2 className="mt-5 text-3xl font-bold tracking-[-.04em]">{mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === 'login' ? 'Sign in with Google or your Meridian account.' : mode === 'signup' ? 'Create a local employee or HR prototype account.' : 'Set a new password for your local account.'}</p></div>{mode === 'login' && <><div ref={googleButtonRef} className="flex min-h-10 justify-center" />{googleMessage && <p className="mt-2 text-center text-xs text-muted-foreground">{googleMessage}</p>}<div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>or sign in with email</span><span className="h-px flex-1 bg-border" /></div></>}<form onSubmit={mode === 'login' ? submitLogin : mode === 'signup' ? submitSignup : submitReset} className="space-y-4"><label className="block text-sm font-medium">Email address<input data-testid="input-login-email" required type="email" autoComplete="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="you@northstar.edu" className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>{mode === 'signup' && <label className="block text-sm font-medium">Account type<select data-testid="select-login-role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)} className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"><option value="employee">Employee</option><option value="hr">HR administrator</option></select></label>}<label className="block text-sm font-medium">{mode === 'reset' ? 'New password' : 'Password'}<input data-testid="input-login-password" required type="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} placeholder={mode === 'reset' ? 'At least 8 characters' : 'Enter your password'} className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10" /></label><button data-testid="button-login-submit" type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Update password'} <ArrowRight size={16} /></button>{loginMessage && <p role="alert" className={cx('text-xs font-semibold', loginMessage.includes('updated') ? 'text-emerald-700' : 'text-rose-700')}>{loginMessage}</p>}</form><div className="mt-4 flex justify-between text-xs font-semibold text-primary"><button type="button" data-testid="button-signup" onClick={() => { setMode('signup'); setLoginMessage(''); }}>Create account</button><button type="button" data-testid="button-forgot-password" onClick={() => { setMode('reset'); setLoginMessage(''); }}>Forgot password?</button></div>{mode !== 'login' && <button type="button" data-testid="button-back-to-login" onClick={() => { setMode('login'); setLoginMessage(''); }} className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground">Back to sign in</button>}<div className="mt-5 rounded-xl border border-border bg-muted/50 p-4 text-xs text-muted-foreground"><p className="font-semibold text-foreground">Demo accounts</p><p className="mt-2"><span className="font-medium">Employee:</span> employee@northstar.edu / Employee@123</p><p className="mt-1"><span className="font-medium">HR:</span> hr@northstar.edu / HrAdmin@123</p></div><div className="mt-5 border-t border-border pt-5"><div className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" /><span><strong className="font-semibold text-foreground">Prototype authentication.</strong> Demo credentials are local-only. Production use requires server-side password hashing, Google token verification, and account role mapping.</span></div></div></div></div>
  </div></div>;
}

function BackendSignIn({ setRole, onSignIn }: { setRole: (role: Role) => void; onSignIn: (user: AuthUser) => void }) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<LoginMode>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loginType, setLoginType] = useState<'EMPLOYEE' | 'HR' | 'MANAGER'>('EMPLOYEE');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', otp: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const showError = (error: unknown) => setMessage(error instanceof Error ? error.message : 'Authentication request failed.');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await ensureCsrf();
      if (mode === 'login') {
        const user = await authRequest<AuthUser>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email: form.email, password: form.password, loginType }),
          },
          true
        );
        onSignIn(user);
        const effectiveManager = user.effectiveRoles?.includes('MANAGER') && loginType === 'MANAGER';
        setRole(user.role === 'HR_ADMIN' ? 'hr' : effectiveManager ? 'manager' : 'employee');
        setLocation(user.role === 'HR_ADMIN' ? '/hr/dashboard' : effectiveManager ? '/manager/dashboard' : '/employee/dashboard');
      } else if (mode === 'signup' && step === 'form') {
        await authRequest<AuthMessage>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
        });
        setStep('otp');
        setCooldown(60);
        setMessage('A verification code was sent to your email address.');
      } else if (mode === 'signup') {
        await authRequest<AuthMessage>('/api/auth/signup/verify', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, otp: form.otp }),
        });
        setMode('login');
        setStep('form');
        setCooldown(0);
        setMessage('Email verified successfully. Your account is pending HR administrator approval before you can sign in.');
        setForm((current) => ({ ...current, password: '', otp: '' }));
      } else if (step === 'form') {
        await authRequest<AuthMessage>(
          '/api/auth/password/forgot',
          {
            method: 'POST',
            body: JSON.stringify({ email: form.email }),
          },
          true
        );
        setStep('otp');
        setCooldown(60);
        setMessage('If the account exists, a password reset code has been sent.');
      } else {
        await authRequest<AuthMessage>(
          '/api/auth/password/reset',
          {
            method: 'POST',
            body: JSON.stringify({
              email: form.email,
              otp: form.otp,
              newPassword: form.password,
              confirmPassword: form.confirmPassword,
            }),
          },
          true
        );
        setMode('login');
        setStep('form');
        setCooldown(0);
        setMessage('Password updated. You can now sign in.');
        setForm((current) => ({ ...current, password: '', confirmPassword: '', otp: '' }));
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setMessage('');
    try {
      await ensureCsrf();
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/password/forgot';
      const body = mode === 'signup'
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email };
      await authRequest<AuthMessage>(path, { method: 'POST', body: JSON.stringify(body) }, mode === 'reset');
      setCooldown(60);
      setMessage('A new verification code has been requested.');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const detail = mode === 'login' ? 'Sign in with your Meridian account.' : mode === 'signup' ? 'Create an employee account and verify your email. HR approval is required before sign in.' : 'Verify your email before setting a new password.';
  return <div className="grain min-h-[100dvh] bg-[#eff4f0]"><div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
    <div className="relative hidden overflow-hidden bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between"><div><LogoMark /><div className="mt-28 max-w-lg"><div className="mono mb-5 text-xs font-bold uppercase tracking-[.2em] text-sidebar-primary">A better rhythm for work</div><h1 className="text-6xl font-bold leading-[.96] tracking-[-.065em] text-white">Every hour,<br /><span className="text-sidebar-primary">accounted for.</span></h1><p className="mt-7 max-w-md text-base leading-7 text-slate-400">A clear, human way to keep attendance, leave, and people records moving together.</p></div></div><div className="flex items-center justify-between text-xs text-slate-500"><span>Meridian HR</span><span className="flex items-center gap-2"><ShieldCheck size={14} /> Private by design</span></div></div>
    <div className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-[440px]"><div className="mb-12 lg:hidden"><LogoMark /></div><div className="mb-9"><Badge tone="info"><Activity size={12} /> Secure sign in</Badge><h2 className="mt-5 text-3xl font-bold tracking-[-.04em]">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'login' && <label className="block text-sm font-medium">Sign in as<select data-testid="select-login-type" value={loginType} onChange={(event) => setLoginType(event.target.value as 'EMPLOYEE' | 'HR' | 'MANAGER')} className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"><option value="EMPLOYEE">Employee</option><option value="HR">HR administrator</option><option value="MANAGER">Manager</option></select></label>}
        {mode === 'signup' && step === 'form' && <label className="block text-sm font-medium">Full name<input required value={form.name} onChange={(event) => update('name', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
        <label className="block text-sm font-medium">Email address<input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@northstar.edu" className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
        {step === 'otp' && <label className="block text-sm font-medium">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.otp} onChange={(event) => update('otp', event.target.value)} placeholder="6-digit code" className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
        {(mode === 'login' || (mode === 'signup' && step === 'form') || (mode === 'reset' && step === 'otp')) && <label className="block text-sm font-medium">{mode === 'reset' ? 'New password' : 'Password'}<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode !== 'login' ? 8 : undefined} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="At least 8 characters" className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
        {mode === 'reset' && step === 'otp' && <label className="block text-sm font-medium">Confirm new password<input required type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
        <button disabled={busy} type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : step === 'otp' ? 'Verify code' : mode === 'signup' ? 'Create account' : 'Send reset code'} <ArrowRight size={16} /></button>
        {message && <p role="alert" className={cx('text-xs font-semibold', message.includes('successfully') || message.includes('updated') ? 'text-emerald-700' : 'text-rose-700')}>{message}</p>}
      </form>
      {step === 'otp' && <button type="button" disabled={busy || cooldown > 0} onClick={resend} className="mt-4 w-full text-xs font-semibold text-primary disabled:opacity-50 disabled:cursor-not-allowed">{cooldown > 0 ? `Resend verification code (${cooldown}s)` : 'Resend verification code'}</button>}
      <div className="mt-4 flex justify-between text-xs font-semibold text-primary"><button type="button" onClick={() => { setMode('signup'); setStep('form'); setMessage(''); setCooldown(0); }}>Create account</button><button type="button" onClick={() => { setMode('reset'); setStep('form'); setMessage(''); setCooldown(0); ensureCsrf(true).catch(() => {}); }}>Forgot password?</button></div>
      {mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setStep('form'); setMessage(''); setCooldown(0); }} className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground">Back to sign in</button>}
      <div className="mt-5 border-t border-border pt-5"><div className="flex items-start gap-3 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" /><span><strong className="font-semibold text-foreground">Secure authentication.</strong> Passwords and sessions are managed by the Spring Boot backend.</span></div></div>
    </div></div>
  </div></div>;
}

function ManagerAccessCard() {
  const [requests, setRequests] = useState<Array<{ id: number; status: string; reviewReason?: string }>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => authRequest<typeof requests>('/api/manager-access/me').then(setRequests).catch(() => undefined);
  useEffect(() => { refresh(); }, []);
  const requestAccess = async () => {
    setBusy(true); setMessage('');
    try { await ensureCsrf(); await authRequest('/api/manager-access/requests', { method: 'POST', body: '{}' }); setMessage('Manager-access request submitted for HR review.'); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit request.'); }
    finally { setBusy(false); }
  };
  const current = requests[0];
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Manager access</h2><p className="mt-1 text-xs text-muted-foreground">Request access for HR to review.</p></div>{current && <Badge tone={statusTone(current.status === 'APPROVED' ? 'Approved' : current.status === 'PENDING' ? 'Pending' : current.status === 'REJECTED' ? 'Rejected' : 'Inactive')}>{current.status}</Badge>}</div>{current?.reviewReason && <p className="mt-3 text-xs text-muted-foreground">{current.reviewReason}</p>}{(!current || current.status === 'REJECTED' || current.status === 'REVOKED') && <Button testId="button-request-manager-access" className="mt-4" onClick={requestAccess} disabled={busy}>{busy ? 'Submitting…' : 'Request manager access'}</Button>}{message && <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p>}</div>;
}

function EmployeeDashboard({ employees, attendance, leaves }: { employees: Employee[]; attendance: Attendance[]; leaves: LeaveRequest[] }) {
  const employee = employees[0]; const todayRecord = attendance.find((item) => item.employeeId === employee.id && item.workDate === today); const recentLeaves = leaves.filter((item) => item.employeeId === employee.id).slice(0, 3);
  return <div className="page-enter"><SectionTitle eyebrow={formatDate(today)} title={`Good morning, ${employee.name.split(' ')[0]}.`} detail="Here is your workday at a glance." action={<Badge tone="info"><ShieldCheck size={12} /> Employee view</Badge>} /><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md md:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-primary-foreground/70">Today’s attendance</p><p className="mt-3 text-4xl font-bold tracking-[-.05em]">{todayRecord?.checkIn || 'Not started'}</p><p className="mt-1 text-sm text-primary-foreground/70">{todayRecord?.checkIn ? 'Check-in recorded · On schedule' : 'Your workday is waiting for you'}</p></div><div className="rounded-xl bg-white/10 p-3"><Clock3 size={23} /></div></div><div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/15 pt-4 text-sm"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> {todayRecord?.checkOut ? `Checked out at ${todayRecord.checkOut}` : 'Currently working'}</span><span className="text-primary-foreground/50">•</span><span className="text-primary-foreground/70">Expected: 8 hours</span></div></div><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Leave balance</p><p className="mt-3 text-4xl font-bold tracking-[-.05em]">14 <span className="text-base font-medium text-muted-foreground">days</span></p><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[64%] rounded-full bg-accent" /></div><p className="mt-2 text-xs text-muted-foreground">25 days annual allowance</p></div></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_.85fr]"><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Recent leave</h2><p className="mt-1 text-xs text-muted-foreground">Your latest requests and decisions</p></div><Link href="/employee/leave" data-testid="link-view-all-leave" className="text-xs font-semibold text-primary hover:underline">View all</Link></div>{recentLeaves.length ? <div className="divide-y divide-border">{recentLeaves.map((leave) => <div key={leave.id} data-testid={`row-recent-leave-${leave.id}`} className="flex items-center justify-between gap-3 py-3.5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText size={16} /></div><div><p className="text-sm font-semibold">{leave.leaveType}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(leave.fromDate)} {leave.fromDate !== leave.toDate && `— ${formatDate(leave.toDate)}`}</p></div></div><Badge tone={statusTone(leave.status)}>{leave.status}</Badge></div>)}</div> : <EmptyState title="No leave requests yet" detail="Your submitted requests will appear here." />}</div><div className="space-y-6"><ManagerAccessCard /><div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><div className="rounded-lg bg-amber-50 p-2 text-amber-700"><CircleHelp size={17} /></div><h2 className="font-bold">Need a hand?</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Keep your attendance current and submit leave early so your manager has time to review it.</p><Link href="/employee/attendance" data-testid="link-go-attendance" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Open attendance <ArrowRight size={15} /></Link></div></div></div></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-border py-10 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground"><FileText size={18} /></div><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }

function EmployeeAttendance({ attendance, setAttendance }: { attendance: Attendance[]; setAttendance: (value: Attendance[] | ((prev: Attendance[]) => Attendance[])) => void }) {
  const me = 'EMP-1042'; const todayRecord = attendance.find((item) => item.employeeId === me && item.workDate === today); const [notice, setNotice] = useState('');
  const checkIn = () => { if (todayRecord?.checkIn) return; setAttendance((prev) => [{ employeeId: me, workDate: today, checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), checkOut: '', status: 'Present', workingHours: '—' }, ...prev]); setNotice('Check-in saved locally.'); };
  const checkOut = () => { if (!todayRecord?.checkIn || todayRecord.checkOut) return; const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); setAttendance((prev) => prev.map((item) => item.employeeId === me && item.workDate === today ? { ...item, checkOut: time, workingHours: '8h 00m' } : item)); setNotice('Check-out saved locally.'); };
  return <div className="page-enter"><SectionTitle eyebrow="My workspace" title="Attendance" detail="Record your workday and review your attendance history." action={<Badge tone="info"><CalendarCheck2 size={12} /> {formatDate(today)}</Badge>} /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Today</p><h2 className="mt-1 text-2xl font-bold">{todayRecord?.checkIn ? 'Workday in progress' : 'Ready to begin?'}</h2></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 size={22} /></div></div><div className="my-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/70 p-4"><p className="text-xs text-muted-foreground">Check in</p><p className="mono mt-2 text-lg font-bold">{todayRecord?.checkIn || '—'}</p></div><div className="rounded-xl bg-muted/70 p-4"><p className="text-xs text-muted-foreground">Check out</p><p className="mono mt-2 text-lg font-bold">{todayRecord?.checkOut || '—'}</p></div></div><div className="flex gap-2"><Button testId="button-check-in" onClick={checkIn} disabled={Boolean(todayRecord?.checkIn)}><Check size={16} /> Check in</Button><Button testId="button-check-out" variant="secondary" onClick={checkOut} disabled={!todayRecord?.checkIn || Boolean(todayRecord?.checkOut)}>Check out</Button></div>{notice && <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> {notice}</p>}</div><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Attendance history</h2><p className="mt-1 text-xs text-muted-foreground">Your most recent workdays</p></div><Button testId="button-attendance-filter" variant="ghost" className="px-2"><Filter size={16} /> Filter</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Check in</th><th className="pb-3 font-medium">Check out</th><th className="pb-3 font-medium">Hours</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{attendance.filter((item) => item.employeeId === me).slice(0, 8).map((item) => <tr key={item.workDate} data-testid={`row-attendance-${item.workDate}`}><td className="py-3.5 font-medium">{formatDate(item.workDate)}</td><td className="mono py-3.5 text-xs">{item.checkIn || '—'}</td><td className="mono py-3.5 text-xs">{item.checkOut || '—'}</td><td className="py-3.5 text-muted-foreground">{item.workingHours}</td><td className="py-3.5"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></table></div></div></div></div>;
}

function EmployeeLeave({ leaves, setLeaves }: { leaves: LeaveRequest[]; setLeaves: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void }) {
  const [form, setForm] = useState({ leaveType: 'Annual leave', fromDate: '', toDate: '', reason: '' }); const [notice, setNotice] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.fromDate || !form.toDate || !form.reason) return; const item: LeaveRequest = { id: `LV-${Math.floor(2209 + Math.random() * 90)}`, employeeId: 'EMP-1042', employeeName: 'Maya Chen', ...form, status: 'Pending', appliedDate: today, approvedBy: '—' }; setLeaves((prev) => [item, ...prev]); setForm({ leaveType: 'Annual leave', fromDate: '', toDate: '', reason: '' }); setNotice('Request submitted for review.'); };
  const mine = leaves.filter((item) => item.employeeId === 'EMP-1042');
  return <div className="page-enter"><SectionTitle eyebrow="My workspace" title="Leave" detail="Plan time away and keep track of your requests." action={<Button testId="button-scroll-leave" onClick={() => document.getElementById('leave-form')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={16} /> New request</Button>} /><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><form id="leave-form" onSubmit={submit} className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="mb-5"><h2 className="font-bold">Apply for leave</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Your manager will be notified to review this request.</p></div><div className="space-y-4"><label className="block text-sm font-medium">Leave type<select data-testid="select-leave-type" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"><option>Annual leave</option><option>Personal leave</option><option>Sick leave</option><option>Study leave</option></select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">From<input data-testid="input-leave-from" required type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="block text-sm font-medium">To<input data-testid="input-leave-to" required type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label></div><label className="block text-sm font-medium">Reason<textarea data-testid="input-leave-reason" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={4} placeholder="Add a short note for your manager" className="mt-2 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /></label><Button type="submit" testId="button-submit-leave" className="w-full">Submit request <ArrowRight size={16} /></Button>{notice && <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> {notice}</p>}</div></form><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Leave history</h2><p className="mt-1 text-xs text-muted-foreground">{mine.length} requests on record</p></div><div className="rounded-xl bg-amber-50 px-3 py-2 text-center"><p className="text-[10px] uppercase tracking-wider text-amber-700">Available</p><p className="mt-0.5 text-lg font-bold text-amber-800">14d</p></div></div><div className="space-y-3">{mine.map((leave) => <div key={leave.id} data-testid={`card-leave-${leave.id}`} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{leave.leaveType}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(leave.fromDate)} — {formatDate(leave.toDate)}</p></div><Badge tone={statusTone(leave.status)}>{leave.status}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{leave.reason}</p><p className="mono mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Applied {formatDate(leave.appliedDate)} · {leave.id}</p></div>)}</div></div></div></div>;
}

function EmployeeProfile({ employees }: { employees: Employee[]; setEmployees?: (value: Employee[] | ((prev: Employee[]) => Employee[])) => void }) {
  const fallbackEmployee = employees[0];
  const [details, setDetails] = useState<PersonalDetails | null>(null);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [requestedChanges, setRequestedChanges] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const loadData = async () => {
    try {
      const data = await authRequest<PersonalDetails>('/api/employee/personal-details');
      setDetails(data);
    } catch {
      setDetails({
        id: 1,
        fullName: fallbackEmployee.name,
        email: fallbackEmployee.email,
        gender: null,
        dateOfBirth: null,
        age: null,
        residentialAddress: null,
        mobileNumber: fallbackEmployee.phone !== '—' ? fallbackEmployee.phone : null,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      });
    }

    try {
      const reqs = await authRequest<CorrectionRequest[]>('/api/employee/correction-requests');
      setCorrections(reqs);
    } catch {
      setCorrections([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCorrectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestedChanges.trim()) return;
    setSubmittingCorrection(true);
    setError('');
    setSuccessMessage('');
    try {
      await ensureCsrf();
      await authRequest('/api/employee/correction-requests', {
        method: 'POST',
        body: JSON.stringify({ requestedChanges: requestedChanges.trim() }),
      });
      setSuccessMessage('Correction request submitted to HR.');
      setRequestedChanges('');
      setCorrectionModalOpen(false);
      const reqs = await authRequest<CorrectionRequest[]>('/api/employee/correction-requests');
      setCorrections(reqs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit correction request.');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const name = details?.fullName || fallbackEmployee.name;
  const roleDisplay = details?.role === 'HR_ADMIN' ? 'HR administrator' : 'Active employee';

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="My workspace"
        title="Personal profile"
        detail="View your personal and employment details on record."
        action={
          <Button
            testId="button-open-correction-modal"
            variant="secondary"
            onClick={() => { setCorrectionModalOpen(true); setError(''); setSuccessMessage(''); }}
          >
            <FileText size={15} /> Request correction
          </Button>
        }
      />

      {successMessage && (
        <p role="alert" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {correctionModalOpen && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Submit personal details correction request</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Personal details are protected and maintained by HR Administration. Describe the changes you are requesting.
              </p>
            </div>
            <button
              type="button"
              data-testid="button-close-correction-modal"
              onClick={() => setCorrectionModalOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X size={17} />
            </button>
          </div>
          <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              Requested changes & explanation
              <textarea
                data-testid="input-correction-changes"
                required
                rows={3}
                value={requestedChanges}
                onChange={(e) => setRequestedChanges(e.target.value)}
                placeholder="e.g., Please update my mobile number to +1-555-0199 and address to 742 Evergreen Terrace."
                className="mt-2 w-full resize-none rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                testId="button-submit-correction"
                disabled={submittingCorrection || !requestedChanges.trim()}
              >
                {submittingCorrection ? 'Submitting…' : 'Submit request'}
              </Button>
              <Button
                variant="ghost"
                testId="button-cancel-correction"
                onClick={() => setCorrectionModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[.45fr_1fr]">
        <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-md">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-sidebar-primary text-xl font-bold text-sidebar-primary-foreground">
            {initials(name)}
          </div>
          <h2 className="mt-5 text-xl font-bold">{name}</h2>
          <p className="mt-1 text-sm text-slate-400">{details?.email || fallbackEmployee.email}</p>
          <div className="mt-8 border-t border-sidebar-border pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck size={15} className="text-sidebar-primary" /> {roleDisplay}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Status <span className="mono ml-2 font-semibold text-sidebar-foreground">{details?.status || 'ACTIVE'}</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Personal & contact details</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Protected employee details maintained exclusively by HR Administration.
              </p>
            </div>
            <Badge tone="info">Read-only</Badge>
          </div>

          <div className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Full name</p>
              <p className="mt-1 text-sm font-semibold">{details?.fullName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Email address</p>
              <p className="mt-1 text-sm font-semibold">{details?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gender</p>
              <p className="mt-1 text-sm font-semibold">{details?.gender || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Date of birth</p>
              <p className="mt-1 text-sm font-semibold">
                {details?.dateOfBirth ? formatDate(details.dateOfBirth) : 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Age</p>
              <p className="mt-1 text-sm font-semibold">
                {details?.age !== null && details?.age !== undefined ? `${details.age} years old` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Mobile number</p>
              <p className="mt-1 text-sm font-semibold">{details?.mobileNumber || 'Not specified'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Residential address</p>
              <p className="mt-1 text-sm font-semibold">{details?.residentialAddress || 'Not specified'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Need to update your details?</span> Employees and managers cannot directly edit protected personal records. Click "Request correction" above to notify HR Administration.
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Correction requests history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Requests submitted to HR for profile updates.</p>
          </div>
        </div>

        {corrections.length === 0 ? (
          <EmptyState
            title="No correction requests"
            detail="When you submit requests to update your personal details, they will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="py-3 font-medium">Requested changes</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">HR resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {corrections.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-sm font-medium max-w-xs">{req.requestedChanges}</td>
                    <td className="py-3">
                      <Badge tone={statusTone(req.status === 'RESOLVED' ? 'Approved' : req.status === 'PENDING' ? 'Pending' : 'Rejected')}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {req.resolutionNote ? (
                        <div>
                          <p className="font-medium text-foreground">{req.resolutionNote}</p>
                          {req.resolverName && <p className="text-[11px]">By {req.resolverName}</p>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HRDashboard({ employees, attendance, leaves }: { employees: Employee[]; attendance: Attendance[]; leaves: LeaveRequest[] }) {
  const active = employees.filter((e) => e.status === 'Active').length; const present = attendance.filter((a) => a.workDate === today && a.status === 'Present').length; const late = attendance.filter((a) => a.workDate === today && a.status === 'Late').length; const pending = leaves.filter((l) => l.status === 'Pending').length;
  return <div className="page-enter"><SectionTitle eyebrow={`People operations / ${formatDate(today)}`} title="Good morning, Avery." detail="A compact read on attendance and people activity." action={<Badge tone="info"><ShieldCheck size={12} /> HR administrator</Badge>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active employees" value={String(active)} detail="+2 since last month" icon={Users} accent="teal" /><StatCard label="Present today" value={`${present + late}/${active}`} detail={`${late} late arrival${late === 1 ? '' : 's'} to review`} icon={CalendarCheck2} accent="sky" /><StatCard label="Pending leave" value={String(pending)} detail="Needs your attention" icon={FileText} accent="amber" /><StatCard label="Attendance rate" value="94.6%" detail="Rolling 30-day average" icon={Activity} accent="rose" /></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Today’s attendance</h2><p className="mt-1 text-xs text-muted-foreground">Live view across your active team</p></div><Link href="/hr/attendance" data-testid="link-full-attendance" className="text-xs font-semibold text-primary hover:underline">Full view</Link></div><div className="space-y-2">{employees.slice(0, 4).map((employee) => { const record = attendance.find((item) => item.employeeId === employee.id && item.workDate === today); return <div key={employee.id} data-testid={`row-dashboard-attendance-${employee.id}`} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{initials(employee.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.department}</p></div><span className="mono hidden text-xs text-muted-foreground sm:block">{record?.checkIn || '—'}</span><Badge tone={statusTone(record?.status || employee.status)}>{record?.status || 'Absent'}</Badge></div>; })}</div></div><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Leave inbox</h2><p className="mt-1 text-xs text-muted-foreground">Requests awaiting review</p></div><Link href="/hr/leave-requests" data-testid="link-review-leave" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><ArrowRight size={17} /></Link></div><div className="mt-5 space-y-4">{leaves.filter((l) => l.status === 'Pending').map((leave) => <div key={leave.id} className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700">{initials(leave.employeeName)}</div><div><p className="text-sm font-semibold">{leave.employeeName}</p><p className="mt-0.5 text-xs text-muted-foreground">{leave.leaveType} · {formatDate(leave.fromDate)}</p></div></div>)}{pending === 0 && <EmptyState title="Inbox is clear" detail="No leave requests need review." />}</div></div></div></div>;
}

function HREmployees({ employees, setEmployees }: { employees: Employee[]; setEmployees: (value: Employee[] | ((prev: Employee[]) => Employee[])) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | Status>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', department: 'Student Services', designation: '' });
  const [backendUsers, setBackendUsers] = useState<BackendUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<BackendUser | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    residentialAddress: '',
    mobileNumber: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');
  const [detailsError, setDetailsError] = useState('');

  const loadBackendUsers = () => {
    authRequest<BackendUser[]>('/api/hr/users')
      .then(setBackendUsers)
      .catch(() => setBackendUsers([]));
  };

  useEffect(() => {
    loadBackendUsers();
  }, []);

  const openPersonalDetails = async (employee: Employee) => {
    setDetailsMessage('');
    setDetailsError('');
    // Look up numeric backend user ID by email
    const match = backendUsers.find((u) => u.email.toLowerCase() === employee.email.toLowerCase());
    const numericId = match ? match.id : 1;

    try {
      const details = await authRequest<PersonalDetails>(`/api/hr/employees/${numericId}/personal-details`);
      setSelectedUser({
        id: details.id,
        name: details.fullName,
        email: details.email,
        role: details.role,
        status: details.status,
      });
      setEditForm({
        fullName: details.fullName || employee.name,
        gender: details.gender || '',
        dateOfBirth: details.dateOfBirth || '',
        residentialAddress: details.residentialAddress || '',
        mobileNumber: details.mobileNumber || '',
      });
    } catch {
      setSelectedUser({
        id: numericId,
        name: employee.name,
        email: employee.email,
        role: 'EMPLOYEE',
        status: employee.status.toUpperCase(),
      });
      setEditForm({
        fullName: employee.name,
        gender: '',
        dateOfBirth: '',
        residentialAddress: '',
        mobileNumber: employee.phone !== '—' ? employee.phone : '',
      });
    }
    setEditModalOpen(true);
  };

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingDetails(true);
    setDetailsError('');
    setDetailsMessage('');

    if (!editForm.fullName.trim()) {
      setDetailsError('Full name is required.');
      setSavingDetails(false);
      return;
    }

    if (editForm.dateOfBirth) {
      const dob = new Date(editForm.dateOfBirth);
      if (isNaN(dob.getTime()) || dob >= new Date()) {
        setDetailsError('Date of birth must be a valid date in the past.');
        setSavingDetails(false);
        return;
      }
    }

    if (editForm.mobileNumber && !/^[0-9+() -]{7,25}$/.test(editForm.mobileNumber.trim())) {
      setDetailsError('Mobile number contains invalid characters (allowed: digits, spaces, +, -, parentheses; 7-25 chars).');
      setSavingDetails(false);
      return;
    }

    try {
      await ensureCsrf();
      await authRequest(`/api/hr/employees/${selectedUser.id}/personal-details`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          gender: editForm.gender.trim() || null,
          dateOfBirth: editForm.dateOfBirth || null,
          residentialAddress: editForm.residentialAddress.trim() || null,
          mobileNumber: editForm.mobileNumber.trim() || null,
        }),
      });
      setDetailsMessage(`Personal details updated successfully for ${editForm.fullName}.`);
      loadBackendUsers();
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.email.toLowerCase() === selectedUser.email.toLowerCase()
            ? { ...emp, name: editForm.fullName.trim(), phone: editForm.mobileNumber.trim() || emp.phone }
            : emp
        )
      );
      setTimeout(() => {
        setEditModalOpen(false);
        setDetailsMessage('');
      }, 1500);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Unable to update personal details.');
    } finally {
      setSavingDetails(false);
    }
  };

  const filtered = employees.filter((employee) => (filter === 'All' || employee.status === filter) && `${employee.name} ${employee.department} ${employee.email}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id: string) => setEmployees((prev) => prev.map((employee) => employee.id === id ? { ...employee, status: employee.status === 'Active' ? 'Inactive' : 'Active' } : employee));
  const addEmployee = (event: FormEvent) => { event.preventDefault(); if (!newEmployee.name || !newEmployee.email || !newEmployee.designation) return; setEmployees((prev) => [...prev, { id: `EMP-${1043 + prev.length}`, ...newEmployee, phone: '—', joiningDate: today, status: 'Active' }]); setNewEmployee({ name: '', email: '', department: 'Student Services', designation: '' }); setAddOpen(false); };

  const previewAge = computeAge(editForm.dateOfBirth);

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="People operations"
        title="Employees & managers"
        detail={`${employees.length} people in your directory. HR can manage personal records for both employees and managers.`}
        action={
          <Button testId="button-add-employee" variant="secondary" onClick={() => setAddOpen((value) => !value)}>
            <Plus size={16} /> Add employee
          </Button>
        }
      />

      {editModalOpen && selectedUser && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-card p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Edit personal details: {selectedUser.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Account role: <span className="font-semibold">{selectedUser.role}</span> · Email: {selectedUser.email}
              </p>
            </div>
            <button
              type="button"
              data-testid="button-close-details-modal"
              onClick={() => setEditModalOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X size={17} />
            </button>
          </div>

          {detailsMessage && (
            <p role="alert" className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-700">
              {detailsMessage}
            </p>
          )}
          {detailsError && (
            <p role="alert" className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
              {detailsError}
            </p>
          )}

          <form onSubmit={handleSaveDetails} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Full name *
                <input
                  data-testid="input-edit-fullname"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="block text-sm font-medium">
                Gender
                <select
                  data-testid="select-edit-gender"
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select gender...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>

              <div>
                <label className="block text-sm font-medium">
                  Date of birth
                  <input
                    data-testid="input-edit-dob"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Calculated age:</span>
                  <span className="font-semibold text-foreground">
                    {previewAge !== null ? `${previewAge} years old` : '—'}
                  </span>
                </div>
              </div>

              <label className="block text-sm font-medium">
                Mobile number
                <input
                  data-testid="input-edit-mobile"
                  placeholder="+1 (555) 019-3456"
                  value={editForm.mobileNumber}
                  onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="block text-sm font-medium sm:col-span-2">
                Residential address
                <textarea
                  data-testid="input-edit-address"
                  rows={2}
                  placeholder="Street, City, Postal Code"
                  value={editForm.residentialAddress}
                  onChange={(e) => setEditForm({ ...editForm, residentialAddress: e.target.value })}
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" testId="button-save-details" disabled={savingDetails}>
                {savingDetails ? 'Saving…' : 'Save personal details'}
              </Button>
              <Button
                variant="ghost"
                testId="button-cancel-edit-details"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {addOpen && (
        <form onSubmit={addEmployee} className="mb-5 rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Add employee</h2>
              <p className="mt-1 text-xs text-muted-foreground">Create a local directory record.</p>
            </div>
            <button
              type="button"
              data-testid="button-close-add-employee"
              onClick={() => setAddOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X size={17} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              data-testid="input-new-employee-name"
              required
              placeholder="Full name"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              data-testid="input-new-employee-email"
              required
              type="email"
              placeholder="Email address"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              data-testid="input-new-employee-role"
              required
              placeholder="Designation"
              value={newEmployee.designation}
              onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" testId="button-save-employee">
              <Check size={16} /> Save employee
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-card-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-search-employees"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, team, or email"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['All', 'Active', 'Inactive'] as const).map((item) => (
              <button
                key={item}
                data-testid={`button-filter-${item.toLowerCase()}`}
                onClick={() => setFilter(item)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="py-3 font-medium">Department</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Joined</th>
                <th className="py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((employee) => (
                <tr key={employee.id} data-testid={`row-employee-${employee.id}`} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {initials(employee.name)}
                      </div>
                      <div>
                        <p className="font-semibold">{employee.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-muted-foreground">{employee.department}</td>
                  <td className="py-4 text-muted-foreground">{employee.designation}</td>
                  <td className="py-4 text-muted-foreground">{formatDate(employee.joiningDate)}</td>
                  <td className="py-4">
                    <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        testId={`button-edit-details-${employee.id}`}
                        variant="secondary"
                        className="px-2.5 text-xs"
                        onClick={() => openPersonalDetails(employee)}
                      >
                        <Pencil size={13} /> Edit details
                      </Button>
                      <Button
                        testId={`button-toggle-${employee.id}`}
                        variant="ghost"
                        className="px-2.5 text-xs"
                        onClick={() => toggle(employee.id)}
                      >
                        {employee.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState title="No employees found" detail="Try a different search or status filter." />
          )}
        </div>
      </div>
    </div>
  );
}

function HRLeaveRequests({ leaves, setLeaves }: { leaves: LeaveRequest[]; setLeaves: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void }) {
  const update = (id: string, status: LeaveStatus) => setLeaves((prev) => prev.map((leave) => leave.id === id ? { ...leave, status, approvedBy: 'Avery Morgan' } : leave)); const pending = leaves.filter((l) => l.status === 'Pending');
  return <div className="page-enter">
    <SectionTitle eyebrow="People operations" title="Leave requests" detail="Review, decide, and keep the team moving." action={<Badge tone={pending.length ? 'warning' : 'success'}>{pending.length} pending review</Badge>} />
    <div className="space-y-3">
      {leaves.map((leave) => (
        <div key={leave.id} data-testid={`card-request-${leave.id}`} className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{initials(leave.employeeName)}</div>
              <div className="min-w-0"><p className="font-semibold">{leave.employeeName}</p><p className="mt-1 text-xs text-muted-foreground">{leave.leaveType} · Applied {formatDate(leave.appliedDate)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-7 text-sm">
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dates</p><p className="mt-1 font-medium">{formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate && ` — ${formatDate(leave.toDate)}`}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</p><p className="mt-1 max-w-[180px] truncate font-medium">{leave.reason}</p></div>
            </div>
            <div className="flex items-center gap-2 md:ml-4">
              {leave.status === 'Pending' ? <><Button testId={`button-approve-${leave.id}`} onClick={() => update(leave.id, 'Approved')} className="px-3"><Check size={15} /> Approve</Button><Button testId={`button-reject-${leave.id}`} variant="danger" onClick={() => update(leave.id, 'Rejected')} className="px-3"><X size={15} /> Reject</Button></> : <Badge tone={statusTone(leave.status)}>{leave.status} {leave.approvedBy !== '—' && `· ${leave.approvedBy}`}</Badge>}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

function HRAttendance({ attendance, employees }: { attendance: Attendance[]; employees: Employee[] }) {
  const [date, setDate] = useState(today); const records = employees.map((employee) => ({ employee, record: attendance.find((item) => item.employeeId === employee.id && item.workDate === date) }));
  return <div className="page-enter"><SectionTitle eyebrow="People operations" title="Attendance" detail="Daily presence, punctuality, and working hours." action={<div className="flex items-center gap-2"><input data-testid="input-attendance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary" /><Button testId="button-attendance-export" variant="secondary" onClick={() => window.print()}><Download size={15} /> Export</Button></div>} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Present" value={String(records.filter((x) => x.record?.status === 'Present').length)} detail="On time today" icon={CheckCircle2} accent="teal" /><StatCard label="Late arrivals" value={String(records.filter((x) => x.record?.status === 'Late').length)} detail="Review patterns over time" icon={Clock3} accent="amber" /><StatCard label="Not recorded" value={String(records.filter((x) => !x.record || x.record.status === 'Absent').length)} detail="Could require follow-up" icon={CircleHelp} accent="rose" /></div><div className="mt-6 rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-primary" /><h2 className="font-bold">Daily register · {formatDate(date)}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Employee</th><th className="pb-3 font-medium">Team</th><th className="pb-3 font-medium">Check in</th><th className="pb-3 font-medium">Check out</th><th className="pb-3 font-medium">Hours</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{records.map(({ employee, record }) => <tr key={employee.id} data-testid={`row-hr-attendance-${employee.id}`}><td className="py-4 font-semibold">{employee.name}</td><td className="py-4 text-muted-foreground">{employee.department}</td><td className="mono py-4 text-xs">{record?.checkIn || '—'}</td><td className="mono py-4 text-xs">{record?.checkOut || '—'}</td><td className="py-4 text-muted-foreground">{record?.workingHours || '—'}</td><td className="py-4"><Badge tone={statusTone(record?.status || 'Absent')}>{record?.status || 'Absent'}</Badge></td></tr>)}</tbody></table></div></div></div>;
}

function HRReports({ attendance, leaves }: { attendance: Attendance[]; leaves: LeaveRequest[] }) {
  const [range, setRange] = useState('This month'); const [report, setReport] = useState('Attendance summary'); const [notice, setNotice] = useState('');
  const exportReport = () => { setNotice(`${report} prepared for ${range}.`); window.setTimeout(() => setNotice(''), 3500); };
  return <div className="page-enter"><SectionTitle eyebrow="People operations" title="Reports" detail="Build a focused view before exporting it for your records." action={<Badge tone="neutral"><Download size={12} /> Local export</Badge>} /><div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]"><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><h2 className="font-bold">Report filters</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a period and report lens.</p><div className="mt-6 space-y-4"><label className="block text-sm font-medium">Report<select data-testid="select-report-type" value={report} onChange={(e) => setReport(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option>Attendance summary</option><option>Leave activity</option><option>Employee directory</option></select></label><label className="block text-sm font-medium">Date range<select data-testid="select-report-range" value={range} onChange={(e) => setRange(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option>This month</option><option>Last month</option><option>Last 90 days</option></select></label><Button testId="button-export-report" onClick={exportReport} className="mt-3 w-full"><Download size={16} /> Prepare export</Button>{notice && <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> {notice}</p>}</div></div><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold">Preview</h2><p className="mt-1 text-xs text-muted-foreground">{report} · {range}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 size={18} /></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Attendance rows</p><p className="mt-2 text-2xl font-bold">{attendance.length}</p></div><div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Leave requests</p><p className="mt-2 text-2xl font-bold">{leaves.length}</p></div></div><div className="mt-6 rounded-xl border border-dashed border-border p-5"><div className="flex items-center gap-2 text-sm font-semibold"><ListFilter size={16} className="text-primary" /> Export includes</div><ul className="mt-3 space-y-2 text-xs text-muted-foreground"><li>• Dates, status, and working hours</li><li>• Department and employee identifiers</li><li>• Review-ready CSV formatting</li></ul></div></div></div></div>;
}

function SettingsPage({ role }: { role: Role }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('meridian-theme') || 'light'); const [notice, setNotice] = useState('');
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('meridian-theme', theme); }, [theme]);
  const reset = () => { ['meridian-role', 'meridian-authenticated', 'meridian-employees', 'meridian-attendance', 'meridian-leaves', 'meridian-theme'].forEach((key) => localStorage.removeItem(key)); window.location.reload(); };
  return <div className="page-enter"><SectionTitle eyebrow="Account" title="Settings" detail="Your access level is managed by the server-side account." /><div className="max-w-3xl space-y-5"><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-start gap-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><UserCog size={18} /></div><div><h2 className="font-bold">Current access</h2><p className="mt-1 text-sm text-muted-foreground">{role === 'hr' ? 'HR administrator' : role === 'manager' ? 'Manager access' : 'Employee access'} is enforced by the authenticated backend session.</p><p className="mt-3 text-xs font-semibold text-emerald-700">Role changes require an authorized server-side workflow.</p></div></div></div><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><h2 className="font-bold">Appearance</h2><p className="mt-1 text-sm text-muted-foreground">Choose the visual theme for this browser.</p></div><select data-testid="select-theme" value={theme} onChange={(e) => setTheme(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option value="light">Light</option><option value="dark">Dark</option></select></div></div><div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6"><h2 className="font-bold text-rose-900">Reset local demo</h2><p className="mt-1 text-sm leading-6 text-rose-800/70">Restore seeded employees, attendance, leave records, and light theme. This cannot be undone.</p><Button testId="button-reset-demo" variant="danger" className="mt-4" onClick={reset}>Reset demo data</Button></div></div></div>;
}

function ManagerDashboard() {
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; email: string; employeeId?: string; status: string }>>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<Array<{ id: number; name: string; email: string; role: string; status: string; createdAt: string; emailVerifiedAt: string }>>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = () => {
    authRequest<typeof employees>('/api/manager/employees')
      .then(setEmployees)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load assigned employees.'));
    authRequest<typeof pendingRegistrations>('/api/manager/pending-registrations')
      .then(setPendingRegistrations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load pending registrations.'));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleApprove = async (reg: typeof pendingRegistrations[0]) => {
    if (!window.confirm(`Approve registration for ${reg.name} (${reg.email})? This will activate their employee account.`)) return;
    setBusyId(reg.id);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/manager/pending-registrations/${reg.id}/approve`, { method: 'POST', body: '{}' });
      setMessage(`Registration for ${reg.name} approved and activated.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve registration.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reg: typeof pendingRegistrations[0]) => {
    setBusyId(reg.id);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/manager/pending-registrations/${reg.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason || 'Registration not approved by assigned manager.' }),
      });
      setMessage(`Registration for ${reg.name} rejected.`);
      setRejectingId(null);
      setRejectReason('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject registration.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="Manager workspace"
        title="Manager operations"
        detail="Review employee registrations assigned to you and manage your active team."
      />

      {message && (
        <p role="alert" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {/* Pending Registrations Assigned to Manager */}
      <div className="mb-8 rounded-2xl border border-card-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Pending employee registrations</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              New employee signups assigned to you by HR. Approving activates their account.
            </p>
          </div>
          <Badge tone={pendingRegistrations.length ? 'warning' : 'success'}>
            {pendingRegistrations.length} awaiting review
          </Badge>
        </div>

        {rejectingId !== null && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <h3 className="text-sm font-bold text-rose-900">Reject registration</h3>
            <p className="mt-1 text-xs text-rose-700">Provide an optional reason for the rejection:</p>
            <input
              data-testid="input-manager-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Unrecognized department or invalid credentials"
              className="mt-3 h-10 w-full rounded-lg border border-rose-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                testId="button-manager-confirm-reject"
                variant="danger"
                disabled={busyId !== null}
                onClick={() => {
                  const item = pendingRegistrations.find((r) => r.id === rejectingId);
                  if (item) handleReject(item);
                }}
              >
                {busyId === rejectingId ? 'Rejecting…' : 'Confirm rejection'}
              </Button>
              <Button
                testId="button-manager-cancel-reject"
                variant="ghost"
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {pendingRegistrations.length === 0 ? (
          <EmptyState
            title="No registrations awaiting review"
            detail="You currently have no new employee registrations assigned to you for approval."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="py-3 font-medium">Registered</th>
                  <th className="py-3 font-medium">Email status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {pendingRegistrations.map((reg) => (
                  <tr key={reg.id} data-testid={`row-manager-registration-${reg.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{reg.name}</p>
                      <p className="text-xs text-muted-foreground">{reg.email}</p>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-xs">
                      {reg.emailVerifiedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <Check size={13} /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">Pending OTP</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          testId={`button-manager-approve-${reg.id}`}
                          className="px-2.5 text-xs"
                          disabled={busyId === reg.id}
                          onClick={() => handleApprove(reg)}
                        >
                          Approve
                        </Button>
                        <Button
                          testId={`button-manager-reject-${reg.id}`}
                          variant="danger"
                          className="px-2.5 text-xs"
                          disabled={busyId === reg.id}
                          onClick={() => setRejectingId(reg.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assigned Employees */}
      <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold">Assigned active employees</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Employees assigned to you by HR administration.
          </p>
        </div>

        {employees.length === 0 ? (
          <EmptyState
            title="No assigned employees"
            detail="HR has not assigned active employees to your team yet."
          />
        ) : (
          <div className="divide-y divide-border">
            {employees.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{employee.name}</p>
                  <p className="text-xs text-muted-foreground">{employee.email}</p>
                </div>
                <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type RegistrationItem = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  emailVerifiedAt?: string;
  reviewedByHrUserId?: number;
  reviewerName?: string;
  reviewedAt?: string;
  reviewReason?: string;
  assignedManagerUserId?: number | null;
  assignedManagerName?: string | null;
  needsHrReview?: boolean;
};

function HRRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Inactive'>('All');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const refresh = () => {
    authRequest<RegistrationItem[]>('/api/hr/employee-registrations')
      .then(setRegistrations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load registrations.'));
    authRequest<EligibleManager[]>('/api/hr/eligible-managers')
      .then(setEligibleManagers)
      .catch(() => setEligibleManagers([]));
    authRequest<CorrectionRequest[]>('/api/hr/correction-requests')
      .then(setCorrectionRequests)
      .catch(() => setCorrectionRequests([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleApprove = async (item: RegistrationItem) => {
    if (!window.confirm(`Approve registration for ${item.name} (${item.email})?`)) return;
    setBusyId(item.id);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/employee-registrations/${item.id}/approve`, { method: 'POST', body: '{}' });
      setMessage(`Registration for ${item.name} approved successfully.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve registration.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (item: RegistrationItem) => {
    setBusyId(item.id);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/employee-registrations/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason || 'Registration not approved by HR.' }),
      });
      setMessage(`Registration for ${item.name} rejected.`);
      setRejectingId(null);
      setRejectReason('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject registration.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignManager = async (registrationId: number) => {
    if (!selectedManagerId) {
      setError('Please select an eligible manager.');
      return;
    }
    setBusyId(registrationId);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/employee-registrations/${registrationId}/assign-manager`, {
        method: 'POST',
        body: JSON.stringify({ managerUserId: Number(selectedManagerId) }),
      });
      setMessage('Manager successfully assigned to employee registration.');
      setAssigningId(null);
      setSelectedManagerId('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign manager.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveCorrection = async (requestId: number) => {
    setBusyId(requestId);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/correction-requests/${requestId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: resolutionNote.trim() || 'Updated in HR records.' }),
      });
      setMessage('Correction request marked as resolved.');
      setResolvingId(null);
      setResolutionNote('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resolve correction request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissCorrection = async (requestId: number) => {
    setBusyId(requestId);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/correction-requests/${requestId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ note: resolutionNote.trim() || 'Dismissed by HR.' }),
      });
      setMessage('Correction request dismissed.');
      setDismissingId(null);
      setResolutionNote('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to dismiss correction request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleState = async (item: RegistrationItem, action: 'activate' | 'deactivate') => {
    const actionLabel = action === 'activate' ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${item.name}?`)) return;
    setBusyId(item.id);
    setMessage('');
    setError('');
    try {
      await ensureCsrf();
      await authRequest(`/api/hr/employees/${item.id}/${action}`, { method: 'POST', body: '{}' });
      setMessage(`Account ${actionLabel}d successfully.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${actionLabel} account.`);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = registrations.filter((item) => {
    const matchQuery = item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.email.toLowerCase().includes(query.toLowerCase());
    if (!matchQuery) return false;
    if (filter === 'All') return true;
    if (filter === 'Pending') return item.status === 'PENDING_APPROVAL';
    if (filter === 'Approved') return item.status === 'ACTIVE';
    if (filter === 'Rejected') return item.status === 'REJECTED';
    if (filter === 'Inactive') return item.status === 'INACTIVE';
    return true;
  });

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="People operations"
        title="Employee registrations & approval"
        detail="Assign registrations to eligible managers, review pending signups, and handle profile corrections."
      />
      {message && <p role="alert" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm font-semibold text-rose-700">{error}</p>}

      {/* Registrations List */}
      <div className="mb-8 rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-search-registrations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {(['All', 'Pending', 'Approved', 'Rejected', 'Inactive'] as const).map((item) => (
              <button
                key={item}
                data-testid={`button-filter-${item.toLowerCase()}`}
                onClick={() => setFilter(item)}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {rejectingId !== null && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <h3 className="text-sm font-bold text-rose-900">Reject registration</h3>
            <p className="mt-1 text-xs text-rose-700">Please provide an optional reason for the registration rejection:</p>
            <input
              data-testid="input-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Ineligible email address or unverified credentials"
              className="mt-3 h-10 w-full rounded-lg border border-rose-300 bg-white px-3 text-sm outline-none focus:border-rose-500"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                testId="button-confirm-reject"
                variant="danger"
                disabled={busyId !== null}
                onClick={() => {
                  const item = registrations.find((r) => r.id === rejectingId);
                  if (item) handleReject(item);
                }}
              >
                {busyId === rejectingId ? 'Rejecting…' : 'Confirm rejection'}
              </Button>
              <Button
                testId="button-cancel-reject"
                variant="ghost"
                onClick={() => { setRejectingId(null); setRejectReason(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="py-3 font-medium">Email verified</th>
                <th className="py-3 font-medium">Status & alerts</th>
                <th className="py-3 font-medium">Assigned manager</th>
                <th className="py-3 font-medium">Review history</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} data-testid={`row-registration-${item.id}`} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {initials(item.name)}
                      </div>
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-xs text-muted-foreground">
                    {item.emailVerifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check size={13} /> Verified
                      </span>
                    ) : (
                      <span className="text-amber-700">Pending OTP</span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <Badge tone={statusTone(item.status)}>
                        {item.status === 'PENDING_APPROVAL' ? 'Pending approval' :
                         item.status === 'ACTIVE' ? 'Approved' :
                         item.status === 'REJECTED' ? 'Rejected' :
                         item.status === 'INACTIVE' ? 'Inactive' : item.status}
                      </Badge>
                      {item.needsHrReview && (
                        <Badge tone="warning">⚠️ Needs HR Review</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-xs text-muted-foreground">
                    {assigningId === item.id ? (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <select
                          data-testid={`select-manager-${item.id}`}
                          value={selectedManagerId}
                          onChange={(e) => setSelectedManagerId(e.target.value)}
                          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                        >
                          <option value="">Choose eligible manager...</option>
                          {eligibleManagers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.email})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <Button
                            testId={`button-confirm-assign-${item.id}`}
                            className="px-2 py-1 text-[11px] h-7 min-h-0"
                            disabled={busyId === item.id || !selectedManagerId}
                            onClick={() => handleAssignManager(item.id)}
                          >
                            Save
                          </Button>
                          <Button
                            testId={`button-cancel-assign-${item.id}`}
                            variant="ghost"
                            className="px-2 py-1 text-[11px] h-7 min-h-0"
                            onClick={() => { setAssigningId(null); setSelectedManagerId(''); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {item.assignedManagerName ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.assignedManagerName}</span>
                            {item.status === 'PENDING_APPROVAL' && (
                              <button
                                type="button"
                                data-testid={`button-reassign-${item.id}`}
                                onClick={() => { setAssigningId(item.id); setSelectedManagerId(item.assignedManagerUserId ? String(item.assignedManagerUserId) : ''); }}
                                className="text-[11px] text-primary hover:underline"
                              >
                                Reassign
                              </button>
                            )}
                          </div>
                        ) : item.status === 'PENDING_APPROVAL' ? (
                          <Button
                            testId={`button-assign-manager-${item.id}`}
                            variant="secondary"
                            className="px-2 text-xs h-8 min-h-0"
                            onClick={() => { setAssigningId(item.id); setSelectedManagerId(''); }}
                          >
                            Assign manager
                          </Button>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4 text-xs text-muted-foreground max-w-[200px]">
                    {item.reviewedAt ? (
                      <div>
                        <p className="font-medium text-foreground">Reviewed by {item.reviewerName || 'HR'}</p>
                        <p className="text-[11px]">{new Date(item.reviewedAt).toLocaleDateString()}</p>
                        {item.reviewReason && <p className="mt-1 italic text-slate-500 truncate" title={item.reviewReason}>{item.reviewReason}</p>}
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.status === 'PENDING_APPROVAL' && (
                        <>
                          <Button
                            testId={`button-approve-registration-${item.id}`}
                            className="px-2.5 text-xs"
                            disabled={busyId === item.id}
                            onClick={() => handleApprove(item)}
                          >
                            Approve
                          </Button>
                          <Button
                            testId={`button-reject-registration-${item.id}`}
                            variant="danger"
                            className="px-2.5 text-xs"
                            disabled={busyId === item.id}
                            onClick={() => setRejectingId(item.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {item.status === 'ACTIVE' && (
                        <Button
                          testId={`button-deactivate-user-${item.id}`}
                          variant="ghost"
                          className="px-2.5 text-xs text-rose-600 hover:text-rose-700"
                          disabled={busyId === item.id}
                          onClick={() => handleToggleState(item, 'deactivate')}
                        >
                          Deactivate
                        </Button>
                      )}
                      {(item.status === 'INACTIVE' || item.status === 'REJECTED') && (
                        <Button
                          testId={`button-activate-user-${item.id}`}
                          variant="ghost"
                          className="px-2.5 text-xs text-emerald-700 hover:text-emerald-800"
                          disabled={busyId === item.id}
                          onClick={() => handleToggleState(item, 'activate')}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              title="No registrations found"
              detail="Try adjusting your search query or filter tab."
            />
          )}
        </div>
      </div>

      {/* Employee Correction Requests Inbox */}
      <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Employee details correction requests</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review and act on profile change requests submitted by employees and managers.
            </p>
          </div>
          <Badge tone={correctionRequests.filter((c) => c.status === 'PENDING').length ? 'warning' : 'success'}>
            {correctionRequests.filter((c) => c.status === 'PENDING').length} pending
          </Badge>
        </div>

        {(resolvingId !== null || dismissingId !== null) && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-muted/40 p-4">
            <h3 className="text-sm font-bold">
              {resolvingId !== null ? 'Resolve correction request' : 'Dismiss correction request'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Add an optional resolution or dismissal note for the employee:</p>
            <input
              data-testid="input-correction-resolution-note"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g., Records updated in directory or Details verified"
              className="mt-3 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                testId="button-confirm-correction-action"
                disabled={busyId !== null}
                onClick={() => {
                  if (resolvingId !== null) handleResolveCorrection(resolvingId);
                  else if (dismissingId !== null) handleDismissCorrection(dismissingId);
                }}
              >
                {busyId !== null ? 'Processing…' : resolvingId !== null ? 'Confirm resolve' : 'Confirm dismiss'}
              </Button>
              <Button
                variant="ghost"
                testId="button-cancel-correction-action"
                onClick={() => { setResolvingId(null); setDismissingId(null); setResolutionNote(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {correctionRequests.length === 0 ? (
          <EmptyState
            title="No correction requests"
            detail="No pending profile correction requests from employees."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="py-3 font-medium">Requested changes</th>
                  <th className="py-3 font-medium">Submitted</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Resolution</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {correctionRequests.map((req) => (
                  <tr key={req.id} data-testid={`row-correction-${req.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{req.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{req.employeeEmail}</p>
                    </td>
                    <td className="py-3 text-xs max-w-xs">{req.requestedChanges}</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3">
                      <Badge tone={statusTone(req.status === 'RESOLVED' ? 'Approved' : req.status === 'PENDING' ? 'Pending' : 'Rejected')}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {req.resolutionNote ? (
                        <div>
                          <p className="font-medium text-foreground">{req.resolutionNote}</p>
                          {req.resolverName && <p className="text-[11px]">By {req.resolverName}</p>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            testId={`button-resolve-req-${req.id}`}
                            className="px-2 py-1 text-xs h-8 min-h-0"
                            disabled={busyId === req.id}
                            onClick={() => { setResolvingId(req.id); setDismissingId(null); setResolutionNote(''); }}
                          >
                            Resolve
                          </Button>
                          <Button
                            testId={`button-dismiss-req-${req.id}`}
                            variant="ghost"
                            className="px-2 py-1 text-xs h-8 min-h-0 text-slate-600 hover:text-slate-800"
                            disabled={busyId === req.id}
                            onClick={() => { setDismissingId(req.id); setResolvingId(null); setResolutionNote(''); }}
                          >
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HRAccessPage() {
  const [requests, setRequests] = useState<Array<{ id: number; status: string; submittedAt: string; reviewReason?: string }>>([]);
  const [message, setMessage] = useState('');
  const refresh = () => authRequest<typeof requests>('/api/hr/manager-access/requests').then(setRequests).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load access requests.'));
  useEffect(() => { refresh(); }, []);
  const decide = async (id: number, action: 'approve' | 'reject') => {
    try { await ensureCsrf(); await authRequest(`/api/hr/manager-access/requests/${id}/${action}`, { method: 'POST', body: action === 'reject' ? JSON.stringify({ reason: 'Reviewed by HR.' }) : '{}' }); setMessage(`Request ${action}d.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update request.'); }
  };
  return <div className="page-enter"><SectionTitle eyebrow="People operations" title="Access control" detail="Review manager access requests. Permissions and assignments remain separate HR actions." />{message && <p role="alert" className="mb-4 text-sm font-semibold text-emerald-700">{message}</p>}<div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">{requests.length === 0 ? <EmptyState title="No manager-access requests" detail="Pending and historical requests will appear here." /> : <div className="divide-y divide-border">{requests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-semibold">Request #{request.id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(request.submittedAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><Badge tone={statusTone(request.status === 'APPROVED' ? 'Approved' : request.status === 'PENDING' ? 'Pending' : request.status === 'REJECTED' ? 'Rejected' : 'Inactive')}>{request.status}</Badge>{request.status === 'PENDING' && <><Button testId={`button-approve-request-${request.id}`} onClick={() => decide(request.id, 'approve')}>Approve</Button><Button testId={`button-reject-request-${request.id}`} variant="danger" onClick={() => decide(request.id, 'reject')}>Reject</Button></>}</div></div>)}</div>}</div></div>;
}

function AppContent() {
  const [role, setRole] = useLocalState<Role>('meridian-role', 'employee');
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [employees, setEmployees] = useLocalState<Employee[]>('meridian-employees', seedEmployees);
  const [attendance, setAttendance] = useLocalState<Attendance[]>('meridian-attendance', seedAttendance);
  const [leaves, setLeaves] = useLocalState<LeaveRequest[]>('meridian-leaves', seedLeaves);
  useEffect(() => { document.documentElement.classList.toggle('dark', localStorage.getItem('meridian-theme') === 'dark'); }, []);
  useEffect(() => {
    let active = true;

    async function initSession() {
      try {
        await ensureCsrf(true);
        if (!active) return;

        const user = await authRequest<AuthUser>('/api/auth/me');
        if (!active) return;

        setRole(user.role === 'HR_ADMIN' ? 'hr' : user.effectiveRoles?.includes('MANAGER') ? 'manager' : 'employee');
        setAuthenticated(true);
      } catch {
        if (active) {
          setAuthenticated(false);
        }
      } finally {
        if (active) {
          setAuthChecking(false);
        }
      }
    }

    initSession();

    return () => {
      active = false;
    };
  }, [setRole]);
  const signIn = (user: AuthUser) => {
    setRole(user.role === 'HR_ADMIN' ? 'hr' : user.effectiveRoles?.includes('MANAGER') ? 'manager' : 'employee');
    setAuthenticated(true);
  };
  const signOut = () => {
    ensureCsrf()
      .then(() => authRequest<AuthMessage>('/api/auth/logout', { method: 'POST' }))
      .catch(() => undefined)
      .finally(() => setAuthenticated(false));
  };
  if (authChecking) return <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">Checking your session…</div>;
  const page = (component: ReactNode) => authenticated
    ? <Shell role={role} setRole={setRole} onSignOut={signOut}>{component}</Shell>
    : <BackendSignIn setRole={setRole} onSignIn={signIn} />;
  return <Switch><Route path="/"><BackendSignIn setRole={setRole} onSignIn={signIn} /></Route><Route path="/employee/dashboard">{page(<EmployeeDashboard employees={employees} attendance={attendance} leaves={leaves} />)}</Route><Route path="/employee/attendance">{page(<EmployeeAttendance attendance={attendance} setAttendance={setAttendance} />)}</Route><Route path="/employee/leave">{page(<EmployeeLeave leaves={leaves} setLeaves={setLeaves} />)}</Route><Route path="/employee/profile">{page(<EmployeeProfile employees={employees} setEmployees={setEmployees} />)}</Route><Route path="/manager/dashboard">{page(<ManagerDashboard />)}</Route><Route path="/hr/dashboard">{page(<HRDashboard employees={employees} attendance={attendance} leaves={leaves} />)}</Route><Route path="/hr/registrations">{page(<HRRegistrationsPage />)}</Route><Route path="/hr/employees">{page(<HREmployees employees={employees} setEmployees={setEmployees} />)}</Route><Route path="/hr/access">{page(<HRAccessPage />)}</Route><Route path="/hr/leave-requests">{page(<HRLeaveRequests leaves={leaves} setLeaves={setLeaves} />)}</Route><Route path="/hr/attendance">{page(<HRAttendance attendance={attendance} employees={employees} />)}</Route><Route path="/hr/reports">{page(<HRReports attendance={attendance} leaves={leaves} />)}</Route><Route path="/settings">{page(<SettingsPage role={role} />)}</Route><Route><BackendSignIn setRole={setRole} onSignIn={signIn} /></Route></Switch>;
}
function Router() { return <ErrorBoundary resetKey={window.location.pathname}><AppContent /></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;