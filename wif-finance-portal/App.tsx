import React, { useEffect, useState } from 'react';
import LoginCard from './components/LoginCard';
import BackgroundPattern from './components/BackgroundPattern';
import Dashboard from './components/Dashboard';
import { fetchDailyWisdom } from './services/geminiService';
import { DashboardView } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wisdom, setWisdom] = useState<string>('');
  const [currentView, setCurrentView] = useState<DashboardView>('overview');

  useEffect(() => {
    const getWisdom = async () => {
      const text = await fetchDailyWisdom();
      setWisdom(text);
    };
    getWisdom();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView('overview');
  };

  if (isAuthenticated) {
    return (
      <Dashboard 
        onLogout={handleLogout} 
        currentView={currentView}
        setView={setCurrentView}
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans bg-white">
      
      {/* Left Panel: The "Brand" Column */}
      <div className="relative w-full md:w-[450px] lg:w-[500px] xl:w-[600px] flex-shrink-0 bg-wif-navy text-white flex flex-col justify-between overflow-hidden order-2 md:order-1">
        {/* Pattern Layer */}
        <BackgroundPattern />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-wif-navy/90 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 p-10 lg:p-14">
           <div className="flex items-center gap-4 mb-2">
             <div className="w-12 h-12 bg-white text-wif-navy flex items-center justify-center font-serif font-bold text-2xl shadow-md">
                W
             </div>
             <span className="text-xl font-semibold tracking-tight">WIF JAPAN</span>
           </div>
           <div className="h-1 w-12 bg-wif-blue mt-4 mb-2"></div>
           <p className="text-sm text-gray-300 uppercase tracking-widest font-medium">Finance Department</p>
        </div>

        {/* Wisdom/Quote Content */}
        <div className="relative z-10 px-10 lg:px-14 pb-20">
           <blockquote className="font-serif text-2xl lg:text-3xl leading-snug text-white mb-6 font-light">
              "{wisdom || "Loading financial insights..."}"
           </blockquote>
           <div className="flex items-center gap-3">
             <div className="h-px w-6 bg-gray-400"></div>
             <span className="text-sm text-gray-400 uppercase tracking-wide">Daily Wisdom</span>
           </div>
        </div>

         {/* Vertical Japanese Text Decoration */}
        <div className="absolute top-1/2 -translate-y-1/2 right-8 opacity-10 pointer-events-none select-none">
             <span className="writing-vertical-rl text-7xl font-serif font-bold text-white">
                信頼と繁栄
             </span>
        </div>
      </div>

      {/* Right Panel: The "Action" Column */}
      <main className="flex-1 bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 relative order-1 md:order-2">
        
        <div className="w-full max-w-md">
           <LoginCard onLogin={handleLogin} />
        </div>
        
        {/* Footer */}
        <footer className="absolute bottom-0 w-full p-6 border-t border-gray-100">
           <div className="max-w-md mx-auto md:max-w-none md:mx-0 flex flex-wrap justify-center md:justify-start gap-6 text-xs text-gray-500">
              <a href="#" className="hover:text-wif-blue hover:underline">Privacy</a>
              <a href="#" className="hover:text-wif-blue hover:underline">Security</a>
              <a href="#" className="hover:text-wif-blue hover:underline">Terms & Conditions</a>
              <span>© 2025 WIF Japan. All rights reserved.</span>
           </div>
        </footer>
      </main>

    </div>
  );
};

export default App;
