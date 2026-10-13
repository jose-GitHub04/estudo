// Matemática pura, sem DOM: frações de π, avaliador de expressões (com ln, log, logb,
// exp, abs, e, π), criarFuncao (x => número, para os gráficos), correção de respostas e
// tabela de valores exatos. É usada pelos widgets, pelo treino e por tests.html e
// logaritmos/tests/motor.html, por isso não pode tocar em document nem em window.

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
// Aceita: números (3,5 ou 3.5), pi/π, e, + - * / ^, parênteses (e chavetas), variáveis
// dadas em `vars`, multiplicação implícita (2π, 3√2, 2ln3, (1/2)(3)) e as funções
//   sqrt x · √x · raiz(x)   ln x   log x (base 10)   exp x   abs x
//   logb(base, x)           log_2(5) · log_2 5 · log2(5) · log2 5 · log_{0,5}(x)
//
// Regras de leitura (iguais para todas as funções):
//  - função com parênteses: o argumento acaba no parêntese, por isso ln(x)^2 = (ln x)^2.
//  - função sem parênteses: o argumento é o número ou símbolo seguinte COM o seu expoente,
//    sem multiplicação implícita: ln x^2 = ln(x²), ln 2x = (ln 2)·x, √3/2 = (√3)/2.
//    O normal é escrever ln(2x). Depois de função não se aceita um sinal: escreve ln(-2).
//  - «^» é associativo à direita e o expoente pode ter sinal: 2^3^2 = 2^9, e^-x, x^-2,
//    -2^2 = -4. O expoente acaba antes de uma multiplicação implícita: e^2x = (e²)·x.
//  - log2(5), log_2 5 e log_{0,5}(x) têm base; log2 sozinho (sem argumento) é log(2) e
//    log 2 (com espaço) é sempre o logaritmo decimal de 2. Dentro de logb( ) a vírgula
//    separa os argumentos (decimais com ponto), ou então separa o «;» e a vírgula é decimal.
//  - e e pi são constantes, mas uma variável com o mesmo nome em `vars` tem prioridade.
//  - letras coladas separam-se pelos nomes conhecidos: xlnx = x·ln x, 2lnx, pie = π·e.

const FUNCOES = new Set(['ln', 'log', 'logb', 'exp', 'abs', 'sqrt', 'raiz']);
const tem = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

/** «xlnx» -> ['x', 'ln', 'x']; null se não der para partir só com nomes conhecidos. */
function dividirLetras(palavra, conhecido) {
  if (conhecido(palavra)) return [palavra];
  if (palavra.length > 24) return null;
  for (let n = palavra.length - 1; n >= 1; n--) {
    if (!conhecido(palavra.slice(0, n))) continue;
    const cauda = dividirLetras(palavra.slice(n), conhecido);
    if (cauda) return [palavra.slice(0, n), ...cauda];
  }
  return null;
}

/** Há um «;» no nível do parêntese que abre em s[i]? Então a vírgula de logb é decimal. */
function temPontoEVirgula(s, i) {
  let prof = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') prof++;
    else if (s[j] === ')') { prof--; if (prof === 0) return false; }
    else if (s[j] === ';' && prof === 1) return true;
  }
  return false;
}

