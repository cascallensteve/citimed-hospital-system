import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import api, { AdminUser } from '../../services/api';

const Admins = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
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
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${a.is_email_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {a.is_email_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admins;


