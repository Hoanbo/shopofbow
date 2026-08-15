// Generated-style types describing the Supabase schema (see supabase/migrations).
// Shaped to satisfy supabase-js v2's GenericSchema constraint (Relationships,
// Views, Functions, Enums, CompositeTypes all present).
export type ProductType = 'ai-tool' | 'premium-app' | 'product';

export type OrderStatus =
  | 'pending_payment'
  | 'pending_delivery'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'refunded';

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
          affiliate_enabled?: boolean;
          affiliate_type?: 'fixed' | 'percent';
          affiliate_reward?: number;
          affiliate_discount?: number;
          price_ctv?: number | null;
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
          badge?: string | null;
          usage_type?: string | null;
          member_count?: number | null;
          profile_type?: string | null;
          short_description?: string | null;
          features?: string[] | null;
          notes?: string | null;
          price_ctv?: number | null;
        };
        Insert: Partial<Database['public']['Tables']['product_plans']['Row']>;
        Update: Partial<Database['public']['Tables']['product_plans']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'product_plans_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'product_features_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
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
          instagram_url: string | null;
          tiktok_url: string | null;
          discord_url: string | null;
          locket_url: string | null;
          support_phone: string | null;
          support_email: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contact_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['contact_settings']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          email: string | null;
          balance: number;
          role?: 'member' | 'ctv' | 'admin';
          referral_code?: string | null;
          referred_by?: string | null;
          affiliate_earnings?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          product_name: string;
          plan_label: string;
          price: number;
          status: OrderStatus;
          payment_code: string;
          notes: string | null;
          account_details: string | null;
          tg_message_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & {
          user_id: string;
          product_name: string;
          plan_label: string;
          payment_code: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'orders_user_profile_fk';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          type: string;
          title: string;
          message: string;
          order_id: string | null;
          user_id: string | null;
          is_admin: boolean;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          type: string;
          title: string;
          message: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'notifications_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_favorites_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      support_tickets: {
        Row: {
          id: string;
          ticket_number: string;
          user_id: string;
          order_id: string | null;
          subject: string;
          status: 'pending' | 'processing' | 'resolved' | 'closed';
          priority: 'low' | 'normal' | 'high' | 'urgent';
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          ticket_number?: string;
          user_id: string;
          order_id?: string | null;
          subject: string;
          status?: 'pending' | 'processing' | 'resolved' | 'closed';
          priority?: 'low' | 'normal' | 'high' | 'urgent';
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          ticket_number?: string;
          user_id?: string;
          order_id?: string | null;
          subject?: string;
          status?: 'pending' | 'processing' | 'resolved' | 'closed';
          priority?: 'low' | 'normal' | 'high' | 'urgent';
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          sender_role: 'user' | 'admin';
          message: string;
          attachments: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_id: string;
          sender_role: 'user' | 'admin';
          message: string;
          attachments?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          sender_id?: string;
          sender_role?: 'user' | 'admin';
          message?: string;
          attachments?: any | null;
          created_at?: string;
        };
        Relationships: [];
      };
      affiliate_conversions: {
        Row: {
          id: string;
          referrer_id: string | null;
          referee_id: string | null;
          order_id: string | null;
          product_id: string | null;
          product_name: string | null;
          order_amount: number;
          commission_amount: number;
          discount_amount: number;
          is_ctv_order: boolean;
          status: 'pending' | 'completed' | 'cancelled';
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['affiliate_conversions']['Row']>;
        Update: Partial<Database['public']['Tables']['affiliate_conversions']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      buy_with_wallet: {
        Args: {
          p_user_id: string;
          p_product_name: string;
          p_plan_label: string;
          p_price: number;
          p_payment_code: string;
          p_notes?: string | null;
        };
        Returns: string;
      };
      refund_order: {
        Args: { p_order_id: string };
        Returns: string;
      };
    };
    Enums: {
      product_type: ProductType;
    };
    CompositeTypes: Record<string, never>;
  };
}
