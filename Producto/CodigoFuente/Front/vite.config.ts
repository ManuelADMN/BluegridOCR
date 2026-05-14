import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

const certFile = process.env.VITE_SSL_CERTFILE
const keyFile = process.env.VITE_SSL_KEYFILE
const hasHttpsCerts = Boolean(
  process.env.VITE_HTTPS === 'true' &&
  certFile &&
  keyFile &&
  fs.existsSync(certFile) &&
  fs.existsSync(keyFile)
)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    https: hasHttpsCerts
      ? {
          cert: fs.readFileSync(certFile as string),
          key: fs.readFileSync(keyFile as string),
        }
      : undefined,
  },
})
