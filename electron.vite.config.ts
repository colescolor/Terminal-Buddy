import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: { '@shared': shared, '@': resolve(__dirname, 'src/renderer/src') }
    },
    plugins: [react(), {
      name: 'record-renderer-runtime-dependencies',
      generateBundle() {
        const names = new Set<string>()
        for (const id of this.getModuleIds()) {
          const match = id.replaceAll('\\', '/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
          if (match) names.add(match[1])
        }
        this.emitFile({ type: 'asset', fileName: 'runtime-dependencies.json', source: JSON.stringify([...names].sort()) })
      }
    }]
  }
})
