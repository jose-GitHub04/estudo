// logaritmo: «o logaritmo é um expoente». A forma logarítmica e a forma exponencial são a
// mesma frase escrita de duas maneiras (tradutor com três papéis a cores e formas fixas), e
// uma escada de potências deixa procurar à mão o expoente a que se eleva a base para dar y.
// Contrato: export async function montar(el, dados). `dados` não é usado.
// Estado guardado: nenhum (tudo se perde ao recarregar a página).
//
// A matemática (ler números, reconhecer potências exatas, intervalo do expoente, texto dos
// passos) é toda função pura, sem DOM, exportada para logaritmos/tests/logaritmo.html.
// O DOM começa em «montar».
//
// Convenção: os textos que terminam em «Tex» são LaTeX; os outros textos de aluno usam $...$
// e passam por rico(), que os converte em KaTeX.

import * as M from '../../assets/motor/matematica.js';
import { tex } from '../../assets/motor/katex.js';

// ---------- constantes ----------

const TOL = 1e-9; // tolerância relativa para dizer que a^x = y
const LIM_BASE = 1e6; // bases fora de [1/LIM_BASE, LIM_BASE] não cabem na escada
const LIM_JANELA = 20; // maior expoente (em módulo) que a escada mostra
const JANELA = [-3, 4]; // expoentes da escada quando o resultado cabe nela
const PASSO_FINO = 1; // décimas
const PASSO_GROSSO = 5;

const BASES = ['2', '3', '5', '10', '1/2', 'e'];
const NUMEROS = ['1/8', '1', '2', '8', '100', '0', '−4'];

// ---------- números ----------

const perto = (a, b, tol = TOL) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const virgula = (s) => s.replace('.', '{,}');
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Lê o que o aluno escreveu: 8, 1/8, 0,01, √2, e, ln 3... { ok, valor, dec } ou { ok: false, vazio?, erro }. */
export function lerNumero(texto) {
  const t = String(texto === undefined || texto === null ? '' : texto).trim();
  if (!t) return { ok: false, vazio: true, erro: 'vazio' };
  const r = M.avaliar(t);
  if (!r.ok) return { ok: false, erro: r.erro };
  return { ok: true, valor: r.valor, dec: r.dec };
}

/** Fração p/q (reduzida, q <= maxDen) igual a x a menos de `tol`; null se não houver. */
export function racionalDe(x, maxDen = 16, tol = 1e-9) {
  if (!Number.isFinite(x)) return null;
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(x * q);
    if (Math.abs(x - p / q) <= tol * Math.max(1, Math.abs(x))) {
      const [a, b] = M.reduzir(p, q);
      return [a || 0, b];
    }
  }
  return null;
}

const ehE = (a) => Math.abs(a - Math.E) < 1e-12;

/** a^x (com e^x exato). */
export const potencia = (a, x) => (a === Math.E ? Math.exp(x) : Math.pow(a, x));

/** log_a y, com os inteiros a cair certos (log_10 1000 = 3). Só para a > 0, a != 1, y > 0. */
export function logb(a, y) {
  let r;
  if (ehE(a)) r = Math.log(y);
  else if (a === 10) r = Math.log10(y);
  else if (a === 2) r = Math.log2(y);
  else r = Math.log(y) / Math.log(a);
  const q = Math.round(r);
  return Math.abs(r - q) < 1e-12 * Math.max(1, Math.abs(r)) ? q : r;
}

// ---------- números em LaTeX ----------

function agrupar(n) {
  const s = String(n);
  return s.length >= 5 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : s;
}

/** 2^i 5^j -> max(i, j) casas decimais; -1 se o decimal não é finito. */
function casasFinitas(q) {
  let i = 0;
  let j = 0;
  while (q % 2 === 0) { q /= 2; i++; }
  while (q % 5 === 0) { q /= 5; j++; }
  return q === 1 ? Math.max(i, j) : -1;
}

/** sqrt(n) = k·sqrt(m) com m sem quadrados. */
function raizSimples(n) {
  let k = 1;
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) { m /= d * d; k *= d; }
  }
  return [k, m];
}

function cientifica(v) {
  let e = Math.floor(Math.log10(v));
  let m = Number((v / Math.pow(10, e)).toFixed(2));
  if (m >= 10) { m /= 10; e++; }
  return { tex: `${virgula(String(m))}\\times10^{${e}}`, exato: perto(m * Math.pow(10, e), v, 1e-12) };
}

/**
 * v > 0 ou < 0 em LaTeX: { tex, exato }. Reconhece inteiros, frações, decimais finitos,
 * raízes, e^k e π; o resto vai em decimal aproximado (exato: false).
 * Opções: dec (preferir 0{,}25 a \frac{1}{4}), soDecimal (só decimais), semE (não reconhecer e^k),
 * max (a partir daqui passa a notação científica).
 */
export function texNumero(v, o = {}) {
  if (v === 0) return { tex: '0', exato: true };
  if (v < 0) {
    const r = texNumero(-v, o);
    return { tex: `-${r.tex}`, exato: r.exato };
  }
  const max = o.max || 1e15;
  if (v >= max || v < 1e-12) return cientifica(v);
  const n = Math.round(v);
  if (n >= 1 && perto(v, n, 1e-12)) return { tex: agrupar(n), exato: true };
  const fr = racionalDe(v, 4096, 1e-12);
  if (fr) {
    const [p, q] = fr;
    const k = casasFinitas(q);
    if (k >= 0 && k <= 4 && (o.dec || o.soDecimal)) return { tex: virgula((p / q).toFixed(k)), exato: true };
    if (!o.soDecimal) return { tex: `\\frac{${agrupar(p)}}{${agrupar(q)}}`, exato: true };
  }
  if (!o.soDecimal) {
    for (const idx of [2, 3, 4]) {
      const w = Math.pow(v, idx);
      const m = Math.round(w);
      if (m >= 2 && w < 1e6 && perto(w, m, 1e-10)) {
        if (idx === 2) {
          const [k, mm] = raizSimples(m);
          return { tex: k === 1 ? `\\sqrt{${mm}}` : `${k}\\sqrt{${mm}}`, exato: true };
        }
        return { tex: `\\sqrt[${idx}]{${m}}`, exato: true };
      }
    }
    const f2 = racionalDe(v * v, 100, 1e-10);
    if (f2 && f2[1] > 1) {
      const [k, mm] = raizSimples(f2[0] * f2[1]);
      const g = M.mdc(k, f2[1]);
      const kk = k / g;
      const qq = f2[1] / g;
      return { tex: `\\frac{${kk === 1 ? '' : kk}\\sqrt{${mm}}}{${qq}}`, exato: true };
    }
    if (!o.semE) {
      const l = Math.log(v);
      const k = Math.round(l);
      if (k !== 0 && Math.abs(k) <= 20 && perto(l, k, 1e-12)) {
        return { tex: k === 1 ? 'e' : `e^{${k}}`, exato: true };
      }
    }
    if (perto(v, Math.PI, 1e-12)) return { tex: '\\pi', exato: true };
  }
  if (v >= 1e-3 && v < 1e6) return { tex: virgula(v.toFixed(3)), exato: false };
  return cientifica(v);
}

