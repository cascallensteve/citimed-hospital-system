import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [greeting, setGreeting] = useState('');
  const { login } = useAuth();
  const [welcomeUser, setWelcomeUser] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set time-based greeting
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      setGreeting('Good morning');
    } else if (currentHour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const u = await login(email, password);
      const name = u.first_name || (u.email?.split('@')[0]) || 'there';
      setWelcomeUser(name);
      toast.success(`Welcome back, ${name}!`);
      // Route directly according to role/permission
      const target = (() => {
        if (u.role === 'superadmin') return '/dashboard';
        // Admins should see Admin Overview first
        return '/dashboard/admin';
      })();
      setTimeout(() => navigate(target), 1000);
    } catch (error) {
      toast.error((error as Error)?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Back Button moved near the form (below banner) */}

      {/* Hero Banner (full-width, sticky, from very top) */}
      <div className="sticky top-0 z-20">
        <div
          className="relative w-full overflow-hidden text-white shadow-md"
          style={{
            backgroundImage:
              'url("https://res.cloudinary.com/djksfayfu/image/upload/v1758518877/6248154_esmkro.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/60 to-blue-700/40" />
          <div className="relative px-4 py-3 md:px-8 md:py-4 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Welcome to Citimed</h2>
                <p className="mt-1 text-xs md:text-sm text-blue-100">Securely sign in to access your admin dashboard</p>
              </div>
              <img src="/IMAGES/Logo.png" alt="Citimed" className="h-16 md:h-20 w-auto hidden sm:block" />
            </div>
          </div>
          <div className="relative h-[3px] bg-gradient-to-r from-blue-500/60 via-blue-500/60 to-blue-600/60" />
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Left side - Form */}
        <div className="flex-1 flex flex-col justify-start pt-4 md:pt-6 pb-8 px-4 sm:px-6 lg:px-16 xl:px-20">
          {/* Back Button near form */}
          <div className="mb-4">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center text-blue-700 hover:text-blue-900 transition-colors duration-200 bg-white rounded-full p-2 shadow-md hover:shadow-lg"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>
          {/* Mobile-only hero image */}
          <div className="mb-4 sm:mb-6 lg:hidden">
            <img
              className="w-full h-40 sm:h-56 object-cover rounded-xl shadow-md"
              src="https://res.cloudinary.com/dqvsjtkqw/image/upload/v1753882847/people-office-work-day_1_ym2pr0.jpg"
              alt="Medical background"
            />
          </div>
          <div className="mx-auto w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100 p-6">
            
            <div className="text-center mb-5">
              <h2 className="text-2xl font-bold text-blue-900">
                {greeting}
              </h2>
              <p className="mt-1 text-blue-700/80">
                Sign in to access your admin dashboard
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-base font-medium text-blue-900 mb-2">
                  Email address
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a 2 2 0 002 2h12a 2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="py-3.5 pl-10 pr-3 block w-full rounded-lg border border-blue-300 bg-white text-blue-900 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-base font-medium text-blue-900 mb-2">
                  Password
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="py-3.5 pl-10 pr-10 block w-full rounded-lg border border-blue-300 bg-white text-blue-900 placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm"
                    placeholder="Enter your password"
                  />
                  {/* Password visibility toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-500/70 hover:text-blue-600 focus:outline-none"
                  >
                    {showPassword ? (
                      // Eye-off icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.808 1.393a1 1 0 00-1.415 1.414l19.8 19.8a1 1 0 101.415-1.414l-3.028-3.028C21.64 15.88 23 12.999 23 12.999s-3.367-7-11-7c-2.01 0-3.77.386-5.266 1.02L2.808 1.393zM12 7.999a5 5 0 014.95 4.286l-2.063-2.063A3 3 0 0012 8.999c-.34 0-.665.057-.97.162l-1.2-1.2A4.98 4.98 0 0112 7.999z" />
                        <path d="M3.06 4.474A15.77 15.77 0 001 12.001s3.367 7 11 7c1.69 0 3.23-.236 4.62-.653l-3.1-3.1A5.002 5.002 0 017 12.001c0-.553.095-1.083.27-1.577L3.06 4.474z" />
                      </svg>
                    ) : (
                      // Eye icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 5c-7.633 0-11 6.999-11 7s3.367 7 11 7 11-6.999 11-7-3.367-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-base text-blue-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="/login/forgot" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex justify-center items-center gap-2 py-3.5 px-5 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : 'Sign in'}
                </button>
              </div>
            </form>

            {/* Optional third-party login removed to keep color scheme strictly blue/green/white */}
            
            <div className="mt-8 text-center">
              <p className="text-sm text-blue-700">
               {' '}
                <a href="/signup/super" className="font-medium text-blue-600 hover:text-blue-500">
                
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Image */}
        <div className="hidden lg:block relative w-1/2">
          <div className="absolute inset-0 bg-gradient-to-l from-blue-900/70 to-blue-700/70 z-10"></div>
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src="https://res.cloudinary.com/dqvsjtkqw/image/upload/v1753882847/people-office-work-day_1_ym2pr0.jpg"
            alt="Medical background"
          />
          <div className="absolute inset-0 flex items-center justify-center z-20 p-12">
            <div className="text-center text-white">
              <h3 className="text-4xl font-bold mb-6">Citimed Healthcare Solutions</h3>
              <p className="text-xl opacity-90">Advanced medical administration platform for healthcare professionals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-blue-100 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-blue-700 mb-2 md:mb-0">
              © {new Date().getFullYear()} Citimed Healthcare Solutions. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {isLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-blue-100 rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-blue-900">Signing you in…</span>
          </div>
        </div>
      )}

      {welcomeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
            <img src="/IMAGES/Logo.png" alt="Citimed" className="h-12 w-auto mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-blue-900">Welcome, {welcomeUser}!</h3>
            <p className="text-blue-700 mt-2">Taking you to your dashboard…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;