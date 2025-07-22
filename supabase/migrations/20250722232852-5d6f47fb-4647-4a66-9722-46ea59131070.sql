-- ============================================
-- LIMPIEZA COMPLETA DE DATOS DE PRUEBA
-- Mantiene: estructura, relaciones, lógica, permisos, roles
-- Elimina: todos los datos de prueba
-- ============================================

-- 1. Eliminar archivos de storage (órdenes médicas y asistencias)
-- Nota: Los archivos en storage se eliminarán automáticamente cuando se eliminen las referencias

-- 2. Eliminar datos en orden correcto para respetar foreign keys

-- Eliminar progress_notes (notas de progreso)
DELETE FROM public.progress_notes;

-- Eliminar medical_history_entries (entradas de historia médica)
DELETE FROM public.medical_history_entries;

-- Eliminar unified_medical_histories (historias médicas unificadas)
DELETE FROM public.unified_medical_histories;

-- Eliminar medical_records (registros médicos)
DELETE FROM public.medical_records;

-- Eliminar appointments (turnos)
DELETE FROM public.appointments;

-- Eliminar medical_orders (órdenes médicas)
DELETE FROM public.medical_orders;

-- Eliminar patients (pacientes) - esto también eliminará sus profiles asociados si existen
DELETE FROM public.patients;

-- Eliminar doctors (profesionales) - esto también eliminará sus profiles asociados si existen
DELETE FROM public.doctors;

-- 3. Eliminar profiles que no sean de usuarios administradores
-- Primero identificamos cuáles son los perfiles de admin reales
-- Mantenemos solo los perfiles con role 'admin'
DELETE FROM public.profiles 
WHERE role != 'admin';

-- 4. Resetear secuencias y contadores si los hubiera
-- (En este caso usamos UUIDs, pero es buena práctica mencionarlo)

-- 5. Limpiar storage buckets (eliminar archivos huérfanos)
-- Esto se manejará automáticamente por las políticas de Supabase

-- ============================================
-- VERIFICACIÓN DE LIMPIEZA
-- ============================================

-- Mostrar conteo final de registros
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'LIMPIEZA COMPLETADA - Conteo final de registros:';
    
    FOR rec IN (
        SELECT 
            'patients' as table_name, COUNT(*) as count
        FROM patients
        UNION ALL
        SELECT 
            'doctors' as table_name, COUNT(*) as count
        FROM doctors
        UNION ALL
        SELECT 
            'appointments' as table_name, COUNT(*) as count
        FROM appointments
        UNION ALL
        SELECT 
            'medical_orders' as table_name, COUNT(*) as count
        FROM medical_orders
        UNION ALL
        SELECT 
            'medical_records' as table_name, COUNT(*) as count
        FROM medical_records
        UNION ALL
        SELECT 
            'progress_notes' as table_name, COUNT(*) as count
        FROM progress_notes
        UNION ALL
        SELECT 
            'unified_medical_histories' as table_name, COUNT(*) as count
        FROM unified_medical_histories
        UNION ALL
        SELECT 
            'medical_history_entries' as table_name, COUNT(*) as count
        FROM medical_history_entries
        UNION ALL
        SELECT 
            'profiles (total)' as table_name, COUNT(*) as count
        FROM profiles
        UNION ALL
        SELECT 
            'profiles (admin only)' as table_name, COUNT(*) as count
        FROM profiles WHERE role = 'admin'
    ) LOOP
        RAISE NOTICE '%: %', rec.table_name, rec.count;
    END LOOP;
    
    RAISE NOTICE 'SISTEMA LIMPIO - Solo quedan usuarios administradores y estructura intacta';
END $$;