// Hand-written subset of the WODPLACE (wiwpaekdykxernegicdv) schema — only the
// tables this panel reads/writes. Regenerate with the Supabase CLI if you need
// the full schema. Kept minimal on purpose.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BoxStatus = "pendiente" | "activo" | "suspendido" | "rechazado";

export type Database = {
  public: {
    Tables: {
      boxes: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string | null;
          location: string | null;
          status: BoxStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_user_id?: string | null;
          location?: string | null;
          status?: BoxStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_user_id?: string | null;
          location?: string | null;
          status?: BoxStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          box_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          box_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          box_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      box_members: {
        Row: {
          box_id: string;
          user_id: string;
          status: string;
          joined_at: string;
        };
        Insert: {
          box_id: string;
          user_id: string;
          status?: string;
          joined_at?: string;
        };
        Update: {
          box_id?: string;
          user_id?: string;
          status?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
