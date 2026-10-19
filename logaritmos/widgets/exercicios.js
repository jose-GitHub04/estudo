// Exercícios (Exponenciais e logaritmos). Uma lista de cartões, um por exercício, com a resolução escondida:
// a aluna tenta primeiro no caderno e depois mostra os passos um a um (ou todos) para comparar.
// No topo: quantos exercícios já marcou como acertados, filtros por tema e por nível e um índice com ligações.
// Recebe dados.exercicios = { exercicios: [...] } (ou só o array). Cada exercício traz id, titulo, tema (o id de um
// GRUPO de ../grupos.js), nivel (1 a 3), enunciado, passos [{ titulo, texto, figura? }] e resposta; opcionais: dica,
// erroComum e alineas [{ id, enunciado, passos, resposta, dica?, erroComum? }]. Com alíneas, cada uma tem os seus passos
// e a sua resposta; o enunciado do exercício é então só o contexto. `texto`, `resposta`, `dica` e `erroComum` levam
// HTML e fórmulas $...$ / $$...$$. O campo `verifica` é só do verificador e não é usado aqui.
// `figura` de um passo segue o esquema comum do tema ({ tipo: 'grafico', x, y, curvas, retas, retasV, retasH, pontos,
// area, legenda, rotuloX, rotuloY, marcasX, marcasY }) e desenha-se com assets/motor/grafico.js. Cada reta, curva e ponto
// aceita ainda `cor` e `tracejado` (retas e curvas; `false` = contínua); a curva aceita `de` e `ate` (cortam o x) e `rotulo`;
// `posRotulo` é a posição preferida do rótulo ('esq' | 'dir' | 'cima' | 'baixo' nos pontos, 'esq' | 'dir' em retasH,
// 'cima' | 'baixo' em retasV, 'inicio' | 'fim' nas curvas); um `rotulo` vazio quer dizer sem rótulo. `marcasX` e `marcasY`
// (lista de números, ou `false` para nenhuma) escolhem os números dos eixos. Os rótulos não ficam onde o motor os poria:
// rotulos.js escolhe, para cada um, a posição mais perto do que descreve onde não tape curvas, eixos, pontos, outros
// rótulos nem números das marcas (`posRotulo` é só uma preferência) e apaga o número de uma marca que continue tapado.
// A figura no ecrã é a do último passo revelado que tenha figura; uma figura ilegível ou que falhe é ignorada
// (o passo fica sem ela).
// Progresso guardado em progresso (o prefixo «log-» existe porque o armazenamento é partilhado com os outros temas):
//   'log-exercicios'  { [chave]: 1 | 0 }   1 = «Acertei», 0 = «Não acertei» (a marca é por unidade de resolução)
//   chave = id do exercício, ou «id/alínea» quando o exercício tem alíneas (ex.: «ex-03/b»).
//   Um exercício conta como acertado quando todas as suas unidades estão a 1.
//   Marcas de exercícios que já não existem ficam guardadas e são ignoradas.
// Todo o estado vive dentro de montar(); nada fica no módulo. `normalizar` e `desenharFigura` são exportadas só para os testes.

import { GRUPOS } from '../grupos.js';
import { renderizar } from '../../assets/motor/katex.js';
import { criarGrafico, formatarNumero } from '../../assets/motor/grafico.js';
import * as P from '../../assets/motor/progresso.js';
import { colocarRotulos } from './rotulos.js';

const CHAVE = 'log-exercicios';

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

// Os textos dos dados vão para innerHTML. Dentro de $...$ um «<» ou «&» é matemática e
// não HTML («$a<b$» seria lido como a etiqueta <b>), por isso escapam-se só aí.
const FORMULA = /\$\$[\s\S]+?\$\$|\$[^$]+?\$/g;
function seguro(texto) {
  return String(texto === undefined || texto === null ? '' : texto).replace(FORMULA, (m) => m
    .replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'));
}

/** Cola a pontuação que vem logo a seguir a uma fórmula em linha, para não ficar sozinha na linha seguinte. */
function colarPontuacao(raiz) {
  for (const k of raiz.querySelectorAll('.katex')) {
    if (k.closest('.katex-display')) continue;
    // o auto-render põe cada fórmula dentro de um <span> sem classe
    const nodo = k.parentNode !== raiz && k.parentNode.childNodes.length === 1 ? k.parentNode : k;
    const prox = nodo.nextSibling;
    if (!prox || prox.nodeType !== 3) continue;
    const m = /^[.,;:!?)]+/.exec(prox.data);
    if (!m) continue;
    const cola = document.createElement('span');
    cola.className = 'ex-cola';
    nodo.replaceWith(cola);
    cola.append(nodo, document.createTextNode(m[0]));
    prox.data = prox.data.slice(m[0].length);
  }
}

