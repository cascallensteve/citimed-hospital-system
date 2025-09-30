import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const AddAdmin = () => {
  const { signupAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', permission: 'out-door-patient' as 'out-door-patient' | 'over-the-counter' });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Enter full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    if (!form.password || !form.confirm) {
      toast.error('Please enter and confirm the password.');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const [first_name, ...rest] = form.full_name.trim().split(/\s+/);
      const last_name = rest.join(' ') || '-';
      await signupAdmin(first_name, last_name, form.email, form.password, form.permission);
      toast.success('Admin created successfully.');
      navigate('/dashboard/super/admins');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Admin</h2>
          <Link to="/dashboard/super/admins" className="text-sm text-blue-600">Back to admins</Link>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Create a new admin user.</p>
        <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <input disabled value="Admin" className="w-full border rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Permission</label>
            <select
              className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              value={form.permission}
              onChange={(e) => setForm({ ...form, permission: e.target.value as 'out-door-patient' | 'over-the-counter' })}
            >
              <option value="out-door-patient">Out-door Patient</option>
              <option value="over-the-counter">Over-the-Counter</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This controls which dashboard the admin can access.</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input type="password" className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
            <input type="password" className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} required />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={loading} className={`w-full py-2 rounded-md text-white ${loading? 'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{loading? 'Creating…':'Create admin'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAdmin;


