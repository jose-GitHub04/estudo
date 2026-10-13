// exponencial: a função f(x) = a^x para mexer. Gráfico com a base num cursor (mais atalhos
// ½, 2, e, 3 e 10), um ponto que se arrasta sobre a curva, a curva e^x a pedido, leituras em
// direto (monotonia, domínio, contradomínio, limites, assíntota, pontos) e uma tabela de
// valores para ver que, de uma coluna para a seguinte, o valor se multiplica sempre por a.
// A matemática (comportamento por base, janela do gráfico, alcance do ponto, números, tabela)
// está em funções puras exportadas, conferidas em logaritmos/tests/exponencial.html. O desenho
// vem de assets/motor/grafico.js.
//
// Contrato: export async function montar(el, dados). Não usa `dados`. Estado guardado: nenhum.

import * as M from '../../assets/motor/matematica.js';
import { criarGrafico, arrastarNaCurva, CORES } from '../../assets/motor/grafico.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

export const BASE_MIN = 0.2;
export const BASE_MAX = 5;
export const PASSO_BASE = 0.05;
export const X_MIN = -4;
export const X_MAX = 4;
export const PASSO_X = 0.05; // o ponto assenta em múltiplos de 0,05, por isso x = 1 e x = 2 são alcançáveis
export const X_TABELA = [-2, -1, 0, 1, 2, 3];

const FINO = '\u202f'; // espaço fino que separa os milhares: 10 000
const ATALHOS = [
  { rotulo: '½', valor: 0.5 },
  { rotulo: '2', valor: 2 },
  { rotulo: 'e', valor: Math.E, ehE: true },
  { rotulo: '3', valor: 3 },
  { rotulo: '10', valor: 10 }, // fora do cursor (que acaba em 5): o atalho mostra a base 10 na mesma
];

let contador = 0;

// ---------- matemática pura (exportada para os testes) ----------

export const arredondarBase = (a) => Math.round(a * 100) / 100;
export const ehConstante = (a) => Math.abs(a - 1) < 1e-9;
export const pertoDeE = (a) => Math.abs(a - Math.E) < 0.03;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** O que a base decide em a^x (a > 0, a ≠ 1): monotonia, limites e o lado da assíntota. */
export function comportamento(a) {
  const cresce = a > 1;
  return {
    cresce,
    limiteMais: cresce ? Infinity : 0, // lim a^x quando x → +∞
    limiteMenos: cresce ? 0 : Infinity, // lim a^x quando x → −∞
    assintotaEm: cresce ? 'menos' : 'mais', // sentido em que a curva cola ao eixo dos xx
  };
}

/** Janela vertical do gráfico: deixa ver (1, a) e a curva mesmo que a base seja grande ou perto de 0. */
export function janelaY(a) {
  const b = a >= 1 ? a : 1 / a; // a curva de a < 1 é o espelho da de 1/a
  if (b <= 3 + 1e-9) return [-1, 4];
  if (b <= 5 + 1e-9) return [-1, 6];
  return [-2, 12];
}

/** Intervalo de x onde o ponto arrastável ainda está dentro do gráfico (em múltiplos de PASSO_X). */
export function limitesPonto(a, ymax) {
  if (ehConstante(a)) return [X_MIN, X_MAX];
  const tope = 0.93 * ymax; // folga para o círculo do ponto não ser cortado
  const xl = Math.log(tope) / Math.log(a); // a^xl = tope
  const grelha = (n) => +(n * PASSO_X).toFixed(2);
  if (a > 1) return [X_MIN, Math.min(X_MAX, grelha(Math.floor(xl / PASSO_X + 1e-9)))];
  return [Math.max(X_MIN, grelha(Math.ceil(xl / PASSO_X - 1e-9))), X_MAX];
}

const agrupar = (inteiro) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, FINO);

/**
 * Número com `algarismos` algarismos significativos, vírgula decimal e menos «−».
 * { txt, exato }: exato é false quando houve arredondamento (para escolher «=» ou «≈»).
 */
