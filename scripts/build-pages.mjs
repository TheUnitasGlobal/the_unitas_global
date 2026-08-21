import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const modules = JSON.parse(await readFile(resolve(root, 'config/modules.json'), 'utf8'))
const publicConfig = JSON.parse(await readFile(resolve(root, 'config/public.json'), 'utf8'))
const outputDir = resolve(root, 'pages')

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const renderPage = (module) => `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(module.key)} | THE UNITAS GLOBAL</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    body { background: #030305; color: #e2e8f0; font-family: monospace; }
    .grid-bg { background-image: radial-gradient(rgba(212, 175, 55, .12) 1px, transparent 1px); background-size: 36px 36px; }
  </style>
</head>
<body class="grid-bg min-h-screen">
  <main class="min-h-screen max-w-3xl mx-auto px-6 py-16 flex items-center">
    <section class="w-full border border-yellow-500/30 bg-black/70 p-8 md:p-12">
      <a href="../index.html" class="text-xs text-yellow-400 tracking-widest">THE UNITAS GLOBAL / HOME</a>
      <p class="text-cyan-300 text-xs tracking-[.3em] uppercase mt-16">Revenue module</p>
      <h1 class="text-4xl md:text-6xl font-bold text-white mt-4">${escapeHtml(module.key)}</h1>
      <p class="text-gray-400 leading-relaxed mt-6">${escapeHtml(module.description)}</p>
      <p class="text-yellow-400 text-xl mt-8">${escapeHtml(module.priceLabel)}</p>
      <button id="checkout-button" type="button" class="mt-10 w-full border border-yellow-400 bg-yellow-400/10 py-4 text-yellow-300 tracking-widest hover:bg-yellow-400 hover:text-black transition-colors">
        START SECURE CHECKOUT
      </button>
      <p id="checkout-message" class="text-xs text-gray-500 mt-4" role="status"></p>
    </section>
  </main>
  <script>
    const SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || publicConfig.supabaseUrl)};
    const SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || publicConfig.supabaseAnonKey)};
    const MODULE = ${JSON.stringify(module.key)};
    const button = document.getElementById('checkout-button');
    const message = document.getElementById('checkout-message');
    const client = SUPABASE_ANON_KEY ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    button.addEventListener('click', async () => {
      if (!client) {
        message.textContent = 'Supabase browser configuration is missing.';
        return;
      }
      button.disabled = true;
      message.textContent = 'Creating secure checkout session...';
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          message.textContent = 'Please sign in on the secure portal first.';
          window.location.assign('../index.html#portal');
          return;
        }
        const { data, error } = await client.functions.invoke('create-checkout-session', { body: { module: MODULE } });
        if (error || !data?.url) throw error || new Error('Checkout URL was not returned');
        window.location.assign(data.url);
      } catch (error) {
        console.error('Checkout error:', error);
        message.textContent = 'Unable to start secure checkout. Please try again.';
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>
`

await mkdir(outputDir, { recursive: true })
for (const module of modules) {
  await writeFile(resolve(outputDir, `${module.slug}.html`), renderPage(module), 'utf8')
}

console.log(`Generated ${modules.length} revenue pages in pages/`)
