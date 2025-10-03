import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Lightweight global cache to avoid refetching on every tab navigation
// It preloads common datasets once after a user session is available

export type CachedPatient = {
  id: string;
  fullName: string;
  phone?: string;
  patientNumber?: string;
  type?: string;
  age?: number;
  gender?: string;
  location?: string;
  registeredAt?: string;
};

export type CachedVisit = any; // pages map to their own display types; store raw-ish objects
export type CachedPharmacyItem = any;
export type CachedSale = any;
export type CachedConsignment = any;

export type DataCache = {
  // data
  patients: CachedPatient[];
  visits: CachedVisit[];
  pharmacyItems: CachedPharmacyItem[];
  sales: CachedSale[];
  consignments: CachedConsignment[];
  loaded: boolean; // true when initial preload finished (success or fail)
  // actions
  refreshAll: () => Promise<void>;
  setPatients: React.Dispatch<React.SetStateAction<CachedPatient[]>>;
  setVisits: React.Dispatch<React.SetStateAction<CachedVisit[]>>;
  setPharmacyItems: React.Dispatch<React.SetStateAction<CachedPharmacyItem[]>>;
  setSales: React.Dispatch<React.SetStateAction<CachedSale[]>>;
  setConsignments: React.Dispatch<React.SetStateAction<CachedConsignment[]>>;
};

const DataCacheContext = createContext<DataCache | undefined>(undefined);

const getApiBase = () => {
  const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
  if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return import.meta.env.DEV ? '/api' : 'https://citimed-api.vercel.app';
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

export const DataCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<CachedPatient[]>([]);
  const [visits, setVisits] = useState<CachedVisit[]>([]);
  const [pharmacyItems, setPharmacyItems] = useState<CachedPharmacyItem[]>([]);
  const [sales, setSales] = useState<CachedSale[]>([]);
  const [consignments, setConsignments] = useState<CachedConsignment[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Quick hydrate from localStorage so pages have immediate data on refresh
  useEffect(() => {
    try {
      const p = localStorage.getItem('patients_cache');
      if (p) {
        const arr = JSON.parse(p);
        if (Array.isArray(arr)) setPatients(arr);
      }
    } catch {}
    try {
      const v = localStorage.getItem('visits_cache_raw');
      if (v) {
        const arr = JSON.parse(v);
        if (Array.isArray(arr)) setVisits(arr);
      }
    } catch {}
    try {
      const ph = localStorage.getItem('pharmacy_cache');
      if (ph) {
        const arr = JSON.parse(ph);
        if (Array.isArray(arr)) setPharmacyItems(arr);
      }
    } catch {}
    try {
      const s = localStorage.getItem('sales_cache');
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) setSales(arr);
      }
    } catch {}
    try {
      const c = localStorage.getItem('consignments_cache');
      if (c) {
        const arr = JSON.parse(c);
        if (Array.isArray(arr)) setConsignments(arr);
      }
    } catch {}
  }, []);

  const preload = async () => {
    const base = getApiBase();
    const token = localStorage.getItem('token');
    if (!token) { setLoaded(true); return; }
    try {
      const tasks: Array<Promise<void>> = [];

      // Patients
      tasks.push((async () => {
        try {
          let res = await authFetch(`${base}/patients/all-patients`);
          if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/all-patients/`);
          const data = await res.json().catch(() => ({} as any));
          const rows: any[] = Array.isArray((data as any)?.Patients) ? (data as any).Patients : [];
          const mapped = rows.map((p: any) => {
            const idStr = String(p?.id ?? '');
            const first = p?.first_name ?? p?.firstName ?? '';
            const last = p?.last_name ?? p?.lastName ?? '';
            const nameFromPair = `${first} ${last}`.trim();
            const nameSingle = p?.name ?? p?.full_name ?? p?.fullName ?? '';
            const fallback = nameFromPair || nameSingle || (p?.email ? String(p.email).split('@')[0] : '') || `Patient #${p?.id ?? ''}`;
            const phone = p?.phone_no ?? p?.phone ?? p?.phoneNumber ?? '';
            const fullPatNum = p?.patient_number ?? p?.patientNumber ?? (p?.id ? `CIT-${new Date().getFullYear()}-${String(p.id).padStart(3,'0')}` : undefined);
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
            } as CachedPatient;
          });
          setPatients(mapped);
          try { localStorage.setItem('patients_cache', JSON.stringify(mapped)); } catch {}
        } catch {}
      })());

      // Visits
      tasks.push((async () => {
        try {
          let res = await authFetch(`${base}/visits/all-visits`, { method: 'GET' });
          if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/visits/all-visits/`, { method: 'GET' });
          const data = await res.json().catch(() => ({} as any));
          const arr: any[] = Array.isArray((data as any)?.visits) ? (data as any).visits : (Array.isArray((data as any)?.data) ? (data as any).data : []);
          setVisits(arr);
          try { localStorage.setItem('visits_cache_raw', JSON.stringify(arr)); } catch {}
        } catch {}
      })());

      // Pharmacy items
      tasks.push((async () => {
        try {
          const res = await authFetch(`${base}/pharmacy/all-items`, { method: 'GET' });
          const data = await res.json().catch(() => ({} as any));
          const items = (data && (data.items || data.data || [])) as any[];
          setPharmacyItems(items);
          try { localStorage.setItem('pharmacy_cache', JSON.stringify(items)); } catch {}
        } catch {}
      })());

      // Pharmacy sales
      tasks.push((async () => {
        try {
          let res = await authFetch(`${base}/pharmacy/all-sales`, { method: 'GET' });
          if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/all-sales/`, { method: 'GET' });
          const data = await res.json().catch(() => ({} as any));
          const arr = (data && (data.items || data.data || [])) as any[];
          setSales(arr);
          try { localStorage.setItem('sales_cache', JSON.stringify(arr)); } catch {}
        } catch {}
      })());

      // Consignments
      tasks.push((async () => {
        try {
          const urls = [
            `${base}/pharmacy/consignments`,
            `${base}/pharmacy/consignments/`,
          ];
          for (const u of urls) {
            try {
              const res = await authFetch(u, { method: 'GET' });
              const data = await res.json().catch(() => ({} as any));
              const arr: any[] = Array.isArray((data as any)?.inventories) ? (data as any).inventories : [];
              if (res.ok) { setConsignments(arr); try { localStorage.setItem('consignments_cache', JSON.stringify(arr)); } catch {} break; }
            } catch {}
          }
        } catch {}
      })());

      await Promise.allSettled(tasks);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { preload(); }, []);

  // Also preload immediately after a successful login/signup/verify event
  useEffect(() => {
    const onLogin = () => { refreshAll().catch(() => {}); };
    window.addEventListener('citimed-login', onLogin);
    return () => window.removeEventListener('citimed-login', onLogin);
  }, []);

  const refreshAll = async () => {
    setLoaded(false);
    await preload();
  };

  const value = useMemo<DataCache>(() => ({
    patients,
    visits,
    pharmacyItems,
    sales,
    consignments,
    loaded,
    refreshAll,
    setPatients,
    setVisits,
    setPharmacyItems,
    setSales,
    setConsignments,
  }), [patients, visits, pharmacyItems, sales, consignments, loaded]);

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider');
  return ctx;
};
