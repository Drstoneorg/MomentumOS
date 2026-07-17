/**
 * TCG-Karte als CSS-Overlay: Artwork kommt aus der Bild-Generierung (ohne Text),
 * Rahmen + alle Texte rendert der Browser — gestochen scharf, Text jederzeit
 * änderbar ohne neues Bild, Bild-Generierung wird günstiger (nur Artwork).
 */
type CardDetails = {
  title?: string
  type_line?: string
  element?: string
  rarity?: string
  attack?: number
  defense?: number
  effect?: string
  flavor?: string
}

// Element → Akzentfarbe des Rahmens (deutsch + englisch abgedeckt, sonst Violett)
const ELEMENT_ACCENT: Record<string, string> = {
  feuer: "#dc2626", fire: "#dc2626",
  wasser: "#2563eb", water: "#2563eb",
  erde: "#a16207", earth: "#a16207",
  luft: "#0891b2", wind: "#0891b2", air: "#0891b2",
  licht: "#ca8a04", light: "#ca8a04",
  schatten: "#6d28d9", dunkel: "#6d28d9", dark: "#6d28d9", shadow: "#6d28d9",
  natur: "#16a34a", nature: "#16a34a", pflanze: "#16a34a",
  blitz: "#d97706", lightning: "#d97706",
  eis: "#0ea5e9", ice: "#0ea5e9",
}

export function CardFrame({ imageUrl, card }: { imageUrl: string | null; card: CardDetails }) {
  const accent =
    ELEMENT_ACCENT[(card.element ?? "").toLowerCase().trim()] ?? "#7c3aed"

  return (
    <div
      className="mx-auto w-full max-w-72 overflow-hidden rounded-xl border-2 p-2"
      style={{ borderColor: accent, background: `linear-gradient(160deg, ${accent}22, #09090b 60%)` }}
    >
      {/* Titelzeile */}
      <div
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1"
        style={{ backgroundColor: `${accent}33` }}
      >
        <span className="truncate text-sm font-bold text-white">{card.title ?? "Karte"}</span>
        {card.element && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            {card.element}
          </span>
        )}
      </div>

      {/* Artwork */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={card.title ?? "Karten-Artwork"}
          className="mt-2 aspect-square w-full rounded-lg border object-cover"
          style={{ borderColor: `${accent}66` }}
        />
      ) : (
        <div
          className="mt-2 flex aspect-square w-full items-center justify-center rounded-lg border text-3xl"
          style={{ borderColor: `${accent}66` }}
        >
          🃏
        </div>
      )}

      {/* Typ + Seltenheit */}
      <p className="mt-1.5 px-1 text-[11px] text-zinc-400">
        {card.type_line ?? ""}
        {card.rarity ? ` · ${card.rarity}` : ""}
      </p>

      {/* Effekt-Box */}
      {(card.effect || card.flavor) && (
        <div className="mt-1 space-y-1 rounded-lg bg-zinc-950/80 p-2">
          {card.effect && <p className="text-[11px] leading-snug text-zinc-200">{card.effect}</p>}
          {card.flavor && <p className="text-[10px] italic leading-snug text-zinc-500">{card.flavor}</p>}
        </div>
      )}

      {/* Werte */}
      {(card.attack != null || card.defense != null) && (
        <div className="mt-1.5 flex justify-between px-1 text-xs font-semibold">
          <span className="text-rose-300">⚔ {card.attack ?? "?"}</span>
          <span className="text-sky-300">🛡 {card.defense ?? "?"}</span>
        </div>
      )}
    </div>
  )
}
