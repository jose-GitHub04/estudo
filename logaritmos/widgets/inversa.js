// inversa: a exponencial e o logaritmo são funções inversas, vistas num espelho.
// Um gráfico com a mesma escala nos dois eixos mostra y = a^x, y = log_a x, a reta y = x e as duas
// assíntotas. A base a muda por slider ou por chips e nunca é 1 (com a = 1 não há inversa). O ponto P
// arrasta-se sobre a exponencial (rato, toque, setas); o seu simétrico Q = (y, x) aparece sozinho no
// logaritmo, ligado a P por um segmento perpendicular a y = x, com o ponto médio nessa reta.
// «Dobrar o papel» mostra ou esconde a reta e essa ligação; «Ver a reflexão» anima P até Q.
// Por baixo: as leituras de P, de Q e da equivalência a^x = y <=> log_a y = x (KaTeX) e uma tabela
// de domínio, contradomínio, monotonia, zero, sinal e assíntota que só muda com a base no que tem de mudar.
// P fica sempre dentro da janela (y = a^x <= 7), por isso Q = (y, x) também fica: a janela é a mesma
// nos dois eixos. x anda de 0,1 em 0,1 para os números serem legíveis.
// Contrato: export async function montar(el, dados); não usa dados. Estado guardado: nenhum.
// Devolve um pequeno objeto de controlo, que só os testes usam.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';
import { criarGrafico, arrastarNaCurva, CORES } from '../../assets/motor/grafico.js';

const J0 = -3; // a janela é [J0, J1] nos dois eixos
const J1 = 7;
const LARGURA = 300;
const FONTE = 12;
const BASE_MIN = 0.25;
const BASE_MAX = 5;
const PASSO_BASE = 0.05;
const PASSO_X = 0.1;
const DURACAO = 600; // ms da animação da reflexão
const CHIPS = [
  { texto: '½', valor: 0.5, aria: 'base um meio' },
  { texto: '2', valor: 2 },
  { texto: 'e', valor: Math.E, aria: 'base e, aproximadamente 2,718', italico: true },
  { texto: '3', valor: 3 },
  { texto: '10', valor: 10 },
];

let contador = 0;

// ---------- utilitários ----------

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

const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ehE = (a) => Math.abs(a - Math.E) < 1e-9;

/** Casas decimais que mostram o essencial de v (os valores pequenos precisam de mais). */
const casasDe = (v) => {
  const m = Math.abs(v);
  return m >= 0.1 ? 2 : m >= 0.01 ? 3 : m >= 0.001 ? 4 : 5;
};

/** Número com vírgula e menos «−», sem zeros inúteis à direita: 1,50 -> 1,5; 10,00 -> 10. */
function num(v, casas = casasDe(v)) {
  let s = M.fmt(v, casas);
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return s;
}
const numTex = (v, casas) => num(v, casas).replace('−', '-').replace(',', '{,}');

const baseTxt = (a) => (ehE(a) ? 'e' : num(a, 2));
const baseTex = (a) => (ehE(a) ? 'e' : numTex(a, 2));
const logTex = (a) => (ehE(a) ? '\\ln' : `\\log_{${baseTex(a)}}`);
const expTexto = (a) => `y=${baseTex(a)}^{x}`;
const logTexto = (a) => `y=${logTex(a)}\\,x`;

/** Intervalo de x em que P fica dentro da janela (y = a^x entre 0 e J1), em múltiplos de 0,1. */
function limitesX(a) {
  const xTopo = Math.log(J1) / Math.log(a); // a^x = J1
  if (a > 1) return [J0, Math.min(J1, Math.floor(xTopo * 10 + 1e-9) / 10)];
  return [Math.max(J0, Math.ceil(xTopo * 10 - 1e-9) / 10), J1];
}

const arred1 = (x) => Math.round(x * 10) / 10 + 0;

/** Os dois lados da equivalência, com os números de P: 2^1,5 ≈ 2,83 <=> log_2 2,83 ≈ 1,5. */
function equivalenciaTex(a, x, y) {
  const cy = casasDe(y);
  const exato = Math.abs(Number(y.toFixed(cy)) - y) < 1e-9;
  const rel = exato ? '=' : '\\approx';
  const B = baseTex(a);
  const X = numTex(x, 1);
  const Y = numTex(y, cy);
  return `\\begin{gathered}${B}^{${X}}${rel}${Y}\\\\[0.35em]\\Leftrightarrow\\ ${logTex(a)}\\,${Y}${rel}${X}\\end{gathered}`;
}

