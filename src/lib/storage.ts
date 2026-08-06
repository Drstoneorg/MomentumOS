import { createAdminClient } from "@/lib/supabase/admin"

const PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/]+)\/([^?]+)/

/**
 * Löscht das Storage-Objekt hinter einer öffentlichen Bucket-URL (moment-images,
 * avatars, …). Kein-URL-Inhalt (Texte, Prompts) wird still ignoriert — kein
 * Fehler, damit Lösch-Aktionen nie an einer fehlenden Datei scheitern.
 */
export async function removeStorageObjectByUrl(url: string | null | undefined) {
  if (!url) return
  const m = PUBLIC_RE.exec(url)
  if (!m) return
  const bucket = m[1]
  const path = decodeURIComponent(m[2])
  if (!bucket || !path) return
  try {
    const admin = createAdminClient()
    await admin.storage.from(bucket).remove([path])
  } catch {
    // Bucket-Aufräumen ist Best-Effort — DB-Löschung hat Vorrang.
  }
}
