// Geradores de perguntas do treino. Lógica pura, sem DOM: o treino, os testes e
// qualquer outro widget usam as mesmas funções.
//
// Cada pergunta tem a forma
//   { tipo, enunciado /* texto com $...$ */, modo: 'escolha' | 'escrita',
//     opcoes?: [{ tex, expr?, correta, ... }]   // escolha: 4 opções, só 1 correta
//     esperado?: { expr } | { naoDefinida: true } // escrita
//     explicacao /* texto com $...$ */,
//     verificacao: { ... } }                      // dados para os testes recalcularem
// Tudo o que é aleatório vem do `rng` (criarRng), por isso a mesma semente dá a
// mesma pergunta. Os valores exatos vêm sempre da tabela (M.exato), nunca à mão.

import * as M from '../assets/motor/matematica.js';

// ---------- Ajudas ----------

const TEX_FUNCAO = { sin: '\\sin', cos: '\\cos', tan: '\\tan' };
const NOME_FUNCAO = { sin: 'seno', cos: 'cosseno', tan: 'tangente' };
const ND_TEX = '\\text{não definida}';

const rad = (graus) => (graus * Math.PI) / 180;
const chaveNum = (x) => String(Math.round(x * 1e9)); // -0 dá "0"
const chaveFrac = (p, q) => {
  [p, q] = M.reduzir(p, q);
  return `${p}/${q}`;
};

/** Ângulo em LaTeX: 150 -> 150^\circ ou \frac{5\pi}{6}. */
function angTex(graus, emRad) {
  if (!emRad) return `${graus}^\\circ`;
  const [p, q] = M.grausEmFracPi(graus);
  return M.fracPiTex(p, q);
}

/** Sinal (+1/-1) de sin, cos ou tan no quadrante q, medido num ângulo dentro dele. */
function sinalNoQuadrante(funcao, q) {
  const v = Math[funcao](rad(37 + 90 * (q - 1)));
  return v > 0 ? 1 : -1;
}

/** «1.º e 2.º» -> «no 1.º e no 2.º quadrantes». */
function listaQuadrantes(lista) {
  return `no ${lista.map((q) => `${q}.º`).join(' e no ')} quadrantes`;
}

/**
 * Escolhe `n` distratores. Percorre os grupos por ordem (cada um baralhado) e salta
 * os que repetem a chave da correta ou de um já escolhido. Os grupos mais plausíveis
 * (erros típicos) vão primeiro; o último é a reserva.
 */
function distratores(rng, correta, grupos, n = 3) {
  const vistas = new Set([correta.chave]);
  const out = [];
  for (const grupo of grupos) {
    for (const c of M.baralhar(rng, grupo.filter(Boolean))) {
      if (out.length >= n) return out;
      if (vistas.has(c.chave)) continue;
      vistas.add(c.chave);
      out.push(c);
    }
  }
  if (out.length < n) throw new Error(`poucos distratores (${out.length}) para ${correta.chave}`);
  return out;
}

/** Junta a correta e os distratores, mistura e tira a chave interna. */
function pergunta(rng, tipo, { enunciado, correta, outras, explicacao, verificacao }) {
  const todas = [{ ...correta, correta: true }, ...outras.map((o) => ({ ...o, correta: false }))];
  const opcoes = M.baralhar(rng, todas).map((o) => {
    const copia = { ...o };
    delete copia.chave;
    return copia;
  });
  return { tipo, modo: 'escolha', enunciado, opcoes, explicacao, verificacao };
}

/** Opção «p/q de π» (reduzida), com unidade opcional. */
function opcaoPi(p, q, unidade = '') {
  [p, q] = M.reduzir(p, q);
  return {
    chave: chaveNum((p / q) * Math.PI),
    tex: M.fracPiTex(p, q) + unidade,
    expr: `${p}*pi/${q}`,
  };
}

/** Opção «p/q» (reduzida) sem π. */
function opcaoFrac(p, q) {
  [p, q] = M.reduzir(p, q);
  return { chave: chaveNum(p / q), tex: M.fracTex(p, q), expr: `${p}/${q}` };
}

// ---------- 1. Valores exatos ----------

