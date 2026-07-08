import { Card } from "@/components/ui"

export default function BookPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">BookOS — Treatment buchen</h1>
      <Card title="Bald verfügbar">
        <p className="text-sm text-zinc-400">
          Hier buchst du Treatments in Echtzeit: Adresse eingeben, verfügbaren
          Anbieter in der Nähe finden, Live-Status verfolgen, bezahlen, bewerten.
          Aufbau läuft — siehe ROADMAP.md Phase 3 (Schema, Dispatch, Karte,
          Anbieter-Ansicht, Stripe).
        </p>
      </Card>
    </div>
  )
}
