// Treino rápido: perguntas de geradores.js, correção imediata com explicação e
// estatísticas por tipo guardadas neste dispositivo (secção «treino»).
// Todo o estado vive dentro de montar(); nada fica no módulo.

import * as M from '../../assets/motor/matematica.js';
import { renderizar, tex } from '../../assets/motor/katex.js';
import * as progresso from '../../assets/motor/progresso.js';
import { TIPOS as TIPOS_PADRAO, gerarPergunta } from '../geradores.js';

const N_PERGUNTAS = 10;
const MIN_PARA_REVER = 3;

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
    cola.className = 'tre-cola';
    nodo.replaceWith(cola);
    cola.append(nodo, document.createTextNode(m[0]));
    prox.data = prox.data.slice(m[0].length);
  }
}

/** Texto com $...$ já convertido em fórmulas. */
function comFormulas(tag, classe, texto) {
  const e = h(tag, { class: classe });
  e.textContent = texto;
  renderizar(e);
  colarPontuacao(e);
  return e;
}

const pct = (certas, total) => (total ? `${Math.round((100 * certas) / total)}%` : '');

/**
 * `extra` é opcional e serve só para testes: { tipos } troca a lista de tipos de pergunta e
 * { semente } fixa o gerador aleatório.
 * A página usa montar(el, dados), como manda o contrato dos widgets.
 */
