import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Nav } from "@/components/Nav"
import { PwaSetup } from "@/components/PwaSetup"
import { CommandPalette } from "@/components/CommandPalette"
import { ErrorReporter } from "@/components/ErrorReporter"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MomentumOS",
  description: "Persönlicher Dating-Agent",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geistSans.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <PwaSetup />
        <ErrorReporter />
        <Nav />
        <CommandPalette />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
