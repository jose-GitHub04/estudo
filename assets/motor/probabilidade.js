// Probabilidades com frações exatas, sem DOM (como matematica.js): tabelas de
// distribuição, valor médio, variância e a urna do widget «urna». Uma fração é
// { n, d } com d > 0 e n/d reduzida. Uma tabela é [{ x: número, p: fração }].

import { mdc, fracTex } from './matematica.js';

// ---------- Frações ----------

export function F(n, d = 1) {
  if (d === 0) throw new Error('denominador nulo');
  const g = mdc(n, d);
  if (d < 0) { n = -n; d = -d; }
  return { n: n / g, d: d / g };
}
export const soma = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
export const mult = (a, b) => F(a.n * b.n, a.d * b.d);
export const igual = (a, b) => a.n === b.n && a.d === b.d;
export const valor = (a) => a.n / a.d;
export const UM = F(1);
export const ZERO = F(0);

/** Fração em LaTeX: \frac{2}{7}, 1, 0, -\frac{1}{2}. */
export const fracTexF = (a) => fracTex(a.n, a.d);

// ---------- Tabela de distribuição ----------

export const somaP = (tabela) => tabela.reduce((s, l) => soma(s, l.p), ZERO);

/** Valor médio: soma de p_i · x_i. */
export const media = (tabela) => tabela.reduce((s, l) => soma(s, mult(l.p, F(l.x))), ZERO);

/** Variância populacional: soma de p_i · (x_i − μ)². */
export function variancia(tabela) {
  const mu = media(tabela);
  return tabela.reduce((s, l) => {
    const d = sub(F(l.x), mu);
    return soma(s, mult(l.p, mult(d, d)));
  }, ZERO);
}

/** Desvio-padrão, como número decimal. */
export const desvioPadrao = (tabela) => Math.sqrt(valor(variancia(tabela)));

// ---------- Urna: tirar bolas sem repor até sair uma vermelha ----------

/**
 * Urna com `vermelhas` bolas vermelhas e `outras` bolas de outra cor. X = número de
 * bolas tiradas até sair a primeira vermelha. Toma os valores 1 … outras + 1.
 */
export function tabelaUrna(vermelhas, outras) {
  const total = vermelhas + outras;
  const linhas = [];
  for (let k = 1; k <= outras + 1; k++) {
    const p = fatoresUrna(vermelhas, outras, k).reduce((acc, f) => mult(acc, f), UM);
    linhas.push({ x: k, p });
  }
  if (!igual(somaP(linhas), UM)) throw new Error(`urna ${vermelhas}/${total}: a soma não dá 1`);
  return linhas;
}

/** Os fatores do ramo X = k, por ordem: (k−1) não vermelhas seguidas de uma vermelha. */
export function fatoresUrna(vermelhas, outras, k) {
  const total = vermelhas + outras;
  const fatores = [];
  for (let i = 0; i < k - 1; i++) fatores.push(F(outras - i, total - i));
  fatores.push(F(vermelhas, total - (k - 1)));
  return fatores;
}

/** Faz uma experiência: devolve { x, bolas: ['o','o','v'] } ('v' = vermelha, 'o' = outra). */
export function simularUrna(rng, vermelhas, outras) {
  const urna = [];
  for (let i = 0; i < vermelhas; i++) urna.push('v');
  for (let i = 0; i < outras; i++) urna.push('o');
  const bolas = [];
  while (urna.length) {
    const i = Math.floor(rng() * urna.length);
    const [b] = urna.splice(i, 1);
    bolas.push(b);
    if (b === 'v') break;
  }
  return { x: bolas.length, bolas };
}

// ---------- Jogo: uma bola de cada vez, com prémio por cor ----------

/**
 * contagens: [{ cor, n, premio }]. Junta as cores com o mesmo prémio e devolve a tabela
 * ordenada por x. Ex.: 5 vermelhas (+2), 2 amarelas (−5), 3 azuis (0) -> x = −5, 0, 2.
 */
export function tabelaJogo(contagens) {
  const total = contagens.reduce((s, c) => s + c.n, 0);
  const porPremio = new Map();
  for (const c of contagens) porPremio.set(c.premio, (porPremio.get(c.premio) || 0) + c.n);
  const linhas = [...porPremio.entries()].sort((a, b) => a[0] - b[0])
    .map(([x, n]) => ({ x, p: F(n, total) }));
  return linhas;
}
