// Matemática pura, sem DOM: frações de π, avaliador de expressões, correção de
// respostas e tabela de valores exatos. É usada pelos widgets, pelo treino e
// por tests.html, por isso não pode tocar em document nem em window.

export const PI = Math.PI;

// ---------- Números e frações ----------

export const mdc = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

/** Reduz p/q e deixa o sinal no numerador. */
export function reduzir(p, q = 1) {
  if (q === 0) throw new Error('denominador nulo');
  const g = mdc(p, q);
  p /= g;
  q /= g;
  if (q < 0) { p = -p; q = -q; }
  return [p, q];
}

export const grausParaRad = (g) => (g * PI) / 180;
export const radParaGraus = (r) => (r * 180) / PI;
export const normalizarGraus = (g) => ((g % 360) + 360) % 360;

/** 1 a 4; 0 se estiver sobre um dos eixos. */
export function quadrante(graus) {
  const g = normalizarGraus(graus);
  if (g % 90 === 0) return 0;
  return Math.floor(g / 90) + 1;
}

/** p/q em LaTeX: 1/2 -> \frac{1}{2}; -3/1 -> -3. */
export function fracTex(p, q = 1) {
  [p, q] = reduzir(p, q);
  const sinal = p < 0 ? '-' : '';
  const n = Math.abs(p);
  return q === 1 ? `${sinal}${n}` : `${sinal}\\frac{${n}}{${q}}`;
}

/** (p/q)·π em LaTeX: \frac{5\pi}{6}, \pi, 2\pi, -\frac{\pi}{2}, 0. */
export function fracPiTex(p, q = 1) {
  [p, q] = reduzir(p, q);
  if (p === 0) return '0';
  const sinal = p < 0 ? '-' : '';
  const n = Math.abs(p);
  const num = n === 1 ? '\\pi' : `${n}\\pi`;
  return q === 1 ? `${sinal}${num}` : `${sinal}\\frac{${num}}{${q}}`;
}

/** (p/q)·π em texto simples, para rótulos SVG: 5π/6, π, −π/2, 0. */
export function fracPiTexto(p, q = 1) {
  [p, q] = reduzir(p, q);
  if (p === 0) return '0';
  const sinal = p < 0 ? '−' : '';
  const n = Math.abs(p);
  const num = n === 1 ? 'π' : `${n}π`;
  return q === 1 ? `${sinal}${num}` : `${sinal}${num}/${q}`;
}

/** Graus inteiros como fração de π: 150 -> [5, 6]. */
export const grausEmFracPi = (graus) => reduzir(Math.round(graus), 180);

