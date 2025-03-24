import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'splashscreens/*'],
      manifest: {
        name: 'Hallopdf - Document & Image Tools',
        short_name: 'Hallopdf',
        theme_color: '#4f46e5',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/docs\.opencv\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opencv-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              fetchOptions: {
                mode: 'cors',
                credentials: 'omit',
              },
              backgroundSync: {
                name: 'unsplash-sync',
                options: {
                  maxRetentionTime: 24 * 60,
                },
              },
            },
          },
          {
            urlPattern: /^https:\/\/pagead2\.googlesyndication\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'adsense-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: /\.(js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            urlPattern: /opencv\.js$/,
            handler: 'NetworkOnly',
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  optimizeDeps: {
    exclude: [],
  },
  resolve: {
    alias: {
      path: 'path-browserify',
      '@workers': '/src/workers',
    },
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=self',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  },
  build: {
    target: ['es2020'],
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('opencv')) {
              return 'opencv';
            }
            if (id.includes('react')) {
              return 'react';
            }
            return 'vendor';
          }
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
      },
    },
  },
});