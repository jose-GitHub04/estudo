// tabela: tabela de distribuição «viva» (barras que se arrastam, soma em direto, valor
// médio, variância e desvio-padrão passo a passo) e o modo «Descobre o k».
// As probabilidades guardam-se em centésimas inteiras (0 a 100), por isso todas as
// contas com frações de probabilidade.js são exatas.

import * as M from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/probabilidade.js';
import { criar, arrastar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

// ---------- constantes do desenho ----------
const VB_W = 400;
const VB_H = 262;
const XS = [0, 1, 2, 3];
const INICIAL = [10, 40, 30, 20]; // em centésimas
const X0 = 80; // posição do valor x = 0
const PASSO_X = 88; // distância entre valores consecutivos
const BASE_Y = 190;
const ALTURA = 160; // altura de p = 1
const MEIA_LARGURA = 26;

const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const posX = (x) => X0 + x * PASSO_X;

/** Decimal sem zeros finais, com vírgula: 0,85 · 0,1 · 1 · 0. */
function dec(v, casas = 6) {
  const s = (Math.abs(v) < 0.5 * Math.pow(10, -casas) ? 0 : v).toFixed(casas);
  const t = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  const r = t.replace('.', ',');
  return r.startsWith('-') ? '−' + r.slice(1) : r;
}
const decTex = (v, casas = 6) => dec(v, casas).replace(',', '{,}').replace('−', '-');
const frac100 = (c) => P.F(c, 100);

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
const comTex = (el, latex) => { el.innerHTML = tex(latex); return el; };
// frações em tamanho normal (\dfrac), para as células e as opções do exercício
const comTexG = (el, latex) => comTex(el, latex.replace(/\\frac/g, '\\dfrac'));

// ======================================================================
// Gerador do exercício «Descobre o k»
// ======================================================================

const CONJUNTOS_X = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [1, 3, 5], [0, 2, 4], [-1, 0, 1], [1, 2, 4]];
const DEN_K = [4, 5, 6, 8, 9, 10, 12, 15];
const DEN_C = [5, 7, 8, 9, 10, 12, 15, 20];
const NUM_K = [1, 1, 1, 2, 3];

const div = (a, b) => P.F(a.n * b.d, a.d * b.n);
const ehFr = (f, n, d) => f.n === n && f.d === d;

/** Evita os exemplos do manual: k/2, k/3, 1/6, 1/4, a e 2a. */
function coefProibido(c) {
  return ehFr(c, 1, 2) || ehFr(c, 1, 3) || ehFr(c, 1, 1) || ehFr(c, 2, 1);
}
const constProibida = (c) => ehFr(c, 1, 6) || ehFr(c, 1, 4);

/** p = coef · k + const, em LaTeX: \frac{k}{5}, \frac{2k}{9}, \frac{3}{10}. */
function pTexDe(coef, cons) {
  if (coef.n === 0) return P.fracTexF(cons);
  if (coef.d === 1) return `${coef.n === 1 ? '' : coef.n}k`;
  return `\\frac{${coef.n === 1 ? '' : coef.n}k}{${coef.d}}`;
}

/** Verifica com frações exatas: p_i = coef_i·k + const_i dá soma 1 e cada p_i está em [0, 1]. */
function verificarExercicioK(ex) {
  const ps = ex.linhas.map((l) => P.soma(P.mult(l.coefK, ex.k), l.const));
  if (!P.igual(P.somaP(ps.map((p) => ({ p }))), P.UM)) throw new Error('exercício k: a soma não dá 1');
  for (const p of ps) {
    if (p.n < 0 || p.n > p.d) throw new Error('exercício k: probabilidade fora de [0, 1]');
  }
  return ps;
}

