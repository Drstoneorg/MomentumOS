import { Card } from "@/components/ui"

export default function BookingsPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Meine Buchungen</h1>
      <Card title="Noch keine Buchungen">
        <p className="text-sm text-zinc-400">
          Sobald BookOS live ist, erscheinen hier deine Treatment-Buchungen mit
          Status, Verlauf und Belegen.
        </p>
      </Card>
    </div>
  )
}
