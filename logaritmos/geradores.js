// Geradores de perguntas do treino do tema «Exponenciais e logaritmos». Lógica pura, sem
// DOM: o treino (widgets/treino.js), os testes (tests/geradores.html) e qualquer outro
// widget usam as mesmas funções. Não precisa de ficheiros de dados.
//
// Cada pergunta tem a forma
//   { tipo, modo: 'escolha' | 'escrita', enunciado /* texto com $...$ */,
//     opcoes?: [{ tex, expr?, correta, ... }]   // escolha: 4 opções, só 1 correta
//     esperado?: { expr, tex } | { naoDefinida: true } // escrita; `expr` na sintaxe de M.avaliar, `tex` em LaTeX
//     explicacao /* texto com $...$ */,
//     verificacao: { ... } }                      // dados para os testes recalcularem
// Tudo o que é aleatório vem do `rng` (M.criarRng), por isso a mesma semente dá a mesma
// pergunta. As respostas escritas são sempre valores exatos (3/2, ln(7), logb(2,5)).

import * as M from '../assets/motor/matematica.js';
import { TIPOS_ANALISE } from './geradores-analise.js';

// ---------- Ajudas ----------

const chaveNum = (x) => String(Math.round(x * 1e9)); // -0 dá "0"
const igual = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const um = (rng, lista) => M.escolher(rng, lista);

/** Opção numérica «p/q» (reduzida), com `expr` para o avaliador. */
function opNum(p, q = 1) {
  [p, q] = M.reduzir(p, q);
  return { chave: chaveNum(p / q), tex: M.fracTex(p, q), expr: q === 1 ? String(p) : `${p}/${q}` };
}

/** Opção que não é um número (intervalo, igualdade, «crescente»...). */
const opTexto = (tex, extra = {}) => ({ chave: `tex:${tex}`, tex, ...extra });

/** Opção com valor numérico dado por uma expressão do avaliador. */
const opExpr = (tex, expr) => ({ chave: chaveNum(M.avaliar(expr).valor), tex, expr });

/**
 * Escolhe `n` distratores. Percorre os grupos por ordem (cada um baralhado) e salta os
 * que repetem a chave da correta ou de um já escolhido. Os grupos mais plausíveis (erros
 * típicos) vão primeiro; o último é a reserva.
 */
function distratores(rng, correta, grupos, n = 3) {
  const vistas = new Set([correta.chave]);
  const out = [];
  for (const grupo of grupos) {
    for (const c of M.baralhar(rng, grupo.filter(Boolean))) {
      if (out.length >= n) return out;
      if (vistas.has(c.chave)) continue;
      vistas.add(c.chave);
      out.push(c);
    }
  }
  if (out.length < n) throw new Error(`poucos distratores (${out.length}) para ${correta.chave}`);
  return out;
}

/** Junta a correta e os distratores, mistura e tira a chave interna. */
function pergunta(rng, tipo, { enunciado, correta, outras, explicacao, verificacao }) {
  const todas = [{ ...correta, correta: true }, ...outras.map((o) => ({ ...o, correta: false }))];
  const opcoes = M.baralhar(rng, todas).map((o) => {
    const copia = { ...o };
    delete copia.chave;
    return copia;
  });
  return { tipo, modo: 'escolha', enunciado, opcoes, explicacao, verificacao };
}

/** Pergunta de resposta escrita: `expr` para corrigir, `tex` para mostrar a certa. */
function escrita(tipo, { enunciado, expr, tex, explicacao, verificacao }) {
  return { tipo, modo: 'escrita', enunciado, esperado: { expr, tex }, explicacao, verificacao };
}

/** Racional p/q em LaTeX (reduzido; -1/2 dá -\frac{1}{2}). */
const fr = (p, q = 1) => M.fracTex(p, q);

/** Coeficiente de x: 1 -> x, -1 -> -x, 3 -> 3x, 1/2 -> \frac{1}{2}x. */
function coefX([p, q], x = 'x') {
  [p, q] = M.reduzir(p, q);
  if (q === 1 && p === 1) return x;
  if (q === 1 && p === -1) return `-${x}`;
  return `${fr(p, q)}${x}`;
}

/** Potência c^(p/q) escrita como inteiro, fração ou raiz (q = 1, 2 ou 3): 8, \frac{1}{8}, \sqrt{2}. */
function potTex(c, [p, q]) {
  if (p === 0) return '1';
  if (q === 1) return p > 0 ? String(c ** p) : `\\frac{1}{${c ** -p}}`;
  const raiz = q === 2 ? '\\sqrt' : `\\sqrt[${q}]`;
  const r = `${raiz}{${c ** Math.abs(p)}}`;
  return p > 0 ? r : `\\frac{1}{${r}}`;
}

/** Potência de e: e, e^{3}, \frac{1}{e^{2}}, \sqrt{e}. */
function potETex(rng, [p, q]) {
  if (p === 0) return '1';
  if (q === 1) {
    if (p === 1) return 'e';
    if (p > 0) return `e^{${p}}`;
    if (p === -1) return '\\frac{1}{e}';
    return rng() < 0.6 ? `\\frac{1}{e^{${-p}}}` : `e^{${p}}`;
  }
  const raiz = q === 2 ? '\\sqrt' : `\\sqrt[${q}]`;
  const r = Math.abs(p) === 1 ? `${raiz}{e}` : `${raiz}{e^{${Math.abs(p)}}}`;
  return p > 0 ? r : `\\frac{1}{${r}}`;
}

/** Potência de 10: 1000, 10^{4}, 0{,}001, \frac{1}{100}, \sqrt{10}. */
function pot10Tex(rng, [p, q]) {
  if (p === 0) return '1';
  if (q === 1) {
    if (p === 1) return '10';
    if (p > 0) return p <= 5 && rng() < 0.6 ? String(10 ** p) : `10^{${p}}`;
    return rng() < 0.5 ? `0{,}${'0'.repeat(-p - 1)}1` : `\\frac{1}{${10 ** -p}}`;
  }
  const raiz = q === 2 ? '\\sqrt' : `\\sqrt[${q}]`;
  const r = `${raiz}{${10 ** Math.abs(p)}}`;
  return p > 0 ? r : `\\frac{1}{${r}}`;
}

/** Argumento de um logaritmo: as frações levam parênteses para não se lerem mal. */
const arg = (tex) => (tex.startsWith('\\frac') ? `\\left(${tex}\\right)` : tex);

/** Cabeça de um logaritmo: \log_{4}, \ln, \log. */
function cabeca(base) {
  if (base === 'e') return '\\ln';
  if (base === 10) return '\\log';
  return `\\log_{${base}}`;
}

// ---------- 1. Valor de um logaritmo ----------

// base = c^s e argumento = c^t, com c = 2, 3 ou 5; o resultado é t/s
const S_BASE = {
  2: [[1, 1], [2, 1], [3, 1], [4, 1], [-1, 1], [-2, 1], [1, 2], [1, 3]],
  3: [[1, 1], [2, 1], [3, 1], [-1, 1], [1, 2]],
  5: [[1, 1], [2, 1], [3, 1], [-1, 1]],
};
const T_EXTRA = [[1, 2], [-1, 2], [1, 3], [-1, 3], [2, 3], [3, 2]];
const T_INT = { 2: [-4, 6], 3: [-3, 5], 5: [-2, 3] };

let combosLog = null;
/** Todas as (c, s, t) com resultado simples (denominador até 4, |valor| até 8). */
function combinacoesLog() {
  if (combosLog) return combosLog;
  combosLog = [];
  for (const c of [2, 3, 5]) {
    const ts = [];
    for (let k = T_INT[c][0]; k <= T_INT[c][1]; k++) ts.push([k, 1]);
    ts.push(...T_EXTRA);
    for (const s of S_BASE[c]) {
      for (const t of ts) {
        const [rp, rq] = M.reduzir(t[0] * s[1], t[1] * s[0]);
        if (rq <= 4 && Math.abs(rp / rq) <= 8) combosLog.push({ c, s, t, r: [rp, rq] });
      }
    }
  }
  return combosLog;
}

const ENUNCIADOS_VALOR = [
  (l) => `Calcula $${l}$.`,
  (l) => `Quanto vale $${l}$?`,
  (l) => `Sem calculadora, determina o valor de $${l}$.`,
  (l) => `Qual é o valor de $${l}$?`,
  (l) => `Calcula o valor exato de $${l}$.`,
];