/** Texto com $...$ já convertido em fórmulas. */
function comFormulas(tag, classe, texto) {
  const e = h(tag, { class: classe, html: seguro(texto) });
  renderizar(e);
  colarPontuacao(e);
  return e;
}

const plural = (n, um, varios) => (n === 1 ? um : varios);
const txt = (v) => (typeof v === 'string' ? v.trim() : '');
const slug = (s) => String(s).replace(/[^\w-]/g, '-');

// ---------- figura (um gráfico) ----------

// Quando uma curva não diz a cor, usam-se estas por ordem (exponencial, logarítmica, y = x, tangente, derivada),
// para duas curvas na mesma figura nunca terem a mesma cor.
const COR_DAS_CURVAS = ['exp', 'log', 'id', 'tg', 'der'];

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehIntervalo = (v) => Array.isArray(v) && v.length === 2 && ehNumero(v[0]) && ehNumero(v[1]) && v[1] > v[0];
const emLista = (v) => (Array.isArray(v) ? v : []);
const num = (v) => formatarNumero(v, 3);
const juntar = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);

/** `false` quer dizer «contínua»; o gráfico lê `false` como «o tracejado de origem», por isso passa-se 'none'. */
const tracejado = (v) => (v === false ? 'none' : v);

/** Uma reta vertical ou horizontal pode vir como número ou como { x | y, rotulo }. */
function guia(r, chave) {
  const o = ehNumero(r) ? { [chave]: r } : r;
  if (!o || typeof o !== 'object' || !ehNumero(o[chave])) throw new Error(`reta sem ${chave}`);
  return o;
}

/** Descrição para leitores de ecrã, quando a figura não traz `legenda`. */
function descricao(f) {
  const curvas = emLista(f.curvas).map((c) => txt(c.rotulo) || `y = ${c.expr}`);
  const partes = [curvas.length ? `Gráfico de ${juntar(curvas)}.` : 'Gráfico cartesiano.'];
  const retas = emLista(f.retas).map((r) => txt(r.rotulo) || `de declive ${num(r.declive)} e ordenada ${num(r.ordenada)}`);
  if (retas.length) partes.push(`${plural(retas.length, 'Reta', 'Retas')}: ${juntar(retas)}.`);
  const vs = emLista(f.retasV).map((r) => `x = ${num(guia(r, 'x').x)}`);
  if (vs.length) partes.push(`${plural(vs.length, 'Reta vertical', 'Retas verticais')}: ${juntar(vs)}.`);
  const hs = emLista(f.retasH).map((r) => `y = ${num(guia(r, 'y').y)}`);
  if (hs.length) partes.push(`${plural(hs.length, 'Reta horizontal', 'Retas horizontais')}: ${juntar(hs)}.`);
  const pontos = emLista(f.pontos).map((p) => {
    const rot = txt(p.rotulo);
    const coord = `(${num(p.x)}; ${num(p.y)})`;
    return rot && !rot.startsWith('(') ? `${rot}, em ${coord}` : coord;
  });
  if (pontos.length) partes.push(`${plural(pontos.length, 'Ponto marcado', 'Pontos marcados')}: ${juntar(pontos)}.`);
  if (f.area) partes.push(`Zona sombreada sob y = ${f.area.expr}, entre x = ${num(f.area.de)} e x = ${num(f.area.ate)}.`);
  return partes.join(' ');
}

