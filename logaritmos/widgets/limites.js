// limites: «Quem ganha quando x cresce?». Cinco abas para VER de onde vêm os limites notáveis
// (em vez de os decorar): eˣ contra xᵖ, ln x contra xᵖ, x·ln x perto de 0, os dois limites
// que dão 1 em 0, e a procura de assíntotas (m e b) com números. Cada aba tem um gráfico com
// cursor (rato, toque, setas) ligado a um slider, leituras em direto, uma tabela de valores,
// uma frase de conclusão e a regra dos cartões.
//
// Escalas: o quociente eˣ/xᵖ varia entre 10⁻⁶ e 10²⁷⁵, por isso o seu gráfico desenha
// log₁₀ do quociente (eixo vertical em potências de 10); ln x/xᵖ e x·ln x desenham-se contra
// log₁₀ x quando o que interessa é x enorme ou minúsculo.
//
// Contrato: export async function montar(el, dados); devolve { aba(id), abaAtual() } (os
// testes e as demos usam-no; a página ignora). Estado guardado: nenhum.
//
// Os cálculos puros (tabelas, formatação científica, cruzamentos) estão exportados para que
// logaritmos/tests/limites.html os confira contra o cálculo direto.

import * as M from '../../assets/motor/matematica.js';
import { criarGrafico, arrastarNaCurva } from '../../assets/motor/grafico.js';
import { tex } from '../../assets/motor/katex.js';
import { amostrarCurva, colocar, posicoesAoRedor, zonasDosEixos } from './colocacao.js';

// ======================================================================
// Números: formatação à portuguesa
// ======================================================================

const SUPER = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).replace(/[0-9-]/g, (c) => SUPER[c]);
const potDez = (k) => (k === 0 ? '1' : `10${sup(k)}`); // marcas dos eixos (texto simples)
const potTex = (k) => (k === 0 ? '1' : k === 1 ? '10' : `10^{${k}}`);
const semZeros = (s) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/** |v| a `sig` algarismos significativos: { mant: '1,2', exp: 19 } (mantissa já arredondada, sem zeros finais). */
export function cientifico(v, sig = 3) {
  const [m, e] = Math.abs(v).toExponential(sig - 1).split('e');
  return { mant: semZeros(m).replace('.', ','), exp: Number(e) };
}

// Decimal simples entre 0,01 e 999 (expoente de -2 a 2 depois de arredondar), senão científico.
function partes(v, sig) {
  if (!Number.isFinite(v)) return null;
  if (v === 0) return { neg: false, plain: '0' };
  const neg = v < 0;
  const { mant, exp } = cientifico(v, sig);
  if (exp >= -2 && exp <= 2) {
    const casas = Math.max(0, sig - 1 - exp);
    const plain = semZeros(Number(`${mant.replace(',', '.')}e${exp}`).toFixed(casas)).replace('.', ',');
    return { neg, plain };
  }
  return { neg, mant, exp };
}

/** LaTeX: 1{,}2\times10^{19} · 10^{-6} · 0{,}0475 · -2{,}3 */
export function numTex(v, sig = 3) {
  const p = partes(v, sig);
  if (!p) return '\\text{n.d.}';
  const s = p.neg ? '-' : '';
  if (p.plain !== undefined) return s + p.plain.replace(',', '{,}');
  return `${s}${p.mant === '1' ? '' : `${p.mant.replace(',', '{,}')}\\times`}10^{${p.exp}}`;
}

/** Texto simples (para o SVG e os rótulos): 1,2×10¹⁹ · 10⁻⁶ · 0,0475 · −2,3 */
export function numTxt(v, sig = 3) {
  const p = partes(v, sig);
  if (!p) return 'n.d.';
  const s = p.neg ? '−' : '';
  if (p.plain !== undefined) return s + p.plain;
  return `${s}${p.mant === '1' ? '' : `${p.mant}×`}10${sup(p.exp)}`;
}

/** Para os leitores de ecrã: «1,2 vezes 10 elevado a 19». */
export function numFalado(v, sig = 3) {
  const p = partes(v, sig);
  if (!p) return 'sem valor';
  const s = p.neg ? 'menos ' : '';
  if (p.plain !== undefined) return s + p.plain;
  return `${s}${p.mant === '1' ? '' : `${p.mant} vezes `}10 elevado a ${p.exp < 0 ? `menos ${-p.exp}` : p.exp}`;
}

/** Decimal com `casas` casas, em LaTeX: 1{,}000500 · -0{,}5 */
export const decTex = (v, casas) => M.fmt(v, casas).replace(',', '{,}').replace('−', '-');

/** O x das tabelas: potências de 10 (|k| ≥ 3) escritas como 10^{k}; o resto como numTex. */
export function xTex(x) {
  if (x === 0) return '0';
  const k = Math.round(Math.log10(Math.abs(x)));
  const pot = Math.pow(10, k);
  if ((k >= 3 || k <= -3) && Math.abs(Math.abs(x) - pot) < 1e-12 * pot) return `${x < 0 ? '-' : ''}10^{${k}}`;
  return numTex(x);
}

// ======================================================================
// Cálculos (exportados para os testes)
// ======================================================================

const LOG10E = Math.LOG10E;

// ----- eˣ / xᵖ, x → +∞ -----
export const X_EXP = [1, 2, 5, 10, 20, 50, 100, 300, 700];
export const P_LN = [0.1, 0.25, 0.5, 1, 2];
export const T_LN = [1, 2, 3, 6, 12]; // x = 10^t
export const X_XLNX = [0.1, 0.01, 1e-3, 1e-6];
export const X_NOTAVEIS = [-1, -0.1, -0.01, -1e-3, 0, 1e-3, 0.01, 0.1, 1];

/** Linhas da tabela de eˣ/xᵖ: x, eˣ, xᵖ e o quociente (sem estourar: x ≤ 700). */
export function linhasExp(p, xs = X_EXP) {
  return xs.map((x) => {
    const ex = Math.exp(x);
    const xp = Math.pow(x, p);
    return { x, ex, xp, q: ex / xp };
  });
}

/** log₁₀(eˣ/xᵖ) = x·log₁₀e − p·log₁₀x: o que se desenha (nunca estoura). */
export const log10QuocExp = (p, x) => x * LOG10E - p * Math.log10(x);

/**
 * Onde eˣ = xᵖ (x > 0). eˣ > xᵖ ⇔ x > p·ln x, e h(x) = x − p·ln x tem mínimo em x = p, de valor
 * p(1 − ln p). Com p < e esse mínimo é positivo: a exponencial está sempre à frente ({ sempre }).
 * Com p > e há dois cruzamentos x1 < p < x2, e a partir de x2 a exponencial fica sempre à frente;
 * n é o menor inteiro com eˣ > xᵖ para todo o x ≥ n.
 */
export function cruzamentoExp(p) {
  const h = (x) => x - p * Math.log(x);
  const minimo = Math.pow(Math.E / p, p); // valor mínimo de eˣ/xᵖ, em x = p
  if (p < Math.E) return { sempre: true, minimo };
  let a = p;
  let b = 2 * p;
  while (h(b) <= 0) b *= 2;
  for (let i = 0; i < 100; i++) {
    const m = (a + b) / 2;
    if (h(m) > 0) b = m; else a = m;
  }
  const x2 = (a + b) / 2;
  let c = 1; // h(1) = 1 > 0
  let d = p; // h(p) < 0
  for (let i = 0; i < 100; i++) {
    const m = (c + d) / 2;
    if (h(m) > 0) c = m; else d = m;
  }
  return { sempre: false, minimo, x1: (c + d) / 2, x2, n: Math.floor(x2) + 1 };
}

