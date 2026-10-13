// Verdadeiro ou falso (Exponenciais e logaritmos). Uma afirmação de cada vez; depois de responder
// mostra a correção, a explicação, o erro comum (nas falsas) e, se a afirmação trouxer `figura`, um gráfico pequeno.
// Recebe dados.vf = { afirmacoes: [...] } (ou só o array). Cada afirmação traz id, tema (o id de um GRUPO de
// ../grupos.js), texto, verdadeira (booleano) e explicacao; opcionais: erroComum e figura. O campo `verifica` é
// só do verificador e não é usado aqui.
// `figura` segue o esquema comum do tema ({ tipo: 'grafico', x, y, curvas, retas, retasV, retasH, pontos, area,
// legenda }) e desenha-se com assets/motor/grafico.js. Só aparece depois de se responder, porque pode revelar a
// resposta (por exemplo a assíntota certa). Uma figura ilegível ou que falhe é ignorada: fica só a explicação.
// Progresso guardado em progresso (o prefixo «log-» existe porque o armazenamento é partilhado com os outros temas):
//   'log-vf'       { [idAfirmacao]: 1 }   afirmações já acertadas à primeira (numa ronda normal)
//   'log-vf-tema'  'todos' | idTema       último filtro escolhido
// Todo o estado vive dentro de montar(); nada fica no módulo.

import { GRUPOS } from '../grupos.js';
import { renderizar } from '../../assets/motor/katex.js';
import { baralhar, criarRng } from '../../assets/motor/matematica.js';
import { criarGrafico, formatarNumero } from '../../assets/motor/grafico.js';
import * as P from '../../assets/motor/progresso.js';

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

const plural = (n, um, varios) => (n === 1 ? um : varios);

// ---------- figura (um gráfico pequeno) ----------

// Quando uma curva não diz a cor, usam-se estas por ordem (exponencial, logarítmica, y = x, tangente, derivada),
// para duas curvas na mesma figura nunca terem a mesma cor.
const COR_DAS_CURVAS = ['exp', 'log', 'id', 'tg', 'der'];

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehIntervalo = (v) => Array.isArray(v) && v.length === 2 && ehNumero(v[0]) && ehNumero(v[1]) && v[1] > v[0];
const emLista = (v) => (Array.isArray(v) ? v : []);
const limpo = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => formatarNumero(v, 3);
const juntar = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);

/** Uma reta vertical ou horizontal pode vir como número ou como { x | y, rotulo }. */
function guia(r, chave) {
  const o = ehNumero(r) ? { [chave]: r } : r;
  if (!o || typeof o !== 'object' || !ehNumero(o[chave])) throw new Error(`reta sem ${chave}`);
  return o;
}

/** Descrição para leitores de ecrã, quando a figura não traz `legenda`. */
function descricao(f) {
  const curvas = emLista(f.curvas).map((c) => limpo(c.rotulo) || `y = ${c.expr}`);
  const partes = [curvas.length ? `Gráfico de ${juntar(curvas)}.` : 'Gráfico cartesiano.'];
  const retas = emLista(f.retas).map((r) => limpo(r.rotulo) || `de declive ${num(r.declive)} e ordenada ${num(r.ordenada)}`);
  if (retas.length) partes.push(`${plural(retas.length, 'Reta', 'Retas')}: ${juntar(retas)}.`);
  const vs = emLista(f.retasV).map((r) => `x = ${num(guia(r, 'x').x)}`);
  if (vs.length) partes.push(`${plural(vs.length, 'Reta vertical', 'Retas verticais')}: ${juntar(vs)}.`);
  const hs = emLista(f.retasH).map((r) => `y = ${num(guia(r, 'y').y)}`);
  if (hs.length) partes.push(`${plural(hs.length, 'Reta horizontal', 'Retas horizontais')}: ${juntar(hs)}.`);
  const pontos = emLista(f.pontos).map((p) => {
    const rot = limpo(p.rotulo);
    const coord = `(${num(p.x)}; ${num(p.y)})`;
    return rot && !rot.startsWith('(') ? `${rot}, em ${coord}` : coord;
  });
  if (pontos.length) partes.push(`${plural(pontos.length, 'Ponto marcado', 'Pontos marcados')}: ${juntar(pontos)}.`);
  if (f.area) partes.push(`Zona sombreada sob y = ${f.area.expr}, entre x = ${num(f.area.de)} e x = ${num(f.area.ate)}.`);
  return partes.join(' ');
}

