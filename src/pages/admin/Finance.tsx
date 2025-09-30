import { useEffect, useState } from 'react';

const Finance = () => {
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<{ charges: string; paid: string; balance: string } | null>(null);

  useEffect(() => {
    // TODO: Wire to backend endpoints when provided. For now, show placeholders.
    setLoading(true);
    setTimeout(() => {
      setTotals({ charges: '0.00', paid: '0.00', balance: '0.00' });
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden rounded-xl text-white shadow-lg"
        style={{
          backgroundImage:
            'url("https://res.cloudinary.com/djksfayfu/image/upload/v1758518877/6248154_esmkro.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-indigo-900/50 to-purple-900/30" />
        <div className="relative px-6 py-8 md:px-10 md:py-10 z-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Finance</h2>
            <p className="mt-2 text-sm md:text-base text-blue-100">
              Monitor charges, payments, and outstanding balances.
            </p>
          </div>
        </div>
        <div className="relative h-2 bg-gradient-to-r from-blue-500/60 via-indigo-500/60 to-purple-500/60" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600">Total Charges</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {loading ? '—' : `KES ${totals?.charges ?? '0.00'}`}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600">Total Paid</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {loading ? '—' : `KES ${totals?.paid ?? '0.00'}`}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-600">Outstanding Balance</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {loading ? '—' : `KES ${totals?.balance ?? '0.00'}`}
          </div>
        </div>
      </div>

      {/* Placeholder table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Financial Activity</h3>
        </div>
        <div className="p-6 text-sm text-gray-600">
          Financial reports and detailed transactions will appear here. Share the finance endpoints to wire this up.
        </div>
      </div>
    </div>
  );
};

export default Finance;