function valorLog(rng) {
  const modoEscrita = rng() < 0.55;
  const especial = rng() < 0.28; // \ln e^k ou \log 10^k
  let baseTex;
  let argTex;
  let base;
  let argumento;
  let r;
  let explicacao;

  if (especial) {
    const natural = rng() < 0.5;
    const ts = [[-3, 1], [-2, 1], [-1, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [-1, 2], [1, 3], [3, 2]];
    const t = um(rng, natural ? ts.filter(([p, q]) => q > 1 || Math.abs(p) <= 5) : ts.filter(([p, q]) => q > 1 || (p >= -4 && p <= 5 && p !== 6)));
    r = t;
    const w = natural ? 'e' : '10';
    const tTex = fr(t[0], t[1]);
    argTex = natural ? potETex(rng, t) : pot10Tex(rng, t);
    base = natural ? Math.E : 10;
    argumento = natural ? Math.exp(t[0] / t[1]) : 10 ** (t[0] / t[1]);
    baseTex = null;
    const nome = natural ? '\\ln' : '\\log';
    const que = natural ? 'O logaritmo neperiano $\\ln$ tem base $e$' : 'O logaritmo decimal $\\log$ tem base $10$';
    const jaPotencia = argTex === `${w}^{${tTex}}`;
    explicacao = jaPotencia
      ? `${que}, por isso $${nome} ${w}^{${tTex}}$ é o expoente a que se eleva $${w}$ para obter $${w}^{${tTex}}$, ou seja, $${tTex}$.`
      : `${que}. Escreve o argumento como potência da base: $${argTex}=${w}^{${tTex}}$. O logaritmo é esse expoente, logo $${nome} ${arg(argTex)}=${tTex}$.`;
    const l = `${nome} ${arg(argTex)}`;
    return fecharValorLog(rng, modoEscrita, l, r, explicacao, { base, arg: argumento, baseTex, argTex, r });
  }

  const { c, s, t, r: res } = um(rng, combinacoesLog());
  r = res;
  const bTex = potTex(c, s);
  argTex = potTex(c, t);
  baseTex = bTex;
  base = c ** (s[0] / s[1]);
  argumento = c ** (t[0] / t[1]);
  const sT = fr(s[0], s[1]);
  const tT = fr(t[0], t[1]);
  const rT = fr(r[0], r[1]);
  const l = `\\log_{${bTex}} ${arg(argTex)}`;
  if (s[0] === 1 && s[1] === 1) {
    explicacao = `O logaritmo é um expoente: $\\log_{${c}} b$ é o expoente a que se eleva $${c}$ para obter $b$. Como $${argTex}=${c}^{${tT}}$, o valor é $${rT}$.`;
  } else {
    explicacao = `Escreve a base e o argumento como potências de $${c}$: $${bTex}=${c}^{${sT}}$ e $${argTex}=${c}^{${tT}}$. Então $\\log_{${bTex}} ${arg(argTex)}=x$ significa $(${c}^{${sT}})^x=${c}^{${tT}}$, isto é, $${c}^{${coefX([s[0], s[1]])}}=${c}^{${tT}}$. Os expoentes são iguais: $${coefX([s[0], s[1]])}=${tT}$, logo $x=${rT}$.`;
  }
  return fecharValorLog(rng, modoEscrita, l, r, explicacao, { base, arg: argumento, baseTex, argTex, r });
}

function fecharValorLog(rng, modoEscrita, l, r, explicacao, verificacao) {
  const enunciado = um(rng, ENUNCIADOS_VALOR)(l);
  const [rp, rq] = r;
  if (modoEscrita) {
    const o = opNum(rp, rq);
    return escrita('valor-log', { enunciado, expr: o.expr, tex: o.tex, explicacao, verificacao });
  }
  const correta = opNum(rp, rq);
  const reserva = [];
  for (let k = -3; k <= 6; k++) reserva.push(opNum(k, 1), opNum(2 * k + 1, 2));
  const grupos = [
    [rp !== 0 ? opNum(-rp, rq) : null, rp !== 0 ? opNum(rq, rp) : null],
    [opNum(rp + rq, rq), opNum(rp - rq, rq), opNum(2 * rp, rq), opNum(rp, 2 * rq)],
    reserva,
  ];
  return pergunta(rng, 'valor-log', { enunciado, correta, outras: distratores(rng, correta, grupos), explicacao, verificacao });
}

// ---------- 2. Forma logarítmica e forma exponencial ----------

/** Racional [p, q] elevado a um inteiro. */
function ratPot([p, q], n) {
  return n >= 0 ? [p ** n, q ** n] : [q ** -n, p ** -n];
}

let ternosForma = null;
/** Ternos (a, c, b) com a^c = b, a e b racionais. */
function ternos() {
  if (ternosForma) return ternosForma;
  ternosForma = [];
  const poe = (a, c, b) => ternosForma.push({ a, c, b });
  for (const a of [2, 3, 5, 4]) {
    for (const c of [-3, -2, -1, 2, 3, 4]) {
      if ((a === 5 && Math.abs(c) > 3) || (a === 4 && Math.abs(c) > 2)) continue;
      poe([a, 1], [c, 1], ratPot([a, 1], c));
    }
  }
  for (const c of [2, 3, 4]) poe([10, 1], [c, 1], ratPot([10, 1], c));
  for (const a of [[1, 2], [1, 3]]) {
    for (const c of [-3, -2, 2, 3]) poe(a, [c, 1], ratPot(a, c));
  }
  poe([4, 1], [1, 2], [2, 1]);
  poe([9, 1], [1, 2], [3, 1]);
  poe([25, 1], [1, 2], [5, 1]);
  poe([8, 1], [1, 3], [2, 1]);
  poe([27, 1], [1, 3], [3, 1]);
  poe([16, 1], [1, 4], [2, 1]);
  poe([4, 1], [-1, 2], [1, 2]);
  poe([1, 4], [-1, 2], [2, 1]);
  return ternosForma;
}

const val = ([p, q]) => p / q;
/** Racional como base de uma potência: as frações levam parênteses. */
const baseTex = ([p, q]) => (q === 1 ? String(p) : `\\left(${fr(p, q)}\\right)`);
const potStmt = (a, c, b) => `${baseTex(a)}^{${fr(...c)}}=${fr(...b)}`;
const logStmt = (a, b, c) => (a[0] === 10 && a[1] === 1
  ? `\\log ${arg(fr(...b))}=${fr(...c)}`
  : `\\log_{${fr(...a)}} ${arg(fr(...b))}=${fr(...c)}`);

const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

function formaExp(rng) {
  const quadro = rng();
  if (quadro < 0.34) return formaDeLogParaExp(rng);
  if (quadro < 0.6) return formaDeExpParaLog(rng);
  if (quadro < 0.8) return formaIsolarX(rng);
  return formaExpoente(rng);
}

function formaDeLogParaExp(rng) {
  const { a, c, b } = um(rng, ternos());
  const itens = [a, b, c]; // a^c = b  <=>  log_a b = c
  const correta = opTexto(potStmt(a, c, b));
  const grupos = [[], []];
  for (const [i, j, k] of PERMS) {
    if (i === 0 && j === 2 && k === 1) continue;
    if (!(val(itens[i]) > 0)) continue; // a base de uma potência é positiva
    const potencia = val(itens[i]) ** val(itens[j]);
    if (!Number.isFinite(potencia) || Math.abs(potencia - val(itens[k])) < 1e-9) continue;
    ((i === 0 && j === 1) || (i === 1 && j === 2) ? grupos[0] : grupos[1]).push(opTexto(potStmt(itens[i], itens[j], itens[k])));
  }
  const reserva = [opTexto(potStmt(a, [-c[0], c[1]], b)), opTexto(potStmt(a, c, [b[1], b[0]]))];
  const outras = distratores(rng, correta, [grupos[0], grupos[1], reserva]);
  return pergunta(rng, 'forma-exp', {
    enunciado: `Qual das igualdades é equivalente a $${logStmt(a, b, c)}$?`,
    correta,
    outras,
    explicacao: `O logaritmo é o expoente: $\\log_{a} b=c$ quer dizer que $a^{c}=b$, com a base $a$ a ser elevada ao logaritmo $c$ para dar o argumento $b$. Aqui: $${potStmt(a, c, b)}$.`,
    verificacao: { forma: 'log-para-exp', a, b, c },
  });
}

function formaDeExpParaLog(rng) {
  const lista = ternos().filter(({ c }) => c[0] > 0 && !(c[0] === 1 && c[1] === 1));
  const { a, c, b } = um(rng, lista);
  const itens = [a, b, c];
  const correta = opTexto(logStmt(a, b, c));
  const grupos = [[], []];
  for (const [i, j, k] of PERMS) {
    if (i === 0 && j === 1 && k === 2) continue;
    const base = val(itens[i]);
    const x = val(itens[j]);
    if (!(base > 0) || base === 1 || !(x > 0)) continue;
    if (Math.abs(Math.log(x) / Math.log(base) - val(itens[k])) < 1e-9) continue;
    (i === 1 && j === 0 ? grupos[0] : grupos[1]).push(opTexto(logStmt(itens[i], itens[j], itens[k])));
  }
  const reserva = [opTexto(logStmt(a, b, [-c[0], c[1]])), opTexto(logStmt(a, [b[1], b[0]], c))];
  const outras = distratores(rng, correta, [grupos[0], grupos[1], reserva]);
  return pergunta(rng, 'forma-exp', {
    enunciado: `Qual das igualdades é equivalente a $${potStmt(a, c, b)}$?`,
    correta,
    outras,
    explicacao: `Em $a^{c}=b$, o expoente $c$ é o logaritmo de $b$ na base $a$: $c=\\log_a b$. Aqui: $${logStmt(a, b, c)}$. Trocar a base com o argumento daria outro número.`,
    verificacao: { forma: 'exp-para-log', a, b, c },
  });
}

/** Sabendo que log_a x = c, qual é x? (x = a^c e não c^a, a·c...) */
function formaIsolarX(rng) {
  const base = um(rng, [2, 3, 4, 5, 10, 'e']);
  const c = um(rng, [2, 3, 4, 5].filter((k) => k !== base));
  const b = base === 'e' ? 'e' : String(base);
  const nome = base === 'e' ? '\\ln' : (base === 10 ? '\\log' : `\\log_{${base}}`);
  const correta = opExpr(`${b}^{${c}}`, `${b}^${c}`);
  const outras = distratores(rng, correta, [
    [opExpr(`${c}^{${b}}`, `${c}^${b}`), opExpr(`${b}\\times${c}`, `${b}*${c}`)],
    [opExpr(`\\frac{${c}}{${b}}`, `${c}/${b}`), opExpr(`${b}+${c}`, `${b}+${c}`), opExpr(`\\frac{${b}}{${c}}`, `${b}/${c}`)],
    [opExpr(`${b}^{${c + 1}}`, `${b}^${c + 1}`)],
  ]);
  return pergunta(rng, 'forma-exp', {
    enunciado: `Sabendo que $${nome} x=${c}$, qual é o valor de $x$?`,
    correta,
    outras,
    explicacao: `$${nome} x=${c}$ diz que ${c} é o expoente a que se eleva a base $${b}$ para obter $x$. Logo $x=${b}^{${c}}$. Um erro frequente é trocar os papéis e escrever $x=${c}^{${b}}$.`,
    verificacao: { forma: 'x-potencia', a: base === 'e' ? Math.E : base, c },
  });
}

/** Resolver a^x = b em ordem a x: x = log_a b. */
function formaExpoente(rng) {
  const base = um(rng, [2, 3, 5, 10, 'e']);
  const b = um(rng, [3, 5, 7, 11, 20].filter((k) => k !== base));
  const a = base === 'e' ? 'e' : String(base);
  const log = (bb, x) => (bb === 'e' ? `\\ln ${x}` : (bb === 10 ? `\\log ${x}` : `\\log_{${bb}} ${x}`));
  const aNum = base === 'e' ? 'e' : String(base);
  const correta = opExpr(`x=${log(base, b)}`, `logb(${aNum},${b})`);
  const outras = distratores(rng, correta, [
    [opExpr(`x=${log(b, a)}`, `logb(${b},${aNum})`), opExpr(`x=\\frac{${b}}{${a}}`, `${b}/${aNum}`)],
    [opExpr(`x=${b}^{${a}}`, `${b}^${aNum}`), base === 'e' ? null : opExpr(`x=\\sqrt[${a}]{${b}}`, `${b}^(1/${aNum})`)],
    [opExpr(`x=${a}^{${b}}`, `${aNum}^${b}`), opExpr(`x=${b}-${a}`, `${b}-${aNum}`)],
  ]);
  return pergunta(rng, 'forma-exp', {
    enunciado: `Qual é a solução da equação $${a}^{x}=${b}$?`,
    correta,
    outras,
    explicacao: `O expoente $x$ a que se eleva ${base === 'e' ? 'o número $e$' : `$${a}$`} para obter $${b}$ é, por definição, o logaritmo de $${b}$ nessa base: $x=${log(base, b)}$. Dividir ($\\frac{${b}}{${a}}$) seria resolver $${a}x=${b}$, que é outra equação.`,
    verificacao: { forma: 'x-log', a: base === 'e' ? Math.E : base, b },
  });
}

// ---------- 3. Existência e domínio ----------

const INF = { v: Infinity, tex: '+\\infty' };
const MINF = { v: -Infinity, tex: '-\\infty' };
const pt = (p, q = 1) => ({ v: p / q, tex: fr(p, q) });
/** Intervalo com extremos {v, tex}; lc/hc dizem se o extremo está incluído. */
const iv = (lo, hi, lc = false, hc = false) => ({ lo, hi, lc, hc });
const ivTex = (i) => `${i.lc ? '[' : ']'}${i.lo.tex},${i.hi.tex}${i.hc ? ']' : '['}`;
const ivNum = (i) => [i.lo.v, i.hi.v, i.lc, i.hc];

/** Opção «união de intervalos»; `intervalos` serve aos testes. */
function opInt(...lista) {
  return opTexto(lista.map(ivTex).join('\\cup '), { intervalos: lista.map(ivNum) });
}
const opR = () => opTexto('\\mathbb{R}', { intervalos: [[-Infinity, Infinity, false, false]] });
function opRSem(...pts) {
  const ordenados = pts.slice().sort((x, y) => x.v - y.v);
  const lista = [];
  let ant = MINF;
  for (const p of ordenados) {
    lista.push(iv(ant, p));
    ant = p;
  }
  lista.push(iv(ant, INF));
  return opTexto(`\\mathbb{R}\\setminus\\{${ordenados.map((p) => p.tex).join(',')}\\}`, { intervalos: lista.map(ivNum) });
}

/** ax+b escrito à portuguesa: 2x-6, 5-x, -3-2x. */
function polinomio(a, b) {
  if (a > 0 || b === 0) return `${coefX([a, 1])}${b === 0 ? '' : (b > 0 ? '+' : '-') + Math.abs(b)}`;
  return `${b}-${Math.abs(a) === 1 ? '' : Math.abs(a)}x`;
}

/** x-p escrito como x, x-3 ou x+2. */
const fator = (p) => (p === 0 ? 'x' : (p > 0 ? `x-${p}` : `x+${-p}`));

function existe(rng) {
  const q = rng();
  if (q < 0.22) return existeExpressao(rng);
  if (q < 0.6) return dominioLinear(rng);
  if (q < 0.85) return dominioQuadratico(rng);
  return dominioQuociente(rng);
}

/** «Qual das expressões tem sentido?»: uma definida e três com base ou argumento impossível. */
function existeExpressao(rng) {
  const valor = (b) => (b === 'e' ? Math.E : b);
  const exprLog = (base, a) => {
    const argTex = a < 0 ? `(${a})` : String(a);
    const tex = base === 'e' ? `\\ln ${argTex}` : (base === 10 ? `\\log ${argTex}` : `\\log_{${base}} ${argTex}`);
    const definida = valor(base) > 0 && valor(base) !== 1 && a > 0;
    return opTexto(tex, { base: valor(base), arg: a, definida });
  };
  const baseOk = () => um(rng, ['e', 10, 2, 3, 5, 4, 7]);
  const argOk = () => um(rng, [2, 3, 5, 7, 9, 12, 20]);
  const correta = exprLog(baseOk(), argOk());
  const kinds = M.baralhar(rng, ['argNeg', 'argZero', 'base1', 'baseNeg', 'baseZero']).slice(0, 3);
  const razoes = [];
  const outras = kinds.map((k) => {
    let o;
    if (k === 'argNeg') { o = exprLog(baseOk(), -um(rng, [1, 2, 3, 4, 5, 8, 9])); razoes.push(`$${o.tex}$ tem argumento negativo`); }
    if (k === 'argZero') { o = exprLog(baseOk(), 0); razoes.push(`$${o.tex}$ tem argumento 0, e nenhuma potência é zero`); }
    if (k === 'base1') { o = exprLog(1, argOk()); razoes.push(`$${o.tex}$ tem base 1, e $1^x$ é sempre 1`); }
    if (k === 'baseNeg') { o = exprLog(-um(rng, [2, 3, 4, 5]), argOk()); razoes.push(`$${o.tex}$ tem base negativa`); }
    if (k === 'baseZero') { o = exprLog(0, argOk()); razoes.push(`$${o.tex}$ tem base 0`); }
    return o;
  });
  return pergunta(rng, 'existe', {
    enunciado: um(rng, [
      'Qual das expressões seguintes representa um número real?',
      'Em $\\mathbb{R}$, qual destas expressões está definida?',
      'Qual destas expressões tem sentido em $\\mathbb{R}$?',
    ]),
    correta,
    outras,
    explicacao: `O logaritmo $\\log_a b$ só existe se $a>0$, $a\\neq1$ e $b>0$, porque uma potência de base positiva nunca dá zero nem um número negativo. Só $${correta.tex}$ cumpre as três condições. Nas outras, ${razoes.join('; ')}.`,
    verificacao: { forma: 'definida' },
  });
}

function dominioLinear(rng) {
  const a = um(rng, [1, 1, 2, 3, -1, -1, -2, -3]);
  const b = um(rng, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
  const g = um(rng, ['\\ln', '\\log', '\\log_{2}', '\\log_{3}', '\\log_{5}']);
  const p = polinomio(a, b);
  const [rp, rq] = M.reduzir(-b, a);
  const r = pt(rp, rq);
  const w = pt(-rp, rq); // o erro de trocar o sinal ao passar o termo b para o outro lado
  const dir = (x, fechado = false) => (a > 0 ? opInt(iv(x, INF, fechado)) : opInt(iv(MINF, x, false, fechado)));
  const inv = (x) => (a > 0 ? opInt(iv(MINF, x)) : opInt(iv(x, INF)));
  const correta = dir(r);
  const outras = distratores(rng, correta, [
    [inv(r), dir(r, true)],
    [dir(w), inv(w)],
    [opR(), opInt(iv(pt(0), INF))],
  ]);
  const rT = fr(rp, rq);
  let passo;
  if (a === 1) passo = `Logo $x>${rT}$.`;
  else if (a > 0) passo = `Dividindo por $${a}$, o sentido mantém-se: $x>${rT}$.`;
  else passo = `Dividindo por $${a}$, que é negativo, o sentido da desigualdade inverte-se: $x<${rT}$.`;
  return pergunta(rng, 'existe', {
    enunciado: um(rng, [
      `Qual é o domínio da função $f(x)=${g}(${p})$?`,
      `Para que valores reais de $x$ está definida a expressão $${g}(${p})$?`,
      `Determina o domínio de $f(x)=${g}(${p})$.`,
    ]),
    correta,
    outras,
    explicacao: `Só existe logaritmo de números positivos, por isso $${p}>0$, isto é, $${coefX([a, 1])}>${-b}$. ${passo} Em $x=${rT}$ o argumento é 0, que também não tem logaritmo, por isso o extremo fica de fora: $${correta.tex}$.`,
    verificacao: { forma: 'linear', a, b },
  });
}

function dominioQuadratico(rng) {
  const forma = um(rng, ['quad-menos', 'quad-menos', 'menos-quad', 'quad-mais']);
  const perfeito = rng() < 0.75;
  const d = perfeito ? um(rng, [1, 4, 9, 16, 25]) : um(rng, [2, 3, 5, 7]);
  const s = { v: Math.sqrt(d), tex: perfeito ? String(Math.sqrt(d)) : `\\sqrt{${d}}` };
  const ns = { v: -s.v, tex: `-${s.tex}` };
  const g = um(rng, ['\\ln', '\\log', '\\log_{2}', '\\log_{3}']);
  const poli = forma === 'quad-menos' ? `x^{2}-${d}` : (forma === 'menos-quad' ? `${d}-x^{2}` : `x^{2}+${d}`);
  let correta;
  let grupos;
  let explicacao;
  if (forma === 'quad-menos') {
    correta = opInt(iv(MINF, ns), iv(s, INF));
    grupos = [
      [opInt(iv(ns, s)), opRSem(ns, s)],
      [opInt(iv(s, INF)), opInt(iv(MINF, ns, false, true), iv(s, INF, true))],
      [opR(), opInt(iv(ns, INF))],
    ];
    explicacao = `Precisas de $${poli}>0$, ou seja, $x^{2}>${d}$. Isso acontece quando $x$ está longe de 0: $x<${ns.tex}$ ou $x>${s.tex}$. Em $x=\\pm${s.tex}$ o argumento é 0, por isso esses pontos ficam de fora. Erro típico: resolver $x^{2}>${d}$ só com $x>${s.tex}$ e esquecer os valores negativos.`;
  } else if (forma === 'menos-quad') {
    correta = opInt(iv(ns, s));
    grupos = [
      [opInt(iv(MINF, ns), iv(s, INF)), opInt(iv(ns, s, true, true))],
      [opInt(iv(pt(0), s)), opInt(iv(MINF, s))],
      [opR(), opRSem(ns, s)],
    ];
    explicacao = `Precisas de $${poli}>0$, ou seja, $x^{2}<${d}$. Isso acontece quando $x$ está entre $${ns.tex}$ e $${s.tex}$. Nos extremos o argumento é 0, que não tem logaritmo, por isso o intervalo é aberto: $${correta.tex}$.`;
  } else {
    correta = opR();
    grupos = [
      [opInt(iv(MINF, ns), iv(s, INF)), opInt(iv(ns, s))],
      [opInt(iv(pt(0), INF)), opRSem(pt(0))],
      [opInt(iv(MINF, pt(0)))],
    ];
    explicacao = `Como $x^{2}\\ge0$ para todo o $x$, tem-se $${poli}\\ge${d}>0$: o argumento é sempre positivo e o domínio é $\\mathbb{R}$. Não resolvas $x^{2}+${d}>0$ como se fosse $x^{2}>${d}$.`;
  }
  return pergunta(rng, 'existe', {
    enunciado: um(rng, [
      `Qual é o domínio da função $f(x)=${g}(${poli})$?`,
      `Determina o domínio de $f(x)=${g}(${poli})$.`,
    ]),
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao,
    verificacao: { forma, d },
  });
}

function dominioQuociente(rng) {
  const [p, q] = M.baralhar(rng, [-4, -3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 2);
  const lo = Math.min(p, q);
  const hi = Math.max(p, q);
  const g = um(rng, ['\\ln', '\\log', '\\log_{2}']);
  const correta = opInt(iv(MINF, pt(lo)), iv(pt(hi), INF));
  const fechadoEmP = p < q
    ? opInt(iv(MINF, pt(p), false, true), iv(pt(q), INF))
    : opInt(iv(MINF, pt(q)), iv(pt(p), INF, true));
  const outras = distratores(rng, correta, [
    [opInt(iv(pt(lo), pt(hi))), opRSem(pt(q))],
    [opRSem(pt(lo), pt(hi)), fechadoEmP],
    [opInt(iv(pt(lo), INF)), opR()],
  ]);
  const frac = `\\frac{${fator(p)}}{${fator(q)}}`;
  return pergunta(rng, 'existe', {
    enunciado: `Qual é o domínio da função $f(x)=${g}\\left(${frac}\\right)$?`,
    correta,
    outras,
    explicacao: `O argumento tem de ser positivo: $${frac}>0$. Um quociente é positivo quando o numerador e o denominador têm o mesmo sinal, e isso acontece fora do intervalo entre os zeros ${lo} e ${hi}: $x<${lo}$ ou $x>${hi}$. O zero do denominador não é permitido e o do numerador dá argumento 0, por isso nenhum dos dois pertence ao domínio.`,
    verificacao: { forma: 'quociente', p, q },
  });
}

// ---------- 4. Propriedades dos logaritmos ----------

const COEFS_1 = [[1, 1], [2, 1], [3, 1], [1, 2]];
const COEFS_2 = [1, 2];
const prefixoCoef = ([p, q]) => (q === 2 ? '\\frac{1}{2}' : (p === 1 ? '' : String(p)));
/** x elevado ao coeficiente: m, m^{2}, \sqrt{m}. */
const potCoef = (x, [p, q]) => (q === 2 ? `\\sqrt{${x}}` : (p === 1 ? String(x) : `${x}^{${p}}`));

const cacheProp = {};
/** Todas as expressões c1·log_b m ± c2·log_b n de valor inteiro (e que não são duas contas triviais). */
function candidatosPropriedades(b) {
  if (cacheProp[b]) return cacheProp[b];
  const lb = Math.log(b);
  const L = (n) => Math.log(n) / lb;
  const inteiro = (x) => Math.abs(x - Math.round(x)) < 1e-9;
  const lista = [];
  for (let m = 2; m <= 100; m++) {
    for (let n = 2; n <= 100; n++) {
      if (m === n || (inteiro(L(m)) && inteiro(L(n)))) continue;
      for (const c1 of COEFS_1) {
        for (const c2 of COEFS_2) {
          for (const s2 of [1, -1]) {
            const v = (c1[0] / c1[1]) * L(m) + s2 * c2 * L(n);
            if (inteiro(v) && Math.abs(v) <= 8) lista.push({ m, n, c1, c2, s2, v: Math.round(v) });
          }
        }
      }
    }
  }
  cacheProp[b] = lista;
  return lista;
}

/** Expressões com ln: o valor exato conhece-se por construção. */
function propriedadesLn(rng) {
  const m = um(rng, [2, 3, 5, 7]);
  const k = um(rng, [1, 2, 3]);
  const ek = k === 1 ? 'e' : `e^{${k}}`;
  const j = um(rng, [2, 3, 4]);
  const n = um(rng, [2, 3, 4, 5, 6].filter((x) => x !== m));
  const modelos = [
    () => ({
      tex: `\\ln ${m}+\\ln\\frac{${ek}}{${m}}`,
      v: [k, 1],
      terms: [{ s: 1, c: [1, 1], arg: m, argTex: String(m) }, { s: 1, c: [1, 1], arg: Math.exp(k) / m, argTex: `\\frac{${ek}}{${m}}` }],
      texto: `A soma de logaritmos é o logaritmo do produto: $\\ln ${m}+\\ln\\frac{${ek}}{${m}}=\\ln\\left(${m}\\times\\frac{${ek}}{${m}}\\right)=\\ln ${ek}=${k}$.`,
    }),
    () => ({
      tex: `\\ln\\left(${m}${ek}\\right)-\\ln ${m}`,
      v: [k, 1],
      terms: [{ s: 1, c: [1, 1], arg: m * Math.exp(k), argTex: `${m}${ek}` }, { s: -1, c: [1, 1], arg: m, argTex: String(m) }],
      texto: `A diferença de logaritmos é o logaritmo do quociente: $\\ln\\left(${m}${ek}\\right)-\\ln ${m}=\\ln\\frac{${m}${ek}}{${m}}=\\ln ${ek}=${k}$.`,
    }),
    () => ({
      tex: `\\ln e^{${j}}-\\ln\\sqrt{e}`,
      v: [2 * j - 1, 2],
      terms: [{ s: 1, c: [1, 1], arg: Math.exp(j), argTex: `e^{${j}}` }, { s: -1, c: [1, 1], arg: Math.sqrt(Math.E), argTex: '\\sqrt{e}' }],
      texto: `$\\ln e^{${j}}=${j}$ e $\\ln\\sqrt{e}=\\ln e^{\\frac{1}{2}}=\\frac{1}{2}$, por isso a diferença é $${j}-\\frac{1}{2}=${fr(2 * j - 1, 2)}$.`,
    }),
    () => ({
      tex: `\\frac{1}{2}\\ln e^{${2 * j}}+\\ln\\frac{1}{e}`,
      v: [j - 1, 1],
      terms: [{ s: 1, c: [1, 2], arg: Math.exp(2 * j), argTex: `e^{${2 * j}}` }, { s: 1, c: [1, 1], arg: 1 / Math.E, argTex: '\\frac{1}{e}' }],
      texto: `$\\frac{1}{2}\\ln e^{${2 * j}}=\\frac{1}{2}\\times${2 * j}=${j}$ e $\\ln\\frac{1}{e}=\\ln e^{-1}=-1$, logo o total é $${j}-1=${j - 1}$.`,
    }),
    () => ({
      tex: `\\ln ${m}+\\ln ${n}-\\ln ${m * n}`,
      v: [0, 1],
      terms: [{ s: 1, c: [1, 1], arg: m, argTex: String(m) }, { s: 1, c: [1, 1], arg: n, argTex: String(n) }, { s: -1, c: [1, 1], arg: m * n, argTex: String(m * n) }],
      texto: `A soma é o logaritmo do produto: $\\ln ${m}+\\ln ${n}=\\ln ${m * n}$. Subtraindo $\\ln ${m * n}$ fica $0$.`,
    }),
  ];
  return { ...um(rng, modelos)(), base: Math.E };
}

function propriedades(rng) {
  if (rng() < 0.25) {
    const { tex, v, terms, base, texto } = propriedadesLn(rng);
    return fecharPropriedades(rng, tex, v, terms, base, texto);
  }
  const b = um(rng, [2, 2, 3, 5, 10, 10]);
  const { m, n, c1, c2, s2, v } = um(rng, candidatosPropriedades(b));
  const cb = cabeca(b);
  const tex = `${prefixoCoef(c1)}${cb} ${m}${s2 > 0 ? '+' : '-'}${prefixoCoef([c2, 1])}${cb} ${n}`;
  const bruto = s2 > 0
    ? `${potCoef(m, c1)}\\times ${potCoef(n, [c2, 1])}`
    : `\\frac{${potCoef(m, c1)}}{${potCoef(n, [c2, 1])}}`;
  const numero = v >= 0 ? String(b ** v) : `\\frac{1}{${b ** -v}}`;
  const passos = [`${cb}\\left(${bruto}\\right)`, `${cb} ${arg(numero)}`];
  if (v !== 0) passos.push(v === 1 ? `${cb} ${b}` : `${cb} ${b}^{${v}}`);
  const unicos = passos.filter((p, i) => i === 0 || p !== passos[i - 1]);
  const props = [];
  if (c1[0] !== 1 || c1[1] !== 1 || c2 !== 1) props.push('$k\\log_b a=\\log_b a^k$');
  props.push(s2 > 0 ? '$\\log_b x+\\log_b y=\\log_b(xy)$' : '$\\log_b x-\\log_b y=\\log_b\\frac{x}{y}$');
  const explicacao = `Junta tudo num só logaritmo com ${props.join(' e ')}. Assim, $${tex}=${unicos.join('=')}=${v}$.`;
  const terms = [
    { s: 1, c: c1, arg: m, argTex: String(m) },
    { s: s2, c: [c2, 1], arg: n, argTex: String(n) },
  ];
  return fecharPropriedades(rng, tex, [v, 1], terms, b, explicacao);
}

function fecharPropriedades(rng, tex, v, terms, base, explicacao) {
  const o = opNum(v[0], v[1]);
  const enunciado = um(rng, [
    (e) => `Calcula o valor exato de $${e}$.`,
    (e) => `Sem calculadora, calcula $${e}$.`,
    (e) => `Qual é o valor de $${e}$?`,
    (e) => `Simplifica $${e}$ até obteres um número.`,
  ])(tex);
  return escrita('propriedades', {
    enunciado, expr: o.expr, tex: o.tex, explicacao,
    verificacao: { base, terms: terms.map(({ s, c, arg: a, argTex }) => ({ s, c, arg: a, argTex })), valor: v, expressao: tex },
  });
}

// ---------- 5. Mudança de base ----------

const MAX_EXP = { 2: 6, 3: 4, 5: 3, 7: 2 };
let combosMudanca = null;
/** (c, s, t) com t/s não inteiro: log_{c^s} c^t. */
function combinacoesMudanca() {
  if (combosMudanca) return combosMudanca;
  combosMudanca = [];
  for (const c of [2, 3, 5]) {
    for (let s = 2; s <= MAX_EXP[c]; s++) {
      for (let t = 1; t <= MAX_EXP[c]; t++) if (t !== s && t % s !== 0) combosMudanca.push({ c, s, t });
    }
  }
  return combosMudanca;
}

const sufixoReduzido = (t, s) => {
  const [rp, rq] = M.reduzir(t, s);
  return rp !== t || rq !== s ? `=${fr(rp, rq)}` : '';
};

function mudancaBase(rng) {
  const q = rng();
  let r;
  if (q < 0.5) r = mudancaDireta(rng);
  else if (q < 0.75) r = mudancaQuociente(rng);
  else r = mudancaProduto(rng);
  const [rp, rq] = r.valor;
  const o = opNum(rp, rq);
  return escrita('mudanca-base', {
    enunciado: um(rng, [
      (e) => `Calcula o valor exato de $${e}$.`,
      (e) => `Sem calculadora, calcula $${e}$.`,
      (e) => `Qual é o valor de $${e}$?`,
    ])(r.tex),
    expr: o.expr,
    tex: o.tex,
    explicacao: r.explicacao,
    verificacao: { forma: r.forma, logs: r.logs, valor: r.valor, expressao: r.tex },
  });
}

function mudancaDireta(rng) {
  const { c, s, t } = um(rng, combinacoesMudanca());
  const A = c ** s;
  const B = c ** t;
  return {
    forma: 'direta',
    tex: `\\log_{${A}} ${B}`,
    logs: [{ base: A, arg: B }],
    valor: M.reduzir(t, s),
    explicacao: `A mudança de base diz que $\\log_a b=\\frac{\\log_c b}{\\log_c a}$, com $c$ à tua escolha. Escolhe $c=${c}$, porque $${A}=${c}^{${s}}$ e $${B}=${c}^{${t}}$: $\\log_{${A}} ${B}=\\frac{\\log_{${c}} ${B}}{\\log_{${c}} ${A}}=\\frac{${t}}{${s}}${sufixoReduzido(t, s)}$. O logaritmo da base fica no denominador, por isso não é $\\frac{${s}}{${t}}$.`,
  };
}

function mudancaQuociente(rng) {
  const d = um(rng, [2, 3, 5, 7]);
  const exps = [];
  for (let k = 1; k <= MAX_EXP[d]; k++) exps.push(k);
  const u = um(rng, exps);
  const w = um(rng, exps.filter((k) => k !== u));
  const k = um(rng, [2, 3, 5, 'e', 10]);
  const cb = cabeca(k);
  const m = d ** w;
  const n = d ** u;
  return {
    forma: 'quociente',
    tex: `\\frac{${cb} ${m}}{${cb} ${n}}`,
    logs: [{ base: k === 'e' ? Math.E : k, arg: m }, { base: k === 'e' ? Math.E : k, arg: n }],
    valor: M.reduzir(w, u),
    explicacao: `Um quociente de logaritmos com a mesma base é um logaritmo de mudança de base: $\\frac{${cb} ${m}}{${cb} ${n}}=\\log_{${n}} ${m}$. Procura o expoente $x$ tal que $${n}^{x}=${m}$. Como $${n}=${d}^{${u}}$ e $${m}=${d}^{${w}}$, vem $${d}^{${coefX([u, 1])}}=${d}^{${w}}$, logo $${coefX([u, 1])}=${w}$ e $x=${fr(w, u)}$.`,
  };
}

function mudancaProduto(rng) {
  const c = um(rng, [2, 3, 5]);
  const s = um(rng, [1, 2, 3]);
  const t = M.inteiro(rng, 1, MAX_EXP[c]);
  const A = c ** s;
  const D = c ** t;
  const potenciaDeC = (x) => {
    let p = 1;
    while (p < x) p *= c;
    return p === x;
  };
  const b = um(rng, [3, 5, 6, 7, 10, 11].filter((x) => !potenciaDeC(x)));
  return {
    forma: 'produto',
    tex: `\\log_{${A}} ${b}\\times\\log_{${b}} ${D}`,
    logs: [{ base: A, arg: b }, { base: b, arg: D }],
    valor: M.reduzir(t, s),
    explicacao: `Passa tudo para logaritmos neperianos com a mudança de base: $\\log_a b=\\frac{\\ln b}{\\ln a}$. Então $\\log_{${A}} ${b}\\times\\log_{${b}} ${D}=\\frac{\\ln ${b}}{\\ln ${A}}\\times\\frac{\\ln ${D}}{\\ln ${b}}=\\frac{\\ln ${D}}{\\ln ${A}}=\\log_{${A}} ${D}$, porque $\\ln ${b}$ cancela. Como $${A}=${c}^{${s}}$ e $${D}=${c}^{${t}}$, o valor é $\\frac{${t}}{${s}}${sufixoReduzido(t, s)}$.`,
  };
}

// ---------- 6. Equações exponenciais com a mesma base ----------

function expMesmaBase(rng) {
  let c;
  let s;
  let t;
  let p;
  let h;
  let x = null;
  for (let i = 0; i < 80 && !x; i++) {
    c = um(rng, [2, 2, 3, 5]);
    s = um(rng, S_BASE[c]);
    const ts = [];
    for (let k = T_INT[c][0]; k <= T_INT[c][1]; k++) ts.push([k, 1]);
    t = um(rng, [...ts, ...T_EXTRA]);
    p = um(rng, [1, 1, 2, -1]);
    h = M.inteiro(rng, -3, 3);
    const [xp, xq] = M.reduzir(t[0] * s[1] - h * t[1] * s[0], t[1] * s[0] * p);
    if (xq <= 6 && Math.abs(xp / xq) <= 10) x = [xp, xq];
  }
  if (!x) { c = 2; s = [1, 1]; t = [-3, 1]; p = 1; h = 1; x = [-4, 1]; }
  const bt = s[1] === 1 && s[0] > 0 ? String(c ** s[0]) : `\\left(${potTex(c, s)}\\right)`;
  const rhs = potTex(c, t);
  const expo = polinomio(p, h);
  const sT = fr(s[0], s[1]);
  const tT = fr(t[0], t[1]);
  const xT = fr(x[0], x[1]);
  const sx = s[0] === 1 && s[1] === 1 ? '' : (s[0] === -1 && s[1] === 1 ? '-' : sT);
  const igualdade = `${sx}${sx === '' ? expo : `\\left(${expo}\\right)`}=${tT}`;
  const explicacao = s[0] === 1 && s[1] === 1
    ? `Escreve o segundo membro como potência de ${c}: $${rhs}=${c}^{${tT}}$. Como a função exponencial é injetiva, duas potências com a mesma base só são iguais se os expoentes forem iguais: $${igualdade}$, logo $x=${xT}$.`
    : `Escreve os dois lados como potências de ${c}: $${bt}=${c}^{${sT}}$ e $${rhs}=${c}^{${tT}}$. A equação fica $${c}^{${sx}\\left(${expo}\\right)}=${c}^{${tT}}$ e, como a base é a mesma, os expoentes são iguais: $${igualdade}$, o que dá $x=${xT}$.`;
  const o = opNum(x[0], x[1]);
  return escrita('exp-mesma-base', {
    enunciado: um(rng, [
      `Resolve a equação $${bt}^{${expo}}=${rhs}$.`,
      `Qual é a solução da equação $${bt}^{${expo}}=${rhs}$?`,
      `Determina o valor de $x$ que verifica $${bt}^{${expo}}=${rhs}$.`,
    ]),
    expr: o.expr,
    tex: o.tex,
    explicacao,
    verificacao: { base: c ** (s[0] / s[1]), rhs: c ** (t[0] / t[1]), p, h, x, baseTex: bt, rhsTex: rhs },
  });
}

// ---------- 7. Equações logarítmicas ----------

const nomeBase = (b) => (b === 'e' ? Math.E : b);

function eqLog(rng) {
  const q = rng();
  if (q < 0.34) return eqLogSimples(rng);
  if (q < 0.62) return eqLogSoma(rng);
  if (q < 0.77) return eqLogQuadrado(rng);
  return eqLogIguais(rng);
}

/** «Quantas soluções?»: as opções são 0, 1, 2 e 3. */
function eqQuantas(rng, n, E, explicacao, verificacao) {
  const ops = [0, 1, 2, 3].map((k) => opNum(k));
  return pergunta(rng, 'eq-log', {
    enunciado: um(rng, [`Quantas soluções reais tem a equação $${E}$?`, `Em $\\mathbb{R}$, quantas soluções tem a equação $${E}$?`]),
    correta: ops[n],
    outras: ops.filter((_, i) => i !== n),
    explicacao,
    verificacao,
  });
}

function eqSolucao(rng, E, expr, tex, explicacao, verificacao, enunciados) {
  return escrita('eq-log', { enunciado: um(rng, enunciados)(E), expr, tex, explicacao, verificacao });
}
const ENUNCIADOS_EQ = [
  (E) => `Resolve a equação $${E}$.`,
  (E) => `Qual é a solução da equação $${E}$?`,
  (E) => `Determina a solução de $${E}$.`,
];

function eqLogSimples(rng) {
  const b = um(rng, [2, 3, 4, 5, 10, 'e']);
  const p = um(rng, [1, 1, 2, 3]);
  const h = um(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const k = b === 'e' ? um(rng, [0, 1, 2]) : um(rng, b === 10 ? [-1, 0, 1, 2] : [-1, 0, 1, 2, 3]);
  const pol = polinomio(p, h);
  const cb = cabeca(b);
  const E = `${cb}\\left(${pol}\\right)=${k}`;
  let expr;
  let tex;
  let valor;
  let bk;
  if (b === 'e' && k > 0) {
    const ek = k === 1 ? 'e' : `e^{${k}}`;
    const numer = h > 0 ? `${ek}-${h}` : `${ek}+${-h}`;
    tex = p === 1 ? numer : `\\frac{${numer}}{${p}}`;
    expr = `(${k === 1 ? 'e' : `e^${k}`}${h > 0 ? '-' : '+'}${Math.abs(h)})/${p}`;
    valor = (Math.exp(k) - h) / p;
    bk = ek;
  } else {
    const [n, d] = b === 'e' ? [1, 1] : (k >= 0 ? [b ** k, 1] : [1, b ** -k]);
    const [xp, xq] = M.reduzir(n - h * d, d * p);
    const o = opNum(xp, xq);
    expr = o.expr;
    tex = o.tex;
    valor = xp / xq;
    bk = fr(n, d);
  }
  const explicacao = `Condição de existência: $${pol}>0$. Na forma exponencial, $${E}$ equivale a $${pol}=${b}^{${k}}$, isto é, $${pol}=${bk}$, e daí $x=${tex}$. Esta solução serve: o argumento vale $${bk}$, que é positivo.`;
  return eqSolucao(rng, E, expr, tex, explicacao,
    { forma: 'simples', b: nomeBase(b), p, h, k, solucoes: [valor] }, ENUNCIADOS_EQ);
}

function eqLogSoma(rng) {
  const b = um(rng, [2, 2, 3, 5]);
  const k = um(rng, [1, 2, 3, 4, 5].filter((e) => b ** e <= 250));
  const N = b ** k;
  const pares = [];
  for (let v = 1; v * v < N; v++) if (N % v === 0 && N / v > v) pares.push([N / v, v]);
  const [u, v] = um(rng, pares);
  const h = u - v;
  const orient = um(rng, ['menos', 'mais']);
  const cb = cabeca(b);
  const E = orient === 'menos' ? `${cb} x+${cb}\\left(${fator(h)}\\right)=${k}` : `${cb}\\left(${fator(-h)}\\right)+${cb} x=${k}`;
  const valida = orient === 'menos' ? u : v;
  const rejeitada = orient === 'menos' ? -v : -u;
  const verificacao = { forma: 'soma', b, h, k, orient, solucoes: [valida], rejeitadas: [rejeitada] };
  const condicao = orient === 'menos' ? `$x>0$ e $x-${h}>0$, ou seja, $x>${h}$` : `$x+${h}>0$ e $x>0$, ou seja, $x>0$`;
  const quadrado = orient === 'menos' ? `x^{2}-${h}x-${N}=0` : `x^{2}+${h}x-${N}=0`;
  const explicacao = `Condição de existência: ${condicao}. Juntando os logaritmos, $${cb}\\left(${orient === 'menos' ? `x(${fator(h)})` : `(${fator(-h)})x`}\\right)=${k}$, logo o produto é $${b}^{${k}}=${N}$ e fica $${quadrado}$, com soluções $x=${valida}$ e $x=${rejeitada}$. Só $x=${valida}$ cumpre a condição de existência; $x=${rejeitada}$ é rejeitada.`;
  if (rng() < 0.5) {
    return eqSolucao(rng, E, String(valida), String(valida), explicacao, verificacao, ENUNCIADOS_EQ);
  }
  return eqQuantas(rng, 1, E, explicacao, verificacao);
}

function eqLogQuadrado(rng) {
  const casos = [[2, 2, 2], [2, 4, 4], [3, 2, 3], [3, 4, 9], [5, 2, 5], [10, 2, 10], [4, 1, 2], [4, 3, 8], ['e', 2, 'e']];
  const [b, k, r] = um(rng, casos);
  const cb = cabeca(b);
  const rTex = String(r);
  const rExpr = String(r);
  if (rng() < 0.55) {
    const E = `${cb}\\left(x^{2}\\right)=${k}`;
    const explicacao = `Condição de existência: $x^{2}>0$, ou seja, $x\\neq0$. Então $x^{2}=${b}^{${k}}$, e $x=\\pm ${rTex}$. As duas soluções cumprem a condição, por isso há duas. Compara com $2${cb} x=${k}$, onde é preciso $x>0$ e só sobra $x=${rTex}$.`;
    const verificacao = { forma: 'quadrado', b: nomeBase(b), k, solucoes: [-valorR(r), valorR(r)] };
    if (rng() < 0.5) return eqQuantas(rng, 2, E, explicacao, verificacao);
    return eqSolucao(rng, E, rExpr, rTex, explicacao, verificacao, [
      (e) => `Qual é a maior solução da equação $${e}$?`,
      (e) => `Resolve a equação $${e}$ e indica a maior solução.`,
    ]);
  }
  const E = `2${cb} x=${k}`;
  const explicacao = `Condição de existência: $x>0$. Dividindo por 2, $${cb} x=${fr(k, 2)}$, logo $x=${b}^{${fr(k, 2)}}=${rTex}$, que é positivo. Atenção: $\\ln(x^{2})$ e $2\\ln x$ não são iguais para todos os $x$, porque o primeiro aceita $x<0$.`;
  const verificacao = { forma: 'dobro', b: nomeBase(b), k, solucoes: [valorR(r)] };
  if (rng() < 0.75) return eqSolucao(rng, E, rExpr, rTex, explicacao, verificacao, ENUNCIADOS_EQ);
  return eqQuantas(rng, 1, E, explicacao, verificacao);
}
const valorR = (r) => (r === 'e' ? Math.E : r);

function eqLogIguais(rng) {
  const b = um(rng, [2, 3, 'e', 10]);
  const cb = cabeca(b);
  let p;
  let q;
  let h;
  let j;
  let x;
  let valida;
  const alvo = rng() < 0.55;
  for (let i = 0; i < 60; i++) {
    p = um(rng, [1, 2, 3]);
    q = um(rng, [-1, 1, 2, 3].filter((e) => e !== p));
    h = M.inteiro(rng, -4, 4);
    j = M.inteiro(rng, -4, 4);
    x = M.reduzir(j - h, p - q);
    valida = p * x[0] + h * x[1] > 0;
    if (valida === alvo) break;
  }
  const E = `${cb}\\left(${polinomio(p, h)}\\right)=${cb}\\left(${polinomio(q, j)}\\right)`;
  const argT = fr(p * x[0] + h * x[1], x[1]);
  const xT = fr(x[0], x[1]);
  const explicacao = `Dois logaritmos na mesma base são iguais quando os argumentos são iguais: $${polinomio(p, h)}=${polinomio(q, j)}$, e daí $x=${xT}$. Falta ver a condição de existência: para $x=${xT}$ o argumento vale $${argT}$, ${valida ? 'que é positivo, por isso a solução serve' : 'que não é positivo, por isso esta solução é rejeitada e a equação é impossível'}.`;
  const solucoes = valida ? [x[0] / x[1]] : [];
  const verificacao = { forma: 'iguais', p, h, q, j, solucoes };
  if (valida && rng() < 0.5) {
    const o = opNum(x[0], x[1]);
    return eqSolucao(rng, E, o.expr, o.tex, explicacao, verificacao, ENUNCIADOS_EQ);
  }
  return eqQuantas(rng, valida ? 1 : 0, E, explicacao, verificacao);
}

// ---------- 8. Equações com substituição de variável ----------

function substituicao(rng) {
  const natural = rng() < 0.22;
  const c = natural ? 'e' : um(rng, [2, 2, 3, 5]);
  const negativa = rng() < 0.4;
  let u1;
  let u2;
  const potencias = natural ? [1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4].map((k) => c ** k).filter((v) => v <= 130);
  do {
    u1 = um(rng, potencias);
    u2 = negativa ? -M.inteiro(rng, 1, 6) : um(rng, potencias);
  } while (u1 === u2 || u1 + u2 === 0);
  const B = -(u1 + u2);
  const C = u1 * u2;
  const cT = String(c);
  const quadrado = !natural && rng() < 0.5 ? `${c * c}^{x}` : `${cT}^{${2}x}`;
  const lin = natural ? `e^{x}` : `${cT}^{x}`;
  const termoB = `${B > 0 ? '+' : '-'}${Math.abs(B) === 1 ? '' : (natural ? Math.abs(B) : `${Math.abs(B)}\\times `)}${lin}`;
  const E = `${quadrado}${termoB}${C > 0 ? '+' : '-'}${Math.abs(C)}=0`;
  const log = (u) => (natural ? Math.log(u) : Math.round(Math.log(u) / Math.log(c)));
  const positivas = [u1, u2].filter((u) => u > 0).sort((a, b) => a - b);
  const xs = positivas.map(log);
  const xTex = (u) => (natural ? (u === 1 ? '0' : `\\ln ${u}`) : String(log(u)));
  const tipos = positivas.length === 2 ? ['numero', 'soma', 'maior'] : ['numero', 'solucao'];
  const pedido = um(rng, tipos);
  let expr;
  let tex;
  let enunciado;
  let valor;
  if (pedido === 'numero') {
    expr = String(positivas.length); tex = expr; valor = positivas.length;
    enunciado = `Quantas soluções reais tem a equação $${E}$?`;
  } else if (pedido === 'soma') {
    valor = xs[0] + xs[1];
    if (natural) { expr = `ln(${positivas[0] * positivas[1]})`; tex = `\\ln ${positivas[0] * positivas[1]}`; } else { expr = String(valor); tex = String(valor); }
    enunciado = `Qual é a soma das soluções da equação $${E}$?`;
  } else {
    valor = Math.max(...xs);
    const maior = positivas[positivas.length - 1];
    if (natural) { expr = maior === 1 ? '0' : `ln(${maior})`; tex = xTex(maior); } else { expr = String(valor); tex = String(valor); }
    enunciado = pedido === 'maior' ? `Qual é a maior solução da equação $${E}$?` : `Qual é a solução da equação $${E}$?`;
  }
  const passo1 = !natural && quadrado.startsWith(`${c * c}`)
    ? `$${c * c}^{x}=\\left(${c}^{2}\\right)^{x}=\\left(${c}^{x}\\right)^{2}$`
    : `$${natural ? 'e' : c}^{2x}=\\left(${natural ? 'e' : c}^{x}\\right)^{2}$`;
  const lado = (u) => `${lin}=${u}`;
  const voltar = positivas.map((u) => `$${lado(u)}\\Leftrightarrow x=${xTex(u)}$`).join(' e ');
  const rejeicao = negativa ? ` $u=${Math.min(u1, u2)}$ não serve, porque $${lin}>0$ para todo o $x$.` : '';
  const fecho = pedido === 'numero' ? `Há ${positivas.length} solução(ões) reais.`
    : (pedido === 'soma' ? `A soma é $${tex}$.` : `A solução pedida é $${tex}$.`);
  const explicacao = `Faz $u=${lin}$, com $u>0$. Como ${passo1}, a equação fica $u^{2}${B > 0 ? '+' : '-'}${Math.abs(B) === 1 ? '' : Math.abs(B)}u${C > 0 ? '+' : '-'}${Math.abs(C)}=0$, com soluções $u=${u1}$ e $u=${u2}$.${rejeicao} Voltando a $x$: ${voltar}. ${fecho}`;
  return escrita('substituicao', {
    enunciado, expr, tex, explicacao,
    verificacao: { c: natural ? Math.E : c, B, C, pedido, valor, equacao: E },
  });
}

// ---------- 9. Inequações exponenciais e logarítmicas ----------

const OPS_TEX = { '>': '>', '>=': '\\ge ', '<': '<', '<=': '\\le ' };
const OPOSTO = { '>': '<', '>=': '<=', '<': '>', '<=': '>=' };
const ALTERNA = { '>': '>=', '>=': '>', '<': '<=', '<=': '<' };

/** x OP r em intervalo: > e >= vão até +∞, < e <= vêm de -∞ (ou de `piso`). */
function intDe(op, r, piso = MINF) {
  if (op === '>') return opInt(iv(r, INF));
  if (op === '>=') return opInt(iv(r, INF, true));
  if (op === '<') return opInt(iv(piso, r));
  return opInt(iv(piso, r, false, true));
}

function inequacao(rng) {
  return rng() < 0.5 ? inequacaoExp(rng) : inequacaoLog(rng);
}

function inequacaoExp(rng) {
  const base = um(rng, [[2, 1], [3, 1], [5, 1], [1, 2], [1, 3], [2, 1], [1, 2]]);
  const k = M.inteiro(rng, -3, 4);
  const h = um(rng, [0, 0, -2, -1, 1, 2]);
  const op = um(rng, ['>', '>=', '<', '<=']);
  const cresc = base[0] > base[1];
  const opFinal = cresc ? op : OPOSTO[op];
  const r = pt(k - h);
  const rhs = ratPot(base, k);
  const expo = polinomio(1, h);
  const E = `${baseTex(base)}^{${expo}}${OPS_TEX[op]}${fr(...rhs)}`;
  const correta = intDe(opFinal, r);
  const errado = pt(k);
  const errado2 = h !== 0 ? errado : pt(-(k - h) === k - h ? k + 1 : -(k - h));
  const outras = distratores(rng, correta, [
    [intDe(OPOSTO[opFinal], r)],
    [intDe(ALTERNA[opFinal], r), intDe(opFinal, errado2)],
    [intDe(OPOSTO[opFinal], errado2), opR()],
  ]);
  const sentido = cresc
    ? 'Como a base é maior do que 1, a função exponencial é crescente e o sentido da desigualdade mantém-se'
    : 'Como a base está entre 0 e 1, a função exponencial é decrescente e o sentido da desigualdade inverte-se';
  const explicacao = `Escreve o segundo membro como potência da mesma base: $${fr(...rhs)}=${baseTex(base)}^{${k}}$. ${sentido}: $${expo}${OPS_TEX[opFinal]}${k}$, logo $x${OPS_TEX[opFinal]}${k - h}$ e o conjunto-solução é $${correta.tex}$.`;
  return pergunta(rng, 'inequacao', {
    enunciado: um(rng, [`Resolve a inequação $${E}$.`, `Qual é o conjunto-solução da inequação $${E}$?`]),
    correta,
    outras,
    explicacao,
    verificacao: { forma: 'exp', base: base[0] / base[1], k, h, op },
  });
}

function inequacaoLog(rng) {
  const natural = rng() < 0.3;
  const base = natural ? null : um(rng, [[2, 1], [3, 1], [5, 1], [10, 1], [1, 2], [1, 3], [2, 1], [1, 2]]);
  const k = natural ? um(rng, [-1, 0, 1, 2]) : (base[0] === 10 ? um(rng, [-1, 1, 2]) : um(rng, [-2, -1, 1, 2, 3]));
  const op = um(rng, ['>', '>=', '<', '<=']);
  const cresc = natural || base[0] > base[1];
  const opFinal = cresc ? op : OPOSTO[op];
  let limiar;
  let limiarTex;
  if (natural) {
    limiar = { v: Math.exp(k), tex: k === 0 ? '1' : (k === 1 ? 'e' : (k === -1 ? '\\frac{1}{e}' : `e^{${k}}`)) };
    limiarTex = limiar.tex;
  } else {
    const [n, d] = ratPot(base, k);
    limiar = pt(n, d);
    limiarTex = fr(n, d);
  }
  const zero = pt(0);
  const cb = natural ? '\\ln' : (base[0] === 10 && base[1] === 1 ? '\\log' : `\\log_{${fr(...base)}}`);
  const E = `${cb} x${OPS_TEX[op]}${k}`;
  const correta = intDe(opFinal, limiar, zero);
  const pontoErrado = pt(k === 0 ? 2 : k);
  const outras = distratores(rng, correta, [
    [intDe(OPOSTO[opFinal], limiar, zero), opFinal.startsWith('<') ? intDe(opFinal, limiar) : null],
    [intDe(ALTERNA[opFinal], limiar, zero), intDe(opFinal, pontoErrado, zero)],
    [intDe(OPOSTO[opFinal], pontoErrado, zero), opInt(iv(zero, INF))],
  ]);
  const bTex = natural ? 'e' : fr(...base);
  const sentido = cresc
    ? 'Como a base é maior do que 1, o logaritmo é crescente e o sentido mantém-se'
    : 'Como a base está entre 0 e 1, o logaritmo é decrescente e o sentido inverte-se';
  const explicacao = `Condição de existência: $x>0$. Escrevendo $${k}=${cb} ${bTex}^{${k}}$, ${sentido}: $x${OPS_TEX[opFinal]}${limiarTex}$. Juntando com $x>0$, o conjunto-solução é $${correta.tex}$.`;
  return pergunta(rng, 'inequacao', {
    enunciado: um(rng, [`Resolve a inequação $${E}$.`, `Qual é o conjunto-solução da inequação $${E}$?`]),
    correta,
    outras,
    explicacao,
    verificacao: { forma: 'log', base: natural ? Math.E : base[0] / base[1], k, op },
  });
}

// ---------- Registo ----------

export const TIPOS = [
  { id: 'valor-log', nome: 'Valor de um logaritmo', tema: 'Logaritmos', gerar: valorLog },
  { id: 'forma-exp', nome: 'Forma logarítmica e exponencial', tema: 'Logaritmos', gerar: formaExp },
  { id: 'existe', nome: 'Existência e domínio', tema: 'Função logarítmica', gerar: existe },
  { id: 'propriedades', nome: 'Propriedades dos logaritmos', tema: 'Propriedades', gerar: propriedades },
  { id: 'mudanca-base', nome: 'Mudança de base', tema: 'Propriedades', gerar: mudancaBase },
  // Desligados até terem recálculo independente da resposta certa em tests/geradores.html:
  // { id: 'exp-mesma-base', nome: 'Exponenciais com a mesma base', tema: 'Equações', gerar: expMesmaBase },
  // { id: 'eq-log', nome: 'Equações logarítmicas', tema: 'Equações', gerar: eqLog },
  // { id: 'substituicao', nome: 'Substituição de variável', tema: 'Equações', gerar: substituicao },
  // { id: 'inequacao', nome: 'Inequações', tema: 'Equações', gerar: inequacao },
  // derivadas, tangentes, limites e monotonia vêm de geradores-analise.js (módulo autónomo)
  ...TIPOS_ANALISE,
];

/** Gera uma pergunta do tipo `tipoId`. `rng` vem de M.criarRng; `dados` não é usado. */
export function gerarPergunta(tipoId, rng, dados) {
  const tipo = TIPOS.find((t) => t.id === tipoId);
  if (!tipo) throw new Error(`tipo de pergunta desconhecido: ${tipoId}`);
  return tipo.gerar(rng, dados || {});
}
