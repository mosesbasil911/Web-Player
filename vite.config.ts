import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/Web-Player/',
  plugins: [react()],
  resolve: {
    alias: {
      '@media-plyr': path.resolve(__dirname, 'modules/media-plyr'),
    },
  },
})
