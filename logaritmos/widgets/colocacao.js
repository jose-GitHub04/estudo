// colocacao: ajuda dos widgets da Matéria a pôr um texto junto de um ponto de um gráfico do motor
// (assets/motor/grafico.js) sem o deixar em cima da curva, dos números dos eixos ou de outro texto.
// Não desenha nada: recebe o ponto, uma lista de posições possíveis (por ordem de preferência) e o
// que há a evitar, e devolve a posição com menos coisas por baixo ({ ancora, dx, dy }) para passar a
// g.rotulo(x, y, texto, { ancora, dx, dy }). As larguras dos textos são estimadas (o texto ainda pode
// nem estar na página), por isso há uma pequena folga em tudo.
// Contrato: só funções puras, sem estado. Usado por exponencial.js, limites.js e estudo.js (rotulos.js, mais completo e de outro autor, serve as equações e os exercícios).

/** Largura de uma letra em múltiplos do tamanho do texto (estimativa por classes, um pouco por cima). */
function larguraLetra(c) {
  if (c === ' ') return 0.28;
  if ("().,;:|!/[]".includes(c)) return 0.33;
  if ('=<>+−-×≈≤≥'.includes(c)) return 0.6;
  if (c >= '0' && c <= '9') return 0.56;
  if ('mwMW'.includes(c)) return 0.8;
  if ('ilIjt'.includes(c)) return 0.3;
  return 0.52;
}

/** Largura aproximada de um texto simples, em unidades do viewBox. */
export const larguraTexto = (txt, tam) => [...String(txt)].reduce((w, c) => w + larguraLetra(c), 0) * tam;

/** Retângulo { x0, x1, y0, y1 } ocupado por um texto com a linha de base em (x, y). */
export function caixaDoTexto(txt, x, y, ancora, tam) {
  const w = larguraTexto(txt, tam);
  const x0 = ancora === 'end' ? x - w : ancora === 'middle' ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - tam * 0.95, y1: y + tam * 0.28 };
}

const sobreposicao = (a, b) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Posições (em unidades do viewBox) do desenho e dos números dos eixos de um gráfico. */
export function geometria(g, fs = 12) {
  const { x, y } = g.janela;
  const L = g.X(x[0]);
  const R = g.X(x[1]);
  const T = g.Y(y[1]);
  const B = g.Y(y[0]);
  const px0 = g.X(Math.min(Math.max(0, x[0]), x[1]));
  const py0 = g.Y(Math.min(Math.max(0, y[0]), y[1]));
  return { L, R, T, B, px0, py0, fs };
}

/**
 * Retângulos dos eixos, dos seus números e dos seus nomes num gráfico do motor, lidos do próprio desenho
 * (os textos da camada de base), para os rótulos os evitarem. Chamar depois de a janela estar definida.
 */
export function zonasDosEixos(g, fs = 12) {
  const base = g.svg.querySelector('[data-camada="base"]');
  const { L, R, T, B, px0, py0 } = geometria(g, fs);
  // as duas retas dos eixos (um texto por cima delas lê-se mal)
  const zonas = [{ x0: px0 - 1.5, x1: px0 + 1.5, y0: T, y1: B }, { x0: L, x1: R, y0: py0 - 1.5, y1: py0 + 1.5 }];
  if (!base) return zonas;
  for (const t of base.querySelectorAll('text')) {
    const tam = Number(t.getAttribute('font-size')) || fs;
    zonas.push(caixaDoTexto(t.textContent, Number(t.getAttribute('x')), Number(t.getAttribute('y')), t.getAttribute('text-anchor') || 'start', tam));
  }
  return zonas;
}

/** Pontos [px, py] de uma curva (dentro do desenho), para contar quantos caem debaixo de um texto. */
export function amostrarCurva(g, fn, de, ate, n = 260) {
  const { x } = g.janela;
  const a = Math.max(de ?? x[0], x[0]);
  const b = Math.min(ate ?? x[1], x[1]);
  const { L, R, T, B } = geometria(g);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = a + ((b - a) * i) / n;
    const v = fn(u);
    if (!Number.isFinite(v)) continue;
    const px = g.X(u);
    const py = g.Y(v);
    if (px >= L - 2 && px <= R + 2 && py >= T - 2 && py <= B + 2) pts.push([px, py]);
  }
  return pts;
}

/**
 * Escolhe onde pôr `texto` junto do ponto (px, py) do desenho.
 *   opcoes   [{ ancora, dx, dy }] por ordem de preferência (a primeira ganha os empates)
 *   curvas   listas de pontos [px, py] (amostrarCurva) por onde o texto não deve passar
 *   evitar   retângulos { x0, x1, y0, y1 } que o texto não deve tapar (números dos eixos, outros textos, o cursor)
 *   limites  retângulo onde o texto deve caber (por defeito, o desenho com uma margem)
 * Devolve { ancora, dx, dy, caixa, custo }.
 */
export function colocar(g, { texto, px, py, tam = 12, opcoes, curvas = [], evitar = [], limites = null }) {
  const geo = geometria(g, tam);
  const caber = limites || { x0: geo.L - 30, x1: geo.R + 14, y0: geo.T - 12, y1: geo.B + 14 };
  let melhor = null;
  opcoes.forEach((o, i) => {
    const caixa = caixaDoTexto(texto, px + o.dx, py + o.dy, o.ancora, tam);
    const folga = { x0: caixa.x0 - 2, x1: caixa.x1 + 2, y0: caixa.y0 - 1.5, y1: caixa.y1 + 1.5 };
    let custo = i * 0.4;
    for (const c of curvas) for (const [qx, qy] of c) if (qx >= folga.x0 && qx <= folga.x1 && qy >= folga.y0 && qy <= folga.y1) custo += 4;
    for (const r of evitar) custo += sobreposicao(caixa, r) * 0.6;
    const area = (caixa.x1 - caixa.x0) * (caixa.y1 - caixa.y0);
    custo += (area - sobreposicao(caixa, caber)) * 1.2;
    if (!melhor || custo < melhor.custo - 1e-9) melhor = { ancora: o.ancora, dx: o.dx, dy: o.dy, caixa, custo };
  });
  return melhor;
}

/** As oito posições habituais à volta de um ponto, de «cima à direita» no sentido dos ponteiros. */
export function posicoesAoRedor(raio = 6, tam = 12) {
  const d = raio + 3;
  return {
    cimaDir: { ancora: 'start', dx: d, dy: -d },
    dir: { ancora: 'start', dx: d + 2, dy: tam * 0.35 },
    baixoDir: { ancora: 'start', dx: d, dy: d + tam * 0.8 },
    baixo: { ancora: 'middle', dx: 0, dy: d + tam },
    baixoEsq: { ancora: 'end', dx: -d, dy: d + tam * 0.8 },
    esq: { ancora: 'end', dx: -d - 2, dy: tam * 0.35 },
    cimaEsq: { ancora: 'end', dx: -d, dy: -d },
    cima: { ancora: 'middle', dx: 0, dy: -d - 2 },
  };
}
