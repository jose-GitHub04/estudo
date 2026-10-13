// equacoes: resolução passo a passo de equações e inequações exponenciais e logarítmicas.
//
// Uma lista de predefinidas (chips) lida de dados/equacoes.json. Para a escolhida mostra o
// enunciado, um gráfico e a resolução em passos curtos (domínio, resolver, verificar no
// domínio) que se revelam um a um. O gráfico mostra os dois membros como curvas, a zona
// fora do domínio riscada (com a assíntota), as soluções aceites (ponto cheio) e as
// rejeitadas (ponto oco, «rejeitada»); nas inequações sombreia o conjunto-solução. Nas
// substituições de variável há três vistas (equação original, equação em u, voltar a x) e
// o gráfico muda sozinho para a do passo em curso. Duas predefinidas têm um slider de
// parâmetro (2^x = k e log2(x+1) = c): a solução anda sobre a curva.
//
// Contrato: export async function montar(el, dados). `dados` não é usado: o widget lê os
// seus dados. O formato do JSON está descrito (e é conferido, linha a linha) em
// tools/verificar_equacoes.py. Não guarda estado entre visitas.
// Exporta ainda funções puras (constantes, funcaoDe, noDominio, resolverParametro) para
// os testes em logaritmos/tests/equacoes.html.

import { criarGrafico } from '../../assets/motor/grafico.js';
import { criarFuncao } from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const LARGURA = 330;
const FASES = [['dominio', 'Domínio'], ['resolver', 'Resolver'], ['verificar', 'Verificar']];
const COR_PAPEL = { esq: 'exp', dir: 'log', aux: 'der' };
const COR_REJEITADA = 'var(--erro, #a3321f)';
const COR_PONTO = { aceite: 'tg', rejeitada: COR_REJEITADA, candidata: 'assint', fronteira: 'tg' };
const ROTULO_PAPEL = { esq: 'Membro esquerdo', dir: 'Membro direito', aux: 'Forma auxiliar' };

let contador = 0;
let promessaDados = null;

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

function carregar() {
  if (!promessaDados) {
    promessaDados = fetch(new URL('../dados/equacoes.json', import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`equacoes.json: ${r.status}`);
      return r.json();
    });
  }
  return promessaDados;
}

// ---------- números e texto ----------

/** Decimal sem zeros finais, com vírgula e menos «−»: 2,32 · 7 · −0,5. */
function dec(v, casas = 2) {
  const s = (Math.abs(v) < 0.5 * Math.pow(10, -casas) ? 0 : v).toFixed(casas);
  const t = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  const r = t.replace('.', ',');
  return r.startsWith('-') ? `−${r.slice(1)}` : r;
}
const decTex = (v, casas = 2) => dec(v, casas).replace(',', '{,}').replace('−', '-');
const cabeEm2Casas = (v) => Math.abs(v - Math.round(v * 100) / 100) < 1e-9;
const rotuloValor = (nome, v) => `${nome} ${cabeEm2Casas(v) ? '=' : '≈'} ${dec(v)}`;

/** Texto com fórmulas entre $...$ -> nós (cada fórmula num <span>). */
function misto(el, s) {
  s.split('$').forEach((seg, i) => {
    if (i % 2) {
      const f = h('span');
      f.innerHTML = tex(seg);
      el.append(f);
    } else if (seg) {
      el.append(seg);
    }
  });
  return el;
}

/** Uma linha de LaTeX em modo de destaque; as cadeias com ⇔ ou muito longas partem-se em linhas alinhadas. */
function linhaTex(s) {
  const partes = s.split(/\\Leftrightarrow|\\Rightarrow/);
  if (partes.length > 1) {
    const ops = s.match(/\\Leftrightarrow|\\Rightarrow/g);
    const linhas = partes.map((p, i) => (i === 0 ? `& ${p}` : `${ops[i - 1]}\\ & ${p}`));
    return tex(`\\begin{aligned}${linhas.join('\\\\')}\\end{aligned}`, true);
  }
  const pedacos = s.split(/(=|\\approx)/); // [A, '=', B, '\approx', C]
  if (s.length > 38 && pedacos.length >= 5 && !/[<>]|\\leq|\\geq|\\lor|\\land/.test(s)) {
    const linhas = [`${pedacos[0]}&${pedacos[1]}${pedacos[2]}`];
    for (let i = 3; i < pedacos.length; i += 2) linhas.push(`&${pedacos[i]}${pedacos[i + 1]}`);
    return tex(`\\begin{aligned}${linhas.join('\\\\')}\\end{aligned}`, true);
  }
  return tex(s, true);
}

