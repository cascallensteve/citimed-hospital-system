import { useEffect, useMemo, useState } from 'react';
import api, { type PharmacySale, type ConsignmentInventory } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Reports = () => {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [summary, setSummary] = useState<{ revenue?: number; visits_today?: number; patients_total?: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  // const [exporting, setExporting] = useState<boolean>(false);

  // Tabbed, paginated data viewers
  type TabKey = 'visits' | 'sales' | 'consignments';
  const [tab, setTab] = useState<TabKey>('visits');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Datasets
  const [visits, setVisits] = useState<any[]>([]);
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [consignments, setConsignments] = useState<ConsignmentInventory[]>([]);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const { user } = useAuth();

  const hasRange = useMemo(() => Boolean(from || to), [from, to]);

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

  // Load data for the active tab (uses existing endpoints; client-side pagination)
  useEffect(() => {
    let cancelled = false;
    const loadTabData = async () => {
      setTableLoading(true);
      setError('');
      try {
        if (tab === 'visits') {
          const { visits } = await api.visits.all();
          const arr = Array.isArray(visits) ? visits : [];
          if (!cancelled) setVisits(arr);
        } else if (tab === 'sales') {
          // When a date range is provided, prefer date-range endpoint (admin or superadmin)
          if (hasRange && from && to) {
            const { sales } = await api.finance.pharmacySalesByDate({ start_date: from, end_date: to });
            const arr = Array.isArray(sales) ? sales : [];
            if (!cancelled) setSales(arr as any);
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
            const { consignments } = await api.finance.consignmentsByDate({ start_date: from, end_date: to });
            const arr = Array.isArray(consignments) ? consignments : [];
            if (!cancelled) setConsignments(arr as any);
          } else {
            const { inventories } = await api.pharmacy.allConsignments();
            const arr = Array.isArray(inventories) ? inventories : [];
            if (!cancelled) setConsignments(arr);
          }
        }
        // Reset to first page whenever tab changes
        if (!cancelled) setPage(1);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to load data');
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    };
    loadTabData();
    return () => { cancelled = true; };
  }, [tab, hasRange, from, to, user?.role]);

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
    const rows = arr.filter(v => inRange(v?.timestamp || v?.date)).map(v => ({
      id: String(v?.id ?? ''),
      patient_name: v?.patient_name ?? `Patient #${v?.patient ?? ''}`,
      diagnosis: v?.diagnosis ?? '',
      timestamp: v?.timestamp || v?.date || '',
      charges: v?.charges ?? '',
      paid: v?.paid ?? v?.total_paid ?? '',
      balance: v?.balance ?? '',
    }));
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visits, from, to]);

  const filteredSales = useMemo(() => {
    const arr = Array.isArray(sales) ? sales : [];
    const rows = arr.filter(s => inRange(s?.timestamp)).map(s => ({
      id: s.id,
      customer_name: s.customer_name,
      total_amount: s.total_amount,
      timestamp: s.timestamp,
      items_count: Array.isArray(s.items) ? s.items.length : 0,
    }));
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, from, to]);

  const filteredConsignments = useMemo(() => {
    const arr = Array.isArray(consignments) ? consignments : [];
    const rows = arr.filter(c => inRange(c?.timestamp || c?.purchase_date)).map(c => ({
      id: c.id,
      item_name: c.item_name || c.name,
      quantity: c.quantity,
      purchase_date: c.purchase_date,
      expiry_date: c.expiry_date,
      timestamp: (c as any).timestamp as string | undefined,
      supplier_name: c.supplier_name,
      purchase_cost: c.purchase_cost,
    }));
    return rows.sort((a, b) => new Date(b.purchase_date || b.timestamp || 0).getTime() - new Date(a.purchase_date || a.timestamp || 0).getTime());
  }, [consignments, from, to]);

  const activeRows = tab === 'visits' ? filteredVisits : tab === 'sales' ? filteredSales : filteredConsignments;
  const totalPages = Math.max(1, Math.ceil((activeRows.length || 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeRows.slice(start, start + pageSize);
  }, [activeRows, currentPage, pageSize]);

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
        <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-3 md:space-y-0">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>
          {/* Exports disabled: backend has no export endpoints */}
        </div>
      </div>

      {/* Summary Content */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {loading ? (
          <p className="text-gray-500">Loading summary…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
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
                    <th className="py-2 pr-4">Patient</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Diagnosis</th>
                    <th className="py-2 pr-4">Charges</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{v.patient_name}</td>
                      <td className="py-2 pr-4">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-4">{v.diagnosis || '—'}</td>
                      <td className="py-2 pr-4">{v.charges ?? '0.00'}</td>
                      <td className="py-2 pr-4">{v.paid ?? '0.00'}</td>
                      <td className="py-2 pr-4">{v.balance ?? '0.00'}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-gray-500 text-center">No data to display</td>
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
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Items</th>
                    <th className="py-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{s.customer_name}</td>
                      <td className="py-2 pr-4">{s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-4">{s.items_count}</td>
                      <td className="py-2 pr-4">{s.total_amount}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-gray-500 text-center">No data to display</td>
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
                      <td className="py-2 pr-4">{c.expiry_date || '—'}</td>
                      <td className="py-2 pr-4">{c.supplier_name}</td>
                      <td className="py-2 pr-4">{c.purchase_cost}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-gray-500 text-center">No data to display</td>
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


