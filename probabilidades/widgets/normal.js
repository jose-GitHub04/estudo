// normal: explorador da distribuição Normal.
// Curva N(μ, σ) com sliders, áreas sombreadas (μ±σ, μ±2σ, μ±3σ, cauda, entre dois valores),
// comparação com N(0, 1) e simetria das caudas. A matemática (erf, cdf, densidade, probEntre)
// está nas funções puras exportadas; o resto é desenho e texto.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';

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

/** Função de distribuição da Normal: P(X ≤ x). Aceita ±Infinity. */
export function cdf(x, mu = 0, sigma = 1) {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
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

// ---------- ajudas ----------

let contador = 0;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

/** Número com vírgula, sem zeros finais: 18 · 0,5 · 2,25 */
function num(x, casas = 2) {
  const s = M.fmt(x, casas);
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s;
}

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

// ---------- geometria do desenho ----------

const VB_W = 420;
const VB_H = 278;
const ML = 48;
const MR = 12;
const BASE = 232;
const TOPO = 54;
const DMAX = 0.85;
const MEIA = 13; // o eixo vai de μ−13 a μ+13
const UNIDADE = (VB_W - ML - MR) / (2 * MEIA); // px por unidade de x
const FS = 14;

const MODOS = [
  { id: 'nenhuma', rotulo: 'Sem área' },
  { id: 's1', rotulo: 'Entre μ−σ e μ+σ', k: 1 },
  { id: 's2', rotulo: 'Entre μ−2σ e μ+2σ', k: 2 },
  { id: 's3', rotulo: 'Entre μ−3σ e μ+3σ', k: 3 },
  { id: 'cauda', rotulo: 'Cauda à direita de um valor' },
  { id: 'entre', rotulo: 'Entre dois valores' },
];

export async function montar(el) {
  const uid = `nor${++contador}`;

  const est = {
    mu: 0,
    sigma: 1,
    modo: 's1',
    sim: false,
    comparar: false,
    c: 1,
    a: -1,
    b: 1,
  };

  const raiz = h('div', { class: 'widget nor' });
  raiz.innerHTML = `
    <div class="nor-lugar-svg"></div>
    <p class="nor-legenda" hidden>
      <span class="nor-leg"><span class="nor-leg-traco nor-leg-traco--a"></span><span class="nor-leg-a"></span></span>
      <span class="nor-leg"><span class="nor-leg-traco nor-leg-traco--b"></span>N(0, 1), a curva padrão</span>
    </p>
    <div class="leituras nor-leituras" aria-live="polite">
      <div class="leitura"><span class="leitura__rotulo">Altura máxima da curva (densidade em μ)</span><span class="leitura__valor nor-altura"></span></div>
      <div class="leitura"><span class="leitura__rotulo">Área total sob a curva</span><span class="leitura__valor nor-total"></span></div>
    </div>
    <div class="controlos nor-sliders">
      <div class="controlo">
        <label for="${uid}-mu">Valor médio μ: <output for="${uid}-mu" class="nor-out-mu"></output></label>
        <input type="range" id="${uid}-mu" min="-10" max="10" step="0.5" value="0">
      </div>
      <div class="controlo">
        <label for="${uid}-sg">Desvio-padrão σ: <output for="${uid}-sg" class="nor-out-sg"></output></label>
        <input type="range" id="${uid}-sg" min="0.5" max="4" step="0.1" value="1">
      </div>
    </div>
    <div class="chips nor-modos" role="group" aria-label="Que área queres ver"></div>
    <div class="nor-valores" hidden>
      <div class="nor-campos">
        <div class="controlo nor-c-c">
          <label for="${uid}-c">Valor (cauda à direita)</label>
          <input type="text" inputmode="decimal" autocomplete="off" class="campo nor-in-c" id="${uid}-c">
        </div>
        <div class="controlo nor-c-a">
          <label for="${uid}-a">Valor a</label>
          <input type="text" inputmode="decimal" autocomplete="off" class="campo nor-in-a" id="${uid}-a">
        </div>
        <div class="controlo nor-c-b">
          <label for="${uid}-b">Valor b</label>
          <input type="text" inputmode="decimal" autocomplete="off" class="campo nor-in-b" id="${uid}-b">
        </div>
      </div>
      <p class="nota">Escreve o valor (com vírgula ou ponto) ou arrasta a bola no eixo. Com o teclado, usa as setas (0,1) e PageUp ou PageDown (1).</p>
    </div>
    <div class="nor-botoes">
      <button type="button" class="botao botao--suave nor-comparar" aria-pressed="false">Comparar com N(0, 1)</button>
      <button type="button" class="botao botao--suave nor-simetria" aria-pressed="false">Mostrar a simetria</button>
    </div>
    <div class="nor-leitura" aria-live="polite"></div>
    <p class="nota nor-nota-fixa">As áreas entre μ−σ e μ+σ, μ−2σ e μ+2σ, μ−3σ e μ+3σ não dependem de μ nem de σ.</p>
    <p class="nor-marcas"></p>
  `;
  el.textContent = '';
  el.append(raiz);
  const q = (s) => raiz.querySelector(s);

  // chips
  const zonaModos = q('.nor-modos');
  for (const m of MODOS) {
    zonaModos.append(h('button', { type: 'button', class: 'chip', 'data-modo': m.id, 'aria-pressed': 'false' }, m.rotulo));
  }

  // ---------- SVG ----------
  const svg = criar('svg', {
    class: 'figura nor-svg',
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': '',
  });
  svg.style.touchAction = 'pan-y';
  const gGrade = criar('g');
  const gSombra = criar('g');
  const curvaPadrao = criar('path', { class: 'nor-curva nor-curva--padrao', fill: 'none' });
  const curva = criar('path', { class: 'nor-curva', fill: 'none' });
  const pico = criar('g');
  const eixo = criar('line', { class: 'nor-eixo', x1: ML, y1: BASE, x2: VB_W - MR, y2: BASE });
  const gMarcas = criar('g');
  const gRotulos = criar('g');
  const gPegas = criar('g');
  svg.append(gGrade, gSombra, curvaPadrao, curva, pico, eixo, gMarcas, gRotulos, gPegas);
  q('.nor-lugar-svg').append(svg);

  const xmin = () => est.mu - MEIA;
  const xmax = () => est.mu + MEIA;
  const pxX = (x) => ML + (x - xmin()) * UNIDADE;
  const valX = (px) => xmin() + (px - ML) / UNIDADE;
  const pxY = (d) => BASE - (d / DMAX) * (BASE - TOPO);

  // pegas
  const pegas = {};
  const ROTULO_PEGA = {
    c: 'Valor da cauda à direita',
    a: 'Valor a, extremo esquerdo',
    b: 'Valor b, extremo direito',
  };
  for (const k of ['c', 'a', 'b']) {
    const hit = criar('circle', { class: 'nor-pega-hit', r: 18 });
    const bola = criar('circle', { class: 'nor-pega', r: 8 });
    const g = criar('g', {
      class: 'nor-pega-g',
      tabindex: 0,
      role: 'slider',
      'aria-label': ROTULO_PEGA[k],
    }, [hit, bola]);
    g.style.touchAction = 'none';
    pegas[k] = g;
    gPegas.append(g);
    ligarPega(g, k);
  }

  function ligarPega(g, k) {
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
      if (m) definirValor(k, r1(valX(pt.matrixTransform(m.inverse()).x)));
    });
    const fim = (e) => {
      ativo = false;
      if (g.hasPointerCapture(e.pointerId)) g.releasePointerCapture(e.pointerId);
    };
    g.addEventListener('pointerup', fim);
    g.addEventListener('pointercancel', fim);
    g.addEventListener('keydown', (e) => {
      const atual = est[k];
      let novo = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') novo = atual + 0.1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') novo = atual - 0.1;
      else if (e.key === 'PageUp') novo = atual + 1;
      else if (e.key === 'PageDown') novo = atual - 1;
      else if (e.key === 'Home') novo = xmin();
      else if (e.key === 'End') novo = xmax();
      if (novo === null) return;
      e.preventDefault();
      definirValor(k, r1(novo));
    });
  }

  function definirValor(k, v) {
    v = limitar(v, xmin(), xmax());
    if (k === 'a') est.a = Math.min(v, r1(est.b - 0.1));
    else if (k === 'b') est.b = Math.max(v, r1(est.a + 0.1));
    else est.c = v;
    est.a = r1(est.a);
    est.b = r1(est.b);
    est.c = r1(est.c);
    atualizar();
  }

  /** Mantém os valores escolhidos dentro do eixo (que se desloca com μ). */
  function ajustarValores() {
    const lo = xmin();
    const hi = xmax();
    est.c = limitar(est.c, lo, hi);
    est.a = limitar(est.a, lo, hi - 0.1);
    est.b = limitar(est.b, est.a + 0.1, hi);
    if (est.b <= est.a) est.a = est.b - 0.1;
  }

  // ---------- desenho ----------

  function caminhoCurva(mu, sigma) {
    const pts = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const x = xmin() + (i / N) * (2 * MEIA);
      pts.push(`${pxX(x).toFixed(1)} ${pxY(densidade(x, mu, sigma)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  /** Área sob N(mu, sigma) entre p e q (cortada ao eixo visível). */
  function caminhoArea(p, q2, mu, sigma) {
    p = Math.max(p, xmin());
    q2 = Math.min(q2, xmax());
    if (q2 - p < 1e-6) return '';
    const n = Math.max(2, Math.ceil((q2 - p) / 0.1));
    let d = `M${pxX(p).toFixed(1)} ${BASE}`;
    for (let i = 0; i <= n; i++) {
      const x = p + ((q2 - p) * i) / n;
      d += ` L${pxX(x).toFixed(1)} ${pxY(densidade(x, mu, sigma)).toFixed(1)}`;
    }
    return d + ` L${pxX(q2).toFixed(1)} ${BASE} Z`;
  }

  /** Regiões sombreadas, em valores de x: [{de, ate, cls}] */
  function regioes() {
    const { mu, sigma, modo } = est;
    if (est.sim) {
      return [
        { de: -Infinity, ate: mu - 2 * sigma, cls: 'nor-cauda' },
        { de: mu - 2 * sigma, ate: mu + 2 * sigma, cls: 'nor-area' },
        { de: mu + 2 * sigma, ate: Infinity, cls: 'nor-cauda' },
      ];
    }
    const m = MODOS.find((o) => o.id === modo);
    if (m && m.k) return [{ de: mu - m.k * sigma, ate: mu + m.k * sigma, cls: 'nor-area' }];
    if (modo === 'cauda') return [{ de: est.c, ate: Infinity, cls: 'nor-area' }];
    if (modo === 'entre') return [{ de: est.a, ate: est.b, cls: 'nor-area' }];
    return [];
  }

  /** Marcas μ + kσ, k = −3…3, com rótulos que não se sobrepõem. */
  function desenharMarcas() {
    const { mu, sigma } = est;
    gMarcas.textContent = '';
    gRotulos.textContent = '';
    const nomes = (k) => (k === 0 ? 'μ' : `μ${k < 0 ? '−' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}σ`);
    const ordem = [0, -1, 1, -2, 2, -3, 3];
    const linhasY = [16, 31, 46];
    const colocados = []; // caixas {l, r, x, linha}
    const largura = (t) => t.length * 8.4 + 4;
    for (const k of ordem) {
      const x = pxX(mu + k * sigma);
      const t = nomes(k);
      const w = largura(t);
      // posições do texto: para fora do traço, para dentro, ou centrado
      const opcoes = k === 0
        ? [{ anc: 'middle', l: x - w / 2, r: x + w / 2 }]
        : k > 0
          ? [{ anc: 'start', l: x - 1, r: x + w }, { anc: 'end', l: x - w, r: x + 1 }]
          : [{ anc: 'end', l: x - w, r: x + 1 }, { anc: 'start', l: x - 1, r: x + w }];
      let esc = null;
      for (let i = 0; i < linhasY.length && !esc; i++) {
        for (const op of opcoes) {
          if (op.l < 2 || op.r > VB_W - 2) continue;
          let livre = true;
          for (const o of colocados) {
            if (o.linha === i && op.l < o.r + 2 && o.l < op.r + 2) livre = false;
            // o traço de um rótulo mais acima não pode atravessar este texto
            if (o.linha < i && o.x > op.l - 2 && o.x < op.r + 2) livre = false;
            // o traço deste rótulo não pode atravessar texto mais abaixo
            if (o.linha > i && x > o.l - 2 && x < o.r + 2) livre = false;
          }
          if (livre) { esc = { ...op, linha: i, x }; break; }
        }
      }
      // o traço aparece sempre; o rótulo só se couber
      gMarcas.append(criar('line', {
        class: k === 0 ? 'nor-marca nor-marca--mu' : 'nor-marca',
        x1: x, y1: esc ? linhasY[esc.linha] + 4 : 50, x2: x, y2: BASE,
      }));
      if (esc) {
        colocados.push(esc);
        const dx = esc.anc === 'start' ? 2 : esc.anc === 'end' ? -2 : 0;
        gRotulos.append(criar('text', { class: 'nor-marca-t', x: x + dx, y: linhasY[esc.linha], 'text-anchor': esc.anc }, [t]));
      }
    }
  }

  function desenhar() {
    const { mu, sigma } = est;
    gGrade.textContent = '';
    // eixo y
    for (let d = 0; d <= 0.81; d += 0.2) {
      const y = pxY(d);
      gGrade.append(
        criar('line', { class: 'nor-grelha', x1: ML, y1: y, x2: VB_W - MR, y2: y }),
        criar('text', { class: 'nor-eixo-t', x: ML - 5, y: y + 4, 'text-anchor': 'end' }, [M.fmt(d, 1)]),
      );
    }
    gGrade.append(criar('text', {
      class: 'nor-eixo-t', transform: `translate(13 ${(TOPO + BASE) / 2}) rotate(-90)`, 'text-anchor': 'middle',
    }, ['densidade']));
    // eixo x
    for (let x = Math.ceil(xmin() / 2) * 2; x <= xmax() + 1e-9; x += 2) {
      gGrade.append(
        criar('line', { class: 'nor-tique', x1: pxX(x), y1: BASE, x2: pxX(x), y2: BASE + 5 }),
        criar('text', { class: 'nor-eixo-t', x: pxX(x), y: BASE + 20, 'text-anchor': 'middle' }, [M.fmt(x, 0)]),
      );
    }
    gGrade.append(criar('text', { class: 'nor-eixo-t', x: VB_W - MR, y: BASE + 40, 'text-anchor': 'end' }, ['x']));

    curva.setAttribute('d', caminhoCurva(mu, sigma));
    curvaPadrao.style.display = est.comparar ? '' : 'none';
    if (est.comparar) curvaPadrao.setAttribute('d', caminhoCurva(0, 1));

    // áreas (na curva própria e, se pedido, as equivalentes na curva padrão)
    gSombra.textContent = '';
    for (const r of regioes()) {
      const d = caminhoArea(r.de, r.ate, mu, sigma);
      if (d) gSombra.append(criar('path', { class: r.cls, d }));
      if (est.comparar) {
        const z0 = (r.de - mu) / sigma;
        const z1 = (r.ate - mu) / sigma;
        const dp = caminhoArea(z0, z1, 0, 1);
        if (dp) gSombra.append(criar('path', { class: `${r.cls} nor-padrao-area`, d: dp }));
      }
    }

    // pico
    pico.textContent = '';
    const ypico = pxY(densidade(mu, mu, sigma));
    pico.append(
      criar('line', { class: 'nor-pico-linha', x1: ML, y1: ypico, x2: pxX(mu), y2: ypico }),
      criar('circle', { class: 'nor-pico', cx: pxX(mu), cy: ypico, r: 4 }),
    );

    desenharMarcas();

    // pegas
    const ativas = est.sim ? [] : est.modo === 'cauda' ? ['c'] : est.modo === 'entre' ? ['a', 'b'] : [];
    for (const k of ['c', 'a', 'b']) {
      const g = pegas[k];
      const on = ativas.includes(k);
      g.style.display = on ? '' : 'none';
      g.setAttribute('tabindex', on ? '0' : '-1');
      g.setAttribute('aria-valuemin', num(xmin(), 1));
      g.setAttribute('aria-valuemax', num(xmax(), 1));
      g.setAttribute('aria-valuenow', String(est[k]));
      g.setAttribute('aria-valuetext', num(est[k], 1));
      for (const c of g.children) {
        c.setAttribute('cx', pxX(est[k]));
        c.setAttribute('cy', BASE);
      }
    }
  }

  // ---------- leituras e textos ----------

  function leitura() {
    const { mu, sigma, modo } = est;
    const base = `Curva Normal com μ = ${num(mu, 1)} e σ = ${num(sigma, 1)}.`;
    if (est.sim) {
      const e = cdf(mu - 2 * sigma, mu, sigma);
      const d = 1 - cdf(mu + 2 * sigma, mu, sigma);
      const c = probEntre(mu - 2 * sigma, mu + 2 * sigma, mu, sigma);
      return {
        html: `
          <div class="leituras nor-tres">
            <div class="leitura leitura--cauda"><span class="leitura__rotulo">P(X &lt; μ−2σ)</span><span class="leitura__valor">≈ ${M.fmt(e, 5)}</span></div>
            <div class="leitura leitura--centro"><span class="leitura__rotulo">P(μ−2σ &lt; X &lt; μ+2σ)</span><span class="leitura__valor">≈ ${M.fmt(c, 4)}</span></div>
            <div class="leitura leitura--cauda"><span class="leitura__rotulo">P(X &gt; μ+2σ)</span><span class="leitura__valor">≈ ${M.fmt(d, 5)}</span></div>
          </div>
          <p class="nor-soma">${M.fmt(e, 5)} + ${M.fmt(c, 4)} + ${M.fmt(d, 5)} = ${M.fmt(e + c + d, 4)}</p>
          <p class="nor-frase">A curva é simétrica em relação a μ, por isso as caudas são iguais.</p>`,
        aria: `${base} Caudas sombreadas: à esquerda de μ−2σ ${M.fmt(e, 5)} e à direita de μ+2σ ${M.fmt(d, 5)}, iguais. Juntas com ${M.fmt(c, 4)} dão 1.`,
      };
    }
    if (modo === 'nenhuma') {
      return {
        html: '<p class="nor-lido">Escolhe uma área para ver a sua probabilidade.</p>',
        aria: `${base} Nenhuma área sombreada.`,
      };
    }
    let txt;
    let p;
    const m = MODOS.find((o) => o.id === modo);
    if (m && m.k) {
      const k = m.k === 1 ? '' : String(m.k);
      txt = `P(μ−${k}σ < X < μ+${k}σ)`;
      p = probEntre(mu - m.k * sigma, mu + m.k * sigma, mu, sigma);
    } else if (modo === 'cauda') {
      txt = `P(X > ${num(est.c, 2)})`;
      p = 1 - cdf(est.c, mu, sigma);
    } else {
      txt = `P(${num(est.a, 2)} < X < ${num(est.b, 2)})`;
      p = probEntre(est.a, est.b, mu, sigma);
    }
    let extra = '';
    if (est.comparar) {
      extra = '<p class="nor-lido nor-lido--sec">Na curva N(0, 1) a zona sombreada correspondente tem a mesma área.</p>';
    }
    return {
      html: `<p class="nor-lido nor-lido--grande">${txt.replace(/</g, '&lt;').replace(/>/g, '&gt;')} ≈ ${M.fmt(p, 4)}</p>${extra}`,
      aria: `${base} Área sombreada, ${txt}: ${M.fmt(p, 4)}.`,
    };
  }

  function atualizar() {
    ajustarValores();
    const { mu, sigma } = est;
    q(`#${uid}-mu`).value = String(mu);
    q(`#${uid}-sg`).value = String(sigma);
    definirTexto(q('.nor-out-mu'), num(mu, 1));
    definirTexto(q('.nor-out-sg'), num(sigma, 1));

    for (const c of raiz.querySelectorAll('.nor-modos .chip')) {
      c.setAttribute('aria-pressed', String(!est.sim && c.dataset.modo === est.modo));
    }
    const botC = q('.nor-comparar');
    const botS = q('.nor-simetria');
    botC.setAttribute('aria-pressed', String(est.comparar));
    botS.setAttribute('aria-pressed', String(est.sim));
    q('.nor-legenda').hidden = !est.comparar;
    definirTexto(q('.nor-leg-a'), `N(${num(mu, 1)}, ${num(sigma, 1)})`);

    const cauda = !est.sim && est.modo === 'cauda';
    const entre = !est.sim && est.modo === 'entre';
    q('.nor-valores').hidden = !(cauda || entre);
    q('.nor-c-c').hidden = !cauda;
    q('.nor-c-a').hidden = !entre;
    q('.nor-c-b').hidden = !entre;
    for (const k of ['c', 'a', 'b']) {
      const inp = q(`.nor-in-${k}`);
      if (document.activeElement !== inp) {
        inp.value = num(est[k], 2);
        inp.removeAttribute('aria-invalid');
      }
    }

    desenhar();
    const l = leitura();
    definirHtml(q('.nor-leitura'), l.html);
    svg.setAttribute('aria-label', l.aria);

    const alt = densidade(mu, mu, sigma);
    definirTexto(q('.nor-altura'), M.fmt(alt, 4));
    definirTexto(q('.nor-total'), `= ${M.fmt(probEntre(mu - 10 * sigma, mu + 10 * sigma, mu, sigma), 4)}`);

    const marcas = [-3, -2, -1, 0, 1, 2, 3].map((k) => {
      const nome = k === 0 ? 'μ' : `μ${k < 0 ? '−' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}σ`;
      return `${nome} = ${num(mu + k * sigma, 2)}`;
    });
    definirTexto(q('.nor-marcas'), marcas.join(' · '));
  }

  // ---------- eventos ----------

  q(`#${uid}-mu`).addEventListener('input', (e) => {
    est.mu = Number(e.target.value);
    atualizar();
  });
  q(`#${uid}-sg`).addEventListener('input', (e) => {
    est.sigma = r1(Number(e.target.value));
    atualizar();
  });
  for (const c of raiz.querySelectorAll('.nor-modos .chip')) {
    c.addEventListener('click', () => {
      est.modo = c.dataset.modo;
      est.sim = false;
      if (est.modo === 'cauda') est.c = r1(est.mu + est.sigma);
      if (est.modo === 'entre') {
        est.a = r1(est.mu - est.sigma);
        est.b = r1(est.mu + est.sigma);
      }
      atualizar();
    });
  }
  q('.nor-comparar').addEventListener('click', () => {
    est.comparar = !est.comparar;
    atualizar();
  });
  q('.nor-simetria').addEventListener('click', () => {
    est.sim = !est.sim;
    if (est.sim && est.modo === 'nenhuma') est.modo = 's2';
    atualizar();
  });
  for (const k of ['c', 'a', 'b']) {
    const input = q(`.nor-in-${k}`);
    const ler = () => {
      const t = input.value.trim().replace(',', '.').replace('−', '-');
      const v = Number(t);
      return t === '' || !Number.isFinite(v) ? null : v;
    };
    input.addEventListener('input', () => {
      const v = ler();
      let ok = v !== null && v >= xmin() && v <= xmax();
      if (ok && k === 'a' && v >= est.b) ok = false;
      if (ok && k === 'b' && v <= est.a) ok = false;
      if (!ok) {
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      input.removeAttribute('aria-invalid');
      est[k] = Math.round(v * 100) / 100;
      atualizar();
    });
    input.addEventListener('change', () => {
      input.removeAttribute('aria-invalid');
      input.value = num(est[k], 2);
    });
  }

  atualizar();
}
