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
