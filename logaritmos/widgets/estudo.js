// estudo: módulo «Estudo de uma função» da Matéria. A aluna escolhe uma de quatro funções e vê o
// roteiro de um estudo completo em 7 passos, revelados um a um: 1 domínio e continuidade, 2 zeros e
// sinal, 3 derivada e tabela de variação, 4 extremos, 5 segunda derivada e concavidades, 6 assíntotas,
// 7 gráfico e contradomínio. A cada passo o gráfico (assets/motor/grafico.js) ganha o que o passo
// descobriu. Um cursor sobre a curva (rato, toque ou setas) mostra x, f(x) e o sinal de f' e de f''.
//
// Contrato: export async function montar(el, dados); dados.estudos = conteúdo de dados/estudos.json.
// Estado guardado: nenhum (cada visita começa no passo 0).
//
// Formato de dados/estudos.json (as expressões usam a sintaxe do avaliador do motor; o texto é
// HTML + KaTeX com as barras dobradas; tools/verificar_estudos.py confere TODOS os números):
//   { "roteiro": [ { "titulo", "porque" } x 7 ],             o mesmo para todas as funções
//     "funcoes": [ {
//       "id", "nome": "f", "expr": "x*e^-x",                  nome da função e a sua expressão
//       "chip": "f(x)=x\\,e^{-x}", "ler": "…",                LaTeX do botão de escolha; leitura por extenso
//       "d1", "d2", "d1Tex", "d2Tex",                         f' e f'' (expressão e LaTeX, o do passo 3 e 5)
//       "janela": { "x": [a, b], "y": [c, d] },               janela do gráfico
//       "cursor": { "x0", "min", "max" },                     onde começa o cursor e por onde anda
//       "faixas": [ { "de", "ate" } ],                        zonas fora do domínio (só se o domínio tem fronteira)
//       "elementos": {                                        o que o gráfico vai ganhando (cada um num passo)
//         "z":  { "tipo": "ponto", "papel": "zero|maximo|minimo|inflexao", "x", "y",
//                 "rotulo", "pos": "cima|baixo|dir|esq", "ancora", "dx", "dy" },     rótulo e posição
//         "ah": { "tipo": "assintota", "orientacao": "vertical|horizontal|obliqua",
//                 "x" | "y" | "m" + "b" + "ate", "sentido", "rotulo" } },
//       "passos": [ {                                         7 passos
//         "texto", "depois", "resumo", "legenda",             HTML antes e depois da tabela, linha-resumo, texto do gráfico
//         "cuidado",                                          (opcional) erro típico
//         "descobre": [ ids de "elementos" que este passo põe no gráfico ],
//         "tabela": { "tipo": "sinal|variacao|concavidade",   (opcional)
//                     "x": [ { "v": "expressão ou ±inf", "tex" } ],
//                     "sinais": [ "+" | "-" ],                um por intervalo entre x consecutivos
//                     "valores": [ null | { "tex", "v", "tag": "max|min|pi" } | { "tex", "limite" } ],
//                     "legenda" } } ],
//       "resultados", "aprox" } ] }                           só para o verificador
//
// Tabelas de variação e de concavidades são <table> com cabeçalhos; as setas e ∪ ∩ são SVG com
// aria-label. Os passos novos entram numa lista aria-live="polite" sem roubar o foco.

import { criarGrafico, arrastarNaCurva, CORES } from '../../assets/motor/grafico.js';
import { avaliar, criarFuncao, fmt } from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { renderizar, tex } from '../../assets/motor/katex.js';

const N_PASSOS = 7;
const ALTURA = 270; // do viewBox do gráfico (a largura é 340)

// o que cada sinal quer dizer, por tipo de tabela: cor do troço, glifo no gráfico e ícone na tabela
const SENTIDO = {
  variacao: {
    '+': { cor: 'tg', glifo: '↗', icone: 'cresce', nome: 'crescente' },
    '-': { cor: 'log', glifo: '↘', icone: 'decresce', nome: 'decrescente' },
  },
  concavidade: {
    '+': { cor: 'der', glifo: '∪', icone: 'cima', nome: 'concavidade voltada para cima' },
    '-': { cor: 'id', glifo: '∩', icone: 'baixo', nome: 'concavidade voltada para baixo' },
  },
};
// onde fica o rótulo de um ponto (âncora do texto, desvio em x e em y, em unidades do desenho); cada ponto pode
// trazer ancora, dx e dy para o afinar
const POS_ROTULO = { cima: ['middle', 0, -10], baixo: ['middle', 0, 18], dir: ['start', 9, 4], esq: ['end', -9, 4] };
const TAGS = { max: ['máx.', 'máximo'], min: ['mín.', 'mínimo'], pi: ['P.I.', 'ponto de inflexão'] };

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

