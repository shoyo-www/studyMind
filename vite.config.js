import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { localApiPlugin } from './dev/localApiPlugin.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }

  return {
    plugins: [
      react(),
      localApiPlugin({ projectRoot: process.cwd() }),
    ],
  }
})
