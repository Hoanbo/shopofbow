export type Category = 'ai-tool' | 'premium-app' | 'product';

export interface PlanTier {
  label: string;
  duration: string;
  price: number;
  originalPrice?: number;
  highlight?: boolean;
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
  rating: number;
  sold: number;
  featured?: boolean;
  badge?: string;
  features: string[];
  plans: PlanTier[];
}
