// Verdadeiro ou falso (Probabilidades). Uma afirmação de cada vez, com explicação e,
// onde ajuda, uma figura pequena desenhada em SVG a partir do campo opcional `figura`.
// Progresso guardado em progresso:
//   'vf'  { [idAfirmacao]: 1 }   afirmações já acertadas à primeira (numa ronda normal)
//   'vf-tema' 'todos' | idTema   último filtro escolhido
// Todo o estado vive dentro de montar(); nada fica no módulo.

import { renderizar } from '../../assets/motor/katex.js';
import { baralhar, criarRng } from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/progresso.js';

const NS = 'http://www.w3.org/2000/svg';

/** Cria um elemento: h('button', { class: 'x', onclick: fn }, 'texto', outroNo). */
function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos.flat(Infinity)) {
    if (f !== null && f !== undefined && f !== false) e.append(f);
  }
  return e;
}

/** Elemento SVG: s('path', { d: '...', class: 'x' }). */
function s(tag, props = {}, ...filhos) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, String(v));
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f);
  return e;
}

// Dentro de $...$ um «<» ou «&» é matemática e não HTML, por isso escapam-se só aí.
const FORMULA = /\$\$[\s\S]+?\$\$|\$[^$]+?\$/g;
function seguro(texto) {
  return String(texto === undefined || texto === null ? '' : texto).replace(FORMULA, (m) => m
    .replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'));
}

/** Cola a pontuação que vem logo a seguir a uma fórmula, para não ficar sozinha na linha seguinte. */
function colarPontuacao(raiz) {
  for (const k of raiz.querySelectorAll('.katex')) {
    const nodo = k.parentNode !== raiz && k.parentNode.childNodes.length === 1 ? k.parentNode : k;
    const prox = nodo.nextSibling;
    if (!prox || prox.nodeType !== 3) continue;
    const m = /^[.,;:!?)]+/.exec(prox.data);
    if (!m) continue;
    const cola = document.createElement('span');
    cola.className = 'vf-cola';
    nodo.replaceWith(cola);
    cola.append(nodo, document.createTextNode(m[0]));
    prox.data = prox.data.slice(m[0].length);
  }
}

function comFormulas(tag, classe, texto) {
  const e = h(tag, { class: classe, html: seguro(texto) });
  renderizar(e);
  colarPontuacao(e);
  return e;
}

const virgula = (n, casas = 2) => Number(n.toFixed(casas)).toString().replace('.', ',').replace('-', '−');
const plural = (n, um, varios) => (n === 1 ? um : varios);

// ---------- figuras (SVG simples) ----------

const lista = (v) => (Array.isArray(v) ? v : [v]);
const densidade = (x, mu, sg) => Math.exp(-0.5 * ((x - mu) / sg) ** 2) / (sg * Math.sqrt(2 * Math.PI));