/** Desenha o campo `figura` de um passo: { svg, legenda }, ou null se for ilegível ou der erro. */
export function desenharFigura(f) {
  if (!f || typeof f !== 'object' || f.tipo !== 'grafico') return null;
  try {
    if (!ehIntervalo(f.x) || !ehIntervalo(f.y)) return null;
    const legenda = txt(f.legenda) || descricao(f);
    const nomeEixo = (v) => (typeof v === 'string' ? v : undefined); // «» = sem nome; sem o campo, fica x / y
    const marcas = (v) => (v === false || Array.isArray(v) ? v : undefined); // false = sem números; lista = só essas
    const g = criarGrafico({
      x: f.x, y: f.y, largura: 340, altura: 250, aria: legenda, rotuloX: '', rotuloY: '', // os nomes dos eixos põe-nos rotulos.js
      marcasX: marcas(f.marcasX), marcasY: marcas(f.marcasY),
    });
    // Tudo se desenha sem rótulos; no fim, rotulos.js escolhe para cada um o sítio onde não tapa nada.
    const pedidos = [];
    const rotulo = (v, porOmissao) => (v === undefined || v === null ? porOmissao : txt(v)); // um rotulo vazio quer dizer sem rótulo
    if (f.area) {
      if (typeof f.area.expr !== 'string' || !ehNumero(f.area.de) || !ehNumero(f.area.ate)) throw new Error('área mal definida');
      g.area(f.area.expr, f.area.de, f.area.ate);
    }
    for (const r of emLista(f.retas)) {
      if (!r || !ehNumero(r.declive) || !ehNumero(r.ordenada)) throw new Error('reta mal definida');
      g.reta(r.declive, r.ordenada, { cor: r.cor, tracejado: tracejado(r.tracejado) });
      pedidos.push({ tipo: 'reta', declive: r.declive, ordenada: r.ordenada, texto: rotulo(r.rotulo, ''), cor: r.cor || 'id' });
    }
    for (const r of emLista(f.retasV)) {
      const o = guia(r, 'x');
      g.retaVertical(o.x, { cor: o.cor, tracejado: tracejado(o.tracejado) });
      // a guia x = 0 cai sobre o eixo dos yy, cujo nome está em cima: prefere-se o rótulo em baixo
      pedidos.push({ tipo: 'retaV', x: o.x, texto: rotulo(o.rotulo, `x = ${num(o.x)}`), cor: o.cor || 'assint', pref: o.posRotulo ?? (o.x === 0 ? 'baixo' : 'cima') });
    }
    for (const r of emLista(f.retasH)) {
      const o = guia(r, 'y');
      g.retaHorizontal(o.y, { cor: o.cor, tracejado: tracejado(o.tracejado) });
      pedidos.push({ tipo: 'retaH', y: o.y, texto: rotulo(o.rotulo, `y = ${num(o.y)}`), cor: o.cor || 'assint', pref: o.posRotulo });
    }
    emLista(f.curvas).forEach((c, i) => {
      if (!c || typeof c.expr !== 'string' || c.expr.trim() === '') throw new Error('curva sem expressão');
      const cor = c.cor || COR_DAS_CURVAS[i % COR_DAS_CURVAS.length];
      const de = ehNumero(c.de) ? c.de : undefined; // de e ate cortam a curva (o domínio de um modelo, por exemplo)
      const ate = ehNumero(c.ate) ? c.ate : undefined;
      const item = g.curva(c.expr, { cor, tracejado: tracejado(c.tracejado), de, ate });
      if (item.tracos === 0) throw new Error(`curva fora da janela: ${c.expr}`); // um gráfico sem a curva enganava
      pedidos.push({ tipo: 'curva', fn: c.expr, de, ate, texto: rotulo(c.rotulo, ''), cor, pref: c.posRotulo === 'inicio' ? 'inicio' : 'fim' });
    });
    for (const p of emLista(f.pontos)) {
      if (!p || !ehNumero(p.x) || !ehNumero(p.y)) throw new Error('ponto mal definido');
      g.ponto(p.x, p.y, { cor: p.cor, oco: p.oco });
      pedidos.push({ tipo: 'ponto', x: p.x, y: p.y, raio: 4.5, texto: rotulo(p.rotulo, ''), cor: p.cor, pref: p.posRotulo });
    }
    colocarRotulos(g, pedidos, { nomesEixos: { x: nomeEixo(f.rotuloX) ?? 'x', y: nomeEixo(f.rotuloY) ?? 'y' } });
    return { svg: g.svg, legenda };
  } catch (e) {
    console.warn('exercicios: figura ignorada', e);
    return null;
  }
}

// ---------- validação ----------

const passoValido = (p) => !!p && typeof p === 'object' && (txt(p.titulo) !== '' || txt(p.texto) !== '');

/** Uma unidade de resolução (o exercício inteiro ou uma alínea): passos e resposta. null se não tiver passos. */
function unidadeDe(o) {
  const passos = emLista(o.passos).filter(passoValido);
  if (passos.length === 0) return null;
  return { passos, resposta: txt(o.resposta), dica: txt(o.dica), erroComum: txt(o.erroComum) };
}

