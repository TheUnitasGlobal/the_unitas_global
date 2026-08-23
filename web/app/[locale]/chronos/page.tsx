import { setRequestLocale } from 'next-intl/server';
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace';
import { ModulePlaceholderEngine } from '@/components/modules/ModulePlaceholderEngine';
import { ECOSYSTEMS } from '@/lib/ecosystems';

const ecosystem = ECOSYSTEMS.find((e) => e.key === 'chronos')!;

export default async function ChronosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModuleWorkspace ecosystem={ecosystem}>
      <ModulePlaceholderEngine ecosystem={ecosystem} />
    </ModuleWorkspace>
  );
}
