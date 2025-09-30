import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarDaysIcon, UserGroupIcon, DocumentTextIcon, ShoppingCartIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

const LandingPage = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className={`bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-50 transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <img src="/IMAGES/Logo.png" alt="Citimed-Clinic logo" className="h-8 sm:h-10 md:h-12 w-auto object-contain" />
              <span className="truncate text-base sm:text-lg md:text-xl font-semibold text-gray-900">Citimed-Clinic</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to="/login"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors duration-300"
              >
                Login
              </Link>
              <Link
                to="/login"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-800 rounded-md hover:shadow-lg transition-all duration-300 flex items-center gap-1 hover:scale-105"
              >
                <span className="hidden sm:inline">Get Started</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className={`sm:text-center lg:text-left transition-all duration-700 delay-150 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">Citimed Healthcare</span>
                  <span className="block text-blue-600">Administration Portal</span>
                </h1>
                <p className="mt-3 text-base text-gray-600 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Manage your healthcare facility efficiently with our comprehensive administration system designed for medical professionals.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start space-y-3 sm:space-y-0 sm:space-x-4">
                  <Link
                    to="/login"
                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-300 md:py-4 md:text-lg md:px-10"
                  >
                    Access Portal
                  </Link>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className={`transform transition-all duration-1000 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
            <img
              className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full rounded-md lg:rounded-none"
              src="https://images.unsplash.com/photo-1550831107-1553da8c8464?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1374&q=80"
              alt="Healthcare professionals"
            />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`lg:text-center transition-all duration-700 delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">Administration Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Comprehensive Healthcare Management
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 lg:mx-auto">
              Streamline operations with our integrated healthcare administration system.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: 'Patient Management',
                  description: 'Complete electronic health records with secure access controls.',
                  icon: <UserGroupIcon className="h-6 w-6" />
                },
                {
                  name: 'Appointment Scheduling',
                  description: 'Intuitive calendar system with automated reminders.',
                  icon: <CalendarDaysIcon className="h-6 w-6" />
                },
                {
                  name: 'Billing & Insurance',
                  description: 'Streamlined billing processes with insurance claim integration.',
                  icon: <DocumentTextIcon className="h-6 w-6" />
                },
                {
                  name: 'Inventory Management',
                  description: 'Track medical supplies and pharmacy inventory in real-time.',
                  icon: <ShoppingCartIcon className="h-6 w-6" />
                },
                {
                  name: 'Reporting & Analytics',
                  description: 'Customizable reports and data visualization tools.',
                  icon: <ChartBarIcon className="h-6 w-6" />
                },
                {
                  name: 'HIPAA Compliant Security',
                  description: 'Enterprise-grade security with full compliance monitoring.',
                  icon: <ShieldCheckIcon className="h-6 w-6" />
                },
              ].map((feature, index) => (
                <div 
                  key={feature.name} 
                  className={`bg-gray-50 rounded-lg p-6 transition-all duration-500 hover:shadow-md ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-100 text-blue-600">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    {feature.name}
                  </h3>
                  <p className="mt-2 text-base text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Trusted by Healthcare Providers
            </h2>
            <p className="mt-3 text-xl text-blue-100">
              Join medical professionals using Citimed Admin
            </p>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {[
                { label: 'Healthcare Facilities', value: '250+' },
                { label: 'Medical Professionals', value: '5,000+' },
                { label: 'Patient Records', value: '2M+' },
              ].map((stat, index) => (
                <div 
                  key={stat.label} 
                  className={`transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${index * 200}ms` }}
                >
                  <div className="bg-white/10 rounded-lg px-6 py-8">
                    <p className="text-4xl font-extrabold text-white">{stat.value}</p>
                    <p className="mt-2 text-blue-100">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-20 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            <span className="block">Ready to optimize your healthcare administration?</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Streamline operations, enhance patient care, and improve efficiency with our dedicated healthcare administration platform.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-300"
          >
            Get Started Today
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            <img src="/IMAGES/Logo.png" alt="Citimed" className="h-24 w-auto object-contain" />
            <nav className="my-6 flex flex-wrap justify-center">
              <div className="px-5 py-2">
                <Link to="/privacy" className="text-base text-gray-600 hover:text-blue-600">
                  Privacy
                </Link>
              </div>
              <div className="px-5 py-2">
                <Link to="/terms" className="text-base text-gray-600 hover:text-blue-600">
                  Terms
                </Link>
              </div>
              <div className="px-5 py-2">
                <Link to="/support" className="text-base text-gray-600 hover:text-blue-600">
                  Support
                </Link>
              </div>
            </nav>
            <p className="text-center text-gray-500">
              &copy; {new Date().getFullYear()} Citimed. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;