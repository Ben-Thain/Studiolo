export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          notification_email: string | null;
          trial_started_at: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          notification_email?: string | null;
          trial_started_at?: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          notification_email?: string | null;
          trial_started_at?: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reserved_slugs: {
        Row: {
          slug: string;
        };
        Insert: {
          slug: string;
        };
        Update: {
          slug?: string;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          slug_locked_at: string | null;
          draft_revision: number;
          draft_updated_at: string;
          live_publish_id: string | null;
          first_published_at: string | null;
          last_published_at: string | null;
          password_enabled: boolean;
          password_hash: string | null;
          gate_version: number;
          seo_title: string | null;
          seo_description: string | null;
          og_asset_id: string | null;
          favicon_asset_id: string | null;
          desktop_layout_seen_at: string | null;
          mobile_layout_seen_at: string | null;
          deleted_at: string | null;
          purge_after: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          slug_locked_at?: string | null;
          draft_revision?: number;
          draft_updated_at?: string;
          live_publish_id?: string | null;
          first_published_at?: string | null;
          last_published_at?: string | null;
          password_enabled?: boolean;
          password_hash?: string | null;
          gate_version?: number;
          seo_title?: string | null;
          seo_description?: string | null;
          og_asset_id?: string | null;
          favicon_asset_id?: string | null;
          desktop_layout_seen_at?: string | null;
          mobile_layout_seen_at?: string | null;
          deleted_at?: string | null;
          purge_after?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          slug_locked_at?: string | null;
          draft_revision?: number;
          draft_updated_at?: string;
          live_publish_id?: string | null;
          first_published_at?: string | null;
          last_published_at?: string | null;
          password_enabled?: boolean;
          password_hash?: string | null;
          gate_version?: number;
          seo_title?: string | null;
          seo_description?: string | null;
          og_asset_id?: string | null;
          favicon_asset_id?: string | null;
          desktop_layout_seen_at?: string | null;
          mobile_layout_seen_at?: string | null;
          deleted_at?: string | null;
          purge_after?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_live_publish_id_fkey";
            columns: ["live_publish_id"];
            isOneToOne: false;
            referencedRelation: "site_publishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_og_asset_id_fkey";
            columns: ["og_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sites_favicon_asset_id_fkey";
            columns: ["favicon_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      site_publishes: {
        Row: {
          id: string;
          site_id: string;
          snapshot: Json;
          published_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          snapshot: Json;
          published_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          snapshot?: Json;
          published_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_publishes_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_publishes_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          site_id: string;
          path: string;
          width: number | null;
          height: number | null;
          mime: string;
          bytes: number;
          blur_data_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          path: string;
          width?: number | null;
          height?: number | null;
          mime: string;
          bytes: number;
          blur_data_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          path?: string;
          width?: number | null;
          height?: number | null;
          mime?: string;
          bytes?: number;
          blur_data_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          id: string;
          site_id: string;
          title: string;
          slug: string;
          sort_order: number;
          in_nav: boolean;
          is_home: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          title: string;
          slug: string;
          sort_order: number;
          in_nav?: boolean;
          is_home?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          title?: string;
          slug?: string;
          sort_order?: number;
          in_nav?: boolean;
          is_home?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pages_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sections: {
        Row: {
          id: string;
          site_id: string;
          page_id: string | null;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          page_id?: string | null;
          name: string;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          page_id?: string | null;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sections_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sections_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      elements: {
        Row: {
          id: string;
          site_id: string;
          page_id: string | null;
          section_id: string;
          type: string;
          name: string;
          content: Json;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          page_id?: string | null;
          section_id: string;
          type: string;
          name: string;
          content: Json;
          sort_order: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          page_id?: string | null;
          section_id?: string;
          type?: string;
          name?: string;
          content?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "elements_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "elements_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "elements_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
        ];
      };
      element_layouts: {
        Row: {
          id: string;
          element_id: string;
          breakpoint: string;
          col_start: number;
          col_span: number;
          row_start: number;
          row_span: number;
          hidden: boolean;
          placement_source: string;
        };
        Insert: {
          id?: string;
          element_id: string;
          breakpoint: string;
          col_start: number;
          col_span: number;
          row_start: number;
          row_span: number;
          hidden?: boolean;
          placement_source?: string;
        };
        Update: {
          id?: string;
          element_id?: string;
          breakpoint?: string;
          col_start?: number;
          col_span?: number;
          row_start?: number;
          row_span?: number;
          hidden?: boolean;
          placement_source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "element_layouts_element_id_fkey";
            columns: ["element_id"];
            isOneToOne: false;
            referencedRelation: "elements";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          id: string;
          site_id: string;
          page_id: string | null;
          name: string;
          email: string;
          message: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          page_id?: string | null;
          name: string;
          email: string;
          message: string;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          page_id?: string | null;
          name?: string;
          email?: string;
          message?: string;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      page_views_daily: {
        Row: {
          site_id: string;
          day: string;
          views: number;
        };
        Insert: {
          site_id: string;
          day: string;
          views?: number;
        };
        Update: {
          site_id?: string;
          day?: string;
          views?: number;
        };
        Relationships: [
          {
            foreignKeyName: "page_views_daily_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          bucket: string;
          window_start: string;
          count: number;
        };
        Insert: {
          bucket: string;
          window_start: string;
          count?: number;
        };
        Update: {
          bucket?: string;
          window_start?: string;
          count?: number;
        };
        Relationships: [];
      };
      domains: {
        Row: {
          id: string;
          site_id: string;
          hostname: string;
          alias_hostname: string | null;
          status: string;
          verification: Json | null;
          dns_records: Json | null;
          misconfigured: boolean | null;
          error_code: string | null;
          error_message: string | null;
          last_checked_at: string | null;
          verified_at: string | null;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          hostname: string;
          alias_hostname?: string | null;
          status?: string;
          verification?: Json | null;
          dns_records?: Json | null;
          misconfigured?: boolean | null;
          error_code?: string | null;
          error_message?: string | null;
          last_checked_at?: string | null;
          verified_at?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          hostname?: string;
          alias_hostname?: string | null;
          status?: string;
          verification?: Json | null;
          dns_records?: Json | null;
          misconfigured?: boolean | null;
          error_code?: string | null;
          error_message?: string | null;
          last_checked_at?: string | null;
          verified_at?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "domains_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: true;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      slug_is_free: {
        Args: {
          s: string;
          for_owner: string;
        };
        Returns: boolean;
      };
      is_site_owner: {
        Args: {
          site: string;
        };
        Returns: boolean;
      };
      is_site_public: {
        Args: {
          site: string;
        };
        Returns: boolean;
      };
      increment_page_views: {
        Args: {
          site: string;
          d: string;
        };
        Returns: undefined;
      };
      resolve_host: {
        Args: {
          h: string;
        };
        Returns: {
          site_id: string;
          slug: string;
          password_enabled: boolean;
          gate_version: number;
          canonical_host: string | null;
        }[];
      };
      rate_limit_hit: {
        Args: {
          b: string;
          window_seconds: number;
          max: number;
        };
        Returns: boolean;
      };
      restore_site: {
        Args: {
          p_site: string;
          p_owner: string;
        };
        Returns: {
          slug: string;
          slug_changed: boolean;
        }[];
      };
      save_draft: {
        Args: {
          site: string;
          expected_revision: number;
          changes: Json;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export const SITE_ROW_KEYS = [
  "id",
  "owner_id",
  "name",
  "slug",
  "slug_locked_at",
  "draft_revision",
  "draft_updated_at",
  "live_publish_id",
  "first_published_at",
  "last_published_at",
  "password_enabled",
  "password_hash",
  "gate_version",
  "seo_title",
  "seo_description",
  "og_asset_id",
  "favicon_asset_id",
  "desktop_layout_seen_at",
  "mobile_layout_seen_at",
  "deleted_at",
  "purge_after",
  "created_at",
  "updated_at",
] as const satisfies readonly (keyof Database["public"]["Tables"]["sites"]["Row"])[];
