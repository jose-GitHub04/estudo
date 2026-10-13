// ex-normal: exercício 4, distribuição Normal (baterias, μ = 20 e σ = 2).
// Figura interativa (curva, sliders de μ e σ, áreas sombreadas), resolução passo a
// passo e campos de resposta opcionais. A matemática (erf, Φ, densidade) está nas
// funções puras exportadas; o resto é desenho e texto.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const MU0 = 20;
const SIGMA0 = 2;
const LIM = 24; // o valor do enunciado
const N_BATERIAS = 400;

// ---------- matemática sem DOM (exportada para testes) ----------

/**
 * Função erro. Série erf(x) = 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (1·3·5···(2n+1)),
 * só com termos positivos (sem cancelamento). Erro da ordem de 1e-15.
 */
export function erf(x) {
  const ax = Math.abs(x);
  if (ax >= 6) return x < 0 ? -1 : 1;
  let termo = ax;
  let soma = ax;
  for (let n = 1; n < 400; n++) {
    termo *= (2 * ax * ax) / (2 * n + 1);
    soma += termo;
    if (termo < 1e-18 * soma) break;
  }
  const r = (2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * soma;
  return x < 0 ? -r : r;
}

/** Função de distribuição da Normal: P(X ≤ x). */
export function cdf(x, mu = 0, sigma = 1) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

/** Densidade da Normal. */
export function densidade(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** P(a < X < b). Aceita ±Infinity. */
export function probEntre(a, b, mu, sigma) {
  if (b <= a) return 0;
  return cdf(b, mu, sigma) - cdf(a, mu, sigma);
}

/**
 * Corrige a resposta escrita (vírgula ou ponto decimal) de uma alínea.
 * alinea: '4.1' | '4.2' | '4.3'. Devolve { estado, dica? }
 * estado: 'certo' | 'errado' | 'invalido' | 'vazio'.
 */
export function corrigirResposta(alinea, texto) {
  const t = String(texto).trim();
  if (t === '') return { estado: 'vazio' };
  const r = M.avaliar(t.replace(/(\d),(\d)/g, '$1.$2'));
  if (!r.ok) return { estado: 'invalido' };
  const v = r.valor;
  const perto = (alvo, tol) => Math.abs(v - alvo) <= tol + 1e-12;
  if (alinea === '4.1') {
    if (perto(0.6827, 0.0006)) return { estado: 'certo' };
    if (perto(0.9545, 0.0006)) return { estado: 'errado', dica: 'Esse é o valor para dois desvios-padrão (16 a 24). Aqui o intervalo é de μ−σ a μ+σ.' };
    if (perto(0.3173, 0.0006)) return { estado: 'errado', dica: 'Esse é o que fica fora do intervalo. Pede-se a probabilidade de estar dentro.' };
    return { estado: 'errado', dica: 'Repara em quantos desvios-padrão 18 e 22 estão da média.' };
  }
  if (alinea === '4.2') {
    if (perto(0.02275, 0.0005)) return { estado: 'certo' };
    if (perto(0.0455, 0.0006)) return { estado: 'errado', dica: 'Esse valor é das duas caudas juntas. Falta usar a simetria e dividir por 2.' };
    if (perto(0.9545, 0.0006)) return { estado: 'errado', dica: 'Esse é o valor do centro, entre 16 e 24. Pede-se só a cauda à direita de 24.' };
    return { estado: 'errado', dica: 'Parte de P(16 < X < 24) ≈ 0,9545 e pensa no que fica de fora.' };
  }
  if (alinea === '4.3') {
    if (perto(9, 0.05) || perto(9.1, 0.05)) return { estado: 'certo' };
    if (perto(18.2, 0.1)) return { estado: 'errado', dica: 'Esse valor corresponde às duas caudas. Só contam as baterias que duram mais de 24 horas.' };
    return { estado: 'errado', dica: 'Multiplica 400 pela probabilidade da alínea anterior.' };
  }
  return { estado: 'invalido' };
}

// ---------- ajudas ----------

let contador = 0;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Número com vírgula, sem zeros finais: 18 · 0,5 · 2,25 */
function num(x, casas = 2) {
  const s = M.fmt(x, casas);
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s;
}
const T = (s, display = false) => tex(s, display);
const dtex = (s) => s.replace(/(\d),(\d)/g, '$1{,}$2');

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
function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}
function definirTexto(el, t) {
  if (el.textContent !== t) el.textContent = t;
}

// ---------- resolução ----------

const PASSOS = [
  {
    alinea: '4.1',
    porque: 'Escreve os extremos do intervalo em função do valor médio e do desvio-padrão. Com μ = 20 e σ = 2, o 18 e o 22 ficam a um desvio-padrão da média.',
    conta: '18 = 20 - 2 = \\mu - \\sigma \\qquad 22 = 20 + 2 = \\mu + \\sigma',
  },
  {
    porque: 'O intervalo vai de μ−σ a μ+σ, e para qualquer Normal a probabilidade nesse intervalo é um valor de referência.',
    conta: 'P(18 < X < 22) = P(\\mu - \\sigma < X < \\mu + \\sigma) \\approx 0{,}6827',
  },
  {
    alinea: '4.2',
    porque: 'O 24 está a dois desvios-padrão acima da média, por isso P(X > 24) é uma cauda: o que sobra à direita de μ+2σ.',
    conta: '24 = 20 + 2 \\times 2 = \\mu + 2\\sigma',
  },
  {
    porque: 'O valor de referência para dois desvios-padrão dá a probabilidade do centro, de 16 a 24.',
    conta: 'P(\\mu - 2\\sigma < X < \\mu + 2\\sigma) = P(16 < X < 24) \\approx 0{,}9545',
  },
  {
    porque: 'O que não está no centro está nas duas caudas, uma à esquerda de 16 e outra à direita de 24. A área total é 1.',
    conta: '1 - 0{,}9545 = 0{,}0455',
  },
  {
    porque: 'A curva é simétrica em relação a μ, por isso as duas caudas têm a mesma área. Cada uma fica com metade.',
    conta: '0{,}0455 : 2 = 0{,}02275',
  },
  {
    porque: 'A cauda da direita é a probabilidade pedida. Às milésimas, 0,02275 arredonda-se para 0,023.',
    conta: 'P(X > 24) \\approx 0{,}02275 \\approx 0{,}023',
  },
  {
    alinea: '4.3',
    porque: 'O número esperado de baterias é o número de baterias analisadas vezes a probabilidade de uma durar mais de 24 horas.',
    conta: '400 \\times P(X > 24) \\approx 400 \\times 0{,}02275 = 9{,}1',
  },
  {
    porque: 'Como não existem 0,1 baterias, arredonda-se às unidades.',
    conta: '\\text{Espera-se que cerca de } 9 \\text{ baterias durem mais de 24 horas.}',
  },
];

// ---------- o widget ----------

const VB_W = 440;
const VB_H = 272;
const XMIN = 12;
const XMAX = 28;
const ML = 24;
const MR = 16;
const BASE = 214;
const TOPO = 50;
const DMAX = 0.42;
const pxX = (x) => ML + ((x - XMIN) / (XMAX - XMIN)) * (VB_W - ML - MR);
const valX = (px) => XMIN + ((px - ML) / (VB_W - ML - MR)) * (XMAX - XMIN);
const pxY = (d) => BASE - (d / DMAX) * (BASE - TOPO);

export async function montar(el) {
  const uid = `exn${++contador}`;

  const est = {
    mu: MU0,
    sigma: SIGMA0,
    modo: 'sigma1', // 'sigma1' | 'sigma2' | 'livre' | 'cauda'
    a: 18,
    b: 22,
    passo: 0, // passos da resolução já mostrados
    aberta: false,
  };

  const raiz = h('div', { class: 'widget exn' });
  raiz.innerHTML = `
    <div class="exn-enunc">
      <p>A duração, em horas, de uma bateria de um certo modelo é uma variável aleatória ${T('X')} com distribuição Normal de valor médio ${T('20')} e desvio-padrão ${T('2')}.</p>
      <ol class="exn-alineas">
        <li><span class="exn-num">4.1.</span> Determina a probabilidade de uma bateria durar entre 18 e 22 horas.</li>
        <li><span class="exn-num">4.2.</span> Determina a probabilidade de uma bateria durar mais de 24 horas. Apresenta o resultado arredondado às milésimas.</li>
        <li><span class="exn-num">4.3.</span> Foram analisadas 400 baterias. Determina quantas delas se espera que durem mais de 24 horas.</li>
      </ol>
    </div>

    <section class="exn-bloco" aria-labelledby="${uid}-fig">
      <h4 id="${uid}-fig" class="exn-titulo">Vê a curva Normal</h4>
      <p class="nota exn-intro">Esta figura é para explorares. Mexe em μ e em σ e repara no que muda e no que não muda.</p>
      <div class="exn-lugar-svg"></div>
      <p class="exn-marcas" aria-live="off"></p>
      <div class="controlos exn-sliders">
        <div class="controlo">
          <label for="${uid}-mu">Valor médio μ: <output for="${uid}-mu" class="exn-out-mu">20</output></label>
          <input type="range" id="${uid}-mu" min="16" max="24" step="0.5" value="20">
        </div>
        <div class="controlo">
          <label for="${uid}-sg">Desvio-padrão σ: <output for="${uid}-sg" class="exn-out-sg">2</output></label>
          <input type="range" id="${uid}-sg" min="1" max="4" step="0.1" value="2">
        </div>
      </div>
      <p class="nota exn-nota-sliders">μ desloca a curva na horizontal. σ torna-a mais baixa e larga (σ maior) ou mais alta e estreita (σ menor). A área total por baixo da curva é sempre 1.</p>
      <div class="chips exn-modos" role="group" aria-label="Que área queres ver">
        <button type="button" class="chip" data-modo="sigma1" aria-pressed="true">Entre μ−σ e μ+σ</button>
        <button type="button" class="chip" data-modo="sigma2" aria-pressed="false">Entre μ−2σ e μ+2σ</button>
        <button type="button" class="chip" data-modo="livre" aria-pressed="false">Entre dois valores à tua escolha</button>
        <button type="button" class="chip" data-modo="cauda" aria-pressed="false">Mostrar a cauda</button>
      </div>
      <div class="exn-livre" hidden>
        <div class="exn-campos">
          <div class="controlo">
            <label for="${uid}-a">Valor a</label>
            <input type="text" inputmode="decimal" autocomplete="off" class="campo exn-in-a" id="${uid}-a">
          </div>
          <div class="controlo">
            <label for="${uid}-b">Valor b</label>
            <input type="text" inputmode="decimal" autocomplete="off" class="campo exn-in-b" id="${uid}-b">
          </div>
        </div>
        <p class="nota">Escreve dois valores entre 12 e 28, ou arrasta as duas bolas no eixo (com o teclado, usa as setas).</p>
      </div>
      <div class="exn-leitura" aria-live="polite"></div>
      <p class="exn-nota-modo nota"></p>
    </section>

    <section class="exn-bloco" aria-labelledby="${uid}-res">
      <h4 id="${uid}-res" class="exn-titulo">Resolução</h4>
      <div class="exn-botoes">
        <button type="button" class="botao exn-ver" aria-expanded="false" aria-controls="${uid}-passos">Ver a resolução</button>
      </div>
      <div class="exn-resolucao" id="${uid}-passos" hidden>
        <ol class="exn-passos" aria-live="polite" aria-relevant="additions"></ol>
        <div class="exn-botoes">
          <button type="button" class="botao exn-prox">Próximo passo</button>
          <button type="button" class="botao botao--suave exn-reiniciar">Recomeçar</button>
        </div>
      </div>
    </section>

    <section class="exn-bloco" aria-labelledby="${uid}-resp">
      <h4 id="${uid}-resp" class="exn-titulo">A tua resposta (opcional)</h4>
      <p class="nota exn-intro">Escreve o resultado em decimal, com vírgula ou ponto. Se estiveres a meio, usa a resolução acima.</p>
      <div class="exn-respostas"></div>
    </section>
  `;
  el.textContent = '';
  el.append(raiz);

  const q = (s) => raiz.querySelector(s);

  // ---------- SVG ----------
  const svg = criar('svg', {
    class: 'figura exn-svg',
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': '',
  });
  svg.style.touchAction = 'pan-y';
  const gGrade = criar('g');
  const gSombra = criar('g');
  const curva = criar('path', { class: 'exn-curva', fill: 'none' });
  const gMarcas = criar('g');
  const gRotulos = criar('g');
  const gPegas = criar('g');
  const eixo = criar('line', { class: 'exn-eixo', x1: ML, y1: BASE, x2: VB_W - MR, y2: BASE });
  svg.append(gGrade, gSombra, curva, eixo, gMarcas, gRotulos, gPegas);
  q('.exn-lugar-svg').append(svg);

  // grelha e rótulos do eixo (fixos)
  for (let x = XMIN; x <= XMAX; x += 2) {
    gGrade.append(
      criar('line', { class: 'exn-tique', x1: pxX(x), y1: BASE, x2: pxX(x), y2: BASE + 5 }),
      criar('text', { class: 'exn-eixo-t', x: pxX(x), y: BASE + 19, 'text-anchor': 'middle' }, [String(x)]),
    );
  }
  gGrade.append(criar('text', { class: 'exn-eixo-t', x: VB_W - MR, y: BASE + 38, 'text-anchor': 'end' }, ['x (horas)']));

  // pegas (modo livre)
  const pegas = {};
  for (const k of ['a', 'b']) {
    const hit = criar('circle', { class: 'exn-pega-hit', r: 18 });
    const bola = criar('circle', { class: 'exn-pega', r: 8 });
    const g = criar('g', {
      class: 'exn-pega-g',
      tabindex: 0,
      role: 'slider',
      'aria-valuemin': XMIN,
      'aria-valuemax': XMAX,
      'aria-label': k === 'a' ? 'Valor a, extremo esquerdo' : 'Valor b, extremo direito',
    }, [hit, bola]);
    g.style.touchAction = 'none';
    pegas[k] = g;
    gPegas.append(g);
    ligarPega(g, k);
  }

  function ligarPega(g, k) {
    const mover = (x) => definirExtremo(k, Math.round(x * 10) / 10);
    let ativo = false;
    g.addEventListener('pointerdown', (e) => {
      ativo = true;
      g.setPointerCapture(e.pointerId);
      g.focus();
      e.preventDefault();
    });
    g.addEventListener('pointermove', (e) => {
      if (!ativo) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const m = svg.getScreenCTM();
      if (m) mover(valX(pt.matrixTransform(m.inverse()).x));
    });
    const fim = (e) => {
      ativo = false;
      if (g.hasPointerCapture(e.pointerId)) g.releasePointerCapture(e.pointerId);
    };
    g.addEventListener('pointerup', fim);
    g.addEventListener('pointercancel', fim);
    g.addEventListener('keydown', (e) => {
      const atual = k === 'a' ? est.a : est.b;
      let novo = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') novo = atual + 0.1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') novo = atual - 0.1;
      else if (e.key === 'PageUp') novo = atual + 1;
      else if (e.key === 'PageDown') novo = atual - 1;
      else if (e.key === 'Home') novo = XMIN;
      else if (e.key === 'End') novo = XMAX;
      if (novo === null) return;
      e.preventDefault();
      definirExtremo(k, Math.round(novo * 10) / 10);
    });
  }

  function definirExtremo(k, v) {
    v = limitar(v, XMIN, XMAX);
    if (k === 'a') est.a = Math.min(v, est.b - 0.1);
    else est.b = Math.max(v, est.a + 0.1);
    est.a = Math.round(est.a * 10) / 10;
    est.b = Math.round(est.b * 10) / 10;
    atualizar();
  }

  // ---------- desenho ----------

  function caminhoCurva() {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const x = XMIN + (i / 160) * (XMAX - XMIN);
      pts.push(`${pxX(x).toFixed(1)} ${pxY(densidade(x, est.mu, est.sigma)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  /** Área sob a curva entre p e q (cortada ao intervalo visível). */
  function caminhoArea(p, q) {
    p = Math.max(p, XMIN);
    q = Math.min(q, XMAX);
    if (q - p < 1e-6) return '';
    const n = Math.max(2, Math.ceil((q - p) / 0.1));
    let d = `M${pxX(p).toFixed(1)} ${BASE}`;
    for (let i = 0; i <= n; i++) {
      const x = p + ((q - p) * i) / n;
      d += ` L${pxX(x).toFixed(1)} ${pxY(densidade(x, est.mu, est.sigma)).toFixed(1)}`;
    }
    return d + ` L${pxX(q).toFixed(1)} ${BASE} Z`;
  }

  function regioes() {
    const { mu, sigma, modo } = est;
    if (modo === 'sigma1') return [{ de: mu - sigma, ate: mu + sigma, cls: 'exn-area' }];
    if (modo === 'sigma2') return [{ de: mu - 2 * sigma, ate: mu + 2 * sigma, cls: 'exn-area' }];
    if (modo === 'livre') return [{ de: est.a, ate: est.b, cls: 'exn-area' }];
    return [
      { de: -Infinity, ate: LIM - 8, cls: 'exn-cauda' },
      { de: LIM - 8, ate: LIM, cls: 'exn-area' },
      { de: LIM, ate: Infinity, cls: 'exn-cauda' },
    ];
  }

  function desenhar() {
    const { mu, sigma, modo } = est;
    curva.setAttribute('d', caminhoCurva());

    // áreas
    gSombra.textContent = '';
    for (const r of regioes()) {
      const d = caminhoArea(r.de, r.ate);
      if (d) gSombra.append(criar('path', { class: r.cls, d }));
    }

    // marcas a tracejado
    gMarcas.textContent = '';
    gRotulos.textContent = '';
    const marcas = [
      { k: -2, t: 'μ−2σ', alto: true },
      { k: -1, t: 'μ−σ', alto: false },
      { k: 0, t: 'μ', alto: false },
      { k: 1, t: 'μ+σ', alto: false },
      { k: 2, t: 'μ+2σ', alto: true },
    ];
    for (const m of marcas) {
      const x = mu + m.k * sigma;
      if (x < XMIN - 1e-9 || x > XMAX + 1e-9) continue;
      const yTxt = m.alto ? 18 : 34;
      gMarcas.append(criar('line', {
        class: m.k === 0 ? 'exn-marca exn-marca--mu' : 'exn-marca',
        x1: pxX(x), y1: yTxt + 4, x2: pxX(x), y2: BASE,
      }));
      gRotulos.append(criar('text', { class: 'exn-marca-t', x: pxX(x), y: yTxt, 'text-anchor': 'middle' }, [m.t]));
    }

    // rótulos dentro das áreas da cauda
    if (modo === 'cauda') {
      const rot = (x, txt, y) => gRotulos.append(criar('text', { class: 'exn-area-t', x: pxX(x), y, 'text-anchor': 'middle' }, [txt]));
      rot(XMIN + 2, '0,02275', BASE - 22);
      rot(20, '0,9545', BASE - 40);
      rot(XMAX - 2, '0,02275', BASE - 22);
    }

    // pegas
    const livre = modo === 'livre';
    for (const k of ['a', 'b']) {
      const v = k === 'a' ? est.a : est.b;
      const g = pegas[k];
      g.style.display = livre ? '' : 'none';
      g.setAttribute('tabindex', livre ? '0' : '-1');
      g.setAttribute('aria-valuenow', String(v));
      g.setAttribute('aria-valuetext', `${num(v, 1)} horas`);
      for (const c of g.children) {
        c.setAttribute('cx', pxX(v));
        c.setAttribute('cy', BASE);
      }
    }
  }

  // ---------- leitura e textos ----------

  function leitura() {
    const { mu, sigma, modo } = est;
    if (modo === 'cauda') {
      const e = cdf(LIM - 8, MU0, SIGMA0);
      const c = probEntre(LIM - 8, LIM, MU0, SIGMA0);
      const d = 1 - cdf(LIM, MU0, SIGMA0);
      return {
        html: `
          <div class="leituras exn-tres">
            <div class="leitura"><span class="leitura__rotulo">Cauda esquerda, P(X &lt; 16)</span><span class="leitura__valor">${M.fmt(e, 5)}</span></div>
            <div class="leitura leitura--centro"><span class="leitura__rotulo">Centro, P(16 &lt; X &lt; 24)</span><span class="leitura__valor">${M.fmt(c, 4)}</span></div>
            <div class="leitura leitura--cauda"><span class="leitura__rotulo">Cauda direita, P(X &gt; 24)</span><span class="leitura__valor">${M.fmt(d, 5)}</span></div>
          </div>
          <p class="exn-frase">As duas caudas são iguais porque a curva é simétrica em relação a μ.</p>
          <p class="exn-lido">P(X &gt; 24) ≈ ${M.fmt(d, 5)}, que às milésimas dá ${M.fmt(d, 3)}.</p>`,
        aria: `Curva Normal com μ = 20 e σ = 2. Cauda esquerda ${M.fmt(e, 5)}, centro ${M.fmt(c, 4)} e cauda direita ${M.fmt(d, 5)}. As duas caudas são iguais.`,
      };
    }
    let a;
    let b;
    if (modo === 'sigma1') [a, b] = [mu - sigma, mu + sigma];
    else if (modo === 'sigma2') [a, b] = [mu - 2 * sigma, mu + 2 * sigma];
    else [a, b] = [est.a, est.b];
    const p = probEntre(a, b, mu, sigma);
    const txt = `P(${num(a)} < X < ${num(b)}) ≈ ${M.fmt(p, 4)}`;
    return {
      html: `<p class="exn-lido exn-lido--grande">${txt}</p>`,
      aria: `Curva Normal com μ = ${num(mu, 1)} e σ = ${num(sigma, 1)}. Área sombreada entre ${num(a)} e ${num(b)}: ${M.fmt(p, 4)}.`,
    };
  }

  function notaModo() {
    if (est.modo === 'sigma1') {
      return 'A área entre μ−σ e μ+σ é sempre ≈ 0,6827, qualquer que seja o μ ou o σ. Mexe nos sliders: a curva muda de sítio e de forma, mas esta área não muda.';
    }
    if (est.modo === 'sigma2') {
      return 'A área entre μ−2σ e μ+2σ é sempre ≈ 0,9545, qualquer que seja o μ ou o σ.';
    }
    if (est.modo === 'livre') {
      return 'Aqui a área já depende dos valores que escolhes e também de μ e σ.';
    }
    return 'Na alínea 4.2 o enunciado fixa μ = 20 e σ = 2. Por isso, neste modo os sliders voltam a esses valores e ficam parados. Escolhe outra área para os voltares a mexer.';
  }

  function atualizar() {
    const cauda = est.modo === 'cauda';
    if (cauda) {
      est.mu = MU0;
      est.sigma = SIGMA0;
    }
    const sMu = q(`#${uid}-mu`);
    const sSg = q(`#${uid}-sg`);
    sMu.disabled = cauda;
    sSg.disabled = cauda;
    sMu.value = String(est.mu);
    sSg.value = String(est.sigma);
    definirTexto(q('.exn-out-mu'), num(est.mu, 1));
    definirTexto(q('.exn-out-sg'), num(est.sigma, 1));

    for (const c of raiz.querySelectorAll('.exn-modos .chip')) {
      c.setAttribute('aria-pressed', String(c.dataset.modo === est.modo));
    }
    q('.exn-livre').hidden = est.modo !== 'livre';
    const inA = q('.exn-in-a');
    const inB = q('.exn-in-b');
    if (document.activeElement !== inA) inA.value = num(est.a, 1);
    if (document.activeElement !== inB) inB.value = num(est.b, 1);

    desenhar();
    const l = leitura();
    definirHtml(q('.exn-leitura'), l.html);
    svg.setAttribute('aria-label', l.aria);
    definirTexto(q('.exn-nota-modo'), notaModo());

    const { mu, sigma } = est;
    definirTexto(
      q('.exn-marcas'),
      `μ−2σ = ${num(mu - 2 * sigma)} · μ−σ = ${num(mu - sigma)} · μ = ${num(mu)} · μ+σ = ${num(mu + sigma)} · μ+2σ = ${num(mu + 2 * sigma)}`,
    );
  }

  // ---------- eventos da figura ----------

  q(`#${uid}-mu`).addEventListener('input', (e) => {
    est.mu = Number(e.target.value);
    atualizar();
  });
  q(`#${uid}-sg`).addEventListener('input', (e) => {
    est.sigma = Number(e.target.value);
    atualizar();
  });
  for (const c of raiz.querySelectorAll('.exn-modos .chip')) {
    c.addEventListener('click', () => {
      est.modo = c.dataset.modo;
      atualizar();
    });
  }
  for (const k of ['a', 'b']) {
    const input = q(`.exn-in-${k}`);
    const ler = () => {
      const t = input.value.trim().replace(',', '.');
      const v = Number(t);
      return t === '' || !Number.isFinite(v) ? null : v;
    };
    input.addEventListener('input', () => {
      const v = ler();
      if (v === null || v < XMIN || v > XMAX) {
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      input.removeAttribute('aria-invalid');
      const par = k === 'a' ? [v, est.b] : [est.a, v];
      if (par[0] < par[1]) {
        est.a = Math.round(par[0] * 100) / 100;
        est.b = Math.round(par[1] * 100) / 100;
        atualizar();
      }
    });
    input.addEventListener('change', () => {
      input.removeAttribute('aria-invalid');
      input.value = num(k === 'a' ? est.a : est.b, 2);
    });
  }

  // ---------- resolução ----------

  const lista = q('.exn-passos');
  const botVer = q('.exn-ver');
  const botProx = q('.exn-prox');

  function desenharPassos() {
    // só acrescenta o que falta, para a região viva anunciar apenas o passo novo
    while (lista.children.length > est.passo) lista.lastElementChild.remove();
    while (lista.children.length < est.passo) {
      const i = lista.children.length;
      const p = PASSOS[i];
      const li = h('li', { class: 'exn-passo', value: i + 1 });
      if (p.alinea) li.append(h('p', { class: 'exn-passo-alinea' }, `Alínea ${p.alinea}`));
      const porque = h('p', { class: 'exn-porque' });
      porque.append(h('strong', {}, `Passo ${i + 1}. `), p.porque);
      li.append(porque, h('div', { class: 'exn-conta' }));
      li.lastChild.innerHTML = T(p.conta, true);
      lista.append(li);
    }
    const fim = est.passo >= PASSOS.length;
    botProx.disabled = fim;
    botProx.textContent = fim ? 'Resolução completa' : 'Próximo passo';
    q('.exn-resolucao').hidden = !est.aberta;
    botVer.textContent = est.aberta ? 'Esconder a resolução' : 'Ver a resolução';
    botVer.setAttribute('aria-expanded', String(est.aberta));
  }

  botVer.addEventListener('click', () => {
    est.aberta = !est.aberta;
    if (est.aberta && est.passo === 0) est.passo = 1;
    desenharPassos();
  });
  botProx.addEventListener('click', () => {
    if (est.passo < PASSOS.length) est.passo++;
    desenharPassos();
  });
  q('.exn-reiniciar').addEventListener('click', () => {
    est.passo = 1;
    desenharPassos();
    botProx.focus();
  });

  // ---------- respostas ----------

  const ALINEAS = [
    { id: '4.1', rot: 'Alínea 4.1, P(18 < X < 22)', exemplo: '0,5' },
    { id: '4.2', rot: 'Alínea 4.2, P(X > 24) às milésimas', exemplo: '0,5' },
    { id: '4.3', rot: 'Alínea 4.3, número de baterias', exemplo: '10' },
  ];
  const zonaResp = q('.exn-respostas');
  for (const al of ALINEAS) {
    const id = `${uid}-r${al.id.replace('.', '')}`;
    const input = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'campo', id,
      'aria-describedby': `${id}-fb`,
    });
    const fb = h('p', { class: 'exn-fb', id: `${id}-fb`, 'aria-live': 'polite' });
    const botao = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Verificar');
    const verificar = () => {
      const r = corrigirResposta(al.id, input.value);
      fb.className = 'exn-fb';
      if (r.estado === 'vazio') {
        fb.textContent = 'Escreve primeiro uma resposta.';
      } else if (r.estado === 'invalido') {
        fb.className = 'exn-fb aviso-erro';
        fb.textContent = 'Não consegui ler isso. Escreve só um número, por exemplo 0,25.';
      } else if (r.estado === 'certo') {
        fb.className = 'exn-fb aviso-ok';
        fb.textContent = al.id === '4.3'
          ? 'Certo. Espera-se que cerca de 9 baterias durem mais de 24 horas (400 × 0,02275 = 9,1).'
          : 'Certo.';
      } else {
        fb.className = 'exn-fb aviso-erro';
        fb.textContent = `Ainda não. ${r.dica}`;
      }
      input.setAttribute('aria-invalid', r.estado === 'errado' || r.estado === 'invalido' ? 'true' : 'false');
    };
    botao.addEventListener('click', verificar);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verificar();
    });
    zonaResp.append(h('div', { class: 'exn-resp' },
      h('label', { for: id }, al.rot),
      h('div', { class: 'exn-resp-linha' }, input, botao),
      fb));
  }

  atualizar();
  desenharPassos();
}
