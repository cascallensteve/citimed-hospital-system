import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserIcon, EnvelopeIcon, ShieldCheckIcon, PlusCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import api from '../services/api';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showGoodbye, setShowGoodbye] = useState(false);

  // Basic profile fields (demo: persisted locally)
  const [fullName, setFullName] = useState(() => localStorage.getItem('profile.fullName') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('profile.phone') || '');
  const [department, setDepartment] = useState(() => localStorage.getItem('profile.department') || 'Administration');
  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      localStorage.setItem('profile.fullName', fullName);
      localStorage.setItem('profile.phone', phone);
      localStorage.setItem('profile.department', department);
    } finally {
      setSavingProfile(false);
    }
  };

  const resendAdminVerification = async (email: string) => {
    setResending(true);
    try {
      await api.auth.resendVerificationOtp({ email });
      toast.success('Verification OTP sent');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to send verification OTP');
    } finally {
      setResending(false);
    }
  };

  const verifyAdminWithOtp = async (email: string, otp: string) => {
    if (!otp.trim()) { toast.error('Enter the OTP sent to email'); return; }
    setVerifying(true);
    try {
      await api.auth.verifyEmail({ email, otp });
      toast.success('Admin verified');
      // Refresh list and details
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const res = await fetchWithAuth(`${base}/user-details/${selectedAdmin?.id}/`);
        const data = await res.json();
        if (res.ok) setDetail(data['user-details'] || null);
        const resAll = await fetchWithAuth(`${base}/all-users`);
        const dataAll = await resAll.json();
        if (resAll.ok && Array.isArray(dataAll?.users)) setAdmins(dataAll.users);
      } catch {}
    } catch (e) {
      toast.error((e as Error).message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const isSuper = user?.role === 'superadmin';
  // Super Admin: Real Admins list + details
  type AdminRow = {
    id: number | string;
    first_name: string;
    last_name: string;
    email: string;
    userType: string;
    is_email_verified: boolean;
    permission?: 'out-door-patient' | 'over-the-counter' | string;
  };
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminRow | null>(null);
  const [detail, setDetail] = useState<AdminRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Super Admin: verify admin controls
  const [verifyEmailInput, setVerifyEmailInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Super Admin: Add New Admin form state
  const [newAdmin, setNewAdmin] = useState({ first_name: '', last_name: '', email: '', password: '', confirm_password: '', permission: 'out-door-patient' as 'out-door-patient' | 'over-the-counter' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) { toast.error('Only super admins can create admins'); return; }
    if (!newAdmin.first_name.trim()) { toast.error('First name is required'); return; }
    if (!newAdmin.last_name.trim()) { toast.error('Last name is required'); return; }
    if (!newAdmin.email.trim()) { toast.error('Email is required'); return; }
    if (!newAdmin.password.trim() || newAdmin.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (!newAdmin.permission) { toast.error('Select a permission'); return; }
    if (newAdmin.password !== newAdmin.confirm_password) { toast.error('Passwords do not match'); return; }
    setCreatingAdmin(true);
    try {
      const createdEmail = newAdmin.email.trim();
      const res = await api.auth.adminSignUp({
        first_name: newAdmin.first_name.trim(),
        last_name: newAdmin.last_name.trim(),
        email: createdEmail,
        password: newAdmin.password,
        permission: newAdmin.permission,
      });
      toast.success('Admin account created');
      // Refresh admins list if we have it loaded
      setNewAdmin({ first_name: '', last_name: '', email: '', password: '', confirm_password: '', permission: 'out-door-patient' });
      // Re-fetch admins, send verification OTP, then redirect to verify page for the new admin
      try {
        const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
        const res2 = await fetchWithAuth(`${base}/all-users`);
        const data2 = await res2.json();
        if (res2.ok && Array.isArray(data2?.users)) {
          setAdmins(data2.users);
          const createdRow = data2.users.find((u: any) => String(u?.email).toLowerCase() === createdEmail.toLowerCase());
          if (createdRow) {
            setSelectedAdmin(createdRow as any);
            openDetails(createdRow as any);
          }
        }
      } catch {}
    } catch (err) {
      toast.error((err as Error).message || 'Failed to create admin');
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Helper: fetch with Authorization; robustly try both Token and Bearer schemes
  const fetchWithAuth = async (url: string, signal?: AbortSignal) => {
    const token = localStorage.getItem('token') || '';
    const doFetch = (scheme: 'Token' | 'Bearer') => fetch(url, {
      headers: token ? { Authorization: `${scheme} ${token}` } : {},
      signal,
    });
    // Many endpoints in this backend prefer Token scheme; try it first
    let res = await doFetch('Token');
    // On common auth failures, retry with Bearer (JWT style)
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      res = await doFetch('Bearer');
    }
    return res;
  };

  useEffect(() => {
    if (!isSuper) return;
    const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
    const controller = new AbortController();
    const run = async () => {
      setAdminsLoading(true);
      setAdminsError('');
      try {
        const res = await fetchWithAuth(`${base}/all-users`, controller.signal);
        const data = await res.json();
        if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to load admins');
        setAdmins(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        if (!(e as any)?.name?.includes('Abort')) setAdminsError((e as Error).message);
      } finally {
        setAdminsLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [isSuper]);

  const openDetails = async (row: AdminRow) => {
    setSelectedAdmin(row);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const base = import.meta.env.DEV ? '/api' : ((import.meta as any).env.VITE_API_BASE_URL || 'https://citimed-api.vercel.app');
      const res = await fetchWithAuth(`${base}/user-details/${row.id}/`);
      const data = await res.json();
      if (!res.ok) throw new Error((data && (data.message || data.error || data.detail)) || 'Failed to load user details');
      setDetail(data['user-details'] || null);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
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
          <div className="flex items-center justify-between gap-4">
        <div>
              <h2 className="text-2xl md:text-3xl font-bold">Admin Profile</h2>
              <p className="mt-2 text-sm md:text-base text-blue-100">Manage your account and administrative settings.</p>
        </div>
            <div className="flex items-center gap-3 text-sm text-blue-100">
              <UserIcon className="h-6 w-6 text-white/90" />
          <span>{user?.email}</span>
            </div>
          </div>
        </div>
        <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
      </div>

      {/* Account Overview */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
            <p className="mt-1 text-sm font-medium text-green-600">Active</p>
          </div>
        </div>
      </section>

      {/* Admin Profile Details (from session) */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Admin Profile Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">First Name</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.first_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last Name</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.last_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">User Type</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.userType === 'super-admin' || user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Email Verified</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.is_email_verified ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.id ?? '—'}</p>
          </div>
        </div>
      </section>

      {/* Profile Details */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Profile Details</h3>
          <button onClick={saveProfile} disabled={savingProfile} className={`px-4 py-2 rounded-md text-white ${savingProfile ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{savingProfile ? 'Saving…' : 'Save'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Jane Doe" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., +1 555 123 4567" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Department</label>
            <input value={department} onChange={e => setDepartment(e.target.value)} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Administration" />
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Actions</h3>
        <div className="flex items-center">
          <button
            onClick={() => setShowGoodbye(true)}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
          >
            Logout
          </button>
        </div>
      </section>

      {/* Super Admin: Add New Admin (hidden while details/verification modal is open) */}
      {isSuper && !selectedAdmin && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add New Admin</h3>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleCreateAdmin}>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">First Name</label>
              <input value={newAdmin.first_name} onChange={e=>setNewAdmin({...newAdmin, first_name: e.target.value})} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Jane" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">Last Name</label>
              <input value={newAdmin.last_name} onChange={e=>setNewAdmin({...newAdmin, last_name: e.target.value})} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Doe" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">Email</label>
              <input type="email" value={newAdmin.email} onChange={e=>setNewAdmin({...newAdmin, email: e.target.value})} className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., admin@citimed.com" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">Permission</label>
              <select
                value={newAdmin.permission}
                onChange={e=>setNewAdmin({...newAdmin, permission: e.target.value as 'out-door-patient' | 'over-the-counter'})}
                className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="out-door-patient">Out-door Patient</option>
                <option value="over-the-counter">Over-the-Counter</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Determines which dashboard the admin can access.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">Password</label>
              <div className="relative mt-1">
                <input type={showPwd ? 'text' : 'password'} value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password: e.target.value})} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-3 pr-10 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Minimum 6 characters" />
                <button type="button" onClick={()=>setShowPwd(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label={showPwd ? 'Hide password' : 'Show password'}>
                  {showPwd ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300">Confirm Password</label>
              <div className="relative mt-1">
                <input type={showPwd2 ? 'text' : 'password'} value={newAdmin.confirm_password} onChange={e=>setNewAdmin({...newAdmin, confirm_password: e.target.value})} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-3 pr-10 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Re-enter password" />
                <button type="button" onClick={()=>setShowPwd2(v=>!v)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label={showPwd2 ? 'Hide password' : 'Show password'}>
                  {showPwd2 ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={creatingAdmin} className={`px-4 py-2 rounded-md text-white ${creatingAdmin ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{creatingAdmin ? 'Creating…' : 'Create Admin'}</button>
            </div>
          </form>
        </section>
      )}

      {/* Super Admin: Real Admins list (connected to backend). Hidden while details/verification modal is open */}
      {isSuper && !selectedAdmin && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Admins</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Fetched from your backend.</p>
          </div>
          <div className="overflow-x-auto">
            {adminsLoading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : adminsError ? (
              <div className="text-sm text-red-600">{adminsError}</div>
            ) : !admins || admins.length === 0 ? (
              <div className="text-sm text-gray-500">No admins found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Permission</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Verified</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {admins.map(a => (
                    <tr key={a.id as any}>
                      <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">{a.first_name} {a.last_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100">{a.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-100 capitalize">{a.permission || '—'}</td>
                      <td className="px-4 py-2 text-sm">
                        {a.is_email_verified ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">Verified</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        <button
                          onClick={() => openDetails(a)}
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* Details modal */}
      {isSuper && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedAdmin(null); setDetail(null); }} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Admin Details</h3>
              {detailLoading ? (
                <p className="mt-3 text-sm text-gray-500">Loading…</p>
              ) : detailError ? (
                <p className="mt-3 text-sm text-red-600">{detailError}</p>
              ) : !detail ? (
                <p className="mt-3 text-sm text-gray-500">No details yet.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.first_name} {detail.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.userType === 'super-admin' ? 'Super Admin' : 'Admin'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Admin Type</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {(() => {
                        const perm = (detail as any)?.permission ?? (selectedAdmin as any)?.permission;
                        if (perm === 'out-door-patient') return 'Out-door Patient';
                        if (perm === 'over-the-counter') return 'Over-the-Counter';
                        return '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email Verified</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.is_email_verified ? 'Yes' : 'No'}</p>
                  </div>

                  {/* Verification controls */}
                  {!detail.is_email_verified && (
                    <div className="mt-2 p-3 rounded-lg border border-blue-100 bg-blue-50">
                      <p className="text-sm font-medium text-blue-900">Verify this admin</p>
                      <p className="text-xs text-blue-800 mt-1">Send OTP to the admin and enter it here to verify their email.</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => resendAdminVerification(detail.email)}
                          disabled={resending}
                          className={`px-3 py-1.5 rounded-md text-white ${resending ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          {resending ? 'Sending…' : 'Send OTP'}
                        </button>
                        <input
                          value={verifyEmailInput}
                          onChange={e=>setVerifyEmailInput(e.target.value)}
                          placeholder="Enter OTP"
                          className="flex-1 rounded border border-blue-200 bg-white px-3 py-1.5 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => verifyAdminWithOtp(detail.email, verifyEmailInput)}
                          disabled={verifying}
                          className={`px-3 py-1.5 rounded-md text-white ${verifying ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          {verifying ? 'Verifying…' : 'Verify'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end gap-3">
              <button onClick={() => { setSelectedAdmin(null); setDetail(null); }} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Close</button>
            </div>
          </div>
        </div>
      )}

      {showGoodbye && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm text-center border border-gray-100 dark:border-gray-700">
            <img src="/IMAGES/Logo.png" alt="Citimed" className="h-12 w-auto mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Goodbye{user?.first_name ? `, ${user.first_name}` : ''}!</h3>
            <p className="text-gray-600 dark:text-gray-300 mt-2">See you soon.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => setShowGoodbye(false)} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white">Cancel</button>
              <button onClick={logout} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
