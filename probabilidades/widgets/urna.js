// urna: a urna (tirar bolas sem repor até sair vermelha) e o jogo do saco.
// A matemática exata está em assets/motor/probabilidade.js; aqui só há o desenho,
// a simulação para o aluno mexer e o texto.

import * as M from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/probabilidade.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const VERMELHAS = 3;
const AZUIS = 4;
const SACO = [
  { cor: 'vermelha', n: 5, premio: 2 },
  { cor: 'amarela', n: 2, premio: -5 },
  { cor: 'azul', n: 3, premio: 0 },
];

let contador = 0;

// ---------- lógica sem DOM (exportada para testes) ----------

/** Uma experiência da urna: { x, bolas: ['o', 'o', 'v'] }. */
export function experiencia(rng, vermelhas = VERMELHAS, outras = AZUIS) {
  return P.simularUrna(rng, vermelhas, outras);
}

/** Repete n experiências: devolve as contagens de X = 1 … outras + 1. */
export function repetir(rng, n, vermelhas = VERMELHAS, outras = AZUIS) {
  const cont = new Array(outras + 1).fill(0);
  for (let i = 0; i < n; i++) cont[experiencia(rng, vermelhas, outras).x - 1]++;
  return cont;
}

/** Tira uma bola do saco: devolve o elemento de `contagens` que saiu. */
export function tirarDoSaco(rng, contagens) {
  const total = contagens.reduce((s, c) => s + c.n, 0);
  let k = Math.floor(rng() * total);
  for (const c of contagens) {
    if (k < c.n) return c;
    k -= c.n;
  }
  return contagens[contagens.length - 1];
}

/** Joga n vezes: { total, media, n }. */
export function jogar(rng, contagens, n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += tirarDoSaco(rng, contagens).premio;
  return { total, media: total / n, n };
}

// ---------- ajudas ----------

const memoTex = new Map();
function texC(s) {
  let h = memoTex.get(s);
  if (h === undefined) {
    h = tex(s);
    memoTex.set(s, h);
  }
  return h;
}
const decTex = (x, casas = 2) => M.fmt(x, casas).replace('−', '-').replace(',', '{,}');
const euros = (x, casas = 0) => `${M.fmt(x, casas)} €`;
const premioTxt = (p) => (p > 0 ? `+${p} €` : p < 0 ? `−${-p} €` : '0 €');
const xTex = (x) => (x < 0 ? `(${x})` : String(x));
const ehInteiro = (f) => f.d === 1;

function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}
function definirTexto(el, txt) {
  if (el.textContent !== txt) el.textContent = txt;
}
const at = (el, atrs) => {
  for (const [k, v] of Object.entries(atrs)) el.setAttribute(k, String(v));
};

const NOME_COR = { v: 'vermelha', o: 'azul' };
const LETRA = { vermelha: 'V', azul: 'Az', amarela: 'Am' };

/** Bola desenhada: círculo com a inicial da cor (para não depender só da cor). */
function bola(cor, cx, cy, r = 15) {
  return criar('g', { class: `urn-bola urn-bola--${cor}` }, [
    criar('circle', { cx, cy, r }),
    criar('text', { class: 'urn-bola-t', x: cx, y: cy + 4, 'text-anchor': 'middle' }, [LETRA[cor]]),
  ]);
}

