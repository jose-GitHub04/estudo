// propriedades: porque é que o logaritmo transforma produtos em somas, quocientes em
// diferenças e potências em produtos. Escolhes a base e a propriedade, mexes em x, y e p
// e vês, numa régua, que os comprimentos somam; a conferência numérica fecha com ✓ ou ✗.
// A aba «Cuidado» mostra os erros típicos (a soma, o quociente de logaritmos, o quadrado).
// Contrato: export async function montar(el, dados). Estado guardado: nenhum.
// Todo o cálculo (valores, comprimentos, janela da régua, textos das contas) está nas funções
// puras exportadas aqui e testadas em tests/propriedades.html; montar() só as liga ao DOM.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

// ======================================================================
// Dados: bases, valores dos sliders, abas
// ======================================================================

export const BASES = [
  { id: '2', valor: 2, rot: '2', nome: 'log₂', tex: '\\log_{2}' },
  { id: '10', valor: 10, rot: '10', nome: 'log', tex: '\\log ' },
  { id: 'e', valor: Math.E, rot: 'e', nome: 'ln', tex: '\\ln ' },
  { id: '3', valor: 3, rot: '3', nome: 'log₃', tex: '\\log_{3}' },
];
export const baseDe = (id) => BASES.find((b) => b.id === id) || BASES[0];

/** Valores de x e y no slider: redondos e, mais ou menos, igualmente espaçados em escala logarítmica de 0,1 a 100. */
export const VALORES = [
  0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8,
  1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 9,
  10, 12, 15, 16, 20, 25, 27, 30, 32, 40, 50, 60, 64, 81, 100,
];
export const ATALHOS = [0.5, 2, 4, 8, 10];
export const P_MIN = -3;
export const P_MAX = 5;
export const P_PASSO = 0.5;

/** Posição do slider mais próxima de um valor. */
export function indiceDe(v) {
  let melhor = 0;
  VALORES.forEach((c, i) => {
    if (Math.abs(Math.log(c / v)) < Math.abs(Math.log(VALORES[melhor] / v))) melhor = i;
  });
  return melhor;
}

export const ABAS = [
  { id: 'produto', rot: 'Produto' },
  { id: 'quociente', rot: 'Quociente' },
  { id: 'potencia', rot: 'Potência' },
  { id: 'inverso', rot: 'Inverso' },
  { id: 'mudanca', rot: 'Mudança de base' },
  { id: 'cuidado', rot: 'Cuidado' },
];

export const CASOS = [
  { id: 'soma', rot: 'log(x+y)', exemplo: { x: 1, y: 1 } },
  { id: 'razao', rot: 'log x ÷ log y', exemplo: { x: 8, y: 2 } },
  { id: 'quadrado', rot: '(log x)²', exemplo: { x: 8, y: 1 } },
];

/** Que controlos cada aba usa. */
export function controlosDe(prop, caso) {
  if (prop === 'produto' || prop === 'quociente') return ['x', 'y'];
  if (prop === 'potencia') return ['x', 'p'];
  if (prop === 'cuidado') return caso === 'quadrado' ? ['x'] : ['x', 'y'];
  return ['x'];
}

// ======================================================================
// Números e formatação
// ======================================================================

/** Logaritmo de x na base dada; os resultados inteiros saem inteiros (log₁₀ 1000 = 3, não 2,9999...). */
export function logB(base, x) {
  let r;
  if (base === 10) r = Math.log10(x);
  else if (base === 2) r = Math.log2(x);
  else r = Math.log(x) / Math.log(base);
  const k = Math.round(r);
  return Math.abs(r - k) < 1e-12 ? k : r;
}

/** O valor tem, no máximo, `casas` casas decimais (é o que se escreve sem «≈»)? */
export const ehExato = (v, casas = 4) => Math.abs(v - Math.round(v * 10 ** casas) / 10 ** casas) < 1e-9;

/** Número com vírgula, no máximo `casas` casas e sem zeros no fim: 5 · 0,903 · −1,5851. */
export function num(v, casas = 4) {
  if (!Number.isFinite(v)) return '?';
  let s = M.fmt(v, casas);
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return s;
}
/** O mesmo, pronto para LaTeX: 0{,}903 · -1{,}5851. */
export const numTex = (v, casas = 4) => num(v, casas).replace('−', '-').replace(',', '{,}');

const nx = (v) => num(v, 3); // x, y e rótulos na régua
const N = numTex;
const par = (v, c = 4) => (v < 0 ? `(${N(v, c)})` : N(v, c)); // negativos entre parênteses
const igual = (exato) => (exato ? '=' : '\\approx');
const eq = (v, c = 4) => (ehExato(v, c) ? '=' : '\\approx'); // «=» ou «≈» em LaTeX
const rel = (v, c = 3) => (ehExato(v, c) ? '=' : '≈'); // o mesmo, para texto simples
const lin1 = (lhs, r, fim) => `${lhs}${r}${fim}`;
const lin2 = (lhs, r1, meio, r2, fim) => `\\begin{aligned}${lhs}&${r1}${meio}\\\\&${r2}${fim}\\end{aligned}`;
/** Com valor intermédio, duas linhas alinhadas; sem ele, uma só. */
const ladoEsq = (lhs, meio, v) => (meio ? lin2(lhs, '=', meio, eq(v), N(v)) : lin1(lhs, eq(v), N(v)));

// ======================================================================
// Rótulos do desenho: texto simples com expoentes ^{...}
// ======================================================================

/** «log₂ (8^{3}) = 9» -> [{t:'log₂ (8'}, {sup:'3'}, {t:') = 9'}]. */
export function partirRotulo(rot) {
  const partes = [];
  const re = /\^\{([^}]*)\}/g;
  let i = 0;
  let m;
  while ((m = re.exec(rot))) {
    if (m.index > i) partes.push({ t: rot.slice(i, m.index) });
    partes.push({ sup: m[1] });
    i = re.lastIndex;
  }
  if (i < rot.length) partes.push({ t: rot.slice(i) });
  return partes;
}
/** Para leitores de ecrã: o expoente por extenso. */
export const semMarcas = (rot) => rot.replace(/\^\{([^}]*)\}/g, ' elevado a $1');
/** Largura aproximada do rótulo, em unidades do viewBox (letra de 13 px). */
export const larguraRotulo = (rot) =>
  partirRotulo(rot).reduce((s, p) => s + (p.sup !== undefined ? 0.7 * p.sup.length : p.t.length) * 7, 0);

// ======================================================================
// Janela da régua: escala que cabe, com marcas nos inteiros
// ======================================================================

export const SPANS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];

/**
 * Janela [lo, lo+span] que contém o 0 e todas as posições. `lo` é inteiro e `span` vem de uma
 * escada de valores, por isso a escala só muda aos saltos (e a régua tem sempre marcas nos inteiros).
 * `passo`: de quanto em quanto há marca com número; `menor`: marcas pequenas (0 = nenhuma).
 */
export function janela(posicoes) {
  const min = Math.min(0, ...posicoes);
  const max = Math.max(0, ...posicoes);
  const lo = Math.floor(min + 1e-9);
  const span = SPANS.find((s) => lo + s >= max - 1e-9) ?? SPANS[SPANS.length - 1];
  const passo = [1, 2, 5, 10].find((p) => span / p <= 12) ?? 10;
  const menor = span <= 3 ? 0.1 : span <= 8 ? 0.5 : 0;
  return { lo, span, hi: lo + span, passo, menor };
}

