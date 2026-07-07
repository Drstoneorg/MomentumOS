const $ = (id) => document.getElementById(id)

chrome.storage.sync.get(["baseUrl", "token"], (v) => {
  $("baseUrl").value = v.baseUrl || "https://matchos-ten.vercel.app"
  $("token").value = v.token || ""
})

$("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    { baseUrl: $("baseUrl").value.replace(/\/$/, ""), token: $("token").value.trim() },
    () => {
      $("status").innerHTML = '<div class="ok">✓ Gespeichert</div>'
      setTimeout(() => ($("status").innerHTML = ""), 2000)
    }
  )
})
