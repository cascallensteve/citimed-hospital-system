import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  MagnifyingGlassIcon, 
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  XMarkIcon,
  TrashIcon,
  ClockIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

interface Visit {
  id: string;
  patient: number; // patient id
  patientName: string;
  patientNumber?: string;
  timestamp?: string;
  complaints: string;
  history: string;
  allergies: string;
  physical_exam: string;
  lab_test: string;
  lab_results: string;
  imaging: string;
  diagnosis: string;
  diagnosis_type: 'chronic' | 'short-term' | 'infection' | string;
  prescription: string;
  charges?: string;
  paid?: string;
  balance?: string;
  payment_method?: string;
}

interface PatientShort {
  id: string;
  fullName: string;
  phone: string;
  patientNumber?: string;
  type?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other' | string;
  location?: string;
  registeredAt?: string; // ISO or date string
}

const Visits = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [loading, setLoading] = useState(true);
  const [, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteVisit, setConfirmDeleteVisit] = useState<Visit | null>(null);
  // Edit state
  const [editVisit, setEditVisit] = useState<Visit | null>(null);
  const [editForm, setEditForm] = useState<Partial<Visit>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Sorting
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Tabs: default to Patients, then Visit Details
  const [activeTab, setActiveTab] = useState<'visits' | 'patients'>('patients');

  const [visits, setVisits] = useState<Visit[]>([]);
  const { user } = useAuth();

  // Patients for linking visits
  const [patients, setPatients] = useState<PatientShort[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientShort | null>(null);

  const [currentVisit, setCurrentVisit] = useState<Partial<Visit>>({
    patient: undefined,
    complaints: '',
    history: '',
    allergies: '',
    physical_exam: '',
    lab_test: '',
    lab_results: '',
    imaging: '',
    diagnosis: '',
    diagnosis_type: 'chronic',
    prescription: '',
    charges: '',
  });

  // Payment UI state after creating a visit
  const [paymentVisit, setPaymentVisit] = useState<Visit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  // Additional fields surfaced in UI (optional, not required by payment endpoint)
  // Removed extra fields from payment step per requirements
  // Anonymous visit mode state
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [anonymousPatientId, setAnonymousPatientId] = useState<number | null>(null);
  const [anonymousResolving, setAnonymousResolving] = useState(false);

  // Removed popup modals for lab/prescription; using inline textareas with auto-numbering

  const filteredVisits = visits.filter(visit => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    const phone = (() => {
      const p = patients.find(pp => Number(pp.id) === Number(visit.patient));
      return (p?.phone || '').toString().toLowerCase();
    })();
    return (
      (visit.patientName || '').toLowerCase().includes(q) ||
      (visit.patientNumber || '').toLowerCase().includes(q) ||
      (visit.diagnosis || '').toLowerCase().includes(q) ||
      phone.includes(q)
    );
  });

  const sortedVisits = [...filteredVisits].sort((a, b) => {
    if (sortBy === 'name') {
      const an = (a.patientName || '').toLowerCase();
      const bn = (b.patientName || '').toLowerCase();
      const cmp = an.localeCompare(bn);
      return sortDir === 'asc' ? cmp : -cmp;
    } else {
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      const cmp = at - bt;
      return sortDir === 'asc' ? cmp : -cmp;
    }
  });
  const totalPages = Math.max(1, Math.ceil(sortedVisits.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedVisits = sortedVisits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Auto-save functionality
  useEffect(() => {
    if (currentVisit.complaints || currentVisit.history) {
      setAutoSaveStatus('saving');
      const timer = setTimeout(() => {
        setAutoSaveStatus('saved');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentVisit]);

  const handleInputChange = (field: keyof Visit, value: any) => {
    setCurrentVisit(prev => ({ ...prev, [field]: value }));
  };

  // Print a receipt for a specific visit from the list actions
  const printVisitReceiptFor = (v: Visit) => {
    const fmtKES = (val: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0);
    const charges = moneyToNumber(v.charges);
    const paid = moneyToNumber(v.paid);
    const balance = Math.max(charges - paid, 0);
    const patientName = resolvePatientName(Number(v.patient)) || (v.patientName || '');
    const patientPhone = resolvePatientPhone(Number(v.patient)) || '';
    const patientNum = resolvePatientNumber(Number(v.patient)) || (v.patientNumber || '');
    const servedByRaw = (user as any)?.full_name ?? (user as any)?.fullName ?? (user as any)?.name ?? (user as any)?.username ?? 'Admin';
    const servedBy = String(servedByRaw).trim();
    const content = `
      <div class="header">
        <div class="title">Citimed - Hospital</div>
        <div class="muted">Makongeni - Thika</div>
        <div class="muted">Served by: ${servedBy}</div>
      </div>
      <div class="section">
        <div class="row"><span class="label">Patient:</span><span class="value">${patientName}</span></div>
        <div class="row"><span class="label">Date:</span><span class="value">${v.timestamp ? new Date(v.timestamp).toLocaleString() : new Date().toLocaleString()}</span></div>
      </div>
      <div class="hr"></div>
      <div class="section">
        <table class="w-full">
          <thead>
            <tr><th class="text-left">Item</th><th class="text-center">Qty</th><th class="right">Price</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Consultation</td>
              <td class="text-center">1</td>
              <td class="right">${fmtKES(charges)}</td>
            </tr>
          </tbody>
        </table>
        <div class="row" style="margin-top:6px"><span class="label">Paid</span><span class="value">${fmtKES(paid)}</span></div>
        <div class="row"><span class="label">Balance</span><span class="value">${fmtKES(balance)}</span></div>
      </div>
      <div class="section" style="text-align:center; padding-top:8px;">
        <div class="muted">Wishing you a Quick recover</div>
      </div>
    `;
    openPrintWindow(`visit-${v.id}-receipt`, content);
  };

  // Print a simple receipt for the current paymentVisit using current inputs
  const printVisitReceipt = () => {
    if (!paymentVisit) { toast.error('No visit selected for printing'); return; }
    const fmtKES = (v: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(v || 0);
    const charges = moneyToNumber(paymentVisit.charges);
    const already = moneyToNumber(paymentVisit.paid);
    const incoming = moneyToNumber(paymentAmount);
    const totalPaid = already + incoming;
    const balance = Math.max(charges - totalPaid, 0);
    const patientName = resolvePatientName(Number(paymentVisit.patient)) || (paymentVisit.patientName || '');
    const patientPhone = resolvePatientPhone(Number(paymentVisit.patient)) || '';
    const patientNum = resolvePatientNumber(Number(paymentVisit.patient)) || (paymentVisit.patientNumber || '');
    const servedBy = ((user as any)?.fullName || (user as any)?.name || (user as any)?.username || 'Admin') as string;
    const content = `
      <div class="header">
        <div class="title">Citimed - Hospital</div>
        <div class="muted">Makongeni - Thika</div>
        <div class="muted">Served by: ${servedBy}</div>
        <div class="muted">Visit Receipt #${paymentVisit.id || ''}</div>
      </div>
      <div class="section">
        <div class="row"><span class="label">Patient:</span><span class="value">${patientNum ? `${patientNum} - ` : ''}${patientName}</span></div>
        <div class="row"><span class="label">Date:</span><span class="value">${paymentVisit.timestamp ? new Date(paymentVisit.timestamp).toLocaleString() : new Date().toLocaleString()}</span></div>
      </div>
      <div class="hr"></div>
      <div class="section">
        <table class="w-full">
          <thead>
            <tr><th class="text-left">Item</th><th class="text-center">Qty</th><th class="right">Price</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Consultation</td>
              <td class="text-center">1</td>
              <td class="right">${fmtKES(charges)}</td>
            </tr>
          </tbody>
        </table>
        <div class="row" style="margin-top:6px"><span class="label">Paid</span><span class="value">${fmtKES(totalPaid)}</span></div>
        <div class="row"><span class="label">Balance</span><span class="value">${fmtKES(balance)}</span></div>
      </div>
      <div class="section" style="text-align:center; padding-top:8px;">
        <div class="muted">Wishing you a Quick recover</div>
      </div>
    `;
    openPrintWindow(`visit-${paymentVisit.id}-receipt`, content);
  };

  const handleEditChange = (field: keyof Visit, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Sanitize server error strings so we never render raw HTML in the UI
  const cleanErrorText = (input: unknown): string => {
    const s = (input ?? '').toString();
    // Strip tags and collapse whitespace
    const noTags = s.replace(/<[^>]*>/g, ' ');
    const compact = noTags.replace(/\s+/g, ' ').trim();
    // Truncate extremely long messages
    return compact.length > 300 ? compact.slice(0, 300) + '…' : compact;
  };

  // Prefer explicit API base URL from env in both dev and prod; fallback to proxy in dev
  const getApiBase = () => {
    const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
    if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
    return import.meta.env.DEV ? '/api' : 'https://citimed-api.vercel.app';
  };

  // Ensure an "Anonymous" patient exists and return its id
  const ensureAnonymousPatient = async (): Promise<number | null> => {
    try {
      if (anonymousPatientId) return anonymousPatientId;
      const base = getApiBase();
      // Try to find an existing Anonymous patient first (best-effort)
      try {
        let res = await authFetch(`${base}/patients/all-patients`);
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/all-patients/`);
        const data = await res.json().catch(() => ({} as any));
        const rows: any[] = Array.isArray((data as any)?.Patients) ? (data as any).Patients : [];
        const found = rows.find((p: any) => String(p?.name || '').trim().toLowerCase() === 'anonymous');
        if (found?.id) {
          const idNum = Number(found.id);
          setAnonymousPatientId(idNum);
          return idNum;
        }
      } catch { /* ignore lookup errors */ }

      // Create a new Anonymous patient
      const payload: any = {
        name: 'Anonymous',
        uploader: undefined,
        patient_type: 'walk-in',
        gender: 'other',
        age: '0',
        phone_no: '0000000000',
        location: '—',
        notes: 'Auto-created for anonymous visit',
      };
      let res = await authFetch(`${base}/patients/add-patient`, { method: 'POST', body: JSON.stringify(payload) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/add-patient/`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({} as any));
      const id = Number((data as any)?.Patient?.id || 0) || null;
      if (id) setAnonymousPatientId(id);
      return id;
    } catch {
      return null;
    }
  };

  // Helpers for money parsing and live balance preview in payment section
  const moneyToNumber = (s?: string) => {
    if (!s) return 0;
    const n = Number(String(s).replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : 0;
  };

  // Sanitize currency text input to a KSH numeric string with up to 2 decimals
  const sanitizeCurrencyInput = (input: string): string => {
    const cleaned = String(input).replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const left = parts[0] || '';
    const right = parts.length > 1 ? (parts[1] || '').slice(0, 2) : '';
    let res = left.replace(/^0+(\d)/, '$1');
    if (right !== '') res += `.${right}`;
    return res;
  };

  // Sanitize to integer digits only (no decimals) for Charges in KSH
  const sanitizeIntegerCurrencyInput = (input: string): string => {
    const digitsOnly = String(input).replace(/\D/g, '');
    return digitsOnly.replace(/^0+(\d)/, '$1');
  };

  // removed unused getPaymentStatus

  // Record a payment for the newly created visit
  const addPayment = async () => {
    if (!paymentVisit) return;
    const amt = (paymentAmount || '').trim();
    if (!amt) { toast.error('Enter payment amount'); return; }
    const num = Number(amt);
    if (!isFinite(num) || num <= 0) { toast.error('Payment amount must be a positive number'); return; }

    setCreatingPayment(true);
    try {
      const base = getApiBase();
      const body = {
        amount: num.toFixed(2),
        payment_type: (paymentType || 'cash').toLowerCase(),
      };
      let res = await authFetch(`${base}/visits/add-payment/${paymentVisit.id}/`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/add-payment/${paymentVisit.id}/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        const rawMsg = (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        const msg = cleanErrorText(rawMsg) || `Failed to record payment (status ${res.status})`;
        throw new Error(msg);
      }
      toast.success(data?.message || 'Payment recorded successfully');

      // Update visits list with latest balances
      if (data?.visit) {
        const updated = mapApiVisitToDisplay(data.visit);
        // If backend didn't echo payment type, fall back to the one chosen in the form
        if (!updated.payment_method) {
          updated.payment_method = (paymentType || '').toLowerCase();
        }
        setVisits(prev => {
          const exists = prev.some(v => v.id === updated.id);
          return exists ? prev.map(v => v.id === updated.id ? updated : v) : [updated, ...prev];
        });
        setPaymentVisit(updated);
        setSelectedVisit(prev => (prev && prev.id === updated.id ? { ...updated } : prev));
      } else if (paymentVisit?.id) {
        // Fallback: refresh detail
        await refreshVisitDetail(paymentVisit.id);
      }

      // Clear form values (keep the payment section visible with updated totals)
      setPaymentAmount('');
      // Optional fields are not sent to the payment endpoint; keep or clear as desired
      // setPaymentPrescription('');
      // setPaymentCharges('');

      // Show centered success, then close payment section and scroll to recent visits
      setShowPaymentSuccess(true);
      setTimeout(() => {
        setShowPaymentSuccess(false);
        setPaymentVisit(null);
        setShowVisitForm(false);
        const el = document.getElementById('recent-visits');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 1400);
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    } finally {
      setCreatingPayment(false);
    }
  };

  const choosePatient = (p: PatientShort) => {
    setSelectedPatient(p);
    setPatientSearch(`${p.patientNumber || p.id} - ${p.fullName}`);
    setCurrentVisit(prev => ({ ...prev, patient: Number(p.id) }));
  };

  // Auto-numbering for multi-line fields (e.g., lab tests, prescriptions)
  const onNumberedEnter = (field: keyof Visit, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const value = ta.value || '';
    const before = value.slice(0, ta.selectionStart || 0);
    const after = value.slice(ta.selectionEnd || 0);
    // Determine current line number by counting non-empty lines
    const lines = value.split(/\r?\n/).filter(l => l.trim().length > 0);
    const nextNum = Math.max(1, lines.length + 1);
    const insert = `\n${nextNum}. `;
    const newVal = before + insert + after;
    // If textarea was empty, seed with first number
    const seeded = value.trim().length === 0 && nextNum === 1 ? `1. ` : newVal;
    handleInputChange(field as any, seeded);
    // Restore caret position after React state update (microtask)
    queueMicrotask(() => {
      const pos = (before + insert).length;
      ta.selectionStart = ta.selectionEnd = pos;
    });
  };

  const mapApiVisitToDisplay = (v: any): Visit => ({
    id: String(v?.id ?? ''),
    patient: v?.patient,
    patientName: v?.patient_name || `Patient #${v?.patient ?? ''}`,
    patientNumber: v?.patient_number,
    timestamp: v?.timestamp,
    complaints: v?.complaints ?? '',
    history: v?.history ?? '',
    allergies: v?.allergies ?? '',
    physical_exam: v?.physical_exam ?? '',
    lab_test: v?.lab_test ?? '',
    lab_results: v?.lab_results ?? '',
    imaging: v?.imaging ?? '',
    diagnosis: v?.diagnosis ?? '',
    diagnosis_type: v?.diagnosis_type ?? 'chronic',
    prescription: (() => {
      if (v?.prescription) return v.prescription as string;
      if (Array.isArray(v?.prescriptions_list)) {
        try { return (v.prescriptions_list as any[]).filter(Boolean).join(','); } catch { /* ignore */ }
      }
      return '';
    })(),
    charges: v?.charges ?? '',
    paid: (v?.paid ?? v?.total_paid ?? ''),
    balance: v?.balance ?? '',
    payment_method: (() => {
      const resolve = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        const direct = (
          obj.payment_method || obj.paymentMethod ||
          obj.payment_type || obj.paymentType || obj.pay_type || obj.payment_mode || obj.method ||
          obj.last_payment_type
        );
        if (direct) return String(direct);
        // nested common containers
        const nested = (
          obj.payment?.payment_type || obj.payment?.type || obj.payment?.mode || obj.payment?.method ||
          obj.last_payment?.payment_type || obj.last_payment?.type || obj.last_payment?.mode || obj.last_payment?.method ||
          obj.billing?.payment_type || obj.billing?.paymentMethod || obj.billing?.method || obj.billing?.mode
        );
        if (nested) return String(nested);
        // arrays
        const arrays = [obj.payments, obj.transactions, obj.billing?.payments, obj.billing?.transactions].find(Array.isArray);
        if (Array.isArray(arrays) && arrays.length) {
          const last = arrays[arrays.length - 1] || {};
          return String(last.payment_type || last.type || last.mode || last.method || '');
        }
        return '';
      };
      const val = resolve(v);
      return val ? String(val) : '';
    })(),
  });

  const resolvePatientName = (patientId?: number) => {
    if (!patientId) return '';
    const p = patients.find(pp => Number(pp.id) === Number(patientId));
    return p ? p.fullName : '';
  };

  const resolvePatientPhone = (patientId?: number) => {
    if (!patientId) return '';
    const p = patients.find(pp => Number(pp.id) === Number(patientId));
    return p ? (p.phone || '') : '';
  };

  // Resolve Client ID (simple number) and Client Type from patients list
  const resolvePatientNumber = (patientId?: number) => {
    if (!patientId) return '';
    const p = patients.find(pp => Number(pp.id) === Number(patientId));
    return p ? (p.patientNumber || '') : '';
  };
  const resolvePatientType = (patientId?: number) => {
    if (!patientId) return '';
    const p = patients.find(pp => Number(pp.id) === Number(patientId));
    return p ? (p.type || '') : '';
  };

  // Use exact payment method from backend; fall back to em dash when missing
  const formatPaymentMethod = (val?: string) => (val ? String(val) : '—');

  // Helpers to format patient display (ID before name and remove 'Patient' prefix)
  const stripPatientPrefix = (name?: string) => (name || '').replace(/^\s*Patient\s*#?\s*/i, '').trim();
  const formatPatientDisplay = (id?: number, name?: string) => {
    const cleanName = stripPatientPrefix(name);
    const idPart = (id ?? '') !== '' ? String(id) : '';
    return [idPart, cleanName].filter(Boolean).join(' - ');
  };

  const authFetch = async (url: string, init?: RequestInit) => {
    const token = localStorage.getItem('token') || '';
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init?.headers || {}),
    } as Record<string, string>;
    const doFetch = (scheme: 'Token' | 'Bearer') => fetch(url, {
      ...(init || {}),
      headers: {
        ...baseHeaders,
        ...(token ? { Authorization: `${scheme} ${token}` } : {}),
      },
    });
    // Prefer Token first (DRF style), then fall back to Bearer
    let res = await doFetch('Token');
    if (res.status === 401 || res.status === 403) {
      const alt = await doFetch('Bearer');
      if (alt.ok) return alt;
      return res;
    }
    if (!res.ok) {
      const alt = await doFetch('Bearer');
      if (alt.ok) return alt;
      return res;
    }
    return res;
  };

  const loadVisits = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to view visits');
        return;
      }
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/all-visits`, { method: 'GET' });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/all-visits/`, { method: 'GET' });
      const data = await res.json().catch(() => ({} as any));
      const arr: any[] = Array.isArray((data as any)?.visits) ? (data as any).visits : (Array.isArray((data as any)?.data) ? (data as any).data : []);
      const mapped = arr.map(mapApiVisitToDisplay).map(v => ({
        ...v,
        patientName: v.patientName && !/^Patient #/i.test(v.patientName)
          ? v.patientName
          : (resolvePatientName(v.patient) || v.patientName),
      }));
      setVisits(mapped);
      // Reset to first page on reload
      setPage(1);
      // Attempt to resolve any missing patient names via patient-detail endpoint (best-effort)
      try {
        const unresolved = mapped.filter(v => !v.patientName || /^\s*Patient\s*#?/i.test(v.patientName));
        const uniqueIds = Array.from(new Set(unresolved.map(v => Number(v.patient)).filter(Boolean))).slice(0, 10);
        if (uniqueIds.length) {
          const base2 = getApiBase();
          for (const pid of uniqueIds) {
            try {
              let r = await authFetch(`${base2}/patients/patient-detail/${pid}/`, { method: 'GET' });
              if (r.status === 404 || r.status === 405) r = await authFetch(`${base2}/patients/patient-detail/${pid}`, { method: 'GET' });
              const d = await r.json().catch(() => ({} as any));
              const name = (d?.Patient?.name || `${(d?.Patient?.first_name||'')} ${(d?.Patient?.last_name||'')}`.trim()).toString();
              if (name) {
                setPatients(prev => {
                  const exists = prev.some(p => Number(p.id) === Number(pid));
                  return exists ? prev.map(p => Number(p.id) === Number(pid) ? { ...p, fullName: name } : p) : [...prev, { id: String(pid), fullName: name, phone: '', patientNumber: '', type: '' } as any];
                });
                setVisits(prev => prev.map(v => Number(v.patient) === Number(pid) ? { ...v, patientName: name } : v));
              }
            } catch { /* ignore individual failures */ }
          }
        }
      } catch { /* ignore */ }
    } catch (e) {
      console.error('Load visits failed:', e);
      toast.error(cleanErrorText((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (v: Visit) => {
    setEditVisit(v);
    setEditForm({ ...v });
  };

  const saveEdit = async () => {
    if (!editVisit) return;
    setSavingEdit(true);
    try {
      const base = getApiBase();
      const body: any = {
        complaints: (editForm.complaints || '').trim(),
        history: (editForm.history || '').trim(),
        allergies: (editForm.allergies || '').trim(),
        physical_exam: (editForm.physical_exam || '').trim(),
        lab_test: (editForm.lab_test || '').trim(),
        lab_results: (editForm.lab_results || '').trim(),
        imaging: (editForm.imaging || '').trim(),
        diagnosis: (editForm.diagnosis || '').trim(),
        diagnosis_type: (editForm.diagnosis_type || 'chronic').toLowerCase(),
        prescription: (editForm.prescription || '').trim(),
        charges: (editForm.charges || '').toString(),
      };
      // Prefer PUT for full update. Backend also supports PATCH for single-field updates.
      let res = await authFetch(`${base}/visits/edit-visit/${editVisit.id}/`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/edit-visit/${editVisit.id}/`, { method: 'PUT', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        const rawMsg = (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        const msg = cleanErrorText(rawMsg) || `Failed to update visit (status ${res.status})`;
        throw new Error(msg);
      }
      toast.success(data?.message || 'Visit successfully updated');
      const updated = data?.visit ? mapApiVisitToDisplay(data.visit) : { ...editForm, id: editVisit.id } as Visit;
      setVisits(prev => prev.map(v => v.id === editVisit.id ? updated : v));
      setSelectedVisit(prev => (prev && prev.id === editVisit.id ? updated : prev));
      setEditVisit(null);
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Export helpers ---
  const openPrintWindow = (title: string, contentHtml: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) { toast.error('Unable to prepare print view'); return; }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        @media print { html, body { width: 80mm; margin: 0 auto; } }
        html, body { margin: 0 auto; }
        body { width: 72mm; margin: 0 auto; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; font-size: 13px; line-height: 1.5; }
        .header { text-align:center; border-bottom:1px dashed #d1d5db; padding:10px 0 12px; margin-bottom:12px; }
        .title { font-weight:700; font-size: 18px; }
        .muted { color:#6b7280; }
        .row { display:flex; justify-content:space-between; gap:8px; }
        .section { margin: 10px 0; }
        .label { color:#111827; font-weight:700; font-size: 13px; }
        .value { color:#111827; white-space: pre-wrap; word-break: break-word; font-size: 14px; }
        .hr { border-top:1px dashed #d1d5db; margin:10px 0; }
        table { width:100%; border-collapse: collapse; }
        th, td { text-align:left; border-bottom:1px dashed #e5e7eb; padding:6px 3px; font-size:13px; }
        th { color:#111827; font-weight:700; }
        .right { text-align:right; }
      </style>
    </head><body>${contentHtml}</body></html>`);
    doc.close();
    const printAndCleanup = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }, 200);
    };
    if (iframe.contentWindow?.document.readyState === 'complete') {
      printAndCleanup();
    } else {
      iframe.onload = printAndCleanup;
    }
  };

  // removed exportVisitPdf (print) per request

  // removed unused exportAllVisitsPdf

  // Load all visits on mount
  useEffect(() => {
    loadVisits();
  }, []);

  // Load patients on mount for Add Visit selection
  useEffect(() => {
    (async () => {
      setPatientsLoading(true);
      try {
        const base = getApiBase();
        let res = await authFetch(`${base}/patients/all-patients`);
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/all-patients/`);
        const data = await res.json().catch(() => ({}));
        const rows: any[] = Array.isArray(data?.Patients) ? data.Patients : [];
        const mapped: PatientShort[] = rows.map(p => {
          const idStr = String(p?.id ?? '');
          const first = p?.first_name ?? p?.firstName ?? '';
          const last = p?.last_name ?? p?.lastName ?? '';
          const nameFromPair = `${first} ${last}`.trim();
          const nameSingle = p?.name ?? p?.full_name ?? p?.fullName ?? '';
          const fallback = nameFromPair || nameSingle || (p?.email ? String(p.email).split('@')[0] : '') || `Patient #${p?.id ?? ''}`;
          const phone = p?.phone_no ?? p?.phone ?? p?.phoneNumber ?? '';
          const fullPatNum = p?.patient_number ?? p?.patientNumber ?? (p?.id ? `CIT-${new Date().getFullYear()}-${String(p.id).padStart(3,'0')}` : undefined);
          // Extract simple number from patient number
          const patNum = fullPatNum && fullPatNum.includes('CIT-') ? fullPatNum.split('-').pop() : fullPatNum;
          const age = typeof p?.age === 'string' ? parseFloat(p.age) : (typeof p?.age === 'number' ? p.age : undefined);
          const gender = p?.gender ?? undefined;
          const location = p?.location ?? undefined;
          const registeredAt = p?.created_at || p?.date_created || p?.createdAt || p?.timestamp || '';
          return {
            id: idStr,
            fullName: fallback,
            phone,
            patientNumber: patNum,
            type: p?.patient_type ?? p?.type,
            age,
            gender,
            location,
            registeredAt,
          } as PatientShort;
        });
        setPatients(mapped);
      } catch (_) {
        // ignore for now; visits can still function
      } finally {
        setPatientsLoading(false);
      }
    })();
  }, []);

  // After patients load, reconcile visit patient names to exact names
  useEffect(() => {
    if (!patients || patients.length === 0) return;
    setVisits(prev => prev.map(v => {
      const resolved = resolvePatientName(Number(v.patient));
      if (!resolved) return v;
      const isGeneric = !v.patientName || /^patient\s*#/i.test(v.patientName);
      return (isGeneric || v.patientName !== resolved) ? { ...v, patientName: resolved } : v;
    }));
  }, [patients]);

  // Also reconcile currently selected visit's patient name when patients list is available
  useEffect(() => {
    if (!selectedVisit || !patients || patients.length === 0) return;
    const resolved = resolvePatientName(Number(selectedVisit.patient));
    if (resolved && (selectedVisit.patientName !== resolved)) {
      setSelectedVisit({ ...selectedVisit, patientName: resolved });
    }
  }, [patients, selectedVisit]);

  // Keep URL in sync with Add Visit form for better back-button UX
  useEffect(() => {
    // On first load, open form if ?add=1
    const qs = new URLSearchParams(window.location.search);
    const shouldOpen = qs.get('add');
    if ((shouldOpen === '1' || shouldOpen === 'true') && !showVisitForm) {
      setShowVisitForm(true);
      // Prefill patient from query params when available
      const pid = Number(qs.get('patient') || '');
      const pname = (qs.get('name') || '').toString();
      if (pid) {
        const resolvedName = pname || resolvePatientName(pid) || `Patient #${pid}`;
        setSelectedPatient({ id: String(pid), fullName: resolvedName, phone: '', patientNumber: '', type: '' });
        setPatientSearch(`${pid} - ${resolvedName}`);
        setCurrentVisit(prev => ({ ...prev, patient: pid }));
      }
    }

    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      const hasAdd = q.get('add') === '1' || q.get('add') === 'true';
      if (!hasAdd) setShowVisitForm(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hasAdd = qs.get('add') === '1' || qs.get('add') === 'true';
    if (showVisitForm && !hasAdd) {
      const url = new URL(window.location.href);
      url.searchParams.set('add', '1');
      window.history.pushState({}, '', url.toString());
    }
  }, [showVisitForm]);

  // --- Actions: Add, Refresh Detail, Update Paid, Delete ---
  const submitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Required fields per backend spec
    const req = (val?: string | number) => (val ?? '').toString().trim().length > 0;
    if (!currentVisit.patient) { toast.error('Patient ID is required'); return; }
    if (!req(currentVisit.complaints)) { toast.error('Complaints are required'); return; }
    if (!req(currentVisit.diagnosis)) { toast.error('Diagnosis is required'); return; }
    if (!req(currentVisit.diagnosis_type)) { toast.error('Diagnosis type is required'); return; }
    if (!req(currentVisit.prescription)) { toast.error('Prescriptions are required'); return; }

    // Normalize money fields to strings with 2 decimals if numeric
    const fmtMoney = (v?: string) => {
      const s = (v ?? '').toString().trim();
      if (s === '') return '';
      const n = Number(s);
      return isFinite(n) ? n.toFixed(2) : s; // keep as-is if not numeric but non-empty
    };
    const chargesStr = fmtMoney(currentVisit.charges);
    // paid is not part of visit creation; handled via add-payment endpoint
    // Ensure we have an auth token before sending
    const tokenCheck = localStorage.getItem('token');
    if (!tokenCheck) {
      toast.error('Please log in to add a visit');
      return;
    }
    setSaving(true);
    try {
      const base = getApiBase();
      // Build prescriptions_list array from textarea (supports comma or newline separated, strips numbering like "1. ")
      const rawPresc = (currentVisit.prescription || '').toString();
      const prescriptions_list = rawPresc
        .split(/\n|,/)
        .map(s => s.replace(/^\s*\d+\.?\s*/, '').trim())
        .filter(Boolean);
      const body = {
        patient: Number(currentVisit.patient),
        complaints: (currentVisit.complaints || '').trim(),
        diagnosis: (currentVisit.diagnosis || '').trim(),
        diagnosis_type: (currentVisit.diagnosis_type || 'short-term').toLowerCase(),
        prescriptions_list,
        // Optional clinical fields (backend may accept and store them)
        history: (currentVisit.history || '').trim() || undefined,
        allergies: (currentVisit.allergies || '').trim() || undefined,
        physical_exam: (currentVisit.physical_exam || '').trim() || undefined,
        lab_test: (currentVisit.lab_test || '').trim() || undefined,
        lab_results: (currentVisit.lab_results || '').trim() || undefined,
        imaging: (currentVisit.imaging || '').trim() || undefined,
        // Optional billing baseline
        charges: chargesStr || undefined,
      } as any;
      let res = await authFetch(`${base}/visits/add-visit`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/add-visit/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        // Compose helpful error message
        const firstFieldErr = (() => {
          if (data && typeof data === 'object') {
            for (const k of Object.keys(data)) {
              if (k !== 'message' && k !== 'error' && k !== 'detail' && Array.isArray((data as any)[k]) && (data as any)[k].length) {
                return `${k}: ${(data as any)[k][0]}`;
              }
            }
          }
          return '';
        })();
        const rawMsg = firstFieldErr || (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        let msg = cleanErrorText(rawMsg) || `Failed to add visit (status ${res.status})`;
        if (res.status === 401 || res.status === 403) msg = 'Authentication required or insufficient permissions';
        throw new Error(msg);
      }
      toast.success(data?.message || 'Visit successfully saved');
      if (data?.visit) {
        const v = mapApiVisitToDisplay(data.visit);
        // Enrich missing fields with what user just entered so details modal shows complete info immediately
        const enriched: Visit = {
          ...v,
          complaints: v.complaints || (currentVisit.complaints || ''),
          history: v.history || (currentVisit.history || ''),
          allergies: v.allergies || (currentVisit.allergies || ''),
          physical_exam: v.physical_exam || (currentVisit.physical_exam || ''),
          lab_test: v.lab_test || (currentVisit.lab_test || ''),
          lab_results: v.lab_results || (currentVisit.lab_results || ''),
          imaging: v.imaging || (currentVisit.imaging || ''),
          diagnosis: v.diagnosis || (currentVisit.diagnosis || ''),
          diagnosis_type: (v.diagnosis_type || (currentVisit.diagnosis_type as any) || 'short-term') as any,
          prescription: v.prescription || (currentVisit.prescription || ''),
          charges: v.charges || (currentVisit.charges || ''),
        } as Visit;
        setVisits(prev => [enriched, ...prev]);
        setPaymentVisit(enriched); // prompt payment next
        setSelectedVisit(enriched);
        setShowConfirmPayment(true); // show print option immediately
        // Step 2 now only records payment
      }
      setShowVisitForm(false);
      setSelectedPatient(null);
      setPatientSearch('');
      setCurrentVisit({ patient: undefined, complaints: '', history: '', allergies: '', physical_exam: '', lab_test: '', lab_results: '', imaging: '', diagnosis: '', diagnosis_type: 'chronic', prescription: '', charges: '' });
    } catch (e) {
      console.error('Add visit failed:', e);
      toast.error(cleanErrorText((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const refreshVisitDetail = async (visitId: string) => {
    try {
      setDetailLoading(true);
      const base = getApiBase();
      // Try both GET and POST, with and without trailing slash
      let res = await authFetch(`${base}/visits/visit-detail/${visitId}/`, { method: 'GET' });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/visit-detail/${visitId}`, { method: 'GET' });
      if ((res.status === 404 || res.status === 405) && res.ok === false) {
        res = await authFetch(`${base}/visits/visit-detail/${visitId}/`, { method: 'POST' });
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/visit-detail/${visitId}`, { method: 'POST' });
      }
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (res.ok && data?.visit) {
        const updated = mapApiVisitToDisplay(data.visit);
        // Preserve payment type if backend did not include it in the detail response
        if (!updated.payment_method && selectedVisit?.payment_method) {
          updated.payment_method = selectedVisit.payment_method;
        }
        setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
        setSelectedVisit(prev => (prev && prev.id === updated.id ? updated : prev));
      } else if (res.status === 404) {
        toast.error('Visit not found');
      }
    } catch (_) {
      // non-fatal
    } finally {
      setDetailLoading(false);
    }
  };

  const openDeleteConfirm = (visit: Visit) => setConfirmDeleteVisit(visit);
  const performDelete = async () => {
    const visit = confirmDeleteVisit;
    if (!visit) return;
    try {
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/delete-visit/${visit.id}/`, { method: 'DELETE' });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/delete-visit/${visit.id}/`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data && (data.message || data.error || data.detail)) || `Failed to delete visit (status ${res.status})`);
      }
      setVisits(prev => prev.filter(v => v.id !== visit.id));
      toast.success('Visit deleted successfully');
      setConfirmDeleteVisit(null);
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  // (removed unused getStatusColor)

  return (
    <div className="p-6 space-y-6">
      {/* Hero Banner (hidden when adding a visit) */}
      {!showVisitForm && !paymentVisit && (
        <div
          className="relative overflow-hidden rounded-xl text-white shadow-lg"
          style={{
            backgroundImage:
              'url("https://res.cloudinary.com/djksfayfu/image/upload/v1758518877/6248154_esmkro.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-indigo-900/50 to-purple-900/30" />
          <div className="relative px-6 py-8 md:px-10 md:py-10 z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">Visits & Clinical Information</h2>
                <p className="mt-2 text-sm md:text-base text-blue-100">Record complaints, examinations, diagnoses, labs, imaging, and procedures</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowVisitForm(true);
                    const url = new URL(window.location.href);
                    url.searchParams.set('add', '1');
                    window.history.pushState({}, '', url.toString());
                  }}
                  className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>New Visit</span>
                </button>
                <button
                  onClick={async () => {
                    // Enter anonymous mode and open form immediately
                    setAnonymousMode(true);
                    setSelectedPatient(null);
                    setPatientSearch('');
                    setShowVisitForm(true);
                    const url = new URL(window.location.href);
                    url.searchParams.set('add', '1');
                    window.history.pushState({}, '', url.toString());
                    // Resolve Anonymous patient id in background
                    try {
                      setAnonymousResolving(true);
                      const id = await ensureAnonymousPatient();
                      if (id) {
                        setCurrentVisit(prev => ({ ...prev, patient: id }));
                      } else {
                        toast.error('Login required to record anonymous visit');
                      }
                    } finally {
                      setAnonymousResolving(false);
                    }
                  }}
                  className="bg-gray-100 text-gray-900 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  title="Record a visit without patient details"
                >
                  Add Anonymous
                </button>
              </div>
            </div>
          </div>
          <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
        </div>
      )}

      {/* Tabs for browsing */}
      {!showVisitForm && !paymentVisit && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 rounded-md text-sm ${activeTab === 'patients' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setActiveTab('patients')}
              >
                Patients
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm ${activeTab === 'visits' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setActiveTab('visits')}
              >
                Visit Details
              </button>
            </div>
            {activeTab === 'visits' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e)=>setSearchTerm(e.target.value)}
                    placeholder="Search visits"
                    className="w-56 pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={`${sortBy}:${sortDir}`}
                  onChange={(e)=>{
                    const [sb, sd] = e.target.value.split(':') as any;
                    setSortBy(sb);
                    setSortDir(sd);
                  }}
                >
                  <option value="date:desc">Newest</option>
                  <option value="date:asc">Oldest</option>
                  <option value="name:asc">Name A→Z</option>
                  <option value="name:desc">Name Z→A</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Visit Details list */}
      {!showVisitForm && !paymentVisit && activeTab === 'visits' && (
        <div id="recent-visits" className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Visit Details</h3>
            <div className="text-sm text-gray-600">Page {currentPage} of {totalPages} • {sortedVisits.length} rows</div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading visits…</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Patient ID</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Diagnosis</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedVisits.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-gray-900">{String(v.patient || '').trim() || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-900">{resolvePatientName(Number(v.patient)) || v.patientName || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{resolvePatientPhone(Number(v.patient)) || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700 capitalize">{resolvePatientType(Number(v.patient)) || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.diagnosis || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedVisit({ ...v, patientName: resolvePatientName(Number(v.patient)) || v.patientName }); refreshVisitDetail(v.id); }}
                            className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center justify-center"
                            aria-label="View visit"
                            title="View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(v)}
                            className="p-2 rounded-md bg-green-600 hover:bg-green-700 text-white inline-flex items-center justify-center"
                            aria-label="Edit visit"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => printVisitReceiptFor(v)}
                            className="p-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center justify-center"
                            aria-label="Print receipt"
                            title="Print"
                          >
                            <PrinterIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(v)}
                            className="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white inline-flex items-center justify-center"
                            aria-label="Delete visit"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!loading && paginatedVisits.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No visits found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {/* Pager */}
          <div className="flex items-center justify-between px-6 py-3 border-t text-sm">
            <div className="text-gray-600">Page {currentPage} of {totalPages}</div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 disabled:opacity-50"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab content: Patients list */}
      {!showVisitForm && !paymentVisit && activeTab === 'patients' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Patients</h3>
          </div>
          <div className="overflow-x-auto">
            {patientsLoading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading patients…</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients
                    .slice()
                    .sort((a,b) => Number(b.id) - Number(a.id))
                    .map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.fullName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"><span className="font-mono">{p.patientNumber || '—'}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.phone || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              setSelectedPatient({ id: String(p.id), fullName: p.fullName, phone: p.phone, patientNumber: p.patientNumber, type: p.type });
                              setPatientSearch(`${p.fullName} (${p.patientNumber || p.id})`);
                              setCurrentVisit(cv => ({ ...cv, patient: Number(p.id) }));
                              setShowVisitForm(true);
                              const url = new URL(window.location.href);
                              url.searchParams.set('add', '1');
                              window.history.pushState({}, '', url.toString());
                            }}
                            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Add Visit
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payment form after creating a visit */}
      {paymentVisit && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-blue-100">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Step 2: Payment for Visit #{paymentVisit.id}</h3>
            {user?.role === 'admin' && (
              <span className="text-xs text-orange-600">Confirm amounts before recording payment.</span>
            )}
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="text-sm text-gray-600">Charges</div>
              <div className="text-lg font-semibold text-gray-900">{paymentVisit.charges || '—'}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-600">Already Paid</div>
              <div className="text-lg font-semibold text-gray-900">
                {(() => {
                  const already = moneyToNumber(paymentVisit.paid);
                  const incoming = moneyToNumber(paymentAmount);
                  return (already + incoming).toFixed(2);
                })()}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-600">Balance (after this payment)</div>
              <div className="text-lg font-semibold text-gray-900">
                {(() => {
                  const charges = moneyToNumber(paymentVisit.charges);
                  const already = moneyToNumber(paymentVisit.paid);
                  const incoming = moneyToNumber(paymentAmount);
                  const bal = Math.max(charges - already - incoming, 0);
                  return bal.toFixed(2);
                })()}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Now</label>
              <input
                value={paymentAmount}
                onChange={e => setPaymentAmount(sanitizeCurrencyInput(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="KSH"
                inputMode="decimal"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
              <select value={paymentType} onChange={e=>setPaymentType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="mpesa">Mpesa</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => setShowConfirmPayment(true)} disabled={creatingPayment} className={`w-full md:w-auto px-4 py-2 rounded-lg text-white ${creatingPayment ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{creatingPayment ? 'Saving…' : 'Save Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Visit Form - In-page section with sticky header */}
      {showVisitForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">New Visit Record</h3>
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-1 text-sm ${autoSaveStatus === 'saved' ? 'text-green-600' : autoSaveStatus === 'saving' ? 'text-yellow-600' : 'text-red-600'}`}>
                  <ClockIcon className="h-4 w-4" />
                  <span>{autoSaveStatus === 'saved' ? 'Draft saved' : autoSaveStatus === 'saving' ? 'Saving...' : 'Save failed'}</span>
                </div>
                <button onClick={() => { setShowVisitForm(false); setAnonymousMode(false); if (window.history.length > 1) window.history.back(); }} className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white">Close</button>
                <button onClick={() => { setShowVisitForm(false); setAnonymousMode(false); }} className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-6">
            <form className="space-y-6" onSubmit={submitVisit} noValidate>
              {/* Patient Selection with search (hidden in anonymous mode) */}
              {!anonymousMode && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Select Patient *</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={patientSearch}
                    onChange={(e)=>{ setPatientSearch(e.target.value); setSelectedPatient(null); }}
                    placeholder="Search by name or Client ID"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {!selectedPatient && patientSearch.trim() && (
                  <div className="max-h-44 overflow-auto border border-gray-200 rounded-lg divide-y">
                    {patients
                      .filter(p=>{
                        const q = patientSearch.trim().toLowerCase();
                        return p.fullName.toLowerCase().includes(q) || (p.patientNumber||'').toLowerCase().includes(q) || (p.phone||'').toLowerCase().includes(q);
                      })
                      .slice(0, 10)
                      .map(p=> (
                        <button type="button" key={p.id} onClick={()=>choosePatient(p)} className="group w-full text-left px-3 py-2 bg-blue-600 hover:bg-green-600">
                          <div className="font-medium text-white">{p.fullName}</div>
                          <div className="mt-1 flex flex-wrap gap-2 items-center text-[11px] text-white/90 group-hover:text-white">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                              <span className="opacity-90">Client ID:</span>
                              <span className="font-mono">{p.patientNumber || p.id}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                              <span className="opacity-90">Phone:</span>
                              <span>{p.phone || '—'}</span>
                            </span>
                            {typeof p.age !== 'undefined' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                                <span className="opacity-90">Age:</span>
                                <span>{p.age}</span>
                              </span>
                            )}
                            {p.gender && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 capitalize">
                                <span className="opacity-90">Gender:</span>
                                <span>{p.gender}</span>
                              </span>
                            )}
                            {p.location && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                                <span className="opacity-90">Location:</span>
                                <span>{p.location}</span>
                              </span>
                            )}
                            {p.type && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 capitalize">
                                <span className="opacity-90">Type:</span>
                                <span>{p.type}</span>
                              </span>
                            )}
                            {p.registeredAt && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                                <span className="opacity-90">Registered:</span>
                                <span>{new Date(p.registeredAt).toLocaleString()}</span>
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    {patients.filter(p=>{
                      const q = patientSearch.trim().toLowerCase();
                      return p.fullName.toLowerCase().includes(q) || (p.patientNumber||'').toLowerCase().includes(q) || (p.phone||'').toLowerCase().includes(q);
                    }).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No matching patients</div>
                    )}
                  </div>
                )}
                {selectedPatient && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-600">
                    <div className="font-medium text-white">{selectedPatient.fullName}</div>
                    <div className="mt-1 flex flex-wrap gap-2 items-center text-[12px] text-white/90">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                        <span className="opacity-90">Client ID:</span>
                        <span className="font-mono">{selectedPatient.patientNumber || selectedPatient.id}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                        <span className="opacity-90">Phone:</span>
                        <span>{selectedPatient.phone || '—'}</span>
                      </span>
                      {typeof selectedPatient.age !== 'undefined' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                          <span className="opacity-90">Age:</span>
                          <span>{selectedPatient.age}</span>
                        </span>
                      )}
                      {selectedPatient.gender && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 capitalize">
                          <span className="opacity-90">Gender:</span>
                          <span>{selectedPatient.gender}</span>
                        </span>
                      )}
                      {selectedPatient.location && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                          <span className="opacity-90">Location:</span>
                          <span>{selectedPatient.location}</span>
                        </span>
                      )}
                      {selectedPatient.type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 capitalize">
                          <span className="opacity-90">Type:</span>
                          <span>{selectedPatient.type}</span>
                        </span>
                      )}
                      {selectedPatient.registeredAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                          <span className="opacity-90">Registered:</span>
                          <span>{new Date(selectedPatient.registeredAt).toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <input type="number" className="hidden" value={currentVisit.patient as any || ''} readOnly />
              </div>
              )}
              {anonymousMode && (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Anonymous visit. Patient will be saved as <span className="font-medium">Anonymous</span>.
                  {anonymousResolving && (
                    <span className="ml-2 text-gray-500">Preparing anonymous patient…</span>
                  )}
                </div>
              )}

              {/* Reveal the rest of the form only after a patient is selected */}
              {(selectedPatient || anonymousMode) && (
                <>

              {/* Billing - move Charges to end of the form */}

              {/* Clinical Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Clinical Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complaints *</label>
                  <textarea value={currentVisit.complaints || ''} onChange={(e)=>handleInputChange('complaints' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Describe the patient's main complaints..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">History</label>
                  <textarea value={currentVisit.history || ''} onChange={(e)=>handleInputChange('history' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Detailed history of the current illness..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Physical Examination</label>
                  <textarea value={currentVisit.physical_exam || ''} onChange={(e)=>handleInputChange('physical_exam' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Physical examination findings..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input type="text" value={currentVisit.allergies || ''} onChange={(e)=>handleInputChange('allergies' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Known allergies..." />
                </div>
              </div>

              {/* Lab Tests */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Lab Tests</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Lab Tests (press Enter to auto-number)</label>
                  <textarea
                    value={currentVisit.lab_test || ''}
                    onChange={(e)=>handleInputChange('lab_test' as any, e.target.value)}
                    onKeyDown={(e)=>onNumberedEnter('lab_test', e)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1. CBC\n2. LFTs\n3. ..."
                  />
                  {currentVisit.lab_test && (
                    <div className="mt-1 text-right">
                      <button type="button" onClick={()=>handleInputChange('lab_test' as any, '')} className="text-sm text-red-600 hover:text-red-800">Clear</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lab Results</label>
                  <textarea value={currentVisit.lab_results || ''} onChange={(e)=>handleInputChange('lab_results' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Lab test results..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imaging</label>
                  <textarea value={currentVisit.imaging || ''} onChange={(e)=>handleInputChange('imaging' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Imaging notes or recommendations..." />
                </div>
              </div>

              {/* Diagnosis */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Diagnosis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                    <textarea value={currentVisit.diagnosis || ''} onChange={(e)=>handleInputChange('diagnosis' as any, e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Primary diagnosis..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Type *</label>
                    <select value={currentVisit.diagnosis_type || 'chronic'} onChange={(e)=>handleInputChange('diagnosis_type' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="infection">Infection</option>
                      <option value="short-term">Short-term</option>
                      <option value="chronic">Chronic</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Prescriptions */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Prescriptions</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Prescription Items (press Enter to auto-number)</label>
                  <textarea
                    value={currentVisit.prescription || ''}
                    onChange={(e)=>handleInputChange('prescription' as any, e.target.value)}
                    onKeyDown={(e)=>onNumberedEnter('prescription', e)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={"1. Amlodipine 10mg OD\n2. Paracetamol 1g TDS\n3. ..."}
                  />
                  {currentVisit.prescription && (
                    <div className="mt-1 text-right">
                      <button type="button" onClick={()=>handleInputChange('prescription' as any, '')} className="text-sm text-red-600 hover:text-red-800">Clear</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Charges at the end */}
              <div className="space-y-2 mt-6">
                <label className="block text-sm font-medium text-gray-700">Charges *</label>
                <input
                  type="text"
                  value={currentVisit.charges || ''}
                  onChange={(e)=>handleInputChange('charges' as any, sanitizeIntegerCurrencyInput(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="KSH"
                  inputMode="numeric"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowVisitForm(false); setAnonymousMode(false); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || anonymousResolving || !currentVisit.patient}
                  className={`px-4 py-2 rounded-lg text-white ${saving || anonymousResolving || !currentVisit.patient ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {saving ? 'Saving…' : anonymousResolving ? 'Please wait…' : !currentVisit.patient ? 'Waiting for patient…' : 'Save & Next'}
                </button>
              </div>
              </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Patients List hidden per new requirement */}
      {false && !showVisitForm && (
      <div id="recent-visits" className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Patients</h3>
        </div>
        <div className="overflow-x-auto">
          {patientsLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading patients…</div>
          ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients
                .slice()
                .sort((a,b) => Number(b.id) - Number(a.id))
                .map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.fullName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"><span className="font-mono">{p.patientNumber || '—'}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.phone || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        // Preselect this patient and reveal the rest of the form
                        setSelectedPatient({
                          id: String(p.id),
                          fullName: p.fullName,
                          phone: p.phone,
                          patientNumber: p.patientNumber,
                          type: p.type,
                        });
                        setPatientSearch(`${p.fullName} (${p.patientNumber || p.id})`);
                        setCurrentVisit(cv => ({ ...cv, patient: Number(p.id) }));
                        setShowVisitForm(true);
                        // ensure URL has ?add=1
                        const url = new URL(window.location.href);
                        url.searchParams.set('add', '1');
                        window.history.pushState({}, '', url.toString());
                      }}
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Add Visit
                    </button>
                  </td>
                </tr>
              ))}
              {(!loading && filteredVisits.filter(v => {
                const q = (searchTerm||'').trim().toLowerCase();
                const phone = (() => {
                  const p = patients.find(pp => Number(pp.id) === Number(v.patient));
                  return (p?.phone || '').toString().toLowerCase();
                })();
                return !q ||
                  (v.patientName||'').toLowerCase().includes(q) ||
                  (v.patientNumber||'').toLowerCase().includes(q) ||
                  (v.diagnosis||'').toLowerCase().includes(q) ||
                  phone.includes(q);
              }).length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No visits found.</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeleteVisit(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900">Delete visit?</h3>
              <p className="mt-2 text-sm text-gray-700">This action cannot be undone. Are you sure you want to delete this visit?</p>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteVisit(null)} className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                <XMarkIcon className="h-4 w-4" />
                <span>Cancel</span>
              </button>
              <button onClick={performDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Visit Details Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedVisit(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Visit Details</h3>
                <button onClick={() => setSelectedVisit(null)} className="px-2.5 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-100 p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Patient</h4>
                  <p className="text-sm text-gray-700">{formatPatientDisplay(Number(selectedVisit.patient), selectedVisit.patientName) || '—'}</p>
                  <p className="text-xs text-gray-500">Patient ID: {selectedVisit.patient}</p>
                  {selectedVisit.timestamp && (
                    <p className="text-xs text-gray-500 mt-1">Date: {new Date(selectedVisit.timestamp).toLocaleString()}</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-100 p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Billing</h4>
                  <p className="text-sm text-gray-700">Charges: {selectedVisit.charges ?? '0.00'}</p>
                  <p className="text-sm text-gray-700">Paid: {selectedVisit.paid ?? '0.00'}</p>
                  <p className="text-sm text-gray-700">Payment Method: {(() => {
                    const v: any = selectedVisit || {};
                    const mapped = selectedVisit.payment_method;
                    if (mapped) return formatPaymentMethod(mapped);
                    const nested = (
                      v.payment?.payment_type || v.payment?.type || v.payment?.mode || v.payment?.method ||
                      v.last_payment?.payment_type || v.last_payment?.type || v.last_payment?.mode || v.last_payment?.method
                    );
                    if (nested) return formatPaymentMethod(String(nested));
                    if (Array.isArray(v.payments) && v.payments.length) {
                      const last = v.payments[v.payments.length - 1] || {};
                      const fromArr = last.payment_type || last.type || last.mode || last.method;
                      if (fromArr) return formatPaymentMethod(String(fromArr));
                    }
                    return '—';
                  })()}</p>
                  <p className="text-sm text-gray-700">Balance: {selectedVisit.balance ?? '0.00'}</p>
                </div>

                <div className="rounded-lg border border-gray-100 p-4 md:col-span-2">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Clinical Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Complaints</p>
                      <p className="text-sm text-gray-800">{selectedVisit.complaints || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">History</p>
                      <p className="text-sm text-gray-800">{selectedVisit.history || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Allergies</p>
                      <p className="text-sm text-gray-800">{selectedVisit.allergies || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Physical Exam</p>
                      <p className="text-sm text-gray-800">{selectedVisit.physical_exam || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lab Test</p>
                      <p className="text-sm text-gray-800">{selectedVisit.lab_test || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lab Results</p>
                      <p className="text-sm text-gray-800">{selectedVisit.lab_results || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Imaging</p>
                      <p className="text-sm text-gray-800">{selectedVisit.imaging || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Diagnosis</p>
                      <p className="text-sm text-gray-800">{selectedVisit.diagnosis || '—'} <span className="text-xs text-gray-500">({selectedVisit.diagnosis_type || '—'})</span></p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">Prescription</p>
                      <p className="text-sm text-gray-800">{selectedVisit.prescription || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end">
              <button onClick={() => setSelectedVisit(null)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {showConfirmPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirmPayment(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Payment</h3>
              <p className="mt-2 text-sm text-gray-700">Please review amounts and payment type. After saving, payment details cannot be edited.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-gray-500">Charges</div><div className="font-medium">{paymentVisit?.charges || '—'}</div></div>
                <div><div className="text-gray-500">Already Paid</div><div className="font-medium">{paymentVisit?.paid || '0.00'}</div></div>
                <div><div className="text-gray-500">Pay Now</div><div className="font-medium">{paymentAmount || '—'}</div></div>
                <div><div className="text-gray-500">Type</div><div className="font-medium capitalize">{paymentType}</div></div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setShowConfirmPayment(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
              <button onClick={printVisitReceipt} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Print Receipt</button>
              <button onClick={() => { setShowConfirmPayment(false); addPayment(); }} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Confirm & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Success Overlay */}
      {showPaymentSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-green-200 px-8 py-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-600 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-white"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div className="text-lg font-semibold text-green-800">Payment saved</div>
            <div className="text-sm text-gray-600 mt-1">Redirecting to Recent Visits…</div>
          </div>
        </div>
      )}

      

      {/* Edit Visit Modal */}
      {editVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditVisit(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Visit #{editVisit.id}</h3>
              <button onClick={() => setEditVisit(null)} className="px-2.5 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complaints</label>
                  <textarea rows={3} value={editForm.complaints || ''} onChange={(e)=>handleEditChange('complaints' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">History</label>
                  <textarea rows={3} value={editForm.history || ''} onChange={(e)=>handleEditChange('history' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input value={editForm.allergies || ''} onChange={(e)=>handleEditChange('allergies' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Physical Exam</label>
                  <textarea rows={3} value={editForm.physical_exam || ''} onChange={(e)=>handleEditChange('physical_exam' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lab Test</label>
                  <input value={editForm.lab_test || ''} onChange={(e)=>handleEditChange('lab_test' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lab Results</label>
                  <textarea rows={3} value={editForm.lab_results || ''} onChange={(e)=>handleEditChange('lab_results' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imaging</label>
                  <textarea rows={3} value={editForm.imaging || ''} onChange={(e)=>handleEditChange('imaging' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <textarea rows={3} value={editForm.diagnosis || ''} onChange={(e)=>handleEditChange('diagnosis' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Type</label>
                  <select value={editForm.diagnosis_type || 'chronic'} onChange={(e)=>handleEditChange('diagnosis_type' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="infection">Infection</option>
                    <option value="short-term">Short-term</option>
                    <option value="chronic">Chronic</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prescription</label>
                  <textarea rows={3} value={editForm.prescription || ''} onChange={(e)=>handleEditChange('prescription' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Charges</label>
                  <input value={editForm.charges || ''} onChange={(e)=>handleEditChange('charges' as any, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setEditVisit(null)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className={`px-4 py-2 rounded-md text-white ${savingEdit ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
