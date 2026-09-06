export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          actor_name: string;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_title: string | null;
          entity_type: string;
          id: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_name: string;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_title?: string | null;
          entity_type: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_title?: string | null;
          entity_type?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          recorded_by: string | null;
          service_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_id: string;
          recorded_by?: string | null;
          service_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          recorded_by?: string | null;
          service_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          category: Database["public"]["Enums"]["member_category"];
          contact: string | null;
          created_at: string;
          gender: Database["public"]["Enums"]["member_gender"] | null;
          guardian_id: string | null;
          id: string;
          is_worker: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["member_category"];
          contact?: string | null;
          created_at?: string;
          gender?: Database["public"]["Enums"]["member_gender"] | null;
          guardian_id?: string | null;
          id?: string;
          is_worker?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["member_category"];
          contact?: string | null;
          created_at?: string;
          gender?: Database["public"]["Enums"]["member_gender"] | null;
          guardian_id?: string | null;
          id?: string;
          is_worker?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          name?: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          name: string;
          type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
          visitor_adult_male: number;
          visitor_adult_female: number;
          visitor_youth_male: number;
          visitor_youth_female: number;
          visitor_child_male: number;
          visitor_child_female: number;
          visitor_notes: string | null;
          taken_by_name: string | null;
          taken_by_id: string | null;
          updated_by_name: string | null;
          updated_by_id: string | null;
          submission_count: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          id?: string;
          name: string;
          type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
          visitor_adult_male?: number;
          visitor_adult_female?: number;
          visitor_youth_male?: number;
          visitor_youth_female?: number;
          visitor_child_male?: number;
          visitor_child_female?: number;
          visitor_notes?: string | null;
          taken_by_name?: string | null;
          taken_by_id?: string | null;
          updated_by_name?: string | null;
          updated_by_id?: string | null;
          submission_count?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
          visitor_adult_male?: number;
          visitor_adult_female?: number;
          visitor_youth_male?: number;
          visitor_youth_female?: number;
          visitor_child_male?: number;
          visitor_child_female?: number;
          visitor_notes?: string | null;
          taken_by_name?: string | null;
          taken_by_id?: string | null;
          updated_by_name?: string | null;
          updated_by_id?: string | null;
          submission_count?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "attendance_taker";
      attendance_status: "present" | "absent";
      member_category: "adult" | "young_adult" | "youth" | "child";
      member_gender: "male" | "female";
      service_type: "recurring" | "one_off";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "attendance_taker"],
      attendance_status: ["present", "absent"],
      member_category: ["adult", "young_adult", "youth", "child"],
      member_gender: ["male", "female"],
      service_type: ["recurring", "one_off"],
    },
  },
} as const;
