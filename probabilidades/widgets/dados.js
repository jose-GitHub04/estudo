// dados: a soma (ou a média) de vários dados tende para uma curva Normal.
// Distribuição exata da soma por convolução (contagens inteiras, divididas por 6^n),
// curva N(3,5n; √(35n/12)), simulação de lançamentos e proporções dentro de μ±σ e μ±2σ.
// A matemática está nas funções puras exportadas; o resto é desenho e texto.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';

// ---------- matemática sem DOM (exportada para testes) ----------

/** Contagens: c[i] = nº de maneiras de a soma de n dados ser n + i (i = 0 … 5n). Exatas (6^12 < 2^53). */
export function contagensSoma(n) {
  let c = [1];
  for (let k = 0; k < n; k++) {
    const novo = new Array(c.length + 5).fill(0);
    for (let i = 0; i < c.length; i++) for (let f = 0; f < 6; f++) novo[i + f] += c[i];
    c = novo;
  }
  return c;
}

/** Distribuição exata da soma de n dados: [{ s, p }], s = n … 6n. */
export function distribuicaoSoma(n) {
  const c = contagensSoma(n);
  const total = Math.pow(6, n);
  return c.map((v, i) => ({ s: n + i, p: v / total }));
}

export const mediaSoma = (n) => 3.5 * n;
export const desvioSoma = (n) => Math.sqrt((35 * n) / 12);

/** P(|S − μ| < k·σ), exata, para a soma de n dados. */
export function proporcaoDentro(n, k) {
  const mu = mediaSoma(n);
  const lim = k * desvioSoma(n);
  let t = 0;
  for (const { s, p } of distribuicaoSoma(n)) if (Math.abs(s - mu) < lim - 1e-9) t += p;
  return t;
}

