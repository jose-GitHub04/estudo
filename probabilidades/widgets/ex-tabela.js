// ex-tabela: exercícios 1 (valor de k e valor médio) e 2 (sistema com a e b) da página
// de exercícios de Probabilidades. Cada um é um cartão com enunciado e tabela, uma
// figura interativa (sliders), a resolução passo a passo e um campo opcional de resposta.
// As contas usam frações exatas de probabilidade.js; os sliders trabalham em inteiros.

import * as M from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/probabilidade.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

// ---------- pequenas ajudas ----------

/** Decimal sem zeros finais, com vírgula e menos «−»: 0,35 · 1 · −0,5. */
function dec(v, casas = 3) {
  const s = (Math.abs(v) < 0.5 * Math.pow(10, -casas) ? 0 : v).toFixed(casas);
  const t = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  const r = t.replace('.', ',');
  return r.startsWith('-') ? '−' + r.slice(1) : r;
}
const decTex = (v, casas = 3) => dec(v, casas).replace(',', '{,}').replace('−', '-');
const fv = (f) => P.valor(f);
const div = (a, b) => P.F(a.n * b.d, a.d * b.n);
const grande = (latex) => latex.replace(/\\frac/g, '\\dfrac');

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
const comTex = (el, latex) => { el.innerHTML = tex(grande(latex)); return el; };
/** Texto com fórmulas entre $...$. */
function misto(el, s) {
  s.split('$').forEach((seg, i) => {
    if (i % 2) {
      const f = h('span');
      f.innerHTML = tex(seg);
      el.append(f);
    } else if (seg) el.append(seg);
  });
  return el;
}
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ======================================================================
// Contas exatas (exportadas para testar)
// ======================================================================

/** Exercício 1: P(X = x_i) = k/4, 1/6, k/3, 1/4. Devolve k, as probabilidades e μ. */
export function resolverK() {
  const coef = P.soma(P.F(1, 4), P.F(1, 3)); // 7/12
  const cons = P.soma(P.F(1, 6), P.F(1, 4)); // 5/12
  const direita = P.sub(P.UM, cons);
  const k = div(direita, coef);
  const xs = [-1, 0, 1, 2];
  const ps = [P.mult(k, P.F(1, 4)), P.F(1, 6), P.mult(k, P.F(1, 3)), P.F(1, 4)];
  const tabela = xs.map((x, i) => ({ x, p: ps[i] }));
  return { coef, cons, direita, k, xs, ps, tabela, soma: P.somaP(tabela), mu: P.media(tabela) };
}

/** Exercício 2: P = a, b, 1/4 em x = 1, 2, 3 e μ = 1,9. Resolve o sistema. */
export function resolverAB() {
  const mu = P.F(19, 10);
  const s = P.sub(P.UM, P.F(1, 4)); // a + b
  const t = P.sub(mu, P.F(3, 4)); // a + 2b
  const b = P.sub(t, s);
  const a = P.sub(s, b);
  const xs = [1, 2, 3];
  const ps = [a, b, P.F(1, 4)];
  const tabela = xs.map((x, i) => ({ x, p: ps[i] }));
  return { mu, s, t, a, b, xs, ps, tabela, soma: P.somaP(tabela), muCalc: P.media(tabela) };
}

// ======================================================================
// Figura: barras, valor médio opcional e barra da soma
// ======================================================================

const VW = 400;
const X_INI = 44;
const X_FIM = 384;
const BASE = 150;
const ALT = 120;