function valorExato(rng, dados) {
  const t = dados.valores;
  const funcao = M.escolher(rng, ['sin', 'cos', 'tan']);
  const base = M.escolher(rng, t.angulos.filter((a) => a.graus < 360)).graus;
  const voltas = M.escolher(rng, [-2, -1, -1, 0, 0, 0, 1, 1, 2]);
  const graus = base + 360 * voltas;
  const emRad = rng() < 0.6;
  const f = TEX_FUNCAO[funcao];
  const X = angTex(graus, emRad);

  const pool = M.valoresPossiveis(t, funcao).map((p) => ({
    chave: chaveNum(p.valor), tex: p.tex, expr: p.expr, valor: p.valor,
  }));
  const doValor = (v) => pool.find((p) => p.chave === chaveNum(v));
  const ex = M.exato(t, graus, funcao);

  let correta;
  let grupos;
  let nDistr = 3;
  if (ex === null) {
    // tan de 90° ou 270°: os erros típicos são 0, 1 e -1
    correta = { chave: 'nd', tex: ND_TEX, naoDefinida: true };
    grupos = [[doValor(0), doValor(1), doValor(-1)], pool];
  } else {
    const v = M.avaliar(ex.expr).valor;
    correta = { chave: chaveNum(v), tex: ex.tex, expr: ex.expr };
    // a outra função (ou, na tangente, o inverso) com o mesmo ângulo
    let outra;
    if (funcao === 'tan') {
      outra = v !== 0 ? doValor(1 / v) : null;
    } else {
      const o = M.exato(t, graus, funcao === 'sin' ? 'cos' : 'sin');
      outra = { chave: chaveNum(M.avaliar(o.expr).valor), tex: o.tex, expr: o.expr, valor: M.avaliar(o.expr).valor };
    }
    const simetrico = v !== 0 ? doValor(-v) : null;
    const simetricoOutra = outra && outra.valor !== 0 ? doValor(-outra.valor) : null;
    grupos = [[simetrico, outra], [simetricoOutra], pool];
    // na tangente, «não definida» também é um distrator plausível (só aqui, e nunca correta)
    if (funcao === 'tan' && rng() < 0.35) {
      nDistr = 2;
      grupos = [[simetrico, outra], pool];
    }
  }
  const outras = distratores(rng, correta, grupos, nDistr);
  if (ex !== null && funcao === 'tan' && nDistr === 2) {
    outras.push({ chave: 'nd', tex: ND_TEX, naoDefinida: true });
  }

  // explicação
  const g = M.normalizarGraus(graus);
  const q = M.quadrante(g);
  const passos = [];
  if (g !== graus) {
    passos.push(`Tirando voltas completas, $${X}$ corresponde ao mesmo ponto da circunferência que $${angTex(g, emRad)}$.`);
  }
  if (q === 0) {
    const c = M.exato(t, g, 'cos');
    const s = M.exato(t, g, 'sin');
    passos.push(`Este ângulo fica sobre um eixo, no ponto $(${c.tex},\\ ${s.tex})$, que tem o cosseno por abcissa e o seno por ordenada.`);
    if (funcao === 'tan') {
      passos.push(ex === null
        ? `Como o cosseno é 0, a tangente $\\frac{\\sin}{\\cos}$ não está definida.`
        : `$\\tan ${X}=\\frac{\\sin}{\\cos}=\\frac{${s.tex}}{${c.tex}}=${ex.tex}$.`);
    } else {
      passos.push(`Logo $${f}\\left(${X}\\right)=${ex.tex}$.`);
    }
  } else {
    const ref = [g, 180 - g, g - 180, 360 - g][q - 1];
    const positivo = sinalNoQuadrante(funcao, q) > 0;
    const refEx = M.exato(t, ref, funcao);
    if (q === 1) {
      // já é um ângulo do 1.º quadrante: o valor lê-se na tabela dos notáveis
      passos.push(`O ângulo do 1.º quadrante é $${angTex(g, emRad)}$, e o seu ${NOME_FUNCAO[funcao]} está na tabela dos ângulos notáveis.`);
      passos.push(g === graus
        ? `Logo $${f}\\left(${X}\\right)=${ex.tex}$.`
        : `Logo $${f}\\left(${X}\\right)=${f}\\left(${angTex(g, emRad)}\\right)=${ex.tex}$.`);
    } else {
      passos.push(`Fica no ${q}.º quadrante, onde o ${NOME_FUNCAO[funcao]} é ${positivo ? 'positivo' : 'negativo'}, e o ângulo de referência é $${angTex(ref, emRad)}$.`);
      passos.push(`Logo $${f}\\left(${X}\\right)=${positivo ? '' : '-'}${f}\\left(${angTex(ref, emRad)}\\right)=${positivo ? '' : '-'}${refEx.tex}$.`);
    }
  }

  return pergunta(rng, 'valor-exato', {
    enunciado: `Qual é o valor exato de $${f}\\left(${X}\\right)$?`,
    correta,
    outras,
    explicacao: passos.join(' '),
    verificacao: { funcao, graus, emRad },
  });
}

