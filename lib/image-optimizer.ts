/**
 * Image Optimization Utilities
 * 
 * Provides helpers for:
 * - Responsive image sizing (srcset, sizes attribute)
 * - AVIF/WebP format detection and fallback
 * - Image quality optimization
 * - Loading strategy (eager/lazy)
 * 
 * Usage:
 * ```tsx
 * import { getImageSizes, getResponsiveImage } from '@/lib/image-optimizer'
 * 
 * <Image
 *   src={imageSrc}
 *   alt="Description"
 *   sizes={getImageSizes('hero')}
 *   {...getResponsiveImage('hero')}
 * />
 * ```
 */

/**
 * Image size presets for different layouts
 */
export const IMAGE_SIZE_PRESETS = {
  // Hero/banner images (full width)
  hero: {
    mobile: 480,
    tablet: 768,
    desktop: 1920,
    quality: 80,
    sizes: '(max-width: 768px) 100vw, (max-width: 1920px) 100vw, 1920px',
  },
  
  // Card/thumbnail images
  card: {
    mobile: 280,
    tablet: 320,
    desktop: 400,
    quality: 75,
    sizes: '(max-width: 768px) 280px, (max-width: 1024px) 320px, 400px',
  },
  
  // Avatar/profile images
  avatar: {
    mobile: 48,
    tablet: 64,
    desktop: 96,
    quality: 85,
    sizes: '(max-width: 640px) 48px, (max-width: 1024px) 64px, 96px',
  },
  
  // Article/blog feature images
  article: {
    mobile: 400,
    tablet: 600,
    desktop: 800,
    quality: 80,
    sizes: '(max-width: 768px) 400px, (max-width: 1024px) 600px, 800px',
  },
  
  // Icon/logo images
  icon: {
    mobile: 32,
    tablet: 48,
    desktop: 64,
    quality: 90,
    sizes: '(max-width: 768px) 32px, (max-width: 1024px) 48px, 64px',
  },
  
  // Full-width responsive images
  fullWidth: {
    mobile: 640,
    tablet: 1024,
    desktop: 1920,
    quality: 80,
    sizes: '(max-width: 768px) 640px, (max-width: 1024px) 1024px, 1920px',
  },
} as const;

export type ImagePresetKey = keyof typeof IMAGE_SIZE_PRESETS;

/**
 * Get CSS sizes attribute for responsive images
 * 
 * @param preset - Preset name from IMAGE_SIZE_PRESETS
 * @returns sizes string for next/image
 * 
 * @example
 * ```tsx
 * <Image sizes={getImageSizes('hero')} />
 * ```
 */
export function getImageSizes(preset: ImagePresetKey): string {
  return IMAGE_SIZE_PRESETS[preset].sizes;
}

/**
 * Get responsive image configuration
 * 
 * @param preset - Preset name
 * @param loading - eager or lazy
 * @returns Object with priority, quality, and loading props
 * 
 * @example
 * ```tsx
 * <Image {...getResponsiveImage('hero', 'eager')} />
 * ```
 */
export function getResponsiveImage(
  preset: ImagePresetKey,
  loading: 'eager' | 'lazy' = 'lazy'
): {
  priority: boolean;
  quality: number;
  loading: 'lazy' | 'eager';
} {
  const preset_config = IMAGE_SIZE_PRESETS[preset];
  
  return {
    priority: loading === 'eager',
    quality: preset_config.quality,
    loading: loading as 'lazy' | 'eager',
  };
}

/**
 * Generate CloudFlare Image Optimization URL
 * 
 * For Supabase Storage images, you can use CloudFlare Workers
 * to optimize and transform images on-the-fly
 * 
 * @param imageUrl - Original image URL
 * @param width - Target width
 * @param height - Target height (optional)
 * @param quality - Quality 1-100
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  imageUrl: string,
  width: number,
  height?: number,
  quality: number = 80
): string {
  // For Supabase Storage, we could use a transform URL
  // This is a placeholder - implement based on your CDN strategy
  
  try {
    const url = new URL(imageUrl);
    
    // Add optimization params as query string
    url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    url.searchParams.set('q', quality.toString());
    url.searchParams.set('fm', 'auto'); // Auto format (AVIF/WebP)
    
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return imageUrl;
  }
}

/**
 * Check if browser supports WebP format
 * 
 * @returns true if WebP is supported
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').includes('image/webp');
  } catch {
    return false;
  }
}

/**
 * Check if browser supports AVIF format
 * 
 * @returns true if AVIF is supported
 */