/** Valores das marcas grandes (com número) e pequenas, dentro da janela. */
export function marcas(jan) {
  const { lo, span, passo, menor } = jan;
  const maiores = [];
  const menores = [];
  for (let k = Math.ceil(lo / passo - 1e-9); k * passo <= lo + span + 1e-9; k++) maiores.push(k * passo);
  if (menor) {
    for (let k = Math.ceil(lo / menor - 1e-9); k * menor <= lo + span + 1e-9; k++) {
      const v = Math.round(k * menor * 1e6) / 1e6;
      if (Math.abs(v / passo - Math.round(v / passo)) > 1e-9) menores.push(v);
    }
  }
  return { maiores, menores };
}

// ======================================================================
// As propriedades: valores dos dois lados, comprimentos da régua, contas e textos
// ======================================================================
// Cada função devolve { esq, dir, formula, linhaEsq, linhaDir, termos, total, porque, ... }:
//   esq, dir     os dois lados da igualdade (números)
//   termos       a cadeia de cima da régua [{ v: comprimento com sinal, rot, tipo, pos }]
//   total        a barra de baixo { v, rot }
//   linhaEsq/Dir LaTeX das contas; porque: parágrafos com $...$

const termo = (v, rot, tipo, pos) => ({ v, rot, tipo, pos });

function produto(B, x, y) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const ly = logB(a, y);
  const xy = x * y;
  const lxy = logB(a, xy);
  const dir = lx + ly;
  const exato = ehExato(lx) && ehExato(ly);
  const dados = exato
    ? `$m=${N(lx)}$ e $n=${N(ly)}$, ou seja, $${N(x)}=${E}^{${N(lx)}}$ e $${N(y)}=${E}^{${N(ly)}}$`
    : `$m\\approx${N(lx)}$ e $n\\approx${N(ly)}$, ou seja, $${N(x)}=${E}^{m}$ e $${N(y)}=${E}^{n}$`;
  const potencias = exato
    ? `Aqui, $${N(x)}\\times${N(y)}=${E}^{${N(lx)}}\\times ${E}^{${N(ly)}}=${E}^{${N(lx)}+${par(ly)}}=${E}^{${N(dir)}}$.`
    : `Aqui, $${N(x)}\\times${N(y)}=${E}^{m}\\times ${E}^{n}=${E}^{m+n}$.`;
  return {
    esq: lxy,
    dir,
    formula: `${L}(xy)=${L}x+${L}y`,
    linhaEsq: ladoEsq(`${L}(${N(x)}\\times${N(y)})`, ehExato(xy, 6) && `${L}${N(xy, 6)}`, lxy),
    linhaDir: lin2(`${L}${N(x)}+${L}${N(y)}`, exato ? '=' : '\\approx', `${N(lx)}+${par(ly)}`, eq(dir), N(dir)),
    termos: [
      termo(lx, `${B.nome} ${nx(x)} ${rel(lx)} ${num(lx, 3)}`, 'x', 'cima'),
      termo(ly, `${B.nome} ${nx(y)} ${rel(ly)} ${num(ly, 3)}`, 'y', 'baixo'),
    ],
    total: { v: lxy, rot: `${B.nome} (${nx(x)}×${nx(y)}) ${rel(lxy)} ${num(lxy, 3)}`, tipo: 'r' },
    porque: [
      `Um logaritmo é um expoente. Põe $m=${L}${N(x)}$ e $n=${L}${N(y)}$. Com os teus números, ${dados}.`,
      `Multiplicar potências da mesma base soma os expoentes: $${E}^{m}\\times ${E}^{n}=${E}^{m+n}$. ${potencias}`,
      `Então o expoente de $${E}$ que dá $${N(x)}\\times${N(y)}$ é $m+n$. Logo $${L}(${N(x)}\\times${N(y)})=m+n${igual(exato)}${N(lx)}+${par(ly)}${eq(dir)}${N(dir)}$.`,
    ],
  };
}

function quociente(B, x, y) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const ly = logB(a, y);
  const q = x / y;
  const lq = logB(a, q);
  const dir = lx - ly;
  const exato = ehExato(lx) && ehExato(ly);
  const frac = `\\frac{${N(x)}}{${N(y)}}`;
  const dados = exato
    ? `$m=${N(lx)}$ e $n=${N(ly)}$, ou seja, $${N(x)}=${E}^{${N(lx)}}$ e $${N(y)}=${E}^{${N(ly)}}$`
    : `$m\\approx${N(lx)}$ e $n\\approx${N(ly)}$, ou seja, $${N(x)}=${E}^{m}$ e $${N(y)}=${E}^{n}$`;
  const potencias = exato
    ? `Aqui, $${frac}=\\frac{${E}^{${N(lx)}}}{${E}^{${N(ly)}}}=${E}^{${N(lx)}-${par(ly)}}=${E}^{${N(dir)}}$.`
    : `Aqui, $${frac}=\\frac{${E}^{m}}{${E}^{n}}=${E}^{m-n}$.`;
  return {
    esq: lq,
    dir,
    formula: `${L}\\frac{x}{y}=${L}x-${L}y`,
    linhaEsq: ladoEsq(`${L}${frac}`, ehExato(q, 6) && `${L}${N(q, 6)}`, lq),
    linhaDir: lin2(`${L}${N(x)}-${L}${N(y)}`, exato ? '=' : '\\approx', `${N(lx)}-${par(ly)}`, eq(dir), N(dir)),
    termos: [
      termo(lx, `${B.nome} ${nx(x)} ${rel(lx)} ${num(lx, 3)}`, 'x', 'cima'),
      termo(-ly, `−${B.nome} ${nx(y)} ${rel(ly)} ${num(-ly, 3)}`, 'y', 'baixo'),
    ],
    total: { v: lq, rot: `${B.nome} (${nx(x)}÷${nx(y)}) ${rel(lq)} ${num(lq, 3)}`, tipo: 'r' },
    porque: [
      `Um logaritmo é um expoente. Põe $m=${L}${N(x)}$ e $n=${L}${N(y)}$. Com os teus números, ${dados}.`,
      `Dividir potências da mesma base subtrai os expoentes: $\\frac{${E}^{m}}{${E}^{n}}=${E}^{m-n}$. ${potencias}`,
      `Então o expoente de $${E}$ que dá $${frac}$ é $m-n$. Logo $${L}${frac}=m-n${igual(exato)}${N(lx)}-${par(ly)}${eq(dir)}${N(dir)}$.`,
    ],
  };
}