// ---------- 2. Graus e radianos ----------

function grausRad(rng) {
  const graus = 15 * M.inteiro(rng, 1, 24);
  const paraRad = rng() < 0.5;
  const [p, q] = M.grausEmFracPi(graus);
  const todos = [];
  for (let k = 1; k <= 24; k++) if (k * 15 !== graus) todos.push(k * 15);

  if (paraRad) {
    const correta = opcaoPi(p, q);
    const grupos = [
      [opcaoPi(graus, 360), opcaoPi(graus, 90), opcaoPi(180, graus)],
      [opcaoPi(graus + 15, 180), graus > 15 ? opcaoPi(graus - 15, 180) : null],
      todos.map((k) => opcaoPi(k, 180)),
    ];
    return pergunta(rng, 'graus-rad', {
      enunciado: `Converte $${graus}^\\circ$ para radianos.`,
      correta,
      outras: distratores(rng, correta, grupos),
      explicacao: `Para passar de graus para radianos multiplica por $\\frac{\\pi}{180}$: $${graus}\\times\\frac{\\pi}{180}=\\frac{${graus}\\pi}{180}=${M.fracPiTex(p, q)}$.`,
      verificacao: { sentido: 'g2r', graus },
    });
  }

  const opcaoGraus = (n) => ({ chave: String(n), tex: `${n}^\\circ`, expr: String(n) });
  const correta = opcaoGraus(graus);
  const grupos = [
    [opcaoGraus(2 * graus), graus % 2 === 0 ? opcaoGraus(graus / 2) : null],
    [graus < 180 ? opcaoGraus(180 - graus) : null, opcaoGraus(graus + 15), graus > 15 ? opcaoGraus(graus - 15) : null],
    todos.map(opcaoGraus),
  ];
  return pergunta(rng, 'graus-rad', {
    enunciado: `Converte $${M.fracPiTex(p, q)}$ radianos para graus.`,
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao: `Para passar de radianos para graus multiplica por $\\frac{180}{\\pi}$: $${M.fracPiTex(p, q)}\\times\\frac{180}{\\pi}=\\frac{${p}\\times 180}{${q}}=${graus}^\\circ$.`,
    verificacao: { sentido: 'r2g', graus },
  });
}

// ---------- 3. Redução ao 1.º quadrante ----------

function reducao(rng, dados) {
  const linhas = [];
  for (const rel of dados.reducao.relacoes) for (const l of rel.linhas) linhas.push({ rel, l });
  const { rel, l } = M.escolher(rng, linhas);
  const f = l.f;

  const opcaoRed = (sinal, res, inv) => {
    const corpo = inv ? `\\frac{1}{${TEX_FUNCAO[res]}\\alpha}` : `${TEX_FUNCAO[res]}\\alpha`;
    const tex = (sinal < 0 ? '-' : '') + corpo;
    return { chave: tex, tex, v: { sinal, res, inv } };
  };

  let todas;
  if (f === 'tan') {
    todas = [opcaoRed(1, 'tan', false), opcaoRed(-1, 'tan', false), opcaoRed(1, 'tan', true), opcaoRed(-1, 'tan', true)];
  } else {
    todas = [opcaoRed(1, 'sin', false), opcaoRed(-1, 'sin', false), opcaoRed(1, 'cos', false), opcaoRed(-1, 'cos', false)];
  }
  const correta = todas.find((o) => o.v.sinal === l.sinal && o.v.res === l.res && !o.v.inv);
  const outras = todas.filter((o) => o !== correta);

  // explicação a partir do ponto de reducao.json: P = (cos α, sin α)
  const coord = (c) => (c.startsWith('-') ? '-' : '') + (c.replace('-', '') === 'x' ? '\\cos\\alpha' : '\\sin\\alpha');
  const px = coord(rel.ponto[0]);
  const py = coord(rel.ponto[1]);
  const arg = rel.argTex;
  const passos = [`Se $P=(\\cos\\alpha,\\ \\sin\\alpha)$ é o ponto do ângulo $\\alpha$, o ponto do ângulo $${arg}$ é $(${px},\\ ${py})$.`];
  if (f === 'sin') passos.push(`O seno é a ordenada, por isso $\\sin\\left(${arg}\\right)=${correta.tex}$.`);
  else if (f === 'cos') passos.push(`O cosseno é a abcissa, por isso $\\cos\\left(${arg}\\right)=${correta.tex}$.`);
  else passos.push(`A tangente é a ordenada a dividir pela abcissa: $\\tan\\left(${arg}\\right)=\\frac{${py}}{${px}}=${correta.tex}$.`);

  return pergunta(rng, 'reducao', {
    enunciado: `Simplifica $${TEX_FUNCAO[f]}\\left(${arg}\\right)$.`,
    correta,
    outras,
    explicacao: passos.join(' '),
    verificacao: { relacao: rel.id, arg: rel.arg, f },
  });
}

