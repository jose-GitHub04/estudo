// circulo: circunferência trigonométrica interativa.
// Três modos: seno e cosseno, tangente, redução ao 1.º quadrante.
// Coordenadas: o desenho usa o y do SVG (para baixo); toda a matemática é feita com o
// y para cima e convertida só ao pôr os atributos (assim o texto nunca fica espelhado).

import * as M from '../../assets/motor/matematica.js';
import { criar, arrastar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const R = 112; // raio da circunferência, em unidades do viewBox
const VB = 170; // meia-largura do viewBox
const A = 148; // meio-comprimento dos eixos
const LIM = 720; // |θ| máximo
const IMAN = 4; // graus de captura dos ímanes
const T_MAX = 150; // altura máxima do desenho da tangente
const EPS_COS = 1e-9;
const ALFA_MIN = 1;
const ALFA_MAX = 89;
const RAPIDOS = [0, 30, 45, 60, 90, 180, 270, 360];

let contador = 0;

// ---------- utilitários ----------

const sinal = (x) => (x < 0 ? -1 : 1);
const arred1 = (x) => Math.round(x * 10) / 10 + 0;
const n2 = (x) => Math.round(x * 100) / 100;
const ehInteiro = (g) => Math.abs(g - Math.round(g)) < 1e-9;
const fmtG = (g) => (ehInteiro(g) ? M.fmt(Math.round(g), 0) : M.fmt(g, 1)) + '°';
const decTex = (x, casas = 3) => M.fmt(x, casas).replace('−', '-').replace(',', '{,}');

const memoTex = new Map();
function texC(s) {
  let h = memoTex.get(s);
  if (h === undefined) {
    h = tex(s);
    memoTex.set(s, h);
  }
  return h;
}

/** Só mexe no DOM se o conteúdo mudou (evita recriar KaTeX a cada movimento). */
function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}

function definirTexto(el, txt) {
  if (el.textContent !== txt) el.textContent = txt;
}

const at = (el, atrs) => {
  for (const [k, v] of Object.entries(atrs)) el.setAttribute(k, String(v));
};
const mostrar = (el, sim) => {
  el.style.display = sim ? '' : 'none';
};

const texto = (cls, x, y, s, ancora = 'middle') =>
  criar('text', { class: cls, x, y, 'text-anchor': ancora }, [s]);

/** Amplitude em radianos como LaTeX: fração de π se os graus forem inteiros, senão decimal. */
function radTex(t) {
  if (ehInteiro(t)) {
    const [p, q] = M.grausEmFracPi(t);
    return M.fracPiTex(p, q);
  }
  return decTex(M.grausParaRad(t), 3);
}

/** Ângulo generalizado (α, n): α em (−360°, 360°) com o sinal do sentido, n voltas completas. */
function generalizado(t) {
  const n = Math.trunc(t / 360) + 0;
  return { a: arred1(t - 360 * n), n };
}

/** 1 a 4, ou 0 se estiver sobre um eixo. */
function quadranteDe(t) {
  const g = M.normalizarGraus(t);
  const r = g % 90;
  if (r < 1e-9 || 90 - r < 1e-9) return 0;
  return Math.floor(g / 90) + 1;
}

/** Múltiplo de 30° ou de 45° mais perto de t. */
function notavelMaisPerto(t) {
  const a = Math.round(t / 30) * 30;
  const b = Math.round(t / 45) * 45;
  return Math.abs(t - a) <= Math.abs(t - b) ? a : b;
}

function iman(v, agudo) {
  const m = notavelMaisPerto(v);
  if (Math.abs(v - m) >= IMAN) return v;
  if (agudo && (m <= ALFA_MIN || m >= ALFA_MAX)) return v;
  return m;
}

/** Representação de φ (em graus) mais próxima do ângulo anterior, dentro de [−LIM, LIM]. */
function volta(fi, anterior) {
  const v = fi + 360 * Math.round((anterior - fi) / 360);
  if (Math.abs(v) <= LIM) return v;
  if (Math.abs(v - anterior) < 120) return sinal(v) * LIM; // a empurrar contra o limite
  let melhor = null;
  for (let k = -3; k <= 3; k++) {
    const w = fi + 360 * k;
    if (Math.abs(w) <= LIM && (melhor === null || Math.abs(w - anterior) < Math.abs(melhor - anterior))) melhor = w;
  }
  return melhor === null ? 0 : melhor;
}

/** Leva um ângulo qualquer ao intervalo [1°, 89°], pela margem mais próxima. */
function alfaDeAngulo(fi) {
  if (fi >= ALFA_MIN && fi <= ALFA_MAX) return fi;
  const d = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  return d(fi, ALFA_MIN) <= d(fi, ALFA_MAX) ? ALFA_MIN : ALFA_MAX;
}