function tokenizar(s, vars = {}) {
  const conhecido = (p) => FUNCOES.has(p) || p === 'pi' || p === 'e' || tem(vars, p);
  const toks = [];
  const pilha = []; // contexto de cada «(» aberto: null, 'logb' (a vírgula separa) ou 'logb;'
  let i = 0;
  let sp = false; // havia espaço antes do token?
  const juntar = (tok) => { toks.push({ ...tok, sp }); sp = false; };
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; sp = true; continue; }
    const resto = s.slice(i);
    const ctx = pilha[pilha.length - 1];
    let m = (ctx === 'logb' ? /^(\d+\.\d+|\d+|\.\d+)/ : /^(\d+[.,]\d+|\d+|[.,]\d+)/).exec(resto);
    if (m) {
      juntar({ t: 'n', v: parseFloat(m[1].replace(',', '.')), dec: /[.,]/.test(m[1]) });
      i += m[1].length;
      continue;
    }
    m = /^[a-zA-Z]+/.exec(resto);
    if (m) {
      const partes = dividirLetras(m[0].toLowerCase(), conhecido) || [m[0].toLowerCase()];
      for (const p of partes) juntar({ t: 'i', v: p });
      i += m[0].length;
      continue;
    }
    if (c === '(') {
      const ant = toks[toks.length - 1];
      pilha.push(ant && ant.t === 'i' && ant.v === 'logb' ? (temPontoEVirgula(s, i) ? 'logb;' : 'logb') : null);
      juntar({ t: 'o', v: '(' });
      i++;
      continue;
    }
    if (c === ')') { pilha.pop(); juntar({ t: 'o', v: ')' }); i++; continue; }
    if ('+-*/^_'.includes(c) || (ctx === 'logb' && c === ',') || (ctx && c === ';')) {
      juntar({ t: 'o', v: c === ';' ? ',' : c });
      i++;
      continue;
    }
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

  /** Argumento de uma função: «(…)» acaba no parêntese; senão, átomo com o seu expoente. */
  function argumento() {
    const t = ver();
    if (eOp(t, '(')) return atomo();
    if (t && (t.t === 'n' || t.t === 'i')) return potencia();
    throw new Error('falta o argumento da função');
  }

  function fechar() {
    if (!eOp(toks[k++], ')')) throw new Error('parêntese por fechar');
  }

  function atomo() {
    const t = toks[k++];
    if (!t) throw new Error('expressão incompleta');
    if (t.t === 'n') return { t: 'num', v: t.v, dec: t.dec };
    if (eOp(t, '(')) {
      const x = expr();
      fechar();
      return x;
    }
    if (t.t === 'i') {
      if (tem(vars, t.v)) return { t: 'var', n: t.v };
      if (t.v === 'pi') return { t: 'pi' };
      if (t.v === 'e') return { t: 'num', v: Math.E, dec: false, e: true };
      if (t.v === 'sqrt' || t.v === 'raiz') return { t: 'sqrt', x: argumento() };
      if (t.v === 'ln' || t.v === 'exp' || t.v === 'abs') return { t: 'fn', f: t.v, x: argumento() };
      if (t.v === 'logb') {
        if (!eOp(toks[k++], '(')) throw new Error('logb pede parênteses: logb(base, x)');
        const base = expr();
        if (!eOp(toks[k++], ',')) throw new Error('logb pede dois argumentos: logb(base, x)');
        const x = expr();
        fechar();
        return { t: 'logb', a: base, b: x };
      }
      if (t.v === 'log') {
        let base = null;
        const p = ver();
        if (eOp(p, '_')) {
          k++;
          base = atomo();
        } else if (p && p.t === 'n' && !p.sp && comecaFator(toks[k + 1])) {
          // log2(5), log2 5: o número colado é a base; log2 sozinho fica log(2)
          k++;
          base = { t: 'num', v: p.v, dec: p.dec };
        }
        const x = argumento();
        return base ? { t: 'logb', a: base, b: x } : { t: 'fn', f: 'log', x };
      }
      throw new Error(`símbolo desconhecido: ${t.v}`);
    }
    throw new Error('símbolo inesperado');
  }

  const raiz = expr();
  if (k !== toks.length) throw new Error('sobrou texto');
  return raiz;
}

// Em modo estrito (avaliar) um valor fora do domínio é um erro; senão (criarFuncao) dá NaN.
const falha = (estrito, msg) => {
  if (estrito) throw new Error(msg);
  return NaN;
};

// resultados que são inteiros a menos do erro de arredondamento (log10 de 1000, log2 de 8)
const colar = (r) => {
  const q = Math.round(r);
  return Math.abs(r - q) < 1e-12 * Math.max(1, Math.abs(r)) ? q : r;
};