function tentarK(rng) {
  const xs = M.escolher(rng, CONJUNTOS_X);
  const tresK = rng() < 0.3;
  const coefs = [];
  let cons = P.ZERO;
  if (tresK) {
    for (let i = 0; i < 3; i++) coefs.push(P.F(M.escolher(rng, NUM_K), M.escolher(rng, DEN_K)));
  } else {
    for (let i = 0; i < 2; i++) coefs.push(P.F(M.escolher(rng, NUM_K), M.escolher(rng, DEN_K)));
    const b = M.escolher(rng, DEN_C);
    cons = P.F(M.inteiro(rng, 1, b - 1), b);
    if (P.valor(cons) > 0.6 || P.valor(cons) < 0.1) return null;
  }
  if (coefs.some(coefProibido) || constProibida(cons)) return null;
  const soCoef = coefs.reduce((s, c) => P.soma(s, c), P.ZERO);
  const k = div(P.sub(P.UM, cons), soCoef);
  if (k.n <= 0 || k.d > 40 || k.n > 80) return null;
  const termos = M.baralhar(rng, tresK
    ? coefs.map((c) => ({ coefK: c, const: P.ZERO }))
    : [{ coefK: coefs[0], const: P.ZERO }, { coefK: coefs[1], const: P.ZERO }, { coefK: P.ZERO, const: cons }]);
  const linhas = termos.map((t, i) => ({
    x: xs[i], pTex: pTexDe(t.coefK, t.const), coefK: t.coefK, const: t.const,
  }));
  const ex = { linhas, k };
  try { verificarExercicioK(ex); } catch { return null; }
  return ex;
}

/**
 * Exercício «Descobre o k»: tabela com 3 valores cujas probabilidades são da forma
 * k/a, c/b ou semelhantes. Devolve { linhas: [{ x, pTex, coefK, const }], k } com
 * p_i = coefK·k + const (frações {n, d}) e confirma com frações exatas que a soma dá 1
 * e que cada p_i está em [0, 1]. Com a mesma semente dá sempre o mesmo exercício.
 */
export function gerarExercicioK(rng) {
  for (let i = 0; i < 5000; i++) {
    const ex = tentarK(rng);
    if (ex) return ex;
  }
  // reserva (nunca deve ser precisa): k/5, 3/10 e k/8
  const ex = {
    linhas: [
      { x: 1, pTex: pTexDe(P.F(1, 5), P.ZERO), coefK: P.F(1, 5), const: P.ZERO },
      { x: 2, pTex: pTexDe(P.ZERO, P.F(3, 10)), coefK: P.ZERO, const: P.F(3, 10) },
      { x: 3, pTex: pTexDe(P.F(1, 8), P.ZERO), coefK: P.F(1, 8), const: P.ZERO },
    ],
    k: P.F(28, 13),
  };
  verificarExercicioK(ex);
  return ex;
}

/** Valores das probabilidades já com k: [{x, p}]. */
export const tabelaDoExercicio = (ex) =>
  ex.linhas.map((l) => ({ x: l.x, p: P.soma(P.mult(l.coefK, ex.k), l.const) }));

// ======================================================================
// Widget
// ======================================================================

let contador = 0;

