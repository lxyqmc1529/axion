import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'


// import { nodePolyfills } from 'vite-plugin-node-polyfills'
// import nodeGlobals from 'rollup-plugin-node-globals'


// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
})
