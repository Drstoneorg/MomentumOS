export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-4xl">📡</p>
      <h1 className="text-xl font-bold">Offline</h1>
      <p className="text-sm text-zinc-400">
        Keine Verbindung. MatchOS lädt automatisch, sobald du wieder online bist.
      </p>
    </div>
  )
}
