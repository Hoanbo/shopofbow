// Generated-style types describing the Supabase schema (see supabase/migrations).
// Shaped to satisfy supabase-js v2's GenericSchema constraint (Relationships,
// Views, Functions, Enums, CompositeTypes all present).
export type ProductType = 'ai-tool' | 'premium-app' | 'product';

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          type: ProductType;
          description: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['categories']['Row']>;
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          logo_url: string | null;
          banner_url: string | null;
          type: ProductType;
          accent: string | null;
          badge: string | null;
          base_price: number | null;
          original_price: number | null;
          rating: number | null;
          sold: number | null;
          is_active: boolean;
          is_featured: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']>;
        Update: Partial<Database['public']['Tables']['products']['Row']>;
        Relationships: [];
      };
      product_plans: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          duration: string | null;
          price: number;
          original_price: number | null;
          description: string | null;
          is_highlight: boolean;
          sort_order: number;
          is_active: boolean;
        };
        Insert: Partial<Database['public']['Tables']['product_plans']['Row']>;
        Update: Partial<Database['public']['Tables']['product_plans']['Row']>;
        Relationships: [];
      };
      product_features: {
        Row: {
          id: string;
          product_id: string;
          feature: string;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['product_features']['Row']>;
        Update: Partial<Database['public']['Tables']['product_features']['Row']>;
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          product_id: string | null;
          question: string;
          answer: string;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['faqs']['Row']>;
        Update: Partial<Database['public']['Tables']['faqs']['Row']>;
        Relationships: [];
      };
      contact_settings: {
        Row: {
          id: string;
          facebook_url: string | null;
          zalo_url: string | null;
          support_phone: string | null;
          support_email: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contact_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['contact_settings']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      product_type: ProductType;
    };
    CompositeTypes: Record<string, never>;
  };
}