function erf(x) { // Abramowitz e Stegun 7.1.26, erro < 1,5e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

const L = 320; const A = 160; // largura e altura da viewBox
const ESQ = 14; const DIR = 306; const BASE = 112; const TOPO = 22;

function nova(rotulo) {
  return s('svg', { viewBox: `0 0 ${L} ${A}`, class: 'vf-fig__svg', role: 'img', 'aria-label': rotulo, focusable: 'false' });
}

function figBarras(f) {
  const xs = f.x; const ps = f.p;
  if (!Array.isArray(xs) || !Array.isArray(ps) || xs.length !== ps.length || !xs.length) return null;
  const media = xs.reduce((a, x, i) => a + x * ps[i], 0);
  const destaque = Array.isArray(f.destaque) ? f.destaque : null;
  const partes = xs.map((x, i) => `${virgula(x)} com probabilidade ${virgula(ps[i])}`);
  const rotulo = `Gráfico de barras da tabela de distribuição: ${partes.join('; ')}.`
    + (f.media ? ` O valor médio é ${virgula(media)}.` : '');
  const svg = nova(rotulo);
  const n = xs.length;
  const passo = (DIR - ESQ) / n;
  const larg = Math.min(46, passo * 0.6);
  const maxP = Math.max(...ps);
  const alt = BASE - TOPO - 12;
  svg.append(s('line', { x1: ESQ, y1: BASE, x2: DIR, y2: BASE, class: 'vf-fig__eixo' }));
  const posX = (i) => ESQ + passo * (i + 0.5);
  xs.forEach((x, i) => {
    const hh = (ps[i] / maxP) * alt;
    const em = !destaque || destaque.includes(x);
    svg.append(
      s('rect', { x: posX(i) - larg / 2, y: BASE - hh, width: larg, height: hh, class: `vf-fig__barra${em ? '' : ' vf-fig__barra--apagada'}` }),
      s('text', { x: posX(i), y: BASE - hh - 5, class: 'vf-fig__txt', 'text-anchor': 'middle' }, virgula(ps[i])),
      s('text', { x: posX(i), y: BASE + 15, class: 'vf-fig__txt vf-fig__txt--eixo', 'text-anchor': 'middle' }, virgula(x)));
  });
  if (f.media) {
    // posição do valor médio entre as barras (interpolação linear entre os valores de x)
    const x0 = xs[0]; const x1 = xs[n - 1];
    const cx = x1 === x0 ? posX(0) : posX(0) + ((media - x0) / (x1 - x0)) * (posX(n - 1) - posX(0));
    svg.append(
      s('path', { d: `M${cx} ${BASE + 3} l-6 10 l12 0 z`, class: 'vf-fig__marca' }),
      s('text', { x: cx, y: BASE + 40, class: 'vf-fig__txt vf-fig__txt--forte', 'text-anchor': 'middle' }, `μ = ${virgula(media)}`));
  }
  return svg;
}

function dominioNormal(mus, sgs, k) {
  const m = Math.max(...sgs);
  return [Math.min(...mus) - Math.max(3.4, k + 0.9) * m, Math.max(...mus) + Math.max(3.4, k + 0.9) * m];
}

function caminhoCurva(mu, sg, xmin, xmax, ymax) {
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N;
    const px = ESQ + ((x - xmin) / (xmax - xmin)) * (DIR - ESQ);
    const py = BASE - (densidade(x, mu, sg) / ymax) * (BASE - TOPO);
    pts.push(`${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return pts.join(' ');
}

function figNormal(f) {
  const mus = lista(f.mu); const sgs = lista(f.sigma);
  const n = Math.max(mus.length, sgs.length);
  if (n < 1 || mus.some((v) => typeof v !== 'number') || sgs.some((v) => typeof v !== 'number' || v <= 0)) return null;
  const curvas = Array.from({ length: n }, (_, i) => ({ mu: mus[i % mus.length], sg: sgs[i % sgs.length] }));
  const [xmin, xmax] = dominioNormal(curvas.map((c) => c.mu), curvas.map((c) => c.sg), 0);
  const ymax = Math.max(...curvas.map((c) => densidade(c.mu, c.mu, c.sg))) * 1.08;
  const descr = curvas.map((c) => `μ = ${virgula(c.mu)} e σ = ${virgula(c.sg)}`).join('; ');
  const svg = nova(`Curvas Normais com ${descr}. Todas têm área total 1.`);
  svg.append(s('line', { x1: ESQ, y1: BASE, x2: DIR, y2: BASE, class: 'vf-fig__eixo' }));
  const px = (x) => ESQ + ((x - xmin) / (xmax - xmin)) * (DIR - ESQ);
  const marcados = new Set(); // com o mesmo μ nas duas curvas, a marca e o rótulo do eixo desenham-se uma vez só
  curvas.forEach((c, i) => {
    svg.append(s('path', { d: caminhoCurva(c.mu, c.sg, xmin, xmax, ymax), class: `vf-fig__curva vf-fig__curva--${i % 2}` }));
    if (marcados.has(c.mu)) return;
    marcados.add(c.mu);
    svg.append(s('line', { x1: px(c.mu), y1: BASE, x2: px(c.mu), y2: BASE + 5, class: 'vf-fig__eixo' }));
    svg.append(s('text', { x: px(c.mu), y: BASE + 18, class: 'vf-fig__txt vf-fig__txt--eixo', 'text-anchor': 'middle' }, `μ = ${virgula(c.mu)}`));
  });
  // legenda: diferenciada por traço e por texto, não só pela cor
  const comp = new Set(curvas.map((c) => c.sg)).size > 1 ? 'sg' : 'mu';
  curvas.forEach((c, i) => {
    const y = 14 + i * 16;
    svg.append(
      s('line', { x1: L - 96, y1: y - 4, x2: L - 74, y2: y - 4, class: `vf-fig__curva vf-fig__curva--${i % 2}` }),
      s('text', { x: L - 69, y, class: 'vf-fig__txt' }, comp === 'sg' ? `σ = ${virgula(c.sg)}` : `μ = ${virgula(c.mu)}`));
  });
  return svg;
}

function figIntervalo(f) {
  const { mu, sigma: sg, k } = f;
  if (typeof mu !== 'number' || typeof sg !== 'number' || sg <= 0 || typeof k !== 'number' || k <= 0) return null;
  const [xmin, xmax] = dominioNormal([mu], [sg], k);
  const ymax = densidade(mu, mu, sg) * 1.12;
  const prob = erf(k / Math.SQRT2);
  const pct = `${virgula(prob * 100, 2)}%`;
  const kt = k === 1 ? '' : virgula(k);
  const svg = nova(`Curva Normal com a zona entre μ − ${kt}σ e μ + ${kt}σ sombreada, com área ${virgula(prob, 4)}, cerca de ${pct}.`);
  const px = (x) => ESQ + ((x - xmin) / (xmax - xmin)) * (DIR - ESQ);
  const a = mu - k * sg; const b = mu + k * sg;
  const pts = [`M${px(a).toFixed(1)} ${BASE}`];
  const N = 70;
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N;
    pts.push(`L${px(x).toFixed(1)} ${(BASE - (densidade(x, mu, sg) / ymax) * (BASE - TOPO)).toFixed(1)}`);
  }
  pts.push(`L${px(b).toFixed(1)} ${BASE} Z`);
  svg.append(
    s('path', { d: pts.join(' '), class: 'vf-fig__area' }),
    s('path', { d: caminhoCurva(mu, sg, xmin, xmax, ymax), class: 'vf-fig__curva vf-fig__curva--0' }),
    s('line', { x1: ESQ, y1: BASE, x2: DIR, y2: BASE, class: 'vf-fig__eixo' }));
  const marca = [[a, `μ − ${kt}σ`], [mu, 'μ'], [b, `μ + ${kt}σ`]];
  for (const [x, t] of marca) {
    svg.append(
      s('line', { x1: px(x), y1: BASE, x2: px(x), y2: BASE + 5, class: 'vf-fig__eixo' }),
      s('text', { x: px(x), y: BASE + 19, class: 'vf-fig__txt vf-fig__txt--eixo', 'text-anchor': 'middle' }, t));
  }
  svg.append(s('text', { x: px(mu), y: BASE - (BASE - TOPO) * 0.32, class: 'vf-fig__txt vf-fig__txt--forte', 'text-anchor': 'middle' }, pct));
  return svg;
}

function figura(f) {
  if (!f || typeof f !== 'object') return null;
  try {
    const svg = f.tipo === 'barras' ? figBarras(f)
      : f.tipo === 'normal' ? figNormal(f)
        : f.tipo === 'normal-intervalo' ? figIntervalo(f) : null;
    return svg ? h('div', { class: 'vf-fig' }, svg) : null;
  } catch (e) {
    return null;
  }
}

// ---------- validação ----------

function valida(a) {
  return !!a && typeof a === 'object'
    && a.id !== undefined && a.id !== null && a.id !== ''
    && typeof a.texto === 'string' && a.texto.trim() !== ''
    && typeof a.verdadeira === 'boolean'
    && typeof a.explicacao === 'string';
}

/**
 * `extra` é opcional e serve só para testes: { semente } fixa o gerador aleatório.
 */
export async function montar(el, extra = {}) {
  const raiz = h('div', { class: 'widget vf' });
  el.replaceChildren(raiz);

  let dados;
  try {
    const resp = await fetch(new URL('../dados/verdadeiro-falso.json', import.meta.url));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dados = await resp.json();
  } catch (e) {
    console.error('vf: não consegui carregar as afirmações', e);
    raiz.append(h('p', { class: 'aviso-erro' }, 'As afirmações não carregaram. Recarrega a página.'));
    return;
  }

  const vistos = new Set();
  const todas = (Array.isArray(dados && dados.afirmacoes) ? dados.afirmacoes : []).filter((a) => {
    if (!valida(a) || vistos.has(String(a.id))) return false;
    vistos.add(String(a.id));
    return true;
  });
  if (todas.length === 0) {
    raiz.append(h('p', { class: 'nota' }, 'Ainda não há afirmações.'));
    return;
  }
  const temas = (Array.isArray(dados.temas) ? dados.temas : []).filter((t) => t && t.id && todas.some((a) => a.tema === t.id));
  const nomeTema = (id) => (temas.find((t) => t.id === id) || { nome: String(id) }).nome;

  const rng = criarRng(extra.semente);
  const uid = Math.random().toString(36).slice(2, 8);

  // ---------- estado ----------

  const guardadoTema = P.ler('vf-tema', 'todos');
  let tema = guardadoTema === 'todos' || temas.some((t) => t.id === guardadoTema) ? guardadoTema : 'todos';
  let ronda = null; // { itens, indice, revisao, respondida }
  let guardouTudo = true;

  const acertadas = () => {
    const r = P.ler('vf', {});
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  };
  function marcarAcertada(id) {
    if (!P.guardar('vf', { ...acertadas(), [id]: 1 })) guardouTudo = false;
  }
  const doTema = () => todas.filter((a) => tema === 'todos' || a.tema === tema);

  // ---------- peças fixas: filtro e zona da afirmação ----------

  const vivo = h('p', { class: 'vf-vivo', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const palco = h('div', { class: 'vf-palco' });
  const chipsEl = h('div', { class: 'chips vf-temas', role: 'group', 'aria-label': 'Tema' });
  const estat = h('p', { class: 'vf-estat nota' });

  const opcoesTema = [{ id: 'todos', nome: 'Todos', n: todas.length }, ...temas.map((t) => ({ id: t.id, nome: t.nome, n: todas.filter((a) => a.tema === t.id).length }))];
  const chips = opcoesTema.map((o) => h('button', {
    type: 'button', class: 'chip', 'data-tema': o.id,
    onclick: () => { tema = o.id; P.guardar('vf-tema', tema); desenharChips(); comecar(doTema()); },
  }, `${o.nome} (${o.n})`));
  chipsEl.append(...chips);

  /** Atualiza os chips e a frase de progresso sem os recriar (o foco do teclado fica onde está). */
  function desenharChips() {
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.tema === tema));
    const total = doTema().length;
    const certas = doTema().filter((a) => acertadas()[a.id] === 1).length;
    estat.textContent = `Já acertaste à primeira em ${certas} de ${total} ${plural(total, 'afirmação', 'afirmações')} deste filtro.`;
  }

  raiz.append(h('div', { class: 'vf-topo' }, chipsEl, estat), palco);
  el.append(vivo);

  // ---------- rondas ----------

  function comecar(afirmacoes, revisao = false) {
    ronda = { itens: baralhar(rng, afirmacoes).map((a) => ({ a, resposta: null, certa: null })), indice: 0, revisao, respondida: false };
    ecraAfirmacao(false);
  }

  function ecraAfirmacao(focar = true) {
    const r = ronda;
    const item = r.itens[r.indice];
    const a = item.a;
    const n = r.itens.length;
    r.respondida = false;

    const cheia = h('div', { class: 'vf-barra__cheia' });
    cheia.style.width = `${(100 * r.indice) / n}%`;
    const barra = h('div', {
      class: 'vf-barra', role: 'progressbar', 'aria-label': 'Progresso', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': r.indice,
    }, cheia);

    const idEnun = `vf-${uid}-enun`;
    const enunciado = comFormulas('p', 'vf-enunciado', a.texto);
    enunciado.id = idEnun;
    enunciado.tabIndex = -1;

    const mk = (valor, rotulo) => {
      const marca = h('span', { class: 'vf-resp__marca' });
      const b = h('button', { type: 'button', class: 'vf-resp', 'data-valor': String(valor), onclick: () => responder(valor) },
        h('span', { class: 'vf-resp__rotulo' }, rotulo), marca);
      b.marca = marca;
      return b;
    };
    const bV = mk(true, 'Verdadeiro');
    const bF = mk(false, 'Falso');
    const botoes = [bV, bF];
    const grupo = h('div', { class: 'vf-respostas', role: 'group', 'aria-labelledby': idEnun }, bV, bF);
    grupo.addEventListener('keydown', (ev) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
      const i = botoes.indexOf(document.activeElement);
      if (i < 0) return;
      ev.preventDefault();
      botoes[(i + 1) % botoes.length].focus(); // só há dois botões, qualquer seta passa ao outro
    });

    const resultado = h('div', { class: 'vf-resultado', 'aria-live': 'polite' });

    function responder(valor) {
      if (r.respondida) return;
      r.respondida = true;
      item.resposta = valor;
      item.certa = valor === a.verdadeira;
      if (item.certa && !r.revisao) marcarAcertada(a.id);
      botoes.forEach((b) => {
        const v = b.dataset.valor === 'true';
        b.disabled = true;
        if (v === valor) {
          b.classList.add('vf-resp--escolhida', item.certa ? 'vf-resp--certa' : 'vf-resp--errada');
          b.marca.textContent = item.certa ? '✓ Certo' : '✗ Errado';
        } else if (v === a.verdadeira) {
          b.classList.add('vf-resp--certa');
          b.marca.textContent = '✓ Era esta';
        } else {
          b.classList.add('vf-resp--outra');
        }
      });
      cheia.style.width = `${(100 * (r.indice + 1)) / n}%`;
      barra.setAttribute('aria-valuenow', String(r.indice + 1));

      const ultima = r.indice === n - 1;
      const seguinte = h('button', { type: 'button', class: 'botao vf-seguinte', onclick: avancar }, ultima ? 'Ver resultado' : 'Próxima');
      resultado.className = `vf-resultado vf-resultado--${item.certa ? 'certo' : 'errado'}`;
      const fig = a.figura ? figura(a.figura) : null;
      resultado.replaceChildren(...[
        h('p', { class: 'vf-veredito' },
          h('span', { class: 'vf-veredito__simbolo', 'aria-hidden': 'true' }, item.certa ? '✓' : '✗'),
          h('strong', {}, item.certa ? 'Certo' : 'Errado'),
          ` A afirmação é ${a.verdadeira ? 'verdadeira' : 'falsa'}.`),
        comFormulas('p', 'vf-expl', a.explicacao),
        fig,
        a.erroComum ? h('div', { class: 'vf-erro' }, h('p', { class: 'vf-erro__titulo' }, 'Erro comum'), comFormulas('p', 'vf-erro__texto', a.erroComum)) : null,
        h('div', { class: 'vf-rodape' }, seguinte)].filter(Boolean));
      seguinte.focus();
    }

    palco.replaceChildren(h('div', { class: 'vf-cartao' },
      h('div', { class: 'vf-progresso' },
        h('p', { class: 'vf-contador' }, `${r.indice + 1} de ${n}`),
        h('p', { class: 'vf-etiqueta' }, nomeTema(a.tema) + (r.revisao ? ' (a rever)' : ''))),
      barra,
      enunciado,
      grupo,
      resultado));
    if (focar) enunciado.focus({ preventScroll: true });
  }

  function avancar() {
    if (!ronda || !ronda.respondida) return;
    if (ronda.indice >= ronda.itens.length - 1) ecraFim();
    else { ronda.indice += 1; ecraAfirmacao(); }
  }

  function ecraFim() {
    const r = ronda;
    const total = r.itens.length;
    const certas = r.itens.filter((i) => i.certa).length;
    const erradas = r.itens.filter((i) => !i.certa);
    desenharChips();

    const msg = `Fim. Acertaste ${certas} de ${total}.`;
    vivo.textContent = '';
    setTimeout(() => { vivo.textContent = msg; }, 60);

    const frase = erradas.length === 0 ? 'Sem falhas. Muito bem!'
      : certas * 2 >= total ? 'Estás no bom caminho. Vê as que falhaste e tenta outra vez.'
        : 'Ainda há trabalho a fazer. Lê as explicações com calma e repete.';
    const titulo = h('h3', { class: 'vf-titulo', tabindex: '-1' }, `Acertaste ${certas} de ${total}`);

    palco.replaceChildren(h('div', { class: 'vf-cartao vf-fim' }, // h() ignora os null

      titulo,
      h('p', {}, frase),
      erradas.length ? h('div', { class: 'vf-erradas' },
        h('h4', { class: 'vf-subtitulo' }, `Para rever (${erradas.length})`),
        h('ol', { class: 'vf-erradas__lista' }, erradas.map((i) => h('li', { class: 'vf-errada' },
          h('span', { class: 'vf-errada__tema' }, nomeTema(i.a.tema)),
          comFormulas('span', 'vf-errada__texto', i.a.texto),
          h('span', { class: 'vf-errada__nota' }, `✗ Era ${i.a.verdadeira ? 'verdadeira' : 'falsa'}.`))))) : null,
      guardouTudo ? null : h('p', { class: 'nota' }, 'Não consegui guardar o progresso neste dispositivo (por exemplo, numa janela privada). Esta ronda conta, mas não fica guardada.'),
      h('div', { class: 'vf-acoes' },
        erradas.length ? h('button', { type: 'button', class: 'botao', onclick: () => comecar(erradas.map((i) => i.a), true) }, 'Recomeçar só com as erradas') : null,
        h('button', { type: 'button', class: erradas.length ? 'botao botao--suave' : 'botao', onclick: () => comecar(doTema()) }, 'Recomeçar com todas'))));
    titulo.focus({ preventScroll: true });
    if (raiz.getBoundingClientRect().top < 0) raiz.scrollIntoView({ block: 'start' });
  }

  desenharChips();
  comecar(doTema());
}
