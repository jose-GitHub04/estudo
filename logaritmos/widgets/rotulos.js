// rotulos: põe as etiquetas de um gráfico do motor (assets/motor/grafico.js) onde não tapam nada.
//
// O motor põe cada rótulo num sítio fixo (ao fim da curva, ao lado do ponto, ao pé da reta...) e por isso um
// rótulo pode cair em cima de uma curva, de um número das marcas, de um ponto ou de outro rótulo. Aqui o gráfico
// desenha-se SEM rótulos (nem nomes dos eixos: criarGrafico({ rotuloX: '', rotuloY: '' })), lê-se a geometria do que
// ficou desenhado (curvas, retas, eixos, pontos e números das marcas) e, para cada rótulo pedido, escolhe-se entre
// várias posições candidatas a que tapa menos, preferindo as mais perto do que o rótulo descreve e, a seguir, a
// ordem pedida. No fim apaga-se o número de uma marca que ainda esteja riscado (o traço da marca fica).
//
// Uso (g é o objeto devolvido por criarGrafico, já com as curvas, retas e pontos desenhados):
//   import { colocarRotulos } from './rotulos.js';
//   colocarRotulos(g, [
//     { tipo: 'ponto', x: 1, y: 2, raio: 4.5, texto: '(1, 2)', pref: 'dir' },
//     { tipo: 'retaH', y: 5, texto: 'y = 5', pref: 'dir', cor: 'assint' },
//     { tipo: 'curva', fn: 'x^2', de, ate, texto: 'f', cor: 'exp' },
//   ], { nomesEixos: { x: 'x', y: 'y' } });
// Pedidos (x e y em coordenadas dos dados; `cor` como no motor; `tam` opcional; «^» no texto escreve um expoente):
//   ponto   { x, y, raio, texto (ou lista de linhas), pref: 'dir' | 'esq' | 'cima' | 'baixo' | 'cima-dir' | 'cima-esq' | 'baixo-dir' | 'baixo-esq' }
//   retaH   { y, texto, pref: 'dir' | 'esq' }                          ao longo de uma reta horizontal
//   retaV   { x, texto, pref: 'cima' | 'baixo' }                       ao longo de uma reta vertical
//   reta    { declive, ordenada, texto }                               ao longo de uma reta oblíqua
//   curva   { fn, de, ate, texto, pref: 'fim' | 'inicio' | 'meio' }   ao longo de uma curva
//   livre   { texto (ou lista de linhas), candidatos: [{ x, y, ancora, dx, dy }] }   posições dadas (a linha de base
//           fica em y mais dy, como em g.rotulo); um candidato pode trazer { px, py } em unidades do desenho
// `pref` é só uma preferência: se a posição preferida tapar alguma coisa, ganha outra.
// Opções: nomesEixos { x, y } (os nomes dos eixos, que também se afastam do que os tapa); fonte (por defeito, a das marcas).
// Devolve { colocados: [{ texto, custo }], apagadas: [texto das marcas apagadas] }; custo >= 25 quer dizer que
// o rótulo ficou a tocar em alguma coisa (não havia sítio melhor).

import { amostrarCurva } from '../../assets/motor/grafico.js';
import { criarFuncao } from '../../assets/motor/matematica.js';

const ASC = 0.76; // altura das letras acima da linha de base, em múltiplos do tamanho da letra
const DESC = 0.22; // e abaixo
const MARGEM = 2; // o rótulo não chega mais perto da borda do desenho
const ENTRELINHA = 1.2; // distância entre linhas de base, em múltiplos do tamanho

// Largura aproximada de uma letra, em múltiplos do tamanho do texto (por cima, para não ficar curto).
function larguraLetra(c) {
  if ('0123456789'.includes(c)) return 0.58;
  if ('−-+=<>≈≤≥×·'.includes(c)) return 0.64;
  if (',.;:'.includes(c)) return 0.3;
  if (c === ' ') return 0.32;
  if ('il|!\''.includes(c)) return 0.28;
  if ('()[]{}/'.includes(c)) return 0.36;
  if ('mw'.includes(c)) return 0.85;
  if (c >= 'A' && c <= 'Z') return 0.7;
  if ('²³⁻¹'.includes(c)) return 0.4;
  return 0.56;
}
const larguraSimples = (t, tam) => [...String(t)].reduce((s, c) => s + larguraLetra(c), 0) * tam;

