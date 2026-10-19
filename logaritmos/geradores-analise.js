// Geradores de perguntas do treino sobre análise de funções: limites, derivadas, reta
// tangente, e monotonia, extremos e contradomínio.
// Módulo autónomo (não importa geradores.js, para não haver importações circulares);
// geradores.js junta TIPOS_ANALISE à lista TIPOS.
// Tipos: 'limite', 'derivada', 'tangente', 'monotonia-contradominio'. Estão todos testados em
// tests/geradores-analise.html, que recalcula a resposta certa por diferenças finitas a partir
// do LaTeX que o aluno vê (o texto das opções é a única fonte de verdade).
// Contrato da pergunta: ver o cabeçalho de geradores.js (modo 'escolha', 4 opções, uma só
// com correta: true, explicacao, verificacao com os dados para recalcular o resultado).
// As opções destes tipos não levam `expr`: a resposta é uma expressão em x, uma reta ou um
// intervalo, e os testes lêem o `tex`.

import * as M from '../assets/motor/matematica.js';

const T = String.raw; // texto com barras do LaTeX sem as dobrar
const um = (rng, lista) => M.escolher(rng, lista);

// ---------- Ajudas de texto ----------

/** Coeficiente colado a uma expressão: 1 -> '', -1 -> '-', 3 -> '3'. */
const coef = (n) => (n === 1 ? '' : n === -1 ? '-' : String(n));
/** n·x: x, -x, 3x. */
const coefX = (n, x = 'x') => `${coef(n)}${x}`;
/** Soma de termos já escritos; salta os vazios e troca «+-» por «-». */
const soma = (...ts) => ts.filter((t) => t !== '' && t !== null && t !== undefined).join('+').replace(/\+-/g, '-');
/** Coeficiente racional colado a uma expressão: 1 -> '', -1 -> '-', 3/2 -> \dfrac{3}{2}. */
function fracCoef(p, q) {
  [p, q] = M.reduzir(p, q);
  return q === 1 ? coef(p) : T`${p < 0 ? '-' : ''}\dfrac{${Math.abs(p)}}{${q}}`;
}
/** Produto «c · potência de x · fator»: o espaço fino evita que «x e^{..}» se leia «xe». */
const prod = (c, xs, resto) => `${c}${xs}${xs ? T`\,` : ''}${resto}`;

/**
 * Escolhe `n` itens { k, tex } com chaves diferentes entre si e das `vistas`. Cada grupo é
 * baralhado e os primeiros grupos têm prioridade (erros mais típicos primeiro).
 */
function escolherN(rng, grupos, vistas, n = 3, estrito = true) {
  const out = [];
  for (const g of grupos) {
    for (const c of M.baralhar(rng, g.filter(Boolean))) {
      if (out.length >= n) return out;
      if (vistas.has(c.k)) continue;
      vistas.add(c.k);
      out.push(c);
    }
  }
  if (estrito && out.length < n) throw new Error(`poucos distratores (${out.length} em vez de ${n})`);
  return out;
}

/** Junta a correta e os distratores, baralha e devolve a pergunta. */
function escolha(rng, tipo, { enunciado, correta, outras, explicacao, verificacao }) {
  const todas = [{ tex: correta, correta: true }, ...outras.map((o) => ({ tex: o.tex, correta: false }))];
  return { tipo, modo: 'escolha', enunciado, opcoes: M.baralhar(rng, todas), explicacao, verificacao };
}

/** Se `fn` falhar, a mensagem diz de que família vinha o erro. */
function comContexto(nome, fn) {
  try { return fn(); } catch (e) { throw new Error(`${nome}: ${e.message}`); }
}

const textos = (lista) => lista.filter((t) => t !== null && t !== undefined).map((tex) => ({ k: tex, tex }));

// ---------- Números exatos: somas de racional × e^k ----------
// Um número é um Map «2k -> [p, q]» que representa Σ (p/q)·e^(2k/2); as chaves em meios
// permitem √e. Servem para a ordenada, o declive e o ponto de tangência com e, 1/e, e²...

const L = (p = 0, q = 1, k = 0) => {
  const r = new Map();
  if (p !== 0) r.set(Math.round(2 * k), M.reduzir(p, q));
  return r;
};
const E = (k) => L(1, 1, k);
function lSoma(x, y) {
  const r = new Map(x);
  for (const [k, [p, q]] of y) {
    const a = r.get(k);
    const s = a ? M.reduzir(a[0] * q + p * a[1], a[1] * q) : [p, q];
    if (s[0] === 0) r.delete(k);
    else r.set(k, s);
  }
  return r;
}
const lNeg = (x) => new Map([...x].map(([k, [p, q]]) => [k, [-p, q]]));
const lSub = (x, y) => lSoma(x, lNeg(y));
function lMul(x, y) {
  let r = new Map();
  for (const [k1, [p1, q1]] of x) {
    for (const [k2, [p2, q2]] of y) r = lSoma(r, new Map([[k1 + k2, M.reduzir(p1 * p2, q1 * q2)]]));
  }
  return r;
}
/** Inverso de um número com um só termo. */
function lInv(x) {
  if (x.size !== 1) return null;
  const [[k, [p, q]]] = [...x];
  return L(q, p, -k / 2);
}
const lVal = (x) => [...x].reduce((s, [k, [p, q]]) => s + (p / q) * Math.exp(k / 2), 0);
const lChave = (x) => [...x].sort((a, b) => a[0] - b[0]).map(([k, [p, q]]) => `${k}:${p}/${q}`).join(',') || '0';
const lZero = (x) => x.size === 0;

/** e^(k2/2) com k2 > 0: e, e^{2}, \sqrt{e}. */
function eTex(k2) {
  if (k2 % 2 === 0) return k2 === 2 ? 'e' : T`e^{${k2 / 2}}`;
  return k2 === 1 ? T`\sqrt{e}` : T`e^{\frac{${k2}}{2}}`;
}
/** Um termo positivo (p/q)·e^(k2/2). */
function termoTex(p, q, k2) {
  if (k2 === 0) return q === 1 ? String(p) : T`\dfrac{${p}}{${q}}`;
  if (k2 > 0) {
    const num = `${p === 1 ? '' : p}${eTex(k2)}`;
    return q === 1 ? num : T`\dfrac{${num}}{${q}}`;
  }
  return T`\dfrac{${p}}{${q === 1 ? '' : q}${eTex(-k2)}}`;
}
/** Soma por ordem decrescente do expoente: e-1, 2e^{2}-3, \dfrac{1}{e}. */
function ltex(x) {
  if (lZero(x)) return '0';
  let s = '';
  [...x.keys()].sort((a, b) => b - a).forEach((k2, i) => {
    const [p, q] = x.get(k2);
    const t = termoTex(Math.abs(p), q, k2);
    s += p < 0 ? `-${t}` : (i === 0 ? t : `+${t}`);
  });
  return s;
}
/** O número multiplicado por x (declive): 2x, e\,x, \dfrac{x}{e}, \left(e+1\right)x. */
function mxTex(m) {
  if (lZero(m)) return '';
  if (m.size > 1) return T`\left(${ltex(m)}\right)x`;
  const [[k2, [p, q]]] = [...m];
  const P = Math.abs(p);
  let corpo;
  if (k2 === 0) {
    if (P === 1 && q === 1) corpo = 'x';
    else corpo = q === 1 ? `${P}x` : T`\dfrac{${P}}{${q}}x`;
  } else if (k2 > 0) {
    const c = `${P === 1 ? '' : P}${eTex(k2)}`;
    corpo = q === 1 ? T`${c}\,x` : T`\dfrac{${c}}{${q}}x`;
  } else {
    corpo = T`\dfrac{${P === 1 ? '' : P}x}{${q === 1 ? '' : q}${eTex(-k2)}}`;
  }
  return (p < 0 ? '-' : '') + corpo;
}
/** y = mx + b, sem termos nulos. */
function retaTex(m, b) {
  const mx = mxTex(m);
  if (!mx) return `y=${ltex(b)}`;
  if (lZero(b)) return `y=${mx}`;
  const bt = ltex(b);
  return `y=${mx}${bt.startsWith('-') ? bt : '+' + bt}`;
}

// ---------- Limites ----------

const OPCOES = {
  inf: { tex: '+\\infty' },
  zero: { tex: '0' },
  um: { tex: '1' },
  menosInf: { tex: '-\\infty' },
  nao: { tex: '\\text{não existe}' },
};

// f recalculável por JavaScript em verificacao; `alvo` é a chave de OPCOES certa.
// x0: número, ou 'inf' / '-inf'; lado: '+' (por cima), '-' (por baixo) ou '' (os dois).
const LIMITES = [
  { tex: '\\frac{e^{x}}{x}', f: (x) => Math.exp(x) / x, x0: 'inf', alvo: 'inf', texto: 'a exponencial cresce mais depressa do que qualquer potência de $x$ (limite notável $\\lim\\frac{e^{x}}{x^{p}}=+\\infty$), por isso o quociente tende para $+\\infty$. O erro típico é dizer que dá $\\frac{\\infty}{\\infty}=1$.' },
  { tex: '\\frac{\\ln x}{x}', f: (x) => Math.log(x) / x, x0: 'inf', alvo: 'zero', texto: 'qualquer potência de $x$ cresce mais depressa do que $\\ln x$ (limite notável $\\lim\\frac{\\ln x}{x}=0$), por isso o quociente tende para $0$. O erro típico é dizer que dá $\\frac{\\infty}{\\infty}=1$.' },
  { tex: 'x\\,e^{-x}', f: (x) => x * Math.exp(-x), x0: 'inf', alvo: 'zero', texto: '$x\\,e^{-x}=\\frac{x}{e^{x}}$ e a exponencial vence a potência, por isso tende para $0$. Não é $\\infty\\times0=0$ nem $+\\infty$: é uma indeterminação que se resolve escrevendo o quociente.' },
  { tex: 'x\\ln x', f: (x) => x * Math.log(x), x0: 0, lado: '+', alvo: 'zero', texto: 'é o limite notável $\\lim_{x\\to0^+}x\\ln x=0$: $x$ tende para $0$ mais depressa do que $\\ln x$ tende para $-\\infty$. O erro típico é responder $-\\infty$ só porque $\\ln x\\to-\\infty$.' },
  { tex: '\\frac{e^{x}-1}{x}', f: (x) => (Math.exp(x) - 1) / x, x0: 0, alvo: 'um', texto: 'é o limite notável $\\lim_{x\\to0}\\frac{e^{x}-1}{x}=1$ (é a derivada de $e^{x}$ em $0$). O erro típico é dizer $0$ porque o numerador tende para $0$, esquecendo que o denominador também.' },
  { tex: 'e^{-x}', f: (x) => Math.exp(-x), x0: 'inf', alvo: 'zero', texto: 'quando $x\\to+\\infty$, $-x\\to-\\infty$ e $e^{-x}=\\frac{1}{e^{x}}$ tende para $0$. O erro típico é esquecer o sinal do expoente e responder $+\\infty$.' },
  { tex: 'e^{-x}', f: (x) => Math.exp(-x), x0: '-inf', alvo: 'inf', texto: 'quando $x\\to-\\infty$, $-x\\to+\\infty$, logo $e^{-x}\\to+\\infty$. O erro típico é responder $0$, que é o limite de $e^{x}$ neste caso.' },
  { tex: '\\ln x', f: (x) => Math.log(x), x0: 0, lado: '+', alvo: 'menosInf', texto: '$\\ln x$ é o expoente a que se eleva $e$ para obter $x$; para obter números cada vez mais perto de $0$ o expoente tem de ser cada vez mais negativo. Logo $\\ln x\\to-\\infty$, e a reta $x=0$ é assíntota vertical.' },
  { tex: '\\frac{x^{2}}{e^{x}}', f: (x) => (x * x) / Math.exp(x), x0: 'inf', alvo: 'zero', texto: 'a exponencial vence qualquer potência, por isso $\\frac{x^{2}}{e^{x}}\\to0$. O erro típico é pensar que $x^{2}$ cresce mais depressa por ser um quadrado.' },
  { tex: '\\frac{\\ln(1+x)}{x}', f: (x) => Math.log(1 + x) / x, x0: 0, alvo: 'um', texto: 'é o limite notável $\\lim_{x\\to0}\\frac{\\ln(1+x)}{x}=1$ (é a derivada de $\\ln(1+x)$ em $0$). O erro típico é dizer $0$ ou $-\\infty$ por causa de $\\ln 1=0$.' },
  { tex: 'e^{1/x}', f: (x) => Math.exp(1 / x), x0: 0, alvo: 'nao', texto: 'os limites laterais são diferentes: por cima, $\\frac1x\\to+\\infty$ e $e^{1/x}\\to+\\infty$; por baixo, $\\frac1x\\to-\\infty$ e $e^{1/x}\\to0$. Como os laterais não coincidem, o limite não existe.' },
];