// ---------- cálculos (puros, exportados para os testes) ----------

/** { nome: valor } do parâmetro do slider, ou {} se a predefinida não tem. */
export function constantes(pred, valor) {
  return pred.param ? { [pred.param.nome]: valor } : {};
}

export function funcaoDe(expr, variavel, consts) {
  return criarFuncao(expr, variavel || 'x', consts || {});
}

/** O x está no domínio? (todos os argumentos da lista `dominio` positivos) */
export function noDominio(modelo, x, consts) {
  return (modelo.dominio || []).every((e) => funcaoDe(e, modelo.variavel, consts)(x) > 0);
}

/** Solução da predefinida com parâmetro: { existe, x }. Sem solução quando o domínio do parâmetro falha. */
export function resolverParametro(pred, valor) {
  const p = pred.param;
  const existe = (p.dominio || []).every((e) => criarFuncao(e, p.nome)(valor) > 0);
  if (!existe) return { existe: false, x: NaN };
  const x = criarFuncao(p.solucao, p.nome)(valor);
  return { existe: Number.isFinite(x), x };
}

// Frase em direto por baixo do slider (as contas do parâmetro, escritas por extenso).
const LEITURAS = {
  potencia(v, r) {
    const k = decTex(v);
    if (!r.existe) return `Para $k=${k}$: sem solução, porque $2^x>0$ para todo o $x$.`;
    const n = Math.log2(v);
    if (Math.abs(n - Math.round(n)) < 1e-12) {
      return `Para $k=${k}$: $x=\\log_2 ${k}=${decTex(n)}$, porque $2^{${decTex(n)}}=${k}$.`;
    }
    return `Para $k=${k}$: $x=\\log_2 ${k}=\\dfrac{\\ln ${k}}{\\ln 2}\\approx${decTex(r.x)}$.`;
  },
  logaritmo(v, r) {
    const c = decTex(v);
    const pot = `2^{${c}}`;
    const sufixo = ' Como $x>-1$, a solução está no domínio.';
    if (Number.isInteger(v)) return `Para $c=${c}$: $x=${pot}-1=${decTex(r.x, 6)}$.${sufixo}`;
    return `Para $c=${c}$: $x=${pot}-1\\approx${decTex(r.x)}$.${sufixo}`;
  },
};

// ---------- gráfico ----------

/** Acrescenta ao svg o padrão de riscas da zona proibida e devolve o valor de `fill` que o usa. */
function juntarRiscas(g) {
  const idPadrao = `${g.id}-riscas`;
  const padrao = criar('pattern', {
    id: idPadrao, patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)',
  }, [
    criar('rect', { width: 8, height: 8, style: 'fill:var(--c-zona, rgba(199, 154, 63, 0.28))' }),
    criar('line', { x1: 0, y1: 0, x2: 0, y2: 8, style: 'stroke:var(--dourado-texto, #8a6520);stroke-width:1.6;stroke-opacity:0.6' }),
  ]);
  g.svg.querySelector('defs').append(padrao);
  return `url(#${idPadrao})`;
}

const visivel = (item, n) => item.desde === undefined || n > item.desde;