function criarFigura({ nomes, fixas, maxSoma, mu = null, alvo = null }) {
  const n = nomes.length;
  const passo = (X_FIM - X_INI) / n;
  const px = (i) => X_INI + (i + 0.5) * passo;
  const larg = Math.min(54, passo * 0.56);
  const yMu = BASE + 30;
  const ySoma = mu ? BASE + 98 : BASE + 48;
  const VH = ySoma + 52;

  const el = [];
  for (const v of [0, 0.5, 1]) {
    const y = BASE - v * ALT;
    el.push(criar('line', { class: 'exa-grelha', x1: X_INI - 4, x2: X_FIM, y1: y, y2: y }));
    el.push(criar('text', { class: 'exa-eixo-y', x: X_INI - 8, y: y + 4, 'text-anchor': 'end' }, [M.fmt(v, v === 0.5 ? 1 : 0)]));
  }
  el.push(criar('text', { class: 'exa-eixo-titulo', x: X_INI - 4, y: 14 }, ['probabilidade']));

  const barras = nomes.map((nome, i) => {
    const rect = criar('rect', { class: `exa-barra${fixas[i] ? ' exa-barra--fixa' : ''}`, x: px(i) - larg / 2, width: larg, rx: 3 });
    const valor = criar('text', { class: 'exa-valor', x: px(i), 'text-anchor': 'middle' });
    el.push(rect, valor);
    return { rect, valor };
  });
  el.push(criar('line', { class: 'exa-eixo', x1: X_INI - 4, x2: X_FIM, y1: BASE, y2: BASE }));
  nomes.forEach((nome, i) => {
    el.push(criar('text', { class: 'exa-marca', x: px(i), y: BASE + 18, 'text-anchor': 'middle' }, [nome]));
  });

  // valor médio no eixo dos x (só no exercício 2)
  let tri = null;
  let triTexto = null;
  let linhaAlvo = null;
  const xDeValor = (v) => limitar(px(0) + (v - mu.x0) * passo, X_INI, X_FIM);
  if (mu) {
    if (alvo !== null) {
      const xa = xDeValor(alvo);
      linhaAlvo = criar('line', { class: 'exa-alvo', x1: xa, x2: xa, y1: BASE - ALT - 6, y2: BASE + 4 });
      el.push(linhaAlvo, criar('text', { class: 'exa-alvo-texto', x: xa, y: BASE - ALT - 10, 'text-anchor': 'middle' }, [`μ = ${dec(alvo, 1)} é o objetivo`]));
    }
    tri = criar('path', { class: 'exa-mu-tri' });
    triTexto = criar('text', { class: 'exa-mu-texto', y: yMu + 34, 'text-anchor': 'middle' });
    el.push(tri, triTexto);
  }

  // barra da soma: segmentos empilhados, com marca em 1
  const esc = (X_FIM - X_INI) / maxSoma;
  el.push(criar('text', { class: 'exa-eixo-titulo', x: X_INI - 4, y: ySoma - 8 }, ['soma das probabilidades']));
  const segs = nomes.map((nome, i) => {
    const r = criar('rect', { class: `exa-seg ${fixas[i] ? 'exa-seg-fixa' : 'exa-seg-var'}`, y: ySoma, height: 18 });
    el.push(r);
    return r;
  });
  el.push(criar('rect', { class: 'exa-seg-moldura', x: X_INI, y: ySoma, width: X_FIM - X_INI, height: 18 }));
  const xUm = X_INI + esc;
  el.push(criar('line', { class: 'exa-um', x1: xUm, x2: xUm, y1: ySoma - 4, y2: ySoma + 24 }));
  el.push(criar('text', { class: 'exa-um-texto', x: xUm, y: ySoma + 38, 'text-anchor': 'middle' }, ['1']));

  const svg = criar('svg', { class: 'figura figura--fixa exa-fig', viewBox: `0 0 ${VW} ${VH}`, role: 'img' }, el);

  /** ps: números; muV: valor médio (ou null). */
  function atualizar(ps, muV, aria) {
    ps.forEach((p, i) => {
      const alt = limitar(p, 0, 1.04) * ALT;
      const y = BASE - alt;
      barras[i].rect.setAttribute('y', y);
      barras[i].rect.setAttribute('height', alt);
      barras[i].valor.setAttribute('y', Math.max(12, y - 6));
      barras[i].valor.textContent = dec(p, 3);
    });
    let acc = 0;
    ps.forEach((p, i) => {
      const w = Math.max(0, Math.min(p * esc, X_FIM - X_INI - acc * esc));
      segs[i].setAttribute('x', X_INI + acc * esc);
      segs[i].setAttribute('width', w);
      acc += p;
    });
    if (mu && muV !== null) {
      const xm = xDeValor(muV);
      tri.setAttribute('d', `M${xm} ${yMu}L${xm - 8} ${yMu + 16}L${xm + 8} ${yMu + 16}Z`);
      triTexto.setAttribute('x', limitar(xm, X_INI + 30, X_FIM - 30));
      triTexto.textContent = `μ = ${dec(muV, 3)}`;
    }
    svg.setAttribute('aria-label', aria);
  }
  return { svg, atualizar };
}

