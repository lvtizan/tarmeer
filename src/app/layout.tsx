import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { SiteLocaleProvider } from "@/contexts/SiteLocaleContext";
import type { SiteLang } from "@/i18n/site-translations";
import { WHATSAPP_LINK } from "@/lib/constants";
import { getCountry } from "@/lib/country";
import { buildOrganizationJsonLd } from "@/lib/schema/organization";

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: {
      default: `Tarmeer | Interior Design & Build — ${c.name}`,
      template: "%s | Tarmeer",
    },
    description:
      `Tarmeer offers interior design and build services in ${c.name}. Find your designer, full-case and soft decoration packages. ${c.cities.slice(0, 2).join(', ')}.`,
    metadataBase: new URL(c.baseUrl),
    openGraph: {
      type: "website",
      siteName: "Tarmeer",
      locale: c.code === 'vn' ? "vi_VN" : "en_US",
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
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const c = getCountry(country);
  const lang: SiteLang = c.lang;
  const orgJsonLd = buildOrganizationJsonLd(c);

  return (
    <html lang={lang} className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap"
        />
        <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="text-[#2c2c2c] antialiased min-h-full flex flex-col">
        <SiteLocaleProvider lang={lang}>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer whatsAppLink={WHATSAPP_LINK} />
          </Providers>
        </SiteLocaleProvider>
      </body>
    </html>
  );
}
