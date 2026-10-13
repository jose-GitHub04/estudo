// derivadas: a derivada é o declive da tangente.
// Escolhes uma função (e^x, a^x, ln x, log_a x e quatro compostas), arrastas o ponto P pela curva
// e vês a secante por P e Q = (x₀+h, f(x₀+h)) aproximar-se da tangente quando h → 0. As leituras
// comparam o declive da secante com o que dá a fórmula e escrevem a equação da tangente. O botão
// «Mostrar o sinal de f'» pinta a curva consoante f' > 0 (sobe) ou f' < 0 (desce).
// Contrato: export async function montar(el, dados). Sem estado guardado.
// Também exporta FAMILIAS, A_LISTA, H_LISTA, configuracao, leituras e equacaoTangente,
// que logaritmos/tests/derivadas.html confere contra diferenças finitas.

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';
import { criarGrafico, arrastarNaCurva } from '../../assets/motor/grafico.js';

const E = Math.E;
const LARGURA_MIN = 260;
const LARGURA_MAX = 600;
const COR_SOBE = 'var(--c-tg, #2d7a4b)';
const COR_DESCE = 'var(--erro, #a3321f)';

// Bases a: de 0,3 a 4 com passo 0,1, sem o 1 (1^x é constante e log_1 não existe), com o número e.
export const A_LISTA = (() => {
  const lista = [];
  for (let i = 3; i <= 40; i++) {
    if (i === 10) continue;
    lista.push(i / 10);
    if (i === 27) lista.push(E);
  }
  return lista;
})();

// Distâncias h, de 2 a 0,001: uma escala aproximadamente logarítmica (de 1,4 em 1,4).
export const H_LISTA = [2, 1.5, 1, 0.7, 0.5, 0.3, 0.2, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02, 0.015, 0.01, 0.007, 0.005, 0.003, 0.002, 0.0015, 0.001];

let contador = 0;

// ---------- Formatação ----------

const r2 = (v) => Math.round(v * 100) / 100;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// quando não há valor a mostrar escreve-se um travessão (em escape: o verificador do site
// não deixa o carácter por extenso em nenhum ficheiro)
const SEM_VALOR = '\u2014';
const nf = (v, c) => (Number.isFinite(v) ? M.fmt(v, c) : SEM_VALOR);
const nt = (v, c) => M.fmt(v, c).replace(',', '{,}').replace('−', '-'); // LaTeX
const par = (v, c = 2) => { const s = nt(v, c); return s.startsWith('-') ? `(${s})` : s; };
const curto = (v, c) => M.fmt(v, c).replace(/(,\d*?)0+$/, '$1').replace(/,$/, ''); // sem zeros à direita
const aTex = (a) => (a === E ? 'e' : nt(a, 1).replace('{,}0', ''));
const aTxt = (a) => (a === E ? 'e' : curto(a, 1));
const hTxt = (v) => String(v).replace('.', ',');
const sem0 = (v) => (v === 0 ? 0 : v); // evita -0

// ---------- As funções ----------
// f(x, a) e df(x, a) são a função e a derivada PELA FÓRMULA (nunca por diferenças finitas).
// janela(a): janela do gráfico. dominio(x): x pertence ao domínio. inf: ínfimo do domínio
// (a curva só existe acima). pMin: o menor x₀ permitido ao ponto P. zeros(a): onde f' = 0.
// assintotaV: desenha a assíntota x = 0. buraco: marca o ponto (0, 0) em aberto (x ln x).
// fronteira: aviso quando x₀ chega perto do limite do domínio.
// tex: f, regra (lista de linhas), der e valor(x0, a) em LaTeX. erro: o que sai quando se
// esquece o fator que os alunos esquecem (ln a, u', ...). expr: a mesma função na sintaxe do
// avaliador do motor (os testes comparam as duas).

