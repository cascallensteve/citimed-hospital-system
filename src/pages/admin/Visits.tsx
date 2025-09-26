import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  MagnifyingGlassIcon, 
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  XMarkIcon,
  TrashIcon,
  PlusIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

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
}

interface PatientShort {
  id: string;
  fullName: string;
  phone: string;
  patientNumber?: string;
  type?: string;
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

  // Simple modals for adding lab test and prescription
  const [showAddLab, setShowAddLab] = useState(false);
  const [labInput, setLabInput] = useState('');
  const [showAddRx, setShowAddRx] = useState(false);
  const [rxInput, setRxInput] = useState('');

  const filteredVisits = visits.filter(visit =>
    visit.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (visit.patientNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  // Helpers for money parsing and live balance preview in payment section
  const moneyToNumber = (s?: string) => {
    if (!s) return 0;
    const n = Number(String(s).replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : 0;
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
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
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
        setVisits(prev => {
          const exists = prev.some(v => v.id === updated.id);
          return exists ? prev.map(v => v.id === updated.id ? updated : v) : [updated, ...prev];
        });
        setPaymentVisit(updated);
        setSelectedVisit(prev => (prev && prev.id === updated.id ? updated : prev));
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
    setPatientSearch(`${p.fullName} (${p.patientNumber || p.id})`);
    setCurrentVisit(prev => ({ ...prev, patient: Number(p.id) }));
  };

  const addLabTest = () => {
    setLabInput('');
    setShowAddLab(true);
  };

  const addPrescription = () => {
    setRxInput('');
    setShowAddRx(true);
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
    prescription: v?.prescription ?? '',
    charges: v?.charges ?? '',
    paid: (v?.paid ?? v?.total_paid ?? ''),
    balance: v?.balance ?? '',
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
    // Try Bearer first (common for JWT). If not OK, try Token.
    let res = await doFetch('Bearer');
    if (!res.ok) {
      const fallback = await doFetch('Token');
      // If fallback is OK, use it; otherwise keep original (to preserve original error context)
      if (fallback.ok) return fallback;
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
      const { visits } = await api.visits.all();
      const arr: any[] = Array.isArray(visits) ? visits : [];
      const mapped = arr.map(mapApiVisitToDisplay).map(v => ({
        ...v,
        patientName: v.patientName && !/^Patient #/i.test(v.patientName)
          ? v.patientName
          : (resolvePatientName(v.patient) || v.patientName),
      }));
      setVisits(mapped);
      // Reset to first page on reload
      setPage(1);
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
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
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
        @media print { html, body { width: 80mm; } }
        body { width: 72mm; margin: 0 auto; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; font-size: 12px; line-height: 1.45; }
        .header { text-align:center; border-bottom:1px dashed #d1d5db; padding:8px 0 10px; margin-bottom:10px; }
        .title { font-weight:700; font-size: 16px; }
        .muted { color:#6b7280; }
        .row { display:flex; justify-content:space-between; gap:8px; }
        .section { margin: 8px 0; }
        .label { color:#111827; font-weight:700; font-size: 12px; }
        .value { color:#111827; white-space: pre-wrap; word-break: break-word; font-size: 13px; }
        .hr { border-top:1px dashed #d1d5db; margin:8px 0; }
        table { width:100%; border-collapse: collapse; }
        th, td { text-align:left; border-bottom:1px dashed #e5e7eb; padding:5px 3px; font-size:12px; }
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
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
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
          const patNum = p?.patient_number ?? p?.patientNumber ?? (p?.id ? `CIT-${new Date().getFullYear()}-${String(p.id).padStart(3,'0')}` : undefined);
          return {
            id: idStr,
            fullName: fallback,
            phone,
            patientNumber: patNum,
            type: p?.patient_type ?? p?.type,
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
    if (!req(currentVisit.history)) { toast.error('History is required'); return; }
    if (!req(currentVisit.allergies)) { toast.error('Allergies are required'); return; }
    if (!req(currentVisit.physical_exam)) { toast.error('Physical exam is required'); return; }
    if (!req(currentVisit.lab_test)) { toast.error('Lab test is required'); return; }
    if (!req(currentVisit.lab_results)) { toast.error('Lab results are required'); return; }
    if (!req(currentVisit.imaging)) { toast.error('Imaging is required'); return; }
    if (!req(currentVisit.diagnosis)) { toast.error('Diagnosis is required'); return; }
    if (!req(currentVisit.diagnosis_type)) { toast.error('Diagnosis type is required'); return; }
    if (!req(currentVisit.prescription)) { toast.error('Prescription is required'); return; }
    if (!req(currentVisit.charges)) { toast.error('Charges are required'); return; }

    // Normalize money fields to strings with 2 decimals if numeric
    const fmtMoney = (v?: string) => {
      const s = (v ?? '').toString().trim();
      if (s === '') return '';
      const n = Number(s);
      return isFinite(n) ? n.toFixed(2) : s; // keep as-is if not numeric but non-empty
    };
    const chargesStr = fmtMoney(currentVisit.charges);
    // paid is not part of visit creation; handled via add-payment endpoint
    setSaving(true);
    try {
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
      const body = {
        patient: Number(currentVisit.patient),
        complaints: (currentVisit.complaints || '').trim(),
        history: (currentVisit.history || '').trim(),
        allergies: (currentVisit.allergies || '').trim(),
        physical_exam: (currentVisit.physical_exam || '').trim(),
        lab_test: (currentVisit.lab_test || '').trim(),
        lab_results: (currentVisit.lab_results || '').trim(),
        imaging: (currentVisit.imaging || '').trim(),
        diagnosis: (currentVisit.diagnosis || '').trim(),
        diagnosis_type: (currentVisit.diagnosis_type || 'chronic').toLowerCase(),
        prescription: (currentVisit.prescription || '').trim(),
        charges: chargesStr,
        // paid: handled separately via finances/add-payment/{visitId}/
      } as any;
      let res = await authFetch(`${base}/visits/add-visit`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/add-visit/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        // Try to surface field-specific errors if present
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
        const msg = cleanErrorText(rawMsg) || `Failed to add visit (status ${res.status})`;
        throw new Error(msg);
      }
      toast.success(data?.message || 'Visit successfully saved');
      if (data?.visit) {
        const v = mapApiVisitToDisplay(data.visit);
        setVisits(prev => [v, ...prev]);
        setPaymentVisit(v); // prompt payment next
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
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
      let res = await authFetch(`${base}/visits/visit-detail/${visitId}/`);
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/visit-detail/${visitId}`);
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (res.ok && data?.visit) {
        const updated = mapApiVisitToDisplay(data.visit);
        setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
        setSelectedVisit(prev => (prev && prev.id === updated.id ? updated : prev));
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
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
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
      {!showVisitForm && (
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
              </div>
            </div>
          </div>
          <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
        </div>
      )}

      {/* Tabs for browsing */}
      {!showVisitForm && (
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
      {!showVisitForm && activeTab === 'visits' && (
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
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Diagnosis</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Charges</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedVisits.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-gray-900">{v.patientName}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.diagnosis || '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.charges ?? '0.00'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.paid ?? '0.00'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{v.balance ?? '0.00'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedVisit({ ...v, patientName: resolvePatientName(Number(v.patient)) || v.patientName })} className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                            <EyeIcon className="h-4 w-4" /> View
                          </button>
                          <button onClick={() => openEdit(v)} className="px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
                            <PencilSquareIcon className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => openDeleteConfirm(v)} className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-1">
                            <TrashIcon className="h-4 w-4" /> Delete
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
      {!showVisitForm && activeTab === 'patients' && (
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
              <div className="text-lg font-semibold text-gray-900">{paymentVisit.paid || '0.00'}</div>
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
              <input value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g., 600.00" />
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
                <button onClick={() => { setShowVisitForm(false); if (window.history.length > 1) window.history.back(); }} className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white">Close</button>
                <button onClick={() => setShowVisitForm(false)} className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-6">
            <form className="space-y-6" onSubmit={submitVisit}>
              {/* Patient Selection with search */}
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
                        const q = patientSearch.toLowerCase();
                        return p.fullName.toLowerCase().includes(q) || (p.patientNumber||'').toLowerCase().includes(q);
                      })
                      .slice(0, 10)
                      .map(p=> (
                        <button type="button" key={p.id} onClick={()=>choosePatient(p)} className="group w-full text-left px-3 py-2 bg-blue-600 hover:bg-green-600">
                          <div className="font-medium text-white">{p.fullName}</div>
                          <div className="text-xs text-white/90 group-hover:text-white">Client ID: {p.patientNumber || p.id} • {p.phone || '—'}</div>
                        </button>
                      ))}
                    {patients.filter(p=>{
                      const q = patientSearch.toLowerCase();
                      return p.fullName.toLowerCase().includes(q) || (p.patientNumber||'').toLowerCase().includes(q);
                    }).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No matching patients</div>
                    )}
                  </div>
                )}
                {selectedPatient && (
                  <div className="p-3 rounded-lg border border-green-200 bg-green-600">
                    <div className="font-medium text-white">{selectedPatient.fullName}</div>
                    <div className="text-sm text-white/90">Client ID: {selectedPatient.patientNumber || selectedPatient.id} • {selectedPatient.phone || '—'}</div>
                  </div>
                )}
                <input type="number" className="hidden" value={currentVisit.patient as any || ''} readOnly />
              </div>

              {/* Reveal the rest of the form only after a patient is selected */}
              {selectedPatient && (
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
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium text-gray-900">Lab Tests</h4>
                  <button
                    type="button"
                    onClick={addLabTest}
                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Lab Test
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span>{currentVisit.lab_test || '—'}</span>
                    {currentVisit.lab_test && (
                      <button type="button" onClick={()=>handleInputChange('lab_test' as any, '')} className="text-red-600 hover:text-red-800"><XMarkIcon className="h-4 w-4" /></button>
                    )}


                  </div>
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
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium text-gray-900">Prescriptions</h4>
                  <button type="button" onClick={addPrescription} className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" />
                    Add Prescription
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span>{currentVisit.prescription || '—'}</span>
                    {currentVisit.prescription && (
                      <button type="button" onClick={()=>handleInputChange('prescription' as any, '')} className="text-red-600 hover:text-red-800"><XMarkIcon className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </div>

              {/* Charges at the end */}
              <div className="space-y-2 mt-6">
                <label className="block text-sm font-medium text-gray-700">Charges *</label>
                <input
                  type="text"
                  value={currentVisit.charges || ''}
                  onChange={(e)=>handleInputChange('charges' as any, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 2500.00"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVisitForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? 'Saving…' : 'Save & Next'}</button>
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
                const q = (searchTerm||'').toLowerCase();
                return !q ||
                  (v.patientName||'').toLowerCase().includes(q) ||
                  (v.patientNumber||'').toLowerCase().includes(q) ||
                  (v.diagnosis||'').toLowerCase().includes(q);
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
                  <p className="text-sm text-gray-700">{selectedVisit.patientName || (selectedVisit.patient ? `Patient #${selectedVisit.patient}` : '—')}</p>
                  <p className="text-xs text-gray-500">Patient ID: {selectedVisit.patient}</p>
                  <p className="text-xs text-gray-500">Client ID: {selectedVisit.patientNumber || '—'}</p>
                  {selectedVisit.timestamp && (
                    <p className="text-xs text-gray-500 mt-1">Date: {new Date(selectedVisit.timestamp).toLocaleString()}</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-100 p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Billing</h4>
                  <p className="text-sm text-gray-700">Charges: {selectedVisit.charges ?? '0.00'}</p>
                  <p className="text-sm text-gray-700">Paid: {selectedVisit.paid ?? '0.00'}</p>
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

      {/* Add Lab Test Modal */}
      {showAddLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddLab(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900">Add Lab Test</h3>
              <p className="mt-1 text-sm text-gray-600">Enter a lab test name to append to this visit.</p>
              <input value={labInput} onChange={e=>setLabInput(e.target.value)} autoFocus placeholder="e.g., CBC, Blood sugar" className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setShowAddLab(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
              <button onClick={() => { const prev = currentVisit.lab_test || ''; const t = labInput.trim(); if (t) { handleInputChange('lab_test' as any, prev ? `${prev}, ${t}` : t); setShowAddLab(false);} }} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Prescription Modal */}
      {showAddRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddRx(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900">Add Prescription</h3>
              <p className="mt-1 text-sm text-gray-600">Enter a prescription to append to this visit.</p>
              <input value={rxInput} onChange={e=>setRxInput(e.target.value)} autoFocus placeholder="e.g., Amlodipine 10mg OD" className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setShowAddRx(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
              <button onClick={() => { const prev = currentVisit.prescription || ''; const t = rxInput.trim(); if (t) { handleInputChange('prescription' as any, prev ? `${prev}, ${t}` : t); setShowAddRx(false);} }} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Add</button>
            </div>
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