/** Arco de raio r0 (cresce `cresce` por volta além da primeira) de 0 até `graus`. */
function arcoPath(r0, graus, cresce = 0) {
  const n = Math.max(1, Math.ceil(Math.abs(graus) / 3));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const fi = (graus * i) / n;
    const rr = r0 + (cresce * Math.max(0, Math.abs(fi) - 360)) / 360;
    const a = M.grausParaRad(fi);
    d += `${i ? 'L' : 'M'}${n2(rr * Math.cos(a))} ${n2(-rr * Math.sin(a))} `;
  }
  return d.trim();
}

/** Ponta de seta no fim do arco (aponta no sentido da rotação). */
function setaArco(r0, graus, cresce = 0) {
  const rr = r0 + (cresce * Math.max(0, Math.abs(graus) - 360)) / 360;
  const a = M.grausParaRad(graus);
  const s = sinal(graus);
  const px = rr * Math.cos(a);
  const py = -rr * Math.sin(a);
  const dx = s * -Math.sin(a);
  const dy = s * -Math.cos(a); // y do SVG vai para baixo
  const nx = -dy;
  const ny = dx;
  const bx = px - 9 * dx;
  const by = py - 9 * dy;
  const p = (x, y) => `${n2(x)},${n2(y)}`;
  return `${p(px + 1.5 * dx, py + 1.5 * dy)} ${p(bx + 4 * nx, by + 4 * ny)} ${p(bx - 4 * nx, by - 4 * ny)}`;
}

/** «pi-a» -> «π − α», «-a» -> «−α», «3*pi/2+a» -> «3π/2 + α» (só para mostrar). */
function textoArg(arg) {
  return arg
    .replace(/(\d)\*pi/g, '$1π')
    .replace(/pi/g, 'π')
    .replace(/\ba\b/g, 'α')
    .replace(/(.)([+-])/g, '$1 $2 ')
    .replace(/-/g, '−');
}

// ---------- o widget ----------

