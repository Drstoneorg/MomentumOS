import { createAdminClient } from "@/lib/supabase/admin"

const PUBLIC_MARKER = "/storage/v1/object/public/moment-images/"

/**
 * Löscht das Storage-Objekt hinter einer öffentlichen moment-images-URL.
 * Kein-URL-Inhalt (Texte, Prompts) wird still ignoriert — kein Fehler,
 * damit Lösch-Aktionen nie an einer fehlenden Datei scheitern.
 */
export async function removeStorageObjectByUrl(url: string | null | undefined) {
  if (!url) return
  const i = url.indexOf(PUBLIC_MARKER)
  if (i === -1) return
  const path = decodeURIComponent(url.slice(i + PUBLIC_MARKER.length).split("?")[0])
  if (!path) return
  try {
    const admin = createAdminClient()
    await admin.storage.from("moment-images").remove([path])
  } catch {
    // Bucket-Aufräumen ist Best-Effort — DB-Löschung hat Vorrang.
  }
}
