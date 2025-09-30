import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { toast } from 'react-hot-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      toast.success('Password reset code sent to your email.');
      // Auto-redirect to Reset Password with prefilled email
      navigate(`/login/reset?email=${encodeURIComponent(email)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
        <p className="text-sm text-gray-600 mt-1">Enter your email to receive a reset code.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full border rounded-md px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className={`w-full py-2 rounded-md text-white ${loading?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{loading?'Sending…':'Send reset code'}</button>
        </form>
        <p className="text-sm text-gray-600 mt-4 text-center">
          Have a code? <Link to={`/login/reset?email=${encodeURIComponent(email)}`} className="text-blue-600">Reset password</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;