// ---------- 4. Arco e setor ----------

const ALFAS_PI = [[1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [7, 6], [2, 1]];

function arcoSetor(rng) {
  const [p, q] = M.escolher(rng, ALFAS_PI);
  const r = M.inteiro(rng, 2, 10);
  const graus = (180 * p) / q;
  const emGraus = rng() < 0.4;
  const arco = rng() < 0.5;
  const alfaTex = M.fracPiTex(p, q);

  const amplitude = emGraus ? `$${graus}^\\circ$` : `$${alfaTex}$ rad`;
  const enunciado = `Um setor circular tem raio ${r} cm e amplitude ${amplitude}. ${arco ? 'Qual é o comprimento do arco?' : 'Qual é a área do setor?'}`;
  const unidade = arco ? '\\text{ cm}' : '\\text{ cm}^2';
  const pi = (a, b) => opcaoPi(a, b, unidade);
  const sem = (a, b) => ({ ...opcaoFrac(a, b), tex: M.fracTex(a, b) + unidade });

  let correta;
  let grupos;
  if (arco) {
    correta = pi(p * r, q);
    grupos = [
      [pi(p * r * r, q), pi(p * r, 2 * q), pi(p * r * r, 2 * q), emGraus ? sem(graus * r, 1) : null],
      [pi(p, q * r), pi(2 * p * r, q), pi(p * (r + 1), q), pi(p * (r - 1), q)],
      [pi(p * r, 3 * q), pi(3 * p * r, q)],
    ];
  } else {
    correta = pi(p * r * r, 2 * q);
    grupos = [
      [pi(p * r, 2 * q), pi(p * r * r, q), pi(p * r, q), emGraus ? sem(graus * r * r, 2) : null],
      [pi(p * r * r, 4 * q), pi(p * (r + 1) * (r + 1), 2 * q), pi(p * r * r * r, 2 * q)],
      [pi(p * r * r, 3 * q), pi(3 * p * r * r, 2 * q)],
    ];
  }
  const outras = distratores(rng, correta, grupos);

  const passos = [];
  if (emGraus) passos.push(`Em radianos, $${graus}^\\circ=${alfaTex}$ rad.`);
  if (arco) {
    passos.push(`O comprimento do arco é $c=\\alpha r=${alfaTex}\\times ${r}=${correta.tex}$.`);
  } else {
    passos.push(`A área do setor é $A=\\frac{\\alpha r^2}{2}=\\frac{1}{2}\\times ${alfaTex}\\times ${r}^2=${correta.tex}$.`);
  }

  return pergunta(rng, 'arco-setor', {
    enunciado,
    correta,
    outras,
    explicacao: passos.join(' '),
    verificacao: { grandeza: arco ? 'arco' : 'area', r, graus, alfaRad: (p / q) * Math.PI },
  });
}

// ---------- 5. Período e contradomínio ----------

const COEFS_C = [[1, 2], [1, 1], [2, 1], [3, 1], [4, 1]];
const RESERVA_PERIODO = [[1, 1], [2, 1], [4, 1], [1, 2], [1, 3], [2, 3], [3, 1], [1, 4]];

function periodo(rng) {
  const fun = M.escolher(rng, ['sin', 'cos', 'tan']);
  const a = M.inteiro(rng, -2, 2);
  const b = M.escolher(rng, [-3, -2, -1, 1, 2, 3]);
  const [cp, cq] = M.escolher(rng, COEFS_C);
  const B = Math.abs(b);
  const perguntaPeriodo = rng() < (fun === 'tan' ? 0.65 : 0.5);
  const f = TEX_FUNCAO[fun];

  const arg = cq === 1 ? (cp === 1 ? 'x' : `${cp}x`) : `\\frac{x}{${cq}}`;
  const chamada = arg === 'x' ? `${f}\\,x` : `${f}\\left(${arg}\\right)`;
  const coef = B === 1 ? '' : String(B);
  const fx = a === 0
    ? `${b < 0 ? '-' : ''}${coef}${chamada}`
    : `${a}${b < 0 ? '-' : '+'}${coef}${chamada}`;
  const defF = `f(x)=${fx}`;
  const cTex = M.fracTex(cp, cq);

  if (perguntaPeriodo) {
    const k = fun === 'tan' ? 1 : 2; // período de k·π/|c|
    const correta = opcaoPi(k * cq, cp);
    const grupos = fun === 'tan'
      ? [[opcaoPi(2 * cq, cp), opcaoPi(cp, cq), opcaoPi(1, 1)], RESERVA_PERIODO.map(([x, y]) => opcaoPi(x, y))]
      : [[opcaoPi(cq, cp), opcaoPi(2 * cp, cq), opcaoPi(2, 1)], RESERVA_PERIODO.map(([x, y]) => opcaoPi(x, y))];
    const formula = fun === 'tan' ? '\\frac{\\pi}{|c|}' : '\\frac{2\\pi}{|c|}';
    const conta = `${k === 1 ? '\\frac{\\pi}' : '\\frac{2\\pi}'}{${cTex}}`;
    return pergunta(rng, 'periodo', {
      enunciado: `Qual é o período da função $${defF}$?`,
      correta,
      outras: distratores(rng, correta, grupos),
      explicacao: `O período de $${f}(cx)$ é $${formula}$, e os parâmetros $a$ e $b$ não o alteram. Aqui $c=${cTex}$, logo $P=${conta}=${correta.tex}$.`,
      verificacao: { pergunta: 'periodo', fun, a, b, c: [cp, cq] },
    });
  }

  const intervalo = (lo, hi) => ({ chave: `${lo},${hi}`, tex: `[${lo},\\,${hi}]`, intervalo: [lo, hi] });
  if (fun === 'tan') {
    const correta = { chave: 'R', tex: '\\mathbb{R}', todoR: true };
    const grupos = [
      [intervalo(a - B, a + B), { chave: `]${a - B},${a + B}[`, tex: `]{${a - B}},\\,{${a + B}}[`, aberto: [a - B, a + B] }],
      [
        { chave: `[${a},inf[`, tex: `[${a},\\,{+\\infty}[`, semiReta: true },
        { chave: `]-inf,${a}]`, tex: `]{-\\infty},\\,${a}]`, semiReta: true },
        { chave: `R-${a}`, tex: `\\mathbb{R}\\setminus\\{${a}\\}`, semiReta: true },
      ],
    ];
    return pergunta(rng, 'periodo', {
      enunciado: `Qual é o contradomínio da função $${defF}$?`,
      correta,
      outras: distratores(rng, correta, grupos),
      explicacao: `A tangente toma todos os valores reais, por isso $${b < 0 ? '-' : ''}${coef}${chamada}$ também os toma, e somar $${a}$ não muda isso. O contradomínio é $\\mathbb{R}$.`,
      verificacao: { pergunta: 'contradominio', fun, a, b, c: [cp, cq] },
    });
  }

  const lo = a - B;
  const hi = a + B;
  const correta = intervalo(lo, hi);
  const grupos = [
    [intervalo(-B, B), intervalo(a - 1, a + 1), intervalo(-B - a, B - a)],
    [intervalo(a - 2 * B, a + 2 * B), intervalo(a - B, a), intervalo(a, a + B)],
    [intervalo(a - B - 1, a + B + 1), intervalo(a - B + 1, a + B + 1)],
  ];
  return pergunta(rng, 'periodo', {
    enunciado: `Qual é o contradomínio da função $${defF}$?`,
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao: [
      `Como $-1\\le ${chamada}\\le 1$`,
      b !== 1 ? `multiplicar por $${b}$ dá valores entre $-${B}$ e $${B}$` : '',
      a !== 0 ? `somar $${a}$ dá $${lo}\\le f(x)\\le ${hi}$` : '',
    ].filter(Boolean).join(', ') + `. O contradomínio é $[${lo},\\,${hi}]$.`,
    verificacao: { pergunta: 'contradominio', fun, a, b, c: [cp, cq] },
  });
}

// ---------- 6. Fórmula fundamental ----------

const TRIOS = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];