const decTex3 = (x) => M.fmt(x, 3).replace('−', '-').replace(',', '{,}');
const xTexto = (x) => (Number.isInteger(x) ? String(x).replace('-', '−') : M.fmt(x, 1));
const xTex = (x) => xTexto(x).replace('−', '-').replace(',', '{,}');

/** LaTeX -> texto para leitores de ecrã: \frac{1}{8} -> «1 sobre 8». */
export function tex2fala(t) {
  return String(t)
    .replace(/\\left|\\right/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 sobre $2')
    .replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, 'raiz de índice $1 de $2')
    .replace(/\\sqrt\{([^{}]*)\}/g, 'raiz de $1')
    .replace(/\^\{([^{}]*)\}/g, ' elevado a $1')
    .replace(/\\times/g, ' vezes ')
    .replace(/\\pi/g, 'pi')
    .replace(/\\ln/g, 'logaritmo neperiano de ')
    .replace(/\\log/g, 'logaritmo')
    .replace(/\\approx/g, ' aproximadamente ')
    .replace(/\\,/g, '')
    .replace(/\{,\}/g, ',')
    .replace(/-/g, 'menos ')
    .replace(/[{}\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// pequenas peças de LaTeX
const simples = (t) => /^(\d[\d\\,]*|[a-z]|\\pi)$/.test(t);
const par = (t) => (simples(t) ? t : `\\left(${t}\\right)`);
const pot = (b, e) => `${par(b)}^{${e}}`;
const fr = (p, q = 1) => M.fracTex(p, q);

/** r·x em LaTeX: x, -x, 2x, \frac{x}{2}, -\frac{3x}{2}. */
function coefX([p, q]) {
  const s = p < 0 ? '-' : '';
  const n = Math.abs(p);
  if (q === 1) return n === 1 ? `${s}x` : `${s}${n}x`;
  return `${s}\\frac{${n === 1 ? '' : n}x}{${q}}`;
}

/** \ln y, \log y ou \log_{a} y conforme a base. */
function logTex(an, arg) {
  if (an.tipoBase === 'e') return `\\ln ${arg}`;
  if (an.tipoBase === '10') return `\\log ${arg}`;
  return `\\log_{${an.baseTex}} ${arg}`;
}
const logArg = (an) => logTex(an, an.yTex.startsWith('-') ? `(${an.yTex})` : an.yTex);

// ---------- análise de um logaritmo ----------

/**
 * Tudo o que se sabe sobre log_a y. Estados:
 *   'ok'            a > 0, a != 1, y > 0: expoente, exato (+ fracao [p, q], caso) ou entre [n, n+1]
 *   'y-zero' 'y-negativo'            o logaritmo não existe
 *   'base-negativa' 'base-zero' 'base-um' 'base-extrema'   a base é recusada
 *   'sem-y'         y não é um número (só vem de calcular)
 * caso (quando exato): 'um' (y = 1), 'base' (y = a), 'potencia' (y = a^k, k inteiro), 'fracao' (expoente fracionário).
 * opc.aDec / opc.yDec: o aluno escreveu a base / o número em decimal (0,25), por isso mostra-se em decimal.
 */
export function analisar(a, y, opc = {}) {
  const an = { a, y, estado: 'ok', aDec: !!opc.aDec, yDec: !!opc.yDec };
  an.tipoBase = ehE(a) ? 'e' : a === 10 ? '10' : 'outra';
  an.baseTex = Number.isFinite(a) ? texNumero(a, { dec: an.aDec }).tex : '';
  an.yTex = Number.isFinite(y) ? texNumero(y, { dec: an.yDec }).tex : '';
  if (!(a > 0)) { an.estado = a === 0 ? 'base-zero' : 'base-negativa'; return an; }
  if (Math.abs(a - 1) < 1e-12) { an.estado = 'base-um'; return an; }
  if (a > LIM_BASE || a < 1 / LIM_BASE) { an.estado = 'base-extrema'; return an; }
  if (Number.isNaN(y)) { an.estado = 'sem-y'; return an; }
  if (!(y > 0)) { an.estado = y === 0 ? 'y-zero' : 'y-negativo'; return an; }

  an.expoente = logb(a, y);
  const f = racionalDe(an.expoente);
  an.exato = !!f && Math.abs(potencia(a, f[0] / f[1]) - y) <= TOL * y;
  an.aprox3 = decTex3(an.expoente);
  if (an.exato) {
    an.fracao = f;
    an.caso = f[0] === 0 ? 'um' : f[0] === 1 && f[1] === 1 ? 'base' : f[1] === 1 ? 'potencia' : 'fracao';
  } else {
    const n = Math.floor(an.expoente);
    an.entre = [n, n + 1];
  }
  return an;
}

/** Lê a base e o número (como o aluno os escreveu) e analisa. Os erros de leitura dão 'erro-base' / 'erro-y'. */
export function calcular(baseTxt, yTxt) {
  const b = lerNumero(baseTxt);
  if (!b.ok) return { estado: 'erro-base', vazio: !!b.vazio, texto: String(baseTxt).trim() };
  const y = lerNumero(yTxt);
  const an = analisar(b.valor, y.ok ? y.valor : NaN, { aDec: b.dec, yDec: y.ok && y.dec });
  if (an.estado.startsWith('base-')) return an;
  if (!y.ok) return { estado: 'erro-y', vazio: !!y.vazio, texto: String(yTxt).trim() };
  return an;
}

/** Expoentes inteiros que a escada mostra: -3 a 4, alargados para o resultado caber. */
export function janela(an) {
  let lo = JANELA[0];
  let hi = JANELA[1];
  if (an && an.estado === 'ok') {
    lo = Math.min(lo, Math.floor(an.expoente));
    hi = Math.max(hi, Math.ceil(an.expoente));
  }
  return [Math.max(-LIM_JANELA, lo), Math.min(LIM_JANELA, hi)];
}

/** Valor de a^k para a escada: { tex, exato }. */
export function valorDegrau(an, k) {
  return texNumero(potencia(an.a, k), { dec: an.aDec || an.tipoBase === '10', semE: true, max: 1e6 });
}

/**
 * O marcador no expoente x: 'achou' (a^x = y), 'pequeno' ou 'grande' (a^x < y ou > y),
 * com `sobe` (para chegar a y é preciso subir o expoente?) e `perto` (a menos de 3 %);
 * 'nunca' quando y <= 0 (uma potência de base positiva é sempre positiva).
 */
export function comparar(a, y, x) {
  const p = potencia(a, x);
  if (!(y > 0)) return { estado: 'nunca', p };
  if (Math.abs(p - y) <= TOL * y) return { estado: 'achou', p };
  const pequeno = p < y;
  return { estado: pequeno ? 'pequeno' : 'grande', p, sobe: a > 1 === pequeno, perto: Math.abs(p - y) <= 0.03 * y };
}

// ---------- textos de aluno ($...$ = KaTeX) ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\$/g, '&#36;');

/** Mensagem para os estados em que não há nada a calcular (base recusada, escrita ilegível). */
export function mensagemErro(an) {
  switch (an.estado) {
    case 'erro-base':
      return an.vazio
        ? 'Escreve a base: um número positivo diferente de 1.'
        : `Não consegui ler a base «${esc(an.texto)}». Escreve um número, como 2, 0,5, 1/4 ou √3.`;
    case 'erro-y':
      return an.vazio
        ? 'Escreve o número de que queres o logaritmo.'
        : `Não consegui ler o número «${esc(an.texto)}». Escreve, por exemplo, 8, 1/8, 0,01, √2 ou e.`;
    case 'base-negativa':
      return 'A base tem de ser positiva. Com base negativa, potências como $(-2)^{\\frac{1}{2}}$ nem existem.';
    case 'base-zero':
      return 'A base não pode ser $0$: $0^x$ não existe para $x\\le0$ e dá sempre $0$ para $x>0$, por isso nunca chegarias a outro número.';
    case 'base-um':
      return 'A base não pode ser $1$: $1^x$ dá sempre $1$, por isso nunca chegarias a outro número.';
    case 'base-extrema':
      return 'Essa base é demasiado grande ou demasiado pequena para a escada. Usa uma base entre 0,000001 e 1 000 000.';
    default:
      return '';
  }
}

/** A pergunta que o logaritmo faz, antes de o aluno a resolver. */
export function textoPergunta(an) {
  return `Procura o expoente: a que expoente tens de elevar $${an.baseTex}$ para obter $${an.yTex}$?`;
}

/** A frase completa com a resposta (tu + notação). */
export function textoResposta(an) {
  const log = logTex(an, an.yTex);
  if (an.exato) {
    const x = fr(an.fracao[0], an.fracao[1]);
    return `Para obter $${an.yTex}$ tens de elevar $${an.baseTex}$ a $${x}$, por isso $${log}=${x}$.`;
  }
  const [n, m] = an.entre;
  return `$${log}$ é o expoente a que tens de elevar $${an.baseTex}$ para obter $${an.yTex}$. `
    + `Não é um número inteiro nem uma fração simples: fica entre $${n}$ e $${m}$, e vale cerca de $${an.aprox3}$.`;
}

/** Quando y <= 0: porque é que o logaritmo não existe. */
export function textoNaoExiste(an) {
  return `$${logArg(an)}$ não existe: nenhuma potência de $${an.baseTex}$ dá $${an.yTex}$. `
    + 'Uma potência de base positiva é sempre maior que $0$, por isso só existe logaritmo de números positivos.';
}

/** Frases dos casos especiais (y = 1, y = a, y = a^k, expoente fracionário); [] se não for nenhum. */
export function textoCasos(an) {
  if (an.estado !== 'ok' || !an.exato) return [];
  const [p, q] = an.fracao;
  const x = fr(p, q);
  switch (an.caso) {
    case 'um':
      return ['Caso especial: $\\log_a 1=0$ para qualquer base, porque $a^0=1$.'];
    case 'base':
      return ['Caso especial: $\\log_a a=1$ para qualquer base, porque $a^1=a$.'];
    case 'potencia': {
      // quando o número já vem escrito como potência (e^3), não se diz «como e^3 = e^3»
      const potencia = pot(an.baseTex, x);
      const como = an.yTex === potencia ? 'O' : `Como $${an.yTex}=${potencia}$, o`;
      return [`${como} logaritmo é o próprio expoente: $${logTex(an, potencia)}=${x}$. Em geral, $\\log_a a^k=k$.`];
    }
    default:
      return [`Os expoentes também podem ser frações: $${an.yTex}=${pot(an.baseTex, x)}$, por isso $${logTex(an, an.yTex)}=${x}$.`];
  }
}

/** A frase sobre a notação quando a base é e ou 10 ('' nas outras bases). */
export function textoNotacaoBase(an) {
  if (an.tipoBase === 'e') return 'Com base $e$ o logaritmo escreve-se $\\ln$ e chama-se logaritmo neperiano: $\\ln y=\\log_e y$.';
  if (an.tipoBase === '10') return 'Com base $10$ o logaritmo escreve-se $\\log$, sem a base, e chama-se logaritmo decimal: $\\log y=\\log_{10} y$.';
  return '';
}

/** Peças da linha «log ⇔ potência» a colorir: base, expoente e argumento. */
export function partesNotacao(an, resolvido) {
  const dado = resolvido && an.estado === 'ok';
  const aprox = dado && !an.exato;
  return {
    fn: an.tipoBase === 'e' ? '\\ln' : '\\log',
    base: an.tipoBase === 'outra' ? an.baseTex : null,
    baseExp: an.baseTex,
    arg: an.yTex.startsWith('-') ? `\\left(${an.yTex}\\right)` : an.yTex,
    argExp: an.yTex,
    exp: dado ? (an.exato ? fr(an.fracao[0], an.fracao[1]) : an.aprox3) : '?',
    aprox,
    impossivel: an.estado === 'y-zero' || an.estado === 'y-negativo',
  };
}

// ---------- os dois processos, passo a passo ----------

/**
 * Procura uma base c (inteiro de 2 a 20, ou e) tal que a = c^r e y = c^s com r e s racionais
 * simples: é a «mesma base» das resoluções (9 = 3², 27 = 3³). Sem ela, usa a própria base.
 */
function baseComum(an, direto) {
  const [p, q] = an.fracao;
  const propria = { c: an.a, cTex: an.baseTex, r: [1, 1], s: [p, q], proprio: true };
  if (direto) return propria;
  let melhor = null;
  const candidatos = [];
  for (let n = 2; n <= 20; n++) candidatos.push(n);
  candidatos.push(Math.E);
  for (const c of candidatos) {
    const lc = Math.log(c);
    const r = racionalDe(Math.log(an.a) / lc, 6);
    const s = racionalDe(Math.log(an.y) / lc, 6);
    if (!r || !s || r[0] === 0) continue;
    if (!perto(potencia(c, r[0] / r[1]), an.a, 1e-9) || !perto(potencia(c, s[0] / s[1]), an.y, 1e-9)) continue;
    const custo = r[1] * s[1] * 1000 + Math.abs(r[0]) + Math.abs(s[0]) + c / 100;
    if (!melhor || custo < melhor.custo) {
      melhor = { c, cTex: c === Math.E ? 'e' : String(c), r, s, custo };
    }
  }
  return melhor || propria;
}

/** Peças do caminho de y até c^s: 1/8, 1/2^3, 2^{-3}. */
function cadeia(yT, cb) {
  const [sp, sq] = cb.s;
  const alvo = pot(cb.cTex, fr(sp, sq));
  const partes = [yT];
  if (sq === 1 && sp < 0 && Number.isInteger(cb.c)) {
    const unidade = `\\frac{1}{${agrupar(Math.round(Math.pow(cb.c, -sp)))}}`;
    if (yT !== unidade) partes.push(unidade);
    partes.push(`\\frac{1}{${pot(cb.cTex, String(-sp))}}`);
  }
  if (partes[partes.length - 1] !== alvo) partes.push(alvo);
  return partes;
}

function passosExatos(an) {
  const [p, q] = an.fracao;
  const xT = fr(p, q);
  const yT = an.yTex;
  const aT = an.baseTex;
  const cb = baseComum(an, p === 0 || (p === 1 && q === 1));
  const [rp, rq] = cb.r;
  const [sp, sq] = cb.s;
  const rT = fr(rp, rq);
  const cT = cb.cTex;
  const direto = rp === 1 && rq === 1;
  const potC = pot(cT, fr(sp, sq));
  const potA = pot(aT, xT);
  const caminho = cadeia(yT, cb);
  const logY = logTex(an, yT);
  const logPot = logTex(an, potA);

  const m1 = [];
  if (direto) {
    m1.push({
      titulo: yT === potA ? 'O número já é uma potência da base' : 'Escreve o número como potência da base',
      linhas: [caminho.join('=')],
    });
  } else {
    m1.push({
      titulo: 'Escreve a base e o número como potências da mesma base',
      linhas: [`${aT}=${pot(cT, rT)}`, caminho.join('=')],
    });
    m1.push({
      titulo: 'Escreve o número como potência da base',
      linhas: [`${yT === potC ? '' : `${yT}=`}${potC}=${pot(pot(cT, rT), xT)}=${potA}`],
      texto: 'Usa $(c^m)^n=c^{mn}$: o expoente de $c$ passa a ser o produto dos dois.',
    });
  }
  m1.push({
    titulo: 'O logaritmo é o expoente',
    linhas: [yT === potA ? `${logY}=${xT}` : `${logY}=${logPot}=${xT}`],
    texto: 'O logaritmo de uma potência da base é o próprio expoente.',
  });

  const m2 = [{
    titulo: 'Passa à forma exponencial',
    linhas: [`${logY}=x\\Leftrightarrow ${pot(aT, 'x')}=${yT}`],
  }];
  if (direto) {
    m2.push({
      titulo: 'Escreve os dois lados na mesma base',
      linhas: caminho.length > 1 ? [caminho.join('='), `${pot(aT, 'x')}=${potC}`] : [`${pot(aT, 'x')}=${potC}`],
    });
    m2.push({
      titulo: 'Iguala os expoentes',
      linhas: [`x=${xT}`],
      texto: 'Duas potências da mesma base só são iguais se os expoentes forem iguais.',
    });
  } else {
    m2.push({
      titulo: 'Escreve os dois lados na mesma base',
      linhas: [`${aT}=${pot(cT, rT)}`, caminho.join('='), `${pot(pot(cT, rT), 'x')}=${potC}`],
    });
    m2.push({
      titulo: 'Potência de potência: multiplica os expoentes',
      linhas: [`${pot(cT, coefX(cb.r))}=${potC}`],
    });
    m2.push({
      titulo: 'Iguala os expoentes e resolve',
      linhas: [`${coefX(cb.r)}=${fr(sp, sq)}\\Leftrightarrow x=${xT}`],
      texto: 'Duas potências da mesma base só são iguais se os expoentes forem iguais.',
    });
  }
  return {
    tipo: 'exato',
    modos: [
      { titulo: '1.º modo: escreve $y$ como potência de $a$', itens: m1 },
      { titulo: '2.º modo: resolve a equação $a^x=y$', itens: m2 },
    ],
  };
}

function passosInexatos(an) {
  const [n, m] = an.entre;
  const aT = an.baseTex;
  const yT = an.yTex;
  const vn = valorDegrau(an, n);
  const vm = valorDegrau(an, m);
  const cresc = an.a > 1;
  const ig = (v) => (v.exato ? '=' : '\\approx ');
  const logY = logTex(an, yT);
  const itens = [
    {
      titulo: `Calcula duas potências inteiras de $${aT}$ à volta de $${yT}$`,
      linhas: [`${pot(aT, n)}${ig(vn)}${vn.tex}\\qquad ${pot(aT, m)}${ig(vm)}${vm.tex}`],
    },
    {
      titulo: `Vê onde fica $${yT}$ entre elas`,
      linhas: [`${pot(aT, n)}${ig(vn)}${vn.tex}${cresc ? '<' : '>'}${yT}${cresc ? '<' : '>'}${vm.tex}${ig(vm)}${pot(aT, m)}`],
    },
    {
      titulo: 'Conclui entre que inteiros fica o expoente',
      linhas: [`${n}<${logY}<${m}`],
      texto: `Como $x\\mapsto ${pot(aT, 'x')}$ é ${cresc ? 'crescente (a base é maior que $1$)' : 'decrescente (a base está entre $0$ e $1$)'}, um valor entre estas duas potências só pode vir de um expoente entre $${n}$ e $${m}$.`,
    },
    {
      titulo: 'Valor aproximado',
      linhas: [`${logY}\\approx ${an.aprox3}`],
      texto: `Para o valor exato escreve $${logY}$${an.tipoBase === 'e' ? '' : ` ou $\\dfrac{\\ln ${yT}}{\\ln ${aT}}$`}.`,
    },
  ];
  return { tipo: 'inexato', modos: [{ titulo: 'Entre que dois inteiros fica o expoente?', itens }] };
}

function passosInexistente(an) {
  const aT = an.baseTex;
  const yT = an.yTex;
  const v = (k) => {
    const r = texNumero(potencia(an.a, k), { dec: an.aDec || an.tipoBase === '10', semE: true });
    return `${pot(aT, String(k))}${r.exato ? '=' : '\\approx '}${r.tex}`;
  };
  const longe = an.a > 1 ? -10 : 10;
  const rl = texNumero(potencia(an.a, longe), { semE: true });
  const zero = an.estado === 'y-zero';
  return {
    tipo: 'inexistente',
    modos: [{
      titulo: `Porque é que $${logArg(an)}$ não existe`,
      itens: [
        {
          titulo: 'Passa à forma exponencial',
          linhas: [`${logArg(an)}=x\\Leftrightarrow ${pot(aT, 'x')}=${yT}`],
        },
        {
          titulo: 'Experimenta alguns expoentes',
          linhas: [`${v(-3)}\\qquad ${v(0)}\\qquad ${v(3)}`],
          texto: 'Com expoente negativo a potência é uma fração, mas continua positiva.',
        },
        {
          titulo: 'Uma potência de base positiva é sempre positiva',
          linhas: [`${pot(aT, 'x')}>0\\text{ para todo o }x`],
          texto: zero
            ? `Também nunca dá $0$: ${an.a > 1 ? 'baixando' : 'subindo'} o expoente aproximas-te de $0$ (por exemplo, $${pot(aT, String(longe))}${rl.exato ? '=' : '\\approx '}${rl.tex}$), mas nunca lá chegas. Por isso $${pot(aT, 'x')}=0$ não tem solução e $${logArg(an)}$ não existe.`
            : `Nunca dá um número negativo, por isso $${pot(aT, 'x')}=${yT}$ não tem solução e $${logArg(an)}$ não existe.`,
        },
      ],
    }],
  };
}

/** Os passos de cálculo: { tipo, modos: [{ titulo, itens: [{ titulo, linhas: [LaTeX], texto? }] }] }; null se não há o que mostrar. */
export function passos(an) {
  if (!an) return null;
  if (an.estado === 'ok') return an.exato ? passosExatos(an) : passosInexatos(an);
  if (an.estado === 'y-zero' || an.estado === 'y-negativo') return passosInexistente(an);
  return null;
}

// ---------- DOM ----------

let contador = 0;

const memoTex = new Map();
function texC(s) {
  let r = memoTex.get(s);
  if (r === undefined) {
    r = tex(s);
    memoTex.set(s, r);
  }
  return r;
}

/** Converte os $...$ de um texto de aluno em KaTeX. */
// a pontuação e o parêntese que abre ficam colados à fórmula (não passam sozinhos para outra linha)
const rico = (s) => String(s).replace(/(\()?\$([^$]+)\$([.,;:!?)]*)/g, (_, ab, t, fim) => (t.length <= 40 && (ab || fim)
  ? `<span class="lg-junto">${ab || ''}${texC(t)}${fim}</span>` : `${ab || ''}${texC(t)}${fim}`));

function h(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  n.append(...filhos.filter((f) => f !== null && f !== undefined && f !== false));
  return n;
}

/** Elemento cujo conteúdo é HTML (já com KaTeX). */
function hh(tag, props, html) {
  const n = h(tag, props);
  n.innerHTML = html;
  return n;
}

function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}

const PAPEIS = {
  base: 'A base fica base.',
  exp: 'O resultado do logaritmo passa a expoente.',
  arg: 'O argumento passa a resultado da potência.',
};

/** Um papel (base, expoente ou argumento) com a sua cor E a sua forma: sublinhado, caixa, cápsula. */
function papel(tipo, texto) {
  return hh('span', { class: `lg-pap lg-pap--${tipo}`, 'data-papel': tipo }, texC(texto));
}

/**
 * As duas formas lado a lado: log_a y = x  ⇔  a^x = y, com os três papéis coloridos.
 * d: { fn, base (null em ln e log), baseExp, arg, argExp, exp, aprox, impossivel }
 * `nomes`: põe por cima de cada forma o seu nome.
 */
function formas(d, nomes = false) {
  const sinal = d.aprox ? '\\approx' : '=';
  const fala = (t) => (tex2fala(t) === '?' ? 'um ponto de interrogação' : tex2fala(t));
  const igual = d.aprox ? 'é aproximadamente' : 'é igual a';
  const quem = d.base
    ? `logaritmo de ${fala(d.arg)} na base ${fala(d.base)}`
    : `${d.fn === '\\ln' ? 'logaritmo neperiano' : 'logaritmo decimal'} de ${fala(d.arg)}`;
  const log = h('span', { class: 'lg-forma lg-forma--log', role: 'img', 'aria-label': `Forma logarítmica: ${quem} ${igual} ${fala(d.exp)}` });
  log.append(
    hh('span', { class: 'lg-fn' }, texC(d.fn)),
    ...(d.base ? [h('sub', { class: 'lg-sub' }, papel('base', d.base))] : []),
    papel('arg', d.arg),
    hh('span', { class: 'lg-igual' }, texC(sinal)),
    papel('exp', d.exp)
  );
  const exp = h('span', { class: 'lg-forma lg-forma--exp', role: 'img', 'aria-label': `Forma exponencial: ${fala(d.baseExp)} elevado a ${fala(d.exp)} ${igual} ${fala(d.argExp)}` });
  exp.append(
    papel('base', par(d.baseExp)),
    h('sup', { class: 'lg-sup' }, papel('exp', d.exp)),
    hh('span', { class: 'lg-igual' }, texC(sinal)),
    papel('arg', d.argExp)
  );
  const caixa = (forma, nome) => h('div', { class: 'lg-caixa' }, nomes ? h('span', { class: 'lg-nome' }, nome) : null, forma);
  return h('div', { class: 'lg-formas' },
    caixa(log, 'Forma logarítmica'),
    // o ⇔ e a forma exponencial quebram juntos, para o ⇔ nunca ficar sozinho no fim da linha
    h('div', { class: 'lg-lado2' },
      hh('span', { class: 'lg-equiv', 'aria-hidden': 'true' }, texC('\\Leftrightarrow')),
      caixa(exp, 'Forma exponencial')),
    d.impossivel ? h('span', { class: 'lg-impossivel' }, 'impossível') : null);
}

export async function montar(el, dados) {
  const id = `lg${++contador}`;
  const est = {
    baseTxt: '2',
    yTxt: '8',
    xd: 0, // expoente em décimas, para não acumular erros de vírgula flutuante
    an: null, // análise do que está escrito
    ref: null, // última análise com base válida: é a que a escada mostra
    resolvido: false, // a resposta já aparece (encontrada na escada ou pedida)
    aberto: false, // o cálculo passo a passo está aberto
    chave: '',
    chaveEscada: '',
  };

  // ---------- 1. o tradutor ----------
  const legenda = h('ul', { class: 'lg-legenda' },
    ...[['base', 'a'], ['exp', 'x'], ['arg', 'y']].map(([p, letra]) =>
      h('li', { class: 'lg-legenda__item' }, papel(p, letra), h('span', {}, PAPEIS[p]))));
  const tradutor = h('section', { class: 'lg-bloco', 'aria-labelledby': `${id}-t1` },
    h('h4', { class: 'lg-titulo', id: `${id}-t1` }, 'A mesma frase, escrita de duas maneiras'),
    hh('p', { class: 'lg-intro' }, rico('Estas duas igualdades dizem o mesmo: $\\log_a y$ é o expoente a que se eleva $a$ para dar $y$.')),
    formas({ fn: '\\log', base: 'a', baseExp: 'a', arg: 'y', argExp: 'y', exp: 'x' }, true),
    legenda,
    h('p', { class: 'nota lg-forma-nota' }, 'Cada papel tem uma cor e uma forma: a base é sublinhada, o expoente está dentro de uma caixa e o argumento dentro de uma cápsula tracejada.'));

  // ---------- 2. escolha da base e do número ----------
  const campoBase = h('input', {
    id: `${id}-base`, class: 'campo lg-campo', type: 'text', value: est.baseTxt, autocomplete: 'off',
    autocapitalize: 'off', spellcheck: 'false', placeholder: 'outra base',
  });
  const campoY = h('input', {
    id: `${id}-y`, class: 'campo lg-campo', type: 'text', value: est.yTxt, autocomplete: 'off',
    autocapitalize: 'off', spellcheck: 'false', placeholder: 'outro número',
  });
  const chipsBase = BASES.map((t) => h('button', { type: 'button', class: 'chip lg-chip', 'data-base': t, 'aria-pressed': 'false' }, t));
  const chipsY = NUMEROS.map((t) => h('button', { type: 'button', class: 'chip lg-chip', 'data-y': t, 'aria-pressed': 'false' }, t));

  const grupo = (rotuloHtml, idRot, campo, chips, atr) => h('div', { class: 'lg-grupo' },
    hh('label', { class: 'lg-grupo__rotulo', id: idRot, for: campo.id }, rotuloHtml),
    h('div', { class: 'lg-linha-chips' },
      h('div', { class: 'chips lg-chips', role: 'group', 'aria-labelledby': idRot, ...atr }, ...chips),
      campo));
  const grupoBase = grupo(`Base ${texC('a')}`, `${id}-rb`, campoBase, chipsBase, {});
  const grupoY = grupo(`Número ${texC('y')}, o argumento do logaritmo`, `${id}-ry`, campoY, chipsY, {});

  // ---------- resultado (a única região em direto) ----------
  const resultado = h('div', { class: 'lg-resultado', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

  // ---------- a escada ----------
  const trilho = h('div', { class: 'lg-trilho' });
  const escada = h('div', { class: 'lg-escada tabela-rolante', tabindex: '0', role: 'group' }, trilho);
  let degraus = []; // { k, li }
  let lo = JANELA[0];
  let hi = JANELA[1];
  let rotuloMarca = null;
  const notaArred = h('p', { class: 'nota lg-arred', hidden: true }, 'Os valores com ≈ estão arredondados.');

  // ---------- o expoente ----------
  const slider = h('input', { type: 'range', id: `${id}-x`, class: 'lg-slider', min: lo, max: hi, step: 0.1, value: 0 });
  const saida = h('output', { for: `${id}-x`, class: 'lg-saida' });
  const botaoX = (d, rotulo, fala) => {
    const b = h('button', { type: 'button', class: 'botao botao--suave lg-passo', 'data-d': d, 'aria-label': fala }, rotulo);
    b.addEventListener('click', () => mover(d));
    return b;
  };
  const botoesX = [
    botaoX(-PASSO_GROSSO, '−0,5', 'Diminuir o expoente em 0,5'),
    botaoX(-PASSO_FINO, '−0,1', 'Diminuir o expoente em 0,1'),
    botaoX(PASSO_FINO, '+0,1', 'Aumentar o expoente em 0,1'),
    botaoX(PASSO_GROSSO, '+0,5', 'Aumentar o expoente em 0,5'),
  ];
  const controloX = h('div', { class: 'controlo lg-controlo' },
    h('div', { class: 'lg-controlo__linha' }, hh('label', { for: `${id}-x` }, `Expoente ${texC('x')}`), saida),
    slider,
    h('div', { class: 'lg-passos-x', role: 'group', 'aria-label': 'Mudar o expoente aos saltos' }, ...botoesX));
  const leituraX = h('p', { class: 'lg-leitura' });

  // ---------- cálculo passo a passo ----------
  const botaoCalculo = h('button', {
    type: 'button', class: 'botao lg-calculo-botao', 'aria-expanded': 'false', 'aria-controls': `${id}-calculo`,
  }, 'Mostrar como se calcula');
  const painel = h('div', { class: 'lg-calculo', id: `${id}-calculo`, hidden: true });

  const procura = h('section', { class: 'lg-bloco', 'aria-labelledby': `${id}-t2` },
    h('h4', { class: 'lg-titulo', id: `${id}-t2` }, 'Procura o expoente'),
    h('p', { class: 'lg-intro' }, 'Escolhe a base e o número. Depois muda o expoente até a potência dar esse número.'),
    h('div', { class: 'lg-escolhas' }, grupoBase, grupoY),
    h('p', { class: 'nota lg-ajuda' }, 'Podes escrever frações (1/8), decimais (0,01), raízes (√2) e o número e.'),
    resultado,
    escada,
    h('p', { class: 'nota lg-legenda-escada' }, 'Em cima, o expoente; em baixo, o valor da potência. Toca num degrau para lá pôr o marcador.'),
    notaArred,
    controloX,
    leituraX,
    botaoCalculo,
    painel);

  el.replaceChildren(h('div', { class: 'widget lg' },
    h('p', { class: 'widget__titulo' }, 'Logaritmo e expoente'), tradutor, procura));

  // ---------- atualização ----------

  const x = () => est.xd / 10;
  const usavel = (an) => an.estado === 'ok' || an.estado === 'y-zero' || an.estado === 'y-negativo';

  function escadaDe(an) {
    const [a, b] = janela(an);
    lo = a;
    hi = b;
    slider.min = String(lo);
    slider.max = String(hi);
    est.xd = limitar(est.xd, lo * 10, hi * 10);
    const lis = [];
    let aprox = false;
    degraus = [];
    for (let k = lo; k <= hi; k++) {
      const v = valorDegrau(an, k);
      if (!v.exato) aprox = true;
      const li = h('li', { class: 'lg-degrau', 'data-k': k },
        hh('span', { class: 'lg-degrau__exp' }, `<span class="sr-only">Expoente </span>${xTexto(k)}`),
        hh('span', { class: 'lg-degrau__val' }, `<span class="sr-only">, valor </span>${texC(`${v.exato ? '' : '\\approx '}${v.tex}`)}`));
      li.addEventListener('click', () => definirX(k * 10));
      degraus.push({ k, li });
      lis.push(li);
    }
    rotuloMarca = h('span', { class: 'lg-marca__rotulo' });
    trilho.replaceChildren(
      h('span', { class: 'lg-marca', 'aria-hidden': 'true' }, rotuloMarca),
      h('ol', { class: 'lg-degraus' }, ...lis));
    trilho.style.setProperty('--lg-n', String(hi - lo + 1));
    // valores compridos (148,413; 1,2×10⁶) alargam os degraus, para não ficarem cortados
    trilho.style.removeProperty('--lg-w');
    const maior = Math.max(0, ...degraus.map((d) => d.li.querySelector('.lg-degrau__val').getBoundingClientRect().width));
    const celula = degraus[0].li.getBoundingClientRect().width;
    if (maior > 0 && celula > 0 && maior + 10 > celula) trilho.style.setProperty('--lg-w', `${Math.ceil(maior + 16)}px`);
    escada.setAttribute('aria-label', `Escada de potências de ${tex2fala(an.baseTex)}: expoentes de ${xTexto(lo)} a ${xTexto(hi)}.`);
    notaArred.hidden = !aprox;
  }

  /** Mantém o marcador à vista dentro da escada, sem mexer na página. */
  function mostrarMarca() {
    if (!degraus.length) return;
    const w = degraus[0].li.offsetWidth;
    if (!w) return;
    const pad = parseFloat(getComputedStyle(trilho).paddingLeft) || 0;
    const centro = pad + (x() - lo + 0.5) * w;
    const larg = escada.clientWidth;
    const margem = Math.min(larg / 2, 1.3 * w);
    if (centro - margem < escada.scrollLeft) escada.scrollLeft = Math.max(0, centro - margem);
    else if (centro + margem > escada.scrollLeft + larg) escada.scrollLeft = centro + margem - larg;
  }

  function definirX(xd) {
    est.xd = limitar(Math.round(xd), lo * 10, hi * 10);
    pintarMarcador();
    pintarResultado();
    pintarCalculo();
    mostrarMarca();
  }
  function mover(d) { definirX(est.xd + d); }

  function pintarMarcador() {
    const an = usavel(est.an) ? est.an : null;
    const xv = x();
    slider.value = String(xv);
    const txt = `x = ${xTexto(xv)}`;
    if (rotuloMarca) rotuloMarca.textContent = txt;
    trilho.style.setProperty('--lg-x', String(xv - lo + 0.5));
    for (const d of degraus) d.li.classList.toggle('lg-degrau--aqui', d.k === xv);
    saida.textContent = xTexto(xv);
    botoesX.forEach((b) => {
      const d = Number(b.dataset.d);
      b.disabled = est.xd + d < lo * 10 || est.xd + d > hi * 10;
    });
    if (!an) { leituraX.textContent = ''; leituraX._h = ''; return; }
    const c = comparar(an.a, an.y, xv);
    const rp = texNumero(c.p, { soDecimal: true, dec: true });
    const linha = `$${pot(an.baseTex, xTex(xv))}${rp.exato ? '=' : '\\approx '}${rp.tex}$`;
    let html;
    let classe = '';
    let fala = `${txt.replace('x = ', 'expoente ')}`;
    if (c.estado === 'achou') {
      html = `Encontraste: $${logTex(an, an.yTex)}=${xTex(xv)}$.`;
      classe = ' lg-leitura--achou';
      fala += ': encontraste';
    } else if (c.estado === 'nunca') {
      html = `${linha} é positivo. Uma potência de base positiva nunca chega a $${an.yTex}$.`;
      fala += ': a potência é sempre positiva';
    } else {
      const verbo = c.sobe ? 'Sobe' : 'Desce';
      html = `${c.perto ? 'Estás perto! ' : ''}${linha} é ${c.estado === 'pequeno' ? 'menor' : 'maior'} que $${an.yTex}$: `
        + `${c.estado === 'pequeno' ? 'ainda é pequeno demais' : 'já é grande demais'}. ${verbo} o expoente.`;
      fala += `: a potência é ${c.estado === 'pequeno' ? 'pequena' : 'grande'} demais`;
    }
    leituraX.className = `lg-leitura${classe}`;
    definirHtml(leituraX, rico(html));
    slider.setAttribute('aria-valuetext', fala);
  }

  /** A região em direto: só muda quando muda a pergunta ou a resposta, não a cada passo do slider. */
  function pintarResultado() {
    const an = est.an;
    const achou = est.ref && est.ref.estado === 'ok' && comparar(est.ref.a, est.ref.y, x()).estado === 'achou';
    if (achou && an.estado === 'ok' && !est.resolvido) est.resolvido = true;
    let chave;
    const pecas = [];
    let classe = 'lg-resultado';
    if (an.estado === 'ok') {
      chave = `ok|${an.baseTex}|${an.yTex}|${est.resolvido}`;
      if (est.resolvido) {
        classe += ' lg-resultado--ok';
        pecas.push(hh('p', { class: 'lg-frase' }, rico(textoResposta(an))));
        pecas.push(h('div', { class: 'lg-notacao' }, formas(partesNotacao(an, true))));
        for (const t of textoCasos(an)) pecas.push(hh('p', { class: 'lg-caso' }, rico(t)));
      } else {
        pecas.push(hh('p', { class: 'lg-frase' }, rico(textoPergunta(an))));
        pecas.push(h('div', { class: 'lg-notacao' }, formas(partesNotacao(an, false))));
      }
      const nb = textoNotacaoBase(an);
      if (nb) pecas.push(hh('p', { class: 'lg-caso' }, rico(nb)));
    } else if (an.estado === 'y-zero' || an.estado === 'y-negativo') {
      chave = `nao|${an.baseTex}|${an.yTex}`;
      classe += ' lg-resultado--nao';
      pecas.push(hh('p', { class: 'lg-frase' }, rico(textoNaoExiste(an))));
      pecas.push(h('div', { class: 'lg-notacao' }, formas(partesNotacao(an, false))));
      const nb = textoNotacaoBase(an);
      if (nb) pecas.push(hh('p', { class: 'lg-caso' }, rico(nb)));
    } else {
      chave = `erro|${an.estado}|${an.texto || ''}|${an.baseTex || ''}`;
      classe = 'lg-resultado lg-resultado--erro';
      pecas.push(hh('p', { class: 'lg-frase' }, rico(mensagemErro(an))));
    }
    if (resultado._chave !== chave) {
      resultado._chave = chave;
      resultado.className = classe;
      resultado.replaceChildren(...pecas);
    }
  }

  function pintarCalculo() {
    const an = est.an;
    const pode = usavel(an);
    botaoCalculo.disabled = !pode;
    botaoCalculo.setAttribute('aria-expanded', String(pode && est.aberto));
    botaoCalculo.textContent = pode && est.aberto ? 'Esconder o cálculo' : 'Mostrar como se calcula';
    painel.hidden = !(pode && est.aberto);
    if (painel.hidden) { painel._chave = ''; return; }
    const chave = `${an.baseTex}|${an.yTex}`;
    if (painel._chave === chave) return;
    painel._chave = chave;
    const p = passos(an);
    painel.className = `lg-calculo lg-calculo--${p.tipo}`;
    painel.replaceChildren(...p.modos.map((modo) => h('section', { class: `lg-modo lg-modo--${p.tipo}` },
      hh('h5', { class: 'lg-modo__titulo' }, rico(modo.titulo)),
      h('ol', { class: 'lg-passos-lista' }, ...modo.itens.map((it) => h('li', { class: 'lg-passo-item' },
        hh('span', { class: 'lg-passo-item__titulo' }, rico(it.titulo)),
        ...it.linhas.map((l) => hh('div', { class: 'lg-linha-tex' }, texC(l))),
        it.texto ? hh('p', { class: 'lg-passo-item__texto' }, rico(it.texto)) : null))))));
  }

  function pintarCampos() {
    const an = est.an;
    const erroBase = an.estado === 'erro-base' || an.estado.startsWith('base-');
    campoBase.setAttribute('aria-invalid', String(erroBase));
    campoY.setAttribute('aria-invalid', String(an.estado === 'erro-y'));
    chipsBase.forEach((b) => b.setAttribute('aria-pressed', String(est.baseTxt.trim() === b.dataset.base)));
    chipsY.forEach((b) => b.setAttribute('aria-pressed', String(est.yTxt.trim() === b.dataset.y)));
    procura.classList.toggle('lg--sem-escada', !usavel(an));
  }

  /** Relê a base e o número; se mudou a pergunta, esconde a resposta e o cálculo. */
  function atualizar() {
    const an = calcular(est.baseTxt, est.yTxt);
    est.an = an;
    const chave = usavel(an) ? `${an.a}|${an.y}` : `erro|${an.estado}`;
    if (chave !== est.chave) {
      est.chave = chave;
      est.resolvido = false;
      est.aberto = false;
    }
    if (usavel(an)) {
      est.ref = an;
      const ch = `${an.a}|${janela(an).join(',')}`;
      if (ch !== est.chaveEscada) {
        est.chaveEscada = ch;
        escadaDe(an);
      }
    }
    pintarCampos();
    pintarMarcador();
    pintarResultado();
    pintarCalculo();
    mostrarMarca();
  }

  // ---------- ligações ----------

  let espera = 0;
  const agendar = () => { clearTimeout(espera); espera = setTimeout(atualizar, 350); };
  const jaMesmo = () => { clearTimeout(espera); atualizar(); };

  for (const [campo, chave] of [[campoBase, 'baseTxt'], [campoY, 'yTxt']]) {
    campo.addEventListener('input', () => { est[chave] = campo.value; agendar(); });
    campo.addEventListener('change', () => { est[chave] = campo.value; jaMesmo(); });
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); est[chave] = campo.value; jaMesmo(); }
    });
  }
  chipsBase.forEach((b) => b.addEventListener('click', () => {
    est.baseTxt = b.dataset.base;
    campoBase.value = est.baseTxt;
    jaMesmo();
  }));
  chipsY.forEach((b) => b.addEventListener('click', () => {
    est.yTxt = b.dataset.y;
    campoY.value = est.yTxt;
    jaMesmo();
  }));
  slider.addEventListener('input', () => definirX(Math.round(Number(slider.value) * 10)));

  botaoCalculo.addEventListener('click', () => {
    est.aberto = !est.aberto;
    const an = est.an;
    if (est.aberto && an.estado === 'ok') {
      est.resolvido = true;
      // se a resposta está na escala de 0,1, o marcador vai para lá
      const xd = Math.round(an.expoente * 10);
      if (an.exato && Math.abs(an.expoente * 10 - xd) < 1e-9 && xd >= lo * 10 && xd <= hi * 10) est.xd = xd;
    }
    pintarMarcador();
    pintarResultado();
    pintarCalculo();
    mostrarMarca();
  });

  atualizar();
  // a escada só tem largura quando já está na página
  requestAnimationFrame(mostrarMarca);
}
