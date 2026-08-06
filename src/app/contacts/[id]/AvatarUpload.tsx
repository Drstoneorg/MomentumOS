"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { uploadContactAvatar, removeContactAvatar } from "@/lib/actions"
import { downscale, istBild } from "@/lib/imageResize"
import { Avatar } from "@/components/Avatar"

/**
 * Avatar auf der Kontaktseite: Klick öffnet die Bildwahl, das Bild wird im
 * Browser auf 512px verkleinert (Handy-Fotos!) und als JPEG hochgeladen.
 */
export function AvatarUpload({
  contactId,
  name,
  url,
}: {
  contactId: string
  name: string
  url: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  function gewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!istBild(file)) {
      setFehler("Das ist kein Bild")
      return
    }
    setFehler(null)
    start(async () => {
      try {
        const dataUrl = await downscale(file, 512)
        await uploadContactAvatar(contactId, dataUrl)
        router.refresh()
      } catch (err) {
        setFehler(err instanceof Error ? err.message : "Upload fehlgeschlagen")
      }
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={`group relative block rounded-full ${pending ? "opacity-50" : ""}`}
        title={url ? "Foto ersetzen" : "Foto hinzufügen"}
      >
        <Avatar name={name} url={url} size="lg" />
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-lg group-hover:flex">
          📷
        </span>
      </button>
      {url && (
        <button
          type="button"
          onClick={() =>
            start(async () => {
              await removeContactAvatar(contactId)
              router.refresh()
            })
          }
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-400 hover:text-red-400"
          title="Foto entfernen"
        >
          ✕
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={gewaehlt} />
      {fehler && <p className="mt-1 max-w-[8rem] text-[10px] text-red-400">{fehler}</p>}
    </div>
  )
}