function fundamental(rng) {
  const [x, y, h] = M.escolher(rng, TRIOS);
  const [conhecido, outro] = rng() < 0.5 ? [x, y] : [y, x];
  const dado = M.escolher(rng, ['sin', 'cos']);
  const quadrante = M.inteiro(rng, 1, 4);
  const pedeTan = rng() < 0.4;
  const sinS = sinalNoQuadrante('sin', quadrante);
  const cosS = sinalNoQuadrante('cos', quadrante);

  const sinN = sinS * (dado === 'sin' ? conhecido : outro);
  const cosN = cosS * (dado === 'sin' ? outro : conhecido);
  const dadoN = dado === 'sin' ? sinN : cosN;
  const faltaN = dado === 'sin' ? cosN : sinN; // numerador do outro valor
  const faltaF = dado === 'sin' ? 'cos' : 'sin';
  const pedido = pedeTan ? 'tan' : faltaF;

  const valorTex = (n) => M.fracTex(n, h);
  const sinal = (positivo) => (positivo ? 'positivo' : 'negativo');
  const dizOutro = `$${TEX_FUNCAO[faltaF]}^2\\alpha=1-\\left(${valorTex(dadoN)}\\right)^2=\\frac{${outro * outro}}{${h * h}}$, logo $${TEX_FUNCAO[faltaF]}\\alpha=\\pm${M.fracTex(outro, h)}$`;
  const passos = ['Pela fórmula fundamental, $\\sin^2\\alpha+\\cos^2\\alpha=1$.'];

  let correta;
  let grupos;
  if (!pedeTan) {
    correta = opcaoFrac(faltaN, h);
    grupos = [
      [opcaoFrac(-faltaN, h), opcaoFrac(dadoN, h), opcaoFrac(outro * outro, h * h)],
      [opcaoFrac(-dadoN, h), opcaoFrac(-outro * outro, h * h), opcaoFrac(Math.sign(faltaN) * (h - conhecido), h)],
      [opcaoFrac(Math.sign(faltaN) * conhecido * outro, h * h), opcaoFrac(conhecido, outro)],
    ];
    passos.push(`${dizOutro}.`);
    passos.push(`No ${quadrante}.º quadrante o ${NOME_FUNCAO[faltaF]} é ${sinal(faltaN > 0)}, então $${TEX_FUNCAO[faltaF]}\\alpha=${correta.tex}$.`);
  } else {
    const t = M.reduzir(sinN, cosN);
    correta = opcaoFrac(t[0], t[1]);
    const inv = M.reduzir(cosN, sinN);
    grupos = [
      [opcaoFrac(-t[0], t[1]), opcaoFrac(inv[0], inv[1]), opcaoFrac(sinN, h), opcaoFrac(cosN, h)],
      [opcaoFrac(-inv[0], inv[1]), opcaoFrac(-sinN, h), opcaoFrac(-cosN, h)],
      [opcaoFrac(conhecido, outro), opcaoFrac(-conhecido, outro)],
    ];
    passos.push(`Primeiro o outro valor: ${dizOutro}.`);
    passos.push(`No ${quadrante}.º quadrante o ${NOME_FUNCAO[faltaF]} é ${sinal(faltaN > 0)}, então $${TEX_FUNCAO[faltaF]}\\alpha=${valorTex(faltaN)}$.`);
    passos.push(`Assim, $\\tan\\alpha=\\frac{\\sin\\alpha}{\\cos\\alpha}=\\frac{${valorTex(sinN)}}{${valorTex(cosN)}}=${correta.tex}$.`);
  }

  return pergunta(rng, 'fundamental', {
    enunciado: `Sabe-se que $${TEX_FUNCAO[dado]}\\alpha=${valorTex(dadoN)}$ e que $\\alpha$ pertence ao ${quadrante}.º quadrante. Qual é o valor de $${TEX_FUNCAO[pedido]}\\alpha$?`,
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao: passos.join(' '),
    verificacao: { dado, valor: [dadoN, h], quadrante, pedido },
  });
}

