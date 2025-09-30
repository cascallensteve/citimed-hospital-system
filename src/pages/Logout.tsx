import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Logout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      logout();
      navigate('/login');
    }, 1200);
    return () => clearTimeout(timer);
  }, [logout, navigate]);

  const name = user?.first_name || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 text-center border border-gray-100 dark:border-gray-700">
        <img src="/IMAGES/Logo.png" alt="Citimed" className="h-12 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goodbye{name ? `, ${name}` : ''}!</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">You have been logged out. See you soon.</p>
      </div>
    </div>
  );
};

export default Logout;


