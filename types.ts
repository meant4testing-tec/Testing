export interface Profile {
  id: string;
  name: string;
  picture: string; // base64 encoded image
  dob: string; // ISO string date
  wakeTime: string; // HH:mm format
  sleepTime: string; // HH:mm format
}

export interface Medicine {
  id: string;
  profileId: string;
  name: string;
  dose: string;
  courseDays: number;
  instructions: Instruction;
  customInstructions?: string;
  frequencyType: FrequencyType;
  frequencyValue: number; // e.g., 3 for "3 times a day", 8 for "every 8 hours"
  frequencyFixedTimes?: string[]; // e.g., ["08:00", "14:30", "21:00"]
  prescriptionImage?: string; // base64 encoded image
  medicineImage?: string; // base64 encoded image
  startDate: string; // ISO string
  endDate?: string; // ISO string, marks when a medicine was stopped
  status: 'active' | 'stopped';
  doctorName?: string;
}

export interface Schedule {
  id: string;
  medicineId: string;
  profileId: string;
  scheduledTime: string; // ISO string
  status: DoseStatus;
  actualTakenTime: string | null; // ISO string
  profileName?: string;
  medicineName: string; // Was optional, now required for new schedules
  dose: string; // Added to snapshot dose
  notificationShown?: boolean; // Added to track if the background notification has been sent
}

export enum DoseStatus {
  PENDING = 'pending',
  TAKEN = 'taken',
  SKIPPED = 'skipped',
  OVERDUE = 'overdue',
}

export enum Instruction {
  BEFORE_FOOD = 'Before Food',
  AFTER_FOOD = 'After Food',
  BEFORE_SLEEP = 'Before Sleep',
  WITH_FOOD = 'With Food',
  EMPTY_STOMACH = 'Empty Stomach'
}

export enum FrequencyType {
  TIMES_A_DAY = 'Times a day',
  EVERY_X_HOURS = 'Every X hours',
  FIXED_TIMES = 'Fixed Times',
}

export enum View {
  DASHBOARD = 'dashboard',
  HISTORY = 'history',
  PROFILES = 'profiles',
}

// Fix: To resolve declaration errors and property access issues, the AIStudio interface
// is now defined within the `declare global` block. This ensures a single, globally-scoped
// definition for `window.aistudio` that is consistently applied across all files.
declare global {
  interface AIStudio {
    notifications?: {
      schedule: (options: {
        id: string;
        title: string;
        body: string;
        at: Date;
      }) => Promise<void>;
      cancel: (id: string) => Promise<void>;
    };
    share?: (options: {
      data: string; // base64 encoded data string (without the data: prefix)
      filename: string;
      mimeType: string;
    }) => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}