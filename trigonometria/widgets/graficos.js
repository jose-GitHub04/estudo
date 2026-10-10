// graficos: gráfico de y = a + b·f(c(x − d)) com f = sin, cos ou tan.
// Sliders para a, b, c e d, leituras em direto (equação, amplitude, período, frequência,
// contradomínio, máximo, mínimo e domínio) e o modo «Descobre os parâmetros».

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const PI = Math.PI;
const X_MIN = -2 * PI;
const X_MAX = 2 * PI;
const Y_MIN = -4.5;
const Y_MAX = 4.5;
const LARGURA_MAX = 760;
const VALORES_C = [0.5, 1, 1.5, 2, 3, 4];
const FUNCOES = ['sin', 'cos', 'tan'];

let contador = 0;

// Estado de uma função: fn, a, b, ci (índice em VALORES_C) e dp (d em passos de π/12).
const padrao = (fn = 'sin') => ({ fn, a: 0, b: 1, ci: 1, dp: 0 });
const cDe = (e) => VALORES_C[e.ci];
const dDe = (e) => (e.dp * PI) / 12;
const fracC = (c) => M.reduzir(Math.round(c * 2), 2); // c = p/q
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- Formatação ----------

const numTex = (v) => (v < 0 ? '-' : '') + String(Math.abs(v)).replace('.', '{,}');
const numTxt = (v) => M.fmt(v, Number.isInteger(v) ? 0 : 1);
const decTex = (v, casas) => M.fmt(v, casas).replace(',', '{,}').replace('−', '-');

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

/** Equação de e, em LaTeX ('tex') ou em texto simples ('txt'). */
function equacao(e, tipo) {
  const T = tipo === 'tex';
  const c = cDe(e);
  const num = (v) => (T ? numTex(v) : numTxt(v));
  const abs = (v) => (T ? numTex(Math.abs(v)) : numTxt(Math.abs(v)));
  const igual = T ? '=' : ' = ';
  if (e.b === 0) return `y${igual}${num(e.a)}`;

  const nome = T ? `\\${e.fn}` : e.fn;
  let dentro;
  if (e.dp === 0) {
    dentro = c === 1 ? 'x' : `${abs(c)}x`;
  } else {
    const [p, q] = M.reduzir(Math.abs(e.dp), 12);
    const dT = T ? M.fracPiTex(p, q).replace('\\frac', '\\tfrac') : M.fracPiTexto(p, q);
    const sg = e.dp > 0 ? (T ? '-' : ' − ') : (T ? '+' : ' + ');
    const xd = `x${sg}${dT}`;
    dentro = c === 1 ? xd : `${abs(c)}(${xd})`;
  }
  // parênteses maiores só quando há uma fração lá dentro
  const arg = T ? (dentro === 'x' ? ' x' : e.dp === 0 ? `(${dentro})` : `\\bigl(${dentro}\\bigr)`) : `(${dentro})`;
  const coef = Math.abs(e.b) === 1 ? '' : abs(e.b);
  const termo = `${T ? coef : (coef ? `${coef} ` : '')}${nome}${arg}`;
  if (e.a === 0) return `y${igual}${e.b < 0 ? (T ? '-' : '−') : ''}${termo}`;
  const op = e.b < 0 ? (T ? '-' : ' − ') : (T ? '+' : ' + ');
  return `y${igual}${num(e.a)}${op}${termo}`;
}

// ---------- Matemática do gráfico ----------

function valor(e, x) {
  const th = cDe(e) * (x - dDe(e));
  const f = e.fn === 'sin' ? Math.sin(th) : e.fn === 'cos' ? Math.cos(th) : Math.tan(th);
  return e.a + e.b * f;
}

/** Abscissas das assíntotas verticais, x = d + (π/2 + kπ)/c, dentro de [−2π, 2π]. */
function assintotas(e) {
  if (e.fn !== 'tan') return [];
  const c = cDe(e);
  const d = dDe(e);
  const r = [];
  for (let k = -80; k <= 80; k++) {
    const x = d + (PI / 2 + k * PI) / c;
    if (x >= X_MIN - 1e-9 && x <= X_MAX + 1e-9) r.push(x);
  }
  return r.sort((p, q) => p - q);
}

