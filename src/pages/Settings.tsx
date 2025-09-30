import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const Settings = () => {
  const { user } = useAuth();

  // Theme state synced with localStorage + document root
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  

  

  

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Customize your Citimed experience.</p>
      </div>

      {/* Appearance */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isDarkMode ? (
              <MoonIcon className="h-6 w-6 text-blue-400" />
            ) : (
              <SunIcon className="h-6 w-6 text-yellow-500" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-200">Theme</span>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${
              isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                isDarkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Light and Dark themes are remembered on this device.</p>
      </section>

      {/* Profile (read-only basic) */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Email</label>
            <div className="mt-1 p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">
              {user?.email || '—'}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Role</label>
            <div className="mt-1 p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">
              {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </div>
          </div>
        </div>
      </section>

      

      

      
    </div>
  );
};

export default Settings;
