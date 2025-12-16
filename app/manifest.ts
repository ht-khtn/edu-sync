import type { MetadataRoute } from 'next'
import { BUILD_INFO } from '@/configs/generated/build-info'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Make manifest identity/version deterministic per build.
    // `id` is a standard manifest field; changing it helps clients detect updates.
    id: `/manifest.webmanifest?v=${encodeURIComponent(BUILD_INFO.version)}`,
    name: 'EduSync - Hệ thống Quản lý Phong Trào',
    short_name: 'EduSync',
    description: 'Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#000000',
    background_color: '#ffffff',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/globe.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/file.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/window.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