// ---------- 7. Relação com a tangente ----------

function relacaoTangente(rng) {
  const t = M.inteiro(rng, 1, 4);
  const pedeCos = rng() < 0.6;
  const d = 1 + t * t;

  let correta;
  let grupos;
  if (pedeCos) {
    correta = opcaoFrac(1, d);
    grupos = [
      [opcaoFrac(t * t, d), opcaoFrac(1, t * t), opcaoFrac(1, 1 + t)],
      [opcaoFrac(d, 1), opcaoFrac(1, 2 * t), opcaoFrac(1, d * d), opcaoFrac(t, d)],
    ];
  } else {
    correta = opcaoFrac(t * t, d);
    grupos = [
      [opcaoFrac(1, d), opcaoFrac(t * t, 1), opcaoFrac(t * t, 1 + t)],
      [opcaoFrac(1, t * t), opcaoFrac(t, d), opcaoFrac(d, t * t)],
      [opcaoFrac(1, 3), opcaoFrac(1, 4), opcaoFrac(3, 4), opcaoFrac(2, 3)],
    ];
  }
  grupos.push([opcaoFrac(1, 3), opcaoFrac(1, 4), opcaoFrac(2, 1), opcaoFrac(1, 5)]);

  const passos = [
    `Usa $1+\\tan^2\\alpha=\\frac{1}{\\cos^2\\alpha}$: $1+${t}^2=\\frac{1}{\\cos^2\\alpha}$, ou seja, $${d}=\\frac{1}{\\cos^2\\alpha}$ e $\\cos^2\\alpha=\\frac{1}{${d}}$.`,
  ];
  if (!pedeCos) passos.push(`Então $\\sin^2\\alpha=1-\\cos^2\\alpha=1-\\frac{1}{${d}}=\\frac{${t * t}}{${d}}$.`);

  return pergunta(rng, 'relacao-tangente', {
    enunciado: `Sabendo que $\\tan\\alpha=${t}$, qual é o valor de $\\${pedeCos ? 'cos' : 'sin'}^2\\alpha$?`,
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao: passos.join(' '),
    verificacao: { t, pedido: pedeCos ? 'cos2' : 'sin2' },
  });
}

