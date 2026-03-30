/**
 * NFC Namecard Admin Server
 * - http://localhost:3000 → edit.html
 * - POST /api/save → index.html CARD_DATA 업데이트 + git push
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');

const PORT = 3000;
const DIR  = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.vcf':  'text/vcard',
};

/* ── base64 → photo/ 파일로 저장 ─────────────────── */
function savePhotoFile(base64str, name) {
  if (!base64str) return '';
  if (!base64str.startsWith('data:')) return base64str; // 이미 경로
  const m = base64str.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return '';
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const buf = Buffer.from(m[2], 'base64');
  const rel = `photo/${name}.${ext}`;
  fs.mkdirSync(path.join(DIR, 'photo'), { recursive: true });
  fs.writeFileSync(path.join(DIR, rel), buf);
  return rel;
}

/* ── index.html의 CARD_DATA 블록 교체 ────────────── */
function updateCardData(d) {
  const profilePath   = savePhotoFile(d.profile,   'profile');
  const logoPath      = savePhotoFile(d.logo,      'logo');
  const frontPath     = savePhotoFile(d.cardFront, 'card_front');
  const backPath      = savePhotoFile(d.cardBack,  'card_back');

  const block = `/* %%CARD_DATA_START%% */
  const CARD_DATA = {
    company: { ko: ${JSON.stringify(d.company?.ko||'')}, en: ${JSON.stringify(d.company?.en||'')}, ja: ${JSON.stringify(d.company?.ja||'')} },
    name:    { ko: ${JSON.stringify(d.name?.ko||'')},    en: ${JSON.stringify(d.name?.en||'')},    ja: ${JSON.stringify(d.name?.ja||'')} },
    title:   { ko: ${JSON.stringify(d.title?.ko||'')},   en: ${JSON.stringify(d.title?.en||'')},   ja: ${JSON.stringify(d.title?.ja||'')} },
    dept:    { ko: ${JSON.stringify(d.dept?.ko||'')},    en: ${JSON.stringify(d.dept?.en||'')},    ja: ${JSON.stringify(d.dept?.ja||'')} },
    email:        ${JSON.stringify(d.email||'')},
    phone:        ${JSON.stringify(d.phone||'')},
    rememberLink: ${JSON.stringify(d.rememberLink||'')},
    profile:   ${JSON.stringify(profilePath)},
    logo:      ${JSON.stringify(logoPath)},
    cardFront: ${JSON.stringify(frontPath)},
    cardBack:  ${JSON.stringify(backPath)},
  };
  /* %%CARD_DATA_END%% */`;

  let html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  html = html.replace(/\/\* %%CARD_DATA_START%% \*\/[\s\S]*?\/\* %%CARD_DATA_END%% \*\//, block);
  fs.writeFileSync(path.join(DIR, 'index.html'), html);
}

/* ── Git add / commit / push ─────────────────────── */
function gitPush() {
  execSync(
    `cd "${DIR}" && git add . && git commit -m "update namecard content" && git push`,
    { stdio: 'pipe' }
  );
}

/* ── HTTP Server ─────────────────────────────────── */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  /* POST /api/save */
  if (req.method === 'POST' && url.pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        updateCardData(data);
        gitPush();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error(e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* Static files */
  let pathname = url.pathname === '/' ? '/edit.html' : url.pathname;
  const filePath = path.join(DIR, pathname);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅  Admin server running → http://localhost:${PORT}\n`);
});
