/**
 * REV-36 MISSION 3 -- 유토크 (U-Talk) hyper matrix. The 22 theme rooms
 * (lib/hub/themeChat.ts) opened blank before a first human message; now every
 * room already breathes with a simulated conversation and a live head-count,
 * both deterministic from the 5-minute pulse slot (lib/square/pulse.ts).
 *
 * The rows are labelled as simulation in the UI (data-hub-msg-sim="1", never
 * data-hub-msg) and can never be confused with a real broadcast or a durable
 * account message: their authorId is the reserved `sim:` prefix, so
 * `data-mine` is always "0" and the E2E "my message lands exactly once"
 * contract is untouched. Real messages render after these.
 */
import type { HotNewsCategory } from '@/lib/live/hotNews';
import type { ChatMessage } from '@/lib/hub/themeChat';
import { PULSE_SLOT_MS, intIn, mulberry32, pickOne, pickHandleUnlike, pulseSlot, seedHash } from './pulse';

/** Simulated messages shown at the head of every room. */
export const TALK_PULSE_COUNT = 12;

/** The rows span at most this window before `now` (90 minutes). */
export const TALK_PULSE_WINDOW_MS = 5_400_000;

/** The reserved authorId prefix that marks a row as simulation, never "mine". */
export const SIM_AUTHOR_PREFIX = 'sim:';

/**
 * Timeless, brand-neutral, specific opening lines per axis -- the kind of
 * thing a real person drops into a themed room. No dates, no named people, no
 * politics-of-the-day, shared by every locale (the house seed-text rule).
 */