// Um texto como «y = e^x» ou «8^(x − 1)» escreve-se com o expoente em cima: parte-se em segmentos { t, sup }.
const EXPOENTE = /\^(\([^)]*\)|[−-]?[A-Za-z0-9.,]+)/g;
const TAM_EXPOENTE = 0.72; // o expoente tem este tamanho relativo
const SOBE = 0.42; // e sobe esta fração do tamanho da letra

function segmentos(texto) {
  const partes = [];
  let i = 0;
  const t = String(texto);
  for (const m of t.matchAll(EXPOENTE)) {
    if (m.index > i) partes.push({ t: t.slice(i, m.index), sup: false });
    partes.push({ t: m[1].startsWith('(') ? m[1].slice(1, -1) : m[1], sup: true });
    i = m.index + m[0].length;
  }
  if (i < t.length) partes.push({ t: t.slice(i), sup: false });
  return partes;
}

const largura = (segs, tam) => segs.reduce((s, p) => s + larguraSimples(p.t, p.sup ? tam * TAM_EXPOENTE : tam), 0) + 1;

/** Escreve os segmentos dentro do <text> que o motor criou (os expoentes em <tspan> mais pequenos e mais altos). */
function escreverSegmentos(el, segs, tam) {
  el.textContent = '';
  let subido = false;
  for (const p of segs) {
    const ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    ts.textContent = p.t;
    if (p.sup) {
      ts.setAttribute('dy', String(-SOBE * tam));
      ts.setAttribute('font-size', String(+(tam * TAM_EXPOENTE).toFixed(2)));
      subido = true;
    } else if (subido) {
      ts.setAttribute('dy', String(SOBE * tam));
      subido = false;
    }
    el.append(ts);
  }
}

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- geometria do gráfico ----------

