import { setRequestLocale } from 'next-intl/server';
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace';
import { GenesisEngine } from '@/components/modules/GenesisEngine';
import { ECOSYSTEMS } from '@/lib/ecosystems';

const ecosystem = ECOSYSTEMS.find((e) => e.key === 'genesis')!;

export default async function GenesisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModuleWorkspace ecosystem={ecosystem}>
      <GenesisEngine ecosystem={ecosystem} />
    </ModuleWorkspace>
  );
}
