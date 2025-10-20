import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import { generatePDFReport } from '../services/pdfGenerator';
import { Profile, Schedule, Medicine, DoseStatus } from '../types';

interface HistoryViewProps {
  profile: Profile;
}

const HistoryView: React.FC<HistoryViewProps> = ({ profile }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const [startDate, setStartDate] = useState(oneMonthAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      
      const [schedulesData, medicinesData] = await Promise.all([
        db.schedules.getByDateRange(profile.id, start.toISOString(), end.toISOString()),
        db.medicines.getByProfileId(profile.id)
      ]);
      setSchedules(schedulesData);
      setMedicines(medicinesData);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  }, [profile.id, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  const handleGenerateReport = async () => {
      const relevantMedicines = medicines.filter(med => schedules.some(s => s.medicineId === med.id));
      await generatePDFReport({
          profile,
          medicines: relevantMedicines,
          schedules,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
      });
  };
  
  const statusBadge = (status: DoseStatus) => {
    const styles: { [key in DoseStatus]: string } = {
        [DoseStatus.TAKEN]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        [DoseStatus.SKIPPED]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        [DoseStatus.PENDING]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        [DoseStatus.OVERDUE]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status]}`}>{status.toUpperCase()}</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Medication History</h1>
          <p className="text-gray-500 dark:text-gray-400">Review past schedules for {profile.name}.</p>
        </div>
        <button onClick={handleGenerateReport} className="px-4 py-2 bg-secondary-500 text-white font-bold rounded-lg hover:bg-secondary-600 transition-colors flex items-center space-x-2">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>Download PDF</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
            <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
        </div>
        <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
            <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
        </div>
      </div>
      
       <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date & Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Medicine</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dose</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
                <tr><td colSpan={4} className="text-center p-8 text-gray-500">Loading history...</td></tr>
            ) : schedules.length > 0 ? (
              schedules
                .sort((a,b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
                .map(schedule => {
                  const medicine = medicineMap.get(schedule.medicineId);
                  const displayName = schedule.medicineName || medicine?.name || 'N/A';
                  const displayDose = schedule.dose || medicine?.dose || 'N/A';
                  return (
                    <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{new Date(schedule.scheduledTime).toLocaleDateString()}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(schedule.scheduledTime).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{displayName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{displayDose}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{statusBadge(schedule.status)}</td>
                    </tr>
                  )
                })
            ) : (
                <tr><td colSpan={4} className="text-center p-12 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    <p className="mt-2">No history found for this period.</p>
                </td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default HistoryView;