/** Lê do svg (mesmo sem estar no documento) tudo o que um rótulo não deve tapar. */
function lerGeometria(g) {
  const svg = g.svg;
  const W = g.largura;
  const H = g.altura;
  const linhas = []; // { pts: [[x, y], ...], tipo: 'curva' | 'reta' | 'eixo' }
  for (const [sel, tipo] of [['[data-camada="curvas"] path', 'curva'], ['[data-camada="retas"] path', 'reta']]) {
    for (const p of svg.querySelectorAll(sel)) {
      const d = p.getAttribute('d');
      if (!d) continue;
      for (const sub of d.split('M')) {
        if (!sub) continue;
        const pts = sub.split('L').map((s) => s.trim().split(' ').map(Number)).filter((v) => v.length === 2 && v.every(Number.isFinite));
        if (pts.length > 1) linhas.push({ pts, tipo });
      }
    }
  }
  const base = svg.querySelector('[data-camada="base"]');
  const marcas = []; // números das marcas: { el, box, numero }
  if (base) {
    for (const l of base.children) {
      if (l.tagName !== 'line' || l.getAttribute('stroke-width') !== '1.5') continue; // os eixos (a grelha é mais fina)
      linhas.push({ pts: [[+l.getAttribute('x1'), +l.getAttribute('y1')], [+l.getAttribute('x2'), +l.getAttribute('y2')]], tipo: 'eixo' });
    }
  }
  const textos = [];
  const lerTexto = (el, tipo) => {
    const t = el.textContent;
    if (!t) return;
    const tam = parseFloat(el.getAttribute('font-size')) || 12;
    const anc = el.getAttribute('text-anchor') || 'start';
    const x = +el.getAttribute('x');
    const y = +el.getAttribute('y');
    const w = largura([{ t, sup: false }], tam);
    const x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x;
    const box = { x0, x1: x0 + w, y0: y - ASC * tam, y1: y + DESC * tam };
    const reg = { el, box, tipo };
    textos.push(reg);
    if (tipo === 'marca') marcas.push({ ...reg, numero: /^[−\-0-9,]+$/.test(t.trim()) });
  };
  if (base) for (const t of base.querySelectorAll('text')) lerTexto(t, 'marca');
  for (const t of svg.querySelectorAll('[data-camada="texto"] text')) lerTexto(t, 'rotulo');
  const circulos = [];
  for (const c of svg.querySelectorAll('[data-camada="pontos"] circle')) {
    const estilo = c.getAttribute('style') || '';
    if (/fill:\s*transparent/.test(estilo) || c.getAttribute('cx') === null || c.getAttribute('visibility') === 'hidden') continue;
    circulos.push({ cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') });
  }
  const clip = svg.querySelector('clipPath rect');
  const area = clip
    ? { x0: +clip.getAttribute('x'), y0: +clip.getAttribute('y'), x1: +clip.getAttribute('x') + +clip.getAttribute('width'), y1: +clip.getAttribute('y') + +clip.getAttribute('height') }
    : { x0: 0, y0: 0, x1: W, y1: H };
  return { W, H, linhas, textos, marcas, circulos, area, colocados: [] };
}

/** Liang-Barsky: o segmento passa dentro da caixa? */
function segmentoToca(x0, y0, x1, y1, b) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lados = [[-dx, x0 - b.x0], [dx, b.x1 - x0], [-dy, y0 - b.y0], [dy, b.y1 - y0]];
  for (const [p, q] of lados) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return t0 <= t1;
}

/** Quantos segmentos da linha passam dentro da caixa. */
function contarSegmentos(pts, b) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) if (segmentoToca(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], b)) n++;
  return n;
}

const caixasSobrepoem = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inflar = (b, k) => ({ x0: b.x0 - k, y0: b.y0 - k, x1: b.x1 + k, y1: b.y1 + k });

function circuloToca(c, b, folga = 1) {
  const px = limitar(c.cx, b.x0, b.x1);
  const py = limitar(c.cy, b.y0, b.y1);
  return Math.hypot(px - c.cx, py - c.cy) < c.r + folga;
}

/** Quanto «custa» pôr uma caixa de texto ali: 0 = sítio livre. */
function custoDaCaixa(box, G) {
  let c = 0;
  if (box.x0 < MARGEM || box.x1 > G.W - MARGEM || box.y0 < MARGEM || box.y1 > G.H - MARGEM) c += 1000;
  const b = inflar(box, 0.8);
  for (const l of G.linhas) {
    const k = contarSegmentos(l.pts, b);
    if (k) c += (l.tipo === 'eixo' ? 25 : 40) + Math.min(k, 20) * 0.3;
  }
  for (const t of G.textos) if (caixasSobrepoem(b, inflar(t.box, 0.5))) c += t.tipo === 'marca' ? 30 : 60;
  for (const o of G.colocados) if (caixasSobrepoem(b, o)) c += 60;
  for (const o of G.circulos) if (circuloToca(o, b)) c += 50;
  return c;
}

// ---------- candidatos ----------

/** Caixa de um texto ancorado: ancora 'start' | 'middle' | 'end' em x e linha de base (da 1.ª linha) em y. */
function caixaAncorada(x, base, anc, w, tam, { expoente = false, linhas = 1 } = {}) {
  const x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: base - (expoente ? ASC + 0.16 : ASC) * tam, y1: base + (linhas - 1) * ENTRELINHA * tam + DESC * tam };
}

const ANGULO_DA_POSICAO = { dir: 0, 'baixo-dir': 45, baixo: 90, 'baixo-esq': 135, esq: 180, 'cima-esq': -135, cima: -90, 'cima-dir': -45 };

