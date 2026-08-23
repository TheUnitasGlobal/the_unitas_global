import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Cinzel, JetBrains_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { Scene } from '@/components/canvas/Scene';
import { SpatialAudioProvider } from '@/components/audio/SpatialAudioProvider';
import { AudioGate } from '@/components/audio/AudioGate';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { NavBar } from '@/components/nav/NavBar';
import '../globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cinzel',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-jetbrains-mono',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LocaleLayout' });
  return { title: t('title') };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${cinzel.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-void font-sans text-gray-200 antialiased">
        <NextIntlClientProvider>
          <WalletProvider>
            <SpatialAudioProvider>
              <Scene />
              <NavBar />
              <AudioGate />
              <div className="relative z-0">{children}</div>
            </SpatialAudioProvider>
          </WalletProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
