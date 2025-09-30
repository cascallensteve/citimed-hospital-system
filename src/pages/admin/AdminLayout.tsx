import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserGroupIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

const AdminLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const permission = (user?.permission as 'out-door-patient' | 'over-the-counter' | undefined) || 'out-door-patient';
  const isOutdoor = permission === 'out-door-patient';
  const isCounter = permission === 'over-the-counter';

  // Live dashboard metrics
  const [patientsTotal, setPatientsTotal] = useState<number>(0);
  const [visitsToday, setVisitsToday] = useState<number>(0);
  const [pharmacyItemsCount, setPharmacyItemsCount] = useState<number>(0);
  const [revenueToday, setRevenueToday] = useState<number>(0);

  // Fetch total patients (for out-door admins)
  useEffect(() => {
    if (!isOutdoor) return;
    let aborted = false;
    (async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = (scheme: 'Token' | 'Bearer', withSlash: boolean) => fetch(`${base}/patients/all-patients${withSlash ? '/' : ''}`, {
          headers: token ? { Authorization: `${scheme} ${token}` } : {},
        });
        let res = await doFetch('Token', false);
        if (res.status === 404 || res.status === 405) res = await doFetch('Token', true);
        if (res.status === 401 || res.status === 403) res = await doFetch('Bearer', true);
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const arr: any[] = Array.isArray((data as any)?.Patients) ? (data as any).Patients : [];
          setPatientsTotal(arr.length || 0);
        }
      } catch {/* ignore */}
    })();
    return () => { aborted = true; };
  }, [isOutdoor]);

  // Fetch today's visits (for out-door admins)
  useEffect(() => {
    if (!isOutdoor) return;
    let aborted = false;
    (async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const doFetch = (withSlash: boolean) => fetch(`${base}/visits/all-visits${withSlash ? '/' : ''}`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        let res = await doFetch(false);
        if (res.status === 404 || res.status === 405) res = await doFetch(true);
        const data = await res.json().catch(() => ({}));
        const arr: any[] = Array.isArray((data as any)?.visits) ? (data as any).visits : (Array.isArray((data as any)?.data) ? (data as any).data : []);
        if (!aborted) {
          const now = new Date();
          const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
          const count = arr.reduce((n: number, v: any) => {
            const ts = v?.timestamp || v?.created_at || v?.date || v?.createdAt;
            const dt = ts ? new Date(ts) : null;
            return n + (dt && isSameDay(dt, now) ? 1 : 0);
          }, 0);
          setVisitsToday(count);
        }
      } catch {/* ignore */}
    })();
    return () => { aborted = true; };
  }, [isOutdoor]);

  // Fetch pharmacy items count (for over-the-counter admins)
  useEffect(() => {
    if (!isCounter) return;
    let aborted = false;
    (async () => {
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${base}/pharmacy/all-items`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        const data = await res.json().catch(() => ({}));
        if (!aborted) {
          const items: any[] = Array.isArray((data as any)?.items) ? (data as any).items : (Array.isArray((data as any)?.data) ? (data as any).data : []);
          setPharmacyItemsCount(items.length || 0);
        }
      } catch {/* ignore */}
    })();
    return () => { aborted = true; };
  }, [isCounter]);

  // Fetch pharmacy revenue today (for over-the-counter admins)
  useEffect(() => {
    if (!isCounter) return;
    let aborted = false;
    (async () => {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const isoDay = `${yyyy}-${mm}-${dd}`;
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const res = await fetch(`${base}/finances/pharmacy-sales-by-day`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Token ${localStorage.getItem('token')}` } : {}) },
          body: JSON.stringify({ date: isoDay })
        });
        const data = await res.json().catch(() => ({}));
        if (!aborted && res.ok) {
          const total = Number((data as any)?.total_sum || 0);
          setRevenueToday(total);
        }
      } catch {/* ignore */}
    })();
    return () => { aborted = true; };
  }, [isCounter]);

  const quickActions = useMemo(() => {
    if (isOutdoor) {
      return [
        { name: 'Add Patient', icon: PlusIcon, color: 'bg-blue-600', onClick: () => navigate('/dashboard/admin/patients?add=1') },
        { name: 'New Visit', icon: CalendarDaysIcon, color: 'bg-green-600', onClick: () => navigate('/dashboard/admin/visits?add=1') },
        { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', onClick: () => navigate('/dashboard/admin/patients') }
      ];
    }
    return [
      { name: 'Pharmacy Sale', icon: ShoppingCartIcon, color: 'bg-purple-600', onClick: () => navigate('/dashboard/admin/pharmacy?sale=1') },
      { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', onClick: () => navigate('/dashboard/admin/patients') }
    ];
  }, [isOutdoor, navigate]);

  // No internal navigation items; rely on main Dashboard sidebar

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* No internal sidebar: rely on main Dashboard sidebar for navigation */}

        {/* Main Content: full width */}
        <div className={`p-6 w-full`}>
          {/* Removed local header to avoid duplicate overview header; main Dashboard shows the header */}

          {/* Dashboard Content */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {quickActions.map((action) => (
                    <button
                      key={action.name}
                      onClick={action.onClick}
                      className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2`}
                    >
                      <action.icon className="h-6 w-6" />
                      <span className="font-medium">{action.name}</span>
                    </button>
                  ))}
                </div>
                {isCounter && (
                  <p className="text-xs text-gray-500 mt-3">Note: Pharmacy admins have access limited to pharmacy operations.</p>
                )}
              </div>

              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isOutdoor && (
                  <>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <UserGroupIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Patients</p>
                          <p className="text-2xl font-semibold text-gray-900">{patientsTotal.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CalendarDaysIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Today's Visits</p>
                          <p className="text-2xl font-semibold text-gray-900">{visitsToday}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {isCounter && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <ShoppingCartIcon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Pharmacy Items</p>
                        <p className="text-2xl font-semibold text-gray-900">{pharmacyItemsCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {isCounter && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Revenue Today (Pharmacy)</p>
                        <p className="text-2xl font-semibold text-gray-900">{revenueToday.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Recent Activity section removed per requirements */}
            </div>
          
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;