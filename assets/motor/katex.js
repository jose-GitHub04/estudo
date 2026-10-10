// Ligação ao KaTeX (carregado como script normal em cada página, em assets/katex/).

const DELIMITADORES = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
];

/** Converte os $...$ e $$...$$ que houver dentro de `el` em fórmulas. */
export function renderizar(el = document.body) {
  if (typeof window.renderMathInElement !== 'function') return;
  window.renderMathInElement(el, { delimiters: DELIMITADORES, throwOnError: false });
}

/** LaTeX -> HTML pronto a pôr em innerHTML. */
export function tex(texto, display = false) {
  if (!window.katex) return texto;
  return window.katex.renderToString(texto, { throwOnError: false, displayMode: display });
}
