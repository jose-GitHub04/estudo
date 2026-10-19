// Monta a estrutura da página (barra, rodapé), carrega só os dados de que a página
// precisa e monta cada widget do tema Exponenciais e logaritmos.
//
// Cada página declara no <body>:
//   data-pagina="cartoes"             qual item do menu fica ativo
//   data-dados="exercicios estudos"   que dados carregar (nomes separados por espaço)
// Contrato de um widget: logaritmos/widgets/<nome>.js exporta
//   export async function montar(el, dados)
// onde `el` é o <div data-widget="<nome>"> e `dados` tem uma chave por cada nome de data-dados.
// Se um widget falhar, só essa parte mostra um aviso; o resto da página continua.
//
// Como cada nome de data-dados chega ao widget:
//   cartoes     dados.cartoes    = { cartoes: [...] }      junta dados/cartoes/<grupo>.json de cada GRUPO
//                                                          (grupo preenchido em cada cartão)
//   perguntas   dados.perguntas  = { perguntas: [...] }    junta dados/perguntas/<grupo>.json (tema preenchido)
//   vf          dados.vf         = { afirmacoes: [...] }   junta dados/vf/<grupo>.json (tema preenchido)
//   outro nome  dados.<nome>     = o conteúdo de dados/<nome>.json (exercicios, estudos)
// Um ficheiro por grupo que falte ou não seja JSON válido conta como vazio, para as páginas
// funcionarem enquanto os dados ainda se escrevem. Já um ficheiro único em falta (exercicios,
// estudos) mostra o aviso de erro em todos os widgets da página.

import { renderizar } from '../assets/motor/katex.js';
import { montarEstrutura } from '../assets/motor/estrutura.js';
import { GRUPOS } from './grupos.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch com uma segunda tentativa se a ligação falhar (rede fraca, servidor ocupado: «ligação recusada» ou
 * interrompida). Uma resposta com erro HTTP (404...) não se repete.
 */
async function buscar(url) {
  try {
    return await fetch(url);
  } catch (e) {
    await esperar(400);
    return fetch(url);
  }
}

/** import() de um widget, com uma segunda tentativa (o endereço leva um sufixo para não reaproveitar a falha). */
async function importar(nome) {
  try {
    return await import(`./widgets/${nome}.js`);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e; // um erro de código não se resolve repetindo
    console.warn(`widget ${nome}: a repetir o carregamento`, e);
    await esperar(400);
    return import(`./widgets/${nome}.js?de-novo=1`);
  }
}

async function json(nome) {
  const r = await buscar(new URL(`./dados/${nome}.json`, import.meta.url));
  if (!r.ok) throw new Error(`${nome}.json: ${r.status}`);
  return r.json();
}

/** Lê dados/<pasta>/<grupo>.json. Em falta devolve null sem barulho; inválido, null com erro na consola. */
async function lerGrupo(pasta, g) {
  try {
    const r = await buscar(new URL(`./dados/${pasta}/${g.id}.json`, import.meta.url));
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error(`${pasta}/${g.id}.json`, e);
    return null;
  }
}

/** Junta, pela ordem dos GRUPOS, a lista `campo` de cada dados/<pasta>/<grupo>.json. */
async function juntar(pasta, campo, preencher) {
  const partes = await Promise.all(GRUPOS.map(async (g) => {
    const d = await lerGrupo(pasta, g);
    if (!d || !Array.isArray(d[campo])) return [];
    return d[campo].map((item) => preencher(item, d, g));
  }));
  return partes.flat();
}

const POR_GRUPO = {
  cartoes: async () => ({
    cartoes: await juntar('cartoes', 'cartoes', (c, d, g) => ({ ...c, grupo: c.grupo || d.grupo || g.id })),
  }),
  perguntas: async () => ({
    perguntas: await juntar('perguntas', 'perguntas', (p, d, g) => ({ ...p, tema: d.tema || g.id })),
  }),
  vf: async () => ({
    afirmacoes: await juntar('vf', 'afirmacoes', (a, d, g) => ({ ...a, tema: a.tema || d.tema || g.id })),
  }),
};

async function iniciar() {
  montarEstrutura(document.body.dataset.pagina, 'logaritmos');

  const pedidos = (document.body.dataset.dados || '').split(/\s+/).filter(Boolean);
  const dados = {};
  try {
    await Promise.all(pedidos.map(async (nome) => {
      dados[nome] = POR_GRUPO[nome] ? await POR_GRUPO[nome]() : await json(nome);
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
      const modulo = await importar(nome);
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
