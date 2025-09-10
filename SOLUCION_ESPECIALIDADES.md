# SOLUCIÓN PARA CREAR PROFESIONALES - ESPECIALIDADES

## Problema
La creación de profesionales falla con el error:
```
null value in column "specialty_id" of relation "doctors" violates not-null constraint
```

## Solución Inmediata

**EJECUTA ESTE SQL EN SUPABASE DASHBOARD:**

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a **SQL Editor** 
3. Ejecuta este comando:

```sql
ALTER TABLE public.doctors ALTER COLUMN specialty_id DROP NOT NULL;
```

## ¿Por qué es necesario?

- La tabla `doctors` requiere un `specialty_id` válido que exista en la tabla `specialties`
- Las políticas RLS impiden leer/crear especialidades para organizaciones diferentes a Rehabilitare1
- Hacer `specialty_id` nullable permite crear profesionales sin depender de especialidades existentes
- La información de la especialidad se preserva en el campo `bio` del profesional

## Después de ejecutar el SQL

1. Recarga la página de profesionales
2. Intenta crear un nuevo profesional
3. Debería funcionar sin errores

## Código implementado

El código ya está preparado para:
- Intentar obtener especialidades existentes de la BD
- Usar UUIDs de fallback si no encuentra especialidades
- Crear profesionales con información completa
- Preservar la especialidad seleccionada en la biografía

## Estado actual
- ✅ Código modificado y listo
- ⏳ **PENDIENTE: Ejecutar SQL en Supabase Dashboard**
- ⏳ Probar creación de profesionales
