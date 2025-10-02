import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarDaysIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDataCache } from '../../context/DataCacheContext';

// Prefer explicit API base URL from env in both dev and prod; fallback to proxy in dev
// Normalize to remove any trailing slashes to prevent URLs like `https://host//patients/...`
const getApiBase = () => {
  const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
  const normalizedEnv = (explicit && typeof explicit === 'string') ? explicit.trim().replace(/\/+$/, '') : '';
  if (normalizedEnv) return normalizedEnv;
  return import.meta.env.DEV ? '/api' : 'https://citimed-api-git-develop-billys-projects-f7b2d4d6.vercel.app';
};

interface Patient {
  id: string;
  patientNumber: string;
  fullName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phoneNumber: string;
  location: string;
  patientType: 'Walk-in' | 'Repeat' | 'Referred';
  registrationDate: string;
  additionalInfo?: string;
}

const Patients = () => {
  const navigate = useNavigate();
  const { patients: cachedPatients, setPatients: setCachedPatients, loaded: cacheLoaded } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'name' | 'number' | 'phone'>('name');
  const [showAddForm, setShowAddForm] = useState(false);

  // Start with empty list; load from backend on mount
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth guard helpers (must be inside component to access navigate)
  const getToken = () => (localStorage.getItem('token') || '').trim();
  const redirectToLogin = (msg?: string) => {
    if (msg) toast.error(msg);
    try { localStorage.removeItem('token'); } catch {}
    navigate('/login');
  };

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Safely format various date strings (ISO or already formatted) for display
  const formatDate = (value?: string) => {
    const v = (value || '').toString();
    if (!v) return '-';
    const t = Date.parse(v);
    if (Number.isNaN(t)) return v; // keep original if not ISO-parsable
    return new Date(t).toLocaleDateString();
  };

  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '', // decimal years as string, e.g., "32.0"
    gender: 'female' as 'male' | 'female' | 'other',
    phoneNumber: '',
    location: '',
    patientType: 'Referral' as 'Walk-in' | 'Repeat' | 'Referral',
    notes: ''
  });

  const filteredPatients = patients.filter(patient => {
    const searchValue = searchTerm.toLowerCase();
    switch (searchBy) {
      case 'name':
        return patient.fullName.toLowerCase().includes(searchValue);
      case 'number':
        return patient.patientNumber.toLowerCase().includes(searchValue);
      case 'phone':
        return patient.phoneNumber.includes(searchValue);
      default:
        return true;
    }
  });

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const generatePatientNumber = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CIT-${year}-${randomNum}`;
  };

  // Helper function to extract simple number from patient number
  const extractPatientNumber = (patientNumber: string): string => {
    if (patientNumber.includes('CIT-')) {
      return patientNumber.split('-').pop() || patientNumber;
    }
    return patientNumber;
  };

  // Age is computed as decimal in the payload; traditional age calc removed.

  const [adding, setAdding] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    phoneNumber: '',
    location: '',
    patientType: 'Walk-in' as 'Walk-in' | 'Repeat' | 'Referred',
    additionalInfo: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeletePatient, setConfirmDeletePatient] = useState<Patient | null>(null);

  // Keep URL in sync with Add form for better back-button UX
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hasAdd = qs.get('add') === '1' || qs.get('add') === 'true';
    if (showAddForm && !hasAdd) {
      // push ?add=1 so Back will close the form
      const url = new URL(window.location.href);
      url.searchParams.set('add', '1');
      window.history.pushState({}, '', url.toString());
    }
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      const stillHasAdd = q.get('add') === '1' || q.get('add') === 'true';
      if (!stillHasAdd) {
        setShowAddForm(false);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showAddForm]);

  const openEdit = (p: Patient) => {
    setEditingPatient(p);
    setEditForm({
      fullName: p.fullName,
      gender: p.gender,
      phoneNumber: p.phoneNumber,
      location: p.location,
      patientType: p.patientType,
      additionalInfo: p.additionalInfo || '',
    });
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    if (!editForm.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!editForm.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!editForm.location.trim()) {
      toast.error('Location is required');
      return;
    }
    const token = localStorage.getItem('token') || '';
    if (!token) {
      toast.error('You must be logged in to update a patient.');
      return;
    }
    setSavingEdit(true);
    try {
      const base = getApiBase();
      const body: any = {
        phone_no: editForm.phoneNumber,
        location: editForm.location,
        notes: editForm.additionalInfo || undefined,
      };
      const doFetch = (scheme: 'Bearer' | 'Token', withSlash: boolean) => fetch(`${base}/patients/edit-patient/${editingPatient.id}${withSlash ? '/' : ''}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${scheme} ${token}`,
        },
        body: JSON.stringify(body),
      });
      let res = await doFetch('Token', true);
      if (res.status === 401 || res.status === 403) res = await doFetch('Bearer', true);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data && (data.message || data.error || data.detail)) || `Failed to update patient (status ${res.status})`;
        throw new Error(msg);
      }
      // Map response patient
      const apiP = data?.Patient;
      if (apiP) {
        setPatients(prev => prev.map(p => p.id === String(apiP.id) || p.id === apiP.id ? mapApiPatientToDisplay(apiP) : p));
      } else {
        // Fallback to updating fields we edited
        setPatients(prev => prev.map(p => p.id === editingPatient.id ? {
          ...p,
          phoneNumber: editForm.phoneNumber,
          location: editForm.location,
          additionalInfo: editForm.additionalInfo || undefined,
        } : p));
      }
      toast.success(data?.message || 'Patient updated successfully');
      setEditingPatient(null);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update patient');
    } finally {
      setSavingEdit(false);
    }
  };

  const { user } = useAuth();

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientNumber = generatePatientNumber();

    // Validate required fields
    if (!newPatient.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!newPatient.gender) {
      toast.error('Gender is required');
      return;
    }
    if (!newPatient.age || isNaN(Number(newPatient.age))) {
      toast.error('Age (in years, e.g., 0.8) is required');
      return;
    }
    if (!newPatient.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!newPatient.location.trim()) {
      toast.error('Location is required');
      return;
    }
    if (!newPatient.patientType) {
      toast.error('Patient type is required');
      return;
    }

    // Map UI fields to backend payload
    const name = newPatient.name.trim();
    const mapType = (t: 'Walk-in' | 'Repeat' | 'Referral') => {
      switch (t) {
        case 'Walk-in': return 'walk-in';
        case 'Repeat': return 'repeat';
        case 'Referral': return 'referral';
      }
    };

    const payload: any = {
      name,
      uploader: Number(user?.id || 0) || undefined,
      patient_type: mapType(newPatient.patientType),
      gender: (newPatient.gender || '').toLowerCase(),
      age: (newPatient.age || '').toString(),
      phone_no: newPatient.phoneNumber,
      location: newPatient.location,
      notes: newPatient.notes || undefined,
    };

    const token = localStorage.getItem('token') || '';
    if (!token) {
      toast.error('You must be logged in to add a patient.');
      return;
    }
    setAdding(true);
    try {
      const base = getApiBase();
      const doFetch = (scheme: 'Bearer' | 'Token', withSlash: boolean) => fetch(`${base}/patients/add-patient${withSlash ? '/' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `${scheme} ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      // Try Token first (DRF style), then Bearer; also try with and without trailing slash
      let res = await doFetch('Token', false);
      if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405) {
        res = await doFetch('Token', true);
      }
      if (res.status === 401 || res.status === 403) {
        let retry = await doFetch('Bearer', false);
        if (retry.status === 401 || retry.status === 403 || retry.status === 404 || retry.status === 405) {
          retry = await doFetch('Bearer', true);
        }
        res = retry;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const baseMsg = (data && (data.message || data.error || data.detail)) || `Failed to add patient (status ${res.status})`;
        const msg = (res.status === 401 || res.status === 403)
          ? `${baseMsg}. Please ensure you are logged in and have permission to add patients.`
          : baseMsg;
        throw new Error(msg);
      }

      toast.success(data?.message || 'Patient added successfully');

      // Append to local list for immediate feedback (best-effort mapping)
      const createdTs = (data?.Patient?.date_created || data?.Patient?.created_at || (data as any)?.timestamp || '') as string;
      const backendId = data?.Patient?.id;
      const backendClientCode = (data as any)?.Patient?.patient_number as string | undefined;
      const computedClientCode = backendClientCode
        ? (backendClientCode.includes('CIT-') ? backendClientCode.split('-').pop() || backendClientCode : backendClientCode)
        : (backendId != null ? String(backendId).padStart(3, '0') : extractPatientNumber(patientNumber));
      const display: Patient = {
        id: String(data?.Patient?.id || Date.now()),
        patientNumber: computedClientCode,
        fullName: (data?.Patient?.name || `${data?.Patient?.first_name ?? ''} ${data?.Patient?.last_name ?? ''}`.trim() || name),
        age: typeof data?.Patient?.age === 'string'
          ? Number(data.Patient.age)
          : (typeof data?.Patient?.age === 'number' ? data.Patient.age : (Number(newPatient.age) || 0)),
        gender: (newPatient.gender as any),
        phoneNumber: data?.Patient?.phone_no ?? newPatient.phoneNumber,
        location: data?.Patient?.location ?? newPatient.location,
        patientType: (() => {
          const pt = data?.Patient?.patient_type ?? mapType(newPatient.patientType);
          if (pt === 'referral') return 'Referred';
          if (pt === 'repeat') return 'Repeat';
          return 'Walk-in';
        })(),
        registrationDate: createdTs ? new Date(createdTs).toLocaleDateString() : new Date().toLocaleDateString(),
        additionalInfo: (data?.Patient?.notes ?? newPatient.notes) || undefined,
      } as Patient;
      setPatients(prev => [display, ...prev]);

      // Reset form
      setNewPatient({
        name: '',
        age: '',
        gender: 'female',
        phoneNumber: '',
        location: '',
        patientType: 'Referral',
        notes: ''
      });
      setShowAddForm(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  // Helpers
  const mapApiPatientToDisplay = (apiP: any): Patient => {
    const pt = apiP?.patient_type;
    let patientType: Patient['patientType'] = 'Walk-in';
    if (pt === 'referral') patientType = 'Referred';
    else if (pt === 'repeat') patientType = 'Repeat';
    // Prefer backend-provided patient_number when available
    const fullPatientNumber = ((): string => {
      const backend = apiP?.patient_number as string | undefined;
      if (backend && typeof backend === 'string' && backend.trim()) return backend.trim();
      return `CIT-${new Date().getFullYear()}-${String(apiP?.id ?? '').padStart(3, '0')}`;
    })();
    const createdTs = (
      apiP?.created_at || apiP?.date_created || apiP?.createdAt || apiP?.timestamp ||
      apiP?.created || apiP?.date || apiP?.dateRegistered || apiP?.date_registered ||
      apiP?.registered_at || apiP?.registeredAt || ''
    );
    // Robust fallbacks for name and phone
    const emailLocal = (() => {
      const e = (apiP?.email || '').toString();
      return e.includes('@') ? e.split('@')[0] : '';
    })();
    const fullName = (
      apiP?.name || apiP?.full_name || apiP?.fullName ||
      `${apiP?.first_name ?? ''} ${apiP?.last_name ?? ''}`.trim() ||
      emailLocal || `Patient #${apiP?.id ?? ''}`
    ).toString();
    const phone = (apiP?.phone_no ?? apiP?.phone ?? apiP?.phoneNumber ?? '').toString();
    return {
      id: String(apiP?.id ?? ''),
      patientNumber: extractPatientNumber(fullPatientNumber),
      fullName,
      age: typeof apiP?.age === 'string' ? Number(apiP.age) : (apiP?.age ?? 0),
      gender: (apiP?.gender as any) ?? 'Other',
      phoneNumber: phone,
      location: apiP?.location ?? '',
      patientType,
      // Keep raw timestamp string; format at render time to avoid Invalid Date
      registrationDate: createdTs ? String(createdTs) : '',
      additionalInfo: apiP?.notes ?? undefined,
    };
  };

  const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getToken();
    const withAuth = (scheme: 'Token' | 'Bearer') => fetch(input, {
      ...(init || {}),
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `${scheme} ${token}` } : {}),
      } as any,
    });
    let res = await withAuth('Token');
    if (res.status === 401 || res.status === 403) {
      res = await withAuth('Bearer');
      if (res.status === 401 || res.status === 403) {
        // Force re-login when unauthorized
        redirectToLogin('Session expired or not authenticated. Please log in.');
      }
    }
    return res;
  };

  // Load patients on mount and optionally open Add form via ?add=1, with cache hydration
  useEffect(() => {
    (async () => {
      if (!cacheLoaded) return;
      // Require auth before attempting to load
      if (!getToken()) {
        redirectToLogin('Please log in to view patients.');
        return;
      }
      setLoading(true);
      try {
        // Open Add Patient form if requested via query param
        const qs = new URLSearchParams(window.location.search);
        const shouldOpenAdd = qs.get('add');
        if (shouldOpenAdd === '1' || shouldOpenAdd === 'true') {
          setShowAddForm(true);
        }

        // Hydrate from cache
        if (Array.isArray(cachedPatients) && cachedPatients.length > 0) {
          setPatients(cachedPatients.map(mapApiPatientToDisplay));
          setPage(1);
          return;
        }

        // Fallback: fetch
        const base = getApiBase();
        let res = await authFetch(`${base}/patients/all-patients`);
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/all-patients/`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || `Failed to load patients (status ${res.status})`);
        const rows: any[] = Array.isArray(data?.Patients) ? data.Patients : [];
        const mapped = rows.map(mapApiPatientToDisplay);
        setPatients(mapped);
        // Push to cache as CachedPatient[]
        try {
          setCachedPatients(mapped.map(p => ({
            id: p.id,
            fullName: p.fullName,
            phone: p.phoneNumber,
            patientNumber: p.patientNumber,
            type: p.patientType as any,
            age: p.age,
            gender: p.gender as any,
            location: p.location,
            registeredAt: p.registrationDate,
          })) as any);
        } catch {}
        setPage(1);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [cacheLoaded]);

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, searchBy]);

  // Load detail when opening details modal (refresh data)
  const openDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setLoadingDetail(true);
    try {
      const base = getApiBase();
      let res = await authFetch(`${base}/patients/patient-detail/${patient.id}/`);
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/patient-detail/${patient.id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.Patient) {
        setSelectedPatient(mapApiPatientToDisplay(data.Patient));
      }
    } catch {}
    finally { setLoadingDetail(false); }
  };

  const openDeleteConfirm = async (patient: Patient) => {
    // Prevent deleting a patient that already has visits
    try {
      const base = getApiBase();
      // Use all-visits endpoint and filter client-side by patient id (robust to backend variants)
      let res = await authFetch(`${base}/visits/all-visits`);
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/all-visits/`);
      const data = await res.json().catch(() => ({}));
      const arr: any[] = Array.isArray(data?.visits) ? data.visits : (Array.isArray(data?.data) ? data.data : []);
      const anyVisit = arr.some(v => String(v?.patient) === String(patient.id));
      if (anyVisit) {
        toast.error('Cannot delete patient: visits exist for this patient.');
        return;
      }
    } catch (_) {
      // If we cannot verify safely, err on the side of caution and block deletion
      toast.error('Cannot verify visits for this patient right now. Deletion blocked.');
      return;
    }
    setConfirmDeletePatient(patient);
  };

  const performDelete = async () => {
    const patient = confirmDeletePatient;
    if (!patient) return;
    const token = localStorage.getItem('token') || '';
    if (!token) { toast.error('You must be logged in to delete a patient.'); return; }
    try {
      const base = getApiBase();
      const doFetch = (withSlash: boolean) => fetch(`${base}/patients/delete-patient/${patient.id}${withSlash ? '/' : ''}`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      });
      let res = await doFetch(true);
      if (res.status === 401 || res.status === 403) {
        res = await fetch(`${base}/patients/delete-patient/${patient.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      }
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        const msg = (data && (data.message || data.error || data.detail)) || `Failed to delete patient (status ${res.status})`;
        throw new Error(msg);
      }
      setPatients(prev => prev.filter(p => p.id !== patient.id));
      toast.success('Patient deleted successfully');
      setConfirmDeletePatient(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hero Banner (hidden when adding a patient) */}
      {!showAddForm && (
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
                <h2 className="text-2xl md:text-3xl font-bold">Patient Management</h2>
                <p className="mt-2 text-sm md:text-base text-blue-100">
                  Manage patient records, search, and registration
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  <span>Add Patient</span>
                </button>
              </div>
            </div>
          </div>
          <div
            className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60"
          />
        </div>
      )}

      {/* Search Section */}
      {!showAddForm && (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Search Patients</h3>
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search by ${searchBy}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setSearchBy('name')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchBy === 'name' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSearchBy('number')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchBy === 'number' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Patient #
            </button>
            <button
              onClick={() => setSearchBy('phone')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchBy === 'phone' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Phone
            </button>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const counts = filteredPatients.reduce((acc, p) => {
                acc[p.patientType] = (acc[p.patientType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              return (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Walk-in: {counts['Walk-in'] || 0}</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Repeat: {counts['Repeat'] || 0}</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Referred: {counts['Referred'] || 0}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      )}

      {/* Add Patient - In-Page Full Width Section */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          {/* Sticky sub-header within content area so main layout remains visible */}
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">Add New Patient</h3>
              <button
                onClick={() => { setShowAddForm(false); if (window.history.length > 1) window.history.back(); }}
                className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
              >
                Back
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 md:px-6">
            <form onSubmit={handleAddPatient} className="space-y-4 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age (years, decimal) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 0.8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({...newPatient, gender: e.target.value as 'male' | 'female' | 'other'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={newPatient.phoneNumber}
                    onChange={(e) => setNewPatient({...newPatient, phoneNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 254712345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location/Address *</label>
                  <input
                    type="text"
                    required
                    value={newPatient.location}
                    onChange={(e) => setNewPatient({...newPatient, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Phase 4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Type *</label>
                  <select
                    value={newPatient.patientType}
                    onChange={(e) => setNewPatient({...newPatient, patientType: e.target.value as 'Walk-in' | 'Repeat' | 'Referral'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Referral">Referral</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Repeat">Repeat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newPatient.notes}
                  onChange={(e) => setNewPatient({...newPatient, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Allergies, medical history, etc."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className={`px-4 py-2 rounded-lg text-white transition-colors ${adding ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {adding ? 'Adding…' : 'Add Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeletePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDeletePatient(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900">Delete patient?</h3>
              <p className="mt-2 text-sm text-gray-700">This action cannot be undone. Are you sure you want to delete <span className="font-medium">{confirmDeletePatient.fullName}</span>?</p>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => setConfirmDeletePatient(null)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Cancel</button>
              <button onClick={performDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingPatient(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Edit Patient</h3>
                <button onClick={() => setEditingPatient(null)} className="bg-green-600 hover:bg-green-700 text-white w-8 h-8 rounded flex items-center justify-center" aria-label="Close">
                  ✕
                </button>
              </div>
              <form onSubmit={handleUpdatePatient} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                  <input value={editForm.fullName} onChange={e=>setEditForm({...editForm, fullName:e.target.value})} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Gender *</label>
                  <select value={editForm.gender} onChange={e=>setEditForm({...editForm, gender: e.target.value as any})} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Phone *</label>
                  <input value={editForm.phoneNumber} onChange={e=>setEditForm({...editForm, phoneNumber:e.target.value})} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Location *</label>
                  <input value={editForm.location} onChange={e=>setEditForm({...editForm, location:e.target.value})} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Patient Type *</label>
                  <select value={editForm.patientType} onChange={e=>setEditForm({...editForm, patientType: e.target.value as any})} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500">
                    <option value="Walk-in">Walk-in</option>
                    <option value="Repeat">Repeat</option>
                    <option value="Referred">Referred</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Additional Info</label>
                  <textarea value={editForm.additionalInfo} onChange={e=>setEditForm({...editForm, additionalInfo: e.target.value})} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setEditingPatient(null)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Cancel</button>
                  <button type="submit" disabled={savingEdit} className={`px-4 py-2 rounded-md text-white ${savingEdit ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Patients List */}
      {!showAddForm && (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Patients {loading ? '' : `(${filteredPatients.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading patients…</div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">🔎</div>
              <p>No patients found{searchTerm ? ' for your search.' : '.'}</p>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="mt-2 px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100">Clear search</button>
              )}
            </div>
          ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{patient.patientNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{patient.fullName}</div>
                        <div className="text-xs text-gray-400">{patient.age} years, {patient.gender}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                      {patient.phoneNumber}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center mt-1">
                      <MapPinIcon className="h-4 w-4 text-gray-400 mr-2" />
                      {patient.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      patient.patientType === 'Walk-in' 
                        ? 'bg-green-100 text-green-800'
                        : patient.patientType === 'Repeat'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {patient.patientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400 mr-2" />
                    {formatDate(patient.registrationDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/dashboard/admin/patients/${patient.id}`)}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md"
                        title="View details"
                      >
                        <EyeIcon className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={() => openEdit(patient)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md"
                        title="Edit patient"
                      >
                        <PencilIcon className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(patient)}
                        className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md"
                        title="Delete patient"
                      >
                        <TrashIcon className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 rounded-md text-sm ${p === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Patient Details Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedPatient(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Patient Details</h3>
                <button onClick={() => setSelectedPatient(null)} className="bg-green-600 hover:bg-green-700 text-white w-8 h-8 rounded flex items-center justify-center" aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Patient ID</p>
                  <p className="font-medium text-gray-900 font-mono">{selectedPatient.patientNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Full Name</p>
                  <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Age</p>
                  <p className="font-medium text-gray-900">{selectedPatient.age}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="font-medium text-gray-900">{selectedPatient.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{selectedPatient.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{selectedPatient.location}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium text-gray-900">{selectedPatient.patientType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Registered</p>
                  <p className="font-medium text-gray-900">{selectedPatient.registrationDate}</p>
                </div>
                {loadingDetail ? (
                  <div className="md:col-span-2 text-sm text-gray-500">Refreshing details…</div>
                ) : selectedPatient.additionalInfo && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500">Additional Info</p>
                    <p className="font-medium text-gray-900 whitespace-pre-wrap">{selectedPatient.additionalInfo}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end">
              <button onClick={() => setSelectedPatient(null)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;
