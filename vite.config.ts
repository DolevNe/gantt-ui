import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /jira/* is proxied to your Jira so the browser stays same-origin
// (Jira Server does not send CORS headers for other origins).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.JIRA_URL;
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: target
        ? {
            '/jira': {
              target,
              changeOrigin: true,
              secure: env.JIRA_TLS_VERIFY !== 'false',
              rewrite: (path) => path.replace(/^\/jira/, ''),
              cookieDomainRewrite: '',
            },
          }
        : undefined,
    },
  };
});
