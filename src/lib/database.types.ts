export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contact_channels: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          handle: string
          id: string
          is_primary: boolean
        }
        Insert: {
          channel: string
          contact_id: string
          created_at?: string
          handle: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          handle?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          age: number | null
          bio: string | null
          created_at: string
          date_idea: string | null
          id: string
          interests: string[] | null
          language: string | null
          location: string | null
          name: string
          next_step: string | null
          notes: string | null
          personality: Json | null
          photo_notes: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          platform: string
          priority: Database["public"]["Enums"]["priority_level"]
          updated_at: string
        }
        Insert: {
          age?: number | null
          bio?: string | null
          created_at?: string
          date_idea?: string | null
          id?: string
          interests?: string[] | null
          language?: string | null
          location?: string | null
          name: string
          next_step?: string | null
          notes?: string | null
          personality?: Json | null
          photo_notes?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          platform?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          updated_at?: string
        }
        Update: {
          age?: number | null
          bio?: string | null
          created_at?: string
          date_idea?: string | null
          id?: string
          interests?: string[] | null
          language?: string | null
          location?: string | null
          name?: string
          next_step?: string | null
          notes?: string | null
          personality?: Json | null
          photo_notes?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          platform?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          updated_at?: string
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          contact_id: string
          generated_at: string
          id: string
          summary: string
        }
        Insert: {
          contact_id: string
          generated_at?: string
          id?: string
          summary: string
        }
        Update: {
          contact_id?: string
          generated_at?: string
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dates: {
        Row: {
          contact_id: string
          created_at: string
          ics_generated: boolean
          id: string
          idea: string | null
          notes: string | null
          place: string | null
          starts_at: string
          status: Database["public"]["Enums"]["date_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          ics_generated?: boolean
          id?: string
          idea?: string | null
          notes?: string | null
          place?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["date_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          ics_generated?: boolean
          id?: string
          idea?: string | null
          notes?: string | null
          place?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["date_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dates_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          contact_id: string
          created_at: string
          done: boolean
          due_at: string
          id: string
          reason: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          done?: boolean
          due_at: string
          id?: string
          reason?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          done?: boolean
          due_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["memory_kind"]
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["memory_kind"]
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "memories_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          contact_id: string
          content: string
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id: string
          sent_at: string
          source: Database["public"]["Enums"]["msg_source"]
        }
        Insert: {
          channel?: string
          contact_id: string
          content: string
          created_at?: string
          direction: Database["public"]["Enums"]["msg_direction"]
          id?: string
          sent_at?: string
          source?: Database["public"]["Enums"]["msg_source"]
        }
        Update: {
          channel?: string
          contact_id?: string
          content?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          id?: string
          sent_at?: string
          source?: Database["public"]["Enums"]["msg_source"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          channel: string
          chosen_variant: string | null
          contact_id: string
          created_at: string
          id: string
          sent_at: string | null
          situation: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          variants: Json
        }
        Insert: {
          channel?: string
          chosen_variant?: string | null
          contact_id: string
          created_at?: string
          id?: string
          sent_at?: string | null
          situation?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          variants?: Json
        }
        Update: {
          channel?: string
          chosen_variant?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          sent_at?: string | null
          situation?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      date_status: "proposed" | "confirmed"
      memory_kind:
        | "likes"
        | "dislikes"
        | "fact"
        | "open_question"
        | "boundary"
        | "topic_works"
      msg_direction: "in" | "out"
      msg_source: "manual" | "telegram" | "import"
      pipeline_stage:
        | "new_match"
        | "first_message_pending"
        | "chatting"
        | "interest_visible"
        | "platform_switch"
        | "on_messenger"
        | "date_idea"
        | "date_proposed"
        | "scheduling"
        | "date_planned"
        | "calendar_created"
        | "archived"
      priority_level: "low" | "normal" | "high"
      suggestion_status: "draft" | "approved" | "sent" | "discarded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export const PIPELINE_STAGES: Enums<"pipeline_stage">[] = [
  "new_match",
  "first_message_pending",
  "chatting",
  "interest_visible",
  "platform_switch",
  "on_messenger",
  "date_idea",
  "date_proposed",
  "scheduling",
  "date_planned",
  "calendar_created",
  "archived",
]

export const STAGE_LABELS: Record<Enums<"pipeline_stage">, string> = {
  new_match: "Neues Match",
  first_message_pending: "Erste Nachricht offen",
  chatting: "Gespräch läuft",
  interest_visible: "Interesse erkennbar",
  platform_switch: "Plattformwechsel",
  on_messenger: "Auf Messenger",
  date_idea: "Date-Idee möglich",
  date_proposed: "Date vorgeschlagen",
  scheduling: "Termin-Abstimmung",
  date_planned: "Date geplant",
  calendar_created: "Kalender erstellt",
  archived: "Archiviert",
}
