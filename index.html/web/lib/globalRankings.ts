import { Landmark, TrendingUp, Trophy, Mountain, Waves, Building2, Users2, Clapperboard, type LucideIcon } from 'lucide-react';

// The 핫이슈 tab's "하이브리드 테마 랭킹 위젯" (owner instruction 2026-09-04): a
// row of theme chips sitting directly above HotIssueNewsList's live feed.
// Tapping a chip expands its top-10 countdown; "더보기" progressively widens
// the visible window (LOAD_MORE_TIERS). Every ranked row here is a factual,
// independently verifiable snapshot (heritage-site counts, elevations,
// river lengths, nominal GDP, box-office gross, population, building
// height, historical milestones) -- deliberately NOT extended with invented
// filler once real data runs out, so `entries.length` legitimately varies
// per theme and the widget shows a "collectingMore" state past it rather
// than fabricate ranks nobody can source. Entry labels stay in English
// across every locale by design (proper nouns / figures a Korean, Thai, or
// Estonian visitor reads identically) -- only the theme title/description
// and the widget's chrome strings are localized (messages/*.json →
// `GlobalRankings` namespace).

export type GlobalRankingThemeKey =
  | 'heritage'
  | 'gdp'
  | 'records'
  | 'mountains'
  | 'rivers'
  | 'buildings'
  | 'population'
  | 'filmBoxOffice';

export interface GlobalRankingEntry {
  /** Rank position, 1-indexed. */
  rank: number;
  /** The ranked subject -- a country, structure, film, or milestone. Kept
   *  untranslated (see file banner). */
  name: string;
  /** Short factual qualifier shown beside the name (figure, year, location). */
  note: string;
}

export interface GlobalRankingTheme {
  key: GlobalRankingThemeKey;
  icon: LucideIcon;
  color: string;
  entries: GlobalRankingEntry[];
}

/** Progressive reveal windows the "더보기" button steps through. */
export const LOAD_MORE_TIERS = [10, 20, 50, 100] as const;