const limTex = (c) => {
  const seta = c.x0 === 'inf' ? '+\\infty' : (c.x0 === '-inf' ? '-\\infty' : `${c.x0}${c.lado ? '^{' + c.lado + '}' : ''}`);
  return `\\lim_{x\\to ${seta}} ${c.tex}`;
};

const ENUNCIADOS = [
  (l) => `Qual é o valor de $${l}$?`,
  (l) => `Determina $${l}$.`,
  (l) => `Quanto vale o limite $${l}$?`,
  (l) => `Calcula $${l}$.`,
];

function limite(rng) {
  const c = M.escolher(rng, LIMITES);
  const outras = M.baralhar(rng, Object.keys(OPCOES).filter((k) => k !== c.alvo)).slice(0, 3);
  const opcoes = M.baralhar(rng, [c.alvo, ...outras]).map((k) => ({ tex: OPCOES[k].tex, correta: k === c.alvo }));
  return {
    tipo: 'limite',
    modo: 'escolha',
    enunciado: M.escolher(rng, ENUNCIADOS)(limTex(c)),
    opcoes,
    explicacao: `Aqui ${c.texto}`,
    verificacao: { f: c.tex, x0: c.x0, lado: c.lado || '', alvo: c.alvo, funcao: c.f },
  };
}

// ---------- Derivadas ----------
// Cada família devolve { f, pos, correta, erros, explicacao }: `f` é o segundo membro de
// f(x)=..., `pos` pede o domínio ]0,+∞[ no enunciado, `erros` são respostas tentadoras (erros
// típicos) já em LaTeX. Os erros que coincidiriam com a correta para certos parâmetros ficam
// de fora (null); os testes confirmam que só uma opção é a derivada.

/** a·e^{kx+b}: regra da derivada de e^u. */
function derExp(rng, n) {
  const a = um(rng, [1, 1, 2, 3, 4, 5, -1, -2, -3]);
  const k = um(rng, [2, 3, 4, 5, -1, -2, -3]);
  const b = um(rng, [0, 0, 0, 1, -1, 2, -2, 3]);
  const u = soma(coefX(k), b ? String(b) : '');
  const ex = T`e^{${u}}`;
  const menos1 = T`e^{${soma(coefX(k), b - 1 ? String(b - 1) : '')}}`;
  const correta = `${coef(a * k)}${ex}`;
  const fator = Math.abs(a) === 1 ? '' : T`, e o fator $${a}$ mantém-se`;
  return {
    f: `${coef(a)}${ex}`,
    correta,
    erros: [
      `${coef(a)}${ex}`,
      a !== 1 ? `${coef(k)}${ex}` : null,
      b === 0 ? T`${coef(a * k)}x\,${menos1}` : T`${coef(a)}(${u})${menos1}`,
      k < 0 ? `${coef(a * -k)}${ex}` : null,
      k !== -1 ? `${fracCoef(a, k)}${ex}` : null,
      `${coef(a * k)}e^{${soma(coefX(-k), b ? String(b) : '')}}`,
    ],
    explicacao: T`Usa $(e^{u})'=u'\,e^{u}$. Aqui $u=${u}$ e $u'=${k}$${fator}, por isso $${n}'(x)=${correta}$. O erro típico é esquecer o fator $u'$.`,
  };
}

/** e^{px²+qx}: o expoente é um polinómio. */
function derExpQuad(rng, n) {
  const p = um(rng, [1, 1, -1]);
  const q = um(rng, [0, 0, 1, -1, 2, -2, 3, -3, 4, -4]);
  const u = soma(p === 1 ? 'x^{2}' : '-x^{2}', q ? coefX(q) : '');
  const du = soma(coefX(2 * p), q ? String(q) : '');
  const ex = T`e^{${u}}`;
  const forma = (lin) => (q === 0 ? T`${lin}\,${ex}` : `(${lin})${ex}`);
  const correta = forma(du);
  return {
    f: ex,
    correta,
    erros: [
      ex,
      T`(${u})e^{${u}-1}`,
      q !== 0 ? forma(soma(coefX(2 * p), String(-q))) : null,
      forma(soma(coefX(p), q ? String(q) : '')),
      du,
    ],
    explicacao: T`Com $u=${u}$, tem-se $u'=${du}$, e $(e^{u})'=u'\,e^{u}$. Então $${n}'(x)=${correta}$. O erro típico é esquecer o $u'$.`,
  };
}

/** Fração com o sinal fora: fracN(-2, 'u') dá -\dfrac{2}{u}. */
function fracN(num, den) {
  return num < 0 ? T`-\dfrac{${-num}}{${den}}` : T`\dfrac{${num}}{${den}}`;
}

/** ln(kx+b). */
function derLnLin(rng, n) {
  const k = um(rng, [2, 3, 4, 5, -1, -2, -3]);
  const b = um(rng, [1, -1, 2, -2, 3, -3, 4, 5]);
  const u = rng() < 0.5 ? soma(coefX(k), String(b)) : soma(String(b), coefX(k));
  const correta = fracN(k, u);
  return {
    f: T`\ln(${u})`,
    correta,
    erros: [
      T`\dfrac{1}{${u}}`,
      T`\dfrac{1}{\ln(${u})}`,
      (k < 0 ? (k === -1 ? `-(${u})` : T`-\dfrac{${u}}{${-k}}`) : T`\dfrac{${u}}{${k}}`),
      fracN(k, 'x'),
      fracN(-k, u),
      fracN(k, T`(${u})^{2}`),
    ],
    explicacao: T`Com $u=${u}$, tem-se $u'=${k}$. Como $(\ln u)'=\dfrac{u'}{u}$, vem $${n}'(x)=${correta}$. O erro típico é esquecer o $u'$ no numerador.`,
  };
}

/** ln(kx²+c). */
function derLnQuad(rng, n) {
  const k = um(rng, [1, 1, 2, 3]);
  const c = um(rng, [1, 2, 3, 4, 5]);
  const u = T`${coef(k)}x^{2}+${c}`;
  const du = `${coef(2 * k)}x`;
  const correta = T`\dfrac{${du}}{${u}}`;
  return {
    f: T`\ln(${u})`,
    correta,
    erros: [
      T`\dfrac{1}{${u}}`,
      T`\dfrac{${du}}{(${u})^{2}}`,
      T`\dfrac{${u}}{${du}}`,
      T`\dfrac{${du}+${c}}{${u}}`,
      T`\dfrac{1}{\ln(${u})}`,
    ],
    explicacao: T`Com $u=${u}$, tem-se $u'=${du}$ (a constante $${c}$ tem derivada $0$). Então $(\ln u)'=\dfrac{u'}{u}$ dá $${n}'(x)=${correta}$.`,
  };
}

/** x^m ln x, e x ln x - x: regra do produto. */
function derProdLn(rng, n) {
  if (rng() < 0.2) {
    const correta = T`\ln x`;
    return {
      f: T`x\ln x-x`,
      pos: true,
      correta,
      erros: [T`\ln x+1`, T`\ln x-1`, T`\dfrac{1}{x}-1`, T`\ln x+x-1`],
      explicacao: T`Pela regra do produto, $(x\ln x)'=\ln x+x\cdot\dfrac{1}{x}=\ln x+1$. Subtraindo a derivada de $x$, que é $1$, vem $${n}'(x)=${correta}$.`,
    };
  }
  const m = um(rng, [1, 2, 2, 3]);
  const xn = m === 1 ? 'x' : `x^{${m}}`;
  const xn1 = m === 1 ? '' : m === 2 ? 'x' : `x^{${m - 1}}`;
  const primeiro = m === 1 ? T`\ln x` : T`${coef(m)}${xn1}\ln x`; // u'v
  const segundo = m === 1 ? '1' : xn1; // u v' = x^m · (1/x)
  const correta = soma(primeiro, segundo);
  return {
    f: T`${xn}\ln x`,
    pos: true,
    correta,
    erros: [
      primeiro,
      m === 1 ? T`\dfrac{1}{x}` : (m === 2 ? '2' : '3x'),
      soma(primeiro, m === 1 ? 'x' : xn),
      soma(m === 1 ? '1' : `${coef(m)}${xn1}`, T`\dfrac{1}{x}`),
      soma(primeiro, `-${segundo}`),
    ],
    explicacao: T`Pela regra do produto, $(uv)'=u'v+uv'$, com $u=${xn}$ e $v=\ln x$. Então $${n}'(x)=${primeiro}+${xn}\cdot\dfrac{1}{x}=${correta}$.`,
  };
}

/** e^{kx}/x^m: regra do quociente. */
const xp = (e) => (e === 1 ? 'x' : `x^{${e}}`);

