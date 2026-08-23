import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function ApexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tEcosystems = await getTranslations('Ecosystems');
  const tPlaceholder = await getTranslations('Placeholder');

  return (
    <main className="mx-auto max-w-3xl px-6 py-32 text-center">
      <h1 className="glow-text mb-4 font-serif text-3xl font-bold text-white">
        {tEcosystems('apex.title')}
      </h1>
      <p className="mb-8 text-sm text-gray-400">{tEcosystems('apex.description')}</p>
      <p className="text-xs uppercase tracking-widest text-accent">
        {tPlaceholder('comingSoon')}
      </p>
    </main>
  );
}