/** Controlo deslizante com rótulo, valor visível e aria-valuetext. */
function criarSlider({ id, rotuloTex, min, max, valor, formato, nome }) {
  const rot = h('label', { for: id, class: 'exa-slider__rotulo' });
  comTex(rot, rotuloTex);
  rot.setAttribute('aria-label', nome);
  const saida = h('span', { class: 'exa-slider__valor' });
  const input = h('input', { type: 'range', id, min, max, step: 1, value: valor, class: 'exa-range' });
  const caixa = h('div', { class: 'exa-slider' }, h('div', { class: 'exa-slider__topo' }, rot, saida), input);
  const sincronizar = () => {
    const v = Number(input.value);
    saida.textContent = formato(v);
    input.setAttribute('aria-valuetext', formato(v));
  };
  input.addEventListener('input', sincronizar);
  sincronizar();
  return { caixa, input, sincronizar };
}

// ======================================================================
// Resolução passo a passo
// ======================================================================

/** passos: [{ parte?, frase, linhas: [latex] }]; final: { texto, linhas: [latex] }. */
function criarResolucao(passos, final) {
  const lista = h('div', { class: 'exa-passos', 'aria-live': 'polite' });
  const botao = h('button', { type: 'button', class: 'botao exa-botao-res' }, 'Ver a resolução');
  const finalEl = h('div', { class: 'exa-final', tabindex: '-1', hidden: true });
  let mostrados = 0;

  function mostrarFinal() {
    finalEl.append(h('p', { class: 'exa-final__titulo' }, final.titulo));
    for (const l of final.linhas) finalEl.append(comTex(h('div', { class: 'exa-linha exa-linha--final' }), l));
    finalEl.hidden = false;
  }

  botao.addEventListener('click', () => {
    const p = passos[mostrados];
    const bloco = h('div', { class: 'exa-passo' },
      h('p', { class: 'exa-passo__frase' },
        h('span', { class: 'exa-passo__num' }, `${p.parte ? p.parte + ' · ' : ''}Passo ${mostrados + 1} de ${passos.length}`),
        ' ', misto(h('span'), p.frase)));
    for (const l of p.linhas) bloco.append(comTex(h('div', { class: 'exa-linha' }), l));
    lista.append(bloco);
    mostrados += 1;
    if (mostrados < passos.length) {
      botao.textContent = 'Próximo passo';
    } else {
      botao.hidden = true;
      mostrarFinal();
      finalEl.focus({ preventScroll: true });
    }
  });

  return h('div', { class: 'exa-resolucao' }, botao, lista, finalEl);
}

// ======================================================================
// Campo «A tua resposta»
// ======================================================================

let contador = 0;