function derQuocExp(rng, n) {
  const k = um(rng, [1, 1, 2, 3, -1]);
  const m = um(rng, [1, 2]);
  const kx = coefX(k);
  const xn = m === 1 ? 'x' : 'x^{2}';
  const vp = m === 1 ? '1' : '2x';
  const ex = T`e^{${kx}}`;
  const lin = soma(kx, String(-m));
  const correta = T`\dfrac{${ex}(${lin})}{${xp(m + 1)}}`;
  const num = T`${coef(k)}${ex}\,${xn}-${ex}\cdot ${vp}`;
  return {
    f: T`\dfrac{${ex}}{${xn}}`,
    correta,
    erros: [
      T`\dfrac{${ex}(${soma(kx, String(m))})}{${xp(m + 1)}}`,
      T`\dfrac{${ex}(${lin})}{${xp(m)}}`,
      T`\dfrac{${ex}(${soma(String(m), coefX(-k))})}{${xp(m + 1)}}`,
      m === 1 ? `${coef(k)}${ex}` : T`\dfrac{${coef(k)}${ex}}{2x}`,
      k !== 1 ? T`\dfrac{${ex}(${soma('x', String(-m))})}{${xp(m + 1)}}` : null,
    ],
    explicacao: T`Regra do quociente: $\left(\dfrac{u}{v}\right)'=\dfrac{u'v-uv'}{v^{2}}$, com $u=${ex}$, $u'=${coef(k)}${ex}$, $v=${xn}$ e $v'=${vp}$. Então $${n}'(x)=\dfrac{${num}}{${xp(2 * m)}}=${correta}$.`,
  };
}

/** ln x / x^m: regra do quociente. */
function derQuocLn(rng, n) {
  const m = um(rng, [1, 2]);
  const xn = m === 1 ? 'x' : 'x^{2}';
  const vp = m === 1 ? '1' : '2x';
  const nl = m === 1 ? T`\ln x` : T`2\ln x`;
  const correta = T`\dfrac{1-${nl}}{x^{${m + 1}}}`;
  return {
    f: T`\dfrac{\ln x}{${xn}}`,
    pos: true,
    correta,
    erros: [
      T`\dfrac{1-${nl}}{${xp(m)}}`,
      T`\dfrac{${nl}-1}{x^{${m + 1}}}`,
      T`\dfrac{1+${nl}}{x^{${m + 1}}}`,
      m === 1 ? T`\dfrac{1}{x}` : T`\dfrac{1}{2x^{2}}`,
      T`\dfrac{1}{x^{${m + 1}}}`,
    ],
    explicacao: T`Regra do quociente com $u=\ln x$, $u'=\dfrac{1}{x}$, $v=${xn}$ e $v'=${vp}$. Então $${n}'(x)=\dfrac{\frac{1}{x}\cdot ${xn}-\ln x\cdot ${vp}}{x^{${2 * m}}}=${correta}$.`,
  };
}

/** x^m e^{kx}: regra do produto. */
function derProdExp(rng, n) {
  const m = um(rng, [1, 2, 2, 3]);
  const k = um(rng, [1, -1, 2, -2, 3]);
  const kx = coefX(k);
  const ex = T`e^{${kx}}`;
  const xn = m === 1 ? 'x' : `x^{${m}}`;
  const xn1 = m === 1 ? '' : m === 2 ? 'x' : `x^{${m - 1}}`;
  const fator = (lin) => `${xn1}(${lin})${ex}`;
  const correta = fator(soma(String(m), kx));
  const A = prod(coef(m), xn1, ex); // u'v
  const B = prod(coef(k), xn, ex); // uv'
  return {
    f: prod('', xn, ex),
    correta,
    erros: [
      prod(coef(m * k), xn1, ex),
      A,
      B,
      fator(soma(String(m), coefX(-k))),
      k !== 1 ? fator(soma(String(m), 'x')) : null,
    ],
    explicacao: T`Regra do produto, com $u=${xn}$ e $v=${ex}$, logo $v'=${coef(k)}${ex}$. Então $${n}'(x)=u'v+uv'=${soma(A, B)}$, e pondo em evidência obtém-se $${correta}$.`,
  };
}

/** log_a x e log_a(kx+b). */
function derLogBase(rng, n) {
  const a = um(rng, [2, 3, 5, 10, 2, 3]);
  const lin = rng() < 0.5;
  const k = um(rng, [2, 3, -1, 4]);
  const b = um(rng, [1, -1, 2, -2, 3]);
  const u = lin ? soma(coefX(k), String(b)) : 'x';
  const cab = a === 10 ? T`\log` : T`\log_{${a}}`;
  const lna = T`\ln ${a}`;
  const lembrete = a === 10 ? T` O logaritmo decimal $\log x$ é $\log_{10}x$.` : '';
  if (lin) {
    const correta = fracN(k, T`(${u})${lna}`);
    return {
      f: `${cab}(${u})`,
      correta,
      erros: [fracN(k, u), T`\dfrac{1}{(${u})${lna}}`, fracN(k, T`${a}(${u})`), (k < 0 ? T`-\dfrac{${-k === 1 ? '' : -k}${lna}}{${u}}` : T`\dfrac{${k === 1 ? '' : k}${lna}}{${u}}`)],
      explicacao: T`Usa $(\log_a u)'=\dfrac{u'}{u\ln a}$, com $a=${a}$, $u=${u}$ e $u'=${k}$. Então $${n}'(x)=${correta}$.${lembrete}`,
    };
  }
  const correta = T`\dfrac{1}{x${lna}}`;
  return {
    f: `${cab} x`,
    pos: true,
    correta,
    erros: [T`\dfrac{1}{x}`, T`\dfrac{1}{${a}x}`, T`\dfrac{${lna}}{x}`, T`\dfrac{x}{${lna}}`, T`\dfrac{1}{${a}\ln x}`],
    explicacao: T`Usa $(\log_a x)'=\dfrac{1}{x\ln a}$, com $a=${a}$. Então $${n}'(x)=${correta}$. O $\ln ${a}$ é um número que fica a dividir; não o trocas por $${a}$.${lembrete}`,
  };
}

/** a^{u}: derivada de uma exponencial de base a. */
function derPotBase(rng, n) {
  const a = um(rng, [2, 3, 5, 10, 2, 3]);
  const tipo = um(rng, ['x', 'kx', 'kx+b']);
  const k = tipo === 'x' ? 1 : um(rng, [2, 3, -1, -2, -3]);
  const b = tipo === 'kx+b' ? um(rng, [1, -1, 2, -2, 3]) : 0;
  const u = soma(coefX(k), b ? String(b) : '');
  const base = `${a}^{${u}}`;
  const lna = T`\ln ${a}`;
  const kc = k === 1 ? '' : (k === -1 ? '-' : T`${k}\times`);
  const correta = `${kc}${base}${lna}`;
  return {
    f: base,
    correta,
    erros: [
      k !== 1 ? `${base}${lna}` : null,
      `${kc}${base}`,
      u === 'x' ? T`x\,${a}^{x-1}` : T`(${u})${a}^{${soma(u, '-1')}}`,
      T`\dfrac{${kc}${base}}{${lna}}`,
    ],
    explicacao: T`Usa $(a^{u})'=u'\,a^{u}\ln a$, com $a=${a}$, $u=${u}$ e $u'=${k}$. Então $${n}'(x)=${correta}$. A variável está no expoente, por isso não se usa a regra da potência.`,
  };
}

/** ln(e^{kx}+c). */
function derLnExp(rng, n) {
  const k = um(rng, [1, 2, 3, -1]);
  const c = um(rng, [1, 2, 3, 4]);
  const kx = coefX(k);
  const ex = T`e^{${kx}}`;
  const u = `${ex}+${c}`;
  const dex = `${coef(k)}${ex}`;
  const correta = T`\dfrac{${dex}}{${u}}`;
  return {
    f: T`\ln(${u})`,
    correta,
    erros: [
      T`\dfrac{1}{${u}}`,
      k !== 1 ? T`\dfrac{${ex}}{${u}}` : null,
      dex,
      T`\dfrac{${dex}+${c}}{${u}}`,
      T`\dfrac{${dex}}{\ln(${u})}`,
    ],
    explicacao: T`Com $u=${u}$, tem-se $u'=${dex}$ (a constante $${c}$ tem derivada $0$). Então $(\ln u)'=\dfrac{u'}{u}$ dá $${n}'(x)=${correta}$.`,
  };
}

/** (ln x)^m: potência de uma função. */
function derPotLn(rng, n) {
  const m = um(rng, [2, 3]);
  const pot = m === 2 ? T`\ln x` : T`(\ln x)^{2}`; // (ln x)^(m-1)
  const correta = T`\dfrac{${m}${pot}}{x}`;
  return {
    f: T`(\ln x)^{${m}}`,
    pos: true,
    correta,
    erros: [
      T`${m}${pot}`,
      T`\dfrac{${pot}}{x}`,
      T`\dfrac{${m}(\ln x)^{${m}}}{x}`,
      T`\dfrac{${m}}{x}`,
      T`\dfrac{${m}${pot}}{x^{2}}`,
    ],
    explicacao: T`É uma potência de $u=\ln x$: $(u^{${m}})'=${m}\,${m === 2 ? 'u' : 'u^{2}'}\,u'$, com $u'=\dfrac{1}{x}$. Então $${n}'(x)=${correta}$.`,
  };
}

const FAMILIAS_DER = [derExp, derExpQuad, derLnLin, derLnQuad, derProdLn, derQuocExp, derQuocLn, derProdExp, derLogBase, derPotBase, derLnExp, derPotLn];

const ENUNCIADOS_DER = [
  (n, f) => T`Qual é a derivada de $${n}(x)=${f}$?`,
  (n, f) => T`Determina $${n}'(x)$, sabendo que $${n}(x)=${f}$.`,
  (n, f) => T`Seja $${n}(x)=${f}$. Qual é a expressão de $${n}'(x)$?`,
  (n, f) => T`Considera a função $${n}$ definida por $${n}(x)=${f}$. Qual é a sua derivada?`,
];
const ENUNCIADOS_DER_POS = [
  (n, f) => T`Para $x>0$, qual é a derivada de $${n}(x)=${f}$?`,
  (n, f) => T`Considera $${n}(x)=${f}$, de domínio $\mathbb{R}^{+}$. Qual é a expressão de $${n}'(x)$?`,
  (n, f) => T`Seja $${n}$ a função de domínio $\mathbb{R}^{+}$ definida por $${n}(x)=${f}$. Determina $${n}'(x)$.`,
];

function derivada(rng) {
  const n = um(rng, ['f', 'f', 'g', 'h']);
  const fam = um(rng, FAMILIAS_DER);
  const d = fam(rng, n);
  const outras = comContexto(fam.name, () => escolherN(rng, [textos(d.erros)], new Set([d.correta])));
  return escolha(rng, 'derivada', {
    enunciado: um(rng, d.pos ? ENUNCIADOS_DER_POS : ENUNCIADOS_DER)(n, d.f),
    correta: d.correta,
    outras,
    explicacao: d.explicacao,
    verificacao: { pedido: 'derivada', familia: fam.name, nome: n, f: d.f, dominio: d.pos ? 'R+' : 'natural' },
  });
}

// ---------- Reta tangente ----------
// Cada família devolve { f, pos, a, y0, m, dTex, errosM, calcF?, calcD? } com a, y0 = f(a) e
// m = f'(a) em números exatos (L/E). Os distratores nascem dos erros típicos: usar f(a) como
// declive, esquecer f(a), pôr f(a) como ordenada na origem, trocar o sinal de a, derivar mal.

const qSobreX = (q) => T`${q < 0 ? '-' : ''}\dfrac{${Math.abs(q)}}{x}`;