/**
 * Candidatos à volta de um ponto: 16 direções (a preferida primeiro, depois as mais próximas dela, com a de cima a
 * desempatar) a quatro distâncias do círculo. A caixa fica sempre à distância pedida do círculo, em qualquer direção.
 */
function candidatosDoPonto(p, cx, cy, tam, w, n = 1) {
  const pref = ANGULO_DA_POSICAO[p.pref] ?? 0;
  const dist = (a) => Math.abs((((a - pref) % 360) + 540) % 360 - 180);
  const angulos = Array.from({ length: 16 }, (_, k) => -180 + k * 22.5);
  angulos.sort((a, b) => dist(a) - dist(b) || Math.sin((a * Math.PI) / 180) - Math.sin((b * Math.PI) / 180));
  const r = p.raio ?? 4.5;
  const h = (ASC + DESC) * tam + (n - 1) * ENTRELINHA * tam;
  const lista = [];
  [3, 8, 14, 21].forEach((folga, anel) => {
    angulos.forEach((a, k) => {
      const dx = Math.cos((a * Math.PI) / 180);
      const dy = Math.sin((a * Math.PI) / 180);
      const D = r + folga + (Math.abs(dx) * w) / 2 + (Math.abs(dy) * h) / 2;
      lista.push({ x: cx + dx * D, base: cy + dy * D - h / 2 + ASC * tam, anc: 'middle', extra: anel * 7 + k * 0.9 });
    });
  });
  return lista;
}

/** Ponto de uma linha poligonal à distância de arco `s`: { x, y, tx, ty } (t é a tangente). */
function pontoNaLinha(pts, cum, s) {
  const total = cum[cum.length - 1];
  const alvo = limitar(s, 0, total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < alvo) i++;
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const u = (alvo - cum[i - 1]) / seg;
  // tangente com uma janela de vários pontos, para não tremer
  const a = pts[Math.max(0, i - 3)];
  const b = pts[Math.min(pts.length - 1, i + 2)];
  let tx = b[0] - a[0];
  let ty = b[1] - a[1];
  const n = Math.hypot(tx, ty) || 1;
  tx /= n;
  ty /= n;
  return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, tx, ty };
}

/** Candidatos ao longo de linhas poligonais: em cada fração da linha, dos dois lados. */
function candidatosNaLinha(tracos, tam, w, fracoes) {
  const lista = [];
  const h = (ASC + DESC) * tam;
  for (const pts of tracos) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    if (!(total > 4)) continue;
    fracoes.forEach((f, k) => {
      const P = pontoNaLinha(pts, cum, f * total);
      let nx = -P.ty;
      let ny = P.tx;
      if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; } // a normal aponta para cima (ou para a direita, nas verticais)
      const ext = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2;
      [1, -1].forEach((lado, j) => {
        const cx = P.x + nx * lado * (ext + 3.5);
        const cy = P.y + ny * lado * (ext + 3.5);
        lista.push({ x: cx, base: cy + ((ASC - DESC) * tam) / 2, anc: 'middle', extra: k * 1.1 + j * 0.8 });
      });
    });
  }
  return lista;
}

// frações do comprimento de uma linha, da mais preferida para a menos
const DESDE_FIM = [1, 0.94, 0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4, 0.32, 0.24, 0.16, 0.08, 0];
const DESDE_INICIO = DESDE_FIM.map((f) => 1 - f);
const DESDE_MEIO = [0.5, 0.58, 0.42, 0.66, 0.34, 0.74, 0.26, 0.82, 0.18, 0.9, 0.1, 1, 0];

/** Corta um segmento [[x0, y0], [x1, y1]] ao retângulo A; devolve [linha] ou []. */
function cortarAoDesenho(par, A) {
  const [[x0, y0], [x1, y1]] = par;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [pp, q] of [[-dx, x0 - A.x0], [dx, A.x1 - x0], [-dy, y0 - A.y0], [dy, A.y1 - y0]]) {
    if (pp === 0) {
      if (q < 0) return [];
    } else {
      const r = q / pp;
      if (pp < 0) { if (r > t1) return []; if (r > t0) t0 = r; } else { if (r < t0) return []; if (r < t1) t1 = r; }
    }
  }
  return [[[x0 + dx * t0, y0 + dy * t0], [x0 + dx * t1, y0 + dy * t1]]];
}

