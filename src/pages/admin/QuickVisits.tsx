import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

// Resolve API base
const getApiBase = () => {
  const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
  if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return import.meta.env.DEV ? '/api' : 'https://citimed-api.vercel.app';
};

// Robust authorized fetch that tries Token and Bearer, and trailing slash variants handled by caller
const authFetch = async (url: string, init?: RequestInit) => {
  const token = localStorage.getItem('token') || '';
  return fetch(url, {
    ...(init || {}),
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    } as any,
  });
};

const QuickVisits = () => {
  const [form, setForm] = useState({ lab_test: '', lab_results: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const canSubmit = useMemo(() => form.lab_test.trim() && form.lab_results.trim() && form.amount.trim(), [form]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/all-quick-visits`, { method: 'GET' });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await authFetch(`${base}/visits/all-quick-visits/`, { method: 'GET' });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to load quick visits');
      setItems(Array.isArray(data?.quick_visits) ? data.quick_visits : []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const fmtKES = (v: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(v || 0);
  const openPrintWindow = (_: string, content: string) => {
    const styles = `
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial; color:#111827; }
        .title { font-size:38px; font-weight:700; }
        .muted { color:#6b7280; font-size:29px; }
        .header.first { text-align:center; margin-bottom:8px; font-weight:700; }
        .header.first * { font-weight:700 !important; }
        .thick-hr { height:3px; background:#111827; margin:10px 0; }
        .section { margin:8px 0; }
        .row { display:flex; justify-content:space-between; font-size:34px; }
        .label { color:#6b7280; }
        table { width:100%; border-collapse:collapse; font-size:34px; }
        th, td { padding:6px 4px; }
        th { color:#6b7280; font-weight:600; border-bottom:3px solid #111827; }
        .right { text-align:right; }
      </style>
    `;
    const html = `<html><head><title>Print</title>${styles}
      <script>
        function __doPrint(){ try { window.focus(); window.print(); } catch(e){} }
        window.onload = function(){ setTimeout(__doPrint, 50); };
        window.onafterprint = function(){ setTimeout(function(){ try{ window.close(); }catch(e){} }, 50); };
      </script>
    </head>
    <body>
      ${content}
      <div style="text-align:center; margin-top:12px;">
        <button onclick="__doPrint()" style="padding:6px 10px; background:#2563eb; color:#fff; border:none; border-radius:6px;">Print</button>
      </div>
    </body></html>`;

    // Try popup window first
    const w = window.open('', '_blank', 'width=480,height=640');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.onload = () => {
        setTimeout(() => { try { w.focus(); w.print(); } catch {} try { w.close(); } catch {} }, 50);
      };
      return;
    }

    // Fallback to hidden iframe if popups are blocked
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error('Unable to open print view.');
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        try { document.body.removeChild(iframe); } catch {}
      }, 50);
    };
  };

  const printQuickVisit = (row: any) => {
    const amountNum = Number(String(row?.amount || '').replace(/[^0-9.]/g, '')) || 0;
    const servedBy = row?.uploader_name || row?.uploader_info || 'Admin';
    const receiptNo = `CCQ${String(row?.id || '').toString().padStart(3, '0')}`;
    const content = `
      <div class="header first">
        <div class="title">CITIMED CLINIC</div>
        <div class="muted">MAKONGENI - THIKA</div>
        <div class="muted"><em>SERVED BY:</em> ${servedBy}</div>
        <div class="muted">RECEIPT NO: ${receiptNo}</div>
      </div>
      <div class="thick-hr"></div>
      <div class="section">
        <div class="row"><span class="label">Date:</span><span class="value">${new Date().toLocaleString()}</span></div>
      </div>
      <div class="thick-hr"></div>
      <div class="section">
        <table class="w-full">
          <thead>
            <tr><th class="text-left">Item</th><th class="right">Price</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Consultation</td>
              <td class="right">${fmtKES(amountNum)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="thick-hr"></div>
      <div class="section">
        <div class="row"><span class="label">Paid</span><span class="value">${fmtKES(amountNum)}</span></div>
        <div class="row"><span class="label">Balance</span><span class="value">${fmtKES(0)}</span></div>
      </div>
      <div class="thick-hr"></div>
      <div class="section" style="text-align:center; padding-top:8px;">
        <div class="muted">Wishing you a Quick recover</div>
      </div>
    `;
    openPrintWindow(`quick-visit-${row?.id}-receipt`, content);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { toast.error('Fill in all fields'); return; }
    if (!/^\d+$/.test(form.amount)) { toast.error('Amount must contain digits only'); return; }
    try {
      setSaving(true);
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/add-quick-visit`, { method: 'POST', body: JSON.stringify(form) });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await authFetch(`${base}/visits/add-quick-visit/`, { method: 'POST', body: JSON.stringify(form) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to add quick visit');
      toast.success('Quick visit saved');
      setForm({ lab_test: '', lab_results: '', amount: '' });
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: number | string) => {
    try {
      setDetailLoading(true);
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/quick-visit-detail/${id}/`, { method: 'GET' });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await authFetch(`${base}/visits/quick-visit-detail/${id}`, { method: 'GET' });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to load quick visit');
      setDetail(data?.quick_visit || null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const doDelete = async (row: any) => {
    try {
      const base = getApiBase();
      let res = await authFetch(`${base}/visits/delete-quick-visit/${row.id}/`, { method: 'DELETE' });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await authFetch(`${base}/visits/delete-quick-visit/${row.id}/`, { method: 'DELETE' });
      }
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to delete quick visit');
      }
      toast.success('Deleted');
      setConfirmDel(null);
      loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl text-white shadow-lg" style={{
        backgroundImage: 'url("https://res.cloudinary.com/djksfayfu/image/upload/v1758518877/6248154_esmkro.jpg")',
        backgroundSize: 'cover', backgroundPosition: 'center'
      }}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-indigo-900/50 to-purple-900/30" />
        <div className="relative px-6 py-8 md:px-10 md:py-10 z-10">
          <h2 className="text-2xl md:text-3xl font-bold">Quick Visits</h2>
          <p className="mt-2 text-sm md:text-base text-blue-100">Record and manage quick visits (lab notes + amount)</p>
        </div>
        <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
      </div>

      {/* Add form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Quick Visit</h3>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={submit}>
          <div className="md:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">Lab Test</label>
            <input className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.lab_test} onChange={e=>setForm({...form, lab_test: e.target.value})} placeholder="Complete Blood Count" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">Amount (KES)</label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.amount}
              onChange={e=>setForm({...form, amount: e.target.value.replace(/[^0-9]/g, '')})}
              placeholder="e.g., 1500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-700 mb-1">Lab Results</label>
            <textarea rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.lab_results} onChange={e=>setForm({...form, lab_results: e.target.value})} placeholder="Normal WBC, slightly low Hemoglobin" />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={()=>setForm({ lab_test: '', lab_results: '', amount: '' })} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Clear</button>
            <button type="submit" disabled={saving || !canSubmit} className={`px-4 py-2 rounded-md text-white ${saving || !canSubmit ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? 'Saving…' : 'Save Quick Visit'}</button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">All Quick Visits</h3>
          <button onClick={loadAll} disabled={loading} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : !items.length ? (
          <div className="text-gray-500">No quick visits yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploader</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab Test</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{row.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.uploader_name}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.lab_test}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.amount}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={()=>openDetail(row.id)} className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">View</button>
                        <button type="button" onClick={()=>printQuickVisit(row)} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Print</button>
                        <button type="button" onClick={()=>setConfirmDel(row)} className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setDetail(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-gray-900">Quick Visit Detail</h3>
              {detailLoading ? (
                <p className="mt-3 text-sm text-gray-500">Loading…</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="text-gray-500">ID:</span> {detail.id}</p>
                  <p><span className="text-gray-500">Uploader:</span> {detail.uploader_name}</p>
                  <p><span className="text-gray-500">Lab Test:</span> {detail.lab_test}</p>
                  <p><span className="text-gray-500">Lab Results:</span> {detail.lab_results}</p>
                  <p><span className="text-gray-500">Amount:</span> {detail.amount}</p>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={()=>setDetail(null)} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmDel(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-gray-900">Delete Quick Visit</h3>
              <p className="mt-2 text-sm text-gray-600">Are you sure you want to delete quick visit #{confirmDel.id}?</p>
            </div>
            <div className="bg-gray-50 px-6 py-3 flex justify-end gap-3">
              <button onClick={()=>setConfirmDel(null)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
              <button onClick={()=>doDelete(confirmDel)} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickVisits;