function potencia(B, x, p) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const lp = p * lx;
  const xp = x ** p;
  const exato = ehExato(lx);
  const sinal = p < 0 ? -1 : 1;
  // p cópias do comprimento de log x (as negativas, viradas ao contrário) e, se p acaba em ,5, meia cópia
  const termos = [];
  for (let i = 0; i < Math.floor(Math.abs(p) + 1e-9); i++) termos.push(termo(sinal * lx, num(sinal * lx, 3), 'x', 'cima'));
  if (Math.abs(Math.abs(p) % 1 - 0.5) < 1e-9) termos.push(termo((sinal * lx) / 2, num((sinal * lx) / 2, 3), 'x', 'cima'));
  const meio = ehExato(xp, 6) && Math.abs(xp) >= 1e-6 && Math.abs(xp) <= 1e7 && `${L}${N(xp, 6)}`;
  const dados = exato
    ? `$m=${N(lx)}$, ou seja, $${N(x)}=${E}^{${N(lx)}}$`
    : `$m\\approx${N(lx)}$, ou seja, $${N(x)}=${E}^{m}$`;
  const potencias = exato
    ? `Aqui, $${N(x)}^{${N(p)}}=\\left(${E}^{${N(lx)}}\\right)^{${N(p)}}=${E}^{${par(p)}\\times${par(lx)}}=${E}^{${N(lp)}}$.`
    : `Aqui, $${N(x)}^{${N(p)}}=\\left(${E}^{m}\\right)^{${N(p)}}=${E}^{${N(p)}m}$.`;
  return {
    esq: logB(a, xp),
    dir: lp,
    formula: `${L}\\left(x^{p}\\right)=p\\,${L}x`,
    linhaEsq: ladoEsq(`${L}\\left(${N(x)}^{${N(p)}}\\right)`, meio, logB(a, xp)),
    linhaDir: lin2(`${par(p)}\\times${L}${N(x)}`, exato ? '=' : '\\approx', `${par(p)}\\times${par(lx)}`, eq(lp), N(lp)),
    termos,
    resumo: `${num(p)} × ${B.nome} ${nx(x)} ${rel(lp)} ${num(lp, 3)}`,
    total: { v: lp, rot: `${B.nome} (${nx(x)}^{${num(p)}}) ${rel(lp)} ${num(lp, 3)}`, tipo: 'r' },
    aviso: termos.length === 0 ? 'p = 0: nenhuma cópia, comprimento 0' : '',
    porque: [
      `Um logaritmo é um expoente. Põe $m=${L}${N(x)}$. Com os teus números, ${dados}.`,
      `Elevar uma potência a um expoente multiplica os expoentes: $\\left(${E}^{m}\\right)^{p}=${E}^{pm}$. ${potencias}`,
      `Então o expoente de $${E}$ que dá $${N(x)}^{${N(p)}}$ é $pm$. Logo $${L}\\left(${N(x)}^{${N(p)}}\\right)=pm${igual(exato)}${par(p)}\\times${par(lx)}${eq(lp)}${N(lp)}$. É por isso que na régua cabem exatamente $p$ cópias do comprimento de $\\log x$.`,
    ],
  };
}

function inverso(B, x) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const inv = 1 / x;
  const li = logB(a, inv);
  const exato = ehExato(lx);
  const dados = exato
    ? `$m=${N(lx)}$, ou seja, $${N(x)}=${E}^{${N(lx)}}$`
    : `$m\\approx${N(lx)}$, ou seja, $${N(x)}=${E}^{m}$`;
  const frac = `\\frac{1}{${N(x)}}`;
  const potencias = exato
    ? `Aqui, $${frac}=\\frac{1}{${E}^{${N(lx)}}}=${E}^{${N(-lx)}}$.`
    : `Aqui, $${frac}=\\frac{1}{${E}^{m}}=${E}^{-m}$.`;
  const dirLinha = lx < 0
    ? lin2(`-${L}${N(x)}`, '=', `-(${N(lx)})`, eq(-lx), N(-lx))
    : lin1(`-${L}${N(x)}`, eq(-lx), N(-lx));
  return {
    esq: li,
    dir: -lx,
    formula: `${L}\\frac{1}{x}=-${L}x`,
    linhaEsq: ladoEsq(`${L}${frac}`, ehExato(inv, 6) && `${L}${N(inv, 6)}`, li),
    linhaDir: dirLinha,
    termos: [termo(lx, `${B.nome} ${nx(x)} ${rel(lx)} ${num(lx, 3)}`, 'x', 'cima')],
    total: { v: li, rot: `${B.nome} (1÷${nx(x)}) ${rel(li)} ${num(li, 3)}`, tipo: 'r' },
    espelho: true,
    porque: [
      `Um logaritmo é um expoente. Põe $m=${L}${N(x)}$. Com os teus números, ${dados}.`,
      `Inverter uma potência troca o sinal do expoente: $\\frac{1}{${E}^{m}}=${E}^{-m}$. ${potencias}`,
      `Então o expoente de $${E}$ que dá $${frac}$ é $-m$. Logo $${L}${frac}=-m${igual(exato)}${par(-lx)}$. Na régua, é o mesmo comprimento virado para o lado contrário.`,
    ],
  };
}

function mudanca(B, C, x) {
  const L = B.tex;
  const Lb = C.tex;
  const la = logB(B.valor, x);
  const lb = logB(C.valor, x);
  const lba = logB(C.valor, B.valor);
  const dir = lb / lba;
  const exato = ehExato(la);
  const ex = ehExato(lb) && ehExato(lba);
  return {
    esq: la,
    dir,
    formula: `${L}x=\\frac{${Lb}x}{${Lb}${B.rot}}`,
    linhaEsq: lin1(`${L}${N(x)}`, eq(la), N(la)),
    linhaDir: lin2(`\\frac{${Lb}${N(x)}}{${Lb}${B.rot}}`, ex ? '=' : '\\approx', `\\frac{${N(lb)}}{${N(lba)}}`, eq(dir), N(dir)),
    ln: Math.log(x),
    la,
    lb,
    rotA: `${B.nome} ${nx(x)} ${rel(la)} ${num(la, 3)}`,
    rotB: `${C.nome} ${nx(x)} ${rel(lb)} ${num(lb, 3)}`,
    termos: [],
    total: { v: la, rot: '', tipo: 'r' },
    porque: [
      `Põe $t=${L}${N(x)}$, ou seja, $${N(x)}=${B.rot}^{t}$. Com os teus números, $t${exato ? '=' : '\\approx'}${N(la)}$.`,
      `Aplica $${Lb}$ aos dois lados e usa a propriedade da potência: $${Lb}${N(x)}=${Lb}\\left(${B.rot}^{t}\\right)=t\\,${Lb}${B.rot}$. Com os teus números, $${Lb}${N(x)}\\approx${N(lb)}$ e $${Lb}${B.rot}\\approx${N(lba)}$.`,
      `Divide por $${Lb}${B.rot}$: $t=\\frac{${Lb}${N(x)}}{${Lb}${B.rot}}${ex ? '=' : '\\approx'}\\frac{${N(lb)}}{${N(lba)}}${eq(dir)}${N(dir)}$. É o mesmo segmento, medido com outra unidade, por isso o número muda mas o segmento não.`,
    ].concat(
      // x igual à nova base: sai a regra log_a b = 1 / log_b a
      Math.abs(x - C.valor) < 1e-9
        ? [`Aqui $x=${N(x)}$ é a própria nova base, por isso $${Lb}${N(x)}=1$ e a fórmula dá $${L}${N(x)}=\\frac{1}{${Lb}${B.rot}}\\approx\\frac{1}{${N(lba)}}\\approx${N(la)}$. Em geral, $\\log_a b=\\frac{1}{\\log_b a}$.`]
        : []),
  };
}

// ---------- Cuidado: as falsas igualdades ----------