/** Lista de ramos, cada um uma lista de pontos [x, y]. A tangente é partida nas assíntotas. */
function ramos(e) {
  if (e.fn !== 'tan') {
    const N = 600;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / N;
      pts.push([x, valor(e, x)]);
    }
    return [pts];
  }
  const lim = [X_MIN, ...assintotas(e), X_MAX];
  const out = [];
  for (let i = 0; i < lim.length - 1; i++) {
    const x0 = lim[i];
    const x1 = lim[i + 1];
    const len = x1 - x0;
    if (len < 1e-6) continue;
    const n = Math.max(16, Math.round((600 * len) / (X_MAX - X_MIN)));
    const comecaNoBordo = i === 0;
    const acabaNoBordo = i === lim.length - 2;
    const pts = [];
    for (let j = comecaNoBordo ? 0 : 1; j <= (acabaNoBordo ? n : n - 1); j++) {
      const t = (1 - Math.cos((PI * j) / n)) / 2; // pontos mais juntos perto das assíntotas
      const x = x0 + len * t;
      pts.push([x, limitar(valor(e, x), -60, 60)]);
    }
    out.push(pts);
  }
  return out;
}

/** Tudo o que as leituras mostram, em LaTeX ({tex}) ou texto simples ({txt}). */
function calcular(e) {
  const tan = e.fn === 'tan';
  const [cn, cd] = fracC(cDe(e));
  const cte = e.b === 0;
  const r = { eq: { tex: equacao(e, 'tex') }, amp: { tex: `|b|=${numTex(Math.abs(e.b))}` } };

  if (cte) {
    r.per = { txt: 'sem período mínimo' };
    r.freq = { txt: 'não se aplica' };
  } else {
    const [pp, pq] = M.reduzir((tan ? 1 : 2) * cd, cn); // P₀ = (pp/pq)·π
    const P = (pp / pq) * PI;
    r.per = { tex: `${M.fracPiTex(pp, pq)}\\approx${decTex(P, 2)}` };
    r.freq = { tex: `\\frac{${pq}}{${pp === 1 ? '' : pp}\\pi}\\approx${decTex(1 / P, 3)}` };
  }

  const lo = e.a - Math.abs(e.b);
  const hi = e.a + Math.abs(e.b);
  if (cte) {
    r.contra = { tex: `\\{${numTex(e.a)}\\}` };
  } else if (tan) {
    r.contra = { tex: '\\mathbb{R}' };
  } else {
    const sep = Number.isInteger(lo) && Number.isInteger(hi) ? ',\\,' : ';\\,';
    r.contra = { tex: `\\left[${numTex(lo)}${sep}${numTex(hi)}\\right]` };
  }
  r.max = { tex: numTex(hi) };
  r.min = { tex: numTex(lo) };

  if (!tan) {
    r.dom = { tex: '\\mathbb{R}' };
  } else {
    // assíntotas: π·(dp/12 + cd/(2cn)) + k·π·cd/cn, com o deslocamento reduzido ao passo
    const [p1, q1] = M.reduzir(e.dp * 2 * cn + 12 * cd, 24 * cn);
    const [sp, sq] = M.reduzir(cd, cn);
    const k = Math.floor((p1 * cn) / (q1 * cd) + 1e-9);
    const [po, qo] = M.reduzir(p1 * cn - k * cd * q1, q1 * cn);
    const kp = `${sp === 1 ? '' : sp}k\\pi`;
    const passo = sq === 1 ? kp : `\\frac{${kp}}{${sq}}`;
    const conj = po === 0 ? passo : `${M.fracPiTex(po, qo)}+${passo}`;
    r.dom = { tex: `\\mathbb{R}\\setminus\\left\\{${conj},\\ k\\in\\mathbb{Z}\\right\\}` };
  }
  return r;
}

// ---------- O widget ----------

