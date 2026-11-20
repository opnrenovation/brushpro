import type { Metadata, Viewport } from 'next';
import CrewShell from '@/components/crew/CrewShell';

export const metadata: Metadata = {
  title: 'OPN Crew',
  description: 'Clock in, time cards and job info for the OPN Renovation crew',
  manifest: '/crew.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'OPN Crew', statusBarStyle: 'default' },
  icons: { apple: '/opn-logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1e40af',
};

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return <CrewShell>{children}</CrewShell>;
}
