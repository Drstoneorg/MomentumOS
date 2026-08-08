/**
 * Push-Texte für die öffentlichen Einläufe (RSVP, Model-Bewerbung, Event-Lead).
 * Pure Funktionen ohne Imports — die Routen hängen sie an sendPushToAll.
 */

export type PushText = { title: string; body: string }

export function rsvpPush(
  gastName: string,
  eventTitel: string,
  status: "yes" | "no" | "waitlist",
  plusOnes = 0
): PushText {
  const begleitung = status === "yes" && plusOnes > 0 ? ` +${plusOnes}` : ""
  switch (status) {
    case "yes":
      return { title: "🎉 Zusage", body: `${gastName}${begleitung} kommt zu „${eventTitel}"` }
    case "waitlist":
      return { title: "⏳ Warteliste", body: `${gastName} steht für „${eventTitel}" auf der Warteliste` }
    case "no":
      return { title: "Absage", body: `${gastName} hat für „${eventTitel}" abgesagt` }
  }
}

export function bewerbungPush(name: string, city: string | null): PushText {
  return {
    title: "✨ Neue Model-Bewerbung",
    body: `${name}${city ? ` aus ${city}` : ""} hat sich über /model beworben`,
  }
}

export function leadPush(name: string, eventTitel: string): PushText {
  return { title: "✨ Neuer Event-Lead", body: `${name} will zu „${eventTitel}" kommen` }
}
