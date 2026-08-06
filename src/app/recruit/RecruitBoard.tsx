"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useTransition } from "react"
import { RECRUIT_STAGES, RECRUIT_STAGE_LABELS, RECRUIT_NEXT_HINT, type RecruitStage } from "@/lib/recruit"
import { setRecruitStage } from "./actions"
import { Avatar } from "@/components/Avatar"

type Model = {
  id: string
  name: string
  location: string | null
  platform: string
  external_id: string | null
  recruit_stage: string | null
  avatar_url: string | null
}

export function RecruitBoard({ models }: { models: Model[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  const move = (id: string, stage: string) =>
    startTransition(async () => {
      const res = await setRecruitStage(id, stage)
      if (res.error) setFehler(res.error)
      else {
        setFehler(null)
        router.refresh()
      }
    })

  return (
    <div className="space-y-2">
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {RECRUIT_STAGES.map((stage) => {
            const inStage = models.filter((m) => (m.recruit_stage ?? "scouted") === stage)
            return (
              <div key={stage} className="w-60 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {RECRUIT_STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-zinc-500">{inStage.length}</span>
                </div>
                <div className="space-y-2">
                  {inStage.map((m) => (
                    <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                      <Link href={`/contacts/${m.id}`} className="flex items-center gap-2 text-sm font-medium hover:text-fuchsia-300">
                        <Avatar name={m.name} url={m.avatar_url} size="sm" />
                        {m.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {[
                          m.location,
                          m.platform === "instagram" && m.external_id ? `@${m.external_id}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {RECRUIT_NEXT_HINT[stage as RecruitStage] && (
                        <p className="mt-1 text-[11px] text-zinc-600">
                          → {RECRUIT_NEXT_HINT[stage as RecruitStage]}
                        </p>
                      )}
                      <select
                        aria-label="Stufe ändern"
                        className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-300"
                        value={stage}
                        onChange={(e) => move(m.id, e.target.value)}
                      >
                        {RECRUIT_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {RECRUIT_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {inStage.length === 0 && (
                    <p className="px-1 pb-1 text-xs text-zinc-600">leer</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
