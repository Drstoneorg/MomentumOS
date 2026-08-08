"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setInviteStatus } from "@/lib/momentsActions"
import { Avatar } from "@/components/Avatar"
import { inputCls } from "@/components/ui"

type Gast = {
  inviteId: string
  contactId: string
  name: string
  avatar_url: string | null
  status: string
  plus_ones: number
  promo_code: string | null
  rsvp_token: string
  companion_names: string | null
}

type PendingCheckin = { inviteId: string; status: "attended" | "yes" }

/** In BarcodeDetector-losen Browsern (Safari iOS < 17, Firefox) fehlt das API. */
type BarcodeDetectorLike = new (opts: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

/**
 * Tür-Modus: fürs Handy am Einlass. Ein Tap hakt den Gast ab (Status attended),
 * nochmal tippen macht es rückgängig. Große Ziele, nichts zum Vertippen.
 * Dazu QR-Scan (Gast zeigt seinen Einladungs-QR), Offline-Warteschlange für
 * den Club-Keller ohne Empfang und der teilbare Türsteher-Link.
 */
export function DoorList({
  eventId,
  gaeste,
  doorToken,
}: {
  eventId: string
  gaeste: Gast[]
  doorToken: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [suche, setSuche] = useState("")
  // Offene Offline-Check-ins vom letzten Besuch direkt beim Start laden
  const [offlineQueue, setOfflineQueue] = useState<PendingCheckin[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(`tuer-queue-${eventId}`)
      return raw ? (JSON.parse(raw) as PendingCheckin[]) : []
    } catch {
      return []
    }
  })
  const [lokalStatus, setLokalStatus] = useState<Record<string, string>>({})
  const [meldung, setMeldung] = useState<string | null>(null)
  const [scanAktiv, setScanAktiv] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const queueKey = `tuer-queue-${eventId}`

  const statusVon = useCallback(
    (g: Gast) => lokalStatus[g.inviteId] ?? g.status,
    [lokalStatus]
  )

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase()
    const liste = n ? gaeste.filter((g) => g.name.toLowerCase().includes(n)) : gaeste
    return [...liste].sort(
      (a, b) =>
        (statusVon(a) === "attended" ? 1 : 0) - (statusVon(b) === "attended" ? 1 : 0) ||
        a.name.localeCompare(b.name)
    )
  }, [gaeste, suche, statusVon])

  const da = gaeste.filter((g) => statusVon(g) === "attended")
  const daMitBegleitung = da.length + da.reduce((s, g) => s + g.plus_ones, 0)

  const speichereQueue = useCallback(
    (q: PendingCheckin[]) => {
      setOfflineQueue(q)
      try {
        localStorage.setItem(queueKey, JSON.stringify(q))
      } catch {
        /* voll oder privat: dann nur im Speicher */
      }
    },
    [queueKey]
  )

  const checkin = useCallback(
    (g: Gast, neu: "attended" | "yes") => {
      // Optimistisch anzeigen; ohne Netz landet der Wechsel in der Warteschlange
      setLokalStatus((s) => ({ ...s, [g.inviteId]: neu }))
      start(async () => {
        try {
          await setInviteStatus(g.inviteId, eventId, neu)
          router.refresh()
        } catch {
          speichereQueue([
            ...offlineQueue.filter((p) => p.inviteId !== g.inviteId),
            { inviteId: g.inviteId, status: neu },
          ])
          setMeldung("Kein Netz — Check-in vorgemerkt, geht raus sobald Verbindung da ist")
        }
      })
    },
    [eventId, offlineQueue, router, speichereQueue, start]
  )

  // Warteschlange abarbeiten, sobald der Browser wieder online ist
  useEffect(() => {
    async function flush() {
      if (!offlineQueue.length) return
      const rest: PendingCheckin[] = []
      for (const p of offlineQueue) {
        try {
          await setInviteStatus(p.inviteId, eventId, p.status)
        } catch {
          rest.push(p)
        }
      }
      speichereQueue(rest)
      if (rest.length < offlineQueue.length) {
        setMeldung(`${offlineQueue.length - rest.length} vorgemerkte Check-ins nachgetragen`)
        router.refresh()
      }
    }
    window.addEventListener("online", flush)
    if (navigator.onLine) flush()
    return () => window.removeEventListener("online", flush)
    // offlineQueue bewusst als Auslöser: neuer Eintrag + online = sofort senden
  }, [offlineQueue, eventId, router, speichereQueue])

  function toggleCheckin(g: Gast) {
    checkin(g, statusVon(g) === "attended" ? "yes" : "attended")
  }

  // ---- QR-Scan: Gast zeigt seinen Einladungs-QR, Kamera findet den Token ----
  const scanStoppen = useCallback(() => {
    if (scanTimer.current) clearInterval(scanTimer.current)
    scanTimer.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanAktiv(false)
  }, [])

  useEffect(() => scanStoppen, [scanStoppen])

  async function scanStarten() {
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector
    if (!Detector) {
      setMeldung("Dieser Browser kann keine QR-Codes lesen — Namen über die Suche abhaken")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setScanAktiv(true)
      // Video erst nach dem Rendern verdrahten
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      const detector = new Detector({ formats: ["qr_code"] })
      scanTimer.current = setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return
        try {
          const codes = await detector.detect(video)
          const wert = codes[0]?.rawValue
          if (!wert) return
          const token = /([a-f0-9]{32})/.exec(wert)?.[1]
          if (!token) return
          const gast = gaeste.find((g) => g.rsvp_token === token)
          if (!gast) {
            setMeldung("QR gehört nicht zu diesem Event")
            return
          }
          if (statusVon(gast) === "attended") {
            setMeldung(`${gast.name} ist schon eingecheckt ✅`)
          } else {
            checkin(gast, "attended")
            setMeldung(`✅ ${gast.name}${gast.plus_ones ? ` +${gast.plus_ones}` : ""} eingecheckt`)
          }
          scanStoppen()
        } catch {
          /* Einzelbild unlesbar: weiterscannen */
        }
      }, 400)
    } catch {
      setMeldung("Kamera nicht verfügbar — Namen über die Suche abhaken")
      scanStoppen()
    }
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 bg-zinc-950/95 px-1 pb-2 pt-1 backdrop-blur">
        <p className="mb-2 text-sm text-zinc-300">
          <span className="text-lg font-bold text-emerald-400">{daMitBegleitung}</span> im Haus
          ({da.length} Gäste + Begleitungen) · {gaeste.length - da.length} erwartet
          {offlineQueue.length > 0 && (
            <span className="ml-2 text-amber-300">⏳ {offlineQueue.length} offline vorgemerkt</span>
          )}
        </p>
        <div className="flex gap-2">
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="🔍 Name…"
            className={inputCls}
          />
          <button
            onClick={() => (scanAktiv ? scanStoppen() : scanStarten())}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
              scanAktiv ? "border-red-700 text-red-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
            title="Gast zeigt den QR von seiner Einladungs-Seite, Kamera checkt ein"
          >
            {scanAktiv ? "✕ Stopp" : "📷 QR"}
          </button>
          {doorToken && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${location.origin}/tuer/${doorToken}`)
                  setKopiert(true)
                  setTimeout(() => setKopiert(false), 1500)
                } catch {
                  setMeldung(`Türsteher-Link: /tuer/${doorToken}`)
                }
              }}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              title="Check-in-Ansicht ohne Login für eine zweite Person an der Tür"
            >
              {kopiert ? "✓" : "🔗 Türsteher"}
            </button>
          )}
        </div>
        {meldung && <p className="mt-1.5 text-xs text-emerald-300">{meldung}</p>}
      </div>

      {scanAktiv && (
        <div className="overflow-hidden rounded-xl border border-zinc-700">
          <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
        </div>
      )}

      {sichtbar.map((g) => {
        const daNow = statusVon(g) === "attended"
        return (
          <button
            key={g.inviteId}
            onClick={() => toggleCheckin(g)}
            disabled={pending}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              daNow
                ? "border-emerald-800/60 bg-emerald-950/30"
                : "border-zinc-800 bg-zinc-900/70 active:bg-zinc-800"
            }`}
          >
            <Avatar name={g.name} url={g.avatar_url} size="md" />
            <span className="min-w-0">
              <span className={`block truncate text-base font-semibold ${daNow ? "text-emerald-200" : "text-white"}`}>
                {g.name}
                {g.plus_ones > 0 && <span className="ml-1 text-sm font-normal text-fuchsia-300">+{g.plus_ones}</span>}
              </span>
              {g.companion_names && (
                <span className="block truncate text-xs text-zinc-400">mit {g.companion_names}</span>
              )}
              {g.promo_code && (
                <span className="block font-mono text-xs text-zinc-500">{g.promo_code}</span>
              )}
            </span>
            <span className={`ml-auto text-2xl ${daNow ? "" : "opacity-25"}`}>{daNow ? "✅" : "⬜️"}</span>
          </button>
        )
      })}
      {sichtbar.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">Niemand gefunden</p>
      )}
    </div>
  )
}
