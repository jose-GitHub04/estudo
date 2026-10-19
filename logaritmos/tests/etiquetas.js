// etiquetas: procura etiquetas mal postas num gráfico desenhado por assets/motor/grafico.js.
// Usado pelos testes de exercicios.html e equacoes.html (e a quem queira ver todas as figuras de uma vez).
//
//   import { analisarSvg } from './etiquetas.js';
//   const problemas = analisarSvg(svg);   // o svg tem de estar no documento e visível (getBBox)
//
// Cada problema é { tipo, texto, contra, detalhe }:
//   fora         o texto sai do desenho (para lá das margens do viewBox)
//   texto        o texto sobrepõe-se a outro texto (rótulos, números das marcas, nomes dos eixos)
//   curva        o texto é riscado por uma curva (ou reta, ou eixo) que não é a dele
//   propria      o texto é riscado pela curva ou reta a que pertence
//   ponto        o texto tapa um ponto
// A caixa do texto é encolhida um pouco (getBBox inclui o espaço dos ascendentes e descendentes), para só
// contar o que se vê.

const escondido = (el) => {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
    if (e.style && e.style.display === 'none') return true;
  }
  return false;
};

function caixaDe(t, encolher = true) {
  const b = t.getBBox();
  const fs = parseFloat(t.getAttribute('font-size')) || 12;
  const base = parseFloat(t.getAttribute('y'));
  // Os ascendentes (l, f, parêntesis) sobem uns 0,76 do tamanho acima da linha de base e os descendentes descem 0,2.
  // O getBBox devolve a caixa do tipo de letra (mais alta que a tinta): só a largura é dele.
  const dx = encolher ? 0.8 : 0;
  return {
    x0: b.x + dx, x1: b.x + b.width - dx,
    y0: encolher ? base - 0.76 * fs : b.y, y1: encolher ? base + 0.2 * fs : b.y + b.height,
  };
}

const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const dentro = (p, c, folga = 0) => p[0] >= c.x0 - folga && p[0] <= c.x1 + folga && p[1] >= c.y0 - folga && p[1] <= c.y1 + folga;

function amostrarCaminho(path, passo = 1.1) {
  const pts = [];
  let total = 0;
  try { total = path.getTotalLength(); } catch (e) { return pts; }
  if (!(total > 0)) return pts;
  for (let s = 0; s <= total; s += passo) {
    const p = path.getPointAtLength(s);
    pts.push([p.x, p.y]);
  }
  return pts;
}

/** Rótulo curto de um elemento, para as mensagens. */
const nome = (el) => (el ? (el.getAttribute('data-id') || el.tagName) : '?');

