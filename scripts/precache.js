// Schreibt nach dem Web-Build eine Liste aller App-Dateien nach dist/precache.json.
// Der Service Worker lädt sie beim Installieren, damit die App auch offline startet.
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push('/' + path.relative(dist, full).split(path.sep).join('/'));
  }
}
for (const sub of ['_expo', 'assets']) if (fs.existsSync(path.join(dist, sub))) walk(path.join(dist, sub));
fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify(files));

// Kennung des Builds an den Service Worker hängen: so merkt das Handy bei jedem
// Update, dass es die neuen Dateien vorab laden soll.
const sw = path.join(dist, 'sw.js');
const build = require('crypto').createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
if (fs.existsSync(sw)) fs.appendFileSync(sw, `\n// build ${build}\n`);
console.log(`precache.json: ${files.length} Dateien`);
