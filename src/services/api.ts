// Prefer Vite proxy in development to avoid CORS. In production, allow override via env
const BASE_URL = import.meta.env.DEV
  ? '/api'
  : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  token?: string;
  signal?: AbortSignal;
  // When true, do not attach any Authorization header even if a token exists in storage
  noAuth?: boolean;
};

// Payload types for creation endpoints
export type AddPharmacyItemPayload = {
  name: string;
  unit_name: string;
  sales_instructions: string;
};

export type CreatePharmacySalePayload = {
  customer_name: string;
  items: Array<{
    item: number;
    amount: number;
    total_price: string;
  }>;
  total_amount: string;
};

async function request<T>(path: string, method: HttpMethod, body?: any, options: RequestOptions = {}): Promise<T> {
  const token = options.noAuth ? undefined : (options.token ?? localStorage.getItem('token') ?? undefined);
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Prefer DRF Token scheme for this backend; visits/patients also try Bearer as fallback elsewhere
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // If backend returned HTML (e.g., Django debug page), avoid surfacing raw HTML
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && contentType.includes('text/html')) {
      data = { message: `Server error (${res.status}) while requesting ${url}` };
    } else {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      (data && (data.message || data.error || data.detail)) ||
      (typeof text === 'string' && text.trim()) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// Auth API
export const authApi = {
  login: (payload: { email: string; password: string; }) =>
    request<{ token: string; user: any }>('/login', 'POST', payload, { noAuth: true }),

  superAdminSignUp: (payload: { first_name: string; last_name: string; email: string; password: string; }) =>
    request<{ token: string; user: any }>('/super-admin-signUp', 'POST', payload, { noAuth: true }),

  // Admin creation (by super-admin only)
  adminSignUp: (payload: { first_name: string; last_name: string; email: string; password: string; permission: 'out-door-patient' | 'over-the-counter'; }) =>
    request<{ token: string; user: any }>('/admin-signUp', 'POST', payload, { noAuth: true }),

  verifyEmail: (payload: { email: string; otp: string; }) =>
    request<{ message: string; token: string; user: any }>('/verify-email', 'POST', payload, { noAuth: true }),

  resendVerificationOtp: (payload: { email: string; }) =>
    request<{ message: string }>('/resend-verification-otp', 'POST', payload, { noAuth: true }),

  forgotPassword: (payload: { email: string; }) =>
    request<{ message: string }>('/forgot-password', 'POST', payload, { noAuth: true }),

  resetPassword: (payload: { email: string; token: string; new_password: string; }) =>
    request<{ message: string }>('/reset-password', 'POST', payload, { noAuth: true }),
};

// Patients API (scaffold based on typical REST conventions)
export type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  created_at?: string;
};

export const patientsApi = {
  list: (query?: { search?: string; page?: number; limit?: number }) =>
    request<{ data: Patient[]; total?: number }>(`/patients${toQuery(query)}`, 'GET'),
  get: (id: string) => request<Patient>(`/patients/${id}`, 'GET'),
  create: (payload: Partial<Patient>) => request<Patient>('/patients', 'POST', payload),
  update: (id: string, payload: Partial<Patient>) => request<Patient>(`/patients/${id}`, 'PUT', payload),
  remove: (id: string) => request<{ message: string }>(`/patients/${id}`, 'DELETE'),
};

// Visits API (scaffold)
export type Visit = {
  id: string;
  patient_id: string;
  date: string;
  notes?: string;
};

export const visitsApi = {
  // Backend-provided full list endpoint
  all: () => request<{ visits: any[] }>(`/visits/all-visits`, 'GET'),
  list: (query?: { patient_id?: string; page?: number; limit?: number }) =>
    request<{ data: Visit[]; total?: number }>(`/visits${toQuery(query)}`, 'GET'),
  get: (id: string) => request<Visit>(`/visits/${id}`, 'GET'),
  create: (payload: Partial<Visit>) => request<Visit>('/visits', 'POST', payload),
  update: (id: string, payload: Partial<Visit>) => request<Visit>(`/visits/${id}`, 'PUT', payload),
  remove: (id: string) => request<{ message: string }>(`/visits/${id}`, 'DELETE'),
};

// Pharmacy API
export type PharmacyItem = {
  id: number;
  uploader_name: string;
  name: string;
  quantity: string | number;
  supplier_name: string;
  purchase_cost: number;
  payment_type: string;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  uploader: number;
  unit_name?: string;
  sales_instructions?: string;
};

export type PharmacySaleLine = {
  id: number;
  amount: string;
  unit_name?: string | null;
  total_price: string;
  sale: number;
  uploader: number | null;
  item: number;
};

export type PharmacySale = {
  id: number;
  uploader_name: string;
  items: PharmacySaleLine[];
  customer_name: string;
  timestamp: string; // ISO datetime
  total_amount: string;
  uploader: number;
};

// Consignment detail (inventory) response types
export type ConsignmentItemDetails = {
  id: number;
  uploader_name: string;
  name: string;
  quantity: number;
  unit_name: string | null;
  sales_instructions: string | null;
  date_created: string; // ISO datetime
  last_updated: string; // ISO datetime
  uploader: number;
};

export type ConsignmentInventory = {
  id: number;
  uploader_name: string;
  item_name: string;
  item_details: ConsignmentItemDetails;
  name: string;
  quantity: number;
  unit_name: string | null;
  supplier_name: string;
  purchase_cost: number;
  payment_type: string;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  uploader: number;
  item: number;
};

export type ConsignmentDetailResponse = {
  inventory: ConsignmentInventory;
};

