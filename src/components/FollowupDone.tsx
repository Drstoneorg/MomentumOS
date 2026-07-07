"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { completeFollowup } from "@/lib/actions"

export function FollowupDone({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() =>
        start(async () => {
          await completeFollowup(id)
          router.refresh()
        })
      }
      disabled={pending}
      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
    >
      ✓ Erledigt
    </button>
  )
}