const sobrepoe = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** O segmento (x0,y0)-(x1,y1) toca no retângulo r? (corte de Liang-Barsky) */
function segmentoToca(x0, y0, x1, y1, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - r.x], [dx, r.x + r.width - x0], [-dy, y0 - r.y], [dy, r.y + r.height - y0]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

/**
 * Afasta os rótulos que ficaram uns sobre os outros, sobre um ponto, sobre os números e os eixos ou sobre uma
 * curva (duas curvas que acabam no mesmo sítio, dois pontos juntos...). Só mexe nos rótulos: na vertical e um pouco
 * na horizontal, sempre dentro da zona do gráfico. Precisa de o desenho já estar no documento, para medir o texto.
 * Se não conseguir medir, deixa como está.
 */
function afastarRotulos(svg) {
  try {
    const visivel = (e) => e.getClientRects().length > 0;
    const zona = (() => { // a zona do gráfico: fora dela os rótulos das curvas e das retas seriam cortados
      const c = svg.querySelector('clipPath rect');
      return { x: Number(c.getAttribute('x')) + 1, y: Number(c.getAttribute('y')) + 1, width: Number(c.getAttribute('width')) - 2, height: Number(c.getAttribute('height')) - 2 };
    })();
    const textosDe = (...nomes) => nomes.flatMap((n) => [...svg.querySelectorAll(`[data-camada="${n}"] text`)]).filter(visivel);
    // quem fica no sítio primeiro: pontos, guias e rótulos soltos; os das curvas, que se encostam a qualquer sítio, cedem
    const textos = textosDe('pontos', 'retas', 'texto', 'curvas');
    const caixas = [...svg.querySelectorAll('[data-camada="base"] text, [data-camada="pontos"] circle')].filter(visivel).map((e) => e.getBBox());
    const segmentos = [];
    for (const l of svg.querySelectorAll('[data-camada="base"] > line')) { // eixos e marcas (a grelha está noutro grupo)
      segmentos.push(['x1', 'y1', 'x2', 'y2'].map((a) => Number(l.getAttribute(a))));
    }
    for (const path of svg.querySelectorAll('[data-camada="curvas"] path')) {
      let anterior = null;
      for (const m of (path.getAttribute('d') || '').matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) {
        const ponto = [Number(m[2]), Number(m[3])];
        if (m[1] === 'L' && anterior) segmentos.push([...anterior, ...ponto]);
        anterior = ponto;
      }
    }
    const PASSO = 13;
    // Deslocamentos a experimentar, dos mais curtos para os mais compridos (mexer na vertical custa menos).
    // Um ponto não larga o seu rótulo: só sobe ou desce uma linha, ou passa para o outro lado do ponto.
    const candidatos = (b, deUmPonto, ancora) => {
      const lista = [];
      for (const dx of deUmPonto ? [0] : [0, -30, 30, -60, 60, -90]) {
        for (const dy of deUmPonto ? [0, -PASSO, PASSO] : [0, -PASSO, PASSO, -2 * PASSO, 2 * PASSO, -3 * PASSO, 3 * PASSO]) lista.push([dx, dy, Math.abs(dx) * 1.5 + Math.abs(dy)]);
      }
      if (deUmPonto && ancora !== 'middle') { // o rótulo está à direita ('start') ou à esquerda ('end') do ponto
        const dx = (ancora === 'end' ? 1 : -1) * (b.width + 19);
        for (const dy of [0, -PASSO, PASSO]) lista.push([dx, dy, 20 + Math.abs(dy)]);
      }
      return lista.sort((p, q) => p[2] - q[2]);
    };
    const rotulos = []; // caixas dos rótulos já pousados
    for (const t of textos) {
      const b = t.getBBox();
      const em = ([dx, dy]) => ({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height });
      const cabe = (r) => r.x >= zona.x && r.y >= zona.y && r.x + r.width <= zona.x + zona.width && r.y + r.height <= zona.y + zona.height;
      // quanto custa pousar aqui: outros rótulos pesam mais, depois números e pontos, depois o traço das curvas
      const custo = (r) => 100 * rotulos.filter((o) => sobrepoe(r, o)).length + 30 * caixas.filter((o) => sobrepoe(r, o)).length
        + Math.min(10, segmentos.filter(([x0, y0, x1, y1]) => segmentoToca(x0, y0, x1, y1, r)).length);
      let melhor = [0, 0, 0];
      let menor = Infinity;
      for (const d of candidatos(b, !!t.closest('[data-camada="pontos"]'), t.getAttribute('text-anchor'))) {
        if (!cabe(em(d))) continue;
        const c = custo(em(d)) + d[2] / 50; // com custos iguais, o mais perto
        if (c < menor) { menor = c; melhor = d; }
        if (c < 1) break; // livre de tudo, e sem se ter afastado
      }
      if (melhor[0] || melhor[1]) {
        t.setAttribute('x', String(+(Number(t.getAttribute('x')) + melhor[0]).toFixed(2)));
        t.setAttribute('y', String(+(Number(t.getAttribute('y')) + melhor[1]).toFixed(2)));
      }
      rotulos.push(em(melhor));
    }
  } catch (e) { /* sem medidas: os rótulos ficam onde o gráfico os pôs */ }
}