export function numero(v, algarismos = 3) {
  if (!Number.isFinite(v)) return { txt: '', exato: false };
  if (v === 0) return { txt: '0', exato: true };
  const mag = Math.floor(Math.log10(Math.abs(v)));
  const casas = Math.min(20, Math.max(0, algarismos - 1 - mag));
  let s = Math.abs(v).toFixed(casas);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  const [inteiro, decimais] = s.split('.');
  const txt = (v < 0 ? '−' : '') + (inteiro.length >= 5 ? agrupar(inteiro) : inteiro) + (decimais ? `,${decimais}` : '');
  const exato = Math.abs(Number(s) * Math.sign(v) - v) <= 1e-9 * Math.abs(v);
  return { txt, exato };
}

/** Casas fixas sem zeros à direita: 1,50 -> «1,5»; 0 -> «0»; 10 -> «10». */
export function limpo(v, casas = 2) {
  const s = M.fmt(v, casas);
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s;
}

/** A base escrita: «2,5», «0,25» ou «e». */
export const baseTxt = (a, ehE = false) => (ehE ? 'e' : limpo(a, 2));

/** Texto (vírgula, «−», espaço fino) -> LaTeX. */
export const paraTex = (txt) => txt.replace(/−/g, '-').replace(/,/g, '{,}').replace(new RegExp(FINO, 'g'), '\\,');

/** Linhas da tabela: x, a^x e a razão entre cada valor e o anterior (a primeira não tem). */
export function valoresTabela(a) {
  return X_TABELA.map((x, i) => {
    const y = Math.pow(a, x);
    return { x, y, razao: i === 0 ? null : y / Math.pow(a, X_TABELA[i - 1]) };
  });
}

// ---------- ajudas de interface ----------

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

const memoTex = new Map();
function m(latex) {
  let r = memoTex.get(latex);
  if (r === undefined) {
    if (memoTex.size > 500) memoTex.clear();
    r = tex(`{${latex}}`); // as chavas impedem o KaTeX de partir a fórmula em duas linhas depois de «=» ou «≈»
    memoTex.set(latex, r);
  }
  return r;
}

// fórmula seguida de pontuação, sem deixar o ponto ou a vírgula sozinhos na linha seguinte
const mp = (latex, pontuacao) => `<span class="exp-junto">${m(latex)}${pontuacao}</span>`;

// só escreve no DOM quando o texto muda (as regiões aria-live só anunciam o que mudou)
function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}

function amostra(cor, tracejado) {
  return criar('svg', { class: 'exp-amostra', width: 30, height: 10, viewBox: '0 0 30 10', 'aria-hidden': 'true' }, [
    criar('line', {
      x1: 2, y1: 5, x2: 28, y2: 5, style: `stroke:${cor}`, 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-dasharray': tracejado || 'none',
    }),
  ]);
}

// ---------- o widget ----------

