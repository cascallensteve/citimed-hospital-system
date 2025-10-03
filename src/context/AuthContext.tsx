import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

type User = {
  id: number | string;
  email: string;
  role: 'admin' | 'superadmin';
  first_name?: string;
  last_name?: string;
  userType?: string;
  is_email_verified?: boolean;
  permission?: 'out-door-patient' | 'over-the-counter';
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  signupSuperAdmin: (first_name: string, last_name: string, email: string, password: string) => Promise<void>;
  signupAdmin: (first_name: string, last_name: string, email: string, password: string, permission: 'out-door-patient' | 'over-the-counter') => Promise<void>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendVerificationOtp: (email: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // Track recent resend attempts to avoid double-sends (per email)
  const resendTrackerRef = useRef<Record<string, number>>({});

  // Normalize backend user role field(s) into our local union type
  const normalizeRole = (backendUser: any): 'admin' | 'superadmin' => {
    const raw = (
      backendUser?.userType ||
      backendUser?.role ||
      backendUser?.user_type ||
      backendUser?.type ||
      ''
    ).toString().toLowerCase();
    // Remove non-letters to handle super-admin, super_admin, etc.
    const compact = raw.replace(/[^a-z]/g, '');
    if (compact === 'superadmin' || compact === 'superadministrator') return 'superadmin';
    // Fallback flags some backends might send
    if (backendUser?.is_superadmin === true || backendUser?.isSuperAdmin === true) return 'superadmin';
    return 'admin';
  };

  useEffect(() => {
    // Check for existing session on initial load
    const checkAuth = async () => {
      try {
        // TODO: Implement token verification with backend
        const token = localStorage.getItem('token');
        if (token) {
          // Hydrate cached user to prevent redirect flicker on refresh
          try {
            const raw = localStorage.getItem('user');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                setUser(parsed as any);
              }
            }
          } catch { /* ignore parse errors */ }
          // Optionally: verify token with backend here if endpoint is available
          // If verification fails, we will clear below in catch
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      localStorage.setItem('token', response.token);
      const normalizedRole = normalizeRole(response.user);
      const loggedIn: User = {
        id: response.user.id,
        email: response.user.email,
        role: normalizedRole,
        first_name: response.user.first_name,
        last_name: response.user.last_name,
        userType: response.user.userType,
        is_email_verified: response.user.is_email_verified,
        permission: response.user.permission,
      };
      setUser(loggedIn);
      try { localStorage.setItem('user', JSON.stringify(loggedIn)); } catch {}
      return loggedIn;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signupSuperAdmin = async (first_name: string, last_name: string, email: string, password: string) => {
    const response = await authApi.superAdminSignUp({ first_name, last_name, email, password });
    localStorage.setItem('token', response.token);
    const u: User = {
      id: response.user.id,
      email: response.user.email,
      role: 'superadmin',
      first_name: response.user.first_name,
      last_name: response.user.last_name,
      userType: response.user.userType,
      is_email_verified: response.user.is_email_verified,
    };
    setUser(u);
    try { localStorage.setItem('user', JSON.stringify(u)); } catch {}
  };

  const signupAdmin = async (first_name: string, last_name: string, email: string, password: string, permission: 'out-door-patient' | 'over-the-counter') => {
    const response = await authApi.adminSignUp({ first_name, last_name, email, password, permission });
    // Keep current logged-in superadmin; do not switch session to the new admin
    // Optionally return created user data to caller
    return response.user;
  };

  const verifyEmail = async (email: string, otp: string) => {
    const response = await authApi.verifyEmail({ email, otp });
    localStorage.setItem('token', response.token);
    const normalizedRole = normalizeRole(response.user);
    const u: User = {
      id: response.user.id,
      email: response.user.email,
      role: normalizedRole,
      first_name: response.user.first_name,
      last_name: response.user.last_name,
      userType: response.user.userType,
      is_email_verified: response.user.is_email_verified,
      permission: response.user.permission,
    };
    setUser(u);
    try { localStorage.setItem('user', JSON.stringify(u)); } catch {}
  };

  const resendVerificationOtp = async (email: string) => {
    const key = (email || '').trim().toLowerCase();
    const now = Date.now();
    const last = resendTrackerRef.current[key] || 0;
    // Throttle duplicate sends within 3 seconds
    if (now - last < 3000) return;
    resendTrackerRef.current[key] = now;
    try {
      await authApi.resendVerificationOtp({ email });
    } finally {
      // allow subsequent sends after window
      setTimeout(() => {
        // Keep only if not updated to a newer timestamp
        if (resendTrackerRef.current[key] === now) delete resendTrackerRef.current[key];
      }, 3100);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, signupSuperAdmin, signupAdmin, verifyEmail, resendVerificationOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