export async function montar(el, dados, extra = {}) {
  const TIPOS = extra.tipos || TIPOS_PADRAO;
  const ids = TIPOS.map((t) => t.id);
  const nomeDe = (id) => (TIPOS.find((t) => t.id === id) || { nome: id }).nome;
  const rng = M.criarRng(extra.semente);
  const gerar = (id) => (extra.tipos
    ? TIPOS.find((t) => t.id === id).gerar(rng, dados)
    : gerarPergunta(id, rng, dados));

  let selecao = 'misto'; // 'misto' ou o id de um tipo
  let sessao = null;
  let guardouTudo = true;

  const raiz = h('div', { class: 'widget tre' });
  el.replaceChildren(raiz);

  // ---------- estatísticas ----------

  function lerStats() {
    const s = progresso.ler('treino', {});
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  }

  function registar(tipoId, certa) {
    const stats = { ...lerStats() };
    const antes = stats[tipoId] || { certas: 0, total: 0 };
    stats[tipoId] = { certas: (antes.certas || 0) + (certa ? 1 : 0), total: (antes.total || 0) + 1 };
    if (!progresso.guardar('treino', stats)) guardouTudo = false;
  }

  const taxa = (a) => (a.total ? a.certas / a.total : 0);

  // ---------- sessões ----------

  function sequenciaMista() {
    const seq = [];
    while (seq.length < N_PERGUNTAS) {
      const bloco = M.baralhar(rng, ids);
      if (seq.length && bloco.length > 1 && bloco[0] === seq[seq.length - 1]) bloco.push(bloco.shift());
      seq.push(...bloco);
    }
    return seq.slice(0, N_PERGUNTAS);
  }

  /** Gera uma pergunta nova do tipo, evitando repetir o enunciado numa mesma sessão. */
  function gerarNova(id, vistos) {
    let p;
    for (let tentativa = 0; tentativa < 30; tentativa++) {
      p = gerar(id);
      if (!vistos.has(p.enunciado)) break;
    }
    vistos.add(p.enunciado);
    return p;
  }

  function iniciarSessao(sel, tipos = null) {
    const lista = tipos || (sel === 'misto' ? sequenciaMista() : Array(N_PERGUNTAS).fill(sel));
    const vistos = new Set();
    sessao = {
      selecao: sel,
      perguntas: lista.map((id) => gerarNova(id, vistos)),
      indice: 0,
      respostas: [],
      respondida: false,
      revisao: tipos !== null,
    };
    ecraPergunta();
  }

  function mostrar(no, foco) {
    raiz.replaceChildren(no);
    if (foco) foco.focus();
  }

  // ---------- ecrã inicial ----------

  function ecraInicio() {
    sessao = null;
    const stats = lerStats();
    const opcoes = [{ id: 'misto', rotulo: `Treino misto (${N_PERGUNTAS} perguntas)` }, ...TIPOS.map((t) => ({ id: t.id, rotulo: t.nome }))];
    const botoes = {};
    const escolher = (id) => {
      selecao = id;
      for (const [k, b] of Object.entries(botoes)) b.setAttribute('aria-pressed', String(k === id));
    };
    const chips = h('div', { class: 'chips tre-chips', role: 'group', 'aria-label': 'O que queres treinar' });
    for (const o of opcoes) {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o.id === selecao), onclick: () => escolher(o.id) }, o.rotulo);
      botoes[o.id] = b;
      chips.append(b);
    }

    const rever = Object.entries(stats)
      .filter(([id, a]) => ids.includes(id) && a && a.total >= MIN_PARA_REVER && a.certas < a.total)
      .sort((a, b) => taxa(a[1]) - taxa(b[1]) || b[1].total - a[1].total)
      .slice(0, 2);
    const blocoRever = rever.length === 0 ? null : h('div', { class: 'tre-rever' },
      h('p', { class: 'tre-rever__titulo' }, 'A rever:'),
      rever.map(([id, a]) => h('button', { type: 'button', class: 'tre-rever__item', onclick: () => { escolher(id); botoes[id].focus(); } },
        `${nomeDe(id)} (${pct(a.certas, a.total)})`)));

    const comDados = TIPOS.filter((t) => stats[t.id] && stats[t.id].total > 0);
    let tabela = null;
    if (comDados.length > 0) {
      const somaC = comDados.reduce((s, t) => s + stats[t.id].certas, 0);
      const somaT = comDados.reduce((s, t) => s + stats[t.id].total, 0);
      tabela = h('div', { class: 'tre-stats' },
        h('p', { class: 'widget__titulo' }, 'As tuas estatísticas'),
        h('div', { class: 'tabela-rolante' },
          h('table', { class: 'tabela tre-tabela' },
            h('thead', {}, h('tr', {},
              h('th', { scope: 'col' }, 'Tipo'), h('th', { scope: 'col' }, 'Certas'), h('th', { scope: 'col' }, 'Total'), h('th', { scope: 'col' }, '%'))),
            h('tbody', {},
              comDados.map((t) => h('tr', {},
                h('th', { scope: 'row' }, t.nome), h('td', {}, String(stats[t.id].certas)), h('td', {}, String(stats[t.id].total)), h('td', {}, pct(stats[t.id].certas, stats[t.id].total)))),
              h('tr', { class: 'tre-tabela__soma' },
                h('th', { scope: 'row' }, 'Tudo'), h('td', {}, String(somaC)), h('td', {}, String(somaT)), h('td', {}, pct(somaC, somaT)))))),
        h('p', { class: 'nota' }, 'Guardado só neste dispositivo.'));
    } else {
      tabela = h('p', { class: 'nota' }, 'Ainda não respondeste a nenhuma pergunta. As tuas estatísticas aparecem aqui.');
    }

    const comecar = h('button', { type: 'button', class: 'botao tre-comecar', onclick: () => iniciarSessao(selecao) }, 'Começar');
    mostrar(h('div', { class: 'tre-inicio' },
      h('p', { class: 'tre-guia' }, 'Escolhe o que queres treinar e carrega em «Começar».'),
      chips,
      blocoRever,
      h('div', { class: 'tre-acoes' }, comecar),
      tabela));
  }

  // ---------- ecrã da pergunta ----------

  function ecraPergunta() {
    const s = sessao;
    const p = s.perguntas[s.indice];
    const n = s.perguntas.length;
    s.respondida = false;
    s.escolher = null;

    const cheia = h('div', { class: 'tre-barra__cheia' });
    cheia.style.width = `${(100 * s.indice) / n}%`;
    const cabecalho = h('div', { class: 'tre-progresso' },
      h('div', { class: 'tre-progresso__linha' },
        h('p', { class: 'tre-progresso__texto' }, `Pergunta ${s.indice + 1} de ${n}`),
        h('button', { type: 'button', class: 'tre-sair', onclick: ecraInicio }, 'Sair do treino')),
      h('div', { class: 'tre-barra', role: 'progressbar', 'aria-label': 'Progresso do treino', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': s.indice }, cheia),
      h('p', { class: 'tre-etiqueta' }, nomeDe(p.tipo) + (s.revisao ? ' (a rever)' : '')));

    const enunciado = comFormulas('p', 'tre-enunciado', p.enunciado);
    enunciado.tabIndex = -1;
    const feedback = h('div', { class: 'tre-feedback', 'aria-live': 'polite' });
    const rodape = h('div', { class: 'tre-acoes tre-rodape' });
    const corpo = h('div', { class: 'tre-corpo' });

    const ultima = s.indice === n - 1;
    const seguinte = h('button', {
      type: 'button',
      class: 'botao tre-seguinte',
      onclick: () => {
        if (ultima) ecraFim();
        else { s.indice++; ecraPergunta(); }
      },
    }, ultima ? 'Ver resultado' : 'Seguinte');

    /** Marca o fim da pergunta: conta, guarda, explica e põe o foco em «Seguinte». */
    function terminar(certa, mensagem) {
      s.respondida = true;
      s.respostas.push({ tipo: p.tipo, certa });
      registar(p.tipo, certa);
      cheia.style.width = `${(100 * (s.indice + 1)) / n}%`;
      feedback.replaceChildren(...mensagem, h('div', { class: 'tre-explicacao' },
        h('p', { class: 'tre-explicacao__titulo' }, 'Explicação'),
        comFormulas('p', 'tre-explicacao__texto', p.explicacao)));
      rodape.append(seguinte);
      seguinte.focus();
    }

    if (p.modo === 'escrita') {
      montarEscrita(p, corpo, feedback, terminar);
    } else {
      const lista = h('div', { class: 'tre-opcoes', role: 'group', 'aria-label': 'Opções de resposta' });
      const botoes = p.opcoes.map((o, i) => {
        const marca = h('span', { class: 'tre-opcao__marca' });
        const b = h('button', { type: 'button', class: 'tre-opcao', onclick: () => escolher(i) },
          h('span', { class: 'tre-opcao__num', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { class: 'tre-opcao__tex', html: tex(o.tex) }),
          marca);
        b.marca = marca;
        return b;
      });
      lista.append(...botoes);
      corpo.append(lista, h('p', { class: 'nota tre-dica' }, 'Dica: no teclado, carrega nas teclas 1 a 4.'));
      s.escolher = escolher;

      function escolher(i) {
        if (s.respondida) return;
        const certa = p.opcoes[i].correta === true;
        const indiceCerta = p.opcoes.findIndex((o) => o.correta);
        botoes.forEach((b, j) => {
          b.disabled = true;
          if (j === i) {
            b.classList.add(certa ? 'tre-opcao--certa' : 'tre-opcao--errada');
            b.marca.textContent = certa ? '✓ Certo' : '✗ Errado';
          } else if (j === indiceCerta) {
            b.classList.add('tre-opcao--certa');
            b.marca.textContent = '✓ Resposta certa';
          }
        });
        const mensagem = certa
          ? [h('p', { class: 'aviso-ok tre-aviso' }, '✓ Certo.')]
          : [h('p', { class: 'aviso-erro tre-aviso' }, '✗ Errado. A resposta certa é ',
            h('span', { class: 'tre-certa', html: tex(p.opcoes[indiceCerta].tex) + '.' }))];
        terminar(certa, mensagem);
      }
    }

    mostrar(h('div', { class: 'tre-pergunta' }, cabecalho, enunciado, corpo, feedback, rodape), enunciado);
  }

  /** Perguntas de resposta escrita: usa M.corrigir e deixa tentar de novo se não percebeu. */
  function montarEscrita(p, corpo, feedback, terminar) {
    const idCampo = `tre-campo-${Math.random().toString(36).slice(2, 8)}`;
    const campo = h('input', {
      type: 'text', id: idCampo, class: 'campo tre-campo', inputmode: 'text', enterkeyhint: 'go',
      autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
      'aria-describedby': `${idCampo}-dica`,
    });
    const verificar = h('button', { type: 'submit', class: 'botao tre-verificar' }, 'Verificar');
    const form = h('form', { class: 'tre-escrita', novalidate: true },
      h('label', { for: idCampo, class: 'tre-escrita__rotulo' }, 'A tua resposta'),
      h('div', { class: 'tre-escrita__linha' }, campo, verificar),
      h('p', { class: 'nota', id: `${idCampo}-dica` }, 'Podes escrever √3/2, sqrt(3)/2 ou raiz(3)/2, e pi ou π. Se não estiver definida, escreve n.d.'));
    corpo.append(form);
    const certaTex = () => (p.esperado.naoDefinida ? '\\text{não definida}' : (p.esperado.tex || ''));
    const certaEmTexto = () => (p.esperado.naoDefinida ? 'não definida' : (p.esperado.tex ? '' : p.esperado.expr));

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (campo.readOnly) return;
      const r = M.corrigir(campo.value, p.esperado);
      if (r.estado === 'invalido') {
        feedback.replaceChildren(h('p', { class: 'aviso-erro tre-aviso' }, 'Não consegui ler isto. Escreve, por exemplo, √3/2 ou 1/2.'));
        campo.focus();
        return;
      }
      if (r.estado === 'decimal') {
        feedback.replaceChildren(h('p', { class: 'aviso-erro tre-aviso' }, 'Está certo em decimal, mas escreve a forma exata (com a raiz, se for o caso).'));
        campo.focus();
        return;
      }
      campo.readOnly = true;
      verificar.disabled = true;
      if (r.estado === 'errado') {
        terminar(false, [h('p', { class: 'aviso-erro tre-aviso' }, '✗ Errado. A resposta certa é ',
          h('span', { class: 'tre-certa', html: (certaTex() ? tex(certaTex()) : certaEmTexto()) + '.' }))]);
      } else if (r.estado === 'certo-forma') {
        terminar(true, [h('p', { class: 'aviso-ok tre-aviso' }, '✓ Certo. ',
          p.esperado.tex ? ['A forma pedida é ', h('span', { html: tex(p.esperado.tex) }), '.'] : 'Escreve a raiz no numerador.')]);
      } else {
        terminar(true, [h('p', { class: 'aviso-ok tre-aviso' }, '✓ Certo.')]);
      }
    });
  }

  // ---------- ecrã final ----------

  function ecraFim() {
    const s = sessao;
    const certas = s.respostas.filter((r) => r.certa).length;
    const total = s.respostas.length;
    const falhadas = s.respostas.filter((r) => !r.certa).map((r) => r.tipo);
    const porTipo = new Map();
    for (const r of s.respostas) {
      const a = porTipo.get(r.tipo) || { certas: 0, total: 0 };
      a.total++;
      if (r.certa) a.certas++;
      porTipo.set(r.tipo, a);
    }
    const frac = total ? certas / total : 0;
    const mensagem = frac === 1 ? 'Sem falhas. Muito bem!'
      : frac >= 0.8 ? 'Muito bom. Já sabes quase tudo.'
        : frac >= 0.5 ? 'Estás no bom caminho. Vê o que falhaste e tenta outra vez.'
          : 'Ainda há trabalho a fazer. Repete com calma, a prática resolve.';

    const titulo = h('h4', { class: 'tre-titulo', tabindex: '-1' }, 'Resultado');
    const botoes = h('div', { class: 'tre-acoes tre-acoes--fim' },
      h('button', { type: 'button', class: 'botao', onclick: () => iniciarSessao(s.selecao) }, 'Repetir'),
      falhadas.length > 0 ? h('button', { type: 'button', class: 'botao botao--suave', onclick: () => iniciarSessao(s.selecao, falhadas) },
        `Rever o que falhei (${falhadas.length})`) : null,
      h('button', { type: 'button', class: 'botao botao--suave', onclick: ecraInicio }, 'Escolher outro treino'));

    mostrar(h('div', { class: 'tre-fim' },
      titulo,
      h('p', { class: 'tre-pontuacao', 'aria-live': 'polite' }, `Acertaste ${certas} de ${total}`, h('span', { class: 'tre-pontuacao__pct' }, ` (${pct(certas, total)})`)),
      h('p', {}, mensagem),
      h('div', { class: 'tabela-rolante' },
        h('table', { class: 'tabela tre-tabela' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Tipo'), h('th', { scope: 'col' }, 'Certas'), h('th', { scope: 'col' }, 'Total'))),
          h('tbody', {}, [...porTipo.entries()].map(([id, a]) => h('tr', { class: a.certas < a.total ? 'tre-tabela__falha' : '' },
            h('th', { scope: 'row' }, nomeDe(id)), h('td', {}, `${a.certas}`), h('td', {}, `${a.total}`)))))),
      guardouTudo ? null : h('p', { class: 'nota' }, 'Não consegui guardar o progresso neste dispositivo (por exemplo, numa janela privada). Esta sessão conta, mas não fica guardada.'),
      botoes), titulo);
  }

  // ---------- teclado: 1 a 4 escolhem a opção ----------

  el.addEventListener('keydown', (ev) => {
    if (!sessao || sessao.respondida || !sessao.escolher) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const alvo = ev.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
    const i = ['1', '2', '3', '4'].indexOf(ev.key);
    if (i < 0) return;
    ev.preventDefault();
    sessao.escolher(i);
  });

  ecraInicio();
}