// ----- ln x / xᵖ, x → +∞ -----
export const quocienteLn = (p, x) => Math.log(x) / Math.pow(x, p);
/** Com x = 10^t: ln x = t·ln 10, xᵖ = 10^(p·t). */
export const quocienteLnT = (p, t) => (t * Math.LN10) / Math.pow(10, p * t);
/** Máximo de ln x/xᵖ: em x = e^(1/p), de valor 1/(p·e). */
export const maximoLn = (p) => ({ x: Math.exp(1 / p), y: 1 / (p * Math.E) });

// ----- x·ln x, x → 0⁺ -----
export const xlnx = (x) => x * Math.log(x);
/** Mínimo de x·ln x: em x = 1/e, de valor −1/e. */
export const minimoXlnx = { x: 1 / Math.E, y: -1 / Math.E };

// ----- (eˣ − 1)/x e ln(1 + x)/x, x → 0 (expm1 e log1p evitam o cancelamento) -----
export const expm1X = (x) => (x === 0 ? NaN : Math.expm1(x) / x);
export const log1pX = (x) => (x <= -1 || x === 0 ? NaN : Math.log1p(x) / x);

// ----- assíntotas -----
export const F5 = (x) => x + Math.exp(-x);
export const G5 = (x) => Math.log(x) / x;
/** f(x)/x = 1 + e^(−x)/x (assim não há cancelamento). */
export const razaoF = (x) => 1 + Math.exp(-x) / x;
/** f(x) − x = e^(−x), exatamente. */
export const difF = (x) => Math.exp(-x);

// ----- linhas das tabelas (o que o widget escreve: texto LaTeX de cada célula) -----

/** Aba 1: [{ cels: [x, eˣ, xᵖ, quociente], classe }]; a classe marca as linhas em que eˣ > xᵖ. */
export const linhasTabelaExp = (p) => linhasExp(p).map((l) => ({
  cels: [xTex(l.x), numTex(l.ex), numTex(l.xp), numTex(l.q)], classe: l.q > 1 ? 'li-ganha' : '',
}));
/** Aba 2: x = 10^t com t em T_LN. */
export const linhasTabelaLn = (p) => T_LN.map((t) => {
  const x = Math.pow(10, t);
  return { cels: [potTex(t), numTex(Math.log(x)), numTex(Math.pow(x, p)), numTex(quocienteLn(p, x))] };
});
/** Aba 3. */
export const linhasTabelaXlnx = () => X_XLNX.map((x) => ({ cels: [xTex(x), numTex(Math.log(x)), numTex(xlnx(x))] }));
/** Aba 4: seis casas decimais; em x = 0 ambos são 0/0 e ln(1 + x) não existe em x = −1. */
export const linhasTabelaNotaveis = () => X_NOTAVEIS.map((x) => {
  const zero = x === 0;
  const a = zero ? String.raw`\tfrac00` : decTex(expm1X(x), 6);
  const b = zero ? String.raw`\tfrac00` : x <= -1 ? String.raw`\text{não existe}` : decTex(log1pX(x), 6);
  return { cels: [xTex(x), a, b], classe: zero ? 'li-zero' : '' };
});

// ======================================================================
// Pequenas peças de interface
// ======================================================================

let contador = 0;
const D = 100; // desloca o eixo dos xx dos gráficos em log₁₀ x para a janela não conter 0 (o motor põe lá um «0»)
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sinal = (x) => (x < 0 ? -1 : 1);

function h(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  n.append(...filhos);
  return n;
}
/** Texto com $...$ -> HTML com as fórmulas desenhadas. */
// a pontuação e o parêntese que abre ficam colados à fórmula (não passam sozinhos para outra linha)
const T = (s) => s.replace(/(\()?\$([^$]+)\$([.,;:!?)]*)/g, (_, ab, m, fim) => (m.length <= 40 && (ab || fim)
  ? `<span class="li-junto">${ab || ''}${tex(m)}${fim}</span>` : `${ab || ''}${tex(m)}${fim}`));
const comTex = (el, latex) => { el.innerHTML = tex(latex); return el; };
const comT = (el, texto) => { el.innerHTML = T(texto); return el; };

/** Slider com rótulo e leitura. `texto(v)` é o que se vê; `falado(v)` o aria-valuetext (por defeito, o mesmo). */
function controlo(id, rotulo, { min, max, step, valor, texto, falado, aoMudar }) {
  const input = h('input', { type: 'range', id, min, max, step, value: valor });
  const out = h('output', { for: id });
  const caixa = h('div', { class: 'controlo li-controlo' },
    h('div', { class: 'li-controlo__linha' }, h('label', { for: id }, rotulo), out), input);
  const atualizar = () => {
    const v = Number(input.value);
    out.textContent = texto(v);
    input.setAttribute('aria-valuetext', falado ? falado(v) : texto(v).replace(' = ', ' igual a '));
  };
  input.addEventListener('input', () => { atualizar(); aoMudar(Number(input.value)); });
  atualizar();
  return { caixa, input, out, atualizar, definir(v) { input.value = v; atualizar(); } };
}

/** Linha de chips (um por opção, exclusivos). `opcoes`: [{ id, tex | txt, falado }]. */
function chipsDe(rotulo, opcoes, aoEscolher, classe = '') {
  const botoes = opcoes.map((o) => {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-id': o.id, 'aria-label': o.falado });
    if (o.tex) b.innerHTML = tex(o.tex); else b.textContent = o.txt;
    b.addEventListener('click', () => aoEscolher(o.id));
    return b;
  });
  const raiz = h('div', { class: `chips li-chips ${classe}`.trim(), role: 'group', 'aria-label': rotulo }, ...botoes);
  return {
    raiz,
    marcar(id) { botoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === String(id)))); },
  };
}

/** Grelha de leituras em direto: definir(chave, latex). */
function criarLeituras(defs) {
  const nos = {};
  const raiz = h('div', { class: 'leituras li-leituras' });
  for (const d of defs) {
    const val = h('span', { class: 'leitura__valor' });
    raiz.append(h('div', { class: `leitura li-leitura ${d.classe || ''}`.trim() },
      comTex(h('span', { class: 'leitura__rotulo' }), d.rotulo), val));
    nos[d.chave] = val;
  }
  return { raiz, definir(chave, latex) { nos[chave].innerHTML = tex(latex); } };
}

/** Tabela com cabeçalhos; a 1.ª coluna é cabeçalho de linha. preencher([{ cels: [latex...], classe }]). */
function criarTabela(cabecalhos) {
  const caption = h('caption', { class: 'sr-only' });
  const cab = h('tr', {}, ...cabecalhos.map((c) => comTex(h('th', { scope: 'col' }), c)));
  const corpo = h('tbody');
  const tabela = h('table', { class: 'tabela li-tabela' }, caption, h('thead', {}, cab), corpo);
  const caixa = h('div', { class: 'tabela-rolante li-rolante', role: 'region', tabindex: '0' }, tabela);
  return {
    caixa,
    preencher(linhas, legenda) {
      caption.textContent = legenda;
      caixa.setAttribute('aria-label', legenda);
      corpo.replaceChildren(...linhas.map((l) => {
        const tr = h('tr', l.classe ? { class: l.classe } : {});
        l.cels.forEach((c, i) => tr.append(comTex(h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}), c)));
        return tr;
      }));
    },
  };
}