function cuidadoSoma(B, x, y) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const ly = logB(a, y);
  const s = x + y;
  const ls = logB(a, s);
  const dir = lx + ly;
  const exato = ehExato(lx) && ehExato(ly);
  const l2 = logB(a, 2);
  const coincide = Math.abs(ls - dir) < 1e-9;
  return {
    esq: ls,
    dir,
    formula: `${L}(x+y)\\neq${L}x+${L}y`,
    linhaEsq: ladoEsq(`${L}(${N(x)}+${N(y)})`, ehExato(s, 6) && `${L}${N(s, 6)}`, ls),
    linhaDir: lin2(`${L}${N(x)}+${L}${N(y)}`, exato ? '=' : '\\approx', `${N(lx)}+${par(ly)}`, eq(dir), N(dir)),
    termos: [
      termo(lx, `${B.nome} ${nx(x)} ${rel(lx)} ${num(lx, 3)}`, 'x', 'cima'),
      termo(ly, `${B.nome} ${nx(y)} ${rel(ly)} ${num(ly, 3)}`, 'y', 'baixo'),
    ],
    total: { v: ls, rot: `${B.nome} (${nx(x)}+${nx(y)}) ${rel(ls)} ${num(ls, 3)}`, tipo: 'r' },
    porque: [
      `A soma de dois logaritmos é o logaritmo do <strong>produto</strong>: $${L}${N(x)}+${L}${N(y)}=${L}(${N(x)}\\times${N(y)})=${L}${N(x * y, 6)}$. Os números multiplicam-se; os expoentes é que se somam.`,
      coincide
        ? `Aqui calha ser $${N(x)}+${N(y)}=${N(x)}\\times${N(y)}=${N(x * y, 6)}$ (como $2+2=2\\times2$), por isso as duas contas dão o mesmo. É uma coincidência: experimenta outros valores.`
        : `Para a soma dos logaritmos dar $${L}(${N(x)}+${N(y)})$ seria preciso $${N(x)}+${N(y)}=${N(x)}\\times${N(y)}$. Mas $${N(x)}+${N(y)}=${N(s, 6)}$ e $${N(x)}\\times${N(y)}=${N(x * y, 6)}$.`,
      `Exemplo que se vê logo: com $x=y=1$, $${L}(1+1)=${L}2${eq(l2)}${N(l2)}$, mas $${L}1+${L}1=0+0=0$. Em qualquer base, $${L}2\\neq0$ (só $${L}1=0$).`,
    ],
    aviso: '',
  };
}

function cuidadoRazao(B, x, y) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const ly = logB(a, y);
  const q = x / y;
  const lq = logB(a, q);
  const semDir = Math.abs(ly) < 1e-12;
  const dir = semDir ? NaN : lx / ly;
  const frac = `\\frac{${N(x)}}{${N(y)}}`;
  const coincide = !semDir && Math.abs(lq - dir) < 1e-9;
  const exato = ehExato(lx) && ehExato(ly);
  const dados = exato
    ? `$${L}${N(x)}=${N(lx)}$ e $${L}${N(y)}=${N(ly)}$ (porque $${N(x)}=${E}^{${N(lx)}}$ e $${N(y)}=${E}^{${N(ly)}}$)`
    : `$${L}${N(x)}\\approx${N(lx)}$ e $${L}${N(y)}\\approx${N(ly)}$`;
  return {
    esq: lq,
    dir,
    formula: `${L}\\frac{x}{y}\\neq\\frac{${L}x}{${L}y}`,
    linhaEsq: ladoEsq(`${L}${frac}`, ehExato(q, 6) && `${L}${N(q, 6)}`, lq),
    linhaDir: semDir
      ? lin2(`\\frac{${L}${N(x)}}{${L}${N(y)}}`, '=', `\\frac{${N(lx)}}{0}`, '', '\\text{ não existe}')
      : lin2(`\\frac{${L}${N(x)}}{${L}${N(y)}}`, exato ? '=' : '\\approx', `\\frac{${N(lx)}}{${N(ly)}}`, eq(dir), N(dir)),
    termos: semDir
      ? []
      : [termo(dir, `${B.nome} ${nx(x)} ÷ ${B.nome} ${nx(y)} ${rel(dir)} ${num(dir, 3)}`, 'f', 'cima')],
    total: { v: lq, rot: `${B.nome} (${nx(x)}÷${nx(y)}) ${rel(lq)} ${num(lq, 3)}`, tipo: 'r' },
    aviso: semDir ? `${B.nome} 1 = 0: não se divide por 0, este lado nem existe` : '',
    porque: [
      `Os logaritmos são expoentes: ${dados}.`,
      semDir
        ? `Aqui $${L}${N(y)}=0$ e não se divide por zero: o lado direito nem existe. Escolhe um $y$ diferente de 1.`
        : coincide
          ? `Aqui calha dar o mesmo nos dois lados, por acaso (por exemplo, base 2, $x=16$ e $y=4$). É uma coincidência: experimenta outros valores.`
          : `Dividir os números subtrai os expoentes: $${L}${frac}${igual(exato)}${N(lx)}-${par(ly)}${eq(lx - ly)}${N(lx - ly)}$. Dividir os expoentes, $\\frac{${N(lx)}}{${N(ly)}}${eq(dir)}${N(dir)}$, é outra conta, e dá outro resultado.`,
      `Não há nenhuma operação com $x$ e $y$ que corresponda a dividir os expoentes. Os logaritmos só ajudam a transformar a divisão de números numa subtração.`,
    ],
  };
}

function cuidadoQuadrado(B, x) {
  const a = B.valor;
  const L = B.tex;
  const E = B.rot;
  const lx = logB(a, x);
  const x2 = x * x;
  const l2 = logB(a, x2);
  const dir = lx * lx;
  const coincide = Math.abs(l2 - dir) < 1e-9;
  const exato = ehExato(lx);
  return {
    esq: l2,
    dir,
    formula: `${L}\\left(x^{2}\\right)\\neq\\left(${L}x\\right)^{2}`,
    linhaEsq: ladoEsq(`${L}\\left(${N(x)}^{2}\\right)`, ehExato(x2, 6) && `${L}${N(x2, 6)}`, l2),
    linhaDir: lin2(`\\left(${L}${N(x)}\\right)^{2}`, exato ? '=' : '\\approx', `${par(lx)}^{2}`, eq(dir), N(dir)),
    termos: [termo(dir, `(${B.nome} ${nx(x)})^{2} ${rel(dir)} ${num(dir, 3)}`, 'f', 'cima')],
    total: { v: l2, rot: `${B.nome} (${nx(x)}^{2}) ${rel(l2)} ${num(l2, 3)}`, tipo: 'r' },
    aviso: '',
    porque: [
      `Põe $m=${L}${N(x)}${exato ? '=' : '\\approx'}${N(lx)}$, ou seja, $${N(x)}=${E}^{m}$.`,
      `Elevar $x$ ao quadrado <strong>duplica</strong> o expoente: $x^{2}=\\left(${E}^{m}\\right)^{2}=${E}^{2m}$. Logo $${L}\\left(${N(x)}^{2}\\right)=2m${eq(l2)}${N(l2)}$. Já $\\left(${L}${N(x)}\\right)^{2}=m^{2}${eq(dir)}${N(dir)}$ multiplica o expoente por ele próprio.`,
      coincide
        ? `Aqui calha ser $2m=m^{2}$, por acaso. Isso só acontece se $m=0$ ou $m=2$, ou seja, $x=1$ ou $x=${E}^{2}$. Experimenta outros valores.`
        : `Só dariam o mesmo se $2m=m^{2}$, isto é, $m=0$ ou $m=2$ (ou seja, $x=1$ ou $x=${E}^{2}$). Para os outros valores, não.`,
    ],
  };
}

/**
 * Tudo o que a interface precisa para um estado: os dois lados, a diferença, o veredicto
 * ('iguais', 'diferentes' ou, na aba Cuidado, 'acaso' se calhar serem iguais), os comprimentos
 * da régua e os textos. `base`/`nova` são objetos de BASES; x, y > 0.
 */