/** Exercício pronto a desenhar, ou null se não tiver id, duplicar outro ou não tiver nenhuma resolução utilizável. */
function exercicioDe(e, vistos) {
  if (!e || typeof e !== 'object' || e.id === undefined || e.id === null) return null;
  const id = String(e.id).trim();
  if (id === '' || vistos.has(id)) return null;
  const unidades = [];
  let geral = false; // true: tem alíneas, por isso dica e erroComum do exercício ficam no cartão
  if (emLista(e.alineas).length > 0) {
    e.alineas.forEach((a, i) => {
      const u = a && typeof a === 'object' ? unidadeDe(a) : null;
      if (!u) return;
      const nome = txt(String(a.id ?? '')) || String.fromCharCode(97 + i);
      unidades.push({ ...u, chave: `${id}/${nome}`, nome, letra: /^[a-z]$/i.test(nome) ? `${nome})` : nome, enunciado: txt(a.enunciado) });
    });
    geral = unidades.length > 0;
  }
  if (unidades.length === 0) {
    const u = unidadeDe(e);
    if (!u) return null;
    unidades.push({ ...u, chave: id, nome: '', letra: '', enunciado: '' });
  }
  vistos.add(id);
  const nivel = Number(e.nivel);
  return {
    id,
    titulo: txt(e.titulo) || 'Exercício',
    tema: txt(e.tema),
    nivel: nivel === 1 || nivel === 2 || nivel === 3 ? nivel : 0,
    enunciado: txt(e.enunciado),
    dica: geral ? txt(e.dica) : '',
    erroGeral: geral ? txt(e.erroComum) : '',
    unidades,
  };
}

/** Lista de exercícios válidos, na ordem dos dados, com `numero` (1, 2, ...) e `dom` (id seguro para o HTML). */
export function normalizar(bruto) {
  const lista = Array.isArray(bruto) ? bruto : bruto && Array.isArray(bruto.exercicios) ? bruto.exercicios : [];
  const vistos = new Set();
  const usados = new Set();
  const saida = [];
  for (const e of lista) {
    try {
      const ex = exercicioDe(e, vistos);
      if (!ex) continue;
      let dom = slug(ex.id);
      while (usados.has(dom)) dom += '_';
      usados.add(dom);
      saida.push({ ...ex, dom, numero: saida.length + 1 });
    } catch (err) {
      console.warn('exercicios: exercício ignorado', err);
    }
  }
  return saida;
}

// ---------- uma dica que se abre e fecha ----------

function criarDica(texto, base) {
  const idCorpo = `${base}-dica`;
  const corpo = h('div', { class: 'ex-dica__corpo', id: idCorpo, hidden: true });
  const botao = h('button', {
    type: 'button', class: 'botao botao--suave ex-dica__botao', 'aria-expanded': 'false', 'aria-controls': idCorpo, 'data-acao': 'dica',
  }, 'Ver a dica');
  let pronta = false;
  botao.addEventListener('click', () => {
    const abrir = corpo.hidden;
    if (abrir && !pronta) {
      corpo.append(h('p', { class: 'ex-dica__titulo' }, 'Dica'), comFormulas('div', 'ex-texto', texto));
      pronta = true;
    }
    corpo.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    botao.textContent = abrir ? 'Esconder a dica' : 'Ver a dica';
  });
  return h('div', { class: 'ex-dica' }, botao, corpo);
}

// ---------- uma unidade de resolução (o exercício inteiro ou uma alínea) ----------

/**
 * ctx: { marcas() -> objeto das marcas, marcar(chave, 1 | 0), aoMudar() }.
 * Devolve { el, completo(), pintar(marcas) }.
 */
