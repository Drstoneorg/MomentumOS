import { Card } from "@/components/ui"

export default function ProviderPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Anbieter-Bereich</h1>
      <Card title="Bald verfügbar">
        <p className="text-sm text-zinc-400">
          Anbieter-Ansicht für BookOS: online/offline gehen, eingehende
          Treatment-Anfragen annehmen, Buchungsstatus führen. Kommt in Phase 3.
        </p>
      </Card>
    </div>
  )
}
