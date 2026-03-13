import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'OPN Renovation | Des Moines Premier Painting Company',
  description:
    'Family-owned painting company serving Des Moines, Ankeny, Pleasant Hill and Polk County. Residential, commercial, interior and exterior painting. Get a free quote today.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'OPN Renovation',
    title: 'OPN Renovation | Des Moines Premier Painting Company',
    description:
      'Family-owned painting company serving Des Moines, Ankeny, Pleasant Hill and Polk County.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'OPN Renovation',
              image: 'https://opnrenovation.com/logo.png',
              '@id': 'https://opnrenovation.com',
              url: 'https://opnrenovation.com',
              telephone: '+15155551234',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Des Moines',
                addressRegion: 'IA',
                addressCountry: 'US',
              },
              areaServed: [
                'Des Moines', 'Ankeny', 'Pleasant Hill', 'Altoona',
                'Norwalk', 'Indianola', 'Ames', 'Newton', 'Colfax', 'Polk County',
              ],
              openingHours: ['Mo-Fr 08:00-17:00', 'Sa-Su 08:00-13:00'],
              serviceType: [
                'Residential Painting', 'Commercial Painting', 'Interior Painting',
                'Exterior Painting', 'Cabinet Painting', 'Deck Staining',
              ],
            }),
          }}
        />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
