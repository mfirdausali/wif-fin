import React from 'react';
import { DashboardView } from '../types';
import CreateInvoice from './CreateInvoice';

interface DashboardProps {
  onLogout: () => void;
  currentView: DashboardView;
  setView: (view: DashboardView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, currentView, setView }) => {
  
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Top Brand Stripe */}
      <div className="h-1 bg-wif-red w-full"></div>

      {/* Header Section */}
      <header className="border-b-2 border-gray-900 mb-8">
        <div className="max-w-6xl mx-auto px-4 lg:px-0">
            <div className="flex justify-between items-end py-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-wif-red text-white flex items-center justify-center font-serif font-black text-2xl">
                        W
                    </div>
                    <div>
                        <h1 className="text-2xl font-serif font-black text-gray-900 tracking-tight leading-none">WIF FINANCIAL</h1>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Internal Control System</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                    <div className="text-right hidden sm:block">
                        <div className="font-bold text-gray-900">Wan Iqmal Fathi</div>
                        <div className="text-xs text-gray-500 uppercase">Administrator</div>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="border border-gray-300 px-4 py-1 hover:bg-gray-100 text-xs font-bold uppercase tracking-wide"
                    >
                        Log Out
                    </button>
                </div>
            </div>

            {/* Navigation Bar */}
            <nav className="flex gap-8 text-sm font-bold border-t border-gray-200 py-3">
                <button onClick={() => setView('overview')} className={`uppercase tracking-wide ${currentView === 'overview' ? 'text-wif-red' : 'text-gray-500 hover:text-gray-900'}`}>
                    Overview
                </button>
                <button onClick={() => setView('create-invoice')} className={`uppercase tracking-wide ${currentView === 'create-invoice' ? 'text-wif-red' : 'text-gray-500 hover:text-gray-900'}`}>
                    Transactions
                </button>
                <button className="uppercase tracking-wide text-gray-500 hover:text-gray-900">
                    Reports
                </button>
                <button className="uppercase tracking-wide text-gray-500 hover:text-gray-900">
                    Settings
                </button>
            </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-0 pb-20">
        
        {currentView === 'create-invoice' && (
          <CreateInvoice onCancel={() => setView('overview')} />
        )}

        {currentView === 'overview' && (
          <div className="animate-fade-in space-y-10">
            
            {/* Date Header */}
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="font-serif text-lg font-bold text-gray-900">Market Overview</span>
                <span className="font-mono text-sm text-gray-500">2025-11-21 (FRI)</span>
            </div>

            {/* Financial Ticker / Stats Row */}
            <div className="border-y border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200">
                    {['Invoices Paid', 'Receipts', 'Pending Vouchers', 'Statements'].map((label, idx) => (
                        <div key={idx} className="p-4 hover:bg-white transition-colors cursor-pointer group">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 group-hover:text-wif-red transition-colors">{label}</div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-serif text-3xl font-black text-gray-900">0</span>
                                <span className="text-xs font-mono text-gray-400">count</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Quick Actions List */}
                    <section>
                        <h3 className="text-sm font-bold bg-gray-900 text-white px-3 py-1 inline-block mb-4 uppercase">Quick Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => setView('create-invoice')} className="border border-gray-300 p-4 flex items-start gap-4 hover:border-wif-red hover:bg-gray-50 transition-all text-left group">
                                <div className="bg-gray-100 p-2 group-hover:bg-white border border-gray-200">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-serif font-bold text-lg text-gray-900 group-hover:text-wif-red">Invoice</h4>
                                    <p className="text-xs text-gray-500 mt-1">Issue new bill to customer</p>
                                </div>
                            </button>

                            <button className="border border-gray-300 p-4 flex items-start gap-4 hover:border-wif-red hover:bg-gray-50 transition-all text-left group">
                                <div className="bg-gray-100 p-2 group-hover:bg-white border border-gray-200">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-serif font-bold text-lg text-gray-900 group-hover:text-wif-red">Receipt</h4>
                                    <p className="text-xs text-gray-500 mt-1">Log incoming payment</p>
                                </div>
                            </button>

                            <button className="border border-gray-300 p-4 flex items-start gap-4 hover:border-wif-red hover:bg-gray-50 transition-all text-left group">
                                <div className="bg-gray-100 p-2 group-hover:bg-white border border-gray-200">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-serif font-bold text-lg text-gray-900 group-hover:text-wif-red">Voucher</h4>
                                    <p className="text-xs text-gray-500 mt-1">Authorize payment out</p>
                                </div>
                            </button>

                            <button className="border border-gray-300 p-4 flex items-start gap-4 hover:border-wif-red hover:bg-gray-50 transition-all text-left group">
                                <div className="bg-gray-100 p-2 group-hover:bg-white border border-gray-200">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-serif font-bold text-lg text-gray-900 group-hover:text-wif-red">Statement</h4>
                                    <p className="text-xs text-gray-500 mt-1">Generate summary</p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* Document Table */}
                    <section>
                        <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
                            <h3 className="text-sm font-bold bg-gray-900 text-white px-3 py-1 inline-block uppercase">Recent Activity</h3>
                            <div className="flex gap-4 text-xs font-bold text-gray-500 uppercase">
                                <button className="text-wif-red underline decoration-2 underline-offset-4">All</button>
                                <button className="hover:text-gray-900">Processed</button>
                                <button className="hover:text-gray-900">Drafts</button>
                            </div>
                        </div>
                        
                        <div className="border border-gray-200 min-h-[200px] flex flex-col items-center justify-center bg-gray-50">
                             <p className="font-serif text-gray-400 italic">No recent transactions found within this fiscal period.</p>
                        </div>
                    </section>
                </div>

                {/* Side Panel / News Feed style */}
                <aside className="space-y-8">
                     <div className="border-t-4 border-gray-900 pt-4">
                        <h4 className="font-serif font-bold text-xl mb-4">Notices</h4>
                        <ul className="space-y-4">
                            <li className="group cursor-pointer">
                                <div className="text-xs text-gray-400 font-mono mb-1">2025/11/20</div>
                                <div className="text-sm font-medium leading-snug group-hover:text-wif-red group-hover:underline">Q3 Fiscal closing procedures updated.</div>
                            </li>
                            <li className="border-t border-gray-200 pt-4 group cursor-pointer">
                                <div className="text-xs text-gray-400 font-mono mb-1">2025/11/18</div>
                                <div className="text-sm font-medium leading-snug group-hover:text-wif-red group-hover:underline">System maintenance scheduled for weekend.</div>
                            </li>
                             <li className="border-t border-gray-200 pt-4 group cursor-pointer">
                                <div className="text-xs text-gray-400 font-mono mb-1">2025/11/15</div>
                                <div className="text-sm font-medium leading-snug group-hover:text-wif-red group-hover:underline">Exchange rate policy adjustments (JPY/USD).</div>
                            </li>
                        </ul>
                     </div>

                     <div className="bg-gray-100 p-4 border border-gray-200">
                        <h5 className="font-bold text-xs uppercase tracking-wider mb-2 text-gray-500">System Status</h5>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                            <span className="text-sm font-bold">Operational</span>
                        </div>
                     </div>
                </aside>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;