/** Número com vírgula decimal e sinal de menos «−». 0,866 · −0,500 */
export function fmt(x, casas = 3) {
  const limiar = 0.5 * Math.pow(10, -casas);
  const v = Math.abs(x) < limiar ? 0 : x;
  const s = v.toFixed(casas).replace('.', ',');
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

// ---------- Gerador aleatório com semente (testes reprodutíveis) ----------

/** mulberry32: devolve uma função que dá números em [0, 1). */
export function criarRng(semente = Date.now() >>> 0) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const inteiro = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
export const escolher = (rng, lista) => lista[Math.floor(rng() * lista.length)];

export function baralhar(rng, lista) {
  const l = lista.slice();
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

// ---------- Avaliador de expressões (sem eval) ----------
// Aceita: números (3,5 ou 3.5), pi/π, sqrt(x)/√x/raiz(x), + - * / ^, parênteses,
// multiplicação implícita (2π, 3√2, (1/2)(3)) e variáveis dadas em `vars`.

function tokenizar(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const resto = s.slice(i);
    let m = /^(\d+[.,]\d+|\d+|[.,]\d+)/.exec(resto);
    if (m) {
      toks.push({ t: 'n', v: parseFloat(m[1].replace(',', '.')), dec: /[.,]/.test(m[1]) });
      i += m[1].length;
      continue;
    }
    m = /^[a-zA-Z]+/.exec(resto);
    if (m) { toks.push({ t: 'i', v: m[0].toLowerCase() }); i += m[0].length; continue; }
    if ('+-*/^()'.includes(c)) { toks.push({ t: 'o', v: c }); i++; continue; }
    return null;
  }
  return toks;
}

function analisar(toks, vars) {
  let k = 0;
  const ver = () => toks[k];
  const eOp = (t, ...ops) => t && t.t === 'o' && ops.includes(t.v);
  const comecaFator = (t) => t && (t.t === 'n' || t.t === 'i' || eOp(t, '('));

  function expr() {
    let x = termo();
    while (eOp(ver(), '+', '-')) {
      const op = toks[k++].v;
      x = { t: 'bin', op, a: x, b: termo() };
    }
    return x;
  }

  function termo() {
    let x = unario();
    for (;;) {
      const t = ver();
      if (!t) break;
      if (eOp(t, '*', '/')) {
        k++;
        x = { t: 'bin', op: t.v, a: x, b: unario() };
      } else if (comecaFator(t)) {
        // multiplicação implícita, mas nunca entre dois números soltos («2 3»)
        if (t.t === 'n' && toks[k - 1] && toks[k - 1].t === 'n') throw new Error('dois números seguidos');
        x = { t: 'bin', op: '*', a: x, b: potencia() };
      } else break;
    }
    return x;
  }

  function unario() {
    const t = ver();
    if (eOp(t, '-', '+')) {
      k++;
      const x = unario();
      return t.v === '-' ? { t: 'neg', x } : x;
    }
    return potencia();
  }

  function potencia() {
    const base = atomo();
    if (eOp(ver(), '^')) {
      k++;
      return { t: 'pow', a: base, b: unario() };
    }
    return base;
  }

  function atomo() {
    const t = toks[k++];
    if (!t) throw new Error('expressão incompleta');
    if (t.t === 'n') return { t: 'num', v: t.v, dec: t.dec };
    if (eOp(t, '(')) {
      const x = expr();
      const f = toks[k++];
      if (!eOp(f, ')')) throw new Error('parêntese por fechar');
      return x;
    }
    if (t.t === 'i') {
      if (t.v === 'pi') return { t: 'pi' };
      if (t.v === 'sqrt' || t.v === 'raiz') return { t: 'sqrt', x: atomo() };
      if (Object.prototype.hasOwnProperty.call(vars, t.v)) return { t: 'var', n: t.v };
      throw new Error(`símbolo desconhecido: ${t.v}`);
    }
    throw new Error('símbolo inesperado');
  }

  const raiz = expr();
  if (k !== toks.length) throw new Error('sobrou texto');
  return raiz;
}

function valorDe(n, vars) {
  switch (n.t) {
    case 'num': return n.v;
    case 'pi': return PI;
    case 'var': return vars[n.n];
    case 'neg': return -valorDe(n.x, vars);
    case 'sqrt': {
      const v = valorDe(n.x, vars);
      if (v < 0) throw new Error('raiz de negativo');
      return Math.sqrt(v);
    }
    case 'pow': return Math.pow(valorDe(n.a, vars), valorDe(n.b, vars));
    case 'bin': {
      const a = valorDe(n.a, vars);
      const b = valorDe(n.b, vars);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (b === 0) throw new Error('divisão por zero');
      return a / b;
    }
    default: throw new Error('nó desconhecido');
  }
}

const contem = (n, tipo) => {
  if (!n || typeof n !== 'object') return false;
  if (n.t === tipo) return true;
  return contem(n.x, tipo) || contem(n.a, tipo) || contem(n.b, tipo);
};
const temDecimal = (n) => {
  if (!n || typeof n !== 'object') return false;
  if (n.t === 'num' && n.dec) return true;
  return temDecimal(n.x) || temDecimal(n.a) || temDecimal(n.b);
};
// raiz no denominador: qualquer «/» cujo lado direito contenha uma raiz
const raizNoDenominador = (n) => {
  if (!n || typeof n !== 'object') return false;
  if (n.t === 'bin' && n.op === '/' && contem(n.b, 'sqrt')) return true;
  return raizNoDenominador(n.x) || raizNoDenominador(n.a) || raizNoDenominador(n.b);
};

// U+2212 (menos), U+2013 e U+2014; por código para não pôr o travessão no ficheiro
const TRACOS = new RegExp('[' + String.fromCharCode(0x2212, 0x2013, 0x2014) + ']', 'g');

function normalizarTexto(s) {
  return String(s)
    .trim()
    .replace(TRACOS, '-') // sinal de menos e traços de vários comprimentos
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[πΠ]/g, 'pi')
    .replace(/√/g, 'sqrt ');
}