/** O gráfico de uma aba: refaz-se por completo quando a janela muda; o cursor liga ao slider. */
function criarVista(caixa) {
  let g = null;
  let cursor = null;
  return {
    get g() { return g; },
    desenhar(cfg) {
      g = criarGrafico({
        x: cfg.x, y: cfg.y, largura: 340, altura: cfg.altura || 250,
        rotuloX: cfg.rotuloX ?? 'x', rotuloY: cfg.rotuloY ?? '',
        marcasX: cfg.marcasX, marcasY: cfg.marcasY, aria: cfg.aria,
      });
      if (cfg.camadas) cfg.camadas(g);
      cursor = cfg.cursor
        ? arrastarNaCurva(g, cfg.cursor.fn, {
          x0: cfg.cursor.x0, xmin: cfg.cursor.min, xmax: cfg.cursor.max, passoTeclado: cfg.cursor.passo,
          aoMover: cfg.cursor.aoMover, textoAria: cfg.cursor.textoAria,
          aria: cfg.cursor.aria || 'Cursor sobre a curva. Setas esquerda e direita para o mover.',
        })
        : null;
      caixa.replaceChildren(g.svg);
    },
    mover(u) { if (cursor) cursor.mover(u, false); },
  };
}

/** Esqueleto comum de uma aba (duas colunas a partir de 50em). */
function esqueleto(id, pergunta, formula) {
  const r = {
    extra: h('div', { class: 'li-extra' }),
    grafico: h('div', { class: 'li-grafico' }),
    nota: h('p', { class: 'nota li-nota' }),
    cx: h('div', { class: 'li-cx' }),
    leituras: h('div', { class: 'li-leituras-caixa' }),
    estado: h('p', { class: 'li-estado', 'aria-live': 'polite' }),
    tabela: h('div', { class: 'li-tabela-caixa' }),
    mais: h('div', { class: 'li-mais' }),
    conclusao: h('div', { class: 'li-conclusao' }),
    regra: h('div', { class: 'li-regra' }),
  };
  const formulaEl = h('div', { class: 'li-formula' });
  formulaEl.innerHTML = tex(formula, true);
  r.raiz = h('div', { class: 'li-aba', 'data-aba': id, hidden: true },
    h('div', { class: 'li-cabeca' }, comT(h('p', { class: 'li-pergunta' }), pergunta), formulaEl),
    h('div', { class: 'li-corpo' },
      h('div', { class: 'li-col' }, r.extra, r.grafico, r.nota, r.cx, r.leituras, r.estado),
      h('div', { class: 'li-col' }, r.tabela, r.mais, r.conclusao, r.regra)));
  return r;
}

/** Marcas em potências de 10: cada marca k (múltipla de `passo`) escreve 10ᵏ; `desloca` acompanha D. */
function marcasPot(k0, k1, passo = 1, desloca = 0) {
  const r = [];
  for (let k = Math.ceil(k0 / passo) * passo; k <= k1; k += passo) r.push({ valor: desloca + k, texto: potDez(k) });
  return r;
}

/**
 * Põe o rótulo de um ponto (de um gráfico já com as curvas) no sítio onde menos pisa as curvas, os números e os nomes dos eixos.
 * `textos`: do mais completo ao mais curto (o curto só entra se o completo não tiver sítio limpo).
 * `curvas`: [{ fn, de, ate }]. `preferencia`: lados por ordem de gosto.
 */
function rotuloDe(g, x, y, textos, { curvas, preferencia = ['cimaDir', 'baixoDir', 'cimaEsq', 'baixoEsq', 'cima', 'baixo', 'dir', 'esq'], cor, tam = 12 }) {
  const alt = posicoesAoRedor(5, tam);
  const pontos = curvas.map((c) => amostrarCurva(g, c.fn, c.de, c.ate));
  const evitar = zonasDosEixos(g, tam);
  let melhor = null;
  textos.forEach((texto, i) => {
    const r = colocar(g, { texto, px: g.X(x), py: g.Y(y), tam, opcoes: preferencia.map((k) => alt[k]), curvas: pontos, evitar });
    const custo = r.custo + i * 3;
    if (!melhor || custo < melhor.custo - 1e-9) melhor = { ...r, custo, texto };
  });
  g.rotulo(x, y, melhor.texto, { ancora: melhor.ancora, dx: melhor.dx, dy: melhor.dy, cor });
  return melhor;
}

const caixaConclusao = (el, titulo, texto) => {
  el.replaceChildren(h('p', { class: 'li-rotulo' }, titulo), comT(h('p', { class: 'li-texto' }), texto));
};

// ======================================================================
// Aba 1: eˣ / xᵖ
// ======================================================================

/** Janela do gráfico de log₁₀(eˣ/xᵖ) para um p: mostra a descida, o mínimo em x = p e a subida. */
export function janelaExp(p) {
  const c = cruzamentoExp(p);
  const xmin = 0.5;
  const xmax = c.sempre ? Math.max(10, Math.ceil((4 * p) / 5) * 5) : Math.ceil((1.5 * c.x2) / 5) * 5;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 300; i++) {
    const v = log10QuocExp(p, xmin + ((xmax - xmin) * i) / 300);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return { c, x: [xmin, xmax], y: [Math.floor(lo) - 2, Math.ceil(hi) + 1] };
}