function criarUnidade(ex, u, ctx) {
  const total = u.passos.length;
  const base = u.nome ? `${ex.dom}-${slug(u.nome)}` : ex.dom;
  let n = 0; // passos já revelados
  let figAtual = -1; // índice do passo cuja figura está no ecrã
  const figs = new Array(total).fill(undefined); // undefined: ainda não desenhada; null: ilegível
  const figDe = (i) => {
    if (figs[i] === undefined) figs[i] = desenharFigura(u.passos[i].figura);
    return figs[i];
  };
  const temFiguras = u.passos.some((p) => p.figura && typeof p.figura === 'object');

  // ----- peças -----
  const passosEl = h('ol', { class: 'ex-passos', role: 'list', 'aria-label': 'Passos da resolução', id: `${base}-passos` });
  const vivo = h('div', { class: 'ex-vivo', 'aria-live': 'polite' }, passosEl);

  const figNome = h('p', { class: 'ex-figura__nome' });
  const figCorpo = h('div', { class: 'ex-figura__corpo' });
  const figEl = h('figure', { class: 'ex-figura', hidden: true }, figNome, figCorpo);

  const finalEl = h('section', { class: 'ex-final', tabindex: '-1', hidden: true, 'aria-label': 'Resposta final' });
  const erroEl = h('div', { class: 'ex-erro', hidden: true });
  let finalPronto = false;

  const idPergunta = `${base}-aval`;
  const bSim = h('button', {
    type: 'button', class: 'botao botao--suave ex-aval__botao ex-aval__botao--sim', 'aria-pressed': 'false', 'data-acao': 'acertei', onclick: () => ctx.marcar(u.chave, 1),
  }, 'Acertei');
  const bNao = h('button', {
    type: 'button', class: 'botao botao--suave ex-aval__botao ex-aval__botao--nao', 'aria-pressed': 'false', 'data-acao': 'nao-acertei', onclick: () => ctx.marcar(u.chave, 0),
  }, 'Não acertei');
  const avalEstado = h('p', { class: 'ex-aval__estado', 'aria-live': 'polite' });
  const avalEl = h('div', { class: 'ex-aval', role: 'group', 'aria-labelledby': idPergunta, tabindex: '-1', hidden: true },
    h('p', { class: 'ex-aval__pergunta', id: idPergunta }, 'Como correu?'),
    h('div', { class: 'ex-aval__botoes' }, bSim, bNao),
    avalEstado);

  const contagem = h('p', { class: 'ex-contagem' });
  const bSeg = h('button', {
    type: 'button', class: 'botao ex-botoes__seguinte', 'data-acao': 'seguinte', 'aria-controls': passosEl.id, onclick: () => seguinte(),
  }, 'Mostrar o passo seguinte');
  const bTudo = h('button', {
    type: 'button', class: 'botao botao--suave', 'data-acao': 'tudo', 'aria-controls': passosEl.id, onclick: () => tudo(),
  }, 'Mostrar tudo');
  const bRec = h('button', {
    type: 'button', class: 'botao botao--suave', 'data-acao': 'recomecar', hidden: true, onclick: () => recomecar(),
  }, 'Recomeçar');
  const botoes = h('div', { class: 'ex-botoes' }, contagem, bSeg, bTudo, bRec);

  // ----- cabeçalho da alínea -----
  const seloAlinea = h('span', { class: 'ex-alinea__selo', hidden: true }, h('span', { 'aria-hidden': 'true' }, '✓'), h('span', { class: 'sr-only' }, ' acertada'));
  const cabAlinea = u.letra
    ? h('div', { class: 'ex-alinea__cab' },
      h('h4', { class: 'ex-alinea__letra', id: `${base}-titulo` },
        h('span', { 'aria-hidden': 'true' }, u.letra), h('span', { class: 'sr-only' }, `Alínea ${u.nome}`)),
      seloAlinea,
      u.enunciado ? comFormulas('div', 'ex-texto ex-alinea__enunciado', u.enunciado) : null)
    : null;

  // ----- lógica -----

  function criarPasso(i) {
    const p = u.passos[i];
    const f = figDe(i);
    return h('li', { class: 'ex-passo' },
      h('span', { class: 'ex-passo__num', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', { class: 'ex-passo__corpo' },
        txt(p.titulo) ? comFormulas('p', 'ex-passo__titulo', p.titulo) : null,
        txt(p.texto) ? comFormulas('div', 'ex-texto ex-passo__texto', p.texto) : null,
        f ? h('span', { class: 'sr-only' }, ` Figura: ${f.legenda}`) : null));
  }

  function preencherFinal() {
    if (finalPronto) return;
    finalPronto = true;
    if (u.resposta) finalEl.append(h('p', { class: 'ex-final__titulo' }, 'Resposta final'), comFormulas('div', 'ex-texto ex-final__resposta', u.resposta));
    if (u.erroComum) erroEl.append(h('p', { class: 'ex-erro__titulo' }, 'Erro típico'), comFormulas('div', 'ex-texto', u.erroComum));
  }

  /** Põe no ecrã o que corresponde a `n` passos revelados. */
  function atualizarVista() {
    // a figura é a do último passo revelado que tenha uma que se consiga desenhar
    let k = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (figDe(i)) { k = i; break; }
    }
    if (k !== figAtual) {
      figAtual = k;
      if (k < 0) {
        figEl.hidden = true;
        figCorpo.replaceChildren();
      } else {
        figNome.textContent = `Figura do passo ${k + 1}`;
        figCorpo.replaceChildren(figDe(k).svg);
        figEl.hidden = false;
      }
    }
    const fim = n === total;
    if (fim) preencherFinal();
    finalEl.hidden = !(fim && u.resposta);
    erroEl.hidden = !(fim && u.erroComum);
    avalEl.hidden = !fim;
    bSeg.hidden = fim;
    bTudo.hidden = fim;
    bRec.hidden = n === 0;
    contagem.hidden = fim;
    contagem.textContent = n === 0
      ? `${total} ${plural(total, 'passo', 'passos')} na resolução.`
      : `${n} de ${total} ${plural(total, 'passo mostrado', 'passos mostrados')}.`;
  }

  function revelar(ate) {
    const alvo = Math.max(0, Math.min(ate, total));
    for (let i = n; i < alvo; i++) passosEl.append(criarPasso(i));
    n = alvo;
    atualizarVista();
    ctx.aoMudar();
  }

  /** No fim o botão que tinha o foco desaparece: o foco vai para a resposta e o ecrã mostra o «Como correu?». */
  function irParaFim() {
    const topo = finalEl.hidden ? avalEl : finalEl;
    topo.focus({ preventScroll: true });
    // à vista, a resposta e (se couber) o «Como correu?»; senão, a resposta a começar no topo
    const cabe = avalEl.getBoundingClientRect().bottom - topo.getBoundingClientRect().top <= window.innerHeight - 96;
    if (cabe) avalEl.scrollIntoView({ block: 'nearest' });
    else topo.scrollIntoView({ block: 'start' });
  }

  function seguinte() {
    revelar(n + 1);
    if (n === total) irParaFim();
    else bSeg.scrollIntoView({ block: 'nearest' }); // o botão fica à vista, com o passo novo mesmo por cima
  }

  function tudo() {
    vivo.setAttribute('aria-live', 'off'); // não ler tudo em voz alta: o foco vai para a resposta
    revelar(total);
    setTimeout(() => vivo.setAttribute('aria-live', 'polite'), 300);
    irParaFim();
  }

  function reiniciar() {
    passosEl.replaceChildren();
    n = 0;
    atualizarVista();
    ctx.aoMudar();
  }

  function recomecar() {
    reiniciar();
    bSeg.focus({ preventScroll: true });
    bSeg.scrollIntoView({ block: 'nearest' });
  }

  function pintar(marcas) {
    const v = marcas[u.chave];
    bSim.setAttribute('aria-pressed', String(v === 1));
    bNao.setAttribute('aria-pressed', String(v === 0));
    avalEstado.textContent = v === 1 ? 'Marcado como acertado.' : v === 0 ? 'Marcado para repetir.' : '';
    seloAlinea.hidden = v !== 1;
  }

  atualizarVista();

  const el = h(u.letra ? 'section' : 'div', { class: `ex-unidade${u.letra ? ' ex-unidade--alinea' : ''}`, 'aria-labelledby': u.letra ? `${base}-titulo` : undefined },
    cabAlinea,
    u.dica ? criarDica(u.dica, base) : null,
    h('div', { class: `ex-res${temFiguras ? ' ex-res--fig' : ''}` }, vivo, figEl, finalEl, erroEl, avalEl, botoes));

  return { el, completo: () => n === total, pintar };
}

