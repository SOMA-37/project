import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Mounts the saju-pipeline backend at /api/* by piggy-backing on Vite's
 * connect middleware stack. Runs in `vite` (dev) and `vite preview`. For
 * static production builds the backend must be hosted separately.
 */
function sajuApiPlugin(): Plugin {
  return {
    name: 'saju-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        try {
          const { dispatch } = await server.ssrLoadModule('/server/index.ts');
          const url = new URL(req.url, 'http://localhost');
          const handled = await dispatch(
            { pathname: url.pathname, method: req.method ?? 'GET' },
            req,
            res,
          );
          if (!handled) next();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[saju-api]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: '서버 내부 오류',
                detail: (err as Error).message,
              }),
            );
          } else {
            res.end();
          }
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        try {
          const mod = await import('./server/index.ts');
          const url = new URL(req.url, 'http://localhost');
          const handled = await mod.dispatch(
            { pathname: url.pathname, method: req.method ?? 'GET' },
            req,
            res,
          );
          if (!handled) next();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[saju-api preview]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Internal server error');
          } else {
            res.end();
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), sajuApiPlugin()],
});
