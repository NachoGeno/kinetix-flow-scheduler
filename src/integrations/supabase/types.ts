export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
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
          no_show_reason: string | null
          notes: string | null
          pardon_reason: string | null
          pardoned_at: string | null
          pardoned_by: string | null
          patient_id: string
          reason: string | null
          reschedule_reason: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
          rescheduled_from_id: string | null
          rescheduled_to_id: string | null
          session_deducted: boolean | null
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
          no_show_reason?: string | null
          notes?: string | null
          pardon_reason?: string | null
          pardoned_at?: string | null
          pardoned_by?: string | null
          patient_id: string
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          session_deducted?: boolean | null
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
          no_show_reason?: string | null
          notes?: string | null
          pardon_reason?: string | null
          pardoned_at?: string | null
          pardoned_by?: string | null
          patient_id?: string
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          session_deducted?: boolean | null
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
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_to_id_fkey"
            columns: ["rescheduled_to_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cash_control: {
        Row: {
          actual_cash_amount: number | null
          closed_by: string
          control_date: string
          created_at: string
          difference: number | null
          expected_cash_amount: number
          id: string
          is_closed: boolean
          observations: string | null
          updated_at: string
        }
        Insert: {
          actual_cash_amount?: number | null
          closed_by: string
          control_date?: string
          created_at?: string
          difference?: number | null
          expected_cash_amount?: number
          id?: string
          is_closed?: boolean
          observations?: string | null
          updated_at?: string
        }
        Update: {
          actual_cash_amount?: number | null
          closed_by?: string
          control_date?: string
          created_at?: string
          difference?: number | null
          expected_cash_amount?: number
          id?: string
          is_closed?: boolean
          observations?: string | null
          updated_at?: string
        }
        Relationships: []
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
      email_recipients: {
        Row: {
          created_at: string
          email: string
          email_type: string
          id: string
          is_active: boolean
          name: string | null
          obra_social_art_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_type: string
          id?: string
          is_active?: boolean
          name?: string | null
          obra_social_art_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_type?: string
          id?: string
          is_active?: boolean
          name?: string | null
          obra_social_art_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_recipients_obra_social_art_id_fkey"
            columns: ["obra_social_art_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales_art"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string
          default_sender_email: string
          default_sender_name: string
          id: string
          reply_to: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_sender_email: string
          default_sender_name?: string
          id?: string
          reply_to?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_sender_email?: string
          default_sender_name?: string
          id?: string
          reply_to?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_history_entries: {
        Row: {
          appointment_date: string
          appointment_id: string
          created_at: string
          evolution: string | null
          id: string
          observations: string | null
          professional_id: string
          professional_name: string
          unified_medical_history_id: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_id: string
          created_at?: string
          evolution?: string | null
          id?: string
          observations?: string | null
          professional_id: string
          professional_name: string
          unified_medical_history_id: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_id?: string
          created_at?: string
          evolution?: string | null
          id?: string
          observations?: string | null
          professional_id?: string
          professional_name?: string
          unified_medical_history_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_medical_history_entries_appointment"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_medical_history_entries_unified_history"
            columns: ["unified_medical_history_id"]
            isOneToOne: false
            referencedRelation: "unified_medical_histories"
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
          document_status: string
          id: string
          instructions: string | null
          obra_social_art_id: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          patient_id: string
          presentation_status: string | null
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
          document_status?: string
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          patient_id: string
          presentation_status?: string | null
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
          document_status?: string
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          patient_id?: string
          presentation_status?: string | null
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
      novedades: {
        Row: {
          autor_id: string
          categoria: Database["public"]["Enums"]["news_category"] | null
          contenido: string
          created_at: string
          fecha: string
          id: string
          turno: Database["public"]["Enums"]["shift_type"]
          updated_at: string
          urgente: boolean | null
        }
        Insert: {
          autor_id: string
          categoria?: Database["public"]["Enums"]["news_category"] | null
          contenido: string
          created_at?: string
          fecha?: string
          id?: string
          turno?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          urgente?: boolean | null
        }
        Update: {
          autor_id?: string
          categoria?: Database["public"]["Enums"]["news_category"] | null
          contenido?: string
          created_at?: string
          fecha?: string
          id?: string
          turno?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          urgente?: boolean | null
        }
        Relationships: []
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
      patient_noshow_resets: {
        Row: {
          appointments_affected: number
          created_at: string
          id: string
          patient_id: string
          reason: string | null
          reset_by: string
          reset_date: string
        }
        Insert: {
          appointments_affected?: number
          created_at?: string
          id?: string
          patient_id: string
          reason?: string | null
          reset_by: string
          reset_date?: string
        }
        Update: {
          appointments_affected?: number
          created_at?: string
          id?: string
          patient_id?: string
          reason?: string | null
          reset_by?: string
          reset_date?: string
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
      plus_payments: {
        Row: {
          amount: number
          collected_by: string
          created_at: string
          id: string
          medical_order_id: string
          observations: string | null
          patient_id: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          collected_by: string
          created_at?: string
          id?: string
          medical_order_id: string
          observations?: string | null
          patient_id: string
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_by?: string
          created_at?: string
          id?: string
          medical_order_id?: string
          observations?: string | null
          patient_id?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          professional_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      presentation_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          medical_order_id: string
          shared_file_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          medical_order_id: string
          shared_file_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          medical_order_id?: string
          shared_file_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_documents_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
      unified_medical_histories: {
        Row: {
          created_at: string
          id: string
          medical_order_id: string
          patient_id: string
          template_data: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medical_order_id: string
          patient_id: string
          template_data?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medical_order_id?: string
          patient_id?: string
          template_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_unified_medical_histories_medical_order"
            columns: ["medical_order_id"]
            isOneToOne: true
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_medical_histories_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      can_manage_plus_payments: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_presentation_ready: {
        Args: { order_id: string }
        Returns: boolean
      }
      fix_medical_orders_data_integrity: {
        Args: Record<PropertyKey, never>
        Returns: {
          new_completed: boolean
          new_sessions_used: number
          old_completed: boolean
          old_sessions_used: number
          order_id: string
          patient_name: string
        }[]
      }
      generate_final_summary_for_completed_order: {
        Args: { order_id: string }
        Returns: boolean
      }
      get_active_patients_in_treatment: {
        Args: {
          end_date?: string
          obra_social_filter?: string
          start_date?: string
        }
        Returns: {
          active_orders: number
          last_appointment_date: string
          obra_social_name: string
          patient_id: string
          patient_name: string
        }[]
      }
      get_appointment_stats: {
        Args: { doctor_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          count: number
          percentage: number
          status: string
        }[]
      }
      get_appointments_by_time_slot: {
        Args: { doctor_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          cancelled_appointments: number
          completed_appointments: number
          completion_rate: number
          time_slot: string
          total_appointments: number
        }[]
      }
      get_current_user_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_daily_plus_stats: {
        Args: { target_date?: string }
        Returns: {
          cash_amount: number
          mercado_pago_amount: number
          total_amount: number
          total_payments: number
          transfer_amount: number
        }[]
      }
      get_new_patients_by_month: {
        Args: {
          end_date?: string
          obra_social_filter?: string
          start_date?: string
        }
        Returns: {
          month: number
          month_name: string
          new_patients: number
          year: number
        }[]
      }
      get_patients_attended_by_month: {
        Args: { doctor_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          month: number
          month_name: string
          patients_attended: number
          year: number
        }[]
      }
      get_patients_by_doctor: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          doctor_id: string
          doctor_name: string
          patients_attended: number
          percentage: number
        }[]
      }
      get_patients_without_closed_history: {
        Args: {
          end_date?: string
          obra_social_filter?: string
          start_date?: string
        }
        Returns: {
          completed_sessions: number
          has_final_summary: boolean
          obra_social_name: string
          patient_id: string
          patient_name: string
        }[]
      }
      get_plus_payments_report: {
        Args: {
          end_date?: string
          payment_method_filter?: Database["public"]["Enums"]["payment_method"]
          professional_filter?: string
          start_date?: string
        }
        Returns: {
          amount: number
          obra_social_name: string
          observations: string
          patient_name: string
          payment_date: string
          payment_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          professional_name: string
        }[]
      }
      get_professional_work_hours: {
        Args: { doctor_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          appointments_completed: number
          doctor_id: string
          doctor_name: string
          estimated_hours: number
          patients_attended: number
          specialty_name: string
        }[]
      }
      get_real_session_count: {
        Args: { patient_uuid: string }
        Returns: number
      }
      get_stats_by_obra_social: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          costo_total: number
          obra_social_id: string
          obra_social_name: string
          ordenes_medicas: number
          pacientes_atendidos: number
          sesiones_realizadas: number
          tipo: Database["public"]["Enums"]["insurance_type"]
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
        | "no_show_rescheduled"
        | "no_show_session_lost"
        | "rescheduled"
      insurance_type: "obra_social" | "art"
      news_category: "tecnica" | "administrativa" | "medica" | "urgente"
      order_type: "laboratory" | "imaging" | "prescription" | "referral"
      payment_method: "cash" | "transfer" | "mercado_pago"
      shift_type: "mañana" | "tarde" | "completo"
      user_role: "admin" | "doctor" | "patient" | "reception"
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
        "no_show_rescheduled",
        "no_show_session_lost",
        "rescheduled",
      ],
      insurance_type: ["obra_social", "art"],
      news_category: ["tecnica", "administrativa", "medica", "urgente"],
      order_type: ["laboratory", "imaging", "prescription", "referral"],
      payment_method: ["cash", "transfer", "mercado_pago"],
      shift_type: ["mañana", "tarde", "completo"],
      user_role: ["admin", "doctor", "patient", "reception"],
    },
  },
} as const
