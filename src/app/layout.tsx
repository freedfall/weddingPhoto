import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({ subsets: ['cyrillic', 'latin'], variable: '--font-playfair' })
const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter' })
const jbMono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-jbmono' })

export const metadata: Metadata = {
  title: 'Свадебная плёнка',
  description: '10 кадров на гостя — общий альбом свадьбы',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${playfair.variable} ${inter.variable} ${jbMono.variable} bg-paper text-ink font-sans antialiased min-h-dvh`}>
        <main className="mx-auto max-w-md min-h-dvh px-5 py-6">{children}</main>
      </body>
    </html>
  )
}
