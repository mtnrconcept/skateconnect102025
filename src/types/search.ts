import type { LucideIcon } from 'lucide-react';
import type { ContentNavigationOptions, Section } from '.';

export interface GlobalSearchResult {
  key: string;
  label: string;
  category: string;
  description?: string;
  section?: Section;
  icon?: LucideIcon;
  options?: ContentNavigationOptions;
}
