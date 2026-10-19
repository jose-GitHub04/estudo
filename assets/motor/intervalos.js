// Intervalos à portuguesa dentro de fórmulas: ]a,b[, [a,b[, ]-∞,2]...
// O KaTeX trata «]» como um fecho de parênteses, por isso em ]-\infty,2] o menos fica com espaços de operador binário
// («] − ∞») e a linha pode quebrar a meio do intervalo. Marcando o «]» que abre com \mathopen{]} (e o «[» que fecha com
// \mathclose{[}) o desenho é o mesmo, mas o espaçamento e as quebras ficam certos.
// Aplicado por katex.js (renderizar e tex), por isso vale para todas as páginas: só mexe no que está dentro de $...$, antes de o KaTeX ler.

/**
 * Devolve o LaTeX com os extremos abertos de cada intervalo marcados. A regra é a dos parênteses retos: o primeiro
 * «]» ou «[» abre e o seguinte fecha, e repete (assim ]a,b[\cup]c,d[ e [a,b[ ficam certos). Não mexe em \sqrt[n]{x},
 * em fórmulas que já tenham \left, \right, \big, \mathopen ou \mathclose, nem em texto cujos parênteses retos não
 * fiquem emparelhados.
 */
export function intervalosTex(tex) {
  if (typeof tex !== 'string' || !/[[\]]/.test(tex) || /\\(left|right|[bB]ig|mathopen|mathclose)/.test(tex)) return tex;
  let dentro = false;
  let saida = '';
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|[\s\S])/.exec(tex.slice(i));
      if (!m) { saida += c; continue; } // barra no fim do texto
      saida += m[0];
      i += m[0].length - 1;
      if (m[1] === 'sqrt' && tex[i + 1] === '[') { // raiz de índice n: o [n] não é um intervalo
        const fim = tex.indexOf(']', i + 1);
        if (fim < 0) return tex;
        saida += tex.slice(i + 1, fim + 1);
        i = fim;
      }
    } else if (c === ']') {
      saida += dentro ? ']' : '\\mathopen{]}';
      dentro = !dentro;
    } else if (c === '[') {
      saida += dentro ? '\\mathclose{[}' : '[';
      dentro = !dentro;
    } else {
      saida += c;
    }
  }
  return dentro ? tex : saida;
}

const FORMULA = /\$\$[\s\S]+?\$\$|\$[^$]+?\$/g;

/** Aplica intervalosTex a cada fórmula $...$ ou $$...$$ de um texto. */
export function intervalosNoTexto(texto) {
  return String(texto === undefined || texto === null ? '' : texto).replace(FORMULA, (m) => {
    const d = m.startsWith('$$') ? 2 : 1;
    return m.slice(0, d) + intervalosTex(m.slice(d, m.length - d)) + m.slice(m.length - d);
  });
}