export const FAMILIAS = [
  {
    id: 'exp', cor: 'exp', param: false, chip: 'e^{x}', aria: 'e elevado a x',
    expr: 'e^x', x0: 1, inf: -Infinity, pMin: -Infinity,
    f: (x) => Math.exp(x),
    df: (x) => Math.exp(x),
    dominio: () => true,
    janela: () => ({ x: [-3, 3], y: [-1.75, 14] }),
    zeros: () => [],
    nome: () => 'e elevado a x',
    tex: {
      f: () => 'f(x)=e^{x}',
      regra: () => ["(e^{x})'=e^{x}"],
      der: () => "f'(x)=e^{x}",
      valor: (x0) => `f'(x_0)=e^{${nt(x0, 2)}}`,
    },
    erro: {
      rotulo: 'Erro típico: usar a regra da potência',
      tex: (x0) => `${par(x0)}\\times e^{${nt(x0, 2)}-1}`,
      valor: (x0) => x0 * Math.exp(x0 - 1),
    },
  },
  {
    id: 'pot', cor: 'exp', param: true, chip: 'a^{x}', aria: 'a elevado a x',
    expr: 'a^x', x0: 1, inf: -Infinity, pMin: -Infinity,
    f: (x, a) => Math.pow(a, x),
    df: (x, a) => Math.pow(a, x) * Math.log(a),
    dominio: () => true,
    janela: (a) => {
      const ymax = Math.max(4, Math.min(12, Math.ceil(Math.pow(Math.max(a, 1 / a), 2.5))));
      return { x: [-3, 3], y: [-ymax / 8, ymax] };
    },
    zeros: () => [],
    nome: (a) => `${aTxt(a)} elevado a x`,
    tex: {
      f: (a) => `f(x)=${aTex(a)}^{x}`,
      regra: (a) => [`(a^{x})'=a^{x}\\ln a\\qquad(a=${aTex(a)})`],
      der: (a) => (a === E ? "f'(x)=e^{x}\\ln e=e^{x}" : `f'(x)=${aTex(a)}^{x}\\ln ${aTex(a)}`),
      valor: (x0, a) => `f'(x_0)=${aTex(a)}^{${nt(x0, 2)}}\\times\\ln ${aTex(a)}`,
    },
    erro: {
      rotulo: 'Erro típico: esquecer o ln a',
      tex: (x0, a) => `${aTex(a)}^{${nt(x0, 2)}}`,
      valor: (x0, a) => Math.pow(a, x0),
    },
  },
  {
    id: 'ln', cor: 'log', param: false, assintotaV: true, chip: '\\ln x', aria: 'logaritmo neperiano de x',
    expr: 'ln(x)', x0: 2, inf: 0, pMin: 0.03,
    f: (x) => Math.log(x),
    df: (x) => 1 / x,
    dominio: (x) => x > 0,
    janela: () => ({ x: [-0.8, 6], y: [-4, 3] }),
    zeros: () => [],
    nome: () => 'logaritmo neperiano de x',
    fronteira: {
      limiar: 0.2,
      texto: 'Perto de x = 0, a fronteira do domínio, o declive 1/x₀ é enorme e a tangente fica quase vertical. Em x = 0 a função nem existe.',
    },
    tex: {
      f: () => 'f(x)=\\ln x',
      regra: () => ["(\\ln x)'=\\frac{1}{x}"],
      der: () => "f'(x)=\\frac{1}{x}",
      valor: (x0) => `f'(x_0)=\\frac{1}{${nt(x0, 2)}}`,
    },
    erro: null,
  },
  {
    id: 'loga', cor: 'log', param: true, assintotaV: true, chip: '\\log_a x', aria: 'logaritmo de x na base a',
    expr: 'logb(a, x)', x0: 2, inf: 0, pMin: 0.03,
    f: (x, a) => Math.log(x) / Math.log(a),
    df: (x, a) => 1 / (x * Math.log(a)),
    dominio: (x) => x > 0,
    janela: () => ({ x: [-0.8, 6], y: [-4, 4] }),
    zeros: () => [],
    nome: (a) => `logaritmo de x na base ${aTxt(a)}`,
    fronteira: {
      limiar: 0.2,
      texto: 'Perto de x = 0, a fronteira do domínio, o declive 1/(x₀ ln a) é enorme e a tangente fica quase vertical. Em x = 0 a função nem existe.',
    },
    tex: {
      f: (a) => `f(x)=\\log_{${aTex(a)}}x`,
      regra: (a) => [`(\\log_a x)'=\\frac{1}{x\\ln a}\\qquad(a=${aTex(a)})`],
      der: (a) => `f'(x)=\\frac{1}{x\\ln ${aTex(a)}}`,
      valor: (x0, a) => `f'(x_0)=\\frac{1}{${nt(x0, 2)}\\times\\ln ${aTex(a)}}`,
    },
    erro: {
      rotulo: 'Erro típico: esquecer o ln a',
      tex: (x0) => `\\frac{1}{${nt(x0, 2)}}`,
      valor: (x0) => 1 / x0,
    },
  },
  {
    id: 'exp2', cor: 'exp', param: false, chip: 'e^{2x-1}', aria: 'e elevado a 2x menos 1',
    expr: 'e^(2*x-1)', x0: 1, inf: -Infinity, pMin: -Infinity,
    f: (x) => Math.exp(2 * x - 1),
    df: (x) => 2 * Math.exp(2 * x - 1),
    dominio: () => true,
    janela: () => ({ x: [-2, 2.5], y: [-1.5, 12] }),
    zeros: () => [],
    nome: () => 'e elevado a 2x menos 1',
    tex: {
      f: () => 'f(x)=e^{2x-1}',
      regra: () => ["(e^{u})'=u'\\,e^{u}", "u=2x-1,\\qquad u'=2"],
      der: () => "f'(x)=2\\,e^{2x-1}",
      valor: (x0) => `f'(x_0)=2\\,e^{2\\times${par(x0)}-1}`,
    },
    erro: {
      rotulo: "Erro típico: esquecer o u'",
      tex: (x0) => `e^{2\\times${par(x0)}-1}`,
      valor: (x0) => Math.exp(2 * x0 - 1),
    },
  },
  {
    id: 'ln2', cor: 'log', param: false, chip: '\\ln(x^{2}+1)', aria: 'logaritmo neperiano de x ao quadrado mais 1',
    expr: 'ln(x^2+1)', x0: 1, inf: -Infinity, pMin: -Infinity,
    f: (x) => Math.log(x * x + 1),
    df: (x) => (2 * x) / (x * x + 1),
    dominio: () => true,
    janela: () => ({ x: [-4, 4], y: [-0.6, 3] }),
    zeros: () => [0],
    nome: () => 'logaritmo neperiano de x ao quadrado mais 1',
    tex: {
      f: () => 'f(x)=\\ln(x^{2}+1)',
      regra: () => ["(\\ln u)'=\\frac{u'}{u}", "u=x^{2}+1,\\qquad u'=2x"],
      der: () => "f'(x)=\\frac{2x}{x^{2}+1}",
      valor: (x0) => `f'(x_0)=\\frac{2\\times${par(x0)}}{${par(x0)}^{2}+1}`,
    },
    erro: {
      rotulo: "Erro típico: esquecer o u'",
      tex: (x0) => `\\frac{1}{${par(x0)}^{2}+1}`,
      valor: (x0) => 1 / (x0 * x0 + 1),
    },
  },
  {
    id: 'xex', cor: 'exp', param: false, chip: 'x\\,e^{x}', aria: 'x vezes e elevado a x',
    expr: 'x*e^x', x0: 0.5, inf: -Infinity, pMin: -Infinity,
    f: (x) => x * Math.exp(x),
    df: (x) => (1 + x) * Math.exp(x),
    dominio: () => true,
    janela: () => ({ x: [-4, 1.3], y: [-0.6, 3] }),
    zeros: () => [-1],
    nome: () => 'x vezes e elevado a x',
    tex: {
      f: () => 'f(x)=x\\,e^{x}',
      regra: () => ["(uv)'=u'v+uv'", "u=x,\\ v=e^{x}\\ \\Rightarrow\\ u'=1,\\ v'=e^{x}"],
      der: () => "f'(x)=1\\times e^{x}+x\\,e^{x}=(1+x)\\,e^{x}",
      valor: (x0) => `f'(x_0)=(1+${par(x0)})\\,e^{${nt(x0, 2)}}`,
    },
    erro: {
      rotulo: 'Erro típico: derivar cada fator e multiplicar',
      tex: (x0) => `1\\times e^{${nt(x0, 2)}}`,
      valor: (x0) => Math.exp(x0),
    },
  },
  {
    id: 'xlnx', cor: 'log', param: false, chip: 'x\\ln x', aria: 'x vezes logaritmo neperiano de x',
    expr: 'x*ln(x)', x0: 0.5, inf: 0, pMin: 0.03, buraco: true,
    f: (x) => x * Math.log(x),
    df: (x) => Math.log(x) + 1,
    dominio: (x) => x > 0,
    janela: () => ({ x: [-0.3, 3.2], y: [-0.7, 3] }),
    zeros: () => [Math.exp(-1)],
    nome: () => 'x vezes logaritmo neperiano de x',
    fronteira: {
      limiar: 0.1,
      texto: 'Perto de x = 0 a tangente fica cada vez mais inclinada, porque f′(x) = ln x + 1 tende para −∞. Em x = 0 a função não está definida (só o limite é 0).',
    },
    tex: {
      f: () => 'f(x)=x\\ln x',
      regra: () => ["(uv)'=u'v+uv'", "u=x,\\ v=\\ln x\\ \\Rightarrow\\ u'=1,\\ v'=\\frac{1}{x}"],
      der: () => "f'(x)=1\\times\\ln x+x\\times\\frac{1}{x}=\\ln x+1",
      valor: (x0) => `f'(x_0)=\\ln ${nt(x0, 2)}+1`,
    },
    erro: {
      rotulo: 'Erro típico: derivar cada fator e multiplicar',
      tex: (x0) => `1\\times\\frac{1}{${nt(x0, 2)}}`,
      valor: (x0) => 1 / x0,
    },
  },
];

