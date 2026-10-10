// Monta a estrutura da página (barra, rodapé), carrega só os dados de que a página
// precisa e monta cada widget.
//
// Cada página declara no <body>:
//   data-pagina="materia"             qual item do menu fica ativo
//   data-dados="valores reducao"      que ficheiros de dados carregar (valores, reducao, cartoes, perguntas)
// Contrato de um widget: trigonometria/widgets/<nome>.js exporta
//   export async function montar(el, dados)
// onde `el` é o <div data-widget="<nome>"> e `dados` tem as chaves pedidas em data-dados.
// Se um widget falhar, só essa parte mostra um aviso; o resto da página continua.

import { renderizar } from '../assets/motor/katex.js';
import { montarEstrutura } from '../assets/motor/estrutura.js';
import { GRUPOS } from '../assets/motor/grupos.js';

async function json(nome) {
  const r = await fetch(new URL(`./dados/${nome}.json`, import.meta.url));
  if (!r.ok) throw new Error(`${nome}.json: ${r.status}`);
  return r.json();
}

/** O banco de perguntas está em dados/perguntas/<tema>.json: junta os que existirem. */
async function carregarPerguntas() {
  const partes = await Promise.all(GRUPOS.map(async (g) => {
    try {
      const r = await fetch(new URL(`./dados/perguntas/${g.id}.json`, import.meta.url));
      if (!r.ok) return [];
      const d = await r.json();
      return (d.perguntas || []).map((p) => ({ ...p, tema: d.tema || g.id }));
    } catch (e) {
      console.error(`perguntas/${g.id}.json`, e);
      return [];
    }
  }));
  return { perguntas: partes.flat() };
}

async function iniciar() {
  montarEstrutura(document.body.dataset.pagina);

  const pedidos = (document.body.dataset.dados || '').split(/\s+/).filter(Boolean);
  const dados = {};
  try {
    await Promise.all(pedidos.map(async (nome) => {
      dados[nome] = nome === 'perguntas' ? await carregarPerguntas() : await json(nome);
    }));
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
