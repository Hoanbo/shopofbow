export type Category = 'ai-tool' | 'premium-app' | 'product';

export interface PlanTier {
  id?: string;
  label: string;
  duration: string;
  price: number;
  originalPrice?: number;
  priceCtv?: number;
  highlight?: boolean;
  badge?: string;
  usageType?: string;
  memberCount?: number;
  profileType?: string;
  shortDescription?: string;
  features?: string[];
  notes?: string;
}

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: Category;
  /** section grouping label shown on cards, e.g. "AI Tools" */
  group: string;
  image: string;
  /** brand accent used for the icon tile background */
  accent: string;
  price: number;
  originalPrice?: number;
  priceCtv?: number;
  affiliateEnabled?: boolean;
  affiliateType?: 'fixed' | 'percent';
  affiliateReward?: number;
  affiliateDiscount?: number;
  rating?: number;
  sold: number;
  featured?: boolean;
  badge?: string;
  features: string[];
  plans: PlanTier[];
}