/** Desenha a vista `V` com `n` passos revelados. Devolve { g, legenda, falas }. */
function desenharVista(pred, V, n, valor) {
  const M = V.modelo || pred.modelo;
  const consts = constantes(pred, valor);
  const nomeVar = V.variavel || 'x';
  const [x0, x1] = V.x;
  const [y0, y1] = V.y;
  const g = criarGrafico({
    x: V.x, y: V.y, largura: LARGURA, rotuloX: V.rotuloX ?? nomeVar, rotuloY: V.rotuloY ?? 'y', aria: V.aria,
  });
  const risca = juntarRiscas(g);
  const legenda = [];
  const falas = [];

  // zonas proibidas (fora do domínio) e as suas assíntotas
  for (const z of V.zonas || []) {
    if (!visivel(z, n)) continue;
    const lo = z.eixo === 'x' ? z.de ?? x0 : z.de ?? y0;
    const hi = z.eixo === 'x' ? z.ate ?? x1 : z.ate ?? y1;
    if (z.eixo === 'x') g.area(() => y1, lo, hi, { entre: y0, cor: risca });
    else g.area(() => hi, x0, x1, { entre: lo, cor: risca });
    if (z.assintota && z.ate != null) g.retaVertical(z.ate, { rotulo: z.assintota });
    (z.rotulo || []).forEach((linha, k) => {
      if (z.eixo === 'x') {
        g.rotulo((Math.max(lo, x0) + Math.min(hi, x1)) / 2, y1 - (y1 - y0) * 0.1, linha, { ancora: 'middle', dx: 0, dy: 14 * k, cor: 'assint' });
      } else {
        const a = Math.max(lo, y0);
        const b = Math.min(hi, y1);
        g.rotulo((x0 + x1) / 2, a + (b - a) * 0.3, linha, { ancora: 'middle', dx: 0, dy: 14 * k, cor: 'assint' });
      }
    });
    if (z.legenda) legenda.push({ tipo: 'zona', risca, texto: z.legenda });
  }

  // conjunto-solução das inequações: faixa vertical, barra no eixo e extremos
  if (V.conjunto && visivel(V.conjunto, n)) {
    for (const iv of M.conjunto) {
      const a = iv.de ?? x0;
      const b = iv.ate ?? x1;
      g.area(() => y1, a, b, { entre: y0, cor: 'tg', opacidade: 0.13 });
      g.segmento(a, 0, b, 0, { cor: 'tg', espessura: 6 });
      if (iv.de != null) g.ponto(iv.de, 0, { cor: 'tg', oco: iv.abertoDe, raio: 5.5 });
      if (iv.ate != null) g.ponto(iv.ate, 0, { cor: 'tg', oco: iv.abertoAte, raio: 5.5 });
      g.rotulo((Math.max(a, x0) + Math.min(b, x1)) / 2, 0, 'solução', { ancora: 'middle', dx: 0, dy: -12, cor: 'tg' });
    }
    legenda.push({ tipo: 'conjunto', texto: V.conjunto.legenda || 'solução' });
  }

  // retas horizontais (as soluções em u, na vista «Voltar a x»)
  for (const r of V.retasH || []) {
    if (!visivel(r, n)) continue;
    const rej = r.estado === 'rejeitada';
    g.retaHorizontal(r.y, { cor: rej ? COR_REJEITADA : 'log', tracejado: rej, rotulo: r.rotulo, posRotulo: 'esq', espessura: 1.8 });
  }

  // curvas
  const fn = {};
  for (const c of V.curvas) {
    fn[c.id] = funcaoDe(c.expr, nomeVar, consts);
    if (!visivel(c, n)) continue;
    g.curva(fn[c.id], { cor: c.cor || COR_PAPEL[c.papel], tracejado: c.tracejado, espessura: 2.6 });
    legenda.push({ tipo: 'curva', cor: c.cor || COR_PAPEL[c.papel], tracejado: c.tracejado, rotulo: c.legenda || ROTULO_PAPEL[c.papel], tex: c.tex });
  }

  // pontos: candidatas até serem decididas, depois aceites ou rejeitadas
  const vistos = new Set();
  for (const p of V.pontos || []) {
    if (!visivel(p, n)) continue;
    let x;
    if (p.x === 'param') {
      const r = resolverParametro(pred, valor);
      if (!r.existe) continue;
      x = r.x;
    } else if (p.sol !== undefined) {
      x = M.solucoes[p.sol].v;
    } else if (p.rej !== undefined) {
      x = M.rejeitadas[p.rej].v;
    } else if (p.fim) {
      x = M.conjunto[p.fim[0]][p.fim[1]];
    } else {
      x = p.x;
    }
    const y = p.y !== undefined ? p.y : fn[p.em](x);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const decidido = p.decide === undefined || n > p.decide;
    const estado = decidido ? p.estado : 'candidata';
    let oco = estado !== 'aceite';
    if (estado === 'fronteira') oco = M.conjunto[p.fim[0]][p.fim[1] === 'de' ? 'abertoDe' : 'abertoAte'];
    let rotulo = rotuloValor(nomeVar, x);
    if (estado === 'rejeitada') rotulo += ' (rejeitada)';
    g.ponto(x, y, { cor: COR_PONTO[estado], oco, raio: 5.5, rotulo, posRotulo: p.pos || 'auto' });
    vistos.add(estado);
    const fala = { aceite: 'solução aceite', rejeitada: 'solução rejeitada', candidata: 'candidata', fronteira: 'extremo do intervalo' }[estado];
    falas.push(`${fala} em ${rotuloValor(nomeVar, x)}`);
  }
  if (vistos.has('aceite')) legenda.push({ tipo: 'ponto', cor: COR_PONTO.aceite, oco: false, texto: 'solução aceite' });
  if (vistos.has('rejeitada')) legenda.push({ tipo: 'ponto', cor: COR_REJEITADA, oco: true, texto: 'rejeitada (fora do domínio)' });
  if (vistos.has('candidata')) legenda.push({ tipo: 'ponto', cor: COR_PONTO.candidata, oco: true, texto: 'candidata, ainda por verificar' });
  if (vistos.has('fronteira')) legenda.push({ tipo: 'ponto', cor: COR_PONTO.fronteira, oco: true, texto: 'extremo (não incluído)' });

  g.definirAria(falas.length ? `${V.aria} Pontos marcados: ${falas.join('; ')}.` : V.aria);
  return { g, legenda };
}

