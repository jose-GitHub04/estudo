// Geradores de perguntas do treino: derivadas, tangentes, limites e monotonia/contradomínio.
// Módulo autónomo (não importa geradores.js, para não haver importações circulares);
// geradores.js junta TIPOS_ANALISE à lista TIPOS.
// Estado actual: só o tipo «limite» está completo e testado; os outros ficam por fazer.
// Contrato da pergunta: ver o cabeçalho de geradores.js (modo 'escolha', 4 opções, uma só
// com correta: true, explicacao, verificacao com os dados para recalcular o resultado).

import * as M from '../assets/motor/matematica.js';

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

export const TIPOS_ANALISE = [
  { id: 'limite', nome: 'Limites com exponenciais e logaritmos', tema: 'Limites', gerar: limite },
];