export function analisarSvg(svg, opcoes = {}) {
  const problemas = [];
  const vb = svg.viewBox.baseVal;
  const W = vb.width;
  const H = vb.height;
  const margem = opcoes.margem ?? 1;

  // obstáculos: caminhos das curvas e das retas, eixos, círculos dos pontos
  const caminhos = [];
  for (const p of svg.querySelectorAll('[data-camada="curvas"] path, [data-camada="retas"] path')) {
    if (escondido(p) || !p.getAttribute('d')) continue;
    caminhos.push({ el: p, pai: p.parentNode, pontos: amostrarCaminho(p), tipo: p.closest('[data-camada="curvas"]') ? 'curva' : 'reta' });
  }
  const base = svg.querySelector('[data-camada="base"]');
  if (base) {
    for (const l of base.children) {
      if (l.tagName !== 'line' || l.getAttribute('stroke-width') !== '1.5') continue; // os eixos (a grelha é mais fina)
      const x1 = +l.getAttribute('x1'); const y1 = +l.getAttribute('y1'); const x2 = +l.getAttribute('x2'); const y2 = +l.getAttribute('y2');
      const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 1.1));
      const pontos = [];
      for (let i = 0; i <= n; i++) pontos.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
      caminhos.push({ el: l, pai: base, pontos, tipo: 'eixo' });
    }
  }
  const circulos = [...svg.querySelectorAll('[data-camada="pontos"] circle')]
    .filter((c) => !escondido(c) && c.getAttribute('r') && c.getAttribute('visibility') !== 'hidden' && c.getAttribute('cx'))
    .filter((c) => c.getAttribute('style') !== null && !/fill:\s*transparent/.test(c.getAttribute('style') || ''))
    .map((c) => ({ el: c, cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') }));

  const textos = [...svg.querySelectorAll('text')].filter((t) => !escondido(t) && (t.textContent || '').trim() !== '');
  const caixas = textos.map((t) => ({ t, c: caixaDe(t), cheia: caixaDe(t, false), texto: t.textContent.trim() }));

  for (const a of caixas) {
    // 1. fora do desenho
    if (a.c.x0 < margem || a.c.x1 > W - margem || a.c.y0 < margem || a.c.y1 > H - margem) {
      problemas.push({
        tipo: 'fora', texto: a.texto, contra: '',
        detalhe: `caixa x ${a.c.x0.toFixed(0)}..${a.c.x1.toFixed(0)}, y ${a.c.y0.toFixed(0)}..${a.c.y1.toFixed(0)} em ${W.toFixed(0)}x${H.toFixed(0)}`,
      });
    }
    // 2. outro texto
    for (const b of caixas) {
      if (b === a || caixas.indexOf(b) < caixas.indexOf(a)) continue;
      if (sobrepoe(a.c, b.c)) problemas.push({ tipo: 'texto', texto: a.texto, contra: b.texto, detalhe: '' });
    }
    // 3. curvas, retas e eixos
    for (const k of caminhos) {
      const hit = k.pontos.find((p) => dentro(p, a.c, 0.6));
      if (!hit) continue;
      const propria = k.pai === a.t.parentNode && k.tipo !== 'eixo';
      problemas.push({
        tipo: propria ? 'propria' : 'curva', texto: a.texto, contra: `${k.tipo}${k.el.getAttribute('data-id') ? ' ' + k.el.getAttribute('data-id') : ''}`,
        detalhe: `em (${hit[0].toFixed(0)}, ${hit[1].toFixed(0)}), texto em x ${a.c.x0.toFixed(0)}..${a.c.x1.toFixed(0)}, y ${a.c.y0.toFixed(0)}..${a.c.y1.toFixed(0)}`,
      });
    }
    // 4. pontos
    for (const c of circulos) {
      if (c.el.parentNode === a.t.parentNode) continue; // o ponto do próprio rótulo
      const px = Math.max(a.c.x0, Math.min(c.cx, a.c.x1));
      const py = Math.max(a.c.y0, Math.min(c.cy, a.c.y1));
      if (Math.hypot(px - c.cx, py - c.cy) < c.r + 0.5) problemas.push({ tipo: 'ponto', texto: a.texto, contra: `(${c.cx.toFixed(0)}, ${c.cy.toFixed(0)})`, detalhe: '' });
    }
  }
  return problemas;
}

/** Texto de uma linha por problema. */
export function descrever(problemas) {
  return problemas.map((p) => {
    switch (p.tipo) {
      case 'fora': return `«${p.texto}» sai do desenho (${p.detalhe})`;
      case 'texto': return `«${p.texto}» sobrepõe-se ao texto «${p.contra}»`;
      case 'propria': return `«${p.texto}» é riscado pela própria ${p.contra} (${p.detalhe})`;
      case 'curva': return `«${p.texto}» é riscado por ${p.contra} (${p.detalhe})`;
      case 'ponto': return `«${p.texto}» tapa o ponto ${p.contra}`;
      default: return `${p.tipo}: ${p.texto}`;
    }
  });
}

/** Mete o svg num contentor visível (para o getBBox funcionar), analisa e tira-o. */
export function analisarFora(svg, larguraPx = 340) {
  const caixa = document.createElement('div');
  caixa.style.cssText = `position:absolute; left:-5000px; top:0; width:${larguraPx}px;`;
  document.body.append(caixa);
  caixa.append(svg);
  try {
    return analisarSvg(svg);
  } finally {
    caixa.remove();
  }
}

