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
    ["tiktok.com", "tiktok"],
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

  // ---------- Session-Zähler (pro Tab-Session) ----------
  function session() {
    try {
      return JSON.parse(sessionStorage.getItem("moxSession") || "{}")
    } catch {
      return {}
    }
  }
  function bump(key) {
    const s = session()
    s[key] = (s[key] || 0) + 1
    try {
      sessionStorage.setItem("moxSession", JSON.stringify(s))
    } catch {}
  }
  function roundupHtml() {
    const s = session()
    const total = (s.scanned || 0) + (s.synced || 0)
    if (!total) return ""
    return `<div class="mox-roundup">Session: ${s.scanned || 0} geprüft · ${s.tasteHits || 0} Typ-Treffer · ${
      s.avoided || 0
    } Ausschluss · ${s.synced || 0} gesynct · ${s.liked || 0} Likes
      <button class="mox-copy" id="mox-roundup-reset">Reset</button></div>`
  }

  function renderIdle() {
    panel.innerHTML = `
      <div class="mox-head">MatchOS <span class="mox-badge">${esc(platform)}</span></div>
      ${roundupHtml()}
      <div id="mox-taste"></div>
      <p class="mox-hint">Markiere Text (Profil oder Chat) und klicke Scannen — ohne Markierung wird der sichtbare Seitentext genommen.</p>
      <button class="mox-btn" id="mox-scan">Scannen & Syncen</button>
      <button class="mox-btn mox-btn-2" id="mox-photo">📷 Foto prüfen (KI)</button>
      <div id="mox-photo-out"></div>
      <div id="mox-out"></div>`
    panel.querySelector("#mox-scan").addEventListener("click", scan)
    panel.querySelector("#mox-photo").addEventListener("click", checkPhotos)
    const reset = panel.querySelector("#mox-roundup-reset")
    if (reset)
      reset.addEventListener("click", () => {
        sessionStorage.removeItem("moxSession")
        renderIdle()
      })
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
    bump("scanned")
    if (recommend) bump("tasteHits")
    else if (avoidHits.length) bump("avoided")

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
    if (ok) bump("liked")
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

  // Größtes sichtbares Profilbild finden (heuristisch): flächengrößtes <img>,
  // Data-/Blob-URLs raus (die kann der Server nicht laden).
  function biggestPhoto() {
    let best = null
    let bestArea = 0
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.src || ""
      if (!/^https?:/.test(src)) continue
      const r = img.getBoundingClientRect()
      const area = r.width * r.height
      if (area > bestArea && r.width > 100 && r.height > 100) {
        bestArea = area
        best = src
      }
    }
    // CSS-Hintergrundbilder als Fallback (viele Dating-Apps nutzen die)
    if (!best) {
      for (const el of document.querySelectorAll('[style*="background-image"]')) {
        const m = /url\(["']?(https?:[^"')]+)/.exec(el.getAttribute("style") || "")
        const r = el.getBoundingClientRect()
        const area = r.width * r.height
        if (m && area > bestArea && r.width > 100 && r.height > 100) {
          bestArea = area
          best = m[1]
        }
      }
    }
    return best
  }

  async function checkPhotos() {
    const out = panel.querySelector("#mox-photo-out")
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) {
      out.innerHTML = `<p class="mox-err">Erst URL + Token im Popup speichern.</p>`
      return
    }
    const imageUrl = biggestPhoto()
    if (!imageUrl) {
      out.innerHTML = `<p class="mox-err">Kein Profilfoto gefunden. Auf ein größeres Bild scrollen.</p>`
      return
    }
    out.innerHTML = `<p class="mox-hint">KI prüft Foto…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl }),
      })
      const d = await res.json()
      if (!res.ok) {
        out.innerHTML = `<p class="mox-err">${esc(d.error === "no_vision_key" ? "Kein OPENAI_API_KEY gesetzt." : d.error || "Fehler")}</p>`
        return
      }
      const cls = d.score >= 70 ? "mox-taste-hit" : d.score >= 45 ? "mox-taste-neutral" : "mox-taste-no"
      out.innerHTML = `
        <div class="${cls}">
          <b>📷 ${d.score} · ${d.matches ? "passt" : "eher nicht"}</b>
          <p class="mox-hint">${esc(d.summary || "")}</p>
          ${d.hits && d.hits.length ? `<p class="mox-hint">✓ ${d.hits.map(esc).join(", ")}</p>` : ""}
          ${d.concerns && d.concerns.length ? `<p class="mox-hint">⚠ ${d.concerns.map(esc).join(", ")}</p>` : ""}
        </div>`
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Netzwerkfehler.</p>`
    }
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
      bump("synced")
      out.innerHTML = `
        <p class="mox-ok">✓ ${esc(data.name)} ${data.isNew ? "angelegt" : "aktualisiert"}${
          data.messageCount ? ` · ${data.messageCount} Nachrichten` : ""
        }${data.stage ? ` · ${esc(data.stage)}` : ""}</p>
        <button class="mox-btn" id="mox-replies">${
          data.autoDraft ? "Neue Vorschläge generieren" : "Antwortvorschläge holen"
        }</button>
        <input class="mox-input" id="mox-situation" placeholder="Situation/Wunsch (optional), z. B. 'sie hat nach meinem Job gefragt'" />
        <div class="mox-chips">
          ${["kürzer", "lockerer", "direkter", "witziger", "Gegenfrage stellen", "Date vorschlagen"]
            .map((c) => `<button class="mox-copy mox-chip" data-c="${c}">${c}</button>`)
            .join("")}
        </div>
        <a class="mox-link" href="${baseUrl}/contacts/${data.contactId}" target="_blank">In MatchOS öffnen ↗</a>
        <div id="mox-replies-out"></div>`
      const situationOf = () => out.querySelector("#mox-situation").value.trim()
      out
        .querySelector("#mox-replies")
        .addEventListener("click", () => replies(data.contactId, situationOf()))
      out.querySelectorAll(".mox-chip").forEach((b) =>
        b.addEventListener("click", () =>
          replies(data.contactId, [situationOf(), `Antwort bitte: ${b.dataset.c}`].filter(Boolean).join(". "))
        )
      )
      if (data.autoDraft) renderVariants(out.querySelector("#mox-replies-out"), data.autoDraft)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  async function replies(contactId, situation) {
    const out = panel.querySelector("#mox-replies-out")
    const { baseUrl, token } = await cfg()
    out.innerHTML = `<p class="mox-hint">Generiere…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId, situation: situation || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      renderVariants(out, data)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  // ---------- Inline-Einfügen ins Chatfeld (WhatsApp-Web/Instagram/Telegram) ----------
  // Findet das Nachrichten-Eingabefeld und fügt Text ein. Sendet NIE — Enter drückt der Nutzer.
  function findComposer() {
    const selectors = [
      'footer [contenteditable="true"]', // WhatsApp-Web
      'div[role="textbox"][contenteditable="true"]', // Instagram (Lexical), Telegram-Web
      'textarea[placeholder]',
      '[contenteditable="true"]',
    ]
    for (const sel of selectors) {
      const els = [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 100 && r.height > 10 && r.bottom > window.innerHeight * 0.4
      })
      if (els.length) return els[els.length - 1] // unterstes = Chat-Composer
    }
    return null
  }

  function insertIntoComposer(text) {
    const box = findComposer()
    if (!box) return false
    box.focus()
    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      const setter = Object.getOwnPropertyDescriptor(
        box.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value"
      ).set
      setter.call(box, text)
      box.dispatchEvent(new Event("input", { bubbles: true }))
      return true
    }
    // contenteditable (Lexical/Draft): execCommand feuert die richtigen Editor-Events
    const ok = document.execCommand("insertText", false, text)
    if (!ok) {
      box.dispatchEvent(
        new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true })
      )
    }
    return true
  }

  // Einfügen auf allen Plattformen versuchen — findComposer ist generisch,
  // bei Misserfolg zeigt der Button "✗ Feld?" und Kopieren bleibt als Fallback.
  const canInsert = true

  function renderVariants(out, data) {
    const rows = Object.entries(data.variants || {})
      .map(
        ([style, text]) => `
      <div class="mox-variant">
        <div><span class="mox-style">${esc(style)}</span><p>${esc(text)}</p></div>
        <div class="mox-variant-actions">
          ${canInsert ? `<button class="mox-copy mox-insert" data-t="${esc(text)}">↳ Einfügen</button>` : ""}
          <button class="mox-copy" data-t="${esc(text)}">Kopieren</button>
        </div>
      </div>`
      )
      .join("")
    out.innerHTML = `
      <p class="mox-hint">${esc(data.social_read || "")}</p>
      <p class="mox-hint"><b>Empfehlung:</b> ${esc(data.next_step || "")} — ${esc(
        data.next_step_reason || ""
      )}</p>
      ${rows}`
    out.querySelectorAll(".mox-copy:not(.mox-insert)").forEach((b) =>
      b.addEventListener("click", async () => {
        await navigator.clipboard.writeText(b.dataset.t)
        b.textContent = "✓"
        setTimeout(() => (b.textContent = "Kopieren"), 1200)
      })
    )
    out.querySelectorAll(".mox-insert").forEach((b) =>
      b.addEventListener("click", () => {
        const ok = insertIntoComposer(b.dataset.t)
        b.textContent = ok ? "✓ drin" : "✗ Feld?"
        setTimeout(() => (b.textContent = "↳ Einfügen"), 1500)
      })
    )
  }

  // ---------- Ergebnisse vom Kontextmenü („An MatchOS senden") ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "matchos-toggle") {
      // Alt+M: Panel auf/zu
      panel.hidden = !panel.hidden
      if (!panel.hidden) renderIdle()
      return
    }
    if (!msg || msg.type !== "matchos-sync-result") return
    panel.hidden = false
    renderIdle()
    const out = panel.querySelector("#mox-out")
    if (msg.ok) {
      bump("synced")
      out.innerHTML = `<p class="mox-ok">✓ ${esc(msg.name || "Kontakt")} ${msg.isNew ? "angelegt" : "aktualisiert"}${
        msg.messageCount ? ` · ${msg.messageCount} Nachrichten` : ""
      }</p>`
    } else {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(msg.error || "unbekannt")}</p>`
    }
  })
})()
