import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertCircle, ArrowRight, BarChart3, Bell, CalendarCheck2,
  CalendarDays, Camera, Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download,
  ExternalLink, Eye, File, FileCheck, FilePlus, FileText, Filter, LayoutDashboard, ListFilter, LogOut, Mail, Menu,
  Paperclip, Pencil, Plus, Search, Settings, ShieldCheck, Trash2, UploadCloud, UserCheck, UserCog, UserRound, Users,
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

type LeaveAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedBy: string;
  attachments?: LeaveAttachment[];
  managerRecommendation?: 'Recommended' | 'Flagged' | 'Pending';
  managerNote?: string;
  managerReviewedBy?: string;
  managerReviewedAt?: string;
  hrResolutionNote?: string;
};
type Department = { id: string; name: string; employeeCount: number };
type DemoAccount = { email: string; password: string; role: Role };

type PersonalDetails = {
  id: number;
  employeeId?: string | null;
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

function getActiveEmployee(
  currentUser: AuthUser | null | undefined,
  employees: Employee[]
): Employee | null {
  if (!currentUser) return null;
  const match = employees.find(
    (e) => e.email.toLowerCase() === currentUser.email.toLowerCase()
  );
  if (match) return match;

  const uniqueId = currentUser.employeeId || `EMP-${1040 + currentUser.id}`;
  return {
    id: uniqueId,
    name: currentUser.name,
    email: currentUser.email,
    phone: '—',
    department: 'Student Services',
    designation: currentUser.role === 'HR_ADMIN' ? 'HR Administrator' : 'Employee',
    joiningDate: today,
    status: 'Active',
  };
}
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
const sampleMedicalCertificateDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780" fill="none">
  <rect width="600" height="780" fill="#FFFFFF" rx="8"/>
  <rect x="20" y="20" width="560" height="740" fill="none" stroke="#2563EB" stroke-width="2" stroke-dasharray="4 4"/>
  <circle cx="80" cy="80" r="32" fill="#EFF6FF" stroke="#2563EB" stroke-width="2"/>
  <path d="M80 62 V98 M62 80 H98" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>
  <text x="130" y="70" font-family="sans-serif" font-size="20" font-weight="bold" fill="#1E293B">ST. JUDE MEDICAL CLINIC</text>
  <text x="130" y="90" font-family="sans-serif" font-size="12" fill="#64748B">450 University Ave, Suite 300 · Dept. of Internal Medicine</text>
  <text x="130" y="105" font-family="sans-serif" font-size="11" fill="#94A3B8">Tel: (555) 019-8234 · Reg No: MED-88421</text>
  <line x1="50" y1="130" x2="550" y2="130" stroke="#CBD5E1" stroke-width="1.5"/>
  <text x="300" y="170" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0F172A" text-decoration="underline">MEDICAL FITNESS &amp; SICK LEAVE CERTIFICATE</text>
  <text x="50" y="220" font-family="sans-serif" font-size="13" fill="#334155">Date of Examination: <tspan font-weight="bold">March 10, 2025</tspan></text>
  <text x="50" y="250" font-family="sans-serif" font-size="13" fill="#334155">Patient Name: <tspan font-weight="bold">Priya Nair (EMP-1028)</tspan></text>
  <text x="50" y="280" font-family="sans-serif" font-size="13" fill="#334155">Diagnosis: <tspan font-weight="bold">Acute Viral Gastritis &amp; Dehydration</tspan></text>
  <text x="50" y="320" font-family="sans-serif" font-size="13" fill="#334155">Clinical Advice &amp; Recommendation:</text>
  <rect x="50" y="335" width="500" height="120" fill="#F8FAFC" stroke="#E2E8F0" rx="6"/>
  <text x="70" y="365" font-family="sans-serif" font-size="12" fill="#475569">This is to certify that the patient mentioned above was examined and</text>
  <text x="70" y="388" font-family="sans-serif" font-size="12" fill="#475569">diagnosed with acute viral gastroenteritis with severe dehydration.</text>
  <text x="70" y="411" font-family="sans-serif" font-size="12" fill="#475569">Complete bed rest and prescribed intravenous hydration therapy were advised</text>
  <text x="70" y="434" font-family="sans-serif" font-size="12" font-weight="bold" fill="#2563EB">from March 10, 2025 for 1 to 2 days for recovery.</text>
  <text x="50" y="500" font-family="sans-serif" font-size="12" fill="#64748B">Prescribed Medications: Oral Rehydration Salts, Ondansetron, Probiotics.</text>
  <text x="50" y="525" font-family="sans-serif" font-size="12" fill="#64748B">Fitness to resume duty: <tspan font-weight="bold" fill="#059669">Expected March 11, 2025 upon follow-up.</tspan></text>
  <circle cx="460" cy="620" r="45" fill="none" stroke="#DC2626" stroke-width="2" stroke-dasharray="3 3"/>
  <text x="460" y="615" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#DC2626">ST. JUDE CLINIC</text>
  <text x="460" y="628" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#DC2626">OFFICIAL VERIFIED</text>
  <text x="460" y="640" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#DC2626">MAR 10, 2025</text>
  <text x="460" y="690" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1E293B">Dr. Sarah Jenkins, M.D.</text>
  <text x="460" y="705" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#64748B">Attending Physician · Lic #84920</text>
</svg>
`);

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const seedLeaves: LeaveRequest[] = [
  {
    id: 'LV-2208',
    employeeId: 'EMP-1037',
    employeeName: 'Jon Bell',
    leaveType: 'Personal leave',
    fromDate: '2025-03-24',
    toDate: '2025-03-24',
    reason: 'Family appointment',
    status: 'Pending',
    appliedDate: '2025-03-19',
    approvedBy: '—',
    managerRecommendation: 'Pending',
  },
  {
    id: 'LV-2207',
    employeeId: 'EMP-1042',
    employeeName: 'Maya Chen',
    leaveType: 'Annual leave',
    fromDate: '2025-04-03',
    toDate: '2025-04-04',
    reason: 'Personal travel',
    status: 'Approved',
    appliedDate: '2025-03-12',
    approvedBy: 'Avery Morgan',
    managerRecommendation: 'Recommended',
    managerNote: 'Travel schedule checked, team coverage confirmed.',
    managerReviewedBy: 'Jordan Reed (Manager)',
    managerReviewedAt: '2025-03-12',
  },
  {
    id: 'LV-2202',
    employeeId: 'EMP-1028',
    employeeName: 'Priya Nair',
    leaveType: 'Sick leave',
    fromDate: '2025-03-10',
    toDate: '2025-03-10',
    reason: 'Acute viral gastritis - medical rest advised',
    status: 'Approved',
    appliedDate: '2025-03-10',
    approvedBy: 'Avery Morgan',
    managerRecommendation: 'Recommended',
    managerNote: 'Valid clinic certificate submitted by employee and verified.',
    managerReviewedBy: 'Jordan Reed (Manager)',
    managerReviewedAt: '2025-03-10',
    attachments: [
      {
        id: 'att-seed-01',
        name: 'St_Jude_Medical_Certificate_Priya_Nair.svg',
        size: 14200,
        type: 'image/svg+xml',
        dataUrl: sampleMedicalCertificateDataUrl,
        uploadedAt: '2025-03-10T08:30:00Z',
      },
    ],
  },
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
function initials(name: string) {
  if (!name) return 'U';
  const parts = name.split(' ').filter(Boolean);
  return (parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase()) || 'U';
}
function cx(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }

type UserProfileData = {
  photo: string | null;
  about: string;
  displayName?: string;
  fullName?: string;
  gender?: string;
  country?: string;
  language?: string;
  timeZone?: string;
  mobileNumber?: string;
  residentialAddress?: string;
  secondaryEmails?: Array<{ email: string; addedAt?: string; label?: string }>;
  updatedAt?: number;
};

type WhatsAppProfileData = UserProfileData;

const ALL_PROFILES_KEY = 'meridian_all_user_profiles';

const PROFESSIONAL_STATUS_PRESETS = [
  { label: 'Available', emoji: '🟢' },
  { label: 'At work', emoji: '💼' },
  { label: 'In a meeting', emoji: '📅' },
  { label: 'Working remotely', emoji: '🏠' },
  { label: 'Focus mode', emoji: '⚡' },
  { label: 'On annual leave', emoji: '🌴' },
  { label: 'Urgent matters only', emoji: '📞' },
  { label: 'Business travel', emoji: '✈️' },
];

const WHATSAPP_PRESET_STATUSES = PROFESSIONAL_STATUS_PRESETS;

function loadAllUserProfiles(): Record<string, UserProfileData> {
  try {
    const raw = localStorage.getItem(ALL_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadUserProfile(identifier?: string | number): UserProfileData {
  const defaultProfile: UserProfileData = {
    photo: null,
    about: 'Available',
    displayName: '',
    fullName: '',
    gender: 'MALE',
    country: 'United States',
    language: 'English (US)',
    timeZone: '(GMT-05:00) Eastern Time (US & Canada)',
    mobileNumber: '',
    residentialAddress: '',
    secondaryEmails: [],
  };
  if (!identifier) {
    return defaultProfile;
  }
  const clean = String(identifier).toLowerCase().trim();
  const all = loadAllUserProfiles();
  if (all[clean]) {
    return { ...defaultProfile, ...all[clean] };
  }
  try {
    const raw = localStorage.getItem(`meridian_profile_${clean}`);
    if (raw) return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {}
  try {
    const rawOld = localStorage.getItem(`meridian_whatsapp_profile_${clean}`);
    if (rawOld) return { ...defaultProfile, ...JSON.parse(rawOld) };
  } catch {}
  return defaultProfile;
}

function saveUserProfile(
  userRef: { email?: string; id?: string | number; employeeId?: string; name?: string } | string | number | undefined,
  data: UserProfileData
) {
  try {
    const all = loadAllUserProfiles();
    const updatedData = { ...data, updatedAt: Date.now() };

    const keys: string[] = [];
    if (typeof userRef === 'object' && userRef !== null) {
      if (userRef.email) keys.push(userRef.email.toLowerCase().trim());
      if (userRef.employeeId) keys.push(userRef.employeeId.toLowerCase().trim());
      if (userRef.id !== undefined && userRef.id !== null) keys.push(String(userRef.id).toLowerCase().trim());
      if (userRef.name) keys.push(userRef.name.toLowerCase().trim());
    } else if (userRef) {
      keys.push(String(userRef).toLowerCase().trim());
    } else {
      keys.push('default');
    }

    for (const k of keys) {
      all[k] = updatedData;
      localStorage.setItem(`meridian_profile_${k}`, JSON.stringify(updatedData));
      localStorage.setItem(`meridian_whatsapp_profile_${k}`, JSON.stringify(updatedData));
    }
    localStorage.setItem(ALL_PROFILES_KEY, JSON.stringify(all));

    window.dispatchEvent(new CustomEvent('meridian-profile-updated', { detail: { keys, data: updatedData } }));
  } catch (e) {
    console.error('Failed to save profile in localStorage', e);
  }
}

const loadWhatsAppProfile = loadUserProfile;
const saveWhatsAppProfile = saveUserProfile;

function getUserPhoto(user?: { email?: string; id?: string | number; employeeId?: string; name?: string } | string | null): string | null {
  if (!user) return null;
  if (typeof user === 'string') {
    const direct = loadUserProfile(user);
    if (direct.photo) return direct.photo;
    const all = loadAllUserProfiles();
    return all[user.toLowerCase().trim()]?.photo || null;
  }
  if (user.email) {
    const byEmail = loadUserProfile(user.email);
    if (byEmail.photo) return byEmail.photo;
  }
  if (user.employeeId) {
    const byEmpId = loadUserProfile(user.employeeId);
    if (byEmpId.photo) return byEmpId.photo;
  }
  if (user.id !== undefined && user.id !== null) {
    const byId = loadUserProfile(user.id);
    if (byId.photo) return byId.photo;
  }
  if (user.name) {
    const byName = loadUserProfile(user.name);
    if (byName.photo) return byName.photo;
  }
  const all = loadAllUserProfiles();
  if (user.email && all[user.email.toLowerCase().trim()]?.photo) {
    return all[user.email.toLowerCase().trim()].photo;
  }
  if (user.employeeId && all[user.employeeId.toLowerCase().trim()]?.photo) {
    return all[user.employeeId.toLowerCase().trim()].photo;
  }
  if (user.name && all[user.name.toLowerCase().trim()]?.photo) {
    return all[user.name.toLowerCase().trim()].photo;
  }
  return null;
}

function DocumentViewerModal({
  doc,
  onClose,
}: {
  doc: LeaveAttachment | null;
  onClose: () => void;
}) {
  if (!doc) return null;

  const isImage = doc.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.name);
  const isPdf = doc.type.includes('pdf') || /\.pdf$/i.test(doc.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full rounded-2xl bg-white dark:bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{doc.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFileSize(doc.size)} · Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'recently'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={doc.dataUrl}
              download={doc.name}
              data-testid="button-download-doc"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Download size={14} /> Download
            </a>
            <button
              type="button"
              data-testid="button-close-doc-modal"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-5 bg-slate-50 dark:bg-muted/10 flex items-center justify-center min-h-[360px]">
          {isImage ? (
            <img
              src={doc.dataUrl}
              alt={doc.name}
              className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-md border border-slate-200 dark:border-border"
            />
          ) : isPdf ? (
            <div className="w-full h-[65vh] flex flex-col">
              <iframe
                src={doc.dataUrl}
                title={doc.name}
                className="w-full flex-1 rounded-lg border border-border bg-white shadow-xs"
              />
              <p className="text-center text-xs text-muted-foreground mt-2">
                If the document does not render directly in your browser,{' '}
                <a href={doc.dataUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  open in new tab
                </a>{' '}
                or use Download above.
              </p>
            </div>
          ) : (
            <div className="text-center p-8 max-w-md">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary mx-auto mb-4">
                <FileText size={32} />
              </div>
              <h4 className="text-base font-bold text-foreground">{doc.name}</h4>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                This document ({formatFileSize(doc.size)}) can be saved and viewed locally on your device.
              </p>
              <a
                href={doc.dataUrl}
                download={doc.name}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Download size={16} /> Download {doc.name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserAvatar({
  user,
  name,
  className = "h-9 w-9",
  textClassName = "text-xs",
  bordered = false,
}: {
  user?: { email?: string; id?: string | number; employeeId?: string; name?: string } | string | null;
  name?: string;
  className?: string;
  textClassName?: string;
  bordered?: boolean;
}) {
  const effectiveName = name || (typeof user === 'object' && user ? user.name : '') || 'User';
  const [photo, setPhoto] = useState<string | null>(() => getUserPhoto(user || name));

  useEffect(() => {
    setPhoto(getUserPhoto(user || name));
    const handleUpdate = () => {
      setPhoto(getUserPhoto(user || name));
    };
    window.addEventListener('meridian-profile-updated', handleUpdate);
    return () => window.removeEventListener('meridian-profile-updated', handleUpdate);
  }, [user, name]);

  if (photo) {
    return (
      <img
        src={photo}
        alt={effectiveName}
        className={cx(
          "object-cover shrink-0 rounded-full",
          bordered && "border border-border/80 shadow-xs",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cx(
        "grid place-items-center bg-primary/10 font-bold text-primary shrink-0 rounded-full",
        textClassName,
        bordered && "border border-border/60",
        className
      )}
    >
      {initials(effectiveName)}
    </div>
  );
}

function formatGender(value?: string | null): string {
  if (!value) return 'Not specified';
  const canonical = value.trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_');
  const labels: Record<string, string> = {
    MALE: 'Male',
    FEMALE: 'Female',
    NON_BINARY: 'Non-binary',
    PREFER_NOT_TO_SAY: 'Prefer not to say',
    OTHER: 'Other',
  };
  return labels[canonical] || value;
}

function normalizeGenderValue(value?: string | null): string {
  if (!value) return '';
  const canonical = value.trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_');
  const valid = ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER'];
  return valid.includes(canonical) ? canonical : value;
}

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

function Shell({ role, setRole, onSignOut, currentUser, children }: { role: Role; setRole: (role: Role) => void; onSignOut: () => void; currentUser?: AuthUser | null; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const employeeNav = [
    { href: '/employee/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/employee/attendance', label: 'My attendance', icon: CalendarCheck2 },
    { href: '/employee/leave', label: 'Leave', icon: FileText },
    { href: '/employee/profile', label: 'Profile', icon: UserRound }
  ];
  const hrNav = [
    { href: '/hr/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/hr/registrations', label: 'Registrations', icon: UserCheck },
    { href: '/hr/employees', label: 'Employees', icon: Users },
    { href: '/hr/access', label: 'Access control', icon: ShieldCheck },
    { href: '/hr/leave-requests', label: 'Leave requests', icon: FileText },
    { href: '/hr/attendance', label: 'Attendance', icon: CalendarCheck2 },
    { href: '/hr/reports', label: 'Reports', icon: BarChart3 },
    { href: '/employee/profile', label: 'My profile', icon: UserRound }
  ];
  const managerNav = [
    { href: '/manager/dashboard', label: 'Assigned employees', icon: Users },
    { href: '/manager/leave-review', label: 'Team leave & proofs', icon: FileText },
    { href: '/employee/profile', label: 'My profile', icon: UserRound }
  ];
  const nav = role === 'hr' ? hrNav : role === 'manager' ? managerNav : employeeNav;
  const active = (href: string) => location === href;
  const navigate = (href: string) => { setLocation(href); setMenuOpen(false); setUserMenuOpen(false); };

  const userIdentifier = currentUser?.email || (role === 'hr' ? 'hr' : 'employee');
  const [userProfile, setUserProfile] = useState(() => loadUserProfile(userIdentifier));

  useEffect(() => {
    setUserProfile(loadUserProfile(userIdentifier));
    const handleUpdate = () => {
      setUserProfile(loadUserProfile(userIdentifier));
    };
    window.addEventListener('meridian-profile-updated', handleUpdate);
    return () => window.removeEventListener('meridian-profile-updated', handleUpdate);
  }, [userIdentifier]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const defaultName = role === 'hr' ? 'Avery Morgan' : 'Maya Chen';
  const displayName = userProfile.displayName || currentUser?.name || defaultName;
  const roleTitle = role === 'hr' ? 'HR Administrator' : role === 'manager' ? 'Manager' : 'Employee';

  return <div className="grain min-h-[100dvh] bg-background">
    <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 transition-transform duration-300 lg:translate-x-0', menuOpen ? 'translate-x-0' : '-translate-x-full')}>
      <LogoMark />
      <div
        className="mt-9 flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5 cursor-pointer hover:border-sidebar-primary/40 transition-colors"
        onClick={() => navigate('/employee/profile')}
        title="View profile"
      >
        <UserAvatar
          user={{ email: userIdentifier, name: displayName }}
          className="h-8 w-8 ring-1 ring-emerald-500/40"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">{displayName}</p>
          <p className="text-[10px] text-slate-400">{roleTitle}</p>
        </div>
        <ChevronDown size={15} className="ml-auto text-slate-400" />
      </div>
      <div className="mono mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{role === 'hr' ? 'Workspace' : role === 'manager' ? 'Manager workspace' : 'My workspace'}</div>
      <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active(href) ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-slate-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Icon size={18} /><span>{label}</span>{label === 'Leave requests' && <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">1</span>}</Link>)}</nav>
      <div className="mono mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Account</div>
      <nav className="space-y-1">
        <Link href="/employee/profile" data-testid="link-my-profile" className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active('/employee/profile') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-slate-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><UserRound size={18} /><span>My profile</span></Link>
        <Link href="/settings" data-testid="link-settings" className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active('/settings') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-slate-400 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Settings size={18} /><span>Settings</span></Link>
      </nav>
      <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-3.5"><div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><ShieldCheck size={15} className="text-sidebar-primary" /> Local demo mode</div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">Data stays in this browser. No production authentication is connected.</p></div>
      <button data-testid="button-sign-out" onClick={() => { onSignOut(); navigate('/'); }} className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><LogOut size={18} /> Sign out</button>
    </aside>
    {menuOpen && <button aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}
    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md md:px-8">
        <button data-testid="button-open-menu" onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu size={21} /></button>
        <div className="hidden text-sm text-muted-foreground lg:block">{role === 'hr' ? 'People operations / Overview' : role === 'manager' ? 'Manager workspace / Assigned employees' : 'Employee workspace / Overview'}</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Backend session</div>
          <button data-testid="button-notifications" onClick={() => window.alert('No new notifications in this local demo.')} className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Bell size={19} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" /></button>

          {/* Interactive Top-Right User Profile Avatar & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              data-testid="button-user-menu"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              className="flex items-center gap-2.5 rounded-full p-1 pl-1.5 pr-2.5 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <UserAvatar
                user={{ email: userIdentifier, name: displayName }}
                className="h-9 w-9 rounded-full ring-2 ring-primary/20 shadow-xs"
              />
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight text-foreground">{displayName}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">{roleTitle}</p>
              </div>
              <ChevronDown size={14} className={cx('text-muted-foreground transition-transform duration-200', userMenuOpen && 'rotate-180')} />
            </button>

            {userMenuOpen && (
              <div
                data-testid="user-dropdown-menu"
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border bg-card p-2 shadow-xl ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Profile Preview Card */}
                <div className="rounded-xl bg-muted/60 p-3 mb-1">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      user={{ email: userIdentifier, name: displayName }}
                      className="h-11 w-11 rounded-full ring-2 ring-background"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{currentUser?.email || (role === 'hr' ? 'hr@northstar.edu' : 'employee@northstar.edu')}</p>
                      <div className="mt-1">
                        <Badge tone={role === 'hr' ? 'info' : role === 'manager' ? 'warning' : 'success'}>
                          {roleTitle}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {/* Status Preview */}
                  <div className="mt-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate italic">"{userProfile.about || 'Available'}"</span>
                  </div>
                </div>

                {/* Quick Status Selector */}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Quick status</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PROFESSIONAL_STATUS_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          saveUserProfile(userIdentifier, { ...userProfile, about: `${preset.emoji} ${preset.label}` });
                        }}
                        className={cx(
                          "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-left transition-colors cursor-pointer",
                          userProfile.about?.includes(preset.label) ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span>{preset.emoji}</span>
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="my-1 border-t border-border" />

                {/* Navigation Items */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    data-testid="dropdown-link-profile"
                    onClick={() => {
                      navigate('/employee/profile');
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
                  >
                    <UserRound size={15} className="text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-semibold leading-none">My Profile</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Edit photo, name & status</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-testid="dropdown-link-settings"
                    onClick={() => {
                      navigate('/settings');
                      setUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
                  >
                    <Settings size={15} className="text-muted-foreground" />
                    <div className="text-left">
                      <p className="font-semibold leading-none">Settings</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">System preferences & theme</p>
                    </div>
                  </button>
                </div>

                <div className="my-1 border-t border-border" />

                {/* Sign Out */}
                <button
                  type="button"
                  data-testid="dropdown-button-sign-out"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onSignOut();
                    navigate('/');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
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
      <div className="mt-4 flex justify-between text-xs font-semibold text-primary"><button type="button" onClick={() => { setMode('signup'); setStep('form'); setMessage(''); setCooldown(0); ensureCsrf().catch(() => {}); }}>Create account</button><button type="button" onClick={() => { setMode('reset'); setStep('form'); setMessage(''); setCooldown(0); ensureCsrf(true).catch(() => {}); }}>Forgot password?</button></div>
      {mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setStep('form'); setMessage(''); setCooldown(0); ensureCsrf().catch(() => {}); }} className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground">Back to sign in</button>}
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

function EmployeeDashboard({
  employees,
  attendance,
  leaves,
  currentUser,
}: {
  employees: Employee[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  currentUser?: AuthUser | null;
}) {
  const employee = getActiveEmployee(currentUser, employees);
  if (!employee) {
    return (
      <div className="page-enter p-8 text-center">
        <EmptyState
          title="Account not linked"
          detail="No employee profile was found for your account. Please contact HR administration."
        />
      </div>
    );
  }

  const todayRecord = attendance.find((item) => item.employeeId === employee.id && item.workDate === today);
  const recentLeaves = leaves.filter((item) => item.employeeId === employee.id).slice(0, 3);
  const approvedLeaves = leaves.filter((item) => item.employeeId === employee.id && item.status === 'Approved');
  const approvedDays = approvedLeaves.reduce((acc, leave) => {
    try {
      const from = new Date(leave.fromDate).getTime();
      const to = new Date(leave.toDate).getTime();
      const diff = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1);
      return acc + (isNaN(diff) ? 1 : diff);
    } catch {
      return acc + 1;
    }
  }, 0);
  const annualAllowance = 25;
  const leaveBalance = Math.max(0, annualAllowance - approvedDays);
  const percentAllowance = Math.min(100, Math.round((leaveBalance / annualAllowance) * 100));

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow={formatDate(today)}
        title={`Good morning, ${employee.name.split(' ')[0]}.`}
        detail="Here is your workday at a glance."
        action={
          <Badge tone="info">
            <ShieldCheck size={12} /> Employee view ({employee.id})
          </Badge>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-primary-foreground/70">Today’s attendance</p>
              <p className="mt-3 text-4xl font-bold tracking-[-.05em]">{todayRecord?.checkIn || 'Not started'}</p>
              <p className="mt-1 text-sm text-primary-foreground/70">
                {todayRecord?.checkIn ? 'Check-in recorded · On schedule' : 'Your workday is waiting for you'}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-3"><Clock3 size={23} /></div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/15 pt-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {todayRecord?.checkOut ? `Checked out at ${todayRecord.checkOut}` : todayRecord?.checkIn ? 'Currently working' : 'Not checked in'}
            </span>
            <span className="text-primary-foreground/50">•</span>
            <span className="text-primary-foreground/70">Expected: 8 hours</span>
          </div>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Leave balance</p>
          <p className="mt-3 text-4xl font-bold tracking-[-.05em]">
            {leaveBalance} <span className="text-base font-medium text-muted-foreground">days</span>
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent" style={{ width: `${percentAllowance}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{annualAllowance} days annual allowance</p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_.85fr]">
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Recent leave</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your latest requests and decisions</p>
            </div>
            <Link href="/employee/leave" data-testid="link-view-all-leave" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentLeaves.length ? (
            <div className="divide-y divide-border">
              {recentLeaves.map((leave) => (
                <div key={leave.id} data-testid={`row-recent-leave-${leave.id}`} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{leave.leaveType}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(leave.fromDate)} {leave.fromDate !== leave.toDate && `— ${formatDate(leave.toDate)}`}
                      </p>
                    </div>
                  </div>
                  <Badge tone={statusTone(leave.status)}>{leave.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No leave requests yet" detail="Your submitted requests will appear here." />
          )}
        </div>
        <div className="space-y-6">
          <ManagerAccessCard />
          <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><CircleHelp size={17} /></div>
              <h2 className="font-bold">Need a hand?</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Keep your attendance current and submit leave early so your manager has time to review it.
            </p>
            <Link href="/employee/attendance" data-testid="link-go-attendance" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Open attendance <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-border py-10 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground"><FileText size={18} /></div><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }

function EmployeeAttendance({
  attendance,
  setAttendance,
  currentUser,
  employees,
}: {
  attendance: Attendance[];
  setAttendance: (value: Attendance[] | ((prev: Attendance[]) => Attendance[])) => void;
  currentUser?: AuthUser | null;
  employees: Employee[];
}) {
  const currentEmployee = getActiveEmployee(currentUser, employees);
  const me = currentEmployee?.id || '';
  const todayRecord = attendance.find((item) => item.employeeId === me && item.workDate === today);
  const [notice, setNotice] = useState('');
  const checkIn = () => {
    if (!me || todayRecord?.checkIn) return;
    setAttendance((prev) => [
      {
        employeeId: me,
        workDate: today,
        checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        checkOut: '',
        status: 'Present',
        workingHours: '—',
      },
      ...prev,
    ]);
    setNotice('Check-in saved locally.');
  };
  const checkOut = () => {
    if (!me || !todayRecord?.checkIn || todayRecord.checkOut) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setAttendance((prev) =>
      prev.map((item) =>
        item.employeeId === me && item.workDate === today
          ? { ...item, checkOut: time, workingHours: '8h 00m' }
          : item
      )
    );
    setNotice('Check-out saved locally.');
  };
  const myHistory = me ? attendance.filter((item) => item.employeeId === me).slice(0, 8) : [];
  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="My workspace"
        title="Attendance"
        detail="Record your workday and review your attendance history."
        action={
          <Badge tone="info">
            <CalendarCheck2 size={12} /> {formatDate(today)}
          </Badge>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today</p>
              <h2 className="mt-1 text-2xl font-bold">{todayRecord?.checkIn ? 'Workday in progress' : 'Ready to begin?'}</h2>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock3 size={22} />
            </div>
          </div>
          <div className="my-7 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="text-xs text-muted-foreground">Check in</p>
              <p className="mono mt-2 text-lg font-bold">{todayRecord?.checkIn || '—'}</p>
            </div>
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="text-xs text-muted-foreground">Check out</p>
              <p className="mono mt-2 text-lg font-bold">{todayRecord?.checkOut || '—'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button testId="button-check-in" onClick={checkIn} disabled={!me || Boolean(todayRecord?.checkIn)}>
              <Check size={16} /> Check in
            </Button>
            <Button
              testId="button-check-out"
              variant="secondary"
              onClick={checkOut}
              disabled={!me || !todayRecord?.checkIn || Boolean(todayRecord?.checkOut)}
            >
              Check out
            </Button>
          </div>
          {notice && (
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={15} /> {notice}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Attendance history</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your most recent workdays</p>
            </div>
            <Button testId="button-attendance-filter" variant="ghost" className="px-2">
              <Filter size={16} /> Filter
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Check in</th>
                  <th className="pb-3 font-medium">Check out</th>
                  <th className="pb-3 font-medium">Hours</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myHistory.length > 0 ? (
                  myHistory.map((item) => (
                    <tr key={item.workDate} data-testid={`row-attendance-${item.workDate}`}>
                      <td className="py-3.5 font-medium">{formatDate(item.workDate)}</td>
                      <td className="mono py-3.5 text-xs">{item.checkIn || '—'}</td>
                      <td className="mono py-3.5 text-xs">{item.checkOut || '—'}</td>
                      <td className="py-3.5 text-muted-foreground">{item.workingHours}</td>
                      <td className="py-3.5">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No attendance records found yet. Click &quot;Check in&quot; to begin your workday.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeLeave({
  leaves,
  setLeaves,
  currentUser,
  employees,
}: {
  leaves: LeaveRequest[];
  setLeaves: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void;
  currentUser?: AuthUser | null;
  employees: Employee[];
}) {
  const currentEmployee = getActiveEmployee(currentUser, employees);
  const [form, setForm] = useState({ leaveType: 'Sick leave', fromDate: '', toDate: '', reason: '' });
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [notice, setNotice] = useState('');
  const [viewingDoc, setViewingDoc] = useState<LeaveAttachment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        window.alert(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newAtt: LeaveAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.fromDate || !form.toDate || !form.reason || !currentEmployee) return;
    const item: LeaveRequest = {
      id: `LV-${Math.floor(2209 + Math.random() * 90)}`,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      ...form,
      status: 'Pending',
      appliedDate: today,
      approvedBy: '—',
      attachments: attachments.length > 0 ? attachments : undefined,
      managerRecommendation: 'Pending',
    };
    setLeaves((prev) => [item, ...prev]);
    setForm({ leaveType: 'Sick leave', fromDate: '', toDate: '', reason: '' });
    setAttachments([]);
    setNotice(
      attachments.length > 0
        ? `Request submitted with ${attachments.length} proof document(s) for manager & HR review.`
        : 'Request submitted for review.'
    );
    window.setTimeout(() => setNotice(''), 5000);
  };

  const mine = currentEmployee ? leaves.filter((item) => item.employeeId === currentEmployee.id) : [];

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="My workspace"
        title="Leave"
        detail="Plan time away, submit medical or travel proof, and keep track of your requests."
        action={
          <Button
            testId="button-scroll-leave"
            onClick={() => document.getElementById('leave-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Plus size={16} /> New request
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <form id="leave-form" onSubmit={submit} className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-bold text-foreground">Apply for leave</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Your manager and HR administration will review this request and examine any attached proof documents.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Leave type
              <select
                data-testid="select-leave-type"
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="Sick leave">Sick leave (Requires medical certificate)</option>
                <option value="Annual leave">Annual leave</option>
                <option value="Personal leave">Personal leave</option>
                <option value="Study leave">Study leave</option>
              </select>
            </label>

            {form.leaveType === 'Sick leave' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30 p-3.5 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                <AlertCircle size={17} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-950 dark:text-blue-200">Medical Proof Required for Sick Leave</p>
                  <p className="mt-0.5 text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                    Please upload a doctor's certificate, clinic note, or prescription in the document upload section below. The manager and HR will inspect the proof before approving.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                From
                <input
                  data-testid="input-leave-from"
                  required
                  type="date"
                  value={form.fromDate}
                  onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                To
                <input
                  data-testid="input-leave-to"
                  required
                  type="date"
                  value={form.toDate}
                  onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-foreground">
              Reason
              <textarea
                data-testid="input-leave-reason"
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
                placeholder="Explain the reason for your leave request (e.g., Fever and acute flu, recovery advice from doctor)"
                className="mt-2 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </label>

            {/* Downside Proof Documents Upload Section */}
            <div className="rounded-xl border border-dashed border-border/90 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Paperclip size={14} className="text-primary" />
                    Proof & Supporting Documents
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {form.leaveType === 'Sick leave'
                      ? 'Upload doctor’s medical certificate, clinic bill, or prescription proof.'
                      : 'Upload travel tickets, proof documents, or supporting files (optional).'}
                  </p>
                </div>
                {form.leaveType === 'Sick leave' && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold px-2.5 py-0.5">
                    Doctor Proof
                  </span>
                )}
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cx(
                  "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                  isDragging ? "border-primary bg-primary/10" : "border-slate-300 dark:border-border hover:border-primary/60 hover:bg-muted/40"
                )}
              >
                <UploadCloud size={24} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-xs font-semibold text-foreground">
                  Click to select files or drag & drop proof documents here
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Accepts PDF, PNG, JPG, or DOC up to 10MB per file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx"
                  data-testid="input-leave-document"
                  className="hidden"
                  onChange={(e) => {
                    handleFileUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Attached Files List */}
              {attachments.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold text-foreground">
                    Attached documents ready to submit ({attachments.length}):
                  </p>
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={16} className="text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{att.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid="button-preview-attachment"
                          onClick={(e) => { e.stopPropagation(); setViewingDoc(att); }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Preview document"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          data-testid="button-remove-attachment"
                          onClick={(e) => { e.stopPropagation(); setAttachments((prev) => prev.filter((a) => a.id !== att.id)); }}
                          className="rounded p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" testId="button-submit-leave" className="w-full">
              Submit leave request {attachments.length > 0 && `with ${attachments.length} proof document(s)`} <ArrowRight size={16} />
            </Button>

            {notice && (
              <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={15} className="shrink-0" /> {notice}
              </p>
            )}
          </div>
        </form>

        {/* Leave History on the Right */}
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-foreground">Leave history</h2>
              <p className="mt-1 text-xs text-muted-foreground">{mine.length} requests on record</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">Available</p>
              <p className="mt-0.5 text-lg font-bold text-amber-800 dark:text-amber-300">14d</p>
            </div>
          </div>

          <div className="space-y-3.5">
            {mine.map((leave) => (
              <div key={leave.id} data-testid={`card-leave-${leave.id}`} className="rounded-xl border border-border p-4 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{leave.leaveType}</p>
                      {leave.leaveType === 'Sick leave' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Medical
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(leave.fromDate)} — {formatDate(leave.toDate)}
                    </p>
                  </div>
                  <Badge tone={statusTone(leave.status)}>{leave.status}</Badge>
                </div>

                <p className="mt-2.5 text-sm text-muted-foreground">{leave.reason}</p>

                {/* Proof Documents in Leave History */}
                {leave.attachments && leave.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                        <Paperclip size={13} className="text-primary" />
                        Submitted proof documents ({leave.attachments.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {leave.attachments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            data-testid={`button-view-doc-${doc.id}`}
                            onClick={() => setViewingDoc(doc)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye size={12} /> {doc.name.length > 20 ? doc.name.slice(0, 18) + '…' : doc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Manager & HR Status Notes */}
                {(leave.managerRecommendation || leave.approvedBy !== '—') && (
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    {leave.managerRecommendation && (
                      <span className={cx(
                        "font-medium",
                        leave.managerRecommendation === 'Recommended' ? "text-emerald-700 dark:text-emerald-400" : leave.managerRecommendation === 'Flagged' ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"
                      )}>
                        Manager: {leave.managerRecommendation}
                      </span>
                    )}
                    {leave.approvedBy !== '—' && (
                      <span>· Decided by {leave.approvedBy}</span>
                    )}
                  </div>
                )}

                <p className="mono mt-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Applied {formatDate(leave.appliedDate)} · {leave.id}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Document Viewer Lightbox Modal */}
      <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}

function EmployeeProfile({ role, employees, setEmployees, currentUser }: { role?: Role; employees: Employee[]; setEmployees?: (value: Employee[] | ((prev: Employee[]) => Employee[])) => void; currentUser?: AuthUser | null }) {
  const currentEmployee = getActiveEmployee(currentUser, employees);
  const [details, setDetails] = useState<PersonalDetails | null>(null);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [requestedChanges, setRequestedChanges] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Role detection
  const isHr = role === 'hr' || currentUser?.role === 'HR_ADMIN' || details?.role === 'HR_ADMIN';
  const isManager = role === 'manager' || details?.role === 'MANAGER';
  const roleDisplay = isHr ? 'HR Administrator' : isManager ? 'Manager' : 'Active Employee';
  const fallbackName = isHr ? 'Avery Morgan' : isManager ? 'Jordan Reed' : (currentEmployee?.name || currentUser?.name || 'Employee');
  const userIdentifier = currentUser?.email || details?.email || currentEmployee?.email || 'employee@northstar.edu';

  const [profileData, setProfileData] = useState<UserProfileData>(() => loadUserProfile(userIdentifier));
  const [isEditing, setIsEditing] = useState(false);

  // Form states matching the exact layout of the user's reference design
  const [formFullName, setFormFullName] = useState('');
  const [formNickName, setFormNickName] = useState('');
  const [formGender, setFormGender] = useState('MALE');
  const [formCountry, setFormCountry] = useState('United States');
  const [formLanguage, setFormLanguage] = useState('English (US)');
  const [formTimeZone, setFormTimeZone] = useState('(GMT-05:00) Eastern Time (US & Canada)');
  const [formMobile, setFormMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAbout, setFormAbout] = useState('Available');

  // Secondary email state
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');

  // Photo modal
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const data = await authRequest<PersonalDetails>('/api/employee/personal-details');
      setDetails(data);
    } catch {
      setDetails({
        id: currentUser?.id || 1,
        employeeId: currentUser?.employeeId || currentEmployee?.id || null,
        fullName: currentUser?.name || currentEmployee?.name || fallbackName,
        email: currentUser?.email || currentEmployee?.email || userIdentifier,
        gender: null,
        dateOfBirth: null,
        age: null,
        residentialAddress: null,
        mobileNumber: currentEmployee?.phone && currentEmployee.phone !== '—' ? currentEmployee.phone : null,
        role: isHr ? 'HR_ADMIN' : isManager ? 'MANAGER' : 'EMPLOYEE',
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

  // Sync profile data on load or when userIdentifier / details change
  useEffect(() => {
    if (userIdentifier) {
      const p = loadUserProfile(userIdentifier);
      setProfileData(p);
      const baseFullName = p.fullName || details?.fullName || currentUser?.name || fallbackName;
      setFormFullName(baseFullName);
      setFormNickName(p.displayName || baseFullName.split(' ')[0] || '');
      setFormGender(normalizeGenderValue(p.gender || details?.gender) || 'MALE');
      setFormCountry(p.country || 'United States');
      setFormLanguage(p.language || 'English (US)');
      setFormTimeZone(p.timeZone || '(GMT-05:00) Eastern Time (US & Canada)');
      setFormMobile(p.mobileNumber || details?.mobileNumber || (currentEmployee?.phone && currentEmployee.phone !== '—' ? currentEmployee.phone : ''));
      setFormAddress(p.residentialAddress || details?.residentialAddress || '');
      setFormAbout(p.about || 'Available');
    }
  }, [userIdentifier, details, currentUser, fallbackName]);

  const handleSaveAll = () => {
    const updated: UserProfileData = {
      ...profileData,
      fullName: formFullName.trim(),
      displayName: formNickName.trim(),
      gender: formGender,
      country: formCountry,
      language: formLanguage,
      timeZone: formTimeZone,
      mobileNumber: formMobile.trim(),
      residentialAddress: formAddress.trim(),
      about: formAbout.trim() || 'Available',
    };
    setProfileData(updated);
    saveUserProfile(userIdentifier, updated);
    setIsEditing(false);
    setSuccessMessage('Profile details saved successfully.');
    window.setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleCancelEdit = () => {
    const baseFullName = profileData.fullName || details?.fullName || currentUser?.name || fallbackName;
    setFormFullName(baseFullName);
    setFormNickName(profileData.displayName || baseFullName.split(' ')[0] || '');
    setFormGender(normalizeGenderValue(profileData.gender || details?.gender) || 'MALE');
    setFormCountry(profileData.country || 'United States');
    setFormLanguage(profileData.language || 'English (US)');
    setFormTimeZone(profileData.timeZone || '(GMT-05:00) Eastern Time (US & Canada)');
    setFormMobile(profileData.mobileNumber || details?.mobileNumber || (currentEmployee?.phone && currentEmployee.phone !== '—' ? currentEmployee.phone : ''));
    setFormAddress(profileData.residentialAddress || details?.residentialAddress || '');
    setFormAbout(profileData.about || 'Available');
    setIsEditing(false);
  };

  const handleAddSecondaryEmail = (e: FormEvent) => {
    e.preventDefault();
    const emailToAdd = newEmailInput.trim().toLowerCase();
    if (!emailToAdd || !emailToAdd.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    setError('');
    const currentList = profileData.secondaryEmails || [];
    if (currentList.some((item) => item.email.toLowerCase() === emailToAdd) || emailToAdd === userIdentifier.toLowerCase()) {
      setError('This email address is already associated with your account.');
      return;
    }
    const updatedEmails = [...currentList, { email: emailToAdd, addedAt: 'Just now', label: 'Secondary' }];
    const updated: UserProfileData = {
      ...profileData,
      secondaryEmails: updatedEmails,
    };
    setProfileData(updated);
    saveUserProfile(userIdentifier, updated);
    setNewEmailInput('');
    setAddEmailOpen(false);
    setSuccessMessage('Secondary email address added successfully.');
    window.setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleRemoveSecondaryEmail = (emailToRemove: string) => {
    const updatedEmails = (profileData.secondaryEmails || []).filter((item) => item.email !== emailToRemove);
    const updated: UserProfileData = {
      ...profileData,
      secondaryEmails: updatedEmails,
    };
    setProfileData(updated);
    saveUserProfile(userIdentifier, updated);
    setSuccessMessage('Email address removed.');
    window.setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP, etc.).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Selected image is too large. Please select an image under 10MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const optimizedUrl = canvas.toDataURL('image/jpeg', 0.88);
        const updated = { ...profileData, photo: optimizedUrl };
        setProfileData(updated);
        saveUserProfile(userIdentifier, updated);
        setSuccessMessage('Profile photo updated successfully.');
        window.setTimeout(() => setSuccessMessage(''), 4000);
      };
      img.onerror = () => {
        setError('Unable to process the selected image.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    const updated = { ...profileData, photo: null };
    setProfileData(updated);
    saveUserProfile(userIdentifier, updated);
    setShowPhotoModal(false);
    setSuccessMessage('Profile photo removed.');
    window.setTimeout(() => setSuccessMessage(''), 4000);
  };

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

  const baseName = details?.fullName || currentUser?.name || fallbackName;
  const effectiveName = profileData.displayName || formFullName || baseName;

  return (
    <div className="page-enter -mx-5 -mt-5 md:-mx-8 md:-mt-8 min-h-screen pb-16 bg-[#f8fafc]/60 dark:bg-background">
      {/* Ambient Pastel Gradient Top Banner */}
      <div className="h-44 sm:h-56 w-full bg-gradient-to-r from-[#d8e5ff] via-[#e8efff] via-50% to-[#feefdd] relative overflow-hidden">
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
      </div>

      {/* Main Floating Profile Card matching the uploaded reference design */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 relative -mt-24 sm:-mt-28">
        {successMessage && (
          <div role="alert" className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800 shadow-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600" /> {successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-800 p-1"><X size={15} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-800 shadow-sm flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-rose-600 hover:text-rose-800 p-1"><X size={15} /></button>
          </div>
        )}

        <div className="rounded-[2rem] bg-white dark:bg-card border border-slate-100/90 dark:border-border p-6 sm:p-10 shadow-xl shadow-slate-200/50 dark:shadow-none">
          {/* Header Row: Avatar, Name, Email, Edit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-8 border-b border-slate-100 dark:border-border/60">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Profile Avatar with Hover & Camera Action */}
              <div className="relative group cursor-pointer shrink-0" onClick={() => setShowPhotoModal(true)}>
                {profileData.photo ? (
                  <img
                    src={profileData.photo}
                    alt={effectiveName}
                    data-testid="img-profile-photo"
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-4 ring-white dark:ring-card shadow-md transition-transform group-hover:scale-105"
                    title="Click to view full photo"
                  />
                ) : (
                  <div
                    data-testid="avatar-profile-initials"
                    className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-2xl sm:text-3xl font-bold text-white ring-4 ring-white dark:ring-card shadow-md transition-transform group-hover:scale-105"
                    title="Click to change photo"
                  >
                    {initials(effectiveName)}
                  </div>
                )}
                <button
                  type="button"
                  data-testid="button-change-photo"
                  title="Change profile photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-[#2563eb] text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all border-2 border-white dark:border-card cursor-pointer"
                >
                  <Camera size={14} />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                data-testid="input-photo-file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoFile(file);
                  e.target.value = '';
                }}
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{formFullName || effectiveName}</h1>
                  <Badge tone={isHr ? 'info' : isManager ? 'warning' : 'success'}>
                    {roleDisplay}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{userIdentifier}</p>
                {formAbout && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">"{formAbout}"</span>
                  </p>
                )}
              </div>
            </div>

            {/* Blue Edit Button matching the screenshot */}
            <div className="flex items-center gap-2.5 self-start sm:self-center">
              {!isEditing ? (
                <button
                  type="button"
                  data-testid="button-edit-profile"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-sm px-6 py-2.5 shadow-sm transition-all duration-150 cursor-pointer active:scale-95"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="button-cancel-edit"
                    onClick={handleCancelEdit}
                    className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-muted dark:hover:bg-muted/80 text-foreground font-medium text-sm px-4 py-2.5 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="button-save-profile"
                    onClick={handleSaveAll}
                    className="rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-sm px-5 py-2.5 shadow-sm transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Check size={15} /> Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields: 2 Columns Grid exactly like screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-8 sm:mt-10">
            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                data-testid="input-profile-fullname"
                placeholder="Your First Name"
                value={formFullName}
                disabled={!isEditing}
                onChange={(e) => setFormFullName(e.target.value)}
                className={cx(
                  "h-12 w-full rounded-xl px-4 text-sm font-medium transition-all outline-none",
                  isEditing
                    ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                    : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                )}
              />
            </div>

            {/* 2. Nick Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Nick Name
              </label>
              <input
                type="text"
                data-testid="input-profile-nickname"
                placeholder="Your First Name"
                value={formNickName}
                disabled={!isEditing}
                onChange={(e) => setFormNickName(e.target.value)}
                className={cx(
                  "h-12 w-full rounded-xl px-4 text-sm font-medium transition-all outline-none",
                  isEditing
                    ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                    : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                )}
              />
            </div>

            {/* 3. Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Gender
              </label>
              <div className="relative">
                <select
                  data-testid="select-profile-gender"
                  value={formGender}
                  disabled={!isEditing}
                  onChange={(e) => setFormGender(e.target.value)}
                  className={cx(
                    "h-12 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium transition-all outline-none",
                    isEditing
                      ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer"
                      : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                  )}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <ChevronDown size={17} />
                </div>
              </div>
            </div>

            {/* 4. Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Country
              </label>
              <div className="relative">
                <select
                  data-testid="select-profile-country"
                  value={formCountry}
                  disabled={!isEditing}
                  onChange={(e) => setFormCountry(e.target.value)}
                  className={cx(
                    "h-12 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium transition-all outline-none",
                    isEditing
                      ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer"
                      : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                  )}
                >
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="India">India</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Japan">Japan</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Netherlands">Netherlands</option>
                  <option value="Ireland">Ireland</option>
                  <option value="Sweden">Sweden</option>
                  <option value="New Zealand">New Zealand</option>
                  <option value="Brazil">Brazil</option>
                  <option value="Other">Other</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <ChevronDown size={17} />
                </div>
              </div>
            </div>

            {/* 5. Language */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Language
              </label>
              <div className="relative">
                <select
                  data-testid="select-profile-language"
                  value={formLanguage}
                  disabled={!isEditing}
                  onChange={(e) => setFormLanguage(e.target.value)}
                  className={cx(
                    "h-12 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium transition-all outline-none",
                    isEditing
                      ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer"
                      : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                  )}
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Mandarin">Mandarin</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Arabic">Arabic</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <ChevronDown size={17} />
                </div>
              </div>
            </div>

            {/* 6. Time Zone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Time Zone
              </label>
              <div className="relative">
                <select
                  data-testid="select-profile-timezone"
                  value={formTimeZone}
                  disabled={!isEditing}
                  onChange={(e) => setFormTimeZone(e.target.value)}
                  className={cx(
                    "h-12 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium transition-all outline-none",
                    isEditing
                      ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 cursor-pointer"
                      : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                  )}
                >
                  <option value="(GMT-08:00) Pacific Time (US & Canada)">(GMT-08:00) Pacific Time</option>
                  <option value="(GMT-07:00) Mountain Time (US & Canada)">(GMT-07:00) Mountain Time</option>
                  <option value="(GMT-06:00) Central Time (US & Canada)">(GMT-06:00) Central Time</option>
                  <option value="(GMT-05:00) Eastern Time (US & Canada)">(GMT-05:00) Eastern Time</option>
                  <option value="(GMT+00:00) UTC / London">(GMT+00:00) UTC / London</option>
                  <option value="(GMT+01:00) Central European Time">(GMT+01:00) Central European Time</option>
                  <option value="(GMT+02:00) Eastern European Time">(GMT+02:00) Eastern European Time</option>
                  <option value="(GMT+05:30) India Standard Time">(GMT+05:30) India Standard Time</option>
                  <option value="(GMT+08:00) Singapore / Beijing">(GMT+08:00) Singapore / Beijing</option>
                  <option value="(GMT+09:00) Tokyo / Seoul">(GMT+09:00) Tokyo / Seoul</option>
                  <option value="(GMT+10:00) Australian Eastern Time">(GMT+10:00) Australian Eastern Time</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <ChevronDown size={17} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: My email Address (matching the uploaded screenshot) */}
          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-border/60">
            <h2 className="text-base font-bold text-foreground">My email Address</h2>

            {/* Primary Email Item */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-full bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{userIdentifier}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">1 month ago</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-0.5 rounded-full">
                Primary
              </span>
            </div>

            {/* Secondary Emails */}
            {profileData.secondaryEmails?.map((item) => (
              <div key={item.email} className="mt-3 flex items-center justify-between gap-3 pt-3 border-t border-slate-100/60 dark:border-border/40">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-muted text-slate-500 flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Added {item.addedAt || 'recently'}</p>
                  </div>
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSecondaryEmail(item.email)}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-700 p-1.5 transition-colors cursor-pointer"
                    title="Remove email"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            {/* + Add Email Address Form / Button */}
            {!addEmailOpen ? (
              <button
                type="button"
                data-testid="button-add-email"
                onClick={() => setAddEmailOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold text-xs px-4 py-2.5 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Email Address
              </button>
            ) : (
              <form onSubmit={handleAddSecondaryEmail} className="mt-4 p-4 rounded-2xl border border-blue-200 bg-blue-50/40 dark:bg-muted/30 max-w-md space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  New email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white dark:bg-card px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
                  >
                    Add email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddEmailOpen(false); setNewEmailInput(''); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Secondary Card: Contact & Status / Bio */}
        <div className="mt-6 rounded-[2rem] bg-white dark:bg-card border border-slate-100/90 dark:border-border p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-bold text-foreground">Contact & Professional Status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Customize your communication details and status bio shown across the workplace.</p>
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
              >
                Edit Details
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Mobile Number
              </label>
              <input
                type="text"
                data-testid="input-profile-mobile"
                placeholder="+1 (555) 019-3456"
                value={formMobile}
                disabled={!isEditing}
                onChange={(e) => setFormMobile(e.target.value)}
                className={cx(
                  "h-12 w-full rounded-xl px-4 text-sm font-medium transition-all outline-none",
                  isEditing
                    ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                    : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Residential Address
              </label>
              <input
                type="text"
                data-testid="input-profile-address"
                placeholder="Street address, City, State, ZIP"
                value={formAddress}
                disabled={!isEditing}
                onChange={(e) => setFormAddress(e.target.value)}
                className={cx(
                  "h-12 w-full rounded-xl px-4 text-sm font-medium transition-all outline-none",
                  isEditing
                    ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                    : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Professional Status & Bio
              </label>
              <input
                type="text"
                data-testid="input-profile-about"
                placeholder="Available"
                value={formAbout}
                disabled={!isEditing}
                onChange={(e) => setFormAbout(e.target.value)}
                className={cx(
                  "h-12 w-full rounded-xl px-4 text-sm font-medium transition-all outline-none",
                  isEditing
                    ? "bg-[#f8fafc] dark:bg-muted/40 border border-slate-200/80 dark:border-border text-foreground focus:bg-white dark:focus:bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                    : "bg-[#f8fafc]/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40 text-foreground cursor-default"
                )}
              />
              {isEditing && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mr-1">Quick presets:</span>
                  {PROFESSIONAL_STATUS_PRESETS.slice(0, 5).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormAbout(`${preset.emoji} ${preset.label}`)}
                      className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-border dark:bg-muted px-2.5 py-1 text-xs text-foreground transition-colors cursor-pointer"
                    >
                      {preset.emoji} {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {isEditing && (
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 dark:border-border pt-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-muted dark:hover:bg-muted/80 text-foreground font-medium text-xs px-4 py-2 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                className="rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} /> Save Details
              </button>
            </div>
          )}
        </div>

        {/* Institutional Record & HR Correction Requests History */}
        {!isHr && !isManager && (
          <div className="mt-8 rounded-[2rem] bg-white dark:bg-card border border-slate-100 dark:border-border p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">Official Personnel Record</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Institutional HR records are protected. Need to submit formal changes for payroll or official files?
                </p>
              </div>
              <Button
                testId="button-open-correction-modal"
                variant="secondary"
                className="shrink-0 text-xs"
                onClick={() => { setCorrectionModalOpen(true); setError(''); setSuccessMessage(''); }}
              >
                <FileText size={14} /> Request HR Correction
              </Button>
            </div>

            {/* Correction Requests Table if any exist */}
            {corrections.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Submitted Correction Requests</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2.5 font-medium">Submitted</th>
                        <th className="pb-2.5 font-medium">Requested changes</th>
                        <th className="pb-2.5 font-medium">Status</th>
                        <th className="pb-2.5 font-medium">HR resolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {corrections.map((req) => (
                        <tr key={req.id}>
                          <td className="py-2.5 text-muted-foreground">{req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : '—'}</td>
                          <td className="py-2.5 font-medium text-foreground max-w-xs">{req.requestedChanges}</td>
                          <td className="py-2.5"><Badge tone={statusTone(req.status === 'RESOLVED' ? 'Approved' : req.status === 'PENDING' ? 'Pending' : 'Rejected')}>{req.status}</Badge></td>
                          <td className="py-2.5 text-muted-foreground">{req.resolutionNote || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox / Modal for Full Photo Preview */}
      {showPhotoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="relative max-w-sm w-full rounded-3xl bg-white dark:bg-card border border-border p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-foreground text-sm">Profile Photo</h3>
              <button
                type="button"
                data-testid="button-close-photo-modal"
                onClick={() => setShowPhotoModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="my-5 flex justify-center">
              {profileData.photo ? (
                <img
                  src={profileData.photo}
                  alt={effectiveName}
                  className="h-48 w-48 rounded-full object-cover shadow-xl border-4 border-blue-500/30"
                />
              ) : (
                <div className="grid h-48 w-48 place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-5xl font-bold text-white shadow-xl">
                  {initials(effectiveName)}
                </div>
              )}
            </div>

            <div className="mb-5">
              <p className="text-base font-bold text-foreground">{effectiveName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{userIdentifier}</p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                testId="button-modal-change-photo"
                onClick={() => {
                  setShowPhotoModal(false);
                  fileInputRef.current?.click();
                }}
              >
                <Camera size={14} /> Change
              </Button>
              {profileData.photo && (
                <Button
                  type="button"
                  variant="danger"
                  testId="button-modal-remove-photo"
                  onClick={handleRemovePhoto}
                >
                  <Trash2 size={14} /> Remove
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                testId="button-modal-close-photo"
                onClick={() => setShowPhotoModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Submitting HR Correction Requests */}
      {correctionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setCorrectionModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full rounded-3xl bg-white dark:bg-card border border-border p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">Request Official HR Record Update</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Describe the personal details changes you need HR Administration to update.</p>
              </div>
              <button
                type="button"
                data-testid="button-close-correction-modal"
                onClick={() => setCorrectionModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4">
              <label className="block text-xs font-semibold text-foreground">
                Requested changes & reason
                <textarea
                  data-testid="input-correction-changes"
                  required
                  rows={4}
                  value={requestedChanges}
                  onChange={(e) => setRequestedChanges(e.target.value)}
                  placeholder="e.g., Please update my official surname to Rawles and mobile number to +1-555-0199 for payroll and tax documentation."
                  className="mt-2 w-full resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  testId="button-cancel-correction"
                  onClick={() => setCorrectionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  testId="button-submit-correction"
                  disabled={submittingCorrection || !requestedChanges.trim()}
                >
                  {submittingCorrection ? 'Submitting…' : 'Submit to HR'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HRDashboard({ employees, attendance, leaves }: { employees: Employee[]; attendance: Attendance[]; leaves: LeaveRequest[] }) {
  const active = employees.filter((e) => e.status === 'Active').length; const present = attendance.filter((a) => a.workDate === today && a.status === 'Present').length; const late = attendance.filter((a) => a.workDate === today && a.status === 'Late').length; const pending = leaves.filter((l) => l.status === 'Pending').length;
  return <div className="page-enter"><SectionTitle eyebrow={`People operations / ${formatDate(today)}`} title="Good morning, Avery." detail="A compact read on attendance and people activity." action={<Badge tone="info"><ShieldCheck size={12} /> HR administrator</Badge>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active employees" value={String(active)} detail="+2 since last month" icon={Users} accent="teal" /><StatCard label="Present today" value={`${present + late}/${active}`} detail={`${late} late arrival${late === 1 ? '' : 's'} to review`} icon={CalendarCheck2} accent="sky" /><StatCard label="Pending leave" value={String(pending)} detail="Needs your attention" icon={FileText} accent="amber" /><StatCard label="Attendance rate" value="94.6%" detail="Rolling 30-day average" icon={Activity} accent="rose" /></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Today’s attendance</h2><p className="mt-1 text-xs text-muted-foreground">Live view across your active team</p></div><Link href="/hr/attendance" data-testid="link-full-attendance" className="text-xs font-semibold text-primary hover:underline">Full view</Link></div><div className="space-y-2">{employees.slice(0, 4).map((employee) => { const record = attendance.find((item) => item.employeeId === employee.id && item.workDate === today); return <div key={employee.id} data-testid={`row-dashboard-attendance-${employee.id}`} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><UserAvatar user={{ id: employee.id, name: employee.name, email: employee.email }} className="h-9 w-9 rounded-lg" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.department}</p></div><span className="mono hidden text-xs text-muted-foreground sm:block">{record?.checkIn || '—'}</span><Badge tone={statusTone(record?.status || employee.status)}>{record?.status || 'Absent'}</Badge></div>; })}</div></div><div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Leave inbox</h2><p className="mt-1 text-xs text-muted-foreground">Requests awaiting review</p></div><Link href="/hr/leave-requests" data-testid="link-review-leave" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><ArrowRight size={17} /></Link></div><div className="mt-5 space-y-4">{leaves.filter((l) => l.status === 'Pending').map((leave) => <div key={leave.id} className="flex items-start gap-3"><UserAvatar name={leave.employeeName} className="h-9 w-9 rounded-lg" /><div><p className="text-sm font-semibold">{leave.employeeName}</p><p className="mt-0.5 text-xs text-muted-foreground">{leave.leaveType} · {formatDate(leave.fromDate)}</p></div></div>)}{pending === 0 && <EmptyState title="Inbox is clear" detail="No leave requests need review." />}</div></div></div></div>;
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
      .then((users) => {
        setBackendUsers(users);
        setEmployees((prev) => {
          let updated = [...prev];
          let changed = false;
          users.forEach((u) => {
            if (u.role === 'EMPLOYEE' && u.status === 'ACTIVE') {
              const idx = updated.findIndex((e) => e.email.toLowerCase() === u.email.toLowerCase());
              if (idx === -1) {
                let highest = 1042;
                updated.forEach((e) => {
                  if (e.id.startsWith('EMP-')) {
                    const num = parseInt(e.id.slice(4), 10);
                    if (!isNaN(num) && num > highest) highest = num;
                  }
                });
                const uniqueId = u.employeeId || `EMP-${highest + 1}`;
                updated.push({
                  id: uniqueId,
                  name: u.name,
                  email: u.email,
                  phone: '—',
                  department: 'Student Services',
                  designation: 'Employee',
                  joiningDate: today,
                  status: 'Active',
                });
                changed = true;
              } else if (u.employeeId && updated[idx].id !== u.employeeId) {
                updated[idx] = { ...updated[idx], id: u.employeeId };
                changed = true;
              }
            }
          });
          return changed ? updated : prev;
        });
      })
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
        gender: normalizeGenderValue(details.gender),
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
  const addEmployee = (event: FormEvent) => {
    event.preventDefault();
    if (!newEmployee.name || !newEmployee.email || !newEmployee.designation) return;
    setEmployees((prev) => {
      let highest = 1042;
      prev.forEach((e) => {
        if (e.id.startsWith('EMP-')) {
          const num = parseInt(e.id.slice(4), 10);
          if (!isNaN(num) && num > highest) highest = num;
        }
      });
      const nextId = `EMP-${highest + 1}`;
      return [...prev, { id: nextId, ...newEmployee, phone: '—', joiningDate: today, status: 'Active' }];
    });
    setNewEmployee({ name: '', email: '', department: 'Student Services', designation: '' });
    setAddOpen(false);
  };

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
            <div className="flex items-center gap-3">
              <UserAvatar user={{ id: selectedUser.id, name: selectedUser.name, email: selectedUser.email }} className="h-12 w-12" />
              <div>
                <h3 className="text-lg font-bold">Edit personal details: {selectedUser.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Account role: <span className="font-semibold">{selectedUser.role}</span> · Email: {selectedUser.email}
                </p>
              </div>
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
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
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
                      <UserAvatar user={{ id: employee.id, name: employee.name, email: employee.email }} />
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
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Sick leave' | 'Approved' | 'Rejected'>('All');
  const [viewingDoc, setViewingDoc] = useState<LeaveAttachment | null>(null);

  const update = (id: string, status: LeaveStatus, hrResolutionNote?: string) =>
    setLeaves((prev) =>
      prev.map((leave) =>
        leave.id === id
          ? {
              ...leave,
              status,
              approvedBy: 'Avery Morgan (HR Admin)',
              hrResolutionNote: hrResolutionNote || leave.hrResolutionNote,
            }
          : leave
      )
    );

  const pending = leaves.filter((l) => l.status === 'Pending');

  const filteredLeaves = leaves.filter((leave) => {
    if (filter === 'Pending') return leave.status === 'Pending';
    if (filter === 'Approved') return leave.status === 'Approved';
    if (filter === 'Rejected') return leave.status === 'Rejected';
    if (filter === 'Sick leave') return leave.leaveType === 'Sick leave';
    return true;
  });

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="People operations"
        title="Leave requests"
        detail="Review employee leave applications, verify medical & proof documents, and issue formal decisions."
        action={
          <Badge tone={pending.length ? 'warning' : 'success'}>
            {pending.length} pending HR review
          </Badge>
        }
      />

      {/* Filter Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(['All', 'Pending', 'Sick leave', 'Approved', 'Rejected'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cx(
              "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              filter === tab
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab}
            {tab === 'Pending' && pending.length > 0 && ` (${pending.length})`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredLeaves.length === 0 ? (
          <EmptyState
            title="No leave requests found"
            detail="There are no leave requests matching the selected filter."
          />
        ) : (
          filteredLeaves.map((leave) => (
            <div
              key={leave.id}
              data-testid={`card-request-${leave.id}`}
              className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-all"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Employee & Type */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar name={leave.employeeName} className="h-11 w-11 rounded-xl shadow-xs" textClassName="text-sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{leave.employeeName}</p>
                        <Badge tone={leave.leaveType === 'Sick leave' ? 'info' : 'neutral'}>
                          {leave.leaveType}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Applied {formatDate(leave.appliedDate)} · Request ID: {leave.id}
                      </p>
                    </div>
                  </div>

                  {/* Dates & Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm md:w-1/2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Leave Dates</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate && ` — ${formatDate(leave.toDate)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reason for Absence</p>
                      <p className="mt-1 text-foreground font-medium">{leave.reason}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 md:ml-4 shrink-0">
                    {leave.status === 'Pending' ? (
                      <>
                        <Button
                          testId={`button-approve-${leave.id}`}
                          onClick={() => update(leave.id, 'Approved')}
                          className="px-3"
                        >
                          <Check size={15} /> Approve
                        </Button>
                        <Button
                          testId={`button-reject-${leave.id}`}
                          variant="danger"
                          onClick={() => update(leave.id, 'Rejected')}
                          className="px-3"
                        >
                          <X size={15} /> Reject
                        </Button>
                      </>
                    ) : (
                      <Badge tone={statusTone(leave.status)}>
                        {leave.status} {leave.approvedBy !== '—' && `· ${leave.approvedBy}`}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Proof Documents & Verification Inspection Area */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Paperclip size={14} className="text-primary" />
                        Proof Documents
                      </span>
                      {leave.attachments && leave.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> {leave.attachments.length} document(s) attached
                        </span>
                      ) : leave.leaveType === 'Sick leave' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                          <AlertCircle size={12} /> No medical certificate uploaded
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">None attached</span>
                      )}
                    </div>

                    {/* Manager Recommendation Badge */}
                    {leave.managerRecommendation && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] text-muted-foreground font-medium">Manager review:</span>
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                            leave.managerRecommendation === 'Recommended'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              : leave.managerRecommendation === 'Flagged'
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                          )}
                        >
                          {leave.managerRecommendation === 'Recommended' ? '✓ Recommended by Manager' : leave.managerRecommendation === 'Flagged' ? '⚠ Flagged Questionable by Manager' : 'Pending Manager Review'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Document Cards */}
                  {leave.attachments && leave.attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {leave.attachments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate" title={doc.name}>{doc.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(doc.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid={`button-hr-inspect-${doc.id}`}
                            onClick={() => setViewingDoc(doc)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manager Review Notes if present */}
                  {leave.managerNote && (
                    <p className="text-xs text-muted-foreground italic bg-card border border-border/60 rounded-lg p-2.5">
                      <span className="font-semibold not-italic text-foreground">Manager Note:</span> "{leave.managerNote}"
                      {leave.managerReviewedBy && ` — ${leave.managerReviewedBy}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}

function HRAttendance({ attendance, employees }: { attendance: Attendance[]; employees: Employee[] }) {
  const [date, setDate] = useState(today); const records = employees.map((employee) => ({ employee, record: attendance.find((item) => item.employeeId === employee.id && item.workDate === date) }));
  return <div className="page-enter"><SectionTitle eyebrow="People operations" title="Attendance" detail="Daily presence, punctuality, and working hours." action={<div className="flex items-center gap-2"><input data-testid="input-attendance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary" /><Button testId="button-attendance-export" variant="secondary" onClick={() => window.print()}><Download size={15} /> Export</Button></div>} /><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Present" value={String(records.filter((x) => x.record?.status === 'Present').length)} detail="On time today" icon={CheckCircle2} accent="teal" /><StatCard label="Late arrivals" value={String(records.filter((x) => x.record?.status === 'Late').length)} detail="Review patterns over time" icon={Clock3} accent="amber" /><StatCard label="Not recorded" value={String(records.filter((x) => !x.record || x.record.status === 'Absent').length)} detail="Could require follow-up" icon={CircleHelp} accent="rose" /></div><div className="mt-6 rounded-2xl border border-card-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-primary" /><h2 className="font-bold">Daily register · {formatDate(date)}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Employee</th><th className="pb-3 font-medium">Team</th><th className="pb-3 font-medium">Check in</th><th className="pb-3 font-medium">Check out</th><th className="pb-3 font-medium">Hours</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{records.map(({ employee, record }) => <tr key={employee.id} data-testid={`row-hr-attendance-${employee.id}`}><td className="py-4"><div className="flex items-center gap-2.5"><UserAvatar user={{ id: employee.id, name: employee.name, email: employee.email }} className="h-8 w-8" /><span className="font-semibold">{employee.name}</span></div></td><td className="py-4 text-muted-foreground">{employee.department}</td><td className="mono py-4 text-xs">{record?.checkIn || '—'}</td><td className="mono py-4 text-xs">{record?.checkOut || '—'}</td><td className="py-4 text-muted-foreground">{record?.workingHours || '—'}</td><td className="py-4"><Badge tone={statusTone(record?.status || 'Absent')}>{record?.status || 'Absent'}</Badge></td></tr>)}</tbody></table></div></div></div>;
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

function ManagerDashboard({
  leaves = seedLeaves,
  setLeaves,
}: {
  leaves?: LeaveRequest[];
  setLeaves?: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void;
}) {
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; email: string; employeeId?: string; status: string }>>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<Array<{ id: number; name: string; email: string; role: string; status: string; createdAt: string; emailVerifiedAt: string }>>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingDoc, setViewingDoc] = useState<LeaveAttachment | null>(null);
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});

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

  const handleRecommendLeave = (id: string, recommendation: 'Recommended' | 'Flagged') => {
    if (!setLeaves) return;
    const note = managerNotes[id] || (recommendation === 'Recommended' ? 'Medical proof & leave schedule verified.' : 'Proof document missing or unclear.');
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              managerRecommendation: recommendation,
              managerNote: note,
              managerReviewedBy: 'Jordan Reed (Manager)',
              managerReviewedAt: new Date().toISOString(),
            }
          : l
      )
    );
    setMessage(`Leave request ${id} marked as "${recommendation}" for HR review.`);
    window.setTimeout(() => setMessage(''), 4000);
  };

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="Manager workspace"
        title="Manager operations"
        detail="Review employee registrations assigned to you, inspect leave proof documents, and manage your active team."
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
                      <div className="flex items-center gap-3">
                        <UserAvatar user={{ id: reg.id, name: reg.name, email: reg.email }} />
                        <div>
                          <p className="font-semibold">{reg.name}</p>
                          <p className="text-xs text-muted-foreground">{reg.email}</p>
                        </div>
                      </div>
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

      {/* Team Leave Applications & Proof Documents */}
      <div className="mb-8 rounded-2xl border border-card-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground">Team leave applications & proof verification</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Examine medical certificates, inspect attached proof documents, and record manager recommendation for HR.
            </p>
          </div>
          <Link
            href="/manager/leave-review"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Dedicated review page <ArrowRight size={13} />
          </Link>
        </div>

        <div className="space-y-3.5">
          {leaves.map((leave) => (
            <div
              key={leave.id}
              data-testid={`card-manager-leave-${leave.id}`}
              className="rounded-xl border border-border bg-background p-4 shadow-2xs"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={leave.employeeName} className="h-10 w-10 rounded-xl" textClassName="text-xs" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-sm">{leave.employeeName}</p>
                        <Badge tone={leave.leaveType === 'Sick leave' ? 'info' : 'neutral'}>
                          {leave.leaveType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate && ` — ${formatDate(leave.toDate)}`} · Applied {formatDate(leave.appliedDate)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={statusTone(leave.status)}>{leave.status}</Badge>
                </div>

                <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                  <span className="font-semibold text-foreground">Reason: </span>{leave.reason}
                </p>

                {/* Attached Proof Documents */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border/50 pt-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Paperclip size={13} className="text-primary" /> Proof Documents:
                    </span>
                    {leave.attachments && leave.attachments.length > 0 ? (
                      leave.attachments.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          data-testid={`button-manager-inspect-${doc.id}`}
                          onClick={() => setViewingDoc(doc)}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Eye size={12} /> {doc.name} ({formatFileSize(doc.size)})
                        </button>
                      ))
                    ) : leave.leaveType === 'Sick leave' ? (
                      <span className="text-[11px] text-rose-600 font-medium">No medical certificate attached</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>

                  {/* Recommendation action */}
                  {leave.status === 'Pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`button-manager-recommend-${leave.id}`}
                        onClick={() => handleRecommendLeave(leave.id, 'Recommended')}
                        className={cx(
                          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer shadow-2xs",
                          leave.managerRecommendation === 'Recommended'
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        )}
                      >
                        ✓ Recommend HR Approval
                      </button>
                      <button
                        type="button"
                        data-testid={`button-manager-flag-${leave.id}`}
                        onClick={() => handleRecommendLeave(leave.id, 'Flagged')}
                        className={cx(
                          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer shadow-2xs",
                          leave.managerRecommendation === 'Flagged'
                            ? "bg-rose-600 text-white"
                            : "bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        )}
                      >
                        ⚠ Flag Questionable
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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
                <div className="flex items-center gap-3">
                  <UserAvatar user={{ id: employee.id, name: employee.name, email: employee.email, employeeId: employee.employeeId }} />
                  <div>
                    <p className="text-sm font-semibold">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.email}</p>
                  </div>
                </div>
                <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
    </div>
  );
}

function ManagerLeaveReview({
  leaves,
  setLeaves,
}: {
  leaves: LeaveRequest[];
  setLeaves: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void;
}) {
  const [viewingDoc, setViewingDoc] = useState<LeaveAttachment | null>(null);
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const handleRecommend = (id: string, recommendation: 'Recommended' | 'Flagged') => {
    const note = managerNotes[id] || (recommendation === 'Recommended' ? 'Medical proof & schedule verified by manager.' : 'Proof document missing or unclear.');
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              managerRecommendation: recommendation,
              managerNote: note,
              managerReviewedBy: 'Jordan Reed (Manager)',
              managerReviewedAt: new Date().toISOString(),
            }
          : l
      )
    );
    setNotice(`Leave request ${id} updated: marked as "${recommendation}".`);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const pendingCount = leaves.filter((l) => l.status === 'Pending').length;

  return (
    <div className="page-enter">
      <SectionTitle
        eyebrow="Manager workspace"
        title="Team leave applications"
        detail="Review employee leave requests, inspect attached medical certificates and proof files, and record your assessment for HR review."
        action={<Badge tone={pendingCount ? 'warning' : 'success'}>{pendingCount} pending review</Badge>}
      />

      {notice && (
        <p role="alert" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </p>
      )}

      <div className="space-y-4">
        {leaves.map((leave) => (
          <div
            key={leave.id}
            data-testid={`card-manager-leave-${leave.id}`}
            className="rounded-2xl border border-card-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar name={leave.employeeName} className="h-11 w-11 rounded-xl shadow-xs" textClassName="text-sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{leave.employeeName}</p>
                      <Badge tone={leave.leaveType === 'Sick leave' ? 'info' : 'neutral'}>
                        {leave.leaveType}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Applied {formatDate(leave.appliedDate)} · Request ID: {leave.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground">
                      {formatDate(leave.fromDate)}{leave.fromDate !== leave.toDate && ` — ${formatDate(leave.toDate)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Scheduled duration</p>
                  </div>
                  <Badge tone={statusTone(leave.status)}>{leave.status}</Badge>
                </div>
              </div>

              <div className="rounded-xl bg-muted/30 p-3 text-xs text-foreground">
                <span className="font-semibold text-muted-foreground">Reason for leave: </span>
                {leave.reason}
              </div>

              {/* Attached Proof Documents Section */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Paperclip size={14} className="text-primary" />
                    Employee Proof Documents
                  </span>
                  {leave.attachments && leave.attachments.length > 0 ? (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> {leave.attachments.length} proof document(s) uploaded
                    </span>
                  ) : leave.leaveType === 'Sick leave' ? (
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle size={12} /> No medical certificate attached
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No documents attached</span>
                  )}
                </div>

                {leave.attachments && leave.attachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {leave.attachments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate" title={doc.name}>{doc.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(doc.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`button-manager-inspect-${doc.id}`}
                          onClick={() => setViewingDoc(doc)}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-1 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          <Eye size={12} /> View proof
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager Verification & Endorsement Action */}
              <div className="pt-2 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 max-w-md">
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Manager verification note (sent to HR):
                    </label>
                    <input
                      data-testid={`input-manager-leave-note-${leave.id}`}
                      placeholder={leave.managerNote || "e.g., Medical certificate verified, recommended for approval."}
                      value={managerNotes[leave.id] !== undefined ? managerNotes[leave.id] : (leave.managerNote || '')}
                      onChange={(e) => setManagerNotes({ ...managerNotes, [leave.id]: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      data-testid={`button-manager-recommend-${leave.id}`}
                      onClick={() => handleRecommend(leave.id, 'Recommended')}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                        leave.managerRecommendation === 'Recommended'
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      )}
                    >
                      <CheckCircle2 size={14} /> Recommend for HR
                    </button>
                    <button
                      type="button"
                      data-testid={`button-manager-flag-${leave.id}`}
                      onClick={() => handleRecommend(leave.id, 'Flagged')}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                        leave.managerRecommendation === 'Flagged'
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      )}
                    >
                      <AlertCircle size={14} /> Flag Questionable
                    </button>
                  </div>
                </div>

                {leave.managerRecommendation && (
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    Manager status: <span className="font-semibold text-foreground">{leave.managerRecommendation}</span>
                    {leave.managerReviewedBy && ` by ${leave.managerReviewedBy}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
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

function HRRegistrationsPage({
  setEmployees,
}: {
  setEmployees?: (value: Employee[] | ((prev: Employee[]) => Employee[])) => void;
} = {}) {
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
      if (setEmployees) {
        setEmployees((prev) => {
          if (prev.some((e) => e.email.toLowerCase() === item.email.toLowerCase())) return prev;
          let highest = 1042;
          prev.forEach((e) => {
            if (e.id.startsWith('EMP-')) {
              const num = parseInt(e.id.slice(4), 10);
              if (!isNaN(num) && num > highest) highest = num;
            }
          });
          const nextId = `EMP-${highest + 1}`;
          return [
            ...prev,
            {
              id: nextId,
              name: item.name,
              email: item.email,
              phone: '—',
              department: 'Student Services',
              designation: 'Employee',
              joiningDate: today,
              status: 'Active',
            },
          ];
        });
      }
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
                      <UserAvatar user={{ id: item.id, name: item.name, email: item.email }} />
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
  const [, setLocation] = useLocation();
  const [role, setRole] = useLocalState<Role>('meridian-role', 'employee');
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
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

        setCurrentUser(user);
        setRole(user.role === 'HR_ADMIN' ? 'hr' : user.effectiveRoles?.includes('MANAGER') ? 'manager' : 'employee');
        setAuthenticated(true);
      } catch {
        if (active) {
          setCurrentUser(null);
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
  useEffect(() => {
    if (authenticated && currentUser && currentUser.role === 'EMPLOYEE') {
      setEmployees((prev) => {
        const match = prev.find((e) => e.email.toLowerCase() === currentUser.email.toLowerCase());
        if (match) {
          if (currentUser.employeeId && match.id !== currentUser.employeeId) {
            return prev.map((e) => e.email.toLowerCase() === currentUser.email.toLowerCase() ? { ...e, id: currentUser.employeeId! } : e);
          }
          return prev;
        }
        let highest = 1042;
        prev.forEach((e) => {
          if (e.id.startsWith('EMP-')) {
            const num = parseInt(e.id.slice(4), 10);
            if (!isNaN(num) && num > highest) highest = num;
          }
        });
        const newEmpId = currentUser.employeeId || `EMP-${highest + 1}`;
        const newEmp: Employee = {
          id: newEmpId,
          name: currentUser.name,
          email: currentUser.email,
          phone: '—',
          department: 'Student Services',
          designation: 'Employee',
          joiningDate: today,
          status: 'Active',
        };
        return [...prev, newEmp];
      });
    }
  }, [authenticated, currentUser, setEmployees]);

  const signIn = (user: AuthUser) => {
    setCurrentUser(user);
    setRole(user.role === 'HR_ADMIN' ? 'hr' : user.effectiveRoles?.includes('MANAGER') ? 'manager' : 'employee');
    setAuthenticated(true);
  };
  const signOut = () => {
    ensureCsrf()
      .then(() => authRequest<AuthMessage>('/api/auth/logout', { method: 'POST' }))
      .catch(() => undefined)
      .finally(() => {
        setCurrentUser(null);
        setAuthenticated(false);
      });
  };
  if (authChecking) return <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">Checking your session…</div>;
  const isHrAdmin = authenticated && currentUser?.role === 'HR_ADMIN';
  const isManager = authenticated && (currentUser?.effectiveRoles?.includes('MANAGER') || false);

  const page = (component: ReactNode) => authenticated
    ? <Shell role={role} setRole={setRole} onSignOut={signOut} currentUser={currentUser}>{component}</Shell>
    : <BackendSignIn setRole={setRole} onSignIn={signIn} />;

  const hrPage = (component: ReactNode) => {
    if (!authenticated) {
      return <BackendSignIn setRole={setRole} onSignIn={signIn} />;
    }
    if (!isHrAdmin) {
      return (
        <Shell role={role} setRole={setRole} onSignOut={signOut}>
          <div className="page-enter rounded-2xl border border-card-border bg-card p-8 shadow-sm text-center">
            <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              HR administrator access is required to view this page.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                testId="button-restricted-back"
                onClick={() => {
                  setLocation(isManager ? '/manager/dashboard' : '/employee/dashboard');
                }}
              >
                Return to dashboard
              </Button>
            </div>
          </div>
        </Shell>
      );
    }
    return <Shell role={role} setRole={setRole} onSignOut={signOut} currentUser={currentUser}>{component}</Shell>;
  };

  return <Switch><Route path="/"><BackendSignIn setRole={setRole} onSignIn={signIn} /></Route><Route path="/employee/dashboard">{page(<EmployeeDashboard employees={employees} attendance={attendance} leaves={leaves} currentUser={currentUser} />)}</Route><Route path="/employee/attendance">{page(<EmployeeAttendance attendance={attendance} setAttendance={setAttendance} currentUser={currentUser} employees={employees} />)}</Route><Route path="/employee/leave">{page(<EmployeeLeave leaves={leaves} setLeaves={setLeaves} currentUser={currentUser} employees={employees} />)}</Route><Route path="/employee/profile">{page(<EmployeeProfile role={role} employees={employees} setEmployees={setEmployees} currentUser={currentUser} />)}</Route><Route path="/manager/dashboard">{page(<ManagerDashboard leaves={leaves} setLeaves={setLeaves} />)}</Route><Route path="/manager/leave-review">{page(<ManagerLeaveReview leaves={leaves} setLeaves={setLeaves} />)}</Route><Route path="/hr/dashboard">{hrPage(<HRDashboard employees={employees} attendance={attendance} leaves={leaves} />)}</Route><Route path="/hr/registrations">{hrPage(<HRRegistrationsPage setEmployees={setEmployees} />)}</Route><Route path="/hr/employees">{hrPage(<HREmployees employees={employees} setEmployees={setEmployees} />)}</Route><Route path="/hr/access">{hrPage(<HRAccessPage />)}</Route><Route path="/hr/leave-requests">{hrPage(<HRLeaveRequests leaves={leaves} setLeaves={setLeaves} />)}</Route><Route path="/hr/attendance">{hrPage(<HRAttendance attendance={attendance} employees={employees} />)}</Route><Route path="/hr/reports">{hrPage(<HRReports attendance={attendance} leaves={leaves} />)}</Route><Route path="/settings">{page(<SettingsPage role={role} />)}</Route><Route><BackendSignIn setRole={setRole} onSignIn={signIn} /></Route></Switch>;
}
function Router() { return <ErrorBoundary resetKey={window.location.pathname}><AppContent /></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;