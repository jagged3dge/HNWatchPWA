import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: '.',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: env.NODE_ENV === 'development',
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
      __VITE_VAPID_PUBLIC_KEY__: JSON.stringify(env.VITE_VAPID_PUBLIC_KEY),
      __VITE_BACKEND_URL__: JSON.stringify(
        env.VITE_BACKEND_URL || 'http://localhost:5001/hnwatch-default/us-central1',
      ),
      __VITE_HN_API_BASE__: JSON.stringify(
        env.VITE_HN_API_BASE || 'https://hacker-news.firebaseio.com',
      ),
      __VITE_ENVIRONMENT__: JSON.stringify(env.NODE_ENV || 'development'),
    },
  };
});
