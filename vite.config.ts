import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: [path.resolve(__dirname, 'index.html')],
    },
  },
  server: {
    port: 8000,
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // publicDir: './public',
  publicDir: path.resolve(__dirname, 'public'),
  worker: {
    format: 'es',
  },
  define: {
    // Inject environment variables into the app
    // In development/test, provide a placeholder VAPID key if not configured
    __VITE_VAPID_PUBLIC_KEY__: JSON.stringify(
      process.env.VITE_VAPID_PUBLIC_KEY ||
        'BOr7v8m2mJmHk2wJ8lYQ8x0kZ0nR1w0vQFz8z4g5xk7o9p9a7pQv8m8b2mJmHk2wJ8lYQ8x0kZ0nR1w0vQFz8z4g5xk',
    ),
    __VITE_BACKEND_URL__: JSON.stringify(
      process.env.VITE_BACKEND_URL || 'http://localhost:5001/hnwatch-default/us-central1/api',
    ),
    __VITE_HN_API_BASE__: JSON.stringify(
      process.env.VITE_HN_API_BASE || 'https://hacker-news.firebaseio.com',
    ),
    __VITE_ENVIRONMENT__: JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
