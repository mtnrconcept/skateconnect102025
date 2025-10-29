export interface Objective {
  id: string;
  name: string;
  description: string;
  recommendedBudget: string;
  successMetrics: string[];
  reachMultiplier: number;
  engagementMultiplier: number;
}

export interface Audience {
  id: string;
  name: string;
  description: string;
  sizeRange: string;
  profileHighlights: string[];
  baseCpm: number;
  baseCpc: number;
  clickThroughRate: number;
  reachRate: number;
}

export type CreativeFormat = 'image' | 'video' | 'carousel';

export interface Creative {
  format: CreativeFormat;
  headline: string;
  subheadline?: string;
  message: string;
  callToAction: string;
  landingUrl: string;
  mediaUrl?: string;
  tone: 'community' | 'product' | 'event';
  primaryColor: string;
  accentColor: string;
}

export interface CampaignDraft {
  name: string;
  objectiveId: Objective['id'];
  audienceId: Audience['id'];
  budget: number;
  startDate: string;
  endDate: string;
  placements: string[];
  optimization: 'reach' | 'clicks' | 'conversions';
  creative: Creative;
  frequencyCap: number;
  locations: string[];
  interests: string[];
  ageRange: [number, number];
  notes?: string;
}

export interface EstimationResult {
  reach: number;
  impressions: number;
  clicks: number;
  views: number;
  engagements: number;
  ctr: number;
  cpm: number;
  cpc: number;
  confidence: 'low' | 'medium' | 'high';
  narrative: string;
  highlights: string[];
}
