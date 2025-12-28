import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_PREFIX = "fiscal-year-selection-";

function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 7) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export function useFiscalYearSelection(accountId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${accountId}`;
  
  const [selectedFiscalYear, setSelectedFiscalYearState] = useState<string>(() => {
    if (typeof window === "undefined") return getCurrentFiscalYear();
    const stored = localStorage.getItem(storageKey);
    return stored || getCurrentFiscalYear();
  });

  useEffect(() => {
    if (typeof window !== "undefined" && selectedFiscalYear) {
      localStorage.setItem(storageKey, selectedFiscalYear);
    }
  }, [storageKey, selectedFiscalYear]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored !== selectedFiscalYear) {
        setSelectedFiscalYearState(stored);
      } else if (!stored) {
        setSelectedFiscalYearState(getCurrentFiscalYear());
      }
    }
  }, [storageKey]);

  const setSelectedFiscalYear = useCallback((year: string) => {
    setSelectedFiscalYearState(year);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, year);
    }
  }, [storageKey]);

  return {
    selectedFiscalYear,
    setSelectedFiscalYear,
    currentFiscalYear: getCurrentFiscalYear(),
  };
}
