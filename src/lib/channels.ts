/**
 * Kanal-Registry: was pro Kommunikationsplattform technisch geht.
 * deepLink: öffnet den Chat, wenn möglich mit vorbefüllter Nachricht — Senden bleibt beim Nutzer.
 */
export type ChannelInfo = {
  id: string
  label: string
  prefill: boolean
  auto: boolean // automatisches Senden via Worker möglich (nur nach Queue-Freigabe)
  deepLink: (handle: string, text?: string) => string | null
  hint?: string
}

const clean = (h: string) => h.replace(/^@/, "").trim()
const phone = (h: string) => h.replace(/[^\d+]/g, "").replace(/^\+/, "")

export const CHANNELS: Record<string, ChannelInfo> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    prefill: false,
    auto: true,
    deepLink: (h) => `https://t.me/${clean(h)}`,
    hint: "Automatisches Senden über Worker nach Queue-Freigabe.",
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    prefill: true,
    auto: false,
    deepLink: (h, text) =>
      `https://wa.me/${phone(h)}${text ? `?text=${encodeURIComponent(text)}` : ""}`,
    hint: "Deep-Link öffnet Chat mit vorbefüllter Nachricht — nur noch auf Senden tippen.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    prefill: false,
    auto: false,
    deepLink: (h) => `https://ig.me/m/${clean(h)}`,
    hint: "Kein Prefill möglich — Nachricht kopieren, Link öffnet den DM-Chat.",
  },
  wechat: {
    id: "wechat",
    label: "WeChat",
    prefill: false,
    auto: false,
    deepLink: () => null,
    hint: "Kein Web-Deep-Link — Nachricht kopieren und in WeChat einfügen.",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    prefill: false,
    auto: false,
    deepLink: (h) => `https://www.tiktok.com/@${clean(h)}`,
    hint: "Öffnet Profil — DM manuell, Nachricht kopieren.",
  },
  snapchat: {
    id: "snapchat",
    label: "Snapchat",
    prefill: false,
    auto: false,
    deepLink: (h) => `https://www.snapchat.com/add/${clean(h)}`,
    hint: "Öffnet Add-Seite — Nachricht kopieren.",
  },
  line: {
    id: "line",
    label: "LINE",
    prefill: false,
    auto: false,
    deepLink: (h) => `https://line.me/ti/p/~${clean(h)}`,
    hint: "Öffnet Profil — Nachricht kopieren.",
  },
}

export function channelDeepLink(
  channel: string,
  handle: string,
  text?: string
): { url: string | null; hint: string; label: string } {
  const info = CHANNELS[channel]
  if (!info) return { url: null, hint: "Unbekannter Kanal — kopieren.", label: channel }
  return {
    url: info.deepLink(handle, info.prefill ? text : undefined),
    hint: info.hint ?? "",
    label: info.label,
  }
}