/** Linhas poligonais (px) da curva `fn` visíveis na janela: amostra como o motor e corta ao retângulo do desenho. */
function tracosDaCurva(g, G, p) {
  const j = g.janela;
  const fn = typeof p.fn === 'string' ? criarFuncao(p.fn) : p.fn;
  const a = Math.max(p.de ?? -Infinity, j.x[0]);
  const b = Math.min(p.ate ?? Infinity, j.x[1]);
  if (!(b > a)) return [];
  const brutos = amostrarCurva(fn, a, b, { n: 120, escalaY: (G.area.y1 - G.area.y0) / (j.y[1] - j.y[0]), altura: j.y[1] - j.y[0] });
  const dentro = (x, y) => x >= G.area.x0 - 0.5 && x <= G.area.x1 + 0.5 && y >= G.area.y0 - 0.5 && y <= G.area.y1 + 0.5;
  const tracos = [];
  for (const t of brutos) {
    let atual = [];
    for (const [x, y] of t) {
      const px = g.X(x);
      const py = g.Y(y);
      if (dentro(px, py)) {
        atual.push([px, py]);
      } else if (atual.length) {
        tracos.push(atual);
        atual = [];
      }
    }
    if (atual.length) tracos.push(atual);
  }
  return tracos.filter((t) => t.length > 1);
}

function candidatosDoPedido(g, G, p, tam, w, nLinhas) {
  const A = G.area;
  switch (p.tipo) {
    case 'ponto':
      return candidatosDoPonto(p, g.X(p.x), g.Y(p.y), tam, w, nLinhas);
    case 'retaH': {
      const py = g.Y(p.y);
      return candidatosNaLinha([[[A.x0, py], [A.x1, py]]], tam, w, p.pref === 'esq' ? DESDE_INICIO : DESDE_FIM);
    }
    case 'retaV': {
      const px = g.X(p.x);
      // f = 0 é o topo: 'baixo' começa pelo fundo
      return candidatosNaLinha([[[px, A.y0], [px, A.y1]]], tam, w, p.pref === 'baixo' ? DESDE_FIM : DESDE_INICIO);
    }
    case 'reta': {
      const j = g.janela;
      const x0 = j.x[0] - 1;
      const x1 = j.x[1] + 1;
      const par = [[g.X(x0), g.Y(p.declive * x0 + p.ordenada)], [g.X(x1), g.Y(p.declive * x1 + p.ordenada)]];
      return candidatosNaLinha(cortarAoDesenho(par, A), tam, w, DESDE_FIM);
    }
    case 'curva': {
      const tr = tracosDaCurva(g, G, p);
      const fr = p.pref === 'inicio' ? DESDE_INICIO : p.pref === 'meio' ? DESDE_MEIO : DESDE_FIM;
      // o traço mais à direita primeiro, que é onde se costuma pôr o nome da curva (ao contrário com 'inicio')
      return candidatosNaLinha(p.pref === 'inicio' ? tr : [...tr].reverse(), tam, w, fr);
    }
    case 'livre':
      return (p.candidatos || []).map((c, k) => ({
        x: c.px ?? g.X(c.x) + (c.dx ?? 0),
        base: c.py ?? g.Y(c.y) + (c.dy ?? 0),
        anc: c.ancora || 'start',
        extra: k * 1.2,
      }));
    default:
      return [];
  }
}

