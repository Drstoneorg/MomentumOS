import Stripe from "stripe"

export function stripeAvailable() {
  return !!process.env.STRIPE_SECRET_KEY
}

let client: Stripe | null = null
export function getStripe(): Stripe | null {
  if (!stripeAvailable()) return null
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return client
}

// Autorisiert Betrag beim Anbieter-Match (manual capture), Einzug erst bei Abschluss.
export async function authorizePayment(amountCents: number, bookingId: string) {
  const stripe = getStripe()
  if (!stripe) return null
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    capture_method: "manual",
    metadata: { bookingId },
    automatic_payment_methods: { enabled: true },
  })
  return { id: intent.id, clientSecret: intent.client_secret }
}

// Zieht den zuvor autorisierten Betrag ein.
export async function capturePayment(paymentIntentId: string) {
  const stripe = getStripe()
  if (!stripe) return false
  await stripe.paymentIntents.capture(paymentIntentId)
  return true
}

export async function refundPayment(paymentIntentId: string) {
  const stripe = getStripe()
  if (!stripe) return false
  await stripe.refunds.create({ payment_intent: paymentIntentId })
  return true
}
