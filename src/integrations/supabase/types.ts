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
      appointment_order_assignments: {
        Row: {
          appointment_id: string
          assigned_at: string
          assigned_by: string
          created_at: string
          id: string
          medical_order_id: string
        }
        Insert: {
          appointment_id: string
          assigned_at?: string
          assigned_by: string
          created_at?: string
          id?: string
          medical_order_id: string
        }
        Update: {
          appointment_id?: string
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          id?: string
          medical_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_order_assignments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_order_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_order_assignments_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          action_type: string
          appointment_id: string
          changed_at: string
          changed_by: string
          id: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status: Database["public"]["Enums"]["appointment_status"] | null
          reason: string | null
          revert_reason: string | null
          reverted_at: string | null
          reverted_by: string | null
        }
        Insert: {
          action_type?: string
          appointment_id: string
          changed_at?: string
          changed_by: string
          id?: string
          new_status: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
          reason?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Update: {
          action_type?: string
          appointment_id?: string
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["appointment_status"]
          old_status?: Database["public"]["Enums"]["appointment_status"] | null
          reason?: string | null
          revert_reason?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
        }
        Relationships: []
      }
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      appointments_backup: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          duration_minutes: number | null
          id: string | null
          no_show_reason: string | null
          notes: string | null
          organization_id: string | null
          pardon_reason: string | null
          pardoned_at: string | null
          pardoned_by: string | null
          patient_id: string | null
          reason: string | null
          reschedule_reason: string | null
          rescheduled_at: string | null
          rescheduled_by: string | null
          rescheduled_from_id: string | null
          rescheduled_to_id: string | null
          session_deducted: boolean | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string | null
          no_show_reason?: string | null
          notes?: string | null
          organization_id?: string | null
          pardon_reason?: string | null
          pardoned_at?: string | null
          pardoned_by?: string | null
          patient_id?: string | null
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          session_deducted?: boolean | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string | null
          no_show_reason?: string | null
          notes?: string | null
          organization_id?: string | null
          pardon_reason?: string | null
          pardoned_at?: string | null
          pardoned_by?: string | null
          patient_id?: string | null
          reason?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          rescheduled_from_id?: string | null
          rescheduled_to_id?: string | null
          session_deducted?: boolean | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_excel_fields: {
        Row: {
          column_order: number
          created_at: string
          default_value: string | null
          field_key: string
          field_name: string
          field_type: string
          format_pattern: string | null
          id: string
          is_required: boolean | null
          template_id: string
        }
        Insert: {
          column_order: number
          created_at?: string
          default_value?: string | null
          field_key: string
          field_name: string
          field_type: string
          format_pattern?: string | null
          id?: string
          is_required?: boolean | null
          template_id: string
        }
        Update: {
          column_order?: number
          created_at?: string
          default_value?: string | null
          field_key?: string
          field_name?: string
          field_type?: string
          format_pattern?: string | null
          id?: string
          is_required?: boolean | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_excel_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "billing_excel_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_excel_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          obra_social_id: string
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          obra_social_id: string
          template_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          obra_social_id?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_excel_templates_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales_art"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_export_templates: {
        Row: {
          column_config: Json
          created_at: string
          id: string
          is_active: boolean
          obra_social_art_id: string
          template_name: string
          updated_at: string
        }
        Insert: {
          column_config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          obra_social_art_id: string
          template_name: string
          updated_at?: string
        }
        Update: {
          column_config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          obra_social_art_id?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_invoice_items: {
        Row: {
          billing_invoice_id: string
          created_at: string
          id: string
          medical_order_id: string
        }
        Insert: {
          billing_invoice_id: string
          created_at?: string
          id?: string
          medical_order_id: string
        }
        Update: {
          billing_invoice_id?: string
          created_at?: string
          id?: string
          medical_order_id?: string
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          created_at: string
          created_by: string
          file_name: string | null
          file_url: string | null
          id: string
          invoice_number: string
          obra_social_art_id: string
          period_end: string
          period_start: string
          sent_at: string
          status: string
          total_amount: number | null
          total_presentations: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_number: string
          obra_social_art_id: string
          period_end: string
          period_start: string
          sent_at?: string
          status?: string
          total_amount?: number | null
          total_presentations?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string
          obra_social_art_id?: string
          period_end?: string
          period_start?: string
          sent_at?: string
          status?: string
          total_amount?: number | null
          total_presentations?: number
          updated_at?: string
        }
        Relationships: []
      }
      cash_reconciliation: {
        Row: {
          calculated_balance: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          difference: number | null
          id: string
          is_closed: boolean
          observations: string | null
          opening_balance: number
          physical_count: number | null
          previous_balance: number | null
          reconciliation_date: string
          shift_end_time: string | null
          shift_start_time: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          total_expenses: number
          total_income: number
          updated_at: string
        }
        Insert: {
          calculated_balance?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          is_closed?: boolean
          observations?: string | null
          opening_balance?: number
          physical_count?: number | null
          previous_balance?: number | null
          reconciliation_date?: string
          shift_end_time?: string | null
          shift_start_time?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          total_expenses?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          calculated_balance?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          is_closed?: boolean
          observations?: string | null
          opening_balance?: number
          physical_count?: number | null
          previous_balance?: number | null
          reconciliation_date?: string
          shift_end_time?: string | null
          shift_start_time?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          total_expenses?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_reconciliation_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string
          expense_category_id: string | null
          id: string
          medical_order_id: string | null
          observations: string | null
          organization_id: string
          patient_id: string | null
          plus_payment_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description: string
          expense_category_id?: string | null
          id?: string
          medical_order_id?: string | null
          observations?: string | null
          organization_id: string
          patient_id?: string | null
          plus_payment_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          expense_category_id?: string | null
          id?: string
          medical_order_id?: string | null
          observations?: string | null
          organization_id?: string
          patient_id?: string | null
          plus_payment_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_plus_payment_id_fkey"
            columns: ["plus_payment_id"]
            isOneToOne: false
            referencedRelation: "plus_payments"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "doctors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          early_discharge: boolean | null
          enviado_a_os: boolean | null
          id: string
          instructions: string | null
          obra_social_art_id: string | null
          order_date: string
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
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
          early_discharge?: boolean | null
          enviado_a_os?: boolean | null
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_date?: string
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
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
          early_discharge?: boolean | null
          enviado_a_os?: boolean | null
          id?: string
          instructions?: string | null
          obra_social_art_id?: string | null
          order_date?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          organization_id?: string
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
            foreignKeyName: "medical_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "medical_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          turno?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          urgente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "novedades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          responsable_contacto?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["insurance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_sociales_art_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          max_patients: number | null
          max_users: number | null
          name: string
          plan_type: string | null
          primary_color: string | null
          secondary_color: string | null
          subdomain: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_patients?: number | null
          max_users?: number | null
          name: string
          plan_type?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          subdomain?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          max_patients?: number | null
          max_users?: number | null
          name?: string
          plan_type?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          subdomain?: string | null
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          patient_id?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          professional_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_medical_histories: {
        Row: {
          created_at: string
          id: string
          medical_order_id: string
          organization_id: string
          patient_id: string
          template_data: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medical_order_id: string
          organization_id: string
          patient_id: string
          template_data?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medical_order_id?: string
          organization_id?: string
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
          {
            foreignKeyName: "unified_medical_histories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      assign_appointment_to_oldest_available_order: {
        Args: { appointment_id_param: string; patient_id_param: string }
        Returns: boolean
      }
      audit_patient_session_allocation: {
        Args: { patient_uuid?: string }
        Returns: {
          calculated_fifo_sessions: number
          current_sessions_used: number
          discrepancy: number
          order_date: string
          order_id: string
          order_status: string
          patient_id: string
          patient_name: string
          total_sessions: number
        }[]
      }
      can_access_admin_only_modules: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_access_secretaria_modules: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_manage_plus_payments: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_presentation_ready: {
        Args: { order_id: string }
        Returns: boolean
      }
      create_organization_with_validation: {
        Args: {
          org_address?: string
          org_contact_email?: string
          org_contact_phone?: string
          org_max_patients?: number
          org_max_users?: number
          org_name: string
          org_plan_type?: string
          org_primary_color?: string
          org_secondary_color?: string
          org_subdomain: string
        }
        Returns: {
          organization_id: string
        }[]
      }
      fix_all_patient_session_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          orders_changed: number
          orders_processed: number
          patient_id: string
          patient_name: string
        }[]
      }
      fix_medical_orders_data_integrity: {
        Args: Record<PropertyKey, never>
        Returns: {
          action_taken: string
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
      get_all_users_for_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          first_name: string
          last_name: string
          organization_id: string
          organization_name: string
          phone: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
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
      get_current_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_daily_cash_summary: {
        Args: { target_date?: string }
        Returns: {
          is_reconciled: boolean
          last_reconciliation_date: string
          net_balance: number
          total_expenses: number
          total_income: number
          transaction_count: number
        }[]
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
      get_organization_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_doctors: number
          organization_id: string
          total_appointments: number
          total_patients: number
          total_users: number
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
      is_secretaria: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_super_admin_only: {
        Args: { user_id: string }
        Returns: boolean
      }
      recalc_order_sessions: {
        Args: { order_id_param: string }
        Returns: undefined
      }
      recalc_patient_order_sessions: {
        Args: { patient_uuid: string }
        Returns: {
          action_taken: string
          new_completed: boolean
          new_sessions_used: number
          old_completed: boolean
          old_sessions_used: number
          order_id: string
        }[]
      }
      recalc_patient_order_sessions_with_assignments: {
        Args: { patient_uuid: string }
        Returns: undefined
      }
      revert_appointment_status: {
        Args: { appointment_uuid: string; revert_reason_text: string }
        Returns: boolean
      }
      search_appointments_paginated: {
        Args: {
          date_from?: string
          date_to?: string
          limit_count?: number
          offset_count?: number
          search_term?: string
          status_filter?: string
          user_profile_id?: string
          user_role?: string
        }
        Returns: {
          appointment_data: Json
          total_count: number
        }[]
      }
      search_patients_paginated: {
        Args: { page_number?: number; page_size?: number; search_term?: string }
        Returns: {
          patient_data: Json
          total_count: number
        }[]
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
        | "discharged"
      insurance_type: "obra_social" | "art"
      news_category: "tecnica" | "administrativa" | "medica" | "urgente"
      order_type: "laboratory" | "imaging" | "prescription" | "referral"
      payment_method: "cash" | "transfer" | "mercado_pago"
      shift_type: "mañana" | "tarde" | "completo"
      user_role:
        | "admin"
        | "doctor"
        | "patient"
        | "reception"
        | "super_admin"
        | "secretaria"
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
        "discharged",
      ],
      insurance_type: ["obra_social", "art"],
      news_category: ["tecnica", "administrativa", "medica", "urgente"],
      order_type: ["laboratory", "imaging", "prescription", "referral"],
      payment_method: ["cash", "transfer", "mercado_pago"],
      shift_type: ["mañana", "tarde", "completo"],
      user_role: [
        "admin",
        "doctor",
        "patient",
        "reception",
        "super_admin",
        "secretaria",
      ],
    },
  },
} as const
