// Banco de perguntas de escolha múltipla (4 opções, uma certa).
// Depois de responder abre uma janela (<dialog>) com a resposta certa e a explicação.
// Recebe dados.perguntas = { perguntas: [...] } (ou só o array); cada pergunta traz `tema`, o id de um
// GRUPO de ../grupos.js. Os campos `ref`, `valor` e `verifica` são só do verificador e não são usados aqui.
// Progresso guardado em progresso (o prefixo «log-» existe porque o armazenamento é partilhado com os outros temas):
//   'log-perguntas'       { [idPergunta]: 1 | 0 }   último resultado de cada pergunta
//   'log-perguntas-temas' [idTema, ...]             temas escolhidos no ecrã inicial
// Todo o estado vive dentro de montar(); nada fica no módulo.

import { GRUPOS } from '../grupos.js';
import { renderizar } from '../../assets/motor/katex.js';
import { baralhar, criarRng } from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/progresso.js';

const LETRAS = ['A', 'B', 'C', 'D'];
const TAMANHOS = [
  { valor: 10, rotulo: '10' },
  { valor: 20, rotulo: '20' },
  { valor: Infinity, rotulo: 'Todas' },
];
const TAMANHO_PADRAO = 10;

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

/** Cola a pontuação que vem logo a seguir a uma fórmula, para não ficar sozinha na linha seguinte. */
function colarPontuacao(raiz) {
  for (const k of raiz.querySelectorAll('.katex')) {
    // o auto-render põe cada fórmula dentro de um <span> sem classe
    const nodo = k.parentNode !== raiz && k.parentNode.childNodes.length === 1 ? k.parentNode : k;
    const prox = nodo.nextSibling;
    if (!prox || prox.nodeType !== 3) continue;
    const m = /^[.,;:!?)]+/.exec(prox.data);
    if (!m) continue;
    const cola = document.createElement('span');
    cola.className = 'per-cola';
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
const percentagem = (certas, total) => (total ? Math.round((100 * certas) / total) : 0);

function perguntaValida(p) {
  return !!p && typeof p === 'object'
    && p.id !== undefined && p.id !== null && p.id !== ''
    && typeof p.enunciado === 'string' && p.enunciado.trim() !== ''
    && Array.isArray(p.opcoes) && p.opcoes.length === 4
    && p.opcoes.every((o) => o && typeof o.tex === 'string')
    && Number.isInteger(p.certa) && p.certa >= 0 && p.certa <= 3;
}

/**
 * `extra` é opcional e serve só para testes: { semente } fixa o gerador aleatório.
 * A página usa montar(el, dados), como manda o contrato dos widgets.
 */
export async function montar(el, dados, extra = {}) {
  const bruto = Array.isArray(dados && dados.perguntas) ? dados.perguntas : (dados && dados.perguntas && dados.perguntas.perguntas);
  const vistos = new Set();
  const lista = (Array.isArray(bruto) ? bruto : []).filter((p) => {
    if (!perguntaValida(p) || vistos.has(String(p.id))) return false;
    vistos.add(String(p.id));
    return true;
  });
  const rng = criarRng(extra.semente);
  const uid = Math.random().toString(36).slice(2, 8);

  const raiz = h('div', { class: 'widget per' });
  el.replaceChildren(raiz);

  if (lista.length === 0) {
    raiz.append(h('p', { class: 'nota' }, 'Ainda não há perguntas.'));
    return;
  }

  // temas que têm perguntas, na ordem dos GRUPOS (temas desconhecidos ficam no fim)
  const temas = GRUPOS.filter((g) => lista.some((p) => p.tema === g.id));
  for (const id of new Set(lista.map((p) => p.tema))) {
    if (!temas.some((t) => t.id === id)) temas.push({ id, titulo: String(id) });
  }
  const idsTemas = temas.map((t) => t.id);
  const tituloTema = (id) => (temas.find((t) => t.id === id) || { titulo: String(id) }).titulo;
  const contagem = Object.fromEntries(idsTemas.map((id) => [id, lista.filter((p) => p.tema === id).length]));

  // ---------- estado ----------

  const guardados = P.ler('log-perguntas-temas', null);
  let escolhidos = new Set(Array.isArray(guardados) ? guardados.filter((id) => idsTemas.includes(id)) : idsTemas);
  if (escolhidos.size === 0) escolhidos = new Set(idsTemas);
  let tamanho = TAMANHO_PADRAO;
  let soNaoAcertei = false;
  let ronda = null; // { itens, indice, respondida, revisao, escolher }
  let guardouTudo = true;
  let manual = false; // a janela está a usar a caixa feita à mão (sem showModal)

  const todosEscolhidos = () => escolhidos.size === idsTemas.length;

  function lerResultados() {
    const r = P.ler('log-perguntas', {});
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  }

  function registar(id, certa) {
    const r = { ...lerResultados(), [id]: certa ? 1 : 0 };
    if (!P.guardar('log-perguntas', r)) guardouTudo = false;
  }

  /** Perguntas que cumprem a escolha atual (temas e «só as que ainda não acertei»). */
  function disponiveis() {
    const res = lerResultados();
    return lista.filter((p) => escolhidos.has(p.tema) && !(soNaoAcertei && res[p.id] === 1));
  }

  /** Primeiro toque (com todos escolhidos) isola esse tema; depois cada toque junta ou tira um tema. */
  function tocarTema(id) {
    if (id === 'todos') {
      escolhidos = new Set(idsTemas);
    } else if (todosEscolhidos()) {
      escolhidos = new Set([id]);
    } else if (escolhidos.has(id)) {
      escolhidos.delete(id);
      if (escolhidos.size === 0) escolhidos = new Set(idsTemas); // nunca fica sem nenhum
    } else {
      escolhidos.add(id);
    }
    P.guardar('log-perguntas-temas', [...escolhidos]);
  }

  // ---------- peças que ficam sempre no DOM: janela e anúncio ----------

  const vivo = h('p', { class: 'per-vivo', 'aria-live': 'polite', 'aria-atomic': 'true' });

  const idTitulo = `per-${uid}-titulo`;
  const idCorpo = `per-${uid}-corpo`;
  const jTitulo = h('h2', { class: 'per-janela__titulo', id: idTitulo });
  const jCab = h('div', { class: 'per-janela__cab' }, jTitulo);
  const jResposta = h('p', { class: 'per-janela__resposta' });
  const jExpl = h('div', { class: 'per-janela__expl' });
  const jCorpo = h('div', { class: 'per-janela__corpo', id: idCorpo }, jResposta, jExpl);
  const jSeguinte = h('button', { type: 'button', class: 'botao per-janela__seguinte', autofocus: true, onclick: () => avancar() }, 'Seguinte');
  const janela = h('dialog', { class: 'per-janela', 'aria-labelledby': idTitulo, 'aria-describedby': idCorpo },
    jCab, jCorpo, h('div', { class: 'per-janela__rodape' }, jSeguinte));
  el.append(janela, vivo);

  const janelaAberta = () => janela.hasAttribute('open');

  function mostrarJanela() {
    manual = false;
    if (typeof janela.showModal === 'function') {
      try {
        if (!janelaAberta()) janela.showModal();
        return;
      } catch (e) { /* cai para a caixa feita à mão */ }
    }
    manual = true;
    janela.classList.add('per-janela--manual');
    janela.setAttribute('role', 'alertdialog');
    janela.setAttribute('aria-modal', 'true');
    janela.setAttribute('open', '');
    raiz.inert = true;
  }

  function esconderJanela() {
    if (!janelaAberta()) return;
    if (!manual && typeof janela.close === 'function') {
      janela.close(); // o evento «close» trata do foco
      return;
    }
    janela.removeAttribute('open');
    aoFecharJanela();
  }

  /** Esc ou clique fora fecham a janela sem avançar: o foco vai para o «Seguinte» da página. */
  function aoFecharJanela() {
    if (janelaAberta()) return; // entretanto abriu outra
    raiz.inert = false;
    if (!ronda || !ronda.respondida) return;
    const b = raiz.querySelector('.per-seguinte');
    if (b && !b.hidden) b.focus();
  }

  janela.addEventListener('close', aoFecharJanela);

  let carregouDentro = false;
  janela.addEventListener('mousedown', (e) => { carregouDentro = e.target !== janela; });
  janela.addEventListener('click', (e) => {
    if (e.target === janela && !carregouDentro) esconderJanela(); // clique no fundo
    carregouDentro = false;
  });
  janela.addEventListener('keydown', (e) => {
    if (!manual) return;
    if (e.key === 'Escape') { e.preventDefault(); esconderJanela(); }
    else if (e.key === 'Tab') { e.preventDefault(); jSeguinte.focus(); } // com um só botão, o foco fica preso aqui
  });

  function abrirJanela(item, ultima) {
    const { p, certa, certaPos } = item;
    jCab.className = `per-janela__cab per-janela__cab--${certa ? 'certo' : 'errado'}`;
    jTitulo.replaceChildren(
      h('span', { class: 'per-janela__simbolo', 'aria-hidden': 'true' }, certa ? '✓' : '✗'),
      certa ? ' Certo!' : ' Errado');
    jResposta.replaceChildren(
      h('span', { class: 'per-janela__rotulo' }, 'A resposta certa é ', h('strong', {}, `${LETRAS[certaPos]})`)),
      h('span', { class: 'per-janela__tex', html: seguro(p.opcoes[p.certa].tex) }));
    renderizar(jResposta);
    jExpl.replaceChildren();
    if (typeof p.explicacao === 'string' && p.explicacao.trim()) {
      jExpl.hidden = false;
      jExpl.append(h('p', { class: 'per-janela__expl-titulo' }, 'Explicação'), comFormulas('p', 'per-janela__expl-texto', p.explicacao));
    } else {
      jExpl.hidden = true;
    }
    jSeguinte.textContent = ultima ? 'Ver resultado' : 'Seguinte';
    mostrarJanela();
    jCorpo.scrollTop = 0;
    jSeguinte.focus();
  }

  // ---------- navegação ----------

  function mostrar(no, foco) {
    raiz.replaceChildren(no);
    if (foco) foco.focus({ preventScroll: true });
    if (raiz.getBoundingClientRect().top < 0) raiz.scrollIntoView({ block: 'start' });
  }

  function iniciarRonda(perguntas, revisao = false) {
    const itens = perguntas.map((p) => {
      const ordem = baralhar(rng, [0, 1, 2, 3]); // ordem[posição no ecrã] = índice original da opção
      return { p, ordem, certaPos: ordem.indexOf(p.certa), escolhida: null, certa: null };
    });
    ronda = { itens, indice: 0, respondida: false, revisao, escolher: null };
    ecraPergunta();
  }

  /** Começa uma ronda com a escolha do ecrã inicial. Se não houver perguntas, volta ao início a explicar porquê. */
  function comecarDaEscolha() {
    const pool = disponiveis();
    if (pool.length === 0) { ecraInicio(true); return; }
    const sorteadas = baralhar(rng, pool);
    iniciarRonda(Number.isFinite(tamanho) ? sorteadas.slice(0, tamanho) : sorteadas);
  }

  function avancar() {
    if (!ronda || !ronda.respondida) return;
    const r = ronda;
    r.respondida = false;
    esconderJanela();
    if (r.indice >= r.itens.length - 1) ecraFim();
    else { r.indice += 1; ecraPergunta(); }
  }

  // ---------- ecrã inicial ----------

  function ecraInicio(focar = false) {
    ronda = null;
    const idLegenda = `per-${uid}-leg-temas`;
    const idLegTam = `per-${uid}-leg-tam`;
    const res = lerResultados();
    const acertadas = lista.filter((p) => res[p.id] === 1).length;

    const chipTodos = h('button', { type: 'button', class: 'chip', 'data-tema': 'todos', onclick: () => { tocarTema('todos'); atualizar(); } },
      `Todos (${lista.length})`);
    const chipsTema = temas.map((t) => h('button', {
      type: 'button', class: 'chip', 'data-tema': t.id, onclick: () => { tocarTema(t.id); atualizar(); },
    }, `${t.titulo} (${contagem[t.id]})`));
    const chipsTam = TAMANHOS.map((t) => h('button', {
      type: 'button', class: 'chip', 'data-tamanho': String(t.valor), onclick: () => { tamanho = t.valor; atualizar(); },
    }, t.rotulo));
    const chipFiltro = h('button', {
      type: 'button', class: 'chip', 'data-filtro': 'nao-acertei', onclick: () => { soNaoAcertei = !soNaoAcertei; atualizar(); },
    }, 'Só as que ainda não acertei');
    const estado = h('p', { class: 'nota per-estado', 'aria-live': 'polite' });
    const comecar = h('button', { type: 'button', class: 'botao per-comecar', 'aria-describedby': `per-${uid}-estado`, onclick: comecarDaEscolha }, 'Começar');
    estado.id = `per-${uid}-estado`;

    function atualizar() {
      const todos = todosEscolhidos();
      chipTodos.setAttribute('aria-pressed', String(todos));
      for (const b of chipsTema) b.setAttribute('aria-pressed', String(!todos && escolhidos.has(b.dataset.tema)));
      for (const b of chipsTam) b.setAttribute('aria-pressed', String(Number(b.dataset.tamanho) === tamanho));
      chipFiltro.setAttribute('aria-pressed', String(soNaoAcertei));

      const disp = disponiveis().length;
      comecar.disabled = disp === 0;
      estado.classList.toggle('per-estado--vazio', disp === 0);
      if (disp === 0) {
        const onde = todos ? 'todas as perguntas' : escolhidos.size === 1 ? 'todas as perguntas deste tema' : 'todas as perguntas destes temas';
        estado.textContent = `Já acertaste em ${onde}. Desliga «Só as que ainda não acertei» ou escolhe outros temas.`;
        return;
      }
      const n = Number.isFinite(tamanho) ? Math.min(tamanho, disp) : disp;
      const quais = todos ? 'Todos os temas escolhidos.' : `${escolhidos.size} ${plural(escolhidos.size, 'tema escolhido', 'temas escolhidos')}.`;
      estado.textContent = `${quais} ${n} ${plural(n, 'pergunta', 'perguntas')} nesta ronda${n < disp ? ` (de ${disp} possíveis)` : ''}.`;
    }

    const intro = h('p', { class: 'per-intro', tabindex: '-1' },
      `${lista.length} ${plural(lista.length, 'pergunta', 'perguntas')} no banco. Responde e vê a explicação logo a seguir.`);
    mostrar(h('div', { class: 'per-inicio' },
      intro,
      h('p', { class: 'per-estat' }, 'Acertaste ', h('strong', {}, String(acertadas)), ` de ${lista.length} ${plural(lista.length, 'pergunta', 'perguntas')} até agora.`),
      h('p', { class: 'per-legenda', id: idLegenda }, 'Temas: toca num para o escolher e junta mais se quiseres. Toca outra vez para tirar um.'),
      h('div', { class: 'chips per-temas', role: 'group', 'aria-labelledby': idLegenda }, chipTodos, chipsTema),
      h('p', { class: 'per-legenda', id: idLegTam }, 'Quantas perguntas'),
      h('div', { class: 'chips per-tamanhos', role: 'group', 'aria-labelledby': idLegTam }, chipsTam),
      h('div', { class: 'chips per-filtros', role: 'group', 'aria-label': 'Filtro' }, chipFiltro),
      estado,
      h('div', { class: 'per-acoes' }, comecar)), focar ? intro : null);
    atualizar();
  }

  // ---------- ecrã da pergunta ----------

  function ecraPergunta() {
    const r = ronda;
    const item = r.itens[r.indice];
    const p = item.p;
    const n = r.itens.length;
    const ultima = r.indice === n - 1;
    r.respondida = false;
    r.escolher = null;

    const cheia = h('div', { class: 'per-barra__cheia' });
    cheia.style.width = `${(100 * r.indice) / n}%`;
    const barra = h('div', {
      class: 'per-barra', role: 'progressbar', 'aria-label': 'Progresso da ronda', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': r.indice,
    }, cheia);
    const cabecalho = h('div', { class: 'per-progresso' },
      h('div', { class: 'per-progresso__linha' },
        h('p', { class: 'per-progresso__texto' }, `Pergunta ${r.indice + 1} de ${n}`),
        h('button', { type: 'button', class: 'per-sair', onclick: () => { esconderJanela(); ecraInicio(true); } }, 'Sair da ronda')),
      barra,
      h('p', { class: 'per-etiqueta' }, tituloTema(p.tema) + (r.revisao ? ' (a rever)' : '')));

    const idEnunciado = `per-${uid}-enun`;
    const enunciado = comFormulas('p', 'per-enunciado', p.enunciado);
    enunciado.id = idEnunciado;
    enunciado.tabIndex = -1;

    const botoes = item.ordem.map((orig, pos) => {
      const marca = h('span', { class: 'per-opcao__marca' });
      const b = h('button', { type: 'button', class: 'per-opcao', 'data-pos': pos, onclick: () => responder(pos) },
        h('span', { class: 'per-opcao__letra' }, LETRAS[pos]),
        h('span', { class: 'per-opcao__tex', html: seguro(p.opcoes[orig].tex) }),
        marca);
      b.marca = marca;
      return b;
    });
    const opcoes = h('div', { class: 'per-opcoes', role: 'group', 'aria-labelledby': idEnunciado }, botoes);
    renderizar(opcoes);

    const seguinte = h('button', { type: 'button', class: 'botao per-seguinte', hidden: true, onclick: () => avancar() },
      ultima ? 'Ver resultado' : 'Seguinte');
    const reabrir = h('button', { type: 'button', class: 'botao botao--suave per-reabrir', hidden: true, onclick: () => abrirJanela(item, ultima) },
      'Ver a explicação');
    const rodape = h('div', { class: 'per-rodape' }, seguinte, reabrir);

    function responder(pos) {
      if (r.respondida) return;
      r.respondida = true;
      item.escolhida = pos;
      item.certa = pos === item.certaPos;
      registar(p.id, item.certa);
      botoes.forEach((b, j) => {
        b.disabled = true;
        if (j === pos) {
          b.classList.add('per-opcao--escolhida', item.certa ? 'per-opcao--certa' : 'per-opcao--errada');
          b.marca.textContent = item.certa ? '✓ Certo' : '✗ Errado';
        } else if (j === item.certaPos) {
          b.classList.add('per-opcao--certa');
          b.marca.textContent = '✓ Resposta certa';
        } else {
          b.classList.add('per-opcao--outra');
        }
      });
      cheia.style.width = `${(100 * (r.indice + 1)) / n}%`;
      barra.setAttribute('aria-valuenow', String(r.indice + 1));
      seguinte.hidden = false; // a saída existe mesmo que a janela falhe ou seja fechada
      reabrir.hidden = false;
      abrirJanela(item, ultima);
    }
    r.escolher = responder;

    mostrar(h('div', { class: 'per-pergunta' },
      cabecalho,
      enunciado,
      opcoes,
      h('p', { class: 'nota per-dica' }, 'Dica: no teclado, carrega nas teclas 1 a 4 ou A a D.'),
      rodape), enunciado);
  }

  // ---------- ecrã final ----------

  function ecraFim() {
    const r = ronda;
    const total = r.itens.length;
    const certas = r.itens.filter((i) => i.certa).length;
    const falhadas = r.itens.filter((i) => !i.certa);
    const pct = percentagem(certas, total);

    const msg = `Fim da ronda. Acertaste ${certas} em ${total}, ${pct} por cento.`;
    vivo.textContent = '';
    setTimeout(() => { vivo.textContent = msg; }, 60); // atraso para o leitor de ecrã notar a mudança

    const porTema = new Map();
    for (const i of r.itens) {
      const a = porTema.get(i.p.tema) || { certas: 0, total: 0 };
      a.total += 1;
      if (i.certa) a.certas += 1;
      porTema.set(i.p.tema, a);
    }
    const linhas = idsTemas.filter((id) => porTema.has(id)).map((id) => {
      const a = porTema.get(id);
      return h('tr', { class: a.certas < a.total ? 'per-tabela__falha' : '' },
        h('th', { scope: 'row' }, tituloTema(id)), h('td', {}, String(a.certas)), h('td', {}, String(a.total)));
    });

    const frase = pct === 100 ? 'Sem falhas. Muito bem!'
      : pct >= 80 ? 'Muito bom. Já sabes quase tudo.'
        : pct >= 50 ? 'Estás no bom caminho. Vê o que falhaste e tenta outra vez.'
          : 'Ainda há trabalho a fazer. Repete com calma, a prática resolve.';

    const titulo = h('h4', { class: 'per-titulo', tabindex: '-1' }, 'Fim da ronda');
    const lista_falhadas = falhadas.length === 0 ? null : h('div', { class: 'per-falhadas' },
      h('h4', { class: 'per-subtitulo' }, `O que falhaste (${falhadas.length})`),
      h('ol', { class: 'per-falhadas__lista' }, falhadas.map((i) => h('li', { class: 'per-falhada' },
        h('span', { class: 'per-falhada__tema' }, tituloTema(i.p.tema)),
        comFormulas('span', 'per-falhada__texto', i.p.enunciado)))));
    const botoes = h('div', { class: 'per-acoes per-acoes--fim' },
      falhadas.length > 0 ? h('button', { type: 'button', class: 'botao', onclick: () => iniciarRonda(baralhar(rng, falhadas.map((i) => i.p)), true) }, 'Rever as que falhei') : null,
      h('button', { type: 'button', class: falhadas.length > 0 ? 'botao botao--suave' : 'botao', onclick: comecarDaEscolha }, 'Outra ronda'),
      h('button', { type: 'button', class: 'botao botao--suave', onclick: () => ecraInicio(true) }, 'Mudar temas'));

    mostrar(h('div', { class: 'per-fim' },
      titulo,
      h('p', { class: 'per-pontuacao' }, `${certas} em ${total}`, h('span', { class: 'per-pontuacao__pct' }, ` (${pct}%)`)),
      h('p', {}, frase),
      h('div', { class: 'tabela-rolante' },
        h('table', { class: 'tabela per-tabela' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Tema'), h('th', { scope: 'col' }, 'Certas'), h('th', { scope: 'col' }, 'Total'))),
          h('tbody', {}, linhas))),
      lista_falhadas,
      guardouTudo ? null : h('p', { class: 'nota' }, 'Não consegui guardar o progresso neste dispositivo (por exemplo, numa janela privada). Esta ronda conta, mas não fica guardada.'),
      botoes), titulo);
  }

  // ---------- teclado: 1 a 4 e A a D escolhem a opção ----------

  el.addEventListener('keydown', (ev) => {
    if (!ronda || ronda.respondida || !ronda.escolher) return;
    if (janelaAberta()) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const alvo = ev.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
    if (typeof ev.key !== 'string' || ev.key.length !== 1) return;
    const pos = '1234'.indexOf(ev.key) >= 0 ? '1234'.indexOf(ev.key) : 'abcd'.indexOf(ev.key.toLowerCase());
    if (pos < 0) return;
    ev.preventDefault();
    ronda.escolher(pos);
  });

  ecraInicio();
}
