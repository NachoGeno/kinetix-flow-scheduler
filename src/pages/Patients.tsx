import { useState } from 'react';
import { Search, Plus, Users, Phone, Mail, Calendar, CreditCard, Edit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedPatients } from '@/hooks/usePaginatedPatients';
import PatientForm from '@/components/patients/PatientForm';

interface Patient {
  id: string;
  profile_id: string;
  medical_record_number: string;
  blood_type: string;
  insurance_provider: string;
  insurance_number: string;
  profile: {
    first_name: string;
    last_name: string;
    dni: string;
    email: string;
    phone: string;
    date_of_birth: string;
    avatar_url: string;
  };
}

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  // Debounce search term to avoid excessive API calls - increased delay for better UX
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  const pageSize = 50;

  // Use paginated patients hook
  const { 
    data: patientsData, 
    isLoading,
    refetch: refetchPatients 
  } = usePaginatedPatients({
    searchTerm: debouncedSearchTerm,
    page: currentPage,
    limit: pageSize
  });

  const patients = patientsData?.patients || [];
  const totalPages = patientsData?.totalPages || 0;
  const totalCount = patientsData?.totalCount || 0;


  // Redirect if patient tries to access this page
  if (profile?.role === 'patient') {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold mb-4">Acceso no autorizado</h1>
        <p className="text-muted-foreground">No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Pacientes</h1>
        </div>
        <div className="text-center py-8">Cargando pacientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pacientes</h1>
          <p className="text-muted-foreground">
            {totalCount} pacientes encontrados
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Nuevo Paciente</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para crear un nuevo paciente en el sistema
            </DialogDescription>
            <PatientForm
              onSuccess={() => {
                setDialogOpen(false);
                refetchPatients();
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog para editar paciente */}
      <Dialog open={!!editingPatient} onOpenChange={(open) => !open && setEditingPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Editar Paciente</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para editar la información del paciente
          </DialogDescription>
          {editingPatient && (
            <PatientForm
              patient={editingPatient}
              isEditing={true}
              onSuccess={() => {
                setEditingPatient(null);
                refetchPatients();
              }}
              onCancel={() => setEditingPatient(null)}
            />
          )}
        </DialogContent>
        </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar pacientes por nombre, DNI, email o número de historia..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patients Grid */}
      <div className="grid gap-6">
        {patients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          patients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={patient.profile?.avatar_url} />
                    <AvatarFallback>
                      {patient.profile?.first_name?.[0]}{patient.profile?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {patient.profile?.first_name} {patient.profile?.last_name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Historia Clínica: {patient.medical_record_number || 'No asignado'}
                    </CardDescription>
                    {patient.blood_type && (
                      <Badge variant="outline" className="mt-2">
                        Tipo de sangre: {patient.blood_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patient.profile?.dni && (
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">DNI: {patient.profile.dni}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{patient.profile?.email}</span>
                  </div>
                  {patient.profile?.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{patient.profile.phone}</span>
                    </div>
                  )}
                  {patient.profile?.date_of_birth && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {(() => {
                          try {
                            return format(new Date(patient.profile.date_of_birth), 'PPP', { locale: es });
                          } catch {
                            return patient.profile.date_of_birth;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {patient.insurance_provider && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Obra Social:</span>
                      <span className="text-sm">{patient.insurance_provider}</span>
                    </div>
                  )}
                  {patient.insurance_number && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">N° Afiliado:</span>
                      <span className="text-sm">{patient.insurance_number}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingPatient(patient)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button size="sm">
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationPrevious 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
            />
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, currentPage - 2) + i;
              if (pageNumber > totalPages) return null;
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    onClick={() => setCurrentPage(pageNumber)}
                    isActive={currentPage === pageNumber}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationNext 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}