export function analisar({ prop, base, nova, x, y, p, caso }) {
  let r;
  switch (prop) {
    case 'produto': r = produto(base, x, y); break;
    case 'quociente': r = quociente(base, x, y); break;
    case 'potencia': r = potencia(base, x, p); break;
    case 'inverso': r = inverso(base, x); break;
    case 'mudanca': r = mudanca(base, nova, x); break;
    case 'cuidado':
      r = caso === 'razao' ? cuidadoRazao(base, x, y) : caso === 'quadrado' ? cuidadoQuadrado(base, x) : cuidadoSoma(base, x, y);
      break;
    default: throw new Error(`propriedade desconhecida: ${prop}`);
  }
  const indef = !Number.isFinite(r.dir);
  const dif = indef ? NaN : r.esq - r.dir;
  const iguais = !indef && Math.abs(dif) <= 1e-9 * Math.max(1, Math.abs(r.esq));
  const estado = iguais ? (prop === 'cuidado' ? 'acaso' : 'iguais') : 'diferentes';
  const arredondado = [r.esq, r.dir].some((v) => Number.isFinite(v) && !ehExato(v));
  return { ...r, prop, caso, base, indef, dif, iguais, estado, arredondado };
}

/**
 * Cadeia da régua: o intervalo [a, b] de cada termo e a fila em que se desenha. Um termo que
 * recua (sentido contrário ao anterior) iria tapar o anterior, por isso passa para a fila 1.
 * `posicoes` são todas as posições de que a janela precisa.
 */
export function cadeia(r) {
  let acc = 0;
  let fila = 0;
  let anterior = 0;
  const segs = r.termos.map((t, i) => {
    const sentido = Math.abs(t.v) < 1e-9 ? 0 : Math.sign(t.v);
    if (i > 0 && sentido !== 0 && anterior !== 0 && sentido !== anterior) fila = 1 - fila;
    if (sentido !== 0) anterior = sentido;
    const s = { ...t, a: acc, b: acc + t.v, fila };
    acc += t.v;
    return s;
  });
  return { segs, fim: acc, posicoes: [0, ...segs.flatMap((s) => [s.a, s.b]), r.total.v] };
}

/** Texto para leitores de ecrã: o que a régua mostra. */
export function descricao(r) {
  if (r.prop === 'mudanca') {
    return `Duas réguas por cima e por baixo do mesmo segmento, que mede o número x. A de cima mede ${semMarcas(r.rotA)}; a de baixo mede ${semMarcas(r.rotB)}.`;
  }
  const { segs } = cadeia(r);
  const total = semMarcas(r.total.rot);
  if (r.prop === 'inverso') {
    return `Régua. Em cima: ${semMarcas(segs[0].rot)}. Em baixo: ${total}. Têm o mesmo comprimento, em sentidos opostos.`;
  }
  const fim = r.iguais ? 'Acabam no mesmo ponto.' : 'Não acabam no mesmo ponto.';
  if (r.prop === 'potencia') {
    const cima = segs.length ? `${segs.length} comprimentos colados, ${semMarcas(r.resumo)}` : semMarcas(r.aviso);
    return `Régua. Em cima, ${cima}. Em baixo: ${total}. ${fim}`;
  }
  const cima = segs.length ? segs.map((s) => semMarcas(s.rot)).join('; depois ') : semMarcas(r.aviso || 'nada');
  return `Régua. Em cima, colados: ${cima}. Em baixo: ${total}. ${fim}`;
}

// ======================================================================
// Desenho (SVG feito à mão com criar)
// ======================================================================

const VB_W = 340;
const X0 = 14;
const X1 = VB_W - 14;
const LARG = X1 - X0;
const ALT = 18; // espessura das barras
const Y_A0 = 38; // centro da barra de cima (a cadeia)
const Y_A1 = 76; // segunda fila da cadeia, para o termo que recua sobre o anterior
const Y_B = 136; // centro da barra de baixo (o resultado)
const Y_EIXO = 176;
const Y_TOPO = 14;
const VB_H = 202;

const n2 = (v) => Math.round(v * 100) / 100;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const grupo = (cls, ...filhos) => criar('g', { class: cls }, filhos);

/** Texto de SVG com expoentes ^{...}; `ancora` 'middle' fica dentro do viewBox. */
function texto(cls, x, y, rot, ancora = 'middle') {
  let cx = x;
  if (ancora === 'middle') {
    const meio = larguraRotulo(rot) / 2 + 2;
    cx = limitar(x, meio, VB_W - meio);
  }
  const t = criar('text', { class: cls, x: n2(cx), y: n2(y), 'text-anchor': ancora });
  let descer = false;
  for (const parte of partirRotulo(rot)) {
    if (parte.sup !== undefined) {
      t.append(criar('tspan', { dy: -4, 'font-size': '75%' }, [parte.sup]));
      descer = true;
    } else {
      t.append(criar('tspan', descer ? { dy: 4 } : {}, [parte.t]));
      descer = false;
    }
  }
  return t;
}

/** Riscas para os comprimentos negativos (um padrão por cor; a forma não depende só da cor). */
function definicoes(uid) {
  const padrao = (tipo) =>
    criar('pattern', { id: `${uid}-riscas-${tipo}`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
      criar('rect', { class: 'pro-fundo', width: 7, height: 7 }),
      criar('line', { class: `pro-risca pro-risca--${tipo}`, x1: 0, y1: 0, x2: 0, y2: 7, 'stroke-width': 3.6 }),
    ]);
  return criar('defs', {}, ['x', 'y', 'r', 'f', 'm'].map(padrao));
}

/** Barra com ponta de seta de `a` até `b` (b < a: para a esquerda, às riscas). */
function barra(uid, X, a, b, yc, tipo) {
  const x0 = X(a);
  const x1 = X(b);
  const comp = x1 - x0;
  if (Math.abs(comp) < 1.2) return criar('circle', { class: `pro-ponto pro-t-${tipo}`, cx: n2(x0), cy: yc, r: 4.5 });
  const dir = comp > 0 ? 1 : -1;
  const ponta = Math.min(8, Math.abs(comp) * 0.6);
  const d = `M${n2(x0)} ${yc - ALT / 2}L${n2(x1 - dir * ponta)} ${yc - ALT / 2}L${n2(x1)} ${yc}L${n2(x1 - dir * ponta)} ${yc + ALT / 2}L${n2(x0)} ${yc + ALT / 2}Z`;
  const neg = dir < 0;
  return criar('path', {
    class: `pro-barra pro-t-${tipo}${neg ? ' pro-neg' : ' pro-pos'}`,
    d,
    fill: neg ? `url(#${uid}-riscas-${tipo})` : null,
  });
}

/** Eixo com marcas nos inteiros (números a cada `passo`) e linhas de grelha ténues. */
function eixo(X, jan, yEixo, ySuperior) {
  const { maiores, menores } = marcas(jan);
  const g = grupo('pro-eixo');
  const grelha = grupo('pro-grelha');
  for (const v of maiores) grelha.append(criar('line', { x1: n2(X(v)), x2: n2(X(v)), y1: ySuperior, y2: yEixo }));
  g.append(criar('line', { class: 'pro-eixo-linha', x1: X0, x2: X1, y1: yEixo, y2: yEixo }));
  for (const v of menores) g.append(criar('line', { class: 'pro-marca', x1: n2(X(v)), x2: n2(X(v)), y1: yEixo, y2: yEixo + 3 }));
  for (const v of maiores) {
    g.append(criar('line', { class: 'pro-marca', x1: n2(X(v)), x2: n2(X(v)), y1: yEixo, y2: yEixo + 6 }));
    g.append(criar('text', { class: 'pro-numero', x: n2(X(v)), y: yEixo + 19, 'text-anchor': 'middle' }, [num(v, 0)]));
  }
  return [grelha, g];
}

