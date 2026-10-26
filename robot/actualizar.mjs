// Robot de Miller Preciado al Día — Vibras Positivas HM
// Corre en GitHub Actions cada 30 minutos. Node 20+, sin dependencias.
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVO = new URL('../data/noticias.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; VibrasPositivasHM-Robot/1.0; +https://github.com/haroldco45)';
// Su sitio millerpreciado.com está hackeado (redirige a apuestas): nunca se enlaza ni se lee
const BLOQUEO = /millerpreciado\.com|slot|gacor|togel|casino|judi|daftar/i;
const seguro = (l) => l.filter((n) => !BLOQUEO.test(`${n.link || ''} ${n.titulo || ''} ${n.imagen || ''}`));
const FOTOS_PROPIAS = ['img/reel-arandanos.jpg', 'img/reel-dream-berries.jpg', 'img/reel-estudio.jpg'];

const NOTICIAS = [
  'https://news.google.com/rss/search?q=%22Miller+Preciado%22&hl=es-419&gl=CO&ceid=CO:es-419',
  'https://news.google.com/rss/search?q=%22Agroventure+Capital%22&hl=es-419&gl=CO&ceid=CO:es-419',
  'https://news.google.com/rss/search?q=%22Miller+Preciado%22&hl=en-US&gl=US&ceid=US:en',
  'https://www.bing.com/news/search?q=%22Miller+Preciado%22&format=rss&setlang=es',
];
const PODCAST = 'https://anchor.fm/s/f17c5578/podcast/rss';
const COLUMNAS = [
  ['https://mascolombia.com/author/miller-preciado/feed/', 'Más Colombia'],
];

async function traer(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

const des = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const limpio = (s = '') => des(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };
const attr = (xml, t, a) => { const m = xml.match(new RegExp(`<${t}[^>]*\\s${a}="([^"]+)"`, 'i')); return m ? des(m[1]) : ''; };
const items = (xml) => xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
const fechaISO = (s) => { const d = new Date(s); return isNaN(d) ? '' : d.toISOString(); };
const clave = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);

async function imagenDe(link) {
  try {
    const html = await traer(link, 8000);
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
    return m ? des(m[1]) : '';
  } catch { return ''; }
}

async function noticias() {
  const out = [];
  for (const url of NOTICIAS) {
    try {
      const xml = await traer(url);
      for (const it of items(xml)) {
        let titulo = limpio(tag(it, 'title'));
        let medio = limpio(tag(it, 'source'));
        if (!medio && / - [^-]+$/.test(titulo)) medio = titulo.split(' - ').pop();
        if (medio && titulo.endsWith(' - ' + medio)) titulo = titulo.slice(0, -(medio.length + 3));
        const texto = (titulo + ' ' + limpio(tag(it, 'description'))).toLowerCase();
        if (!/miller preciado|agroventure/.test(texto)) continue; // solo lo que de verdad habla de él
        out.push({
          titulo,
          resumen: limpio(tag(it, 'description')).slice(0, 260),
          medio: medio || new URL(url).hostname,
          fecha: fechaISO(tag(it, 'pubDate')),
          link: limpio(tag(it, 'link')),
          imagen: attr(it, 'media:content', 'url') || attr(it, 'enclosure', 'url') || '',
        });
      }
    } catch (e) { console.log('No se pudo leer', url, e.message); }
  }
  // Fotos reales de la nota (og:image) para los que no traen imagen y no son de Google News
  let buscadas = 0;
  for (const n of out) {
    if (!n.imagen && !n.link.includes('news.google.com') && buscadas < 15) { n.imagen = await imagenDe(n.link); buscadas++; }
  }
  return out;
}

async function podcast() {
  try {
    const xml = await traer(PODCAST);
    const portada = attr(xml, 'itunes:image', 'href');
    return items(xml).slice(0, 30).map((it) => ({
      titulo: limpio(tag(it, 'title')),
      fecha: fechaISO(tag(it, 'pubDate')).slice(0, 10),
      resumen: limpio(tag(it, 'description')).slice(0, 300),
      link: limpio(tag(it, 'link')) || 'https://podcasts.apple.com/us/podcast/agroventure-podcast/id1739670985',
      audio: attr(it, 'enclosure', 'url'),
      imagen: attr(it, 'itunes:image', 'href') || portada,
    }));
  } catch (e) { console.log('Podcast sin respuesta', e.message); return null; }
}

async function columnas() {
  const out = [];
  for (const [url, medio] of COLUMNAS) {
    try {
      const xml = await traer(url);
      for (const it of items(xml).slice(0, 12)) {
        out.push({ titulo: limpio(tag(it, 'title')), medio, fecha: fechaISO(tag(it, 'pubDate')).slice(0, 10), link: limpio(tag(it, 'link')) });
      }
    } catch (e) { console.log('Columnas sin respuesta', url, e.message); }
  }
  return out;
}

function unir(nuevos, viejos, max) {
  const vistos = new Set(); const res = [];
  for (const n of [...nuevos, ...viejos]) {
    if (!n || !n.titulo) continue;
    const k = clave(n.titulo);
    if (vistos.has(k)) continue;
    vistos.add(k); res.push(n);
  }
  return res.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, max);
}

function horaBogota() {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return d.toISOString().replace('Z', '').slice(0, 19) + '-05:00';
}

const viejo = JSON.parse(await readFile(ARCHIVO, 'utf8'));
const [n, p, c] = await Promise.all([noticias(), podcast(), columnas()]);
n.forEach((x, i) => { if (!x.imagen) x.imagen = FOTOS_PROPIAS[i % FOTOS_PROPIAS.length]; });

const nuevo = {
  actualizado: horaBogota(),
  fuente: 'robot',
  noticias: seguro(unir(n, viejo.noticias || [], 80)),
  podcast: seguro(p && p.length ? p : (viejo.podcast || [])),
  columnas: seguro(unir(c, viejo.columnas || [], 40)),
};

const antes = JSON.stringify({ ...viejo, actualizado: '', fuente: '' });
const despues = JSON.stringify({ ...nuevo, actualizado: '', fuente: '' });
if (antes === despues) {
  console.log('Sin novedades. Se conserva el archivo.');
} else {
  await writeFile(ARCHIVO, JSON.stringify(nuevo, null, 2) + '\n');
  console.log(`Listo: ${nuevo.noticias.length} noticias, ${nuevo.podcast.length} episodios, ${nuevo.columnas.length} columnas.`);
}
