import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api, { type PatientVisitsResponse } from '../../services/api';
import { useDataCache } from '../../context/DataCacheContext';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';

// Utility: resolve API base for direct fetch fallbacks
const getApiBase = () => {
  const explicit = (import.meta as any).env?.VITE_API_BASE_URL;
  if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  return import.meta.env.DEV ? '/api' : 'https://citimed-api.vercel.app';
};

const PatientDetails = () => {
  const { id } = useParams();
  const patientId = id ? id : '';
  const [loading, setLoading] = useState(true);
  const [visitsResp, setVisitsResp] = useState<PatientVisitsResponse | null>(null);
  const [patientDetail, setPatientDetail] = useState<any>(null);
  const { patients: cachedPatients } = useDataCache();

  const displayPatient = useMemo(() => {
    // Prefer fetched patientDetail; fallback to cached patients
    if (patientDetail) return patientDetail;
    const found = (cachedPatients || []).find((p: any) => String(p.id) === String(patientId));
    if (found) {
      return {
        id: found.id,
        name: found.fullName,
        phone_no: found.phone,
        location: found.location,
        patient_number: found.patientNumber,
        registeredAt: found.registeredAt,
        age: found.age,
        gender: found.gender,
        patient_type: found.type,
      };
    }
    return null;
  }, [patientDetail, cachedPatients, patientId]);

  // Fallback auth fetch helper for endpoints that may require Token/Bearer and trailing slash variants
  const authFetch = async (path: string, init?: RequestInit) => {
    const token = localStorage.getItem('token') || '';
    const base = getApiBase();
    const tryReq = async (scheme: 'Token' | 'Bearer', withSlash: boolean) => {
      const url = `${base}${path}${withSlash ? (path.endsWith('/') ? '' : '/') : ''}`;
      return fetch(url, {
        ...(init || {}),
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
          ...(token ? { Authorization: `${scheme} ${token}` } : {}),
        } as any,
      });
    };
    let res = await tryReq('Token', true);
    if (res.status === 401 || res.status === 403) res = await tryReq('Bearer', true);
    return res;
  };

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    (async () => {
      try {
        // 1) Load visits for this patient using typed API; backend expects trailing slash
        let data: PatientVisitsResponse | null = null;
        try {
          data = await api.patientVisits.byPatient(patientId);
        } catch (e) {
          // graceful fallback with Bearer/Token if proxy/env mismatch
          const res = await authFetch(`/visits/patient-visits/${patientId}/`, { method: 'GET' });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((json && (json.message || json.error || json.detail)) || `Failed to load visits (status ${res.status})`);
          data = json as PatientVisitsResponse;
        }
        setVisitsResp(data);

        // 2) Load patient detail (for demographics)
        try {
          let res = await authFetch(`/patients/patient-detail/${patientId}/`, { method: 'GET' });
          if (res.status === 404 || res.status === 405) res = await authFetch(`/patients/patient-detail/${patientId}`, { method: 'GET' });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.Patient) setPatientDetail(json.Patient);
        } catch {}
      } catch (err) {
        toast.error((err as Error).message || 'Failed to load patient visits');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  const formatDateTime = (v?: string) => {
    if (!v) return '-';
    const t = Date.parse(v);
    if (Number.isNaN(t)) return v;
    return new Date(t).toLocaleString();
  };

  const patientName = displayPatient?.name || visitsResp?.patient || `Patient #${patientId}`;
  const addVisitHref = `/dashboard/admin/visits?add=1` +
    `&patient=${encodeURIComponent(String(patientId))}` +
    `&name=${encodeURIComponent(String(patientName))}` +
    (displayPatient?.patient_number ? `&patientNumber=${encodeURIComponent(String(displayPatient.patient_number))}` : '') +
    (displayPatient?.phone_no ? `&phone=${encodeURIComponent(String(displayPatient.phone_no))}` : '') +
    (displayPatient?.age != null ? `&age=${encodeURIComponent(String(displayPatient.age))}` : '') +
    (displayPatient?.gender ? `&gender=${encodeURIComponent(String(displayPatient.gender))}` : '') +
    (displayPatient?.location ? `&location=${encodeURIComponent(String(displayPatient.location))}` : '') +
    (displayPatient?.patient_type ? `&type=${encodeURIComponent(String(displayPatient.patient_type))}` : '') +
    (displayPatient?.registeredAt ? `&registeredAt=${encodeURIComponent(String(displayPatient.registeredAt))}` : '');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Patient Details</h2>
          <p className="text-sm text-gray-500 mt-1">View demographics and visit history</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={addVisitHref} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
            <PlusIcon className="h-5 w-5" />
            Add Visit
          </Link>
          <Link to="/dashboard/admin/patients" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm">
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Patients
          </Link>
        </div>
      </div>

      {/* Patient Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Full Name</p>
            <p className="font-semibold text-gray-900">{patientName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Patient ID</p>
            <p className="font-mono text-gray-900">{displayPatient?.patient_number || patientId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Phone</p>
            <p className="text-gray-900">{displayPatient?.phone_no || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Location</p>
            <p className="text-gray-900">{displayPatient?.location || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Registered</p>
            <p className="text-gray-900">{displayPatient?.registeredAt || '-'}</p>
          </div>
        </div>
      </div>

      {/* Visits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Visit History</h3>
          <p className="text-sm text-gray-500">All visits and transactions for this patient</p>
        </div>
        {loading ? (
          <div className="p-6 text-gray-500">Loading visits…</div>
        ) : !visitsResp?.visits?.length ? (
          <div className="p-6 text-gray-500">No visits found for this patient.</div>
        ) : (
          <div className="divide-y">
            {visitsResp.visits.map((v) => (
              <div key={v.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <div>
                    <div className="text-gray-900 font-semibold">Visit #{v.id}</div>
                    <div className="text-sm text-gray-500">Served by {v.uploader_info} • {formatDateTime(v.timestamp)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">Charges: {v.charges}</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">Paid: {v.total_paid}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full ${v.balance > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-emerald-50 text-emerald-700'} font-medium`}>Balance: {v.balance}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-1">Clinical Notes</div>
                    <ul className="text-gray-700 space-y-1 list-disc list-inside">
                      <li><span className="text-gray-500">Complaints:</span> {v.complaints || '-'}</li>
                      <li><span className="text-gray-500">History:</span> {v.history || '-'}</li>
                      <li><span className="text-gray-500">Allergies:</span> {v.allergies || '-'}</li>
                      <li><span className="text-gray-500">Exam:</span> {v.physical_exam || '-'}</li>
                      <li><span className="text-gray-500">Diagnosis:</span> {v.diagnosis || '-'} ({v.diagnosis_type})</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-1">Investigations</div>
                    <ul className="text-gray-700 space-y-1 list-disc list-inside">
                      <li><span className="text-gray-500">Lab Tests:</span> {v.lab_test || '-'}</li>
                      <li><span className="text-gray-500">Lab Results:</span> {v.lab_results || '-'}</li>
                      <li><span className="text-gray-500">Imaging:</span> {v.imaging || '-'}</li>
                    </ul>
                  </div>
                  <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-1">Prescription</div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {Array.isArray(v.prescriptions_list) && v.prescriptions_list.length
                        ? (
                          <ul className="list-disc list-inside">
                            {v.prescriptions_list.map((p, idx) => (
                              <li key={idx}>{p}</li>
                            ))}
                          </ul>
                        )
                        : (v.prescription || '-')} 
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="font-medium text-gray-900 mb-1">Transactions</div>
                    {v.transactions && v.transactions.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploader</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {v.transactions.map(t => (
                              <tr key={t.id}>
                                <td className="px-4 py-2 text-sm text-gray-900">{t.id}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{t.uploader_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{t.amount}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{t.payment_type}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{formatDateTime(t.timestamp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No transactions recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDetails;
