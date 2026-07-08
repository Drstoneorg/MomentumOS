"use client"

import { useEffect, useRef } from "react"
import type * as L from "leaflet"

type Marker = { lat: number; lng: number; label: string; kind: "customer" | "provider" }

// Leaflet direkt (kein react-leaflet) — vermeidet React-19-Peer-Konflikte.
export function LiveMap({ markers, height = 260 }: { markers: Marker[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const leaflet = (await import("leaflet")).default
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !ref.current) return

      if (!mapRef.current) {
        mapRef.current = leaflet.map(ref.current, { zoomControl: true, attributionControl: false })
        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 })
          .addTo(mapRef.current)
        layerRef.current = leaflet.layerGroup().addTo(mapRef.current)
      }

      const layer = layerRef.current!
      layer.clearLayers()
      const pts: [number, number][] = []
      for (const m of markers) {
        const color = m.kind === "provider" ? "#0ea5e9" : "#f43f5e"
        const icon = leaflet.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })
        leaflet.marker([m.lat, m.lng], { icon }).bindPopup(m.label).addTo(layer)
        pts.push([m.lat, m.lng])
      }
      if (pts.length === 1) mapRef.current!.setView(pts[0], 15)
      else if (pts.length > 1) mapRef.current!.fitBounds(pts, { padding: [40, 40] })
    })()
    return () => {
      cancelled = true
    }
  }, [markers])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl border border-zinc-800" />
}