function fabricaExp() {
  const id = `li${++contador}`;
  const est = { p: 5, meios: false, x: 10 };
  const E = esqueleto('exp', String.raw`Quem cresce mais depressa quando $x\to+\infty$: $e^x$ ou $x^p$?`, String.raw`\lim_{x\to+\infty}\frac{e^x}{x^p}`);
  const vista = criarVista(E.grafico);
  const tabela = criarTabela(['x', 'e^x', 'x^{p}', String.raw`\dfrac{e^x}{x^p}`]);
  const L = criarLeituras([
    { chave: 'x', rotulo: 'x' },
    { chave: 'ex', rotulo: 'e^x', classe: 'leitura--exp' },
    { chave: 'xp', rotulo: 'x^p' },
    { chave: 'q', rotulo: String.raw`\dfrac{e^x}{x^p}` },
  ]);

  const cp = controlo(`${id}-p`, 'Expoente p', {
    min: 1, max: 10, step: 1, valor: est.p,
    texto: (v) => `p = ${numTxt(v)}`,
    aoMudar: (v) => { est.p = v; redesenhar(); },
  });
  const chipMeios = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, 'Também meios (1,5; 2,5; ...)');
  chipMeios.addEventListener('click', () => {
    est.meios = !est.meios;
    chipMeios.setAttribute('aria-pressed', String(est.meios));
    cp.input.step = est.meios ? '0.5' : '1';
    if (!est.meios) est.p = Math.floor(est.p);
    cp.definir(est.p);
    redesenhar();
  });
  E.extra.append(cp.caixa, h('div', { class: 'chips li-chips' }, chipMeios));

  const cx = controlo(`${id}-x`, 'Valor de x', {
    min: 0.5, max: 20, step: 0.5, valor: est.x,
    texto: (v) => `x = ${numTxt(v)}`,
    aoMudar: (v) => { est.x = v; vista.mover(v); leitura(); },
  });
  E.cx.append(cx.caixa);
  E.leituras.append(L.raiz);
  E.tabela.append(tabela.caixa);
  E.nota.innerHTML = T(String.raw`Eixo vertical em escala logarítmica: cada marca vale $10$ vezes a anterior. O eixo horizontal é onde o quociente vale $1$, ou seja, $e^x=x^p$: acima dele a exponencial ganha, abaixo ganha a potência.`);
  caixaConclusao(E.conclusao, 'Conclusão',
    String.raw`Quando $x$ cresce, $e^x$ cresce muito mais depressa que $x^p$, por isso o quociente tende para $+\infty$. Por maior que seja $p$, a exponencial acaba por passar a potência e nunca mais perde.`);
  caixaConclusao(E.regra, 'Regra dos cartões',
    String.raw`A exponencial vence qualquer potência: $\lim_{x\to+\infty}\dfrac{e^x}{x^p}=+\infty$, seja qual for $p$. Por isso este limite não é uma indeterminação por resolver: dá $+\infty$.`);

  function leitura() {
    const { p, x } = est;
    const ex = Math.exp(x);
    const xp = Math.pow(x, p);
    const q = ex / xp;
    L.definir('x', numTex(x));
    L.definir('ex', numTex(ex));
    L.definir('xp', numTex(xp));
    L.definir('q', numTex(q));
    comT(E.estado, String.raw`Em $x=${numTex(x)}$: $\dfrac{e^x}{x^p}\approx${numTex(q)}$. `
      + (q > 1 ? String.raw`A exponencial já está à frente ($e^x>x^p$).` : String.raw`A potência ainda está à frente ($e^x<x^p$).`));
  }

  function redesenhar() {
    const { p } = est;
    const { c, x: jx, y: jy } = janelaExp(p);
    est.x = limitar(est.x, jx[0], jx[1]);
    cx.input.max = String(jx[1]);
    cx.definir(est.x);
    const passoY = jy[1] - jy[0] <= 8 ? 1 : jy[1] - jy[0] <= 16 ? 2 : 5;
    const P = numTxt(p);
    vista.desenhar({
      x: jx, y: jy, marcasY: marcasPot(jy[0], jy[1], passoY),
      aria: `Gráfico do logaritmo decimal de e elevado a x a dividir por x elevado a ${P}, para x entre 0,5 e ${jx[1]}. A curva desce até ao mínimo em x igual a ${P} e depois sobe`
        + (c.sempre ? ', sempre acima do eixo horizontal, onde o quociente vale 1.' : `, passando o valor 1 em x aproximadamente ${numTxt(c.x2)}.`),
      camadas(g) {
        g.curva((u) => log10QuocExp(p, u), { cor: 'exp' });
        g.rotulo(jx[0], 0, '1', { ancora: 'end', dx: -6, dy: 4 }); // a marca do eixo (o motor não a escreve onde passa o eixo)
        g.ponto(p, log10QuocExp(p, p));
        rotuloDe(g, p, log10QuocExp(p, p), [`mínimo, x = ${P}`, 'mínimo'], { curvas: [{ fn: (u) => log10QuocExp(p, u) }], preferencia: ['baixoDir', 'baixoEsq', 'baixo', 'cimaDir', 'cimaEsq', 'cima', 'dir', 'esq'] });
        if (!c.sempre) {
          g.ponto(c.x1, 0, { cor: 'tg', raio: 3.5 });
          g.ponto(c.x2, 0, { cor: 'tg' });
          g.rotulo(c.x2, 0, `x ≈ ${numTxt(c.x2)}`, { ancora: 'end', dx: -4, dy: -9, cor: 'tg' }); // por cima do eixo: à esquerda a curva está abaixo
        }
      },
      cursor: {
        fn: (u) => log10QuocExp(p, u), x0: est.x, min: jx[0], max: jx[1], passo: 0.5,
        aoMover: (u) => { est.x = u; cx.definir(Math.round(u * 2) / 2); leitura(); },
        textoAria: (u, y) => `x igual a ${numFalado(u)}; o quociente vale ${numFalado(Math.pow(10, y))}`,
      },
    });

    tabela.preencher(linhasTabelaExp(p), `Valores de e elevado a x, de x elevado a ${P} e do quociente. As linhas a verde são aquelas em que a exponencial já ganha.`);

    const Ptex = numTex(p);
    const min = numTex(c.minimo);
    if (c.sempre) {
      comT(E.mais, String.raw`<strong>A partir de que $x$?</strong> Com $p=${Ptex}$, a exponencial está à frente da potência para todo o $x>0$: o quociente tem o mínimo em $x=p$ e esse mínimo, $\left(\dfrac{e}{p}\right)^{p}\approx${min}$, já é maior que $1$.`);
    } else {
      const n = c.n;
      comT(E.mais, String.raw`<strong>A partir de que $x$?</strong> Com $p=${Ptex}$ o quociente desce até ao mínimo em $x=p$, onde vale $\left(\dfrac{e}{p}\right)^{p}\approx${min}$ (a potência está mesmo à frente), e depois sobe. A exponencial só passa a potência em $x\approx${numTex(c.x2)}$: em $x=${n - 1}$ ainda é $e^{${n - 1}}\approx${numTex(Math.exp(n - 1))}<${n - 1}^{${Ptex}}\approx${numTex(Math.pow(n - 1, p))}$, mas em $x=${n}$ já é $e^{${n}}\approx${numTex(Math.exp(n))}>${n}^{${Ptex}}\approx${numTex(Math.pow(n, p))}$. A partir daí fica sempre à frente. (À esquerda de $x\approx${numTex(c.x1)}$ o quociente também é maior que $1$, porque com $x$ pequeno $x^p$ é minúsculo, mas isso não conta para $x\to+\infty$.)`);
    }
    leitura();
  }

  cp.definir(est.p);
  chipMeios.setAttribute('aria-pressed', 'false');
  redesenhar();
  return { raiz: E.raiz };
}

// ======================================================================
// Aba 2: ln x / xᵖ
// ======================================================================

function fabricaLn() {
  const id = `li${++contador}`;
  const est = { p: 0.5, t: 3 }; // x = 10^t
  const E = esqueleto('ln', String.raw`Quem cresce mais depressa quando $x\to+\infty$: $x^p$ ou $\ln x$?`, String.raw`\lim_{x\to+\infty}\frac{\ln x}{x^p}`);
  const vista = criarVista(E.grafico);
  const tabela = criarTabela(['x', String.raw`\ln x`, 'x^{p}', String.raw`\dfrac{\ln x}{x^p}`]);
  const L = criarLeituras([
    { chave: 'x', rotulo: 'x' },
    { chave: 'ln', rotulo: String.raw`\ln x`, classe: 'leitura--log' },
    { chave: 'xp', rotulo: 'x^p' },
    { chave: 'q', rotulo: String.raw`\dfrac{\ln x}{x^p}` },
  ]);

  const pChips = chipsDe('Expoente p', P_LN.map((p) => ({ id: p, txt: `p = ${numTxt(p)}`, falado: `p igual a ${numTxt(p)}` })), (v) => {
    est.p = Number(v);
    redesenhar();
  });
  E.extra.append(pChips.raiz);

  const cx = controlo(`${id}-x`, 'Valor de x (escala logarítmica)', {
    min: 0, max: 12, step: 0.1, valor: est.t,
    texto: (t) => `x = ${numTxt(Math.pow(10, t))}`,
    falado: (t) => `x igual a ${numFalado(Math.pow(10, t))}`,
    aoMudar: (t) => { est.t = t; vista.mover(D + t); leitura(); },
  });
  E.cx.append(cx.caixa);
  E.leituras.append(L.raiz);
  E.tabela.append(tabela.caixa);
  E.nota.innerHTML = T(String.raw`O eixo horizontal está em escala logarítmica: cada marca vale $10$ vezes a anterior, de $x=1$ até $x=10^{12}$.`);
  caixaConclusao(E.conclusao, 'Conclusão',
    String.raw`Quando $x$ cresce, $\ln x$ cresce muito mais devagar que $x^p$, por isso o quociente tende para $0$. Com $p$ pequeno demora a chegar lá, mas chega.`);
  caixaConclusao(E.regra, 'Regra dos cartões',
    String.raw`A potência vence o logaritmo: $\lim_{x\to+\infty}\dfrac{\ln x}{x^p}=0$, para todo o $p>0$.`);

  function leitura() {
    const { p, t } = est;
    const x = Math.pow(10, t);
    const lnx = t * Math.LN10;
    const xp = Math.pow(10, p * t);
    const q = lnx / xp;
    L.definir('x', numTex(x));
    L.definir('ln', numTex(lnx));
    L.definir('xp', numTex(xp));
    L.definir('q', numTex(q));
    comT(E.estado, String.raw`Em $x=${numTex(x)}$: $\dfrac{\ln x}{x^p}\approx${numTex(q)}$. `
      + (x > maximoLn(p).x ? 'Já passou o máximo: o quociente está a descer para $0$.' : 'Ainda antes do máximo: o quociente está a subir.'));
  }

  function redesenhar() {
    const { p } = est;
    pChips.marcar(p);
    const mx = maximoLn(p);
    const tm = Math.log10(mx.x);
    const ymax = mx.y * 1.25;
    vista.desenhar({
      x: [D, D + 12], y: [-0.15 * mx.y, ymax],
      marcasX: marcasPot(0, 12, 2, D),
      aria: `Gráfico de logaritmo neperiano de x a dividir por x elevado a ${numTxt(p)}, para x entre 1 e 10 elevado a 12, com o eixo horizontal em escala logarítmica. Sobe até ao máximo em x igual a ${numFalado(mx.x)} e depois desce para zero.`,
      camadas(g) {
        g.curva((u) => quocienteLnT(p, u - D), { cor: 'log' });
        g.ponto(D + tm, mx.y);
        rotuloDe(g, D + tm, mx.y, ['máximo'], { curvas: [{ fn: (u) => quocienteLnT(p, u - D) }], preferencia: ['cimaDir', 'cima', 'cimaEsq', 'dir', 'esq', 'baixoDir', 'baixoEsq', 'baixo'] });
      },
      cursor: {
        fn: (u) => quocienteLnT(p, u - D), x0: D + est.t, min: D, max: D + 12, passo: 0.1,
        aoMover: (u) => { est.t = limitar(u - D, 0, 12); cx.definir(Math.round(est.t * 10) / 10); leitura(); },
        textoAria: (u, y) => `x igual a ${numFalado(Math.pow(10, u - D))}; o quociente vale ${numFalado(y)}`,
      },
    });

    tabela.preencher(linhasTabelaLn(p), `Valores de ln x, de x elevado a ${numTxt(p)} e do quociente, para x de 10 a 10 elevado a 12.`);
    comT(E.mais, String.raw`<strong>E o máximo?</strong> O quociente sobe até ao máximo em $x=e^{1/p}\approx${numTex(mx.x)}$, onde vale $\dfrac{1}{pe}\approx${numTex(mx.y)}$, e depois desce para $0$. Quanto menor o $p$, mais tarde (e mais devagar) isso acontece.`);
    leitura();
  }

  redesenhar();
  return { raiz: E.raiz };
}