export const TALK_PHRASES: Record<HotNewsCategory, readonly string[]> = {
  politics: [
    'Turnout in the small districts is the number nobody reports and it decides everything.',
    'A coalition is easy to announce and hard to keep fed.',
    'Read the second paragraph of any statement — the first is for the cameras.',
    'Local councils move more money per capita than most people ever notice.',
    'Every reshuffle is a map of who owed whom a favour.',
    'The quiet committee votes are where the real bargaining shows up.',
    'A manifesto is a wish list until you cost each line.',
    'Watch which ministries get the new buildings, not the new slogans.',
  ],
  economy: [
    'The yield curve is whispering again and half the room is pretending not to hear it.',
    'Wage growth minus inflation is the only headline that pays your rent.',
    'Inventory-to-sales ratios tell you more than any forecast panel.',
    'When shipping rates fall this fast, someone over-ordered last quarter.',
    'A rate cut priced in is a rate cut already spent.',
    'Small-business credit is the canary; watch it before the indices.',
    'Two percent is a target, not a law of nature.',
    'Household savings rates just quietly did something interesting.',
  ],
  science: [
    'Replication is the boring part that turns a result into knowledge.',
    'A p-value is a smoke alarm, not a verdict.',
    'The interesting error bars are the ones nobody puts on the slide.',
    'Preprints are a conversation, not a conclusion.',
    'Half of a breakthrough is a better instrument.',
    'The control group is where the honesty lives.',
    'Scale changes the physics more often than people expect.',
    'A null result you can trust is worth more than a flashy one you cannot.',
  ],
  technology: [
    'Latency is a feature until it is a lawsuit.',
    'The demo always works; the migration is the real product.',
    'Every abstraction leaks, the only question is where and when.',
    'Caching is easy; cache invalidation is where the week goes.',
    'A protocol outlives every app built on it.',
    'The best feature this year is the one that quietly deleted three others.',
    'Ship the boring version first, then earn the clever one.',
    'Observability is cheaper than the outage it prevents.',
  ],
  engineering: [
    'The load case nobody modelled is the one that finds you.',
    'Tolerances stack, and they never stack in your favour.',
    'A bridge is a negotiation between wind, weight and time.',
    'The failure post-mortem is worth ten design reviews.',
    'Redundancy is not waste until the accountant sees it.',
    'Every weld is a promise you cannot inspect from the outside.',
    'Maintenance access is a first-class requirement, not an afterthought.',
    'The prototype lies about the tenth unit off the line.',
  ],
  sports: [
    'The corner that broke the game looked like nothing on the replay.',
    'Fitness in the last fifteen minutes wins more than talent does.',
    'A transfer fee is a story about next season, not this one.',
    'Set pieces are the cheapest goals and the most neglected drills.',
    'The bench decides the long tournaments.',
    'Pressing works right up until the legs stop agreeing.',
    'Home advantage is mostly sleep and mostly travel.',
    'Watch the runs off the ball, not the ball.',
  ],
  culture: [
    'The one-take shot only feels effortless because the sixth try finally landed.',
    'A festival slot is a launch pad, not a prize.',
    'Subtitles change which jokes survive the border.',
    'The B-side ages better than the single more often than you would think.',
    'Every revival is a bet that the mood came back around.',
    'Word of mouth still beats the biggest ad budget.',
    'The costume department carries half the story and gets a tenth of the credit.',
    'A cult classic is just a film that found its people late.',
  ],
  art: [
    'Panel forty-seven is where the artist finally stopped hiding.',
    'The frame is part of the work more often than galleries admit.',
    'A provenance gap is a whole novel nobody wrote down.',
    'Colour reads differently the moment the wall behind it changes.',
    'Auction ladders tell you about money, not about the painting.',
    'Restoration is a series of reversible decisions, in theory.',
    'The sketch usually has more life than the finished piece.',
    'Scale is the first thing a photograph steals from a sculpture.',
  ],
  expression: [
    'A press-freedom index is only as honest as its worst-scored source.',
    'The chapter that broke the internet was three plain sentences.',
    'Editing is deciding what the reader is allowed to miss.',
    'A retraction should be as loud as the claim it corrects.',
    'The quiet censorship is the story that never gets assigned.',
    'A byline is a small act of standing behind the words.',
    'Anonymity protects the source and tempts the fabricator; both are true.',
    'The correction column is where a newsroom keeps its dignity.',
  ],
  language: [
    'A language goes quiet one household at a time, not all at once.',
    'Loanwords are fossils of who traded with whom.',
    'The untranslatable word is usually just a habit the other side never needed.',
    'Grammar is a treaty everyone signed before they were born.',
    'A field starter kit is worth more than a grammar for the last speakers.',
    'Dialects carry the map the atlas forgot.',
    'Machine translation flattens the jokes first.',
    'Writing a language down changes it, and pretending otherwise is the mistake.',
  ],
  society: [
    'Birth-rate policy is a fifty-year bet dressed as a five-year plan.',
    'The commute is the invisible tax nobody itemises.',
    'Loneliness scales worse in the newest neighbourhoods.',
    'A census undercount becomes a decade of underfunding.',
    'Third places disappear quietly and take the small talk with them.',
    'Housing is the root cause hiding behind six other debates.',
    'Trust is cheap to spend and expensive to rebuild.',
    'The care economy is most of the economy and least of the coverage.',
  ],
  structure: [
    'A power grid seen from the roof is just a promise held up by wire.',
    'The outage post-mortem always finds a spare part nobody stocked.',
    'Redundant lines are boring right up to the blackout.',
    'Water infrastructure is invisible until the day it is the only story.',
    'A single substation can be a whole city’s single point of failure.',
    'Peak demand is a design problem pretending to be a weather problem.',
    'The last mile is where the grid gets humble.',
    'Load balancing is politics with a physics exam attached.',
  ],
  pragma: [
    'Unboxed in fifteen seconds, and the packaging cost more than the part.',
    'A zero-capital launch is mostly a list of things you decided not to buy.',
    'The night market teaches pricing better than any course.',
    'Returns are a feature; pretend otherwise and the reviews will remind you.',
    'The cheapest supplier is the most expensive delay.',
    'Cash flow kills more small shops than bad ideas do.',
    'A good checklist beats a great memory every single time.',
    'The one-person shop lives or dies on which tasks it refuses.',
  ],
  law: [
    'Courtroom vocabulary in five languages, and the nuance still gets lost at the door.',
    'A precedent is a decision that outlived the people who argued it.',
    'The dissent is where next decade’s majority is drafted.',
    'Standing is the quiet gate most cases never get through.',
    'A statute means what the last court said it means.',
    'Discovery is where the real trial happens.',
    'Plain-language drafting saves more disputes than any clause.',
    'The remedy matters more than the ruling to the person who filed.',
  ],
  institution: [
    'A regulator watch across four jurisdictions is four different definitions of the same word.',
    'The org chart is a rumour; the budget is the truth.',
    'Institutions remember through their forms, not their people.',
    'Every reform grows a new department to administer the last one.',
    'Independence is a habit, not a statute.',
    'The audit finds what the incentives were always going to produce.',
    'Mandate creep is how a small agency becomes a large one.',
    'A committee that never says no has stopped being a committee.',
  ],
  education: [
    'A theorem in one chalk line is a semester of scaffolding you didn’t see.',
    'Admissions decode into resources long before they decode into merit.',
    'The best teachers are ruthless about what to leave out.',
    'A curriculum is a set of quiet decisions about what matters.',
    'Testing measures what is easy to measure, then pretends otherwise.',
    'Class size is the intervention everyone knows and nobody funds.',
    'The dropout data hides in the transfer numbers.',
    'Learning sticks when the student teaches it back.',
  ],
  welfare: [
    'A pension tracker across twenty countries is twenty definitions of "enough".',
    'Take-up rates are the real test of any benefit.',
    'The means test costs more than the fraud it prevents, sometimes.',
    'Universal is simple; targeted is fair; you rarely get both.',
    'A safety net has to be reachable, not just fundable.',
    'Child benefit pays back over a generation, not a budget cycle.',
    'The waiting list is the policy nobody voted for.',
    'Dignity is a design requirement, not a nice-to-have.',
  ],
  health: [
    'What a night shift sounds like at 3am is the part no brochure shows.',
    'Vaccine trial phases exist so the surprises happen on paper first.',
    'Prevention is the cheapest medicine and the hardest sell.',
    'The waiting-room clock is a health outcome too.',
    'A screening programme lives or dies on its false-positive rate.',
    'Continuity of care beats any single brilliant consult.',
    'Burnout is a staffing problem wearing a wellness lanyard.',
    'The chart that matters is the one the next clinician can actually read.',
  ],
  security: [
    'A cyber-defence checklist for a small team is mostly saying no to convenience.',
    'The breach is rarely the clever exploit; it is the unpatched Tuesday.',
    'Least privilege is boring and it is the whole game.',
    'Backups you have never restored are a rumour, not a plan.',
    'The phishing test everyone passes is the one that was too easy.',
    'Defence in depth means assuming each layer already failed.',
    'A password policy that annoys people breeds sticky notes.',
    'The logs you do not read are the attack you do not see.',
  ],
  conflict: [
    'Ceasefire timelines read cleaner on paper than they ever hold on the ground.',
    'A corridor is a promise measured in hours, not intentions.',
    'The refugee route is drawn by geography, not by policy.',
    'De-escalation is a series of small reversible steps or it is nothing.',
    'Attribution is the hardest and most consequential call.',
    'The quiet front is where the next flashpoint is prepared.',
    'Supply lines decide more outcomes than heroism does.',
    'A frozen conflict is still a conflict, just patient.',
  ],
  strategy: [
    'A diplomat’s reading order tells you what they expect to be surprised by.',
    'Deterrence is a message that has to be believed to work.',
    'The summit is the photo; the sherpas did the treaty.',
    'Alliances are cheapest to build before you need them.',
    'A red line only counts if the other side thinks you mean it.',
    'Grand strategy is mostly saying no to good ideas that don’t fit.',
    'Logistics is the strategy nobody puts on the poster.',
    'The long game punishes whoever blinks at the quarterly report.',
  ],
  disaster: [
    'An earthquake early-warning primer buys seconds, and seconds save streets.',
    'The evacuation route is only as good as its slowest lane.',
    'A hundred-year flood is a name, not a schedule.',
    'Preparedness is boring until the one day it is everything.',
    'The aftershock plan is the plan people forget to write.',
    'Early warning fails at the last mile more than at the sensor.',
    'Rebuild once, or rebuild every season; that is the whole budget debate.',
    'The drill you resent is the muscle memory you will thank.',
  ],
};

