import { Medicine, Schedule } from '../types';
import { db } from './db';

/**
 * NOTE: All notification logic is now handled by the service worker registered in `index.html`
 * to ensure notifications are delivered even when the app is not active.
 * These functions are kept for compatibility with existing calls but are now no-ops.
 */

export const scheduleNativeNotificationsForMedicine = async (medicine: Medicine, schedules: Schedule[]): Promise<void> => {
  // Logic moved to service worker.
  return Promise.resolve();
};

export const cancelNativeNotification = async (scheduleId: string): Promise<void> => {
  // Logic is now implicit. The service worker checks the dose status.
  return Promise.resolve();
};

export const cancelAllNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  // Logic is now implicit. Schedules are deleted, so the SW won't find them.
  return Promise.resolve();
};

export const cancelFutureNotificationsForMedicine = async (medicineId: string): Promise<void> => {
  // Logic is now implicit. Schedules are deleted, so the SW won't find them.
  return Promise.resolve();
};