export function supportsAVIF(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/avif').includes('image/avif');
  } catch {
    return false;
  }
}

/**
 * Get best image format based on browser support
 * 
 * @returns 'avif' | 'webp' | 'jpg'
 */
export function getBestImageFormat(): 'avif' | 'webp' | 'jpg' {
  if (typeof window === 'undefined') return 'jpg';
  
  if (supportsAVIF()) return 'avif';
  if (supportsWebP()) return 'webp';
  return 'jpg';
}

/**
 * Image loading strategy
 * 
 * Determines if image should be eagerly loaded (priority)
 * based on viewport position and image importance
 */
export const IMAGE_LOADING_STRATEGY = {
  /** Critical images (above the fold, hero sections) */
  critical: 'eager' as const,
  
  /** Important images (main content area) */
  important: 'lazy' as const,
  
  /** Non-critical images (below the fold) */
  normal: 'lazy' as const,
  
  /** Background/decorative images */
  background: 'lazy' as const,
} as const;

/**
 * AVIF/WebP Image Response with fallback
 * 
 * Generate a complete picture element with modern format support
 * 
 * @param src - Image URL
 * @param alt - Alt text
 * @param width - Width
 * @param height - Height
 * @param sizes - Sizes attribute
 * @returns HTML for picture element with AVIF, WebP, and JPG fallback
 */
export function getPictureHtml(
  src: string,
  alt: string,
  width: number,
  height: number,
  sizes: string
): string {
  const baseUrl = src.split('?')[0]; // Remove query params
  const ext = baseUrl.split('.').pop();
  const baseSrc = baseUrl.substring(0, baseUrl.lastIndexOf('.'));
  
  return `
    <picture>
      <!-- AVIF format for modern browsers (smallest) -->
      <source 
        srcSet="${baseSrc}.avif" 
        type="image/avif" 
        sizes="${sizes}"
      />
      <!-- WebP format for good compression -->
      <source 
        srcSet="${baseSrc}.webp" 
        type="image/webp" 
        sizes="${sizes}"
      />
      <!-- Fallback to original format -->
      <img 
        src="${src}" 
        alt="${alt}"
        width="${width}"
        height="${height}"
        sizes="${sizes}"
        loading="lazy"
        decoding="async"
      />
    </picture>
  `.trim();
}

/**
 * Calculate aspect ratio from width and height
 * 
 * @param width - Image width
 * @param height - Image height
 * @returns aspect-ratio as decimal
 */
export function getAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Generate srcSet for responsive images
 * 
 * Creates multiple image URLs for different resolutions
 * 
 * @param baseUrl - Base image URL
 * @param widths - Array of widths to generate
 * @returns srcSet string
 */
export function generateSrcSet(baseUrl: string, widths: number[]): string {
  return widths
    .map(width => `${getOptimizedImageUrl(baseUrl, width)} ${width}w`)
    .join(', ');
}

/**
 * Image optimization recommendations by content type
 */
export const IMAGE_RECOMMENDATIONS = {
  hero: {
    description: 'Full-width banner images',
    formats: ['avif', 'webp', 'jpg'],
    quality: 80,
    maxWidth: 1920,
    useWebP: true,
    useAVIF: true,
    preset: 'hero' as const,
  },
  card: {
    description: 'Card and thumbnail images',
    formats: ['webp', 'jpg'],
    quality: 75,
    maxWidth: 400,
    useWebP: true,
    useAVIF: false,
    preset: 'card' as const,
  },
  avatar: {
    description: 'User avatar and profile images',
    formats: ['webp', 'jpg'],
    quality: 85,
    maxWidth: 96,
    useWebP: true,
    useAVIF: true,
    preset: 'avatar' as const,
  },
  icon: {
    description: 'Icons and logos',
    formats: ['png', 'svg'],
    quality: 95,
    maxWidth: 64,
    useWebP: false,
    useAVIF: false,
    preset: 'icon' as const,
  },
  article: {
    description: 'Article and blog feature images',
    formats: ['avif', 'webp', 'jpg'],
    quality: 80,
    maxWidth: 800,
    useWebP: true,
    useAVIF: true,
    preset: 'article' as const,
  },
} as const;
