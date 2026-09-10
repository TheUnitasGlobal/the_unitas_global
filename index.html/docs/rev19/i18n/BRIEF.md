# REV-19 i18n translation brief (namespace `Rev19`)

Translate `docs/rev19/i18n/en.json` into the target locale, writing `docs/rev19/i18n/<locale>.json`
with EXACTLY the same flat dot-path keys (same count, same names, same order). Reference tone: `ko.json`
(mysterious, restrained, curiosity-inducing invitation — never technical, never salesy).

Rules:
1. Keep every ICU token verbatim: `{theme}`, `{term}`, `{seconds}`, `{time}`, `{count}`, `{title}`, `{handle}`.
2. Keep brand/proper nouns as-is: UNITAS, U-AI, U-Messenger, UNITAS Mail, UNITAS Shorts (may be transliterated for scripts that need it, but keep "UNITAS"), Google News RSS, Bing News RSS, YouTube, Wikipedia (use the local Wikipedia name), THE UNITAS GLOBAL OÜ, www.theunitas.global, `@theunitas.global`.
3. `mail.placeholder` stays `yourname` (ASCII) — it is an example handle; `mail.invalid` must keep "a–z, 0–9" ASCII rule text.
4. `watermark.printMark` stays exactly "THE UNITAS GLOBAL OÜ · PROTECTED".
5. UI length: chip/tab labels (`hub.themes.*.title`, `discovery.*`, `shorts.like/liked/follow/following/upload`, `search.ask`, `legal.close`) must be SHORT (1–2 words). Titles under 40 characters.
6. `search.cards.c1..c12` are curiosity questions — translate as natural, intriguing questions in the target language.
7. Output valid JSON only (UTF-8, 2-space indent, trailing newline). Do not add or remove keys.
