import { defineConfig } from 'astro/config';

// Static-first build, output to ./dist for Vercel deploy.
// API routes live in /api/ at the project root (Vercel-native serverless functions).
export default defineConfig({
  site: 'https://aivaluefirm.com',
  output: 'static',
  build: {
    format: 'directory',
  },
  trailingSlash: 'ignore',
});
