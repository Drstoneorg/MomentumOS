/**
 * Öffentliche Basis-URL der Anwendung — eine Quelle für Telegram-Buttons,
 * Webhook-Adressen und alles, was von außen zurückzeigt.
 *
 * Über `NEXT_PUBLIC_SITE_URL` setzbar (Vercel: Project Settings → Environment
 * Variables). Der Fallback ist die aktuelle Produktions-URL, damit ohne
 * gesetzte Variable nichts bricht. Wandert die App auf eine neue Adresse,
 * ist das genau ein Eintrag statt einer Suche durch den Quelltext.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://momentumos-hq.vercel.app").replace(/\/$/, "")