export async function montar(el) {
  const id = `tab${++contador}`;
  let c = INICIAL.slice(); // probabilidades em centésimas
  let modo = 'mexer';

  // ---------------- separadores ----------------
  const chipMexer = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true' }, 'Mexer na tabela');
  const chipK = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, 'Descobre o k');
  const chips = h('div', { class: 'chips tab-chips', role: 'group', 'aria-label': 'Modo' }, chipMexer, chipK);

  // ---------------- painel A: mexer na tabela ----------------
  const barras = [];
  const grelha = [];
  for (const v of [0, 0.5, 1]) {
    const y = BASE_Y - v * ALTURA;
    grelha.push(criar('line', { class: 'tab-grelha', x1: 40, x2: 380, y1: y, y2: y }));
    grelha.push(criar('text', { class: 'tab-eixo-y', x: 34, y: y + 4, 'text-anchor': 'end' }, [M.fmt(v, v === 0.5 ? 1 : 0)]));
  }
  const eixoX = criar('line', { class: 'tab-eixo', x1: 40, x2: 380, y1: BASE_Y, y2: BASE_Y });
  const marcas = XS.map((x) => criar('text', {
    class: 'tab-marca', x: posX(x), y: BASE_Y + 20, 'text-anchor': 'middle',
  }, [`x = ${x}`]));
  const linhaMu = criar('line', { class: 'tab-mu-linha', y1: 40, y2: BASE_Y + 30 });
  const trianguloMu = criar('path', { class: 'tab-mu-tri' });
  const textoMu = criar('text', { class: 'tab-mu-texto', y: BASE_Y + 70, 'text-anchor': 'middle' });
  const grupoMu = criar('g', { class: 'tab-mu' }, [linhaMu, trianguloMu, textoMu]);

  const grupoBarras = criar('g');
  XS.forEach((x, i) => {
    const rect = criar('rect', { class: 'tab-barra', x: posX(x) - MEIA_LARGURA, width: 2 * MEIA_LARGURA, rx: 3 });
    const valor = criar('text', { class: 'tab-valor', x: posX(x), 'text-anchor': 'middle' });
    const anel = criar('circle', { class: 'tab-anel', cx: posX(x), r: 14 });
    const bola = criar('circle', { class: 'tab-bola', cx: posX(x), r: 7 });
    const pega = criar('g', {
      class: 'tab-pega', tabindex: 0, role: 'slider',
      'aria-valuemin': 0, 'aria-valuemax': 1, 'aria-orientation': 'vertical',
    }, [anel, bola]);
    pega.addEventListener('keydown', (e) => {
      const passos = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
      if (e.key in passos) {
        definir(i, c[i] + passos[e.key]);
      } else if (e.key === 'Home') {
        definir(i, 0);
      } else if (e.key === 'End') {
        definir(i, 100);
      } else return;
      e.preventDefault();
    });
    barras.push({ rect, valor, pega, anel, bola });
    grupoBarras.append(rect, valor, pega);
  });

  const svg = criar('svg', {
    class: 'figura tab-fig', viewBox: `0 0 ${VB_W} ${VB_H}`, role: 'img',
  }, [...grelha, grupoBarras, eixoX, ...marcas, grupoMu]);
  // o grupo de barras fica por cima da grelha; o eixo e as marcas por cima das barras
  let barraAtiva = 0;
  arrastar(svg, (p, e) => {
    if (e.type === 'pointerdown') {
      barraAtiva = limitar(Math.round((p.x - X0) / PASSO_X), 0, XS.length - 1);
      barras[barraAtiva].pega.focus({ preventScroll: true });
    }
    definir(barraAtiva, ((BASE_Y - p.y) / ALTURA) * 100);
  });

  // campos de texto
  const campos = XS.map((x, i) => {
    const input = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'campo tab-campo',
      id: `${id}-p${i}`, 'aria-describedby': `${id}-msg`,
    });
    input.addEventListener('input', () => {
      const t = input.value.trim().replace(',', '.');
      if (!/^(\d+\.?\d*|\.\d+)$/.test(t) || Number(t) > 1) {
        input.setAttribute('aria-invalid', 'true');
        mensagem.textContent = 'Escreve um número entre 0 e 1, por exemplo 0,25.';
        return;
      }
      input.removeAttribute('aria-invalid');
      mensagem.textContent = '';
      definir(i, Math.round(Number(t) * 100), input);
    });
    input.addEventListener('change', () => {
      input.removeAttribute('aria-invalid');
      mensagem.textContent = '';
      input.value = dec(c[i] / 100, 2);
    });
    const rot = h('label', { for: `${id}-p${i}`, class: 'tab-campo__rotulo' });
    comTex(rot, `P(X=${x})`);
    rot.setAttribute('aria-label', `Probabilidade de X igual a ${x}`);
    return { input, caixa: h('div', { class: 'tab-campo__caixa' }, rot, input) };
  });
  const linhaCampos = h('div', { class: 'tab-campos' }, ...campos.map((k) => k.caixa));
  const mensagem = h('p', { class: 'tab-msg', id: `${id}-msg`, 'aria-live': 'polite' });

  const soma = h('p', { class: 'tab-soma', 'aria-live': 'polite' });
  const avisoSoma = h('p', { class: 'tab-aviso', 'aria-live': 'polite' });
  const btnNorm = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Normalizar');
  const btnRepor = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Repor');
  btnNorm.addEventListener('click', normalizar);
  btnRepor.addEventListener('click', () => { c = INICIAL.slice(); render(); });
  const acoes = h('div', { class: 'tab-acoes' }, btnNorm, btnRepor);

  const notaCentesimas = h('p', { class: 'nota' },
    'Arrasta uma barra, escreve o valor ou usa as setas (±0,01). As probabilidades têm até duas casas decimais. «Normalizar» reescala-as para somarem 1.');

  const calcMedia = h('div', { class: 'tab-calculo tab-calculo--media', 'aria-live': 'polite' });
  const calcVar = h('div', { class: 'tab-calculo tab-calculo--var', 'aria-live': 'polite' });

  const painelMexer = h('div', { class: 'tab-painel' },
    h('div', { class: 'tab-topo' },
      h('div', { class: 'tab-coluna' }, svg),
      h('div', { class: 'tab-lado' }, linhaCampos, mensagem, soma, avisoSoma, acoes, notaCentesimas)),
    h('div', { class: 'tab-contas' }, calcMedia, calcVar));

  // ---------------- painel B: descobre o k ----------------
  const painelK = h('div', { class: 'tab-painel tab-k', hidden: true });

  const cartao = h('div', { class: 'widget tab' },
    h('p', { class: 'widget__titulo' }, 'Tabela de distribuição'),
    chips, painelMexer, painelK);
  el.replaceChildren(cartao);

  function mudarModo(novo) {
    modo = novo;
    chipMexer.setAttribute('aria-pressed', String(modo === 'mexer'));
    chipK.setAttribute('aria-pressed', String(modo === 'k'));
    painelMexer.hidden = modo !== 'mexer';
    painelK.hidden = modo !== 'k';
    if (modo === 'k' && !painelK.dataset.pronto) { painelK.dataset.pronto = 'sim'; novoExercicio(); }
  }
  chipMexer.addEventListener('click', () => mudarModo('mexer'));
  chipK.addEventListener('click', () => mudarModo('k'));

  // ---------------- lógica do painel A ----------------
  const somaC = () => c.reduce((s, v) => s + v, 0);

  function definir(i, valor, deixarCampo = null) {
    c[i] = limitar(Math.round(valor), 0, 100);
    render(deixarCampo);
  }

  function normalizar() {
    const total = somaC();
    if (total === 0) return;
    const novo = c.map((v) => Math.round((v * 100) / total));
    let resto = 100 - novo.reduce((s, v) => s + v, 0);
    // o que sobra ou falta por causa do arredondamento vai para a maior probabilidade
    const maior = novo.indexOf(Math.max(...novo));
    novo[maior] += resto;
    resto = 0;
    c = novo;
    render();
  }

  function linhaCalculo(latex, classe = '') {
    return comTex(h('div', { class: `tab-linha ${classe}` }), latex);
  }

  function render(campoAtivo = null) {
    const tabela = XS.map((x, i) => ({ x, p: frac100(c[i]) }));
    const s = P.somaP(tabela);
    const certa = P.igual(s, P.UM);
    const total = somaC();

    // barras
    barras.forEach((b, i) => {
      const y = BASE_Y - (c[i] / 100) * ALTURA;
      b.rect.setAttribute('y', y);
      b.rect.setAttribute('height', BASE_Y - y);
      b.valor.setAttribute('y', Math.max(14, y - 11));
      b.valor.textContent = dec(c[i] / 100, 2);
      b.anel.setAttribute('cy', y);
      b.bola.setAttribute('cy', y);
      const txt = dec(c[i] / 100, 2);
      b.pega.setAttribute('aria-valuenow', c[i] / 100);
      b.pega.setAttribute('aria-valuetext', txt);
      b.pega.setAttribute('aria-label', `Probabilidade de X igual a ${XS[i]}`);
    });
    campos.forEach((k, i) => {
      if (k.input !== campoAtivo) k.input.value = dec(c[i] / 100, 2);
    });

    // soma
    const sv = total / 100;
    const diff = Math.abs(100 - total) / 100;
    soma.className = `tab-soma ${certa ? 'tab-soma--ok' : 'tab-soma--mal'}`;
    soma.textContent = certa
      ? 'soma = 1, está certo'
      : `soma = ${dec(sv, 2)}, ${total < 100 ? 'falta' : 'passa'} ${dec(diff, 2)}`;
    avisoSoma.textContent = certa ? '' : 'Para ser uma tabela de distribuição a soma tem de dar 1.';
    avisoSoma.className = `tab-aviso${certa ? '' : ' tab-aviso--ativo'}`;
    btnNorm.disabled = total === 0 || certa;

    // valor médio
    let mu = null;
    if (!certa) {
      calcMedia.replaceChildren(
        h('p', { class: 'tab-calculo__titulo' }, 'Valor médio'),
        h('p', { class: 'tab-espera' }, 'Primeiro faz a soma dar 1.'));
      calcVar.replaceChildren(
        h('p', { class: 'tab-calculo__titulo' }, 'Variância e desvio-padrão'),
        h('p', { class: 'tab-espera' }, 'Primeiro faz a soma dar 1.'));
      grupoMu.setAttribute('visibility', 'hidden');
    } else {
      const muF = P.media(tabela);
      mu = P.valor(muF);
      const parcelas = tabela.map((l) => P.mult(l.p, P.F(l.x)));
      const pv = (f) => decTex(P.valor(f));
      calcMedia.replaceChildren(
        h('p', { class: 'tab-calculo__titulo' }, 'Valor médio'),
        linhaCalculo(`\\mu=\\sum x_i\\,p_i=${tabela.map((l) => `${l.x}\\times${pv(l.p)}`).join('+')}`),
        linhaCalculo(`\\mu=${parcelas.map(pv).join('+')}`),
        linhaCalculo(`\\mu=${pv(muF)}`, 'tab-linha--final'));

      const dif = tabela.map((l) => P.sub(P.F(l.x), muF));
      const quad = dif.map((d) => P.mult(d, d));
      const termos = tabela.map((l, i) => P.mult(l.p, quad[i]));
      const varF = P.variancia(tabela);
      const sigma = P.desvioPadrao(tabela);
      const exato = Math.abs(sigma - Math.round(sigma * 100) / 100) < 1e-12;
      const parc = tabela.map((l, i) => linhaCalculo(
        `p_${i + 1}(x_${i + 1}-\\mu)^2=${pv(l.p)}\\times(${l.x}-${pv(muF)})^2=${pv(l.p)}\\times${pv(quad[i])}=${pv(termos[i])}`,
        'tab-linha--parcela'));
      calcVar.replaceChildren(
        h('p', { class: 'tab-calculo__titulo' }, 'Variância e desvio-padrão'),
        ...parc,
        linhaCalculo(`\\sigma^2=${termos.map(pv).join('+')}=${pv(varF)}`),
        linhaCalculo(`\\sigma=\\sqrt{${pv(varF)}}${exato ? '=' : '\\approx'}${decTex(sigma, 2)}`, 'tab-linha--final'));

      const xm = X0 + mu * PASSO_X;
      grupoMu.setAttribute('visibility', 'visible');
      linhaMu.setAttribute('x1', xm);
      linhaMu.setAttribute('x2', xm);
      trianguloMu.setAttribute('d', `M${xm} ${BASE_Y + 32}L${xm - 9} ${BASE_Y + 50}L${xm + 9} ${BASE_Y + 50}Z`);
      textoMu.setAttribute('x', limitar(xm, 40, 360));
      textoMu.textContent = `μ = ${dec(mu, 4)}`;
    }

    svg.setAttribute('aria-label',
      `Gráfico de barras da tabela de distribuição. ${XS.map((x, i) => `P(X = ${x}) = ${dec(c[i] / 100, 2)}`).join('; ')}. `
      + (certa ? `A soma é 1 e o valor médio é ${dec(mu, 4)}.` : `A soma é ${dec(sv, 2)}, não dá 1.`));
  }

  // ---------------- lógica do painel B: descobre o k ----------------
  let exercicio = null;
  let numero = 0;

  function novoExercicio() {
    numero += 1;
    exercicio = gerarExercicioK(M.criarRng((Date.now() + numero * 7919) >>> 0));
    desenharExercicio(exercicio);
  }

  function opcoesDe(ex) {
    const ps = ex.linhas.map((l) => l.pTex);
    const n = ex.linhas.length;
    const certa = {
      certa: true, tex: `${ps.join('+')}=1`,
      explica: 'Certo. As probabilidades de todos os valores de X somam sempre 1: é a regra que usamos para descobrir k.',
    };
    const erradas = [
      {
        tex: `P(X=x_1)=P(X=x_2)=P(X=x_3)=1`,
        explica: 'Não. Cada probabilidade está entre 0 e 1 e, se uma valesse 1, as outras seriam 0. O que tem de dar 1 é a soma delas.',
      },
      {
        tex: `${ps.join('+')}=${n}`,
        explica: `Não. A soma não depende do número de valores: dá sempre 1, tenha a tabela ${n} valores ou 30.`,
      },
      {
        tex: `${ps.join('\\times')}=1`,
        explica: 'Não. É a soma que dá 1, e não o produto. Multiplicar probabilidades de valores diferentes não tem este significado.',
      },
    ];
    const dois = M.baralhar(M.criarRng(ex.k.n * 31 + ex.k.d), erradas).slice(0, 2);
    return M.baralhar(M.criarRng(ex.k.n * 17 + ex.k.d * 5 + 3), [certa, ...dois]);
  }

  function resolucao(ex) {
    const coefs = ex.linhas.filter((l) => l.coefK.n !== 0).map((l) => l.coefK);
    const cons = ex.linhas.reduce((s, l) => P.soma(s, l.const), P.ZERO);
    const somaCoef = coefs.reduce((s, f) => P.soma(s, f), P.ZERO);
    const direita = P.sub(P.UM, cons);
    const kTex = (f) => (P.igual(f, P.UM) ? 'k' : `${P.fracTexF(f)}k`);
    const temConst = cons.n !== 0;
    const linhas = [
      h('p', {}, 'Os valores de X têm de ter probabilidades que somam 1:'),
      linhaCalculo(`${ex.linhas.map((l) => l.pTex).join('+')}=1`),
      h('p', {}, temConst ? 'Junta os termos com k e passa o outro termo para o segundo membro:' : 'Junta os termos com k:'),
      linhaCalculo(`\\left(${coefs.map(P.fracTexF).join('+')}\\right)k=${temConst ? `1-${P.fracTexF(cons)}` : '1'}`),
      linhaCalculo(`${kTex(somaCoef)}=${P.fracTexF(direita)}`),
      h('p', {}, 'Divide os dois membros pelo número que está a multiplicar k:'),
      linhaCalculo(P.igual(somaCoef, P.UM)
        ? `k=${P.fracTexF(ex.k)}`
        : `k=${P.fracTexF(direita)}\\div${P.fracTexF(somaCoef)}=${P.fracTexF(ex.k)}`, 'tab-linha--final'),
    ];
    const ps = tabelaDoExercicio(ex);
    linhas.push(
      h('p', {}, `Confirmação: com k = ${ex.k.d === 1 ? ex.k.n : `${ex.k.n}/${ex.k.d}`} as probabilidades ficam todas entre 0 e 1 e somam 1:`),
      linhaCalculo(`${ps.map((l) => P.fracTexF(l.p)).join('+')}=1`));
    return h('div', { class: 'tab-resolucao' }, ...linhas);
  }

  function desenharExercicio(ex) {
    const idEx = `${id}-ex${numero}`;
    // tabela do enunciado
    const cab = h('tr', {}, h('th', { scope: 'row' }, ''));
    const lin = h('tr', {}, h('th', { scope: 'row' }, ''));
    comTex(cab.firstChild, 'x_i');
    comTex(lin.firstChild, 'P(X=x_i)');
    for (const l of ex.linhas) {
      const a = h('td'); a.textContent = l.x < 0 ? `−${-l.x}` : String(l.x);
      const b = h('td'); comTexG(b, l.pTex);
      cab.append(a);
      lin.append(b);
    }
    const tabela = h('table', { class: 'tabela tab-enunciado' },
      h('caption', { class: 'sr-only' }, 'Tabela de distribuição da variável aleatória X, com um valor desconhecido k.'),
      h('tbody', {}, cab, lin));

    // passo (a): escolher a equação
    const passoA = h('div', { class: 'tab-passo' });
    const feedbackA = h('div', { class: 'tab-feedback', 'aria-live': 'polite' });
    const passoB = h('div', { class: 'tab-passo tab-passo--b', hidden: true });
    const lista = h('div', { class: 'tab-opcoes', role: 'group', 'aria-labelledby': `${idEx}-a` });
    const opcoes = opcoesDe(ex);
    const botoes = opcoes.map((o, i) => {
      const b = h('button', { type: 'button', class: 'tab-opcao', 'data-certa': o.certa ? 'sim' : 'nao' });
      b.append(h('span', { class: 'tab-opcao__letra', 'aria-hidden': 'true' }, 'ABC'[i]));
      const t = h('span', { class: 'tab-opcao__tex' });
      comTexG(t, o.tex);
      b.append(t);
      b.addEventListener('click', () => {
        for (const outro of botoes) {
          outro.disabled = true;
          if (outro.dataset.certa === 'sim') outro.classList.add('tab-opcao--certa');
        }
        if (!o.certa) b.classList.add('tab-opcao--errada');
        feedbackA.replaceChildren(h('p', { class: o.certa ? 'aviso-ok' : 'aviso-erro' }, o.explica));
        if (!o.certa) {
          feedbackA.append(h('p', { class: 'nota' }, 'A equação certa é a primeira regra da tabela: a soma das probabilidades é 1.'));
        }
        passoB.hidden = false;
        campoK.focus({ preventScroll: true });
      });
      return b;
    });
    lista.append(...botoes);
    passoA.append(
      h('p', { class: 'tab-passo__titulo', id: `${idEx}-a` }, 'Passo 1: que equação te permite descobrir k?'),
      lista, feedbackA);

    // passo (b): escrever k
    const campoK = h('input', {
      type: 'text', inputmode: 'text', autocomplete: 'off', class: 'campo tab-campo-k', id: `${idEx}-k`,
      placeholder: 'por exemplo 3/8 ou 0,5',
    });
    const btnVer = h('button', { type: 'submit', class: 'botao' }, 'Verificar');
    const feedbackB = h('div', { class: 'tab-feedback', 'aria-live': 'polite' });
    const formK = h('form', { class: 'tab-form-k', novalidate: true },
      h('label', { for: `${idEx}-k`, class: 'tab-form-k__rotulo' }, 'k ='), campoK, btnVer);
    let resolvido = false;
    formK.addEventListener('submit', (e) => {
      e.preventDefault();
      if (resolvido) return;
      const texto = campoK.value.trim();
      if (!texto) {
        feedbackB.replaceChildren(h('p', { class: 'aviso-erro' }, 'Escreve o valor de k.'));
        return;
      }
      const r = M.corrigir(texto, { expr: `${ex.k.n}/${ex.k.d}` });
      const alvo = P.valor(ex.k);
      const exatoDec = r.valor !== undefined && Math.abs(r.valor - alvo) < 1e-9;
      const kTexto = ex.k.d === 1 ? String(ex.k.n) : `${ex.k.n}/${ex.k.d}`;
      if (r.estado === 'certo' || r.estado === 'certo-forma' || exatoDec) {
        resolvido = true;
        campoK.setAttribute('aria-invalid', 'false');
        feedbackB.replaceChildren(
          h('p', { class: 'aviso-ok' }, `Certo, k = ${kTexto}. Esta é a resolução:`),
          resolucao(ex));
      } else if (r.estado === 'invalido') {
        campoK.setAttribute('aria-invalid', 'true');
        feedbackB.replaceChildren(h('p', { class: 'aviso-erro' },
          'Não consegui ler essa resposta. Escreve uma fração (3/8) ou um decimal (0,375).'));
      } else if (r.estado === 'decimal') {
        feedbackB.replaceChildren(h('p', { class: 'aviso-erro' },
          'Estás perto, mas esse decimal é só uma aproximação. Escreve k em fração.'));
      } else {
        campoK.setAttribute('aria-invalid', 'true');
        const ver = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Ver a resolução');
        ver.addEventListener('click', () => {
          resolvido = true;
          feedbackB.replaceChildren(h('p', { class: 'aviso-erro' }, `Não é esse valor. A resposta é k = ${kTexto}. Esta é a resolução:`), resolucao(ex));
        });
        feedbackB.replaceChildren(
          h('p', { class: 'aviso-erro' }, 'Ainda não. Confere as contas e tenta outra vez.'),
          ver);
      }
    });
    campoK.addEventListener('input', () => campoK.removeAttribute('aria-invalid'));
    passoB.append(
      h('p', { class: 'tab-passo__titulo' }, 'Passo 2: calcula k. Aceito fração ou decimal.'),
      formK, feedbackB);

    const outro = h('button', { type: 'button', class: 'botao botao--suave botao--mini tab-outro' }, 'Outro exercício');
    outro.addEventListener('click', () => novoExercicio());

    painelK.replaceChildren(
      h('p', { class: 'tab-enunciado__texto' },
        'A tabela mostra a distribuição de probabilidades de uma variável aleatória X, que depende de um número k. Descobre k.'),
      h('div', { class: 'tabela-rolante' }, tabela),
      passoA, passoB, h('div', { class: 'tab-acoes' }, outro));
  }

  render();
}
