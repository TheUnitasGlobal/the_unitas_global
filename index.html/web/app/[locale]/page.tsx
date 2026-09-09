import { setRequestLocale } from 'next-intl/server';
import { QuantumWhiteHome } from '@/components/home/quantum/QuantumWhiteHome';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <QuantumWhiteHome />;
}
