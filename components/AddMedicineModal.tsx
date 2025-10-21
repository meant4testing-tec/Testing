import React, { useState, useRef, ChangeEvent, memo, useEffect } from 'react';
import { db } from '../services/db';
import { compressImage } from '../services/imageCompressor';
import { scheduleNativeNotificationsForMedicine, cancelFutureNotificationsForMedicine } from '../services/notificationManager';
import { Profile, Medicine, Schedule, DoseStatus, Instruction, FrequencyType } from '../types';

interface MedicineFormModalProps {
  profile: Profile;
  onClose: () => void;
  onSave: () => void;
  existingMedicine?: Medicine | null;
}

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & {label: string}> = memo(({label, ...props}) => (
  <div>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input {...props} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700" />
  </div>
));

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & {label: string, children: React.ReactNode}> = memo(({label, children, ...props}) => (
  <div>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <select {...props} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
          {children}
      </select>
  </div>
));

const MedicineFormModal: React.FC<MedicineFormModalProps> = ({ profile, onClose, onSave, existingMedicine }) => {
  const isEditMode = !!existingMedicine;
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [courseDays, setCourseDays] = useState(7);
  const [instructions, setInstructions] = useState<Instruction>(Instruction.AFTER_FOOD);
  const [customInstructions, setCustomInstructions] = useState('');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(FrequencyType.TIMES_A_DAY);
  const [frequencyValue, setFrequencyValue] = useState(3);
  const [fixedTimes, setFixedTimes] = useState<string[]>(['08:00', '14:00', '20:00']);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [medicineImage, setMedicineImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState(false);
  const prescriptionFileInputRef = useRef<HTMLInputElement>(null);
  const medicineFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingMedicine) {
      setName(existingMedicine.name);
      setDose(existingMedicine.dose);
      setDoctorName(existingMedicine.doctorName || '');
      setCourseDays(existingMedicine.courseDays);
      setInstructions(existingMedicine.instructions);
      setCustomInstructions(existingMedicine.customInstructions || '');
      setFrequencyType(existingMedicine.frequencyType);
      setFrequencyValue(existingMedicine.frequencyValue);
      setFixedTimes(existingMedicine.frequencyFixedTimes || ['08:00', '14:00', '20:00']);
      setPrescriptionImage(existingMedicine.prescriptionImage || null);
      setMedicineImage(existingMedicine.medicineImage || null);
    }
  }, [existingMedicine]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, type: 'prescription' | 'medicine') => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressedImage = await compressImage(e.target.files[0], 0.8, 1024);
        if (type === 'prescription') setPrescriptionImage(compressedImage);
        else setMedicineImage(compressedImage);
      } catch (error) {
        console.error("Error compressing image:", error);
        alert("Failed to process image.");
      }
    }
  };

  const handleFixedTimesCountChange = (count: number) => {
    const newCount = Math.max(1, count);
    setFrequencyValue(newCount);
    const currentTimes = [...fixedTimes];
    if (newCount > currentTimes.length) {
      for (let i = currentTimes.length; i < newCount; i++) {
        currentTimes.push('12:00'); // Default new time
      }
    }
    setFixedTimes(currentTimes.slice(0, newCount));
  };

  const handleFixedTimeChange = (index: number, time: string) => {
    const newTimes = [...fixedTimes];
    newTimes[index] = time;
    setFixedTimes(newTimes);
  };
  
  const generateSchedules = (medicine: Medicine, fromNowOnly: boolean): Schedule[] => {
    const schedules: Schedule[] = [];
    
    const [wakeHour] = profile.wakeTime.split(':').map(Number);
    const [sleepHour, sleepMinute] = profile.sleepTime.split(':').map(Number);

    const courseEndDate = new Date(medicine.startDate);
    courseEndDate.setDate(courseEndDate.getDate() + medicine.courseDays);

    let allDoseTimes: Date[] = [];
    
    // Determine if the 1-hour buffer should be applied, with exceptions
    const applyBuffer = medicine.instructions !== Instruction.EMPTY_STOMACH && 
                        medicine.instructions !== Instruction.BEFORE_SLEEP &&
                        medicine.frequencyType !== FrequencyType.FIXED_TIMES;

    if (medicine.instructions === Instruction.BEFORE_SLEEP) {
        for (let day = 0; day < medicine.courseDays; day++) {
            const currentDay = new Date(medicine.startDate);
            currentDay.setDate(currentDay.getDate() + day);
            currentDay.setHours(sleepHour, sleepMinute, 0, 0);
            allDoseTimes.push(currentDay);
        }
    } else if (medicine.frequencyType === FrequencyType.FIXED_TIMES) {
        for (let day = 0; day < medicine.courseDays; day++) {
            const currentDay = new Date(medicine.startDate);
            currentDay.setDate(currentDay.getDate() + day);
            medicine.frequencyFixedTimes?.forEach(time => {
                const [hour, minute] = time.split(':').map(Number);
                const scheduleTime = new Date(currentDay);
                scheduleTime.setHours(hour, minute, 0, 0);
                allDoseTimes.push(scheduleTime);
            });
        }
    } else { // Handles TIMES_A_DAY and EVERY_X_HOURS with buffer logic
        const startHour = applyBuffer ? wakeHour + 1 : wakeHour;
        const endHour = applyBuffer ? sleepHour - 1 : sleepHour;
        
        if (medicine.frequencyType === FrequencyType.EVERY_X_HOURS) {
            for (let day = 0; day < medicine.courseDays; day++) {
                const currentDay = new Date(medicine.startDate);
                currentDay.setDate(currentDay.getDate() + day);
    
                let nextDoseTime = new Date(currentDay);
                nextDoseTime.setHours(startHour, 0, 0, 0);
    
                const dayEndTime = new Date(currentDay);
                if (endHour < startHour) { // Handle overnight
                    dayEndTime.setDate(dayEndTime.getDate() + 1);
                }
                dayEndTime.setHours(endHour, 0, 0, 0);
    
                while(nextDoseTime <= dayEndTime && nextDoseTime < courseEndDate) {
                    allDoseTimes.push(new Date(nextDoseTime));
                    nextDoseTime.setHours(nextDoseTime.getHours() + medicine.frequencyValue);
                }
            }
        } else if (medicine.frequencyType === FrequencyType.TIMES_A_DAY) {
            for (let day = 0; day < medicine.courseDays; day++) {
                const currentDay = new Date(medicine.startDate);
                currentDay.setDate(currentDay.getDate() + day);
                
                const effectiveEndHour = endHour < startHour ? endHour + 24 : endHour;
                const durationHours = effectiveEndHour - startHour;
                
                if (medicine.frequencyValue > 0 && durationHours > 0) {
                    const intervalHours = durationHours / medicine.frequencyValue;
                    for (let i = 0; i < medicine.frequencyValue; i++) {
                         const scheduleTime = new Date(currentDay);
                         // Place the dose in the middle of its time interval for more even spacing
                         const hourOffset = (i * intervalHours) + (intervalHours / 2);
                         const totalMinutes = (startHour * 60) + (hourOffset * 60);
                         scheduleTime.setHours(Math.floor(totalMinutes / 60) % 24, Math.round(totalMinutes % 60), 0, 0);
                         allDoseTimes.push(scheduleTime);
                    }
                }
            }
        }
    }
    
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // If adding a new medicine, we include all of today's doses (from start of day).
    // If editing, we only include doses from this moment forward.
    const filterTime = fromNowOnly ? now.getTime() : startOfToday.getTime();

    allDoseTimes.forEach(scheduleTime => {
        if (scheduleTime.getTime() >= filterTime && scheduleTime < courseEndDate) {
             schedules.push({
                id: crypto.randomUUID(),
                medicineId: medicine.id,
                profileId: medicine.profileId,
                scheduledTime: scheduleTime.toISOString(),
                status: DoseStatus.PENDING,
                actualTakenTime: null,
                medicineName: medicine.name,
                dose: medicine.dose,
                notificationShown: false,
            });
        }
    });
    
    return schedules;
  };


  const handleSubmit = async () => {
    if (!name || !dose || courseDays <= 0 || frequencyValue <= 0) {
      alert('Please fill all required fields correctly.');
      return;
    }

    setIsProcessing(true);

    try {
        if (isEditMode && existingMedicine) {
            const hasMajorChange = existingMedicine.name !== name ||
                                   existingMedicine.dose !== dose ||
                                   existingMedicine.courseDays !== courseDays ||
                                   existingMedicine.instructions !== instructions ||
                                   existingMedicine.frequencyType !== frequencyType ||
                                   existingMedicine.frequencyValue !== frequencyValue ||
                                   (frequencyType === FrequencyType.FIXED_TIMES && JSON.stringify(existingMedicine.frequencyFixedTimes || []) !== JSON.stringify(fixedTimes));

            const updatedMedicine: Medicine = {
                ...existingMedicine,
                name, dose, courseDays, instructions,
                customInstructions: customInstructions.trim() ? customInstructions.trim() : undefined,
                frequencyType, frequencyValue,
                frequencyFixedTimes: frequencyType === FrequencyType.FIXED_TIMES ? fixedTimes : undefined,
                prescriptionImage: prescriptionImage || undefined,
                medicineImage: medicineImage || undefined,
                doctorName: doctorName.trim() ? doctorName.trim() : undefined,
            };

            await db.medicines.update(updatedMedicine);

            if (hasMajorChange) {
                await db.schedules.deleteFutureSchedulesForMedicine(existingMedicine.id);
                const newSchedules = generateSchedules(updatedMedicine, true); // true for 'fromNowOnly'
                for (const schedule of newSchedules) {
                    await db.schedules.add(schedule);
                }
            }
        } else {
            // Adding a new medicine
            const newMedicine: Medicine = {
                id: crypto.randomUUID(),
                profileId: profile.id,
                name, dose, courseDays, instructions,
                customInstructions: customInstructions.trim() ? customInstructions.trim() : undefined,
                frequencyType, frequencyValue,
                frequencyFixedTimes: frequencyType === FrequencyType.FIXED_TIMES ? fixedTimes : undefined,
                prescriptionImage: prescriptionImage || undefined,
                medicineImage: medicineImage || undefined,
                startDate: new Date().toISOString(),
                status: 'active',
                doctorName: doctorName.trim() ? doctorName.trim() : undefined,
            };
            await db.medicines.add(newMedicine);
            const newSchedules = generateSchedules(newMedicine, false); // Generate for all of today for new meds
            for (const schedule of newSchedules) {
                await db.schedules.add(schedule);
            }
        }

        onSave();
        onClose();

    } catch (error) {
        console.error("Failed to save medicine:", error);
        alert("An error occurred while saving. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleStopMedicine = () => {
    if (!existingMedicine || isBusy) return;
    setShowStopConfirmModal(true);
  };

  const confirmStopMedicine = async () => {
    if (!existingMedicine) return;

    setShowStopConfirmModal(false);
    setIsStopping(true);
    try {
        const stoppedMedicine: Medicine = {
            ...existingMedicine,
            status: 'stopped',
            endDate: new Date().toISOString(),
        };
        await db.medicines.update(stoppedMedicine);
        await db.schedules.deleteFutureSchedulesForMedicine(existingMedicine.id);
        
        onSave();
        onClose();
    } catch(error) {
        console.error("Failed to stop medicine:", error);
        alert("An error occurred while stopping the medicine. Please try again.");
    } finally {
        setIsStopping(false);
    }
  };

  const isBusy = isProcessing || isStopping;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
          <h2 className="text-2xl font-bold p-6 border-b border-gray-200 dark:border-gray-700">{isEditMode ? 'Edit Medicine' : `Add Medicine for ${profile.name}`}</h2>
          <div className="p-6 space-y-6 overflow-y-auto">
            
            <fieldset className="space-y-4">
              <legend className="text-lg font-semibold text-primary-600 dark:text-primary-400">Medicine Details</legend>
              <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><FormInput label="Medicine Name *" type="text" placeholder="e.g., Ibuprofen" value={name} onChange={e => setName(e.target.value)} disabled={isBusy} /></div>
                  <div><FormInput label="Dose *" type="text" placeholder="e.g., 200mg" value={dose} onChange={e => setDose(e.target.value)} disabled={isBusy} /></div>
              </div>
              <FormInput label="Doctor's Name (Optional)" type="text" placeholder="e.g., Dr. Smith" value={doctorName} onChange={e => setDoctorName(e.target.value)} disabled={isBusy}/>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-lg font-semibold text-primary-600 dark:text-primary-400">Schedule & Instructions</legend>
              <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Course Duration (days) *" type="number" placeholder="e.g., 7" value={courseDays} onChange={e => setCourseDays(parseInt(e.target.value) || 0)} disabled={isBusy}/>
                  <FormSelect label="Instructions *" value={instructions} onChange={e => setInstructions(e.target.value as Instruction)} disabled={isBusy}>
                      {Object.values(Instruction).map(val => <option key={val} value={val}>{val}</option>)}
                  </FormSelect>
              </div>
               <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Instructions (if any)</label>
                  <textarea placeholder="e.g., Dissolve in a glass of warm water." value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} rows={2} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700" disabled={isBusy} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Frequency *</label>
                <div className="flex space-x-2 mt-1">
                    <select value={frequencyType} onChange={e => setFrequencyType(e.target.value as FrequencyType)} className="w-1/2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700" disabled={isBusy}>
                         {Object.values(FrequencyType).map(val => <option key={val} value={val}>{val}</option>)}
                    </select>
                    {frequencyType !== FrequencyType.FIXED_TIMES && <input type="number" placeholder={frequencyType === FrequencyType.TIMES_A_DAY ? "e.g., 3" : "e.g., 8"} value={frequencyValue} onChange={e => setFrequencyValue(parseInt(e.target.value) || 0)} className="w-1/2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700" disabled={isBusy} />}
                    {frequencyType === FrequencyType.FIXED_TIMES && <input type="number" placeholder="No. of Doses" value={frequencyValue} onChange={e => handleFixedTimesCountChange(parseInt(e.target.value) || 0)} className="w-1/2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700" disabled={isBusy} />}
                </div>
                { instructions === Instruction.BEFORE_SLEEP && frequencyType !== FrequencyType.FIXED_TIMES && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Frequency is ignored for 'Before Sleep' instructions.</p>}
              </div>
               {frequencyType === FrequencyType.FIXED_TIMES && (
                  <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Set Fixed Dose Times</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {fixedTimes.map((time, index) => (
                              <input key={index} type="time" value={time} onChange={e => handleFixedTimeChange(index, e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" disabled={isBusy}/>
                          ))}
                      </div>
                  </div>
              )}
            </fieldset>
           
            <fieldset>
               <legend className="text-lg font-semibold text-primary-600 dark:text-primary-400 mb-2">Attachments</legend>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { type: 'medicine', title: 'Medicine Image', file: medicineImage, ref: medicineFileInputRef, handler: (e: ChangeEvent<HTMLInputElement>) => handleFileChange(e, 'medicine') },
                  { type: 'prescription', title: 'Prescription Image', file: prescriptionImage, ref: prescriptionFileInputRef, handler: (e: ChangeEvent<HTMLInputElement>) => handleFileChange(e, 'prescription') }
                ].map(item => (
                  <div key={item.type}>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.title}</label>
                    <div className="mt-1 p-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md flex flex-col items-center justify-center h-32 bg-gray-50 dark:bg-gray-700/50">
                      {item.file ? <img src={item.file} alt={item.title} className="max-h-20 rounded-md object-contain" /> : <p className="text-gray-500 text-xs text-center">No image uploaded</p>}
                      <button onClick={() => item.ref.current?.click()} className="mt-2 text-sm text-primary-600 hover:underline" disabled={isBusy}>Upload Image</button>
                      <input type="file" ref={item.ref} onChange={item.handler} accept="image/*" className="hidden" />
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

          </div>
          <div className="p-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700">
             <div>
               {isEditMode && <button onClick={handleStopMedicine} disabled={isBusy} className="px-4 py-2 text-sm font-semibold text-red-600 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed">{isStopping ? 'Stopping...' : 'Stop Medicine'}</button>}
             </div>
             <div className="flex space-x-2">
                <button onClick={onClose} className="px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" disabled={isBusy}>Cancel</button>
                <button onClick={handleSubmit} className="px-6 py-2 bg-primary-600 text-white font-bold rounded-md hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed" disabled={isBusy}>{isProcessing ? 'Saving...' : 'Save Medicine'}</button>
             </div>
          </div>
        </div>
      </div>

      {showStopConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full">
                <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Action</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Do you want to stop all future doses of this medicine?
                    </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 flex flex-row-reverse rounded-b-lg">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={confirmStopMedicine}
                    >
                        Yes, Stop
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={() => setShowStopConfirmModal(false)}
                        disabled={isStopping}
                    >
                        No, Cancel
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default MedicineFormModal;
