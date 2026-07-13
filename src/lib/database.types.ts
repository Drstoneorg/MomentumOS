export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          cost_usd: number
          created_at: string
          feature: string
          id: string
          images: number
          model: string
          provider: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          images?: number
          model: string
          provider: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          images?: number
          model?: string
          provider?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: []
      }
      asset_sends: {
        Row: {
          asset_id: string
          channel: string
          contact_id: string | null
          id: string
          note: string | null
          sent_at: string
        }
        Insert: {
          asset_id: string
          channel: string
          contact_id?: string | null
          id?: string
          note?: string | null
          sent_at?: string
        }
        Update: {
          asset_id?: string
          channel?: string
          contact_id?: string | null
          id?: string
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
          {
            foreignKeyName: "asset_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_offers: {
        Row: {
          booking_id: string
          created_at: string
          distance_km: number | null
          expires_at: string
          id: string
          provider_id: string
          status: Database["public"]["Enums"]["offer_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          distance_km?: number | null
          expires_at: string
          id?: string
          provider_id: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          distance_km?: number | null
          expires_at?: string
          id?: string
          provider_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
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
      bookings: {
        Row: {
          accepted_at: string | null
          address: string
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string
          customer_note: string | null
          duration_min: number
          id: string
          location: unknown
          payment_intent_id: string | null
          payment_status: string
          price_cents: number
          provider_id: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          travel_fee_cents: number
          treatment_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          address: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_note?: string | null
          duration_min?: number
          id?: string
          location?: unknown
          payment_intent_id?: string | null
          payment_status?: string
          price_cents?: number
          provider_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          travel_fee_cents?: number
          treatment_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_note?: string | null
          duration_min?: number
          id?: string
          location?: unknown
          payment_intent_id?: string | null
          payment_status?: string
          price_cents?: number
          provider_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          travel_fee_cents?: number
          treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          style_notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name: string
          style_notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          style_notes?: string | null
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
          intent: string
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
          realm: string
          relationship_tags: string[]
          tone_offset: string | null
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
          intent?: string
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
          realm?: string
          relationship_tags?: string[]
          tone_offset?: string | null
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
          intent?: string
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
          realm?: string
          relationship_tags?: string[]
          tone_offset?: string | null
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
          promo_code: string | null
          status: Database["public"]["Enums"]["event_invite_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          invite_text?: string | null
          promo_code?: string | null
          status?: Database["public"]["Enums"]["event_invite_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          invite_text?: string | null
          promo_code?: string | null
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
      job_applications: {
        Row: {
          applied_at: string | null
          city: string
          company: string
          contact_email: string | null
          contact_name: string | null
          cover_letter: string | null
          created_at: string
          description: string | null
          id: string
          interview_prep: Json | null
          match_reasons: Json | null
          match_score: number | null
          next_action: string | null
          notes: string | null
          portal: string | null
          requirements: string[]
          salary: string | null
          stage: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          applied_at?: string | null
          city?: string
          company: string
          contact_email?: string | null
          contact_name?: string | null
          cover_letter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interview_prep?: Json | null
          match_reasons?: Json | null
          match_score?: number | null
          next_action?: string | null
          notes?: string | null
          portal?: string | null
          requirements?: string[]
          salary?: string | null
          stage?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          applied_at?: string | null
          city?: string
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          cover_letter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interview_prep?: Json | null
          match_reasons?: Json | null
          match_score?: number | null
          next_action?: string | null
          notes?: string | null
          portal?: string | null
          requirements?: string[]
          salary?: string | null
          stage?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "moment_assets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "occasions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_trades: {
        Row: {
          amount_eur: number
          eurusd: number
          id: string
          is_benchmark: boolean
          label: string
          price_usd: number
          symbol: string
          thesis: string | null
          traded_at: string
          units: number
        }
        Insert: {
          amount_eur: number
          eurusd: number
          id?: string
          is_benchmark?: boolean
          label: string
          price_usd: number
          symbol: string
          thesis?: string | null
          traded_at?: string
          units: number
        }
        Update: {
          amount_eur?: number
          eurusd?: number
          id?: string
          is_benchmark?: boolean
          label?: string
          price_usd?: number
          symbol?: string
          thesis?: string | null
          traded_at?: string
          units?: number
        }
        Relationships: []
      }
      providers: {
        Row: {
          avatar_url: string | null
          base_location: unknown
          bio: string | null
          created_at: string
          current_location: unknown
          id: string
          is_online: boolean
          last_seen: string | null
          name: string
          rating_avg: number
          rating_count: number
          service_radius_km: number
          skills: string[]
        }
        Insert: {
          avatar_url?: string | null
          base_location?: unknown
          bio?: string | null
          created_at?: string
          current_location?: unknown
          id?: string
          is_online?: boolean
          last_seen?: string | null
          name: string
          rating_avg?: number
          rating_count?: number
          service_radius_km?: number
          skills?: string[]
        }
        Update: {
          avatar_url?: string | null
          base_location?: unknown
          bio?: string | null
          created_at?: string
          current_location?: unknown
          id?: string
          is_online?: boolean
          last_seen?: string | null
          name?: string
          rating_avg?: number
          rating_count?: number
          service_radius_km?: number
          skills?: string[]
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      reply_feedback: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string
          id: string
          rating: number
          source: string
          style: string | null
        }
        Insert: {
          contact_id?: string | null
          content: string
          created_at?: string
          id?: string
          rating: number
          source?: string
          style?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string
          id?: string
          rating?: number
          source?: string
          style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_feedback_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author: string
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          provider_id: string | null
          rating: number
        }
        Insert: {
          author?: string
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          rating: number
        }
        Update: {
          author?: string
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          auto_send_at: string | null
          channel: string
          chosen_variant: string | null
          contact_id: string
          created_at: string
          id: string
          image_url: string | null
          replied_at: string | null
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
          created_at?: string
          id?: string
          image_url?: string | null
          replied_at?: string | null
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
          created_at?: string
          id?: string
          image_url?: string | null
          replied_at?: string | null
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
      trading_digests: {
        Row: {
          created_at: string
          day: string
          digest: string
          id: string
          picks: Json | null
        }
        Insert: {
          created_at?: string
          day: string
          digest: string
          id?: string
          picks?: Json | null
        }
        Update: {
          created_at?: string
          day?: string
          digest?: string
          id?: string
          picks?: Json | null
        }
        Relationships: []
      }
      treatments: {
        Row: {
          active: boolean
          base_price_cents: number
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          base_price_cents?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          base_price_cents?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_offer: {
        Args: { p_offer: string; p_travel_fee_cents?: number }
        Returns: boolean
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      booking_geo: {
        Args: { p_booking: string }
        Returns: {
          b_lat: number
          b_lng: number
          distance_km: number
          p_lat: number
          p_lng: number
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      nearby_providers: {
        Args: { p_lat: number; p_limit?: number; p_lng: number }
        Returns: {
          distance_km: number
          id: string
          name: string
          rating_avg: number
          rating_count: number
        }[]
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      provider_distance_km: {
        Args: { p_lat: number; p_lng: number; p_provider: string }
        Returns: number
      }
      set_booking_location: {
        Args: { p_booking: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      set_provider_location: {
        Args: { p_lat: number; p_lng: number; p_provider: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_review: {
        Args: { p_booking: string; p_comment?: string; p_rating: number }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      asset_kind: "image_prompt" | "image" | "text" | "collage" | "card"
      booking_status:
        | "requested"
        | "accepted"
        | "en_route"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
      date_status: "proposed" | "confirmed"
      event_invite_status: "invited" | "yes" | "no" | "no_reply" | "ticket" | "attended"
      meetup_status:
        | "idea"
        | "proposed"
        | "confirmed"
        | "happened"
        | "cancelled"
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
      offer_status: "offered" | "accepted" | "declined" | "expired"
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
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_kind: ["image_prompt", "image", "text", "collage", "card"],
      booking_status: [
        "requested",
        "accepted",
        "en_route",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      date_status: ["proposed", "confirmed"],
      event_invite_status: ["invited", "yes", "no", "no_reply", "ticket", "attended"],
      meetup_status: ["idea", "proposed", "confirmed", "happened", "cancelled"],
      memory_kind: [
        "likes",
        "dislikes",
        "fact",
        "open_question",
        "boundary",
        "topic_works",
      ],
      msg_direction: ["in", "out"],
      msg_source: ["manual", "telegram", "import"],
      occasion_kind: ["birthday", "anniversary", "custom"],
      offer_status: ["offered", "accepted", "declined", "expired"],
      pipeline_stage: [
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
      ],
      priority_level: ["low", "normal", "high"],
      suggestion_status: ["draft", "approved", "sent", "discarded"],
    },
  },
} as const

// ---------- Manuelle Zusätze (Labels/Konstanten) — bei Types-Regeneration unten wieder anhängen ----------
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
  ticket: "🎟 Ticket gekauft",
  attended: "✔ War da",
}

// Kontakt-Intent: wozu pflege ich diesen Kontakt (nur MatchOS-Realm relevant)
export const INTENT_LABELS: Record<string, string> = {
  date: "💘 Date",
  event_lead: "🎟 Event-Lead",
  both: "💘🎟 Beides",
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
