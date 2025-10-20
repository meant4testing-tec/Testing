import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { db } from './services/db';
import { Profile, View, Schedule, DoseStatus } from './types';
import Header from './components/Header';
import TermsModal from './components/TermsModal';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ProfilesPage from './components/ProfilesPage';
import BottomNavBar from './components/BottomNavBar';
import { DEVELOPER_NAME } from './constants';
import AlarmBanner from './components/AlarmBanner';
import { cancelNativeNotification } from './services/notificationManager';

const App: React.FC = () => {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const [termsAccepted, setTermsAccepted] = useLocalStorage('termsAccepted', false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>(View.DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [alarmingSchedule, setAlarmingSchedule] = useState<Schedule | null>(null);


  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const fetchProfiles = useCallback(async (profileToSelectId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const allProfiles = await db.profiles.getAll();
      setProfiles(allProfiles);
      if (allProfiles.length > 0) {
        const idToSelect = profileToSelectId || localStorage.getItem('selectedProfileId');
        const profileToSelect = idToSelect ? allProfiles.find(p => p.id === idToSelect) : allProfiles[0];
        setSelectedProfile(profileToSelect || allProfiles[0]);
      } else {
        setSelectedProfile(null);
        setView(View.PROFILES);
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setError(`Could not load app data. ${errorMessage} This can happen in private browsing mode or if your browser's storage is disabled or unsupported.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (termsAccepted) {
        fetchProfiles();
    }
  }, [fetchProfiles, termsAccepted]);

  useEffect(() => {
    if (selectedProfile?.id) {
        localStorage.setItem('selectedProfileId', selectedProfile.id);
    } else if (profiles.length === 0) {
        localStorage.removeItem('selectedProfileId');
    }
    
    // Communicate the selected profile to the service worker for background notifications.
    const setProfileInSW = () => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_PROFILE',
          profileId: selectedProfile?.id || null
        });
      }
    };

    if (navigator.serviceWorker?.controller) {
       setProfileInSW();
    } else {
       navigator.serviceWorker?.ready.then(setProfileInSW);
    }

  }, [selectedProfile, profiles]);
  
  const checkforAlarms = useCallback(async () => {
    if (!selectedProfile || alarmingSchedule || !termsAccepted) return;

    const now = new Date();
    // Check for any PENDING schedules that are now in the past.
    // We check up to 5 minutes in the past to catch any missed intervals.
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); 

    try {
      const potentialAlarms = await db.schedules.getByDateRange(selectedProfile.id, fiveMinutesAgo.toISOString(), now.toISOString());
      
      const dueSchedule = potentialAlarms.find(s => s.status === DoseStatus.PENDING);

      if (dueSchedule) {
          const profile = await db.profiles.get(dueSchedule.profileId);
          setAlarmingSchedule({ ...dueSchedule, profileName: profile?.name });
      }
    } catch(e) {
        console.error("Error checking for alarms:", e);
    }
  }, [selectedProfile, alarmingSchedule, termsAccepted]);

  useEffect(() => {
    const intervalId = setInterval(checkforAlarms, 15000); // Check every 15 seconds
    return () => clearInterval(intervalId);
  }, [checkforAlarms]);

  const handleUpdateAlarmingSchedule = async (scheduleId: string, status: DoseStatus.TAKEN | DoseStatus.SKIPPED) => {
      const scheduleToUpdate = alarmingSchedule;
      if (scheduleToUpdate && scheduleToUpdate.id === scheduleId) {
          await db.schedules.update({
              ...scheduleToUpdate,
              status,
              actualTakenTime: status === DoseStatus.TAKEN ? new Date().toISOString() : null,
          });
          // No need to cancel native notification here, as the SW won't re-notify for a non-pending status.
          setAlarmingSchedule(null);
          // The dashboard will refresh its data automatically via its own useEffect when it becomes visible.
      }
  };


  const handleProfileSelect = (profile: Profile | null) => {
    setSelectedProfile(profile);
    if (profile) {
        setView(View.DASHBOARD);
    }
  };
  
  const pageTitles: { [key in View]: string } = {
    [View.DASHBOARD]: "Today's Schedule",
    [View.HISTORY]: 'Medication History',
    [View.PROFILES]: 'Manage Profiles',
  };

  const renderContent = () => {
    if (error) {
      return <div className="text-center p-8 text-red-500 dark:text-red-400">{error}</div>;
    }
      
    if (loading) {
      return <div className="text-center p-8 text-gray-500 dark:text-gray-400">Loading...</div>;
    }

    if (!selectedProfile && view !== View.PROFILES) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-primary-300 dark:text-primary-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">No Profile Selected</h2>
            <p className="text-gray-600 dark:text-gray-400">Go to the 'Profiles' tab to add or select a profile.</p>
        </div>
      );
    }

    switch (view) {
      case View.HISTORY:
        return <HistoryView profile={selectedProfile!} />;
      case View.PROFILES:
        return <ProfilesPage profiles={profiles} selectedProfile={selectedProfile} onProfileSelect={handleProfileSelect} onProfilesUpdate={fetchProfiles} />;
      case View.DASHBOARD:
      default:
        return <Dashboard profile={selectedProfile!} />;
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme}`}>
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-screen">
          {!termsAccepted && <TermsModal onAccept={() => setTermsAccepted(true)} />}
          {showTerms && <TermsModal onAccept={() => setShowTerms(false)} isReopened={true} />}
      
          <Header 
              theme={theme} 
              onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
              title={selectedProfile ? `${pageTitles[view]} for ${selectedProfile.name.split(' ')[0]}` : pageTitles[view]}
          />

          {alarmingSchedule && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full px-4" style={{maxWidth: 'calc(100% - 2rem)'}}>
                  <AlarmBanner schedule={alarmingSchedule} onUpdate={handleUpdateAlarmingSchedule} />
              </div>
          )}

          <main className="pt-20 pb-24">
              <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
                  <div className="bg-white dark:bg-gray-900/50 rounded-2xl shadow-lg p-4 sm:p-6">
                      {termsAccepted ? renderContent() : <p className="text-center py-10">Please accept the terms to use the app.</p>}
                  </div>
              </div>
          </main>
          
          {termsAccepted && <BottomNavBar currentView={view} onNavigate={setView} />}

          <footer className="text-center py-4 px-4 pb-20 sm:pb-4">
              <p className="text-xs text-gray-500 dark:text-gray-600">
                  Powered by {DEVELOPER_NAME} ・ 
                  <button 
                      onClick={() => setShowTerms(true)} 
                      className="underline hover:text-primary-600 dark:hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                  >
                      Terms of Use
                  </button>
              </p>
          </footer>
      </div>
    </div>
  );
};

export default App;