export async function montar(el) {
  const uid = `exp${++contador}`;
  const est = { a: 2, ehE: false, x: 1.5, mostrarE: false };

  let g = null; // o gráfico atual (refaz-se quando a largura muda de escalão)
  let largura = 0;
  let assint = null;
  let curvaA = null;
  let curvaE = null;
  let curvaConstante = false;
  let ctrl = null;
  const optAss = { rotulo: 'assíntota: y = 0', posRotulo: 'dir', espessura: 2.6, tracejado: '7 5' };

  // --- estrutura ---
  const lienzo = h('div', { class: 'exp-lienzo' });
  const legenda = h('ul', { class: 'exp-legenda' });
  const pontoValor = h('span', { class: 'leitura__valor exp-ponto__valor' });
  const pontoNota = h('span', { class: 'exp-ponto__nota', hidden: true }, 'daqui a curva sai do gráfico');
  const pontoRotulo = h('span', { class: 'leitura__rotulo exp-ponto__rotulo' }, h('span', {}, 'Ponto na curva'), pontoNota);
  const pontoCaixa = h('div', { class: 'leitura exp-ponto' }, pontoRotulo, pontoValor);
  const ajuda = h('p', { class: 'nota exp-ajuda' },
    'Arrasta o ponto ao longo da curva, ou carrega no gráfico. Com o teclado, vai ao ponto e usa as setas.');

  const idBase = `${uid}-base`;
  const slider = h('input', { type: 'range', id: idBase, min: BASE_MIN, max: BASE_MAX, step: PASSO_BASE, value: est.a });
  const saida = h('output', { for: idBase });
  const controloBase = h('div', { class: 'controlo exp-controlo' },
    h('div', { class: 'exp-controlo__linha' }, h('label', { for: idBase }, 'Escolhe a base'), saida), slider);

  const chips = ATALHOS.map((at) => {
    const b = h('button', { type: 'button', class: `chip exp-chip${at.ehE ? ' exp-chip--e' : ''}`, 'aria-pressed': 'false' }, at.rotulo);
    b.addEventListener('click', () => mudarBase(at.valor, !!at.ehE));
    return b;
  });
  const controloAtalhos = h('div', { class: 'controlo exp-controlo' },
    h('span', { class: 'controlo__rotulo', id: `${uid}-atalhos` }, 'Ou escolhe um atalho'),
    h('div', { class: 'chips exp-chips', role: 'group', 'aria-labelledby': `${uid}-atalhos` }, ...chips));

  const caixaE = h('input', { type: 'checkbox', id: `${uid}-e`, class: 'exp-caixa' });
  const textoE = h('span', {});
  textoE.innerHTML = `Mostrar também ${m('e^x')}`;
  const interruptor = h('label', { class: 'exp-interruptor', for: `${uid}-e` }, caixaE, textoE);

  const aviso = h('p', { class: 'exp-aviso', hidden: true });
  aviso.innerHTML = `Com ${m('a=1')} a função é constante: não é uma função exponencial. `
    + `Qualquer potência de 1 dá 1, por isso o gráfico é a reta ${mp('y=1', '.')} Afasta a base de 1 para voltares a ver as propriedades.`;
  const notaE = h('p', { class: 'exp-nota-e', hidden: true });
  const avisos = h('div', { class: 'exp-avisos', 'aria-live': 'polite' }, aviso, notaE);

  const DEFS = [
    ['mono', 'Monotonia', true],
    ['dom', 'Domínio', false],
    ['contra', 'Contradomínio', false],
    ['mais', `Quando ${m('x\\to+\\infty')}`, false],
    ['menos', `Quando ${m('x\\to-\\infty')}`, false],
    ['assint', 'Assíntota horizontal', true],
    ['fixos', 'Pontos da curva', true],
  ];
  const leit = {};
  const leiturasEl = h('div', { class: 'leituras exp-leituras', 'aria-live': 'polite' });
  for (const [chave, rotulo, larga] of DEFS) {
    const rot = h('span', { class: 'leitura__rotulo' });
    rot.innerHTML = rotulo;
    const val = h('span', { class: 'leitura__valor' });
    const caixa = h('div', { class: `leitura exp-leitura${larga ? ' exp-leitura--larga' : ''}`, 'data-leitura': chave }, rot, val);
    leit[chave] = val;
    leiturasEl.append(caixa);
  }

  const colunaFigura = h('div', { class: 'exp-col' }, lienzo, legenda, pontoCaixa, ajuda);
  const colunaControlos = h('div', { class: 'exp-col' },
    h('div', { class: 'controlos exp-controlos' }, controloBase, controloAtalhos, interruptor),
    avisos, leiturasEl);

  // tabela de valores
  const tabela = h('table', { class: 'tabela exp-tabela' });
  tabela.innerHTML = `<caption class="sr-only">Valores da função para x igual a ${X_TABELA.map((x) => limpo(x, 0)).join(', ')}</caption>`
    + `<thead><tr><th scope="col">${m('x')}</th>${X_TABELA.map((x) => `<th scope="col">${limpo(x, 0)}</th>`).join('')}</tr></thead>`
    + '<tbody><tr class="exp-linha-y"><th scope="row"></th>' + X_TABELA.map(() => '<td></td>').join('') + '</tr>'
    + '<tr class="exp-razao"><th scope="row">Razão</th>' + X_TABELA.map(() => '<td></td>').join('') + '</tr></tbody>';
  const cabecaY = tabela.querySelector('.exp-linha-y th');
  const celulasY = [...tabela.querySelectorAll('.exp-linha-y td')];
  const celulasR = [...tabela.querySelectorAll('.exp-razao td')];
  const padrao = h('p', { class: 'exp-padrao', 'aria-live': 'polite' });
  const notaArred = h('p', { class: 'nota exp-arredondado', hidden: true }, 'Os valores estão arredondados a 3 algarismos.');
  const secaoTabela = h('div', { class: 'exp-tabela-secao' },
    h('p', { class: 'widget__titulo' }, 'Tabela de valores'),
    h('div', { class: 'tabela-rolante' }, tabela), notaArred, padrao);

  const raiz = h('div', { class: 'widget exp' },
    h('p', { class: 'widget__titulo' }, 'Experimenta a função exponencial'),
    h('p', { class: 'nota exp-intro' }, 'Muda a base e arrasta o ponto sobre a curva. Repara no que muda e no que fica sempre igual.'),
    h('div', { class: 'exp-grelha' }, colunaFigura, colunaControlos),
    secaoTabela);
  el.replaceChildren(raiz);

  // --- o gráfico ---
  const fA = (x) => Math.pow(est.a, x);
  const limites = () => limitesPonto(est.a, g.janela.y[1]);

  function criarCurvaA() {
    curvaConstante = ehConstante(est.a);
    return g.curva(fA, { cor: curvaConstante ? 'id' : 'exp', espessura: 3 });
  }

  function construirGrafico() {
    const larg = limitar(Math.round((lienzo.clientWidth || 320) / 20) * 20, 280, 640);
    if (g && larg === largura) return;
    largura = larg;
    const tinhaFoco = g && g.svg.contains(document.activeElement);
    const [y0, y1] = janelaY(est.a);
    g = criarGrafico({
      x: [X_MIN, X_MAX], y: [y0, y1], largura: larg, altura: Math.min(400, Math.round(larg * 0.82)), fonte: 13,
      aria: 'Gráfico da função exponencial',
    });
    assint = g.retaHorizontal(0, optAss);
    curvaA = criarCurvaA();
    curvaE = est.mostrarE ? g.curva(Math.exp, { cor: 'tg', espessura: 2.6, tracejado: '8 5' }) : null;
    ctrl = arrastarNaCurva(g, fA, {
      x0: est.x, xmin: X_MIN, xmax: X_MAX, passoTeclado: 0.1, aoMover: aoMoverPonto,
      aria: 'Ponto sobre a curva. Usa as setas esquerda e direita para mudar x.',
      textoAria: textoPonto,
    });
    lienzo.replaceChildren(g.svg);
    sincronizarGrafico();
    if (tinhaFoco) ctrl.el.focus({ preventScroll: true });
  }

  // chamado quando o ponto se mexe (rato, toque ou teclado): arruma-o na grelha e dentro do gráfico
  function aoMoverPonto(x) {
    const [lo, hi] = limites();
    const xs = +limitar(Math.round(x / PASSO_X) * PASSO_X, lo, hi).toFixed(2);
    if (xs !== x) ctrl.mover(xs, false);
    est.x = xs;
    escreverPonto();
  }

  function textoPonto(x, y) {
    const v = Number.isFinite(y) ? numero(y).txt : '';
    return `x igual a ${limpo(x, 2)}, ${baseTxt(est.a, est.ehE)} elevado a x igual a ${v}`;
  }

  function sincronizarGrafico() {
    const cst = ehConstante(est.a);
    const [y0, y1] = janelaY(est.a);
    const j = g.janela;
    if (j.y[0] !== y0 || j.y[1] !== y1) g.definirJanela([X_MIN, X_MAX], [y0, y1]);

    optAss.posRotulo = est.a > 1 ? 'dir' : 'esq'; // do lado onde a curva está longe do eixo
    assint.desenhar();
    if (cst !== curvaConstante) {
      curvaA.remover();
      curvaA = criarCurvaA();
    } else {
      curvaA.atualizar();
    }
    if (est.mostrarE && !curvaE) curvaE = g.curva(Math.exp, { cor: 'tg', espessura: 2.6, tracejado: '8 5' });
    if (!est.mostrarE && curvaE) {
      curvaE.remover();
      curvaE = null;
    }

    // (0, 1) e (1, a) com rótulo, cada um do lado onde a curva não passa
    g.limpar('pontos');
    g.limpar('texto');
    if (!cst) {
      const sep = Number.isInteger(est.a) || est.ehE ? ', ' : '; ';
      g.ponto(0, 1);
      g.ponto(1, est.a);
      const subir = { dx: 8, dy: -12 };
      if (est.a > 1) {
        // com a janela alta (base 10) os números do eixo ficam juntos: o rótulo afasta-se para não lhes tocar
        g.rotulo(0, 1, `(0${sep}1)`, { ancora: 'end', dx: y1 > 8 ? -22 : -8, dy: -12 });
        g.rotulo(1, est.a, `(1${sep}${baseTxt(est.a, est.ehE)})`, { ancora: 'start', dx: 8, dy: 17 });
      } else {
        g.rotulo(0, 1, `(0${sep}1)`, { ancora: 'start', ...subir });
        const pertoDoEixo = g.Y(0) - g.Y(est.a) < 30;
        let pos = { ancora: 'end', dx: -8, dy: 17 }; // por baixo da curva, à esquerda (aí a curva está mais acima)
        if (est.a > 0.8) pos = { ancora: 'start', dx: 8, dy: 17 }; // curva quase horizontal: à direita, longe dos números do eixo
        else if (pertoDoEixo) pos = { ancora: 'start', ...subir };
        g.rotulo(1, est.a, `(1${sep}${baseTxt(est.a, est.ehE)})`, pos);
      }
    }

    const [lo, hi] = limites();
    ctrl.el.setAttribute('aria-valuemin', String(lo));
    ctrl.el.setAttribute('aria-valuemax', String(hi));
    ctrl.mover(limitar(est.x, lo, hi), true);
    g.definirAria(descricaoGrafico());
  }

  function descricaoGrafico() {
    if (ehConstante(est.a)) return 'Gráfico de y igual a 1: uma reta horizontal.';
    const c = comportamento(est.a);
    const b = baseTxt(est.a, est.ehE);
    return `Gráfico de y igual a ${b} elevado a x, para x entre −4 e 4. A curva é ${c.cresce ? 'crescente' : 'decrescente'}, `
      + `passa por (0, 1) e por (1, ${b}) e aproxima-se da assíntota horizontal y igual a 0 quando x tende para `
      + `${c.assintotaEm === 'menos' ? 'menos' : 'mais'} infinito.`;
  }

  // --- textos que mudam ---
  const potTex = () => (est.ehE ? 'e' : paraTex(baseTxt(est.a)));

  function escreverPonto() {
    const A = potTex();
    const xs = limpo(est.x, 2);
    const xT = paraTex(xs);
    const v = Math.pow(est.a, est.x);
    const nv = numero(v);
    const igual = nv.exato ? '=' : '\\approx';
    const [lo, hi] = limites();
    const noLimite = (est.x >= hi - 1e-9 && hi < X_MAX) || (est.x <= lo + 1e-9 && lo > X_MIN);
    definirHtml(pontoValor,
      `<span class="exp-ponto__par">${m(`x=${xT}`)}</span>`
      + `<span class="exp-ponto__par">${m(`a^x=${A}^{${xT}}${igual}${paraTex(nv.txt)}`)}</span>`);
    pontoNota.hidden = !noLimite; // na mesma linha do rótulo, para a página não saltar
  }

  function escreverControlos() {
    const cst = ehConstante(est.a);
    saida.textContent = est.ehE ? 'a = e ≈ 2,718' : `a = ${baseTxt(est.a)}`;
    slider.setAttribute('aria-valuetext', est.ehE ? 'e, aproximadamente 2,718' : baseTxt(est.a));
    if (Number(slider.value) !== est.a) slider.value = String(est.a); // o cursor assenta no passo mais perto (e fica em 5 para a base 10)
    chips.forEach((b, i) => {
      const at = ATALHOS[i];
      b.setAttribute('aria-pressed', String(Math.abs(est.a - at.valor) < 1e-9 && !!at.ehE === est.ehE));
    });
    caixaE.checked = est.mostrarE;

    aviso.hidden = !cst;
    const eExato = est.ehE;
    const eAprox = !cst && !eExato && pertoDeE(est.a);
    notaE.hidden = !(eExato || eAprox);
    if (!notaE.hidden) {
      const eNum = mp('e\\approx2{,}718', ',');
      let t = eExato ? `Esta base é o número ${eNum} a base mais usada.` : `Esta base é praticamente o número ${eNum} a base mais usada.`;
      if (est.mostrarE) t += eExato ? ' Por isso as duas curvas coincidem.' : ' Por isso as duas curvas quase coincidem.';
      definirHtml(notaE, t);
    }
  }

  function escreverLegenda() {
    const cst = ehConstante(est.a);
    const itens = [];
    itens.push([amostra(cst ? CORES.id : CORES.exp), cst ? 'y=1' : `y=${potTex()}^x`]);
    if (est.mostrarE) itens.push([amostra(CORES.tg, '8 5'), 'y=e^x']);
    const chave = itens.map(([, t]) => t).join('|') + cst;
    if (legenda._c === chave) return;
    legenda._c = chave;
    legenda.replaceChildren(...itens.map(([am, t]) => {
      const li = h('li', {}, am);
      const s = h('span', {});
      s.innerHTML = m(t);
      li.append(s);
      return li;
    }));
  }

  function escreverLeituras() {
    const cst = ehConstante(est.a);
    leiturasEl.hidden = cst;
    secaoTabela.hidden = cst;
    if (cst) return;
    const c = comportamento(est.a);
    const lim = (v) => (v === Infinity ? '+\\infty' : '0');
    const cresce = 'cresce sem limite';
    const colado = 'aproxima-se de 0, sem lá chegar';
    const nota = (t) => `<span class="exp-leitura__nota">${t}</span>`;

    definirHtml(leit.mono, c.cresce
      ? `Crescente, porque ${mp('a>1', '.')}`
      : `Decrescente, porque ${mp('0<a<1', '.')}`);
    definirHtml(leit.dom, `${m('\\mathbb{R}')}${nota('qualquer expoente serve')}`);
    definirHtml(leit.contra, `${m('\\mathbb{R}^+')}${nota('nunca é zero nem negativa')}`);
    definirHtml(leit.mais, `${m(`a^x\\to${lim(c.limiteMais)}`)}${nota(c.limiteMais === Infinity ? cresce : colado)}`);
    definirHtml(leit.menos, `${m(`a^x\\to${lim(c.limiteMenos)}`)}${nota(c.limiteMenos === Infinity ? cresce : colado)}`);
    definirHtml(leit.assint, `A reta ${mp('y=0', ',')} quando ${mp(c.assintotaEm === 'menos' ? 'x\\to-\\infty' : 'x\\to+\\infty', '.')} `
      + 'O gráfico aproxima-se dela, mas nunca lhe toca.');
    definirHtml(leit.fixos, `Passa sempre por ${mp('(0,1)', ',')} qualquer que seja a base, porque ${mp('a^0=1', '.')} `
      + `O ponto ${m('(1,a)')} muda com a base, porque ${mp('a^1=a', '.')}`);
  }

  function escreverTabela() {
    if (ehConstante(est.a)) return;
    const A = potTex();
    const linhas = valoresTabela(est.a);
    definirHtml(cabecaY, m(`${A}^x`));
    let arredondado = false;
    linhas.forEach((l, i) => {
      const n = numero(l.y);
      if (!n.exato) arredondado = true;
      celulasY[i].textContent = n.txt;
      celulasR[i].textContent = l.razao === null ? '' : `×${est.ehE ? 'e' : numero(l.razao, 4).txt}`;
    });
    notaArred.hidden = !arredondado;

    const razao = est.ehE ? 'e' : numero(linhas[1].razao, 4).txt;
    const R = est.ehE ? 'e' : paraTex(razao);
    const c = comportamento(est.a);
    definirHtml(padrao,
      `De uma coluna para a seguinte, o valor multiplica-se sempre por ${mp(R, ',')} a base. `
      + 'Numa função afim somas sempre o mesmo número; numa exponencial multiplicas sempre pelo mesmo número. '
      + (c.cresce
        ? `Como ${mp(`${R}>1`, ',')} cada multiplicação faz o valor crescer.`
        : `Como ${mp(`0<${R}<1`, ',')} cada multiplicação faz o valor encolher.`));
  }

  function atualizarTudo() {
    escreverControlos();
    sincronizarGrafico();
    escreverLegenda();
    escreverLeituras();
    escreverTabela();
  }

  function mudarBase(a, ehE = false) {
    est.a = ehE ? Math.E : arredondarBase(a);
    est.ehE = ehE;
    atualizarTudo();
  }

  slider.addEventListener('input', () => mudarBase(Number(slider.value), false));
  caixaE.addEventListener('change', () => {
    est.mostrarE = caixaE.checked;
    atualizarTudo();
  });

  // --- arranque e redimensionamento ---
  construirGrafico();
  escreverControlos();
  escreverLegenda();
  escreverLeituras();
  escreverTabela();

  // o gráfico refaz-se fora da notificação, senão a mudança de altura volta a disparar o observador no mesmo ciclo
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => requestAnimationFrame(construirGrafico)).observe(lienzo);
}