export async function montar(el, dados) {
  const uid = `cir${++contador}`;
  const valores = dados.valores;
  const rels = dados.reducao.relacoes;
  const est = { modo: 'sc', theta: 40, alfa: 40, alfaEntrada: 40, rel: 0, iman: true };

  const raiz = document.createElement('div');
  raiz.className = 'widget cir';
  raiz.innerHTML = `
    <div class="chips cir-modos" role="group" aria-label="O que queres ver">
      <button type="button" class="chip" data-modo="sc" aria-pressed="true">Seno e cosseno</button>
      <button type="button" class="chip" data-modo="tan" aria-pressed="false">Tangente</button>
      <button type="button" class="chip" data-modo="red" aria-pressed="false">Redução ao 1.º quadrante</button>
    </div>
    <div class="cir-corpo">
      <div class="cir-fig">
        <div class="cir-svg-lugar"></div>
        <p class="cir-selo" hidden></p>
        <p class="cir-aviso" hidden></p>
        <p class="nota cir-dica"></p>
      </div>
      <div class="cir-info">
        <div class="cir-gen">
          <div class="leituras cir-leituras">
            <div class="leitura"><span class="leitura__rotulo">Amplitude</span><span class="leitura__valor" data-l="amp"></span></div>
            <div class="leitura"><span class="leitura__rotulo">Em radianos</span><span class="leitura__valor" data-l="rad"></span></div>
            <div class="leitura cir-larga"><span class="leitura__rotulo">Ângulo generalizado (α, n)</span><span class="leitura__valor" data-l="gen"></span><span class="cir-sub" data-l="gensub"></span></div>
            <div class="leitura leitura--seno"><span class="leitura__rotulo">sin α</span><span class="leitura__valor" data-l="sin"></span></div>
            <div class="leitura leitura--cosseno"><span class="leitura__rotulo">cos α</span><span class="leitura__valor" data-l="cos"></span></div>
            <div class="leitura leitura--tangente"><span class="leitura__rotulo">tan α</span><span class="leitura__valor" data-l="tan"></span></div>
            <div class="leitura"><span class="leitura__rotulo">Quadrante</span><span class="leitura__valor" data-l="quad"></span></div>
          </div>
          <div class="tabela-rolante cir-sinais-lugar"></div>
        </div>
        <div class="cir-red" hidden>
          <div class="chips cir-rels" role="group" aria-label="Relação entre ângulos"></div>
          <p class="cir-efeito"></p>
          <div class="leituras cir-leituras">
            <div class="leitura"><span class="leitura__rotulo">α (agudo)</span><span class="leitura__valor" data-l="ra"></span></div>
            <div class="leitura"><span class="leitura__rotulo">Ângulo de Q</span><span class="leitura__valor" data-l="rarg"></span></div>
            <div class="leitura"><span class="leitura__rotulo">P (cos α ; sin α)</span><span class="leitura__valor" data-l="rP"></span></div>
            <div class="leitura cir-leitura--q"><span class="leitura__rotulo">Q</span><span class="leitura__valor" data-l="rQ"></span></div>
          </div>
          <p class="cir-ident-titulo">Em cada linha, os dois lados dão o mesmo número:</p>
          <ul class="cir-ident"></ul>
        </div>
        <div class="controlos cir-controlos">
          <div class="controlo">
            <label for="${uid}-campo" class="cir-campo-rotulo">Amplitude em graus</label>
            <input id="${uid}-campo" class="campo cir-campo" type="number" step="any" min="${-LIM}" max="${LIM}" value="40">
          </div>
          <label class="cir-iman"><input type="checkbox" checked> Ímanes nos ângulos notáveis</label>
          <div class="chips cir-rapidos" role="group" aria-label="Ângulos rápidos"></div>
        </div>
      </div>
    </div>
    <div class="sr-only cir-vivo" aria-live="polite" aria-atomic="true"></div>
  `;
  el.innerHTML = '';
  el.append(raiz);

  const $ = (sel) => raiz.querySelector(sel);
  const L = {};
  raiz.querySelectorAll('[data-l]').forEach((n) => {
    L[n.dataset.l] = n;
  });
  const selo = $('.cir-selo');
  const aviso = $('.cir-aviso');
  const dica = $('.cir-dica');
  const secGen = $('.cir-gen');
  const secRed = $('.cir-red');
  const campo = $('.cir-campo');
  const campoRotulo = $('.cir-campo-rotulo');
  const caixaIman = $('.cir-iman input');
  const rapidos = $('.cir-rapidos');
  const chipsModo = [...raiz.querySelectorAll('.cir-modos .chip')];
  const efeito = $('.cir-efeito');
  const listaIdent = $('.cir-ident');
  const vivo = $('.cir-vivo');

  // ----- quadro de sinais (calculado, não escrito à mão) -----
  {
    const fs = [
      ['sin α', (a) => Math.sin(a)],
      ['cos α', (a) => Math.cos(a)],
      ['tan α', (a) => Math.sin(a) / Math.cos(a)],
    ];
    const linhas = fs
      .map(([nome, f]) => {
        const cels = [1, 2, 3, 4]
          .map((q) => `<td>${f(M.grausParaRad(45 + 90 * (q - 1))) > 0 ? '+' : '−'}</td>`)
          .join('');
        return `<tr><th scope="row">${nome}</th>${cels}</tr>`;
      })
      .join('');
    $('.cir-sinais-lugar').innerHTML = `
      <table class="tabela cir-sinais" data-q="1">
        <caption class="sr-only">Sinal do seno, do cosseno e da tangente em cada quadrante</caption>
        <thead><tr><th scope="col"><span class="sr-only">Razão</span></th><th scope="col">1.º</th><th scope="col">2.º</th><th scope="col">3.º</th><th scope="col">4.º</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }
  const tabSinais = $('.cir-sinais');

  // ----- botões rápidos -----
  RAPIDOS.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.g = String(g);
    b.textContent = `${g}°`;
    b.setAttribute('aria-pressed', 'false');
    rapidos.append(b);
  });
  const botoesRapidos = [...rapidos.querySelectorAll('button')];

  // ----- chips das relações -----
  const chipsRel = rels.map((rel, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.rel = String(i);
    b.textContent = textoArg(rel.arg);
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    $('.cir-rels').append(b);
    return b;
  });

  // ---------- SVG ----------

  const svg = criar('svg', {
    class: 'figura cir-svg',
    viewBox: `${-VB} ${-VB} ${2 * VB} ${2 * VB}`,
    tabindex: 0,
    role: 'slider',
    'aria-label': 'Ângulo na circunferência trigonométrica (arrasta o ponto ou usa as setas do teclado)',
    'aria-valuemin': -LIM,
    'aria-valuemax': LIM,
    'aria-valuenow': est.theta,
    'aria-valuetext': '',
  });
  const E = {};

  const toque = criar('rect', { class: 'cir-toque', x: -VB, y: -VB, width: 2 * VB, height: 2 * VB });
  const disco = criar('circle', { class: 'cir-disco', cx: 0, cy: 0, r: R });

  E.quad = [null];
  const gQuad = criar('g');
  // nos cantos, fora da circunferência, para não pisarem o ponto nem as projeções
  [[1, 164, -140, 'end'], [2, -164, -140, 'start'], [3, -164, 140, 'start'], [4, 164, 140, 'end']].forEach(([q, x, y, ancora]) => {
    const t = criar('text', { class: 'cir-quad', x, y, 'text-anchor': ancora, 'dominant-baseline': 'central' }, [`${q}.º`]);
    E.quad[q] = t;
    gQuad.append(t);
  });

  const eixos = criar('g', {}, [
    criar('line', { class: 'cir-eixo', x1: -A, y1: 0, x2: A, y2: 0 }),
    criar('line', { class: 'cir-eixo', x1: 0, y1: A, x2: 0, y2: -A }),
    criar('polygon', { class: 'cir-seta', points: '154,0 142,-4.5 142,4.5' }),
    criar('polygon', { class: 'cir-seta', points: '0,-154 -4.5,-142 4.5,-142' }),
    criar('line', { class: 'cir-eixo', x1: R, y1: -5, x2: R, y2: 5 }),
    criar('line', { class: 'cir-eixo', x1: -R, y1: -5, x2: -R, y2: 5 }),
    criar('line', { class: 'cir-eixo', x1: -5, y1: R, x2: 5, y2: R }),
    criar('line', { class: 'cir-eixo', x1: -5, y1: -R, x2: 5, y2: -R }),
    texto('cir-eixo-nome', 161, -9, 'x'),
    texto('cir-eixo-nome', 12, -150, 'y', 'start'),
    texto('cir-num', R - 3, 19, '1', 'end'),
    texto('cir-num', -R, 19, '−1'),
    texto('cir-num', -9, -R + 5, '1', 'end'),
    texto('cir-num', -9, R + 5, '−1', 'end'),
    texto('cir-num', -9, 19, '0', 'end'),
  ]);
  const circ = criar('circle', { class: 'cir-circ', cx: 0, cy: 0, r: R });

  // modo 1: seno e cosseno
  E.sinSeg = criar('line', { class: 'cir-seg cir-seg--seno' });
  E.cosSeg = criar('line', { class: 'cir-seg cir-seg--cosseno' });
  E.projY = criar('line', { class: 'cir-proj cir-proj--seno' });
  E.dotY = criar('circle', { class: 'cir-ponto-seno', r: 3.8 });
  E.dotX = criar('circle', { class: 'cir-ponto-cosseno', r: 3.8 });
  E.labSin = texto('cir-t-seno', 0, 0, 'sin α');
  E.labCos = texto('cir-t-cosseno', 0, 0, 'cos α');
  const gSC = criar('g', {}, [E.projY, E.sinSeg, E.cosSeg, E.dotY, E.dotX, E.labSin, E.labCos]);

  // modo 2: tangente
  E.xReta = criar('line', { class: 'cir-reta-x', x1: R, y1: -T_MAX, x2: R, y2: T_MAX });
  E.xNome = texto('cir-t-tangente cir-t-pequeno', R - 6, -T_MAX + 8, 'x = 1', 'end');
  E.tReta = criar('line', { class: 'cir-reta-op' });
  E.tSeg = criar('line', { class: 'cir-seg cir-seg--tangente' });
  E.tDot = criar('circle', { class: 'cir-ponto-tangente', r: 5.5 });
  E.tSeta = criar('polygon', { class: 'cir-seta-tangente' });
  E.tLab = texto('cir-t-tangente', 0, 0, 'tan α', 'start');
  E.tT = texto('cir-t-tangente', 0, 0, 'T', 'start');
  const gTan = criar('g', {}, [E.xReta, E.xNome, E.tReta, E.tSeg, E.tDot, E.tSeta, E.tLab, E.tT]);

  // modo 3: redução
  E.bis = criar('line', { class: 'cir-bissetriz' });
  E.lig = criar('line', { class: 'cir-ligacao' });
  E.arcA = criar('path', { class: 'cir-arco' });
  E.arcALab = texto('cir-t-ang', 0, 0, 'α');
  E.arcQ = criar('path', { class: 'cir-arco cir-arco--q' });
  E.arcQLab = texto('cir-t-destaque', 0, 0, '');
  E.rP = criar('line', { class: 'cir-raio' });
  E.rQ = criar('line', { class: 'cir-raio cir-raio--q' });
  E.P2 = criar('circle', { class: 'cir-P', r: 7 });
  E.Q2 = criar('circle', { class: 'cir-Q', r: 7 });
  E.labP2 = texto('cir-t-ponto', 0, 0, 'P');
  E.labQ2 = texto('cir-t-destaque', 0, 0, 'Q');
  const gRed = criar('g', {}, [E.bis, E.lig, E.arcA, E.arcALab, E.arcQ, E.arcQLab, E.rP, E.rQ, E.P2, E.Q2, E.labP2, E.labQ2]);

  // modos 1 e 2: ângulo generalizado e ponto P
  E.arco = criar('path', { class: 'cir-arco' });
  E.arcoSeta = criar('polygon', { class: 'cir-arco-seta' });
  E.arcoRot = texto('cir-t-ang', 0, 0, '');
  E.raio = criar('line', { class: 'cir-raio', x1: 0, y1: 0 });
  E.P = criar('circle', { class: 'cir-P', r: 7.5 });
  E.Plab = texto('cir-t-ponto', 0, 0, 'P');
  const gGen = criar('g', {}, [E.arco, E.arcoSeta, E.arcoRot, E.raio, E.P, E.Plab]);

  svg.append(toque, disco, gQuad, eixos, circ, gSC, gTan, gRed, gGen);
  $('.cir-svg-lugar').append(svg);

  // ---------- cálculo ----------

  function calcGen() {
    const t = est.theta;
    const tr = M.grausParaRad(t);
    const c = Math.cos(tr);
    const s = Math.sin(tr);
    const def = Math.abs(c) >= EPS_COS;
    return { t, c, s, def, ty: def ? s / c : null };
  }

  function calcRed() {
    const rel = rels[est.rel];
    const ar = M.grausParaRad(est.alfa);
    const av = M.avaliar(rel.arg, { a: ar });
    const argRad = av.valor;
    return { rel, ar, argRad, argDeg: M.radParaGraus(argRad) };
  }

  /** Valor de sin, cos ou tan: exato (KaTeX) se o ângulo é notável, mais o decimal. */
  function celulaTrig(f, g) {
    if (f === 'tan' && !g.def) return 'não definida';
    const valor = f === 'sin' ? g.s : f === 'cos' ? g.c : g.ty;
    if (ehInteiro(g.t)) {
      const ex = M.exato(valores, Math.round(g.t), f);
      if (ex === null) return 'não definida';
      if (ex) {
        const inteiroSo = /^-?\d+$/.test(ex.tex);
        return texC(ex.tex) + (inteiroSo ? '' : ` <span class="cir-dec">≈ ${M.fmt(valor, 3)}</span>`);
      }
    }
    return M.fmt(valor, 3);
  }

  // ---------- desenho ----------

  function pintarGen() {
    const g = calcGen();
    const { t, c, s, def } = g;
    const px = R * c;
    const py = -R * s;
    at(E.raio, { x2: n2(px), y2: n2(py) });
    at(E.P, { cx: n2(px), cy: n2(py) });
    at(E.Plab, { x: n2(px + 18 * c), y: n2(py - 18 * s + 5) });

    // arco do ângulo, com seta e valor
    const temArco = Math.abs(t) >= 0.3;
    mostrar(E.arco, temArco);
    mostrar(E.arcoSeta, temArco && Math.abs(t) >= 12);
    const { a, n } = generalizado(t);
    if (temArco) {
      at(E.arco, { d: arcoPath(24, t, 8) });
      at(E.arcoSeta, { points: setaArco(24, t, 8) });
    }
    const rotVisivel = Math.abs(t) >= 14;
    mostrar(E.arcoRot, rotVisivel);
    if (rotVisivel) {
      const ang = Math.abs(t) <= 360 ? t / 2 : Math.abs(a) < 14 ? 180 * sinal(t) : a / 2;
      const ar = M.grausParaRad(ang);
      at(E.arcoRot, { x: n2(50 * Math.cos(ar)), y: n2(-50 * Math.sin(ar) + 5) });
      definirTexto(E.arcoRot, fmtG(t));
    }

    if (est.modo === 'sc') pintarSC(g, px, py);
    else pintarTan(g, px, py);

    leiturasGen(g, a, n);
    avisosGen(g);
    at(tabSinais, { 'data-q': quadranteDe(t) });
    E.quad.forEach((q, i) => {
      if (q) q.classList.toggle('cir-quad--ativo', quadranteDe(t) === i);
    });
  }

  function pintarSC({ c, s }, px, py) {
    mostrar(E.sinSeg, Math.abs(py) > 0.3);
    mostrar(E.cosSeg, Math.abs(px) > 0.3);
    at(E.sinSeg, { x1: n2(px), y1: 0, x2: n2(px), y2: n2(py) });
    at(E.cosSeg, { x1: 0, y1: 0, x2: n2(px), y2: 0 });
    at(E.projY, { x1: n2(px), y1: n2(py), x2: 0, y2: n2(py) });
    at(E.dotY, { cx: 0, cy: n2(py) });
    at(E.dotX, { cx: n2(px), cy: 0 });
    const lado = c >= 0 ? 1 : -1;
    if (Math.abs(py) >= 30) {
      // segmento comprido: rótulo do lado de fora, a meio
      at(E.labSin, { x: n2(px + lado * 9), y: n2(py / 2 + 5), 'text-anchor': lado > 0 ? 'start' : 'end' });
    } else {
      // segmento curto: rótulo do lado de dentro, logo acima (ou abaixo) do tracejado
      at(E.labSin, { x: n2(px - lado * 9), y: n2(s >= 0 ? py - 9 : py + 21), 'text-anchor': lado > 0 ? 'end' : 'start' });
    }
    // se o segmento é curto, o rótulo fica logo depois do pé de P (longe do «0»)
    const curto = Math.abs(px) < 44;
    at(E.labCos, {
      x: n2(curto ? px + lado * 6 : px / 2),
      y: s >= 0 ? 22 : -10,
      'text-anchor': curto ? (lado > 0 ? 'start' : 'end') : 'middle',
    });
  }

  function pintarTan({ c, s, def, ty }, px, py) {
    if (!def) {
      // a reta OP é paralela a x = 1: não há T
      at(E.tReta, { x1: n2(-A * c), y1: n2(A * s), x2: n2(A * c), y2: n2(-A * s) });
      [E.tSeg, E.tDot, E.tSeta, E.tLab, E.tT].forEach((n) => mostrar(n, false));
      return;
    }
    const yy = R * ty; // para cima
    const corta = Math.abs(yy) > T_MAX;
    const k = corta ? T_MAX / Math.abs(yy) : 1;
    at(E.tReta, { x1: 0, y1: 0, x2: n2(R * k), y2: n2(-R * ty * k) });
    const Ty = corta ? -sinal(ty) * T_MAX : -yy; // y do SVG
    const dir = ty > 0 ? -1 : 1;
    mostrar(E.tSeg, Math.abs(Ty) > 0.3);
    at(E.tSeg, { x1: R, y1: 0, x2: R, y2: n2(Ty) });
    mostrar(E.tDot, !corta);
    at(E.tDot, { cx: R, cy: n2(Ty) });
    mostrar(E.tSeta, corta);
    if (corta) at(E.tSeta, { points: `${R},${Ty + dir * 11} ${R - 6},${Ty} ${R + 6},${Ty}` });
    mostrar(E.tLab, true);
    mostrar(E.tT, true);
    if (Math.abs(Ty) >= 28) {
      at(E.tLab, { x: R + 9, y: n2(Ty / 2 + 5), 'text-anchor': 'start' });
    } else if (ty >= 0) {
      at(E.tLab, { x: R + 9, y: 22, 'text-anchor': 'start' }); // segmento curto: do outro lado do eixo
    } else {
      at(E.tLab, { x: R - 7, y: -12, 'text-anchor': 'end' }); // longe do nome do eixo x
    }
    at(E.tT, { x: R + 10, y: n2(corta ? Ty + 5 : ty >= 0 ? Ty - 9 : Ty + 19) });
  }

  function pintarRed() {
    const { rel, ar, argRad, argDeg } = calcRed();
    const cx = Math.cos(ar);
    const sy = Math.sin(ar);
    const qx = Math.cos(argRad);
    const qy = Math.sin(argRad);
    const Px = R * cx;
    const Py = -R * sy;
    const Qx = R * qx;
    const Qy = -R * qy;
    at(E.rP, { x1: 0, y1: 0, x2: n2(Px), y2: n2(Py) });
    at(E.rQ, { x1: 0, y1: 0, x2: n2(Qx), y2: n2(Qy) });
    at(E.P2, { cx: n2(Px), cy: n2(Py) });
    at(E.Q2, { cx: n2(Qx), cy: n2(Qy) });

    const dist = Math.hypot(Px - Qx, Py - Qy);
    mostrar(E.lig, dist > 1);
    at(E.lig, { x1: n2(Px), y1: n2(Py), x2: n2(Qx), y2: n2(Qy) });

    const [pxExpr, pyExpr] = rel.ponto;
    const bisY = pxExpr === 'y' && pyExpr === 'x'; // y = x
    const bisN = pxExpr === '-y' && pyExpr === '-x'; // y = −x
    mostrar(E.bis, bisY || bisN);
    if (bisY) at(E.bis, { x1: -A, y1: A, x2: A, y2: -A });
    if (bisN) at(E.bis, { x1: -A, y1: -A, x2: A, y2: A });

    at(E.arcA, { d: arcoPath(24, est.alfa) });
    const am = M.grausParaRad(est.alfa / 2);
    at(E.arcALab, { x: n2(37 * Math.cos(am)), y: n2(-37 * Math.sin(am) + 5) });
    at(E.arcQ, { d: arcoPath(44, argDeg) });
    const qm = M.grausParaRad(argDeg / 2);
    const qc = Math.cos(qm);
    at(E.arcQLab, {
      x: n2(54 * qc),
      y: n2(-54 * Math.sin(qm) + 5),
      'text-anchor': qc < -0.25 ? 'end' : qc > 0.25 ? 'start' : 'middle',
    });
    definirTexto(E.arcQLab, textoArg(rel.arg));

    // rótulos P e Q, para fora; se coincidirem, um só
    const junto = dist < 3;
    at(E.labP2, { x: n2(Px + 18 * cx), y: n2(Py - 18 * sy + 5) });
    definirTexto(E.labP2, junto ? 'P e Q' : 'P');
    mostrar(E.labQ2, !junto);
    const fora = dist < 26 ? 34 : 18;
    at(E.labQ2, { x: n2(Qx + fora * qx), y: n2(Qy - fora * qy + 5) });

    // leituras
    definirHtml(L.ra, `${fmtG(est.alfa)}`);
    definirHtml(L.rarg, fmtG(argDeg));
    definirHtml(L.rP, `(${M.fmt(cx, 3)} ; ${M.fmt(sy, 3)})`);
    definirHtml(L.rQ, `(${M.fmt(qx, 3)} ; ${M.fmt(qy, 3)})`);

    // identidades: valores numéricos dos dois lados
    const fn = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
    rel.linhas.forEach((ln, i) => {
      const esq = fn[ln.f](argRad);
      const dir = ln.sinal * fn[ln.res](ar);
      const alvo = listaIdent.querySelector(`[data-i="${i}"]`);
      if (alvo) definirTexto(alvo, `${M.fmt(esq, 3)} = ${M.fmt(dir, 3)}`);
    });
    selo.hidden = true;
    aviso.hidden = true;
    const qq = quadranteDe(argDeg);
    E.quad.forEach((q, i) => {
      if (q) q.classList.toggle('cir-quad--ativo', qq === i);
    });
  }

  function leiturasGen(g, a, n) {
    const { t } = g;
    definirHtml(L.amp, fmtG(t));
    definirHtml(L.rad, texC(`${radTex(t)}\\text{ rad}`));
    definirHtml(L.gen, `${fmtG(t)} = (${fmtG(a)}, ${M.fmt(n, 0)})`);
    definirHtml(L.gensub, `${fmtG(a)} + ${n < 0 ? `(${M.fmt(n, 0)})` : M.fmt(n, 0)} × 360°`);
    definirHtml(L.sin, celulaTrig('sin', g));
    definirHtml(L.cos, celulaTrig('cos', g));
    definirHtml(L.tan, celulaTrig('tan', g));
    const q = quadranteDe(t);
    definirHtml(L.quad, q ? `${q}.º quadrante` : 'sobre o eixo');
  }

  function avisosGen({ t, def, ty }) {
    // ângulo notável: só diz «exatos» se o ângulo é mesmo esse
    const m = notavelMaisPerto(t);
    const d = Math.abs(t - m);
    let txtSelo = '';
    if (d < 1e-9) txtSelo = 'Ângulo notável: tem valores exatos.';
    else if (d < 0.5) txtSelo = `Está muito perto de ${fmtG(m)}, um ângulo notável. Põe ${fmtG(m)} para ver os valores exatos.`;
    selo.hidden = !txtSelo;
    definirTexto(selo, txtSelo);
    selo.classList.toggle('cir-selo--perto', d >= 1e-9);

    let txtAviso = '';
    if (est.modo === 'tan') {
      if (!def) txtAviso = 'tan α = sin α / cos α, e aqui cos α = 0. O denominador não pode ser zero, por isso tan α não está definida (a reta OP é paralela à reta x = 1 e nunca a corta).';
      else if (Math.abs(R * ty) > T_MAX) txtAviso = `T fica fora do desenho: tan α ≈ ${M.fmt(ty, 3)}`;
    }
    aviso.hidden = !txtAviso;
    definirTexto(aviso, txtAviso);
  }

  // ---------- estado e controlos ----------

  const DICAS = {
    sc: 'Arrasta o ponto P à volta da circunferência (ou usa as setas do teclado). O cosseno é a abcissa de P e o seno é a ordenada.',
    tan: 'A tangente é a ordenada do ponto T, onde a reta OP corta a reta x = 1. Como tan α = sin α / cos α, quando cos α = 0 o denominador é zero e a tangente não existe.',
    red: 'Arrasta no 1.º quadrante para mudar α. O ponto Q, a roxo, é o ponto do ângulo escolhido nos botões em baixo.',
  };

  function valorAtual() {
    return est.modo === 'red' ? est.alfa : est.theta;
  }

  function aplicar(v, comIman) {
    if (comIman && est.iman) v = iman(v, est.modo === 'red');
    if (est.modo === 'red') est.alfa = arred1(Math.min(ALFA_MAX, Math.max(ALFA_MIN, v)));
    else est.theta = arred1(Math.min(LIM, Math.max(-LIM, v)));
    pintar();
  }

  function sincronizar() {
    const red = est.modo === 'red';
    chipsModo.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === est.modo)));
    chipsRel.forEach((b, i) => b.setAttribute('aria-pressed', String(i === est.rel)));
    secGen.hidden = red;
    secRed.hidden = !red;
    definirTexto(dica, DICAS[est.modo]);
    definirTexto(campoRotulo, red ? 'α em graus (de 1 a 89)' : 'Amplitude em graus');
    campo.min = String(red ? ALFA_MIN : -LIM);
    campo.max = String(red ? ALFA_MAX : LIM);
    const v = valorAtual();
    if (document.activeElement !== campo) campo.value = String(v);
    caixaIman.checked = est.iman;
    botoesRapidos.forEach((b) => {
      const g = Number(b.dataset.g);
      b.hidden = red && (g < ALFA_MIN || g > ALFA_MAX);
      b.setAttribute('aria-pressed', String(Math.abs(v - g) < 1e-9));
    });
    at(svg, {
      'aria-valuemin': red ? ALFA_MIN : -LIM,
      'aria-valuemax': red ? ALFA_MAX : LIM,
      'aria-valuenow': v,
    });
    if (red) {
      svg.setAttribute('aria-valuetext', `α igual a ${fmtG(v)}`);
    } else {
      const q = quadranteDe(v);
      svg.setAttribute('aria-valuetext', `${fmtG(v)}, ${q ? q + '.º quadrante' : 'sobre o eixo'}`);
    }
  }

  function textoSR() {
    if (est.modo === 'red') {
      const { rel, argDeg, argRad } = calcRed();
      return `α igual a ${fmtG(est.alfa)}. O ângulo ${textoArg(rel.arg)} mede ${fmtG(argDeg)}. O ponto Q tem coordenadas ${M.fmt(Math.cos(argRad), 3)} e ${M.fmt(Math.sin(argRad), 3)}.`;
    }
    const { t, c, s, def, ty } = calcGen();
    const q = quadranteDe(t);
    return `Amplitude ${fmtG(t)}, ${q ? q + '.º quadrante' : 'sobre o eixo'}. Seno ${M.fmt(s, 3)}, cosseno ${M.fmt(c, 3)}, tangente ${def ? M.fmt(ty, 3) : 'não definida'}.`;
  }

  let temporizador = 0;
  function agendarSR() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => definirTexto(vivo, textoSR()), 300);
  }

  function pintar() {
    const red = est.modo === 'red';
    mostrar(gSC, est.modo === 'sc');
    mostrar(gTan, est.modo === 'tan');
    mostrar(gRed, red);
    mostrar(gGen, !red);
    if (red) pintarRed();
    else pintarGen();
    sincronizar();
    agendarSR();
  }

  function construirIdent() {
    const rel = rels[est.rel];
    listaIdent.innerHTML = '';
    rel.linhas.forEach((ln, i) => {
      const li = document.createElement('li');
      li.className = 'cir-ident__linha';
      const t = `\\${ln.f}\\left(${rel.argTex}\\right)=${ln.sinal < 0 ? '-' : ''}\\${ln.res}\\alpha`;
      li.innerHTML = `<span class="cir-ident__tex">${texC(t)}</span><span class="cir-ident__num" data-i="${i}"></span>`;
      listaIdent.append(li);
    });
    efeito.innerHTML = '';
    const forte = document.createElement('strong');
    forte.textContent = `Q, para ${textoArg(rel.arg)}: `;
    efeito.append(forte, `${rel.efeito}.`);
  }

  function irPara(modo) {
    if (modo === est.modo) return;
    if (modo === 'red') {
      // usa a amplitude reduzida se for aguda; senão volta a 40°
      const g = M.normalizarGraus(est.theta);
      est.alfa = g >= ALFA_MIN && g <= ALFA_MAX ? arred1(g) : 40;
      est.alfaEntrada = est.alfa;
    } else if (est.modo === 'red' && est.alfa !== est.alfaEntrada) {
      est.theta = est.alfa;
    }
    est.modo = modo;
    pintar();
  }

  // ---------- eventos ----------

  chipsModo.forEach((b) => b.addEventListener('click', () => irPara(b.dataset.modo)));
  chipsRel.forEach((b) =>
    b.addEventListener('click', () => {
      est.rel = Number(b.dataset.rel);
      construirIdent();
      pintar();
    })
  );
  botoesRapidos.forEach((b) => b.addEventListener('click', () => aplicar(Number(b.dataset.g), false)));
  caixaIman.addEventListener('change', () => {
    est.iman = caixaIman.checked;
  });

  campo.addEventListener('input', () => {
    const v = parseFloat(campo.value);
    if (Number.isFinite(v)) aplicar(v, false);
  });
  campo.addEventListener('change', () => {
    campo.value = String(valorAtual());
  });

  arrastar(svg, (pt) => {
    const x = pt.x;
    const y = -pt.y;
    if (Math.hypot(x, y) < 3) return;
    const fi = (Math.atan2(y, x) * 180) / Math.PI;
    if (est.modo === 'red') aplicar(alfaDeAngulo(fi), true);
    else aplicar(volta(fi, est.theta), true);
  });
  svg.addEventListener('pointerdown', () => svg.focus({ preventScroll: true }));

  /** Próximo múltiplo de 15 na direção dir. */
  const passo15 = (v, dir) =>
    (dir > 0 ? Math.floor(v / 15 + 1e-9) + 1 : Math.ceil(v / 15 - 1e-9) - 1) * 15;

  svg.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const v = valorAtual();
    let novo;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        novo = e.shiftKey ? passo15(v, 1) : v + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        novo = e.shiftKey ? passo15(v, -1) : v - 1;
        break;
      case 'PageUp':
        novo = passo15(v, 1);
        break;
      case 'PageDown':
        novo = passo15(v, -1);
        break;
      case 'Home':
        novo = est.modo === 'red' ? ALFA_MIN : 0;
        break;
      default:
        return;
    }
    e.preventDefault();
    aplicar(novo, false);
  });

  construirIdent();
  pintar();
  definirTexto(vivo, textoSR());
}
