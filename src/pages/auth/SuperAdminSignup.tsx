import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const SuperAdminSignup = () => {
  const { signupSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password strength helpers (blue palette only)
  const assessPassword = (pwd: string) => {
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const lengthOK = pwd.length >= 12;
    // Score out of 5, then map to 0..4 meter
    const raw = [lengthOK, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
    const meter = Math.min(4, Math.max(0, raw - 1)); // 0..4 (reserve 0 for <12 length)
    const label = lengthOK
      ? (raw >= 5 ? 'Very strong' : raw === 4 ? 'Strong' : raw === 3 ? 'Fair' : 'Weak')
      : 'Too short';
    return { hasUpper, hasLower, hasNumber, hasSymbol, lengthOK, meter, label };
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // simple client-side validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    if (form.password.length < 12) {
      toast.error('Password must be at least 12 characters.');
      return;
    }
    setLoading(true);
    try {
      await signupSuperAdmin(form.first_name, form.last_name, form.email, form.password);
      toast.success('Account created. Please log in.');
      navigate('/login');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Left: Banner image */}
      <div className="hidden lg:block relative w-1/2">
        <div className="absolute inset-0 bg-gradient-to-l from-blue-900/70 to-blue-700/70 z-10"></div>
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://res.cloudinary.com/dqvsjtkqw/image/upload/v1753882847/people-office-work-day_1_ym2pr0.jpg"
          alt="Citimed banner"
        />
        <div className="absolute inset-0 flex items-center justify-center z-20 p-12">
          <div className="text-center text-white">
            <img src="/IMAGES/Logo.png" alt="Citimed" className="h-24 w-auto mx-auto mb-6" />
            <h3 className="text-4xl font-bold mb-3">Create Super Admin</h3>
            <p className="text-lg opacity-90">Own your organization and manage access securely</p>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-xl bg-white rounded-2xl shadow-xl border border-blue-100 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-blue-900">Create Super Admin</h1>
            <p className="text-blue-700/80 mt-1">Set up your organization owner account</p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base text-blue-900 mb-2">First name</label>
                <input className="w-full rounded-md border border-blue-200 bg-white text-blue-900 placeholder-blue-300 px-3 py-3 focus:ring-blue-500 focus:border-blue-500 text-base" value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} required />
              </div>
              <div>
                <label className="block text-base text-blue-900 mb-2">Last name</label>
                <input className="w-full rounded-md border border-blue-200 bg-white text-blue-900 placeholder-blue-300 px-3 py-3 focus:ring-blue-500 focus:border-blue-500 text-base" value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} required />
              </div>
            </div>

            <div>
              <label className="block text-base text-blue-900 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a 2 2 0 002 2h12a 2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input type="email" className="w-full rounded-md border border-blue-200 bg-white text-blue-900 placeholder-blue-300 pl-10 pr-3 py-3 focus:ring-blue-500 focus:border-blue-500 text-base" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
              </div>
            </div>

            <div>
              <label className="block text-base text-blue-900 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input type={showPwd ? 'text' : 'password'} className="w-full rounded-md border border-blue-200 bg-white text-blue-900 placeholder-blue-300 pl-10 pr-10 py-3 focus:ring-blue-500 focus:border-blue-500 text-base" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
                {/* Toggle eye icon */}
                <button type="button" onClick={()=>setShowPwd(v=>!v)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-500 hover:text-blue-700" aria-label={showPwd ? 'Hide password' : 'Show password'}>
                  {showPwd ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 15.59 7.244 19 12 19c1.727 0 3.36-.36 4.82-.995l-1.664-1.664A8.48 8.48 0 0112 17c-3.63 0-6.81-2.33-8.062-5 .44-.98 1.148-1.953 2.06-2.77L3.98 8.223z" />
                      <path d="M8.53 9.59a3.5 3.5 0 004.88 4.88l-4.88-4.88z" />
                      <path d="M10.59 8.53l4.88 4.88A3.5 3.5 0 0010.59 8.53z" />
                      <path d="M14.121 14.121l2.122 2.122 4.95 4.95 1.415-1.414-4.95-4.95-2.122-2.122-1.415 1.414z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5c-7.633 0-11 6.999-11 7s3.367 7 11 7 11-6.999 11-7-3.367-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password strength meter and guidance */}
              {(() => {
                const s = assessPassword(form.password);
                const bars = 4; // show 4 bars
                return (
                  <div className="mt-3">
                    <div className="flex gap-1" aria-hidden>
                      {Array.from({ length: bars }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded ${i <= s.meter - 1 ? 'bg-blue-600' : 'bg-blue-200'}`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-blue-800">Strength: {s.label}</div>
                    <ul className="mt-2 text-xs text-blue-700 list-disc list-inside space-y-1">
                      <li className={`${s.lengthOK ? 'opacity-70' : 'font-medium'}`}>At least 12 characters</li>
                      <li className={`${s.hasUpper ? 'opacity-70' : 'font-medium'}`}>Include an uppercase letter (A–Z)</li>
                      <li className={`${s.hasLower ? 'opacity-70' : 'font-medium'}`}>Include a lowercase letter (a–z)</li>
                      <li className={`${s.hasNumber ? 'opacity-70' : 'font-medium'}`}>Include a number (0–9)</li>
                      <li className={`${s.hasSymbol ? 'opacity-70' : 'font-medium'}`}>Include a symbol (!@#$…)</li>
                    </ul>
                  </div>
                );
              })()}
            </div>

            <button type="submit" disabled={loading} className={`w-full py-3 rounded-md text-white ${loading?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'} font-medium`}>{loading?'Creating…':'Create account'}</button>
          </form>

          <p className="text-sm text-blue-700 mt-6 text-center">Already have an account? <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSignup;


