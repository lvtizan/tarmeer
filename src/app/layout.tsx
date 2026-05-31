import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { WHATSAPP_LINK } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: "Tarmeer | Interior Design & Build — UAE",
    template: "%s | Tarmeer",
  },
  description:
    "Tarmeer offers interior design and build services in the UAE. Find your designer, full-case and soft decoration packages. Sharjah, Dubai.",
  metadataBase: new URL("https://www.tarmeer.com"),
  openGraph: {
    type: "website",
    siteName: "Tarmeer",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@TarmeerUAE",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap"
        />
        <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
      </head>
      <body className="text-[#2c2c2c] antialiased min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer whatsAppLink={WHATSAPP_LINK} />
        </Providers>
      </body>
    </html>
  );
}