/** A régua das propriedades: cadeia de cima, resultado de baixo, eixo com unidades. */
function desenharCadeia(svg, r, uid) {
  const { segs, fim, posicoes } = cadeia(r);
  const jan = janela(posicoes);
  const X = (v) => X0 + ((v - jan.lo) / jan.span) * LARG;
  const yFila = (s) => (s.fila ? Y_A1 : Y_A0);
  const [grelha, eixoG] = eixo(X, jan, Y_EIXO, Y_TOPO);
  const zero = criar('line', { class: 'pro-zero', x1: n2(X(0)), x2: n2(X(0)), y1: Y_TOPO, y2: Y_EIXO });
  // rótulo no meio da barra; se o comprimento for (quase) nulo, ao lado do ponto, para não cair sobre a linha do zero
  const rotuloBarra = (cls, a, b, y, rot) => {
    const x0 = X(a);
    const x1 = X(b);
    if (Math.abs(x1 - x0) >= 12) return texto(cls, (x0 + x1) / 2, y, rot);
    return x0 < VB_W / 2 ? texto(cls, x0 + 9, y, rot, 'start') : texto(cls, x0 - 9, y, rot, 'end');
  };
  const linhaV = (cls, v, y1, y2 = Y_EIXO) => criar('line', { class: cls, x1: n2(X(v)), x2: n2(X(v)), y1, y2 });

  // guias: de onde acaba a cadeia até ao eixo e, se não coincidirem, de onde acaba o resultado
  const guias = grupo('pro-guias');
  const ultima = segs[segs.length - 1];
  if (r.espelho === true) {
    guias.append(linhaV('pro-guia', segs[0].b, Y_A0 + ALT / 2), linhaV('pro-guia pro-guia--total', r.total.v, Y_B + ALT / 2));
  } else if (ultima) {
    guias.append(linhaV('pro-guia', fim, yFila(ultima) + ALT / 2));
    if (Math.abs(fim - r.total.v) >= 1e-9) {
      guias.append(linhaV('pro-guia pro-guia--total', r.total.v, Y_B + ALT / 2));
      const ya = 122;
      const xa = X(fim);
      const xb = X(r.total.v);
      const sentido = xb > xa ? 1 : -1;
      const ponta = (x, k) => criar('path', { class: 'pro-folga-seta', d: `M${n2(x)} ${ya}L${n2(x - k * 6)} ${ya - 4}L${n2(x - k * 6)} ${ya + 4}Z` });
      guias.append(
        criar('line', { class: 'pro-folga', x1: n2(xa), x2: n2(xb), y1: ya, y2: ya }),
        ponta(xb, sentido), ponta(xa, -sentido),
        texto('pro-t-folga', (xa + xb) / 2, ya - 5, `diferença ${num(Math.abs(fim - r.total.v), 3)}`));
    }
  }
  // um termo que recuou fica noutra fila: liga-se ao anterior no ponto onde este acaba
  segs.forEach((s, i) => {
    if (i > 0 && s.fila !== segs[i - 1].fila) {
      guias.append(linhaV('pro-guia', s.a, Math.min(yFila(s), yFila(segs[i - 1])) + ALT / 2, Math.max(yFila(s), yFila(segs[i - 1])) - ALT / 2));
    }
  });

  // barras e rótulos
  const barras = grupo('pro-barras');
  const rotulos = grupo('pro-rotulos');
  segs.forEach((s) => {
    const yc = yFila(s);
    barras.append(barra(uid, X, s.a, s.b, yc, s.tipo));
    const meio = (X(s.a) + X(s.b)) / 2;
    if (r.prop === 'potencia') {
      if (Math.abs(X(s.b) - X(s.a)) >= 18) rotulos.append(texto('pro-t-curto', meio, yc - ALT / 2 - 6, s.rot));
    } else {
      const y = s.pos === 'baixo' ? yc + ALT / 2 + 15 : yc - ALT / 2 - 6;
      rotulos.append(rotuloBarra('pro-t-barra', s.a, s.b, y, s.rot));
    }
  });
  if (r.prop === 'potencia' && segs.length) {
    rotulos.append(texto('pro-t-barra', (X(0) + X(fim)) / 2, Y_A0 + ALT / 2 + 15, r.resumo));
  }
  if (!segs.length && r.aviso) rotulos.append(texto('pro-t-aviso', VB_W / 2, Y_A0 + 4, r.aviso));
  barras.append(barra(uid, X, 0, r.total.v, Y_B, r.total.tipo));
  rotulos.append(rotuloBarra('pro-t-barra', 0, r.total.v, Y_B + ALT / 2 + 15, r.total.rot));

  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.replaceChildren(definicoes(uid), grelha, eixoG, zero, guias, barras, rotulos);
  svg.setAttribute('aria-label', descricao(r));
}

// Mudança de base: o mesmo segmento (de 0 a ln x) medido por duas réguas. A janela é fixa,
// em unidades naturais, porque o que muda entre bases é só a distância entre as marcas.
const MB_LO = -2.5;
const MB_HI = 4.75;
const MB_Y1 = 34; // eixo da régua de cima (marcas e números por cima)
const MB_Y2 = 146; // eixo da régua de baixo (marcas e números por baixo)
const MB_YM = 90; // barra do segmento
const MB_H = 176;

