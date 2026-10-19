// Ligação ao KaTeX (carregado como script normal em cada página, em assets/katex/).

import { intervalosTex, intervalosNoTexto } from './intervalos.js';

const DELIMITADORES = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
];

/** Converte os $...$ e $$...$$ que houver dentro de `el` em fórmulas. */
export function renderizar(el = document.body) {
  if (typeof window.renderMathInElement !== 'function') return;
  // intervalos ]a,b[: marca os extremos abertos para o KaTeX não os tratar como menos binário
  const nos = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = nos.nextNode(); n; n = nos.nextNode()) {
    if (n.data.includes('$')) n.data = intervalosNoTexto(n.data);
  }
  window.renderMathInElement(el, { delimiters: DELIMITADORES, throwOnError: false });
}

/** LaTeX -> HTML pronto a pôr em innerHTML. */
export function tex(texto, display = false) {
  if (!window.katex) return texto;
  return window.katex.renderToString(intervalosTex(texto), { throwOnError: false, displayMode: display });
}
