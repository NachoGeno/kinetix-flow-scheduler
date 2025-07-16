-- Crear enum para roles de usuarios
CREATE TYPE public.user_role AS ENUM ('admin', 'doctor', 'patient');

-- Crear enum para estados de citas
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- Crear enum para tipos de órdenes médicas
CREATE TYPE public.order_type AS ENUM ('laboratory', 'imaging', 'prescription', 'referral');

-- Crear tabla de especialidades médicas
CREATE TABLE public.specialties (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de perfiles de usuario
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'patient',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de doctores
CREATE TABLE public.doctors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES public.specialties(id),
    license_number TEXT NOT NULL UNIQUE,
    years_experience INTEGER DEFAULT 0,
    consultation_fee DECIMAL(10,2),
    bio TEXT,
    schedule_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de pacientes
CREATE TABLE public.patients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medical_record_number TEXT UNIQUE,
    blood_type TEXT,
    allergies TEXT[],
    current_medications TEXT[],
    insurance_provider TEXT,
    insurance_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de citas médicas
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status appointment_status DEFAULT 'scheduled',
    reason TEXT,
    notes TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT appointment_datetime_unique UNIQUE (doctor_id, appointment_date, appointment_time)
);

-- Crear tabla de historiales clínicos
CREATE TABLE public.medical_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id),
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    chief_complaint TEXT,
    vital_signs JSONB,
    physical_examination TEXT,
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    follow_up_notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de órdenes médicas
CREATE TABLE public.medical_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id),
    order_type order_type NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT,
    urgent BOOLEAN DEFAULT false,
    completed BOOLEAN DEFAULT false,
    results TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient_date ON public.appointments(patient_id, appointment_date);
CREATE INDEX idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX idx_medical_orders_patient ON public.medical_orders(patient_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_orders ENABLE ROW LEVEL SECURITY;

-- Crear función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = $1;
$$;

-- Crear función para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = $1 AND role = 'admin'
  );
$$;

-- Políticas RLS para specialties (públicas para lectura, solo admin para escritura)
CREATE POLICY "Anyone can view specialties" ON public.specialties
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage specialties" ON public.specialties
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para doctors
CREATE POLICY "Anyone can view active doctors" ON public.doctors
    FOR SELECT USING (is_active = true);

CREATE POLICY "Doctors can view their own data" ON public.doctors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = doctors.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can update their own data" ON public.doctors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = doctors.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all doctors" ON public.doctors
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para patients
CREATE POLICY "Patients can view their own data" ON public.patients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = patients.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can update their own data" ON public.patients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = patients.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can view their patients" ON public.patients
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'doctor'
    );

CREATE POLICY "Admins can manage all patients" ON public.patients
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para appointments
CREATE POLICY "Patients can view their own appointments" ON public.appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            JOIN public.profiles pr ON p.profile_id = pr.id
            WHERE p.id = appointments.patient_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can view their appointments" ON public.appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.doctors d
            JOIN public.profiles pr ON d.profile_id = pr.id
            WHERE d.id = appointments.doctor_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can create appointments" ON public.appointments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patients p
            JOIN public.profiles pr ON p.profile_id = pr.id
            WHERE p.id = appointments.patient_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can manage their appointments" ON public.appointments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.doctors d
            JOIN public.profiles pr ON d.profile_id = pr.id
            WHERE d.id = appointments.doctor_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all appointments" ON public.appointments
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para medical_records
CREATE POLICY "Patients can view their own medical records" ON public.medical_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            JOIN public.profiles pr ON p.profile_id = pr.id
            WHERE p.id = medical_records.patient_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can view and manage medical records" ON public.medical_records
    FOR ALL USING (
        public.get_user_role(auth.uid()) = 'doctor'
    );

CREATE POLICY "Admins can manage all medical records" ON public.medical_records
    FOR ALL USING (public.is_admin(auth.uid()));

-- Políticas RLS para medical_orders
CREATE POLICY "Patients can view their own medical orders" ON public.medical_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            JOIN public.profiles pr ON p.profile_id = pr.id
            WHERE p.id = medical_orders.patient_id 
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can manage medical orders" ON public.medical_orders
    FOR ALL USING (
        public.get_user_role(auth.uid()) = 'doctor'
    );

CREATE POLICY "Admins can manage all medical orders" ON public.medical_orders
    FOR ALL USING (public.is_admin(auth.uid()));

-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo'),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient')
    );
    RETURN NEW;
END;
$$;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar timestamps automáticamente
CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medical_orders_updated_at BEFORE UPDATE ON public.medical_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar especialidades médicas iniciales
INSERT INTO public.specialties (name, description, color) VALUES
    ('Medicina General', 'Atención médica integral y preventiva', '#3B82F6'),
    ('Cardiología', 'Especialista en enfermedades del corazón', '#EF4444'),
    ('Dermatología', 'Especialista en enfermedades de la piel', '#F59E0B'),
    ('Pediatría', 'Atención médica para niños y adolescentes', '#10B981'),
    ('Ginecología', 'Salud reproductiva femenina', '#EC4899'),
    ('Traumatología', 'Lesiones del sistema musculoesquelético', '#8B5CF6'),
    ('Neurología', 'Enfermedades del sistema nervioso', '#6366F1'),
    ('Psiquiatría', 'Salud mental y trastornos psiquiátricos', '#14B8A6'),
    ('Oftalmología', 'Enfermedades de los ojos', '#F97316'),
    ('Otorrinolaringología', 'Oído, nariz y garganta', '#84CC16');