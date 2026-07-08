"use client"

import { useEffect, useRef, useState } from "react"

// Klick-zum-Editieren-Feld: Enter/Blur speichert, Escape bricht ab.
export function InlineField({
  value,
  placeholder = "—",
  multiline = false,
  type = "text",
  className = "",
  displayClassName = "",
  display,
  onSave,
}: {
  value: string
  placeholder?: string
  multiline?: boolean
  type?: "text" | "number" | "date"
  className?: string
  displayClassName?: string
  display?: React.ReactNode
  onSave: (v: string) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      ref.current?.focus()
      if (ref.current instanceof HTMLInputElement && type === "text") ref.current.select()
    }
  }, [editing, type])
  useEffect(() => setDraft(value), [value])

  async function commit() {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDraft(value)
      setEditing(false)
    }
    if (e.key === "Enter" && (!multiline || e.metaKey)) {
      e.preventDefault()
      commit()
    }
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        title="Klicken zum Bearbeiten"
        className={`cursor-pointer rounded px-1 -mx-1 hover:bg-zinc-800/70 ${
          value ? "" : "italic text-zinc-600"
        } ${displayClassName}`}
      >
        {display ?? (value || placeholder)}
      </span>
    )
  }

  const shared = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: onKey,
    disabled: saving,
    className: `rounded border border-rose-600 bg-zinc-950 px-1 text-inherit outline-none ${className}`,
  }

  return multiline ? (
    <textarea ref={ref as React.Ref<HTMLTextAreaElement>} rows={2} {...shared} className={shared.className + " w-full"} />
  ) : (
    <input ref={ref as React.Ref<HTMLInputElement>} type={type} {...shared} />
  )
}
