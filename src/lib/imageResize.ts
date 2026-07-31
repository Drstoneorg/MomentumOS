/**
 * Bild-Vorbereitung im Browser, gemeinsam für alle Upload-Stellen.
 *
 * Zwei Fallen, die am Handy zugeschlagen haben und hier zentral abgefangen sind:
 * Vercel nimmt maximal 4,5 MB Request-Body — ein unverkleinertes Handyfoto als
 * Data-URL sprengt das. Und HEIC vom iPhone kann der Browser nicht in ein
 * Canvas zeichnen, weshalb ohne Fehlerbehandlung einfach nichts passierte.
 */

/** Die Data-URL geht als JSON-String raus, ihre Länge entspricht ungefähr den Bytes. */
export const MAX_UPLOAD = 3_500_000

// Manche Android-Browser liefern beim Galerie-Pick einen leeren MIME-Typ.
const BILD_ENDUNG = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i

export function istBild(file: { type: string; name: string }): boolean {
  if (file.type.startsWith("image/")) return true
  return file.type === "" && BILD_ENDUNG.test(file.name)
}

function lesen(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error("Datei nicht lesbar"))
    r.readAsDataURL(file)
  })
}

function laden(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error("decode"))
    i.src = dataUrl
  })
}

function zeichnen(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", quality)
}

/**
 * Verkleinert und kodiert immer neu als JPEG. Das Original durchzureichen hat
 * bei großen Aufnahmen den Body gesprengt, und die Vision-API versteht kein HEIC.
 */
export async function downscale(file: File, maxDim = 1600): Promise<string> {
  const dataUrl = await lesen(file)
  let img: HTMLImageElement
  try {
    img = await laden(dataUrl)
  } catch {
    throw new Error(
      `„${file.name || "Bild"}“ kann der Browser nicht öffnen${file.type ? ` (${file.type})` : ""}. ` +
        "Auf dem iPhone hilft: Einstellungen → Kamera → Formate → „Maximale Kompatibilität“."
    )
  }
  let dim = maxDim
  let out = zeichnen(img, dim, 0.85)
  // Notfalls weiter verkleinern, statt am Server in ein 413 zu laufen.
  while (out.length > MAX_UPLOAD && dim > 400) {
    dim = Math.round(dim * 0.75)
    out = zeichnen(img, dim, 0.8)
  }
  if (out.length > MAX_UPLOAD) {
    throw new Error("Bild ist auch verkleinert zu groß. Bitte einen Ausschnitt schicken.")
  }
  return out
}
