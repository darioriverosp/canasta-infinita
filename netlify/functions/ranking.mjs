// Ranking online de CanastaMan: guarda las mejores puntuaciones en Netlify Blobs.
// GET  /api/ranking?id=...  -> top 10 de cada tabla (marca con "me" las entradas de ese jugador)
// POST /api/ranking         -> { id, name, team, kind: 'day' | 'champ', value }  o  { id, kind: 'play' } para el contador
import { getStore } from '@netlify/blobs';

const BOARDS = {
  day:   { better: (a, b) => a > b, max: 1e15 },   // más puntos en un día
  champ: { better: (a, b) => a < b, max: 100000 }, // menos días para ser campeón
};
const clean = s => String(s ?? '').replace(/[<>&"'`]/g, '').trim().slice(0, 12) || 'Jugador';
const top = (data, id) => ({
  ...Object.fromEntries(Object.keys(BOARDS).map(k =>
    [k, (data[k] || []).slice(0, 10).map(e => ({ name: e.name, team: e.team, value: e.value, me: e.id === id }))])),
  stats: data.stats || { plays: 0, players: 0 },
});

export default async (req) => {
  const store = getStore('ranking');
  const data = (await store.get('tablas', { type: 'json' })) || { day: [], champ: [] };

  if (req.method === 'GET') return Response.json(top(data, new URL(req.url).searchParams.get('id')));
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('JSON inválido', { status: 400 }); }
  const { id, name, team, kind, value } = body || {};

  // contador de días jugados y jugadores distintos
  if (kind === 'play') {
    if (typeof id !== 'string' || !/^[a-z0-9]{6,32}$/.test(id)) return new Response('Datos inválidos', { status: 400 });
    const stats = data.stats || (data.stats = { plays: 0, players: 0 });
    stats.plays++;
    if (!(await store.get(`jugador/${id}`))) { stats.players++; await store.set(`jugador/${id}`, '1'); }
    await store.setJSON('tablas', data);
    return Response.json(stats);
  }
  const board = BOARDS[kind];
  if (!board || typeof id !== 'string' || !/^[a-z0-9]{6,32}$/.test(id) || !Number.isFinite(value) || value <= 0 || value > board.max)
    return new Response('Datos inválidos', { status: 400 });

  const list = data[kind] || (data[kind] = []);
  const entry = { id, name: clean(name), team: clean(team), value: Math.floor(value), at: Date.now() };
  const i = list.findIndex(e => e.id === id);
  if (i < 0) list.push(entry);
  else if (board.better(entry.value, list[i].value)) list[i] = entry;
  else { list[i].name = entry.name; list[i].team = entry.team; }
  list.sort((a, b) => (board.better(a.value, b.value) ? -1 : board.better(b.value, a.value) ? 1 : 0));
  data[kind] = list.slice(0, 100);
  await store.setJSON('tablas', data);
  return Response.json(top(data, id));
};

export const config = { path: '/api/ranking' };
