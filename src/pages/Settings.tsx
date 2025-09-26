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

  // Notification preferences (local only for now)
  const [notifyEmail, setNotifyEmail] = useState(() => localStorage.getItem('notifyEmail') === 'true');
  const [notifySMS, setNotifySMS] = useState(() => localStorage.getItem('notifySMS') === 'true');

  useEffect(() => {
    localStorage.setItem('notifyEmail', String(notifyEmail));
  }, [notifyEmail]);
  useEffect(() => {
    localStorage.setItem('notifySMS', String(notifySMS));
  }, [notifySMS]);

  // Clinic info (local demo persistence)
  const [clinicName, setClinicName] = useState(() => localStorage.getItem('clinicName') || 'Citimed Clinic');
  const [clinicPhone, setClinicPhone] = useState(() => localStorage.getItem('clinicPhone') || '');
  const [clinicAddress, setClinicAddress] = useState(() => localStorage.getItem('clinicAddress') || '');
  const [savingClinic, setSavingClinic] = useState(false);
  const saveClinicInfo = async () => {
    setSavingClinic(true);
    try {
      // In a real app, call your API here. For now, persist locally.
      localStorage.setItem('clinicName', clinicName);
      localStorage.setItem('clinicPhone', clinicPhone);
      localStorage.setItem('clinicAddress', clinicAddress);
      // You can add a toast here if you have one globally configured
    } finally {
      setSavingClinic(false);
    }
  };

  // Change password (placeholder UI)
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword || !newPassword) {
      setError('Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setChanging(true);
    try {
      // Replace with your API call
      await new Promise(r => setTimeout(r, 800));
      setSuccess('Password changed successfully (demo).');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError('Failed to change password.');
    } finally {
      setChanging(false);
    }
  };

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

      {/* Notifications */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Email Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receive updates and reports by email.</p>
            </div>
            <button
              onClick={() => setNotifyEmail(e => !e)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                notifyEmail ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                  notifyEmail ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">SMS Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Critical alerts (requires verified phone).</p>
            </div>
            <button
              onClick={() => setNotifySMS(e => !e)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                notifySMS ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                  notifySMS ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Clinic Information */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Clinic Information</h3>
          <button
            onClick={saveClinicInfo}
            disabled={savingClinic}
            className={`px-4 py-2 rounded-md text-white ${savingClinic ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
          >
            {savingClinic ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Clinic Name</label>
            <input
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Citimed Hospital"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Phone</label>
            <input
              value={clinicPhone}
              onChange={e => setClinicPhone(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., +1 555 123 4567"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 dark:text-gray-300">Address</label>
            <textarea
              value={clinicAddress}
              onChange={e => setClinicAddress(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Street, City, State, ZIP"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">These values are stored locally for demo purposes. Connect your backend to persist them.</p>
      </section>

      {/* Security */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security</h3>
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-3 flex items-center space-x-3">
            <button
              type="submit"
              disabled={changing}
              className={`px-4 py-2 rounded-md text-white ${changing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
            >
              {changing ? 'Changing…' : 'Change Password'}
            </button>
            {error && <span className="text-sm text-red-500">{error}</span>}
            {success && <span className="text-sm text-green-600">{success}</span>}
          </div>
        </form>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This is a demo form. Wire it to your authentication backend to enable real password changes.</p>
      </section>
    </div>
  );
};

export default Settings;