/** Pedidos dos nomes dos eixos: primeiro onde o motor os poria, depois um pouco mais para dentro. */
function pedidosDosEixos(g, G, nomes, tam) {
  const j = g.janela;
  const A = G.area;
  const px0 = g.X(limitar(0, j.x[0], j.x[1]));
  const py0 = g.Y(limitar(0, j.y[0], j.y[1]));
  const pedidos = [];
  if (nomes.x) {
    pedidos.push({
      tipo: 'livre', prioridade: -1, texto: nomes.x, tam,
      candidatos: [-8, -22, 17].flatMap((dy) => [0, 26, 52].map((recuo) => ({ px: A.x1 - 2 - recuo, py: py0 + dy, ancora: 'end' }))),
    });
  }
  if (nomes.y) {
    const direita = limitar(0, j.x[0], j.x[1]) < j.x[1];
    const lado = direita ? 8 : -8;
    pedidos.push({
      tipo: 'livre', prioridade: -1, texto: nomes.y, tam,
      candidatos: [11, 25, 39].flatMap((descida) => [lado, -lado].map((dx) => ({ px: px0 + dx, py: A.y0 + descida, ancora: dx > 0 ? 'start' : 'end' }))),
    });
  }
  return pedidos;
}

const PRIORIDADE = { ponto: 0, retaV: 1, retaH: 1, reta: 2, livre: 3, curva: 4 };
const linhasDoTexto = (t) => (Array.isArray(t) ? t : [t]).filter((l) => typeof l === 'string' && l !== '');

export function colocarRotulos(g, pedidos, opcoes = {}) {
  const G = lerGeometria(g);
  const tamBase = opcoes.fonte ?? (parseFloat((g.svg.querySelector('[data-camada="base"] text') || { getAttribute: () => null }).getAttribute('font-size')) || 12);
  const todos = [...pedidos];
  if (opcoes.nomesEixos) todos.push(...pedidosDosEixos(g, G, opcoes.nomesEixos, tamBase + 1));
  const colocados = [];
  const ordenados = todos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && linhasDoTexto(p.texto).length > 0)
    .sort((a, b) => (a.p.prioridade ?? PRIORIDADE[a.p.tipo] ?? 9) - (b.p.prioridade ?? PRIORIDADE[b.p.tipo] ?? 9) || a.i - b.i);
  for (const { p } of ordenados) {
    const tam = p.tam ?? tamBase;
    const linhas = linhasDoTexto(p.texto);
    const segsDe = linhas.map(segmentos);
    const w = Math.max(...segsDe.map((s) => largura(s, tam)));
    const expoente = segsDe.some((s) => s.some((x) => x.sup));
    let melhor = null;
    for (const c of candidatosDoPedido(g, G, p, tam, w, linhas.length)) {
      const box = caixaAncorada(c.x, c.base, c.anc, w, tam, { expoente, linhas: linhas.length });
      const custo = custoDaCaixa(box, G) + c.extra;
      if (!melhor || custo < melhor.custo) melhor = { ...c, box, custo };
      if (custo < 0.5) break; // sítio livre à primeira escolha
    }
    if (!melhor) continue; // sem onde pôr (linha fora da janela): não há rótulo
    G.colocados.push(melhor.box);
    linhas.forEach((texto, k) => {
      const item = g.rotulo(g.x(melhor.x), g.y(melhor.base + k * ENTRELINHA * tam), texto, { ancora: melhor.anc, dx: 0, dy: 0, cor: p.cor, tam: p.tam });
      if (segsDe[k].some((s) => s.sup)) escreverSegmentos(item.el, segsDe[k], tam);
    });
    colocados.push({ texto: linhas.join(' '), custo: melhor.custo });
  }

  // números das marcas ainda riscados por curvas, retas, eixos, pontos ou rótulos: o número sai, o traço fica
  const apagadas = [];
  for (const m of G.marcas) {
    if (!m.numero) continue;
    const b = inflar(m.box, 0.8);
    const riscado = G.linhas.some((l) => contarSegmentos(l.pts, b) > 0)
      || G.circulos.some((c) => circuloToca(c, b, 0.5))
      || G.colocados.some((o) => caixasSobrepoem(b, o));
    if (riscado) {
      apagadas.push(m.el.textContent);
      m.el.textContent = '';
    }
  }
  return { colocados, apagadas };
}
