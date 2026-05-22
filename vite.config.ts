import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git commit hash for build versioning
const getGitHash = () => {
  if (process.env.VITE_BUILD_HASH) {
    return process.env.VITE_BUILD_HASH
  }

  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    return 'unknown'
  }
}

// Get build timestamp
const getBuildTime = () => {
  return new Date().toISOString()
}

// Helper function to get allowed hosts from environment or use defaults
const getAllowedHosts = () => {
  const defaultHosts = [
    // Local development
    'localhost',
    '127.0.0.1',
    // Docker Desktop default hostname pattern
    '.docker.internal',
    // OrbStack domains
    '.orb.local',
    // Tailscale domains
    '.ts.net',
    // Allow all subdomains of these base domains
    'boxento-dev.boxento.orb.local',
    'boxento-prod.boxento.orb.local',
    'boxento.boxento.orb.local',
    // Allow custom domains set via environment variable
    ...(process.env.VITE_ALLOWED_HOSTS || '').split(',').filter(Boolean)
  ]
  
  return defaultHosts
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_HASH__: JSON.stringify(getGitHash()),
    __BUILD_TIME__: JSON.stringify(getBuildTime()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/mindicador': {
        target: 'https://mindicador.cl',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mindicador/, ''),
        secure: false
      },
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '/api'),
        secure: false
      }
    },
    host: true, // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    cors: true,
    // Hosts allowed for dev server
    allowedHosts: getAllowedHosts()
  },
  preview: {
    port: 5173,
    host: true, // Listen on all network interfaces
    // Use same allowed hosts for preview
    allowedHosts: getAllowedHosts()
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    cssMinify: 'lightningcss',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Put ALL node_modules in a single vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // App.tsx in its own chunk due to size
          if (id.includes('/App.tsx')) {
            return 'app';
          }

          // Let widget components be lazy-loaded into their own chunks
          // Do NOT include them in ui-components
          if (id.includes('/components/widgets/') && !id.includes('/common/')) {
            // Return undefined to let Rollup handle chunking via dynamic imports
            return undefined;
          }

          // Other components (UI, auth, etc.) in their own chunk
          if (id.includes('/components/')) {
            return 'ui-components';
          }

          // Library files (including contexts) in their own chunk
          if (id.includes('/lib/') || id.includes('/utils/')) {
            return 'lib';
          }
        }
      },
    },
    chunkSizeWarningLimit: 800, // Increased since vendor will be larger
  },
})
