/* eslint-disable @next/next/no-img-element -- Supabase-Storage-URLs, kein next/image-Loader nötig */

/**
 * Kontakt-Avatar: Foto, sonst farbiger Anfangsbuchstabe. Farbe wird stabil aus
 * dem Namen abgeleitet, damit dieselbe Person überall gleich aussieht.
 */

const FARBEN = [
  "bg-rose-900 text-rose-200",
  "bg-amber-900 text-amber-200",
  "bg-emerald-900 text-emerald-200",
  "bg-sky-900 text-sky-200",
  "bg-violet-900 text-violet-200",
  "bg-fuchsia-900 text-fuchsia-200",
  "bg-teal-900 text-teal-200",
]

function farbe(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return FARBEN[h % FARBEN.length]
}

const GROESSEN = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-xl",
} as const

export function Avatar({
  name,
  url,
  size = "md",
  className = "",
}: {
  name: string
  url?: string | null
  size?: keyof typeof GROESSEN
  className?: string
}) {
  const base = `${GROESSEN[size]} shrink-0 rounded-full ${className}`
  if (url) {
    return <img src={url} alt="" className={`${base} object-cover`} loading="lazy" />
  }
  return (
    <span className={`${base} flex items-center justify-center font-semibold ${farbe(name)}`}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  )
}
