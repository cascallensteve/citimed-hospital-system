import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  ShoppingCartIcon,
  CurrencyDollarIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PrinterIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useDataCache } from '../../context/DataCacheContext';

type ApiItem = {
  id: number;
  uploader_name?: string;
  name: string;
  quantity: string;
  supplier_name?: string;
  purchase_cost?: number;
  payment_type?: string;
  purchase_date?: string;
  expiry_date?: string;
  uploader?: number;
};

type PharmacyItem = {
  id: string;
  name: string;
  quantity: number;
  supplierName?: string;
  purchaseCost?: number;
  paymentType?: string;
  purchaseDate?: string;
  expiryDate?: string;
  unitName?: string;
  unitPrice?: number;
  discount?: number;
  salesInstructions?: string;
  dateCreated?: string;
};

interface Sale {
  id: string;
  customerName: string;
  itemCount: number;
  totalAmount: number;
  timestamp: string;
}

const Pharmacy = () => {
  const { user } = useAuth();
  const { pharmacyItems: cachedItems, setPharmacyItems: setCachedItems, sales: cachedSales, setSales: setCachedSales, consignments: cachedConsignments, setConsignments: setCachedConsignments, loaded: cacheLoaded } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'consignments'>('inventory');
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showAddConsignmentForm, setShowAddConsignmentForm] = useState(false);
  const [showViewItem, setShowViewItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockItemId, setStockItemId] = useState<string>('');
  const [showItemConsignments, setShowItemConsignments] = useState(false);
  const [consignmentsItemName, setConsignmentsItemName] = useState('');
  const [itemConsignments, setItemConsignments] = useState<Array<any>>([]);
  // Consignments (all)
  const [consignments, setConsignments] = useState<Array<any>>([]);
  const [showConsignmentDetail, setShowConsignmentDetail] = useState(false);
  const [consignmentDetail, setConsignmentDetail] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<PharmacyItem | null>(null);
  const [editItem, setEditItem] = useState<PharmacyItem | null>(null);
  const canAddConsignment = (user?.role === 'superadmin') || ((user as any)?.permission === 'over-the-counter');
  const canUsePharmacy = (
    user?.role === 'superadmin' ||
    user?.role === 'admin' ||
    (user as any)?.permission === 'over-the-counter' ||
    (user as any)?.permission === 'pharmacy'
  );
  // Only superadmins can see money values
  const canViewMoney = user?.role === 'superadmin';

  // Redirect unauthenticated users to login
  const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  // When token exists but user context not yet ready, show a lightweight loader to avoid flicker
  if (!user) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-sm text-gray-700">
          Loading pharmacy…
        </div>
      </div>
    );
  }

  // If authenticated but without pharmacy permission, show a friendly notice
  if (!canUsePharmacy) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-sm text-gray-700">You don't have permission to access the Pharmacy module. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Items from backend
  const [items, setItems] = useState<PharmacyItem[]>([]);

  const [sales, setSales] = useState<Sale[]>([]);
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  const [saleDetail, setSaleDetail] = useState<{ id: number; customer_name: string; total_amount: string; timestamp: string; uploader_name?: string; items: Array<{ id: number; amount: string | number; total_price: string; item: number; item_name?: string }>; } | null>(null);
  // Post-sale print prompt
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [showPostSalePrompt, setShowPostSalePrompt] = useState<boolean>(false);
  // Consignments report by day
  const [consignmentsReportDate, setConsignmentsReportDate] = useState<string>('');
  // Cache for resolving user id -> display name
  const [userNameCache, setUserNameCache] = useState<Record<number, string>>({});

  const [newItem, setNewItem] = useState({
    name: '',
    unit_name: '',
    quantity: '' as number | '',
    drug_type: '',
    unit_price: '' as number | '',
    discount: '' as number | '',
    sales_instructions: '',
  });

  // Add Consignment (multi-line) form state
  const [addConsignment, setAddConsignment] = useState({
    supplier_name: '',
    total_paid: '' as string | '', // keep as string for backend format
    lines: [
      { itemId: '', batch_no: '', quantity: 1 as number | '', purchase_cost: '' as number | '', expiry_date: '' }
    ] as Array<{ itemId: string; batch_no: string; quantity: number | ''; purchase_cost: number | ''; expiry_date: string }>,
  });

  const [newSale, setNewSale] = useState({
    customer_name: '',
    lines: [
      { itemId: '', amount: 1, unitPrice: '' as number | '', discount: '' as number | '' },
    ] as Array<{ itemId: string; amount: number; unitPrice: number | ''; discount: number | '' }>,
  });

  const [stockForm, setStockForm] = useState({
    quantity: '' as number | '',
    unit_name: '',
    supplier_name: '',
    purchase_cost: '' as number | '',
    total_paid: '' as number | '',
    payment_type: 'cash' as 'cash' | 'mpesa' | string,
    purchase_date: '',
    expiry_date: '',
    batch_no: '',
    remainder: undefined as number | undefined,
  });

  const cleanErrorText = (input: unknown): string => {
    const s = (input ?? '').toString();
    const noTags = s.replace(/<[^>]*>/g, ' ');
    const compact = noTags.replace(/\s+/g, ' ').trim();
    return compact.length > 300 ? compact.slice(0, 300) + '…' : compact;
  };

  // Fetch a user's display name by id using best-effort endpoints and cache the result
  const fetchUserNameById = async (uid: number): Promise<string> => {
    if (!uid || !Number.isFinite(uid)) return '';
    if (userNameCache[uid]) return userNameCache[uid];
    const base = getApiBase();
    const endpoints = [
      `${base}/auth/user-detail/${uid}/`,
      `${base}/auth/user-detail/${uid}`,
      `${base}/users/${uid}/`,
      `${base}/users/${uid}`,
      `${base}/accounts/user-detail/${uid}/`,
    ];
    for (const url of endpoints) {
      try {
        const res = await authFetch(url, { method: 'GET' });
        const data = await res.json().catch(() => ({} as any));
        const name = resolveUploaderName(data) || '';
        if (res.ok && name && name !== '-') {
          setUserNameCache(prev => ({ ...prev, [uid]: name }));
          return name;
        }
      } catch { /* try next */ }
    }
    return '';
  };

  // Resolve a friendly uploader name from various possible API fields
  const resolveUploaderName = (obj: any): string => {
    // Direct common keys
    const direct = (
      obj?.uploader_name || obj?.uploaderName ||
      obj?.uploaded_by_name || obj?.admin_name || obj?.added_by_name ||
      obj?.uploader_info || obj?.uploaderInfo ||
      obj?.user_name || obj?.user_full_name || obj?.created_by_name || obj?.staff_name
    );
    if (direct) return String(direct);
    // Compose first/last name if present at top or nested
    const compose = (x: any) => {
      if (!x) return '';
      const first = (x.first_name || x.firstName || '').toString().trim();
      const last = (x.last_name || x.lastName || '').toString().trim();
      const full = [first, last].filter(Boolean).join(' ').trim();
      return full || (x.full_name || x.fullName || x.name || '').toString();
    };
    const nested1 = compose(obj);
    if (nested1) return nested1;
    const nested2 = compose(obj?.uploader_details) || compose(obj?.uploaderDetails) || compose(obj?.user) || compose(obj?.uploaderUser);
    if (nested2) return nested2;
    // Avoid synthetic fallback like "User #<id>"; prefer '-' if no readable name available
    return '-';
  };

  // Build printable HTML for a consignment detail
  const buildConsignmentPrintableHtml = (cons: any) => {
    const itemsRows = (Array.isArray(cons?.consignment_items) ? cons.consignment_items : []).map((it: any, i: number) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${(it.item_name || `#${it.item}`)}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${it.batch_no || '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${it.quantity}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${Number(it.purchase_cost || 0).toFixed(2)}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${it.expiry_date ? new Date(it.expiry_date).toLocaleDateString() : '-'}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Consignment-${cons?.id || ''}</title>
      <style>
        body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#111827}
        .header{ text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
        .title{ font-size:18px; font-weight:700 }
        table{ width:100%; border-collapse:collapse; font-size:12px }
        th,td{ text-align:left; padding:6px; border-bottom:1px solid #e5e7eb }
        th{ background:#f9fafb; font-weight:700 }
        .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin:8px 0 }
        .row{ display:flex; justify-content:space-between }
        .label{ font-weight:700 }
      </style>
    </head><body>
      <div class="header">
        <div class="title">Consignment #${cons?.id || '-'}</div>
        <div>${cons?.timestamp ? new Date(cons.timestamp).toLocaleString() : ''}</div>
      </div>
      <div class="grid">
        <div class="row"><span class="label">Supplier:</span> <span>${cons?.supplier_name || '-'}</span></div>
        <div class="row"><span class="label">Uploader:</span> <span>${(cons?.uploader_name || resolveUploaderName(cons) || '-')}</span></div>
        <div class="row"><span class="label">Purchase Cost:</span> <span>${Number(cons?.purchase_cost || 0).toFixed(2)}</span></div>
        <div class="row"><span class="label">Total Paid:</span> <span>${Number(cons?.total_paid || 0).toFixed(2)}</span></div>
        <div class="row"><span class="label">Balance:</span> <span>${Number(cons?.balance || 0).toFixed(2)}</span></div>
        <div class="row"><span class="label">Payment Status:</span> <span>${(cons?.payment_status || '-').toString()}</span></div>
      </div>
      <h4 style="margin-top:10px; font-weight:700">Items</h4>
      <table>
        <thead>
          <tr><th>#</th><th>Item</th><th>Batch</th><th>Qty</th><th>Cost</th><th>Expiry</th></tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </body></html>`;
    return html;
  };

  const printConsignmentDetail = () => {
    if (!consignmentDetail) { toast.error('No consignment loaded'); return; }
    const html = buildConsignmentPrintableHtml(consignmentDetail);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html + '<script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}<\/script>');
    win.document.close();
  };

  const openConsignmentPdf = () => {
    if (!consignmentDetail) { toast.error('No consignment loaded'); return; }
    const html = buildConsignmentPrintableHtml(consignmentDetail);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleOpenAddConsignment = () => {
    if (!canAddConsignment) { toast.error('You do not have permission to add consignments'); return; }
    setAddConsignment({
      supplier_name: '',
      total_paid: '',
      lines: [ { itemId: '', batch_no: '', quantity: 1, purchase_cost: '', expiry_date: '' } ],
    });
    setShowAddConsignmentForm(true);
  };

  const addConsignmentLine = () => {
    setAddConsignment(prev => ({
      ...prev,
      lines: [...prev.lines, { itemId: '', batch_no: '', quantity: 1, purchase_cost: '', expiry_date: '' }],
    }));
  };

  const removeConsignmentLine = (index: number) => {
    setAddConsignment(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitAddConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddConsignment) { toast.error('You do not have permission to add consignments'); return; }
    try {
      // Build payload
      const itemsBuilt = (addConsignment.lines || []).map((l) => {
        const selected = items.find(it => it.id === l.itemId);
        const qty = l.quantity === '' ? NaN : Number(l.quantity);
        const cost = l.purchase_cost === '' ? NaN : Number(l.purchase_cost);
        if (!selected || !l.batch_no.trim() || !l.expiry_date || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return null;
        return {
          item: Number(selected.id),
          batch_no: l.batch_no.trim(),
          quantity: Math.max(1, Number(qty) || 1),
          purchase_cost: (Number(cost) || 0).toFixed(2),
          expiry_date: l.expiry_date,
        };
      }).filter(Boolean) as Array<{ item: number; batch_no: string; quantity: number; purchase_cost: string; expiry_date: string }>;

      if (!addConsignment.supplier_name.trim()) { toast.error('Supplier name is required'); return; }
      if (itemsBuilt.length === 0) { toast.error('Add at least one valid consignment line'); return; }
      const totalPaidNum = addConsignment.total_paid === '' ? 0 : Number(addConsignment.total_paid);
      if (isNaN(totalPaidNum) || totalPaidNum < 0) { toast.error('Total paid must be a valid amount'); return; }

      const body = {
        supplier_name: addConsignment.supplier_name.trim(),
        total_paid: Number(totalPaidNum).toFixed(2),
        consignment_items: itemsBuilt,
      };
      await api.pharmacy.addConsignment(body as any);
      toast.success('Consignment recorded');
      setShowAddConsignmentForm(false);
      // Refresh consignments list
      try { await loadConsignments(); } catch {}
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  // Generate a PDF-like report window for consignments by a specific day
  const printConsignmentsByDayPDF = async () => {
    try {
      if (!consignmentsReportDate) { toast.error('Select a date'); return; }
      const base = getApiBase();
      const res = await authFetch(`${base}/finances/consignments-by-day`, { method: 'POST', body: JSON.stringify({ date: consignmentsReportDate }) });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const msg = (data && (data.message || data.error || data.detail)) || 'Failed to load consignments';
        throw new Error(msg);
      }
      const arr: any[] = Array.isArray(data?.consignments) ? data.consignments : [];
      const chargesSum = arr.reduce((sum, c) => sum + (parseFloat((c.purchase_cost ?? '0').toString()) || 0), 0);
      const paidSum = (typeof data?.total_paid_sum === 'number' ? data.total_paid_sum : parseFloat((data?.total_paid_sum ?? '0').toString()) || 0);
      const balanceSum = (typeof data?.balance_sum === 'number' ? data.balance_sum : parseFloat((data?.balance_sum ?? '0').toString()) || 0);
      const rows = arr.map((c: any, i: number) => {
        const batch = (c.batch_no || c.name || '-');
        const charges = parseFloat((c.purchase_cost ?? '0').toString()) || 0;
        const paid = parseFloat((c.total_paid ?? '0').toString()) || 0;
        const balance = (c.balance !== undefined && c.balance !== null) ? (parseFloat((c.balance ?? '0').toString()) || 0) : (charges - paid);
        return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.item_name || (c.item_details?.name) || '-'}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.quantity}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${batch}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.supplier_name || '-'}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${formatKES(charges)}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${formatKES(paid)}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${formatKES(balance)}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.purchase_date ? new Date(c.purchase_date).toLocaleDateString() : '-'}</td>
          </tr>`;
      }).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>Consignments Report - ${consignmentsReportDate}</title>
        <style>
          body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#111827}
          .header{ text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
          .title{ font-size:18px; font-weight:700 }
          table{ width:100%; border-collapse:collapse; font-size:12px }
          th,td{ text-align:left; padding:6px; border-bottom:1px solid #e5e7eb }
          th{ background:#f9fafb; font-weight:700 }
          .totals{ margin-top:12px; font-weight:700; font-size:14px; }
        </style>
      </head><body>
        <div class="header">
          <div class="title">Consignments Report - ${new Date(consignmentsReportDate).toLocaleDateString()}</div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Item</th><th>Quantity</th><th>Batch No</th><th>Supplier</th><th>Charges</th><th>Paid</th><th>Balance</th><th>Purchase Date</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">Total Charges: ${formatKES(chargesSum)}</div>
        <div class="totals">Total Paid: ${formatKES(paidSum)}</div>
        <div class="totals">Total Balance: ${formatKES(balanceSum)}</div>
        <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
      </body></html>`;
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  // Prefer explicit API base URL from env in both dev and prod; fallback to proxy in dev
  // Normalize to remove trailing slashes to prevent `//pharmacy/...`
  const getApiBase = () => {
    const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
    const normalizedEnv = (explicit && typeof explicit === 'string') ? explicit.trim().replace(/\/+$/, '') : '';
    if (normalizedEnv) return normalizedEnv;
    return import.meta.env.DEV ? '/api' : 'https://citimed-api.vercel.app';
  };

  

  // Load a sale detail without opening modal (for direct printing)
  const loadSaleDetailSilently = async (saleId: number) => {
    try {
      const base = getApiBase();
      let res = await authFetch(`${base}/pharmacy/sale-detail/${saleId}/`, { method: 'GET' });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/sale-detail/${saleId}/`, { method: 'GET' });
      const data = await res.json().catch(() => ({} as any));
      const sale = (data && (data.item || data.sale || null));
      if (!sale) throw new Error('Sale not found');
      const resolveNames = await Promise.all((Array.isArray(sale.items) ? sale.items : []).map(async (line: any) => {
        const localName = (() => {
          const found = items.find(i => Number(i.id) === Number(line.item));
          return found?.name || '';
        })();
        try {
          let res2 = await authFetch(`${base}/pharmacy/item-detail/${line.item}/`, { method: 'POST' });
          if (res2.status === 404 || res2.status === 405) res2 = await authFetch(`${base}/pharmacy/item-detail/${line.item}/`, { method: 'POST' });
          const d2 = await res2.json().catch(() => ({} as any));
          const itemName = d2?.item?.name || localName;
          return { ...line, item_name: itemName };
        } catch {
          return { ...line, item_name: localName };
        }
      }));
      const detail = {
        id: Number(sale.id),
        customer_name: sale.customer_name || 'Walk-in',
        total_amount: String(sale.total_amount || ''),
        timestamp: sale.timestamp || '',
        uploader_name: sale.uploader_name,
        items: resolveNames,
      };
      return detail;
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
      return null;
    }
  };

  const printReceiptBySaleId = async (saleId: number) => {
    const detail = await loadSaleDetailSilently(saleId);
    if (!detail) return;
    setSaleDetail(detail);
    // Use thermal receipt by default for quick printing
    printThermalReceipt();
  };

  const printPdfBySaleId = async (saleId: number) => {
    const detail = await loadSaleDetailSilently(saleId);
    if (!detail) return;
    setSaleDetail(detail);
    printSalePDF();
  };

  // Print only the Inventory table (respects current search/filter)
  const printInventoryList = () => {
    const rows = filteredInventoryItems.map((item, i) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${item.name}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${item.unitName || '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${formatKES(item.unitPrice || 0)}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${item.quantity}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Pharmacy Inventory</title>
      <style>
        body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#111827}
        .header{ text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
        .title{ font-size:18px; font-weight:700 }
        table{ width:100%; border-collapse:collapse; font-size:12px }
        th,td{ text-align:left; padding:6px; border-bottom:1px solid #e5e7eb }
        th{ background:#f9fafb; font-weight:700 }
      </style>
    </head><body>
      <div class="header">
        <div class="title">Pharmacy Inventory</div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Item Name</th><th>Unit Name</th><th>Unit Price</th><th>Quantity</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Print only the Consignments table (all consignments loaded)
  const printConsignmentsList = () => {
    const rows = consignments.map((c: any, i: number) => {
      const batch = (c.batch_no || c.name || '-');
      const charges = Number(c.purchase_cost || 0);
      const paid = Number(c.total_paid || 0);
      const balance = (c.remainder !== undefined && c.remainder !== null)
        ? Number(c.remainder || 0)
        : (charges - paid);
      return `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.item_name || (c.item_details?.name) || '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.quantity}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${batch}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.supplier_name || '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${canViewMoney ? charges.toFixed(2) : '—'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${canViewMoney ? paid.toFixed(2) : '—'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${canViewMoney ? balance.toFixed(2) : '—'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.purchase_date ? new Date(c.purchase_date).toLocaleDateString() : '-'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '-'}</td>
      </tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Pharmacy Consignments</title>
      <style>
        body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#111827}
        .header{ text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
        .title{ font-size:18px; font-weight:700 }
        table{ width:100%; border-collapse:collapse; font-size:12px }
        th,td{ text-align:left; padding:6px; border-bottom:1px solid #e5e7eb }
        th{ background:#f9fafb; font-weight:700 }
      </style>
    </head><body>
      <div class="header">
        <div class="title">Pharmacy Consignments</div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Item</th><th>Quantity</th><th>Batch No</th><th>Supplier</th><th>Charges</th><th>Paid</th><th>Balance</th><th>Purchase Date</th><th>Expiry</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
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
    // Prefer Token for this backend; fall back to Bearer
    let res = await doFetch('Token');
    if (res.status === 401 || res.status === 403) {
      const alt = await doFetch('Bearer');
      if (alt.ok) return alt;
      // If alt not ok, keep original response for caller to inspect status
    } else if (!res.ok) {
      const alt = await doFetch('Bearer');
      if (alt.ok) return alt;
      return res;
    }
    return res;
  };

  // Robust consignments loader (tries both URL variants)
  const loadConsignments = async () => {
    try {
      const base = getApiBase();
      const urls = [
        `${base}/pharmacy/consignments`,
        `${base}/pharmacy/consignments/`,
      ];
      for (const u of urls) {
        try {
          const res = await authFetch(u, { method: 'GET' });
          const data = await res.json().catch(() => ({} as any));
          const arr: any[] = Array.isArray(data?.inventories)
            ? data.inventories
            : (Array.isArray((data as any)?.consignments)
              ? (data as any).consignments
              : (Array.isArray((data as any)?.data) ? (data as any).data : []));
          if (res.ok) { setConsignments(arr); try { setCachedConsignments(arr); } catch {} return; }
        } catch { /* try next */ }
      }
      setConsignments([]);
    } catch { setConsignments([]); }
  };

  // Removed Low Stock feature per requirements

  const totalInventoryValue = items.reduce((sum, item) => sum + ((item.purchaseCost || 0) * item.quantity), 0);

  // Currency formatter for Kenyan Shillings (masked for non-superadmin)
  const formatKES = (value: number) => {
    if (!canViewMoney) return '—';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value || 0);
  };

  // Helper to open native date picker for inputs by id
  const openDatePicker = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    // Prefer showPicker if supported (Chrome/Edge)
    // @ts-ignore - showPicker is not in all TS lib.d.ts versions
    if (typeof el.showPicker === 'function') {
      // @ts-ignore
      el.showPicker();
    } else {
      // Fallback: focus + click to hint the picker where possible
      el.focus();
      el.click();
    }
  };

  // Fetch pharmacy items from backend and map to UI shape, with cache hydration
  useEffect(() => {
    const hydrateOrFetch = async () => {
      if (!cacheLoaded) return;
      // Hydrate from cache
      if (Array.isArray(cachedItems) && cachedItems.length > 0) {
        const apiItems: ApiItem[] = cachedItems as any;
        const mapped: PharmacyItem[] = (apiItems || []).map((it) => ({
          id: String(it.id),
          name: it.name,
          quantity: Math.max(0, parseInt(String((it as any).quantity || '0')) || 0),
          supplierName: (it as any).supplier_name || '',
          purchaseCost: typeof (it as any).purchase_cost === 'number' ? (it as any).purchase_cost : Number((it as any).purchase_cost || 0) || 0,
          paymentType: (it as any).payment_type || undefined,
          purchaseDate: (it as any).purchase_date || undefined,
          expiryDate: (it as any).expiry_date || undefined,
          unitName: (it as any).unit_name || '',
          unitPrice: Number((it as any).unit_price ?? 0) || 0,
          discount: Number((it as any).discount ?? 0) || 0,
          salesInstructions: (it as any).sales_instructions || '',
          dateCreated: (it as any).date_created || (it as any).timestamp || '',
        }));
        setItems(mapped);
        return;
      }
      // Fetch
      try {
        const base = getApiBase();
        const res = await authFetch(`${base}/pharmacy/all-items`, { method: 'GET' });
        const data = await res.json().catch(() => ({} as any));
        const apiItems: ApiItem[] = (data && (data.items || data.data || [])) as ApiItem[];
        const mapped: PharmacyItem[] = (apiItems || []).map((it) => ({
          id: String(it.id),
          name: it.name,
          quantity: Math.max(0, parseInt(String(it.quantity || '0')) || 0),
          supplierName: it.supplier_name || '',
          purchaseCost: typeof it.purchase_cost === 'number' ? it.purchase_cost : Number(it.purchase_cost || 0) || 0,
          paymentType: it.payment_type || undefined,
          purchaseDate: it.purchase_date || undefined,
          expiryDate: it.expiry_date || undefined,
          unitName: (it as any).unit_name || '',
          unitPrice: Number((it as any).unit_price ?? 0) || 0,
          discount: Number((it as any).discount ?? 0) || 0,
          salesInstructions: (it as any).sales_instructions || '',
          dateCreated: (it as any).date_created || (it as any).timestamp || '',
        }));
        setItems(mapped);
        try { setCachedItems(apiItems as any); } catch {}
      } catch (e) {
        // ignore
      }
    };
    hydrateOrFetch();
  }, [cacheLoaded]);

  // Fetch all consignments on mount with cache hydration
  useEffect(() => {
    if (!cacheLoaded) return;
    if (Array.isArray(cachedConsignments) && cachedConsignments.length > 0) {
      setConsignments(cachedConsignments as any);
      return;
    }
    loadConsignments();
  }, [cacheLoaded]);

  const openSaleDetail = async (saleId: number) => {
    try {
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
      let res = await authFetch(`${base}/pharmacy/sale-detail/${saleId}/`, { method: 'GET' });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/sale-detail/${saleId}/`, { method: 'GET' });
      const data = await res.json().catch(() => ({} as any));
      const sale = (data && (data.item || data.sale || null));
      if (!sale) throw new Error('Sale not found');
      // Resolve item names for each line via item-detail endpoint with local fallback
      const resolveNames = await Promise.all((Array.isArray(sale.items) ? sale.items : []).map(async (line: any) => {
        const localName = (() => {
          const found = items.find(i => Number(i.id) === Number(line.item));
          return (found?.name || '').toString();
        })();
        try {
          let res2 = await authFetch(`${base}/pharmacy/item-detail/${line.item}/`, { method: 'POST' });
          if (res2.status === 404 || res2.status === 405) res2 = await authFetch(`${base}/pharmacy/item-detail/${line.item}/`, { method: 'POST' });
          const d2 = await res2.json().catch(() => ({} as any));
          const itemName = (d2?.item?.name ?? localName ?? '').toString();
          return { ...line, item_name: itemName };
        } catch {
          return { ...line, item_name: localName };
        }
      }));
      setSaleDetail({
        id: Number(sale.id),
        customer_name: sale.customer_name || 'Walk-in',
        total_amount: String(sale.total_amount || ''),
        timestamp: sale.timestamp || '',
        uploader_name: sale.uploader_name,
        items: resolveNames,
      });
      setShowSaleDetail(true);
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  const downloadBlob = (content: BlobPart, filename: string, type = 'application/octet-stream') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printSalePDF = () => {
    if (!saleDetail) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const name = (saleDetail.customer_name || 'Walk-in').toString();
    const slugName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'walk-in';
    const dt = saleDetail.timestamp ? new Date(saleDetail.timestamp) : new Date();
    const stamp = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`;
    const rows = (saleDetail.items || []).map((l, i) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${l.item_name || `#${l.item}`}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${l.amount}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${l.total_price}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>${slugName}-sale-${saleDetail.id}-${stamp}</title>
      <style>
        body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:24px; color:#111827; background:#fff;}
        .wrap{max-width:640px; margin:0 auto; text-align:center;}
        .header{ margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
        .brand{ font-size:20px; font-weight:800; letter-spacing:0.5px; }
        .title{ font-size:16px; font-weight:700; margin-top:4px; }
        .meta{ font-size:12px; color:#4b5563; margin-top:2px; }
        table{ width:100%; border-collapse:collapse; font-size:12px; margin-top:12px; text-align:center; }
        th,td{ padding:8px 6px; border-bottom:1px solid #e5e7eb }
        th{ background:#f9fafb; font-weight:700 }
        .totals{ margin-top:12px; font-weight:700; font-size:14px; }
      </style>
    </head><body>
      <div class="wrap">
        <div class="header">
          <div class="brand">CITIMED PHARMACY</div>
          <div class="title">Receipt - Sale #${saleDetail.id}</div>
          <div class="meta">${saleDetail.timestamp ? new Date(saleDetail.timestamp).toLocaleString() : ''}</div>
        </div>
        <div class="meta"><b>Customer:</b> ${saleDetail.customer_name || 'Walk-in'}</div>
        <div class="meta"><b>Served by:</b> ${saleDetail.uploader_name || '—'}</div>
        <table>
          <thead>
            <tr><th>#</th><th>Item</th><th>Qty</th><th>Line Total</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">Total Amount: ${saleDetail.total_amount}</div>
      </div>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const downloadSaleCSV = () => {
    if (!saleDetail) return;
    const name = (saleDetail.customer_name || 'Walk-in').toString();
    const slugName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'walk-in';
    const dt = saleDetail.timestamp ? new Date(saleDetail.timestamp) : new Date();
    const stamp = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`;
    const header = 'line_id,item_id,item_name,amount,total_price\n';
    const rows = (saleDetail.items || []).map(l => `${l.id},${l.item},"${(l.item_name || '').replace(/"/g,'""')}",${l.amount},${l.total_price}`).join('\n');
    downloadBlob(header + rows, `${slugName}-sale-${saleDetail.id}-${stamp}.csv`, 'text/csv');
  };

  // Thermal receipt printing (80mm/58mm friendly)
  const printThermalReceipt = () => {
    if (!saleDetail) return;
    const widthMm = 80; // adjust to 58 if you use 58mm paper
    const name = (saleDetail.customer_name || 'Walk-in').toString();
    const slugName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'walk-in';
    const dt = saleDetail.timestamp ? new Date(saleDetail.timestamp) : new Date();
    const stamp = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`;
    const lines = (saleDetail.items || []).map((l) => {
      const qty = Number(l.amount || 0);
      const total = parseFloat((l.total_price || '0').toString()) || 0;
      const unit = qty > 0 ? (total / qty) : 0;
      return {
        name: (l.item_name || `#${l.item}`),
        qty,
        unit,
        total,
      };
    });
    const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
    const money = (v: number) => (v || 0).toFixed(2);
    const header = `CITIMED PHARMACY\nReceipt - Sale #${saleDetail.id}\n${saleDetail.timestamp ? new Date(saleDetail.timestamp).toLocaleString() : ''}\nCustomer: ${saleDetail.customer_name || 'Walk-in'}\nServed by: ${saleDetail.uploader_name || '—'}\n--------------------------------`;
    const body = lines.map(li => {
      const name = li.name.replace(/\s+/g, ' ');
      const line1 = name + '\n';
      const line2 = `${pad('  x' + li.qty, 6)} @${pad(money(li.unit), 8)} = ${pad(money(li.total), 10)}\n`;
      return line1 + line2;
    }).join('');
    const total = (saleDetail.items || []).reduce((sum, l) => sum + (parseFloat((l.total_price || '0').toString()) || 0), 0);
    const footer = `--------------------------------\nTOTAL: ${money(total)}\n\nThank you!\n`;
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>${slugName}-sale-${saleDetail.id}-${stamp}</title>
      <style>
        @page { size: ${widthMm}mm auto; margin: 5mm; }
        body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; width: ${widthMm}mm; margin: 0; text-align:center; }
        pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; line-height: 1.3; margin: 0; text-align:center; }
      </style>
    </head><body>
      <pre>${header + '\n' + body + footer}</pre>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Fetch pharmacy sales from backend with cache hydration
  useEffect(() => {
    const fetchSales = async () => {
      if (!cacheLoaded) return;
      // Hydrate from cache first
      const hydrate = (apiSales: any[]) => {
        const mapped: Sale[] = (apiSales || []).map((s) => {
          const parsedTotal = (() => {
            const t = (s.total_amount ?? '').toString();
            const n = parseFloat(t);
            if (!isNaN(n) && isFinite(n)) return n;
            // Fallback: sum line totals
            if (Array.isArray(s.items)) {
              const sum = s.items.reduce((acc: number, it: any) => acc + (parseFloat((it.total_price ?? '0').toString()) || 0), 0);
              return sum;
            }
            return 0;
          })();
          const itemCount = Array.isArray(s.items) ? s.items.reduce((n: number, it: any) => n + (parseInt(String(it.amount || '0')) || 0), 0) : 0;
          return {
            id: String(s.id),
            customerName: s.customer_name || 'Walk-in',
            itemCount,
            totalAmount: parsedTotal,
            timestamp: s.timestamp || '',
          };
        });
        // Sort newest-first on initial load as well
        const sorted = (mapped || []).slice().sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
        });
        setSales(sorted);
      };
      try {
        if (Array.isArray(cachedSales) && cachedSales.length > 0) {
          hydrate(cachedSales as any);
          return;
        }
        const base = getApiBase();
        let res = await authFetch(`${base}/pharmacy/all-sales`, { method: 'GET' });
        if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/all-sales/`, { method: 'GET' });
        const data = await res.json().catch(() => ({} as any));
        const apiSales: any[] = (data && (data.items || data.data || [])) as any[];
        hydrate(apiSales);
        try { setCachedSales(apiSales as any); } catch {}
      } catch {
        // keep empty sales on error
      }
    };
    fetchSales();
  }, [cacheLoaded]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsePharmacy) { toast.error('You do not have permission for pharmacy'); return; }
    try {
      const base = getApiBase();
      const body = {
        uploader: Number(user?.id || 0) || undefined,
        name: (newItem.name || '').trim(),
        quantity: newItem.quantity === '' ? undefined : Math.max(0, Number(newItem.quantity) || 0),
        unit_name: (newItem.unit_name || '').trim(),
        unit_price: newItem.unit_price === '' ? undefined : (Number(newItem.unit_price).toFixed(2)),
        discount: newItem.discount === '' ? undefined : (Number(newItem.discount).toFixed(2)),
        sales_instructions: (newItem.sales_instructions || '').trim(),
      };
      let res = await authFetch(`${base}/pharmacy/add-item`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/add-item/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        const rawMsg = (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        throw new Error(cleanErrorText(rawMsg) || `Failed to add item (status ${res.status})`);
      }
      toast.success('Item added to pharmacy');
      setShowAddItemForm(false);
      setNewItem({ name: '', unit_name: '', quantity: '', drug_type: '', unit_price: '', discount: '', sales_instructions: '' });
      // Refresh items after successful add
      try {
        const base2 = getApiBase();
        const res2 = await authFetch(`${base2}/pharmacy/all-items`, { method: 'GET' });
        const data2 = await res2.json().catch(() => ({} as any));
        const apiItems2: ApiItem[] = (data2 && (data2.items || data2.data || [])) as ApiItem[];
        const mapped2: PharmacyItem[] = (apiItems2 || []).map((it) => ({
          id: String(it.id),
          name: it.name,
          quantity: Math.max(0, parseInt(String(it.quantity || '0')) || 0),
          supplierName: it.supplier_name || '',
          purchaseCost: typeof it.purchase_cost === 'number' ? it.purchase_cost : Number(it.purchase_cost || 0) || 0,
          paymentType: it.payment_type || undefined,
          purchaseDate: it.purchase_date || undefined,
          expiryDate: it.expiry_date || undefined,
          unitName: (it as any).unit_name || '',
          unitPrice: Number((it as any).unit_price ?? 0) || 0,
          discount: Number((it as any).discount ?? 0) || 0,
          salesInstructions: (it as any).sales_instructions || '',
          dateCreated: (it as any).date_created || (it as any).timestamp || '',
        }));
        setItems(mapped2);
      } catch {}
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  const handleOpenStockForm = (item: PharmacyItem) => {
    if (!canUsePharmacy) { toast.error('You do not have permission for pharmacy'); return; }
    setStockItemId(item.id);
    setStockForm({
      quantity: '' as number | '',
      unit_name: '',
      supplier_name: item.supplierName || '',
      purchase_cost: '' as number | '',
      total_paid: '' as number | '',
      payment_type: 'cash',
      purchase_date: '',
      expiry_date: '',
      batch_no: '',
      remainder: undefined,
    });
    setShowStockForm(true);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsePharmacy) { toast.error('You do not have permission for pharmacy'); return; }
    const idNum = Number(stockItemId || '');
    if (!idNum) { toast.error('Invalid item'); return; }
    try {
      const base = getApiBase();
      const body: any = {
        quantity: stockForm.quantity === '' ? undefined : Math.max(0, Number(stockForm.quantity) || 0),
        unit_name: (stockForm.unit_name || '') || null,
        supplier_name: (stockForm.supplier_name || '').trim(),
        purchase_cost: stockForm.purchase_cost === '' ? undefined : Number(stockForm.purchase_cost) || 0,
        total_paid: stockForm.total_paid === '' ? undefined : Number(stockForm.total_paid) || 0,
        payment_type: (stockForm.payment_type || 'cash').toLowerCase(),
        purchase_date: (stockForm.purchase_date || '').trim(),
        expiry_date: (stockForm.expiry_date || '').trim(),
        batch_no: (stockForm.batch_no || '').trim(),
        uploader: Number(user?.id || 0) || undefined,
      };
      if (stockForm.remainder !== undefined) body.remainder = Number(stockForm.remainder) || 0;
      // Try both URL variants to be resilient to backend routing with/without trailing slash
      let res = await authFetch(`${base}/pharmacy/update-item-stock/${idNum}/`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) {
        res = await authFetch(`${base}/pharmacy/update-item-stock/${idNum}`, { method: 'POST', body: JSON.stringify(body) });
      }
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        const rawMsg = (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        throw new Error(cleanErrorText(rawMsg) || `Failed to update stock (status ${res.status})`);
      }
      toast.success('Stock updated');
      setShowStockForm(false);
      // Refresh items after stock update using item-details then all-items for fresh quantities
      try {
        const base2 = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const res2 = await authFetch(`${base2}/pharmacy/all-items`, { method: 'GET' });
        const data2 = await res2.json().catch(() => ({} as any));
        const apiItems2: ApiItem[] = (data2 && (data2.items || data2.data || [])) as ApiItem[];
        const mapped2: PharmacyItem[] = (apiItems2 || []).map((it) => ({
          id: String(it.id),
          name: it.name,
          quantity: Math.max(0, parseInt(String(it.quantity || '0')) || 0),
          supplierName: it.supplier_name || '',
          purchaseCost: typeof it.purchase_cost === 'number' ? it.purchase_cost : Number(it.purchase_cost || 0) || 0,
          paymentType: it.payment_type || undefined,
          purchaseDate: it.purchase_date || undefined,
          expiryDate: it.expiry_date || undefined,
          unitName: (it as any).unit_name || '',
          unitPrice: Number((it as any).unit_price ?? 0) || 0,
          discount: Number((it as any).discount ?? 0) || 0,
          salesInstructions: (it as any).sales_instructions || '',
          dateCreated: (it as any).date_created || (it as any).timestamp || '',
        }));
        setItems(mapped2);
      } catch {}
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  const openItemConsignments = async (item: PharmacyItem) => {
    if (!canUsePharmacy) { toast.error('You do not have permission for pharmacy'); return; }
    try {
      const base = getApiBase();
      const res = await authFetch(`${base}/pharmacy/item-consignments/${item.id}/`, { method: 'GET' });
      const data = await res.json().catch(() => ({} as any));
      setConsignmentsItemName((data && (data.item || item.name)) || item.name);
      setItemConsignments(Array.isArray(data?.consignments) ? data.consignments : []);
      setShowItemConsignments(true);
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  const openConsignmentDetail = async (consignmentId: number) => {
    try {
      const base = getApiBase();
      // Try both URL variants and both methods (some backends require GET)
      const urls = [
        `${base}/pharmacy/consignment-detail/${consignmentId}/`,
        `${base}/pharmacy/consignment-detail/${consignmentId}`,
      ];
      const methods: Array<'GET' | 'POST'> = ['GET', 'POST'];
      for (const u of urls) {
        for (const method of methods) {
          try {
            const res = await authFetch(u, { method });
            const text = await res.text().catch(() => '');
            let data: any = {};
            try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
            const inv = (data && (data.inventory || data.consignment || data)) as any;
            if (res.ok && inv && (inv.id || Array.isArray(inv.consignment_items))) {
              // If API didn't include a human uploader_name, and this consignment's uploader matches
              // the currently logged-in user, fill it from user context so the UI shows a name.
              try {
                if (!resolveUploaderName(inv) || resolveUploaderName(inv) === '-') {
                  const uid = Number(inv?.uploader);
                  const curId = Number((user as any)?.id);
                  if (uid && curId && uid === curId) {
                    const first = (((user as any)?.first_name) || (user as any)?.firstName || '').toString().trim();
                    const last = (((user as any)?.last_name) || (user as any)?.lastName || '').toString().trim();
                    const full = [first, last].filter(Boolean).join(' ').trim() || (((user as any)?.full_name) || (user as any)?.fullName || (user as any)?.name || (user as any)?.username || '').toString();
                    if (full) (inv as any).uploader_name = full;
                  }
                  // If still no name, try fetching by uid and populate
                  if ((!inv as any)?.uploader_name || resolveUploaderName(inv) === '-') {
                    const uid2 = Number(inv?.uploader);
                    if (uid2) {
                      const fetched = await fetchUserNameById(uid2);
                      if (fetched) (inv as any).uploader_name = fetched;
                    }
                  }
                }
              } catch { /* ignore name fill errors */ }
              setConsignmentDetail(inv);
              setShowConsignmentDetail(true);
              return;
            }
            // If 404/405 on this combo, continue to next combination
            if (res.status === 404 || res.status === 405) continue;
            // For 401/403, surface a clearer message and stop trying further methods on same URL
            if (res.status === 401 || res.status === 403) {
              toast.error('Not authorized to view this consignment. Please ensure you are logged in with the correct permissions.');
              continue;
            }
          } catch { /* try next method/url */ }
        }
      }
      throw new Error('Consignment not found');
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  // Derive correct consignment id from a table row and open detail
  const openConsignmentDetailFromRow = async (row: any) => {
    // Common fields seen from various list endpoints
    const candidates = [
      row?.consignment_id,
      row?.parent,
      row?.consignment,
      row?.inventory_parent_id,
      row?.inventory_id_parent,
      row?.id,
    ]
      .map((v: any) => Number(v))
      .filter((n: any) => Number.isFinite(n) && n > 0) as number[];
    if (candidates.length === 0) {
      toast.error('Unable to resolve consignment id');
      return;
    }
    for (const id of candidates) {
      try {
        await openConsignmentDetail(id);
        return;
      } catch { /* try next candidate */ }
    }
    toast.error('Consignment not found');
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsePharmacy) { toast.error('You do not have permission for pharmacy'); return; }
    try {
      // Build items from multiple lines
      const builtLines = (newSale.lines || []).map(l => {
        const selectedItem = items.find(item => item.id === l.itemId);
        const qty = Math.max(1, Number(l.amount) || 1);
        const unit = l.unitPrice === '' ? NaN : Number(l.unitPrice);
        if (!selectedItem || isNaN(unit)) return null;
        const disc = l.discount === '' ? 0 : Number(l.discount);
        const total = Math.max(0, (unit * qty) - disc);
        return { item: Number(selectedItem.id), amount: qty, total_price: total.toFixed(2) };
      }).filter(Boolean) as Array<{ item: number; amount: number; total_price: string }>;
      if (builtLines.length === 0) { toast.error('Add at least one valid item'); return; }
      const totalAmount = builtLines.reduce((sum, l) => sum + (parseFloat(l.total_price) || 0), 0).toFixed(2);
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
      const body = {
        customer_name: (newSale.customer_name || 'Walk-in').trim() || 'Walk-in',
        items: builtLines,
        total_amount: totalAmount,
      };
      let res = await authFetch(`${base}/pharmacy/add-sale`, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 404 || res.status === 405) res = await authFetch(`${base}/pharmacy/add-sale/`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(async () => ({ raw: cleanErrorText(await res.text().catch(()=> '')) }));
      if (!res.ok) {
        const rawMsg = (data && (data.message || data.error || data.detail || (data as any).raw)) || '';
        throw new Error(cleanErrorText(rawMsg) || `Failed to add sale (status ${res.status})`);
      }
      // Determine new sale id from response to enable quick printing
      const newId: number | null = (Number((data?.Sale?.id ?? data?.sale?.id ?? data?.id ?? 0)) || null);
      toast.success('Sale recorded');
      setShowSaleForm(false);
      setNewSale({ customer_name: '', lines: [{ itemId: '', amount: 1, unitPrice: '', discount: '' }] });
      // Auto-print immediately for speed; avoid extra prompt
      if (newId) {
        setLastSaleId(newId);
        setShowPostSalePrompt(false);
        // Fire and forget: load and print thermal receipt fast
        printReceiptBySaleId(newId);
      } else {
        setLastSaleId(null);
        setShowPostSalePrompt(false);
      }
      // Refresh sales after successful add
      try {
        const base2 = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        let res2 = await authFetch(`${base2}/pharmacy/all-sales`, { method: 'GET' });
        if (res2.status === 404 || res2.status === 405) res2 = await authFetch(`${base2}/pharmacy/all-sales/`, { method: 'GET' });
        const data2 = await res2.json().catch(() => ({} as any));
        const apiSales2: any[] = (data2 && (data2.items || data2.data || [])) as any[];
        const mapped2: Sale[] = (apiSales2 || []).map((s) => {
          const parsedTotal = (() => {
            const t = (s.total_amount ?? '').toString();
            const n = parseFloat(t);
            if (!isNaN(n) && isFinite(n)) return n;
            if (Array.isArray(s.items)) {
              const sum = s.items.reduce((acc: number, it: any) => acc + (parseFloat((it.total_price ?? '0').toString()) || 0), 0);
              return sum;
            }
            return 0;
          })();
          const itemCount = Array.isArray(s.items) ? s.items.reduce((n: number, it: any) => n + (parseInt(String(it.amount || '0')) || 0), 0) : 0;
          return {
            id: String(s.id),
            customerName: s.customer_name || 'Walk-in',
            itemCount,
            totalAmount: parsedTotal,
            timestamp: s.timestamp || '',
          };
        });
        // Ensure newest appear first by timestamp (fallback by id desc)
        const sorted2 = (mapped2 || []).slice().sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
        });
        setSales(sorted2);
      } catch {}
    } catch (e) {
      toast.error(cleanErrorText((e as Error).message));
    }
  };

  // Simple print utility for individual item
  const printItem = (item: PharmacyItem) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = `<!doctype html><html><head><title>Print Item</title>
      <style>body{font-family:Arial,sans-serif;padding:24px} h1{font-size:18px;margin-bottom:12px} table{border-collapse:collapse;width:100%} td{padding:8px;border:1px solid #ccc}</style>
      </head><body>
      <h1>Pharmacy Item</h1>
      <table>
        <tr><td><b>Name</b></td><td>${item.name}</td></tr>
        <tr><td><b>Quantity</b></td><td>${item.quantity}</td></tr>
      </table>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
      </body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Filters
  const [inventoryFilter, setInventoryFilter] = useState<'all'>('all');
  const [salesRange, setSalesRange] = useState<'today' | 'week' | 'all'>('all');
  const [consignmentPayFilter, setConsignmentPayFilter] = useState<'all' | 'pending' | 'partial' | 'full'>('all');

  const filteredInventoryItems = (items || [])
    .filter((item) => {
      const q = (searchTerm || '').toString().toLowerCase();
      if (!q) return true;
      const name = (item?.name || '').toString().toLowerCase();
      const supplier = (item?.supplierName || '').toString().toLowerCase();
      return name.includes(q) || supplier.includes(q);
    });

  const salesFilteredBySearch = (sales || [])
    .filter((s) => {
      const q = (searchTerm || '').toString().toLowerCase();
      if (!q) return true;
      const idMatch = (s?.id || '').toString().toLowerCase().includes(q);
      const dateStr = s?.timestamp ? new Date(s.timestamp).toLocaleString().toLowerCase() : '';
      const dateMatch = dateStr.includes(q);
      return idMatch || dateMatch;
    });
  const salesDisplayed = (() => {
    // Always show newest first
    const baseSorted = salesFilteredBySearch.slice().sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
    });
    if (salesRange === 'all') return baseSorted;
    const now = new Date();
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0,0,0,0);
    const day = startOfWeek.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    if (salesRange === 'today') return baseSorted.filter(s => s.timestamp && isSameDay(new Date(s.timestamp), now));
    return baseSorted.filter(s => s.timestamp && new Date(s.timestamp) >= startOfWeek && new Date(s.timestamp) <= now);
  })();

  // Consignments filtered by search (item name, supplier, or payment type)
  // Consignments filtered by search (item name, batch, supplier) and payment status (pending/partial/full)
  const consignmentsFiltered: any[] = (consignments || []).filter((c: any) => {
    const q = (searchTerm || '').toString().toLowerCase();
    const itemName = (c?.item_name || c?.item_details?.name || '').toString().toLowerCase();
    const supplier = (c?.supplier_name || '').toString().toLowerCase();
    const batch = (c?.batch_no || c?.name || '').toString().toLowerCase();
    const charges = Number(c?.purchase_cost || 0);
    const paid = Number(c?.total_paid || 0);
    const balance = (c?.remainder !== undefined && c?.remainder !== null) ? Number(c?.remainder || 0) : (charges - paid);
    const status: 'pending' | 'partial' | 'full' = (() => {
      if (paid <= 0) return 'pending';
      if (balance <= 0) return 'full';
      return 'partial';
    })();
    const textMatch = !q || itemName.includes(q) || supplier.includes(q) || batch.includes(q);
    const statusMatch = (consignmentPayFilter === 'all') || (status === consignmentPayFilter);
    return textMatch && statusMatch;
  });

  // Print only the Sales table (not the whole page)
  const printSalesList = () => {
    const rows = salesDisplayed.map((s, i) => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${(s as any).itemCount}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${canViewMoney ? (s as any).totalAmount : '—'}</td>
        <td style="padding:6px;border-bottom:1px solid #e5e7eb">${(s as any).timestamp ? new Date((s as any).timestamp).toLocaleString() : '-'}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Pharmacy Sales</title>
      <style>
        body{font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#111827}
        .header{ text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb }
        .title{ font-size:18px; font-weight:700 }
        table{ width:100%; border-collapse:collapse; font-size:12px }
        th,td{ text-align:left; padding:6px; border-bottom:1px solid #e5e7eb }
        th{ background:#f9fafb; font-weight:700 }
      </style>
    </head><body>
      <div class="header">
        <div class="title">Pharmacy Sales</div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Items</th><th>Total</th><th>Date</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const getStockStatusColor = (item: PharmacyItem) => {
    if (item.quantity < 4) {
      return 'text-red-600';
    } else if (item.quantity <= 10) {
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hero Banner */}
      {!(showAddItemForm || showSaleForm || showStockForm || showAddConsignmentForm) && (
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
              <h2 className="text-2xl md:text-3xl font-bold">Pharmacy Management</h2>
              <p className="mt-2 text-sm md:text-base text-blue-100">Manage inventory, stock updates, and sales linked to patient visits</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => canUsePharmacy ? (setShowAddItemForm(true), setShowSaleForm(false)) : toast.error('No pharmacy permission')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Add Item</span>
              </button>
              <button
                onClick={() => canUsePharmacy ? (setShowSaleForm(true), setShowAddItemForm(false)) : toast.error('No pharmacy permission')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <span>New Sale</span>
              </button>
              {canAddConsignment && (
                <button
                  onClick={handleOpenAddConsignment}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                >
                  Add Consignment
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
      </div>
      )}

      {/* Add Consignment Form */}
      {showAddConsignmentForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">Add Consignment</h3>
              <button onClick={() => setShowAddConsignmentForm(false)} className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white">Back</button>
            </div>
          </div>
          <form onSubmit={handleSubmitAddConsignment} className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  value={addConsignment.supplier_name}
                  onChange={(e) => setAddConsignment({ ...addConsignment, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Paid</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addConsignment.total_paid}
                  onChange={(e) => setAddConsignment({ ...addConsignment, total_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-md font-semibold text-gray-900">Consignment Items</h4>
                <button type="button" onClick={addConsignmentLine} className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Add Line</button>
              </div>
              <div className="space-y-4">
                {addConsignment.lines.map((ln, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end border p-3 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                      <select
                        value={ln.itemId}
                        onChange={(e) => setAddConsignment(prev => ({ ...prev, lines: prev.lines.map((l, i) => i === idx ? { ...l, itemId: e.target.value } : l) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Item…</option>
                        {items.map(it => (
                          <option key={it.id} value={it.id}>{it.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batch No</label>
                      <input
                        type="text"
                        value={ln.batch_no}
                        onChange={(e) => setAddConsignment(prev => ({ ...prev, lines: prev.lines.map((l, i) => i === idx ? { ...l, batch_no: e.target.value } : l) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., BATCH-001"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={ln.quantity}
                        onChange={(e) => setAddConsignment(prev => ({ ...prev, lines: prev.lines.map((l, i) => i === idx ? { ...l, quantity: (e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1)) } : l) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ln.purchase_cost}
                        onChange={(e) => setAddConsignment(prev => ({ ...prev, lines: prev.lines.map((l, i) => i === idx ? { ...l, purchase_cost: (e.target.value === '' ? '' : Number(e.target.value)) } : l) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                      <input
                        id={`expiry_${idx}`}
                        type="date"
                        value={ln.expiry_date}
                        onChange={(e) => setAddConsignment(prev => ({ ...prev, lines: prev.lines.map((l, i) => i === idx ? { ...l, expiry_date: e.target.value } : l) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div className="flex gap-2 md:justify-end">
                      <button type="button" onClick={() => removeConsignmentLine(idx)} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddConsignmentForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Save Consignment</button>
            </div>
          </form>
        </div>
      )}
      {!(showAddItemForm || showSaleForm || showStockForm) && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTab === 'sales' && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sales Value</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatKES((salesDisplayed || []).reduce((sum, s) => sum + (Number((s as any).totalAmount) || 0), 0))}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <ShoppingCartIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-semibold text-gray-900">{(salesDisplayed || []).length}</p>
                </div>
              </div>
            </div>
          </>
        )}
        {activeTab === 'inventory' && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
                </div>
              </div>
            </div>
          </>
        )}
        {activeTab === 'consignments' && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ShoppingCartIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Consignments</p>
                  <p className="text-2xl font-semibold text-gray-900">{consignments.length}</p>
                </div>
              </div>
            </div>
          </>
        )}
        {/* Low Stock KPI removed */}
      </div>
      )}

      {/* Sale Detail Modal */}
      {showSaleDetail && saleDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Sale #{saleDetail.id}</h3>
              <button onClick={() => setShowSaleDetail(false)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Close</button>
            </div>
            <div className="space-y-1 text-sm text-gray-700 mb-4">
              <div><span className="font-medium">Customer:</span> {saleDetail.customer_name}</div>
              <div><span className="font-medium">Total:</span> {formatKES(Number(saleDetail.total_amount || 0))}</div>
              <div><span className="font-medium">Items:</span> {(saleDetail.items || []).reduce((sum, l) => sum + (parseInt(String(l.amount || '0')) || 0), 0)}</div>
              <div><span className="font-medium">Date:</span> {saleDetail.timestamp ? new Date(saleDetail.timestamp).toLocaleString() : '-'}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {saleDetail.items.map((l, i) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{l.item_name || `#${l.item}`}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{l.amount}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatKES(Number(l.total_price || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={downloadSaleCSV} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Download CSV</button>
              <button onClick={printSalePDF} className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded">Download PDF</button>
              <button onClick={printThermalReceipt} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Sale Prompt Modal */}
      {showPostSalePrompt && lastSaleId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setShowPostSalePrompt(false); printReceiptBySaleId(lastSaleId); } }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Sale Recorded</h3>
              <button onClick={() => setShowPostSalePrompt(false)} className="px-2 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Close</button>
            </div>
            <p className="text-sm text-gray-700 mb-4">Would you like to print the receipt now?</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                autoFocus
                onClick={() => { setShowPostSalePrompt(false); printReceiptBySaleId(lastSaleId); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                title="Press Enter to print"
              >
                Print Now
              </button>
              <button onClick={() => { setShowPostSalePrompt(false); printPdfBySaleId(lastSaleId); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded">Print PDF</button>
              <button onClick={() => { setShowPostSalePrompt(false); openSaleDetail(lastSaleId); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Open Details</button>
            </div>
          </div>
        </div>
      )}

      {!(showAddItemForm || showSaleForm || showStockForm) && (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-3 px-6 py-3">
            {[
              { id: 'inventory', name: 'Item', count: items.length, color: 'bg-green-100 text-green-700 border-green-400' },
              { id: 'sales', name: 'Sales', count: sales.length, color: 'bg-blue-100 text-blue-700 border-blue-400' },
              { id: 'consignments', name: 'Inventory', count: consignments.length, color: 'bg-purple-100 text-purple-700 border-purple-400' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 rounded-full text-sm font-medium border ${tab.color} ${activeTab === tab.id ? 'ring-2 ring-offset-1 ring-black/5' : 'opacity-80 hover:opacity-100'}`}
              >
                {tab.name} ({tab.count})
              </button>
            ))}
          </nav>
        </div>

    <div className="p-6">
          {/* Search */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'sales' ? 'Search sales by ID or date…' : 'Search items by name or supplier…'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'inventory' && (
                <>
                  <select value={inventoryFilter} onChange={(e) => setInventoryFilter(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="all">All Items</option>
                  </select>
                  <button onClick={printInventoryList} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">Print Items</button>
                </>
              )}
              {activeTab === 'sales' && (
                <>
                  <select value={salesRange} onChange={(e) => setSalesRange(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="all">All Time</option>
                    <option value="week">This Week</option>
                    <option value="today">Today</option>
                  </select>
                  <button onClick={printSalesList} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Print Sales</button>
                </>
              )}
              {activeTab === 'consignments' && (
                <>
                  <select
                    value={consignmentPayFilter}
                    onChange={(e) => setConsignmentPayFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="full">Full</option>
                  </select>
                  <div className="relative inline-flex items-center">
                    <input
                      id="consignments_report_date"
                      type="date"
                      value={consignmentsReportDate}
                      onChange={(e) => setConsignmentsReportDate(e.target.value)}
                      className="px-3 pr-9 py-2 border border-gray-300 rounded-lg"
                      aria-label="Consignments report date"
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker('consignments_report_date')}
                      className="absolute right-1 text-gray-500 hover:text-gray-700"
                      title="Open calendar"
                      aria-label="Open calendar"
                    >
                      <CalendarDaysIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={printConsignmentsByDayPDF}
                    className="px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
                    title="Generate PDF report for selected day"
                  >
                    PDF Report
                  </button>
                  <button onClick={printConsignmentsList} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Print Consignments</button>
                </>
              )}
            </div>
          </div>

          {/* Low Stock Tab removed */}
          {/* Consignments Tab */}
          {activeTab === 'consignments' && (
            <div className="overflow-x-auto">
              {consignments.length === 0 ? (
                <div className="p-6 text-sm text-gray-600 flex items-center justify-between">
                  <span>No consignments found. Ensure you have added stock (consignments) and you are authenticated.</span>
                  <button onClick={loadConsignments} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded">Retry</button>
                </div>
              ) : (
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consignmentsFiltered.map((c: any, idx: number) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.timestamp ? new Date(c.timestamp).toLocaleString() : (c.purchase_date ? new Date(c.purchase_date).toLocaleDateString() : '-')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.supplier_name || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatKES(Number(c.purchase_cost || 0))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatKES(Number(c.total_paid || 0))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatKES((c.balance !== undefined && c.balance !== null)
                        ? Number(c.balance)
                        : ((c.remainder !== undefined && c.remainder !== null)
                          ? Number(c.remainder || 0)
                          : (Number(c.purchase_cost || 0) - Number(c.total_paid || 0))))}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(c.payment_status || '-').toString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openConsignmentDetailFromRow(c)}
                          className="inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 p-2"
                          aria-label="View consignment"
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4 text-white" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              )}
            </div>
          )}
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInventoryItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.unitName || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatKES(item.unitPrice || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => { setSelectedItem(item); setShowViewItem(true); }}
                          className="inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 p-2"
                          aria-label="View item"
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4 text-white" />
                        </button>
                        <button
                          onClick={() => handleOpenStockForm(item)}
                          className="inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 p-2"
                          aria-label="Add stock"
                          title="Stock"
                        >
                          <PlusIcon className="h-4 w-4 text-white" />
                        </button>
                        <button
                          onClick={() => openItemConsignments(item)}
                          className="inline-flex items-center justify-center rounded-full bg-yellow-500 hover:bg-yellow-600 p-2"
                          aria-label="View consignments"
                          title="Consignments"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4 text-white" />
                        </button>
                        <button
                          onClick={() => printItem(item)}
                          className="inline-flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-800 p-2"
                          aria-label="Print item"
                          title="Print"
                        >
                          <PrinterIcon className="h-4 w-4 text-white" />
                        </button>
                        <button
                          onClick={() => { setSelectedItem(item); setShowDeleteItem(true); }}
                          className="inline-flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 p-2"
                          aria-label="Delete item"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4 text-white" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === 'sales' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesDisplayed.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.itemCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatKES(s.totalAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.timestamp ? new Date(s.timestamp).toLocaleString() : '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openSaleDetail(Number(s.id))}
                          className="inline-flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 p-2"
                          aria-label="View sale"
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4 text-white" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Add Item - In-Page Full Width Section (matches Patients page style) */}
      {showAddItemForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">Add New Item</h3>
              <button
                onClick={() => { setShowAddItemForm(false); if (window.history.length > 1) window.history.back(); }}
                className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
              >
                Back
              </button>
            </div>
          </div>
          <div className="px-4 py-4 md:px-6">
            <form onSubmit={handleAddItem} className="space-y-4 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name</label>
                  <select
                    value={newItem.unit_name}
                    onChange={(e) => setNewItem({ ...newItem, unit_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Unit</option>
                    <option value="tablets">Tablets</option>
                    <option value="syrup">Syrup</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.discount}
                    onChange={(e) => setNewItem({ ...newItem, discount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sales Instructions</label>
                  <textarea
                    rows={3}
                    value={newItem.sales_instructions}
                    onChange={(e) => setNewItem({ ...newItem, sales_instructions: e.target.value })}
                    placeholder="e.g., Only sell in strips for ksh.20 per pair"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddItemForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
          </div>
      )}

      {/* New Sale - In-Page Full Width Section */}
      {showSaleForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">New Sale</h3>
              <button
                onClick={() => { setShowSaleForm(false); if (window.history.length > 1) window.history.back(); }}
                className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
              >
                Back
              </button>
            </div>
          </div>
          <div className="px-4 py-4 md:px-6">
            <form onSubmit={handleAddSale} className="space-y-4 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 gap-4">
                

                {/* Sale Lines */}
                <div className="space-y-3">
                  {(newSale.lines || []).map((line, idx) => {
                    const qty = Math.max(1, Number(line.amount) || 1);
                    const unit = line.unitPrice === '' ? 0 : Number(line.unitPrice);
                    const lineDiscount = line.discount === '' ? 0 : Number(line.discount);
                    const total = Math.max(0, (unit * qty) - lineDiscount);
                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-lg p-3">
                        <div className="md:col-span-6">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                          <select
                            required
                            value={line.itemId}
                            onChange={(e) => {
                              const id = e.target.value;
                              const selected = items.find(it => it.id === id);
                              const defaultDiscount = (selected && typeof selected.discount === 'number') ? selected.discount : 0;
                              const defaultUnit = (selected && typeof selected.unitPrice === 'number') ? selected.unitPrice : 0;
                              setNewSale(prev => ({
                                ...prev,
                                lines: prev.lines.map((ln, i) => i === idx ? { ...ln, itemId: id, discount: ln.discount === '' ? defaultDiscount : ln.discount, unitPrice: ln.unitPrice === '' ? defaultUnit : ln.unitPrice } : ln)
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select Item</option>
                            {items.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} (Stock: {item.quantity})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.amount}
                            onChange={(e) => {
                              const amt = Math.max(1, parseInt(e.target.value || '1'));
                              setNewSale(prev => ({
                                ...prev,
                                lines: prev.lines.map((ln, i) => i === idx ? { ...ln, amount: amt } : ln)
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={line.unitPrice}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewSale(prev => ({
                                ...prev,
                                lines: prev.lines.map((ln, i) => i === idx ? { ...ln, unitPrice: val === '' ? '' : Number(val) } : ln)
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.discount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewSale(prev => ({
                                ...prev,
                                lines: prev.lines.map((ln, i) => i === idx ? { ...ln, discount: val === '' ? '' : Number(val) } : ln)
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
                          <input
                            value={formatKES(total)}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                          />
                        </div>
                        <div className="md:col-span-12 flex justify-between">
                          <button
                            type="button"
                            onClick={() => setNewSale(prev => ({ ...prev, lines: [...prev.lines, { itemId: '', amount: 1, unitPrice: '', discount: '' }] }))}
                            className="px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Add Item
                          </button>
                          {newSale.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewSale(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }))}
                              className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="flex justify-end">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Total</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {(() => {
                        const t = (newSale.lines || []).reduce((sum, ln) => {
                          const unit = ln.unitPrice === '' ? 0 : Number(ln.unitPrice);
                          const qty = Math.max(1, Number(ln.amount) || 1);
                          const disc = ln.discount === '' ? 0 : Number(ln.discount);
                          return sum + Math.max(0, (unit * qty) - disc);
                        }, 0);
                        return formatKES(t);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSaleForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Complete Sale
                </button>
              </div>
            </form>
          </div>
          </div>
      )}

      {/* Add Stock - Consignment Form */}
      {showStockForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">Add Stock (Consignment)</h3>
              <button
                onClick={() => setShowStockForm(false)}
                className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
              >
                Back
              </button>
            </div>
          </div>
          <div className="px-4 py-4 md:px-6">
            <form onSubmit={handleUpdateStock} className="space-y-4 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                  <textarea
                    rows={2}
                    value={stockForm.batch_no}
                    onChange={(e) => setStockForm({ ...stockForm, batch_no: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., BN-2025-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name</label>
                  <input
                    type="text"
                    value={stockForm.unit_name}
                    onChange={(e) => setStockForm({ ...stockForm, unit_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={stockForm.supplier_name}
                    onChange={(e) => setStockForm({ ...stockForm, supplier_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stockForm.purchase_cost}
                    onChange={(e) => setStockForm({ ...stockForm, purchase_cost: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockForm.total_paid}
                    onChange={(e) => setStockForm({ ...stockForm, total_paid: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
                  <select
                    required
                    value={stockForm.payment_type}
                    onChange={(e) => setStockForm({ ...stockForm, payment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">Mpesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
                  <div className="relative">
                    <input
                      id="purchase_date"
                      type="date"
                      required
                      value={stockForm.purchase_date}
                      onChange={(e) => setStockForm({ ...stockForm, purchase_date: e.target.value })}
                      className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker('purchase_date')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-700"
                      aria-label="Open calendar for purchase date"
                    >
                      <CalendarDaysIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                  <div className="relative">
                    <input
                      id="expiry_date"
                      type="date"
                      required
                      value={stockForm.expiry_date}
                      onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })}
                      className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker('expiry_date')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-700"
                      aria-label="Open calendar for expiry date"
                    >
                      <CalendarDaysIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowStockForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Save Consignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Modal */}
      {showViewItem && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Item Details</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div><span className="font-medium">Name:</span> {selectedItem.name}</div>
              <div><span className="font-medium">Quantity:</span> {selectedItem.quantity}</div>
              <div><span className="font-medium">Unit:</span> {selectedItem.unitName || '-'}</div>
              <div><span className="font-medium">Unit Price:</span> {formatKES(selectedItem.unitPrice || 0)}</div>
              <div><span className="font-medium">Discount:</span> {selectedItem.discount ? formatKES(selectedItem.discount) : '-'}</div>
              <div><span className="font-medium">Sales Instructions:</span> {selectedItem.salesInstructions || '-'}</div>
              <div><span className="font-medium">Created:</span> {selectedItem.dateCreated ? new Date(selectedItem.dateCreated).toLocaleString() : '-'}</div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowViewItem(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Consignments Modal */}
      {showItemConsignments && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Consignments - {consignmentsItemName}</h3>
              <button onClick={() => setShowItemConsignments(false)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Close</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Charges</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itemConsignments.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.quantity}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.batch_no || c.name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.supplier_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatKES(Number(c.purchase_cost || 0))}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatKES(Number(c.total_paid || 0))}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatKES((c.remainder !== undefined && c.remainder !== null) ? Number(c.remainder || 0) : (Number(c.purchase_cost || 0) - Number(c.total_paid || 0)))}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.purchase_date ? new Date(c.purchase_date).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Consignment Detail Modal */}
      {showConsignmentDetail && consignmentDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Consignment #{consignmentDetail.id}</h3>
              <div className="flex items-center gap-2">
                <button onClick={openConsignmentPdf} className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Save PDF</button>
                <button onClick={printConsignmentDetail} className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-900 text-white">Print</button>
                <button onClick={() => setShowConsignmentDetail(false)} className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Close</button>
              </div>
            </div>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div><span className="font-medium">Supplier:</span> {consignmentDetail.supplier_name || '-'}</div>
              <div><span className="font-medium">Uploader:</span> {consignmentDetail.uploader_name || resolveUploaderName(consignmentDetail) || '-'}</div>
              <div><span className="font-medium">Purchase Cost:</span> {formatKES(Number(consignmentDetail.purchase_cost || 0))}</div>
              <div><span className="font-medium">Total Paid:</span> {formatKES(Number(consignmentDetail.total_paid || 0))}</div>
              <div><span className="font-medium">Balance:</span> {formatKES(Number((consignmentDetail.balance ?? 0) as number))}</div>
              <div><span className="font-medium">Payment Status:</span> {(consignmentDetail.payment_status || '-').toString()}</div>
              <div><span className="font-medium">Timestamp:</span> {consignmentDetail.timestamp ? new Date(consignmentDetail.timestamp).toLocaleString() : '-'}</div>
            </div>

            {/* Items table */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Consignment Items</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm text-gray-700">
                    {(Array.isArray(consignmentDetail.consignment_items) ? consignmentDetail.consignment_items : []).map((it: any, idx: number) => (
                      <tr key={it.id || idx}>
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">{it.item_name || `#${it.item}`}</td>
                        <td className="px-4 py-2">{it.batch_no || '-'}</td>
                        <td className="px-4 py-2">{it.quantity}</td>
                        <td className="px-4 py-2">{formatKES(Number((it.purchase_cost ?? 0) as number))}</td>
                        <td className="px-4 py-2">{it.expiry_date ? new Date(it.expiry_date).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteItem && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Item</h3>
            <p className="mt-2 text-sm text-gray-700">Are you sure you want to delete <span className="font-medium">{selectedItem.name}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowDeleteItem(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Cancel</button>
              <button
                onClick={() => {
                  setItems(prev => prev.filter(it => it.id !== selectedItem.id));
                  setShowDeleteItem(false);
                  toast.success('Item deleted');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pharmacy;
