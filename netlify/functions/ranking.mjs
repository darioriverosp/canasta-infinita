// Ranking online de CanastaMan: guarda las mejores puntuaciones y el contador en Netlify Blobs.
// GET  /api/ranking?id=...  -> top 10 de cada tabla (marca con "me" las entradas de ese jugador) + contador
// POST /api/ranking         -> { id, name, team, kind: 'end', earned, champ? }  al terminar cada día
//                              (también acepta los formatos antiguos: kind 'day' | 'champ' con value, y kind 'play')
import { getStore } from '@netlify/blobs';

// Temporada actual: solo cuentan para el ranking las puntuaciones de partidas de esta temporada
// (las partidas viejas siguen sumando al contador, pero no entran en las tablas)
const SEASON = 1;

const BOARDS = {
  day:   { better: (a, b) => a > b, max: 1e15 },   // más puntos en un día
  champ: { better: (a, b) => a < b, max: 100000 }, // menos días para ser campeón
};
const clean = s => String(s ?? '').replace(/[<>&"'`]/g, '').trim().slice(0, 12) || 'Jugador';
const validId = id => typeof id === 'string' && /^[a-z0-9]{6,32}$/.test(id);
const top = (data, id) => ({
  ...Object.fromEntries(Object.keys(BOARDS).map(k =>
    [k, (data[k] || []).slice(0, 10).map(e => ({ name: e.name, team: e.team, value: e.value, me: e.id === id }))])),
  stats: data.stats || { plays: 0, players: 0 },
  season: SEASON,
});

// Se puede llamar desde otras webs (por ejemplo, el juego subido a itch.io)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const res = await handle(req);
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
};

// "strong": siempre lee la última versión (con "eventual" se perdían guardados de jugadores simultáneos)
const store = () => getStore({ name: 'ranking', consistency: 'strong' });

function addScore(data, kind, id, name, team, value) {
  const board = BOARDS[kind];
  if (!Number.isFinite(value) || value <= 0 || value > board.max) return;
  const list = data[kind] || (data[kind] = []);
  const entry = { id, name: clean(name), team: clean(team), value: Math.floor(value), at: Date.now() };
  const i = list.findIndex(e => e.id === id);
  if (i < 0) list.push(entry);
  else if (board.better(entry.value, list[i].value)) list[i] = entry;
  else { list[i].name = entry.name; list[i].team = entry.team; }
  list.sort((a, b) => (board.better(a.value, b.value) ? -1 : board.better(b.value, a.value) ? 1 : 0));
  data[kind] = list.slice(0, 100);
}

// Lee, cambia y guarda solo si nadie guardó entre medias; si alguien lo hizo, lo reintenta con los datos nuevos
async function update(s, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const cur = await s.getWithMetadata('tablas', { type: 'json' });
    const data = cur?.data || { day: [], champ: [] };
    change(data);
    const r = await s.setJSON('tablas', data, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (r.modified) return data;
    await new Promise(ok => setTimeout(ok, 30 + Math.random() * 120));
  }
  throw new Error('Demasiados guardados a la vez');
}

async function handle(req) {
  const s = store();
  if (req.method === 'GET') {
    const data = (await s.get('tablas', { type: 'json' })) || { day: [], champ: [] };
    return Response.json(top(data, new URL(req.url).searchParams.get('id')));
  }
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('JSON inválido', { status: 400 }); }
  const { id, name, team, kind } = body || {};
  if (!validId(id) || !['end', 'play', 'day', 'champ'].includes(kind)) return new Response('Datos inválidos', { status: 400 });

  // jugador nuevo: se marca de forma atómica (solo el primer guardado de ese id cuenta)
  const counts = kind === 'end' || kind === 'play';
  const newPlayer = counts ? (await s.set(`jugador/${id}`, '1', { onlyIfNew: true })).modified : false;

  try {
    const data = await update(s, d => {
      if (counts) {
        const st = d.stats || (d.stats = { plays: 0, players: 0 });
        st.plays++; if (newPlayer) st.players++;
      }
      const inSeason = body.season === SEASON;
  if (kind === 'end' && inSeason) {
        addScore(d, 'day', id, name, team, Number(body.earned));
        if (body.champ) addScore(d, 'champ', id, name, team, Number(body.champ));
      }
      if ((kind === 'day' || kind === 'champ') && inSeason) addScore(d, kind, id, name, team, Number(body.value));
    });
    return Response.json(top(data, id));
  } catch (e) {
    return new Response('Servidor ocupado, inténtalo otra vez', { status: 503 });
  }
}

export const config = { path: '/api/ranking' };
