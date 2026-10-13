// grafico: gráficos cartesianos em SVG, sem dependências. Usado pelos widgets do tema
// «Exponenciais e logaritmos» (e por qualquer outro que precise de um gráfico y = f(x)).
//
// ---------- Uso rápido ----------
//   import { criarGrafico, arrastarNaCurva, CORES } from '../../assets/motor/grafico.js';
//   const g = criarGrafico({ x: [-3, 3], y: [-1, 6], rotuloX: 'x', rotuloY: 'y', aria: 'Gráfico de 2^x' });
//   g.retaHorizontal(0, { rotulo: 'y = 0' });          // assíntota a tracejado
//   g.curva('2^x', { cor: 'exp', id: 'f' });            // string (sintaxe de avaliar) ou x => número
//   g.ponto(0, 1, { rotulo: '(0, 1)' });
//   el.append(g.svg);                                   // g.svg já tem a classe «figura»
//
// ---------- Exports ----------
//   criarGrafico(opcoes) -> g          cria o gráfico (ver abaixo)
//   arrastarNaCurva(g, fn, opcoes)     ponto que se arrasta (rato, toque, teclado) sobre uma curva
//   CORES                              tokens de cor: CORES.exp, .log, .id, .tg, .der, .assint, .zona, ...
//   amostrarCurva(fn, a, b, opcoes)    amostragem adaptativa em coordenadas de dados (sem DOM)
//   marcasBonitas(min, max, alvo)      { passo, valores } com passos 1, 2, 5 × 10^k
//   passoBonito(intervalo, alvo)       só o passo
//   formatarNumero(v, casas)           1234.5 -> «1234,5», -2 -> «−2» (vírgula e menos «−»)
//
// ---------- criarGrafico(opcoes) ----------
//   x: [xmin, xmax], y: [ymin, ymax]   a janela (obrigatório)
//   largura = 340                      largura do viewBox (o SVG ocupa a largura do contentor)
//   altura                             altura do viewBox (por defeito 0,78 × largura)
//   igual = false                      true: a escala é igual nos dois eixos (a altura sai da janela)
//   rotuloX = 'x', rotuloY = 'y'       nomes dos eixos ('' para não escrever)
//   grelha = true                      grelha suave nas marcas
//   marcasX, marcasY                   undefined: automáticas; false: sem números; ou lista de
//                                      números / { valor, texto } (ex.: [{ valor: 2.718, texto: 'e' }])
//   setas = true                       setas nas pontas dos eixos
//   fonte = 12                         tamanho do texto, em unidades do viewBox
//   margem = { esq, dir, cima, baixo } margens do viewBox (por defeito ajustam-se à janela)
//   aria                               descrição do desenho (role="img"; passa a "group" se
//                                      houver pontos arrastáveis, para o teclado funcionar)
//
// O objeto g:
//   g.svg                              <svg class="figura figura--fixa"> pronto a inserir
//   g.X(x) g.Y(y)                      dados -> unidades do viewBox       (escala atual)
//   g.x(px) g.y(py)                    unidades do viewBox -> dados
//   g.janela                           { x: [xmin, xmax], y: [ymin, ymax] } (cópia)
//   g.definirJanela(x, y)              muda a janela e redesenha tudo (aceita também ({ x, y }))
//   g.curva(fn, opcoes)                fn: string ou x => número (NaN/±∞/exceção = fora do domínio)
//   g.retaVertical(x, opcoes)          tracejada por defeito (cor das assíntotas)
//   g.retaHorizontal(y, opcoes)
//   g.reta(declive, ordenada, opcoes)  y = declive·x + ordenada, cortada pela janela
//   g.segmento(x1, y1, x2, y2, opcoes)
//   g.ponto(x, y, opcoes)              círculo cheio (oco: true para ponto excluído)
//   g.rotulo(x, y, texto, opcoes)      texto simples (sem KaTeX) ancorado a um ponto dos dados
//   g.area(fn, a, b, opcoes)           sombreado entre a curva e o eixo (ou a curva opcoes.entre)
//   g.limpar(camada)                   remove os itens de uma camada ('curvas', 'retas', 'areas',
//                                      'pontos', 'texto', 'controlos'); sem argumento limpa todas
//                                      menos 'controlos'
//   g.camadas                          { areas, retas, curvas, pontos, texto, controlos }: os <g>
//                                      (por esta ordem, de baixo para cima; a base fica por baixo)
//   g.item(id)                         devolve o item criado com opcoes.id
//   g.redesenhar()                     recalcula tudo (depois de mudares algo que as fn leem)
//   g.definirAria(texto)
//
// Todos os métodos de desenho devolvem um item { el, desenhar(), remover(), ... }:
//   curva:  item.atualizar(novaFn?) volta a amostrar; item.tracos = n.º de traços (partes)
//   ponto:  item.x, item.y, item.mover(x, y, chamar = true), item.definirRotulo(texto)
//
// Opções comuns: cor ('exp' | 'log' | 'id' | 'tg' | 'der' | 'assint' | 'zona' ou qualquer cor CSS),
// espessura, tracejado (true | '6 5' | false), id (fica em data-id), camada (para trocar a camada),
// rotulo (texto junto da reta/ponto/curva), posRotulo.
//   curva:  de, ate (limites do x), rotulo (junto ao fim direito da curva)
//   retaVertical: rotulo, posRotulo 'cima' | 'baixo'     retaHorizontal: rotulo, posRotulo 'dir' | 'esq'
//   ponto:  raio = 4.5, oco, rotulo, posRotulo 'auto' | 'dir' | 'esq' | 'cima' | 'baixo', guias (tracejado
//           até aos eixos), arrastavel, restringir ('x' | 'y' | { x:[a,b], y:[c,d] } | (x, y) => [x, y]),
//           aoMover(x, y, item), passoTeclado (número ou [px, py]), aria (rótulo para leitores de ecrã)
//   rotulo: ancora 'start' | 'middle' | 'end', dx, dy (em unidades do viewBox), tam, cor
//   area:   entre (número, string ou fn; por defeito 0), cor ('zona'), opacidade
//
// Pontos arrastáveis: rato, toque e caneta (pointer events, touch-action: none só no ponto, por isso
// a página continua a deslizar noutros sítios) e teclado (a ponta fica focável com tabindex="0",
// role="slider"; setas movem, Shift multiplica por 5). Têm alvo de toque de 44 unidades.
//
// arrastarNaCurva(g, fn, { xmin, xmax, x0, aoMover(x, y), passoTeclado, cor, raio, aria, textoAria(x, y) })
//   -> { mover(x, chamar = true), el, ponto, x, y }   (x e y são getters)
//   Carregar ou arrastar em qualquer sítio do gráfico leva o ponto para esse x (o y vem da curva).
//   Teclado: setas ±passoTeclado (Shift ×5), PageUp/PageDown ×10, Home/End vão aos extremos.
//   NÃO chama aoMover ao criar: chama controlo.mover(controlo.x) se quiseres a primeira leitura.
//
// Como a curva é desenhada: amostra-se com N pontos e refina-se onde a linha se desvia mais de
// 0,25 unidades; onde a função deixa de ser finita (domínio) refina-se até à fronteira; onde há um
// salto maior que a altura da janela (assíntotas de 1/x, tan) parte-se o traço. Depois corta-se na
// janela (Liang-Barsky), por isso nunca há coordenadas gigantes no SVG.
//
// Estilo: tudo com atributos inline (style="stroke: var(--c-exp, #1d5f94)"), por isso o módulo
// funciona sem CSS. O texto herda a família de letra de «.figura text» (estilo.css) e tem halo branco.
// Os ids de clipPath são únicos por gráfico (podes ter vários na mesma página).

