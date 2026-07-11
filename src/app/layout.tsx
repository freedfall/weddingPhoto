import type { Metadata } from 'next'
import { Cormorant, JetBrains_Mono, Montserrat_Alternates } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant({
  subsets: ['cyrillic', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cormorant',
})
const montserratAlt = Montserrat_Alternates({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-msa',
})
const jbMono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-jbmono' })

export const metadata: Metadata = {
  title: 'Свадебная плёнка',
  description: '10 кадров на гостя — общий альбом свадьбы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${cormorant.variable} ${montserratAlt.variable} ${jbMono.variable}`}>
      <body
        className="bg-paper text-ink font-sans antialiased min-h-dvh"
      >
        <main className="mx-auto max-w-md min-h-dvh px-5 py-6">{children}</main>
      </body>
    </html>
  )
}