/** p·e^{kx}+q em a = 0, 1 ou -1. */
function tgExp(rng) {
  const p = um(rng, [1, 2, 3, -1, -2]);
  const k = um(rng, [1, 2, 3, -1, -2]);
  const aN = um(rng, [0, 0, 1, -1]);
  let q = um(rng, [0, 1, -1, 2, -2, 3, -3]);
  if (aN === 0 && p + q === 0) q += 1; // com f(0)=0 a tangente passa na origem e faltam distratores
  const ex = T`e^{${coefX(k)}}`;
  const termo = `${coef(p)}${ex}`;
  const qs = q ? String(q) : '';
  const f = rng() < 0.5 ? soma(termo, qs) : soma(qs, termo);
  const ek = E(k * aN);
  return {
    f,
    a: L(aN),
    y0: lSoma(lMul(L(p), ek), L(q)),
    m: lMul(L(p * k), ek),
    dTex: `${coef(p * k)}${ex}`,
    errosM: [k !== 1 ? lMul(L(p), ek) : null, aN !== 0 ? L(p * k) : null],
  };
}

/** p + q ln x em a = 1, e ou 1/e. */
function tgLn(rng) {
  const p = um(rng, [0, 1, -1, 2, -2, 3, -3]);
  const q = um(rng, [1, -1, 2, -2, 3]);
  const j = um(rng, [0, 0, 1, -1]);
  const lnx = T`${coef(q)}\ln x`;
  const ps = p ? String(p) : '';
  const f = rng() < 0.5 ? soma(ps, lnx) : soma(lnx, ps);
  return {
    f,
    pos: true,
    a: E(j),
    y0: L(p + q * j),
    m: lMul(L(q), E(-j)),
    dTex: qSobreX(q),
    errosM: [q !== 1 ? E(-j) : null, j !== 0 ? L(q * j) : null, j !== 0 ? lMul(L(q), E(j)) : null, L(q)],
  };
}

/** x ln x e x² ln x em pontos de abcissa e^j. */
function tgXLn(rng) {
  const m2 = um(rng, [1, 1, 2]);
  const j = m2 === 1 ? um(rng, [0, 1, -1, 2]) : um(rng, [0, 1, -1]);
  const y0 = lMul(E(m2 * j), L(j));
  if (m2 === 1) {
    return {
      f: T`x\ln x`,
      pos: true,
      a: E(j),
      y0,
      m: L(j + 1),
      dTex: T`\ln x+1`,
      errosM: [L(j), E(-j), lSoma(L(1), E(-j))],
    };
  }
  return {
    f: T`x^{2}\ln x`,
    pos: true,
    a: E(j),
    y0,
    m: lMul(E(j), L(2 * j + 1)),
    dTex: T`2x\ln x+x`,
    errosM: [lMul(E(j), L(2 * j)), L(2), lSoma(lMul(E(j), L(2)), E(-j))],
  };
}

/** x e^{kx} em a = 1 ou -1. */
function tgXExp(rng) {
  const k = um(rng, [1, 2, -1, -2]);
  const aN = um(rng, [1, 1, -1]);
  const kx = coefX(k);
  const ex = T`e^{${kx}}`;
  const ek = E(k * aN);
  return {
    f: T`x\,${ex}`,
    a: L(aN),
    y0: lMul(L(aN), ek),
    m: lMul(L(1 + k * aN), ek),
    dTex: T`(${soma('1', kx)})${ex}`,
    errosM: [lMul(L(k), ek), ek, k !== 1 ? lMul(L(1 + aN), ek) : null],
  };
}

/** e^x/x e ln x/x. */
function tgQuoc(rng) {
  if (rng() < 0.5) {
    const aN = um(rng, [1, 2, -1]);
    return {
      f: T`\dfrac{e^{x}}{x}`,
      a: L(aN),
      y0: L(1, aN, aN),
      m: L(aN - 1, aN * aN, aN),
      dTex: T`\dfrac{e^{x}(x-1)}{x^{2}}`,
      errosM: [E(aN), L(aN + 1, aN * aN, aN), L(aN - 1, aN, aN)],
    };
  }
  const j = um(rng, [0, 1, 2]);
  return {
    f: T`\dfrac{\ln x}{x}`,
    pos: true,
    a: E(j),
    y0: L(j, 1, -j),
    m: L(1 - j, 1, -2 * j),
    dTex: T`\dfrac{1-\ln x}{x^{2}}`,
    errosM: [E(-j), L(1 - j, 1, -j), L(j - 1, 1, -2 * j)],
  };
}

/** p + ln(kx+b) no ponto em que kx+b = 1. */
function tgLnLin(rng, n) {
  const k = um(rng, [2, 3, -1, -2]);
  const aN = um(rng, [1, 2, -1]);
  const b = 1 - k * aN;
  const p = um(rng, [0, 0, 1, -1, 2, -2, 3]);
  const u = soma(coefX(k), b ? String(b) : '');
  const lnu = T`\ln(${u})`;
  const f = p ? (rng() < 0.5 ? soma(String(p), lnu) : soma(lnu, String(p))) : lnu;
  return {
    f,
    a: L(aN),
    y0: L(p),
    m: L(k),
    dTex: fracN(k, u),
    calcF: p ? T`${n}(${aN})=${p}+\ln 1=${p}` : T`${n}(${aN})=\ln 1=0`,
    calcD: T`${n}'(${aN})=${k}`,
    errosM: [L(1), L(1, k), L(-k)],
  };
}

/** p x^e + q ln x em a = 1 ou e. */
function tgPolLn(rng) {
  const e = um(rng, [1, 2]);
  const p = um(rng, [1, -1, 2, -2, 3]);
  const q = um(rng, [1, -1, 2, -2, 3]);
  const j = um(rng, [0, 0, 1]);
  const pol = e === 1 ? coefX(p) : `${coef(p)}x^{2}`;
  const lnx = T`${coef(q)}\ln x`;
  const f = rng() < 0.5 ? soma(pol, lnx) : soma(lnx, pol);
  const mPol = lMul(L(e * p), E((e - 1) * j));
  return {
    f,
    pos: true,
    a: E(j),
    y0: lSoma(lMul(L(p), E(e * j)), L(q * j)),
    m: lSoma(mPol, lMul(L(q), E(-j))),
    dTex: soma(e === 1 ? String(p) : coefX(2 * p), qSobreX(q)),
    errosM: [mPol, lMul(L(q), E(-j)), j !== 0 ? lSoma(mPol, lMul(L(q), E(j))) : null],
  };
}

/** a^x em x = 0 e log_a x em x = 1: o resultado leva ln a. */
function tgBase(rng, n) {
  const a = um(rng, [2, 3, 5]);
  if (rng() < 0.5) {
    const correta = T`y=x\ln ${a}+1`;
    return {
      directo: true,
      f: T`${a}^{x}`,
      aTex: '0',
      m: Math.log(a),
      b: 1,
      correta,
      erros: [T`y=x+1`, T`y=${a}x+1`, T`y=\dfrac{x}{\ln ${a}}+1`, T`y=x\ln ${a}`, T`y=x\ln ${a}-1`],
      explicacao: T`Passo 1: $${n}(0)=${a}^{0}=1$, por isso o ponto de tangência é $(0,1)$. Passo 2: $${n}'(x)=${a}^{x}\ln ${a}$, logo o declive é $${n}'(0)=\ln ${a}$. Passo 3: $y=\ln ${a}\,(x-0)+1$, ou seja, $${correta}$. A derivada de $${a}^{x}$ leva o fator $\ln ${a}$; só com base $e$ esse fator vale $1$.`,
    };
  }
  const correta = T`y=\dfrac{x-1}{\ln ${a}}`;
  return {
    directo: true,
    pos: true,
    f: T`\log_{${a}} x`,
    aTex: '1',
    m: 1 / Math.log(a),
    b: -1 / Math.log(a),
    correta,
    erros: [T`y=\dfrac{x-1}{${a}}`, T`y=x-1`, T`y=(x-1)\ln ${a}`, T`y=\dfrac{x}{\ln ${a}}`, T`y=\dfrac{x+1}{\ln ${a}}`],
    explicacao: T`Passo 1: $${n}(1)=\log_{${a}}1=0$, por isso o ponto de tangência é $(1,0)$. Passo 2: $${n}'(x)=\dfrac{1}{x\ln ${a}}$, logo o declive é $${n}'(1)=\dfrac{1}{\ln ${a}}$. Passo 3: $y=\dfrac{1}{\ln ${a}}(x-1)+0$, ou seja, $${correta}$.`,
  };
}

/** e^{x²} e e^{-x²} em a = 1 ou -1. */
function tgGauss(rng) {
  const s = um(rng, [1, -1]);
  const aN = um(rng, [1, -1]);
  const u = s === 1 ? 'x^{2}' : '-x^{2}';
  return {
    f: T`e^{${u}}`,
    a: L(aN),
    y0: E(s),
    m: lMul(L(2 * s * aN), E(s)),
    dTex: T`${coefX(2 * s)}\,e^{${u}}`,
    errosM: [E(s), lMul(L(s * aN), E(s)), lMul(L(2 * aN), E(s))],
  };
}

const FAMILIAS_TG = [[tgExp, 3], [tgLn, 3], [tgXLn, 2], [tgXExp, 2], [tgQuoc, 2], [tgLnLin, 2], [tgPolLn, 2], [tgBase, 1], [tgGauss, 1]];

function escolherPeso(rng, lista) {
  let r = rng() * lista.reduce((s, [, p]) => s + p, 0);
  for (const [item, p] of lista) {
    r -= p;
    if (r < 0) return item;
  }
  return lista[lista.length - 1][0];
}

/** Retas erradas, mais prováveis primeiro. Cada uma é {m, b} em números exatos. */
function retasErradas(y0, m, a, errosM) {
  const b = lSub(y0, lMul(m, a));
  const ma = lMul(m, a);
  const g1 = [];
  for (const mm of errosM) if (mm) g1.push({ m: mm, b: lSub(y0, lMul(mm, a)) });
  g1.push({ m: y0, b: lSub(y0, lMul(y0, a)) }); // f(a) em vez de f'(a)
  g1.push({ m, b: lNeg(ma) }); // esquece o +f(a)
  g1.push({ m, b: y0 }); // f(a) como ordenada na origem
  const g2 = [
    { m, b: lSoma(y0, ma) }, // y = m(x+a)+f(a)
    { m, b: lNeg(b) }, // sinal da ordenada
    { m: lNeg(m), b: lSoma(y0, ma) }, // sinal do declive
  ];
  const inv = lInv(m);
  if (inv) g2.push({ m: lNeg(inv), b: lSoma(y0, lMul(inv, a)) }); // reta normal
  const com = (g) => g.map((r) => ({ k: `${lChave(r.m)}|${lChave(r.b)}`, m: r.m, b: r.b }));
  return { certa: `${lChave(m)}|${lChave(b)}`, b, g1: com(g1), g2: com(g2) };
}

