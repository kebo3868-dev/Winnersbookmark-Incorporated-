import { useEffect } from 'react';
import { site } from '../data/site';

// Lightweight document-title + meta-description manager for SEO without
// pulling in a helmet dependency.
export function useMeta(title, description) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${site.name}` : site.fullName;
    document.title = fullTitle;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }
  }, [title, description]);
}
