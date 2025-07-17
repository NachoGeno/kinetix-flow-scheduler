import { useState, useEffect } from 'react';
import { Search, Plus, Users, Phone, Mail, Award, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Doctor {
  id: string;
  license_number: string;
  years_experience: number;
  consultation_fee: number;
  bio: string;
  is_active: boolean;
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    avatar_url: string;
  };
  specialty: {
    name: string;
    color: string;
  };
}

interface Specialty {
  id: string;
  name: string;
  color: string;
}

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchDoctors();
    fetchSpecialties();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          *,
          profile:profiles(
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          ),
          specialty:specialties(
            name,
            color
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los profesionales",
          variant: "destructive",
        });
        return;
      }

      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los profesionales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching specialties:', error);
        return;
      }

      setSpecialties(data || []);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const filteredDoctors = doctors.filter(doctor => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      doctor.profile?.first_name?.toLowerCase().includes(searchLower) ||
      doctor.profile?.last_name?.toLowerCase().includes(searchLower) ||
      doctor.specialty?.name?.toLowerCase().includes(searchLower) ||
      doctor.license_number?.toLowerCase().includes(searchLower)
    );

    const matchesSpecialty = specialtyFilter === 'all' || 
      doctor.specialty?.name === specialties.find(s => s.id === specialtyFilter)?.name;

    return matchesSearch && matchesSpecialty;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Profesionales</h1>
        </div>
        <div className="text-center py-8">Cargando profesionales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Profesionales</h1>
          <p className="text-muted-foreground">
            Total: {filteredDoctors.length} profesionales activos
          </p>
        </div>
        {profile?.role === 'admin' && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Profesional
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar profesionales por nombre, especialidad o licencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las especialidades</SelectItem>
            {specialties.map((specialty) => (
              <SelectItem key={specialty.id} value={specialty.id}>
                {specialty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Doctors Grid */}
      <div className="grid gap-6">
        {filteredDoctors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || specialtyFilter !== 'all' 
                  ? 'No se encontraron profesionales' 
                  : 'No hay profesionales registrados'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDoctors.map((doctor) => (
            <Card key={doctor.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={doctor.profile?.avatar_url} />
                    <AvatarFallback>
                      Dr. {doctor.profile?.first_name?.[0]}{doctor.profile?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      Dr. {doctor.profile?.first_name} {doctor.profile?.last_name}
                    </CardTitle>
                    <CardDescription>
                      {doctor.specialty?.name}
                    </CardDescription>
                    <div className="flex items-center space-x-4 mt-2">
                      <Badge 
                        variant="secondary"
                        style={{ backgroundColor: `${doctor.specialty?.color}20`, color: doctor.specialty?.color }}
                      >
                        {doctor.specialty?.name}
                      </Badge>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Award className="h-4 w-4" />
                        <span>{doctor.years_experience} años de experiencia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{doctor.profile?.email}</span>
                  </div>
                  {doctor.profile?.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doctor.profile.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Licencia:</span>
                    <span className="text-sm">{doctor.license_number}</span>
                  </div>
                  {doctor.consultation_fee && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Tarifa:</span>
                      <span className="text-sm">${doctor.consultation_fee}</span>
                    </div>
                  )}
                </div>
                
                {doctor.bio && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {doctor.bio}
                  </p>
                )}

                <div className="flex justify-end space-x-2">
                  {profile?.role === 'patient' && (
                    <Button size="sm">
                      <Clock className="h-4 w-4 mr-2" />
                      Agendar Cita
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    Ver Perfil
                  </Button>
                  {profile?.role === 'admin' && (
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}