// ---------- Configuração, leituras e tangente (puras, sem DOM) ----------

/**
 * Janela do gráfico e intervalo [lo, hi] onde o ponto P se pode mover, para a função `fi` e a
 * base `a`. P fica sempre dentro do desenho (senão desaparecia e perdia o foco): só se aceitam
 * os x, de 0,01 em 0,01, em que a curva está na janela, a partir do x₀ inicial.
 */
export function configuracao(fi, a) {
  const fam = FAMILIAS[fi];
  const { x: jx, y: jy } = fam.janela(a);
  const folga = 0.04 * (jy[1] - jy[0]);
  const k0 = Math.ceil(jx[0] * 100 - 1e-9);
  const k1 = Math.floor(jx[1] * 100 + 1e-9);
  const bom = (k) => {
    const x = k / 100;
    if (!fam.dominio(x) || x < fam.pMin) return false;
    const y = fam.f(x, a);
    return Number.isFinite(y) && y >= jy[0] + folga && y <= jy[1] - folga;
  };
  const kc = Math.round(fam.x0 * 100);
  let melhor = null;
  for (let d = 0; d <= k1 - k0 && melhor === null; d++) {
    for (const k of [kc - d, kc + d]) {
      if (k >= k0 && k <= k1 && bom(k)) { melhor = k; break; }
    }
  }
  if (melhor === null) melhor = kc;
  let lo = melhor;
  let hi = melhor;
  while (lo - 1 >= k0 && bom(lo - 1)) lo--;
  while (hi + 1 <= k1 && bom(hi + 1)) hi++;
  return { x: jx, y: jy, p: [lo / 100, hi / 100], x0: melhor / 100 };
}

