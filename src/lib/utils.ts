import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date object to ISO date string (YYYY-MM-DD) without timezone conversion.
 * This prevents the timezone shift issue that can occur with date-fns format().
 * 
 * @param date - The Date object to format
 * @returns String in YYYY-MM-DD format
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a date-only string (YYYY-MM-DD) to a Date object in local timezone.
 * This prevents the timezone shift issue that occurs with new Date('YYYY-MM-DD').
 * 
 * @param dateString - The date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
