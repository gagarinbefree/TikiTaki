import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { DEPLOYMENT_CONFIG, SERVER_CONFIG, VERSION_CONFIG } from '../../tooling.config.mjs';

const root = new URL('../../', import.meta.url);
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const publishedPath = path.startsWith(DEPLOYMENT_CONFIG.basePath) ? path.slice(DEPLOYMENT_CONFIG.basePath.length) : null;
  const file =
    publishedPath === VERSION_CONFIG.filename
      ? `demos/dist/${VERSION_CONFIG.filename}`
      : publishedPath === ''
        ? 'demos/dist/index.html'
        : publishedPath !== null && /^(react|vue)\/$/.test(publishedPath)
          ? `demos/dist/${publishedPath}index.html`
          : publishedPath !== null && /^assets\/[a-zA-Z0-9_-]+\.(js|css|png)$/.test(publishedPath)
            ? `demos/dist/${publishedPath}`
            : path === '/'
              ? 'tests/browser/renderer.html'
              : path === '/swipe'
                ? 'tests/browser/swipe.html'
                : /^\/demos\/(react|vue)\/$/.test(path)
                  ? `demos/dist/${path.split('/')[2]}/index.html`
                  : /^\/assets\/[a-zA-Z0-9_-]+\.(js|css|png)$/.test(path)
                    ? `demos/dist${path}`
                    : /^\/dist\/[a-z-]+(?:\.js)?$/.test(path)
                      ? path.endsWith('.js')
                        ? path.slice(1)
                        : `${path.slice(1)}.js`
                      : null;
  if (path === '/favicon.ico') {
    response.writeHead(204);
    response.end();

    return;
  }
  if (file === null) {
    response.writeHead(404);
    response.end();

    return;
  }
  readFile(fileURLToPath(new URL(file, root))).then(
    (content) => {
      response.writeHead(200, {
        'content-type': file.endsWith('.json')
          ? 'application/json; charset=utf-8'
          : file.endsWith('.png')
            ? 'image/png'
            : file.endsWith('.html')
              ? 'text/html; charset=utf-8'
              : file.endsWith('.css')
                ? 'text/css; charset=utf-8'
                : 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(content);
    },
    () => {
      response.writeHead(404);
      response.end();
    },
  );
});
server.listen(SERVER_CONFIG.testPort, SERVER_CONFIG.host);