import { criar, pontoDoEvento } from './svg.js';
import { criarFuncao } from './matematica.js';

export const CORES = {
  exp: 'var(--c-exp, #1d5f94)',
  log: 'var(--c-log, #b4452f)',
  id: 'var(--c-id, #6b5a4e)',
  tg: 'var(--c-tg, #2d7a4b)',
  der: 'var(--c-der, #7a3f98)',
  assint: 'var(--c-assint, #6b5a4e)',
  zona: 'var(--c-zona, rgba(199, 154, 63, 0.30))',
  eixo: 'var(--c-eixo, #6b5a4e)',
  grelha: 'var(--c-grelha, #e6dbcf)',
  ponto: 'var(--c-ponto, #241710)',
  texto: 'var(--tinta, #2a1c13)',
};

const FONTE = 'var(--sans, system-ui, sans-serif)';
const HALO = 'paint-order:stroke;stroke:var(--papel, #fff);stroke-width:3px;stroke-linejoin:round;';
const CAMADAS = ['areas', 'retas', 'curvas', 'pontos', 'texto', 'controlos'];
const MAX_PROF = 14; // profundidade máxima do refinamento (intervalo / 16384)
const TOL_PX = 0.25; // desvio máximo, em unidades do viewBox, entre a curva e a corda
const MAX_PONTOS = 9000;

let contador = 0;

const cor = (c, padrao) => (c ? CORES[c] || c : padrao);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const dec2 = (v) => +v.toFixed(2);
const traco = (t, padrao) => (t === true ? '6 5' : t === false || t === undefined || t === null ? padrao : String(t));

// ---------- Números e marcas ----------

/** 1234.5 -> «1234,5»; -2 -> «−2». Sem zeros à direita. */
export function formatarNumero(v, casas = 2) {
  if (!Number.isFinite(v)) return '';
  const n = Number(v.toFixed(casas));
  return String(Object.is(n, -0) ? 0 : n).replace('.', ',').replace('-', '−');
}

/** Passo «bonito» (1, 2, 5 × 10^k) para ter perto de `alvo` marcas num intervalo. */
export function passoBonito(intervalo, alvo = 7) {
  const bruto = intervalo / Math.max(1, alvo);
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / pot;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pot;
}

/** { passo, valores } com os múltiplos do passo bonito dentro de [min, max]. */
export function marcasBonitas(min, max, alvo = 7) {
  const passo = passoBonito(max - min, alvo);
  const valores = [];
  const k0 = Math.ceil(min / passo - 1e-9);
  const k1 = Math.floor(max / passo + 1e-9);
  for (let k = k0; k <= k1; k++) valores.push(+(k * passo).toPrecision(12) + 0);
  return { passo, valores };
}

const casasDoPasso = (passo) => (passo >= 1 ? 0 : Math.min(8, Math.ceil(-Math.log10(passo) - 1e-9)));

// ---------- Amostragem e corte (puros, sem DOM) ----------

/**
 * Amostra fn em [a, b] e devolve a lista de traços [[x, y], ...] em coordenadas de dados.
 * Parte o traço onde fn não é finita (NaN, ±∞, exceção) e onde há saltos maiores que
 * `altura` (assíntotas). opcoes: { n = 120, escalaY = 1 (unidades do viewBox por unidade de y),
 * altura = Infinity (altura da janela em y) }.
 */
