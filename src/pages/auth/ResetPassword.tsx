import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { toast } from 'react-hot-toast';

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

const ResetPassword = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const emailParam = query.get('email') || '';
  const [form, setForm] = useState({ email: emailParam, token: '', new_password: '' });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.resetPassword(form);
      toast.success('Password reset successfully.');
      navigate('/login');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
        <p className="text-sm text-gray-600 mt-1">Enter the code and your new password.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full border rounded-md px-3 py-2" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Reset code</label>
            <input className="w-full border rounded-md px-3 py-2 tracking-widest" value={form.token} onChange={e=>setForm({...form, token:e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">New password</label>
            <input type="password" className="w-full border rounded-md px-3 py-2" value={form.new_password} onChange={e=>setForm({...form, new_password:e.target.value})} required />
          </div>
          <button type="submit" disabled={loading} className={`w-full py-2 rounded-md text-white ${loading?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{loading?'Resetting…':'Reset password'}</button>
        </form>
        <p className="text-sm text-gray-600 mt-4 text-center"><Link to="/login" className="text-blue-600">Back to login</Link></p>
      </div>
    </div>
  );
};

export default ResetPassword;


