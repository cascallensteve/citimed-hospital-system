import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  UserGroupIcon, 
  CalendarDaysIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

const AdminLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const permission = (user?.permission as 'out-door-patient' | 'over-the-counter' | undefined) || 'out-door-patient';
  const isOutdoor = permission === 'out-door-patient';
  const isCounter = permission === 'over-the-counter';

  // Always start on Overview; content adapts to permission
  const [activeTab, setActiveTab] = useState('home');

  // Compute active section from URL so sidebar highlights correctly even on direct route hits
  const pathname = location.pathname || '';
  const activeFromPath = useMemo(() => {
    if (/\/dashboard\/admin\/?$/.test(pathname)) return 'home';
    if (pathname.includes('/dashboard/admin/patients')) return 'patients';
    if (pathname.includes('/dashboard/admin/visits')) return 'visits';
    if (pathname.includes('/dashboard/admin/reports')) return 'reports';
    if (pathname.includes('/dashboard/admin/pharmacy')) return 'pharmacy';
    return 'home';
  }, [pathname]);

  // Sample data for demonstration
  const dashboardData = {
    patients: {
      total: 1245,
      new: 42,
      walkIn: 28,
      repeat: 14
    },
    visits: {
      today: 28,
      thisWeek: 156,
      pending: 8
    },
    pharmacy: {
      totalItems: 342,
      lowStock: 12,
      sales: 45
    },
    balances: {
      totalPaid: 125640,
      outstanding: 18750,
      today: 5240
    }
  };

  const quickActions = useMemo(() => {
    if (isOutdoor) {
      return [
        { name: 'Add Patient', icon: PlusIcon, color: 'bg-blue-600', onClick: () => navigate('/dashboard/admin/patients?add=1') },
        { name: 'New Visit', icon: CalendarDaysIcon, color: 'bg-green-600', onClick: () => navigate('/dashboard/admin/visits?add=1') },
        { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', onClick: () => navigate('/dashboard/admin/patients') }
      ];
    }
    return [
      { name: 'Pharmacy Sale', icon: ShoppingCartIcon, color: 'bg-purple-600', onClick: () => navigate('/dashboard/admin/pharmacy?sale=1') },
      { name: 'Search Patient', icon: MagnifyingGlassIcon, color: 'bg-orange-600', onClick: () => navigate('/dashboard/admin/patients') }
    ];
  }, [isOutdoor, navigate]);

  const sidebarItems = useMemo(() => {
    if (isOutdoor) {
      return [
        { name: 'Overview', icon: ChartBarIcon, id: 'home', path: '/dashboard/admin' },
        { name: 'Patients', icon: UserGroupIcon, id: 'patients', path: '/dashboard/admin/patients' },
        { name: 'Visits', icon: CalendarDaysIcon, id: 'visits', path: '/dashboard/admin/visits' }
      ];
    }
    return [
      { name: 'Overview', icon: ChartBarIcon, id: 'home', path: '/dashboard/admin' },
      { name: 'Pharmacy', icon: ShoppingCartIcon, id: 'pharmacy', path: '/dashboard/admin/pharmacy' },
      { name: 'Reports', icon: DocumentTextIcon, id: 'reports', path: '/dashboard/admin/reports' }
    ];
  }, [isOutdoor]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Internal Sidebar: only show for Counter Admins to avoid duplicate sidebars for Outdoor Admins */}
        {isCounter && (
          <div className="w-64 bg-white shadow-sm min-h-screen">
            <div className="p-6">
              <div className="flex items-center space-x-3">
                <img src="/IMAGES/Logo.png" alt="Citimed-Clinic logo" className="h-10 w-auto object-contain" />
                <h1 className="text-xl font-bold text-gray-900">Citimed-Clinic</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isOutdoor ? 'Admin • Out-door Patient' : 'Admin • Over-the-Counter'}
              </p>
            </div>
            
            <nav className="mt-6">
              {sidebarItems.map((item) => {
                const isActive = (activeFromPath === item.id) || (activeTab === item.id && activeFromPath === 'home' && item.id === 'home');
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); navigate(item.path); }}
                    className={`w-full flex items-center px-6 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Main Content (full width for Outdoor Admin) */}
        <div className={`p-6 ${isCounter ? 'flex-1' : 'w-full'}`}>
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 capitalize">
              {activeTab === 'home' ? (isOutdoor ? 'Out-door Patient Dashboard' : 'Over-the-Counter Dashboard') : activeTab}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {activeTab === 'home' 
                ? (isOutdoor 
                    ? 'Welcome. Manage patients and clinical visits.' 
                    : 'Welcome. Manage pharmacy inventory and sales.'
                  )
                : `Manage ${activeTab} and related operations`}
            </p>
          </div>

          {/* Home Dashboard */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {quickActions.map((action) => (
                    <button
                      key={action.name}
                      onClick={action.onClick}
                      className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2`}
                    >
                      <action.icon className="h-6 w-6" />
                      <span className="font-medium">{action.name}</span>
                    </button>
                  ))}
                </div>
                {isCounter && (
                  <p className="text-xs text-gray-500 mt-3">Note: Pharmacy admins have access limited to pharmacy operations.</p>
                )}
              </div>

              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isOutdoor && (
                  <>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <UserGroupIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Patients</p>
                          <p className="text-2xl font-semibold text-gray-900">{dashboardData.patients.total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CalendarDaysIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Today's Visits</p>
                          <p className="text-2xl font-semibold text-gray-900">{dashboardData.visits.today}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {isCounter && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <ShoppingCartIcon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Pharmacy Items</p>
                        <p className="text-2xl font-semibold text-gray-900">{dashboardData.pharmacy.totalItems}</p>
                      </div>
                    </div>
                  </div>
                )}

                {isCounter && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Paid</p>
                        <p className="text-2xl font-semibold text-gray-900">${dashboardData.balances.totalPaid.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {isOutdoor && (
                    <>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-600">New patient registered: John Doe</span>
                        </div>
                        <span className="text-xs text-gray-500">2 minutes ago</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span className="text-sm text-gray-600">Visit completed for Patient #1234</span>
                        </div>
                        <span className="text-xs text-gray-500">15 minutes ago</span>
                      </div>
                    </>
                  )}
                  {isCounter && (
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <span className="text-sm text-gray-600">Pharmacy sale: $45.00</span>
                      </div>
                      <span className="text-xs text-gray-500">1 hour ago</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Other Tabs Content */}
          {activeTab !== 'home' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">{activeTab} Management</h3>
              <p className="text-gray-600">
                {activeTab === 'patients' && isOutdoor && 'Manage patient records, search, and registration with unique patient numbers.'}
                {activeTab === 'visits' && isOutdoor && 'Record clinical visits, complaints, examinations, diagnoses, and prescriptions.'}
                {activeTab === 'pharmacy' && isCounter && 'Manage inventory, stock updates, and sales linked to patient visits.'}
                {activeTab === 'reports' && 'Generate comprehensive reports and analytics for patients, visits, and financial data.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;