export function amostrarCurva(fn, a, b, opcoes = {}) {
  const { n = 120, escalaY = 1, altura = Infinity } = opcoes;
  const val = (x) => {
    let y;
    try { y = Number(fn(x)); } catch { y = NaN; }
    return Number.isFinite(y) ? limitar(y, -1e12, 1e12) : NaN;
  };
  const pts = [];
  const sub = (xa, ya, xb, yb, prof) => {
    const fa = ya === ya;
    const fb = yb === yb;
    if (prof >= MAX_PROF || pts.length > MAX_PONTOS) {
      if (fa && fb && Math.abs(yb - ya) > altura) pts.push(null); // salto: assíntota
      pts.push([xb, yb]);
      return;
    }
    const xm = (xa + xb) / 2;
    const ym = val(xm);
    const fm = ym === ym;
    if (!fa && !fb && !fm) { pts.push([xb, yb]); return; }
    const dividir = fa !== fb || fa !== fm || Math.abs(ym - (ya + yb) / 2) * escalaY > TOL_PX;
    if (dividir) {
      sub(xa, ya, xm, ym, prof + 1);
      sub(xm, ym, xb, yb, prof + 1);
    } else {
      pts.push([xb, yb]);
    }
  };
  let xa = a;
  let ya = val(a);
  pts.push([xa, ya]);
  for (let i = 1; i <= n; i++) {
    const xb = i === n ? b : a + ((b - a) * i) / n;
    const yb = val(xb);
    sub(xa, ya, xb, yb, 0);
    xa = xb;
    ya = yb;
  }
  const tracos = [];
  let atual = [];
  const fechar = () => { if (atual.length > 1) tracos.push(atual); atual = []; };
  for (const p of pts) {
    if (p === null || p[1] !== p[1]) fechar();
    else atual.push(p);
  }
  fechar();
  return tracos;
}

/** Liang-Barsky: [t0, t1] da parte do segmento dentro do retângulo, ou null. */
function cortarSegmento(x0, y0, x1, y1, L, T, R, B) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lados = [[-dx, x0 - L], [dx, R - x0], [-dy, y0 - T], [dy, B - y0]];
  for (const [p, q] of lados) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [t0, t1];
}

/** Corta uma linha poligonal [[px, py], ...] ao retângulo; devolve uma lista de linhas. */
function cortarLinha(pts, L, T, R, B) {
  const saida = [];
  let atual = null;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const r = cortarSegmento(x0, y0, x1, y1, L, T, R, B);
    if (!r) {
      if (atual) { saida.push(atual); atual = null; }
      continue;
    }
    const [ta, tb] = r;
    if (!atual || ta > 0) {
      if (atual) saida.push(atual);
      atual = [[x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta]];
    }
    atual.push([x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb]);
    if (tb < 1) { saida.push(atual); atual = null; }
  }
  if (atual) saida.push(atual);
  return saida.filter((l) => l.length > 1);
}

const caminho = (linhas) => linhas.map((l) => l.map(([x, y], i) => `${i ? 'L' : 'M'}${dec2(x)} ${dec2(y)}`).join('')).join('');

// ---------- O gráfico ----------