const ENUNCIADOS_TG = [
  (n, f, a) => T`Qual é a equação da reta tangente ao gráfico de $${n}(x)=${f}$ no ponto de abcissa $${a}$?`,
  (n, f, a) => T`Seja $${n}(x)=${f}$. Qual é uma equação da reta tangente ao gráfico de $${n}$ no ponto de abcissa $${a}$?`,
  (n, f, a) => T`Considera a função $${n}$ definida por $${n}(x)=${f}$. Qual é a equação reduzida da reta tangente ao seu gráfico no ponto de abcissa $${a}$?`,
];
const ENUNCIADOS_TG_POS = [
  (n, f, a) => T`Considera a função $${n}$, de domínio $\mathbb{R}^{+}$, definida por $${n}(x)=${f}$. Qual é a equação da reta tangente ao seu gráfico no ponto de abcissa $${a}$?`,
  (n, f, a) => T`Para $x>0$, seja $${n}(x)=${f}$. Qual é uma equação da reta tangente ao gráfico de $${n}$ no ponto de abcissa $${a}$?`,
  (n, f, a) => T`Seja $${n}$ a função de domínio $\mathbb{R}^{+}$ definida por $${n}(x)=${f}$. Qual é a equação reduzida da reta tangente ao gráfico de $${n}$ no ponto de abcissa $${a}$?`,
];

/** Argumento de f(...) ou f'(...): entre parênteses grandes se tiver frações ou raízes. */
const argF = (t) => (/dfrac|sqrt/.test(t) ? T`\left(${t}\right)` : `(${t})`);

/** Declive·(x - a) + y0, por extenso, para mostrar a substituição. */
function pontoDeclive(m, a, y0) {
  const fator = lChave(m) === lChave(L(1)) ? '' : (lChave(m) === lChave(L(-1)) ? '-' : (m.size > 1 ? T`\left(${ltex(m)}\right)` : ltex(m)));
  let dentro = 'x';
  if (!lZero(a)) dentro = lVal(a) > 0 ? `x-${ltex(a)}` : `x+${ltex(lNeg(a))}`;
  const ult = lZero(y0) ? '' : (ltex(y0).startsWith('-') ? ltex(y0) : `+${ltex(y0)}`);
  if (fator === '' && !lZero(a)) return `${dentro}${ult}`;
  if (lZero(a)) return `${fator}x${ult}`;
  return `${fator}${argF(dentro)}${ult}`;
}

function tangente(rng) {
  const n = um(rng, ['f', 'f', 'g', 'h']);
  const fam = escolherPeso(rng, FAMILIAS_TG);
  const d = fam(rng, n);
  const enun = (aTex) => um(rng, d.pos ? ENUNCIADOS_TG_POS : ENUNCIADOS_TG)(n, d.f, aTex);
  if (d.directo) {
    const outras = comContexto(fam.name, () => escolherN(rng, [textos(d.erros)], new Set([d.correta])));
    return escolha(rng, 'tangente', {
      enunciado: enun(d.aTex),
      correta: d.correta,
      outras,
      explicacao: d.explicacao,
      verificacao: { pedido: 'tangente', familia: fam.name, nome: n, f: d.f, a: Number(d.aTex), aTex: d.aTex, m: d.m, b: d.b },
    });
  }
  const r = retasErradas(d.y0, d.m, d.a, d.errosM);
  const correta = retaTex(d.m, r.b);
  const grupos = [r.g1.map((x) => ({ k: x.k, tex: retaTex(x.m, x.b) })), r.g2.map((x) => ({ k: x.k, tex: retaTex(x.m, x.b) }))];
  // dois dos erros mais típicos e, se houver, um dos outros
  const vistas = new Set([r.certa]);
  const primeiros = escolherN(rng, [grupos[0]], vistas, 2, false);
  const resto = comContexto(`${fam.name} ${d.f} em ${ltex(d.a)}: ${correta}`, () => escolherN(rng, [M.baralhar(rng, [...grupos[0], ...grupos[1]])], vistas, 3 - primeiros.length));
  const outras = [...primeiros, ...resto];
  const aTex = ltex(d.a);
  const subst = `y=${pontoDeclive(d.m, d.a, d.y0)}`;
  const passo3 = lZero(d.m)
    ? T`Como o declive é $0$, a reta é horizontal: $${correta}$.`
    : (subst === correta
      ? T`Substituindo em $y=${n}'(a)(x-a)+${n}(a)$, vem $${correta}$.`
      : T`Substituindo em $y=${n}'(a)(x-a)+${n}(a)$, vem $${subst}$, ou seja, $${correta}$.`);
  const ponto = /dfrac|sqrt/.test(aTex + ltex(d.y0)) ? T`\left(${aTex},${ltex(d.y0)}\right)` : `(${aTex},${ltex(d.y0)})`;
  const explicacao = T`Passo 1: $${d.calcF || T`${n}${argF(aTex)}=${ltex(d.y0)}`}$, por isso o ponto de tangência é $${ponto}$. Passo 2: $${n}'(x)=${d.dTex}$, logo o declive é $${d.calcD || T`${n}'${argF(aTex)}=${ltex(d.m)}`}$. Passo 3: ${passo3}`;
  return escolha(rng, 'tangente', {
    enunciado: enun(aTex),
    correta,
    outras,
    explicacao,
    verificacao: { pedido: 'tangente', familia: fam.name, nome: n, f: d.f, a: lVal(d.a), aTex, m: lVal(d.m), b: lVal(r.b) },
  });
}

// ---------- Monotonia, extremos e contradomínio ----------
// Um extremo de intervalo é { v, tex }: v numérico (±Infinity incluído), tex em LaTeX.
// Cada caso (cs) traz a função (f em LaTeX, fx na sintaxe do avaliador), o domínio, os intervalos
// maximais de monotonia (pecas), o extremo absoluto (ext), o contradomínio (contra) e as frases
// da explicação. Os testes recalculam tudo a partir de f, por amostragem.

const INF = { v: Infinity, tex: '+\\infty' };
const MINF = { v: -Infinity, tex: '-\\infty' };
const ZERO = { v: 0, tex: '0' };
const ep = (x) => ({ v: lVal(x), tex: ltex(x), L: x });
const grande = (e) => /\\dfrac|\\frac|\\sqrt/.test(e.tex);

function intTex(lo, loC, hi, hiC) {
  const ab = loC ? '[' : ']';
  const fe = hiC ? ']' : '[';
  const corpo = `${lo.tex},${hi.tex}`;
  return grande(lo) || grande(hi) ? `\\left${ab}${corpo}\\right${fe}` : `${ab}${corpo}${fe}`;
}
const peca = (dir, lo, loC, hi, hiC) => ({ dir, lo, loC, hi, hiC });
const chaveInt = (I) => `${I.lo.v.toFixed(9)}|${I.loC}|${I.hi.v.toFixed(9)}|${I.hiC}`;
const conjTex = (S) => (S.lo.v === -Infinity && S.hi.v === Infinity ? T`\mathbb{R}` : intTex(S.lo, S.loC, S.hi, S.hiC));

const DOM_R = { lo: MINF, loC: false, hi: INF, hiC: false, tex: T`\mathbb{R}`, natural: true };
const DOM_RP = { lo: ZERO, loC: false, hi: INF, hiC: false, tex: T`\mathbb{R}^{+}`, natural: true };
// e^x/x também existe para x<0: aqui o domínio ]0,+∞[ é uma restrição dada no enunciado
const DOM_RP_DADO = { ...DOM_RP, natural: false };

/** Frase «Como f tem mínimo y e f(x) -> +inf quando x -> limX,» para o contradomínio. */
function limite1(n, tipo, yTex, limX) {
  return tipo === 'min'
    ? T`Como $${n}$ tem mínimo $${yTex}$ e $${n}(x)\to+\infty$ quando $x\to${limX}$,`
    : T`Como $${n}$ tem máximo $${yTex}$ e $${n}(x)\to-\infty$ quando $x\to${limX}$,`;
}

/** Dois intervalos de monotonia, separados por c: min (desce, sobe) ou max (sobe, desce). */
function pecas2(dom, c, tipo) {
  const cE = ep(c);
  return tipo === 'min'
    ? [peca('-', dom.lo, dom.loC, cE, true), peca('+', cE, true, dom.hi, dom.hiC)]
    : [peca('+', dom.lo, dom.loC, cE, true), peca('-', cE, true, dom.hi, dom.hiC)];
}

/** x e^{kx}. */
function csXExp(rng, n) {
  const k = um(rng, [1, 2, 3, -1, -2, -3]);
  const kx = coefX(k);
  const c = L(-1, k);
  const tipo = k > 0 ? 'min' : 'max';
  const y = k > 0 ? L(-1, k, -1) : L(1, -k, -1);
  const lin = soma('1', kx);
  return {
    id: 'x-exp',
    f: T`x\,e^{${kx}}`,
    fx: `x*exp(${k}*x)`,
    dom: DOM_R,
    pecas: pecas2(DOM_R, c, tipo),
    ext: { tipo, x: c, y, yTex: ltex(y), yV: lVal(y) },
    sinal: T`Pela regra do produto, $${n}'(x)=(${lin})e^{${kx}}$. Como $e^{${kx}}>0$, o sinal de $${n}'$ é o de $${lin}$, que se anula em $x=${ltex(c)}$.`,
    limX: k > 0 ? '+\\infty' : '-\\infty',
  };
}

/** (x+q)e^x e (p-x)e^x. */
function csProdExp(rng, n) {
  if (rng() < 0.6) {
    const q = um(rng, [-2, -1, 1, 2]);
    const c = L(-q - 1);
    const y = L(-1, 1, -q - 1);
    const lin = soma('x', q + 1 ? String(q + 1) : '');
    const dTex = lin === 'x' ? T`x\,e^{x}` : T`(${lin})e^{x}`;
    return {
      id: 'x+q-exp',
      f: T`(${soma('x', String(q))})e^{x}`,
      fx: `(x+(${q}))*exp(x)`,
      dom: DOM_R,
      pecas: pecas2(DOM_R, c, 'min'),
      ext: { tipo: 'min', x: c, y, yTex: ltex(y), yV: lVal(y) },
      sinal: T`Pela regra do produto, $${n}'(x)=e^{x}+(${soma('x', String(q))})e^{x}=${dTex}$. Como $e^{x}>0$, o sinal de $${n}'$ é o de $${lin}$, que se anula em $x=${ltex(c)}$.`,
      limX: '+\\infty',
    };
  }
  const p = um(rng, [1, 2, 3]);
  const c = L(p - 1);
  const y = L(1, 1, p - 1);
  const lin = soma(p - 1 ? String(p - 1) : '', '-x');
  const dTex = lin === '-x' ? T`-x\,e^{x}` : T`(${lin})e^{x}`;
  return {
    id: 'p-x-exp',
    f: T`(${p}-x)e^{x}`,
    fx: `(${p}-x)*exp(x)`,
    dom: DOM_R,
    pecas: pecas2(DOM_R, c, 'max'),
    ext: { tipo: 'max', x: c, y, yTex: ltex(y), yV: lVal(y) },
    sinal: T`Pela regra do produto, $${n}'(x)=-e^{x}+(${p}-x)e^{x}=${dTex}$. Como $e^{x}>0$, o sinal de $${n}'$ é o de $${lin}$, que se anula em $x=${ltex(c)}$.`,
    limX: '+\\infty',
  };
}

