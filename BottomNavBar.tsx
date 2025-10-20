import React from 'react';
import { View } from '../types';

interface BottomNavBarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const NavItem: React.FC<{
  targetView: View;
  currentView: View;
  onNavigate: (view: View) => void;
  // Fix: Used React.ReactElement instead of JSX.Element to resolve namespace error.
  icon: React.ReactElement;
  label: string;
}> = ({ targetView, currentView, onNavigate, icon, label }) => {
  const isActive = currentView === targetView;
  const colorClass = isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400';

  return (
    <button
      onClick={() => onNavigate(targetView)}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors ${colorClass} hover:text-primary-500 dark:hover:text-primary-300`}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
  const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>);
  const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
  const ProfilesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.122-1.28-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.122-1.28.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 z-40">
      <div className="flex justify-around max-w-4xl mx-auto">
        <NavItem targetView={View.DASHBOARD} currentView={currentView} onNavigate={onNavigate} icon={<DashboardIcon />} label="Today" />
        <NavItem targetView={View.HISTORY} currentView={currentView} onNavigate={onNavigate} icon={<HistoryIcon />} label="History" />
        <NavItem targetView={View.PROFILES} currentView={currentView} onNavigate={onNavigate} icon={<ProfilesIcon />} label="Profiles" />
      </div>
    </footer>
  );
};

export default BottomNavBar;