/** Amostra da legenda: um pequeno SVG com a linha, o ponto ou o padrão. */
function amostra(item) {
  const svg = criar('svg', { class: 'eq-amostra', width: 30, height: 14, viewBox: '0 0 30 14', 'aria-hidden': 'true', focusable: 'false' });
  const cor = item.cor ? (item.cor.startsWith('var') ? item.cor : `var(--c-${item.cor})`) : 'currentColor';
  if (item.tipo === 'curva') {
    svg.append(criar('line', { x1: 2, y1: 7, x2: 28, y2: 7, style: `stroke:${cor}`, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-dasharray': item.tracejado ? '5 4' : undefined }));
  } else if (item.tipo === 'ponto') {
    svg.append(criar('circle', { cx: 15, cy: 7, r: 5, 'stroke-width': 2, style: item.oco ? `fill:var(--papel, #fff);stroke:${cor}` : `fill:${cor};stroke:var(--papel, #fff)` }));
  } else if (item.tipo === 'zona') {
    svg.append(criar('rect', { x: 1, y: 1, width: 28, height: 12, rx: 2, style: `fill:${item.risca};stroke:var(--tinta-suave)`, 'stroke-width': 0.8 }));
  } else {
    svg.append(
      criar('rect', { x: 1, y: 1, width: 28, height: 12, rx: 2, style: 'fill:var(--c-tg);fill-opacity:0.13;stroke:none' }),
      criar('line', { x1: 2, y1: 7, x2: 28, y2: 7, style: 'stroke:var(--c-tg)', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    );
  }
  return svg;
}

function itemLegenda(item) {
  const texto = h('span', { class: 'eq-legenda__texto' });
  if (item.tipo === 'curva') {
    texto.append(`${item.rotulo}: `);
    const f = h('span');
    f.innerHTML = tex(item.tex);
    texto.append(f);
  } else {
    texto.append(item.texto);
  }
  return h('li', { class: 'eq-legenda__item' }, amostra(item), texto);
}

// ---------- o widget ----------

export async function montar(el, dados) {
  const conteudo = await carregar();
  const preds = conteudo.predefinidas;
  const id = `eq${++contador}`;
  const reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const est = { i: 0, n: 0, vista: '', valor: 0 };
  let desenhados = 0; // passos já escritos no DOM

  // --- escolha da predefinida ---
  const botoesPred = [];
  const escolha = h('div', { class: 'eq-escolha' });
  for (const gr of conteudo.grupos) {
    const chips = h('div', { class: 'chips eq-chips', role: 'group', 'aria-label': gr.titulo });
    preds.forEach((p, i) => {
      if (p.grupo !== gr.id) return;
      const b = h('button', { type: 'button', class: 'chip eq-chip', 'aria-pressed': 'false' }, p.chip);
      b.addEventListener('click', () => escolher(i));
      botoesPred[i] = b;
      chips.append(b);
    });
    escolha.append(h('div', { class: 'eq-grupo' }, h('p', { class: 'eq-grupo__nome' }, gr.titulo), chips));
  }

  // --- enunciado ---
  const enunciadoTexto = h('p', { class: 'eq-enunciado__texto' });
  const enunciadoFormula = h('div', { class: 'eq-formula' });
  const enunciado = h('div', { class: 'eq-enunciado', 'aria-live': 'polite' }, enunciadoTexto, enunciadoFormula);

  // --- coluna do gráfico ---
  const vistasEl = h('div', { class: 'chips eq-vistas', role: 'group', 'aria-label': 'Vista do gráfico' });
  const figura = h('div', { class: 'eq-figura' });
  const legendaEl = h('ul', { class: 'eq-legenda', 'aria-label': 'Legenda do gráfico' });
  const idSlider = `${id}-par`;
  const parRotulo = h('label', { for: idSlider, class: 'eq-param__rotulo' });
  const parSaida = h('output', { for: idSlider, class: 'eq-param__valor' });
  const parInput = h('input', { type: 'range', id: idSlider, class: 'eq-range' });
  const leitura = h('p', { class: 'eq-leitura', 'aria-live': 'polite' });
  const parEl = h('div', { class: 'eq-param', hidden: true }, h('div', { class: 'eq-param__topo' }, parRotulo, parSaida), parInput, leitura);
  const colunaGrafico = h('div', { class: 'eq-col eq-col--grafico' }, vistasEl, figura, legendaEl, parEl);

  // --- coluna da resolução ---
  const metodo = h('ol', { class: 'eq-metodo', 'aria-label': 'O método' },
    ...FASES.map(([chave, nome], k) => h('li', { class: 'eq-metodo__fase', 'data-fase': chave }, h('span', { class: 'eq-metodo__num' }, String(k + 1)), nome)));
  const vazio = h('p', { class: 'nota eq-vazio' }, 'Carrega em «Mostrar o passo seguinte» para começar. Primeiro o domínio, depois a resolução, no fim a verificação.');
  const passosEl = h('ol', { class: 'eq-passos' });
  const respostaEl = h('div', { class: 'eq-resposta', hidden: true });
  const resolucao = h('div', { class: 'eq-resolucao', 'aria-live': 'polite' }, passosEl, respostaEl);
  const progresso = h('p', { class: 'eq-progresso' });
  const btnSeg = h('button', { type: 'button', class: 'botao eq-btn eq-btn--seguinte' }, 'Mostrar o passo seguinte');
  const btnTudo = h('button', { type: 'button', class: 'botao botao--suave eq-btn' }, 'Mostrar tudo');
  const btnRec = h('button', { type: 'button', class: 'botao botao--suave eq-btn' }, 'Recomeçar');
  const acoes = h('div', { class: 'eq-acoes' }, btnSeg, btnTudo, btnRec);
  const colunaResolucao = h('div', { class: 'eq-col eq-col--resolucao' }, metodo, vazio, resolucao, progresso, acoes);

  const estado = h('p', { class: 'sr-only', role: 'status' });
  const raiz = h('div', { class: 'widget eq' },
    h('p', { class: 'widget__titulo' }, 'Resolve passo a passo'),
    h('p', { class: 'eq-intro' }, 'Escolhe um tipo de equação. O gráfico mostra porque é que cada solução é aceite ou rejeitada.'),
    escolha, enunciado,
    h('div', { class: 'eq-quadro' }, colunaGrafico, colunaResolucao),
    estado);
  el.replaceChildren(raiz);

  const atual = () => preds[est.i];
  const vistaAtual = () => atual().vistas.find((v) => v.id === est.vista) || atual().vistas[0];

  // --- gráfico ---
  function desenhar() {
    const { g, legenda } = desenharVista(atual(), vistaAtual(), est.n, est.valor);
    figura.replaceChildren(g.svg);
    legendaEl.replaceChildren(...legenda.map(itemLegenda));
  }

  let botoesVista = [];

  /** Os chips das vistas fazem-se uma vez por predefinida (para o foco não se perder ao clicar). */
  function construirVistas() {
    const p = atual();
    vistasEl.hidden = p.vistas.length < 2;
    botoesVista = p.vistas.map((v) => {
      const b = h('button', { type: 'button', class: 'chip eq-chip', 'aria-pressed': 'false' }, v.rotulo);
      b.addEventListener('click', () => {
        est.vista = v.id;
        marcarVista();
        desenhar();
      });
      return b;
    });
    vistasEl.replaceChildren(...botoesVista);
  }

  function marcarVista() {
    atual().vistas.forEach((v, k) => botoesVista[k].setAttribute('aria-pressed', String(v.id === est.vista)));
  }

  // --- parâmetro ---
  function atualizarParametro(redesenhar) {
    const p = atual();
    if (!p.param) return;
    const v = est.valor;
    parSaida.textContent = dec(v, 2);
    parInput.setAttribute('aria-valuetext', `${p.param.nome} igual a ${dec(v, 2)}`);
    leitura.replaceChildren(misto(h('span'), LEITURAS[p.param.leitura](v, resolverParametro(p, v))));
    if (redesenhar) desenhar();
  }

  // --- passos ---
  function criarPasso(p, k) {
    const passo = p.passos[k];
    const cabeca = h('p', { class: 'eq-passo__cabeca' },
      h('span', { class: 'eq-passo__num' }, `Passo ${k + 1} de ${p.passos.length}`));
    cabeca.append(' ', misto(h('strong', { class: 'eq-passo__titulo' }), passo.titulo));
    const corpo = h('div', { class: 'eq-passo__corpo' });
    corpo.append(misto(h('p', { class: 'eq-passo__texto' }), passo.texto));
    for (const l of passo.linhas) {
      const linha = h('div', { class: 'eq-linha' });
      linha.innerHTML = linhaTex(l.tex);
      corpo.append(linha);
    }
    return h('li', { class: 'eq-passo', 'data-fase': passo.fase }, cabeca, corpo);
  }

  function atualizarMetodo() {
    const p = atual();
    const ultimo = est.n > 0 ? p.passos[est.n - 1].fase : null;
    const idx = FASES.findIndex(([chave]) => chave === ultimo);
    metodo.querySelectorAll('.eq-metodo__fase').forEach((li, k) => {
      li.classList.toggle('eq-metodo__fase--feita', idx > k || (idx === k && est.n === p.passos.length));
      li.classList.toggle('eq-metodo__fase--atual', idx === k && est.n < p.passos.length);
      if (idx === k && est.n < p.passos.length) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

  function mostrarAte(n) {
    const p = atual();
    while (desenhados < n) {
      passosEl.append(criarPasso(p, desenhados));
      const passo = p.passos[desenhados];
      if (passo.vista) est.vista = passo.vista;
      desenhados += 1;
    }
    est.n = n;
    const fim = n >= p.passos.length;
    respostaEl.hidden = !fim;
    if (fim && !respostaEl.firstChild) {
      respostaEl.append(h('p', { class: 'eq-resposta__titulo' }, 'Resposta'));
      const f = h('div', { class: 'eq-resposta__formula' });
      f.innerHTML = linhaTex(p.resposta);
      respostaEl.append(f);
    }
    vazio.hidden = n > 0;
    progresso.textContent = n === 0 ? '' : fim ? `Passo ${n} de ${n}: resolução completa.` : `Passo ${n} de ${p.passos.length}`;
    btnSeg.disabled = fim;
    btnTudo.disabled = fim;
    btnRec.disabled = n === 0;
    atualizarMetodo();
    marcarVista();
    desenhar();
  }

  function reiniciar() {
    passosEl.replaceChildren();
    respostaEl.replaceChildren();
    desenhados = 0;
    est.vista = atual().vistas[0].id;
    mostrarAte(0);
  }

  function escolher(i) {
    est.i = i;
    const p = atual();
    botoesPred.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    enunciadoTexto.replaceChildren(misto(h('span'), p.enunciado));
    enunciadoFormula.innerHTML = tex(p.modelo.tex, true);
    est.valor = p.param ? p.param.inicial : 0;
    parEl.hidden = !p.param;
    if (p.param) {
      parRotulo.replaceChildren(p.param.rotulo);
      parInput.min = p.param.min;
      parInput.max = p.param.max;
      parInput.step = p.param.passo;
      parInput.value = p.param.inicial;
    }
    construirVistas();
    reiniciar();
    atualizarParametro(false);
  }

  // --- eventos ---
  btnSeg.addEventListener('click', () => {
    mostrarAte(est.n + 1);
    if (btnSeg.disabled) {
      btnRec.focus({ preventScroll: true }); // o botão que tinha o foco ficou desativado
    }
    acoes.scrollIntoView({ block: 'nearest', behavior: reduzMovimento ? 'auto' : 'smooth' });
  });
  btnTudo.addEventListener('click', () => {
    mostrarAte(atual().passos.length);
    btnRec.focus({ preventScroll: true });
  });
  btnRec.addEventListener('click', () => {
    reiniciar();
    estado.textContent = 'Resolução reiniciada.';
    btnSeg.focus({ preventScroll: true });
  });
  parInput.addEventListener('input', () => {
    est.valor = Number(parInput.value);
    atualizarParametro(true);
  });

  escolher(0);
}
