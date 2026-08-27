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
  <title>${escapeHtml(module.key)} | UNITAS</title>
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
      <a href="../index.html" class="text-xs text-yellow-400 tracking-widest">UNITAS / HOME</a>
      <p class="text-cyan-300 text-xs tracking-[.3em] uppercase mt-16">Revenue module</p>
      <h1 class="text-4xl md:text-6xl font-bold text-white mt-4">${escapeHtml(module.key)}</h1>
      <p class="text-gray-400 leading-relaxed mt-6">${escapeHtml(module.description)}</p>
      <p class="text-yellow-400 text-xl mt-8">${escapeHtml(module.priceLabel)}</p>
      <button id="access-button" type="button" class="mt-10 w-full border border-yellow-400 bg-yellow-400/10 py-4 text-yellow-300 tracking-widest hover:bg-yellow-400 hover:text-black transition-colors">
        SPEND COINS &amp; ENTER
      </button>
      <p id="access-message" class="text-xs text-gray-500 mt-4" role="status"></p>
    </section>
  </main>
  <script>
    const SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || publicConfig.supabaseUrl)};
    const SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || publicConfig.supabaseAnonKey)};
    const MODULE = ${JSON.stringify(module.key)};
    const COIN_COST = ${JSON.stringify(module.coinCost)};
    const button = document.getElementById('access-button');
    const message = document.getElementById('access-message');
    const client = SUPABASE_ANON_KEY ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    // Button-triggered, not on bare page load -- a reload must not re-spend
    // coins for a page the user has already paid to enter this session.
    button.addEventListener('click', async () => {
      if (!client) {
        message.textContent = 'Supabase browser configuration is missing.';
        return;
      }
      button.disabled = true;
      message.textContent = 'Checking balance and spending coins...';
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          message.textContent = 'Please sign in on the secure portal first.';
          window.location.assign('../index.html#portal');
          return;
        }
        const { error } = await client.rpc('spend_coins', { p_module: MODULE, p_amount: COIN_COST });
        if (error) {
          if (String(error.message || '').includes('Insufficient balance')) {
            message.textContent = 'Insufficient U-COIN balance. Buy more coins on the secure portal.';
          } else {
            throw error;
          }
          return;
        }
        message.textContent = 'Access granted.';
        button.textContent = 'ENTERED';
      } catch (error) {
        console.error('Module access error:', error);
        message.textContent = 'Unable to spend coins for this module. Please try again.';
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
