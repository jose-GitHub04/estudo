// ex-urna: exercício 3, a caixa com 2 bolas vermelhas e 3 brancas, tirar até sair vermelha.
// A matemática exata vem de assets/motor/probabilidade.js; aqui há o desenho, a correção
// das respostas e os passos da resolução.

import * as M from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/probabilidade.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const VERM = 2;
const BRAN = 3;
const TOTAL = VERM + BRAN;
const K = BRAN + 1; // X = 1 … 4

const T = (s) => tex(s);
const D = (s) => tex(s, true);
const ft = (f) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`); // fração em texto simples
const fx = (n, d) => `\\frac{${n}}{${d}}`; // fração sem reduzir, em LaTeX
const fp = (f) => P.fracTexF(f);

let contador = 0;

// ---------- lógica sem DOM (exportada para testes) ----------

/** Fatores sem reduzir do ramo X = k: [[3,5],[2,4],[1,3],[2,2]] … o último é a vermelha. */
export function fatoresBrutos(k) {
  const r = [];
  for (let i = 0; i < k - 1; i++) r.push([BRAN - i, TOTAL - i]);
  r.push([VERM, TOTAL - (k - 1)]);
  return r;
}

/** Tabela de X e as três grandezas do exercício, tudo em frações exatas. */
export function dados() {
  const tab = P.tabelaUrna(VERM, BRAN);
  const mu = P.media(tab);
  const sigma2 = P.variancia(tab);
  const pX3 = tab[2].p;
  const pGe2 = P.sub(P.UM, tab[0].p);
  const cond = P.F(pX3.n * pGe2.d, pX3.d * pGe2.n);
  return { tab, mu, sigma2, sigma: Math.sqrt(P.valor(sigma2)), pX3, pGe2, cond };
}

// ---------- ajudas de DOM ----------

const at = (el, a) => {
  for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
};

export async function montar(el) {
  const uid = `exu${++contador}`;
  const rng = M.criarRng();
  const d = dados();
  const { tab } = d;

  const est = {
    rev: 0, // níveis da árvore já desenhados (0 … 4)
    exp: null, // experiência em curso { x, bolas }
    passo: 0, // bolas já tiradas na experiência em curso
    sel: null, // X selecionado (1 … 4)
    modo: 'todos', // 'todos' | 'ge2'
    mostrarMu: false,
    parcelas: false,
    resolucao: false,
    nPassos: 0,
  };

  const raiz = document.createElement('div');
  raiz.className = 'widget exu';
  raiz.innerHTML = `
    <div class="exu-enunciado">
      <p>Uma caixa tem 5 bolas indistinguíveis ao tato: 2 vermelhas e 3 brancas. Tiras bolas da caixa, uma de cada vez e sem reposição, até sair uma bola vermelha. Seja ${T('X')} o número de bolas que tiraste.</p>
      <ol class="exu-alineas">
        <li><span class="exu-num">3.1.</span> Constrói a tabela de distribuição de probabilidade de ${T('X')}. Apresenta as probabilidades na forma de fração irredutível.</li>
        <li><span class="exu-num">3.2.</span> Sabendo que foram tiradas pelo menos duas bolas, determina a probabilidade de terem sido tiradas exatamente três bolas.</li>
        <li><span class="exu-num">3.3.</span> Determina o valor médio e o desvio-padrão de ${T('X')}.</li>
      </ol>
    </div>

    <section class="exu-bloco" aria-labelledby="${uid}-a1">
      <h4 id="${uid}-a1" class="exu-titulo">3.1. A árvore e a tabela</h4>
      <p class="nota exu-nota">Tira bolas e vê a árvore crescer. Em cada ramo está a probabilidade desse passo, já com as bolas que sobram. Toca num ramo para o ver na tabela.</p>
      <div class="exu-lugar-arvore"></div>
      <div class="exu-botoes">
        <button type="button" class="botao exu-tirar">Tirar uma bola</button>
        <button type="button" class="botao botao--suave exu-toda">Mostrar a árvore toda</button>
        <button type="button" class="botao botao--suave exu-recomecar">Recomeçar</button>
      </div>
      <p class="exu-estado aviso-ok" aria-live="polite">Ainda não tiraste nenhuma bola. A caixa tem 2 vermelhas (V) e 3 brancas (B).</p>
      <div class="exu-tab-lugar tabela-rolante"></div>
      <p class="exu-soma" aria-live="polite"></p>
      <div class="exu-resposta" data-al="1"></div>
    </section>

    <section class="exu-bloco" aria-labelledby="${uid}-a2">
      <h4 id="${uid}-a2" class="exu-titulo">3.2. Parte de um todo mais pequeno</h4>
      <div class="exu-trava" data-al="2">
        <p class="nota">Tenta primeiro no caderno e escreve a tua resposta mais abaixo. O desenho abre depois de carregares em «Verificar», ou aqui se já tentaste.</p>
        <button type="button" class="botao botao--suave exu-abrir" data-al="2">Já tentei, abrir o desenho</button>
      </div>
      <div class="exu-conteudo" data-al="2" hidden>
      <div class="chips exu-modos" role="group" aria-label="Escolhe o todo">
        <button type="button" class="chip" data-modo="todos" aria-pressed="true">Todos os casos</button>
        <button type="button" class="chip" data-modo="ge2" aria-pressed="false">Só ${T('X \\geq 2')}</button>
      </div>
      <div class="exu-lugar-cond"></div>
      <p class="exu-leitura" aria-live="polite"></p>
      <p class="exu-frase">Aqui o todo já não é a caixa inteira: é só o que sobra depois de saberes que ${T('X \\geq 2')}.</p>
      <p class="nota exu-nota">Não confundas ${T('P(A \\cap B)')} com ${T('P(A \\mid B)')}. Em ${T('P(A \\cap B)')} o todo é tudo (vale 1). Em ${T('P(A \\mid B)')} o todo é só ${T('B')}.</p>
      </div>
      <div class="exu-resposta" data-al="2"></div>
    </section>

    <section class="exu-bloco" aria-labelledby="${uid}-a3">
      <h4 id="${uid}-a3" class="exu-titulo">3.3. Valor médio e desvio-padrão</h4>
      <div class="exu-trava" data-al="3">
        <p class="nota">Tenta primeiro no caderno e escreve a tua resposta mais abaixo. O desenho abre depois de carregares em «Verificar», ou aqui se já tentaste.</p>
        <button type="button" class="botao botao--suave exu-abrir" data-al="3">Já tentei, abrir o desenho</button>
      </div>
      <div class="exu-conteudo" data-al="3" hidden>
      <div class="chips exu-modos" role="group" aria-label="O que mostrar">
        <button type="button" class="chip exu-t-mu" aria-pressed="false">Mostrar ${T('\\mu')} no eixo</button>
        <button type="button" class="chip exu-t-parc" aria-pressed="false">Mostrar as parcelas</button>
      </div>
      <div class="exu-lugar-mu"></div>
      <div class="exu-tabela-mu tabela-rolante"></div>
      <p class="exu-leitura-mu" aria-live="polite"></p>
      </div>
      <div class="exu-resposta" data-al="3"></div>
    </section>

    <section class="exu-bloco exu-res" aria-labelledby="${uid}-r">
      <h4 id="${uid}-r" class="exu-titulo">Resolução</h4>
      <div class="exu-botoes">
        <button type="button" class="botao exu-ver" aria-expanded="false" aria-controls="${uid}-passos">Ver a resolução</button>
        <button type="button" class="botao botao--suave exu-prox" hidden>Próximo passo</button>
      </div>
      <div class="exu-passos" id="${uid}-passos" aria-live="polite"></div>
    </section>
  `;
  el.innerHTML = '';
  el.append(raiz);
  const $ = (s) => raiz.querySelector(s);

  // ---------- árvore ----------

  const YS = [28, 90, 152, 214];
  const XS = 24; // coluna dos nós «brancas»
  const XF = 140; // coluna das folhas
  const svgA = criar('svg', { class: 'figura figura--fixa exu-svg', viewBox: '0 0 360 244', role: 'img', 'aria-label': '' });
  const gRaiz = criar('g');
  svgA.append(gRaiz);

  const spine = []; // ligações brancas i -> i+1
  const folhas = []; // ramos vermelhos
  const fr = (k) => fatoresBrutos(k);
  for (let i = 0; i < K; i++) {
    const y = YS[i];
    const fat = fr(i + 1);
    const [vn, vd] = fat[fat.length - 1];
    // ramo vermelho (folha)
    const prod = fat.map(([n, dd]) => `${n}/${dd}`).join(' × ');
    const pk = ft(tab[i].p);
    const g = criar('g', { class: 'exu-folha', role: 'button', tabindex: 0, 'aria-pressed': 'false' });
    const linhaV = criar('line', { class: 'exu-aresta exu-aresta--v', x1: XS, y1: y, x2: XF - 15, y2: y });
    g.append(
      criar('rect', { class: 'exu-fundo', x: 44, y: y - 28, width: 312, height: 56, rx: 6 }),
      linhaV,
      criar('text', { class: 'exu-fr', x: (XS + XF - 15) / 2 + 6, y: y - 7, 'text-anchor': 'middle' }, [`${vn}/${vd}`]),
      criar('circle', { class: 'exu-no exu-no--v', cx: XF, cy: y, r: 14 }),
      criar('text', { class: 'exu-letra exu-letra--v', x: XF, y: y + 4, 'text-anchor': 'middle' }, ['V']),
      criar('text', { class: 'exu-x', x: XF + 22, y: y - 3 }, [`X = ${i + 1}`]),
      criar('text', { class: 'exu-prod', x: XF + 22, y: y + 14 }, [i === 0 ? pk : `${prod} = ${pk}`])
    );
    gRaiz.append(g);
    g.addEventListener('click', () => selecionar(i + 1));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selecionar(i + 1);
      }
    });
    folhas.push({ g, linhaV });
  }
  for (let i = 0; i < K - 1; i++) {
    const [bn, bd] = [BRAN - i, TOTAL - i];
    const linha = criar('line', { class: 'exu-aresta exu-aresta--b', x1: XS, y1: YS[i], x2: XS, y2: YS[i + 1] - 11 });
    const g = criar('g', {}, [
      linha,
      criar('text', { class: 'exu-fr', x: XS + 9, y: (YS[i] + YS[i + 1]) / 2 + 4 }, [`${bn}/${bd}`]),
      criar('circle', { class: 'exu-no exu-no--b', cx: XS, cy: YS[i + 1], r: 11 }),
      criar('text', { class: 'exu-letra', x: XS, y: YS[i + 1] + 4, 'text-anchor': 'middle' }, ['B']),
    ]);
    gRaiz.insertBefore(g, gRaiz.firstChild);
    spine.push({ g, linha });
  }
  gRaiz.insertBefore(criar('circle', { class: 'exu-no exu-no--raiz', cx: XS, cy: YS[0], r: 5 }), gRaiz.firstChild);
  $('.exu-lugar-arvore').append(svgA);

  // ---------- tabela de X ----------

  const tabLugar = $('.exu-tab-lugar');
  tabLugar.innerHTML = `
    <table class="tabela exu-tab">
      <caption class="sr-only">Tabela de distribuição de probabilidade de X</caption>
      <thead><tr><th scope="row">${T('x_i')}</th>${tab
        .map((l, i) => `<td><button type="button" class="exu-btn-x" data-k="${i + 1}" aria-pressed="false" aria-label="Valor X igual a ${l.x}">${l.x}</button></td>`)
        .join('')}</tr></thead>
      <tbody><tr><th scope="row">${T('P(X = x_i)')}</th>${tab.map(() => '<td class="exu-p">?</td>').join('')}</tr></tbody>
    </table>`;
  const btnsX = [...tabLugar.querySelectorAll('.exu-btn-x')];
  const celP = [...tabLugar.querySelectorAll('.exu-p')];
  btnsX.forEach((b) => b.addEventListener('click', () => selecionar(+b.dataset.k)));

  // ---------- 3.2: barras e faixa ----------

  const BX = (i) => 55 + i * 85;
  const BASE = 134;
  const HP = 250; // altura por unidade de probabilidade
  const svgC = criar('svg', { class: 'figura figura--fixa exu-svg', viewBox: '0 0 360 256', role: 'img', 'aria-label': '' });
  svgC.append(criar('line', { class: 'exu-eixo', x1: 18, y1: BASE, x2: 346, y2: BASE }));
  const barras = [];
  tab.forEach((l, i) => {
    const h = P.valor(l.p) * HP;
    const barra = criar('rect', { class: 'exu-barra', x: BX(i) - 24, y: BASE - h, width: 48, height: h });
    const gB = criar('g', {}, [
      barra,
      criar('text', { class: 'exu-t', x: BX(i), y: BASE - h - 5, 'text-anchor': 'middle' }, [ft(l.p)]),
      criar('text', { class: 'exu-t exu-t--eixo', x: BX(i), y: BASE + 15, 'text-anchor': 'middle' }, [`X = ${l.x}`]),
    ]);
    svgC.append(gB);
    barras.push(barra);
  });
  svgC.append(
    criar('text', { class: 'exu-t exu-t--eixo', x: 18, y: 166 }, ['Faixa de largura 1: cada pedaço é um valor de X'])
  );
  const FX0 = 20;
  const FW = 320;
  const FY = 174;
  const FH = 26;
  const segs = [];
  let acc = 0;
  tab.forEach((l, i) => {
    const w = P.valor(l.p) * FW;
    const r = criar('rect', { class: 'exu-seg', x: FX0 + acc, y: FY, width: w, height: FH });
    svgC.append(r, criar('text', { class: 'exu-t exu-t--seg', x: FX0 + acc + w / 2, y: FY + 17, 'text-anchor': 'middle' }, [String(l.x)]));
    segs.push(r);
    acc += w;
  });
  const colchete = criar('path', { class: 'exu-colchete', d: '' });
  const textoTodo = criar('text', { class: 'exu-t exu-t--todo', x: 0, y: 232, 'text-anchor': 'middle' });
  svgC.append(colchete, textoTodo);
  $('.exu-lugar-cond').append(svgC);

  // ---------- 3.3: eixo com μ ----------

  const BASE3 = 118;
  const HP3 = 230;
  const svgM = criar('svg', { class: 'figura figura--fixa exu-svg', viewBox: '0 0 360 176', role: 'img', 'aria-label': '' });
  svgM.append(criar('line', { class: 'exu-eixo', x1: 18, y1: BASE3, x2: 346, y2: BASE3 }));
  const hastes = [];
  tab.forEach((l, i) => {
    const h = P.valor(l.p) * HP3;
    const haste = criar('line', { class: 'exu-haste', x1: BX(i), y1: BASE3, x2: BX(i), y2: BASE3 - h });
    svgM.append(
      haste,
      criar('circle', { class: 'exu-ponto', cx: BX(i), cy: BASE3 - h, r: 5 }),
      criar('text', { class: 'exu-t exu-t--eixo', x: BX(i), y: BASE3 + 15, 'text-anchor': 'middle' }, [String(l.x)])
    );
    hastes.push(haste);
  });
  const xMu = BX(0) + (P.valor(d.mu) - 1) * 85;
  const gMu = criar('g', { class: 'exu-mu' }, [
    criar('line', { class: 'exu-mu-linha', x1: xMu, y1: 14, x2: xMu, y2: BASE3 }),
    criar('path', { class: 'exu-mu-tri', d: `M${xMu} ${BASE3 + 3} l-9 15 h18 z` }),
    criar('text', { class: 'exu-t exu-t--mu', x: xMu, y: BASE3 + 42, 'text-anchor': 'middle' }, [`μ = ${M.fmt(P.valor(d.mu), 0)}`]),
  ]);
  const desvio = criar('line', { class: 'exu-desvio', x1: xMu, y1: 0, x2: xMu, y2: 0 });
  const desvioT = criar('text', { class: 'exu-t exu-t--desvio', x: 0, y: 0, 'text-anchor': 'middle' });
  svgM.append(gMu, desvio, desvioT);
  $('.exu-lugar-mu').append(svgM);

  // mini-tabela das parcelas
  const tabMu = $('.exu-tabela-mu');
  const parcelaDe = (l) => {
    const dif = P.sub(P.F(l.x), d.mu);
    return { dif, q: P.mult(dif, dif), parc: P.mult(l.p, P.mult(dif, dif)) };
  };
  const par = tab.map(parcelaDe);
  tabMu.innerHTML = `
    <table class="tabela exu-tab exu-tab-mu">
      <caption class="sr-only">Parcelas da variância</caption>
      <thead><tr><th scope="col">${T('x_i')}</th><th scope="col">${T('p_i')}</th><th scope="col">${T('(x_i-\\mu)^2')}</th><th scope="col">${T('p_i(x_i-\\mu)^2')}</th></tr></thead>
      <tbody>${tab
        .map(
          (l, i) => `<tr data-k="${i + 1}"><th scope="row"><button type="button" class="exu-btn-x" data-k="${i + 1}" aria-pressed="false" aria-label="Ver o desvio de X igual a ${l.x}">${l.x}</button></th>
            <td>${T(fp(l.p))}</td><td class="exu-oc">${T(fp(par[i].q))}</td><td class="exu-oc">${T(fp(par[i].parc))}</td></tr>`
        )
        .join('')}
        <tr class="exu-linha-soma"><th scope="row">Soma</th><td>${T('1')}</td><td class="exu-oc"></td><td class="exu-oc">${T('\\sigma^2=' + fp(d.sigma2))}</td></tr>
      </tbody>
    </table>`;
  const btnsMu = [...tabMu.querySelectorAll('.exu-btn-x')];
  btnsMu.forEach((b) => b.addEventListener('click', () => selecionar(+b.dataset.k)));
  const lerMu = $('.exu-leitura-mu');

  // ---------- pintar ----------

  const nomeBola = (b) => (b === 'v' ? 'vermelha' : 'branca');

  function pintar() {
    // árvore
    for (let i = 0; i < K; i++) {
      const vis = est.rev > i;
      const f = folhas[i];
      f.g.setAttribute('display', vis ? 'inline' : 'none');
      f.g.setAttribute('aria-pressed', String(est.sel === i + 1));
      f.g.setAttribute('aria-label', `Ramo X igual a ${i + 1}, probabilidade ${ft(tab[i].p)}. ${est.sel === i + 1 ? 'Selecionado.' : 'Toca para selecionar.'}`);
      f.g.classList.toggle('exu-sel', est.sel === i + 1);
      const noAtivo = est.exp && est.passo >= i + 1 && est.exp.bolas[i] === 'v';
      f.g.classList.toggle('exu-ativo', !!noAtivo);
      if (i < K - 1) {
        spine[i].g.setAttribute('display', est.rev > i ? 'inline' : 'none');
        const emSel = est.sel !== null && est.sel > i + 1;
        const emAtivo = est.exp && est.passo > i && est.exp.bolas[i] === 'o';
        spine[i].g.classList.toggle('exu-sel', emSel);
        spine[i].g.classList.toggle('exu-ativo', !!emAtivo);
      }
    }
    const vistas = [];
    for (let i = 0; i < est.rev; i++) vistas.push(`X = ${i + 1} com probabilidade ${ft(tab[i].p)}`);
    svgA.setAttribute(
      'aria-label',
      est.rev === 0
        ? 'Árvore de probabilidades por desenhar. Raiz: a caixa com 2 bolas vermelhas e 3 brancas.'
        : `Árvore de probabilidades com ${est.rev} nível${est.rev > 1 ? 'is' : ''} desenhado${est.rev > 1 ? 's' : ''}. Ramos: ${vistas.join('; ')}.`
    );

    // tabela
    tab.forEach((l, i) => {
      const vis = est.rev > i;
      const novo = vis ? T(fp(l.p)) : '?';
      if (celP[i]._h !== novo) {
        celP[i]._h = novo;
        celP[i].innerHTML = novo;
      }
      celP[i].classList.toggle('exu-sel-col', est.sel === i + 1);
      btnsX[i].setAttribute('aria-pressed', String(est.sel === i + 1));
    });
    const soma = $('.exu-soma');
    const html = est.rev >= K ? `${T('0{,}4 + 0{,}3 + 0{,}2 + 0{,}1 = 1')} ${'e em fração: ' + T(`${fp(tab[0].p)}+${fp(tab[1].p)}+${fp(tab[2].p)}+${fp(tab[3].p)}=1`)}` : '';
    if (soma._h !== html) {
      soma._h = html;
      soma.innerHTML = html ? `Confirma: ${html}. A soma das probabilidades é 1.` : '';
    }

    // 3.2
    const ge2 = est.modo === 'ge2';
    barras.forEach((b, i) => {
      b.classList.toggle('exu-fora', ge2 && i === 0);
      b.classList.toggle('exu-alvo', i === 2);
    });
    segs.forEach((s, i) => {
      s.classList.toggle('exu-fora', ge2 && i === 0);
      s.classList.toggle('exu-alvo', i === 2);
    });
    const x0 = ge2 ? FX0 + P.valor(tab[0].p) * FW : FX0;
    const x1 = FX0 + FW;
    colchete.setAttribute('d', `M${x0} 207 v6 H${x1} v-6`);
    at(textoTodo, { x: (x0 + x1) / 2 });
    textoTodo.textContent = ge2 ? `todo: ${ft(d.pGe2)}` : 'todo: 1';
    const lc = $('.exu-leitura');
    const ph = ge2
      ? `${T('P(X=3\\mid X\\geq 2)=')} ${T(`${fp(d.pX3)} \\div ${fp(d.pGe2)}`)} ${T('=' + fp(d.cond))}. A barra ${T('X=3')} ocupa ${T(fp(d.cond))} da zona sombreada.`
      : `${T('P(X=3)=')} ${T(fp(d.pX3))} de um todo que vale 1. Passa para «Só ${'X ≥ 2'}» e vê o que muda.`;
    if (lc._h !== ph) {
      lc._h = ph;
      lc.innerHTML = ph;
    }
    raiz.querySelectorAll('.exu-modos [data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === est.modo)));
    svgC.setAttribute(
      'aria-label',
      `Gráfico de barras das probabilidades de X e faixa de largura 1 dividida pelos valores de X. ${
        ge2
          ? `O todo é só X maior ou igual a 2, que vale ${ft(d.pGe2)}; a parte X igual a 3 vale ${ft(d.pX3)}, ou seja ${ft(d.cond)} do todo.`
          : `O todo vale 1; a parte X igual a 3 vale ${ft(d.pX3)}.`
      }`
    );

    // 3.3
    gMu.setAttribute('display', est.mostrarMu ? 'inline' : 'none');
    $('.exu-t-mu').setAttribute('aria-pressed', String(est.mostrarMu));
    $('.exu-t-parc').setAttribute('aria-pressed', String(est.parcelas));
    tabMu.classList.toggle('exu-mostrar', est.parcelas);
    hastes.forEach((h, i) => h.classList.toggle('exu-sel', est.sel === i + 1));
    btnsMu.forEach((b, i) => b.setAttribute('aria-pressed', String(est.sel === i + 1)));
    tabMu.querySelectorAll('tbody tr[data-k]').forEach((tr) => tr.classList.toggle('exu-fila-sel', +tr.dataset.k === est.sel));
    if (est.mostrarMu && est.sel) {
      const k = est.sel;
      const x = BX(k - 1);
      at(desvio, { x1: xMu, x2: x, y1: 62, y2: 62 });
      desvio.setAttribute('display', k === 2 ? 'none' : 'inline');
      at(desvioT, { x: (xMu + x) / 2, y: 55 });
      desvioT.textContent = k === 2 ? '' : `x − μ = ${M.fmt(k - P.valor(d.mu), 0)}`;
    } else {
      desvio.setAttribute('display', 'none');
      desvioT.textContent = '';
    }
    let leit = '';
    if (est.mostrarMu) {
      leit = `O triângulo marca o valor médio ${T('\\mu=' + fp(d.mu))}: é o ponto de equilíbrio das barras.`;
      if (est.sel) {
        const k = est.sel;
        leit += ` Para ${T('x_i=' + k)}: desvio ${T(`${k}-${fp(d.mu)}=${fp(par[k - 1].dif)}`)}.`;
      } else leit += ' Escolhe um valor de X na tabela para ver o desvio.';
    } else leit = 'Escolhe «Mostrar μ no eixo» para veres onde fica o valor médio.';
    if (lerMu._h !== leit) {
      lerMu._h = leit;
      lerMu.innerHTML = leit;
    }
    svgM.setAttribute(
      'aria-label',
      `Eixo dos valores de X com as probabilidades.${est.mostrarMu ? ` O valor médio é ${fp(d.mu) === '2' ? 2 : ft(d.mu)}, marcado com um triângulo.` : ''}`
    );
  }

  function selecionar(k) {
    est.sel = est.sel === k ? null : k;
    pintar();
  }

  // ---------- botões da árvore ----------

  const estado = $('.exu-estado');
  const botTirar = $('.exu-tirar');
  const botToda = $('.exu-toda');

  botTirar.addEventListener('click', () => {
    if (!est.exp || est.passo >= est.exp.x) {
      est.exp = P.simularUrna(rng, VERM, BRAN);
      est.passo = 0;
    }
    est.passo++;
    est.rev = Math.max(est.rev, est.passo);
    const i = est.passo - 1;
    const b = est.exp.bolas[i];
    const [n, dd] = b === 'v' ? fatoresBrutos(i + 1)[i] : [BRAN - i, TOTAL - i];
    if (b === 'v') {
      const k = est.exp.x;
      const fat = fatoresBrutos(k);
      const prod = fat.map(([a, c]) => `${a}/${c}`).join(' × ');
      est.sel = k;
      estado.textContent = `Bola ${est.passo}: vermelha (probabilidade ${n}/${dd}). Parou: X = ${k}. P(X = ${k}) = ${k === 1 ? '' : prod + ' = '}${ft(tab[k - 1].p)}. Tira outra bola para fazer nova experiência.`;
    } else {
      est.sel = null;
      estado.textContent = `Bola ${est.passo}: branca (probabilidade ${n}/${dd}). Ainda não saiu vermelha, tira outra bola.`;
    }
    pintar();
    atualizarBotoes();
  });
  botToda.addEventListener('click', () => {
    est.rev = K;
    est.sel = null;
    estado.textContent = 'A árvore está toda desenhada: os 4 ramos vão de X = 1 a X = 4. Multiplica as frações ao longo de cada ramo e toca num ramo para o ver na tabela.';
    pintar();
    atualizarBotoes();
  });
  $('.exu-recomecar').addEventListener('click', () => {
    est.rev = 0;
    est.exp = null;
    est.passo = 0;
    est.sel = null;
    estado.textContent = 'Ainda não tiraste nenhuma bola. A caixa tem 2 vermelhas (V) e 3 brancas (B).';
    pintar();
    atualizarBotoes();
  });
  function atualizarBotoes() {
    botToda.disabled = est.rev >= K;
  }

  raiz.querySelectorAll('.exu-modos [data-modo]').forEach((b) =>
    b.addEventListener('click', () => {
      est.modo = b.dataset.modo;
      pintar();
    })
  );
  $('.exu-t-mu').addEventListener('click', () => {
    est.mostrarMu = !est.mostrarMu;
    pintar();
  });
  $('.exu-t-parc').addEventListener('click', () => {
    est.parcelas = !est.parcelas;
    pintar();
  });

  // ---------- campos de resposta ----------

  /** Um campo com botão «Verificar». ajuda(valor) devolve uma pista para respostas erradas. */
  function campo(contentor, id, rotuloHtml, expr, esperadoTxt, ajuda) {
    const w = document.createElement('div');
    w.className = 'exu-campo';
    w.innerHTML = `
      <label for="${uid}-${id}">${rotuloHtml}</label>
      <div class="exu-linha-campo">
        <input id="${uid}-${id}" class="campo exu-in" type="text" inputmode="text" autocomplete="off" placeholder="fração ou decimal">
        <button type="button" class="botao botao--suave exu-ver-resp">Verificar</button>
      </div>
      <p class="exu-fb" aria-live="polite"></p>`;
    contentor.append(w);
    const inp = w.querySelector('input');
    const fb = w.querySelector('.exu-fb');
    const dizer = (cls, txt) => {
      fb.className = `exu-fb ${cls}`;
      fb.textContent = txt;
    };
    const verificar = () => {
      const al = contentor.dataset.al;
      if (al === '2' || al === '3') abrirDesenho(al);
      const txt = inp.value.trim();
      if (!txt) return dizer('aviso-erro', 'Escreve primeiro a tua resposta.');
      const r = M.corrigir(txt, { expr });
      if (r.estado === 'certo') dizer('aviso-ok', `Certo: ${esperadoTxt}.`);
      else if (r.estado === 'certo-forma') dizer('aviso-ok', `Certo: ${esperadoTxt}.`);
      else if (r.estado === 'decimal' && Math.abs(r.valor - M.avaliar(expr).valor) < 1e-9) dizer('aviso-ok', `Certo: ${esperadoTxt}.`);
      else if (r.estado === 'decimal') dizer('aviso-ok', `Valor certo (aproximado). O valor exato é ${esperadoTxt}.`);
      else if (r.estado === 'invalido') dizer('aviso-erro', 'Não consegui ler. Escreve por exemplo 1/3 ou 0,5.');
      else dizer('aviso-erro', 'Ainda não. ' + (ajuda ? ajuda(r.valor) : 'Revê a resolução passo a passo.'));
    };
    w.querySelector('.exu-ver-resp').addEventListener('click', verificar);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verificar();
      }
    });
  }
  /** Abre o desenho de 3.2 ou 3.3 (fica escondido até o aluno tentar ou pedir). */
  function abrirDesenho(n) {
    const c = raiz.querySelector(`.exu-conteudo[data-al="${n}"]`);
    const t = raiz.querySelector(`.exu-trava[data-al="${n}"]`);
    if (c) c.hidden = false;
    if (t) t.hidden = true;
  }
  raiz.querySelectorAll('.exu-abrir').forEach((b) => b.addEventListener('click', () => abrirDesenho(b.dataset.al)));
  const cx = (n) => raiz.querySelector(`.exu-resposta[data-al="${n}"]`);
  for (const n of [1, 2, 3]) {
    const t = document.createElement('p');
    t.className = 'exu-resp-t';
    t.textContent = 'A tua resposta (opcional)';
    cx(n).append(t);
  }
  campo(cx(1), 'r1', `Para testar a tabela: ${T('P(X = 2)')} =`, '3/10', '3/10', (v) =>
    Math.abs(v - 0.6) < 1e-9
      ? 'Isso é só a probabilidade de a primeira ser branca. Falta a segunda sair vermelha, depois de já teres tirado uma bola.'
      : Math.abs(v - 0.4) < 1e-9
        ? 'Isso é P(X = 1). Para X = 2 a primeira é branca e a segunda é vermelha, com 4 bolas na caixa.'
        : 'Multiplica os dois ramos: branca (3 em 5) e depois vermelha (2 em 4).'
  );
  campo(cx(2), 'r2', `${T('P(X = 3 \\mid X \\geq 2)')} =`, '1/3', '1/3', (v) =>
    Math.abs(v - 0.2) < 1e-9
      ? 'Isso é P(X = 3), com o todo igual a 1. Aqui o todo é só P(X ≥ 2).'
      : Math.abs(v - 0.6) < 1e-9
        ? 'Isso é P(X ≥ 2), o todo. Falta dividir P(X = 3) por ele.'
        : 'Divide P(X = 3) por P(X ≥ 2).'
  );
  campo(cx(3), 'r3a', `Valor médio ${T('\\mu')} =`, '2', '2', () => 'Soma os produtos x_i × P(X = x_i).');
  campo(cx(3), 'r3b', `Desvio-padrão ${T('\\sigma')} =`, '1', '1', (v) =>
    Math.abs(v - 1) > 1e-9 && Math.abs(v - 1.0) < 2 ? 'Soma primeiro as parcelas p_i (x_i − μ)² para teres a variância, e só depois tiras a raiz quadrada.' : ''
  );

  // ---------- resolução passo a passo ----------

  const lista = [];
  const add = (al, html) => lista.push({ al, html });
  const prodTex = (k) => fatoresBrutos(k).map(([n, dd]) => fx(n, dd)).join('\\times ');
  const nomes = ['', 'Sai logo uma vermelha.', 'Sai uma branca e depois uma vermelha.', 'Saem duas brancas e depois uma vermelha.', 'Saem as três brancas e depois a vermelha.'];

  add('3.1', `<p>Na caixa há 5 bolas, 2 vermelhas e 3 brancas. ${T('X')} conta as bolas tiradas até sair a primeira vermelha, por isso só pode ser ${T('1,\\,2,\\,3')} ou ${T('4')}: depois de saírem as 3 brancas, a bola seguinte é vermelha de certeza.</p>`);
  add('3.1', `<p>${nomes[1]} ${T('X = 1')}: há 2 vermelhas em 5 bolas.</p>${D('P(X=1)=' + fx(2, 5))}`);
  add('3.1', `<p>${nomes[2]} Como não repões, depois de tirares uma branca ficam 4 bolas, 2 delas vermelhas.</p>${D('P(X=2)=' + prodTex(2) + '=' + fp(tab[1].p))}`);
  add('3.1', `<p>${nomes[3]} Em cada passo há menos uma bola na caixa.</p>${D('P(X=3)=' + prodTex(3) + '=' + fp(tab[2].p))}`);
  add('3.1', `<p>${nomes[4]} Na última tiragem só restam 2 bolas e são as duas vermelhas, por isso o último fator é ${T(fx(2, 2))}.</p>${D('P(X=4)=' + prodTex(4) + '=' + fp(tab[3].p))}`);
  add(
    '3.1',
    `<p>A tabela de distribuição fica assim. Confirma que as probabilidades somam 1.</p>
     <div class="tabela-rolante"><table class="tabela exu-tab"><tbody>
      <tr><th scope="row">${T('x_i')}</th>${tab.map((l) => `<td>${T(String(l.x))}</td>`).join('')}</tr>
      <tr><th scope="row">${T('P(X=x_i)')}</th>${tab.map((l) => `<td>${T(fp(l.p))}</td>`).join('')}</tr>
     </tbody></table></div>
     ${D(tab.map((l) => fp(l.p)).join('+') + '=1')}`
  );

  add('3.2', `<p>Esta pergunta é uma probabilidade condicionada: sabes que ${T('X \\geq 2')}, por isso o todo deixou de ser a caixa inteira. Usa a definição.</p>${D('P(X=3\\mid X\\geq 2)=\\dfrac{P(X=3\\cap X\\geq 2)}{P(X\\geq 2)}')}`);
  add('3.2', `<p>Se ${T('X = 3')}, então já ${T('X \\geq 2')}. Logo a interseção é só ${T('X = 3')}.</p>${D('P(X=3\\cap X\\geq 2)=P(X=3)=' + fp(d.pX3))}`);
  add('3.2', `<p>${T('P(X\\geq 2)')} calcula-se somando os valores 2, 3 e 4. Também podias fazer ${T('1-P(X=1)')}.</p>${D('P(X\\geq 2)=' + [1, 2, 3].map((i) => fp(tab[i].p)).join('+') + '=' + fp(d.pGe2) + '=1-' + fp(tab[0].p))}`);
  add('3.2', `<p>Divide a parte pelo todo.</p>${D('P(X=3\\mid X\\geq 2)=' + `\\dfrac{${fp(d.pX3)}}{${fp(d.pGe2)}}=` + fp(d.cond))}<p>Na figura: a barra ${T('X=3')} ocupa ${T(fp(d.cond))} da zona sombreada. Repara que ${T(fp(d.pX3))} é a parte, mas o todo é ${T(fp(d.pGe2))}, e não 1.</p>`);

  add('3.3', `<p>O valor médio é a soma dos produtos de cada valor pela sua probabilidade.</p>${D('\\mu=\\sum x_i\\,P(X=x_i)=' + tab.map((l) => `${l.x}\\times ${fp(l.p)}`).join('+') + '=' + fp(d.mu))}`);
  add('3.3', `<p>Para a variância, calcula cada parcela ${T('p_i(x_i-\\mu)^2')} com ${T('\\mu=' + fp(d.mu))} e soma.</p>${D('\\sigma^2=' + tab.map((l) => `${fp(l.p)}\\times(${l.x}-${fp(d.mu)})^2`).join('+'))}${D('\\sigma^2=' + par.map((p) => fp(p.parc)).join('+') + '=' + fp(d.sigma2))}`);
  add('3.3', `<p>O desvio-padrão é a raiz quadrada da variância.</p>${D('\\sigma=\\sqrt{\\sigma^2}=\\sqrt{' + fp(d.sigma2) + '}=' + M.fmt(d.sigma, 0))}<p>Em média, ${T('X')} é ${M.fmt(P.valor(d.mu), 0)} bolas tiradas, e os valores afastam-se dessa média cerca de ${M.fmt(d.sigma, 0)} bola.</p>`);

  const passosEl = $('.exu-passos');
  const botVer = $('.exu-ver');
  const botProx = $('.exu-prox');

  function mostrarPasso(n) {
    const p = lista[n];
    const div = document.createElement('div');
    div.className = 'exu-passo';
    const anterior = n > 0 ? lista[n - 1].al : null;
    div.innerHTML = `${p.al !== anterior ? `<h5 class="exu-alinea">${p.al}</h5>` : ''}${p.html}`;
    passosEl.append(div);
  }
  function atualizarRes() {
    botVer.textContent = est.resolucao ? 'Esconder a resolução' : 'Ver a resolução';
    botVer.setAttribute('aria-expanded', String(est.resolucao));
    botProx.hidden = !est.resolucao;
    botProx.disabled = est.nPassos >= lista.length;
    botProx.textContent = est.nPassos >= lista.length ? 'Resolução completa' : est.nPassos === 0 ? 'Primeiro passo' : `Próximo passo (${est.nPassos}/${lista.length})`;
    passosEl.hidden = !est.resolucao;
  }
  botVer.addEventListener('click', () => {
    est.resolucao = !est.resolucao;
    if (est.resolucao) {
      abrirDesenho(2);
      abrirDesenho(3);
    }
    if (est.resolucao && est.nPassos === 0) {
      mostrarPasso(0);
      est.nPassos = 1;
    }
    atualizarRes();
  });
  botProx.addEventListener('click', () => {
    if (est.nPassos < lista.length) {
      mostrarPasso(est.nPassos);
      est.nPassos++;
      atualizarRes();
      passosEl.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  });

  pintar();
  atualizarBotoes();
  atualizarRes();
}
