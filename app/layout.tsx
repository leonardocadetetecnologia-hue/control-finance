import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finance Control - Leo Cadete',
  description: 'Sistema de controle financeiro pessoal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=Manrope:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('fx_theme');
                if (theme) document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
