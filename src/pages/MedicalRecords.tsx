import { useState, useEffect } from 'react';
import { Search, User, Calendar, FileText, Plus, Edit, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MedicalHistorySection from '@/components/medical-records/MedicalHistorySection';

interface Patient {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
    dni: string | null;
    date_of_birth: string | null;
  };
  blood_type: string | null;
  allergies: string[] | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  doctor: {
    profile: {
      first_name: string;
      last_name: string;
    };
    specialty: {
      name: string;
    };
  };
}

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  physical_examination: string | null;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  follow_up_notes: string | null;
  vital_signs: any;
  appointment_id: string | null;
  created_by_profile: {
    first_name: string;
    last_name: string;
  };
}

export default function MedicalRecords() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingDiagnosis, setEditingDiagnosis] = useState('');
  const [editingTreatment, setEditingTreatment] = useState('');
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientAppointments();
      fetchPatientMedicalRecords();
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          blood_type,
          allergies,
          profile:profiles(first_name, last_name, dni, date_of_birth)
        `)
        .order('profile(first_name)', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    }
  };

  const fetchPatientAppointments = async () => {
    if (!selectedPatient) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          reason,
          diagnosis,
          treatment_plan,
          notes,
          doctor:doctors(
            profile:profiles(first_name, last_name),
            specialty:specialties(name)
          )
        `)
        .eq('patient_id', selectedPatient.id)
        .order('appointment_date', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientMedicalRecords = async () => {
    if (!selectedPatient) return;

    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select(`
          id,
          record_date,
          chief_complaint,
          physical_examination,
          diagnosis,
          treatment,
          prescription,
          follow_up_notes,
          vital_signs,
          appointment_id,
          created_by_profile:profiles!medical_records_created_by_fkey(first_name, last_name)
        `)
        .eq('patient_id', selectedPatient.id)
        .order('record_date', { ascending: false });

      if (error) throw error;
      setMedicalRecords(data || []);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros médicos",
        variant: "destructive",
      });
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment.id);
    setEditingNotes(appointment.notes || '');
    setEditingDiagnosis(appointment.diagnosis || '');
    setEditingTreatment(appointment.treatment_plan || '');
  };

  const handleSaveAppointment = async () => {
    if (!editingAppointment) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          notes: editingNotes,
          diagnosis: editingDiagnosis,
          treatment_plan: editingTreatment,
        })
        .eq('id', editingAppointment);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Información de la cita actualizada correctamente",
      });

      setEditingAppointment(null);
      fetchPatientAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la información de la cita",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setEditingNotes('');
    setEditingDiagnosis('');
    setEditingTreatment('');
  };

  const filteredPatients = patients.filter(patient =>
    patient.profile.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.profile.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.profile.dni && patient.profile.dni.includes(searchTerm))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completada';
      case 'confirmed': return 'Confirmada';
      case 'scheduled': return 'Programada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  if (!profile || (profile.role !== 'admin' && profile.role !== 'doctor')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Historia Clínica</h1>
      </div>

      {/* Patient Search and Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Paciente</CardTitle>
          <CardDescription>
            Busca y selecciona un paciente para ver su historia clínica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente por nombre o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {searchTerm && (
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-b-0 ${
                      selectedPatient?.id === patient.id ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearchTerm('');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {patient.profile.first_name} {patient.profile.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {patient.profile.dni && `DNI: ${patient.profile.dni}`}
                          {patient.profile.date_of_birth && ` • Nacimiento: ${format(new Date(patient.profile.date_of_birth), 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedPatient && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {selectedPatient.profile.first_name} {selectedPatient.profile.last_name}
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {selectedPatient.profile.dni && <p>DNI: {selectedPatient.profile.dni}</p>}
                        {selectedPatient.profile.date_of_birth && (
                          <p>Nacimiento: {format(new Date(selectedPatient.profile.date_of_birth), 'dd/MM/yyyy')}</p>
                        )}
                        {selectedPatient.blood_type && <p>Grupo sanguíneo: {selectedPatient.blood_type}</p>}
                        {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                          <p>Alergias: {selectedPatient.allergies.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Medical History */}
      {selectedPatient && (
        <div className="grid gap-6">
          {/* Appointments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Historial de Citas
              </CardTitle>
              <CardDescription>
                Todas las citas médicas del paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-4">Cargando citas...</p>
              ) : appointments.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No se encontraron citas para este paciente
                </p>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getStatusColor(appointment.status)} variant="secondary">
                              {getStatusLabel(appointment.status)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(appointment.appointment_date), 'PPP', { locale: es })} - {appointment.appointment_time}
                            </span>
                          </div>
                          <p className="font-medium">
                            Dr. {appointment.doctor.profile.first_name} {appointment.doctor.profile.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.doctor.specialty.name}
                          </p>
                          {appointment.reason && (
                            <p className="text-sm mt-1"><strong>Motivo:</strong> {appointment.reason}</p>
                          )}
                        </div>
                        
                        {profile.role === 'doctor' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAppointment(appointment)}
                            disabled={editingAppointment === appointment.id}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        )}
                      </div>

                      {editingAppointment === appointment.id ? (
                        <div className="space-y-4 border-t pt-4">
                          <div>
                            <label className="text-sm font-medium">Diagnóstico</label>
                            <Textarea
                              value={editingDiagnosis}
                              onChange={(e) => setEditingDiagnosis(e.target.value)}
                              placeholder="Diagnóstico del paciente..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Tratamiento</label>
                            <Textarea
                              value={editingTreatment}
                              onChange={(e) => setEditingTreatment(e.target.value)}
                              placeholder="Plan de tratamiento..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Notas de Progreso</label>
                            <Textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Notas sobre el progreso del paciente..."
                              className="mt-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveAppointment}>
                              <Save className="h-4 w-4 mr-2" />
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 border-t pt-4">
                          {appointment.diagnosis && (
                            <div>
                              <strong className="text-sm">Diagnóstico:</strong>
                              <p className="text-sm text-muted-foreground">{appointment.diagnosis}</p>
                            </div>
                          )}
                          {appointment.treatment_plan && (
                            <div>
                              <strong className="text-sm">Tratamiento:</strong>
                              <p className="text-sm text-muted-foreground">{appointment.treatment_plan}</p>
                            </div>
                          )}
                          {appointment.notes && (
                            <div>
                              <strong className="text-sm">Notas:</strong>
                              <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medical History Section with Progress Notes */}
          <MedicalHistorySection patientId={selectedPatient.id} />

          {/* Medical Records Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Registros Médicos Detallados
              </CardTitle>
              <CardDescription>
                Registros médicos completos del paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {medicalRecords.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No se encontraron registros médicos detallados para este paciente
                </p>
              ) : (
                <div className="space-y-4">
                  {medicalRecords.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">
                            {format(new Date(record.record_date), 'PPP', { locale: es })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Por: Dr. {record.created_by_profile.first_name} {record.created_by_profile.last_name}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {record.chief_complaint && (
                          <div>
                            <strong className="text-sm">Motivo de consulta:</strong>
                            <p className="text-sm text-muted-foreground">{record.chief_complaint}</p>
                          </div>
                        )}
                        {record.physical_examination && (
                          <div>
                            <strong className="text-sm">Examen físico:</strong>
                            <p className="text-sm text-muted-foreground">{record.physical_examination}</p>
                          </div>
                        )}
                        {record.diagnosis && (
                          <div>
                            <strong className="text-sm">Diagnóstico:</strong>
                            <p className="text-sm text-muted-foreground">{record.diagnosis}</p>
                          </div>
                        )}
                        {record.treatment && (
                          <div>
                            <strong className="text-sm">Tratamiento:</strong>
                            <p className="text-sm text-muted-foreground">{record.treatment}</p>
                          </div>
                        )}
                        {record.prescription && (
                          <div>
                            <strong className="text-sm">Prescripción:</strong>
                            <p className="text-sm text-muted-foreground">{record.prescription}</p>
                          </div>
                        )}
                        {record.follow_up_notes && (
                          <div>
                            <strong className="text-sm">Notas de seguimiento:</strong>
                            <p className="text-sm text-muted-foreground">{record.follow_up_notes}</p>
                          </div>
                        )}
                        {record.vital_signs && (
                          <div>
                            <strong className="text-sm">Signos vitales:</strong>
                            <p className="text-sm text-muted-foreground">
                              {JSON.stringify(record.vital_signs)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}