// ======================================================================
// Aba 3: x ln x, x → 0⁺
// ======================================================================

function fabricaXlnx() {
  const id = `li${++contador}`;
  const est = { log: false, s: -2 }; // x = 10^s
  const E = esqueleto('xlnx', String.raw`O que acontece a $x\ln x$ quando $x$ se aproxima de $0$ por valores positivos?`, String.raw`\lim_{x\to0^+}x\ln x`);
  const vista = criarVista(E.grafico);
  const tabela = criarTabela(['x', String.raw`\ln x`, String.raw`x\ln x`]);
  const L = criarLeituras([
    { chave: 'x', rotulo: 'x' },
    { chave: 'ln', rotulo: String.raw`\ln x`, classe: 'leitura--log' },
    { chave: 'f', rotulo: String.raw`x\ln x` },
  ]);

  const vChips = chipsDe('Escala do eixo horizontal', [
    { id: 'normal', txt: 'Escala normal', falado: 'Eixo horizontal em escala normal' },
    { id: 'log', txt: 'Escala logarítmica', falado: 'Eixo horizontal em escala logarítmica' },
  ], (v) => { est.log = v === 'log'; redesenhar(); });
  E.extra.append(vChips.raiz);

  const cx = controlo(`${id}-x`, 'Valor de x (escala logarítmica)', {
    min: -6, max: 0, step: 0.05, valor: est.s,
    texto: (s) => `x = ${numTxt(Math.pow(10, s))}`,
    falado: (s) => `x igual a ${numFalado(Math.pow(10, s))}`,
    aoMudar: (s) => { est.s = s; vista.mover(uDeS(s)); leitura(); },
  });
  E.cx.append(cx.caixa);
  E.leituras.append(L.raiz);
  E.tabela.append(tabela.caixa);
  caixaConclusao(E.conclusao, 'Conclusão',
    String.raw`Quando $x\to0^+$, $\ln x\to-\infty$, mas $x\to0$ mais depressa, por isso o produto $x\ln x$ tende para $0$, por valores negativos (em $]0,1[$ o logaritmo é negativo).`);
  caixaConclusao(E.regra, 'Regra dos cartões',
    String.raw`Com $y=\dfrac1x$ (e $y\to+\infty$): $x\ln x=-\dfrac{\ln y}{y}\to0$. É outra vez «a potência vence o logaritmo».`);
  comT(E.mais, String.raw`<strong>E o mínimo?</strong> O produto tem o mínimo em $x=\dfrac1e\approx${numTex(minimoXlnx.x)}$, onde vale $-\dfrac1e\approx${numTex(minimoXlnx.y)}$. À esquerda do mínimo, à medida que $x$ se aproxima de $0$, o produto volta a subir para $0$.`);

  const uDeS = (s) => (est.log ? D + s : Math.pow(10, s));
  const sDeU = (u) => (est.log ? u - D : Math.log10(Math.max(u, 1e-6)));

  function leitura() {
    const x = Math.pow(10, est.s);
    L.definir('x', numTex(x));
    L.definir('ln', numTex(Math.log(x)));
    L.definir('f', numTex(xlnx(x)));
    comT(E.estado, x >= 0.99
      ? String.raw`Em $x=1$: $\ln 1=0$, por isso $x\ln x=0$.`
      : String.raw`Em $x=${numTex(x)}$: $x\ln x\approx${numTex(xlnx(x))}$ (negativo). Quanto mais perto de $0$ está $x$, mais perto de $0$ fica o produto.`);
  }

  function redesenhar() {
    vChips.marcar(est.log ? 'log' : 'normal');
    const f = (u) => (est.log ? xlnx(Math.pow(10, u - D)) : xlnx(u));
    vista.desenhar({
      x: est.log ? [D - 6.6, D + 0.02] : [0, 1.1], y: [-0.45, 0.15],
      marcasX: est.log ? marcasPot(-6, 0, 1, D) : undefined,
      aria: est.log
        ? 'Gráfico de x vezes logaritmo neperiano de x, com o eixo horizontal em escala logarítmica, de x igual a 10 elevado a menos 6 até 1. A curva desce até ao mínimo, menos 0,37, e depois sobe para zero.'
        : 'Gráfico de x vezes logaritmo neperiano de x, para x entre 0 e 1,1. Parte da origem (ponto aberto), desce até ao mínimo, menos 0,37, em x igual a 0,37, e sobe até zero em x igual a 1.',
      camadas(g) {
        g.curva(f, { cor: 'log' });
        if (!est.log) g.ponto(0, 0, { oco: true });
        const xm = est.log ? D + Math.log10(minimoXlnx.x) : minimoXlnx.x;
        g.ponto(xm, minimoXlnx.y);
        rotuloDe(g, xm, minimoXlnx.y, ['mínimo'], { curvas: [{ fn: f }], preferencia: ['baixo', 'baixoDir', 'baixoEsq', 'dir', 'esq', 'cimaDir', 'cimaEsq', 'cima'] });
      },
      cursor: {
        fn: f, x0: uDeS(est.s), min: est.log ? D - 6 : 1e-6, max: est.log ? D : 1, passo: est.log ? 0.1 : 0.01,
        aoMover: (u) => { est.s = limitar(sDeU(u), -6, 0); cx.definir(Math.round(est.s * 20) / 20); leitura(); },
        textoAria: (u, y) => `x igual a ${numFalado(est.log ? Math.pow(10, u - D) : u)}; x ln x vale ${numFalado(y)}`,
      },
    });
    tabela.preencher(linhasTabelaXlnx(),
      'Valores de ln x e de x ln x, para x de 0,1 até 10 elevado a menos 6.');
    leitura();
  }

  cx.definir(est.s);
  redesenhar();
  return { raiz: E.raiz };
}

