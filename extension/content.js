/**
 * MatchOS Companion — Content-Script.
 * Extrahiert sichtbaren Profil-/Chattext (generisch, DOM-Layout-unabhängig),
 * synct zu MatchOS, zeigt Antwortvarianten. Sendet NIE selbst.
 */
;(() => {
  if (window.__matchosLoaded) return
  window.__matchosLoaded = true

  const PLATFORM_MAP = [
    ["tinder.com", "tinder"],
    ["bumble.com", "bumble"],
    ["boo.world", "boo"],
    ["badoo.com", "badoo"],
    ["web.whatsapp.com", "whatsapp"],
    ["instagram.com", "instagram"],
    ["web.telegram.org", "telegram"],
  ]
  const platform =
    (PLATFORM_MAP.find(([host]) => location.hostname.includes(host)) || [, "sonstige"])[1]

  // ---------- UI ----------
  const fab = document.createElement("button")
  fab.id = "matchos-fab"
  fab.textContent = "M"
  fab.title = "MatchOS: Seite scannen"
  document.documentElement.appendChild(fab)

  const panel = document.createElement("div")
  panel.id = "matchos-panel"
  panel.hidden = true
  document.documentElement.appendChild(panel)

  fab.addEventListener("click", () => {
    panel.hidden = !panel.hidden
    if (!panel.hidden) renderIdle()
  })

  function esc(s) {
    const d = document.createElement("div")
    d.textContent = s
    return d.innerHTML
  }

  function renderIdle() {
    panel.innerHTML = `
      <div class="mox-head">MatchOS <span class="mox-badge">${esc(platform)}</span></div>
      <div id="mox-taste"></div>
      <p class="mox-hint">Markiere Text (Profil oder Chat) und klicke Scannen — ohne Markierung wird der sichtbare Seitentext genommen.</p>
      <button class="mox-btn" id="mox-scan">Scannen & Syncen</button>
      <div id="mox-out"></div>`
    panel.querySelector("#mox-scan").addEventListener("click", scan)
    evalTaste()
  }

  // ---------- Beuteschema / Typ-Check ----------
  let tasteCache = null

  async function getTaste() {
    if (tasteCache) return tasteCache
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) return null
    try {
      const res = await fetch(`${baseUrl}/api/extension/taste-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      tasteCache = await res.json()
      return tasteCache
    } catch {
      return null
    }
  }

  function matchTaste(text, taste) {
    const t = text.toLowerCase()
    const hits = (taste.include || []).filter((k) => k && t.includes(k))
    const avoidHits = (taste.avoid || []).filter((k) => k && t.includes(k))
    return { hits, avoidHits, recommend: hits.length > 0 && avoidHits.length === 0 }
  }

  async function evalTaste() {
    const box = panel.querySelector("#mox-taste")
    if (!box) return
    const taste = await getTaste()
    if (!taste || !(taste.include || []).length) return
    const { hits, avoidHits, recommend } = matchTaste(visibleText(), taste)

    if (recommend) {
      box.innerHTML = `
        <div class="mox-taste-hit">
          <b>⭐ Passt zu deinem Typ</b>
          <span class="mox-taste-tags">${hits.map((h) => `<span>${esc(h)}</span>`).join("")}</span>
          ${taste.autoLikeHint ? `<button class="mox-btn mox-like" id="mox-like">❤ Liken (dein Klick)</button>` : ""}
          <p class="mox-hint">Nur Bio-Text geprüft — Foto siehst du selbst. Like löst nur dein Klick aus.</p>
        </div>`
      const likeBtn = box.querySelector("#mox-like")
      if (likeBtn) likeBtn.addEventListener("click", doLike)
    } else if (avoidHits.length) {
      box.innerHTML = `<div class="mox-taste-no">⚠ Ausschluss-Treffer: ${avoidHits.map(esc).join(", ")}</div>`
    } else {
      box.innerHTML = `<div class="mox-taste-neutral">Kein Beuteschema-Treffer im Text.</div>`
    }
  }

  /** Führt den plattformeigenen Like-Klick aus — nur auf Nutzer-Klick, ein Profil. */
  function doLike(e) {
    const btn = e?.currentTarget
    const ok = performLike()
    if (btn) {
      btn.textContent = ok ? "✓ geliked" : "✗ Button nicht gefunden — manuell"
      btn.disabled = ok
    }
  }

  function performLike() {
    const isLike = (el) => {
      const l = ((el.getAttribute("aria-label") || "") + " " + (el.title || "") + " " + (el.textContent || "")).toLowerCase()
      return /(^|\b)(like|gefällt|liken|herz|heart|yes|smash)(\b|$)/.test(l) && !/super|rewind|zurück|dislike|nope|pass/.test(l)
    }
    // 1) explizite Like-Buttons
    const candidates = [...document.querySelectorAll('button, [role="button"], a')]
    const hit = candidates.find(isLike)
    if (hit) {
      hit.click()
      return true
    }
    // 2) Tinder-Tastatur-Shortcut (Pfeil rechts = Like)
    if (platform === "tinder") {
      const ev = { key: "ArrowRight", code: "ArrowRight", keyCode: 39, which: 39, bubbles: true }
      document.dispatchEvent(new KeyboardEvent("keydown", ev))
      document.dispatchEvent(new KeyboardEvent("keyup", ev))
      return true
    }
    return false
  }

  function visibleText() {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 20) return sel
    // sichtbarer Haupttext, Skripte/Styles raus, auf 6000 Zeichen gekappt
    const main = document.querySelector("main") || document.body
    return main.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 6000)
  }

  async function cfg() {
    return new Promise((r) => chrome.storage.sync.get(["baseUrl", "token"], r))
  }

  async function scan() {
    const out = panel.querySelector("#mox-out")
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) {
      out.innerHTML = `<p class="mox-err">Erst URL + Token im Extension-Popup speichern.</p>`
      return
    }
    out.innerHTML = `<p class="mox-hint">Analysiere…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ raw: visibleText(), platform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      out.innerHTML = `
        <p class="mox-ok">✓ ${esc(data.name)} ${data.isNew ? "angelegt" : "aktualisiert"}${
          data.messageCount ? ` · ${data.messageCount} Nachrichten` : ""
        }${data.stage ? ` · ${esc(data.stage)}` : ""}</p>
        <button class="mox-btn" id="mox-replies">${
          data.autoDraft ? "Neue Vorschläge generieren" : "Antwortvorschläge holen"
        }</button>
        <a class="mox-link" href="${baseUrl}/contacts/${data.contactId}" target="_blank">In MatchOS öffnen ↗</a>
        <div id="mox-replies-out"></div>`
      out
        .querySelector("#mox-replies")
        .addEventListener("click", () => replies(data.contactId))
      if (data.autoDraft) renderVariants(out.querySelector("#mox-replies-out"), data.autoDraft)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  async function replies(contactId) {
    const out = panel.querySelector("#mox-replies-out")
    const { baseUrl, token } = await cfg()
    out.innerHTML = `<p class="mox-hint">Generiere…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      renderVariants(out, data)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  function renderVariants(out, data) {
    const rows = Object.entries(data.variants || {})
      .map(
        ([style, text]) => `
      <div class="mox-variant">
        <div><span class="mox-style">${esc(style)}</span><p>${esc(text)}</p></div>
        <button class="mox-copy" data-t="${esc(text)}">Kopieren</button>
      </div>`
      )
      .join("")
    out.innerHTML = `
      <p class="mox-hint">${esc(data.social_read || "")}</p>
      <p class="mox-hint"><b>Empfehlung:</b> ${esc(data.next_step || "")} — ${esc(
        data.next_step_reason || ""
      )}</p>
      ${rows}`
    out.querySelectorAll(".mox-copy").forEach((b) =>
      b.addEventListener("click", async () => {
        await navigator.clipboard.writeText(b.dataset.t)
        b.textContent = "✓"
        setTimeout(() => (b.textContent = "Kopieren"), 1200)
      })
    )
  }
})()