function logaritmo(base, x, estrito) {
  if (!(base > 0) || base === 1) return falha(estrito, 'base de logaritmo inválida');
  if (!(x > 0)) return falha(estrito, 'logaritmo de número não positivo');
  if (base === Math.E) return Math.log(x);
  if (base === 10) return colar(Math.log10(x));
  if (base === 2) return colar(Math.log2(x));
  return colar(Math.log(x) / Math.log(base));
}

function valorDe(n, vars, estrito = true) {
  const v = (no) => valorDe(no, vars, estrito);
  switch (n.t) {
    case 'num': return n.v;
    case 'pi': return PI;
    case 'var': return vars[n.n];
    case 'neg': return -v(n.x);
    case 'sqrt': {
      const x = v(n.x);
      return x < 0 ? falha(estrito, 'raiz de negativo') : Math.sqrt(x);
    }
    case 'fn': {
      const x = v(n.x);
      if (n.f === 'exp') return Math.exp(x);
      if (n.f === 'abs') return Math.abs(x);
      return logaritmo(n.f === 'ln' ? Math.E : 10, x, estrito);
    }
    case 'logb': return logaritmo(v(n.a), v(n.b), estrito);
    case 'pow': return n.a.e ? Math.exp(v(n.b)) : Math.pow(v(n.a), v(n.b));
    case 'bin': {
      const a = v(n.a);
      const b = v(n.b);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (b === 0) return falha(estrito, 'divisão por zero');
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

// U+2212 (menos), U+2013 e U+2014; por código para não juntar o travessão no ficheiro
const TRACOS = new RegExp('[' + String.fromCharCode(0x2212, 0x2013, 0x2014) + ']', 'g');

function normalizarTexto(s) {
  return String(s)
    .trim()
    .replace(TRACOS, '-') // sinal de menos e traços de vários comprimentos
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[πΠ]/g, 'pi')
    .replace(/[₀-₉]+/g, (m) => '_' + [...m].map((c) => c.charCodeAt(0) - 0x2080).join('')) // log₂
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/√/g, 'sqrt ');
}

/**
 * avaliar('√3/2') -> { ok: true, valor: 0.866…, dec: false, raizDenominador: false }
 * avaliar('pi-a', { a: 0.5 }) usa variáveis. Em erro: { ok: false, erro }.
 * avaliar('ln5/ln2') -> 2,3219…; avaliar('ln(0)') -> { ok: false } (fora do domínio).
 */
export function avaliar(texto, vars = {}) {
  try {
    const toks = tokenizar(normalizarTexto(texto), vars);
    if (!toks || toks.length === 0) return { ok: false, erro: 'vazio ou com símbolos que não conheço' };
    const ast = analisar(toks, vars);
    const valor = valorDe(ast, vars);
    if (!Number.isFinite(valor)) return { ok: false, erro: 'não é um número' };
    return { ok: true, valor, dec: temDecimal(ast), raizDenominador: raizNoDenominador(ast) };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

/**
 * criarFuncao('x*ln(x)') -> x => número. A expressão é lida UMA vez (lança Error se for
 * ilegível: símbolo desconhecido, parêntese por fechar...); depois a função nunca lança:
 * devolve NaN fora do domínio (ln de x ≤ 0, raiz de negativo, divisão por zero,
 * logb com base inválida) e quando o resultado não é finito. Aceita a mesma escrita de
 * `avaliar`. `params` são constantes extra: criarFuncao('a^x', 'x', { a: 2 }).
 */
export function criarFuncao(expr, nomeVar = 'x', params = {}) {
  const nome = String(nomeVar).toLowerCase();
  const vars = { ...params, [nome]: 0 };
  const toks = tokenizar(normalizarTexto(expr), vars);
  if (!toks || toks.length === 0) throw new Error(`expressão ilegível: ${expr}`);
  const ast = analisar(toks, vars);
  return (x) => {
    vars[nome] = Number(x);
    try {
      const r = valorDe(ast, vars, false);
      return Number.isFinite(r) ? r : NaN;
    } catch {
      return NaN;
    }
  };
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