// Update stock (add consignment) types
export type UpdateItemStockPayload = {
  quantity: number;
  unit_name: string | null;
  supplier_name: string;
  purchase_cost: number;
  payment_type: string;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  remainder?: number; // optional based on backend
  name?: string; // optional batch name when provided
};

export type UpdateItemStockResponse = {
  id: number;
  uploader_name: string;
  item_name: string;
  item_details: ConsignmentItemDetails;
  quantity: number;
  unit_name: string | null;
  supplier_name: string;
  purchase_cost: number;
  payment_type: string;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  uploader: number;
  item: number;
  name?: string; // present on some responses
};

export const pharmacyApi = {
  // Backend-provided endpoints
  allItems: () => request<{ items: PharmacyItem[] }>(`/pharmacy/all-items`, 'GET'),
  itemDetail: (id: number) => request<{ item: PharmacyItem }>(`/pharmacy/item-detail/${id}/`, 'POST'),
  itemConsignments: (id: number) => request<{ item: string; consignments: ConsignmentInventory[] }>(`/pharmacy/item-consignments/${id}/`, 'GET'),
  allSales: () => request<{ items: PharmacySale[] }>(`/pharmacy/all-sales`, 'GET'),
  saleDetail: (id: number) => request<{ item: PharmacySale }>(`/pharmacy/sale-detail/${id}/`, 'GET'),
  consignmentDetail: (id: number) => request<ConsignmentDetailResponse>(`/pharmacy/consignment-detail/${id}/`, 'POST'),
  allConsignments: () => request<{ inventories: ConsignmentInventory[] }>(`/pharmacy/consignments`, 'GET'),

  // Update item stock by adding a consignment
  updateItemStock: (itemId: number, payload: UpdateItemStockPayload) =>
    request<UpdateItemStockResponse>(`/pharmacy/update-item-stock/${itemId}/`, 'POST', payload),

  // Create item & sale
  addItem: (payload: AddPharmacyItemPayload) =>
    request<{ Item: PharmacyItem }>(`/pharmacy/add-item`, 'POST', payload),
  addSale: (payload: CreatePharmacySalePayload) =>
    request<{ Sale: PharmacySale }>(`/pharmacy/add-sale`, 'POST', payload),

  // Generic CRUD (keep scaffold in case other parts rely on it)
  listItems: (query?: { search?: string; page?: number; limit?: number }) =>
    request<{ data: PharmacyItem[]; total?: number }>(`/pharmacy/items${toQuery(query)}`, 'GET'),
  getItem: (id: string) => request<PharmacyItem>(`/pharmacy/items/${id}`, 'GET'),
  createItem: (payload: Partial<PharmacyItem>) => request<PharmacyItem>('/pharmacy/items', 'POST', payload),
  updateItem: (id: string, payload: Partial<PharmacyItem>) => request<PharmacyItem>(`/pharmacy/items/${id}`, 'PUT', payload),
  removeItem: (id: string) => request<{ message: string }>(`/pharmacy/items/${id}`, 'DELETE'),
};

// Reports API (scaffold)
export type ReportSummary = {
  revenue?: number;
  visits_today?: number;
  patients_total?: number;
};

export const reportsApi = {
  summary: (query?: { from?: string; to?: string }) => request<ReportSummary>(`/reports/summary${toQuery(query)}`, 'GET'),
  export: (query?: { from?: string; to?: string; format?: 'csv' | 'xlsx' }) =>
    request<{ url: string }>(`/reports/export${toQuery(query)}`, 'GET'),
};

// Finance API (pharmacy-related financial endpoints)
export type PharmacySalesResponse = {
  sales: PharmacySale[];
  total_sum: number;
};

export type ConsignmentsByDateResponse = {
  consignments: ConsignmentInventory[];
  total_purchase_cost: number;
};

export const financeApi = {
  allPharmacySales: () => request<PharmacySalesResponse>(`/finances/all-pharmacy-sales`, 'GET'),
  pharmacySalesByDate: (payload: { start_date: string; end_date: string }) =>
    request<PharmacySalesResponse>(`/finances/pharmacy-sales-by-date`, 'POST', payload),
  pharmacySalesByDay: (payload: { date: string }) =>
    request<PharmacySalesResponse>(`/finances/pharmacy-sales-by-day`, 'POST', payload),
  consignmentsByDate: (payload: { start_date: string; end_date: string }) =>
    request<ConsignmentsByDateResponse>(`/finances/consignments-by-date`, 'POST', payload),
  // Visits finance endpoints
  visitsBalances: () =>
    request<{ total_pending_balance: number; visits: any[] }>(`/finances/visits-balances`, 'GET'),
  visitsRevenueByDate: (payload: { start_date: string; end_date: string }) =>
    request<{ totals: Record<string, any>; transactions: any[] }>(`/finances/visits-revenue-by-date`, 'POST', payload),
  visitsRevenueByDay: (payload: { day: string }) =>
    request<{ totals: Record<string, any>; transactions: any[] }>(`/finances/visits-revenue-by-day`, 'POST', payload),
};

// Super Admin API
export type AdminUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_no?: string | null;
  userType: 'admin' | 'super-admin';
  is_email_verified: boolean;
  permission?: 'out-door-patient' | 'over-the-counter' | string;
};

export const superAdminApi = {
  listAdmins: () => request<{ users: AdminUser[] }>(`/all-users`, 'GET'),
};

function toQuery(query: Record<string, any> | undefined) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}

// Unified export for convenience
export const api = {
  auth: authApi,
  patients: patientsApi,
  visits: visitsApi,
  pharmacy: pharmacyApi,
  reports: reportsApi,
  finance: financeApi,
  super: superAdminApi,
};

export default api;


