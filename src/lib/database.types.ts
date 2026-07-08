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
          auto_mode: boolean
          bio: string | null
          birthday: string | null
          contact_frequency_days: number | null
          created_at: string
          date_idea: string | null
          external_id: string | null
          id: string
          interests: string[] | null
          language: string | null
          last_contact_at: string | null
          last_contact_initiator: string | null
          location: string | null
          name: string
          next_step: string | null
          notes: string | null
          personality: Json | null
          photo_notes: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          platform: string
          priority: Database["public"]["Enums"]["priority_level"]
          relationship_tags: string[]
          updated_at: string
        }
        Insert: {
          age?: number | null
          auto_mode?: boolean
          bio?: string | null
          birthday?: string | null
          contact_frequency_days?: number | null
          created_at?: string
          date_idea?: string | null
          external_id?: string | null
          id?: string
          interests?: string[] | null
          language?: string | null
          last_contact_at?: string | null
          last_contact_initiator?: string | null
          location?: string | null
          name: string
          next_step?: string | null
          notes?: string | null
          personality?: Json | null
          photo_notes?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          platform?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          relationship_tags?: string[]
          updated_at?: string
        }
        Update: {
          age?: number | null
          auto_mode?: boolean
          bio?: string | null
          birthday?: string | null
          contact_frequency_days?: number | null
          created_at?: string
          date_idea?: string | null
          external_id?: string | null
          id?: string
          interests?: string[] | null
          language?: string | null
          last_contact_at?: string | null
          last_contact_initiator?: string | null
          location?: string | null
          name?: string
          next_step?: string | null
          notes?: string | null
          personality?: Json | null
          photo_notes?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          platform?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          relationship_tags?: string[]
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
      event_invites: {
        Row: {
          contact_id: string
          created_at: string
          event_id: string
          id: string
          invite_text: string | null
          status: Database["public"]["Enums"]["event_invite_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          invite_text?: string | null
          status?: Database["public"]["Enums"]["event_invite_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          invite_text?: string | null
          status?: Database["public"]["Enums"]["event_invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          image_prompt: string | null
          location: string | null
          starts_at: string | null
          title: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_prompt?: string | null
          location?: string | null
          starts_at?: string | null
          title: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_prompt?: string | null
          location?: string | null
          starts_at?: string | null
          title?: string
        }
        Relationships: []
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
      meetup_participants: {
        Row: {
          contact_id: string
          id: string
          meetup_id: string
          rsvp: Database["public"]["Enums"]["event_invite_status"]
        }
        Insert: {
          contact_id: string
          id?: string
          meetup_id: string
          rsvp?: Database["public"]["Enums"]["event_invite_status"]
        }
        Update: {
          contact_id?: string
          id?: string
          meetup_id?: string
          rsvp?: Database["public"]["Enums"]["event_invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meetup_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_participants_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          chosen_slot: number | null
          created_at: string
          id: string
          notes: string | null
          recap: string | null
          slots: Json
          status: Database["public"]["Enums"]["meetup_status"]
          title: string
        }
        Insert: {
          chosen_slot?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recap?: string | null
          slots?: Json
          status?: Database["public"]["Enums"]["meetup_status"]
          title: string
        }
        Update: {
          chosen_slot?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recap?: string | null
          slots?: Json
          status?: Database["public"]["Enums"]["meetup_status"]
          title?: string
        }
        Relationships: []
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
      moment_assets: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          meta: Json
          title: string | null
        }
        Insert: {
          contact_id?: string | null
          content: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          meta?: Json
          title?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          meta?: Json
          title?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      occasions: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["occasion_kind"]
          label: string
          on_date: string
          recurring: boolean
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["occasion_kind"]
          label: string
          on_date: string
          recurring?: boolean
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["occasion_kind"]
          label?: string
          on_date?: string
          recurring?: boolean
        }
        Relationships: []
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
          auto_send_at: string | null
          channel: string
          image_url: string | null
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
          auto_send_at?: string | null
          channel?: string
          chosen_variant?: string | null
          contact_id: string
          image_url?: string | null
          created_at?: string
          id?: string
          sent_at?: string | null
          situation?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          variants?: Json
        }
        Update: {
          auto_send_at?: string | null
          channel?: string
          chosen_variant?: string | null
          contact_id?: string
          image_url?: string | null
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
      asset_kind: "image_prompt" | "image" | "text" | "collage"
      date_status: "proposed" | "confirmed"
      event_invite_status: "invited" | "yes" | "no" | "no_reply"
      meetup_status: "idea" | "proposed" | "confirmed" | "happened" | "cancelled"
      memory_kind:
        | "likes"
        | "dislikes"
        | "fact"
        | "open_question"
        | "boundary"
        | "topic_works"
      msg_direction: "in" | "out"
      msg_source: "manual" | "telegram" | "import"
      occasion_kind: "birthday" | "anniversary" | "custom"
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

export const MEETUP_STATUS_LABELS: Record<Enums<"meetup_status">, string> = {
  idea: "Idee",
  proposed: "Vorgeschlagen",
  confirmed: "Bestätigt",
  happened: "Stattgefunden",
  cancelled: "Abgesagt",
}

export const RSVP_LABELS: Record<Enums<"event_invite_status">, string> = {
  invited: "Eingeladen",
  yes: "Zugesagt",
  no: "Abgesagt",
  no_reply: "Keine Antwort",
}
