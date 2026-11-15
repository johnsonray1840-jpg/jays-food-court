export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = 'confirmed' | 'cooking' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentMethod = 'transfer' | 'card' | 'cash_on_delivery';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type StaffRole = 'kitchen_staff' | 'manager' | 'admin';
export type DiscountType = 'percentage' | 'fixed_amount';

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          phone: string;
          full_name: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          full_name: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          full_name?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_addresses: {
        Row: {
          id: string;
          customer_id: string;
          street_address: string;
          landmark: string | null;
          city: string;
          state: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          street_address: string;
          landmark?: string | null;
          city?: string;
          state?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          street_address?: string;
          landmark?: string | null;
          city?: string;
          state?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: string;
          legacy_id: number | null;
          category_id: string;
          name: string;
          slug: string;
          description: string;
          base_price: number;
          image_url: string;
          rating_avg: number;
          rating_count: string;
          is_available: boolean;
          is_popular: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_id?: number | null;
          category_id: string;
          name: string;
          slug: string;
          description: string;
          base_price: number;
          image_url: string;
          rating_avg?: number;
          rating_count?: string;
          is_available?: boolean;
          is_popular?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legacy_id?: number | null;
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string;
          base_price?: number;
          image_url?: string;
          rating_avg?: number;
          rating_count?: string;
          is_available?: boolean;
          is_popular?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customization_groups: {
        Row: {
          id: string;
          name: string;
          min_selectable: number;
          max_selectable: number;
          is_required: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          min_selectable?: number;
          max_selectable?: number;
          is_required?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          min_selectable?: number;
          max_selectable?: number;
          is_required?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_item_customization_groups: {
        Row: {
          menu_item_id: string;
          group_id: string;
        };
        Insert: {
          menu_item_id: string;
          group_id: string;
        };
        Update: {
          menu_item_id?: string;
          group_id?: string;
        };
      };
      customization_options: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          additional_price: number;
          is_available: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          additional_price?: number;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          additional_price?: number;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_code: string;
          customer_id: string | null;
          customer_name: string;
          phone: string;
          delivery_address: string;
          status: OrderStatus;
          subtotal: number;
          discount_amount: number;
          delivery_fee: number;
          total_amount: number;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          estimated_delivery_time: string;
          assigned_rider_id: string | null;
          special_instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_code: string;
          customer_id?: string | null;
          customer_name: string;
          phone: string;
          delivery_address: string;
          status?: OrderStatus;
          subtotal: number;
          discount_amount?: number;
          delivery_fee?: number;
          total_amount: number;
          payment_method: PaymentMethod;
          payment_status?: PaymentStatus;
          estimated_delivery_time?: string;
          assigned_rider_id?: string | null;
          special_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_code?: string;
          customer_id?: string | null;
          customer_name?: string;
          phone?: string;
          delivery_address?: string;
          status?: OrderStatus;
          subtotal?: number;
          discount_amount?: number;
          delivery_fee?: number;
          total_amount?: number;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          estimated_delivery_time?: string;
          assigned_rider_id?: string | null;
          special_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          item_name: string;
          unit_price: number;
          quantity: number;
          total_price: number;
          customizations: Json | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          item_name: string;
          unit_price: number;
          quantity?: number;
          total_price: number;
          customizations?: Json | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string | null;
          item_name?: string;
          unit_price?: number;
          quantity?: number;
          total_price?: number;
          customizations?: Json | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          status: OrderStatus;
          changed_by_staff_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: OrderStatus;
          changed_by_staff_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: OrderStatus;
          changed_by_staff_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          payment_reference: string;
          payment_gateway: string;
          amount: number;
          currency: string;
          status: string;
          gateway_response: Json | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_reference: string;
          payment_gateway?: string;
          amount: number;
          currency?: string;
          status?: string;
          gateway_response?: Json | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          payment_reference?: string;
          payment_gateway?: string;
          amount?: number;
          currency?: string;
          status?: string;
          gateway_response?: Json | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: StaffRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // Must match auth.users.id
          email: string;
          full_name: string;
          role?: StaffRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: StaffRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      riders: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          vehicle_type: string | null;
          rating: number;
          is_active: boolean;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          vehicle_type?: string | null;
          rating?: number;
          is_active?: boolean;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          vehicle_type?: string | null;
          rating?: number;
          is_active?: boolean;
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      promotions: {
        Row: {
          id: string;
          code: string;
          description: string;
          discount_type: DiscountType;
          discount_value: number;
          minimum_order_amount: number;
          is_active: boolean;
          starts_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description: string;
          discount_type: DiscountType;
          discount_value: number;
          minimum_order_amount?: number;
          is_active?: boolean;
          starts_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string;
          discount_type?: DiscountType;
          discount_value?: number;
          minimum_order_amount?: number;
          is_active?: boolean;
          starts_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      restaurant_settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          order_id: string | null;
          menu_item_id: string;
          customer_name: string;
          rating: number;
          comment: string | null;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          menu_item_id: string;
          customer_name: string;
          rating: number;
          comment?: string | null;
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          menu_item_id?: string;
          customer_name?: string;
          rating?: number;
          comment?: string | null;
          is_published?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      staff_role: StaffRole;
      discount_type: DiscountType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
