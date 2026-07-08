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
      ai_usage: {
        Row: {
          id: string
          provider: string
          model: string
          feature: string
          tokens_in: number
          tokens_out: number
          images: number
          cost_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          provider: string
          model: string
          feature?: string
          tokens_in?: number
          tokens_out?: number
          images?: number
          cost_usd?: number
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          model?: string
          feature?: string
          tokens_in?: number
          tokens_out?: number
          images?: number
          cost_usd?: number
          created_at?: string
        }
        Relationships: []
      }
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
      asset_sends: {
        Row: {
          id: string
          asset_id: string
          contact_id: string | null
          channel: string
          note: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          contact_id?: string | null
          channel: string
          note?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          contact_id?: string | null
          channel?: string
          note?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_sends_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "moment_assets"
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
      treatments: {
        Row: {
          id: string
          name: string
          description: string | null
          duration_min: number
          base_price_cents: number
          active: boolean
          sort: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          duration_min?: number
          base_price_cents?: number
          active?: boolean
          sort?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          duration_min?: number
          base_price_cents?: number
          active?: boolean
          sort?: number
          created_at?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          id: string
          name: string
          bio: string | null
          avatar_url: string | null
          skills: string[]
          base_location: unknown | null
          current_location: unknown | null
          service_radius_km: number
          is_online: boolean
          last_seen: string | null
          rating_avg: number
          rating_count: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          bio?: string | null
          avatar_url?: string | null
          skills?: string[]
          service_radius_km?: number
          is_online?: boolean
          last_seen?: string | null
          rating_avg?: number
          rating_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          bio?: string | null
          avatar_url?: string | null
          skills?: string[]
          service_radius_km?: number
          is_online?: boolean
          last_seen?: string | null
          rating_avg?: number
          rating_count?: number
          created_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          treatment_id: string | null
          provider_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          address: string
          location: unknown | null
          scheduled_at: string | null
          duration_min: number
          price_cents: number
          travel_fee_cents: number
          customer_note: string | null
          contact_phone: string | null
          payment_intent_id: string | null
          payment_status: string
          created_at: string
          accepted_at: string | null
          started_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          cancel_reason: string | null
        }
        Insert: {
          id?: string
          treatment_id?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          address: string
          scheduled_at?: string | null
          duration_min?: number
          price_cents?: number
          travel_fee_cents?: number
          customer_note?: string | null
          contact_phone?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          created_at?: string
          accepted_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
        }
        Update: {
          id?: string
          treatment_id?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          address?: string
          scheduled_at?: string | null
          duration_min?: number
          price_cents?: number
          travel_fee_cents?: number
          customer_note?: string | null
          contact_phone?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          created_at?: string
          accepted_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          cancel_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_offers: {
        Row: {
          id: string
          booking_id: string
          provider_id: string
          status: Database["public"]["Enums"]["offer_status"]
          distance_km: number | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          provider_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          distance_km?: number | null
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          provider_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          distance_km?: number | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_offers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_offers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          provider_id: string | null
          author: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          provider_id?: string | null
          author?: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          provider_id?: string | null
          author?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      nearby_providers: {
        Args: { p_lat: number; p_lng: number; p_limit?: number }
        Returns: {
          id: string
          name: string
          rating_avg: number
          rating_count: number
          distance_km: number
        }[]
      }
      set_provider_location: {
        Args: { p_provider: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      provider_distance_km: {
        Args: { p_provider: string; p_lat: number; p_lng: number }
        Returns: number
      }
      set_booking_location: {
        Args: { p_booking: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      accept_offer: {
        Args: { p_offer: string; p_travel_fee_cents?: number }
        Returns: boolean
      }
      submit_review: {
        Args: { p_booking: string; p_rating: number; p_comment?: string }
        Returns: undefined
      }
      booking_geo: {
        Args: { p_booking: string }
        Returns: {
          b_lat: number
          b_lng: number
          p_lat: number
          p_lng: number
          distance_km: number
        }[]
      }
    }
    Enums: {
      asset_kind: "image_prompt" | "image" | "text" | "collage"
      booking_status:
        | "requested"
        | "accepted"
        | "en_route"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
      offer_status: "offered" | "accepted" | "declined" | "expired"
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

export const BOOKING_STATUS_LABELS: Record<Enums<"booking_status">, string> = {
  requested: "Angefragt",
  accepted: "Angenommen",
  en_route: "Auf dem Weg",
  arrived: "Angekommen",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
}

// Reihenfolge der aktiven Status für Fortschrittsanzeige
export const BOOKING_FLOW: Enums<"booking_status">[] = [
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
]

// (BookOS-RPCs manuell ergänzt — nicht in Functions-Block der Row-Typen)
