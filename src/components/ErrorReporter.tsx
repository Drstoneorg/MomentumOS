"use client"

import { useEffect } from "react"

/**
 * Globaler Fehler-Melder: unbehandelte Browser-Fehler landen in client_errors,
 * das Dashboard warnt bei frischen Einträgen. Vorher waren Produktionsfehler
 * nur sichtbar, wenn der Nutzer sie zufällig bemerkt und gemeldet hat.
 * Bremse: max. 5 Meldungen pro Sitzung, gleiche Meldung nur einmal.
 */
export function ErrorReporter() {
  useEffect(() => {
    const KEY = "fehler-gemeldet"
    const gemeldet = new Set<string>(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"))

    const melde = (message: string, stack?: string) => {
      const kurz = message.slice(0, 120)
      if (gemeldet.has(kurz) || gemeldet.size >= 5) return
      gemeldet.add(kurz)
      sessionStorage.setItem(KEY, JSON.stringify([...gemeldet]))
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          stack,
          path: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {})
    }

    const onError = (e: ErrorEvent) =>
      melde(e.message || "Unbekannter Fehler", e.error instanceof Error ? e.error.stack : undefined)
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason
      melde(
        r instanceof Error ? r.message : `Unhandled rejection: ${String(r).slice(0, 200)}`,
        r instanceof Error ? r.stack : undefined
      )
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