export async function montar(el, dados) {
  const id = `gra${++contador}`;
  const idClip = `${id}-clip`;

  let modo = false; // true no modo «Descobre os parâmetros»
  let fantasma = false;
  const livre = padrao('sin');
  let tent = padrao('sin');
  let segredo = null;
  let G = null;
  const ativo = () => (modo ? tent : livre);

  // --- estrutura ---
  const chipsFn = FUNCOES.map((f) => {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-fn': f }, f);
    b.addEventListener('click', () => {
      if (modo) return;
      livre.fn = f;
      sincronizar();
    });
    return b;
  });
  const grupoFn = h('div', { class: 'chips gra-fn', role: 'group', 'aria-label': 'Escolhe a função' }, ...chipsFn);

  const defs = criar('defs');
  const gBase = criar('g');
  const gDin = criar('g', { 'clip-path': `url(#${idClip})` });
  const gRot = criar('g');
  const svg = criar('svg', { class: 'figura gra-fig', role: 'img', preserveAspectRatio: 'xMidYMid meet' }, [defs, gBase, gDin, gRot]);
  const lienzo = h('div', { class: 'gra-lienzo' }, svg);
  const legenda = h('ul', { class: 'gra-legenda' });

  function criarControlo(nome, rotulo, min, max, passo, aoMudar) {
    const idIn = `${id}-${nome}`;
    const input = h('input', { type: 'range', id: idIn, min, max, step: passo, 'data-param': nome });
    const out = h('output', { for: idIn });
    const caixa = h('div', { class: 'controlo gra-controlo' },
      h('div', { class: 'gra-controlo__linha' }, h('label', { for: idIn }, rotulo), out), input);
    input.addEventListener('input', () => aoMudar(Number(input.value)));
    return { caixa, input, out };
  }

  const sA = criarControlo('a', 'a, translação vertical', -3, 3, 0.5, (v) => alterar('a', v));
  const sB = criarControlo('b', 'b, amplitude (com sinal)', -3, 3, 0.5, (v) => alterar('b', v));
  const sC = criarControlo('c', 'c, compressão horizontal', 0, VALORES_C.length - 1, 1, (v) => alterar('ci', v));
  const sD = criarControlo('d', 'd, translação horizontal', -12, 12, 1, (v) => alterar('dp', v));
  const controlos = h('div', { class: 'controlos gra-controlos' }, sA.caixa, sB.caixa, sC.caixa, sD.caixa);

  const btnFantasma = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' });
  const btnDescobre = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, 'Descobre os parâmetros');
  const btnRepor = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Repor');
  const opcoes = h('div', { class: 'chips gra-opcoes' }, btnFantasma, btnDescobre, btnRepor);

  const btnVerificar = h('button', { type: 'button', class: 'botao botao--mini' }, 'Verificar');
  const btnSolucao = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Mostrar solução');
  const btnOutra = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Outra');
  const instrucao = h('p', { class: 'nota' });
  const resultado = h('div', { class: 'gra-resultado', role: 'status', 'aria-live': 'polite' });
  const painel = h('div', { class: 'gra-descobre', hidden: true },
    instrucao, h('div', { class: 'gra-acoes' }, btnVerificar, btnSolucao, btnOutra), resultado);

  const DEFS_LEITURA = [
    ['eq', 'Equação', true],
    ['amp', 'Amplitude', false],
    ['per', 'Período P₀', false],
    ['freq', 'Frequência 1/P₀', false],
    ['max', 'Máximo', false],
    ['min', 'Mínimo', false],
    ['contra', 'Contradomínio', false],
    ['dom', 'Domínio', true],
  ];
  const nos = {};
  const leiturasEl = h('div', { class: 'leituras gra-leituras', 'aria-live': 'polite' });
  for (const [chave, rotulo, larga] of DEFS_LEITURA) {
    const rot = h('span', { class: 'leitura__rotulo' }, rotulo);
    const val = h('span', { class: 'leitura__valor' });
    const caixa = h('div', { class: `leitura gra-leitura${larga ? ' gra-leitura--larga' : ''}`, 'data-leitura': chave }, rot, val);
    nos[chave] = { caixa, rot, valor: val };
    leiturasEl.append(caixa);
  }
  const notaConstante = h('p', { class: 'nota gra-constante', hidden: true },
    'Com b = 0 a função é constante: o gráfico é uma reta horizontal e não tem período.');

  const formula = h('p', { class: 'gra-formula' });
  formula.innerHTML = `Gráfico de ${tex('y=a+b\\,f\\bigl(c(x-d)\\bigr)')}, com f igual a sin, cos ou tan.`;
  const raiz = h('div', { class: 'widget gra' },
    h('p', { class: 'widget__titulo' }, 'Experimenta os parâmetros'),
    formula,
    grupoFn, lienzo, legenda, controlos, opcoes, painel, leiturasEl, notaConstante);
  el.replaceChildren(raiz);

  // --- geometria e desenho ---
  const sx = (x) => G.mL + ((x - X_MIN) / (X_MAX - X_MIN)) * G.pw;
  const sy = (y) => G.mT + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * G.ph;

  function medir() {
    const largura = Math.round(Math.min(lienzo.clientWidth || 640, LARGURA_MAX));
    const W = Math.max(280, largura);
    if (G && G.W === W) return false;
    const mL = 24;
    const mR = 22;
    const mT = 18;
    const mB = 12;
    const pw = W - mL - mR;
    const ph = Math.round(limitar(pw * 0.8, 240, 420));
    G = { W, H: ph + mT + mB, mL, mR, mT, mB, pw, ph, fs: W < 420 ? 11 : 12.5 };
    return true;
  }

  function desenharBase() {
    const { W, H, mL, mT, pw, ph, fs } = G;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    defs.replaceChildren(criar('clipPath', { id: idClip }, [criar('rect', { x: mL, y: mT, width: pw, height: ph })]));
    gBase.replaceChildren();
    gRot.replaceChildren();
    const x0 = sx(0);
    const y0 = sy(0);

    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const x = sx((i * PI) / 2);
      gBase.append(criar('line', { class: 'gra-grelha', x1: x, x2: x, y1: mT, y2: mT + ph }));
    }
    for (let v = -4; v <= 4; v++) {
      if (v === 0) continue;
      const y = sy(v);
      gBase.append(criar('line', { class: 'gra-grelha', x1: mL, x2: mL + pw, y1: y, y2: y }));
    }

    gBase.append(
      criar('line', { class: 'gra-eixo', x1: mL, y1: y0, x2: mL + pw - 6, y2: y0 }),
      criar('line', { class: 'gra-eixo', x1: x0, y1: mT + ph, x2: x0, y2: mT + 6 }),
      criar('polygon', { class: 'gra-seta', points: `${mL + pw},${y0} ${mL + pw - 9},${y0 - 4.5} ${mL + pw - 9},${y0 + 4.5}` }),
      criar('polygon', { class: 'gra-seta', points: `${x0},${mT} ${x0 - 4.5},${mT + 9} ${x0 + 4.5},${mT + 9}` }),
    );

    const rotulo = (txt, x, y, anchor, extra = '') =>
      criar('text', { class: `gra-rot${extra}`, x, y, 'text-anchor': anchor, 'font-size': fs }, [txt]);

    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const x = sx((i * PI) / 2);
      gBase.append(criar('line', { class: 'gra-marca', x1: x, x2: x, y1: y0 - 3, y2: y0 + 3 }));
      gRot.append(rotulo(M.fracPiTexto(i, 2), x, y0 + fs + 5, 'middle'));
    }
    for (let v = -4; v <= 4; v++) {
      if (v === 0) continue;
      const y = sy(v);
      gBase.append(criar('line', { class: 'gra-marca', x1: x0 - 3, x2: x0 + 3, y1: y, y2: y }));
      gRot.append(rotulo(String(v).replace('-', '−'), x0 - 7, y + 4, 'end'));
    }
    gRot.append(
      rotulo('0', x0 - 7, y0 + fs + 5, 'end'),
      rotulo('x', mL + pw + 5, y0 + 4, 'start', ' gra-rot--nome'),
      rotulo('y', x0 + 9, mT + 5, 'start', ' gra-rot--nome'),
    );
  }

  function trajeto(e) {
    const rs = ramos(e);
    const d = rs
      .map((pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(''))
      .join('');
    return { d, n: rs.length };
  }

  function curva(e, classe, papel) {
    const { d, n } = trajeto(e);
    return criar('path', { class: classe, d, 'data-papel': papel, 'data-ramos': n });
  }

  function desenhar() {
    gDin.replaceChildren();
    if (modo) {
      gDin.append(curva(segredo, 'gra-curva', 'principal'));
      gDin.append(curva(tent, 'gra-curva gra-curva--tentativa', 'tentativa'));
      svg.setAttribute('aria-label', 'Gráfico da função misteriosa, a cheio, e da tua tentativa, a tracejado, para x entre −2π e 2π.');
      return;
    }
    if (fantasma) gDin.append(curva(padrao(livre.fn), 'gra-curva gra-curva--fantasma', 'fantasma'));
    for (const x of assintotas(livre)) {
      gDin.append(criar('line', { class: 'gra-assintota', x1: sx(x), x2: sx(x), y1: G.mT, y2: G.mT + G.ph, 'data-x': x.toFixed(6) }));
    }
    gDin.append(curva(livre, 'gra-curva', 'principal'));
    svg.setAttribute('aria-label', `Gráfico de ${equacao(livre, 'txt')}, para x entre −2π e 2π.`);
  }

  function amostra(classe) {
    return criar('svg', { class: 'gra-amostra', width: 30, height: 10, viewBox: '0 0 30 10', 'aria-hidden': 'true' },
      [criar('line', { class: classe, x1: 1, y1: 5, x2: 29, y2: 5 })]);
  }

  function atualizarLegenda() {
    const itens = [];
    if (modo) {
      itens.push(['gra-curva', 'Função misteriosa']);
      itens.push(['gra-curva gra-curva--tentativa', 'A tua tentativa']);
    } else {
      itens.push(['gra-curva', 'A tua função']);
      if (fantasma) itens.push(['gra-curva gra-curva--fantasma', `y = ${livre.fn} x original`]);
      if (livre.fn === 'tan') itens.push(['gra-assintota', 'Assíntotas']);
    }
    legenda.replaceChildren(...itens.map(([classe, txt]) => h('li', {}, amostra(classe), txt)));
  }

  const ultimo = {};
  function atualizarLeituras() {
    const e = ativo();
    const r = calcular(e);
    const tan = e.fn === 'tan';
    for (const chave of Object.keys(nos)) {
      const no = nos[chave];
      no.caixa.hidden = tan && (chave === 'amp' || chave === 'max' || chave === 'min');
      const v = r[chave];
      const sinal = v.tex !== undefined ? `T${v.tex}` : `X${v.txt}`;
      if (ultimo[chave] === sinal) continue;
      ultimo[chave] = sinal;
      if (v.tex !== undefined) no.valor.innerHTML = tex(v.tex);
      else no.valor.textContent = v.txt;
    }
    nos.eq.rot.textContent = modo ? 'A tua equação' : 'Equação';
    notaConstante.hidden = e.b !== 0;
  }

  function refrescar() {
    const e = ativo();
    sA.out.textContent = numTxt(e.a);
    sB.out.textContent = numTxt(e.b);
    sC.out.textContent = numTxt(cDe(e));
    sD.out.textContent = M.fracPiTexto(e.dp, 12);
    sA.input.setAttribute('aria-valuetext', numTxt(e.a));
    sB.input.setAttribute('aria-valuetext', numTxt(e.b));
    sC.input.setAttribute('aria-valuetext', numTxt(cDe(e)));
    sD.input.setAttribute('aria-valuetext', M.fracPiTexto(e.dp, 12));
    desenhar();
    atualizarLeituras();
  }

  function sincronizar() {
    const e = ativo();
    chipsFn.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.fn === e.fn));
      b.disabled = modo || false;
    });
    sA.input.value = e.a;
    sB.input.value = e.b;
    sC.input.value = e.ci;
    sD.input.value = e.dp;
    sD.input.disabled = modo;
    btnFantasma.hidden = modo;
    btnFantasma.textContent = `Mostrar y = ${livre.fn} x original`;
    btnFantasma.setAttribute('aria-pressed', String(fantasma));
    btnDescobre.setAttribute('aria-pressed', String(modo));
    painel.hidden = !modo;
    refrescar();
    atualizarLegenda();
  }

  function alterar(campo, v) {
    ativo()[campo] = v;
    if (modo) resultado.replaceChildren();
    refrescar();
  }

  // --- modo «Descobre os parâmetros» ---
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];

  function novoSegredo() {
    let s;
    do {
      s = {
        fn: sorteia(['sin', 'cos']),
        a: sorteia([-2, -1, 0, 1, 2]),
        b: sorteia([-3, -2, -1, 1, 2, 3]),
        ci: sorteia([1, 3, 4]), // c = 1, 2 ou 3
        dp: 0,
      };
      // a curva tem de caber no desenho para se poder ver o máximo e o mínimo
    } while (Math.abs(s.a) + Math.abs(s.b) > 4 || (segredo && JSON.stringify(s) === JSON.stringify(segredo)));
    segredo = s;
    tent = padrao(s.fn);
    resultado.replaceChildren();
    instrucao.innerHTML = `Há uma função misteriosa ${tex(`y=a+b\\${s.fn}(cx)`)}, desenhada a cheio. `
      + 'Mexe em a, b e c até a tua curva tracejada ficar por cima dela e carrega em Verificar.';
  }

  function alternarModo(ligar) {
    modo = ligar;
    if (modo) novoSegredo();
    else resultado.replaceChildren();
    sincronizar();
  }

  function verificar() {
    const faltas = [];
    if (tent.a !== segredo.a) faltas.push('a posição vertical (o valor de a) ainda não bate');
    if (Math.abs(tent.b) !== Math.abs(segredo.b)) faltas.push('a amplitude ainda não bate');
    else if (tent.b !== segredo.b) faltas.push('a amplitude está certa, mas o gráfico está ao contrário (pensa no sinal de b)');
    if (tent.ci !== segredo.ci) faltas.push('o período ainda não bate');
    resultado.replaceChildren();
    if (faltas.length === 0) {
      const p = h('p', { class: 'aviso-ok' });
      p.innerHTML = `Acertaste! A função era ${tex(equacao(segredo, 'tex'))}.`;
      resultado.append(p);
    } else {
      resultado.append(h('p', { class: 'aviso-erro' }, `Ainda não. ${faltas.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join('. ')}.`));
    }
  }

  function mostrarSolucao() {
    tent = { ...segredo };
    sincronizar();
    const p = h('p', { class: 'aviso-ok' });
    p.innerHTML = `A solução é ${tex(equacao(segredo, 'tex'))}.`;
    resultado.replaceChildren(p);
  }

  btnDescobre.addEventListener('click', () => alternarModo(!modo));
  btnVerificar.addEventListener('click', verificar);
  btnSolucao.addEventListener('click', mostrarSolucao);
  btnOutra.addEventListener('click', () => {
    novoSegredo();
    sincronizar();
  });
  btnFantasma.addEventListener('click', () => {
    fantasma = !fantasma;
    sincronizar();
  });
  btnRepor.addEventListener('click', () => {
    if (modo) {
      tent = padrao(segredo.fn);
      resultado.replaceChildren();
    } else {
      Object.assign(livre, padrao(livre.fn));
    }
    sincronizar();
  });

  // --- arranque e redimensionamento ---
  medir();
  desenharBase();
  sincronizar();

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (medir()) {
        desenharBase();
        desenhar();
      }
    }).observe(lienzo);
  }
}