// ---------- um cartão por exercício ----------

function criarCartao(ex, ctx) {
  const idTitulo = `${ex.dom}-titulo`;
  const selo = h('span', { class: 'ex-selo', hidden: true });
  const titulo = comFormulas('h3', 'ex-titulo', ex.titulo);
  titulo.id = idTitulo;
  titulo.prepend(h('span', { class: 'ex-numero' }, h('span', { class: 'sr-only' }, 'Exercício '), String(ex.numero)), ' ');

  const meta = h('p', { class: 'ex-meta' },
    ex.tema ? h('span', { class: 'ex-etiqueta' }, ctx.tituloTema(ex.tema)) : null,
    ex.nivel ? h('span', { class: 'ex-nivel' }, `Nível ${ex.nivel}`, h('span', { class: 'ex-nivel__pontos', 'aria-hidden': 'true' }, '●'.repeat(ex.nivel) + '○'.repeat(3 - ex.nivel))) : null,
    selo);

  const unidades = ex.unidades.map((u) => criarUnidade(ex, u, { ...ctx, aoMudar: () => aoMudar() }));
  const erroGeral = ex.erroGeral ? h('div', { class: 'ex-erro ex-erro--geral', hidden: true }) : null;
  let erroGeralPronto = false;
  function aoMudar() {
    if (!erroGeral) return;
    const todas = unidades.every((u) => u.completo());
    if (todas && !erroGeralPronto) {
      erroGeralPronto = true;
      erroGeral.append(h('p', { class: 'ex-erro__titulo' }, 'Erro típico'), comFormulas('div', 'ex-texto', ex.erroGeral));
    }
    erroGeral.hidden = !todas;
  }

  const el = h('article', { class: 'widget ex-cartao', id: ex.dom, 'aria-labelledby': idTitulo },
    titulo,
    meta,
    ex.enunciado ? comFormulas('div', 'ex-texto ex-enunciado', ex.enunciado) : null,
    h('p', { class: 'ex-caderno' }, 'Resolve primeiro no caderno.'),
    ex.dica ? criarDica(ex.dica, ex.dom) : null,
    unidades.map((u) => u.el),
    erroGeral);

  // ✓ Acertado | Para repetir | «2 de 3 alíneas acertadas»
  function pintar(marcas) {
    const e = estadoDe(ex, marcas);
    for (const u of unidades) u.pintar(marcas);
    el.classList.toggle('ex-cartao--ok', e.completo);
    selo.className = 'ex-selo';
    selo.replaceChildren();
    if (e.completo) {
      selo.append(h('span', { 'aria-hidden': 'true' }, '✓ '), 'Acertado');
    } else if (e.total === 1 && e.falhadas === 1) {
      selo.classList.add('ex-selo--repetir');
      selo.append('Para repetir');
    } else if (e.total > 1 && (e.certas > 0 || e.falhadas > 0)) {
      selo.classList.add(e.certas > 0 ? 'ex-selo--parcial' : 'ex-selo--repetir');
      selo.append(e.certas > 0 ? `${e.certas} de ${e.total} alíneas acertadas` : 'Para repetir');
    }
    selo.hidden = selo.childNodes.length === 0;
  }

  return { ex, el, pintar };
}

