
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:4000'
  const aiTarget = env.AI_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/ai-api': {
          target: aiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-api/, '/api/v1'),
        },
      },
    },
  }
})