/** Tudo o que se lê no ponto x0 com a distância h. `ok` é false fora do domínio ou se algo não for finito. */
export function leituras(fi, a, x0, h) {
  const fam = FAMILIAS[fi];
  const r = { ok: false, x0, h };
  if (!Number.isFinite(x0) || !Number.isFinite(h) || !(h > 0) || !fam.dominio(x0)) return r;
  r.f0 = fam.f(x0, a);
  r.f1 = fam.f(x0 + h, a);
  r.m = fam.df(x0, a);
  r.ms = (r.f1 - r.f0) / h;
  r.dif = Math.abs(r.ms - r.m);
  r.ok = [r.f0, r.f1, r.m, r.ms, r.dif].every(Number.isFinite);
  return r;
}

/**
 * A reta y = f'(x0)(x - x0) + f(x0) com números (3 casas, vírgula decimal). Devolve o LaTeX da
 * forma com x - x0 (`tex`), o da forma y = mx + b (`tex2`) e o texto simples (`txt`). O sinal «=»
 * só aparece quando os números arredondados são exatos.
 */
export function equacaoTangente(x0, f0, m) {
  const r3 = (v) => sem0(Math.round(v * 1000) / 1000);
  const mr = r3(m);
  const fr = r3(f0);
  const br = r3(f0 - m * x0);
  const sg = (v) => (v < 0 ? '-' : '+');
  const termoX = x0 === 0 ? 'x' : x0 > 0 ? `(x-${nt(x0, 2)})` : `(x+${nt(-x0, 2)})`;
  const exata1 = Math.abs(m - mr) < 1e-9 && Math.abs(f0 - fr) < 1e-9;
  const exata2 = Math.abs(m - mr) < 1e-9 && Math.abs(f0 - m * x0 - br) < 1e-9;
  const tex1 = `y${exata1 ? '=' : '\\approx'}${nt(mr, 3)}\\,${termoX}${sg(fr)}${nt(Math.abs(fr), 3)}`;
  const tex2 = mr === 0
    ? `y${exata2 ? '=' : '\\approx'}${nt(br, 3)}`
    : `y${exata2 ? '=' : '\\approx'}${nt(mr, 3)}\\,x${sg(br)}${nt(Math.abs(br), 3)}`;
  const tx = x0 === 0 ? 'x' : x0 > 0 ? `(x − ${M.fmt(x0, 2)})` : `(x + ${M.fmt(-x0, 2)})`;
  const txt = `y ${exata1 ? '=' : '≈'} ${M.fmt(mr, 3)} ${tx} ${fr < 0 ? '−' : '+'} ${M.fmt(Math.abs(fr), 3)}`;
  return { tex: tex1, tex2, txt, m: mr, f0: fr, b: br };
}

// ---------- O widget ----------

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

