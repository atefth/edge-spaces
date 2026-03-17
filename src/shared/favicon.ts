import { FAVICON_BASE_URL } from './constants';

export function getFaviconUrl(url: string, size: 16 | 32 = 16): string {
  try {
    const parsedUrl = new URL(url);

    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return '';
    }

    return `${FAVICON_BASE_URL}?domain=${parsedUrl.hostname}&sz=${size}`;
  } catch {
    return '';
  }
}