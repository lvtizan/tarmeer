import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { WHATSAPP_LINK } from '../lib/constants';
import { useVisitorTracking } from '../hooks/useVisitorTracking';
import { useAnalyticsTracking } from '../hooks/useAnalyticsTracking';

export default function Layout({
  children,
  navbarVariant = 'default',
}: {
  children: ReactNode;
  navbarVariant?: 'default' | 'admin-auth';
}) {
  useVisitorTracking();
  useAnalyticsTracking();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar variant={navbarVariant} />
      <main className="flex-1">{children}</main>
      <Footer whatsAppLink={WHATSAPP_LINK} />
    </div>
  );
}
