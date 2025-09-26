import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
          // Verify token with backend
          // const response = await verifyToken(token);
          // setUser(response.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
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
      return loggedIn;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signupSuperAdmin = async (first_name: string, last_name: string, email: string, password: string) => {
    const response = await authApi.superAdminSignUp({ first_name, last_name, email, password });
    localStorage.setItem('token', response.token);
    setUser({
      id: response.user.id,
      email: response.user.email,
      role: 'superadmin',
      first_name: response.user.first_name,
      last_name: response.user.last_name,
      userType: response.user.userType,
      is_email_verified: response.user.is_email_verified,
    });
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
    setUser({
      id: response.user.id,
      email: response.user.email,
      role: normalizedRole,
      first_name: response.user.first_name,
      last_name: response.user.last_name,
      userType: response.user.userType,
      is_email_verified: response.user.is_email_verified,
      permission: response.user.permission,
    });
  };

  const resendVerificationOtp = async (email: string) => {
    await authApi.resendVerificationOtp({ email });
  };

  const logout = () => {
    localStorage.removeItem('token');
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
