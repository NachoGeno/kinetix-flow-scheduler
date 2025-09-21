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

// Debug flag for appointment validations (can be toggled for troubleshooting)
const DEBUG_APPOINTMENTS = true;

/**
 * Validates appointment date is within reasonable bounds
 * Allows past dates but with reasonable limits
 */
export function validateAppointmentDate(date: Date): { isValid: boolean; error?: string } {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  if (date < fiveYearsAgo) {
    return { isValid: false, error: 'La fecha no puede ser anterior a 5 años' };
  }
  
  if (date > oneYearFromNow) {
    return { isValid: false, error: 'La fecha no puede ser posterior a 1 año' };
  }

  return { isValid: true };
}

/**
 * Validates date integrity by comparing original vs formatted dates
 * Detects potential timezone or date parsing issues
 */
export function validateDateIntegrity(originalDate: Date, formattedDate: string): {
  isValid: boolean;
  warning?: string;
  originalFormatted: string;
} {
  const originalFormatted = formatDateToISO(originalDate);
  const today = formatDateToISO(new Date());
  
  const isValid = originalFormatted === formattedDate;
  let warning: string | undefined;

  // Check if formatted date unexpectedly became today
  if (!isValid && formattedDate === today && originalFormatted !== today) {
    warning = `POSIBLE BUG DETECTADO: Fecha seleccionada ${originalFormatted} se convirtió en hoy ${today}`;
  } else if (!isValid) {
    warning = `Discrepancia de fecha: seleccionada ${originalFormatted}, enviada ${formattedDate}`;
  }

  return {
    isValid,
    warning,
    originalFormatted
  };
}

/**
 * Logs appointment debugging information
 * Can be enabled/disabled with DEBUG_APPOINTMENTS flag
 */
export function logAppointmentDebug(context: string, data: {
  selectedDate?: Date;
  formattedDate?: string;
  appointmentTime?: string;
  patientId?: string;
  doctorId?: string;
  organizationId?: string;
  userAgent?: string;
  timezone?: string;
}) {
  if (!DEBUG_APPOINTMENTS) return;

  console.group(`🔍 [APPOINTMENT DEBUG] ${context}`);
  console.log('Timestamp:', new Date().toISOString());
  
  if (data.selectedDate) {
    console.log('📅 Fecha seleccionada:', data.selectedDate);
    console.log('📅 Fecha ISO original:', formatDateToISO(data.selectedDate));
  }
  
  if (data.formattedDate) {
    console.log('📅 Fecha formateada final:', data.formattedDate);
  }
  
  if (data.appointmentTime) {
    console.log('⏰ Hora:', data.appointmentTime);
  }
  
  if (data.patientId) {
    console.log('👤 Paciente ID:', data.patientId);
  }
  
  if (data.doctorId) {
    console.log('👨‍⚕️ Doctor ID:', data.doctorId);
  }
  
  if (data.organizationId) {
    console.log('🏥 Organización ID:', data.organizationId);
  }
  
  console.log('🌍 User Agent:', navigator.userAgent);
  console.log('🕐 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('🕐 Timezone offset:', new Date().getTimezoneOffset());
  
  console.groupEnd();
}

/**
 * Detects anomalous appointment patterns
 * Warns about potential issues with appointment creation
 */
export function detectAppointmentAnomalies(appointments: Array<{
  selectedDate: Date;
  finalDate: string;
  createdAt?: string;
  patientId?: string;
}>) {
  const anomalies: string[] = [];
  const today = formatDateToISO(new Date());

  appointments.forEach((apt, index) => {
    const selectedFormatted = formatDateToISO(apt.selectedDate);
    
    // Check if selected date became today unexpectedly
    if (selectedFormatted !== today && apt.finalDate === today) {
      anomalies.push(`Turno #${index + 1}: Fecha ${selectedFormatted} se convirtió inesperadamente en hoy (${today})`);
    }
    
    // Check for consecutive suspicious dates
    if (index > 0) {
      const prevApt = appointments[index - 1];
      const prevFormatted = formatDateToISO(prevApt.selectedDate);
      
      if (prevFormatted !== prevApt.finalDate && selectedFormatted !== apt.finalDate) {
        anomalies.push(`Turnos #${index} y #${index + 1}: Patrón sospechoso de fechas alteradas`);
      }
    }
  });

  if (anomalies.length > 0) {
    console.warn('⚠️ ANOMALÍAS DETECTADAS EN TURNOS:');
    anomalies.forEach(anomaly => console.warn(`  • ${anomaly}`));
  }

  return anomalies;
}
