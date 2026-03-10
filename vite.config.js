import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import process from 'process'
import { exec } from 'child_process'

function teaAdminPlugin() {
  return {
    name: 'tea-admin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.endsWith('/api/teas') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const filePath = path.join(process.cwd(), 'src', 'data', 'teas.json');
              fs.writeFileSync(filePath, body);

              exec('npm run update-ai', (error) => {
                if (error) {
                  console.error('AI Update error:', error);
                  res.statusCode = 500;
                  res.end('Error recomputing AI models');
                  return;
                }
                res.statusCode = 200;
                res.end('OK');
              });
            } catch (err) {
              res.statusCode = 500;
              res.end(err.message);
            }
          });
        } else {
          next();
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/tea-db/',
  plugins: [react(), teaAdminPlugin()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.loc?.file?.includes('onnxruntime-web')) return;
        warn(warning);
      }
    }
  }
})