/** Desenha o campo `figura` de uma afirmação, ou devolve null se for ilegível ou der erro. */
function figura(f) {
  if (!f || typeof f !== 'object' || f.tipo !== 'grafico') return null;
  try {
    if (!ehIntervalo(f.x) || !ehIntervalo(f.y)) return null;
    const g = criarGrafico({
      x: f.x, y: f.y, largura: 300, altura: 225, // 300 de largura: a 390 px o texto fica perto do tamanho real
      aria: limpo(f.legenda) || limpo(f.aria) || descricao(f),
    });
    if (f.area) {
      if (typeof f.area.expr !== 'string' || !ehNumero(f.area.de) || !ehNumero(f.area.ate)) throw new Error('área mal definida');
      g.area(f.area.expr, f.area.de, f.area.ate);
    }
    for (const r of emLista(f.retas)) {
      if (!r || !ehNumero(r.declive) || !ehNumero(r.ordenada)) throw new Error('reta mal definida');
      g.reta(r.declive, r.ordenada, { rotulo: r.rotulo, cor: r.cor });
    }
    for (const r of emLista(f.retasV)) {
      const o = guia(r, 'x');
      g.retaVertical(o.x, { rotulo: o.rotulo ?? `x = ${num(o.x)}`, cor: o.cor, posRotulo: o.posRotulo });
    }
    for (const r of emLista(f.retasH)) {
      const o = guia(r, 'y');
      g.retaHorizontal(o.y, { rotulo: o.rotulo ?? `y = ${num(o.y)}`, cor: o.cor });
    }
    emLista(f.curvas).forEach((c, i) => {
      if (!c || typeof c.expr !== 'string' || c.expr.trim() === '') throw new Error('curva sem expressão');
      const item = g.curva(c.expr, { cor: c.cor || COR_DAS_CURVAS[i % COR_DAS_CURVAS.length], rotulo: c.rotulo });
      if (item.tracos === 0) throw new Error(`curva fora da janela: ${c.expr}`); // um gráfico sem a curva enganava
    });
    for (const p of emLista(f.pontos)) {
      if (!p || !ehNumero(p.x) || !ehNumero(p.y)) throw new Error('ponto mal definido');
      g.ponto(p.x, p.y, { rotulo: p.rotulo, cor: p.cor });
    }
    return h('div', { class: 'vf-fig' }, g.svg);
  } catch (e) {
    console.warn('vf: figura ignorada', e);
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
 * A página usa montar(el, dados), como manda o contrato dos widgets.
 */
export async function montar(el, dados, extra = {}) {
  const raiz = h('div', { class: 'widget vf' });
  el.replaceChildren(raiz);

  const bruto = Array.isArray(dados && dados.vf) ? dados.vf : (dados && dados.vf && dados.vf.afirmacoes);
  const vistos = new Set();
  const todas = (Array.isArray(bruto) ? bruto : []).filter((a) => {
    if (!valida(a) || vistos.has(String(a.id))) return false;
    vistos.add(String(a.id));
    return true;
  });
  if (todas.length === 0) {
    raiz.append(h('p', { class: 'nota' }, 'Ainda não há afirmações.'));
    return;
  }

  // temas que têm afirmações, na ordem dos GRUPOS (temas desconhecidos ficam no fim)
  const temas = GRUPOS.filter((g) => todas.some((a) => a.tema === g.id));
  for (const id of new Set(todas.map((a) => a.tema))) {
    if (!temas.some((t) => t.id === id)) temas.push({ id, titulo: String(id) });
  }
  const nomeTema = (id) => (temas.find((t) => t.id === id) || { titulo: String(id) }).titulo;

  const rng = criarRng(extra.semente);
  const uid = Math.random().toString(36).slice(2, 8);

  // ---------- estado ----------

  const guardadoTema = P.ler('log-vf-tema', 'todos');
  let tema = guardadoTema === 'todos' || temas.some((t) => t.id === guardadoTema) ? guardadoTema : 'todos';
  let ronda = null; // { itens, indice, revisao, respondida }
  let guardouTudo = true;

  const acertadas = () => {
    const r = P.ler('log-vf', {});
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  };
  function marcarAcertada(id) {
    if (!P.guardar('log-vf', { ...acertadas(), [id]: 1 })) guardouTudo = false;
  }
  const doTema = () => todas.filter((a) => tema === 'todos' || a.tema === tema);

  // ---------- peças fixas: filtro e zona da afirmação ----------

  const vivo = h('p', { class: 'vf-vivo', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const palco = h('div', { class: 'vf-palco' });
  const chipsEl = h('div', { class: 'chips vf-temas', role: 'group', 'aria-label': 'Tema' });
  const estat = h('p', { class: 'vf-estat nota' });

  const opcoesTema = [{ id: 'todos', nome: 'Todos', n: todas.length }, ...temas.map((t) => ({ id: t.id, nome: t.titulo, n: todas.filter((a) => a.tema === t.id).length }))];
  const chips = opcoesTema.map((o) => h('button', {
    type: 'button', class: 'chip', 'data-tema': o.id,
    onclick: () => { tema = o.id; P.guardar('log-vf-tema', tema); desenharChips(); comecar(doTema()); },
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
      const fig = a.figura ? figura(a.figura) : null; // só agora: pode revelar a resposta
      resultado.replaceChildren(...[
        h('p', { class: 'vf-veredito' },
          h('span', { class: 'vf-veredito__simbolo', 'aria-hidden': 'true' }, item.certa ? '✓' : '✗'),
          h('strong', {}, item.certa ? 'Certo' : 'Errado'),
          ` A afirmação é ${a.verdadeira ? 'verdadeira' : 'falsa'}.`),
        comFormulas('p', 'vf-expl', a.explicacao),
        fig,
        a.erroComum ? h('div', { class: 'vf-erro' }, h('p', { class: 'vf-erro__titulo' }, 'Erro comum'), comFormulas('p', 'vf-erro__texto', a.erroComum)) : null,
        h('div', { class: 'vf-rodape' }, seguinte)].filter(Boolean));
      if (fig) afastarRotulos(fig.querySelector('svg'));
      // Com a figura o resultado fica alto: o foco no botão sem deslizar a página (senão o veredito
      // saía do ecrã) e depois só o necessário para ver o resultado, se couber.
      seguinte.focus({ preventScroll: true });
      resultado.scrollIntoView({ block: 'nearest' });
    }

    palco.replaceChildren(h('div', { class: 'vf-cartao', 'data-id': a.id },
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
