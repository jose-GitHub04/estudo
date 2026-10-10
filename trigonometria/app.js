// Carrega os dados e monta cada widget da página.
// Contrato de um widget: trigonometria/widgets/<nome>.js exporta
//   export async function montar(el, dados)
// onde `el` é o <div data-widget="<nome>"> e `dados` = { valores, reducao, cartoes }.
// Se um widget falhar, só essa parte mostra um aviso; o resto da página continua.

import { renderizar } from '../assets/motor/katex.js';

async function json(nome) {
  const r = await fetch(new URL(`./dados/${nome}.json`, import.meta.url));
  if (!r.ok) throw new Error(`${nome}.json: ${r.status}`);
  return r.json();
}

async function iniciar() {
  let dados;
  try {
    const [valores, reducao, cartoes] = await Promise.all([json('valores'), json('reducao'), json('cartoes')]);
    dados = { valores, reducao, cartoes };
  } catch (e) {
    console.error(e);
    document.querySelectorAll('[data-widget]').forEach((el) => {
      el.innerHTML = '<p class="aviso-erro">Não consegui carregar os dados. Recarrega a página.</p>';
    });
    return;
  }

  await Promise.all([...document.querySelectorAll('[data-widget]')].map(async (el) => {
    const nome = el.dataset.widget;
    try {
      const modulo = await import(`./widgets/${nome}.js`);
      await modulo.montar(el, dados);
    } catch (e) {
      console.error(`widget ${nome}:`, e);
      el.innerHTML = '<p class="aviso-erro">Esta parte não carregou. Recarrega a página.</p>';
    }
  }));

  renderizar(document.body);
  document.documentElement.dataset.pronto = 'sim'; // para os testes automáticos
}

iniciar();
