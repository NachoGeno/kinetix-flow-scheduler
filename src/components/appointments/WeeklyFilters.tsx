import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Doctor {
  id: string;
  profile?: {
    first_name: string;
    last_name: string;
  } | null;
  specialty?: {
    name: string;
  } | null;
}

interface ObraSocial {
  id: string;
  nombre: string;
}

interface WeeklyFiltersProps {
  doctors: Doctor[];
  obrasSociales: ObraSocial[];
  selectedDoctorId?: string;
  selectedObraSocialId?: string;
  selectedStatuses: string[];
  onDoctorChange: (doctorId?: string) => void;
  onObraSocialChange: (obraSocialId?: string) => void;
  onStatusesChange: (statuses: string[]) => void;
  onClearFilters: () => void;
}

const statusOptions = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'Asistido' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'no_show', label: 'Ausente' },
];

export default function WeeklyFilters({
  doctors,
  obrasSociales,
  selectedDoctorId,
  selectedObraSocialId,
  selectedStatuses,
  onDoctorChange,
  onObraSocialChange,
  onStatusesChange,
  onClearFilters
}: WeeklyFiltersProps) {
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [osOpen, setOsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
  const selectedOS = obrasSociales.find(os => os.id === selectedObraSocialId);

  const hasActiveFilters = selectedDoctorId || selectedObraSocialId || selectedStatuses.length > 0;

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros:</span>
      </div>

      {/* Filtro por Profesional */}
      <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="border-border">
            {selectedDoctor 
              ? `${selectedDoctor.profile?.first_name} ${selectedDoctor.profile?.last_name}`
              : 'Profesional'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0 border-border bg-popover">
          <Command>
            <CommandInput placeholder="Buscar profesional..." />
            <CommandList>
              <CommandEmpty>No se encontraron profesionales.</CommandEmpty>
              <CommandGroup>
                {doctors.map((doctor) => (
                  <CommandItem
                    key={doctor.id}
                    value={`${doctor.profile?.first_name} ${doctor.profile?.last_name}`}
                    onSelect={() => {
                      onDoctorChange(doctor.id === selectedDoctorId ? undefined : doctor.id);
                      setDoctorOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedDoctorId === doctor.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {doctor.profile?.first_name} {doctor.profile?.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {doctor.specialty?.name || 'Sin especialidad'}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Filtro por Obra Social */}
      <Popover open={osOpen} onOpenChange={setOsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="border-border">
            {selectedOS ? selectedOS.nombre : 'Obra Social'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0 border-border bg-popover">
          <Command>
            <CommandInput placeholder="Buscar obra social..." />
            <CommandList>
              <CommandEmpty>No se encontraron obras sociales.</CommandEmpty>
              <CommandGroup>
                {obrasSociales.map((os) => (
                  <CommandItem
                    key={os.id}
                    value={os.nombre}
                    onSelect={() => {
                      onObraSocialChange(os.id === selectedObraSocialId ? undefined : os.id);
                      setOsOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedObraSocialId === os.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-foreground">{os.nombre}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Filtro por Estado */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="border-border">
            Estado {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-3 border-border bg-popover">
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-accent/10 p-2 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(option.value)}
                  onChange={() => toggleStatus(option.value)}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">{option.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Botón limpiar filtros */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Limpiar filtros
        </Button>
      )}

      {/* Badges de filtros activos */}
      <div className="flex flex-wrap gap-2 ml-auto">
        {selectedDoctor && (
          <Badge variant="secondary" className="gap-1 bg-accent/10 text-foreground border-border">
            {selectedDoctor.profile?.first_name} {selectedDoctor.profile?.last_name}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={() => onDoctorChange(undefined)}
            />
          </Badge>
        )}
        {selectedOS && (
          <Badge variant="secondary" className="gap-1 bg-accent/10 text-foreground border-border">
            {selectedOS.nombre}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={() => onObraSocialChange(undefined)}
            />
          </Badge>
        )}
      </div>
    </div>
  );
}