/** campos: [{ rotuloTex, nome, expr, certoTexto }] */
function criarResposta(campos) {
  const id = `exa-r${++contador}`;
  const feedbacks = [];
  const inputs = campos.map((c, i) => {
    const input = h('input', {
      type: 'text', inputmode: 'text', autocomplete: 'off', class: 'campo exa-campo',
      id: `${id}-${i}`, placeholder: 'fração ou decimal',
    });
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); fb.replaceChildren(); });
    const rot = h('label', { for: `${id}-${i}`, class: 'exa-resposta__rotulo' });
    comTex(rot, c.rotuloTex);
    rot.setAttribute('aria-label', c.nome);
    const fb = h('p', { class: 'exa-fb', 'aria-live': 'polite' });
    feedbacks.push(fb);
    c.input = input;
    return h('div', { class: 'exa-resposta__linha' }, rot, input, fb);
  });
  const geral = h('p', { class: 'exa-fb exa-fb--geral', 'aria-live': 'polite' });
  const botao = h('button', { type: 'submit', class: 'botao botao--suave' }, 'Verificar');
  const form = h('form', { class: 'exa-resposta', novalidate: true },
    h('p', { class: 'exa-resposta__titulo' }, 'A tua resposta (opcional)'),
    ...inputs, botao, geral);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    geral.replaceChildren();
    let escritas = 0;
    let certas = 0;
    campos.forEach((c, i) => {
      const texto = c.input.value.trim();
      const fb = feedbacks[i];
      fb.replaceChildren();
      if (!texto) return;
      escritas += 1;
      const r = M.corrigir(texto, { expr: c.expr });
      const alvo = M.avaliar(c.expr).valor;
      const exatoDec = r.valor !== undefined && Math.abs(r.valor - alvo) < 1e-9;
      if (r.estado === 'certo' || r.estado === 'certo-forma' || exatoDec) {
        certas += 1;
        c.input.setAttribute('aria-invalid', 'false');
        fb.append(h('span', { class: 'exa-fb--ok' }, `Certo, ${c.certoTexto}.`));
      } else if (r.estado === 'invalido') {
        c.input.setAttribute('aria-invalid', 'true');
        fb.append(h('span', { class: 'exa-fb--mal' }, 'Não consegui ler isto. Escreve uma fração (3/8) ou um decimal (0,375).'));
      } else if (r.estado === 'decimal') {
        fb.append(h('span', { class: 'exa-fb--mal' }, 'Estás perto, mas esse decimal é só uma aproximação. Escreve a fração.'));
      } else {
        c.input.setAttribute('aria-invalid', 'true');
        fb.append(h('span', { class: 'exa-fb--mal' }, 'Ainda não. Confere as contas e tenta outra vez.'));
      }
    });
    if (!escritas) geral.append(h('span', { class: 'exa-fb--mal' }, 'Escreve pelo menos uma resposta.'));
    else if (certas === campos.length) geral.append(h('span', { class: 'exa-fb--ok' }, 'Está tudo certo.'));
  });
  return form;
}

// ======================================================================
// Tabela do enunciado
// ======================================================================

function tabelaEnunciado(xs, pTex, legenda) {
  const cab = h('tr', {}, h('th', { scope: 'row' }));
  const lin = h('tr', {}, h('th', { scope: 'row' }));
  comTex(cab.firstChild, 'x_i');
  comTex(lin.firstChild, 'P(X=x_i)');
  xs.forEach((x, i) => {
    const a = h('td'); comTex(a, String(x));
    const b = h('td'); comTex(b, pTex[i]);
    cab.append(a);
    lin.append(b);
  });
  return h('div', { class: 'tabela-rolante' },
    h('table', { class: 'tabela exa-tabela' },
      h('caption', { class: 'sr-only' }, legenda),
      h('tbody', {}, cab, lin)));
}

// ======================================================================
// Exercício 1
// ======================================================================

