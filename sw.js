const DB_NAME = 'MedicineReminderDB';
const DB_VERSION = 1;
const SCHEDULES_STORE = 'schedules';
const MEDICINES_STORE = 'medicines';

const DoseStatus = { PENDING: 'pending' };
let dbInstance = null;

const getDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    // No onupgradeneeded here, as the main app handles DB creation.
  });
};

let activeProfileId = null;
let notificationInterval = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_PROFILE') {
    activeProfileId = event.data.profileId;
    if (notificationInterval) clearInterval(notificationInterval);
    if (activeProfileId) {
      notificationInterval = setInterval(checkForNotifications, 60000);
      checkForNotifications(); // Check immediately on profile change
    }
  }
});

async function checkForNotifications() {
  if (!activeProfileId || !self.registration) return;

  try {
    const db = await getDB();
    const now = new Date();
    // Check for schedules in the last minute to avoid re-notifying if the interval runs slightly off.
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000); 

    const transaction = db.transaction([SCHEDULES_STORE, MEDICINES_STORE], 'readwrite');
    const schedulesStore = transaction.objectStore(SCHEDULES_STORE);
    const timeIndex = schedulesStore.index('scheduledTime');
    const range = IDBKeyRange.bound(oneMinuteAgo.toISOString(), now.toISOString());
    
    const schedulesRequest = timeIndex.getAll(range);

    schedulesRequest.onsuccess = () => {
      const potentialSchedules = schedulesRequest.result;
      const dueSchedules = potentialSchedules.filter(s =>
        s.profileId === activeProfileId &&
        s.status === DoseStatus.PENDING &&
        !s.notificationShown
      );

      if (dueSchedules.length > 0) {
        const dueSchedule = dueSchedules[0];
        const medicinesStore = transaction.objectStore(MEDICINES_STORE);
        const medicineRequest = medicinesStore.get(dueSchedule.medicineId);

        medicineRequest.onsuccess = () => {
          const medicine = medicineRequest.result;
          if (medicine) {
            const title = `Time for ${medicine.name}!`;
            const body = `It's time for your ${medicine.dose} of ${medicine.name}.`;
            
            self.registration.showNotification(title, { body, tag: dueSchedule.id, icon: '/vite.svg', renotify: true });

            dueSchedule.notificationShown = true;
            schedulesStore.put(dueSchedule);
          }
        };
      }
    };
     schedulesRequest.onerror = (event) => {
        console.error('SW: Error fetching schedules:', event.target.error);
    }
  } catch (error) {
    console.error('SW: Error checking notifications:', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Take control of the page as soon as the service worker activates.
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
