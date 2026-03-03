

## Plan: Exportar Pacientes de Rehabilitare a Excel

### Datos confirmados
- **1,177 pacientes activos** en la organización Rehabilitare
- Campos disponibles: nombre, apellido, DNI, email, teléfono, obra social

### Implementación

**Modificar `src/pages/Patients.tsx`**:

1. Importar la librería `xlsx` (ya instalada)
2. Agregar botón "Exportar Excel" junto al botón de agregar paciente
3. Crear función `exportPatientsToExcel` que:
   - Consulte **todos** los pacientes de la organización (sin paginación, usando múltiples fetches si hay más de 1000 por el límite de Supabase)
   - Genere un archivo Excel con columnas: Apellido, Nombre, DNI, Email, Teléfono, Obra Social
   - Descargue el archivo como `Pacientes_[NombreOrg]_[fecha].xlsx`

### Query a ejecutar (client-side)
```sql
SELECT pr.first_name, pr.last_name, pr.dni, pr.email, pr.phone,
       osa.nombre as obra_social
FROM patients p
JOIN profiles pr ON p.profile_id = pr.id
LEFT JOIN obras_sociales_art osa ON p.obra_social_art_id = osa.id
WHERE p.is_active = true
ORDER BY pr.last_name, pr.first_name
```
(RLS filtra automáticamente por organización)

### Manejo del límite de 1000 filas
- Paginar las consultas en bloques de 1000 hasta obtener todos los registros
- Mostrar toast de progreso durante la exportación

### Archivo resultante
- Hoja: "Pacientes"
- Columnas con ancho auto-ajustado
- Nombre del archivo: `Pacientes_Rehabilitare_2026-03-03.xlsx`

