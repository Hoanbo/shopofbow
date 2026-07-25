import { useEffect } from 'react';

export interface SeoInput {
  title?: string;
  description?: string;
  image?: string;
  /** og:type — website (default) or product */
  type?: 'website' | 'product' | 'article';
}

const SITE_NAME = "BOW — Let's Connect";
const DEFAULT_DESC =
  'Cửa hàng AI Tools & Premium Apps chính chủ: ChatGPT, Claude, Netflix, Spotify, Canva... giá tốt, bảo hành đầy đủ, hỗ trợ 24/7.';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Sets document title + description + Open Graph tags dynamically.
 * Call once per page with the page-specific values.
 */
export function useSeo({ title, description, image, type = 'website' }: SeoInput) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
    const desc = description || DEFAULT_DESC;
    const url = window.location.href;
    const img = image ? new URL(image, window.location.origin).href : `${window.location.origin}/assets/bowLogo.jpeg`;

    document.title = fullTitle;

    setMeta('name', 'description', desc);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);
  }, [title, description, image, type]);
}
