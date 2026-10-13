// Monta a estrutura da página (barra, rodapé) e cada widget do tema Probabilidades.
//
// Cada página declara no <body> data-pagina="..." (item ativo do menu).
// Contrato de um widget: probabilidades/widgets/<nome>.js exporta
//   export async function montar(el)
// onde `el` é o <div data-widget="<nome>">. Se um widget falhar, só essa parte mostra
// um aviso; o resto da página continua.

import { renderizar } from '../assets/motor/katex.js';
import { montarEstrutura } from '../assets/motor/estrutura.js';

async function iniciar() {
  montarEstrutura(document.body.dataset.pagina, 'probabilidades');

  await Promise.all([...document.querySelectorAll('[data-widget]')].map(async (el) => {
    const nome = el.dataset.widget;
    try {
      const modulo = await import(`./widgets/${nome}.js`);
      await modulo.montar(el);
    } catch (e) {
      console.error(`widget ${nome}:`, e);
      el.innerHTML = '<p class="aviso-erro">Esta parte não carregou. Recarrega a página.</p>';
    }
  }));

  renderizar(document.body);
  document.documentElement.dataset.pronto = 'sim'; // para os testes automáticos
}

iniciar();
