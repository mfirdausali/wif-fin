/**
 * Database type definitions for Supabase
 * Generated from DATABASE_SCHEMA.md
 * Updated for Supabase JS v2 compatibility
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          tel: string | null;
          email: string | null;
          registration_no: string | null;
          registered_office: string | null;
          allow_negative_balance: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          tel?: string | null;
          email?: string | null;
          registration_no?: string | null;
          registered_office?: string | null;
          allow_negative_balance?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          tel?: string | null;
          email?: string | null;
          registration_no?: string | null;
          registered_office?: string | null;
          allow_negative_balance?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          type: 'main_bank' | 'petty_cash';
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          bank_name: string | null;
          account_number: string | null;
          custodian: string | null;
          initial_balance: number;
          current_balance: number;
          is_active: boolean;
          metadata: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          type: 'main_bank' | 'petty_cash';
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          bank_name?: string | null;
          account_number?: string | null;
          custodian?: string | null;
          initial_balance?: number;
          current_balance?: number;
          is_active?: boolean;
          metadata?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          type?: 'main_bank' | 'petty_cash';
          currency?: 'MYR' | 'JPY';
          country?: 'Malaysia' | 'Japan';
          bank_name?: string | null;
          account_number?: string | null;
          custodian?: string | null;
          initial_balance?: number;
          current_balance?: number;
          is_active?: boolean;
          metadata?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          account_id: string | null;
          booking_id: string | null;
          document_type: 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment';
          document_number: string;
          status: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled';
          document_date: string;
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          amount: number;
          subtotal: number | null;
          document_discount_type: 'fixed' | 'percentage' | null;
          document_discount_value: number | null;
          document_discount_amount: number | null;
          tax_rate: number | null;
          tax_amount: number | null;
          total: number | null;
          notes: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          account_id?: string | null;
          booking_id?: string | null;
          document_type: 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment';
          document_number: string;
          status?: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled';
          document_date: string;
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          amount: number;
          subtotal?: number | null;
          document_discount_type?: 'fixed' | 'percentage' | null;
          document_discount_value?: number | null;
          document_discount_amount?: number | null;
          tax_rate?: number | null;
          tax_amount?: number | null;
          total?: number | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          account_id?: string | null;
          booking_id?: string | null;
          document_type?: 'invoice' | 'receipt' | 'payment_voucher' | 'statement_of_payment';
          document_number?: string;
          status?: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled';
          document_date?: string;
          currency?: 'MYR' | 'JPY';
          country?: 'Malaysia' | 'Japan';
          amount?: number;
          subtotal?: number | null;
          document_discount_type?: 'fixed' | 'percentage' | null;
          document_discount_value?: number | null;
          document_discount_amount?: number | null;
          tax_rate?: number | null;
          tax_amount?: number | null;
          total?: number | null;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_account_id_fkey';
            columns: ['account_id'];
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          }
        ];
      };
      invoices: {
        Row: {
          id: string;
          document_id: string;
          customer_name: string;
          customer_address: string | null;
          customer_email: string | null;
          invoice_date: string;
          due_date: string;
          payment_terms: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          customer_name: string;
          customer_address?: string | null;
          customer_email?: string | null;
          invoice_date: string;
          due_date: string;
          payment_terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          customer_name?: string;
          customer_address?: string | null;
          customer_email?: string | null;
          invoice_date?: string;
          due_date?: string;
          payment_terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          }
        ];
      };
      receipts: {
        Row: {
          id: string;
          document_id: string;
          linked_invoice_id: string | null;
          payer_name: string;
          payer_contact: string | null;
          receipt_date: string;
          payment_method: string;
          received_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          linked_invoice_id?: string | null;
          payer_name: string;
          payer_contact?: string | null;
          receipt_date: string;
          payment_method: string;
          received_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          linked_invoice_id?: string | null;
          payer_name?: string;
          payer_contact?: string | null;
          receipt_date?: string;
          payment_method?: string;
          received_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipts_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_linked_invoice_id_fkey';
            columns: ['linked_invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          }
        ];
      };
      payment_vouchers: {
        Row: {
          id: string;
          document_id: string;
          payee_name: string;
          payee_address: string | null;
          payee_bank_account: string | null;
          payee_bank_name: string | null;
          voucher_date: string;
          payment_due_date: string | null;
          requested_by: string;
          approved_by: string | null;
          approval_date: string | null;
          supporting_doc_filename: string | null;
          supporting_doc_base64: string | null;
          supporting_doc_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          payee_name: string;
          payee_address?: string | null;
          payee_bank_account?: string | null;
          payee_bank_name?: string | null;
          voucher_date: string;
          payment_due_date?: string | null;
          requested_by: string;
          approved_by?: string | null;
          approval_date?: string | null;
          supporting_doc_filename?: string | null;
          supporting_doc_base64?: string | null;
          supporting_doc_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          payee_name?: string;
          payee_address?: string | null;
          payee_bank_account?: string | null;
          payee_bank_name?: string | null;
          voucher_date?: string;
          payment_due_date?: string | null;
          requested_by?: string;
          approved_by?: string | null;
          approval_date?: string | null;
          supporting_doc_filename?: string | null;
          supporting_doc_base64?: string | null;
          supporting_doc_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_vouchers_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          }
        ];
      };
      statements_of_payment: {
        Row: {
          id: string;
          document_id: string;
          linked_voucher_id: string;
          payment_date: string;
          payment_method: string;
          transaction_reference: string;
          transfer_proof_filename: string | null;
          transfer_proof_base64: string | null;
          confirmed_by: string;
          payee_name: string;
          transaction_fee: number;
          transaction_fee_type: string | null;
          total_deducted: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          linked_voucher_id: string;
          payment_date: string;
          payment_method: string;
          transaction_reference: string;
          transfer_proof_filename?: string | null;
          transfer_proof_base64?: string | null;
          confirmed_by: string;
          payee_name: string;
          transaction_fee?: number;
          transaction_fee_type?: string | null;
          total_deducted: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          linked_voucher_id?: string;
          payment_date?: string;
          payment_method?: string;
          transaction_reference?: string;
          transfer_proof_filename?: string | null;
          transfer_proof_base64?: string | null;
          confirmed_by?: string;
          payee_name?: string;
          transaction_fee?: number;
          transaction_fee_type?: string | null;
          total_deducted?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'statements_of_payment_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'statements_of_payment_linked_voucher_id_fkey';
            columns: ['linked_voucher_id'];
            referencedRelation: 'payment_vouchers';
            referencedColumns: ['id'];
          }
        ];
      };
      line_items: {
        Row: {
          id: string;
          document_id: string;
          line_number: number;
          description: string;
          quantity: number;
          unit_price: number;
          discount_type: 'fixed' | 'percentage' | null;
          discount_value: number | null;
          discount_amount: number | null;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          line_number: number;
          description: string;
          quantity?: number;
          unit_price: number;
          discount_type?: 'fixed' | 'percentage' | null;
          discount_value?: number | null;
          discount_amount?: number | null;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          line_number?: number;
          description?: string;
          quantity?: number;
          unit_price?: number;
          discount_type?: 'fixed' | 'percentage' | null;
          discount_value?: number | null;
          discount_amount?: number | null;
          amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'line_items_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          document_id: string;
          transaction_type: 'increase' | 'decrease';
          description: string;
          amount: number;
          balance_before: number;
          balance_after: number;
          metadata: Json | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          document_id: string;
          transaction_type: 'increase' | 'decrease';
          description: string;
          amount: number;
          balance_before: number;
          balance_after: number;
          metadata?: Json | null;
          transaction_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          document_id?: string;
          transaction_type?: 'increase' | 'decrease';
          description?: string;
          amount?: number;
          balance_before?: number;
          balance_after?: number;
          metadata?: Json | null;
          transaction_date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_account_id_fkey';
            columns: ['account_id'];
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          }
        ];
      };
      document_counters: {
        Row: {
          id: string;
          company_id: string;
          document_type: string;
          date_key: string;
          counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          document_type: string;
          date_key: string;
          counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          document_type?: string;
          date_key?: string;
          counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_counters_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          username: string;
          email: string;
          full_name: string;
          password_hash: string;
          role: 'admin' | 'manager' | 'accountant' | 'viewer' | 'operations';
          is_active: boolean;
          failed_login_attempts: number;
          locked_until: string | null;
          last_login: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          username: string;
          email: string;
          full_name: string;
          password_hash: string;
          role: 'admin' | 'manager' | 'accountant' | 'viewer' | 'operations';
          is_active?: boolean;
          failed_login_attempts?: number;
          locked_until?: string | null;
          last_login?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          username?: string;
          email?: string;
          full_name?: string;
          password_hash?: string;
          role?: 'admin' | 'manager' | 'accountant' | 'viewer' | 'operations';
          is_active?: boolean;
          failed_login_attempts?: number;
          locked_until?: string | null;
          last_login?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          company_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          company_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          company_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_logs_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_logs_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          refresh_token_hash: string | null;
          device_info: Record<string, unknown> | null;
          last_activity: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          refresh_token_hash?: string | null;
          device_info?: Record<string, unknown> | null;
          last_activity?: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token_hash?: string;
          refresh_token_hash?: string | null;
          device_info?: Record<string, unknown> | null;
          last_activity?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      cost_centers: {
        Row: {
          id: string;
          company_id: string;
          code: string;
          name: string;
          type: 'trip' | 'project' | 'department';
          guest_name: string | null;
          start_date: string | null;
          end_date: string | null;
          number_of_pax: string | null;
          budgeted_revenue: number;
          budgeted_cost: number;
          actual_revenue: number;
          actual_cost: number;
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          exchange_rate: number | null;
          status: 'planning' | 'active' | 'completed' | 'closed';
          is_active: boolean;
          notes: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          code: string;
          name: string;
          type: 'trip' | 'project' | 'department';
          guest_name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          number_of_pax?: string | null;
          budgeted_revenue?: number;
          budgeted_cost?: number;
          actual_revenue?: number;
          actual_cost?: number;
          currency: 'MYR' | 'JPY';
          country: 'Malaysia' | 'Japan';
          exchange_rate?: number | null;
          status?: 'planning' | 'active' | 'completed' | 'closed';
          is_active?: boolean;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          code?: string;
          name?: string;
          type?: 'trip' | 'project' | 'department';
          guest_name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          number_of_pax?: string | null;
          budgeted_revenue?: number;
          budgeted_cost?: number;
          actual_revenue?: number;
          actual_cost?: number;
          currency?: 'MYR' | 'JPY';
          country?: 'Malaysia' | 'Japan';
          exchange_rate?: number | null;
          status?: 'planning' | 'active' | 'completed' | 'closed';
          is_active?: boolean;
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cost_centers_company_id_fkey';
            columns: ['company_id'];
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          }
        ];
      };
      booking_forms: {
        Row: {
          id: string;
          document_id: string;
          cost_center_id: string;
          guest_name: string;
          trip_start_date: string | null;
          trip_end_date: string | null;
          number_of_pax: string | null;
          car_types: string[] | null;
          transportation_items: Json;
          meals_items: Json;
          entrance_items: Json;
          tour_guide_items: Json;
          flight_items: Json;
          accommodation_items: Json;
          transportation_total: number;
          meals_total: number;
          entrance_total: number;
          tour_guide_total: number;
          flight_total: number;
          accommodation_total: number;
          grand_total_jpy: number;
          grand_total_myr: number;
          exchange_rate: number | null;
          wif_cost: number;
          b2b_price: number;
          expected_profit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          cost_center_id: string;
          guest_name: string;
          trip_start_date?: string | null;
          trip_end_date?: string | null;
          number_of_pax?: string | null;
          car_types?: string[] | null;
          transportation_items?: Json;
          meals_items?: Json;
          entrance_items?: Json;
          tour_guide_items?: Json;
          flight_items?: Json;
          accommodation_items?: Json;
          transportation_total?: number;
          meals_total?: number;
          entrance_total?: number;
          tour_guide_total?: number;
          flight_total?: number;
          accommodation_total?: number;
          grand_total_jpy: number;
          grand_total_myr: number;
          exchange_rate?: number | null;
          wif_cost: number;
          b2b_price: number;
          expected_profit: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          cost_center_id?: string;
          guest_name?: string;
          trip_start_date?: string | null;
          trip_end_date?: string | null;
          number_of_pax?: string | null;
          car_types?: string[] | null;
          transportation_items?: Json;
          meals_items?: Json;
          entrance_items?: Json;
          tour_guide_items?: Json;
          flight_items?: Json;
          accommodation_items?: Json;
          transportation_total?: number;
          meals_total?: number;
          entrance_total?: number;
          tour_guide_total?: number;
          flight_total?: number;
          accommodation_total?: number;
          grand_total_jpy?: number;
          grand_total_myr?: number;
          exchange_rate?: number | null;
          wif_cost?: number;
          b2b_price?: number;
          expected_profit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_forms_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_forms_cost_center_id_fkey';
            columns: ['cost_center_id'];
            referencedRelation: 'cost_centers';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      invoice_payment_summary: {
        Row: {
          document_id: string | null;
          invoice_total: number | null;
          amount_paid: number | null;
          balance_due: number | null;
          payment_count: number | null;
          payment_status: string | null;
          last_payment_date: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      generate_document_number: {
        Args: {
          p_company_id: string;
          p_document_type: string;
        };
        Returns: string;
      };
      create_full_document: {
        Args: {
          payload: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
