export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          diagnosis: string | null
          doctor_id: string
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string
          reason: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          diagnosis?: string | null
          doctor_id: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          appointment_duration: number | null
          bio: string | null
          consultation_fee: number | null
          created_at: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          license_number: string
          profile_id: string
          schedule_notes: string | null
          specialty_id: string
          updated_at: string
          work_days: string[] | null
          work_end_time: string | null
          work_start_time: string | null
          years_experience: number | null
        }
        Insert: {
          appointment_duration?: number | null
          bio?: string | null
          consultation_fee?: number | null
          created_at?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          license_number: string
          profile_id: string
          schedule_notes?: string | null
          specialty_id: string
          updated_at?: string
          work_days?: string[] | null
          work_end_time?: string | null
          work_start_time?: string | null
          years_experience?: number | null
        }
        Update: {
          appointment_duration?: number | null
          bio?: string | null
          consultation_fee?: number | null
          created_at?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string
          profile_id?: string
          schedule_notes?: string | null
          specialty_id?: string
          updated_at?: string
          work_days?: string[] | null
          work_end_time?: string | null
          work_start_time?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_orders: {
        Row: {
          appointment_id: string | null
          art_authorization_number: string | null
          art_provider: string | null
          attachment_name: string | null
          attachment_url: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          description: string
          doctor_id: string | null
          doctor_name: string | null
          id: string
          instructions: string | null
          obra_social_art_id: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          patient_id: string
          results: string | null
          sessions_used: number
          total_sessions: number
          updated_at: string
          urgent: boolean | null
        }
        Insert: {
          appointment_id?: string | null
          art_authorization_number?: string | null
          art_provider?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description: string
          doctor_id?: string | null
          doctor_name?: string | null
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          patient_id: string
          results?: string | null
          sessions_used?: number
          total_sessions?: number
          updated_at?: string
          urgent?: boolean | null
        }
        Update: {
          appointment_id?: string | null
          art_authorization_number?: string | null
          art_provider?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          description?: string
          doctor_id?: string | null
          doctor_name?: string | null
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          patient_id?: string
          results?: string | null
          sessions_used?: number
          total_sessions?: number
          updated_at?: string
          urgent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_orders_obra_social_art_id_fkey"
            columns: ["obra_social_art_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales_art"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          created_at: string
          created_by: string
          diagnosis: string | null
          follow_up_notes: string | null
          id: string
          patient_id: string
          physical_examination: string | null
          prescription: string | null
          record_date: string
          treatment: string | null
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          created_by: string
          diagnosis?: string | null
          follow_up_notes?: string | null
          id?: string
          patient_id: string
          physical_examination?: string | null
          prescription?: string | null
          record_date?: string
          treatment?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          created_at?: string
          created_by?: string
          diagnosis?: string | null
          follow_up_notes?: string | null
          id?: string
          patient_id?: string
          physical_examination?: string | null
          prescription?: string | null
          record_date?: string
          treatment?: string | null
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      obras_sociales_art: {
        Row: {
          condicion_iva: string | null
          created_at: string
          cuit: string | null
          domicilio: string | null
          email: string | null
          id: string
          is_active: boolean
          nombre: string
          responsable_contacto: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["insurance_type"]
          updated_at: string
        }
        Insert: {
          condicion_iva?: string | null
          created_at?: string
          cuit?: string | null
          domicilio?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          responsable_contacto?: string | null
          telefono?: string | null
          tipo: Database["public"]["Enums"]["insurance_type"]
          updated_at?: string
        }
        Update: {
          condicion_iva?: string | null
          created_at?: string
          cuit?: string | null
          domicilio?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          responsable_contacto?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["insurance_type"]
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          allergies: string[] | null
          blood_type: string | null
          created_at: string
          current_medications: string[] | null
          id: string
          insurance_number: string | null
          insurance_provider: string | null
          is_active: boolean | null
          medical_record_number: string | null
          obra_social_art_id: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: string | null
          created_at?: string
          current_medications?: string[] | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          medical_record_number?: string | null
          obra_social_art_id?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          blood_type?: string | null
          created_at?: string
          current_medications?: string[] | null
          id?: string
          insurance_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean | null
          medical_record_number?: string | null
          obra_social_art_id?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_obra_social_art_id_fkey"
            columns: ["obra_social_art_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales_art"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          dni: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          dni?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          dni?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      progress_notes: {
        Row: {
          appointment_id: string
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          medical_order_id: string | null
          note_type: string
          patient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          medical_order_id?: string | null
          note_type?: string
          patient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          medical_order_id?: string | null
          note_type?: string
          patient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_progress_notes_appointment"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_progress_notes_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      valores_honorarios: {
        Row: {
          created_at: string
          doctor_id: string
          fecha_vigencia_desde: string
          fecha_vigencia_hasta: string | null
          id: string
          is_active: boolean
          updated_at: string
          valor_por_sesion: number
        }
        Insert: {
          created_at?: string
          doctor_id: string
          fecha_vigencia_desde?: string
          fecha_vigencia_hasta?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          valor_por_sesion?: number
        }
        Update: {
          created_at?: string
          doctor_id?: string
          fecha_vigencia_desde?: string
          fecha_vigencia_hasta?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          valor_por_sesion?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_appointment_stats: {
        Args: { start_date?: string; end_date?: string; doctor_filter?: string }
        Returns: {
          status: string
          count: number
          percentage: number
        }[]
      }
      get_patients_attended_by_month: {
        Args: { start_date?: string; end_date?: string; doctor_filter?: string }
        Returns: {
          year: number
          month: number
          month_name: string
          patients_attended: number
        }[]
      }
      get_patients_by_doctor: {
        Args: { start_date?: string; end_date?: string }
        Returns: {
          doctor_id: string
          doctor_name: string
          patients_attended: number
          percentage: number
        }[]
      }
      get_stats_by_obra_social: {
        Args: { start_date?: string; end_date?: string }
        Returns: {
          obra_social_id: string
          obra_social_name: string
          tipo: Database["public"]["Enums"]["insurance_type"]
          pacientes_atendidos: number
          sesiones_realizadas: number
          ordenes_medicas: number
          costo_total: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      insurance_type: "obra_social" | "art"
      order_type: "laboratory" | "imaging" | "prescription" | "referral"
      user_role: "admin" | "doctor" | "patient"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      insurance_type: ["obra_social", "art"],
      order_type: ["laboratory", "imaging", "prescription", "referral"],
      user_role: ["admin", "doctor", "patient"],
    },
  },
} as const
