/**
 * MatchOS Companion — Background-Worker.
 * Kontextmenü „An MatchOS senden": markierten Text an /api/extension/sync schicken.
 * Ergebnis geht als Message an den Tab (Overlay zeigt es); Fallback: Badge am Icon.
 */

const PLATFORM_MAP = [
  ["tinder.com", "tinder"],
  ["bumble.com", "bumble"],
  ["boo.world", "boo"],
  ["badoo.com", "badoo"],
  ["web.whatsapp.com", "whatsapp"],
  ["instagram.com", "instagram"],
  ["tiktok.com", "tiktok"],
  ["web.telegram.org", "telegram"],
]

function setupMenu() {
  // removeAll verhindert "duplicate id"-Fehler bei Extension-Reload
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "matchos-send",
      title: "An MatchOS senden",
      contexts: ["selection"],
    })
  })
}
chrome.runtime.onInstalled.addListener(setupMenu)
chrome.runtime.onStartup.addListener(setupMenu)

// Tastenkürzel Alt+M: Panel im aktiven Tab auf/zu
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: "matchos-toggle" }).catch(() => {})
})

function badge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "matchos-send" || !info.selectionText) return
  const { baseUrl, token } = await chrome.storage.sync.get(["baseUrl", "token"])
  if (!baseUrl || !token) {
    badge("cfg", "#f59e0b")
    return
  }
  const host = tab?.url ? new URL(tab.url).hostname : ""
  const platform = (PLATFORM_MAP.find(([h]) => host.includes(h)) || [, "sonstige"])[1]

  badge("…", "#71717a")
  let result
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/extension/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ raw: info.selectionText, platform }),
    })
    const data = await res.json()
    result = res.ok
      ? { type: "matchos-sync-result", ok: true, ...data }
      : { type: "matchos-sync-result", ok: false, error: data.error || String(res.status) }
  } catch (e) {
    result = { type: "matchos-sync-result", ok: false, error: String(e && e.message ? e.message : e) }
  }
  badge(result.ok ? "✓" : "✗", result.ok ? "#10b981" : "#ef4444")
  if (tab?.id != null) {
    // Auf Seiten ohne Content-Script schlägt das fehl — Badge reicht dann als Feedback.
    chrome.tabs.sendMessage(tab.id, result).catch(() => {})
  }
})
