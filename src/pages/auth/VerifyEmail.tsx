import { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

const VerifyEmail = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const emailParam = query.get('email') || '';
  const { verifyEmail, resendVerificationOtp } = useAuth();
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const resendLock = useRef(false);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    if (!/^\d{4,8}$/.test(otp)) {
      toast.error('Enter a valid numeric OTP.');
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(email, otp);
      toast.success('Email verified successfully.');
      // Stay on this page. If you prefer to go back to profile, uncomment:
      // navigate('/dashboard/profile');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resendLock.current) return; // hard guard against rapid double-invokes
    resendLock.current = true;
    setResending(true);
    try {
      await resendVerificationOtp(email);
      toast.success('Verification code sent successfully.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResending(false);
      resendLock.current = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Enter the OTP sent to your email address.</p>
        <form className="mt-6 space-y-4" onSubmit={onVerify}>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" className="w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">OTP</label>
            <input inputMode="numeric" pattern="[0-9]*" className="w-full border rounded-md px-3 py-2 tracking-widest bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100" value={otp} onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} required />
          </div>
          <button type="submit" disabled={loading} className={`w-full py-2 rounded-md text-white ${loading?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{loading?'Verifying…':'Verify Email'}</button>
        </form>
        <button type="button" onClick={() => { if (!resending) onResend(); }} disabled={resending} className="w-full mt-3 py-2 rounded-md border text-blue-700 border-blue-200 dark:text-blue-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700">{resending?'Sending…':'Resend code'}</button>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 text-center"><Link to="/login" className="text-blue-600">Back to login</Link></p>
      </div>
    </div>
  );
};

export default VerifyEmail;


