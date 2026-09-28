import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Header, Footer, Sidebar } from '@/components/Chrome';
import AnalyticsClean from '@/components/AnalyticsClean';
import { SITE } from '@/lib/site';
import './globals.css';
import './logo.css';
import './legal.css';
import './insurance.css';
import './depth.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'FreeDoc — Should I go to the ER? Free symptom check',
  description: 'A free AI symptom checker. Answer a few quick questions and get a suggested next step: home care, a doctor visit, urgent care today, or the ER. Not medical advice.',
  openGraph: {
    title: 'FreeDoc — Should I go to the ER?',
    description: 'A free AI symptom checker with a suggested next step in about 60 seconds. Not medical advice.',
    url: '/',
    siteName: 'FreeDoc',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
};

const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--mono', display: 'swap' });

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <head><script src="https://island.contact/snippet.js" data-site="freedoc-web" defer></script></head>
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <div className="app">
          <Sidebar />
          <div className="pane">
            <Header />
            <main id="main" tabIndex={-1}>{children}</main>
            <Footer />
          </div>
        </div>
        <div className="scan" aria-hidden />
        <AnalyticsClean />
      </body>
    </html>
  );
}