export const GLOBAL_RANKING_THEMES: GlobalRankingTheme[] = [
  {
    key: 'heritage',
    icon: Landmark,
    color: '#facc15',
    entries: [
      { rank: 1, name: 'Italy', note: '60 sites' },
      { rank: 2, name: 'China', note: '59 sites' },
      { rank: 3, name: 'Germany', note: '54 sites' },
      { rank: 4, name: 'France', note: '53 sites' },
      { rank: 5, name: 'Spain', note: '50 sites' },
      { rank: 6, name: 'India', note: '43 sites' },
      { rank: 7, name: 'Mexico', note: '35 sites' },
      { rank: 8, name: 'United Kingdom', note: '34 sites' },
      { rank: 9, name: 'Russia', note: '32 sites' },
      { rank: 10, name: 'Iran', note: '28 sites' },
      { rank: 11, name: 'United States', note: '26 sites' },
      { rank: 12, name: 'Japan', note: '26 sites' },
      { rank: 13, name: 'Brazil', note: '23 sites' },
      { rank: 14, name: 'Türkiye', note: '21 sites' },
      { rank: 15, name: 'Greece', note: '19 sites' },
      { rank: 16, name: 'Portugal', note: '18 sites' },
      { rank: 17, name: 'Poland', note: '17 sites' },
      { rank: 18, name: 'Czechia', note: '16 sites' },
      { rank: 19, name: 'Belgium', note: '15 sites' },
      { rank: 20, name: 'Sweden', note: '15 sites' },
    ],
  },
  {
    key: 'gdp',
    icon: TrendingUp,
    color: '#60a5fa',
    entries: [
      { rank: 1, name: 'United States', note: '~$27T nominal GDP' },
      { rank: 2, name: 'China', note: '~$18T' },
      { rank: 3, name: 'Germany', note: '~$4.5T' },
      { rank: 4, name: 'Japan', note: '~$4.1T' },
      { rank: 5, name: 'India', note: '~$3.9T' },
      { rank: 6, name: 'United Kingdom', note: '~$3.3T' },
      { rank: 7, name: 'France', note: '~$3.0T' },
      { rank: 8, name: 'Brazil', note: '~$2.3T' },
      { rank: 9, name: 'Italy', note: '~$2.3T' },
      { rank: 10, name: 'Canada', note: '~$2.1T' },
      { rank: 11, name: 'Russia', note: '~$2.0T' },
      { rank: 12, name: 'South Korea', note: '~$1.8T' },
      { rank: 13, name: 'Australia', note: '~$1.7T' },
      { rank: 14, name: 'Spain', note: '~$1.6T' },
      { rank: 15, name: 'Mexico', note: '~$1.5T' },
      { rank: 16, name: 'Indonesia', note: '~$1.4T' },
      { rank: 17, name: 'Netherlands', note: '~$1.1T' },
      { rank: 18, name: 'Saudi Arabia', note: '~$1.1T' },
      { rank: 19, name: 'Türkiye', note: '~$1.1T' },
      { rank: 20, name: 'Switzerland', note: '~$0.9T' },
    ],
  },
  {
    key: 'records',
    icon: Trophy,
    color: '#e879f9',
    entries: [
      { rank: 1, name: 'Cuneiform script invented', note: 'Sumer, c. 3400 BCE' },
      { rank: 2, name: 'Great Pyramid of Giza completed', note: 'Egypt, c. 2560 BCE' },
      { rank: 3, name: 'Code of Hammurabi inscribed', note: 'Babylon, c. 1754 BCE' },
      { rank: 4, name: 'Great Wall of China begun', note: 'China, 7th century BCE' },
      { rank: 5, name: 'Library of Alexandria founded', note: 'Egypt, c. 285 BCE' },
      { rank: 6, name: 'Gutenberg printing press', note: 'Germany, c. 1440' },
      { rank: 7, name: "Newton's Principia Mathematica", note: 'England, 1687' },
      { rank: 8, name: 'First industrial steam engine', note: 'England, 1776' },
      { rank: 9, name: 'Transatlantic telegraph cable', note: '1866' },
      { rank: 10, name: "Wright brothers' first powered flight", note: 'USA, 1903' },
      { rank: 11, name: 'Penicillin discovered', note: 'UK, 1928' },
      { rank: 12, name: 'First human spaceflight, Yuri Gagarin', note: 'USSR, 1961' },
      { rank: 13, name: 'Apollo 11 Moon landing', note: 'USA, 1969' },
      { rank: 14, name: 'World Wide Web invented', note: 'CERN, 1989' },
      { rank: 15, name: 'Human Genome Project completed', note: '2003' },
      { rank: 16, name: 'First reusable orbital rocket landing', note: 'SpaceX, 2015' },
    ],
  },
  {
    key: 'mountains',
    icon: Mountain,
    color: '#38bdf8',
    entries: [
      { rank: 1, name: 'Mount Everest', note: 'Nepal/China · 8,849m' },
      { rank: 2, name: 'K2', note: 'Pakistan/China · 8,611m' },
      { rank: 3, name: 'Kangchenjunga', note: 'Nepal/India · 8,586m' },
      { rank: 4, name: 'Lhotse', note: 'Nepal/China · 8,516m' },
      { rank: 5, name: 'Makalu', note: 'Nepal/China · 8,485m' },
      { rank: 6, name: 'Cho Oyu', note: 'Nepal/China · 8,188m' },
      { rank: 7, name: 'Dhaulagiri I', note: 'Nepal · 8,167m' },
      { rank: 8, name: 'Manaslu', note: 'Nepal · 8,163m' },
      { rank: 9, name: 'Nanga Parbat', note: 'Pakistan · 8,126m' },
      { rank: 10, name: 'Annapurna I', note: 'Nepal · 8,091m' },
      { rank: 11, name: 'Gasherbrum I', note: 'Pakistan/China · 8,080m' },
      { rank: 12, name: 'Broad Peak', note: 'Pakistan/China · 8,051m' },
      { rank: 13, name: 'Gasherbrum II', note: 'Pakistan/China · 8,035m' },
      { rank: 14, name: 'Shishapangma', note: 'China · 8,027m' },
      { rank: 15, name: 'Aconcagua', note: 'Argentina · 6,961m' },
      { rank: 16, name: 'Denali', note: 'USA · 6,190m' },
      { rank: 17, name: 'Kilimanjaro', note: 'Tanzania · 5,895m' },
      { rank: 18, name: 'Mount Elbrus', note: 'Russia · 5,642m' },
      { rank: 19, name: 'Vinson Massif', note: 'Antarctica · 4,892m' },
      { rank: 20, name: 'Puncak Jaya', note: 'Indonesia · 4,884m' },
    ],
  },
  {
    key: 'rivers',
    icon: Waves,
    color: '#2dd4bf',
    entries: [
      { rank: 1, name: 'Nile', note: 'Africa · ~6,650km' },
      { rank: 2, name: 'Amazon', note: 'South America · ~6,400km' },
      { rank: 3, name: 'Yangtze', note: 'China · ~6,300km' },
      { rank: 4, name: 'Mississippi–Missouri', note: 'USA · ~6,275km' },
      { rank: 5, name: 'Yenisei–Angara', note: 'Russia · ~5,539km' },
      { rank: 6, name: 'Yellow River (Huang He)', note: 'China · ~5,464km' },
      { rank: 7, name: 'Ob–Irtysh', note: 'Russia/Kazakhstan · ~5,410km' },
      { rank: 8, name: 'Congo', note: 'Africa · ~4,700km' },
      { rank: 9, name: 'Amur–Argun', note: 'Russia/China · ~4,444km' },
      { rank: 10, name: 'Lena', note: 'Russia · ~4,400km' },
      { rank: 11, name: 'Mekong', note: 'Southeast Asia · ~4,350km' },
      { rank: 12, name: 'Mackenzie', note: 'Canada · ~4,241km' },
      { rank: 13, name: 'Niger', note: 'West Africa · ~4,180km' },
      { rank: 14, name: 'Brahmaputra', note: 'Asia · ~3,969km' },
      { rank: 15, name: 'Murray–Darling', note: 'Australia · ~3,672km' },
      { rank: 16, name: 'Volga', note: 'Russia · ~3,531km' },
      { rank: 17, name: 'Madeira', note: 'South America · ~3,250km' },
      { rank: 18, name: 'Purus', note: 'South America · ~3,211km' },
      { rank: 19, name: 'Yukon', note: 'Canada/USA · ~3,190km' },
      { rank: 20, name: 'Indus', note: 'Asia · ~3,180km' },
    ],
  },
  {
    key: 'buildings',
    icon: Building2,
    color: '#c084fc',
    entries: [
      { rank: 1, name: 'Burj Khalifa', note: 'Dubai · 828m' },
      { rank: 2, name: 'Merdeka 118', note: 'Kuala Lumpur · 679m' },
      { rank: 3, name: 'Shanghai Tower', note: 'Shanghai · 632m' },
      { rank: 4, name: 'Abraj Al-Bait Clock Tower', note: 'Mecca · 601m' },
      { rank: 5, name: 'Ping An Finance Center', note: 'Shenzhen · 599m' },
      { rank: 6, name: 'Lotte World Tower', note: 'Seoul · 555m' },
      { rank: 7, name: 'One World Trade Center', note: 'New York · 541m' },
      { rank: 8, name: 'Guangzhou CTF Finance Centre', note: 'Guangzhou · 530m' },
      { rank: 9, name: 'Tianjin CTF Finance Centre', note: 'Tianjin · 530m' },
      { rank: 10, name: 'CITIC Tower', note: 'Beijing · 528m' },
      { rank: 11, name: 'Taipei 101', note: 'Taipei · 508m' },
      { rank: 12, name: 'Shanghai World Financial Center', note: 'Shanghai · 492m' },
      { rank: 13, name: 'International Commerce Centre', note: 'Hong Kong · 484m' },
      { rank: 14, name: 'Central Park Tower', note: 'New York · 472m' },
      { rank: 15, name: 'Lakhta Center', note: 'St. Petersburg · 462m' },
      { rank: 16, name: 'Vincom Landmark 81', note: 'Ho Chi Minh City · 461m' },
      { rank: 17, name: 'Changsha IFS Tower T1', note: 'Changsha · 452m' },
      { rank: 18, name: 'Petronas Towers', note: 'Kuala Lumpur · 452m' },
      { rank: 19, name: 'Suzhou IFS', note: 'Suzhou · 450m' },
      { rank: 20, name: 'Zifeng Tower', note: 'Nanjing · 450m' },
    ],
  },
  {
    key: 'population',
    icon: Users2,
    color: '#34d399',
    entries: [
      { rank: 1, name: 'India', note: '~1.44B' },
      { rank: 2, name: 'China', note: '~1.41B' },
      { rank: 3, name: 'United States', note: '~340M' },
      { rank: 4, name: 'Indonesia', note: '~280M' },
      { rank: 5, name: 'Pakistan', note: '~250M' },
      { rank: 6, name: 'Nigeria', note: '~230M' },
      { rank: 7, name: 'Brazil', note: '~217M' },
      { rank: 8, name: 'Bangladesh', note: '~173M' },
      { rank: 9, name: 'Russia', note: '~144M' },
      { rank: 10, name: 'Mexico', note: '~130M' },
      { rank: 11, name: 'Ethiopia', note: '~127M' },
      { rank: 12, name: 'Japan', note: '~123M' },
      { rank: 13, name: 'Philippines', note: '~118M' },
      { rank: 14, name: 'Egypt', note: '~116M' },
      { rank: 15, name: 'DR Congo', note: '~102M' },
      { rank: 16, name: 'Vietnam', note: '~100M' },
      { rank: 17, name: 'Iran', note: '~89M' },
      { rank: 18, name: 'Türkiye', note: '~87M' },
      { rank: 19, name: 'Germany', note: '~84M' },
      { rank: 20, name: 'Thailand', note: '~72M' },
    ],
  },
  {
    key: 'filmBoxOffice',
    icon: Clapperboard,
    color: '#fb7185',
    entries: [
      { rank: 1, name: 'Avatar', note: '2009 · ~$2.92B' },
      { rank: 2, name: 'Avengers: Endgame', note: '2019 · ~$2.80B' },
      { rank: 3, name: 'Avatar: The Way of Water', note: '2022 · ~$2.32B' },
      { rank: 4, name: 'Titanic', note: '1997 · ~$2.26B' },
      { rank: 5, name: 'Star Wars: The Force Awakens', note: '2015 · ~$2.07B' },
      { rank: 6, name: 'Avengers: Infinity War', note: '2018 · ~$2.05B' },
      { rank: 7, name: 'Spider-Man: No Way Home', note: '2021 · ~$1.92B' },
      { rank: 8, name: 'Inside Out 2', note: '2024 · ~$1.70B' },
      { rank: 9, name: 'Jurassic World', note: '2015 · ~$1.67B' },
      { rank: 10, name: 'The Lion King', note: '2019 · ~$1.66B' },
      { rank: 11, name: 'The Avengers', note: '2012 · ~$1.52B' },
      { rank: 12, name: 'Furious 7', note: '2015 · ~$1.52B' },
      { rank: 13, name: 'Top Gun: Maverick', note: '2022 · ~$1.49B' },
      { rank: 14, name: 'Frozen II', note: '2019 · ~$1.45B' },
      { rank: 15, name: 'Barbie', note: '2023 · ~$1.45B' },
      { rank: 16, name: 'Avengers: Age of Ultron', note: '2015 · ~$1.40B' },
      { rank: 17, name: 'The Super Mario Bros. Movie', note: '2023 · ~$1.36B' },
      { rank: 18, name: 'Black Panther', note: '2018 · ~$1.35B' },
      { rank: 19, name: 'Harry Potter and the Deathly Hallows – Part 2', note: '2011 · ~$1.34B' },
      { rank: 20, name: 'Star Wars: The Last Jedi', note: '2017 · ~$1.33B' },
    ],
  },
];