const definirHtml = (no, html) => {
  if (no._h !== html) {
    no._h = html;
    no.innerHTML = html;
  }
};
const definirTexto = (no, txt) => {
  if (no.textContent !== txt) no.textContent = txt;
};

// ---------- o widget ----------

export async function montar(el, dados) {
  const id = `inv${++contador}`;
  const est = { a: 2, x: 2, dobrar: true, aviso: '', avisoTxt: '' }; // aviso: HTML (KaTeX); avisoTxt: o mesmo para o leitor de ecrã
  let regime = null; // true quando a > 1; muda -> as células que dependem da base piscam
  let raf = 0;
  let temporizador = 0;
  let interagiu = false; // só se anuncia (aria-live) depois de o aluno mexer em alguma coisa
  const cresc = () => est.a > 1;
  const yDe = (x) => Math.pow(est.a, x);
  const reduzir = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // ----- estrutura -----
  const raiz = h('div', { class: 'widget inv' });
  raiz.innerHTML = `
    <p class="widget__titulo">O espelho na reta y = x</p>
    <p class="inv-intro">Arrasta o ponto P ao longo da exponencial. O ponto Q aparece sozinho no logaritmo, com as coordenadas trocadas.</p>
    <div class="inv-corpo">
      <div class="inv-esq">
        <div class="inv-fig"></div>
        <ul class="inv-legenda" aria-label="Legenda do gráfico">
          <li><svg class="inv-amostra" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line class="inv-amostra--exp" x1="1" y1="5" x2="29" y2="5"/></svg><span data-leg="exp"></span></li>
          <li><svg class="inv-amostra" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line class="inv-amostra--log" x1="1" y1="5" x2="29" y2="5"/></svg><span data-leg="log"></span></li>
          <li data-leg-reta><svg class="inv-amostra" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line class="inv-amostra--id" x1="1" y1="5" x2="29" y2="5"/></svg><span>${tex('y=x')}</span></li>
        </ul>
      </div>
      <div class="inv-dir">
        <div class="inv-controlos">
          <div class="controlo inv-base">
            <div class="inv-base__linha">
              <label for="${id}-base">Base <i>a</i></label>
              <output for="${id}-base" class="inv-base__valor"></output>
            </div>
            <input type="range" id="${id}-base" min="${BASE_MIN}" max="${BASE_MAX}" step="${PASSO_BASE}" value="${est.a}">
          </div>
          <div class="chips inv-chips" role="group" aria-label="Bases mais usadas"></div>
          <p class="nota inv-aviso" hidden></p>
          <div class="chips inv-acoes" role="group" aria-label="Dobrar o papel">
            <button type="button" class="chip inv-dobrar" aria-pressed="true">Dobrar o papel</button>
            <button type="button" class="chip inv-refletir">Ver a reflexão</button>
          </div>
          <p class="nota inv-nota-dobra">Ao dobrar o papel pela reta ${tex('y=x')}, P cai em cima de Q: o segmento PQ é perpendicular à reta e o seu ponto médio está nela.</p>
        </div>
        <div class="leituras inv-leituras">
          <div class="leitura leitura--exp"><span class="leitura__rotulo">P, na exponencial</span><span class="leitura__valor" data-l="p"></span></div>
          <div class="leitura leitura--log"><span class="leitura__rotulo">Q, no logaritmo</span><span class="leitura__valor" data-l="q"></span></div>
          <div class="leitura inv-leitura--larga"><span class="leitura__rotulo">Os dois dizem o mesmo</span><span class="leitura__valor inv-equiv" data-l="eq"></span></div>
        </div>
        <p class="nota inv-troca-nota">Q tem as mesmas coordenadas de P, mas trocadas.</p>
      </div>
    </div>
    <div class="inv-baixo">
      <div class="tabela-rolante inv-tabela-lugar"></div>
      <div class="inv-notas">
        <p class="inv-dominio"><strong>O domínio de uma é o contradomínio da outra.</strong> É isto que a troca de ${tex('x')} com ${tex('y')} faz aos conjuntos.</p>
        <p class="inv-mono" data-c="nota-mono"></p>
        <p class="nota inv-zero">O zero do logaritmo é ${tex('x=1')} para qualquer base, porque ${tex('a^{0}=1')}.</p>
      </div>
    </div>
    <div class="sr-only inv-vivo" aria-live="polite" aria-atomic="true"></div>
  `;
  el.replaceChildren(raiz);

  const $ = (sel) => raiz.querySelector(sel);
  const slider = $('.inv-base input');
  const saidaBase = $('.inv-base__valor');
  const avisoEl = $('.inv-aviso');
  const btnDobrar = $('.inv-dobrar');
  const btnRefletir = $('.inv-refletir');
  const vivo = $('.inv-vivo');
  const legExp = $('[data-leg="exp"]');
  const legLog = $('[data-leg="log"]');
  const legReta = $('[data-leg-reta]');
  const L = {};
  raiz.querySelectorAll('[data-l]').forEach((n) => { L[n.dataset.l] = n; });

  const chipsBase = CHIPS.map((c) => {
    const b = h('button', { type: 'button', class: 'chip inv-chip', 'aria-pressed': 'false', 'aria-label': c.aria },
      c.italico ? h('i', {}, c.texto) : c.texto);
    b.addEventListener('click', () => {
      est.aviso = est.avisoTxt = '';
      definirBase(c.valor);
    });
    $('.inv-chips').append(b);
    return b;
  });

  // ----- tabela de domínio, contradomínio, ... -----
  const R = tex('\\mathbb{R}');
  const Rmais = tex('\\mathbb{R}^{+}');
  const tabela = h('table', { class: 'tabela inv-tabela' });
  tabela.innerHTML = `
    <caption class="sr-only">Domínio, contradomínio, monotonia, zero, sinal e assíntota da exponencial e do logaritmo</caption>
    <thead><tr>
      <th scope="col"><span class="sr-only">Propriedade</span></th>
      <th scope="col" class="inv-col-exp" data-c="cab-exp"></th>
      <th scope="col" class="inv-col-log" data-c="cab-log"></th>
    </tr></thead>
    <tbody>
      <tr><th scope="row">Domínio ${tex('D')}</th><td class="inv-par">${R}</td><td class="inv-par">${Rmais}</td></tr>
      <tr><th scope="row">Contradomínio ${tex("D'")}</th><td class="inv-par">${Rmais}</td><td class="inv-par">${R}</td></tr>
      <tr><th scope="row">Monotonia</th><td data-c="mono-exp"></td><td data-c="mono-log"></td></tr>
      <tr><th scope="row">Zero</th><td>não tem</td><td>${tex('x=1')}</td></tr>
      <tr><th scope="row">Sinal</th><td>positiva</td><td data-c="sinal-log"></td></tr>
      <tr><th scope="row">Assíntota</th><td>${tex('y=0')}</td><td>${tex('x=0')}</td></tr>
    </tbody>`;
  $('.inv-tabela-lugar').append(tabela);
  const C = {};
  raiz.querySelectorAll('[data-c]').forEach((n) => { C[n.dataset.c] = n; });

  // ----- gráfico -----
  const marcas = [];
  for (let v = J0; v <= J1; v++) marcas.push(v === 1 ? { valor: 1, texto: '' } : v); // o 1 leva o rótulo do ponto fixo
  const g = criarGrafico({
    x: [J0, J1], y: [J0, J1], igual: true, largura: LARGURA, fonte: FONTE,
    rotuloX: 'x', rotuloY: 'y', marcasX: marcas, marcasY: marcas,
    aria: 'Gráfico da exponencial e do logaritmo.',
  });
  $('.inv-fig').append(g.svg);

  const L0 = g.X(J0);
  const R0 = g.X(J1);
  const T0 = g.Y(J1);
  const B0 = g.Y(J0);

  const reta = g.reta(1, 0, { cor: 'id', tracejado: '7 5', espessura: 2 });
  g.retaHorizontal(0, { cor: 'exp', tracejado: '7 6', espessura: 2.4 });
  g.retaVertical(0, { cor: 'log', tracejado: '7 6', espessura: 2.4 });
  const curvaExp = g.curva((x) => yDe(x), { cor: 'exp', id: 'exp' });
  const curvaLog = g.curva((x) => (x > 0 ? Math.log(x) / Math.log(est.a) : NaN), { cor: 'log', id: 'log' });

  // ligação entre P e Q: segmento, ângulo reto e ponto médio (os nossos, para mexer sem recriar nada)
  const gExtra = criar('g', { 'clip-path': `url(#${g.id}-clip)` });
  g.camadas.pontos.append(gExtra);
  const segPQ = criar('line', { style: `stroke:${CORES.texto}`, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'stroke-linecap': 'round' });
  const angulo = criar('path', { fill: 'none', style: `stroke:${CORES.texto}`, 'stroke-width': 1.3, 'stroke-linejoin': 'miter' });
  const medio = criar('circle', { r: 3.2, 'stroke-width': 1.8, style: `fill:var(--papel, #fff);stroke:${CORES.texto}` });
  gExtra.append(segPQ, angulo, medio);

  g.ponto(0, 1, { cor: 'exp', raio: 4 });
  g.ponto(1, 0, { cor: 'log', raio: 4 });
  const q = g.ponto(est.a, est.x, { cor: 'log', raio: 6, id: 'q' });

  // texto simples dentro do SVG (com o halo branco dos rótulos do módulo)
  const camadaTexto = g.camadas.texto;
  function rotulo(cor, conteudo, extra = {}) {
    const t = criar('text', {
      'font-size': FONTE,
      'font-weight': extra.peso,
      style: `fill:${cor};font-family:var(--sans, system-ui, sans-serif);paint-order:stroke;stroke:var(--papel, #fff);stroke-width:3px;stroke-linejoin:round;`,
    }, [conteudo]);
    camadaTexto.append(t);
    return t;
  }
  const poe = (t, x, y, ancora = 'start') => {
    t.setAttribute('x', +x.toFixed(2));
    t.setAttribute('y', +y.toFixed(2));
    t.setAttribute('text-anchor', ancora);
  };

  const rotAssH = rotulo(CORES.exp, 'y = 0', { peso: 600 });
  const rotAssV = rotulo(CORES.log, 'x = 0', { peso: 600 });
  const rotP = rotulo(CORES.exp, 'P = (x, y)', { peso: 700 });
  const rotQ = rotulo(CORES.log, 'Q = (y, x)', { peso: 700 });
  const rotReta = rotulo(CORES.id, 'y = x', { peso: 600 });
  const rotUm = rotulo(CORES.exp, '(0, 1)', { peso: 600 });
  const rotZero = rotulo(CORES.log, '(1, 0)', { peso: 600 });
  // (1, 0) fica numa segunda linha por baixo dos números do eixo, ligado ao ponto por um fio
  const fioZero = criar('line', { style: `stroke:${CORES.log}`, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' });
  camadaTexto.insertBefore(fioZero, camadaTexto.firstChild);
  // «y = x» escrito ao longo da reta, no canto de baixo, que fica sempre livre
  rotReta.setAttribute('transform', `translate(${(g.X(-1.7) - 4).toFixed(2)} ${(g.Y(-1.7) - 6).toFixed(2)}) rotate(-45)`);
  rotReta.setAttribute('text-anchor', 'middle');

  // P: o ponto que se arrasta
  const ctl = arrastarNaCurva(g, (x) => yDe(x), {
    x0: est.x, xmin: J0, xmax: J1, passoTeclado: PASSO_X, cor: 'exp', raio: 6.5,
    aoMover: aoMoverP,
    aria: 'Ponto P, sobre a exponencial. Setas esquerda e direita para o mover.',
    textoAria: (x, y) => `P = (${num(x, 1)} ; ${num(y)}), Q = (${num(y)} ; ${num(x, 1)})`,
  });

  const fantasma = criar('circle', { class: 'inv-fantasma', r: 6.5, 'stroke-width': 1.6, style: 'fill:var(--c-exp, #1d5f94);stroke:var(--papel, #fff)', display: 'none' });
  g.camadas.controlos.append(fantasma);

  // ----- desenho -----

  // ----- rótulos P e Q: ficam no sítio com menos coisas por cima -----
  // (curvas, números e nomes dos eixos, rótulos dos pontos fixos e das assíntotas, o outro ponto)
  const larg = (txt) => txt.length * FONTE * 0.6;
  const caixa = { x0: L0 - 4, y0: T0 - 6, x1: R0 + 10, y1: B0 + 6 }; // o desenho e um pouco das margens
  const area = (r1, r2) => Math.max(0, Math.min(r1.x1, r2.x1) - Math.max(r1.x0, r2.x0)) * Math.max(0, Math.min(r1.y1, r2.y1) - Math.max(r1.y0, r2.y0));
  const retTexto = (txt, x, y, ancora) => {
    const w = larg(txt);
    const x0 = ancora === 'end' ? x - w : ancora === 'middle' ? x - w / 2 : x;
    return { x0, x1: x0 + w, y0: y - FONTE * 0.85, y1: y + 3 };
  };
  const em = (x, y, r) => ({ x0: x - r, x1: x + r, y0: y - r, y1: y + r });
  const dentroDe = (r, [x, y]) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

  const fixos = [
    { x0: L0, x1: R0, y0: g.Y(0) + 3, y1: g.Y(0) + FONTE + 8 }, // números do eixo dos xx
    { x0: g.X(0) - 28, x1: g.X(0) - 2, y0: T0, y1: B0 }, // números do eixo dos yy
    { x0: R0 - 14, x1: R0 + 2, y0: g.Y(0) - 22, y1: g.Y(0) - 5 }, // nome do eixo dos xx
    { x0: g.X(0) + 5, x1: g.X(0) + 18, y0: T0, y1: T0 + 15 }, // nome do eixo dos yy
    em(g.X(-1.7) - 4, g.Y(-1.7) - 6, 18), // «y = x» escrito ao longo da reta
    em(g.X(0), g.Y(1), 8),
    em(g.X(1), g.Y(0), 8),
  ];
  const amostrasReta = [];
  for (let t = J0; t <= J1 + 1e-9; t += 0.1) amostrasReta.push([g.X(t), g.Y(t)]);
  let variaveis = []; // por base: os rótulos das assíntotas e dos pontos fixos
  let amostras = []; // por base: pontos das duas curvas

  // para onde o rótulo pode ir, em relação ao ponto: [âncora do texto, dx, dy]
  const DIRS = {
    cimaEsq: ['end', -9, -9],
    cimaDir: ['start', 9, -9],
    baixoDir: ['start', 9, FONTE + 6],
    baixoEsq: ['end', -9, FONTE + 6],
    esq: ['end', -13, 4],
    dir: ['start', 13, 4],
    cima: ['middle', 0, -14],
    baixo: ['middle', 0, FONTE + 10],
  };

  /**
   * Põe o texto t junto do ponto (px, py). `textos` é a lista de textos possíveis (do mais completo ao mais
   * curto); `ordem` diz os lados preferidos; `evitar` são retângulos e `seg` pontos a evitar.
   */
  function colocar(t, textos, px, py, ordem, evitar, seg) {
    let melhor = null;
    const nomes = [...ordem, ...Object.keys(DIRS).filter((n) => !ordem.includes(n))];
    textos.forEach((conteudo, ti) => {
      for (const k of [1, 1.6, 2.4]) {
        nomes.forEach((nome, i) => {
          const [anc, dx, dy] = DIRS[nome];
          const x = px + dx * k;
          const y = py + dy * k;
          const r = retTexto(conteudo, x, y, anc);
          let custo = i * 0.7 + (k - 1) * 6 + ti * 25 + ((r.x1 - r.x0) * (r.y1 - r.y0) - area(r, caixa)) * 0.8;
          for (const o of fixos) custo += area(r, o);
          for (const o of variaveis) custo += area(r, o);
          for (const o of evitar) custo += area(r, o) * 1.5;
          for (const pt of amostras) if (dentroDe(r, pt)) custo += 5;
          if (est.dobrar) for (const pt of amostrasReta) if (dentroDe(r, pt)) custo += 1.5;
          for (const pt of seg) if (dentroDe(r, pt)) custo += 4;
          if (!melhor || custo < melhor.custo) melhor = { custo, x, y, anc, r, conteudo };
        });
      }
    });
    definirTexto(t, melhor.conteudo);
    poe(t, melhor.x, melhor.y, melhor.anc);
    return melhor.r;
  }

  /** Tudo o que depende só da base. */
  function refrescarBase() {
    const a = est.a;
    const c = cresc();
    const mudou = regime !== null && regime !== c;
    regime = c;

    saidaBase.textContent = ehE(a) ? 'e ≈ 2,718' : num(a, 2);
    slider.value = String(limitar(Math.round(a * 100) / 100, BASE_MIN, BASE_MAX));
    slider.setAttribute('aria-valuetext', ehE(a) ? 'e, aproximadamente 2,718' : (a > BASE_MAX ? `${num(a, 2)} (acima do máximo do controlo)` : num(a, 2)));
    chipsBase.forEach((b, i) => b.setAttribute('aria-pressed', String(Math.abs(CHIPS[i].valor - a) < 1e-9)));
    avisoEl.hidden = !est.aviso || Math.abs(a - 1) > 0.1;
    if (avisoEl.hidden) est.aviso = est.avisoTxt = '';
    else avisoEl.innerHTML = est.aviso;

    // legenda e cabeçalhos
    definirHtml(legExp, tex(expTexto(a)));
    definirHtml(legLog, tex(logTexto(a)));
    definirHtml(C['cab-exp'], tex(expTexto(a)));
    definirHtml(C['cab-log'], tex(logTexto(a)));

    // o que depende de a ser maior ou menor que 1
    const mono = c ? 'crescente' : 'decrescente';
    definirTexto(C['mono-exp'], mono);
    definirTexto(C['mono-log'], mono);
    definirHtml(C['sinal-log'], c
      ? `negativa em ${tex(']0,1[')}, positiva em ${tex(']1,+\\infty[')}`
      : `positiva em ${tex(']0,1[')}, negativa em ${tex(']1,+\\infty[')}`);
    definirHtml(C['nota-mono'], c
      ? `Com ${tex('a>1')} as duas são <strong>crescentes</strong>. Um ${tex('y')} maior pede um expoente maior, por isso ${tex(`${logTex(a)}\\,y`)} também cresce.`
      : `Com ${tex('0<a<1')} as duas são <strong>decrescentes</strong>. Um ${tex('y')} maior pede um expoente menor, por isso ${tex(`${logTex(a)}\\,y`)} decresce.`);
    if (mudou) {
      for (const k of ['mono-exp', 'mono-log', 'sinal-log', 'nota-mono']) {
        C[k].classList.remove('inv-muda');
        void C[k].offsetWidth; // reinicia a animação
        C[k].classList.add('inv-muda');
      }
    }

    // assíntotas: o rótulo fica do lado onde a curva não se aproxima do eixo
    const hx = c ? R0 - 26 : L0 + 6;
    const hy = g.Y(0) - 7;
    const vx = g.X(0) + (c ? -16 : 6); // a crescente: à esquerda dos números do eixo dos yy
    const vy = c ? g.Y(J1 - 0.5) + FONTE * 0.35 : B0 - 6; // a crescente: entre os números 6 e 7 do eixo dos yy, para não tocar neles
    const anc = c ? 'end' : 'start';
    poe(rotAssH, hx, hy, anc);
    poe(rotAssV, vx, vy, anc);
    // (0, 1) e (1, 0): do lado onde a curva não passa
    const ux = g.X(0) - 8;
    const uy = c ? g.Y(1) - 8 : g.Y(1) + FONTE + 6;
    const zx = g.X(1) + (c ? 4 : -4);
    const zy = g.Y(0) + 2 * FONTE + 10;
    const ancZ = c ? 'start' : 'end';
    poe(rotUm, ux, uy, 'end');
    poe(rotZero, zx, zy, ancZ);
    for (const [k, v] of Object.entries({ x1: g.X(1), y1: g.Y(0) + 7, x2: g.X(1), y2: zy - 12 })) fioZero.setAttribute(k, +v.toFixed(2));
    variaveis = [retTexto('y = 0', hx, hy, anc), retTexto('x = 0', vx, vy, anc), retTexto('(0, 1)', ux, uy, 'end'), retTexto('(1, 0)', zx, zy, ancZ)];
    amostras = [];
    for (let k = 0; k <= 400; k++) {
      const t = J0 + ((J1 - J0) * k) / 400;
      const y = yDe(t);
      for (const [dx, dy] of [[t, y], [y, t]]) if (dx >= J0 && dx <= J1 && dy >= J0 && dy <= J1) amostras.push([g.X(dx), g.Y(dy)]);
    }

    curvaExp.atualizar();
    curvaLog.atualizar();
  }

  /** Tudo o que depende do ponto P (e, por arrasto, da base). */
  function refrescarPonto() {
    const a = est.a;
    const x = est.x;
    const y = yDe(x);
    q.mover(y, x, false);

    // rótulos P e Q: do lado em que a curva deixa espaço (a exponencial sobe se a > 1, desce se a < 1)
    const c = cresc();
    const pxP = g.X(x);
    const pyP = g.Y(y);
    const pxQ = g.X(y);
    const pyQ = g.Y(x);
    const dist = Math.hypot(pxP - pxQ, pyP - pyQ);
    const junto = dist < 22; // x = y: P e Q são o mesmo ponto, sobre a reta
    const seg = [];
    if (est.dobrar && !junto) for (let i = 1; i < 12; i++) seg.push([pxP + ((pxQ - pxP) * i) / 12, pyP + ((pyQ - pyP) * i) / 12]);
    const pontos = [em(pxP, pyP, 9), em(pxQ, pyQ, 9)];
    rotQ.style.display = junto ? 'none' : '';
    const rp = colocar(rotP, junto ? ['P = Q'] : ['P = (x, y)', 'P'], pxP, pyP, c ? ['cimaEsq', 'baixoDir', 'cimaDir', 'baixoEsq'] : ['cimaDir', 'baixoEsq', 'cimaEsq', 'baixoDir'], pontos, seg);
    if (!junto) colocar(rotQ, ['Q = (y, x)', 'Q'], pxQ, pyQ, c ? ['baixoDir', 'cimaEsq', 'baixoEsq', 'cimaDir'] : ['cimaDir', 'baixoEsq', 'cimaEsq', 'baixoDir'], [...pontos, rp], seg);

    // segmento PQ, ângulo reto e ponto médio
    const m = (x + y) / 2;
    const mx = g.X(m);
    const my = g.Y(m);
    const ligar = est.dobrar && !junto; // P e Q quase juntos: nada para ligar
    gExtra.style.display = ligar ? '' : 'none';
    if (ligar) {
      for (const [k, v] of Object.entries({ x1: pxP, y1: pyP, x2: pxQ, y2: pyQ })) segPQ.setAttribute(k, +v.toFixed(2));
      medio.setAttribute('cx', +mx.toFixed(2));
      medio.setAttribute('cy', +my.toFixed(2));
      const s = 7;
      const ux = Math.SQRT1_2; // direção da reta y = x no ecrã
      const uy = -Math.SQRT1_2;
      const vx = (pxP - mx) / (dist / 2); // de M para P, perpendicular à reta
      const vy = (pyP - my) / (dist / 2);
      angulo.setAttribute('d', `M${(mx + s * ux).toFixed(2)} ${(my + s * uy).toFixed(2)}L${(mx + s * ux + s * vx).toFixed(2)} ${(my + s * uy + s * vy).toFixed(2)}L${(mx + s * vx).toFixed(2)} ${(my + s * vy).toFixed(2)}`);
    }

    // leituras
    definirTexto(L.p, `(${num(x, 1)} ; ${num(y)})`);
    definirTexto(L.q, `(${num(y)} ; ${num(x, 1)})`);
    definirHtml(L.eq, tex(equivalenciaTex(a, x, y), true));

    const [lo, hi] = limitesX(a);
    ctl.el.setAttribute('aria-valuemin', String(lo));
    ctl.el.setAttribute('aria-valuemax', String(hi));
    g.definirAria(`Gráfico com a mesma escala nos dois eixos. A azul, a exponencial de base ${baseTxt(a)}, ${c ? 'crescente' : 'decrescente'}. `
      + `A vermelho, o logaritmo de base ${baseTxt(a)}, ${c ? 'crescente' : 'decrescente'}. `
      + `${est.dobrar ? 'A reta y = x, tracejada, é o eixo de simetria. ' : ''}`
      + `O ponto P = (${num(x, 1)} ; ${num(y)}) está na exponencial e o ponto Q = (${num(y)} ; ${num(x, 1)}) está no logaritmo.`);
    agendarVoz();
  }

  function refrescarDobra() {
    reta.el.style.display = est.dobrar ? '' : 'none';
    rotReta.style.display = est.dobrar ? '' : 'none';
    legReta.hidden = !est.dobrar;
    btnDobrar.setAttribute('aria-pressed', String(est.dobrar));
    refrescarPonto();
  }

  // ----- leitor de ecrã: um resumo curto, sem repetir a cada passo do arrasto -----
  function textoVoz() {
    const a = est.a;
    const x = est.x;
    const y = yDe(x);
    const aviso = est.avisoTxt ? `${est.avisoTxt} ` : '';
    return `${aviso}Base ${baseTxt(a)}. P tem coordenadas (${num(x, 1)} ; ${num(y)}); Q tem as mesmas coordenadas trocadas, (${num(y)} ; ${num(x, 1)}). `
      + `Lê-se: ${baseTxt(a)} elevado a ${num(x, 1)} é ${Math.abs(Number(y.toFixed(casasDe(y))) - y) < 1e-9 ? '' : 'aproximadamente '}${num(y)}, logo o logaritmo de ${num(y)} na base ${baseTxt(a)} é ${num(x, 1)}.`;
  }
  function agendarVoz() {
    if (!interagiu) return; // ao abrir a página não se anuncia nada
    clearTimeout(temporizador);
    temporizador = setTimeout(() => definirTexto(vivo, textoVoz()), 350);
  }

  // ----- entradas -----

  /** Chamado pelo gráfico a cada movimento de P: arredonda x a 0,1 e mantém P dentro da janela. */
  function aoMoverP(x) {
    interagiu = true;
    parar();
    const [lo, hi] = limitesX(est.a);
    const xr = limitar(arred1(x), lo, hi);
    if (Math.abs(xr - x) > 1e-9) ctl.mover(xr, false);
    est.x = xr;
    refrescarPonto();
  }

  function definirBase(a) {
    interagiu = true;
    parar();
    est.a = a;
    const [lo, hi] = limitesX(a);
    est.x = limitar(est.x, lo, hi);
    ctl.mover(est.x, false); // volta a pôr P na exponencial nova
    refrescarBase();
    refrescarPonto();
  }

  slider.addEventListener('input', () => {
    let v = Math.round(Number(slider.value) * 100) / 100;
    if (Math.abs(v - 1) < 1e-9) {
      // com a = 1 não há inversa: salta para o valor seguinte, no sentido em que ias
      v = est.a < 1 ? 1.05 : 0.95;
      est.avisoTxt = `Com a igual a 1 não há inversa: 1 elevado a x é sempre 1, uma função constante. Por isso a base saltou para ${num(v, 2)}.`;
      est.aviso = `Com ${tex('a=1')} não há inversa: ${tex('1^{x}=1')} para qualquer ${tex('x')}, uma função constante, que repete o mesmo valor (não é injetiva). `
        + `Por isso a base saltou para ${tex(`a=${numTex(v, 2)}`)}.`;
    } else if (Math.abs(v - 1) > 0.1) {
      est.aviso = est.avisoTxt = '';
    }
    definirBase(v);
  });

  btnDobrar.addEventListener('click', () => {
    interagiu = true;
    parar();
    est.dobrar = !est.dobrar;
    refrescarDobra();
  });

  // ----- a reflexão: P vai até Q como o papel a dobrar (visto de cima, anda ao longo de PQ) -----
  function parar() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    fantasma.setAttribute('display', 'none');
  }

  function refletir() {
    parar();
    if (reduzir && reduzir.matches) return;
    if (!est.dobrar) {
      est.dobrar = true;
      refrescarDobra();
    }
    const x = est.x;
    const y = yDe(x);
    const m = (x + y) / 2;
    const t0 = performance.now();
    fantasma.removeAttribute('display');
    const passo = () => {
      const t = Math.min(1, (performance.now() - t0) / DURACAO); // o mesmo relógio de t0
      const k = Math.cos(Math.PI * t); // 1 em P, 0 na reta, -1 em Q
      fantasma.setAttribute('cx', +g.X(m + (x - m) * k).toFixed(2));
      fantasma.setAttribute('cy', +g.Y(m + (y - m) * k).toFixed(2));
      fantasma.style.fill = t < 0.5 ? CORES.exp : CORES.log;
      if (t < 1) {
        raf = requestAnimationFrame(passo);
      } else {
        raf = 0;
        parar();
        definirTexto(vivo, 'P foi refletido na reta y = x e caiu em Q.');
      }
    };
    raf = requestAnimationFrame(passo);
  }
  btnRefletir.addEventListener('click', refletir);

  const verBotao = () => { btnRefletir.hidden = !!(reduzir && reduzir.matches); };
  if (reduzir && reduzir.addEventListener) reduzir.addEventListener('change', verBotao);
  verBotao();

  // ----- arranque -----
  refrescarBase();
  refrescarDobra();
  definirTexto(vivo, '');

  return {
    estado: () => ({ a: est.a, x: est.x, dobrar: est.dobrar }),
    definirBase,
    moverP: (x) => ctl.mover(x),
    dobrar: (sim) => { parar(); est.dobrar = sim; refrescarDobra(); },
    refletir,
    limitesX,
    janela: [J0, J1],
  };
}
