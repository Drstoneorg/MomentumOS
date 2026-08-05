/**
 * MomentumOS Companion — Content-Script.
 * Extrahiert sichtbaren Profil-/Chattext (generisch, DOM-Layout-unabhängig),
 * synct zu MomentumOS, zeigt Antwortvarianten. Sendet NIE selbst.
 */
;(() => {
  if (window.__momentumosLoaded) return
  window.__momentumosLoaded = true

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

  // Job-Portale (JobOS): dort erfasst die Extension Stellenanzeigen statt Profile.
  // Reihenfolge wichtig: mediajobs.at vor jobs.at (Substring-Match).
  const JOB_MAP = [
    ["linkedin.com", "linkedin"],
    ["karriere.at", "karriere_at"],
    ["stepstone.", "stepstone"],
    ["willhaben.at", "willhaben"],
    ["mediajobs.at", "mediajobs"],
    ["hokify.at", "hokify"],
    ["indeed.com", "indeed"],
    ["berlinstartupjobs.com", "berlinstartupjobs"],
    ["xing.com", "xing"],
    ["arbeitsagentur.de", "arbeitsagentur"],
    ["jobs.derstandard.at", "derstandard"],
    ["jobs.at", "jobs_at"],
  ]
  const jobPlatform = (JOB_MAP.find(([h]) => location.hostname.includes(h)) || [])[1] || null

  // ---------- UI ----------
  const fab = document.createElement("button")
  fab.id = "momentumos-fab"
  fab.textContent = "M"
  fab.title = "MomentumOS: Seite scannen"
  document.documentElement.appendChild(fab)

  const panel = document.createElement("div")
  panel.id = "momentumos-panel"
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

  // ---------- JobOS: Stellenanzeige erfassen ----------
  function renderJobIdle() {
    panel.innerHTML = `
      <div class="mox-head">JobOS <span class="mox-badge">${esc(jobPlatform)}</span></div>
      <p class="mox-hint">Stellenanzeige offen? Erfassen liest den sichtbaren Text (oder deine Markierung), extrahiert Firma/Titel/Anforderungen und rechnet den Match gegen dein CV-Profil.</p>
      <button class="mox-btn" id="mox-job-scan">💼 Job erfassen + Match-Score</button>
      <label class="mox-hint" style="display:flex;gap:6px;align-items:center;cursor:pointer">
        <input type="checkbox" id="mox-job-autoscan" /> Auto-Erfassen auf Stellen-Detailseiten
      </label>
      <div id="mox-out"></div>`
    panel.querySelector("#mox-job-scan").addEventListener("click", scanJob)
    const autoBox = panel.querySelector("#mox-job-autoscan")
    getAutoScan().then((on) => (autoBox.checked = on))
    autoBox.addEventListener("change", () => setAutoScan(autoBox.checked))
  }

  async function scanJob() {
    const out = panel.querySelector("#mox-out")
    if (!extAlive()) {
      out.innerHTML = `<p class="mox-err">Extension wurde aktualisiert — Seite neu laden (F5).</p>`
      return
    }
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) {
      out.innerHTML = `<p class="mox-err">Erst URL + Token im Extension-Popup speichern.</p>`
      return
    }
    out.innerHTML = `<p class="mox-hint">KI liest die Anzeige…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/job`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ raw: visibleText(), url: location.href, portal: jobPlatform }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || res.status)
      if (d.duplicate) {
        out.innerHTML = `<p class="mox-hint">Schon erfasst: ${esc(d.company)} — ${esc(d.title)}</p>
          <a class="mox-link" href="${baseUrl}/jobs" target="_blank">JobOS öffnen ↗</a>`
        return
      }
      const cls = d.score >= 70 ? "mox-taste-hit" : d.score >= 45 ? "mox-taste-neutral" : "mox-taste-no"
      out.innerHTML = `
        <div class="${d.score != null ? cls : "mox-taste-neutral"}">
          <b>✓ ${esc(d.company)} — ${esc(d.title)}${d.score != null ? ` · ${d.score}%` : ""}</b>
          ${d.verdict ? `<p class="mox-hint">${esc(d.verdict)}</p>` : ""}
          ${d.missing && d.missing.length ? `<p class="mox-hint">Fehlt: ${d.missing.map(esc).join(", ")}</p>` : ""}
        </div>
        <a class="mox-link" href="${baseUrl}/jobs" target="_blank">In JobOS öffnen ↗</a>`
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  // Auto-Erfassung: Stellen-Detailseite erkannt + Auto-Scan an → ohne Klick erfassen.
  const JOB_DETAIL_RE = [
    /linkedin\.com\/jobs\/(view\/|.*currentJobId=)/,
    /karriere\.at\/jobs\/[^/]*\d{5,}/,
    /stepstone\.(at|de)\/stellenangebote--/,
    /indeed\.com\/.*viewjob/,
    /willhaben\.at\/jobs\/job\//,
    /mediajobs\.at\/job/i,
    /hokify\.at\/job\//,
    /berlinstartupjobs\.com\/.+\/.+/,
    /xing\.com\/jobs\/[a-z-]+-\d+/,
    /jobs\.derstandard\.at\/.+\/job\//i,
  ]
  let lastJobHref = ""
  let jobHrefSince = 0
  if (jobPlatform) {
    setInterval(() => {
      if (!autoScanOn || !extAlive()) return
      const href = location.href
      if (!JOB_DETAIL_RE.some((re) => re.test(href))) return
      if (href !== lastJobHref) {
        lastJobHref = href
        jobHrefSince = Date.now()
        return
      }
      // Detailseite seit >2s stabil und noch nicht erfasst → automatisch erfassen
      if (jobHrefSince && Date.now() - jobHrefSince > 2000 && href !== window.__moxLastJobScanned) {
        window.__moxLastJobScanned = href
        panel.hidden = false
        renderJobIdle()
        scanJob()
      }
    }, 2000)
  }

  function renderIdle() {
    if (jobPlatform) {
      renderJobIdle()
      return
    }
    panel.innerHTML = `
      <div class="mox-head">MomentumOS <span class="mox-badge">${esc(platform)}</span></div>
      ${roundupHtml()}
      <div id="mox-taste"></div>
      <p class="mox-hint">Markiere Text (Profil oder Chat) und klicke Scannen — ohne Markierung wird der sichtbare Seitentext genommen.</p>
      <button class="mox-btn" id="mox-scan">Scannen & Syncen</button>
      <button class="mox-btn mox-btn-2" id="mox-fullscan" title="Scrollt den Chat automatisch ganz nach oben und erfasst ALLE Nachrichten. Einmal pro Chat reicht — danach hält Auto-Scan den Rest aktuell.">⇪ Ganzen Verlauf scannen</button>
      <button class="mox-btn mox-btn-2" id="mox-photo">📷 Foto prüfen (KI)</button>
      <label class="mox-hint" style="display:flex;gap:6px;align-items:center;cursor:pointer">
        <input type="checkbox" id="mox-autoscan" /> Auto-Scan bei Chatwechsel
      </label>
      <div id="mox-photo-out"></div>
      <div id="mox-out"></div>`
    panel.querySelector("#mox-scan").addEventListener("click", scan)
    panel.querySelector("#mox-fullscan").addEventListener("click", fullScan)
    panel.querySelector("#mox-photo").addEventListener("click", checkPhotos)
    const autoBox = panel.querySelector("#mox-autoscan")
    getAutoScan().then((on) => (autoBox.checked = on))
    autoBox.addEventListener("change", () => setAutoScan(autoBox.checked))
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
    } catch {
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

  // Liest Chat-Nachrichten aus dem DOM und erkennt die Richtung über die horizontale
  // Ausrichtung: eigene Nachrichten sind rechts ausgerichtet, fremde links — das gilt
  // plattformübergreifend (Tinder, WhatsApp, Instagram, Telegram, TikTok, …).
  // Ergebnis: annotierte Zeilen [me]/[them], damit die KI den Verlauf sicher erkennt.
  function chatAnnotatedText() {
    // Nur echte Chat-Ansichten haben ein Nachrichten-Eingabefeld. Profilkarten
    // (Swipe-Ansicht) nicht — dort keinen "Chatverlauf" erfinden, sonst landen
    // Profilinfos als Nachrichten in der DB.
    const composer = findComposer()
    if (!composer) return ""
    const scope = document.querySelector("main") || document.body
    // Chat-Spalte = horizontaler Bereich des Eingabefelds. Alles außerhalb
    // (z. B. Tinder-Profilpanel rechts neben dem Chat) gehört NICHT zum Verlauf —
    // sonst landen Profilinfos als [me]-Nachrichten in der DB.
    const cRect = composer.getBoundingClientRect()
    if (cRect.width < 120) return ""
    const colLeft = cRect.left - 12
    const colRight = cRect.right + 12
    const colWidth = colRight - colLeft
    const midX = (colLeft + colRight) / 2
    const topCut = window.innerHeight * 0.15 // Kopfzeile/Navigation ignorieren

    // Innerste Textknoten = einzelne Bubble-Texte (Blattelemente mit Text).
    const leaves = [...scope.querySelectorAll("*")].filter((el) => {
      if (el.childElementCount !== 0) return false
      const t = (el.textContent || "").trim()
      if (t.length < 1 || t.length > 800) return false
      const r = el.getBoundingClientRect()
      const center = r.left + r.width / 2
      // Nur Elemente innerhalb der Chat-Spalte zählen.
      if (center < colLeft || center > colRight) return false
      return r.width >= 24 && r.height >= 8 && r.top >= topCut && r.width < colWidth * 0.95
    })

    const rows = leaves
      .map((el) => {
        const r = el.getBoundingClientRect()
        const center = r.left + r.width / 2
        // Deutliche Rechts-/Linkslage; Mitte (Systemtext/Datum) markieren wir neutral.
        const off = (center - midX) / colWidth
        const dir = off > 0.08 ? "me" : off < -0.08 ? "them" : "sys"
        return { top: Math.round(r.top), dir, text: el.textContent.trim() }
      })
      .sort((a, b) => a.top - b.top)

    // Aufeinanderfolgende Duplikate/Systemzeilen ausdünnen.
    // Reine Zeitstempel ("09:53", "10.07.2026, 13:33") als eigene Zeile OHNE
    // Präfix durchreichen — egal ob zentriert oder an der Bubble ausgerichtet.
    // Der Server-Parser (chatParse) macht daraus echte sent_at statt Schätzwerte.
    const timeTxt = /^(?:\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})[,\s]+)?\d{1,2}:\d{2}(?::\d{2})?$/
    const lines = []
    let last = ""
    for (const m of rows) {
      if (timeTxt.test(m.text)) {
        if (m.text !== last) lines.push(m.text)
        last = m.text
        continue
      }
      if (m.dir === "sys") continue
      const line = `[${m.dir}] ${m.text}`
      if (line === last) continue
      last = line
      lines.push(line)
    }
    // Plausibilitäts-Check: viele Zeilen, alle aus einer Richtung = vermutlich
    // Profil-/Infotext (z. B. Tinder-Profilpanel neben dem Chat), kein Verlauf.
    const meCount = lines.filter((l) => l.startsWith("[me]")).length
    if (lines.length > 12 && (meCount === 0 || meCount === lines.length)) return ""

    return lines.slice(-60).join("\n").slice(0, 6000)
  }

  // Baut die Sync-Nutzlast: annotierter Chatverlauf (mit Richtung) + Seitentext als Kontext.
  function scanRaw() {
    const chat = chatAnnotatedText()
    const page = visibleText()
    if (!chat) return page
    return `--- CHATVERLAUF (Richtung erkannt: [me]=ich, [them]=Person) ---\n${chat}\n\n--- WEITERER SEITENTEXT ---\n${page}`.slice(
      0,
      12000
    )
  }

  // ---------- Voll-Verlauf-Scan (scrollt hoch, sammelt alles) ----------

  // Scroll-Container des Chatverlaufs: scrollbares Element in der Chat-Spalte
  // oberhalb des Eingabefelds.
  function chatScroller() {
    const composer = findComposer()
    if (!composer) return null
    const c = composer.getBoundingClientRect()
    let best = null
    for (const el of document.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue
      if (el.scrollHeight - el.clientHeight < 150) continue
      const r = el.getBoundingClientRect()
      if (r.height < 200 || r.width < 200) continue
      const overlap = Math.min(r.right, c.right) - Math.max(r.left, c.left)
      if (overlap < c.width * 0.6) continue // muss in der Chat-Spalte liegen
      if (r.top > c.top) continue // muss über dem Eingabefeld beginnen
      if (!best || el.scrollHeight > best.scrollHeight) best = el
    }
    return best
  }

  // Zwei Zeilen-Listen zusammenführen: längste Überlappung (Ende von acc =
  // Anfang von batch) erkennen statt naiv zu deduplizieren — bewusst, damit
  // legitime Wiederholungen ("Haha" zweimal) erhalten bleiben.
  function mergeLines(acc, batch) {
    if (!acc.length) return batch.slice()
    const max = Math.min(acc.length, batch.length)
    for (let k = max; k > 0; k--) {
      let ok = true
      for (let i = 0; i < k; i++) {
        if (acc[acc.length - k + i] !== batch[i]) {
          ok = false
          break
        }
      }
      if (ok) return acc.concat(batch.slice(k))
    }
    return acc.concat(batch)
  }

  async function fullScan() {
    const out = panel.querySelector("#mox-out")
    const sc = chatScroller()
    if (!sc) {
      out.innerHTML = `<p class="mox-err">Kein scrollbarer Chatverlauf gefunden — Chat öffnen und erneut versuchen.</p>`
      return
    }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    out.innerHTML = `<p class="mox-hint">Lade ganzen Verlauf — scrollt automatisch hoch, bitte kurz nicht eingreifen…</p>`
    // 1) ganz nach oben, bis die Plattform nichts Älteres mehr nachlädt
    let lastH = -1
    for (let i = 0; i < 40 && sc.scrollHeight !== lastH; i++) {
      lastH = sc.scrollHeight
      sc.scrollTop = 0
      await sleep(700)
    }
    // 2) von oben nach unten in Schritten sammeln, Überlappungen zusammenführen
    let lines = []
    sc.scrollTop = 0
    await sleep(350)
    for (let guard = 0; guard < 300; guard++) {
      lines = mergeLines(lines, chatAnnotatedText().split("\n").filter(Boolean))
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) break
      sc.scrollTop = sc.scrollTop + Math.max(120, sc.clientHeight * 0.7)
      await sleep(350)
    }
    sc.scrollTop = sc.scrollHeight // zurück ans Chat-Ende
    await sleep(200)
    if (!lines.length) {
      out.innerHTML = `<p class="mox-err">⚠ Verlauf leer erkannt — Plattform-Layout evtl. geändert.</p>`
      return
    }
    const chat = lines.slice(-400).join("\n").slice(-15000)
    const raw = `--- CHATVERLAUF (Richtung erkannt: [me]=ich, [them]=Person) ---\n${chat}\n\n--- WEITERER SEITENTEXT ---\n${visibleText()}`.slice(
      0,
      18000
    )
    await scan(raw)
  }

  // Nach Extension-Reload/-Update ist der Kontext dieser (alten) Instanz ungültig.
  // chrome.runtime.id wird dann undefined; APIs werfen "Extension context invalidated".
  function extAlive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id)
    } catch {
      return false
    }
  }

  async function cfg() {
    if (!extAlive()) return {}
    return new Promise((r) => {
      try {
        chrome.storage.sync.get(["baseUrl", "token"], (v) => r(v || {}))
      } catch {
        r({})
      }
    })
  }

  // rawOverride: fertiger Scan-Text (Voll-Verlauf). Als Klick-Handler kommt
  // stattdessen ein Event-Objekt an — dann normal scannen.
  async function scan(rawOverride) {
    const out = panel.querySelector("#mox-out")
    if (!extAlive()) {
      out.innerHTML = `<p class="mox-err">Extension wurde aktualisiert — Seite neu laden (F5), dann geht's wieder.</p>`
      return
    }
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) {
      out.innerHTML = `<p class="mox-err">Erst URL + Token im Extension-Popup speichern.</p>`
      return
    }
    // Selbsttest: Chat-Ansicht offen (Composer da), aber 0 Nachrichten erkannt
    // = vermutlich DOM-Änderung der Plattform. Sichtbar warnen statt still kaputt.
    const domWarn =
      findComposer() && !chatAnnotatedText()
        ? `<p class="mox-err">⚠ Chat sichtbar, aber 0 Nachrichten erkannt — Plattform-Layout evtl. geändert. Chattext markieren und erneut scannen.</p>`
        : ""
    out.innerHTML = `${domWarn}<p class="mox-hint">Analysiere…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          raw: typeof rawOverride === "string" ? rawOverride : scanRaw(),
          platform,
          nowLocal: new Date().toString(),
          // Live-Chat-Ende mitgeben: der Auto-Entwurf soll auf die tatsächlich
          // letzte Nachricht antworten, nicht auf evtl. veralteten DB-Stand.
          chatTail: chatAnnotatedText().split("\n").filter(Boolean).slice(-14).join("\n") || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      bump("synced")
      // Zweite Selbsttest-Stufe: Server hat praktisch nichts erkannt —
      // Profil-Capture vermutlich leer (DOM-Umbau oder Seite nicht fertig geladen).
      const emptyWarn =
        !domWarn && data.name === "Unbekannt" && !data.messageCount
          ? `<p class="mox-err">⚠ Fast nichts erkannt (kein Name, keine Nachrichten) — Seite fertig geladen? Profiltext markieren und erneut scannen.</p>`
          : ""
      out.innerHTML = `
        ${domWarn}${emptyWarn}
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
        <div class="mox-idea-row">
          <input class="mox-input" id="mox-idea" placeholder="Wie ich's sagen würde: grobe Idee tippen, KI formuliert nur aus" />
          <button class="mox-copy mox-chip" id="mox-idea-go">In meinem Stil</button>
        </div>
        <a class="mox-link" href="${baseUrl}/contacts/${data.contactId}" target="_blank">In MomentumOS öffnen ↗</a>
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
      out.querySelector("#mox-idea-go").addEventListener("click", () => rephrase(data.contactId))
      out.querySelector("#mox-idea").addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") rephrase(data.contactId)
      })
      if (data.autoDraft) {
        renderVariants(out.querySelector("#mox-replies-out"), data.autoDraft, data.contactId)
      } else {
        // Kein Auto-Entwurf vom Server, aber letzte sichtbare Nachricht ist von der
        // Person → Vorschläge automatisch holen (kein extra Klick nötig).
        const chat = chatAnnotatedText()
        // Zeitstempel-Zeilen überspringen — die letzte NACHRICHT zählt
        const lastLine = chat.split("\n").filter((l) => l.startsWith("[")).pop() || ""
        if (lastLine.startsWith("[them]")) replies(data.contactId, "")
      }
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  async function replies(contactId, situation) {
    const out = panel.querySelector("#mox-replies-out")
    const { baseUrl, token } = await cfg()
    out.innerHTML = `<p class="mox-hint">Generiere…</p>`
    // Live-Chat-Ende mitschicken: garantiert, dass die allerletzte Nachricht der
    // Person berücksichtigt wird, auch wenn der DB-Sync sie (noch) nicht hat.
    const liveChat = chatAnnotatedText().split("\n").filter(Boolean).slice(-14).join("\n")
    try {
      const res = await fetch(`${baseUrl}/api/extension/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contactId,
          situation: situation || undefined,
          liveChat: liveChat || undefined,
          nowLocal: new Date().toString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      renderVariants(out, data, contactId)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  // "Wie ich's sagen würde": grobe Idee wird nur im eigenen Stil ausformuliert
  async function rephrase(contactId) {
    const idea = (panel.querySelector("#mox-idea")?.value || "").trim()
    const out = panel.querySelector("#mox-replies-out")
    if (!idea) return
    const { baseUrl, token } = await cfg()
    out.innerHTML = `<p class="mox-hint">Formuliere…</p>`
    try {
      const res = await fetch(`${baseUrl}/api/extension/rephrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId, idea, nowLocal: new Date().toString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.status)
      renderVariants(out, data, contactId)
    } catch (e) {
      out.innerHTML = `<p class="mox-err">Fehler: ${esc(String(e.message || e))}</p>`
    }
  }

  // Daumen hoch/runter: System lernt, welche Vorschläge übernommen werden
  async function sendFeedback(contactId, style, text, rating) {
    try {
      const { baseUrl, token } = await cfg()
      if (!baseUrl || !token) return
      await fetch(`${baseUrl}/api/extension/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId, style, text, rating }),
      })
    } catch {
      /* Feedback ist best effort */
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

  function renderVariants(out, data, contactId) {
    const rows = Object.entries(data.variants || {})
      .map(
        ([style, text]) => `
      <div class="mox-variant">
        <div><span class="mox-style">${esc(style.replace(/_/g, " "))}</span><p>${esc(text)}</p></div>
        <div class="mox-variant-actions">
          <button class="mox-copy mox-rate" data-r="1" data-s="${esc(style)}" data-t="${esc(text)}">👍</button>
          <button class="mox-copy mox-rate" data-r="-1" data-s="${esc(style)}" data-t="${esc(text)}">👎</button>
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
    out.querySelectorAll(".mox-rate").forEach((b) =>
      b.addEventListener("click", () => {
        sendFeedback(contactId, b.dataset.s, b.dataset.t, Number(b.dataset.r))
        b.textContent = "✓"
        b.disabled = true
      })
    )
    out.querySelectorAll(".mox-copy:not(.mox-insert):not(.mox-rate)").forEach((b) =>
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

  // ---------- Auto-Scan bei Chatwechsel ----------
  // Erkennt Profil-/Chatwechsel über URL + ersten [them]-Text. Bei Wechsel und
  // vorhandenem Composer: kurz warten (DOM stabil), dann automatisch scannen+syncen.
  // Nur Lesen + Sync — gesendet wird weiterhin nie automatisch.
  let autoScanOn = false
  async function getAutoScan() {
    if (!extAlive()) return false
    return new Promise((r) => {
      try {
        chrome.storage.sync.get(["autoScan"], (v) => r(v?.autoScan !== false))
      } catch {
        r(false)
      }
    })
  }
  function setAutoScan(on) {
    autoScanOn = on
    try {
      chrome.storage.sync.set({ autoScan: on })
    } catch {}
  }

  function chatSignature() {
    if (!findComposer()) return ""
    const chat = chatAnnotatedText()
    if (!chat) return ""
    const firstThem = chat.split("\n").find((l) => l.startsWith("[them]")) || ""
    return location.href + "::" + firstThem.slice(0, 120)
  }

  let lastSig = ""
  let sigStableSince = 0
  let lastAutoScan = 0
  getAutoScan().then((on) => (autoScanOn = on))
  setInterval(() => {
    if (!autoScanOn || !extAlive()) return
    const sig = chatSignature()
    if (!sig) return
    if (sig !== lastSig) {
      lastSig = sig
      sigStableSince = Date.now()
      return
    }
    // Neue Signatur seit >1,5s stabil, letzter Auto-Scan >20s her → scannen
    if (
      sigStableSince &&
      Date.now() - sigStableSince > 1500 &&
      Date.now() - lastAutoScan > 20000 &&
      sig !== window.__moxLastScanned
    ) {
      window.__moxLastScanned = sig
      lastAutoScan = Date.now()
      panel.hidden = false
      renderIdle()
      scan()
    }
  }, 2000)

  // ---------- Instagram Activity-Tracker ----------
  // Liest beim Browsen sichtbare Ereignisse: ungelesene DM-Threads (Inbox) und
  // Notification-Einträge (Likes, Story-Reaktionen, Erwähnungen). Meldet sie an
  // MomentumOS → dort werden bekannte Kontakte zu fälligen Follow-ups mit ⚡-Antwort.
  // Nur Lesen + Erinnern — gesendet wird nie automatisch.
  function igCollectEvents() {
    const events = []

    // 1) DM-Inbox: ungelesene Threads. Heuristik: fetter Name in der linken Spalte
    // (Instagram rendert ungelesene Threads mit font-weight >= 600) + Vorschautext.
    if (location.pathname.startsWith("/direct")) {
      const seenNames = new Set()
      for (const el of document.querySelectorAll("span")) {
        if (el.childElementCount) continue
        const name = (el.textContent || "").trim()
        if (name.length < 2 || name.length > 40 || /\d{1,2}\s?(min|std|h|d|w)/i.test(name)) continue
        const fw = parseInt(getComputedStyle(el).fontWeight, 10) || 400
        if (fw < 600) continue
        const r = el.getBoundingClientRect()
        if (r.width < 20 || r.left > window.innerWidth * 0.5) continue // nur Thread-Liste links
        if (seenNames.has(name)) continue
        seenNames.add(name)
        // Vorschau: nächster nicht-fetter Text im selben Zeilen-Container
        const row = el.closest('div[role="button"], a, li') || el.parentElement?.parentElement
        let preview = ""
        if (row) {
          for (const s of row.querySelectorAll("span")) {
            const t = (s.textContent || "").trim()
            if (s !== el && t && t !== name && t.length > 2 && t.length < 150) {
              preview = t
              break
            }
          }
        }
        events.push({ kind: "dm", name, text: preview })
        if (events.length >= 15) break
      }
    }

    // 2) Notifications (Herz-Panel / /notifications): Zeilen wie
    // "name gefällt dein Foto." / "name liked your story."
    const notifRe =
      /(gefällt|geliked|liked|hat auf deine story reagiert|reacted to your story|hat dich erwähnt|mentioned you)/i
    for (const el of document.querySelectorAll("span, div")) {
      if (el.childElementCount) continue
      const t = (el.textContent || "").trim()
      if (t.length < 8 || t.length > 200 || !notifRe.test(t)) continue
      // Name = erstes Wort vor dem Verb (IG-Notifications beginnen mit dem Usernamen)
      const name = t.split(/\s/)[0]
      if (!name || name.length < 2 || name.length > 40) continue
      const kind = /erwähnt|mentioned/i.test(t) ? "mention" : "like"
      events.push({ kind, name, text: t.slice(0, 150) })
      if (events.length >= 25) break
    }

    return events
  }

  let lastActivitySig = ""
  async function igReportActivity() {
    if (platform !== "instagram" || !autoScanOn || !extAlive()) return
    const events = igCollectEvents()
    if (!events.length) return
    const sig = JSON.stringify(events.map((e) => e.kind + "|" + e.name))
    if (sig === lastActivitySig) return // nichts Neues sichtbar
    const { baseUrl, token } = await cfg()
    if (!baseUrl || !token) return
    try {
      await fetch(`${baseUrl}/api/extension/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ events, platform }),
      })
      lastActivitySig = sig
    } catch {
      /* best effort — nächster Tick versucht's wieder */
    }
  }
  if (platform === "instagram") setInterval(igReportActivity, 15000)

  // ---------- Ergebnisse vom Kontextmenü („An MomentumOS senden") ----------
  try {
    chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "momentumos-toggle") {
      // Alt+M: Panel auf/zu
      panel.hidden = !panel.hidden
      if (!panel.hidden) renderIdle()
      return
    }
    if (!msg || msg.type !== "momentumos-sync-result") return
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
  } catch {
    // Kontext bereits ungültig (alte Instanz nach Reload) — Listener nicht registrierbar.
  }
})()