/** Densidade da Normal. */
export function densidade(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Função erro (série só com termos positivos). */
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

/** Função de distribuição da Normal. */
export function cdf(x, mu = 0, sigma = 1) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

/** P(μ−kσ < X < μ+kσ) para a Normal: 0,6827 (k=1) e 0,9545 (k=2). */
export const normalDentro = (k) => cdf(k) - cdf(-k);

/** Lança n dados: faces 1 a 6. */
export function lancar(rng, n) {
  const faces = [];
  for (let i = 0; i < n; i++) faces.push(1 + Math.floor(rng() * 6));
  return faces;
}

// ---------- ajudas ----------

let contador = 0;
const num = (x, casas = 2) => M.fmt(x, casas);

/** Número com vírgula, sem zeros finais. */
function numLivre(x, casas = 2) {
  const s = M.fmt(x, casas);
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s;
}

function definirTexto(el, t) {
  if (el.textContent !== t) el.textContent = t;
}

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function dado(face) {
  const g = criar('svg', { class: 'dad-dado', viewBox: '0 0 30 30', 'aria-hidden': 'true', focusable: 'false' });
  g.append(criar('rect', { class: 'dad-dado-corpo', x: 1.5, y: 1.5, width: 27, height: 27, rx: 6 }));
  for (const i of PIPS[face]) {
    g.append(criar('circle', { class: 'dad-pip', cx: 7.5 + (i % 3) * 7.5, cy: 7.5 + Math.floor(i / 3) * 7.5, r: 2.7 }));
  }
  return g;
}

// ---------- geometria do desenho ----------

const VB_W = 336;
const VB_H = 262;
const ML = 46;
const MR = 10;
const TOPO = 16;
const BASE = 196;
const FS = 14;

const MODOS = [
  { id: 'soma', rotulo: 'Soma' },
  { id: 'media', rotulo: 'Média' },
];

/** Passo "bonito" para os eixos. */
function passoBonito(maximo, alvo, lista) {
  for (const p of lista) if (maximo / p <= alvo) return p;
  return lista[lista.length - 1];
}

export async function montar(el, opcoes = {}) {
  const uid = `dad${++contador}`;
  const rng = opcoes.rng || M.criarRng();

  const est = {
    n: 6,
    modo: 'soma',
    curva: true,
    cont: new Map(), // soma -> nº de vezes
    total: 0,
    somaObs: 0,
    ultimo: null, // faces do último lançamento
    aviso: '',
  };

  const raiz = document.createElement('div');
  raiz.className = 'widget dad';
  raiz.innerHTML = `
    <div class="controlos dad-controlos">
      <div class="controlo">
        <label for="${uid}-n">Número de dados n: <output for="${uid}-n" class="dad-out-n"></output></label>
        <input type="range" id="${uid}-n" min="1" max="12" step="1" value="${est.n}">
      </div>
      <div class="controlo">
        <span class="controlo__rotulo" id="${uid}-eixo">O eixo horizontal mostra</span>
        <div class="chips dad-modos" role="group" aria-labelledby="${uid}-eixo"></div>
      </div>
    </div>
    <div class="dad-lugar-svg"></div>
    <p class="dad-legenda">
      <span class="dad-leg"><svg class="dad-leg-s" viewBox="0 0 26 16" aria-hidden="true" focusable="false"><rect class="dad-barra" x="3" y="3" width="20" height="11"/></svg>Distribuição exata (barras)</span>
      <span class="dad-leg dad-leg-curva"><svg class="dad-leg-s" viewBox="0 0 26 16" aria-hidden="true" focusable="false"><line class="dad-curva" x1="1" y1="8" x2="25" y2="8"/></svg>Curva Normal (traço contínuo)</span>
      <span class="dad-leg"><svg class="dad-leg-s" viewBox="0 0 26 16" aria-hidden="true" focusable="false"><path class="dad-obs" d="M13 2 L20 8 L13 14 L6 8 Z"/></svg>Frequências observadas (losangos)</span>
    </p>
    <p class="dad-frase" aria-live="polite"></p>
    <div class="dad-opcoes">
      <label class="dad-caixa"><input type="checkbox" class="dad-chk" checked> Mostrar a curva Normal</label>
    </div>
    <div class="leituras dad-leituras-mu" aria-live="polite">
      <div class="leitura"><span class="leitura__rotulo">Valor médio da soma</span><span class="leitura__valor dad-mu"></span></div>
      <div class="leitura"><span class="leitura__rotulo">Desvio-padrão da soma</span><span class="leitura__valor dad-sg"></span></div>
      <div class="leitura dad-l-media" hidden><span class="leitura__rotulo">Na média dos dados</span><span class="leitura__valor dad-mm"></span></div>
    </div>
    <div class="dad-botoes" role="group" aria-label="Lançar os dados">
      <button type="button" class="botao dad-b1"></button>
      <button type="button" class="botao botao--suave dad-b100" aria-label="Lançar a experiência 100 vezes">×100</button>
      <button type="button" class="botao botao--suave dad-b1000" aria-label="Lançar a experiência 1000 vezes">×1000</button>
      <button type="button" class="botao botao--suave dad-limpar">Limpar</button>
    </div>
    <div class="dad-faces" aria-hidden="true"></div>
    <div class="leituras dad-leituras-sim" aria-live="polite">
      <div class="leitura"><span class="leitura__rotulo">Lançamentos feitos</span><span class="leitura__valor dad-nlanc"></span></div>
      <div class="leitura"><span class="leitura__rotulo dad-rot-obs"></span><span class="leitura__valor dad-obs-media"></span></div>
      <div class="leitura dad-l-ultimo"><span class="leitura__rotulo">Último lançamento</span><span class="leitura__valor dad-ultimo"></span></div>
    </div>
    <p class="dad-estado nota" aria-live="polite"></p>
    <div class="tabela-rolante">
      <table class="tabela dad-tab" aria-live="polite">
        <caption class="sr-only">Proporção de resultados perto da média</caption>
        <thead><tr><th scope="col">Zona</th><th scope="col">Exata</th><th scope="col">Observada</th><th scope="col">Normal</th></tr></thead>
        <tbody>
          <tr><th scope="row">Dentro de μ ± σ</th><td class="dad-e1"></td><td class="dad-o1"></td><td class="dad-n1"></td></tr>
          <tr><th scope="row">Dentro de μ ± 2σ</th><td class="dad-e2"></td><td class="dad-o2"></td><td class="dad-n2"></td></tr>
        </tbody>
      </table>
    </div>
    <p class="nota">Como a soma só toma valores inteiros, as proporções exatas não coincidem com 0,6827 e 0,9545, mas aproximam-se à medida que n aumenta.</p>
  `;
  el.textContent = '';
  el.append(raiz);
  const q = (s) => raiz.querySelector(s);

  const zonaModos = q('.dad-modos');
  for (const m of MODOS) {
    zonaModos.append(Object.assign(document.createElement('button'), {
      type: 'button', className: 'chip', textContent: m.rotulo,
    }));
    zonaModos.lastChild.dataset.modo = m.id;
    zonaModos.lastChild.setAttribute('aria-pressed', 'false');
  }

  // ---------- SVG ----------
  const svg = criar('svg', {
    class: 'figura figura--fixa dad-svg',
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': '',
  });
  const gGrade = criar('g');
  const gBarras = criar('g');
  const curva = criar('path', { class: 'dad-curva', fill: 'none' });
  const gMu = criar('g');
  const gObs = criar('g');
  const eixo = criar('line', { class: 'dad-eixo', x1: ML, y1: BASE, x2: VB_W - MR, y2: BASE });
  svg.append(gGrade, gBarras, curva, gMu, eixo, gObs);
  q('.dad-lugar-svg').append(svg);

  // ---------- desenho ----------

  function desenhar() {
    const { n } = est;
    const dist = distribuicaoSoma(n);
    const mu = mediaSoma(n);
    const sg = desvioSoma(n);
    const media = est.modo === 'media';
    const k = media ? n : 1; // converte soma em posição no eixo: x = s / k
    const x0 = (n - 0.5) / k;
    const x1 = (6 * n + 0.5) / k;
    const pxX = (x) => ML + ((x - x0) / (x1 - x0)) * (VB_W - ML - MR);
    const larguraBarra = (VB_W - ML - MR) / (5 * n + 1);

    const freq = new Map();
    let fmax = 0;
    if (est.total) {
      for (const [s, c] of est.cont) {
        const f = c / est.total;
        freq.set(s, f);
        if (f > fmax) fmax = f;
      }
    }
    const pmax = Math.max(...dist.map((d) => d.p));
    const alto = Math.max(pmax, densidade(mu, mu, sg), fmax);
    const passoY = passoBonito(alto, 5, [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5]);
    const ymax = Math.ceil(alto / passoY - 1e-9) * passoY;
    const casasY = passoY < 0.1 ? 2 : 1;
    const pxY = (p) => BASE - (p / ymax) * (BASE - TOPO);

    gGrade.textContent = '';
    for (let v = 0; v <= ymax + 1e-9; v += passoY) {
      gGrade.append(
        criar('line', { class: 'dad-grelha', x1: ML, y1: pxY(v), x2: VB_W - MR, y2: pxY(v) }),
        criar('text', { class: 'dad-eixo-t', x: ML - 5, y: pxY(v) + 5, 'text-anchor': 'end' }, [num(v, casasY)]),
      );
    }
    gGrade.append(criar('text', {
      class: 'dad-eixo-t', transform: `translate(12 ${(TOPO + BASE) / 2}) rotate(-90)`, 'text-anchor': 'middle',
    }, ['probabilidade']));

    // eixo x
    const marcas = [];
    if (media) {
      for (let v = 1; v <= 6; v++) marcas.push(v);
    } else {
      const p = passoBonito(5 * n, 8, [1, 2, 5, 10]);
      for (let s = Math.ceil(n / p) * p; s <= 6 * n; s += p) marcas.push(s);
      if (!marcas.includes(n) && n < marcas[0] - p / 2) marcas.unshift(n);
    }
    for (const v of marcas) {
      gGrade.append(
        criar('line', { class: 'dad-tique', x1: pxX(v), y1: BASE, x2: pxX(v), y2: BASE + 5 }),
        criar('text', { class: 'dad-eixo-t', x: pxX(v), y: BASE + 21, 'text-anchor': 'middle' }, [num(v, 0)]),
      );
    }
    gGrade.append(criar('text', {
      class: 'dad-eixo-t', x: (ML + VB_W - MR) / 2, y: BASE + 46, 'text-anchor': 'middle',
    }, [media ? 'Média dos n dados (S ÷ n)' : 'Soma S dos n dados']));

    // barras
    gBarras.textContent = '';
    for (const d of dist) {
      const xc = pxX(d.s / k);
      const y = pxY(d.p);
      const lb = Math.max(1, larguraBarra - (larguraBarra > 5 ? 1.2 : 0.6));
      gBarras.append(criar('rect', {
        class: 'dad-barra', x: xc - lb / 2, y, width: lb, height: Math.max(0, BASE - y),
      }));
    }

    // curva Normal: altura = densidade da soma (o passo entre somas é 1; na média, a barra
    // tem a mesma altura, pois p(s) ≈ f(s)·1)
    curva.style.display = est.curva ? '' : 'none';
    if (est.curva) {
      const pts = [];
      const N = 160;
      for (let i = 0; i <= N; i++) {
        const x = x0 + ((x1 - x0) * i) / N;
        pts.push(`${pxX(x).toFixed(1)} ${pxY(densidade(x * k, mu, sg)).toFixed(1)}`);
      }
      curva.setAttribute('d', 'M' + pts.join(' L'));
    }
    q('.dad-leg-curva').hidden = !est.curva;

    // μ
    gMu.textContent = '';
    gMu.append(
      criar('line', { class: 'dad-mu-linha', x1: pxX(mu / k), y1: TOPO - 4, x2: pxX(mu / k), y2: BASE }),
    );

    // frequências observadas
    gObs.textContent = '';
    for (const [s, f] of freq) {
      const cx = pxX(s / k);
      const cy = pxY(f);
      gObs.append(criar('path', { class: 'dad-obs', d: `M${cx} ${cy - 5} L${cx + 4.5} ${cy} L${cx} ${cy + 5} L${cx - 4.5} ${cy} Z` }));
    }

    // texto alternativo
    const topo = dist.reduce((a, b) => (b.p > a.p ? b : a));
    let aria = `Gráfico de barras da distribuição exata da ${media ? 'média' : 'soma'} de ${n} ${n === 1 ? 'dado' : 'dados'}. `
      + `Valores de ${media ? num(1, 0) + ' a 6' : n + ' a ' + 6 * n}, `
      + `o mais provável é ${num(media ? topo.s / n : topo.s, media ? 2 : 0)} com probabilidade ${num(topo.p, 4)}. `
      + `Centro em ${numLivre(media ? 3.5 : mu, 1)}. `;
    aria += est.curva ? 'Está sobreposta a curva Normal correspondente. ' : 'A curva Normal está escondida. ';
    aria += est.total ? `Losangos: frequências relativas de ${est.total} lançamentos.` : 'Ainda sem lançamentos.';
    svg.setAttribute('aria-label', aria);
  }

  // ---------- texto ----------

  function frase() {
    if (est.n === 1) return 'Com um dado, todas as somas têm a mesma probabilidade: a tabela é plana.';
    if (est.n === 2) return 'Com dois dados o 7 é o mais provável (6 maneiras em 36).';
    return 'Quanto mais dados, mais o gráfico se parece com uma curva Normal.';
  }

  function atualizar() {
    const { n } = est;
    const media = est.modo === 'media';
    const mu = mediaSoma(n);
    const sg = desvioSoma(n);
    q(`#${uid}-n`).value = String(n);
    definirTexto(q('.dad-out-n'), String(n));
    for (const c of raiz.querySelectorAll('.dad-modos .chip')) {
      c.setAttribute('aria-pressed', String(c.dataset.modo === est.modo));
    }
    q('.dad-chk').checked = est.curva;
    definirTexto(q('.dad-frase'), frase());

    definirTexto(q('.dad-mu'), `μ = 3,5·n = ${numLivre(mu, 1)}`);
    definirTexto(q('.dad-sg'), `σ = √(35n/12) ≈ ${num(sg, 2)}`);
    q('.dad-l-media').hidden = !media;
    definirTexto(q('.dad-mm'), `μ = 3,5 e σ = √(35/(12n)) ≈ ${num(sg / n, 2)}`);

    definirTexto(q('.dad-b1'), n === 1 ? 'Lançar o dado' : `Lançar os ${n} dados`);
    definirTexto(q('.dad-nlanc'), String(est.total));
    definirTexto(q('.dad-rot-obs'), media ? 'Média observada média' : 'Soma observada média');
    const obs = est.total ? est.somaObs / est.total : null;
    definirTexto(q('.dad-obs-media'), obs === null ? 'sem dados' : num(media ? obs / n : obs, 2));
    if (est.ultimo) {
      const s = est.ultimo.reduce((a, b) => a + b, 0);
      definirTexto(q('.dad-ultimo'), media ? `média ${num(s / n, 2)}` : `soma ${s}`);
    } else {
      definirTexto(q('.dad-ultimo'), 'nenhum');
    }
    q('.dad-faces').replaceChildren(...(est.ultimo || []).map(dado));
    q('.dad-faces').hidden = !est.ultimo;
    q('.dad-faces').setAttribute('data-faces', est.ultimo ? est.ultimo.join(',') : '');
    definirTexto(q('.dad-estado'), est.aviso);

    // proporções
    for (const kk of [1, 2]) {
      definirTexto(q(`.dad-e${kk}`), num(proporcaoDentro(n, kk), 4));
      definirTexto(q(`.dad-n${kk}`), num(normalDentro(kk), 4));
      let o = 'sem dados';
      if (est.total) {
        let dentro = 0;
        for (const [s, c] of est.cont) if (Math.abs(s - mu) < kk * sg - 1e-9) dentro += c;
        o = num(dentro / est.total, 4);
      }
      definirTexto(q(`.dad-o${kk}`), o);
    }

    desenhar();
  }

  // ---------- simulação ----------

  function lancarVezes(vezes) {
    let faces = null;
    for (let i = 0; i < vezes; i++) {
      faces = lancar(rng, est.n);
      const s = faces.reduce((a, b) => a + b, 0);
      est.cont.set(s, (est.cont.get(s) || 0) + 1);
      est.somaObs += s;
      est.total++;
    }
    est.ultimo = faces;
    est.aviso = vezes === 1 ? '' : `Lançaste mais ${vezes} vezes.`;
    atualizar();
  }

  function limpar(aviso = '') {
    est.cont = new Map();
    est.total = 0;
    est.somaObs = 0;
    est.ultimo = null;
    est.aviso = aviso;
  }

  q('.dad-b1').addEventListener('click', () => lancarVezes(1));
  q('.dad-b100').addEventListener('click', () => lancarVezes(100));
  q('.dad-b1000').addEventListener('click', () => lancarVezes(1000));
  q('.dad-limpar').addEventListener('click', () => {
    limpar('Lançamentos apagados.');
    atualizar();
  });
  q(`#${uid}-n`).addEventListener('input', (e) => {
    const novo = Number(e.target.value);
    if (novo === est.n) return;
    est.n = novo;
    limpar(est.total ? 'Mudaste o número de dados: os lançamentos anteriores foram apagados.' : '');
    atualizar();
  });
  for (const c of raiz.querySelectorAll('.dad-modos .chip')) {
    c.addEventListener('click', () => {
      est.modo = c.dataset.modo;
      atualizar();
    });
  }
  q('.dad-chk').addEventListener('change', (e) => {
    est.curva = e.target.checked;
    atualizar();
  });

  atualizar();
}
