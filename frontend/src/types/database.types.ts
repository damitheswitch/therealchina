export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      comments: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string | null
          review_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id?: string | null
          review_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string | null
          review_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_review_id_fkey'
            columns: ['review_id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'member_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profile_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      flight_listings: {
        Row: {
          arrival_city: string | null
          arrival_country: string
          arrival_date: string
          available_kgs: number
          created_at: string | null
          currency: string | null
          departure_city: string | null
          departure_country: string
          departure_date: string
          id: string
          is_active: boolean | null
          notes: string | null
          price_per_kg: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          arrival_city?: string | null
          arrival_country: string
          arrival_date: string
          available_kgs: number
          created_at?: string | null
          currency?: string | null
          departure_city?: string | null
          departure_country: string
          departure_date: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          price_per_kg: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          arrival_city?: string | null
          arrival_country?: string
          arrival_date?: string
          available_kgs?: number
          created_at?: string | null
          currency?: string | null
          departure_city?: string | null
          departure_country?: string
          departure_date?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          price_per_kg?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_discoverable: boolean | null
          location: string | null
          onboarding_completed: boolean | null
          program: string | null
          show_social_handle: boolean | null
          social_handle: string | null
          social_handles: Json | null
          social_platform: string | null
          university: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_discoverable?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          program?: string | null
          show_social_handle?: boolean | null
          social_handle?: string | null
          social_handles?: Json | null
          social_platform?: string | null
          university?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_discoverable?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          program?: string | null
          show_social_handle?: boolean | null
          social_handle?: string | null
          social_handles?: Json | null
          social_platform?: string | null
          university?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string | null
          degree_level: string | null
          id: string
          media: Json | null
          program: string | null
          rating: number
          text: string
          university_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          degree_level?: string | null
          id?: string
          media?: Json | null
          program?: string | null
          rating: number
          text: string
          university_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          degree_level?: string | null
          id?: string
          media?: Json | null
          program?: string | null
          rating?: number
          text?: string
          university_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reviews_university_id_fkey'
            columns: ['university_id']
            isOneToOne: false
            referencedRelation: 'universities'
            referencedColumns: ['id']
          },
        ]
      }
      universities: {
        Row: {
          city: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          logo_url: string | null
          name: string
          name_zh: string | null
          search_text: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name: string
          name_zh?: string | null
          search_text?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string
          name_zh?: string | null
          search_text?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      university_stats: {
        Row: {
          avg_rating: number
          has_verified_review: boolean
          review_count: number
          university_id: string
          updated_at: string | null
        }
        Insert: {
          avg_rating?: number
          has_verified_review?: boolean
          review_count?: number
          university_id: string
          updated_at?: string | null
        }
        Update: {
          avg_rating?: number
          has_verified_review?: boolean
          review_count?: number
          university_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'university_stats_university_id_fkey'
            columns: ['university_id']
            isOneToOne: true
            referencedRelation: 'universities'
            referencedColumns: ['id']
          },
        ]
      }
      upload_rate_limits: {
        Row: {
          count: number
          key: string
          last_attempt_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          last_attempt_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          last_attempt_at?: string
          window_start?: string
        }
        Relationships: []
      }
      upload_sessions: {
        Row: {
          created_at: string
          expires_at: string
          files_used: number
          id: string
          ip: string
          is_anon: boolean
          max_files: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          files_used?: number
          id?: string
          ip: string
          is_anon?: boolean
          max_files?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          files_used?: number
          id?: string
          ip?: string
          is_anon?: boolean
          max_files?: number
          user_id?: string | null
        }
        Relationships: []
      }
      upvotes: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'upvotes_review_id_fkey'
            columns: ['review_id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      flight_listings_with_profile: {
        Row: {
          arrival_city: string | null
          arrival_country: string | null
          arrival_date: string | null
          available_kgs: number | null
          avatar_url: string | null
          created_at: string | null
          currency: string | null
          departure_city: string | null
          departure_country: string | null
          departure_date: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          price_per_kg: number | null
          show_social_handle: boolean | null
          social_handles: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_discoverable: boolean | null
          location: string | null
          onboarding_completed: boolean | null
          program: string | null
          show_social_handle: boolean | null
          social_handle: string | null
          social_handles: Json | null
          social_platform: string | null
          university: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_discoverable?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          program?: string | null
          show_social_handle?: boolean | null
          social_handle?: never
          social_handles?: never
          social_platform?: never
          university?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_discoverable?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          program?: string | null
          show_social_handle?: boolean | null
          social_handle?: never
          social_handles?: never
          social_platform?: never
          university?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profile_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_upload_rate_limits: { Args: never; Returns: undefined }
      profile_has_social_handle: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      record_upload_attempt: { Args: { p_key: string }; Returns: number }
      refresh_university_stats: {
        Args: { p_university_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
      toggle_upvote: {
        Args: { p_review_id: string }
        Returns: {
          upvote_count: number
          upvoted: boolean
        }[]
      }
      use_upload_session: {
        Args: { p_session_id: string }
        Returns: {
          expires_at: string
          files_used: number
          ip: string
          is_anon: boolean
          max_files: number
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
