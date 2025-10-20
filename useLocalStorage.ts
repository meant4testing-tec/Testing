import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getStorageValue<T,>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
          return JSON.parse(saved);
      } catch(e) {
          console.warn(`Failed to parse localStorage value for key "${key}", using default.`);
          return defaultValue;
      }
    }
  } catch (e) {
    console.warn(`Could not read from localStorage for key "${key}". This can happen in private browsing or if storage is disabled.`, e);
    return defaultValue;
  }
  return defaultValue;
}

export const useLocalStorage = <T,>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch(e) {
      console.error(`Could not write to localStorage for key "${key}".`, e);
    }
  }, [key, value]);

  return [value, setValue];
};