// ---------- 8. Sinais e quadrantes ----------

const PARES_SINAIS = [['sin', 'cos'], ['sin', 'tan'], ['cos', 'tan']];

function sinais(rng) {
  const [f1, f2] = M.escolher(rng, PARES_SINAIS);
  let c1 = { f: f1, sinal: M.escolher(rng, [1, -1]) };
  let c2 = { f: f2, sinal: M.escolher(rng, [1, -1]) };
  if (rng() < 0.5) [c1, c2] = [c2, c1];

  const quadrantesDe = (c) => [1, 2, 3, 4].filter((q) => sinalNoQuadrante(c.f, q) === c.sinal);
  const q1 = quadrantesDe(c1);
  const q2 = quadrantesDe(c2);
  const comuns = q1.filter((q) => q2.includes(q));
  if (comuns.length !== 1) throw new Error('as condições têm de dar um único quadrante');
  const certo = comuns[0];

  const cond = (c) => `\\${c.f}\\alpha${c.sinal > 0 ? '>' : '<'}0`;
  const frase = (c, qs) => `$${cond(c)}$ ${listaQuadrantes(qs)}`;
  const opcao = (q) => ({ chave: String(q), tex: `${q}.^{\\mathrm{o}}\\ \\text{quadrante}`, quadrante: q });
  const todas = [1, 2, 3, 4].map(opcao);
  const correta = todas.find((o) => o.quadrante === certo);

  return pergunta(rng, 'sinais', {
    enunciado: `Em que quadrante está o ângulo $\\alpha$, sabendo que $${cond(c1)}$ e $${cond(c2)}$?`,
    correta,
    outras: todas.filter((o) => o !== correta),
    explicacao: `${frase(c1, q1)}; ${frase(c2, q2)}. O único quadrante comum é o ${certo}.º.`,
    verificacao: { condicoes: [c1, c2], quadrante: certo },
  });
}

// ---------- 9. Razões no triângulo ----------

const TRIOS_TRIANGULO = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];

