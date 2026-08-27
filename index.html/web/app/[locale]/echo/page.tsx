import { setRequestLocale } from 'next-intl/server';
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace';
import { EchoEngine } from '@/components/modules/EchoEngine';
import { ECOSYSTEMS } from '@/lib/ecosystems';

const ecosystem = ECOSYSTEMS.find((e) => e.key === 'echo')!;

export default async function EchoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModuleWorkspace ecosystem={ecosystem}>
      <EchoEngine ecosystem={ecosystem} />
    </ModuleWorkspace>
  );
}
