// Os grupos do tema Exponenciais e logaritmos, pela ordem em que aparecem nos cartões,
// nas perguntas e no verdadeiro ou falso. Cada grupo tem um ficheiro por tipo de dados:
// dados/cartoes/<id>.json, dados/perguntas/<id>.json e dados/vf/<id>.json.
// `prefixo` é o começo dos ids desse grupo (por exemplo exp-01, exp-vf-base).
export const GRUPOS = [
  { id: 'exponencial', titulo: 'Função exponencial', prefixo: 'exp' },
  { id: 'logaritmo', titulo: 'Logaritmos: definição e cálculo', prefixo: 'log' },
  { id: 'propriedades', titulo: 'Propriedades dos logaritmos', prefixo: 'pro' },
  { id: 'funcao', titulo: 'Função logarítmica', prefixo: 'fun' },
  { id: 'equacoes', titulo: 'Equações e inequações', prefixo: 'equ' },
  { id: 'derivadas', titulo: 'Derivadas', prefixo: 'der' },
  { id: 'limites', titulo: 'Limites e assíntotas', prefixo: 'lim' },
  { id: 'estudo', titulo: 'Estudo de funções', prefixo: 'est' },
];

/** id do grupo -> prefixo dos ids. */
export const PREFIXOS = Object.fromEntries(GRUPOS.map((g) => [g.id, g.prefixo]));
