import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDataCache } from '../context/DataCacheContext';
import { 
  Bars3Icon as MenuAlt2Icon, 
  XMarkIcon as XIcon,
  UserGroupIcon, 
  CalendarDaysIcon, 
  CurrencyDollarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  HomeIcon,
  Cog6ToothIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

type NavItem = { name: string; to: string; icon: any };

const Dashboard = () => {
  const { user } = useAuth();
  const { loaded: cacheLoaded, patients: cachePatients, pharmacyItems: cachePharmacyItems, visits: cacheVisits, sales: cacheSales, refreshAll } = useDataCache();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Apply saved theme on mount for consistent theming
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  

  // Dashboard state
  const [patientsTotal, setPatientsTotal] = useState<number | null>(null);
  const [patientsNewToday, setPatientsNewToday] = useState<number>(0);
  const [pharmacyItemsCount, setPharmacyItemsCount] = useState<number>(0);
  const [visitsToday, setVisitsToday] = useState<number>(0);
  const [visitsThisWeek, setVisitsThisWeek] = useState<number>(0);
  const [revenueToday, setRevenueToday] = useState<number>(0);
  const [visitsRevenueToday, setVisitsRevenueToday] = useState<number>(0);
  const [pharmacyRevenueToday, setPharmacyRevenueToday] = useState<number>(0);
  const [quickVisitsRevenueToday, setQuickVisitsRevenueToday] = useState<number>(0);
  const [quickVisitsRevenueTotal, setQuickVisitsRevenueTotal] = useState<number>(0);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
  const [supplierOutstanding, setSupplierOutstanding] = useState<number>(0);
  const [transactionsToday, setTransactionsToday] = useState<number>(0);
  const [totalSalesCount, setTotalSalesCount] = useState<number>(0);

  // Hydrate cards from localStorage to avoid flashing zeros on refresh in production
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dashboard_cache');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        if (typeof d.patientsTotal === 'number') setPatientsTotal(d.patientsTotal);
        if (typeof d.patientsNewToday === 'number') setPatientsNewToday(d.patientsNewToday);
        if (typeof d.pharmacyItemsCount === 'number') setPharmacyItemsCount(d.pharmacyItemsCount);
        if (typeof d.visitsToday === 'number') setVisitsToday(d.visitsToday);
        if (typeof d.visitsThisWeek === 'number') setVisitsThisWeek(d.visitsThisWeek);
        if (typeof d.revenueToday === 'number') setRevenueToday(d.revenueToday);
        if (typeof d.visitsRevenueToday === 'number') setVisitsRevenueToday(d.visitsRevenueToday);
        if (typeof d.pharmacyRevenueToday === 'number') setPharmacyRevenueToday(d.pharmacyRevenueToday);
        if (typeof d.quickVisitsRevenueToday === 'number') setQuickVisitsRevenueToday(d.quickVisitsRevenueToday);
        if (typeof d.quickVisitsRevenueTotal === 'number') setQuickVisitsRevenueTotal(d.quickVisitsRevenueTotal);
        if (typeof d.outstandingBalance === 'number') setOutstandingBalance(d.outstandingBalance);
        if (typeof d.supplierOutstanding === 'number') setSupplierOutstanding(d.supplierOutstanding);
        if (typeof d.transactionsToday === 'number') setTransactionsToday(d.transactionsToday);
        if (typeof d.totalSalesCount === 'number') setTotalSalesCount(d.totalSalesCount);
      }
    } catch {}
  }, []);

  const dashboardData = {
    patients: {
      total: patientsTotal ?? 0,
      new: patientsNewToday,
      walkIn: 0,
      repeat: 0,
    },
    visits: {
      today: visitsToday,
      thisWeek: visitsThisWeek,
      pending: 0,
    },
    pharmacy: {
      totalItems: pharmacyItemsCount,
      lowStock: 0,
      sales: 0,
    },
    balances: {
      totalPaid: 0,
      outstanding: outstandingBalance,
      today: revenueToday,
    }
  };

  // Prefill cards from cached datasets for instant, accurate values (works in deployed builds too)
  useEffect(() => {
    if (!cacheLoaded) return;
    // Patients
    if (Array.isArray(cachePatients)) {
      setPatientsTotal(cachePatients.length);
      const today = new Date();
      const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
      const newToday = cachePatients.filter((p: any) => {
        const created = p?.registeredAt || p?.created_at || p?.createdAt || p?.timestamp || p?.date_created || p?.dateCreated;
        if (!created) return false;
        const dt = new Date(created);
        return isSameDay(dt, today);
      }).length;
      setPatientsNewToday(newToday);
    }
    // Pharmacy items
    if (Array.isArray(cachePharmacyItems)) {
      setPharmacyItemsCount(cachePharmacyItems.length || 0);
    }
    // Visits-derived stats
    if (Array.isArray(cacheVisits)) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0,0,0,0);
      const day = startOfWeek.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // Monday start
      startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
      const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
      const inThisWeek = (d: Date) => d >= startOfWeek && d <= now;

      let todayCount = 0;
      let weekCount = 0;
      let todayChargesSum = 0;
      let outstanding = 0;
      cacheVisits.forEach((v: any) => {
        const ts = v?.timestamp || v?.time_stamp || v?.created_at || v?.updated_at || v?.date || v?.createdAt || v?.date_created || v?.dateCreated;
        const dt = ts ? new Date(ts) : null;
        if (dt) {
          if (isSameDay(dt, now)) todayCount += 1;
          if (inThisWeek(dt)) weekCount += 1;
        }
        if (dt && isSameDay(dt, now)) {
          todayChargesSum += moneyToNumber(v?.charges);
        }
        const balNum = Number(v?.balance || 0);
        if (isFinite(balNum) && balNum > 0) outstanding += balNum;
      });
      // Only update if we truly computed values; otherwise keep previous snapshot
      if (todayCount || weekCount || todayChargesSum || outstanding || visitsToday === 0) {
        setVisitsToday(todayCount);
        setVisitsThisWeek(weekCount);
        if (user?.role === 'superadmin' || user?.permission === 'out-door-patient') {
          setVisitsRevenueToday(todayChargesSum);
        }
        setOutstandingBalance(outstanding);
      }
    }
    // Pharmacy sales (today)
    if (Array.isArray(cacheSales)) {
      const today = new Date();
      const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
      let total = 0;
      let count = 0;
      for (const s of cacheSales) {
        const ts = s?.timestamp || s?.time_stamp || s?.created_at || s?.updated_at || s?.date || s?.createdAt || s?.date_created || s?.dateCreated;
        const dt = ts ? new Date(ts) : null;
        if (!dt || !isSameDay(dt, today)) continue;
        const lineTotal = (() => {
          const t = (s?.total_amount ?? s?.total ?? '').toString();
          const n = parseFloat(t);
          if (!isNaN(n) && isFinite(n)) return n;
          if (Array.isArray(s?.items)) {
            return s.items.reduce((acc: number, it: any) => acc + (parseFloat((it.total_price ?? '0').toString()) || 0), 0);
          }
          return 0;
        })();
        total += lineTotal;
        count += 1;
      }
      setRevenueToday(total);
      setPharmacyRevenueToday(total);
      setTransactionsToday(count);
    }
    // Persist latest snapshot for next reload
    try {
      const snapshot = {
        patientsTotal,
        patientsNewToday,
        pharmacyItemsCount,
        visitsToday,
        visitsThisWeek,
        revenueToday,
        visitsRevenueToday,
        pharmacyRevenueToday,
        quickVisitsRevenueToday,
        quickVisitsRevenueTotal,
        outstandingBalance,
        supplierOutstanding,
        transactionsToday,
        totalSalesCount,
      };
      localStorage.setItem('dashboard_cache', JSON.stringify(snapshot));
    } catch {}
  }, [cacheLoaded, cachePatients, cachePharmacyItems, cacheVisits, cacheSales, user?.role, user?.permission, patientsTotal, patientsNewToday, pharmacyItemsCount, visitsToday, visitsThisWeek, revenueToday, visitsRevenueToday, pharmacyRevenueToday, quickVisitsRevenueToday, quickVisitsRevenueTotal, outstandingBalance, supplierOutstanding, transactionsToday, totalSalesCount]);

  // If caches are empty post-load, trigger a background refresh once to populate real values (production-safe)
  useEffect(() => {
    if (!cacheLoaded) return;
    const allEmpty = (!Array.isArray(cachePatients) || cachePatients.length === 0)
      && (!Array.isArray(cacheVisits) || cacheVisits.length === 0)
      && (!Array.isArray(cachePharmacyItems) || cachePharmacyItems.length === 0)
      && (!Array.isArray(cacheSales) || cacheSales.length === 0);
    const hasToken = !!localStorage.getItem('token');
    if (hasToken && allEmpty) {
      refreshAll().catch(() => {});
    }
  }, [cacheLoaded, cachePatients, cacheVisits, cachePharmacyItems, cacheSales, refreshAll]);

  // Fetch real patients total for Overview
  useEffect(() => {
    let aborted = false;
    const fetchTotal = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/patients/all-patients${withSlash ? '/' : ''}`, {
          headers: token ? { Authorization: `${scheme} ${token}` } : {},
        });
        let res = await doFetch('Token', false);
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405) res = await doFetch('Token', true);
        if (res.status === 401 || res.status === 403) res = await doFetch('Bearer', true);
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const arr: any[] = Array.isArray(data?.Patients) ? data.Patients : [];
          if (arr.length >= 0) setPatientsTotal(arr.length);
          // Compute new patients today if created_at present
          const today = new Date();
          const isSameDay = (d: Date, e: Date) => d.getFullYear() === e.getFullYear() && d.getMonth() === e.getMonth() && d.getDate() === e.getDate();
          const newToday = arr.filter((p: any) => {
            const created = p?.created_at || p?.createdAt || p?.created || p?.timestamp;
            if (!created) return false;
            const dt = new Date(created);
            return isSameDay(dt, today);
          }).length;
          setPatientsNewToday(newToday);
        }
      } catch {
        /* ignore, keep demo totals */
      }
    };
    fetchTotal();
    return () => { aborted = true; };
  }, []);

  // Fetch pharmacy items count
  useEffect(() => {
    let aborted = false;
    const fetchItems = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${base}/pharmacy/all-items`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const items: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : []);
          setPharmacyItemsCount(items.length || 0);
        }
      } catch {/* ignore */}
    };
    fetchItems();
    return () => { aborted = true; };
  }, []);

  // Fetch visits for today/this week and compute revenue/outstanding (for superadmin/outdoor)
  useEffect(() => {
    let aborted = false;
    const fetchVisits = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = (withSlash: boolean) => fetch(`${base}/visits/all-visits${withSlash ? '/' : ''}`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        let res = await doFetch(false);
        if (res.status === 404 || res.status === 405) res = await doFetch(true);
        const data = await res.json().catch(() => ({}));
        const arr: any[] = Array.isArray(data?.visits) ? data.visits : (Array.isArray(data?.data) ? data.data : []);
        if (!aborted) {
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0,0,0,0);
          // Set to Monday (assuming week starts Monday)
          const day = startOfWeek.getDay();
          const diffToMonday = (day === 0 ? -6 : 1) - day; // Sunday -> -6
          startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
          const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
          const inThisWeek = (d: Date) => d >= startOfWeek && d <= now;

          let todayCount = 0;
          let weekCount = 0;
          let todayChargesSum = 0;
          let outstanding = 0;
          arr.forEach((v: any) => {
            const ts = v?.timestamp || v?.created_at || v?.date || v?.createdAt;
            const dt = ts ? new Date(ts) : null;
            if (dt) {
              if (isSameDay(dt, now)) todayCount += 1;
              if (inThisWeek(dt)) weekCount += 1;
            }
            const balNum = Number(v?.balance || 0);
            if (dt && isSameDay(dt, now)) {
              // Sum charges for visits revenue card as requested
              const charge = moneyToNumber(v?.charges);
              todayChargesSum += charge;
            }
            if (isFinite(balNum) && balNum > 0) outstanding += balNum;
          });
          setVisitsToday(todayCount);
          setVisitsThisWeek(weekCount);
          // Capture visits revenue today for overview cards (only for clinical roles)
          if (user?.role === 'superadmin' || user?.permission === 'out-door-patient') {
            setVisitsRevenueToday(todayChargesSum);
          }
          setOutstandingBalance(outstanding);
        }
      } catch {/* ignore */}
    };
    if (user?.role === 'superadmin' || user?.permission === 'out-door-patient') {
      fetchVisits();
    }
    return () => { aborted = true; };
  }, [user?.role, user?.permission]);

  // Fetch today's pharmacy sales to populate pharmacyRevenueToday (for OTC and Superadmin)
  useEffect(() => {
    let aborted = false;
    const fetchSalesToday = async () => {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const isoDay = `${yyyy}-${mm}-${dd}`;
        // Use finance endpoint for aggregated totals
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = async (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/finances/pharmacy-sales-by-day${withSlash ? '/' : ''}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { Authorization: `${scheme} ${token}` } : {}),
          },
          body: JSON.stringify({ date: isoDay })
        });
        let res = await doFetch('Token', false);
        if (!res.ok && (res.status === 404 || res.status === 405)) res = await doFetch('Token', true);
        if (!res.ok && (res.status === 401 || res.status === 403)) res = await doFetch('Bearer', true);
        const data = await res.json().catch(() => ({}));
        if (!aborted && res.ok) {
          let total = Number(data?.total_sum || 0);
          let salesArr: any[] = Array.isArray(data?.sales) ? data.sales : (Array.isArray((data as any)?.items) ? (data as any).items : []);
          // Fallback: if total is 0 but there are sales today under all-sales, recompute
          if (!total) {
            try {
              const doAll = async (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/pharmacy/all-sales${withSlash ? '/' : ''}`, {
                headers: { 'Accept': 'application/json', ...(token ? { Authorization: `${scheme} ${token}` } : {}) }
              });
              let r2 = await doAll('Token', false);
              if (!r2.ok && (r2.status === 404 || r2.status === 405)) r2 = await doAll('Token', true);
              if (!r2.ok && (r2.status === 401 || r2.status === 403)) r2 = await doAll('Bearer', true);
              const d2 = await r2.json().catch(() => ({}));
              const arr2: any[] = Array.isArray((d2 as any)?.items) ? (d2 as any).items : (Array.isArray((d2 as any)?.sales) ? (d2 as any).sales : []);
              const today = new Date();
              const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
              const sumToday = arr2.reduce((sum, s: any) => {
                const ts = s?.timestamp || s?.created_at || s?.date || s?.createdAt;
                const dt = ts ? new Date(ts) : null;
                const lineTotal = (() => {
                  const t = (s?.total_amount ?? '').toString();
                  const n = parseFloat(t);
                  if (!isNaN(n) && isFinite(n)) return n;
                  if (Array.isArray(s?.items)) {
                    return s.items.reduce((acc: number, it: any) => acc + (parseFloat((it.total_price ?? '0').toString()) || 0), 0);
                  }
                  return 0;
                })();
                return (dt && isSameDay(dt, today)) ? (sum + lineTotal) : sum;
              }, 0);
              if (sumToday > 0) {
                total = sumToday;
                salesArr = arr2.filter((s: any) => {
                  const ts = s?.timestamp || s?.created_at || s?.date || s?.createdAt;
                  const dt = ts ? new Date(ts) : null;
                  return dt && isSameDay(dt, new Date());
                });
              }
            } catch { /* ignore fallback errors */ }
          }
          setRevenueToday(total);
          setPharmacyRevenueToday(total);
          setTransactionsToday(salesArr.length);
        }
      } catch {/* ignore */}
    };
    // Always fetch to make sure production cards are accurate regardless of role
    fetchSalesToday();
    return () => { aborted = true; };
  }, [user?.permission, user?.role]);

  // Fetch Quick Visits revenue: both today's and all-time totals
  useEffect(() => {
    let aborted = false;
    const fetchQuickVisits = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = async (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/visits/all-quick-visits${withSlash ? '/' : ''}`, {
          headers: {
            'Accept': 'application/json',
            ...(token ? { Authorization: `${scheme} ${token}` } : {}),
          }
        });
        let res = await doFetch('Token', false);
        if (!res.ok && (res.status === 404 || res.status === 405)) res = await doFetch('Token', true);
        if (!res.ok && (res.status === 401 || res.status === 403)) res = await doFetch('Bearer', true);
        const data = await res.json().catch(() => ({}));
        if (!aborted && res.ok) {
          const arr: any[] = Array.isArray((data as any)?.quick_visits) ? (data as any).quick_visits : (Array.isArray((data as any)?.items) ? (data as any).items : (Array.isArray((data as any)?.data) ? (data as any).data : []));
          const today = new Date();
          const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
          let totalToday = 0;
          let totalAll = 0;
          for (const qv of arr) {
            const ts = qv?.timestamp || qv?.created_at || qv?.date || qv?.createdAt;
            const dt = ts ? new Date(ts) : null;
            const amt = moneyToNumber(qv?.amount);
            totalAll += amt;
            if (dt && isSameDay(dt, today)) totalToday += amt;
          }
          setQuickVisitsRevenueToday(totalToday);
          setQuickVisitsRevenueTotal(totalAll);
        }
      } catch { /* ignore */ }
    };
    // Always fetch: compute locally and show if available
    fetchQuickVisits();
    return () => { aborted = true; };
  }, [user?.role, user?.permission]);

  // Fetch Supplier Outstanding balances from consignments
  useEffect(() => {
    let aborted = false;
    const fetchSupplierOutstanding = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = async (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/pharmacy/consignments${withSlash ? '/' : ''}`, {
          headers: {
            'Accept': 'application/json',
            ...(token ? { Authorization: `${scheme} ${token}` } : {}),
          }
        });
        let res = await doFetch('Token', false);
        if (!res.ok && (res.status === 404 || res.status === 405)) res = await doFetch('Token', true);
        if (!res.ok && (res.status === 401 || res.status === 403)) res = await doFetch('Bearer', true);
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const arr: any[] = Array.isArray((data as any)?.inventories)
            ? (data as any).inventories
            : (Array.isArray((data as any)?.consignments)
              ? (data as any).consignments
              : (Array.isArray((data as any)?.data) ? (data as any).data : []));
          const totalOutstanding = arr.reduce((sum, c: any) => {
            const charges = moneyToNumber(c?.purchase_cost);
            const paid = moneyToNumber(c?.total_paid);
            const balance = (c?.balance !== undefined && c?.balance !== null) ? moneyToNumber(c?.balance) : Math.max(0, charges - paid);
            return sum + (balance > 0 ? balance : 0);
          }, 0);
          setSupplierOutstanding(totalOutstanding);
        }
      } catch { /* ignore */ }
    };
    // Always fetch: it will compute to 0 if not permitted
    fetchSupplierOutstanding();
    return () => { aborted = true; };
  }, [user?.role]);

  // For over-the-counter admins: fetch total sales count (all time)
  useEffect(() => {
    let aborted = false;
    const fetchTotalSales = async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${base}/pharmacy/all-sales`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const arr: any[] = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.sales) ? data.sales : []);
          setTotalSalesCount(arr.length || 0);
        }
      } catch {/* ignore */}
    };
    // Always fetch
    fetchTotalSales();
    return () => { aborted = true; };
  }, [user?.permission]);

  // Final fallback: if after refreshAll caches are still empty, run direct fetches to populate cards
  useEffect(() => {
    if (!cacheLoaded) return;
    const hasData = (patientsTotal ?? 0) > 0 || visitsToday > 0 || pharmacyItemsCount > 0 || revenueToday > 0 || quickVisitsRevenueTotal > 0;
    if (hasData) return;
    const token = localStorage.getItem('token') || '';
    if (!token) return;
    // Trigger the existing effects by calling refreshAll (which we already do), and also run direct fetches by re-invoking the API effects via a state tick
    refreshAll().catch(()=>{});
  }, [cacheLoaded, patientsTotal, visitsToday, pharmacyItemsCount, revenueToday, quickVisitsRevenueTotal, refreshAll]);

  // Currency formatter KES
  const formatKES = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value || 0);

  const quickActions = useMemo(() => {
    if (user?.role === 'superadmin') {
      return [
        { name: 'Add Patient', icon: PlusIcon, color: 'bg-blue-600', href: '/dashboard/admin/patients?add=1' },
        { name: 'New Visit', icon: CalendarDaysIcon, color: 'bg-green-600', href: '/dashboard/admin/visits?add=1' },
        { name: 'Pharmacy Sale', icon: ShoppingCartIcon, color: 'bg-purple-600', href: '/dashboard/admin/pharmacy' },
        { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', href: '/dashboard/admin/patients' },
      ];
    }
    if (user?.permission === 'out-door-patient') {
      return [
        { name: 'Add Patient', icon: PlusIcon, color: 'bg-blue-600', href: '/dashboard/admin/patients?add=1' },
        { name: 'New Visit', icon: CalendarDaysIcon, color: 'bg-green-600', href: '/dashboard/admin/visits?add=1' },
        { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', href: '/dashboard/admin/patients' },
      ];
    }
    if (user?.permission === 'over-the-counter') {
      return [
        { name: 'Pharmacy Sale', icon: ShoppingCartIcon, color: 'bg-purple-600', href: '/dashboard/admin/pharmacy' },
      ];
    }
    return [];
  }, [user?.role, user?.permission]);

  const navItems: NavItem[] = useMemo(() => {
    if (user?.role === 'superadmin') {
      return [
        { name: 'Overview', to: '/dashboard', icon: HomeIcon },
        { name: 'Patients', to: '/dashboard/admin/patients', icon: UserGroupIcon },
        { name: 'Visits', to: '/dashboard/admin/visits', icon: CalendarDaysIcon },
        { name: 'Quick Visits', to: '/dashboard/admin/quick-visits', icon: BeakerIcon },
        { name: 'Pharmacy', to: '/dashboard/admin/pharmacy', icon: ShoppingCartIcon },
        { name: 'Reports', to: '/dashboard/super/reports', icon: DocumentTextIcon },
        { name: 'Settings', to: '/dashboard/settings', icon: Cog6ToothIcon },
      ];
    }
    // Admins: show features based on permission
    if (user?.permission === 'out-door-patient') {
      return [
        { name: 'Overview', to: '/dashboard', icon: HomeIcon },
        { name: 'Patients', to: '/dashboard/admin/patients', icon: UserGroupIcon },
        { name: 'Visits', to: '/dashboard/admin/visits', icon: CalendarDaysIcon },
        { name: 'Quick Visits', to: '/dashboard/admin/quick-visits', icon: BeakerIcon },
        { name: 'Settings', to: '/dashboard/settings', icon: Cog6ToothIcon },
      ];
    }
    if (user?.permission === 'over-the-counter') {
      return [
        { name: 'Overview', to: '/dashboard', icon: HomeIcon },
        { name: 'Pharmacy', to: '/dashboard/admin/pharmacy', icon: ShoppingCartIcon },
        { name: 'Settings', to: '/dashboard/settings', icon: Cog6ToothIcon },
      ];
    }
    // Fallback: show minimal
    return [
      { name: 'Overview', to: '/dashboard', icon: HomeIcon },
      { name: 'Settings', to: '/dashboard/settings', icon: Cog6ToothIcon },
    ];
  }, [user?.role, user?.permission]);

  const isOverviewPage = location.pathname === '/dashboard' || location.pathname === '/dashboard/';

  // Remove forced redirect; admins have an Admin Overview at /dashboard/admin

  // Helper: parse currency-like strings to number
  const moneyToNumber = (s: unknown) => {
    if (s === null || s === undefined) return 0;
    const n = Number(String(s).replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : 0;
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="fixed inset-0 flex z-40">
          <div className="fixed inset-0">
            <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
          </div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-gradient-to-b from-blue-900 to-blue-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <XIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-6 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-6 mb-8">
                <img src="/IMAGES/Logo.png" alt="Citimed" className="h-12 w-auto object-contain filter brightness-0 invert" />
                <div className="ml-3">
                  <h1 className="text-lg font-bold text-white">CITIMED CLINIC</h1>
                  <p className="text-blue-200 text-xs">Admin Dashboard</p>
                </div>
              </div>
              <nav className="px-3 space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <Link
                      key={item.name}
                      to={item.to}
                      className={`${
                        isActive 
                          ? 'bg-white text-blue-900 shadow-lg' 
                          : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                      } group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${
                        isActive ? 'text-blue-900' : 'text-blue-200 group-hover:text-white'
                      }`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              
              {/* Mobile Settings Panel removed: now a dedicated Settings page */}
            </div>
            <div className="flex-shrink-0 border-t border-blue-700 p-4">
              <div className="flex items-center">
                <Link to="/dashboard/profile" className="flex items-center flex-1 hover:bg-blue-700 rounded-lg p-2 transition-colors duration-300">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 flex-1 text-left">
                    <div className="text-sm font-medium text-white truncate">
                      {user?.email}
                    </div>
                    <div className="text-xs text-blue-200">
                      {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </div>
                  </div>
                </Link>
              </div>
              {/* Mobile Profile Panel removed: now navigate to Profile page */}
            </div>
          </div>
          <div className="flex-shrink-0 w-14">
            {/* Force sidebar to shrink to fit close icon */}
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-gradient-to-b from-blue-900 to-blue-800 shadow-xl">
            <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-6 mb-8">
                <img src="/IMAGES/Logo.png" alt="Citimed" className="h-16 w-auto object-contain filter brightness-0 invert" />
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-white">CITIMED CMS</h1>
                  <p className="text-blue-200 text-sm">Admin Dashboard</p>
                </div>
              </div>
              <nav className="flex-1 px-3 space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <Link
                      key={item.name}
                      to={item.to}
                      className={`${
                        isActive 
                          ? 'bg-white text-blue-900 shadow-lg transform scale-105' 
                          : 'text-blue-100 hover:bg-blue-700 hover:text-white hover:shadow-md'
                      } group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out hover:transform hover:scale-105`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 transition-colors duration-300 ${
                        isActive ? 'text-blue-900' : 'text-blue-200 group-hover:text-white'
                      }`} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
              
              {/* Settings Panel removed: now a dedicated Settings page */}
            </div>
            <div className="flex-shrink-0 border-t border-blue-700 p-4">
              <div className="flex items-center">
                <Link to="/dashboard/profile" className="flex items-center flex-1 hover:bg-blue-700 rounded-lg p-2 transition-colors duration-300">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 flex-1 text-left">
                    <div className="text-sm font-medium text-white truncate">
                      {user?.email}
                    </div>
                    <div className="text-xs text-blue-200">
                    {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                  </div>
                </div>
                </Link>
              </div>
              {/* Profile Panel removed: now navigate to Profile page */}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Header with Date/Time and Mobile Menu */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger button inside header */}
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full bg-transparent hover:bg-transparent focus:outline-none focus:ring-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                title="Open menu"
              >
                <MenuAlt2Icon className="h-7 w-7 text-gray-900 dark:text-white" />
              </button>
              <div className="flex flex-col leading-tight">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isOverviewPage ? 'Dashboard Overview' : 'CITIMED CMS'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isOverviewPage ? 'Welcome to Citimed Clinic Management System' : 'Manage your clinic operations'}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour12: true, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-gray-50 dark:bg-gray-900">
          {isOverviewPage && (
            <div className="p-6">
              {/* Hero Banner */}
              <div
                className="relative overflow-hidden rounded-xl mb-6 text-white shadow-lg"
                style={{
                  backgroundImage: 'url("https://res.cloudinary.com/djksfayfu/image/upload/v1758518877/6248154_esmkro.jpg")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-indigo-900/50 to-purple-900/30"></div>
                <div className="relative px-6 py-8 md:px-10 md:py-10 z-10">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold">Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!</h2>
                      <p className="mt-2 text-sm md:text-base text-blue-100">Track clinic performance, manage patients, and streamline operations from your dashboard.</p>
                    </div>
          <div className="flex items-center gap-3">
            {(!user || user.role === 'superadmin' || user.permission === 'out-door-patient') && (
              <>
                <Link to="/dashboard/admin/patients" className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">Add Patient</Link>
                <Link to="/dashboard/admin/visits?add=1" className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">New Visit</Link>
              </>
            )}
          </div>
                  </div>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-20 pointer-events-none select-none">
                  <img src="/IMAGES/Logo.png" alt="Citimed" className="h-40 w-40 object-contain" />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {quickActions.map((action) => (
                    <Link
                      key={action.name}
                      to={action.href}
                      className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center space-x-2 hover:transform hover:scale-105`}
                    >
                      <action.icon className="h-6 w-6" />
                      <span className="font-medium">{action.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {(user?.role === 'superadmin' || user?.permission === 'out-door-patient') && (
                  <div className="contents">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <UserGroupIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Patients</p>
                          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{dashboardData.patients.total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                          <CalendarDaysIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Today's Visits</p>
                          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{dashboardData.visits.today}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(user?.role === 'superadmin' || user?.permission === 'over-the-counter') && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <ShoppingCartIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pharmacy Items</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{dashboardData.pharmacy.totalItems}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Removed duplicate Outstanding Balance card here; shown later in summary section */}

                {user?.permission === 'over-the-counter' && (
                  <div className="contents">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                          <CurrencyDollarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="ml-4">
                          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(revenueToday)}</p>
                        </div>
                      </div>
                    </div>
                    {user?.role === 'superadmin' && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-center">
                          <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                            <CurrencyDollarIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Outstanding Balance</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(dashboardData.balances.outstanding)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Analytics Summary (hidden for over-the-counter admins) */}
              {user?.permission !== 'over-the-counter' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-300">New Patients Today</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{dashboardData.patients.new}</div>
                      <div className="mt-2 text-xs text-green-600">+12% vs yesterday</div>
                    </div>
                    <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                      <div className="text-sm text-gray-600 dark:text-gray-300">Visits This Week</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{dashboardData.visits.thisWeek}</div>
                      <div className="mt-2 text-xs text-blue-600">On track</div>
                    </div>
                    {(user?.role === 'superadmin') && (
                      <>
                        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-300">Visit Revenue</div>
                          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(visitsRevenueToday)}</div>
                          <div className="mt-2 text-xs text-green-600">Paid inflow from visits</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-300">Quick Visits Revenue (Total)</div>
                          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(quickVisitsRevenueTotal)}</div>
                          <div className="mt-2 text-xs text-emerald-600">All-time quick visits</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-300">Pharmacy Sales Revenue</div>
                          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(pharmacyRevenueToday)}</div>
                          <div className="mt-2 text-xs text-purple-600">Sales today</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-300">All Revenue</div>
                          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES((visitsRevenueToday || 0) + (quickVisitsRevenueTotal || 0) + (pharmacyRevenueToday || 0))}</div>
                          <div className="mt-2 text-xs text-blue-600">Visits (today) + Quick (total) + Pharmacy (today)</div>
                        </div>
                      </>
                    )}
                    {user?.role === 'superadmin' && (
                      <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300">Outstanding Balance</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(dashboardData.balances.outstanding)}</div>
                        <div className="mt-2 text-xs text-orange-600">Follow-ups needed</div>
                      </div>
                    )}
                    {user?.role === 'superadmin' && (
                      <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300">Supplier Outstanding</div>
                        <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatKES(supplierOutstanding)}</div>
                        <div className="mt-2 text-xs text-amber-600">Consignments due</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!isOverviewPage && (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