/** Quantas unidades do exercício foram marcadas como acertadas e como não acertadas. */
function estadoDe(ex, marcas) {
  let certas = 0;
  let falhadas = 0;
  for (const u of ex.unidades) {
    if (marcas[u.chave] === 1) certas += 1;
    else if (marcas[u.chave] === 0) falhadas += 1;
  }
  const total = ex.unidades.length;
  return { total, certas, falhadas, completo: certas === total };
}

// ---------- o widget ----------

export async function montar(el, dados) {
  const lista = normalizar(dados && dados.exercicios);
  const uid = Math.random().toString(36).slice(2, 7);

  const raiz = h('div', { class: 'ex-raiz' });
  el.replaceChildren(raiz);

  if (lista.length === 0) {
    raiz.append(h('p', { class: 'nota' }, 'Ainda não há exercícios.'));
    return;
  }

  // temas que têm exercícios, na ordem dos GRUPOS (temas desconhecidos ficam no fim)
  const temas = GRUPOS.filter((g) => lista.some((e) => e.tema === g.id));
  for (const id of new Set(lista.map((e) => e.tema).filter(Boolean))) {
    if (!temas.some((t) => t.id === id)) temas.push({ id, titulo: id });
  }
  const tituloTema = (id) => (temas.find((t) => t.id === id) || { titulo: id }).titulo;
  const niveis = [1, 2, 3].filter((v) => lista.some((e) => e.nivel === v));

  // ---------- progresso ----------

  let guardouTudo = true;

  function lerMarcas() {
    const r = P.ler(CHAVE, {});
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  }

  function marcar(chave, valor) {
    const r = { ...lerMarcas(), [chave]: valor };
    if (!P.guardar(CHAVE, r)) guardouTudo = false;
    pintarTudo();
  }

  // ---------- topo: resumo, filtros e índice ----------

  const estado = { tema: 'todos', nivel: 0 };

  const resumoTexto = h('p', { class: 'ex-resumo__texto', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const barraCheia = h('div', { class: 'ex-barra__cheia' });
  const aviso = h('p', { class: 'nota ex-aviso', hidden: true },
    'Não consegui guardar neste dispositivo (por exemplo, numa janela privada). As marcas contam enquanto esta página estiver aberta.');

  function criarFiltro(legenda, itens, chave) {
    const idLegenda = `ex-${uid}-leg-${chave}`;
    const botoes = itens.map((it) => h('button', {
      type: 'button', class: 'chip', 'data-valor': String(it.valor), 'aria-pressed': 'false',
      onclick: () => { estado[chave] = it.valor; aplicarFiltros(); },
    }, it.rotulo));
    const grupo = h('div', { class: 'ex-filtro', hidden: itens.length < 3 }, // «Todos» + pelo menos dois valores
      h('p', { class: 'ex-legenda', id: idLegenda }, legenda),
      h('div', { class: 'chips', role: 'group', 'aria-labelledby': idLegenda }, botoes));
    return {
      grupo,
      pintar() { for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.valor === String(estado[chave]))); },
    };
  }

  const filtroTema = criarFiltro('Tema', [
    { valor: 'todos', rotulo: `Todos (${lista.length})` },
    ...temas.map((t) => ({ valor: t.id, rotulo: `${t.titulo} (${lista.filter((e) => e.tema === t.id).length})` })),
  ], 'tema');
  const filtroNivel = criarFiltro('Nível (quanto maior, mais perto do exame)', [
    { valor: 0, rotulo: 'Todos' },
    ...niveis.map((v) => ({ valor: v, rotulo: `Nível ${v} (${lista.filter((e) => e.nivel === v).length})` })),
  ], 'nivel');

  const contagemFiltro = h('p', { class: 'ex-contagem-filtro', 'aria-live': 'polite' });
  const vazio = h('div', { class: 'ex-vazio', hidden: true },
    h('p', {}, 'Não há exercícios com esta combinação de tema e nível.'),
    h('button', { type: 'button', class: 'botao botao--suave', onclick: () => { estado.tema = 'todos'; estado.nivel = 0; aplicarFiltros(); } }, 'Ver todos'));

  const itensIndice = lista.map((ex) => {
    const marca = h('span', { class: 'ex-indice__selo', hidden: true }, h('span', { 'aria-hidden': 'true' }, '✓'), h('span', { class: 'sr-only' }, ' acertado'));
    const li = h('li', {}, h('a', { href: `#${ex.dom}` },
      h('span', { class: 'ex-indice__num' }, h('span', { class: 'sr-only' }, 'Exercício '), String(ex.numero)),
      comFormulas('span', 'ex-indice__nome', ex.titulo),
      marca));
    return { li, marca };
  });
  const indice = h('details', { class: 'ex-indice' },
    h('summary', {}, `Índice dos exercícios (${lista.length})`),
    h('nav', { 'aria-label': 'Índice dos exercícios' }, h('ol', { class: 'ex-indice__lista' }, itensIndice.map((i) => i.li))));

  const topo = h('div', { class: 'widget ex-topo' },
    resumoTexto,
    h('div', { class: 'ex-barra', 'aria-hidden': 'true' }, barraCheia),
    h('p', { class: 'nota ex-guardado' }, 'As marcas ficam guardadas só neste dispositivo.'),
    aviso,
    h('div', { class: 'ex-filtros' }, filtroTema.grupo, filtroNivel.grupo),
    contagemFiltro,
    vazio,
    indice);

  // ---------- cartões ----------

  const ctx = { marcas: lerMarcas, marcar, tituloTema, aoMudar: () => {} };
  const cartoes = lista.map((ex) => criarCartao(ex, ctx));
  const listaEl = h('div', { class: 'ex-lista' }, cartoes.map((c) => c.el));

  raiz.append(
    h('h2', { class: 'sr-only' }, 'Lista de exercícios'),
    topo,
    listaEl);

  function pintarTudo() {
    const marcas = lerMarcas();
    let acertados = 0;
    let repetir = 0;
    cartoes.forEach((c, i) => {
      c.pintar(marcas);
      const e = estadoDe(c.ex, marcas);
      itensIndice[i].marca.hidden = !e.completo;
      if (e.completo) acertados += 1;
      else if (e.falhadas > 0) repetir += 1;
    });
    resumoTexto.replaceChildren('Marcaste ', h('strong', {}, String(acertados)),
      ` de ${lista.length} ${plural(lista.length, 'exercício como acertado', 'exercícios como acertados')}.`,
      repetir > 0 ? ` ${repetir} para repetir.` : '');
    barraCheia.style.width = `${Math.round((100 * acertados) / lista.length)}%`;
    aviso.hidden = guardouTudo;
  }

  function aplicarFiltros() {
    let visiveis = 0;
    cartoes.forEach((c, i) => {
      const mostra = (estado.tema === 'todos' || c.ex.tema === estado.tema) && (!estado.nivel || c.ex.nivel === estado.nivel);
      c.el.hidden = !mostra;
      itensIndice[i].li.hidden = !mostra;
      if (mostra) visiveis += 1;
    });
    filtroTema.pintar();
    filtroNivel.pintar();
    contagemFiltro.textContent = visiveis === lista.length
      ? `${lista.length} ${plural(lista.length, 'exercício', 'exercícios')}.`
      : `A mostrar ${visiveis} de ${lista.length} exercícios.`;
    vazio.hidden = visiveis !== 0;
  }

  // ---------- ligações diretas (#ex-03): o cartão pode estar escondido por um filtro ----------

  function irPara(hash, instante = false) {
    let id = String(hash || '').replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch (e) { /* fica como está */ }
    const c = cartoes.find((x) => x.ex.dom === id);
    if (!c) return;
    if (c.el.hidden) {
      estado.tema = 'todos';
      estado.nivel = 0;
      aplicarFiltros();
    }
    c.el.scrollIntoView({ block: 'start', behavior: instante ? 'instant' : 'auto' });
  }

  const aoMudarHash = () => {
    if (!raiz.isConnected) { window.removeEventListener('hashchange', aoMudarHash); return; }
    irPara(location.hash);
  };
  window.addEventListener('hashchange', aoMudarHash);

  pintarTudo();
  aplicarFiltros();
  // o browser já tentou saltar para o #ex-... antes de os cartões existirem
  if (location.hash) setTimeout(() => irPara(location.hash, true), 0);
}
