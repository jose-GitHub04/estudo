// Progresso do aluno, só neste dispositivo (localStorage). Nada sai do browser.
// Cada leitura e escrita tem try/catch: em janela privada ou com os dados do site
// bloqueados o storage pode falhar, e a página tem de funcionar na mesma.

const CHAVE = 'mat100-estudo-v1';

let memoria = {}; // cópia usada quando o storage não funciona

function lerTudo() {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto);
  } catch (e) { /* storage indisponível: usa a memória */ }
  return memoria;
}

function escreverTudo(obj) {
  memoria = obj;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

/** ler('treino', {}) -> o que está guardado nessa secção, ou `padrao`. */
export function ler(seccao, padrao = {}) {
  const tudo = lerTudo();
  return tudo[seccao] === undefined ? padrao : tudo[seccao];
}

/** guardar('treino', valor) -> true se ficou gravado no dispositivo. */
export function guardar(seccao, valor) {
  const tudo = lerTudo();
  tudo[seccao] = valor;
  return escreverTudo(tudo);
}

/** Apaga todo o progresso (o botão de reset pede confirmação antes). */
export function apagarTudo() {
  memoria = {};
  try { window.localStorage.removeItem(CHAVE); } catch (e) { /* nada a fazer */ }
}