export async function montar(el, opcoes = {}) {
  const uid = `urn${++contador}`;
  const rng = opcoes.rng || M.criarRng();

  // ---------- estado ----------
  const tab = P.tabelaUrna(VERMELHAS, AZUIS);
  const mu = P.media(tab);
  const variancia = P.variancia(tab);
  const sigma = P.desvioPadrao(tab);
  const K = tab.length;

  const est = {
    sep: 'urna',
    atual: null, // experiência em curso { x, bolas }
    passo: 0, // bolas já reveladas
    cont: new Array(K).fill(0),
    n: 0,
    soma: 0,
    sel: null, // valor de X selecionado (1..K)
    premio: -3,
    resposta: null, // 'sim' | 'nao'
    jogo100: null, // { media, total }
    ultima: null, // última bola do jogo
  };

  const raiz = document.createElement('div');
  raiz.className = 'widget urn';
  raiz.innerHTML = `
    <div class="chips urn-separadores" role="group" aria-label="Escolhe a parte">
      <button type="button" class="chip" data-sep="urna" aria-pressed="true">Urna</button>
      <button type="button" class="chip" data-sep="jogo" aria-pressed="false">Jogo</button>
    </div>

    <div class="urn-painel" data-painel="urna">
      <div class="urn-grelha">
        <section class="urn-bloco" aria-labelledby="${uid}-h1">
          <h4 id="${uid}-h1" class="urn-titulo">Faz a experiência</h4>
          <div class="urn-lugar-urna"></div>
          <div class="urn-botoes">
            <button type="button" class="botao urn-tirar">Tirar uma bola</button>
            <button type="button" class="botao botao--suave urn-toda">Fazer a experiência toda</button>
          </div>
          <p class="urn-resultado aviso-ok" aria-live="polite">Ainda não tiraste nenhuma bola.</p>
        </section>

        <section class="urn-bloco" aria-labelledby="${uid}-h2">
          <h4 id="${uid}-h2" class="urn-titulo">Repete e vê o histograma</h4>
          <div class="chips urn-repetir" role="group" aria-label="Repetir a experiência">
            <button type="button" class="chip" data-rep="1">×1</button>
            <button type="button" class="chip" data-rep="100">×100</button>
            <button type="button" class="chip" data-rep="1000">×1000</button>
            <button type="button" class="chip urn-limpar">Limpar</button>
          </div>
          <div class="urn-lugar-hist"></div>
          <p class="nota urn-legenda">Barras: frequência relativa das experiências feitas. Traços: probabilidade teórica. Toca numa barra para a ver na tabela.</p>
          <p class="nota urn-sel" aria-live="polite"></p>
        </section>
      </div>

      <section class="urn-bloco urn-bloco--largo" aria-labelledby="${uid}-h3">
        <h4 id="${uid}-h3" class="urn-titulo">A tabela, passo a passo</h4>
        <p class="nota urn-nota-tab">Para cada valor, multiplicas as probabilidades ao longo do caminho. Toca num valor para o ver no histograma.</p>
        <div class="urn-tabela-lugar tabela-rolante"></div>
        <p class="urn-soma"></p>
      </section>

      <section class="urn-bloco urn-bloco--largo" aria-labelledby="${uid}-h4">
        <h4 id="${uid}-h4" class="urn-titulo">Ligação ao valor médio</h4>
        <div class="leituras urn-leituras" aria-live="polite">
          <div class="leitura"><span class="leitura__rotulo">Experiências feitas</span><span class="leitura__valor" data-l="n"></span></div>
          <div class="leitura"><span class="leitura__rotulo">Média das experiências</span><span class="leitura__valor" data-l="media"></span></div>
          <div class="leitura"><span class="leitura__rotulo">Valor médio teórico</span><span class="leitura__valor" data-l="mu"></span></div>
          <div class="leitura"><span class="leitura__rotulo">Variância e desvio-padrão</span><span class="leitura__valor" data-l="sigma"></span></div>
        </div>
        <p class="urn-frase">Quanto mais repetes, mais a média se aproxima de $\\mu$.</p>
      </section>
    </div>

    <div class="urn-painel" data-painel="jogo" hidden>
      <div class="urn-grelha">
        <section class="urn-bloco" aria-labelledby="${uid}-j1">
          <h4 id="${uid}-j1" class="urn-titulo">O saco</h4>
          <p class="urn-enunc">Um saco tem 10 bolas. Tiras <strong>uma</strong> bola e recebes (ou pagas) o prémio da sua cor.</p>
          <div class="urn-lugar-saco"></div>
          <div class="controlo urn-controlo-premio">
            <div class="urn-linha"><label for="${uid}-p">Prémio da bola amarela</label><output for="${uid}-p" class="urn-sp"></output></div>
            <input id="${uid}-p" class="urn-premio" type="range" min="-10" max="0" step="1" value="${est.premio}">
          </div>
          <div class="urn-botoes">
            <button type="button" class="botao urn-uma">Jogar uma vez</button>
            <button type="button" class="botao botao--suave urn-cem">Jogar 100 vezes</button>
          </div>
          <p class="urn-resultado-jogo aviso-ok" aria-live="polite">Ainda não jogaste.</p>
        </section>

        <section class="urn-bloco" aria-labelledby="${uid}-j2">
          <h4 id="${uid}-j2" class="urn-titulo">Ganho $X$ e valor médio</h4>
          <div class="urn-tabela-jogo tabela-rolante"></div>
          <div class="leituras urn-leituras-jogo" aria-live="polite">
            <div class="leitura urn-larga"><span class="leitura__rotulo">Valor médio (ganho médio por jogada)</span><span class="leitura__valor urn-formula" data-j="mu"></span></div>
            <div class="leitura"><span class="leitura__rotulo">Média das 100 jogadas</span><span class="leitura__valor" data-j="media"></span></div>
            <div class="leitura"><span class="leitura__rotulo">Valor médio teórico</span><span class="leitura__valor" data-j="teorico"></span></div>
          </div>
        </section>
      </div>

      <section class="urn-bloco urn-bloco--largo" aria-labelledby="${uid}-j3">
        <h4 id="${uid}-j3" class="urn-titulo">O jogo é equitativo?</h4>
        <p class="nota urn-nota-eq">Um jogo é equitativo quando o valor médio é 0: em média, nem ganhas nem perdes em cada jogada.</p>
        <div class="chips urn-resp" role="group" aria-label="A tua resposta">
          <button type="button" class="chip" data-r="sim" aria-pressed="false">Sim</button>
          <button type="button" class="chip" data-r="nao" aria-pressed="false">Não</button>
        </div>
        <p class="urn-feedback" aria-live="polite"></p>
      </section>
    </div>
  `;
  el.innerHTML = '';
  el.append(raiz);

  const $ = (s) => raiz.querySelector(s);
  const L = {};
  raiz.querySelectorAll('[data-l]').forEach((n) => (L[n.dataset.l] = n));
  const J = {};
  raiz.querySelectorAll('[data-j]').forEach((n) => (J[n.dataset.j] = n));

  // ---------- SVG da urna ----------

  const CORES_URNA = ['o', 'v', 'o', 'o', 'v', 'o', 'v']; // cor de cada lugar na taça
  const POS = [
    [103, 66], [141, 66], [179, 66], [217, 66],
    [122, 100], [160, 100], [198, 100],
  ];
  const svgUrna = criar('svg', { class: 'figura figura--fixa urn-svg', viewBox: '0 0 320 230', role: 'img', 'aria-label': '' });
  svgUrna.append(
    criar('path', { class: 'urn-taca', d: 'M48 40 H272 A112 92 0 0 1 48 40 Z' }),
    criar('line', { class: 'urn-borda', x1: 44, y1: 40, x2: 276, y2: 40 }),
    criar('text', { class: 'urn-rotulo', x: 160, y: 164, 'text-anchor': 'middle' }, ['Bolas tiradas, por ordem'])
  );
  const gTaca = criar('g');
  const gFila = criar('g');
  const SLOTS = AZUIS + 1;
  const slotX = (i) => 160 + (i - (SLOTS - 1) / 2) * 54;
  for (let i = 0; i < SLOTS; i++) {
    gFila.append(criar('circle', { class: 'urn-slot', cx: slotX(i), cy: 196, r: 17 }));
  }
  const gTiradas = criar('g');
  svgUrna.append(gTaca, gFila, gTiradas);
  $('.urn-lugar-urna').append(svgUrna);

  function pintarUrna() {
    const tiradas = est.atual ? est.atual.bolas.slice(0, est.passo) : [];
    // bolas ainda na taça: tira, de cada cor, as primeiras que saíram
    const restam = CORES_URNA.map(() => true);
    for (const t of tiradas) {
      const i = CORES_URNA.findIndex((c, k) => restam[k] && c === t);
      if (i >= 0) restam[i] = false;
    }
    gTaca.replaceChildren();
    restam.forEach((r, i) => {
      if (r) gTaca.append(bola(CORES_URNA[i] === 'v' ? 'vermelha' : 'azul', POS[i][0], POS[i][1]));
    });
    gTiradas.replaceChildren();
    tiradas.forEach((t, i) => gTiradas.append(bola(t === 'v' ? 'vermelha' : 'azul', slotX(i), 196, 15)));
    const nVerm = restam.filter((r, i) => r && CORES_URNA[i] === 'v').length;
    const nAz = restam.filter((r, i) => r && CORES_URNA[i] === 'o').length;
    const lista = tiradas.length ? tiradas.map((t) => NOME_COR[t]).join(', ') : 'nenhuma';
    at(svgUrna, {
      'aria-label': `Urna com ${nVerm} bolas vermelhas e ${nAz} azuis. Bolas tiradas: ${lista}.`,
    });
  }

  // ---------- histograma ----------

  const W = 320, H = 190, X0 = 38, X1 = 312, Y0 = 16, Y1 = 150;
  const slotW = (X1 - X0) / K;
  const cx = (k) => X0 + slotW * (k - 0.5);
  const svgH = criar('svg', { class: 'figura figura--fixa urn-svg urn-hist', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '' });
  const gGrelha = criar('g');
  const gBandas = criar('g');
  const gBarras = criar('g');
  const gTeor = criar('g');
  svgH.append(gBandas, gGrelha, gBarras, gTeor);
  const bandas = [], barras = [], tracos = [], pontos = [];
  for (let k = 1; k <= K; k++) {
    const banda = criar('rect', { class: 'urn-banda', x: X0 + slotW * (k - 1), y: Y0 - 6, width: slotW, height: Y1 - Y0 + 6 });
    banda.addEventListener('click', () => selecionar(est.sel === k ? null : k));
    bandas.push(banda);
    gBandas.append(banda);
    const barra = criar('rect', { class: 'urn-barra', x: cx(k) - 17, width: 34, y: Y1, height: 0 });
    barras.push(barra);
    gBarras.append(barra);
    const pt = P.valor(tab[k - 1].p);
    const traco = criar('line', { class: 'urn-traco' });
    const ponto = criar('circle', { class: 'urn-ponto', r: 4 });
    tracos.push(traco);
    pontos.push(ponto);
    gTeor.append(traco, ponto);
    void pt;
  }
  // rótulos do eixo X
  for (let k = 1; k <= K; k++) {
    svgH.append(criar('text', { class: 'urn-eixo-t', x: cx(k), y: Y1 + 17, 'text-anchor': 'middle' }, [String(k)]));
  }
  svgH.append(
    criar('text', { class: 'urn-eixo-t', x: (X0 + X1) / 2, y: H - 4, 'text-anchor': 'middle' }, ['X, número de bolas tiradas']),
    criar('line', { class: 'urn-eixo', x1: X0, y1: Y1, x2: X1, y2: Y1 })
  );
  $('.urn-lugar-hist').append(svgH);

  function pintarHist() {
    const freq = est.cont.map((c) => (est.n ? c / est.n : 0));
    const maxTeor = Math.max(...tab.map((l) => P.valor(l.p)));
    const m = Math.max(maxTeor, ...freq);
    const ymax = Math.max(0.1, Math.ceil(m * 10 - 1e-9) / 10);
    const passo = ymax > 0.5 ? 0.2 : 0.1;
    const y = (v) => Y1 - (v / ymax) * (Y1 - Y0);

    gGrelha.replaceChildren();
    for (let v = 0; v <= ymax + 1e-9; v += passo) {
      gGrelha.append(
        criar('line', { class: 'urn-grade', x1: X0, y1: y(v), x2: X1, y2: y(v) }),
        criar('text', { class: 'urn-eixo-t', x: X0 - 5, y: y(v) + 4, 'text-anchor': 'end' }, [M.fmt(v, 1)])
      );
    }
    for (let k = 1; k <= K; k++) {
      const f = freq[k - 1];
      at(barras[k - 1], { y: y(f), height: Math.max(0, Y1 - y(f)) });
      const pt = P.valor(tab[k - 1].p);
      at(tracos[k - 1], { x1: cx(k) - 22, x2: cx(k) + 22, y1: y(pt), y2: y(pt) });
      at(pontos[k - 1], { cx: cx(k), cy: y(pt) });
      bandas[k - 1].classList.toggle('urn-banda--sel', est.sel === k);
    }
    const partes = tab.map((l, i) => `X = ${l.x}: observada ${M.fmt(freq[i], 2)}, teórica ${M.fmt(P.valor(l.p), 2)}`);
    at(svgH, {
      'aria-label': est.n
        ? `Histograma de ${est.n} experiências. ${partes.join('; ')}.`
        : `Histograma vazio, ainda sem experiências. Probabilidades teóricas: ${tab.map((l) => `X = ${l.x}: ${M.fmt(P.valor(l.p), 2)}`).join('; ')}.`,
    });
  }

  // ---------- tabela teórica ----------

  const tabelaEl = document.createElement('table');
  tabelaEl.className = 'tabela urn-tabela';
  tabelaEl.innerHTML = `<caption class="sr-only">Distribuição de X com o cálculo de cada probabilidade</caption>
    <thead><tr><th scope="col">Valor</th><th scope="col">Caminho</th><th scope="col">$P(X=x_i)$</th></tr></thead><tbody></tbody>`;
  const corpo = tabelaEl.querySelector('tbody');
  const linhasEl = [];
  const botoesLinha = [];
  tab.forEach((l, i) => {
    const k = l.x;
    const fatores = P.fatoresUrna(VERMELHAS, AZUIS, k);
    const produto = fatores.map(P.fracTexF).join('\\times ');
    const tr = document.createElement('tr');
    tr.className = 'urn-fila';
    tr.innerHTML = `<th scope="row"><button type="button" class="urn-btn-linha" aria-pressed="false" aria-label="Ver X igual a ${k} no histograma">$x_i=${k}$</button></th>
      <td class="urn-caminho"></td><td class="urn-res"></td>`;
    // KaTeX direto, sem passar pelo auto-render
    tr.querySelector('button').innerHTML = texC(`X=${k}`);
    tr.querySelector('.urn-caminho').innerHTML = texC(`P(X=${k})=${produto}`);
    tr.querySelector('.urn-res').innerHTML = texC(P.fracTexF(l.p));
    tr.querySelector('button').addEventListener('click', () => selecionar(est.sel === k ? null : k));
    corpo.append(tr);
    linhasEl.push(tr);
    botoesLinha.push(tr.querySelector('button'));
    void i;
  });
  // o cabeçalho também em KaTeX
  tabelaEl.querySelector('thead tr').children[2].innerHTML = texC('P(X=x_i)');
  $('.urn-tabela-lugar').append(tabelaEl);
  definirHtml(
    $('.urn-soma'),
    texC(`${tab.map((l) => P.fracTexF(l.p)).join('+')}=${P.fracTexF(P.somaP(tab))}`) + ' <span class="urn-soma-t">A soma dá 1.</span>'
  );

  function selecionar(k) {
    est.sel = k;
    pintarSel();
  }

  function pintarSel() {
    linhasEl.forEach((tr, i) => {
      const sel = est.sel === i + 1;
      tr.classList.toggle('urn-fila--sel', sel);
      botoesLinha[i].setAttribute('aria-pressed', String(sel));
    });
    bandas.forEach((b, i) => b.classList.toggle('urn-banda--sel', est.sel === i + 1));
    const k = est.sel;
    if (!k) {
      definirTexto($('.urn-sel'), '');
      return;
    }
    const pt = tab[k - 1].p;
    const teor = M.fmt(P.valor(pt) * 100, 1);
    const obs = est.n ? `Observaste ${est.cont[k - 1]} em ${est.n} (${M.fmt((est.cont[k - 1] / est.n) * 100, 1)} %). ` : 'Ainda não fizeste experiências. ';
    definirTexto($('.urn-sel'), `X = ${k}: ${obs}Teoria: ${pt.d === 1 ? pt.n : `${pt.n}/${pt.d}`}, cerca de ${teor} %.`);
  }

  // ---------- leituras e experiência ----------

  function pintarLeituras() {
    definirTexto(L.n, String(est.n));
    definirTexto(L.media, est.n ? M.fmt(est.soma / est.n, 2) : 'sem dados');
    definirHtml(L.mu, texC(`\\mu=${P.fracTexF(mu)}`));
    definirHtml(L.sigma, texC(`\\sigma^2=${P.fracTexF(variancia)},\\ \\sigma\\approx ${decTex(sigma, 2)}`));
  }

  function mensagem() {
    const a = est.atual;
    if (!a || est.passo === 0) return 'Ainda não tiraste nenhuma bola.';
    const nomes = a.bolas.slice(0, est.passo).map((b) => `Saiu ${NOME_COR[b]}.`).join(' ');
    return est.passo === a.bolas.length ? `${nomes} Parou aqui: X = ${a.x}.` : nomes;
  }

  const fim = () => est.atual && est.passo === est.atual.bolas.length;

  function registar() {
    est.cont[est.atual.x - 1]++;
    est.n++;
    est.soma += est.atual.x;
  }

  const botaoTirar = $('.urn-tirar');
  const botaoToda = $('.urn-toda');

  function pintarTudoUrna() {
    pintarUrna();
    definirTexto(botaoTirar, fim() ? 'Nova experiência' : 'Tirar uma bola');
    definirTexto($('.urn-resultado'), mensagem());
    pintarHist();
    pintarLeituras();
    pintarSel();
  }

  botaoTirar.addEventListener('click', () => {
    if (fim()) {
      est.atual = null;
      est.passo = 0;
    } else {
      if (!est.atual) {
        est.atual = experiencia(rng);
        est.passo = 0;
      }
      est.passo++;
      if (fim()) registar();
    }
    pintarTudoUrna();
  });

  botaoToda.addEventListener('click', () => {
    const jaFeita = fim();
    if (!est.atual || jaFeita) {
      est.atual = experiencia(rng);
      est.passo = 0;
    }
    est.passo = est.atual.bolas.length;
    registar();
    pintarTudoUrna();
  });

  raiz.querySelectorAll('[data-rep]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.rep);
      const c = repetir(rng, n);
      c.forEach((v, i) => {
        est.cont[i] += v;
        est.soma += v * (i + 1);
      });
      est.n += n;
      pintarHist();
      pintarLeituras();
      pintarSel();
      definirTexto($('.urn-resultado'), `Fizeste mais ${n} ${n === 1 ? 'experiência' : 'experiências'}. Já são ${est.n}.`);
    })
  );

  $('.urn-limpar').addEventListener('click', () => {
    est.cont.fill(0);
    est.n = 0;
    est.soma = 0;
    est.atual = null;
    est.passo = 0;
    pintarTudoUrna();
  });

  // ---------- jogo ----------

  const contagens = () => SACO.map((c) => (c.cor === 'amarela' ? { ...c, premio: est.premio } : c));

  const svgSaco = criar('svg', { class: 'figura figura--fixa urn-svg urn-saco', viewBox: '0 0 320 140', role: 'img', 'aria-label': '' });
  const gBolasSaco = criar('g');
  svgSaco.append(criar('rect', { class: 'urn-taca', x: 22, y: 12, width: 276, height: 116, rx: 30 }), gBolasSaco);
  $('.urn-lugar-saco').append(svgSaco);
  const ordemSaco = [];
  SACO.forEach((c) => {
    for (let i = 0; i < c.n; i++) ordemSaco.push(c.cor);
  });

  function pintarSaco() {
    gBolasSaco.replaceChildren();
    ordemSaco.forEach((cor, i) => {
      const x = 62 + (i % 5) * 49;
      const y = 44 + Math.floor(i / 5) * 48;
      const g = bola(cor, x, y, 16);
      if (est.ultima === cor && i === ordemSaco.indexOf(cor)) g.classList.add('urn-bola--ultima');
      gBolasSaco.append(g);
    });
    const c = contagens();
    at(svgSaco, {
      'aria-label': `Saco com 10 bolas: ${c.map((x) => `${x.n} ${x.cor}${x.n > 1 ? 's' : ''} (${premioTxt(x.premio)})`).join(', ')}.`,
    });
  }

  function pintarJogo() {
    const c = contagens();
    const t = P.tabelaJogo(c);
    const m = P.media(t);
    const mv = P.valor(m);

    // tabela horizontal
    const tb = document.createElement('table');
    tb.className = 'tabela urn-tab-jogo';
    tb.innerHTML = `<caption class="sr-only">Distribuição do ganho X</caption>
      <tbody><tr><th scope="row">Ganho $x_i$ (€)</th></tr><tr><th scope="row">$P(X=x_i)$</th></tr></tbody>`;
    const [r1, r2] = tb.querySelectorAll('tr');
    r1.firstElementChild.innerHTML = `${texC('x_i')} (€)`;
    r2.firstElementChild.innerHTML = texC('P(X=x_i)');
    t.forEach((l) => {
      const a = document.createElement('td');
      a.textContent = M.fmt(l.x, 0);
      const b = document.createElement('td');
      b.innerHTML = texC(P.fracTexF(l.p));
      r1.append(a);
      r2.append(b);
    });
    const lugar = $('.urn-tabela-jogo');
    lugar.replaceChildren(tb);

    // valor médio
    const termos = t.map((l) => `${xTex(l.x)}\\times ${P.fracTexF(l.p)}`).join('+');
    const dec = ehInteiro(m) ? '' : `\\approx ${decTex(mv, 2)}`;
    definirHtml(J.mu, texC(`\\mu=${termos}=${P.fracTexF(m)}${dec}`) + ` <span class="urn-un">€ por jogada</span>`);
    definirHtml(J.teorico, texC(`\\mu=${decTex(mv, 2)}`) + ' €');

    // 100 jogadas
    if (est.jogo100) {
      definirTexto(J.media, euros(est.jogo100.media, 2));
    } else {
      definirTexto(J.media, 'ainda sem jogadas');
    }

    // slider
    const sl = $('.urn-premio');
    sl.value = String(est.premio);
    definirTexto($('.urn-sp'), premioTxt(est.premio));
    at(sl, { 'aria-valuetext': `prémio da bola amarela: ${premioTxt(est.premio)}` });

    pintarSaco();
    pintarFeedback(mv);
  }

  function pintarFeedback(mv) {
    raiz.querySelectorAll('[data-r]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === est.resposta)));
    const fb = $('.urn-feedback');
    const eq = Math.abs(mv) < 1e-9;
    fb.className = 'urn-feedback';
    if (!est.resposta) {
      definirTexto(fb, eq ? '' : 'Responde e depois mexe no prémio da bola amarela para veres o que acontece a μ.');
      return;
    }
    const disseSim = est.resposta === 'sim';
    const certo = disseSim === eq;
    fb.classList.add(certo ? 'aviso-ok' : 'aviso-erro');
    if (eq) {
      definirTexto(
        fb,
        disseSim
          ? 'Certo. Com este prémio, μ = 0 €, por isso o jogo é equitativo.'
          : 'Não é bem assim. Com este prémio, μ = 0 €, por isso o jogo é equitativo.'
      );
    } else {
      const sinal = mv > 0 ? 'ganhas' : 'perdes';
      definirTexto(
        fb,
        disseSim
          ? `Não é bem assim. Com este prémio, μ = ${euros(mv, 2)}, diferente de 0: em média ${sinal} ${euros(Math.abs(mv), 2)} por jogada. Procura um prémio que dê μ = 0.`
          : `Certo. Com este prémio, μ = ${euros(mv, 2)}, diferente de 0: em média ${sinal} ${euros(Math.abs(mv), 2)} por jogada. Procura um prémio que dê μ = 0.`
      );
    }
  }

  $('.urn-premio').addEventListener('input', (e) => {
    est.premio = Number(e.target.value);
    est.jogo100 = null;
    est.ultima = null;
    definirTexto($('.urn-resultado-jogo'), 'Mudaste o prémio. Joga outra vez para veres a média.');
    pintarJogo();
  });

  $('.urn-uma').addEventListener('click', () => {
    const c = contagens();
    const saiu = tirarDoSaco(rng, c);
    est.ultima = saiu.cor;
    definirTexto($('.urn-resultado-jogo'), `Saiu ${saiu.cor}: ganho de ${premioTxt(saiu.premio)}.`);
    pintarSaco();
  });

  $('.urn-cem').addEventListener('click', () => {
    const r = jogar(rng, contagens(), 100);
    est.jogo100 = r;
    est.ultima = null;
    definirTexto(
      $('.urn-resultado-jogo'),
      `Em 100 jogadas, o ganho total foi ${euros(r.total)} e o ganho médio ${euros(r.media, 2)}.`
    );
    pintarJogo();
  });

  raiz.querySelectorAll('[data-r]').forEach((b) =>
    b.addEventListener('click', () => {
      est.resposta = b.dataset.r;
      pintarJogo();
    })
  );

  // ---------- separadores ----------

  raiz.querySelectorAll('[data-sep]').forEach((b) =>
    b.addEventListener('click', () => {
      est.sep = b.dataset.sep;
      raiz.querySelectorAll('[data-sep]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.sep === est.sep)));
      raiz.querySelectorAll('[data-painel]').forEach((p) => {
        p.hidden = p.dataset.painel !== est.sep;
      });
    })
  );

  // KaTeX do texto estático ($\mu$, $X$) já com o motor
  raiz.querySelectorAll('.urn-frase, .urn-titulo').forEach((n) => {
    n.innerHTML = n.innerHTML.replace(/\$([^$]+)\$/g, (_, t) => texC(t.replace(/&amp;/g, '&')));
  });
  const thP = tabelaEl.querySelector('thead tr').children[2];
  void thP;

  pintarTudoUrna();
  pintarJogo();
}