// ======================================================================
// Aba 4: (eˣ − 1)/x e ln(1 + x)/x, x → 0
// ======================================================================

/** Slider de x em escala logarítmica dos dois lados: k de −31 a 31 (k = 0 é x = 0; |k| = 31 é |x| = 1). */
export const xDeK = (k) => (k === 0 ? 0 : sinal(k) * Math.pow(10, -3 + (Math.abs(k) - 1) / 10));
export const kDeX = (x) => (x === 0 ? 0 : sinal(x) * Math.max(1, Math.min(31, Math.round((Math.log10(Math.abs(x)) + 3) * 10) + 1)));

function fabricaNotaveis() {
  const id = `li${++contador}`;
  const est = { k: 20 };
  const E = esqueleto('notaveis', String.raw`Para onde vão estes dois quocientes quando $x\to0$?`,
    String.raw`\begin{gathered}\lim_{x\to0}\dfrac{e^x-1}{x}\\[0.5em]\lim_{x\to0}\dfrac{\ln(1+x)}{x}\end{gathered}`);
  const vista = criarVista(E.grafico);
  const tabela = criarTabela(['x', String.raw`\dfrac{e^x-1}{x}`, String.raw`\dfrac{\ln(1+x)}{x}`]);
  const L = criarLeituras([
    { chave: 'x', rotulo: 'x' },
    { chave: 'a', rotulo: String.raw`\dfrac{e^x-1}{x}`, classe: 'leitura--exp' },
    { chave: 'b', rotulo: String.raw`\dfrac{\ln(1+x)}{x}`, classe: 'leitura--log' },
  ]);
  let segundo = null;

  const cx = controlo(`${id}-x`, 'Valor de x (escala logarítmica)', {
    min: -31, max: 31, step: 1, valor: est.k,
    texto: (k) => `x = ${k === 0 ? '0' : numTxt(xDeK(k))}`,
    falado: (k) => `x igual a ${k === 0 ? '0' : numFalado(xDeK(k))}`,
    aoMudar: (k) => { est.k = k; vista.mover(xDeK(k)); leitura(xDeK(k)); },
  });
  E.cx.append(cx.caixa);
  E.leituras.append(L.raiz);
  E.tabela.append(tabela.caixa);
  E.nota.innerHTML = T(String.raw`As duas curvas passam perto de $(0,1)$ mas não existem em $x=0$ (é $\frac00$): o ponto aberto assinala o buraco. $\ln(1+x)$ só existe para $x>-1$. Para $x$ muito pequeno, $e^x-1$ subtrai dois números quase iguais e perde algarismos; aqui os valores são calculados de forma a evitar isso.`);
  caixaConclusao(E.conclusao, 'Conclusão',
    String.raw`Quando $x$ se aproxima de $0$, dos dois lados, os dois quocientes aproximam-se de $1$. Perto de $0$, $e^x\approx1+x$ e $\ln(1+x)\approx x$, por isso o numerador comporta-se como $x$ e o quociente fica perto de $1$.`);
  caixaConclusao(E.regra, 'Regra dos cartões',
    String.raw`$\lim_{x\to0}\dfrac{e^x-1}{x}=1$ e $\lim_{x\to0}\dfrac{\ln(1+x)}{x}=1$. Só servem quando o que está no expoente de $e$ (ou dentro do $\ln$) é igual ao denominador; se não for, faz uma mudança de variável.`);
  tabela.preencher(linhasTabelaNotaveis(), 'Valores dos dois quocientes para x de menos 1 a 1. Em x igual a 0 ambos são zero sobre zero; em x igual a menos 1 o segundo não existe.');

  function leitura(x) {
    if (x === 0) {
      L.definir('x', '0');
      L.definir('a', String.raw`\tfrac00`);
      L.definir('b', String.raw`\tfrac00`);
      comT(E.estado, String.raw`Em $x=0$ os dois quocientes são $\tfrac00$: não se pode substituir, mas o limite existe e vale $1$.`);
      return;
    }
    const a = expm1X(x);
    const b = log1pX(x);
    L.definir('x', numTex(x));
    L.definir('a', decTex(a, 6));
    L.definir('b', Number.isNaN(b) ? String.raw`\text{não existe}` : decTex(b, 6));
    comT(E.estado, String.raw`Em $x=${numTex(x)}$: a distância a $1$ é $${numTex(Math.abs(a - 1), 2)}$ no primeiro quociente`
      + (Number.isNaN(b) ? '.' : String.raw` e $${numTex(Math.abs(b - 1), 2)}$ no segundo.`));
  }

  function redesenhar() {
    vista.desenhar({
      x: [-1.2, 1.5], y: [0, 3], rotuloY: 'y',
      aria: 'Gráfico de duas curvas, e elevado a x menos 1 sobre x, a azul, e logaritmo de 1 mais x sobre x, a vermelho, para x entre menos 1,2 e 1,5. As duas passam muito perto do ponto (0, 1), assinalado a aberto, e a reta tracejada y igual a 1 mostra o valor do limite.',
      camadas(g) {
        g.retaHorizontal(1, { rotulo: 'y = 1', posRotulo: 'dir' }); // à direita: à esquerda o texto cruza a reta x = −1
        g.retaVertical(-1, { rotulo: 'x = −1', posRotulo: 'baixo' });
        g.curva((x) => (x === 0 ? 1 : expm1X(x)), { cor: 'exp' });
        g.curva((x) => (x === 0 ? 1 : log1pX(x)), { cor: 'log' });
        g.ponto(0, 1, { oco: true });
        segundo = g.ponto(xDeK(est.k), 1, { cor: 'log', raio: 4.5, fora: true });
      },
      cursor: {
        fn: (x) => (x === 0 ? 1 : expm1X(x)), x0: xDeK(est.k), min: -1, max: 1, passo: 0.01,
        aoMover: (x) => {
          segundo.mover(x, x === 0 ? 1 : log1pX(x), false);
          est.k = kDeX(x);
          cx.definir(est.k);
          leitura(x);
        },
        textoAria: (x, y) => `x igual a ${numFalado(x)}; o primeiro quociente vale ${M.fmt(y, 6).replace('−', 'menos ')}`,
      },
    });
    const x = xDeK(est.k);
    segundo.mover(x, x === 0 ? 1 : log1pX(x), false);
    leitura(x);
  }

  redesenhar();
  return { raiz: E.raiz };
}

// ======================================================================
// Aba 5: assíntotas de f(x) = x + e^(−x) e de g(x) = ln x / x
// ======================================================================