export async function montar(el, dados) {
  const id = `dv${++contador}`;
  const est = { fi: 0, a: 2, x0: 1, hi: 2, sinal: false }; // hi: índice em H_LISTA
  let cfg = configuracao(est.fi, est.a);
  est.x0 = cfg.x0;
  let g = null;
  let ctl = null;
  let W = 0;
  let sec = null;
  let tang = null;
  let ptQ = null;
  let rotP = null;
  let rotQ = null;
  let anim = 0;
  let tAnuncio = 0;
  let interagiu = false; // só se anuncia (aria-live) depois de o aluno mexer em algo
  const F = () => FAMILIAS[est.fi];
  const ff = (x) => F().f(x, est.a);
  const dff = (x) => F().df(x, est.a);
  const reduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- estrutura ---
  const chips = FAMILIAS.map((f, i) => {
    const b = h('button', { type: 'button', class: 'chip dv-chip', 'aria-pressed': 'false', 'aria-label': f.aria, 'data-fn': f.id });
    b.innerHTML = tex(f.chip);
    b.addEventListener('click', () => { interagiu = true; escolher(i); });
    return b;
  });
  const grupoChips = (rotulo, lista) => {
    const idRot = `${id}-g${rotulo}`;
    return h('div', { class: 'dv-grupo' },
      h('span', { class: 'dv-grupo__rotulo', id: idRot }, rotulo),
      h('div', { class: 'chips dv-chips', role: 'group', 'aria-labelledby': idRot }, ...lista));
  };
  const escolhas = h('div', { class: 'dv-escolhas' },
    grupoChips('Base', chips.slice(0, 4)), grupoChips('Compostas', chips.slice(4)));

  const lienzo = h('div', { class: 'dv-lienzo' });
  const legenda = h('ul', { class: 'dv-legenda' });
  const btnSinal = h('button', { type: 'button', class: 'chip dv-sinal', 'aria-pressed': 'false' }, 'Mostrar o sinal de f′');
  const dica = h('p', { class: 'nota dv-dica' },
    'Arrasta P pela curva (ou toca no gráfico). Com o teclado: foca P e usa as setas.');

  // slider da base a (só para a^x e log_a x)
  const idA = `${id}-a`;
  const sA = h('input', { type: 'range', id: idA, min: 0, max: A_LISTA.length - 1, step: 1, 'data-param': 'a' });
  const outA = h('output', { for: idA });
  const btnE = h('button', { type: 'button', class: 'botao botao--suave botao--mini dv-btn-e' }, 'a = e');
  const ctrlA = h('div', { class: 'controlo dv-controlo dv-controlo--a', hidden: true },
    h('div', { class: 'dv-controlo__linha' }, h('label', { for: idA }, 'Base a'), outA, btnE), sA);

  // slider de h (escala logarítmica por índice: à direita h é mais pequeno)
  const idH = `${id}-h`;
  const sH = h('input', { type: 'range', id: idH, min: 0, max: H_LISTA.length - 1, step: 1, 'data-param': 'h' });
  const outH = h('output', { for: idH });
  const btnZero = h('button', { type: 'button', class: 'botao botao--mini dv-btn-zero', 'aria-label': 'Fazer h tender para zero' }, 'h → 0');
  const ctrlH = h('div', { class: 'controlo dv-controlo dv-controlo--h' },
    h('div', { class: 'dv-controlo__linha' }, h('label', { for: idH }, 'Distância h entre P e Q'), outH, btnZero),
    sH,
    h('div', { class: 'dv-escala', 'aria-hidden': 'true' }, h('span', {}, 'h = 2'), h('span', {}, 'h = 0,001')));
  const legendaSec = h('p', { class: 'nota dv-formula-sec' });
  legendaSec.innerHTML = `Declive da secante PQ: ${tex('\\dfrac{f(x_0+h)-f(x_0)}{h}')}`;
  const controlos = h('div', { class: 'controlos dv-controlos' }, ctrlA, ctrlH, legendaSec);

  // leituras
  const nos = {};
  const leiturasEl = h('div', { class: 'leituras dv-leituras' });
  const novaLeitura = (chave, rotulo, classe, larga) => {
    const rot = h('span', { class: 'leitura__rotulo' }, rotulo);
    const val = h('span', { class: 'leitura__valor' });
    const caixa = h('div', { class: `leitura dv-leitura ${classe || ''}${larga ? ' dv-leitura--larga' : ''}`, 'data-leitura': chave }, rot, val);
    nos[chave] = { caixa, rot, valor: val };
    leiturasEl.append(caixa);
  };
  novaLeitura('x0', 'x₀', '');
  novaLeitura('f0', 'f(x₀)', '');
  novaLeitura('q', 'Q = (x₀+h; f(x₀+h))', 'dv-leitura--sec');
  novaLeitura('ms', 'Declive da secante', 'dv-leitura--sec');
  novaLeitura('m', 'Declive pela fórmula, f′(x₀)', 'leitura--der');
  novaLeitura('dif', 'Diferença entre os declives', '');
  novaLeitura('eq', 'Equação da tangente em P', 'leitura--der', true);
  novaLeitura('obs', 'Observação', 'dv-leitura--obs', true);
  novaLeitura('erro', '', 'dv-leitura--erro', true);
  novaLeitura('sinal', 'Sinal de f′ em P', 'dv-leitura--sinal', true);

  const notaDominio = h('p', { class: 'nota dv-nota-dominio', hidden: true });
  const notaQ = h('p', { class: 'nota dv-nota-q', hidden: true },
    'O ponto Q está fora do desenho, mas o declive da secante continua a ser calculado.');

  // cartão da fórmula
  const nosF = {};
  const cartaoF = h('div', { class: 'dv-regra' });
  for (const [chave, rotulo] of [['f', 'Função'], ['regra', 'Regra usada'], ['der', 'Derivada'], ['valor', 'No ponto P']]) {
    const val = h('div', { class: 'dv-regra__valor' });
    nosF[chave] = val;
    cartaoF.append(h('div', { class: 'dv-regra__linha', 'data-regra': chave }, h('span', { class: 'dv-regra__rotulo' }, rotulo), val));
  }

  // texto lido em voz alta: atualiza-se com atraso, para não ler cada passo de um arrasto
  const estado = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });

  const colGrafico = h('div', { class: 'dv-col dv-col--grafico' },
    lienzo, legenda, dica, controlos, h('div', { class: 'dv-acoes' }, btnSinal));
  const colPainel = h('div', { class: 'dv-col dv-col--painel' }, leiturasEl, notaDominio, notaQ, cartaoF);
  const raiz = h('div', { class: 'widget dv' },
    h('p', { class: 'widget__titulo' }, 'A derivada é o declive da tangente'),
    h('p', { class: 'dv-intro' },
      'A reta roxa é a tangente em P. A tracejada passa por P e por Q, a uma distância h. Faz h tender para 0 e vê o declive da secante aproximar-se do da tangente.'),
    escolhas,
    h('div', { class: 'dv-layout' }, colGrafico, colPainel),
    estado);
  el.replaceChildren(raiz);

  // --- gráfico ---
  const larguraAtual = () => Math.round(limitar(lienzo.clientWidth || 340, LARGURA_MIN, LARGURA_MAX));

  function curvas() {
    const fam = F();
    if (!est.sinal) {
      g.curva(ff, { cor: fam.cor, espessura: 2.8, id: 'f' });
      return;
    }
    // curva em dois tons: parte-se nos zeros de f' e pinta-se cada pedaço pelo sinal de f'
    const zs = fam.zeros(est.a).filter((z) => z > cfg.x[0] && z < cfg.x[1]);
    const lim = [Math.max(cfg.x[0], fam.inf), ...zs, cfg.x[1]];
    for (let i = 0; i < lim.length - 1; i++) {
      const meio = (lim[i] + lim[i + 1]) / 2;
      const sobe = dff(meio) > 0;
      g.curva(ff, { de: lim[i], ate: lim[i + 1], cor: sobe ? COR_SOBE : COR_DESCE, espessura: 3.4, id: `sinal${i}` });
    }
    const largura = (cfg.x[1] - cfg.x[0]) * 0.07;
    for (const z of zs) {
      g.segmento(z - largura, ff(z), z + largura, ff(z), { cor: 'der', tracejado: true, espessura: 1.6 });
      g.ponto(z, ff(z), { oco: true, cor: 'der', raio: 5.5 });
    }
  }

  function construir() {
    const fam = F();
    W = larguraAtual();
    g = criarGrafico({
      x: cfg.x, y: cfg.y, largura: W, altura: Math.round(W * 0.8),
      aria: `Gráfico de ${fam.nome(est.a)}, com o ponto P, a tangente e a secante.`,
    });
    if (fam.assintotaV) g.retaVertical(0, { rotulo: 'x = 0', posRotulo: 'baixo' }); // x ln x não tem: o limite em 0 existe
    curvas();
    if (fam.buraco) g.ponto(0, 0, { oco: true });
    ptQ = g.ponto(est.x0, 0, { cor: 'id', raio: 4.5, fora: true, id: 'Q' });
    sec = tang = rotP = rotQ = null;
    ctl = arrastarNaCurva(g, ff, {
      x0: est.x0,
      xmin: cfg.p[0],
      xmax: cfg.p[1],
      passoTeclado: 0.05,
      aoMover: (x) => {
        interagiu = true;
        const xr = limitar(r2(x), cfg.p[0], cfg.p[1]);
        if (Math.abs(xr - x) > 1e-9) ctl.mover(xr, false);
        est.x0 = xr;
        atualizar();
      },
      aria: 'Ponto P sobre a curva. Setas esquerda e direita para o mover.',
      textoAria: (x) => {
        const xr = r2(x);
        return `x₀ = ${M.fmt(xr, 2)}; f(x₀) = ${nf(ff(xr), 3)}; declive da tangente ${nf(dff(xr), 4)}`;
      },
    });
    const tinhaFoco = lienzo.contains(document.activeElement); // o ponto P pode ter o foco (teclado)
    lienzo.replaceChildren(g.svg);
    if (tinhaFoco) { try { ctl.el.focus({ preventScroll: true }); } catch { /* sem foco */ } }
    legendaAtualizar();
  }

  function legendaAtualizar() {
    const fam = F();
    const am = (classe, extra = '') => criar('svg', { class: 'dv-amostra', width: 30, height: 10, viewBox: '0 0 30 10', 'aria-hidden': 'true' },
      [criar('line', { class: `${classe}${extra}`, x1: 1, y1: 5, x2: 29, y2: 5 })]);
    const itens = [];
    if (est.sinal) {
      const zs = fam.zeros(est.a).filter((z) => z > cfg.x[0] && z < cfg.x[1]);
      const lim = [Math.max(cfg.x[0], fam.inf), ...zs, cfg.x[1]];
      let sobe = false;
      let desce = false;
      for (let i = 0; i < lim.length - 1; i++) {
        if (dff((lim[i] + lim[i + 1]) / 2) > 0) sobe = true; else desce = true;
      }
      if (sobe) itens.push([am('dv-am dv-am--sobe'), 'f′ > 0: a função sobe']);
      if (desce) itens.push([am('dv-am dv-am--desce'), 'f′ < 0: a função desce']);
      if (zs.length) itens.push([am('dv-am dv-am--zero'), 'f′ = 0: tangente horizontal']);
    } else {
      itens.push([am(`dv-am dv-am--${fam.cor}`), 'Curva f']);
    }
    itens.push([am('dv-am dv-am--tang'), 'Tangente em P']);
    itens.push([am('dv-am dv-am--sec'), 'Secante PQ']);
    legenda.replaceChildren(...itens.map(([a, t]) => h('li', {}, a, t)));
  }

  // tangente, secante, Q e os rótulos P e Q: refazem-se a cada passo (são poucos elementos)
  function desenharDinamico(r) {
    if (sec) sec.remover();
    if (tang) tang.remover();
    if (rotP) rotP.remover();
    if (rotQ) rotQ.remover();
    sec = tang = rotP = rotQ = null;
    if (!r.ok) {
      ptQ.mover(NaN, NaN, false);
      return;
    }
    sec = g.reta(r.ms, r.f0 - r.ms * r.x0, { cor: 'id', tracejado: '8 5', espessura: 3.2, id: 'secante' });
    tang = g.reta(r.m, r.f0 - r.m * r.x0, { cor: 'der', espessura: 2, id: 'tangente' });
    const xq = r.x0 + r.h;
    ptQ.mover(xq, r.f1, false);
    const sobe = r.m > 0;
    rotP = g.rotulo(r.x0, r.f0, 'P', { cor: 'der', peso: 700, dx: 9, dy: sobe ? 19 : -9 });
    const longe = Math.hypot(g.X(xq) - g.X(r.x0), g.Y(r.f1) - g.Y(r.f0)) > 22;
    if (longe) rotQ = g.rotulo(xq, r.f1, 'Q', { cor: 'id', peso: 700, ancora: 'end', dx: -9, dy: sobe ? -9 : 19 });
  }

  // --- leituras ---
  const ultimo = new Map();
  function poe(chave, conteudo, html) {
    const marca = (html ? 'H' : 'T') + conteudo;
    if (ultimo.get(chave) === marca) return;
    ultimo.set(chave, marca);
    if (html) nos[chave].valor.innerHTML = conteudo;
    else nos[chave].valor.textContent = conteudo;
  }
  function poeF(chave, conteudo) {
    const marca = `H${conteudo}`;
    if (ultimo.get(`F${chave}`) === marca) return;
    ultimo.set(`F${chave}`, marca);
    nosF[chave].innerHTML = conteudo;
  }
  function poeRotulo(chave, texto) {
    if (nos[chave].rot.textContent !== texto) nos[chave].rot.textContent = texto;
  }

  function sinalTexto(m) {
    if (!Number.isFinite(m)) return SEM_VALOR;
    if (Math.abs(m) < 1e-9) return 'f′(x₀) = 0: a tangente é horizontal, pode haver extremo.';
    if (m > 0) return `f′(x₀) = ${nf(m, 4)} > 0: a tangente sobe e a função sobe em P.`;
    return `f′(x₀) = ${nf(m, 4)} < 0: a tangente desce e a função desce em P.`;
  }

  function pintar(r) {
    const fam = F();
    const a = est.a;
    const hh = H_LISTA[est.hi];
    const ok = r.ok;

    // cartão da fórmula
    poeF('f', tex(fam.tex.f(a)));
    poeF('regra', fam.tex.regra(a).map((l) => `<div>${tex(l)}</div>`).join(''));
    poeF('der', tex(fam.tex.der(a)));
    let valorTex = fam.tex.valor(est.x0, a);
    if (ok) valorTex += `${Math.abs(r.m - Number(r.m.toFixed(4))) < 1e-9 ? '=' : '\\approx'}${nt(r.m, 4)}`;
    poeF('valor', ok ? tex(valorTex) : SEM_VALOR);

    // leituras numéricas
    poe('x0', nf(r.x0, 2));
    poe('f0', nf(r.f0, 4));
    poe('q', ok ? `(${curto(r.x0 + hh, 4)}; ${nf(r.f1, 4)})` : SEM_VALOR);
    poe('ms', nf(r.ms, 4));
    poe('m', nf(r.m, 4));
    poe('dif', nf(r.dif, 4));
    let eq = null;
    if (ok) {
      eq = equacaoTangente(r.x0, r.f0, r.m);
      poe('eq', `${tex(eq.tex)}<br>${tex(eq.tex2)}`, true);
    } else {
      poe('eq', SEM_VALOR);
    }

    // observação: e^x e a^x
    const comE = fam.id === 'exp' || (fam.id === 'pot' && a === E);
    const obs = nos.obs.caixa;
    if (ok && comE) {
      obs.hidden = false;
      poe('obs', `${tex(`f'(x_0)=f(x_0)=${nt(r.f0, 4)}`)}<br>O declive é igual ao valor da função. Só a exponencial de base ${tex('e')} faz isto em todos os pontos.`, true);
    } else if (ok && fam.id === 'pot') {
      obs.hidden = false;
      poe('obs', `${tex(`\\dfrac{f'(x_0)}{f(x_0)}=\\dfrac{${nt(r.m, 4)}}{${nt(r.f0, 4)}}\\approx${nt(r.m / r.f0, 4)}`)}<br>`
        + `Esta razão é a mesma em todos os pontos: ${tex(`\\ln a=\\ln ${aTex(a)}\\approx${nt(Math.log(a), 4)}`)}. Só vale 1 quando ${tex('a=e')}.`, true);
    } else {
      obs.hidden = true;
    }

    // erro típico
    const erro = nos.erro.caixa;
    if (ok && fam.erro) {
      erro.hidden = false;
      const errado = fam.erro.valor(r.x0, a);
      poeRotulo('erro', fam.erro.rotulo);
      const igual = Math.abs(errado - r.m) < 5e-5;
      const semLn = a === E && (fam.id === 'pot' || fam.id === 'loga');
      poe('erro', `${tex(`${fam.erro.tex(r.x0, a)}\\approx${nt(errado, 4)}`)}<br>`
        + (semLn ? `Com ${tex('a=e')} tem-se ${tex('\\ln e=1')}, por isso aqui esquecer o ${tex('\\ln a')} não se nota.`
          : igual ? `Aqui calha dar o mesmo valor que o certo, ${nf(r.m, 4)}.`
            : `O declive da tangente é ${nf(r.m, 4)}, por isso este valor está errado.`), true);
    } else {
      erro.hidden = true;
    }

    // sinal
    nos.sinal.caixa.hidden = !est.sinal;
    if (est.sinal) poe('sinal', sinalTexto(r.m));

    // notas
    let nota = '';
    if (!fam.dominio(r.x0)) nota = 'Este x₀ está fora do domínio da função, por isso não há valores para mostrar.';
    else if (fam.fronteira && r.x0 <= fam.fronteira.limiar) nota = fam.fronteira.texto;
    notaDominio.textContent = nota;
    notaDominio.hidden = nota === '';
    const xq = r.x0 + hh;
    notaQ.hidden = !ok || (xq <= cfg.x[1] && r.f1 >= cfg.y[0] && r.f1 <= cfg.y[1]);

    // aria-live com atraso
    const partes = [`${fam.nome(a)}.`];
    if (ok) {
      partes.push(`x₀ = ${nf(r.x0, 2)}, f(x₀) = ${nf(r.f0, 4)}, h = ${hTxt(hh)}.`,
        `Declive da secante ${nf(r.ms, 4)}, declive pela fórmula ${nf(r.m, 4)}, diferença ${nf(r.dif, 4)}.`,
        `Tangente: ${eq.txt}.`);
      if (est.sinal) partes.push(sinalTexto(r.m));
    } else {
      partes.push('Sem valores neste ponto.');
    }
    if (nota) partes.push(nota);
    anunciar(partes.join(' '));
  }

  function anunciar(txt) {
    if (!interagiu) return;
    clearTimeout(tAnuncio);
    tAnuncio = setTimeout(() => { estado.textContent = txt; }, 700);
  }

  function atualizar() {
    const r = leituras(est.fi, est.a, est.x0, H_LISTA[est.hi]);
    desenharDinamico(r);
    pintar(r);
  }

  // --- controlos ---
  function mostrarControlos() {
    const fam = F();
    chips.forEach((b, i) => b.setAttribute('aria-pressed', String(i === est.fi)));
    ctrlA.hidden = !fam.param;
    sA.value = A_LISTA.indexOf(est.a);
    outA.textContent = est.a === E ? 'a = e ≈ 2,718' : `a = ${aTxt(est.a)}`;
    sA.setAttribute('aria-valuetext', est.a === E ? 'a igual a e, aproximadamente 2,718' : `a igual a ${aTxt(est.a)}`);
    sH.value = est.hi;
    const hh = H_LISTA[est.hi];
    outH.textContent = `h = ${hTxt(hh)}`;
    sH.setAttribute('aria-valuetext', `h igual a ${hTxt(hh)}`);
    btnSinal.setAttribute('aria-pressed', String(est.sinal));
  }

  function escolher(i) {
    pararAnim();
    est.fi = i;
    cfg = configuracao(est.fi, est.a);
    est.x0 = cfg.x0;
    mostrarControlos();
    construir();
    atualizar();
  }

  function mudarA(i) {
    est.a = A_LISTA[limitar(i, 0, A_LISTA.length - 1)];
    cfg = configuracao(est.fi, est.a);
    est.x0 = limitar(r2(est.x0), cfg.p[0], cfg.p[1]);
    mostrarControlos();
    construir();
    atualizar();
  }

  function definirH(i) {
    est.hi = limitar(i, 0, H_LISTA.length - 1);
    mostrarControlos();
    atualizar();
  }

  function pararAnim() {
    if (anim) { clearInterval(anim); anim = 0; }
  }

  function fazerHZero() {
    pararAnim();
    const fim = H_LISTA.length - 1;
    if (reduzido()) { definirH(fim); return; }
    if (est.hi >= fim) definirH(0);
    anim = setInterval(() => {
      if (est.hi >= fim) { pararAnim(); return; }
      definirH(est.hi + 1);
    }, 200);
  }

  sA.addEventListener('input', () => { interagiu = true; mudarA(Number(sA.value)); });
  btnE.addEventListener('click', () => { interagiu = true; mudarA(A_LISTA.indexOf(E)); });
  sH.addEventListener('input', () => { interagiu = true; pararAnim(); definirH(Number(sH.value)); });
  btnZero.addEventListener('click', () => { interagiu = true; fazerHZero(); });
  btnSinal.addEventListener('click', () => {
    interagiu = true;
    est.sinal = !est.sinal;
    mostrarControlos();
    construir();
    atualizar();
  });

  // --- arranque e redimensionamento ---
  mostrarControlos();
  construir();
  atualizar();

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (Math.abs(larguraAtual() - W) >= 2) {
        construir();
        atualizar();
      }
    }).observe(lienzo);
  }
}