function montarK(el) {
  const S = resolverK();
  const id = `exa-k${++contador}`;

  const enunciado = h('div', { class: 'exa-enunciado' },
    misto(h('p'), 'Considera a variável aleatória $X$ com a tabela de distribuição abaixo.'),
    tabelaEnunciado(S.xs, ['\\frac{k}{4}', '\\frac{1}{6}', '\\frac{k}{3}', '\\frac{1}{4}'],
      'Tabela de distribuição de X: P(X = −1) = k/4, P(X = 0) = 1/6, P(X = 1) = k/3, P(X = 2) = 1/4.'),
    misto(h('p', { class: 'exa-alinea' }), '1.1. Determina o valor de $k$.'),
    misto(h('p', { class: 'exa-alinea' }), '1.2. Calcula o valor médio de $X$.'));

  // figura
  const fig = criarFigura({ nomes: ['x = −1', 'x = 0', 'x = 1', 'x = 2'], fixas: [false, true, false, true], maxSoma: 1.6 });
  const slider = criarSlider({
    id: `${id}-s`, rotuloTex: 'k', nome: 'Valor de k', min: 0, max: 40, valor: 10,
    formato: (v) => `k = ${dec(v * 0.05, 2)}`,
  });
  const leitura = h('p', { class: 'exa-leitura', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const dica = h('p', { class: 'exa-leitura-extra', 'aria-live': 'polite' });

  function atualizarK() {
    const kc = Number(slider.input.value);
    const k = P.F(kc, 20);
    const ps = [P.mult(k, P.F(1, 4)), P.F(1, 6), P.mult(k, P.F(1, 3)), P.F(1, 4)];
    const s = ps.reduce((acc, p) => P.soma(acc, p), P.ZERO);
    const sv = fv(s);
    const certa = P.igual(s, P.UM);
    const passa1 = ps.some((p) => fv(p) > 1);
    leitura.className = `exa-leitura ${certa ? 'exa-leitura--ok' : 'exa-leitura--mal'}`;
    leitura.textContent = certa
      ? 'soma = 1, está certo'
      : `soma = ${dec(sv, 3)}, ${sv < 1 ? 'falta' : 'passa'} ${dec(Math.abs(1 - sv), 3)}`;
    let msg = '';
    if (passa1) msg = 'Uma probabilidade passou de 1, o que não faz sentido.';
    else if (certa) msg = 'Encontraste: ainda falta escrever a equação que o prova.';
    else if (sv > 1) msg = 'Passaste de 1: as probabilidades têm de somar exatamente 1.';
    dica.textContent = msg;
    dica.className = `exa-leitura-extra${certa ? ' exa-leitura-extra--ok' : ''}`;
    fig.atualizar(ps.map(fv),
      null,
      `Gráfico de barras com k = ${dec(kc * 0.05, 2)}. ${S.xs.map((x, i) => `P(X = ${x < 0 ? '−' + (-x) : x}) = ${dec(fv(ps[i]))}`).join('; ')}. `
      + (certa ? 'A soma é 1.' : `A soma é ${dec(sv)}, não dá 1.`));
  }
  slider.input.addEventListener('input', atualizarK);

  const figuraCaixa = h('div', { class: 'exa-figura' },
    h('p', { class: 'exa-objetivo' }, 'Procura o valor de k que faz a soma dar exatamente 1.'),
    h('div', { class: 'exa-figura__corpo' }, fig.svg,
      h('div', { class: 'exa-figura__lado' }, slider.caixa, leitura, dica)));

  // resolução
  const T = P.fracTexF;
  const passos = [
    {
      parte: '1.1', frase: 'A soma das probabilidades de todos os valores de X é sempre 1. É esta a equação que nos dá $k$.',
      linhas: ['\\frac{k}{4}+\\frac{1}{6}+\\frac{k}{3}+\\frac{1}{4}=1'],
    },
    {
      parte: '1.1', frase: 'Juntam-se os termos com $k$ e, à parte, os números. Com denominador 12, $\\frac{1}{4}+\\frac{1}{3}=\\frac{7}{12}$ e $\\frac{1}{6}+\\frac{1}{4}=\\frac{5}{12}$.',
      linhas: [
        `\\left(\\frac{1}{4}+\\frac{1}{3}\\right)k+\\left(\\frac{1}{6}+\\frac{1}{4}\\right)=1`,
        `${T(S.coef)}k+${T(S.cons)}=1`,
      ],
    },
    {
      parte: '1.1', frase: 'O número passa para o segundo membro com o sinal trocado.',
      linhas: [`${T(S.coef)}k=1-${T(S.cons)}`, `${T(S.coef)}k=${T(S.direita)}`],
    },
    {
      parte: '1.1', frase: 'Dividem-se os dois membros pelo número que multiplica $k$.',
      linhas: [`k=${T(S.direita)}\\div${T(S.coef)}`, `k=${T(S.k)}`],
    },
    {
      parte: '1.1', frase: 'Confirma-se: cada probabilidade tem de estar entre 0 e 1 e a soma tem de dar 1.',
      linhas: [
        `${S.ps.map(T).join(',\\;')}`,
        `\\frac{3}{12}+\\frac{2}{12}+\\frac{4}{12}+\\frac{3}{12}=\\frac{12}{12}=1`,
      ],
    },
    {
      parte: '1.2', frase: 'O valor médio é a soma de cada valor $x_i$ multiplicado pela sua probabilidade.',
      linhas: [
        `\\mu=\\sum x_i\\,P(X=x_i)=(-1)\\times${T(S.ps[0])}+0\\times${T(S.ps[1])}+1\\times${T(S.ps[2])}+2\\times${T(S.ps[3])}`,
        `\\mu=-\\frac{1}{4}+0+\\frac{1}{3}+\\frac{1}{2}`,
      ],
    },
    {
      parte: '1.2', frase: 'Com denominador 12, soma-se tudo.',
      linhas: [`\\mu=-\\frac{3}{12}+\\frac{4}{12}+\\frac{6}{12}=${T(S.mu)}`],
    },
  ];
  const resolucao = criarResolucao(passos, {
    titulo: 'Resposta',
    linhas: [`1.1.\\;\\; k=${T(S.k)}`, `1.2.\\;\\; \\mu=${T(S.mu)}`],
  });

  const resposta = criarResposta([
    { rotuloTex: 'k=', nome: 'Valor de k', expr: `${S.k.n}/${S.k.d}`, certoTexto: 'k está certo' },
    { rotuloTex: '\\mu=', nome: 'Valor médio de X', expr: `${S.mu.n}/${S.mu.d}`, certoTexto: 'o valor médio está certo' },
  ]);

  const cartao = h('div', { class: 'widget exa' }, enunciado, figuraCaixa, resolucao, resposta);
  el.replaceChildren(cartao);
  atualizarK();
}

// ======================================================================
// Exercício 2
// ======================================================================

const PARES_A = [10, 60, 20, 50, 5, 70, 25, 45];

function montarAB(el) {
  const S = resolverAB();
  const id = `exa-ab${++contador}`;

  const enunciado = h('div', { class: 'exa-enunciado' },
    misto(h('p'), 'A variável aleatória $X$ tem a tabela abaixo e valor médio $\\mu = 1{,}9$.'),
    tabelaEnunciado(S.xs, ['a', 'b', '\\frac{1}{4}'],
      'Tabela de distribuição de X: P(X = 1) = a, P(X = 2) = b, P(X = 3) = 1/4.'),
    misto(h('p', { class: 'exa-alinea' }), 'Determina $a$ e $b$.'));

  const fig = criarFigura({
    nomes: ['x = 1', 'x = 2', 'x = 3'], fixas: [false, false, true], maxSoma: 1.8,
    mu: { x0: 1 }, alvo: 1.9,
  });
  const sa = criarSlider({
    id: `${id}-a`, rotuloTex: 'a', nome: 'Valor de a, probabilidade de X igual a 1', min: 0, max: 75, valor: 20,
    formato: (v) => `a = ${dec(v / 100, 2)}`,
  });
  const sb = criarSlider({
    id: `${id}-b`, rotuloTex: 'b', nome: 'Valor de b, probabilidade de X igual a 2', min: 0, max: 75, valor: 20,
    formato: (v) => `b = ${dec(v / 100, 2)}`,
  });
  const leituraSoma = h('p', { class: 'exa-leitura', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const leituraMu = h('p', { class: 'exa-leitura', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const dica = h('p', { class: 'exa-leitura-extra', 'aria-live': 'polite' });
  const outro = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Mostra outro par com soma 1');
  let ciclo = 0;
  outro.addEventListener('click', () => {
    const a = PARES_A[ciclo % PARES_A.length];
    ciclo += 1;
    sa.input.value = a;
    sb.input.value = 75 - a;
    sa.sincronizar();
    sb.sincronizar();
    atualizarAB();
  });

  function atualizarAB() {
    const a = Number(sa.input.value); // centésimas
    const b = Number(sb.input.value);
    const somaC = a + b + 25;
    const muC = a + 2 * b + 75;
    const somaOk = somaC === 100;
    const muOk = muC === 190;
    const sv = somaC / 100;
    const mv = muC / 100;
    leituraSoma.className = `exa-leitura ${somaOk ? 'exa-leitura--ok' : 'exa-leitura--mal'}`;
    leituraSoma.textContent = somaOk ? 'soma = 1, está certo'
      : `soma = ${dec(sv, 2)}, ${somaC < 100 ? 'falta' : 'passa'} ${dec(Math.abs(100 - somaC) / 100, 2)}`;
    leituraMu.className = `exa-leitura ${muOk ? 'exa-leitura--ok' : 'exa-leitura--mal'}`;
    leituraMu.textContent = muOk ? 'μ = 1,9, está certo' : `μ = ${dec(mv, 2)}, o objetivo é 1,9`;
    let msg = '';
    if (somaOk && muOk) msg = 'Encontraste: ainda falta escrever o sistema que o prova.';
    else if (somaOk) msg = 'A soma já dá 1, mas μ não. Há muitos pares com soma 1, por isso uma condição sozinha não chega.';
    else if (muOk) msg = 'μ já dá 1,9, mas a soma não dá 1. Também há muitos pares com este μ: precisas das duas condições.';
    dica.textContent = msg;
    dica.className = `exa-leitura-extra${somaOk && muOk ? ' exa-leitura-extra--ok' : ''}`;
    fig.atualizar([a / 100, b / 100, 0.25], mv,
      `Gráfico de barras. P(X = 1) = ${dec(a / 100, 2)}; P(X = 2) = ${dec(b / 100, 2)}; P(X = 3) = 0,25. `
      + `A soma é ${dec(sv, 2)} e o valor médio é ${dec(mv, 2)}. `
      + (somaOk && muOk ? 'As duas condições estão certas.' : 'O objetivo é soma 1 e valor médio 1,9.'));
  }
  sa.input.addEventListener('input', atualizarAB);
  sb.input.addEventListener('input', atualizarAB);

  const figuraCaixa = h('div', { class: 'exa-figura' },
    h('p', { class: 'exa-objetivo' }, 'Mexe em a e em b até a soma dar 1 e μ dar 1,9.'),
    h('div', { class: 'exa-figura__corpo' }, fig.svg,
      h('div', { class: 'exa-figura__lado' }, sa.caixa, sb.caixa, leituraSoma, leituraMu, dica, outro)),
    h('p', { class: 'nota exa-nota' }, 'Duas incógnitas pedem duas equações: uma vem da soma, outra do valor médio.'));

  const dt = (f) => decTex(fv(f), 2);
  const passos = [
    {
      frase: 'A soma das probabilidades é 1. Isto dá a primeira equação.',
      linhas: ['a+b+\\frac{1}{4}=1', `a+b=${dt(S.s)}`],
    },
    {
      frase: 'O valor médio é a soma de cada $x_i$ vezes a sua probabilidade, e vale $1{,}9$. Isto dá a segunda equação.',
      linhas: [
        `1\\times a+2\\times b+3\\times\\frac{1}{4}=${dt(S.mu)}`,
        `a+2b+${dt(P.F(3, 4))}=${dt(S.mu)}`,
        `a+2b=${dt(S.t)}`,
      ],
    },
    {
      frase: 'Duas incógnitas, duas equações: escreve-se o sistema.',
      linhas: [`\\begin{cases} a+b=${dt(S.s)} \\\\ a+2b=${dt(S.t)} \\end{cases}`],
    },
    {
      frase: 'Subtrai-se a primeira equação à segunda, membro a membro. O $a$ desaparece e fica só $b$.',
      linhas: [`(a+2b)-(a+b)=${dt(S.t)}-${dt(S.s)}`, `b=${dt(S.b)}`],
    },
    {
      frase: 'Substitui-se $b$ na primeira equação para encontrar $a$.',
      linhas: [`a+${dt(S.b)}=${dt(S.s)}`, `a=${dt(S.s)}-${dt(S.b)}`, `a=${dt(S.a)}`],
    },
    {
      frase: 'Confirma-se: as probabilidades somam 1 e o valor médio dá $1{,}9$.',
      linhas: [
        `${dt(S.a)}+${dt(S.b)}+${dt(P.F(1, 4))}=1`,
        `\\mu=1\\times${dt(S.a)}+2\\times${dt(S.b)}+3\\times${dt(P.F(1, 4))}=${dt(S.a)}+${decTex(2 * fv(S.b), 2)}+${decTex(0.75, 2)}=${dt(S.muCalc)}`,
      ],
    },
  ];
  const resolucao = criarResolucao(passos, {
    titulo: 'Resposta',
    linhas: [`a=${dt(S.a)}=${P.fracTexF(S.a)}`, `b=${dt(S.b)}=${P.fracTexF(S.b)}`],
  });

  const resposta = criarResposta([
    { rotuloTex: 'a=', nome: 'Valor de a', expr: `${S.a.n}/${S.a.d}`, certoTexto: 'a está certo' },
    { rotuloTex: 'b=', nome: 'Valor de b', expr: `${S.b.n}/${S.b.d}`, certoTexto: 'b está certo' },
  ]);

  el.replaceChildren(h('div', { class: 'widget exa' }, enunciado, figuraCaixa, resolucao, resposta));
  atualizarAB();
}

// ======================================================================

export async function montar(el) {
  if (el.dataset.ex === 'ab') montarAB(el);
  else montarK(el);
}