/** Funções com ln em ]0,+∞[ com um só ponto crítico. */
const TABELA_LOG = [
  (n) => ({ id: 'x-lnx', f: T`x-\ln x`, fx: 'x-ln(x)', tipo: 'min', c: L(1), y: L(1), limX: '+\\infty', sinal: T`$${n}'(x)=1-\dfrac{1}{x}=\dfrac{x-1}{x}$. Em $\mathbb{R}^{+}$ o denominador é positivo, por isso $${n}'$ tem o sinal de $x-1$, que se anula em $x=1$.` }),
  (n) => ({ id: 'lnx-x', f: T`\ln x-x`, fx: 'ln(x)-x', tipo: 'max', c: L(1), y: L(-1), limX: '+\\infty', sinal: T`$${n}'(x)=\dfrac{1}{x}-1=\dfrac{1-x}{x}$. Em $\mathbb{R}^{+}$ o denominador é positivo, por isso $${n}'$ tem o sinal de $1-x$, que se anula em $x=1$.` }),
  (n) => ({ id: 'x2/2-lnx', f: T`\dfrac{x^{2}}{2}-\ln x`, fx: 'x^2/2-ln(x)', tipo: 'min', c: L(1), y: L(1, 2), limX: '+\\infty', sinal: T`$${n}'(x)=x-\dfrac{1}{x}=\dfrac{x^{2}-1}{x}$. Em $\mathbb{R}^{+}$ o denominador é positivo, por isso $${n}'$ tem o sinal de $x^{2}-1$, que se anula em $x=1$.` }),
  (n) => ({ id: 'lnx-x2/2', f: T`\ln x-\dfrac{x^{2}}{2}`, fx: 'ln(x)-x^2/2', tipo: 'max', c: L(1), y: L(-1, 2), limX: '+\\infty', sinal: T`$${n}'(x)=\dfrac{1}{x}-x=\dfrac{1-x^{2}}{x}$. Em $\mathbb{R}^{+}$ o denominador é positivo, por isso $${n}'$ tem o sinal de $1-x^{2}$, que se anula em $x=1$.` }),
  (n) => ({ id: 'x2-2lnx', f: T`x^{2}-2\ln x`, fx: 'x^2-2*ln(x)', tipo: 'min', c: L(1), y: L(1), limX: '+\\infty', sinal: T`$${n}'(x)=2x-\dfrac{2}{x}=\dfrac{2(x^{2}-1)}{x}$. Em $\mathbb{R}^{+}$ o denominador é positivo, por isso $${n}'$ tem o sinal de $x^{2}-1$, que se anula em $x=1$.` }),
  (n) => ({ id: 'xlnx-x', f: T`x\ln x-x`, fx: 'x*ln(x)-x', tipo: 'min', c: L(1), y: L(-1), limX: '+\\infty', sinal: T`Pela regra do produto, $(x\ln x)'=\ln x+1$, por isso $${n}'(x)=\ln x$, que se anula em $x=1$.` }),
  (n) => ({ id: 'xlnx', f: T`x\ln x`, fx: 'x*ln(x)', tipo: 'min', c: E(-1), y: L(-1, 1, -1), limX: '+\\infty', sinal: T`Pela regra do produto, $${n}'(x)=\ln x+1$, que se anula em $x=\dfrac{1}{e}$.` }),
  (n) => ({ id: 'x2lnx', f: T`x^{2}\ln x`, fx: 'x^2*ln(x)', tipo: 'min', c: E(-0.5), y: L(-1, 2, -1), limX: '+\\infty', sinal: T`Pela regra do produto, $${n}'(x)=2x\ln x+x=x(2\ln x+1)$. Como $x>0$, o sinal de $${n}'$ é o de $2\ln x+1$, que se anula em $x=\dfrac{1}{\sqrt{e}}$.` }),
  (n) => ({ id: 'lnx/x', f: T`\dfrac{\ln x}{x}`, fx: 'ln(x)/x', tipo: 'max', c: E(1), y: L(1, 1, -1), limX: '0^{+}', sinal: T`Pela regra do quociente, $${n}'(x)=\dfrac{1-\ln x}{x^{2}}$. O denominador é positivo, por isso o sinal de $${n}'$ é o de $1-\ln x$, que se anula em $x=e$.` }),
  (n) => ({ id: 'e^x/x', dom: DOM_RP_DADO, f: T`\dfrac{e^{x}}{x}`, fx: 'exp(x)/x', tipo: 'min', c: L(1), y: E(1), limX: '+\\infty', sinal: T`Pela regra do quociente, $${n}'(x)=\dfrac{e^{x}(x-1)}{x^{2}}$. Como $e^{x}>0$ e $x^{2}>0$, o sinal de $${n}'$ é o de $x-1$, que se anula em $x=1$.` }),
];

function csLog(rng, n) {
  const t = um(rng, TABELA_LOG)(n);
  return {
    id: t.id,
    f: t.f,
    fx: t.fx,
    dom: t.dom || DOM_RP,
    pecas: pecas2(t.dom || DOM_RP, t.c, t.tipo),
    ext: { tipo: t.tipo, x: t.c, y: t.y, yTex: ltex(t.y), yV: lVal(t.y) },
    sinal: t.sinal,
    limX: t.limX,
  };
}

/** x²e^{-x} e x²e^{x}: dois pontos críticos; só se pergunta um dos intervalos. */
function csX2Exp(rng, n) {
  const y = L(0);
  const base = {
    dom: DOM_R,
    ext: { tipo: 'min', x: L(0), y, yTex: '0', yV: 0 },
  };
  if (rng() < 0.5) {
    return {
      ...base,
      outroCritico: { x: L(2), y: L(4, 1, -2) },
      id: 'x2e-x',
      f: T`x^{2}\,e^{-x}`,
      fx: 'x^2*exp(-x)',
      pecas: [peca('-', MINF, false, ep(L(0)), true), peca('+', ep(L(0)), true, ep(L(2)), true), peca('-', ep(L(2)), true, INF, false)],
      perg: [1],
      sinal: T`Pela regra do produto, $${n}'(x)=2x\,e^{-x}-x^{2}e^{-x}=x(2-x)e^{-x}$. Como $e^{-x}>0$, o sinal de $${n}'$ é o de $x(2-x)$, que se anula em $x=0$ e em $x=2$.`,
      extJust: T`Como $${n}'$ passa de negativa a positiva em $x=0$ e $${n}(x)=x^{2}e^{-x}\ge0$ para todo o $x$, o ponto $x=0$ dá o mínimo absoluto.`,
      limX: '-\\infty',
    };
  }
  return {
    ...base,
    outroCritico: { x: L(-2), y: L(4, 1, -2) },
    id: 'x2ex',
    f: T`x^{2}\,e^{x}`,
    fx: 'x^2*exp(x)',
    pecas: [peca('+', MINF, false, ep(L(-2)), true), peca('-', ep(L(-2)), true, ep(L(0)), true), peca('+', ep(L(0)), true, INF, false)],
    perg: [1],
    sinal: T`Pela regra do produto, $${n}'(x)=2x\,e^{x}+x^{2}e^{x}=x(x+2)e^{x}$. Como $e^{x}>0$, o sinal de $${n}'$ é o de $x(x+2)$, que se anula em $x=-2$ e em $x=0$.`,
    extJust: T`Como $${n}'$ passa de negativa a positiva em $x=0$ e $${n}(x)=x^{2}e^{x}\ge0$ para todo o $x$, o ponto $x=0$ dá o mínimo absoluto.`,
    limX: '+\\infty',
  };
}

/** e^{px²+qx}, com q par para o valor extremo ser e^inteiro. */
function csGauss(rng, n) {
  const p = um(rng, [1, 1, -1]);
  const q = um(rng, [0, 2, -2, 4, -4]);
  const u = soma(p === 1 ? 'x^{2}' : '-x^{2}', q ? coefX(q) : '');
  const du = soma(coefX(2 * p), q ? String(q) : '');
  const c = L(-q, 2 * p);
  const uc = -(q * q) / (4 * p);
  const y = L(1, 1, uc);
  const tipo = p === 1 ? 'min' : 'max';
  const dTex = q === 0 ? T`${coefX(2 * p)}\,e^{${u}}` : T`(${du})e^{${u}}`;
  return {
    id: 'gauss',
    f: T`e^{${u}}`,
    fx: `exp((${p})*x^2+(${q})*x)`,
    dom: DOM_R,
    pecas: pecas2(DOM_R, c, tipo),
    ext: { tipo, x: c, y, yTex: ltex(y), yV: lVal(y) },
    sinal: T`Com $u=${u}$ tem-se $u'=${du}$, e $${n}'(x)=u'\,e^{u}=${dTex}$. Como $e^{u}>0$, o sinal de $${n}'$ é o de $${du}$, que se anula em $x=${ltex(c)}$.`,
    limX: '+\\infty',
    contra: tipo === 'max' ? { lo: ZERO, loC: false, hi: ep(y), hiC: true } : undefined,
    lim: tipo === 'max' ? T`Como $${n}$ tem máximo $${ltex(y)}$, e $${n}(x)>0$ com $${n}(x)\to0$ quando $x\to\pm\infty$ (sem nunca valer $0$),` : undefined,
  };
}

/** ln(x²+c). */
function csLnQuad(rng, n) {
  const c = um(rng, [1, 2, 3, 4, 5, 'e']);
  const cv = c === 'e' ? Math.E : c;
  const yTex = c === 'e' ? '1' : (c === 1 ? '0' : T`\ln ${c}`);
  const y = c === 'e' ? L(1) : (c === 1 ? L(0) : null);
  return {
    id: 'ln-x2+c',
    f: T`\ln(x^{2}+${c})`,
    fx: `ln(x^2+${c})`,
    dom: DOM_R,
    pecas: pecas2(DOM_R, L(0), 'min'),
    ext: { tipo: 'min', x: L(0), y, yTex, yV: Math.log(cv) },
    sinal: T`$${n}'(x)=\dfrac{2x}{x^{2}+${c}}$. O denominador é sempre positivo, por isso o sinal de $${n}'$ é o de $2x$, que se anula em $x=0$.`,
    limX: '+\\infty',
    altLim: [{ v: cv, tex: String(c) }],
  };
}

