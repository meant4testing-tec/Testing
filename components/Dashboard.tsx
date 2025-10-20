import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import { Profile, Medicine, Schedule, DoseStatus } from '../types';
import { cancelNativeNotification } from '../services/notificationManager';
import MedicineFormModal from './AddMedicineModal';

interface DashboardProps {
  profile: Profile;
}

const AdherenceRing: React.FC<{ percentage: number }> = ({ percentage }) => {
    const size = 80;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    let colorClass = 'text-green-500';
    if (percentage < 75) colorClass = 'text-yellow-500';
    if (percentage < 50) colorClass = 'text-red-500';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    className="text-gray-200 dark:text-gray-700"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`${colorClass} transition-all duration-500`}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <span className={`absolute text-xl font-bold ${colorClass}`}>
                {Math.round(percentage)}%
            </span>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ profile }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [medicineToEdit, setMedicineToEdit] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [sharedScheduleId, setSharedScheduleId] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window && window.aistudio?.notifications) {
      const permissionDismissed = localStorage.getItem('notificationPermissionDismissed');
      // Show banner if native notifications are supported but permission is default
      if (Notification.permission === 'default' && !permissionDismissed) {
          setShowNotificationBanner(true);
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' || permission === 'denied') {
              setShowNotificationBanner(false);
          }
      }
  };

  const handleDismissBanner = () => {
      localStorage.setItem('notificationPermissionDismissed', 'true');
      setShowNotificationBanner(false);
  };

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch all medicines (including stopped) to ensure history can be displayed correctly.
      const allMeds = await db.medicines.getByProfileId(profile.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const todaySchedules = await db.schedules.getByDateRange(profile.id, today.toISOString(), tomorrow.toISOString());
      
      setMedicines(allMeds);
      setSchedules(todaySchedules);
    } catch(e) {
        console.error("Failed to fetch dashboard data:", e);
    } finally {
        setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  const handleShareReminder = async (schedule: Schedule) => {
    const medicine = medicineMap.get(schedule.medicineId);
    if (!profile || !medicine) return;

    const displayName = schedule.medicineName || medicine.name;
    const displayDose = schedule.dose || medicine.dose;

    const time = new Date(schedule.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let text = `Reminder for ${profile.name}:\n`;
    text += `- Medicine: ${displayName}\n`;
    text += `- Dose: ${displayDose}\n`;
    text += `- Time: ${time}`;
    if (medicine.instructions) text += `\n- Instruction: ${medicine.instructions}`;
    if (medicine.customInstructions) text += `\n- Usage: ${medicine.customInstructions}`;

    const shareData = {
        title: `Medicine Reminder for ${profile.name}`,
        text,
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareData.text);
        }
        setSharedScheduleId(schedule.id);
    } catch (error) {
        console.error('Error sharing:', error);
    } finally {
        setTimeout(() => setSharedScheduleId(null), 2000);
    }
  };

  const handleOpenEditModal = async (medicineId: string) => {
    const medicine = await db.medicines.get(medicineId);
    if (medicine) {
        setMedicineToEdit(medicine);
    }
  };

  const handleCloseModal = () => {
      setIsAddModalOpen(false);
      setMedicineToEdit(null);
  };
  
  const handleUpdateSchedule = async (scheduleId: string, status: DoseStatus.TAKEN | DoseStatus.SKIPPED) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) {
      await db.schedules.update({
        ...schedule,
        status,
        actualTakenTime: status === DoseStatus.TAKEN ? new Date().toISOString() : null,
      });
      // After updating, cancel the corresponding native notification so it doesn't fire.
      await cancelNativeNotification(scheduleId);
      setSchedules(schedules.map(s => s.id === scheduleId ? {...s, status } : s));
    }
  };

  const sortedSchedules = useMemo(() => {
    const now = new Date();
    return schedules
        .map(s => {
            const isOverdue = new Date(s.scheduledTime) < now && s.status === DoseStatus.PENDING;
            return { ...s, status: isOverdue ? DoseStatus.OVERDUE : s.status };
        })
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  }, [schedules]);

  const adherence = useMemo(() => {
    const pastSchedules = schedules.filter(s => new Date(s.scheduledTime).getTime() < Date.now() && (s.status === DoseStatus.TAKEN || s.status === DoseStatus.SKIPPED || s.status === DoseStatus.OVERDUE));
    
    if (pastSchedules.length === 0) return 100;

    const takenCount = pastSchedules.filter(s => s.status === DoseStatus.TAKEN).length;
    
    return (takenCount / pastSchedules.length) * 100;
  }, [schedules]);
  
  const ScheduleItem: React.FC<{schedule: Schedule}> = ({ schedule }) => {
      const medicine = medicineMap.get(schedule.medicineId);
      
      // Fallback for older schedule data that doesn't have the new fields
      const displayName = schedule.medicineName || medicine?.name;
      const displayDose = schedule.dose || medicine?.dose;
      
      // Instructions are not snapshotted, so we still get them from the live medicine object
      const displayInstructions = medicine?.instructions || '';

      if (!displayName) return null; // Don't render if we can't determine a medicine name

      const time = new Date(schedule.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusInfo = {
          [DoseStatus.PENDING]: { text: 'Pending', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          [DoseStatus.TAKEN]: { text: 'Taken', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          [DoseStatus.SKIPPED]: { text: 'Skipped', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          [DoseStatus.OVERDUE]: { text: 'Overdue', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
      };
      
      const isShared = sharedScheduleId === schedule.id;

      return (
          <button onClick={() => handleOpenEditModal(schedule.medicineId)} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded-lg" disabled={medicine?.status === 'stopped'}>
            <div className={`p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between transition-all ${medicine?.status === 'stopped' ? 'opacity-60' : ''}`}>
                <div className="flex items-center">
                    <div className="mr-4">{statusInfo[schedule.status].icon}</div>
                    <div>
                      <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{displayName} <span className="text-gray-500 dark:text-gray-400 font-normal text-base">{displayDose}</span></p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{displayInstructions}</p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <p className="text-xl font-semibold mb-1">{time}</p>
                    {schedule.status === DoseStatus.PENDING || schedule.status === DoseStatus.OVERDUE ? (
                        <div className="flex space-x-2">
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateSchedule(schedule.id, DoseStatus.SKIPPED)}} className="px-3 py-1 rounded-md bg-yellow-400/20 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 text-xs font-semibold hover:bg-yellow-400/40">Skip</button>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateSchedule(schedule.id, DoseStatus.TAKEN)}} className="px-3 py-1 rounded-md bg-green-500/20 text-green-800 dark:bg-green-500/20 dark:text-green-300 text-xs font-semibold hover:bg-green-500/40">Take</button>
                        </div>
                    ) : (
                        <p className="text-sm font-semibold capitalize">{statusInfo[schedule.status].text}</p>
                    )}
                  </div>
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleShareReminder(schedule); }} 
                      className={`p-2 rounded-full transition-colors ${isShared ? 'text-green-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                      aria-label="Share reminder details"
                  >
                      {isShared ? 
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> :
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                      }
                  </button>
                </div>
            </div>
          </button>
      );
  };

  return (
    <div>
      {showNotificationBanner && (
        <div className="bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500 text-blue-700 dark:text-blue-300 p-4 mb-6 rounded-r-lg" role="alert">
            <div className="flex">
                <div className="py-1"><svg className="fill-current h-6 w-6 text-blue-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8v2h2v-2H9z"/></svg></div>
                <div>
                    <p className="font-bold">Get timely reminders</p>
                    <p className="text-sm">Enable notifications to make sure you never miss a dose.</p>
                    <div className="mt-2">
                        <button onClick={handleEnableNotifications} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm">Enable</button>
                        <button onClick={handleDismissBanner} className="text-blue-600 dark:text-blue-200 hover:underline ml-4 text-sm font-semibold">Dismiss</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">Hello, {profile.name.split(' ')[0]}</h1>
            <p className="text-gray-500 dark:text-gray-400">Here's your schedule for today.</p>
        </div>
        <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Adherence</p>
            <AdherenceRing percentage={adherence} />
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {loading ? <p>Loading schedule...</p> : sortedSchedules.length > 0 ? (
            sortedSchedules.map(s => <ScheduleItem key={s.id} schedule={s}/>)
        ) : (
            <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-200">All Done!</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">You have no more medications scheduled for today.</p>
            </div>
        )}
      </div>

      <button
        onClick={() => setIsAddModalOpen(true)}
        className="w-full py-3 px-4 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        <span>Add New Medicine</span>
      </button>

      {(isAddModalOpen || medicineToEdit) && (
        <MedicineFormModal
          profile={profile}
          existingMedicine={medicineToEdit}
          onClose={handleCloseModal}
          onSave={() => {
            handleCloseModal();
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;