function desenharMudanca(svg, r, uid, B, C, x) {
  const X = (v) => X0 + ((v - MB_LO) / (MB_HI - MB_LO)) * LARG;
  const xm = X(r.ln);
  const camadas = [];

  const regua = (base, y, cima, tipo) => {
    const passo = Math.log(base.valor);
    const g = grupo(`pro-regua pro-regua--${tipo}`);
    g.append(criar('line', { class: 'pro-eixo-linha', x1: X0, x2: X1, y1: y, y2: y }));
    for (let k = Math.ceil(MB_LO / passo - 1e-9); k * passo <= MB_HI + 1e-9; k++) {
      const px = n2(X(k * passo));
      g.append(criar('line', { class: 'pro-marca', x1: px, x2: px, y1: y, y2: y + (cima ? -6 : 6) }));
      g.append(criar('text', { class: 'pro-numero', x: px, y: y + (cima ? -11 : 19), 'text-anchor': 'middle' }, [num(k, 0)]));
    }
    return g;
  };
  camadas.push(regua(B, MB_Y1, true, 'a'), regua(C, MB_Y2, false, 'b'));

  const guias = grupo('pro-guias');
  guias.append(criar('line', { class: 'pro-zero', x1: n2(X(0)), x2: n2(X(0)), y1: MB_Y1, y2: MB_Y2 }));
  guias.append(criar('line', { class: 'pro-guia', x1: n2(xm), x2: n2(xm), y1: MB_Y1, y2: MB_Y2 }));
  // marcadores: triângulos encostados a cada régua
  guias.append(criar('path', { class: 'pro-seta-a', d: `M${n2(xm)} ${MB_Y1 + 1}L${n2(xm - 5)} ${MB_Y1 + 11}L${n2(xm + 5)} ${MB_Y1 + 11}Z` }));
  guias.append(criar('path', { class: 'pro-seta-b', d: `M${n2(xm)} ${MB_Y2 - 1}L${n2(xm - 5)} ${MB_Y2 - 11}L${n2(xm + 5)} ${MB_Y2 - 11}Z` }));

  const barras = grupo('pro-barras', barra(uid, X, 0, r.ln, MB_YM, 'm'));
  const rotulos = grupo('pro-rotulos');
  rotulos.append(texto('pro-t-a', xm, MB_Y1 + 28, r.rotA));
  rotulos.append(texto('pro-t-b', xm, MB_Y2 - 20, r.rotB));
  if (Math.abs(X(r.ln) - X(0)) >= 52) {
    // sobre as riscas (segmento negativo) o texto branco não se lê: texto escuro com contorno claro
    rotulos.append(texto(r.ln < 0 ? 'pro-t-barra' : 'pro-t-dentro', (X(0) + X(r.ln)) / 2, MB_YM + 4, `x = ${nx(x)}`));
  }

  camadas.push(guias, barras, rotulos);
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${MB_H}`);
  svg.replaceChildren(definicoes(uid), ...camadas);
  svg.setAttribute('aria-label', descricao(r));
}

// ======================================================================
// Widget
// ======================================================================

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

const memoTex = new Map();
function texC(s) {
  let r = memoTex.get(s);
  if (r === undefined) {
    if (memoTex.size > 3000) memoTex.clear();
    r = tex(s);
    memoTex.set(s, r);
  }
  return r;
}
/** Texto com $...$ -> HTML com as fórmulas já desenhadas (frações em tamanho normal, para se lerem os índices). */
const comTex = (s) =>
  s.replace(/\$([^$]+)\$([.,;:!?]?)/g, (_, t, pontuacao) => {
    const html = texC(t.replace(/\\frac/g, '\\dfrac'));
    // fórmulas curtas ficam coladas à vírgula ou ao ponto que as segue (não passam sozinhos para a linha de baixo)
    return pontuacao && t.length <= 50 ? `<span class="pro-cola">${html}${pontuacao}</span>` : html + pontuacao;
  });

function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}
function definirTexto(el, txt) {
  if (el.textContent !== txt) el.textContent = txt;
}

let contador = 0;

const LEGENDAS = {
  produto: 'Os dois comprimentos de cima, colados, acabam onde acaba o de baixo.',
  quociente: 'Recuando o segundo comprimento a partir do fim do primeiro, chegas ao fim do de baixo.',
  potencia: 'As cópias do comprimento de cima ocupam exatamente o comprimento de baixo.',
  inverso: 'O mesmo comprimento, em sentidos opostos.',
  mudanca: 'O segmento roxo é o mesmo nas duas réguas: em cima conta-se em unidades da base escolhida (azul), em baixo em unidades da nova base (vermelho).',
  cuidado: 'Os comprimentos não acabam no mesmo ponto: as duas expressões são diferentes.',
};
// as riscas e a seta para a esquerda assinalam os comprimentos negativos (não depende só da cor)
const SETAS = 'Às riscas e a apontar para a esquerda: comprimento negativo (por exemplo, o logaritmo de um número menor que 1). Cada marca da régua vale 1 unidade.';
const SETAS_MUDANCA = 'Cada marca vale 1 unidade da respetiva base. Se x é menor que 1, o segmento aponta para a esquerda e leva riscas.';

const SELOS = {
  iguais: { simbolo: '✓', texto: 'iguais' },
  diferentes: { simbolo: '✗', texto: 'diferentes' },
  acaso: { simbolo: '!', texto: 'iguais por coincidência' },
};

export async function montar(el) {
  const uid = `pro${++contador}`;
  const est = {
    prop: 'produto',
    base: '2',
    nova: '10',
    caso: 'soma',
    g: { ix: indiceDe(8), iy: indiceDe(4), p: 3 }, // produto, quociente, potência, inverso, mudança
    c: { ix: indiceDe(1), iy: indiceDe(1) }, // cuidado: tem os seus próprios valores
  };
  const alvo = () => (est.prop === 'cuidado' ? est.c : est.g);

  // ---------------- abas ----------------
  const abas = ABAS.map((a) =>
    h('button', {
      type: 'button', role: 'tab', class: 'chip pro-aba', id: `${uid}-aba-${a.id}`, 'data-aba': a.id,
      'aria-controls': `${uid}-painel`, 'aria-selected': a.id === est.prop ? 'true' : 'false', tabindex: a.id === est.prop ? '0' : '-1',
    }, a.rot));
  const listaAbas = h('div', { class: 'chips pro-abas', role: 'tablist', 'aria-label': 'Propriedade' }, ...abas);
  listaAbas.addEventListener('keydown', (e) => {
    const i = abas.indexOf(document.activeElement);
    if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight') j = (i + 1) % abas.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = abas.length - 1;
    else return;
    e.preventDefault();
    abas[j].focus();
    escolherAba(abas[j].dataset.aba);
  });
  abas.forEach((b) => b.addEventListener('click', () => escolherAba(b.dataset.aba)));

  // ---------------- bases ----------------
  const chipsBase = (rotulo, aoEscolher) => {
    const botoes = BASES.map((b) =>
      h('button', { type: 'button', class: 'chip pro-chip', 'data-base': b.id, 'aria-pressed': 'false', 'aria-label': `base ${b.rot}` }, b.rot));
    botoes.forEach((b) => b.addEventListener('click', () => aoEscolher(b.dataset.base)));
    return { botoes, caixa: h('div', { class: 'pro-base' }, h('span', { class: 'pro-rotulo' }, rotulo), h('div', { class: 'chips', role: 'group', 'aria-label': rotulo }, ...botoes)) };
  };
  const cBase = chipsBase('Base', (id) => {
    if (id === est.nova) est.nova = est.base;
    est.base = id;
    pintar();
  });
  const cNova = chipsBase('Nova base', (id) => {
    if (id === est.base) est.base = est.nova;
    est.nova = id;
    pintar();
  });
  cNova.caixa.classList.add('pro-base--nova');

  // ---------------- casos do «Cuidado» ----------------
  const botoesCaso = CASOS.map((c) =>
    h('button', { type: 'button', class: 'chip pro-chip', 'data-caso': c.id, 'aria-pressed': 'false' }, c.rot));
  botoesCaso.forEach((b) => b.addEventListener('click', () => {
    est.caso = b.dataset.caso;
    exemplo();
    pintar();
  }));
  const botaoExemplo = h('button', { type: 'button', class: 'botao botao--suave botao--mini pro-exemplo' }, 'Voltar ao exemplo');
  botaoExemplo.addEventListener('click', () => { exemplo(); pintar(); });
  const caixaCaso = h('div', { class: 'pro-caso' },
    h('span', { class: 'pro-rotulo' }, 'Erro típico'),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Erro típico' }, ...botoesCaso, botaoExemplo));
  function exemplo() {
    const ex = CASOS.find((c) => c.id === est.caso).exemplo;
    est.c.ix = indiceDe(ex.x);
    est.c.iy = indiceDe(ex.y);
  }

  // ---------------- controlos ----------------
  const slider = (letra, min, max, step) =>
    h('input', { type: 'range', id: `${uid}-${letra}`, min, max, step, value: min, class: 'pro-slider' });
  const sX = slider('x', 0, VALORES.length - 1, 1);
  const sY = slider('y', 0, VALORES.length - 1, 1);
  const sP = slider('p', P_MIN, P_MAX, P_PASSO);
  const saidas = {};
  const atalhosDe = (letra) => {
    const botoes = ATALHOS.map((v) =>
      h('button', { type: 'button', class: 'chip pro-chip', 'data-v': String(v), 'aria-pressed': 'false', 'aria-label': `${letra} igual a ${nx(v)}` }, nx(v)));
    botoes.forEach((b) => b.addEventListener('click', () => {
      alvo()[letra === 'x' ? 'ix' : 'iy'] = indiceDe(Number(b.dataset.v));
      pintar();
    }));
    return botoes;
  };
  const botoesX = atalhosDe('x');
  const botoesY = atalhosDe('y');
  const controlo = (letra, input, botoes) => {
    saidas[letra] = h('span', { class: 'pro-saida', 'aria-hidden': 'true' });
    return h('div', { class: `controlo pro-ctl pro-ctl--${letra}` },
      h('div', { class: 'pro-linha' }, h('label', { for: `${uid}-${letra}` }, letra), saidas[letra]),
      input,
      botoes ? h('div', { class: 'chips pro-atalhos', role: 'group', 'aria-label': `Valores rápidos de ${letra}` }, ...botoes) : null);
  };
  const cX = controlo('x', sX, botoesX);
  const cY = controlo('y', sY, botoesY);
  const cP = controlo('p', sP, null);
  sX.addEventListener('input', () => { alvo().ix = Number(sX.value); pintar(); });
  sY.addEventListener('input', () => { alvo().iy = Number(sY.value); pintar(); });
  sP.addEventListener('input', () => { est.g.p = Number(sP.value); pintar(); });
  const dominio = h('p', { class: 'nota pro-dominio' });
  dominio.innerHTML = comTex('$x$ e $y$ têm de ser positivos: só existem logaritmos de números positivos. Por isso os controlos só vão de 0,1 a 100.');
  const controlos = h('div', { class: 'controlos pro-controlos' }, cX, cY, cP, dominio);

  // ---------------- desenho, conferência, porquê ----------------
  const svg = criar('svg', { class: 'figura figura--fixa pro-svg', viewBox: `0 0 ${VB_W} ${VB_H}`, role: 'img', 'aria-label': '' });
  const legenda = h('figcaption', { class: 'pro-legenda' });
  const figura = h('figure', { class: 'pro-fig' }, svg, legenda);

  const ladoEsqEl = h('div', { class: 'pro-lado-tex' });
  const ladoDirEl = h('div', { class: 'pro-lado-tex' });
  const seloSimbolo = h('span', { class: 'pro-selo__simbolo', 'aria-hidden': 'true' });
  const seloTexto = h('span', { class: 'pro-selo__texto' });
  const seloDif = h('span', { class: 'pro-selo__dif' });
  const selo = h('p', { class: 'pro-selo' }, seloSimbolo, seloTexto, seloDif);
  const notaArred = h('p', { class: 'nota pro-arred' }, 'Valores arredondados a 4 casas; as contas são feitas com todas as casas.');
  const conf = h('div', { class: 'pro-conf', 'aria-live': 'polite', 'aria-atomic': 'true' },
    h('div', { class: 'pro-lado' }, h('span', { class: 'pro-lado__rot' }, 'Lado esquerdo'), ladoEsqEl),
    h('div', { class: 'pro-lado' }, h('span', { class: 'pro-lado__rot' }, 'Lado direito'), ladoDirEl),
    selo, notaArred);

  const tituloPorque = h('h4', { class: 'pro-porque__titulo' });
  const linhasPorque = h('div', { class: 'pro-porque__linhas' });
  const porque = h('div', { class: 'pro-porque' }, tituloPorque, linhasPorque);

  const formula = h('p', { class: 'pro-formula' });
  const painel = h('div', { class: 'pro-painel', role: 'tabpanel', id: `${uid}-painel`, 'aria-labelledby': `${uid}-aba-${est.prop}` },
    cBase.caixa, cNova.caixa, caixaCaso, formula,
    h('div', { class: 'pro-corpo' },
      h('div', { class: 'pro-col pro-col--a' }, figura, controlos),
      h('div', { class: 'pro-col pro-col--b' }, conf, porque)));

  el.replaceChildren(h('div', { class: 'widget pro' },
    h('p', { class: 'widget__titulo' }, 'Experimenta as propriedades'),
    listaAbas, painel));

  function escolherAba(id) {
    if (id === est.prop) return;
    est.prop = id;
    if (id === 'cuidado') exemplo();
    pintar();
  }

  // ---------------- pintar ----------------
  function pintar() {
    const B = baseDe(est.base);
    const C = baseDe(est.nova);
    const v = alvo();
    const x = VALORES[v.ix];
    const y = VALORES[v.iy];
    const p = est.g.p;
    const r = analisar({ prop: est.prop, base: B, nova: C, x, y, p, caso: est.caso });
    const usa = controlosDe(est.prop, est.caso);

    // abas
    abas.forEach((b) => {
      const ativa = b.dataset.aba === est.prop;
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
    });
    painel.setAttribute('aria-labelledby', `${uid}-aba-${est.prop}`);

    // bases e casos
    cBase.botoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.base === est.base)));
    cNova.botoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.base === est.nova)));
    cNova.caixa.hidden = est.prop !== 'mudanca';
    caixaCaso.hidden = est.prop !== 'cuidado';
    botoesCaso.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.caso === est.caso)));

    // fórmula
    definirHtml(formula, texC(`\\displaystyle ${r.formula}`));

    // controlos
    cX.hidden = !usa.includes('x');
    cY.hidden = !usa.includes('y');
    cP.hidden = !usa.includes('p');
    sX.value = String(v.ix);
    sY.value = String(v.iy);
    sP.value = String(p);
    definirTexto(saidas.x, `= ${nx(x)}`);
    definirTexto(saidas.y, `= ${nx(y)}`);
    definirTexto(saidas.p, `= ${num(p)}`);
    sX.setAttribute('aria-valuetext', `x igual a ${nx(x)}`);
    sY.setAttribute('aria-valuetext', `y igual a ${nx(y)}`);
    sP.setAttribute('aria-valuetext', `p igual a ${num(p)}`);
    botoesX.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === x)));
    botoesY.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === y)));

    // régua
    if (est.prop === 'mudanca') {
      desenharMudanca(svg, r, uid, B, C, x);
    } else {
      desenharCadeia(svg, r, uid);
    }
    definirTexto(legenda, `${LEGENDAS[est.prop]} ${est.prop === 'mudanca' ? SETAS_MUDANCA : SETAS}`);

    // conferência
    definirHtml(ladoEsqEl, texC(r.linhaEsq));
    definirHtml(ladoDirEl, texC(r.linhaDir));
    const s = SELOS[r.estado];
    selo.className = `pro-selo pro-selo--${r.estado}`;
    definirTexto(seloSimbolo, s.simbolo);
    definirTexto(seloTexto, s.texto);
    definirTexto(seloDif, r.indef ? 'o lado direito não existe' : `diferença: ${num(Math.abs(r.dif), 4)}`);
    notaArred.hidden = !r.arredondado;

    // porquê
    definirTexto(tituloPorque, est.prop === 'cuidado' ? 'Porque é que não é verdade' : 'Porquê, com os teus números');
    definirHtml(linhasPorque, r.porque.map((t) => `<p>${comTex(t)}</p>`).join(''));
  }

  pintar();
}