/** e^{kx}-kx e variantes com mínimo 1 ou 0. */
function csExpLin(rng, n) {
  const r = rng();
  if (r < 0.6) {
    const k = um(rng, [1, 2, 3, -1, -2, -3]);
    const kx = coefX(k);
    const dTex = k === 1 ? 'e^{x}-1' : T`${coef(k)}(e^{${kx}}-1)`;
    return {
      id: 'e^kx-kx',
      f: soma(T`e^{${kx}}`, coefX(-k)),
      fx: `exp(${k}*x)-(${k})*x`,
      dom: DOM_R,
      pecas: pecas2(DOM_R, L(0), 'min'),
      ext: { tipo: 'min', x: L(0), y: L(1), yTex: '1', yV: 1 },
      sinal: T`$${n}'(x)=${dTex}$, que se anula quando $e^{${kx}}=1$, isto é, em $x=0$.`,
      limX: k > 0 ? '+\\infty' : '-\\infty',
    };
  }
  if (r < 0.8) {
    return {
      id: 'e^x-ex',
      f: T`e^{x}-e\,x`,
      fx: 'exp(x)-e*x',
      dom: DOM_R,
      pecas: pecas2(DOM_R, L(1), 'min'),
      ext: { tipo: 'min', x: L(1), y: L(0), yTex: '0', yV: 0 },
      sinal: T`$${n}'(x)=e^{x}-e$, que se anula quando $e^{x}=e$, isto é, em $x=1$.`,
      limX: '+\\infty',
    };
  }
  return {
    id: 'e^(x-1)-x',
    f: T`e^{x-1}-x`,
    fx: 'exp(x-1)-x',
    dom: DOM_R,
    pecas: pecas2(DOM_R, L(1), 'min'),
    ext: { tipo: 'min', x: L(1), y: L(0), yTex: '0', yV: 0 },
    sinal: T`$${n}'(x)=e^{x-1}-1$, que se anula quando $e^{x-1}=1$, isto é, em $x=1$.`,
    limX: '+\\infty',
  };
}

// Casos só para o contradomínio (sem extremo): a·e^{kx}+b em R, em intervalo fechado, a·ln x+b
// em intervalo, b+a·ln(x-p) no domínio natural.

function csRangeExp(rng, n) {
  const k = um(rng, [1, 2, 3, -1, -2]);
  const a = um(rng, [1, 2, 3, -1, -2, -3]);
  const b = um(rng, [-3, -2, -1, 1, 2, 3]);
  const kx = coefX(k);
  const termo = T`${coef(a)}e^{${kx}}`;
  const f = rng() < 0.5 ? soma(termo, String(b)) : soma(String(b), termo);
  const B = ep(L(b));
  const contra = a > 0 ? { lo: B, loC: false, hi: INF, hiC: false } : { lo: MINF, loC: false, hi: B, hiC: false };
  return {
    id: 'a-exp+b',
    f,
    fx: `(${a})*exp(${k}*x)+(${b})`,
    dom: DOM_R,
    contra,
    lim: T`Como $e^{${kx}}>0$, o termo $${termo}$ é ${a > 0 ? 'positivo' : 'negativo'} e $${n}(x)${a > 0 ? '>' : '<'}${b}$ para todo o $x$. Quando $x\to${k > 0 ? '-\\infty' : '+\\infty'}$, esse termo tende para $0$ e $${n}(x)\to${b}$ sem nunca o atingir, e do outro lado $${n}$ ${a > 0 ? 'cresce' : 'decresce'} sem limite. Sendo $${n}$ contínua,`,
    altLim: [ZERO, { v: -b, tex: String(-b) }],
  };
}

function csRangeExpRestr(rng, n) {
  const k = um(rng, [1, -1]);
  const a = um(rng, [1, 2, 3, -1, -2, -3]);
  const b = um(rng, [-3, -2, -1, 0, 1, 2, 3]);
  const ds = M.baralhar(rng, [1, 2, 3, 4]).slice(0, 2).sort((x, y) => x - y);
  const loC = rng() < 0.7;
  const hiC = rng() < 0.7;
  const kx = coefX(k);
  const termo = T`${coef(a)}e^{${kx}}`;
  const bs = b ? String(b) : '';
  const f = rng() < 0.5 ? soma(termo, bs) : soma(bs, termo);
  const ponto = (d) => ({ v: Math.log(d), tex: d === 1 ? '0' : T`\ln ${d}` });
  const val = (d) => lSoma(L(a * (k === 1 ? d : 1), k === 1 ? 1 : d), L(b)); // a·d^k + b
  const [d1, d2] = ds;
  const v1 = val(d1);
  const v2 = val(d2);
  const cresce = a * k > 0;
  const contra = cresce
    ? { lo: ep(v1), loC, hi: ep(v2), hiC }
    : { lo: ep(v2), loC: hiC, hi: ep(v1), hiC: loC };
  const dom = { lo: ponto(d1), loC, hi: ponto(d2), hiC, natural: false };
  dom.tex = intTex(dom.lo, dom.loC, dom.hi, dom.hiC);
  const potE = (d) => {
    if (d === 1) return T`e^{0}=1`;
    return k === 1 ? T`e^{\ln ${d}}=${d}` : T`e^{-\ln ${d}}=\dfrac{1}{${d}}`;
  };
  return {
    id: 'a-exp+b-restr',
    f,
    fx: `(${a})*exp(${k}*x)+(${b})`,
    dom,
    contra,
    lim: T`A função $${n}$ é ${cresce ? 'crescente' : 'decrescente'} no domínio (a exponencial ${k > 0 ? 'cresce' : 'decresce'} e o fator $${a}$ é ${a > 0 ? 'positivo' : 'negativo'}), por isso os extremos do contradomínio são os valores nos extremos do domínio. Como $${potE(d1)}$ e $${potE(d2)}$, vem $${n}(${dom.lo.tex})=${ltex(v1)}$ e $${n}(${dom.hi.tex})=${ltex(v2)}$. Assim,`,
    altLim: [ZERO, ep(L(a + b))],
  };
}

function csRangeLn(rng, n) {
  const a = um(rng, [1, 2, 3, -1, -2, -3]);
  const b = um(rng, [-3, -2, -1, 0, 1, 2, 3]);
  const js = M.baralhar(rng, [-1, 0, 1, 2, 3]).slice(0, 2).sort((x, y) => x - y);
  const loC = rng() < 0.7;
  const hiC = rng() < 0.7;
  const lnx = T`${coef(a)}\ln x`;
  const bs = b ? String(b) : '';
  const f = rng() < 0.5 ? soma(lnx, bs) : soma(bs, lnx);
  const [j1, j2] = js;
  const v1 = L(a * j1 + b);
  const v2 = L(a * j2 + b);
  const cresce = a > 0;
  const contra = cresce
    ? { lo: ep(v1), loC, hi: ep(v2), hiC }
    : { lo: ep(v2), loC: hiC, hi: ep(v1), hiC: loC };
  const dom = { lo: ep(E(j1)), loC, hi: ep(E(j2)), hiC, natural: false };
  dom.tex = intTex(dom.lo, dom.loC, dom.hi, dom.hiC);
  return {
    id: 'a-ln+b-restr',
    f,
    fx: `(${a})*ln(x)+(${b})`,
    dom,
    contra,
    lim: T`A função $${n}$ é ${cresce ? 'crescente' : 'decrescente'} no domínio (o logaritmo é crescente e o fator $${a}$ é ${a > 0 ? 'positivo' : 'negativo'}). Usando $\ln e^{k}=k$, vem $${n}(${dom.lo.tex})=${ltex(v1)}$ e $${n}(${dom.hi.tex})=${ltex(v2)}$. Assim,`,
    altLim: [ZERO, ep(L(b))],
  };
}

function csRangeLnDesl(rng, n) {
  const a = um(rng, [1, 2, 3, -1, -2, -3]);
  const b = um(rng, [-3, -2, -1, 1, 2, 3]);
  const p = um(rng, [1, 2, 3, -1, -2]);
  const lnt = T`${coef(a)}\ln(${soma('x', String(-p))})`;
  const f = rng() < 0.5 ? soma(String(b), lnt) : soma(lnt, String(b));
  const dom = { lo: { v: p, tex: String(p) }, loC: false, hi: INF, hiC: false, natural: true };
  dom.tex = intTex(dom.lo, false, INF, false);
  return {
    id: 'b+a-ln(x-p)',
    f,
    fx: `(${b})+(${a})*ln(x-(${p}))`,
    dom,
    contra: { lo: MINF, loC: false, hi: INF, hiC: false },
    lim: T`Em $${dom.tex}$, o argumento $${soma('x', String(-p))}$ percorre todos os números positivos, e $\ln(${soma('x', String(-p))})$ toma todos os valores reais (tende para $-\infty$ perto de $${p}$ e para $+\infty$ quando $x\to+\infty$). Multiplicar por $${a}$ e somar $${b}$ não muda isto, por isso, sendo $${n}$ contínua,`,
    altLim: [{ v: b, tex: String(b) }, { v: p, tex: String(p) }],
  };
}

// ---------- Monotonia, extremos e contradomínio: perguntas ----------

const MIN_MAX = { min: 'mínimo', max: 'máximo' };
const DIR_PALAVRA = { '+': 'crescente', '-': 'decrescente' };

/** Hipóteses de ponto crítico erradas, a partir do certo c: sinal trocado, inverso, dobro, metade... */
function variantesC(c) {
  const racional = ![...c.keys()].some((k) => k !== 0);
  const out = [lNeg(c), lMul(c, L(2)), lMul(c, L(1, 2))];
  const inv = lInv(c);
  if (inv) out.push(inv);
  if (racional) out.push(lSoma(c, L(1)), lSub(c, L(1)));
  return out.map(ep);
}

/** A função é monótona no sentido `dir` em I? (amostragem das diferenças finitas). */
function ehMonotona(f, I, dir) {
  const fl = Number.isFinite(I.lo.v);
  const fh = Number.isFinite(I.hi.v);
  const A = fl ? I.lo.v : (fh ? I.hi.v - 20 : -15);
  const B = fh ? I.hi.v : (fl ? A + 20 : 15);
  const N = 300;
  for (let i = 1; i < N; i++) {
    const x = A + ((B - A) * i) / N;
    const h = 1e-5 * (1 + Math.abs(x));
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (Number.isFinite(d) && dir * d < -1e-4) return false;
  }
  return true;
}

function intervalosErrados(rng, cs, p) {
  const f = M.criarFuncao(cs.fx);
  const dir = p.dir === '+' ? 1 : -1;
  const dom = cs.dom;
  const itens = [];
  const addInt = (g, lo, loC, hi, hiC) => {
    if (!(lo.v < hi.v)) return;
    if (lo.v < dom.lo.v || hi.v > dom.hi.v) return;
    if (lo.v === dom.lo.v && !dom.loC && loC) return;
    const I = { lo, loC, hi, hiC };
    if (ehMonotona(f, I, dir)) return;
    g.push({ k: chaveInt(I), tex: intTex(lo, loC, hi, hiC) });
  };
  // 1. o intervalo do sentido contrário
  const g1 = [];
  for (const q of cs.pecas) if (q.dir !== p.dir) addInt(g1, q.lo, q.loC, q.hi, q.hiC);
  // 2. o ponto crítico trocado por um valor errado; todo o domínio
  const g2 = [];
  const fronteira = (e, lado) => e.v === (lado === 'lo' ? dom.lo.v : dom.hi.v);
  for (const lado of ['lo', 'hi']) {
    if (fronteira(p[lado], lado)) continue;
    const c = p[lado];
    for (const alt of variantesC(c.L)) {
      if (lado === 'lo') addInt(g2, alt, p.loC, p.hi, p.hiC);
      else addInt(g2, p.lo, p.loC, alt, p.hiC);
    }
  }
  const todo = { lo: dom.lo, loC: dom.loC, hi: dom.hi, hiC: dom.hiC };
  if (!ehMonotona(f, todo, dir)) g2.push({ k: chaveInt(todo), tex: dom.tex });
  itens.push(g1, g2);
  return itens;
}