export const FUNCOES5 = {
  f: {
    chip: 'f(x)=x+e^{-x}', falado: 'f de x igual a x mais e elevado a menos x',
    cor: 'exp', fn: F5, janela: { x: [-2.5, 6.5], y: [-2, 10] },
    slider: { min: -2.5, max: 6.5, step: 0.1, x0: 1.5, log: false },
    cursor: { min: -2.5, max: 6.5, passo: 0.1 },
    camadas(g) {
      g.reta(1, 0, { cor: 'assint', tracejado: true });
      g.rotulo(6.3, 4.6, 'y = x', { ancora: 'end', dx: 0, dy: 0, cor: 'assint' }); // por baixo da reta: por cima ela confunde-se com a curva
    },
    aria: 'Gráfico de f de x igual a x mais e elevado a menos x, para x entre menos 2,5 e 6,5. À esquerda a curva sobe muito depressa; desce até ao mínimo em x igual a 0 e depois aproxima-se, por cima, da reta tracejada y igual a x.',
    leituras: [
      { chave: 'x', rotulo: 'x' }, { chave: 'fx', rotulo: 'f(x)', classe: 'leitura--exp' },
      { chave: 'ass', rotulo: 'y=x' }, { chave: 'dif', rotulo: 'f(x)-x' },
    ],
    ler: (x) => ({ x: numTex(x), fx: numTex(F5(x)), ass: numTex(x), dif: numTex(difF(x)) }),
    estado: (x) => String.raw`Em $x=${numTex(x)}$: $f(x)-x=e^{-x}\approx${numTex(difF(x))}$. `
      + (x > 2 ? 'A diferença para a reta já é minúscula.' : x < 0 ? 'À esquerda a curva afasta-se da reta.' : 'A curva está a aproximar-se da reta.'),
    sentidos: [
      {
        id: 'mais', chip: String.raw`x\to+\infty`, falado: 'x tende para mais infinito',
        formulas: [
          String.raw`\begin{aligned}m&=\lim_{x\to+\infty}\dfrac{f(x)}{x}\\&=\lim_{x\to+\infty}\left(1+\dfrac{e^{-x}}{x}\right)=1\end{aligned}`,
          String.raw`\begin{aligned}b&=\lim_{x\to+\infty}\bigl(f(x)-1\cdot x\bigr)\\&=\lim_{x\to+\infty}e^{-x}=0\end{aligned}`,
        ],
        cabs: ['x', String.raw`\dfrac{f(x)}{x}`, 'f(x)-x'],
        xs: [1, 2, 5, 10, 20],
        cels: (x) => [xTex(x), decTex(razaoF(x), 6), numTex(difF(x))],
        nota: String.raw`A reta tracejada é $y=x$. O segmento roxo é a diferença $f(x)-x$ na posição do cursor: encolhe quando $x$ cresce.`,
        conclusao: String.raw`Quando $x\to+\infty$, $\dfrac{f(x)}{x}\to1$ e $f(x)-x=e^{-x}\to0$: o gráfico encosta-se à reta $y=x$, que é assíntota oblíqua.`,
        regra: String.raw`Assíntota oblíqua $y=mx+b$, com $m=\lim\dfrac{f(x)}{x}$ e $b=\lim\bigl(f(x)-mx\bigr)$. Aqui $m=1$ e $b=0$, logo $y=x$.`,
        gap: (x, y) => [x, x, x, y],
      },
      {
        id: 'menos', chip: String.raw`x\to-\infty`, falado: 'x tende para menos infinito',
        formulas: [
          String.raw`\begin{aligned}m&=\lim_{x\to-\infty}\dfrac{f(x)}{x}\\&=\lim_{x\to-\infty}\left(1+\dfrac{e^{-x}}{x}\right)=-\infty\end{aligned}`,
        ],
        cabs: ['x', 'f(x)', String.raw`\dfrac{f(x)}{x}`],
        xs: [-1, -5, -10, -20],
        cels: (x) => [xTex(x), numTex(F5(x)), numTex(razaoF(x))],
        nota: String.raw`Para $x$ negativo a curva sobe muito depressa e afasta-se da reta $y=x$.`,
        conclusao: String.raw`Quando $x\to-\infty$, $e^{-x}$ cresce muito mais depressa que $|x|$, por isso $\dfrac{f(x)}{x}\to-\infty$. Como $m$ não é um número real, não há assíntota oblíqua neste sentido (nem horizontal, porque $f(x)\to+\infty$).`,
        regra: String.raw`Se $m=\pm\infty$, não há assíntota nesse sentido. Cada sentido, $+\infty$ e $-\infty$, estuda-se à parte.`,
        gap: null,
      },
    ],
  },
  g: {
    chip: String.raw`g(x)=\ln x/x`, falado: 'g de x igual a logaritmo de x a dividir por x',
    cor: 'log', fn: G5, janela: { x: [-2.5, 12], y: [-3, 1] }, // com espaço à esquerda do eixo dos yy para o texto «y = 0»
    slider: { min: -2, max: 1.08, step: 0.02, x0: 2, log: true },
    cursor: { min: 0.01, max: 12, passo: 0.1 },
    camadas(g) {
      // os textos das retas ficam à esquerda do eixo dos yy, onde a curva não existe (à direita ela cola-se às duas retas)
      g.retaVertical(0);
      g.retaHorizontal(0);
      g.rotulo(0, 0.55, 'x = 0', { ancora: 'end', dx: -8, dy: 4, cor: 'assint' });
      g.rotulo(0, 0, 'y = 0', { ancora: 'end', dx: -8, dy: -6, cor: 'assint' });
      g.ponto(Math.E, 1 / Math.E);
      rotuloDe(g, Math.E, 1 / Math.E, ['máximo'], { curvas: [{ fn: G5 }], preferencia: ['cima', 'cimaDir', 'cimaEsq', 'dir', 'esq', 'baixoDir', 'baixoEsq', 'baixo'] });
    },
    aria: 'Gráfico de g de x igual a logaritmo de x sobre x, para x entre menos 1 e 12. Só existe para x positivo: desce sem limite junto da reta x igual a 0, tem o máximo 1 sobre e em x igual a e, e depois desce lentamente para a reta y igual a 0.',
    leituras: [
      { chave: 'x', rotulo: 'x' }, { chave: 'ln', rotulo: String.raw`\ln x`, classe: 'leitura--log' },
      { chave: 'gx', rotulo: 'g(x)' },
    ],
    ler: (x) => ({ x: numTex(x), ln: numTex(Math.log(x)), gx: numTex(G5(x)) }),
    estado: (x) => String.raw`Em $x=${numTex(x)}$: $g(x)\approx${numTex(G5(x))}$. `
      + (x < 1 ? 'Perto de $0$ o valor desce sem limite (o ponto sai pelo fundo do gráfico).' : x > Math.E ? 'À direita do máximo a curva desce para $0$.' : 'A curva ainda está a subir até ao máximo.'),
    sentidos: [
      {
        id: 'zero', chip: String.raw`x\to0^+`, falado: 'x tende para zero por valores positivos',
        formulas: [String.raw`\begin{aligned}\lim_{x\to0^+}\dfrac{\ln x}{x}&=\dfrac{-\infty}{0^+}\\&=-\infty\end{aligned}`],
        cabs: ['x', String.raw`\ln x`, String.raw`\dfrac{\ln x}{x}`],
        xs: [0.1, 0.01, 1e-3, 1e-6],
        cels: (x) => [xTex(x), numTex(Math.log(x)), numTex(G5(x))],
        nota: String.raw`O segmento roxo é a distância do ponto à reta $x=0$: encolhe, mas a curva desce cada vez mais.`,
        conclusao: String.raw`Quando $x\to0^+$, o numerador tende para $-\infty$ e o denominador para $0^+$, por isso $g(x)\to-\infty$ e a reta $x=0$ é assíntota vertical.`,
        regra: String.raw`A assíntota vertical procura-se na fronteira do domínio, com limites laterais. Como $D=\mathbb{R}^+$, só há o lado direito de $0$.`,
        gap: (x, y) => [0, y, x, y],
      },
      {
        id: 'mais', chip: String.raw`x\to+\infty`, falado: 'x tende para mais infinito',
        formulas: [
          String.raw`\begin{aligned}m&=\lim_{x\to+\infty}\dfrac{g(x)}{x}\\&=\lim_{x\to+\infty}\dfrac{\ln x}{x^2}=0\end{aligned}`,
          String.raw`\begin{aligned}b&=\lim_{x\to+\infty}\bigl(g(x)-0\cdot x\bigr)\\&=\lim_{x\to+\infty}\dfrac{\ln x}{x}=0\end{aligned}`,
        ],
        cabs: ['x', String.raw`\dfrac{g(x)}{x}`, 'g(x)'],
        xs: [10, 100, 1e3, 1e6, 1e12],
        cels: (x) => [xTex(x), numTex(G5(x) / x), numTex(G5(x))],
        nota: String.raw`O segmento roxo é a distância à reta $y=0$, que é o próprio valor de $g(x)$.`,
        conclusao: String.raw`Quando $x\to+\infty$, $\dfrac{\ln x}{x}\to0$ e $\dfrac{\ln x}{x^2}\to0$ (a potência vence o logaritmo): $m=0$ e $b=0$. Com $m=0$ a assíntota é horizontal: $y=0$.`,
        regra: String.raw`Se $m=0$ e $b$ é um número, a assíntota é horizontal, $y=b$, com $b=\lim g(x)$. Como $D=\mathbb{R}^+$, não há $x\to-\infty$.`,
        gap: (x, y) => [x, 0, x, y],
      },
    ],
  },
};