/**
 * avaliar('√3/2') -> { ok: true, valor: 0.866…, dec: false, raizDenominador: false }
 * avaliar('pi-a', { a: 0.5 }) usa variáveis. Em erro: { ok: false, erro }.
 */
export function avaliar(texto, vars = {}) {
  try {
    const toks = tokenizar(normalizarTexto(texto));
    if (!toks || toks.length === 0) return { ok: false, erro: 'vazio ou com símbolos que não conheço' };
    const ast = analisar(toks, vars);
    const valor = valorDe(ast, vars);
    if (!Number.isFinite(valor)) return { ok: false, erro: 'não é um número' };
    return { ok: true, valor, dec: temDecimal(ast), raizDenominador: raizNoDenominador(ast) };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// ---------- Correção de respostas ----------

const SEM_SENTIDO = new Set([
  'nd', 'n.d.', 'n.d', 'naodefinida', 'naodefinido', 'indefinida', 'indefinido',
  'impossivel', 'naoexiste', 'semsentido',
]);

/** «n.d.», «não definida», «indefinida»... */
export function ehNaoDefinida(texto) {
  const s = String(texto).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[\s_]+/g, '');
  return SEM_SENTIDO.has(s);
}

/**
 * Compara a resposta escrita com o valor esperado.
 * esperado: { expr: 'sqrt(3)/2' }  ou  { naoDefinida: true }
 * estado: 'certo' | 'certo-forma' (raiz no denominador) | 'decimal' (certo mas em
 * decimal, pede-se a forma exata) | 'errado' | 'invalido' (não consegui ler)
 */
export function corrigir(resposta, esperado) {
  if (esperado.naoDefinida) {
    return { estado: ehNaoDefinida(resposta) ? 'certo' : 'errado' };
  }
  if (ehNaoDefinida(resposta)) return { estado: 'errado' };
  const alvo = avaliar(esperado.expr);
  if (!alvo.ok) throw new Error(`esperado ilegível: ${esperado.expr}`);
  const r = avaliar(resposta);
  if (!r.ok) return { estado: 'invalido', erro: r.erro };
  const escala = Math.max(1, Math.abs(alvo.valor));
  const dif = Math.abs(r.valor - alvo.valor);
  if (r.dec) {
    if (Number.isInteger(alvo.valor) && dif <= 1e-9) return { estado: 'certo', valor: r.valor };
    return { estado: dif <= 0.006 * escala ? 'decimal' : 'errado', valor: r.valor };
  }
  if (dif <= 1e-9 * escala) {
    return { estado: r.raizDenominador ? 'certo-forma' : 'certo', valor: r.valor };
  }
  return { estado: 'errado', valor: r.valor };
}

// ---------- Tabela de valores exatos (valores.json) ----------
// tabela = { angulos: [{ graus, sin: {expr, tex}, cos: {...}, tan: {...} | null }] }

/** Entrada da tabela para um ângulo em graus inteiros (qualquer volta, qualquer sinal). */
export function linhaDe(tabela, graus) {
  if (!Number.isInteger(graus)) return undefined;
  const g = normalizarGraus(graus);
  return tabela.angulos.find((a) => a.graus === g);
}

/** {expr, tex} do valor exato, null se não definido (tan de 90°), undefined se o ângulo não é notável. */
export function exato(tabela, graus, funcao) {
  const linha = linhaDe(tabela, graus);
  return linha ? linha[funcao] : undefined;
}

/** Valores distintos que sin/cos (ou tan) tomam nos ângulos notáveis. Serve para distratores. */
export function valoresPossiveis(tabela, funcao) {
  const vistos = new Map();
  for (const a of tabela.angulos) {
    const v = a[funcao];
    if (!v) continue;
    const num = avaliar(v.expr).valor;
    const chave = num.toFixed(9);
    if (!vistos.has(chave)) vistos.set(chave, { expr: v.expr, tex: v.tex, valor: num });
  }
  return [...vistos.values()];
}
