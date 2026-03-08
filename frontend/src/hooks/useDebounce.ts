'use client';

import { useState, useEffect } from 'react';

/**
 * Delays updating a value until after the specified delay has elapsed
 * since the last change. Useful for debouncing search input.
 * @param value - the raw value to debounce
 * @param delay - milliseconds to wait before updating (default 300ms)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