function fabricaAssintotas() {
  const id = `li${++contador}`;
  const est = { fn: 'f', sentido: 'mais', x: FUNCOES5.f.slider.x0 };
  const E = esqueleto('assintotas', String.raw`Que assíntotas tem a função? Procura $m$ e $b$ com números.`,
    String.raw`\begin{gathered}y=mx+b\\[0.5em]m=\lim\dfrac{f(x)}{x}\\[0.5em]b=\lim\bigl(f(x)-mx\bigr)\end{gathered}`);
  const vista = criarVista(E.grafico);
  const calculo = h('div', { class: 'li-calculo' });
  const sentRaiz = h('div', { class: 'li-sentidos' });
  let tabela = null;
  let L = null;
  let seg = null;
  let sentChips = null;

  function atual() { return FUNCOES5[est.fn]; }
  function sentidoAtual() { return atual().sentidos.find((s) => s.id === est.sentido); }
  function valorX(v) { return atual().slider.log ? Math.pow(10, v) : v; }
  function posX(x) { return atual().slider.log ? Math.log10(x) : x; }

  const fChips = chipsDe('Função', Object.entries(FUNCOES5).map(([k, v]) => ({ id: k, tex: v.chip, falado: v.falado })), (k) => {
    est.fn = k;
    est.sentido = FUNCOES5[k].sentidos[0].id;
    est.x = FUNCOES5[k].slider.x0;
    escolherFuncao();
  });
  E.extra.append(fChips.raiz, sentRaiz);

  const cx = controlo(`${id}-x`, 'Valor de x', {
    min: -2.5, max: 6.5, step: 0.1, valor: posX(est.x),
    texto: (v) => `x = ${numTxt(valorX(v))}`,
    falado: (v) => `x igual a ${numFalado(valorX(v))}`,
    aoMudar: (v) => { est.x = valorX(v); vista.mover(est.x); leitura(); },
  });
  E.cx.append(cx.caixa);

  function leitura() {
    const F = atual();
    const dados = F.ler(est.x);
    for (const [k, v] of Object.entries(dados)) L.definir(k, v);
    comT(E.estado, F.estado(est.x));
    if (seg) { seg.remover(); seg = null; }
    const gap = sentidoAtual().gap;
    const y = F.fn(est.x);
    if (gap && vista.g && Number.isFinite(y)) {
      const [a, b, c, d] = gap(est.x, y);
      seg = vista.g.segmento(a, b, c, d, { cor: 'der', espessura: 2.6 });
    }
  }

  function escolherFuncao() {
    const F = atual();
    fChips.marcar(est.fn);
    L = criarLeituras(F.leituras);
    E.leituras.replaceChildren(L.raiz);
    sentChips = chipsDe('Sentido do limite', F.sentidos.map((s) => ({ id: s.id, tex: s.chip, falado: s.falado })), (s) => {
      est.sentido = s;
      escolherSentido();
    });
    sentRaiz.replaceChildren(sentChips.raiz);
    cx.input.min = String(F.slider.min);
    cx.input.max = String(F.slider.max);
    cx.input.step = String(F.slider.step);
    cx.caixa.querySelector('label').textContent = F.slider.log ? 'Valor de x (escala logarítmica)' : 'Valor de x';
    cx.definir(posX(est.x));
    seg = null;
    vista.desenhar({
      x: F.janela.x, y: F.janela.y, rotuloY: 'y', aria: F.aria,
      camadas(g) {
        g.curva(F.fn, { cor: F.cor });
        F.camadas(g);
      },
      cursor: {
        fn: F.fn, x0: est.x, min: F.cursor.min, max: F.cursor.max, passo: F.cursor.passo,
        aoMover: (x) => { est.x = x; cx.definir(posX(x)); leitura(); },
        textoAria: (x, y) => `x igual a ${numFalado(x)}; a função vale ${numFalado(y)}`,
      },
    });
    escolherSentido();
  }

  function escolherSentido() {
    const S = sentidoAtual();
    sentChips.marcar(est.sentido);
    tabela = criarTabela(S.cabs);
    E.tabela.replaceChildren(calculo, tabela.caixa);
    tabela.preencher(S.xs.map((x) => ({ cels: S.cels(x) })),
      `Valores para a procura de assíntotas da função ${est.fn}, com x ${S.falado}.`);
    calculo.replaceChildren(...S.formulas.map((f) => {
      const d = h('div', { class: 'li-formula li-formula--calculo' });
      d.innerHTML = tex(f, true);
      return d;
    }));
    comT(E.nota, S.nota);
    caixaConclusao(E.conclusao, 'Conclusão', S.conclusao);
    caixaConclusao(E.regra, 'Regra dos cartões', S.regra);
    leitura();
  }

  escolherFuncao();
  return { raiz: E.raiz };
}

// ======================================================================
// O widget
// ======================================================================

const ABAS = [
  { id: 'exp', tex: 'e^x/x^p', falado: 'e elevado a x sobre x elevado a p, com x a tender para mais infinito', fabrica: fabricaExp },
  { id: 'ln', tex: String.raw`\ln x/x^p`, falado: 'logaritmo de x sobre x elevado a p, com x a tender para mais infinito', fabrica: fabricaLn },
  { id: 'xlnx', tex: String.raw`x\ln x`, falado: 'x vezes logaritmo de x, com x a tender para zero', fabrica: fabricaXlnx },
  { id: 'notaveis', txt: 'Limites em 0', falado: 'Os dois limites notáveis em zero, que dão 1', fabrica: fabricaNotaveis },
  { id: 'assintotas', txt: 'Assíntotas', falado: 'Assíntotas de uma função', fabrica: fabricaAssintotas },
];

export async function montar(el) {
  let atual = null;
  const prontas = {};
  const paineis = h('div', { class: 'li-paineis' });
  const chips = chipsDe('Escolhe o limite', ABAS, (id) => mostrar(id), 'li-abas');

  function mostrar(id) {
    const def = ABAS.find((a) => a.id === id);
    if (!def) throw new Error(`limites: aba desconhecida (${id})`);
    if (!prontas[id]) {
      prontas[id] = def.fabrica();
      paineis.append(prontas[id].raiz);
    }
    for (const a of ABAS) if (prontas[a.id]) prontas[a.id].raiz.hidden = a.id !== id;
    chips.marcar(id);
    atual = id;
  }

  el.replaceChildren(h('div', { class: 'widget li' },
    h('p', { class: 'widget__titulo' }, 'Quem ganha quando x cresce?'),
    chips.raiz, paineis));
  mostrar('exp');
  return { aba: mostrar, abaAtual: () => atual };
}