function perguntaMonotonia(rng, n, cs) {
  const idx = um(rng, cs.perg || cs.pecas.map((_, i) => i));
  const p = cs.pecas[idx];
  const correta = intTex(p.lo, p.loC, p.hi, p.hiC);
  const [g1, g2] = intervalosErrados(rng, cs, p);
  const vistas = new Set([chaveInt(p)]);
  const outras = [...escolherN(rng, [g1], vistas, 1), ...escolherN(rng, [g2, g1], vistas, 2)];
  const palavra = DIR_PALAVRA[p.dir];
  const partes = cs.pecas.map((q) => `${DIR_PALAVRA[q.dir]} em $${intTex(q.lo, q.loC, q.hi, q.hiC)}$`);
  const lista = partes.length === 2 ? partes.join(' e ') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  return {
    enunciado: `${introducao(rng, n, cs)} ${um(rng, [
      T`Qual é o maior intervalo em que $${n}$ é ${palavra}?`,
      T`Indica o maior intervalo onde $${n}$ é ${palavra}.`,
      T`Em que intervalo, o maior possível, $${n}$ é ${palavra}?`,
    ])}`,
    correta,
    outras,
    explicacao: T`${cs.sinal} Logo $${n}$ é ${lista}.`,
    verificacao: { pedido: 'monotonia', dir: p.dir },
  };
}

function introducao(rng, n, cs) {
  return um(rng, [
    T`Considera a função $${n}$, de domínio $${cs.dom.tex}$, definida por $${n}(x)=${cs.f}$.`,
    T`Seja $${n}$ a função de domínio $${cs.dom.tex}$ definida por $${n}(x)=${cs.f}$.`,
    T`A função $${n}$, de domínio $${cs.dom.tex}$, é definida por $${n}(x)=${cs.f}$.`,
  ]);
}

const dentroDom = (dom, v) => (v > dom.lo.v || (dom.loC && v === dom.lo.v)) && (v < dom.hi.v || (dom.hiC && v === dom.hi.v));

function perguntaExtremo(rng, n, cs, valor) {
  const { tipo, x, y, yTex } = cs.ext;
  const word = MIN_MAX[tipo];
  const it = (v) => ({ k: lChave(v), tex: ltex(v), v: lVal(v) });
  const fora = (c) => !dentroDom(cs.dom, c.v);
  const tail = T`Logo ${valor ? T`o ${word} absoluto de $${n}$ é` : T`$${n}$ atinge o ${word} absoluto em $x=${ltex(x)}$, onde`} $${n}(${ltex(x)})=${yTex}$.`;
  let correta;
  let vistas;
  let grupos;
  let enunciado;
  if (valor) {
    correta = ltex(y);
    vistas = new Set([lChave(y)]);
    grupos = [
      [it(x), it(lNeg(y)), ...(cs.outroCritico ? [it(cs.outroCritico.y)] : [])],
      [it(lSoma(y, L(1))), it(lSub(y, L(1))), it(lMul(y, L(2))), it(lMul(y, L(1, 2))), it(L(0)), it(L(1))],
      [it(lMul(y, E(1))), it(lMul(y, E(-1))), it(L(-1)), it(E(1)), it(E(-1)), it(L(2))],
    ];
    enunciado = um(rng, [T`Qual é o ${word} absoluto de $${n}$?`, T`Determina o valor ${word} de $${n}$.`, T`Qual é o ${word} absoluto da função $${n}$?`]);
  } else {
    correta = ltex(x);
    vistas = new Set([lChave(x)]);
    const inv = lInv(x);
    grupos = [
      [y ? it(y) : null, it(lNeg(x)), inv ? it(inv) : null, ...(cs.outroCritico ? [it(cs.outroCritico.x)] : [])],
      [it(lSoma(x, L(1))), it(lSub(x, L(1))), it(lMul(x, L(2))), it(lMul(x, L(1, 2))), it(L(0)), it(L(1))],
      [it(lMul(x, E(1))), it(lMul(x, E(-1))), it(L(-1)), it(E(1)), it(E(-1)), it(L(2))],
    ].map((g) => g.filter((c) => c && !fora(c)));
    enunciado = um(rng, [T`Em que ponto $${n}$ atinge o seu ${word} absoluto? Indica a abcissa.`, T`Para que valor de $x$ tem $${n}$ o ${word} absoluto?`]);
  }
  const outras = escolherN(rng, grupos, vistas, 3).map(({ k, tex }) => ({ k, tex }));
  const just = cs.extJust || T`Como $${n}'$ passa de ${cs.pecas[0].dir === '-' ? 'negativa a positiva' : 'positiva a negativa'} em $x=${ltex(x)}$, é aí que $${n}$ tem o ${word}; é absoluto porque esse é o único ponto onde $${n}'$ se anula.`;
  return {
    enunciado: `${introducao(rng, n, cs)} ${enunciado}`,
    correta,
    outras,
    explicacao: T`${cs.sinal} ${just} ${tail}`,
    verificacao: { pedido: valor ? 'extremo-valor' : 'extremo-abcissa', tipoExt: tipo },
  };
}

function conjuntosErrados(cs, S) {
  const fin = (e) => Number.isFinite(e.v);
  const alts = [];
  if (cs.ext) alts.push(ep(cs.ext.x));
  alts.push(ZERO);
  for (const e of [S.lo, S.hi]) {
    if (!fin(e) || e.v === 0) continue;
    if (e.L) alts.push(ep(lNeg(e.L)));
    else if (/^[^+-]*$/.test(e.tex)) alts.push({ v: -e.v, tex: `-${e.tex}` });
  }
  for (const e of cs.altLim || []) alts.push(e);
  if (cs.ext && cs.ext.y) alts.push(ep(lSoma(cs.ext.y, L(1))), ep(lSub(cs.ext.y, L(1))));
  const g1 = [];
  const g2 = [];
  const g3 = [];
  const add = (g, lo, loC, hi, hiC) => {
    if (!(lo.v < hi.v || (lo.v === hi.v && loC && hiC))) return;
    const I = { lo, loC, hi, hiC };
    g.push({ k: chaveInt(I), tex: conjTex(I) });
  };
  if (fin(S.lo)) add(g1, S.lo, !S.loC, S.hi, S.hiC);
  if (fin(S.hi)) add(g1, S.lo, S.loC, S.hi, !S.hiC);
  if (fin(S.lo) && fin(S.hi)) add(g1, S.lo, !S.loC, S.hi, !S.hiC);
  if (!fin(S.lo) && fin(S.hi)) add(g2, S.hi, S.hiC, INF, false);
  if (fin(S.lo) && !fin(S.hi)) add(g2, MINF, false, S.lo, S.loC);
  add(g2, MINF, false, INF, false);
  add(g2, ZERO, false, INF, false);
  for (const alt of alts) {
    if (fin(S.lo)) add(g3, alt, S.loC, S.hi, S.hiC);
    if (fin(S.hi)) add(g3, S.lo, S.loC, alt, S.hiC);
    if (!fin(S.lo) && !fin(S.hi)) {
      add(g3, alt, false, INF, false);
      add(g3, MINF, false, alt, false);
      add(g3, alt, true, INF, false);
    }
  }
  return [g1, g2, g3];
}

function perguntaContra(rng, n, cs) {
  const S = cs.contra || (cs.ext.tipo === 'min'
    ? { lo: { v: cs.ext.yV, tex: cs.ext.yTex }, loC: true, hi: INF, hiC: false }
    : { lo: MINF, loC: false, hi: { v: cs.ext.yV, tex: cs.ext.yTex }, hiC: true });
  const correta = conjTex(S);
  const [g1, g2, g3] = conjuntosErrados(cs, S);
  const vistas = new Set([chaveInt(S)]);
  const tipicos = escolherN(rng, [g1], vistas, Math.min(2, g1.length));
  const outras = [...tipicos, ...escolherN(rng, [M.baralhar(rng, [...g2, ...g3]), g1], vistas, 3 - tipicos.length)];
  return {
    enunciado: `${introducao(rng, n, cs)} ${um(rng, [T`Qual é o contradomínio de $${n}$?`, T`Indica o contradomínio da função $${n}$.`])}`,
    correta,
    outras,
    explicacao: T`${cs.sinal ? cs.sinal + ' ' : ''}${cs.lim || limite1(n, cs.ext.tipo, cs.ext.yTex, cs.limX)} o contradomínio é $${correta}$.`,
    verificacao: { pedido: 'contradominio' },
  };
}

const CASOS_MON = [csXExp, csProdExp, csLog, csLog, csX2Exp, csGauss, csLnQuad, csExpLin];
const CASOS_RANGE = [[csRangeExp, 4], [csRangeExpRestr, 3], [csRangeLn, 3], [csRangeLnDesl, 2]];

function monotoniaContradominio(rng) {
  const n = um(rng, ['f', 'f', 'g', 'h']);
  const r = rng();
  let cs;
  let q;
  if (r < 0.34) {
    cs = um(rng, CASOS_MON)(rng, n);
    q = comContexto(`monotonia ${cs.id}`, () => perguntaMonotonia(rng, n, cs));
  } else if (r < 0.5) {
    cs = um(rng, CASOS_MON)(rng, n);
    q = comContexto(`extremo ${cs.id}`, () => perguntaExtremo(rng, n, cs, rng() < 0.55 && cs.ext.y !== null));
  } else {
    cs = rng() < 0.45 ? um(rng, CASOS_MON)(rng, n) : escolherPeso(rng, CASOS_RANGE)(rng, n);
    q = comContexto(`contradomínio ${cs.id}`, () => perguntaContra(rng, n, cs));
  }
  const dom = cs.dom;
  return escolha(rng, 'monotonia-contradominio', {
    enunciado: q.enunciado,
    correta: q.correta,
    outras: q.outras,
    explicacao: q.explicacao,
    verificacao: {
      ...q.verificacao,
      familia: cs.id,
      nome: n,
      f: cs.f,
      fx: cs.fx,
      dominio: { lo: dom.lo.v, hi: dom.hi.v, loC: dom.loC, hiC: dom.hiC, natural: dom.natural, tex: dom.tex },
    },
  });
}

export const TIPOS_ANALISE = [
  { id: 'limite', nome: 'Limites com exponenciais e logaritmos', tema: 'Limites', gerar: limite },
  { id: 'derivada', nome: 'Derivadas de exponenciais e logaritmos', tema: 'Derivadas', gerar: derivada },
  { id: 'tangente', nome: 'Reta tangente ao gráfico', tema: 'Derivadas', gerar: tangente },
  { id: 'monotonia-contradominio', nome: 'Monotonia, extremos e contradomínio', tema: 'Estudo de funções', gerar: monotoniaContradominio },
];