/** Número de uma expressão dos dados: '+inf', '-inf', '1/e', 'ln(2)', 3. */
function num(v) {
  if (typeof v === 'number') return v;
  if (v === '+inf') return Infinity;
  if (v === '-inf') return -Infinity;
  const r = avaliar(String(v));
  if (!r.ok) throw new Error(`estudo: não consegui calcular «${v}»`);
  return r.valor;
}

/** LaTeX simples -> texto para leitores de ecrã («\ln 2» fica «ln 2», «-\infty» fica «menos infinito»). */
function plano(t) {
  return String(t)
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 sobre $2')
    .replace(/-\\infty/g, 'menos infinito')
    .replace(/\+?\\infty/g, 'mais infinito')
    .replace(/\^\{([^{}]*)\}/g, ' elevado a $1')
    .replace(/\\ln\s*/g, 'ln ')
    .replace(/[{}\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const txt = (t) => t.replace(/\$[^$]*\$/g, '').replace(/<[^>]*>/g, '');
const reduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Ícones (SVG): setas ↗ ↘ e concavidades ∪ ∩ ----------

function seta(x1, y1, x2, y2) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const barba = (d) => `L${(x2 - 7 * Math.cos(ang + d)).toFixed(1)} ${(y2 - 7 * Math.sin(ang + d)).toFixed(1)}`;
  return `M${x1} ${y1}L${x2} ${y2}M${(x2 - 7 * Math.cos(ang - 0.5)).toFixed(1)} ${(y2 - 7 * Math.sin(ang - 0.5)).toFixed(1)}L${x2} ${y2}${barba(0.5)}`;
}

const FORMAS = {
  cresce: seta(4, 17, 24, 4),
  decresce: seta(4, 4, 24, 17),
  cima: 'M3 3Q14 25 25 3',
  baixo: 'M3 17Q14 -5 25 17',
};

function icone(tipo, nome) {
  return criar('svg', { class: `es-icone es-icone--${tipo}`, viewBox: '0 0 28 20', role: 'img', 'aria-label': nome, focusable: 'false' },
    [criar('path', { d: FORMAS[tipo] })]);
}

// ---------- Tabelas (variação, concavidades, sinal) ----------

function formula(t) {
  const s = h('span', { class: 'es-f' });
  s.innerHTML = tex(t);
  return s;
}

/** Constrói a <table> de uma tabela dos dados. `T` é a tabela já com x numéricos; `nome` é f, g, h ou k. */
function criarTabela(T, nome) {
  const n = T.x.length;
  const sinaisNome = T.tipo === 'concavidade' ? `${nome}″` : `${nome}′`;
  const ehSinal = T.tipo === 'sinal';
  const sg = (s) => (s === '+' ? '+' : '−');

  const cabeca = [h('th', { scope: 'col', class: 'es-canto' }, 'x')];
  const lSinais = [h('th', { scope: 'row' }, ehSinal ? nome : sinaisNome)];
  const lF = [h('th', { scope: 'row' }, nome)];

  for (let k = 0; k < 2 * n - 1; k++) {
    if (k % 2 === 0) {
      const i = k / 2;
      const c = T.x[i];
      const interior = i > 0 && i < n - 1;
      cabeca.push(h('th', { scope: 'col', class: 'es-x' }, formula(c.tex)));
      lSinais.push(h('td', { class: 'es-zero' }, interior ? '0' : ''));
      const v = T.valores[i];
      if (ehSinal || !v) {
        lF.push(h('td', { class: 'es-vazio' }));
      } else if (v.limite !== undefined) {
        lF.push(h('td', { class: 'es-lim' }, formula(v.tex)));
      } else {
        const [curta, longa] = TAGS[v.tag] || ['', ''];
        lF.push(h('td', { class: `es-ext es-ext--${v.tag || 'ponto'}` },
          formula(v.tex),
          curta ? h('span', { class: 'es-tag', 'aria-hidden': 'true' }, curta) : null,
          curta ? h('span', { class: 'sr-only' }, ` (${longa})`) : null));
      }
    } else {
      const j = (k - 1) / 2;
      const a = T.x[j];
      const b = T.x[j + 1];
      const s = T.sinais[j];
      cabeca.push(h('th', { scope: 'col', class: 'es-int' }, h('span', { class: 'sr-only' }, `de ${plano(a.tex)} a ${plano(b.tex)}`)));
      lSinais.push(h('td', { class: `es-sinal es-sinal--${s === '+' ? 'mais' : 'menos'}` }, sg(s)));
      if (ehSinal) {
        lF.push(h('td', { class: 'es-vazio' }));
      } else {
        const sd = SENTIDO[T.tipo][s];
        lF.push(h('td', { class: 'es-seta' }, icone(sd.icone, sd.nome)));
      }
    }
  }
  // na tabela de sinal a linha de f é a dos sinais, por isso só há duas linhas
  const corpo = ehSinal ? [h('tr', {}, ...cabeca), h('tr', {}, ...lSinais)] : [h('tr', {}, ...cabeca), h('tr', {}, ...lSinais), h('tr', {}, ...lF)];
  return h('div', { class: 'tabela-rolante es-tabela-caixa' },
    h('table', { class: `tabela es-tabela es-tabela--${T.tipo}`, 'data-colunas': String(2 * n - 1) },
      h('caption', { class: 'sr-only' }, T.legenda),
      h('tbody', {}, ...corpo)));
}

// ---------- O widget ----------

export async function montar(el, dados) {
  const D = dados && dados.estudos;
  if (!D || !Array.isArray(D.funcoes) || D.funcoes.length === 0 || !Array.isArray(D.roteiro) || D.roteiro.length !== N_PASSOS) {
    throw new Error('estudo: faltam dados.estudos (roteiro e funcoes)');
  }
  const uid = Math.random().toString(36).slice(2, 7);
  const roteiro = D.roteiro;

  let F = null; // função escolhida, já preparada
  let rev = 0; // passos revelados
  let atual = 0; // passo cujo estado do gráfico se vê (0 a 7)
  let G = null; // { g, c } gráfico e cursor
  let porPonteiro = false;
  let cartoes = []; // [{ li, cab, corpo }]

  // ---------- estrutura ----------
  const chips = D.funcoes.map((def, i) => {
    const b = h('button', { type: 'button', class: 'chip es-chip', 'aria-pressed': 'false', 'aria-label': def.ler, 'data-i': String(i) });
    b.innerHTML = tex(def.chip);
    b.addEventListener('click', () => escolher(i));
    return b;
  });
  const grupoChips = h('div', { class: 'chips es-chips', role: 'group', 'aria-label': 'Escolhe a função' }, ...chips);
  const enunciado = h('p', { class: 'es-enunciado' });

  // navegação: roteiro (7 números), estado e botões
  const pontos = roteiro.map((r, i) => {
    const b = h('button', { type: 'button', class: 'es-ponto', 'data-n': String(i + 1), 'aria-label': `Passo ${i + 1}: ${txt(r.titulo)}` }, String(i + 1));
    b.addEventListener('click', () => ir(i + 1));
    return h('li', { class: 'es-roteiro__item' }, b);
  });
  const roteiroEl = h('ol', { class: 'es-roteiro', 'aria-label': 'Passos do estudo' }, ...pontos);
  const estado = h('p', { class: 'es-estado' });
  const btnSeguinte = h('button', { type: 'button', class: 'botao es-botao es-botao--seguinte' }, 'Passo seguinte');
  const btnTudo = h('button', { type: 'button', class: 'botao botao--suave es-botao' }, 'Mostrar tudo');
  const btnRecomecar = h('button', { type: 'button', class: 'botao botao--suave es-botao' }, 'Recomeçar');
  btnSeguinte.addEventListener('click', seguinte);
  btnTudo.addEventListener('click', tudo);
  btnRecomecar.addEventListener('click', recomecar);
  const botoes = h('div', { class: 'es-botoes' }, btnSeguinte, btnTudo, btnRecomecar);
  const nav = h('div', { class: 'es-nav' }, roteiroEl, estado, botoes);

  // gráfico, cursor e leituras
  const figura = h('div', { class: 'es-fig' });
  const legenda = h('p', { class: 'nota es-legenda' });
  const btnLer = h('button', { type: 'button', class: 'botao botao--suave botao--mini es-ler' }, 'Ler o passo');
  btnLer.addEventListener('click', lerPasso);
  const leitura = (chave, rotulo) => {
    const rot = h('span', { class: 'leitura__rotulo' }, rotulo);
    const val = h('span', { class: 'leitura__valor' });
    return { chave, rot, val, caixa: h('div', { class: `leitura es-leitura es-leitura--${chave}` }, rot, val) };
  };
  const L = { x: leitura('x', 'x'), y: leitura('y', 'f(x)'), d1: leitura('d1', "f′(x)"), d2: leitura('d2', 'f″(x)') };
  const leituras = h('div', { class: 'leituras es-leituras' }, L.x.caixa, L.y.caixa, L.d1.caixa, L.d2.caixa);
  const dica = h('p', { class: 'nota es-dica' }, 'Arrasta o ponto sobre a curva, ou carrega no gráfico, ou usa as setas depois de o focares. Perto de um ponto importante o cursor encaixa.');
  const blocoFig = h('div', { class: 'es-bloco-fig' }, figura, legenda, btnLer, leituras, dica);

  // passos revelados (cada novo passo entra aqui sem tirar o foco)
  const lista = h('ol', { class: 'es-passos', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const blocoPassos = h('div', { class: 'es-bloco-passos' }, lista);

  const corpo = h('div', { class: 'es-corpo' }, nav, blocoFig, blocoPassos);
  const raiz = h('div', { class: 'widget es' },
    h('p', { class: 'widget__titulo' }, 'Estudo completo, passo a passo'),
    grupoChips, enunciado, corpo);
  el.replaceChildren(raiz);

  // o gráfico fixa-se por baixo da barra de navegação do site
  const ajustarTopo = () => {
    const barra = document.getElementById('barra');
    raiz.style.setProperty('--es-topo', `${(barra ? barra.offsetHeight : 64) + 8}px`);
  };
  ajustarTopo();
  window.addEventListener('resize', ajustarTopo);

  // ---------- preparar uma função ----------
  function preparar(def) {
    const fn = criarFuncao(def.expr);
    const d1 = criarFuncao(def.d1);
    const d2 = criarFuncao(def.d2);
    const elementos = {};
    for (const [k, e] of Object.entries(def.elementos)) {
      elementos[k] = { ...e, nome: k, passo: 0 };
      if (e.tipo === 'ponto') { elementos[k].xn = num(e.x); elementos[k].yn = num(e.y); }
    }
    def.passos.forEach((p, i) => p.descobre.forEach((k) => { elementos[k].passo = i + 1; }));
    const passos = def.passos.map((p) => {
      const t = p.tabela;
      return { ...p, T: t ? { ...t, x: t.x.map((c) => ({ ...c, n: num(c.v) })) } : null };
    });
    return { def, nome: def.nome, fn, d1, d2, elementos, passos, janela: def.janela, cursor: def.cursor, faixas: def.faixas || [] };
  }

  // ---------- o gráfico ----------
  const sinalDe = (d) => (!Number.isFinite(d) ? null : Math.abs(d) < 1e-5 ? 0 : d > 0 ? 1 : -1);

  function pontosSnap() {
    return Object.values(F.elementos).filter((e) => e.tipo === 'ponto' && e.passo >= 1 && e.passo <= atual);
  }

  function textoDoCursor(x, y) {
    let t = `x = ${fmt(x, 2)}; ${F.nome}(x) = ${fmt(y, 3)}`;
    if (atual >= 3) {
      const s = sinalDe(F.d1(x));
      t += s === 0 ? `; ${F.nome}′ é zero` : `; ${F.nome}′ ${s > 0 ? 'positiva, a função sobe' : 'negativa, a função desce'}`;
    }
    if (atual >= 5) {
      const s = sinalDe(F.d2(x));
      t += s === 0 ? `; ${F.nome}″ é zero` : `; ${F.nome}″ ${s > 0 ? 'positiva, concavidade voltada para cima' : 'negativa, concavidade voltada para baixo'}`;
    }
    return t;
  }

  function atualizarLeituras() {
    if (!G) return;
    const x = G.c.x;
    const y = G.c.y;
    L.x.val.textContent = fmt(x, 2);
    L.y.val.textContent = Number.isFinite(y) ? fmt(y, 3) : '';
    L.y.rot.textContent = `${F.nome}(x)`;
    L.d1.rot.textContent = `${F.nome}′(x)`;
    L.d2.rot.textContent = `${F.nome}″(x)`;
    const mostra = (l, passo, d, textos) => {
      l.caixa.dataset.estado = '';
      if (atual < passo) {
        l.val.textContent = `passo ${passo}`;
        l.val.className = 'leitura__valor es-pendente';
        l.caixa.dataset.estado = 'pendente';
        return;
      }
      const s = sinalDe(d);
      const [txtMais, txtMenos, txtZero] = textos;
      l.val.className = `leitura__valor ${s === 0 ? 'es-neutro' : s > 0 ? 'es-mais' : 'es-menos'}`;
      l.val.textContent = s === 0 ? txtZero : s > 0 ? txtMais : txtMenos;
      l.caixa.dataset.estado = s === 0 ? 'zero' : s > 0 ? 'mais' : 'menos';
    };
    mostra(L.d1, 3, F.d1(x), ['+ ↗ sobe', '− ↘ desce', '0 ponto crítico']);
    mostra(L.d2, 5, F.d2(x), ['+ ∪ para cima', '− ∩ para baixo', '0 sinal muda?']);
    G.c.el.setAttribute('aria-valuetext', textoDoCursor(x, y));
  }

  function construirGrafico() {
    const j = F.janela;
    const g = criarGrafico({ x: j.x, y: j.y, largura: 340, altura: ALTURA, aria: `Gráfico de ${F.nome}` });
    const tol = ((j.x[1] - j.x[0]) / 280) * 5; // 5 px do desenho, em unidades de x
    // o encaixe só se aplica ao ponteiro; com o teclado o cursor anda sempre um passo
    g.svg.addEventListener('pointerdown', () => { porPonteiro = true; }, true);
    g.svg.addEventListener('pointermove', () => { porPonteiro = true; }, true);
    g.svg.addEventListener('keydown', () => { porPonteiro = false; }, true);
    let encaixando = false;
    const c = arrastarNaCurva(g, F.fn, {
      xmin: F.cursor.min,
      xmax: F.cursor.max,
      x0: F.cursor.x0,
      cor: 'ponto',
      passoTeclado: (F.cursor.max - F.cursor.min) / 80,
      aria: `Cursor sobre a curva de ${F.nome}. Setas esquerda e direita para o mover.`,
      textoAria: textoDoCursor,
      aoMover: (x) => {
        if (porPonteiro && !encaixando) {
          const alvo = pontosSnap().find((p) => Math.abs(p.xn - x) < tol && p.xn !== x);
          if (alvo) {
            encaixando = true;
            G.c.mover(alvo.xn);
            encaixando = false;
            return;
          }
        }
        atualizarLeituras();
      },
    });
    G = { g, c };
    figura.replaceChildren(g.svg);
    desenhar();
    atualizarLeituras();
  }

  /** Troços do gráfico, a partir dos intervalos de uma tabela. */
  function trocosDe(T) {
    const j = F.janela.x;
    return T.sinais.map((s, i) => {
      const de = Math.max(T.x[i].n, j[0]);
      const ate = Math.min(T.x[i + 1].n, j[1]);
      return { s, de, ate };
    }).filter((t) => t.ate > t.de);
  }

  function desenhar() {
    if (!G) return;
    const { g } = G;
    const j = F.janela;
    const n = atual;
    g.limpar();

    // zona fora do domínio, desde o passo 1
    if (n >= 1) for (const f of F.faixas) g.area(() => j.y[1], f.de, f.ate, { entre: j.y[0], cor: 'zona', id: 'faixa' });

    // assíntotas descobertas (a tracejado)
    for (const e of Object.values(F.elementos)) {
      if (e.tipo !== 'assintota' || e.passo < 1 || e.passo > n) continue;
      const op = { rotulo: e.rotulo, id: e.nome };
      if (e.orientacao === 'vertical') g.retaVertical(num(e.x), { ...op, posRotulo: 'baixo' });
      else if (e.orientacao === 'horizontal') g.retaHorizontal(num(e.y), { ...op, posRotulo: 'dir' });
      else {
        const m = num(e.m);
        const b = num(e.b);
        const a = e.sentido === '-inf' ? j.x[0] : (e.de ?? j.x[0]);
        const z = e.sentido === '-inf' ? (e.ate ?? j.x[1]) : j.x[1];
        g.segmento(a, m * a + b, z, m * z + b, { ...op, cor: 'assint', tracejado: true, espessura: 1.8 });
      }
    }

    // a curva: esbatida até ao passo 6, em destaque no 7
    if (n >= N_PASSOS) g.curva(F.fn, { cor: 'exp', espessura: 3.2, rotulo: F.nome, id: 'curva' });
    else g.curva(F.fn, { cor: 'exp', espessura: 2.2, opacidade: 0.3, id: 'curva' });

    // troços coloridos: monotonia nos passos 3 e 4, concavidade no 5
    const passoTabela = n === 3 || n === 4 ? 3 : n === 5 ? 5 : 0;
    if (passoTabela) {
      const T = F.passos[passoTabela - 1].T;
      for (const t of trocosDe(T)) {
        const sd = SENTIDO[T.tipo][t.s];
        g.curva(F.fn, { cor: sd.cor, espessura: 3.6, de: t.de, ate: t.ate, id: `troco-${sd.icone}` });
        const xm = (t.de + t.ate) / 2;
        const ym = F.fn(xm);
        if (Number.isFinite(ym)) {
          const cima = sd.icone === 'baixo';
          g.rotulo(xm, ym, sd.glifo, { ancora: 'middle', cor: sd.cor, tam: 17, peso: 700, dy: cima ? 24 : -12, dx: sd.icone === 'cresce' ? -12 : sd.icone === 'decresce' ? 12 : 0, id: `glifo-${sd.icone}` });
        }
      }
    }

    // pontos descobertos
    for (const e of Object.values(F.elementos)) {
      if (e.tipo !== 'ponto' || e.passo < 1 || e.passo > n) continue;
      g.ponto(e.xn, e.yn, { guias: e.papel !== 'zero', oco: e.papel === 'inflexao', cor: 'ponto', id: e.nome });
      if (e.rotulo) {
        const [anc, dx, dy] = POS_ROTULO[e.pos || 'cima'];
        g.rotulo(e.xn, e.yn, e.rotulo, { ancora: e.ancora || anc, dx: e.dx ?? dx, dy: e.dy ?? dy, id: `${e.nome}-rotulo` });
      }
    }

    const d = n === 0
      ? `Curva de ${F.nome} a cinzento claro, só para orientar. Cada passo do estudo acrescenta aqui o que descobre.`
      : F.passos[n - 1].legenda;
    legenda.textContent = d;
    g.definirAria(`Gráfico de ${F.nome}. ${d}`);
  }

  // ---------- passos ----------
  function criarCartao(n) {
    const p = F.passos[n - 1];
    const r = roteiro[n - 1];
    const id = `${uid}-p${n}`;
    const resumo = h('span', { class: 'es-passo__res' });
    resumo.innerHTML = p.resumo;
    const cab = h('button', { type: 'button', class: 'es-passo__cab', 'aria-expanded': 'false', 'aria-controls': `${id}-c` },
      h('span', { class: 'es-passo__num', 'aria-hidden': 'true' }, String(n)),
      h('span', { class: 'es-passo__txt' },
        h('span', { class: 'es-passo__nome' }, h('span', { class: 'sr-only' }, `Passo ${n}: `), r.titulo),
        resumo));
    const porque = h('p', { class: 'es-passo__porque' });
    porque.innerHTML = r.porque;
    const texto = h('div', { class: 'es-passo__texto' });
    texto.innerHTML = p.texto;
    const corpoEl = h('div', { class: 'es-passo__corpo', id: `${id}-c`, hidden: true }, porque, texto);
    if (p.T) corpoEl.append(criarTabela(p.T, F.nome));
    if (p.depois) {
      const dep = h('div', { class: 'es-passo__texto es-passo__depois' });
      dep.innerHTML = p.depois;
      corpoEl.append(dep);
    }
    if (p.cuidado) {
      const c = h('p', { class: 'es-cuidado' }, h('strong', {}, 'Atenção. '));
      const t = h('span');
      t.innerHTML = p.cuidado;
      c.append(t);
      corpoEl.append(c);
    }
    const voltar = h('button', { type: 'button', class: 'botao botao--suave botao--mini es-voltar' }, 'Voltar ao gráfico');
    voltar.addEventListener('click', () => {
      nav.scrollIntoView({ block: 'start', behavior: reduzido() ? 'auto' : 'smooth' });
      try { btnSeguinte.focus({ preventScroll: true }); } catch { /* sem foco */ }
    });
    corpoEl.append(voltar);
    const li = h('li', { class: 'es-passo', 'data-n': String(n) }, h('h4', { class: 'es-passo__titulo' }, cab), corpoEl);
    renderizar(li);
    cab.addEventListener('click', () => {
      const abrir = corpoEl.hidden;
      if (abrir) ir(n, false);
      else abrirCartao(n, false);
    });
    return { li, cab, corpo: corpoEl };
  }

  function abrirCartao(n, abrir) {
    const c = cartoes[n - 1];
    if (!c) return;
    c.corpo.hidden = !abrir;
    c.cab.setAttribute('aria-expanded', String(abrir));
    c.li.classList.toggle('es-passo--aberto', abrir);
  }

  function acrescentar() {
    rev += 1;
    const c = criarCartao(rev);
    cartoes.push(c);
    lista.append(c.li);
  }

  function ir(n, rolar = true) {
    if (n < 1 || n > rev) return;
    atual = n;
    cartoes.forEach((_, i) => abrirCartao(i + 1, i + 1 === n));
    refrescar();
    if (rolar) cartoes[n - 1].li.scrollIntoView({ block: 'nearest', behavior: reduzido() ? 'auto' : 'smooth' });
  }

  function seguinte() {
    if (rev >= N_PASSOS) return;
    acrescentar();
    atual = rev;
    cartoes.forEach((_, i) => abrirCartao(i + 1, i + 1 === rev));
    refrescar();
  }

  function tudo() {
    while (rev < N_PASSOS) acrescentar();
    atual = N_PASSOS;
    cartoes.forEach((_, i) => abrirCartao(i + 1, true));
    refrescar();
  }

  function recomecar() {
    lista.replaceChildren();
    cartoes = [];
    rev = 0;
    atual = 0;
    refrescar();
  }

  function lerPasso() {
    const c = cartoes[atual - 1];
    if (!c) return;
    c.li.scrollIntoView({ block: 'start', behavior: reduzido() ? 'auto' : 'smooth' });
    try { c.cab.focus({ preventScroll: true }); } catch { /* sem foco */ }
  }

  function desativar(btn, desligado) {
    // aria-disabled em vez de disabled: o foco não se perde quando o botão deixa de servir
    btn.setAttribute('aria-disabled', String(desligado));
    btn.classList.toggle('es-botao--desligado', desligado);
  }
  function refrescar() {
    pontos.forEach((li, i) => {
      const b = li.firstChild;
      const n = i + 1;
      b.disabled = n > rev;
      b.classList.toggle('es-ponto--feito', n <= rev && n !== atual);
      if (n === atual) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    desativar(btnSeguinte, rev >= N_PASSOS);
    desativar(btnTudo, rev >= N_PASSOS && cartoes.every((c) => !c.corpo.hidden));
    desativar(btnRecomecar, rev === 0);
    btnSeguinte.textContent = rev >= N_PASSOS ? 'Estudo completo' : 'Passo seguinte';
    btnLer.hidden = atual === 0;
    estado.textContent = atual === 0
      ? 'Ainda não começaste. Carrega em «Passo seguinte» para ver o primeiro passo.'
      : `Passo ${atual} de ${N_PASSOS}: ${txt(roteiro[atual - 1].titulo)}.`;
    desenhar();
    atualizarLeituras();
  }

  // ---------- escolher a função ----------
  function escolher(i) {
    F = preparar(D.funcoes[i]);
    chips.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    enunciado.innerHTML = `Faz o estudo completo da função $${F.def.chip}$: domínio, zeros, variação e extremos, concavidades, assíntotas, gráfico e contradomínio.`;
    renderizar(enunciado);
    lista.replaceChildren();
    cartoes = [];
    rev = 0;
    atual = 0;
    construirGrafico();
    refrescar();
  }

  escolher(0);
}
