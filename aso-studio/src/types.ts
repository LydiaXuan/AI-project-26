export type KeywordCategory = 'action' | 'entity' | 'emotion' | 'genre';

export interface KeywordMetric {
  word: string;
  count: number;
  density: number; // Percentage e.g. 2.4
  category: KeywordCategory;
  translation?: string;
}

export interface CompetitorInfo {
  id: string;
  name: string;
  url: string;
  iconUrl?: string;
  title: string;
  titleZh: string;
  shortDescription: string;
  shortDescriptionZh: string;
  longDescription: string;
  longDescriptionZh: string;
  downloads: string;
  rating: number;
  category: string;
  keywords: KeywordMetric[];
  coreFeatures: string[];
  commonPoints: string[];
  differentiationPoints: string[];
}

export interface AsoCopy {
  appName: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  targetKeywords: string[];
  subGenre: string;
}

export interface ReleaseNotesVariant {
  highlights: string;
  concise: string;
  exciting: string;
}

export interface ReleaseNotes {
  version: string;
  english: ReleaseNotesVariant;
  chinese: ReleaseNotesVariant;
}

export interface StoreScreenshot {
  id: string;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  bgColor: string;
  mockType: 'demolition' | 'physics' | 'cannon' | 'levels' | 'rewards';
}

export interface Project {
  id: string;
  name: string;
  packageName: string;
  category: string;
  updatedAt: string;
  targetKeywords: string[];
  competitors: CompetitorInfo[];
  asoCopy: AsoCopy;
  releaseNotes?: ReleaseNotes;
}

