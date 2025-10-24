-- FASE 1 - PARTE 1: Agregar valor 'gerencia' al enum
-- ====================================================
-- IMPORTANTE: Este valor debe estar committed antes de usarse en otras estructuras

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'gerencia';