function razoesTriangulo(rng) {
  const [l1, l2, hip] = M.escolher(rng, TRIOS_TRIANGULO);
  const [AB, BC] = rng() < 0.5 ? [l1, l2] : [l2, l1];
  const vertice = M.escolher(rng, ['A', 'C']);
  const f = M.escolher(rng, ['sin', 'cos', 'tan']);
  const letra = vertice === 'A' ? '\\alpha' : '\\beta';

  const [opp, adj] = vertice === 'A' ? [BC, AB] : [AB, BC];
  const nomeOpp = vertice === 'A' ? 'BC' : 'AB';
  const nomeAdj = vertice === 'A' ? 'AB' : 'BC';
  const razoes = {
    oppHip: [opp, hip], adjHip: [adj, hip], oppAdj: [opp, adj],
    adjOpp: [adj, opp], hipOpp: [hip, opp], hipAdj: [hip, adj],
  };
  const chaveCerta = { sin: 'oppHip', cos: 'adjHip', tan: 'oppAdj' }[f];
  const chaveTrocada = { sin: 'adjHip', cos: 'oppHip', tan: 'adjOpp' }[f];
  const chaveInversa = { sin: 'hipOpp', cos: 'hipAdj', tan: 'adjOpp' }[f];
  const op = (k) => opcaoFrac(...razoes[k]);

  const correta = op(chaveCerta);
  const grupos = [
    [op(chaveInversa), op(chaveTrocada)],
    Object.keys(razoes).filter((k) => k !== chaveCerta).map(op),
  ];
  const formula = { sin: '\\frac{\\text{oposto}}{\\text{hipotenusa}}', cos: '\\frac{\\text{adjacente}}{\\text{hipotenusa}}', tan: '\\frac{\\text{oposto}}{\\text{adjacente}}' }[f];

  return pergunta(rng, 'razoes-triangulo', {
    enunciado: `No triângulo $[ABC]$, retângulo em $B$, tem-se $\\overline{AB}=${AB}$, $\\overline{BC}=${BC}$ e $\\overline{AC}=${hip}$. Seja $${letra}$ a amplitude do ângulo de vértice $${vertice}$. Qual é o valor de $${TEX_FUNCAO[f]}${letra}$?`,
    correta,
    outras: distratores(rng, correta, grupos),
    explicacao: `Em relação a $${letra}$, o cateto oposto é $\\overline{${nomeOpp}}=${opp}$, o cateto adjacente é $\\overline{${nomeAdj}}=${adj}$ e a hipotenusa é $\\overline{AC}=${hip}$. Então $${TEX_FUNCAO[f]}${letra}=${formula}=${correta.tex}$.`,
    verificacao: { AB, BC, AC: hip, vertice, f },
  });
}

// ---------- Registo ----------

export const TIPOS = [
  { id: 'valor-exato', nome: 'Valores exatos', tema: 'Circunferência trigonométrica', gerar: valorExato },
  { id: 'graus-rad', nome: 'Graus e radianos', tema: 'Radianos', gerar: grausRad },
  { id: 'reducao', nome: 'Redução ao 1.º quadrante', tema: 'Redução ao 1.º quadrante', gerar: reducao },
  { id: 'arco-setor', nome: 'Arco e setor', tema: 'Radianos', gerar: arcoSetor },
  { id: 'periodo', nome: 'Período e contradomínio', tema: 'Funções trigonométricas', gerar: periodo },
  { id: 'fundamental', nome: 'Fórmula fundamental', tema: 'Relações fundamentais', gerar: fundamental },
  { id: 'relacao-tangente', nome: 'Relação com a tangente', tema: 'Relações fundamentais', gerar: relacaoTangente },
  { id: 'sinais', nome: 'Sinais e quadrantes', tema: 'Circunferência trigonométrica', gerar: sinais },
  { id: 'razoes-triangulo', nome: 'Razões no triângulo', tema: 'Razões trigonométricas', gerar: razoesTriangulo },
];

/** Gera uma pergunta do tipo `tipoId`. `rng` vem de M.criarRng; `dados` = { valores, reducao }. */
export function gerarPergunta(tipoId, rng, dados) {
  const tipo = TIPOS.find((t) => t.id === tipoId);
  if (!tipo) throw new Error(`tipo de pergunta desconhecido: ${tipoId}`);
  return tipo.gerar(rng, dados);
}