export function criarGrafico(op = {}) {
  if (!Array.isArray(op.x) || !Array.isArray(op.y)) throw new Error('criarGrafico: faltam x e y');
  const janela = { x: [op.x[0], op.x[1]], y: [op.y[0], op.y[1]] };
  if (!(janela.x[1] > janela.x[0]) || !(janela.y[1] > janela.y[0])) throw new Error('criarGrafico: janela inválida');
  const uid = `gf${++contador}${Math.random().toString(36).slice(2, 5)}`;
  const W = op.largura || 340;
  const fs = op.fonte || 12;
  const igual = !!op.igual;
  const setas = op.setas !== false;
  const grelha = op.grelha !== false;
  const rotuloX = op.rotuloX === undefined ? 'x' : op.rotuloX;
  const rotuloY = op.rotuloY === undefined ? 'y' : op.rotuloY;
  let H = op.altura || Math.round(W * 0.78);
  const m = { L: 0, T: 0, pw: 0, ph: 0, mL: 0, mR: 0, mT: 0, mB: 0 };

  const clipId = `${uid}-clip`;
  const clipRect = criar('rect', {});
  const gBase = criar('g', { 'data-camada': 'base' });
  const camadas = {};
  const registo = {};
  for (const nome of CAMADAS) {
    const recorta = nome === 'areas' || nome === 'retas' || nome === 'curvas';
    camadas[nome] = criar('g', { 'data-camada': nome, 'clip-path': recorta ? `url(#${clipId})` : undefined });
    registo[nome] = new Set();
  }
  const svg = criar('svg', {
    class: 'figura figura--fixa',
    role: 'img',
    preserveAspectRatio: 'xMidYMid meet',
  }, [criar('defs', {}, [criar('clipPath', { id: clipId }, [clipRect])]), gBase, ...CAMADAS.map((c) => camadas[c])]);
  const porId = new Map();

  // ----- geometria -----
  const X = (x) => m.L + ((x - janela.x[0]) / (janela.x[1] - janela.x[0])) * m.pw;
  const Y = (y) => m.T + ((janela.y[1] - y) / (janela.y[1] - janela.y[0])) * m.ph;
  const xDe = (px) => janela.x[0] + ((px - m.L) / m.pw) * (janela.x[1] - janela.x[0]);
  const yDe = (py) => janela.y[1] - ((py - m.T) / m.ph) * (janela.y[1] - janela.y[0]);
  const eixoX = () => limitar(0, janela.x[0], janela.x[1]); // x onde passa o eixo dos yy
  const eixoY = () => limitar(0, janela.y[0], janela.y[1]); // y onde passa o eixo dos xx

  function layout() {
    const mg = op.margem || {};
    m.mL = mg.esq ?? (eixoX() === janela.x[0] ? 38 : 12);
    m.mR = mg.dir ?? 16;
    m.mT = mg.cima ?? 16;
    m.mB = mg.baixo ?? (eixoY() === janela.y[0] ? 26 : 12);
    m.L = m.mL;
    m.T = m.mT;
    m.pw = W - m.mL - m.mR;
    if (igual) {
      m.ph = (m.pw * (janela.y[1] - janela.y[0])) / (janela.x[1] - janela.x[0]);
      H = Math.round(m.ph + m.mT + m.mB);
    } else {
      m.ph = H - m.mT - m.mB;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    clipRect.setAttribute('x', m.L);
    clipRect.setAttribute('y', m.T);
    clipRect.setAttribute('width', m.pw);
    clipRect.setAttribute('height', m.ph);
  }

  const R = () => m.L + m.pw;
  const B = () => m.T + m.ph;
  const dentroPx = (px, py, folga = 0) => px >= m.L - folga && px <= R() + folga && py >= m.T - folga && py <= B() + folga;

  // ----- texto -----
  function texto(x, y, txt, { ancora = 'start', cor: c = CORES.texto, tam = fs, halo = true, peso } = {}) {
    return criar('text', {
      x: dec2(x),
      y: dec2(y),
      'text-anchor': ancora,
      'font-size': tam,
      'font-weight': peso,
      style: `fill:${c};font-family:${FONTE};${halo ? HALO : ''}`,
    }, [txt]);
  }
  const largTexto = (txt, tam = fs) => String(txt).length * tam * 0.58;

  // ----- base: grelha, eixos, marcas, números e nomes -----
  function marcasDe(opcao, min, max, alvo) {
    if (opcao === false) return { lista: [], passo: 1, auto: false };
    if (Array.isArray(opcao)) {
      return { lista: opcao.map((v) => (typeof v === 'number' ? { valor: v } : v)).filter((v) => v.valor >= min && v.valor <= max), passo: 1, auto: false };
    }
    const { passo, valores } = marcasBonitas(min, max, alvo);
    return { lista: valores.map((valor) => ({ valor })), passo, auto: true };
  }

  function desenharBase() {
    gBase.replaceChildren();
    const [x0, x1] = janela.x;
    const [y0, y1] = janela.y;
    const xe = eixoX();
    const ye = eixoY();
    const px0 = X(xe);
    const py0 = Y(ye);
    const L = m.L;
    const T = m.T;
    const Rr = R();
    const Bb = B();
    const mx = marcasDe(op.marcasX, x0, x1, Math.max(2, Math.round(m.pw / 56)));
    const my = marcasDe(op.marcasY, y0, y1, Math.max(2, Math.round(m.ph / 42)));
    const estiloEixo = `stroke:${CORES.eixo}`;

    if (grelha) {
      const gr = criar('g', { style: `stroke:${CORES.grelha}`, 'stroke-width': 1, fill: 'none' });
      for (const { valor } of mx.lista) if (Math.abs(X(valor) - px0) > 0.5) gr.append(criar('line', { x1: dec2(X(valor)), x2: dec2(X(valor)), y1: T, y2: Bb }));
      for (const { valor } of my.lista) if (Math.abs(Y(valor) - py0) > 0.5) gr.append(criar('line', { x1: L, x2: Rr, y1: dec2(Y(valor)), y2: dec2(Y(valor)) }));
      gBase.append(gr);
    }

    // eixos (com setas fora da janela, nas margens)
    const folga = setas ? 11 : 0;
    gBase.append(
      criar('line', { x1: L, x2: Rr + (setas ? 5 : 0), y1: dec2(py0), y2: dec2(py0), style: estiloEixo, 'stroke-width': 1.5 }),
      criar('line', { x1: dec2(px0), x2: dec2(px0), y1: Bb, y2: T - (setas ? 5 : 0), style: estiloEixo, 'stroke-width': 1.5 }),
    );
    if (setas) {
      gBase.append(
        criar('polygon', { points: `${dec2(Rr + folga)},${dec2(py0)} ${dec2(Rr + 3)},${dec2(py0 - 3.8)} ${dec2(Rr + 3)},${dec2(py0 + 3.8)}`, style: `fill:${CORES.eixo}` }),
        criar('polygon', { points: `${dec2(px0)},${dec2(T - folga)} ${dec2(px0 - 3.8)},${dec2(T - 3)} ${dec2(px0 + 3.8)},${dec2(T - 3)}`, style: `fill:${CORES.eixo}` }),
      );
    }

    // marcas e números
    const estiloNum = { ancora: 'middle', cor: CORES.eixo, tam: fs };
    const decX = casasDoPasso(mx.passo);
    const decY = casasDoPasso(my.passo);
    for (const { valor, texto: t } of mx.lista) {
      const px = X(valor);
      if (xe === 0 && Math.abs(px - px0) < 1) continue;
      gBase.append(criar('line', { x1: dec2(px), x2: dec2(px), y1: dec2(py0 - 3.5), y2: dec2(py0 + 3.5), style: estiloEixo, 'stroke-width': 1.2 }));
      gBase.append(texto(px, py0 + fs + 4, t ?? formatarNumero(valor, mx.auto ? decX : 3), estiloNum));
    }
    for (const { valor, texto: t } of my.lista) {
      const py = Y(valor);
      if (ye === 0 && Math.abs(py - py0) < 1) continue;
      gBase.append(criar('line', { x1: dec2(px0 - 3.5), x2: dec2(px0 + 3.5), y1: dec2(py), y2: dec2(py), style: estiloEixo, 'stroke-width': 1.2 }));
      gBase.append(texto(px0 - 7, py + fs * 0.35, t ?? formatarNumero(valor, my.auto ? decY : 3), { ...estiloNum, ancora: 'end' }));
    }
    if (xe === 0 && ye === 0 && op.marcasX !== false && op.marcasY !== false) {
      gBase.append(texto(px0 - 6, py0 + fs + 3, '0', { ...estiloNum, ancora: 'end' }));
    }

    // nomes dos eixos
    if (rotuloX) gBase.append(texto(Rr - 2, py0 - 8, rotuloX, { ancora: 'end', cor: CORES.texto, tam: fs + 1 }));
    if (rotuloY) {
      const direita = xe < x1;
      gBase.append(texto(px0 + (direita ? 8 : -8), T + 11, rotuloY, { ancora: direita ? 'start' : 'end', cor: CORES.texto, tam: fs + 1 }));
    }
  }

  // ----- itens -----
  function registar(camada, item, el, desenhar, o = {}) {
    if (!registo[camada]) throw new Error(`camada desconhecida: ${camada}`);
    item.el = el;
    item.camada = camada;
    item.desenhar = desenhar;
    item.remover = () => {
      el.remove();
      registo[camada].delete(item);
      if (o.id && porId.get(o.id) === item) porId.delete(o.id);
    };
    if (o.id) {
      el.setAttribute('data-id', o.id);
      porId.set(o.id, item);
    }
    registo[camada].add(item);
    camadas[camada].append(el);
    desenhar();
    return item;
  }

  const comoFuncao = (f) => (typeof f === 'string' ? criarFuncao(f) : f);

  function tracosPx(fn, de, ate) {
    const a = Math.max(de ?? -Infinity, janela.x[0]);
    const b = Math.min(ate ?? Infinity, janela.x[1]);
    if (!(b > a)) return [];
    const altura = janela.y[1] - janela.y[0];
    const brutos = amostrarCurva(fn, a, b, { n: Math.max(60, Math.round(m.pw / 2.5)), escalaY: m.ph / altura, altura });
    const linhas = [];
    for (const t of brutos) linhas.push(...cortarLinha(t.map(([x, y]) => [X(x), Y(y)]), m.L - 1, m.T - 1, R() + 1, B() + 1));
    return linhas;
  }

  function curva(fn, o = {}) {
    const item = { fn: comoFuncao(fn), tracos: 0 };
    const c = cor(o.cor, CORES.exp);
    const path = criar('path', {
      fill: 'none',
      style: `stroke:${c}`,
      'stroke-width': o.espessura ?? 2.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-dasharray': traco(o.tracejado),
      'stroke-opacity': o.opacidade,
    });
    const el = o.rotulo ? criar('g', {}, [path]) : path;
    const rot = o.rotulo ? texto(0, 0, o.rotulo, { ancora: 'end', cor: c, tam: fs }) : null;
    if (rot) el.append(rot);
    const desenhar = () => {
      const linhas = tracosPx(item.fn, o.de, o.ate);
      item.tracos = linhas.length;
      path.setAttribute('d', caminho(linhas));
      path.setAttribute('data-tracos', linhas.length);
      if (rot) {
        // rótulo junto ao fim do último traço, ligeiramente acima
        const ult = linhas[linhas.length - 1];
        rot.style.display = ult ? '' : 'none';
        if (ult) {
          const [lx, ly] = ult[ult.length - 1];
          rot.setAttribute('x', dec2(Math.min(lx, R() - 3)));
          rot.setAttribute('y', dec2(limitar(ly - 8, m.T + fs, B() - 4)));
        }
      }
    };
    item.atualizar = (novaFn) => {
      if (novaFn) item.fn = comoFuncao(novaFn);
      desenhar();
    };
    return registar(o.camada || 'curvas', item, el, desenhar, o);
  }

  /** Linha reta entre dois pontos dos dados (já alargados para lá da janela quando é infinita). */
  function linha(calc, o, padrao, rotuloPos) {
    const c = cor(o.cor, padrao.cor);
    const path = criar('path', {
      fill: 'none',
      style: `stroke:${c}`,
      'stroke-width': o.espessura ?? padrao.espessura ?? 1.8,
      'stroke-linecap': 'round',
      'stroke-dasharray': traco(o.tracejado, padrao.tracejado),
    });
    const el = criar('g', {}, [path]);
    const rot = o.rotulo ? texto(0, 0, o.rotulo, { cor: c, tam: fs }) : null;
    if (rot) el.append(rot);
    const item = {};
    const desenhar = () => {
      const par = calc();
      const linhas = par ? cortarLinha([[X(par[0][0]), Y(par[0][1])], [X(par[1][0]), Y(par[1][1])]], m.L - 1, m.T - 1, R() + 1, B() + 1) : [];
      path.setAttribute('d', caminho(linhas));
      item.visivel = linhas.length > 0;
      if (rot) {
        rot.style.display = linhas.length ? '' : 'none';
        if (linhas.length) rotuloPos(rot, linhas[0], o);
      }
    };
    return registar(o.camada || 'retas', item, el, desenhar, o);
  }

  const AS = { cor: CORES.assint, tracejado: '6 5', espessura: 1.8 };

  function retaVertical(x, o = {}) {
    return linha(
      () => (x >= janela.x[0] && x <= janela.x[1] ? [[x, janela.y[0]], [x, janela.y[1]]] : null),
      o, AS,
      (rot, [[ax]], opc) => {
        const dir = ax + 6 + largTexto(opc.rotulo) <= R();
        rot.setAttribute('text-anchor', dir ? 'start' : 'end');
        rot.setAttribute('x', dec2(ax + (dir ? 6 : -6)));
        rot.setAttribute('y', dec2(opc.posRotulo === 'baixo' ? B() - 6 : m.T + fs + 2));
      },
    );
  }

  function retaHorizontal(y, o = {}) {
    return linha(
      () => (y >= janela.y[0] && y <= janela.y[1] ? [[janela.x[0], y], [janela.x[1], y]] : null),
      o, AS,
      (rot, [[, ay]], opc) => {
        const esq = opc.posRotulo === 'esq';
        rot.setAttribute('text-anchor', esq ? 'start' : 'end');
        rot.setAttribute('x', dec2(esq ? m.L + 6 : R() - 22)); // deixa livre o nome do eixo dos xx
        rot.setAttribute('y', dec2(ay - 6 < m.T + fs ? ay + fs + 3 : ay - 6));
      },
    );
  }

  function reta(declive, ordenada, o = {}) {
    const [x0, x1] = janela.x;
    return linha(
      () => [[x0 - 1, declive * (x0 - 1) + ordenada], [x1 + 1, declive * (x1 + 1) + ordenada]],
      o, { cor: CORES.id, espessura: 1.9 },
      (rot, l, opc) => {
        // junto à ponta direita da parte visível, um pouco acima
        const [bx, by] = l[l.length - 1];
        rot.setAttribute('text-anchor', 'end');
        rot.setAttribute('x', dec2(Math.min(bx, R()) - 4));
        rot.setAttribute('y', dec2(limitar(by + (declive > 0 ? 14 : -7), m.T + fs, B() - 4)));
      },
    );
  }

  function segmento(x1, y1, x2, y2, o = {}) {
    return linha(
      () => [[x1, y1], [x2, y2]],
      o, { cor: CORES.id, espessura: 1.9 },
      (rot, l) => {
        const [ax, ay] = l[0];
        const [bx, by] = l[l.length - 1];
        rot.setAttribute('x', dec2((ax + bx) / 2 + 6));
        rot.setAttribute('y', dec2((ay + by) / 2 - 6));
      },
    );
  }

  function area(fn, a, b, o = {}) {
    const item = { fn: comoFuncao(fn) };
    const c = cor(o.cor, CORES.zona);
    const path = criar('path', { style: `fill:${c};stroke:none`, 'fill-opacity': o.opacidade });
    const desenhar = () => {
      const base = o.entre === undefined ? () => 0 : typeof o.entre === 'number' ? () => o.entre : comoFuncao(o.entre);
      const lo = Math.max(a, janela.x[0]);
      const hi = Math.min(b, janela.x[1]);
      const folga = (janela.y[1] - janela.y[0]) * 2;
      const lim = (y) => limitar(y, janela.y[0] - folga, janela.y[1] + folga);
      let d = '';
      if (hi > lo) {
        const altura = janela.y[1] - janela.y[0];
        const tr = amostrarCurva(item.fn, lo, hi, { n: Math.max(60, Math.round(m.pw / 3)), escalaY: m.ph / altura, altura: Infinity });
        for (const t of tr) {
          const cima = t.map(([x, y]) => `${dec2(X(x))} ${dec2(Y(lim(y)))}`);
          const baixo = t.map(([x]) => { const yb = base(x); return `${dec2(X(x))} ${dec2(Y(lim(Number.isFinite(yb) ? yb : 0)))}`; }).reverse();
          d += `M${cima.join('L')}L${baixo.join('L')}Z`;
        }
      }
      path.setAttribute('d', d);
    };
    item.atualizar = (novaFn) => {
      if (novaFn) item.fn = comoFuncao(novaFn);
      desenhar();
    };
    return registar(o.camada || 'areas', item, path, desenhar, o);
  }

  function rotulo(x, y, txt, o = {}) {
    const item = { x, y };
    const el = texto(0, 0, txt, { ancora: o.ancora || 'start', cor: cor(o.cor, CORES.texto), tam: o.tam || fs, peso: o.peso });
    const desenhar = () => {
      el.setAttribute('x', dec2(X(item.x) + (o.dx ?? 5)));
      el.setAttribute('y', dec2(Y(item.y) + (o.dy ?? -5)));
      el.style.display = dentroPx(X(item.x), Y(item.y), 40) ? '' : 'none';
    };
    item.mover = (nx, ny) => { item.x = nx; item.y = ny; desenhar(); };
    item.definirTexto = (t) => { el.textContent = t; };
    return registar(o.camada || 'texto', item, el, desenhar, o);
  }

  // ----- pontos -----
  function ponto(x, y, o = {}) {
    const item = { x, y };
    const c = cor(o.cor, CORES.ponto);
    const r = o.raio ?? 4.5;
    const arrastavel = !!o.arrastavel;
    const el = criar('g', {});
    const guias = o.guias
      ? criar('path', { fill: 'none', style: `stroke:${c}`, 'stroke-width': 1, 'stroke-dasharray': '3 3', 'stroke-opacity': 0.7 })
      : null;
    const alvo = arrastavel ? criar('circle', { r: 22, style: 'fill:transparent;cursor:grab', 'pointer-events': 'all' }) : null;
    const anel = arrastavel ? criar('circle', { r: r + 5, fill: 'none', style: `stroke:${c}`, 'stroke-width': 2, visibility: 'hidden' }) : null;
    const bola = criar('circle', {
      r,
      'stroke-width': 1.6,
      style: o.oco ? `fill:var(--papel, #fff);stroke:${c}` : `fill:${c};stroke:var(--papel, #fff)`,
      'stroke-linejoin': 'round',
    });
    if (o.oco) bola.setAttribute('stroke-width', 2.2);
    const rot = o.rotulo ? texto(0, 0, o.rotulo, { cor: c === CORES.ponto ? CORES.texto : c, tam: fs }) : null;
    el.append(...[guias, alvo, anel, bola, rot].filter(Boolean));

    const desenhar = () => {
      const cx = X(item.x);
      const cy = Y(item.y);
      const visivel = Number.isFinite(cx) && Number.isFinite(cy) && dentroPx(cx, cy, r + 2);
      el.style.display = visivel ? '' : 'none';
      if (!visivel) return;
      for (const e of [alvo, anel, bola]) if (e) { e.setAttribute('cx', dec2(cx)); e.setAttribute('cy', dec2(cy)); }
      if (guias) guias.setAttribute('d', `M${dec2(cx)} ${dec2(cy)}L${dec2(cx)} ${dec2(Y(eixoY()))}M${dec2(cx)} ${dec2(cy)}L${dec2(X(eixoX()))} ${dec2(cy)}`);
      if (rot) {
        let pos = o.posRotulo || 'auto';
        if (pos === 'auto') pos = cx + r + 5 + largTexto(o.rotulo) > R() + m.mR - 2 ? 'esq' : 'dir';
        const cfg = {
          dir: [cx + r + 5, cy + fs * 0.35, 'start'],
          esq: [cx - r - 5, cy + fs * 0.35, 'end'],
          cima: [cx, cy - r - 6, 'middle'],
          baixo: [cx, cy + r + fs + 3, 'middle'],
        }[pos] || [cx + r + 5, cy + fs * 0.35, 'start'];
        rot.setAttribute('x', dec2(cfg[0]));
        rot.setAttribute('y', dec2(cfg[1]));
        rot.setAttribute('text-anchor', cfg[2]);
      }
    };

    const textoAria = () => (o.textoAria ? o.textoAria(item.x, item.y) : `x = ${formatarNumero(item.x, 2)}; y = ${formatarNumero(item.y, 2)}`);
    const atualizarAria = () => {
      if (!arrastavel) return;
      el.setAttribute('aria-valuenow', String(+item.x.toFixed(4)));
      el.setAttribute('aria-valuetext', textoAria());
    };

    function aplicar(nx, ny, chamar = true) {
      const rs = o.restringir;
      if (rs === 'x') ny = item.y;
      else if (rs === 'y') nx = item.x;
      if (typeof rs === 'function') {
        [nx, ny] = rs(nx, ny);
      } else {
        if (rs && typeof rs === 'object') {
          if (rs.x) nx = limitar(nx, rs.x[0], rs.x[1]);
          if (rs.y) ny = limitar(ny, rs.y[0], rs.y[1]);
        }
        if (!o.fora) {
          nx = limitar(nx, janela.x[0], janela.x[1]);
          ny = limitar(ny, janela.y[0], janela.y[1]);
        }
      }
      item.x = nx;
      item.y = ny;
      desenhar();
      atualizarAria();
      if (chamar && o.aoMover) o.aoMover(nx, ny, item);
    }
    item.mover = (nx, ny, chamar = true) => aplicar(nx, ny === undefined ? item.y : ny, chamar);
    item.definirRotulo = (t) => { if (rot) rot.textContent = t; };

    if (arrastavel) {
      svg.setAttribute('role', 'group');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', o.aria || o.rotulo || 'Ponto que se pode arrastar');
      el.setAttribute('aria-valuemin', String(janela.x[0]));
      el.setAttribute('aria-valuemax', String(janela.x[1]));
      el.style.touchAction = 'none';
      el.style.outline = 'none';
      let ativo = false;
      let desvio = [0, 0];
      const ponteiro = (e) => {
        const p = pontoDoEvento(svg, e);
        return [xDe(p.x), yDe(p.y)];
      };
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        ativo = true;
        try { el.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
        const [px, py] = ponteiro(e);
        desvio = [item.x - px, item.y - py];
        e.stopPropagation();
        e.preventDefault();
        try { el.focus({ preventScroll: true }); } catch { /* sem foco */ }
      });
      el.addEventListener('pointermove', (e) => {
        if (!ativo) return;
        const [px, py] = ponteiro(e);
        aplicar(px + desvio[0], py + desvio[1]);
      });
      const fim = (e) => {
        ativo = false;
        try { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch { /* nada */ }
      };
      el.addEventListener('pointerup', fim);
      el.addEventListener('pointercancel', fim);
      el.addEventListener('focus', () => {
        let visivel = true;
        try { visivel = el.matches(':focus-visible'); } catch { /* navegador antigo */ }
        if (visivel) anel.setAttribute('visibility', 'visible');
      });
      el.addEventListener('blur', () => anel.setAttribute('visibility', 'hidden'));
      if (o.teclado !== false) {
        const passo = Array.isArray(o.passoTeclado)
          ? o.passoTeclado
          : [o.passoTeclado ?? (janela.x[1] - janela.x[0]) / 50, o.passoTeclado ?? (janela.y[1] - janela.y[0]) / 50];
        const DIR = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        el.addEventListener('keydown', (e) => {
          const d = DIR[e.key];
          if (!d) return;
          e.preventDefault();
          const k = e.shiftKey ? 5 : 1;
          aplicar(+(item.x + d[0] * passo[0] * k).toFixed(10), +(item.y + d[1] * passo[1] * k).toFixed(10));
        });
      }
    }

    registar(o.camada || 'pontos', item, el, desenhar, o);
    atualizarAria();
    return item;
  }

  // ----- janela, limpar, redesenhar -----
  function redesenhar() {
    layout();
    desenharBase();
    for (const nome of CAMADAS) for (const it of registo[nome]) it.desenhar();
  }

  function definirJanela(a, b) {
    const nx = Array.isArray(a) ? a : a && a.x;
    const ny = Array.isArray(a) ? b : a && a.y;
    if (!Array.isArray(nx) || !Array.isArray(ny) || !(nx[1] > nx[0]) || !(ny[1] > ny[0])) throw new Error('definirJanela: janela inválida');
    janela.x = [nx[0], nx[1]];
    janela.y = [ny[0], ny[1]];
    redesenhar();
  }

  function limpar(camada) {
    const nomes = camada ? [camada] : CAMADAS.filter((c) => c !== 'controlos');
    for (const nome of nomes) {
      if (!registo[nome]) throw new Error(`camada desconhecida: ${nome}`);
      for (const it of [...registo[nome]]) it.remover();
    }
  }

  const fmtJ = (v) => formatarNumero(v, 2);
  svg.setAttribute('aria-label', op.aria || `Gráfico cartesiano, x de ${fmtJ(janela.x[0])} a ${fmtJ(janela.x[1])}, y de ${fmtJ(janela.y[0])} a ${fmtJ(janela.y[1])}.`);
  layout();
  desenharBase();

  return {
    svg,
    id: uid,
    camadas,
    X,
    Y,
    x: xDe,
    y: yDe,
    get janela() { return { x: [...janela.x], y: [...janela.y] }; },
    get largura() { return W; },
    get altura() { return H; },
    definirJanela,
    curva,
    retaVertical,
    retaHorizontal,
    reta,
    segmento,
    ponto,
    rotulo,
    area,
    limpar,
    redesenhar,
    item: (id) => porId.get(id),
    definirAria: (t) => svg.setAttribute('aria-label', t),
  };
}

// ---------- Ponto que desliza sobre uma curva ----------

export function arrastarNaCurva(g, fn, o = {}) {
  const f = typeof fn === 'string' ? criarFuncao(fn) : fn;
  const xmin = o.xmin ?? g.janela.x[0];
  const xmax = o.xmax ?? g.janela.x[1];
  const passo = o.passoTeclado ?? (xmax - xmin) / 100;
  const lim = (x) => limitar(x, xmin, xmax);
  const yDe = (x) => {
    try { const y = Number(f(x)); return Number.isFinite(y) ? y : NaN; } catch { return NaN; }
  };
  const x0 = lim(o.x0 ?? (xmin + xmax) / 2);
  const p = g.ponto(x0, yDe(x0), {
    camada: 'controlos',
    cor: o.cor || 'der',
    raio: o.raio ?? 6.5,
    arrastavel: true,
    teclado: false,
    fora: true,
    aria: o.aria || 'Ponto sobre a curva. Setas esquerda e direita para o mover.',
    textoAria: o.textoAria,
    restringir: (px) => { const x = lim(px); return [x, yDe(x)]; },
    aoMover: o.aoMover,
  });
  p.el.setAttribute('aria-valuemin', String(xmin));
  p.el.setAttribute('aria-valuemax', String(xmax));
  p.mover(x0, undefined, false); // põe os atributos aria

  const mover = (x, chamar = true) => p.mover(lim(x), undefined, chamar);

  p.el.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 5 : 1;
    let nx;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': nx = p.x - passo * k; break;
      case 'ArrowRight': case 'ArrowUp': nx = p.x + passo * k; break;
      case 'PageDown': nx = p.x - passo * 10; break;
      case 'PageUp': nx = p.x + passo * 10; break;
      case 'Home': nx = xmin; break;
      case 'End': nx = xmax; break;
      default: return;
    }
    e.preventDefault();
    mover(+nx.toFixed(10));
  });

  // carregar/arrastar em qualquer sítio do gráfico (dentro da área do desenho) leva o ponto para esse x
  const svg = g.svg;
  svg.style.touchAction = 'pan-y'; // o deslizar na vertical continua a mover a página
  svg.classList.remove('figura--fixa');
  let ativo = false;
  const xDoEvento = (e) => g.x(pontoDoEvento(svg, e).x);
  svg.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const pt = pontoDoEvento(svg, e);
    const j = g.janela;
    if (pt.x < g.X(j.x[0]) - 8 || pt.x > g.X(j.x[1]) + 8 || pt.y < g.Y(j.y[1]) - 8 || pt.y > g.Y(j.y[0]) + 8) return;
    ativo = true;
    try { svg.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ }
    mover(xDoEvento(e));
    try { p.el.focus({ preventScroll: true }); } catch { /* sem foco */ }
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (ativo) mover(xDoEvento(e));
  });
  const fim = (e) => {
    ativo = false;
    try { if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch { /* nada */ }
  };
  svg.addEventListener('pointerup', fim);
  svg.addEventListener('pointercancel', fim);

  return {
    mover,
    el: p.el,
    ponto: p,
    get x() { return p.x; },
    get y() { return p.y; },
  };
}
