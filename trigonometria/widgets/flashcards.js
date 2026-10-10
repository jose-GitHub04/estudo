// Flashcards com repetição espaçada (caixas de Leitner).
// Estado guardado em progresso, secção 'flashcards': { [idCartao]: { caixa: 1..5, prox: 'AAAA-MM-DD' } }
// Cartão novo = sem entrada. «Sabia» sobe uma caixa; «Não sabia» volta à caixa 1 e repete no fim da sessão.

import { GRUPOS } from '../../assets/motor/grupos.js';
import { renderizar } from '../../assets/motor/katex.js';
import { baralhar, criarRng } from '../../assets/motor/matematica.js';
import * as P from '../../assets/motor/progresso.js';

const INTERVALOS = [0, 1, 3, 7, 14]; // dias de espera, caixas 1 a 5
const POR_SESSAO = 15;
const MAX_REPETICOES = 2; // quantas vezes um cartão falhado volta à fila na mesma sessão

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = () => iso(new Date());
function somarDias(isoData, n) {
  const [a, m, d] = isoData.split('-').map(Number);
  return iso(new Date(a, m - 1, d + n));
}

function html(texto) {
  const t = document.createElement('template');
  t.innerHTML = texto.trim();
  return t.content.firstElementChild;
}

export async function montar(el, dados) {
  const lista = Array.isArray(dados.cartoes) ? dados.cartoes : dados.cartoes.cartoes;
  const tituloGrupo = Object.fromEntries(GRUPOS.map((g) => [g.id, g.titulo]));
  const rng = criarRng();

  let estado = P.ler('flashcards', {});
  let grupo = 'todos';
  let modo = 'hoje'; // 'hoje' = só os que já podem voltar; 'tudo' = o grupo inteiro
  let sessao = null; // { fila, total, feitos, certas, falhadas, repeticoes, virado }
  let avisouStorage = false;

  if (lista.length === 0) {
    el.innerHTML = '<p class="nota">Ainda não há cartões.</p>';
    return;
  }

  el.innerHTML = '';
  const raiz = html('<div class="widget fc"></div>');
  el.append(raiz);

  // ---------- Cálculos ----------

  const doGrupo = () => lista.filter((c) => grupo === 'todos' || c.grupo === grupo);
  const devido = (c) => !estado[c.id] || estado[c.id].prox <= hoje();
  const caixaDe = (c) => (estado[c.id] ? estado[c.id].caixa : 0);

  function escolherCartoes() {
    const base = modo === 'hoje' ? doGrupo().filter(devido) : doGrupo();
    // novos e caixas baixas primeiro; dentro de cada caixa, ordem aleatória
    const ordenados = baralhar(rng, base).sort((a, b) => caixaDe(a) - caixaDe(b));
    return modo === 'hoje' ? ordenados.slice(0, POR_SESSAO) : ordenados;
  }

  function guardar() {
    const ok = P.guardar('flashcards', estado);
    if (!ok && !avisouStorage) {
      avisouStorage = true;
      const aviso = raiz.querySelector('.fc-aviso');
      if (aviso) aviso.hidden = false;
    }
  }

  function responder(sabia) {
    const c = sessao.fila[0];
    const antes = estado[c.id] ? estado[c.id].caixa : 0;
    const primeira = !(c.id in sessao.respondidos);
    if (primeira) {
      sessao.respondidos[c.id] = sabia;
      sessao.feitos += 1;
      if (sabia) sessao.certas += 1; else sessao.falhadas += 1;
    }
    // cartão novo e sabido já passa para a caixa 2 (volta amanhã), não fica a repetir hoje
    const caixa = sabia ? Math.min(5, Math.max(antes, 1) + 1) : 1;
    estado[c.id] = { caixa, prox: somarDias(hoje(), INTERVALOS[caixa - 1]) };
    guardar();
    sessao.fila.shift();
    if (!sabia && (sessao.repeticoes[c.id] || 0) < MAX_REPETICOES) {
      sessao.repeticoes[c.id] = (sessao.repeticoes[c.id] || 0) + 1;
      sessao.fila.push(c);
    }
    sessao.virado = false;
    desenhar();
  }

  // ---------- Desenho ----------

  function cabecalho() {
    const devidos = doGrupo().filter(devido).length;
    const dominados = lista.filter((c) => caixaDe(c) === 5).length;
    const nGrupo = doGrupo().length;
    return `
      <p class="fc-resumo" aria-live="polite">
        <span><strong>${devidos}</strong> ${devidos === 1 ? 'cartão' : 'cartões'} para rever hoje${grupo === 'todos' ? '' : ' neste grupo'}</span>
        <span class="fc-sep" aria-hidden="true">·</span>
        <span>dominados: <strong>${dominados}</strong> de ${lista.length}</span>
      </p>
      <div class="chips fc-grupos" role="group" aria-label="Grupo de cartões">
        <button type="button" class="chip" data-grupo="todos" aria-pressed="${grupo === 'todos'}">Todos (${lista.length})</button>
        ${GRUPOS.filter((g) => lista.some((c) => c.grupo === g.id)).map((g) => `
          <button type="button" class="chip" data-grupo="${g.id}" aria-pressed="${grupo === g.id}">${g.titulo} (${lista.filter((c) => c.grupo === g.id).length})</button>`).join('')}
      </div>
      <div class="chips fc-modos" role="group" aria-label="O que estudar">
        <button type="button" class="chip" data-modo="hoje" aria-pressed="${modo === 'hoje'}">Os de hoje</button>
        <button type="button" class="chip" data-modo="tudo" aria-pressed="${modo === 'tudo'}">Estudar o grupo todo (${nGrupo})</button>
      </div>`;
  }

  function palcoInicio() {
    const n = escolherCartoes().length;
    if (n === 0) {
      return `<div class="fc-palco fc-vazio">
        <p><strong>Não há cartões para rever hoje${grupo === 'todos' ? '' : ' neste grupo'}.</strong></p>
        <p class="nota">Volta amanhã, ou escolhe «Estudar o grupo todo» para treinar na mesma.</p>
      </div>`;
    }
    return `<div class="fc-palco fc-vazio">
      <p>${n} ${n === 1 ? 'cartão' : 'cartões'} nesta ronda. Tenta responder de cabeça antes de virar.</p>
      <button type="button" class="botao" data-acao="comecar">Começar</button>
    </div>`;
  }

  function palcoCartao() {
    const c = sessao.fila[0];
    const caixa = caixaDe(c);
    const etiqueta = caixa === 0 ? 'Novo' : `Caixa ${caixa} de 5`;
    const feitos = sessao.feitos;
    const pct = Math.round((feitos / sessao.total) * 100);
    const verso = `
      <div class="fc-verso" ${sessao.virado ? '' : 'hidden'}>
        <div class="fc-resposta">${c.verso}</div>
        ${c.porque ? `<p class="fc-porque">${c.porque}</p>` : ''}
      </div>`;
    const acoes = sessao.virado
      ? `<div class="fc-acoes">
           <button type="button" class="botao botao--suave" data-acao="nao">Não sabia</button>
           <button type="button" class="botao" data-acao="sim">Sabia</button>
         </div>
         <p class="nota fc-dica">Teclado: ← não sabia, → sabia.</p>`
      : `<div class="fc-acoes fc-acoes--uma">
           <button type="button" class="botao" data-acao="virar">Virar o cartão</button>
         </div>
         <p class="nota fc-dica">Teclado: Enter vira o cartão.</p>`;
    return `
      <div class="fc-palco">
        <div class="fc-progresso">
          <span>${feitos} de ${sessao.total} feitos</span>
          <progress max="100" value="${pct}" aria-label="Progresso da ronda"></progress>
        </div>
        <div class="fc-cartao">
          <p class="fc-meta"><span>${tituloGrupo[c.grupo] || ''}</span><span class="fc-caixa">${etiqueta}</span></p>
          <div class="fc-frente">${c.frente}</div>
          ${verso}
        </div>
        ${acoes}
      </div>`;
  }

  function palcoFim() {
    const { certas, falhadas } = sessao;
    return `
      <div class="fc-palco fc-vazio">
        <p><strong>Ronda concluída.</strong></p>
        <p>${certas} ${certas === 1 ? 'cartão sabido' : 'cartões sabidos'} à primeira, ${falhadas} a repetir.</p>
        <p class="nota">Os que falhaste voltam já; os que sabes voltam mais tarde.</p>
        <button type="button" class="botao" data-acao="outra">Outra ronda</button>
      </div>`;
  }

  function desenhar() {
    const emCurso = sessao && sessao.fila.length > 0;
    const concluida = sessao && sessao.fila.length === 0;
    raiz.innerHTML = `
      ${cabecalho()}
      ${emCurso ? palcoCartao() : concluida ? palcoFim() : palcoInicio()}
      <p class="aviso-erro fc-aviso" hidden>Não consegui guardar o progresso neste dispositivo (modo privado ou dados do site bloqueados). Continua a funcionar, mas não fica guardado.</p>
      <p class="fc-rodape">
        <button type="button" class="botao botao--suave botao--mini" data-acao="apagar">Apagar o progresso dos cartões</button>
      </p>`;
    renderizar(raiz);
    if (emCurso) {
      const principal = raiz.querySelector('[data-acao="virar"], [data-acao="sim"]');
      if (principal) principal.focus({ preventScroll: true });
    }
  }

  // ---------- Eventos ----------

  raiz.addEventListener('click', (e) => {
    const botao = e.target.closest('button');
    if (!botao || !raiz.contains(botao)) return;
    if (botao.dataset.grupo) {
      grupo = botao.dataset.grupo;
      sessao = null;
      desenhar();
    } else if (botao.dataset.modo) {
      modo = botao.dataset.modo;
      sessao = null;
      desenhar();
    } else if (botao.dataset.acao) {
      const acao = botao.dataset.acao;
      if (acao === 'comecar' || acao === 'outra') {
        const fila = escolherCartoes();
        sessao = fila.length
          ? { fila, total: fila.length, feitos: 0, certas: 0, falhadas: 0, repeticoes: {}, respondidos: {}, virado: false }
          : null;
        desenhar();
      } else if (acao === 'virar') {
        sessao.virado = true;
        desenhar();
      } else if (acao === 'sim') {
        responder(true);
      } else if (acao === 'nao') {
        responder(false);
      } else if (acao === 'apagar') {
        if (window.confirm('Apagar o progresso dos cartões neste dispositivo? Não dá para desfazer.')) {
          estado = {};
          P.guardar('flashcards', estado);
          sessao = null;
          desenhar();
        }
      }
    }
  });

  raiz.addEventListener('keydown', (e) => {
    if (!sessao || sessao.fila.length === 0) return;
    if (sessao.virado && e.key === 'ArrowRight') { e.preventDefault(); responder(true); }
    else if (sessao.virado && e.key === 'ArrowLeft') { e.preventDefault(); responder(false); }
  });

  desenhar();
}
