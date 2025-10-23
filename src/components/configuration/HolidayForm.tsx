import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .nonempty('El nombre es obligatorio'),
  date: z.date({
    required_error: "La fecha es obligatoria",
  }),
  is_national: z.boolean().default(false),
  recurring: z.boolean().default(false),
});

interface HolidayFormProps {
  onSuccess: () => void;
  existingHoliday?: any;
}

export default function HolidayForm({ onSuccess, existingHoliday }: HolidayFormProps) {
  const { currentOrgId } = useOrganizationContext();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: existingHoliday?.name || '',
      date: existingHoliday?.date ? new Date(existingHoliday.date) : new Date(),
      is_national: existingHoliday?.is_national || false,
      recurring: existingHoliday?.recurring || false,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const holidayData = {
        organization_id: currentOrgId,
        name: values.name.trim(),
        date: format(values.date, 'yyyy-MM-dd'),
        is_national: values.is_national,
        recurring: values.recurring,
      };

      if (existingHoliday) {
        const { error } = await supabase
          .from('holidays')
          .update(holidayData)
          .eq('id', existingHoliday.id);
        
        if (error) throw error;
        toast({ title: "Feriado actualizado correctamente" });
      } else {
        const { error } = await supabase
          .from('holidays')
          .insert([holidayData]);
        
        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Error",
              description: "Ya existe un feriado en esta fecha",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }
        toast({ title: "Feriado creado correctamente" });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving holiday:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el feriado",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del feriado</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Día de la Independencia" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="is_national"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Feriado nacional
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="recurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Se repite cada año
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full">
          {existingHoliday ? 'Actualizar' : 'Crear'} Feriado
        </Button>
      </form>
    </Form>
  );
}
