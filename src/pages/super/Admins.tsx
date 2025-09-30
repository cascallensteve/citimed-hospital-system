import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import api, { type AdminUser } from '../../services/api';

const Admins = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.super.listAdmins();
        if (!mounted) return;
        setAdmins(Array.isArray(res.users) ? res.users : []);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message || 'Failed to load admins');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Manage Admins</h2>
          <p className="mt-1 text-gray-600">Create, suspend, and delete admin accounts.</p>
        </div>
        <div className="text-sm text-gray-500">Logged in as: <span className="font-medium">{user?.email}</span></div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Admins</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Manage existing admins or add a new one.</p>
          </div>
          <Link to="/dashboard/super/admins/new" className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm">Add Admin</Link>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading admins…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : admins.length === 0 ? (
            <div className="text-sm text-gray-500">No admins found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{`${a.first_name || ''} ${a.last_name || ''}`.trim() || `User #${a.id}`}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{a.email}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 capitalize">{a.userType}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 capitalize">{a.permission || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${a.is_email_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {a.is_email_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedAdmin(a)}
                          className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          View
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

      {/* View Admin Details Modal */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedAdmin(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Details</h3>
                <button onClick={() => setSelectedAdmin(null)} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800">Close</button>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Name</span><span className="font-medium text-gray-900 dark:text-white">{`${selectedAdmin.first_name || ''} ${selectedAdmin.last_name || ''}`.trim() || `User #${selectedAdmin.id}`}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Email</span><span className="font-medium text-gray-900 dark:text-white">{selectedAdmin.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Type</span><span className="font-medium text-gray-900 dark:text-white capitalize">{selectedAdmin.userType}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Permission</span><span className="font-medium text-gray-900 dark:text-white capitalize">{selectedAdmin.permission || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Verified</span><span className="font-medium text-gray-900 dark:text-white">{selectedAdmin.is_email_verified ? 'Verified' : 'Pending'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admins;


