import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { WHATSAPP_LINK } from '../lib/constants';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer whatsAppLink={WHATSAPP_LINK} />
    </div>
  );
}