/**
 * Pure: the simulated head of one room at `now`. Twelve rows, ascending in
 * time, the last within four minutes of now, each from a distinct-ish handle
 * and a non-repeating phrase. Every row satisfies isChatMessagePayload, so
 * mergeMessages and the room list render them exactly like real messages --
 * they are simply marked as simulation by the UI.
 */
export function talkPulse(room: HotNewsCategory, now: number): ChatMessage[] {
  const slot = pulseSlot(now);
  const rand = mulberry32(seedHash(`talk::${room}::${slot}`));
  const phrases = TALK_PHRASES[room] ?? [];
  if (phrases.length === 0) return [];
  const rows: ChatMessage[] = [];
  let at = now - intIn(rand, 0, 4 * 60_000);
  let prevHandle: string | null = null;
  let prevPhrase = -1;
  const step = Math.max(60_000, Math.floor(TALK_PULSE_WINDOW_MS / TALK_PULSE_COUNT));
  for (let i = TALK_PULSE_COUNT - 1; i >= 0; i--) {
    const handle = pickHandleUnlike(rand, prevHandle);
    let idx = Math.floor(rand() * phrases.length) % phrases.length;
    if (idx === prevPhrase) idx = (idx + 1) % phrases.length;
    const text = phrases[idx];
    rows.unshift({
      id: `sim:${room}:${slot}:${i}`,
      room,
      author: handle,
      authorId: `${SIM_AUTHOR_PREFIX}${handle}`,
      text,
      at,
    });
    prevHandle = handle;
    prevPhrase = idx;
    at -= step + intIn(rand, 0, step);
  }
  return rows;
}

/** Pure: a plausible live head-count for the room (7..63), seeded per slot. */
export function talkPresence(room: HotNewsCategory, now: number): number {
  const slot = pulseSlot(now);
  const rand = mulberry32(seedHash(`talk-presence::${room}::${slot}`));
  return intIn(rand, 7, 63);
}

/** Pure: is this a simulated pulse message (never "mine", never durable)? */
export function isSimulatedMessage(message: { authorId?: string } | null | undefined): boolean {
  return typeof message?.authorId === 'string' && message.authorId.startsWith(SIM_AUTHOR_PREFIX);
}

/** The pulse cadence, re-exported for the panels' refresh interval. */
export { PULSE_SLOT_MS };

/** A convenience for tests: one phrase list for a room. */
export function talkPhrasesFor(room: HotNewsCategory): readonly string[] {
  return TALK_PHRASES[room] ?? [];
}

export { pickOne };
