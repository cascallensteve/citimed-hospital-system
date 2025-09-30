import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { type PharmacySale, type ConsignmentInventory } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDataCache } from '../../context/DataCacheContext';

// Simple inline calendar grid for picking a date (YYYY-MM-DD)
function CalendarGrid(props: {
  year: number;
  month: number; // 0-11
  from: string;
  to: string;
  onPick: (date: string) => void;
}) {
  const { year, month, from, to, onPick } = props;
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const firstWeekDay = start.getDay(); // 0=Sun
  const daysInMonth = end.getDate();
  const cells: Array<{ date: Date | null }> = [];
  for (let i = 0; i < firstWeekDay; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const inRange = (iso: string) => {
    if (from && to) return iso >= from && iso <= to;
    if (from && !to) return iso === from;
    return false;
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          const label = c.date ? c.date.getDate() : '';
          const iso = c.date ? fmt(c.date) : '';
          const isActive = c.date ? inRange(iso) : false;
          const isToday = c.date ? fmt(new Date()) === iso : false;
          return (
            <button
              key={idx}
              type="button"
              disabled={!c.date}
              onClick={() => iso && onPick(iso)}
              className={
                `h-8 rounded-md text-sm ` +
                (c.date
                  ? (isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200')
                  : 'opacity-0 cursor-default')
              }
              title={iso}
            >
              <span className={isToday && !isActive ? 'underline' : ''}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Reports = () => {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [summary, setSummary] = useState<{ revenue?: number; visits_today?: number; patients_total?: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);

  // Tabbed, paginated data viewers
  type TabKey = 'visits' | 'sales' | 'consignments' | 'balances';
  const [tab, setTab] = useState<TabKey>('visits');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  // Caching flags: avoid reloading a tab if already loaded for the current date range
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<TabKey, boolean>>>({});
  const [lastRangeByTab, setLastRangeByTab] = useState<Partial<Record<TabKey, string>>>({});

  // Datasets
  const [visits, setVisits] = useState<any[]>([]);
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [consignments, setConsignments] = useState<ConsignmentInventory[]>([]);
  const [balanceVisits, setBalanceVisits] = useState<any[]>([]);
  const [totalPendingBalance, setTotalPendingBalance] = useState<number>(0);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const { user } = useAuth();
  const { visits: cachedVisits, sales: cachedSales, consignments: cachedConsignments, patients: cachedPatients, pharmacyItems: cachedItems, loaded: cacheLoaded } = useDataCache();

  // Permission guard: Outdoor Admins should not access Reports
  const perm = (user as any)?.permission as 'out-door-patient' | 'over-the-counter' | undefined;
  if (user?.role === 'admin' && perm === 'out-door-patient') {
    return <Navigate to="/dashboard/admin" replace />;
  }

  // Patient name resolution for visits table
  const [patientsMap, setPatientsMap] = useState<Record<number, string>>({});
  // Pharmacy item name resolution for sales table
  const [itemsMap, setItemsMap] = useState<Record<number, string>>({});

  // Hydrate maps from cache when available (faster initial load)
  useEffect(() => {
    if (!cacheLoaded) return;
    if (Object.keys(patientsMap).length === 0 && Array.isArray(cachedPatients) && cachedPatients.length > 0) {
      const map: Record<number, string> = {};
      cachedPatients.forEach(p => { const id = Number(p.id); if (id && p.fullName) map[id] = p.fullName; });
      setPatientsMap(map);
    }
    if (Object.keys(itemsMap).length === 0 && Array.isArray(cachedItems) && cachedItems.length > 0) {
      const map: Record<number, string> = {};
      (cachedItems as any[]).forEach((it: any) => { const id = Number(it?.id); const name = it?.name || ''; if (id && name) map[id] = name; });
      setItemsMap(map);
    }
  }, [cacheLoaded]);

  // Minimal auth fetch (tries Bearer then Token)
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
    let res = await doFetch('Bearer');
    if (!res.ok) {
      const fallback = await doFetch('Token');
      if (fallback.ok) return fallback;
      return res;
    }
    return res;
  };

  const hasRange = useMemo(() => Boolean(from || to), [from, to]);

  // Finance endpoints (corrected): use authFetch directly
  const financeConsignmentsByDay = async ({ date }: { date: string }) => {
    const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
    const res = await authFetch(`${base}/finances/consignments-by-day`, { method: 'POST', body: JSON.stringify({ date }) });
    const data = await res.json().catch(() => ({}));
    const consignments = Array.isArray((data as any)?.consignments) ? (data as any).consignments : [];
    return { consignments } as { consignments: any[] };
  };
  const financeConsignmentsByDate = async ({ start_date, end_date }: { start_date: string; end_date: string }) => {
    const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
    const res = await authFetch(`${base}/finances/consignments-by-date`, { method: 'POST', body: JSON.stringify({ start_date, end_date }) });
    const data = await res.json().catch(() => ({}));
    const consignments = Array.isArray((data as any)?.consignments) ? (data as any).consignments : [];
    return { consignments } as { consignments: any[] };
  };

  // Helper: robustly fetch all consignments (tries URL with and without trailing slash, and both auth schemes)
  const fetchAllConsignments = async (): Promise<ConsignmentInventory[]> => {
    const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
    const urls = [
      `${base}/pharmacy/consignments`,
      `${base}/pharmacy/consignments/`,
    ];
    for (const u of urls) {
      try {
        let res = await authFetch(u, { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.inventories)) return data.inventories as ConsignmentInventory[];
      } catch { /* try next */ }
    }
    return [] as ConsignmentInventory[];
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Compute revenue using available endpoints
        let revenue = 0;
        if (hasRange && from && to) {
          const { total_sum } = await api.finance.pharmacySalesByDate({ start_date: from, end_date: to });
          revenue = Number(total_sum || 0);
        } else if (user?.role === 'superadmin') {
          const { total_sum } = await api.finance.allPharmacySales();
          revenue = Number(total_sum || 0);
        } else {
          // Fallback for admins: use pharmacy all-sales and sum client-side
          const { items } = await api.pharmacy.allSales();
          const arr = Array.isArray(items) ? items : [];
          revenue = arr.reduce((sum: number, s: any) => sum + Number(s?.total_amount || 0), 0);
        }

        if (!cancelled) setSummary({ revenue, visits_today: 0, patients_total: 0 });
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [from, to, hasRange, user?.role]);

  // Load all patients once to resolve patient names in tables
  useEffect(() => {
    (async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        let res = await authFetch(`${base}/patients/all-patients`);
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/patients/all-patients/`);
        const data = await res.json().catch(() => ({}));
        const rows: any[] = Array.isArray(data?.Patients) ? data.Patients : [];
        const map: Record<number, string> = {};
        rows.forEach(p => {
          const id = Number(p?.id);
          const firstLast = `${p?.first_name ?? p?.firstName ?? ''} ${p?.last_name ?? p?.lastName ?? ''}`.trim();
          const fallback = (p?.name || p?.full_name || p?.fullName || '').toString().trim();
          const name = firstLast || fallback;
          if (id && name) map[id] = name;
        });
        setPatientsMap(map);
      } catch (_) {
        // non-fatal; table will fall back to Patient #ID
      }
    })();
  }, []);

  // Load all pharmacy items once to resolve item names in sales table
  useEffect(() => {
    (async () => {
      try {
        const { items } = await api.pharmacy.allItems();
        const map: Record<number, string> = {};
        (Array.isArray(items) ? items : []).forEach((it: any) => {
          const id = Number(it?.id);
          const name = it?.name ?? '';
          if (id && name) map[id] = name;
        });
        setItemsMap(map);
      } catch (_) {
        // non-fatal; sales table will omit item names if not resolvable
      }
    })();
  }, []);

  // Load data for the active tab (uses existing endpoints; client-side pagination)
  useEffect(() => {
    let cancelled = false;
    const loadTabData = async () => {
      const rangeKey = `${from || ''}|${to || ''}`;
      // If this tab is already loaded for the current range, skip fetching
      if (loadedTabs[tab] && lastRangeByTab[tab] === rangeKey) {
        setTableLoading(false);
        return;
      }
      setTableLoading(true);
      setError('');
      try {
        // For no range: hydrate from global cache to avoid network
        if (!hasRange && cacheLoaded) {
          if (tab === 'visits' && Array.isArray(cachedVisits) && cachedVisits.length > 0) {
            if (!cancelled) {
              setVisits(cachedVisits);
              setLoadedTabs(prev => ({ ...prev, [tab]: true }));
              setLastRangeByTab(prev => ({ ...prev, [tab]: rangeKey }));
              setPage(1);
              setTableLoading(false);
              return;
            }
          }
          if (tab === 'sales' && Array.isArray(cachedSales) && cachedSales.length > 0) {
            if (!cancelled) {
              setSales(cachedSales as any);
              setLoadedTabs(prev => ({ ...prev, [tab]: true }));
              setLastRangeByTab(prev => ({ ...prev, [tab]: rangeKey }));
              setPage(1);
              setTableLoading(false);
              return;
            }
          }
          if (tab === 'consignments' && Array.isArray(cachedConsignments) && cachedConsignments.length > 0) {
            if (!cancelled) {
              setConsignments(cachedConsignments as any);
              setLoadedTabs(prev => ({ ...prev, [tab]: true }));
              setLastRangeByTab(prev => ({ ...prev, [tab]: rangeKey }));
              setPage(1);
              setTableLoading(false);
              return;
            }
          }
        }
        if (tab === 'visits') {
          const { visits } = await api.visits.all();
          const arr = Array.isArray(visits) ? visits : [];
          if (!cancelled) setVisits(arr);
        } else if (tab === 'sales') {
          // When a date range is provided, prefer date-range endpoint (admin or superadmin)
          if (hasRange && from && to) {
            if (from === to) {
              // Single day selection -> use by-day endpoint
              const { sales } = await api.finance.pharmacySalesByDay({ date: from });
              const arr = Array.isArray(sales) ? sales : [];
              if (!cancelled) setSales(arr as any);
            } else {
              const { sales } = await api.finance.pharmacySalesByDate({ start_date: from, end_date: to });
              const arr = Array.isArray(sales) ? sales : [];
              if (!cancelled) setSales(arr as any);
            }
          } else {
            // Without a range, superadmins can view all sales via finance endpoint.
            // Admins should use pharmacy all-sales endpoint instead (permissioned for admins).
            if (user?.role === 'superadmin') {
              const { sales } = await api.finance.allPharmacySales();
              const arr = Array.isArray(sales) ? sales : [];
              if (!cancelled) setSales(arr);
            } else {
              const { items } = await api.pharmacy.allSales();
              const arr = Array.isArray(items) ? items : [];
              if (!cancelled) setSales(arr as any);
            }
          }
        } else if (tab === 'consignments') {
          if (hasRange && from && to) {
            if (user?.role === 'superadmin') {
              // Superadmins: use finance day or date-range for consignments
              let arr: any[] = [];
              if (from === to) {
                const { consignments } = await financeConsignmentsByDay({ date: from });
                arr = Array.isArray(consignments) ? consignments : [];
              } else {
                const { consignments } = await financeConsignmentsByDate({ start_date: from, end_date: to });
                arr = Array.isArray(consignments) ? consignments : [];
              }
              // Fallback to pharmacy all-consignments if empty
              if (arr.length === 0) {
                const allArr = await fetchAllConsignments();
                arr = allArr.filter((c: any) => inRange(c?.timestamp || c?.purchase_date));
              }
              if (!cancelled) setConsignments(arr as any);
            } else {
              // Admins: always use pharmacy all-consignments and filter client-side by date range
              const allArr = await fetchAllConsignments();
              const filtered = allArr.filter((c: any) => inRange(c?.timestamp || c?.purchase_date));
              if (!cancelled) setConsignments(filtered as any);
            }
          } else {
            // No range -> show all consignments from pharmacy for everyone
            const arr = await fetchAllConsignments();
            if (!cancelled) setConsignments(arr);
          }
        } else if (tab === 'balances') {
          // Fetch all balances; endpoint returns total_pending_balance and a list of visits with balances
          const { total_pending_balance, visits } = await api.finance.visitsBalances();
          const arr = Array.isArray(visits) ? visits : [];
          if (!cancelled) {
            setBalanceVisits(arr);
            setTotalPendingBalance(Number(total_pending_balance || 0));
          }
        }
        // Mark this tab as loaded for the current range
        if (!cancelled) {
          setLoadedTabs(prev => ({ ...prev, [tab]: true }));
          setLastRangeByTab(prev => ({ ...prev, [tab]: rangeKey }));
          // Reset to first page whenever data loads (first time for a range)
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load data');
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    };
    loadTabData();
    // Eagerly prefetch other tabs for this range in background (no spinner)
    const prefetch = async () => {
      const rangeKey = `${from || ''}|${to || ''}`;
      const others: TabKey[] = (['visits','sales','consignments','balances'] as TabKey[]).filter(t => t !== tab);
      const tasks = others
        .filter(t => !(loadedTabs[t] && lastRangeByTab[t] === rangeKey))
        .map((t) => (async () => {
          // Use cache when no range
          if (!hasRange && cacheLoaded) {
            if (t === 'visits' && Array.isArray(cachedVisits) && cachedVisits.length > 0) {
              if (!cancelled) { setVisits(cachedVisits); setLoadedTabs(prev => ({ ...prev, [t]: true })); setLastRangeByTab(prev => ({ ...prev, [t]: rangeKey })); }
              return;
            }
            if (t === 'sales' && Array.isArray(cachedSales) && cachedSales.length > 0) {
              if (!cancelled) { setSales(cachedSales as any); setLoadedTabs(prev => ({ ...prev, [t]: true })); setLastRangeByTab(prev => ({ ...prev, [t]: rangeKey })); }
              return;
            }
            if (t === 'consignments' && Array.isArray(cachedConsignments) && cachedConsignments.length > 0) {
              if (!cancelled) { setConsignments(cachedConsignments as any); setLoadedTabs(prev => ({ ...prev, [t]: true })); setLastRangeByTab(prev => ({ ...prev, [t]: rangeKey })); }
              return;
            }
          }
          if (t === 'visits') {
            const { visits } = await api.visits.all();
            const arr = Array.isArray(visits) ? visits : [];
            if (!cancelled) setVisits(arr);
          } else if (t === 'sales') {
            if (hasRange && from && to) {
              if (from === to) {
                const { sales } = await api.finance.pharmacySalesByDay({ date: from });
                const arr = Array.isArray(sales) ? sales : [];
                if (!cancelled) setSales(arr as any);
              } else {
                const { sales } = await api.finance.pharmacySalesByDate({ start_date: from, end_date: to });
                const arr = Array.isArray(sales) ? sales : [];
                if (!cancelled) setSales(arr as any);
              }
            } else {
              if (user?.role === 'superadmin') {
                const { sales } = await api.finance.allPharmacySales();
                const arr = Array.isArray(sales) ? sales : [];
                if (!cancelled) setSales(arr);
              } else {
                const { items } = await api.pharmacy.allSales();
                const arr = Array.isArray(items) ? items : [];
                if (!cancelled) setSales(arr as any);
              }
            }
          } else if (t === 'consignments') {
            const loadAllCons = async () => {
              const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
              const urls = [`${base}/pharmacy/consignments`, `${base}/pharmacy/consignments/`];
              for (const u of urls) { try { let res = await authFetch(u, { method: 'GET' }); const data = await res.json().catch(()=>({})); if (res.ok && Array.isArray(data?.inventories)) return data.inventories as any[]; } catch {} }
              return [] as any[];
            };
            if (hasRange && from && to) {
              if (user?.role === 'superadmin') {
                let arr: any[] = [];
                if (from === to) {
                  const { consignments } = await financeConsignmentsByDay({ date: from });
                  arr = Array.isArray(consignments) ? consignments : [];
                } else {
                  const { consignments } = await financeConsignmentsByDate({ start_date: from, end_date: to });
                  arr = Array.isArray(consignments) ? consignments : [];
                }
                if (arr.length === 0) {
                  const allArr = await loadAllCons();
                  arr = allArr.filter((c: any) => inRange(c?.timestamp || c?.purchase_date));
                }
                if (!cancelled) setConsignments(arr as any);
              } else {
                const baseArr = await loadAllCons();
                const filtered = baseArr.filter((c: any) => inRange(c?.timestamp || c?.purchase_date));
                if (!cancelled) setConsignments(filtered as any);
              }
            } else {
              const arr = await loadAllCons();
              if (!cancelled) setConsignments(arr as any);
            }
          } else if (t === 'balances') {
            const { total_pending_balance, visits } = await api.finance.visitsBalances();
            const arr = Array.isArray(visits) ? visits : [];
            if (!cancelled) {
              setBalanceVisits(arr);
              setTotalPendingBalance(Number(total_pending_balance || 0));
            }
          }
          if (!cancelled) {
            setLoadedTabs(prev => ({ ...prev, [t]: true }));
            setLastRangeByTab(prev => ({ ...prev, [t]: rangeKey }));
          }
        })());
      await Promise.allSettled(tasks);
    };
    prefetch();
    return () => { cancelled = true; };
  }, [tab, hasRange, from, to, user?.role, loadedTabs, lastRangeByTab]);

  // Helpers: date filtering by range
  const inRange = (isoOrDate?: string) => {
    if (!isoOrDate) return true;
    try {
      const t = new Date(isoOrDate).getTime();
      if (from) {
        const f = new Date(from + 'T00:00:00').getTime();
        if (t < f) return false;
      }
      if (to) {
        const tt = new Date(to + 'T23:59:59').getTime();
        if (t > tt) return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  // Filtered + sorted datasets per tab
  const filteredVisits = useMemo(() => {
    const arr = Array.isArray(visits) ? visits : [];
    // Try common timestamp fields
    const rows = arr.filter(v => inRange(v?.timestamp || v?.date || v?.created_at)).map(v => {
      // Resolve patient ID from multiple common keys
      const rawId = (
        v?.patient ?? v?.patient_id ?? v?.patientId ?? v?.client_id ?? v?.clientId ?? ''
      ).toString();
      const idNum = Number(rawId) || 0;
      // Resolve patient name from payload first, then from patientsMap, else fallback
      const directName = (
        v?.patient_name || v?.patientName || v?.name || v?.full_name || v?.fullName || ''
      ).toString().trim();
      const mapName = idNum ? (patientsMap[idNum] || '') : '';
      const resolvedName = directName || mapName || (idNum ? `Patient #${idNum}` : '');
      // Resolve client id/code
      const clientId = (
        v?.patient_number || v?.client_id || v?.patientId || idNum || ''
      ).toString();
      return {
        id: String(v?.id ?? ''),
        patient_name: resolvedName,
        client_id: clientId,
        diagnosis: v?.diagnosis ?? '',
        timestamp: v?.timestamp || v?.date || v?.created_at || '',
        charges: v?.charges ?? '',
        paid: v?.paid ?? v?.total_paid ?? '',
        balance: v?.balance ?? '',
      };
    });
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visits, from, to, patientsMap]);

  const filteredSales = useMemo(() => {
    const arr = Array.isArray(sales) ? sales : [];
    const rows = arr.filter(s => inRange(s?.timestamp)).map(s => {
      const lines = Array.isArray(s.items) ? s.items.length : 0;
      const units = Array.isArray(s.items)
        ? s.items.reduce((sum: number, it: any) => sum + Number(it?.amount || 0), 0)
        : 0;
      const itemNames = Array.isArray(s.items)
        ? Array.from(new Set(
            s.items
              .map((it: any) => itemsMap[Number(it?.item)] || '')
              .filter(Boolean)
          )).join(', ')
        : '';
      const batchNos = Array.isArray(s.items)
        ? Array.from(new Set(
            s.items
              .map((it: any) => (it?.batch_no || it?.batchNo || '').toString().trim())
              .filter(Boolean)
          )).join(', ')
        : '';
      return {
        id: s.id,
        customer_name: s.customer_name,
        total_amount: s.total_amount,
        timestamp: s.timestamp,
        items_count: lines, // number of distinct line items
        units_count: units, // sum of amounts (quantities)
        item_names: itemNames,
        batch_nos: batchNos,
      };
    });
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, from, to, itemsMap]);

  // Totals for Pharmacy Sales (based on filtered rows)
  const salesTotal = useMemo(() => {
    try {
      return filteredSales.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredSales]);
  const salesUnitsTotal = useMemo(() => {
    try {
      return filteredSales.reduce((sum: number, s: any) => sum + Number(s.units_count || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredSales]);

  // Visits metrics (based on filtered visit rows)
  const visitsRevenue = useMemo(() => {
    try {
      return filteredVisits.reduce((sum: number, v: any) => sum + Number(v.paid || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredVisits]);
  const visitsPending = useMemo(() => {
    try {
      return filteredVisits.reduce((sum: number, v: any) => sum + Number(v.balance || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredVisits]);
  const visitsCount = filteredVisits.length;

  // Consignments metrics (based on filtered consignment rows)

  const filteredConsignments = useMemo(() => {
    const arr = Array.isArray(consignments) ? consignments : [];
    const rows = arr.filter(c => inRange(c?.timestamp || c?.purchase_date)).map(c => ({
      id: c.id,
      item_name: c.item_name || c.name,
      quantity: c.quantity,
      purchase_date: c.purchase_date,
      payment_type: (c as any).payment_type || (c as any).paymentType || (c as any).payment || (c as any).payment_method,
      expiry_date: c.expiry_date,
      timestamp: (c as any).timestamp as string | undefined,
      supplier_name: c.supplier_name,
      purchase_cost: c.purchase_cost,
    }));
    return rows.sort((a, b) => new Date(b.purchase_date || b.timestamp || 0).getTime() - new Date(a.purchase_date || a.timestamp || 0).getTime());
  }, [consignments, from, to]);

  // Consignments metrics (based on filtered consignment rows) — must come AFTER filteredConsignments
  const consignmentsTotalCost = useMemo(() => {
    try {
      return filteredConsignments.reduce((sum: number, c: any) => sum + Number(c.purchase_cost || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredConsignments]);
  const consignmentsTotalQty = useMemo(() => {
    try {
      return filteredConsignments.reduce((sum: number, c: any) => sum + Number(c.quantity || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredConsignments]);

  const filteredBalances = useMemo(() => {
    const arr = Array.isArray(balanceVisits) ? balanceVisits : [];
    const rows = arr.filter(v => inRange(v?.timestamp)).map(v => {
      const rawId = (
        v?.patient ?? v?.patient_id ?? v?.patientId ?? v?.client_id ?? v?.clientId ?? ''
      ).toString();
      const idNum = Number(rawId) || 0;
      const directName = (
        v?.patient_name || v?.patientName || v?.name || v?.full_name || v?.fullName || ''
      ).toString().trim();
      const resolvedName = directName || (patientsMap[idNum] || (idNum ? `Patient #${idNum}` : ''));
      const clientId = (v?.patient_number || v?.client_id || v?.patientId || idNum || '').toString();
      return {
        id: String(v?.id ?? ''),
        patient_name: resolvedName,
        client_id: clientId,
        timestamp: v?.timestamp || '',
        charges: v?.charges ?? '',
        paid: v?.total_paid ?? 0,
        balance: v?.balance ?? 0,
        diagnosis: v?.diagnosis ?? '',
        diagnosis_type: v?.diagnosis_type ?? '',
        prescription: v?.prescription ?? '',
        complaints: v?.complaints ?? '',
        history: v?.history ?? '',
        allergies: v?.allergies ?? '',
        physical_exam: v?.physical_exam ?? '',
        lab_test: v?.lab_test ?? '',
        lab_results: v?.lab_results ?? '',
        imaging: v?.imaging ?? '',
        transactions: Array.isArray(v?.transactions) ? v.transactions : [],
      };
    });
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [balanceVisits, patientsMap, from, to]);

  // Total for Balances (based on filtered balance rows)
  const balancesTotal = useMemo(() => {
    try {
      return filteredBalances.reduce((sum: number, v: any) => sum + Number(v.balance || 0), 0);
    } catch {
      return 0;
    }
  }, [filteredBalances]);

  const activeRows =
    tab === 'visits' ? filteredVisits :
    tab === 'sales' ? filteredSales :
    tab === 'consignments' ? filteredConsignments :
    filteredBalances;
  const totalPages = Math.max(1, Math.ceil((activeRows.length || 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeRows.slice(start, start + pageSize);
  }, [activeRows, currentPage, pageSize]);

  // Balance detail modal state
  const [selectedBalance, setSelectedBalance] = useState<any | null>(null);

  // --- Export helpers (client-side) ---
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
    if (!doc) { alert('Unable to prepare print view'); return; }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; font-size: 12px; line-height: 1.45; padding: 16px; }
        .header { text-align:center; padding-bottom: 10px; margin-bottom:10px; border-bottom:1px solid #e5e7eb; }
        .title { font-weight:700; font-size: 18px; }
        table { width:100%; border-collapse: collapse; }
        th, td { text-align:left; border-bottom:1px solid #e5e7eb; padding:6px 4px; font-size:12px; }
        th { color:#111827; font-weight:700; background:#f9fafb; }
      </style>
    </head><body>${contentHtml}</body></html>`);
    doc.close();
    const printAndCleanup = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); }, 500);
      }, 200);
    };
    if (iframe.contentWindow?.document.readyState === 'complete') printAndCleanup();
    else iframe.onload = printAndCleanup;
  };

  const toCSV = (rows: Array<Record<string, any>>, headers: string[], headerLabels: string[]) => {
    const esc = (val: any) => {
      const s = val == null ? '' : String(val);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const headerLine = headerLabels.map(esc).join(',');
    const lines = rows.map(r => headers.map(h => esc(r[h])).join(','));
    return [headerLine, ...lines].join('\n');
  };

  const exportCSV = () => {
    setExporting(true);
    try {
      let rows: any[] = [];
      let headers: string[] = [];
      let labels: string[] = [];
      let filename = 'report.csv';
      if (tab === 'visits') {
        rows = filteredVisits;
        headers = ['patient_name','timestamp','diagnosis','charges','paid','balance'];
        labels = ['Patient','Date','Diagnosis','Charges','Paid','Balance'];
        filename = 'visits_report.csv';
      } else if (tab === 'sales') {
        rows = filteredSales;
        headers = ['customer_name','item_names','timestamp','items_count','units_count','total_amount'];
        labels = ['Customer','Item Name(s)','Date','Items (lines)','Units','Total'];
        filename = 'sales_report.csv';
      } else {
        rows = filteredConsignments;
        headers = ['item_name','quantity','purchase_date','payment_type','expiry_date','supplier_name','purchase_cost'];
        labels = ['Item','Quantity','Purchase Date','Payment Type','Expiry','Supplier','Cost'];
        filename = 'consignments_report.csv';
      }
      const csv = toCSV(rows, headers, labels);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = () => {
    let title = 'Report';
    let headers: string[] = [];
    let labels: string[] = [];
    let rows: any[] = [];
    if (tab === 'visits') {
      title = 'Visits Report';
      headers = ['patient_name','timestamp','diagnosis','charges','paid','balance'];
      labels = ['Patient','Date','Diagnosis','Charges','Paid','Balance'];
      rows = filteredVisits;
    } else if (tab === 'sales') {
      title = 'Pharmacy Sales Report';
      headers = ['customer_name','item_names','timestamp','items_count','units_count','total_amount'];
      labels = ['Customer','Item Name(s)','Date','Items (lines)','Units','Total'];
      rows = filteredSales;
    } else if (tab === 'consignments') {
      title = 'Consignments Report';
      headers = ['item_name','quantity','purchase_date','payment_type','expiry_date','supplier_name','purchase_cost'];
      labels = ['Item','Quantity','Purchase Date','Payment Type','Expiry','Supplier','Cost'];
      rows = filteredConsignments;
    } else if (tab === 'balances') {
      title = 'Balances Report';
      headers = ['patient_name','client_id','timestamp','charges','paid','balance'];
      labels = ['Patient','Client ID','Date','Charges','Paid','Balance'];
      rows = filteredBalances;
    }
    const bodyRows = rows.map(r => `<tr>${headers.map((h) => `<td>${(r as any)[h] ?? ''}</td>`).join('')}</tr>`).join('');
    const thead = `<thead><tr>${labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>`;
    const totalNote = (
      tab === 'sales'
        ? `<div style=\"margin:8px 0; font-weight:600;\">Total Sales: ${salesTotal.toFixed(2)}</div>`
        : tab === 'consignments'
        ? `<div style=\"margin:8px 0; font-weight:600;\">Total Purchase Cost: ${consignmentsTotalCost.toFixed(2)}</div>`
        : tab === 'visits'
        ? `<div style=\"margin:8px 0; font-weight:600;\">Visits Revenue: ${visitsRevenue.toFixed(2)} • Number of Visits: ${visitsCount} • Pending Balance: ${visitsPending.toFixed(2)}</div>`
        : tab === 'balances'
        ? `<div style=\"margin:8px 0; font-weight:600;\">Total Pending Balance: ${balancesTotal.toFixed(2)}</div>`
        : ''
    );
    const tfoot = (
      tab === 'sales'
        ? `<tfoot><tr>${labels.map((_, idx) => idx === labels.length - 2
            ? `<td style=\"text-align:right; font-weight:700\">Total</td>`
            : (idx === labels.length - 1
                ? `<td style=\"font-weight:700\">${salesTotal.toFixed(2)}</td>`
                : `<td></td>`)).join('')}</tr></tfoot>`
        : tab === 'consignments'
        ? `<tfoot><tr>${labels.map((_, idx) => idx === labels.length - 2
            ? `<td style=\"text-align:right; font-weight:700\">Total</td>`
            : (idx === labels.length - 1
                ? `<td style=\"font-weight:700\">${consignmentsTotalCost.toFixed(2)}</td>`
                : `<td></td>`)).join('')}</tr></tfoot>`
        : tab === 'balances'
        ? `<tfoot><tr>${labels.map((_, idx) => idx === labels.length - 2
            ? `<td style=\"text-align:right; font-weight:700\">Total</td>`
            : (idx === labels.length - 1
                ? `<td style=\"font-weight:700\">${balancesTotal.toFixed(2)}</td>`
                : `<td></td>`)).join('')}</tr></tfoot>`
        : ''
    );
    const table = `<div class=\"header\"><div class=\"title\">${title}</div><div>${from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All time'}</div>${totalNote}</div><table>${thead}<tbody>${bodyRows}</tbody>${tfoot}</table>`;
    openPrintWindow(title, table);
  };

  // Print a single balance row (patient) as PDF/printable receipt
  const exportBalancePdf = (row: {
    id: string;
    patient_name: string;
    client_id?: string;
    timestamp?: string;
    charges?: string | number;
    paid?: string | number;
    balance?: string | number;
  }) => {
    const title = `Patient Balance - ${row.patient_name}`;
    const content = `
      <div class="header">
        <div class="title">Patient Balance</div>
        <div>${row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}</div>
      </div>
      <table>
        <tbody>
          <tr><th>Patient</th><td>${row.patient_name || '—'}</td></tr>
          <tr><th>Client ID</th><td>${row.client_id || '—'}</td></tr>
          <tr><th>Charges</th><td>${row.charges ?? '0.00'}</td></tr>
          <tr><th>Paid</th><td>${row.paid ?? '0.00'}</td></tr>
          <tr><th>Balance</th><td>${row.balance ?? '0.00'}</td></tr>
          <tr><th>Items (Prescription)</th><td>${(row as any).prescription || '—'}</td></tr>
        </tbody>
      </table>
    `;
    openPrintWindow(title, content);
  };

  // Export functionality not available on backend; hide for now

  return (
    <div className="space-y-6 p-6">
      {/* Hero Banner */}
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
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Reports</h2>
            <p className="mt-2 text-sm md:text-base text-blue-100">Live summary data with optional export.</p>
          </div>
        </div>
        <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm text-gray-700 font-medium">Date Range</div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Start</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="px-3 py-2 rounded-md bg-green-600 text-white text-sm focus:ring-2 focus:ring-green-500 focus:outline-none cursor-pointer hover:bg-green-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">End</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="px-3 py-2 rounded-md bg-green-600 text-white text-sm focus:ring-2 focus:ring-green-500 focus:outline-none cursor-pointer hover:bg-green-700"
                />
              </div>
              {(from || to) && (
                <button
                  onClick={() => { setFrom(''); setTo(''); }}
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 text-sm hover:bg-gray-200"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                disabled={exporting}
                className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Export CSV (Excel)
              </button>
              <button
                onClick={exportPDF}
                className="inline-flex items-center px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
              >
                Print PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Content (changes per active tab) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <p className="text-gray-500">Loading summary…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : tab === 'sales' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-semibold text-gray-900">{salesTotal.toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Units Sold</p>
              <p className="text-2xl font-semibold text-gray-900">{salesUnitsTotal}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredSales.length}</p>
            </div>
          </div>
        ) : tab === 'visits' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Visits Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">{visitsRevenue.toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Number of Visits</p>
              <p className="text-2xl font-semibold text-gray-900">{visitsCount}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Pending Balance</p>
              <p className="text-2xl font-semibold text-gray-900">{visitsPending.toFixed(2)}</p>
            </div>
          </div>
        ) : tab === 'consignments' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Purchase Cost</p>
              <p className="text-2xl font-semibold text-gray-900">{consignmentsTotalCost.toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Quantity</p>
              <p className="text-2xl font-semibold text-gray-900">{consignmentsTotalQty}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Consignments</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredConsignments.length}</p>
            </div>
          </div>
        ) : tab === 'balances' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Pending Balance</p>
              <p className="text-2xl font-semibold text-gray-900">{totalPendingBalance.toFixed ? totalPendingBalance.toFixed(2) : Number(totalPendingBalance || 0).toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Visits With Balance</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredBalances.length}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">In Range</p>
              <p className="text-2xl font-semibold text-gray-900">{from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All time'}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">{summary?.revenue ?? 0}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Visits Today</p>
              <p className="text-2xl font-semibold text-gray-900">{summary?.visits_today ?? 0}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Patients</p>
              <p className="text-2xl font-semibold text-gray-900">{summary?.patients_total ?? 0}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabbed, paginated report viewer */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'visits' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setTab('visits')}
            >
              Visits
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setTab('sales')}
            >
              Pharmacy Sales
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'consignments' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setTab('consignments')}
            >
              Consignments
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'balances' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setTab('balances')}
            >
              Balances
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Rows per page</span>
            <select
              className="border rounded-md px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {tableLoading ? (
          <p className="text-gray-500">Loading {tab}…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            {tab === 'visits' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">S/N</th>
                    <th className="py-2 pr-4">Patient</th>
                    <th className="py-2 pr-4">Client ID</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Diagnosis</th>
                    <th className="py-2 pr-4">Charges</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((v: any, idx: number) => {
                    const sn = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{sn}</td>
                        <td className="py-2 pr-4">{v.patient_name}</td>
                        <td className="py-2 pr-4 font-mono">{v.client_id || '—'}</td>
                        <td className="py-2 pr-4">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{v.diagnosis || '—'}</td>
                        <td className="py-2 pr-4">{v.charges ?? '0.00'}</td>
                        <td className="py-2 pr-4">{v.paid ?? '0.00'}</td>
                        <td className="py-2 pr-4">{v.balance ?? '0.00'}</td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-gray-500 text-center">No data to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'sales' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Item Name(s)</th>
                    <th className="py-2 pr-4">Batch No(s)</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Items (lines)</th>
                    <th className="py-2 pr-4">Units</th>
                    <th className="py-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{s.customer_name}</td>
                      <td className="py-2 pr-4">{s.item_names || '—'}</td>
                      <td className="py-2 pr-4">{s.batch_nos || '—'}</td>
                      <td className="py-2 pr-4">{s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-4">{s.items_count}</td>
                      <td className="py-2 pr-4">{s.units_count}</td>
                      <td className="py-2 pr-4">{s.total_amount}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-gray-500 text-center">No data to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'consignments' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Quantity</th>
                    <th className="py-2 pr-4">Purchase Date</th>
                    <th className="py-2 pr-4">Payment Type</th>
                    <th className="py-2 pr-4">Expiry</th>
                    <th className="py-2 pr-4">Supplier</th>
                    <th className="py-2 pr-4">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{c.item_name}</td>
                      <td className="py-2 pr-4">{c.quantity}</td>
                      <td className="py-2 pr-4">{c.purchase_date || '—'}</td>
                      <td className="py-2 pr-4 capitalize">{c.payment_type || '—'}</td>
                      <td className="py-2 pr-4">{c.expiry_date || '—'}</td>
                      <td className="py-2 pr-4">{c.supplier_name}</td>
                      <td className="py-2 pr-4">{c.purchase_cost}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-gray-500 text-center">No data to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'balances' && (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">S/N</th>
                    <th className="py-2 pr-4">Patient</th>
                    <th className="py-2 pr-4">Client ID</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Charges</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Balance</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((v: any, idx: number) => {
                    const sn = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{sn}</td>
                        <td className="py-2 pr-4">{v.patient_name}</td>
                        <td className="py-2 pr-4 font-mono">{v.client_id || '—'}</td>
                        <td className="py-2 pr-4">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{v.charges ?? '0.00'}</td>
                        <td className="py-2 pr-4">{v.paid ?? '0.00'}</td>
                        <td className="py-2 pr-4">{v.balance ?? '0.00'}</td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => exportBalancePdf(v)}
                            className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
                          >
                            Print
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-gray-500 text-center">No data to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
        {/* Pager */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-gray-600">Page {currentPage} of {totalPages} • {activeRows.length} rows</div>
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
    </div>
  );
};

export default Reports;


