"""Verificação dos dados do tema «Exponenciais e logaritmos» (logaritmos/dados/**).

Correr (a partir da raiz do site):
    python -X utf8 -I tools/verificar_log.py                 tudo o que existir
    python -X utf8 -I tools/verificar_log.py f1.json f2.json  só esses ficheiros
    opções: --sem-avisos (esconde os AVISO)   --semente N (outras amostras aleatórias)
            --nao-lidas (lista as relações de LaTeX dos exercícios que o leitor não conferiu sozinhas)

Imprime `FALHA: <ficheiro>: <id>: <o quê>` por cada problema e sai com código 1 se houver
falhas. Os AVISO não fazem falhar (contagens por grupo, falta de erroComum, distribuição da
posição certa...), para não bloquear trabalho em curso. Pastas ou ficheiros que ainda não
existem são ignorados.

Verifica, por tipo:
  cartões    (dados/cartoes/<grupo>.json):   campos, ids, texto, `verifica`
  perguntas  (dados/perguntas/<grupo>.json): 4 opções distintas, `certa`, `nivel`, texto,
             `ref` + `valor` das opções, `verifica`, >= 60 % com verificação numérica
  V/F        (dados/vf/<grupo>.json):        `verdadeira`, explicação, `verifica`, `figura` (e, na `figura`, que cada
             curva é a função do seu rótulo e do enunciado e cada ponto está numa curva, com as coordenadas do rótulo)
  exercícios (dados/exercicios.json):        estrutura, texto, `verifica` de cada exercício e de cada alínea (a resposta
             recalculada), todas as fórmulas de LaTeX dos passos que se conseguem ler (identidades, equivalências,
             contas com «≈» arredondadas ao que está escrito), todos os números decimais escritos (têm de aparecer num
             `verifica`) e as figuras (curvas = `funcoes`, pontos nas curvas, retas tangentes)
Campos de cada exercício (e de cada alínea) que o verificador lê, além do que o widget usa:
  verifica   afirmações Python que RECALCULAM a resposta final por outro caminho (zeros com raizes(f, a, b), mínimos com
             valmin/argmin, limites com lim/limd/lime, derivadas com der, domínios com comparações...). Cada alínea (ou o
             exercício, se não tem alíneas) tem de ter as suas.
  funcoes    { rótulo da curva: expressão em x, em Python }: o que cada curva das figuras tem de ser (a curva desenhada
             é comparada com isto em 400 pontos). O rótulo «y = ...» também se lê e confronta com a curva.
  solucao    lista de números calculada à parte (ex.: raizes(...)): tem de ser o conjunto S={...} escrito na `resposta`.
  intervalo  [a, b] (com inf) calculado à parte: tem de ser o intervalo escrito na `resposta`.
Além disso confere-se sozinho: cada linha de LaTeX dos passos que o leitor lê (identidades, ⇔, ⇒, «≈» ao número de casas
escrito); todo o decimal escrito que não é dado do enunciado (tem de aparecer num `verifica`); cada ponto das figuras
(dentro da janela, numa curva ou reta, com as coordenadas do rótulo) e cada reta (a do rótulo; a de cor `tg` ou chamada
«t»/«tangente» tem de ser a tangente num ponto marcado).

Sem argumentos corre também os verificadores de equacoes.json (tools/verificar_equacoes.py) e de estudos.json
(tools/verificar_estudos.py), para um só comando cobrir os dados todos.

Verificação numérica (expressões Python dos campos `ref`, `valor` e `verifica`):
  nomes disponíveis: sqrt pi e exp ln log(base 10) logb(a, x) abs min max sin cos tan
                     ig(x, y) der(f, x) lim(f, x0) inf
  para os exercícios (acrescentam): raizes(f, a, b) (zeros por varrimento e bisseção), valmin/valmax/argmin/argmax(f, a, b),
                     cresc/decresc(f, a, b), der2(f, x), igl(lista, lista)
  extras (não estão no contrato; só acrescentam): limd(f, x0) e lime(f, x0) (limites
                     laterais), lim_existe(f, x0), atan asin acos floor ceil round sum all
                     any range len sorted float int
  variáveis aleatórias: a, b em (0,2; 6) a mais de 0,15 de 1; x, y, z em (0,2; 8);
                     t em (-3; 3); k inteiro -3..3; n inteiro 1..6
  `ref` e `valor` não têm variáveis; cada `verifica` tem de ser True em 40 amostras
  (as que saem do domínio, como ln de um negativo, são trocadas por outras).
As amostras são sempre as mesmas para a mesma afirmação (semente fixa), por isso o resultado
não muda de uma corrida para a outra.

Também se usa de dentro de tools/verificar.py: correr() devolve a lista de falhas.
"""
import importlib.util
import json
import math
import random
import re
import sys
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "logaritmos" / "dados"

PREFIXOS = {"exponencial": "exp", "logaritmo": "log", "propriedades": "pro", "funcao": "fun",
            "equacoes": "equ", "derivadas": "der", "limites": "lim", "estudo": "est"}
TIPOS = ("cartoes", "perguntas", "vf")   # exercicios.json tem o seu verificador (verificar_exercicios)
LISTA = {"cartoes": "cartoes", "perguntas": "perguntas", "vf": "afirmacoes"}
ROTULO = {"cartoes": "cartões", "perguntas": "perguntas", "vf": "afirmações"}
CAMPO_TEMA = {"cartoes": "grupo", "perguntas": "tema", "vf": "tema"}
FICHEIROS_DE_OUTROS = {"estudos.json": "tools/verificar_estudos.py"}   # têm formato e verificador próprios

N_AMOSTRAS = 40
MIN_VALIDAS = 10          # abaixo disto a afirmação "nunca se avalia" e falha
MAX_TENTATIVAS = 200
MIN_VERIFICADAS = 60      # % de perguntas por ficheiro com ref ou verifica
SEMENTE = 0

VARIAVEIS = ("a", "b", "x", "y", "z", "t", "k", "n")
ERROS_DOMINIO = (ValueError, ZeroDivisionError, OverflowError)
# (escritos com \u: o verificar.py falha se este ficheiro tiver um travessão por extenso)
TRAVESSOES = {"\u2014": "travessão «\u2014» (U+2014)", "\u2013": "travessão curto «\u2013» (U+2013)",
              "\u2015": "barra horizontal (U+2015)", "\u2012": "travessão de algarismos (U+2012)"}


# ---------------------------------------------------------------- relatório
class _Relatorio:
    def __init__(self):
        self.falhas, self.avisos = [], []
        self.mostrar_avisos = True

    def falha(self, nome, ident, msg):
        linha = f"{nome}: {ident}: {msg}"
        self.falhas.append(linha)
        print("FALHA:", linha)

    def aviso(self, nome, ident, msg):
        linha = f"{nome}: {ident}: {msg}"
        self.avisos.append(linha)
        if self.mostrar_avisos:
            print("AVISO:", linha)


R = _Relatorio()


# ------------------------------------------- espaço de nomes das expressões
class ErroAutor(Exception):
    """Erro de quem escreveu a expressão (nome desconhecido, sintaxe, limite que não existe...),
    não de domínio matemático: não se troca a amostra, falha logo."""


def _ig(x, y):
    if isinstance(x, complex) or isinstance(y, complex):
        raise ValueError("resultado complexo")
    try:
        return math.isclose(x, y, rel_tol=1e-6, abs_tol=1e-6)
    except TypeError:
        return x == y


def _ln(x):
    return math.log(x)


def _logb(a, x):
    return math.log(x) / math.log(a)


def _der(f, x):
    """Derivada central com extrapolação de Richardson (h = 1e-5): erro de ordem h^4."""
    h = 1e-5

    def d(passo):
        return (f(x + passo) - f(x - passo)) / (2 * passo)
    return (4 * d(h / 2) - d(h)) / 3


H_LIM = 1e-7
GRANDE = 1e8


def _lado(f, ponto):
    try:
        return f(ponto), None
    except ERROS_DOMINIO as exc:
        return None, exc


def _lim(f, x0):
    """Valor de f muito perto de x0, por baixo e por cima. Se um dos lados está fora do
    domínio devolve o outro (limite lateral do domínio). Lança se os dois lados diferem.
    lim(f, inf) -> f(1e8); lim(f, -inf) -> f(-1e8)."""
    if x0 == math.inf or x0 == -math.inf:
        try:
            return f(GRANDE if x0 > 0 else -GRANDE)
        except OverflowError:
            raise ErroAutor("lim(f, ±inf): f(±1e8) transborda (por exemplo exp de um número enorme); "
                            "testa com um valor grande à mão (exp(30) > 1e12) ou reescreve f sem transbordar")
    esq, e1 = _lado(f, x0 - H_LIM)
    dir_, e2 = _lado(f, x0 + H_LIM)
    if e1 is not None and e2 is not None:
        raise e1
    if e1 is not None:
        return dir_
    if e2 is not None:
        return esq
    if not math.isclose(esq, dir_, rel_tol=1e-5, abs_tol=1e-5):
        raise ErroAutor(f"lim: os limites laterais são diferentes (f(x0-1e-7) = {esq:.6g}, f(x0+1e-7) = {dir_:.6g}); "
                        "usa limd (à direita) ou lime (à esquerda)")
    return (esq + dir_) / 2


def _limd(f, x0):
    return f(x0 + H_LIM)


def _lime(f, x0):
    return f(x0 - H_LIM)


def _lim_existe(f, x0):
    try:
        _lim(f, x0)
        return True
    except ErroAutor:
        return False


def _espaco(variaveis=None):
    """Dicionário único (globais = locais), para as lambdas verem as variáveis."""
    ns = {"sqrt": math.sqrt, "pi": math.pi, "e": math.e, "exp": math.exp, "ln": _ln,
          "log": math.log10, "logb": _logb, "abs": abs, "min": min, "max": max,
          "sin": math.sin, "cos": math.cos, "tan": math.tan, "ig": _ig, "der": _der,
          "lim": _lim, "inf": math.inf,
          # extras, só acrescentam
          "limd": _limd, "lime": _lime, "lim_existe": _lim_existe,
          "atan": math.atan, "asin": math.asin, "acos": math.acos, "floor": math.floor,
          "ceil": math.ceil, "round": round, "sum": sum, "all": all, "any": any, "range": range,
          "len": len, "sorted": sorted, "float": float, "int": int}
    ns.update(EXTRAS_NUMERICOS)
    ns["__builtins__"] = {}
    if variaveis:
        ns.update(variaveis)
    return ns


def _amostra(rnd):
    def base():
        while True:
            v = rnd.uniform(0.2, 6.0)
            if abs(v - 1.0) >= 0.15:
                return v
    return {"a": base(), "b": base(), "x": rnd.uniform(0.2, 8.0), "y": rnd.uniform(0.2, 8.0),
            "z": rnd.uniform(0.2, 8.0), "t": rnd.uniform(-3.0, 3.0), "k": rnd.randint(-3, 3),
            "n": rnd.randint(1, 6)}


def _compilar(expr, onde):
    if not isinstance(expr, str) or not expr.strip():
        raise ErroAutor(f"{onde} vazio ou não é texto")
    if "^" in expr:
        raise ErroAutor(f"{onde} «{expr}» usa ^ (em Python é XOR); escreve ** para as potências")
    try:
        return compile(expr.strip(), "<expr>", "eval")
    except SyntaxError as exc:
        raise ErroAutor(f"{onde} «{expr}» tem erro de sintaxe ({exc.msg}); multiplicação explícita com *, potências com **")


def _nomes(code):
    """Nomes globais usados na expressão, incluindo dentro de lambdas."""
    nomes = set(code.co_names)
    for c in code.co_consts:
        if hasattr(c, "co_names"):
            nomes |= _nomes(c)
    return nomes


def _avaliar(code, ns, expr, com_variaveis=True):
    try:
        return eval(code, ns)
    except ERROS_DOMINIO:
        raise
    except ErroAutor:
        raise
    except NameError as exc:
        nome = getattr(exc, "name", None) or str(exc)
        if not com_variaveis and nome in VARIAVEIS:
            raise ErroAutor(f"«{expr}» usa a variável «{nome}», mas ref e valor não podem ter variáveis")
        raise ErroAutor(f"«{expr}»: nome desconhecido «{nome}» (disponíveis: sqrt pi e exp ln log logb abs min max "
                        "sin cos tan ig der lim inf raizes valmin valmax argmin argmax cresc decresc der2 igl; variáveis a b x y z t k n)")
    except TypeError as exc:
        if "complex" in str(exc):
            raise ValueError("resultado complexo")
        raise ErroAutor(f"«{expr}»: erro de tipos ({exc})")
    except Exception as exc:  # noqa: BLE001
        raise ErroAutor(f"«{expr}»: {type(exc).__name__}: {exc}")


def _mostrar(v, usadas):
    return ", ".join(f"{n}={v[n]:.6g}" for n in VARIAVEIS if n in usadas) or "sem variáveis"


def verificar_afirmacao(expr, chave):
    """Uma afirmação `verifica`: True em N_AMOSTRAS amostras. Devolve (erro, aviso) em texto ou None."""
    try:
        code = _compilar(expr, "verifica")
    except ErroAutor as exc:
        return str(exc), None
    usadas = _nomes(code) & set(VARIAVEIS)
    alvo = N_AMOSTRAS if usadas else 1
    rnd = random.Random(zlib.crc32(f"{SEMENTE}|{chave}|{expr}".encode("utf-8")))
    validas, ultimo = 0, None
    for _ in range(MAX_TENTATIVAS):
        if validas >= alvo:
            break
        v = _amostra(rnd)
        try:
            r = _avaliar(code, _espaco(v), expr)
        except ERROS_DOMINIO as exc:
            ultimo = exc
            continue
        except ErroAutor as exc:
            return str(exc), None
        if not isinstance(r, bool):
            return f"«{expr}» devolve {r!r} em vez de True/False (usa ig(..., ...) ou uma comparação)", None
        if not r:
            return f"afirmação falsa «{expr}» com {_mostrar(v, usadas)}", None
        validas += 1
    if validas < min(alvo, MIN_VALIDAS):
        return (f"«{expr}» quase nunca se consegue avaliar (só {validas} amostras válidas em {MAX_TENTATIVAS} "
                f"tentativas; último erro de domínio: {ultimo})"), None
    if validas < alvo:
        return None, f"«{expr}» só teve {validas} amostras válidas em {MAX_TENTATIVAS} tentativas (domínio estreito)"
    return None, None


def avaliar_numero(expr, onde):
    """`ref`/`valor`: expressão sem variáveis que dá um número real (±inf permitido)."""
    if isinstance(expr, (int, float)) and not isinstance(expr, bool):
        expr = repr(expr)
    code = _compilar(expr, onde)
    try:
        r = _avaliar(code, _espaco(), expr, com_variaveis=False)
    except ERROS_DOMINIO as exc:
        raise ErroAutor(f"{onde} «{expr}» sai do domínio ({exc})")
    if isinstance(r, bool) or not isinstance(r, (int, float)) or (isinstance(r, float) and math.isnan(r)):
        raise ErroAutor(f"{onde} «{expr}» não dá um número real (dá {r!r})")
    try:
        return float(r)
    except OverflowError:
        raise ErroAutor(f"{onde} «{expr}» é grande demais")


# --------------------------------------------------------------- texto
FORMULA = re.compile(r"\$\$[\s\S]+?\$\$|\$[^$]+?\$")


def _importar_verificar(nome, local):
    """O regex do tools/verificar.py (se existir), para as duas listas ficarem alinhadas."""
    try:
        spec = importlib.util.spec_from_file_location("_verificar_base", RAIZ / "tools" / "verificar.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, nome)
    except Exception:  # noqa: BLE001
        return local


_PTBR_LOCAL = re.compile(r"\b(tela|arquivo|celular|você|vocês|equipe|ônibus|time de)\b", re.I)
_OPCAO_LOCAL = re.compile(r"(nenhuma|todas|ambas)\s+(d?as\s+)?(anteriores|acima|outras)|\b[abcd]\)\s*e\s*[abcd]\)", re.I)
PTBR = _importar_verificar("PTBR", _PTBR_LOCAL)
OPCAO_PROIBIDA = _importar_verificar("OPCAO_PROIBIDA", _OPCAO_LOCAL)
PTBR_EXTRA = re.compile(r"\b(usu[aá]rios?|pra|tá|né|a gente|porcentagem|registros?|gerenciar|contato|"
                        r"telas?|arquivos?|celulares?|equipes?|ônibus)\b", re.I)
GERUNDIO = re.compile(r"\b(estou|estás|está|estamos|estão|estava|estavam)\s+\w{3,}(ando|endo|indo)\b", re.I)
OPCAO_EXTRA = re.compile(
    r"(?i:\b(nenhuma|nenhum|todas|todos|ambas|ambos)\s+(d[aeo]s?\s+)?(anteriores|acima|op[cç][õo]es|respostas|alternativas|"
    r"outras|restantes)\b|\bas\s+duas\s+(op|resp|alt))")
# a letra é maiúscula de propósito: «resposta a esta pergunta» não é uma referência à opção A
OPCAO_LETRA_REF = re.compile(r"(?i:\b(op[cç][aã]o|alternativa|resposta))\s+[A-D]\b")
OPCAO_LETRAS = re.compile(r"\b[A-D]\s+e\s+[A-D]\b|\(\s*[A-D]\s*\)")  # maiúsculas: «A e B», «(C)»
TAG_OK = re.compile(r"<(/?)(strong|em|br|code|sub|sup|b|i|u|ul|ol|li|p|span)(\s[^<>]*)?/?>")
CONTROLO = re.compile(r"[\x00-\x1f]")
NOME_CONTROLO = {"\x0c": r"\f", "\x08": r"\b", "\n": r"\n", "\r": r"\r", "\t": r"\t"}
ORIGEM_CONTROLO = {"\x0c": r"\frac, \forall", "\x08": r"\beta, \binom, \bar",
                   "\n": r"\neq, \nu, \not (ou uma quebra de linha)", "\r": r"\right, \rho",
                   "\t": r"\times, \text, \to, \theta, \tan, \tfrac"}


def _trecho(t, n=60):
    t = t.replace("\n", " ")
    return t if len(t) <= n else t[:n] + "..."


def _formula_ok(f):
    """Chavetas, \\left/\\right e \\begin/\\end equilibrados numa fórmula. Devolve a queixa ou None."""
    s = f.replace("\\{", "").replace("\\}", "")
    prof = 0
    for c in s:
        prof += (c == "{") - (c == "}")
        if prof < 0:
            return "chaveta } a mais"
    if prof:
        return "chaveta { sem fechar"
    if len(re.findall(r"\\left(?![a-zA-Z])", f)) != len(re.findall(r"\\right(?![a-zA-Z])", f)):
        return r"\left e \right desequilibrados"
    if re.findall(r"\\begin\{(\w+\*?)\}", f) != re.findall(r"\\end\{(\w+\*?)\}", f):
        return r"\begin e \end desequilibrados"
    return None


def verificar_texto(nome, ident, campo, t, opcoes=True):
    """Texto que o aluno lê (vai para innerHTML com KaTeX). `opcoes=False` nos exercícios, onde
    «alíneas a) e b)» é normal e não há opções baralhadas."""
    if not isinstance(t, str):
        R.falha(nome, ident, f"{campo} não é texto")
        return
    t = t.replace("\\$", "")
    if t.count("$") % 2:
        R.falha(nome, ident, f"número ímpar de $ em {campo} («{_trecho(t)}»)")
        return
    for f in FORMULA.findall(t):
        queixa = _formula_ok(f)
        if queixa:
            R.falha(nome, ident, f"{campo}: {queixa} em «{_trecho(f)}»")
    fora = FORMULA.sub(" \u00a4 ", t)
    brasileiras = []
    for rx in (PTBR, PTBR_EXTRA):
        for m in rx.finditer(fora):
            if m.group(0).lower() not in brasileiras:
                brasileiras.append(m.group(0).lower())
    if brasileiras:
        R.falha(nome, ident, f"palavra(s) de pt-BR «{'», «'.join(brasileiras)}» em {campo} («{_trecho(fora)}»)")
    m = GERUNDIO.search(fora)
    if m:
        R.aviso(nome, ident, f"gerúndio de pt-BR? «{m.group(0)}» em {campo} (em pt-PT: «estar a fazer»)")
    for rx in ((OPCAO_PROIBIDA, OPCAO_EXTRA, OPCAO_LETRA_REF, OPCAO_LETRAS) if opcoes else ()):
        m = rx.search(fora)
        if m:
            R.falha(nome, ident, f"{campo} aponta para outras opções («{m.group(0)}»); as opções são baralhadas no ecrã")
            break
    sem_tags = TAG_OK.sub("", fora)
    if "<" in sem_tags:
        R.falha(nome, ident, f"«<» solto fora de $...$ em {campo} (escreve &lt;): «{_trecho(sem_tags)}»")
    if re.search(r"&(?![a-zA-Z]+;|#\d+;)", sem_tags):
        R.aviso(nome, ident, f"«&» solto fora de $...$ em {campo} (escreve &amp;)")
    if re.search(r"(?<![\w.,])\d+\.\d+(?![\w.])", t):
        R.aviso(nome, ident, f"ponto decimal em {campo} («{_trecho(t)}»): em pt-PT é vírgula (texto 0,5; LaTeX 0{{,}}5)")


def _percorrer(obj):
    """Todas as strings (chaves e valores) de uma estrutura JSON."""
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from _percorrer(k)
            yield from _percorrer(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _percorrer(v)


def verificar_caracteres(nome, ident, obj):
    """Caracteres de controlo (barra do LaTeX por dobrar que ainda dá JSON válido) e travessões."""
    for s in _percorrer(obj):
        for m in CONTROLO.finditer(s):
            c = m.group(0)
            ctx = (s[max(0, m.start() - 25):m.start()] + "\u27e8" + NOME_CONTROLO.get(c, f"U+{ord(c):04X}")
                   + "\u27e9" + s[m.end():m.end() + 25]).replace("\n", " ")
            R.falha(nome, ident, f"caractere de controlo {NOME_CONTROLO.get(c, f'U+{ord(c):04X}')} em «{ctx}»: "
                                 f"vem de {ORIGEM_CONTROLO.get(c, 'uma barra do LaTeX')} com a barra por dobrar; "
                                 "no JSON escreve-se \\\\frac, \\\\times, \\\\neq, \\\\right, \\\\text...")
            break
        for ch, descr in TRAVESSOES.items():
            if ch in s:
                R.falha(nome, ident, f"{descr} em «{_trecho(s[max(0, s.index(ch) - 25):s.index(ch) + 25])}» "
                                     "(usa vírgula, dois pontos ou reescreve; menos fora de $ é «\u2212» U+2212)")


# ---------------------------------------------------------- estrutura
def _rotulo(caminho):
    try:
        return str(caminho.resolve().relative_to(DADOS)).replace("\\", "/")
    except ValueError:
        return f"{caminho.parent.name}/{caminho.name}"


def _eh_numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _id_ok(nome, ident, i, prefixo, esperado, ids):
    """Prefixo, unicidade e carateres do id. `esperado` é o começo exigido (ex. 'exp-' ou 'exp-vf-')."""
    if not isinstance(i, str) or not i:
        R.falha(nome, ident, "sem id")
        return
    if not i.startswith(esperado) or len(i) == len(esperado):
        R.falha(nome, ident, f"o id deve começar por {esperado} (grupo com prefixo {prefixo})")
    if i in ids:
        R.falha(nome, ident, f"id repetido (também em {ids[i]})")
    else:
        ids[i] = nome
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", i):
        R.aviso(nome, ident, "id com maiúsculas, acentos, espaços ou símbolos (usa minúsculas, dígitos e hífenes)")


def _chaves_desconhecidas(nome, ident, d, permitidas):
    extra = [k for k in d if k not in permitidas and not k.startswith("_")]
    if extra:
        R.aviso(nome, ident, f"campos desconhecidos: {', '.join(extra)} (gralha?)")


def _verifica_lista(nome, ident, item, contar):
    """Corre a lista `verifica` de um item; devolve True se tem pelo menos uma afirmação."""
    v = item.get("verifica")
    if v is None:
        return False
    if not isinstance(v, list) or not v or not all(isinstance(s, str) for s in v):
        R.falha(nome, ident, "`verifica` tem de ser uma lista não vazia de texto, ex.: [\"ig(ln(x**2), 2*ln(x))\"]")
        return False
    for expr in v:
        erro, aviso = verificar_afirmacao(expr, f"{nome}|{ident}")
        if erro:
            R.falha(nome, ident, erro)
        if aviso:
            R.aviso(nome, ident, aviso)
        contar["afirmacoes"] = contar.get("afirmacoes", 0) + 1
    return True


# --------------------------------------------------------- cartões
CHAVES_CARTAO = {"id", "grupo", "frente", "verso", "porque", "verifica"}


def verificar_cartoes(nome, stem, itens, ids, est):
    prefixo = PREFIXOS[stem]
    if len(itens) != 0 and not 8 <= len(itens) <= 10:
        R.aviso(nome, "-", f"{len(itens)} cartões (esperados 8 a 10)")
    if not itens:
        R.aviso(nome, "-", "sem cartões")
    for n, c in enumerate(itens, 1):
        ident = str(c.get("id")) if isinstance(c, dict) and c.get("id") else f"#{n}"
        est["total"] += 1
        if not isinstance(c, dict):
            R.falha(nome, ident, "o cartão tem de ser um objeto { id, grupo, frente, verso }")
            continue
        verificar_caracteres(nome, ident, c)
        _id_ok(nome, ident, c.get("id"), prefixo, prefixo + "-", ids)
        for campo in ("id", "grupo", "frente", "verso"):
            if not isinstance(c.get(campo), str) or not c.get(campo).strip():
                R.falha(nome, ident, f"falta `{campo}` (texto não vazio)")
        if c.get("grupo") not in (None, stem) and isinstance(c.get("grupo"), str):
            R.falha(nome, ident, f"grupo «{c['grupo']}» não coincide com o nome do ficheiro ({stem})")
        for campo in ("frente", "verso", "porque"):
            if campo in c:
                if campo == "porque" and (not isinstance(c[campo], str) or not c[campo].strip()):
                    R.aviso(nome, ident, "`porque` vazio (tira-o ou escreve a razão)")
                    continue
                verificar_texto(nome, ident, campo, c[campo])
        _chaves_desconhecidas(nome, ident, c, CHAVES_CARTAO)
        if _verifica_lista(nome, ident, c, est):
            est["verif"] += 1


# ------------------------------------------------------- perguntas
CHAVES_PERGUNTA = {"id", "nivel", "enunciado", "opcoes", "certa", "ref", "explicacao", "verifica"}


def verificar_perguntas(nome, stem, itens, ids, est):
    prefixo = PREFIXOS[stem]
    verificadas = 0
    por_posicao = [0, 0, 0, 0]
    niveis = {1: 0, 2: 0, 3: 0}
    enunciados = {}
    if len(itens) != 14:
        R.aviso(nome, "-", f"{len(itens)} perguntas (esperadas 14: 5 de nível 1, 6 de nível 2, 3 de nível 3)")
    for n, p in enumerate(itens, 1):
        ident = str(p.get("id")) if isinstance(p, dict) and p.get("id") else f"#{n}"
        est["total"] += 1
        if not isinstance(p, dict):
            R.falha(nome, ident, "a pergunta tem de ser um objeto")
            continue
        verificar_caracteres(nome, ident, p)
        _id_ok(nome, ident, p.get("id"), prefixo, prefixo + "-", ids)
        if isinstance(p.get("id"), str) and p["id"].startswith(prefixo + "-") and not re.fullmatch(re.escape(prefixo) + r"-\d\d", p["id"]):
            R.aviso(nome, ident, f"o id das perguntas costuma ser {prefixo}-NN (ex. {prefixo}-01)")
        nivel = p.get("nivel")
        if isinstance(nivel, bool) or nivel not in (1, 2, 3):
            R.falha(nome, ident, "`nivel` tem de ser 1, 2 ou 3")
        else:
            niveis[nivel] += 1
        for campo in ("enunciado", "explicacao"):
            if not isinstance(p.get(campo), str) or not p.get(campo).strip():
                R.falha(nome, ident, f"sem {campo}")
            else:
                verificar_texto(nome, ident, campo, p[campo])
        if isinstance(p.get("enunciado"), str):
            chave = re.sub(r"\s+", " ", p["enunciado"]).strip()
            if chave in enunciados:
                R.aviso(nome, ident, f"enunciado igual ao de {enunciados[chave]}")
            enunciados.setdefault(chave, ident)
        _chaves_desconhecidas(nome, ident, p, CHAVES_PERGUNTA)

        opcoes = p.get("opcoes")
        opcoes_ok = isinstance(opcoes, list) and len(opcoes) == 4 and all(isinstance(o, dict) for o in opcoes)
        if not opcoes_ok:
            R.falha(nome, ident, f"`opcoes` tem de ter 4 opções {{ tex, valor? }}, tem {len(opcoes) if isinstance(opcoes, list) else 'outra coisa'}")
        textos = []
        if opcoes_ok:
            textos = [o.get("tex", "").strip() if isinstance(o.get("tex"), str) else "" for o in opcoes]
            if "" in textos:
                R.falha(nome, ident, "há uma opção sem `tex`")
            norm = [re.sub(r"\s+", "", t) for t in textos]
            if len(set(norm)) != 4:
                R.falha(nome, ident, "há opções repetidas")
            for i, t in enumerate(textos):
                if t:
                    verificar_texto(nome, ident, f"opção {i}", t)
            for o in opcoes:
                _chaves_desconhecidas(nome, ident, o, {"tex", "valor"})
        certa = p.get("certa")
        certa_ok = isinstance(certa, int) and not isinstance(certa, bool) and 0 <= certa <= 3
        if not certa_ok:
            R.falha(nome, ident, "`certa` tem de ser um inteiro de 0 a 3")
        else:
            por_posicao[certa] += 1

        tem = False
        # ref + valor
        tem_valor = [("valor" in o) for o in opcoes] if opcoes_ok else []
        if opcoes_ok and ("ref" in p or any(tem_valor)):
            if "ref" not in p:
                R.falha(nome, ident, "há `valor` nas opções mas falta `ref` (a expressão da resposta certa)")
            elif not any(tem_valor):
                R.falha(nome, ident, "há `ref` mas nenhuma opção tem `valor`")
            elif not all(tem_valor):
                faltam = [str(i) for i, t in enumerate(tem_valor) if not t]
                R.falha(nome, ident, f"se uma opção tem `valor` todas têm (faltam nas opções {', '.join(faltam)}); "
                                     "se há opções que não são números usa `verifica` em vez de `ref`")
            elif certa_ok:
                est["ref"] += 1
                tem = True
                try:
                    ref = avaliar_numero(p["ref"], "ref")
                    valores = [avaliar_numero(o["valor"], f"valor da opção {i}") for i, o in enumerate(opcoes)]
                except ErroAutor as exc:
                    R.falha(nome, ident, str(exc))
                else:
                    def igual(u, v):
                        return math.isclose(u, v, rel_tol=1e-9, abs_tol=1e-9)
                    iguais_a_ref = [i for i, v in enumerate(valores) if igual(v, ref)]
                    if not igual(valores[certa], ref):
                        if iguais_a_ref:
                            R.falha(nome, ident, f"`certa` aponta para a opção {certa} (vale {valores[certa]:.12g}) mas `ref` dá "
                                                 f"{ref:.12g}, que é o valor da opção {iguais_a_ref[0]}")
                        else:
                            R.falha(nome, ident, f"a opção certa ({certa}) vale {valores[certa]:.12g} mas `ref` dá {ref:.12g} "
                                                 "(se a resposta é arredondada, põe round(..., casas) no ref)")
                    else:
                        for i in iguais_a_ref:
                            if i != certa:
                                R.falha(nome, ident, f"a opção {i} também vale {ref:.12g}: há duas certas")
                    for i in range(4):
                        for j in range(i + 1, 4):
                            if i != certa and j != certa and igual(valores[i], valores[j]):
                                R.falha(nome, ident, f"as opções {i} e {j} têm o mesmo valor ({valores[i]:.12g})")
        if _verifica_lista(nome, ident, p, est):
            est["verifica"] += 1
            tem = True
        if tem:
            verificadas += 1

    total = len(itens)
    est["verif"] += verificadas
    if total:
        pct = 100 * verificadas / total
        if pct < MIN_VERIFICADAS:
            R.falha(nome, "-", f"só {verificadas} de {total} perguntas ({pct:.0f}%) têm `ref` ou `verifica`; mínimo {MIN_VERIFICADAS}%")
        if total >= 6 and max(por_posicao) / total > 0.5:
            R.aviso(nome, "-", f"a resposta certa está demasiadas vezes na mesma posição: {por_posicao} (posições 0 a 3)")
        if total == 14 and (niveis[1], niveis[2], niveis[3]) != (5, 6, 3):
            R.aviso(nome, "-", f"níveis {niveis[1]}/{niveis[2]}/{niveis[3]} (esperado 5/6/3)")
    return por_posicao, niveis, verificadas


# --------------------------------------------------------------- V/F
CHAVES_VF = {"id", "tema", "texto", "verdadeira", "explicacao", "erroComum", "verifica", "figura"}
CHAVES_FIGURA = {"tipo", "x", "y", "curvas", "pontos", "retasH", "retasV", "aria", "largura", "altura", "rotuloX", "rotuloY"}


def _avaliar_curva(expr, x0, x1):
    """Valores de y = expr(x) em 241 pontos de [x0, x1]. A sintaxe é a do avaliador do site: ^ para potências."""
    py = expr.replace("^", "**")
    code = _compilar(py, "expr da curva")
    finitos = []
    for i in range(241):
        x = x0 + (x1 - x0) * i / 240
        try:
            y = _avaliar(code, _espaco({"x": x}), expr)
        except ERROS_DOMINIO:
            continue
        if isinstance(y, (int, float)) and not isinstance(y, bool) and math.isfinite(y):
            finitos.append(y)
    return finitos


def verificar_figura(nome, ident, fig):
    if not isinstance(fig, dict):
        R.falha(nome, ident, "`figura` tem de ser um objeto")
        return
    _chaves_desconhecidas(nome, ident, fig, CHAVES_FIGURA)
    if fig.get("tipo") != "grafico":
        R.falha(nome, ident, f"figura.tipo tem de ser \"grafico\" (está {fig.get('tipo')!r})")
    janelas = {}
    for eixo in ("x", "y"):
        v = fig.get(eixo)
        if not (isinstance(v, list) and len(v) == 2 and all(_eh_numero(n) for n in v) and v[0] < v[1]):
            R.falha(nome, ident, f"figura.{eixo} tem de ser [mínimo, máximo], dois números com mínimo < máximo")
        else:
            janelas[eixo] = v
    curvas = fig.get("curvas")
    if not isinstance(curvas, list) or not curvas:
        R.falha(nome, ident, "figura.curvas tem de ser uma lista com pelo menos uma curva { expr, rotulo }")
        curvas = []
    for c in curvas:
        if not isinstance(c, dict) or not isinstance(c.get("expr"), str) or not c["expr"].strip():
            R.falha(nome, ident, "cada curva precisa de `expr` (texto)")
            continue
        if "x" not in janelas:
            continue
        try:
            ys = _avaliar_curva(c["expr"], *janelas["x"])
        except ErroAutor as exc:
            R.falha(nome, ident, f"curva «{c['expr']}»: {exc}")
            continue
        if len(ys) < 5:
            R.falha(nome, ident, f"curva «{c['expr']}» só tem {len(ys)} valores finitos na janela x={janelas['x']} (precisa de pelo menos 5)")
        elif "y" in janelas and not any(janelas["y"][0] <= y <= janelas["y"][1] for y in ys):
            R.aviso(nome, ident, f"a curva «{c['expr']}» nunca entra na janela y={janelas['y']}")
    for p in fig.get("pontos", []) or []:
        if not isinstance(p, dict) or not _eh_numero(p.get("x")) or not _eh_numero(p.get("y")):
            R.falha(nome, ident, "cada ponto precisa de x e y numéricos")
    for campo in ("retasH", "retasV"):
        v = fig.get(campo, [])
        if not isinstance(v, list) or not all(_eh_numero(n) for n in v):
            R.falha(nome, ident, f"figura.{campo} tem de ser uma lista de números")


def verificar_vf(nome, stem, itens, ids, est):
    prefixo = PREFIXOS[stem]
    verd = sum(1 for a in itens if isinstance(a, dict) and a.get("verdadeira") is True)
    falsas = sum(1 for a in itens if isinstance(a, dict) and a.get("verdadeira") is False)
    if (len(itens), verd, falsas) != (6, 3, 3):
        R.aviso(nome, "-", f"{len(itens)} afirmações ({verd} verdadeiras, {falsas} falsas); esperadas 6 (3 V e 3 F)")
    corrida = 1
    for i in range(1, len(itens)):
        a, b = itens[i - 1], itens[i]
        if isinstance(a, dict) and isinstance(b, dict) and a.get("verdadeira") == b.get("verdadeira"):
            corrida += 1
            if corrida == 3:
                R.aviso(nome, b.get("id", "-"), "três afirmações seguidas com a mesma resposta (mistura a ordem)")
        else:
            corrida = 1
    for n, a in enumerate(itens, 1):
        ident = str(a.get("id")) if isinstance(a, dict) and a.get("id") else f"#{n}"
        est["total"] += 1
        if not isinstance(a, dict):
            R.falha(nome, ident, "a afirmação tem de ser um objeto")
            continue
        verificar_caracteres(nome, ident, a)
        _id_ok(nome, ident, a.get("id"), prefixo, prefixo + "-vf-", ids)
        if a.get("tema") != stem:
            R.falha(nome, ident, f"`tema` «{a.get('tema')}» não coincide com o nome do ficheiro ({stem})")
        for campo in ("texto", "explicacao"):
            if not isinstance(a.get(campo), str) or not a.get(campo).strip():
                R.falha(nome, ident, f"sem {campo}")
            else:
                verificar_texto(nome, ident, campo, a[campo])
        if not isinstance(a.get("verdadeira"), bool):
            R.falha(nome, ident, "`verdadeira` tem de ser true ou false (booleano)")
        elif a["verdadeira"] is False:
            if not (isinstance(a.get("erroComum"), str) and a["erroComum"].strip()):
                R.aviso(nome, ident, "afirmação falsa sem `erroComum`")
        elif "erroComum" in a:
            R.aviso(nome, ident, "`erroComum` só nas afirmações falsas")
        if isinstance(a.get("erroComum"), str):
            verificar_texto(nome, ident, "erroComum", a["erroComum"])
        _chaves_desconhecidas(nome, ident, a, CHAVES_VF)
        if "figura" in a:
            verificar_figura(nome, ident, a["figura"])
            _verificar_figura_vf(nome, ident, a)
        if _verifica_lista(nome, ident, a, est):
            est["verif"] += 1


# ====================================================================== matemática dos textos e das figuras
# Funções numéricas extra para o `verifica` (só acrescentam ao espaço de nomes).
def _raizes(f, a, b, n=20000):
    """Zeros de f em [a, b] por varrimento (mudança de sinal) e bisseção; ignora saltos (assíntotas)."""
    xs = [a + (b - a) * i / n for i in range(n + 1)]
    vals = []
    for x in xs:
        try:
            vals.append(float(f(x)))
        except ERROS_DOMINIO:
            vals.append(math.nan)
    achados = []
    for i in range(n):
        y0, y1 = vals[i], vals[i + 1]
        if y0 != y0 or y1 != y1:
            continue
        if y0 == 0.0:
            achados.append(xs[i])
        elif y0 * y1 < 0:
            lo, hi, flo = xs[i], xs[i + 1], y0
            for _ in range(90):
                m = (lo + hi) / 2
                try:
                    fm = float(f(m))
                except ERROS_DOMINIO:
                    break
                if (fm < 0) == (flo < 0):
                    lo, flo = m, fm
                else:
                    hi = m
            r = (lo + hi) / 2
            try:
                if abs(f(r)) < 1e-6:  # um salto (assíntota) não é um zero
                    achados.append(r)
            except ERROS_DOMINIO:
                pass
    if vals[-1] == 0.0:
        achados.append(xs[-1])
    achados.sort()
    unicos = []
    for r in achados:
        if not unicos or abs(r - unicos[-1]) > 1e-7:
            unicos.append(r)
    return unicos


def _varrer(f, a, b, n=20000):
    pts = []
    for i in range(n + 1):
        x = a + (b - a) * i / n
        try:
            y = float(f(x))
        except ERROS_DOMINIO:
            continue
        if math.isfinite(y):
            pts.append((x, y))
    if not pts:
        raise ValueError("a função não está definida em nenhum ponto de [a, b]")
    return pts


def _valmin(f, a, b):
    return min(y for _, y in _varrer(f, a, b))


def _valmax(f, a, b):
    return max(y for _, y in _varrer(f, a, b))


def _argmin(f, a, b):
    return min(_varrer(f, a, b), key=lambda p: p[1])[0]


def _argmax(f, a, b):
    return max(_varrer(f, a, b), key=lambda p: p[1])[0]


def _cresc(f, a, b, n=2000):
    ys = [y for _, y in _varrer(f, a, b, n)]
    return all(q >= p - 1e-12 for p, q in zip(ys, ys[1:]))


def _decresc(f, a, b, n=2000):
    ys = [y for _, y in _varrer(f, a, b, n)]
    return all(q <= p + 1e-12 for p, q in zip(ys, ys[1:]))


def _der2(f, x):
    """Segunda derivada numérica (diferença central de passo 1e-3)."""
    h = 1e-3
    return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h)


def _igl(xs, ys):
    """Duas listas de números iguais (a menos de 1e-6 relativo), pela mesma ordem."""
    return len(xs) == len(ys) and all(_ig(u, v) for u, v in zip(xs, ys))


EXTRAS_NUMERICOS = {"raizes": _raizes, "valmin": _valmin, "valmax": _valmax, "argmin": _argmin, "argmax": _argmax,
                    "cresc": _cresc, "decresc": _decresc, "der2": _der2, "igl": _igl}


# --------------------------------------------------------------- texto matemático simples (rótulos)
# Os rótulos das figuras são texto simples («y = e^(−x²)», «y = log_½ x», «(0, √e − 3)»). Lê-se com um
# pequeno analisador e dá uma expressão de Python, para confrontar com o que está realmente desenhado.
_SUBS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_SUPS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
_FRACOES = {"½": "(1/2)", "⅓": "(1/3)", "¼": "(1/4)", "¾": "(3/4)"}
_TOK_TXT = re.compile(
    r"\s*(?:(?P<num>\d+(?:,\d+)?)|(?P<nome>ln|log|exp|sqrt|abs|pi|[A-Za-z])|(?P<sub>_(?:\{[^}]*\}|[0-9½⅓¼¾]+)|[₀-₉]+)"
    r"|(?P<sup>[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)|(?P<frac>[½⅓¼¾])|(?P<raiz>√)|(?P<op>[-+*/^()]))")


class _ErroTexto(Exception):
    pass


def _tokens_texto(s):
    s = s.strip().replace("−", "-").replace("×", "*").replace("·", "*")
    toks, pos = [], 0
    while pos < len(s):
        m = _TOK_TXT.match(s, pos)
        if not m or m.end() == pos:
            if s[pos:].strip() == "":
                break
            raise _ErroTexto(f"símbolo desconhecido em «{s[pos:pos + 8]}»")
        pos = m.end()
        k = m.lastgroup
        toks.append((k, m.group(k)))
    return toks


class _AnalisadorTexto:
    def __init__(self, s):
        self.t = _tokens_texto(s)
        self.i = 0

    def ver(self, k=0):
        j = self.i + k
        return self.t[j] if j < len(self.t) else (None, None)

    def tirar(self):
        if self.i >= len(self.t):
            raise _ErroTexto("fim inesperado")
        tok = self.t[self.i]
        self.i += 1
        return tok

    def expressao(self):
        a = self.termo()
        while self.ver() in (("op", "+"), ("op", "-")):
            op = self.tirar()[1]
            a = f"({a}){op}({self.termo()})"
        return a

    def termo(self):
        a = self.unario()
        while True:
            k, v = self.ver()
            if (k, v) in (("op", "*"), ("op", "/")):
                self.tirar()
                a = f"({a}){v}({self.unario()})"
            elif k in ("num", "nome", "frac", "raiz") or (k, v) == ("op", "("):
                a = f"({a})*({self.unario()})"  # multiplicação implícita
            else:
                return a

    def unario(self):
        if self.ver() == ("op", "-"):
            self.tirar()
            return f"(-({self.unario()}))"
        if self.ver() == ("op", "+"):
            self.tirar()
            return self.unario()
        return self.potencia()

    def potencia(self):
        base = self.primario()
        while self.ver()[0] == "sup":
            base = f"({base})**({self.tirar()[1].translate(_SUPS)})"
        if self.ver() == ("op", "^"):
            self.tirar()
            if self.ver() == ("op", "("):
                self.tirar()
                e = self.expressao()
                if self.tirar() != ("op", ")"):
                    raise _ErroTexto("falta )")
            elif self.ver() == ("op", "-"):
                self.tirar()
                e = f"-({self.primario()})"
            else:
                e = self.primario()
                while self.ver()[0] == "sup":
                    e = f"({e})**({self.tirar()[1].translate(_SUPS)})"
            base = f"({base})**({e})"
        return base

    def primario(self):
        k, v = self.tirar()
        if k == "num":
            return v.replace(",", ".")
        if k == "frac":
            return _FRACOES[v]
        if k == "raiz":
            return f"sqrt({self.potencia_de_argumento()})"
        if (k, v) == ("op", "("):
            e = self.expressao()
            if self.tirar() != ("op", ")"):
                raise _ErroTexto("falta )")
            return f"({e})"
        if k == "nome":
            if v in ("x", "e", "pi"):
                return v
            if v in ("ln", "exp", "sqrt", "abs"):
                return f"{v}({self.potencia_de_argumento()})"
            if v == "log":
                if self.ver()[0] == "sub":
                    sub = self.tirar()[1]
                    base = sub[1:].strip("{}") if sub.startswith("_") else sub.translate(_SUBS)
                    base = "".join(_FRACOES.get(c, c) for c in base)
                    return f"logb({base}, {self.potencia_de_argumento()})"
                return f"log({self.potencia_de_argumento()})"
        raise _ErroTexto(f"não sei ler «{v}»")

    def potencia_de_argumento(self):
        """O argumento de ln, log, √...: um primário com os seus expoentes (ln x² é ln(x²))."""
        return self.potencia()


def _texto_para_py(s):
    """Texto simples (sem «y =») -> expressão de Python em x, ou levanta _ErroTexto."""
    p = _AnalisadorTexto(s)
    e = p.expressao()
    if p.i != len(p.t):
        raise _ErroTexto(f"sobra «{p.t[p.i][1]}»")
    return e


def _rotulo_funcao(rotulo):
    """«y = 2x + 1» -> código de Python em x; None se o rótulo não é da forma «y = ...»."""
    if not isinstance(rotulo, str):
        return None
    m = re.match(r"^\s*(?:y|[fgh]\(x\))\s*=\s*(.+)$", rotulo.strip())
    if not m:
        return None
    try:
        return _texto_para_py(m.group(1))
    except _ErroTexto:
        return None


# ------------------------------------------------------------------ leitor de LaTeX (reaproveita o de verificar_equacoes)
_VEQ = None
_LEITOR = None


def _veq():
    global _VEQ
    if _VEQ is None:
        spec = importlib.util.spec_from_file_location("_verificar_equacoes_log", RAIZ / "tools" / "verificar_equacoes.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _VEQ = mod
    return _VEQ


def _leitor():
    """O leitor de LaTeX de verificar_equacoes, alargado ao que aparece nos passos dos exercícios."""
    global _LEITOR
    if _LEITOR is not None:
        return _LEITOR
    V = _veq()

    class LeitorEx(V.Leitor):
        def primario(self):
            k, v = self.espreitar()
            if k == "c" and v in ("\\frac", "\\tfrac", "\\dfrac") and self.espreitar(1)[0] in ("n", "i"):
                # \frac32 quer dizer 3/2 (o TeX lê um símbolo por argumento)
                self.seguinte()
                k1, v1 = self.seguinte()
                if k1 == "n" and len(v1) == 2 and v1.isdigit():
                    return ("bin", "/", ("num", float(v1[0]), None), ("num", float(v1[1]), None))
                a = ("num", float(v1.replace("{,}", ".")), None) if k1 == "n" else ("var", v1)
                k2, v2 = self.seguinte()
                b = ("num", float(v2.replace("{,}", ".")), None) if k2 == "n" else ("var", v2)
                return ("bin", "/", a, b)
            if k == "i" and v in "fghkT" and self.espreitar(1) == ("o", "("):
                raise V.ErroTex("chamada de função (f(x), T(t)...) não se lê aqui")
            return super().primario()

        def argumento(self):
            # \ln x^{2} e \ln e^{p} querem dizer ln(x²) e ln(eᵖ)
            a = self.primario()
            if self.espreitar() == ("o", "^"):
                self.seguinte()
                a = ("pow", a, self.simbolo_ou_grupo())
            return a

        def cadeia(self):
            exprs, rels = [self.expr()], []
            while self.espreitar() in V.RELACOES:
                rels.append(V.NOME_REL[self.seguinte()[1]])
                e = self.expr()
                if rels[-1] == "~" and e[0] == "neg" and e[1][0] == "num":
                    e = ("num", -e[1][1], e[1][2])  # «\approx-1{,}35»
                if rels[-1] == "~" and e[0] == "num" and e[2] is None and float(e[1]).is_integer():
                    e = ("num", e[1], 0)  # «\approx35»: arredonda às unidades
                exprs.append(e)
            if not rels:
                raise V.ErroTex(f"falta uma relação em {self.s!r}")
            for r, e in zip(rels, exprs[1:]):
                if r == "~" and (e[0] != "num" or e[2] is None):
                    raise V.ErroTex("depois de «\\approx» tem de vir um decimal escrito")
            return ("cad", exprs, rels)

    _LEITOR = LeitorEx
    return _LEITOR


def _ler_tex(tex):
    return _leitor()(tex).formula()


def _ler_expr_tex(tex):
    r = _leitor()(tex)
    e = r.expr()
    r.fim()
    return e


REL_INICIO = re.compile(r"^(=|\\Leftrightarrow|\\Rightarrow|\\approx|<|>|\\leq|\\geq|\\neq|\\lor|\\vee|\\land)")


def _linhas_do_bloco(math):
    """Um bloco $$...$$ ou $...$ em fórmulas: as linhas de um aligned que continuam a anterior (começam por uma
    relação) juntam-se a ela; as outras são fórmulas à parte."""
    m = re.sub(r"\\begin\{aligned\}|\\end\{aligned\}", "", math.strip())
    linhas = []
    for r in re.split(r"\\\\(?:\[[^\]]*\])?", m):
        r = r.replace("&", "").strip()
        if not r:
            continue
        r2 = re.sub(r"^(\\;|\\,|\\ |\\quad)+", "", r)
        if linhas and (REL_INICIO.match(r2) or re.match(r"^\\q?quad\b", r)):  # «\quad+...» continua a expressão
            linhas[-1] += " " + r2
        else:
            linhas.append(r)
    return linhas


def _limpar_linha(l):
    l = re.sub(r"\\text\{\s*ou\s*\}", r"\\lor", l.strip())
    l = l.replace("\\vee", "\\lor").replace("\\wedge", "\\land").replace("\\checkmark", "")
    l = re.sub(r"^\\Delta\s*=\s*", "", l.strip())  # «\Delta=b^2-4ac=...»: confere-se a conta
    l = re.sub(r"\\(bigl|bigr|big|Bigl|Bigr|Big)(?![a-zA-Z])\s*", "", l)
    l = l.replace("\\lt", "<").replace("\\gt", ">")
    return re.sub(r"[.,;]\s*$", "", l.strip()).strip()


def _amostras_de(nomes, n=700):
    """Valores das variáveis: uma grelha fina de -8 a 8 se for uma só, pares aleatórios (sempre os mesmos) se forem várias."""
    nomes = sorted(nomes)
    if len(nomes) == 1:
        return [{nomes[0]: -8 + 16 * i / n} for i in range(n + 1)]
    rnd = random.Random(zlib.crc32("|".join(nomes).encode("utf-8")))
    grande = [i / 8 for i in range(-64, 65)]
    return [{v: rnd.choice(grande) for v in nomes} for _ in range(n)]


_PREFIXO_FUNCAO = re.compile(r"^([A-Za-z])('*)(\^\{-1\})?\(([^()]*)\)\s*=\s*(.+)$")


def _derivada_de(f, ordem, x):
    """Derivada numérica de ordem 0, 1 ou 2 de f (x -> número ou None) em x; None fora do domínio."""
    try:
        if ordem == 0:
            return f(x)
        if ordem == 1:
            return _der(f, x)
        h = 0.01  # segunda derivada: diferenças centrais de 5 pontos
        v = [f(x + k * h) for k in (-2, -1, 0, 1, 2)]
        return (-v[4] + 16 * v[3] - 30 * v[2] + 16 * v[1] - v[0]) / (12 * h * h)
    except (TypeError, ZeroDivisionError, ValueError, OverflowError):
        return None


def _conferir_linha_de_funcao(tex, funcs):
    """Linhas como «f'(x)=1\times e^{2x}+...=(2x+3)e^{2x}» ou «f^{-1}(-3)=e^{...}-3=e^{2}-3»: cada expressão da
    cadeia (até ao primeiro «\approx») tem de ser a função, a derivada (f', f'') ou a inversa de `funcoes` no
    ponto. Devolve None se a linha não é deste tipo."""
    m = _PREFIXO_FUNCAO.match(tex)
    if not m or not funcs:
        return None
    nome_f, primas, inversa, arg, resto = m.groups()
    chave = nome_f + ("\u207b\u00b9" if inversa else "")
    if chave not in funcs or len(primas) > 2 or (inversa and primas):
        return None
    if re.search(r"\\(Leftrightarrow|Rightarrow|lor|land|text|mathrm)|<|>", resto):
        return None
    V = _veq()
    try:
        try:
            cad = _ler_tex(resto)[1][0]
            exprs, rels = cad[1], cad[2]
        except V.ErroTex as exc:
            if "falta uma relação" not in str(exc):
                return "ignorada", str(exc)
            exprs, rels = [_ler_expr_tex(resto)], []
    except (V.ErroTex, ValueError, IndexError, TypeError) as exc:
        return "ignorada", f"{type(exc).__name__}: {exc}"
    variavel = arg.strip() if arg.strip() in ("x", "t") else None
    if variavel and not V.variaveis(exprs[0]):
        return "ignorada", "equação (f(x) = número): resolve-se, não se confere sozinha"
    if variavel is None:
        try:
            pontos = [V.ev(_ler_expr_tex(arg), {})]
        except (V.ErroTex, ValueError, IndexError, TypeError):
            return "ignorada", "argumento que não se lê"
    else:
        pontos = [-3 + 8 * i / 400 for i in range(401)]
    if V.variaveis(("cad", exprs, [])) - ({variavel} if variavel else set()):
        return "ignorada", "outras variáveis na cadeia"
    exatas = [exprs[0]]
    for i, rel in enumerate(rels):
        if rel != "=":
            break
        exatas.append(exprs[i + 1])
    comparados = 0
    for s_ in pontos:
        env = {variavel: s_} if variavel else {}
        if inversa:
            # f^{-1}(s) é o x tal que f(x) = s: a função declarada para a inversa está em funcs[chave]
            alvo = funcs[chave](s_)
        else:
            alvo = _derivada_de(funcs[chave], len(primas), s_)
        if alvo is None or not math.isfinite(alvo):
            continue
        for e in exatas:
            try:
                v = V.ev(e, env)
            except (V.ErroTex, ZeroDivisionError, OverflowError, ValueError):
                continue
            if v != v:
                continue
            comparados += 1
            if not math.isclose(v, alvo, rel_tol=1e-6, abs_tol=1e-6):
                return "falha", (f"em «{tex}», com {variavel or arg}={s_:.6g}, uma expressão vale {v:.8g} mas "
                                 f"{nome_f}{primas}{'^{-1}' if inversa else ''}({arg}) vale {alvo:.8g}")
    if comparados < (1 if variavel is None else 25):
        return "ignorada", "quase sem pontos em que esteja definida"
    # os passos seguintes da cadeia (as aproximações) conferem-se à parte, como qualquer cadeia
    estado, msg = _conferir_linha(resto, funcs=None)
    if estado == "falha":
        return "falha", msg
    return "ok", ""


def _conferir_linha(tex, funcs=None):
    """Confere uma linha de LaTeX de um passo. Devolve (estado, mensagem): estado «ok» | «ignorada» | «falha»."""
    V = _veq()
    de_funcao = _conferir_linha_de_funcao(tex, funcs)
    if de_funcao is not None:
        return de_funcao
    try:
        f = _ler_tex(tex)
    except V.ErroTex as exc:
        return "ignorada", str(exc)
    except (ValueError, IndexError, TypeError) as exc:
        return "ignorada", f"{type(exc).__name__}: {exc}"
    nomes = V.variaveis(f)
    if nomes & NOMES_DE_FUNCOES_E_PONTOS:
        return "ignorada", "f, g, T, P... são nomes de funções ou pontos, não variáveis"
    partes, ops = f[1], f[2]

    def verdadeira(parte, env):
        try:
            return V.verdade(parte, env)
        except (V.ErroTex, ZeroDivisionError, OverflowError, ValueError):
            return None

    if not nomes:  # uma afirmação só com números: tem de ser verdadeira
        ts = [verdadeira(p, {}) for p in partes]
        if any(t is None for t in ts):
            return "ignorada", "fora do domínio"
        if not ops:
            return ("ok", "") if ts[0] else ("falha", f"a afirmação «{tex}» é falsa")
        for i, op in enumerate(ops):
            if op == "\\Leftrightarrow" and ts[i] != ts[i + 1]:
                return "falha", f"equivalência falsa em «{tex}» (um lado é {ts[i]} e o outro {ts[i + 1]})"
            if op == "\\Rightarrow" and ts[i] and not ts[i + 1]:
                return "falha", f"implicação falsa em «{tex}»"
        return "ok", ""

    amostras = _amostras_de(nomes)
    if ops:  # equivalências e implicações: a mesma verdade em todos os pontos (e nos zeros de cada igualdade)
        if len(nomes) == 1:
            (var,) = nomes
            extra = []
            for esq, dir_ in V.igualdades(f):
                extra += V.raizes(lambda x, esq=esq, dir_=dir_: V.ev(esq, {var: x}) - V.ev(dir_, {var: x}), -8, 8, 4001)
            amostras = amostras + [{var: x} for x in extra]
        definidos = 0
        for env in amostras:
            ts = [verdadeira(p, env) for p in partes]
            if any(t is None for t in ts):
                continue
            definidos += 1
            for i, op in enumerate(ops):
                if op == "\\Leftrightarrow" and ts[i] != ts[i + 1]:
                    return "falha", f"equivalência falsa em «{tex}» com {env}: um lado é {ts[i]} e o outro {ts[i + 1]}"
                if op == "\\Rightarrow" and ts[i] and not ts[i + 1]:
                    return "falha", f"implicação falsa em «{tex}» com {env}"
        if definidos < 25:
            return "ignorada", f"quase sem pontos em que esteja definida ({definidos})"
        return "ok", ""

    p = partes[0]
    if p[0] != "cad":
        return "ignorada", "conjunção ou disjunção de relações (não se confere sozinha)"
    exprs, rels = p[1], p[2]
    verificadas = 0
    for i, rel in enumerate(rels):
        a, b = exprs[i], exprs[i + 1]
        if rel not in ("=", "~"):
            continue
        if a[0] == "var" or b[0] == "var":
            continue  # «x = e^{1/2} - 3»: uma solução ou uma definição, não uma identidade
        va, vb = V.variaveis(a), V.variaveis(b)
        if bool(va) != bool(vb):
            continue  # «3^{x} = 6»: uma equação (um lado com x, o outro só números), não uma identidade
        par = ("cad", [a, b], [rel])
        definidos, falsos, exemplo = 0, 0, None
        for env in amostras:
            t = verdadeira(par, env)
            if t is None:
                continue
            definidos += 1
            if not t:
                falsos += 1
                exemplo = exemplo or env
        if definidos < 25:
            continue
        if not falsos:
            verificadas += 1  # é uma identidade, e confirma-se
        elif not va and not vb:
            return "falha", f"«{tex}» é falsa: os dois lados do {i + 1}.º sinal são números diferentes"
        elif len(rels) >= 2:
            return "falha", f"a cadeia «{tex}» tem um passo falso com {exemplo}: os dois lados do {i + 1}.º sinal diferem"
        # uma só relação que não vale em todos os pontos é uma equação (ou uma definição): não se confere sozinha
    if verificadas:
        return "ok", ""
    return "ignorada", "equação, definição ou desigualdade (não se confere sozinha)"


NAO_LIDAS = []   # relações que o leitor de LaTeX não leu (para --verboso)
NOMES_DE_FUNCOES_E_PONTOS = {"f", "g", "h", "k", "T", "P", "S", "D"}
FORMULA_TEX = re.compile(r"\$\$([\s\S]+?)\$\$|\$([^$]+?)\$")


def _formulas_de(texto):
    for m in FORMULA_TEX.finditer(texto.replace("\\$", "")):
        f = m.group(1) or m.group(2)
        if m.group(2) and f.startswith("{") and f.endswith("}"):
            f = f[1:-1]  # ${y=-x+1}$: as chavetas só impedem o KaTeX de partir a fórmula em duas linhas
        yield f


def _decimais_do_texto(t):
    """Os números decimais escritos num texto (0{,}5 dentro de fórmulas, 0,5 fora), com ponto: {'0.5', ...}."""
    achados = set()
    for m in FORMULA_TEX.finditer(t):
        for d in re.findall(r"\d+\{,\}\d+", m.group(0)):
            achados.add(d.replace("{,}", "."))
    fora = FORMULA_TEX.sub(" ", t)
    for d in re.findall(r"(?<![\d.,])\d+,\d+(?!\d)", fora):
        achados.add(d.replace(",", "."))
    return achados


def _numeros_do_codigo(afirmacoes):
    """Os números escritos nas afirmações `verifica` (como texto, por exemplo '10.6')."""
    achados = set()
    for a in afirmacoes:
        for d in re.findall(r"(?<![\w.])\d+\.\d+", a):
            achados.add(d)
            achados.add(str(float(d)).rstrip("0").rstrip("."))
    return achados


# ---------------------------------------------------------------- figuras: o que está desenhado é o que o texto diz
def _y_em(code, ns, x):
    """Valor de uma expressão compilada em x, ou None fora do domínio (ou se não for um real finito)."""
    ns["x"] = x
    try:
        y = eval(code, ns)
    except (ValueError, ZeroDivisionError, OverflowError, TypeError):
        return None
    if isinstance(y, bool) or not isinstance(y, (int, float)) or not math.isfinite(y):
        return None
    return float(y)


def _codigo_site(expr, onde):
    """Expressão na sintaxe do site (^ para potências) -> código de Python compilado."""
    return _compilar(expr.replace("^", "**"), onde)


def _comparar_funcoes(f1, f2, x0, x1, de=None, ate=None, n=400):
    """f1, f2: x -> número ou None. Devolve (pontos comparados, primeira diferença ou None)."""
    usados, primeira = 0, None
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        if (de is not None and x < de - 1e-12) or (ate is not None and x > ate + 1e-12):
            continue
        a, b = f1(x), f2(x)
        if a is None and b is None:
            continue
        usados += 1
        if a is None or b is None or not math.isclose(a, b, rel_tol=1e-7, abs_tol=1e-7):
            return usados, (x, a, b)
    return usados, primeira


def _valor_do_texto(txt, ns):
    """Valor de um texto como «10,6», «−1», «ln 5», «e² − 3», «11/2» (None se não se lê) e o número de casas
    decimais se o texto for um decimal escrito por extenso."""
    txt = txt.strip()
    try:
        w = eval(compile(_texto_para_py(txt), "<rotulo>", "eval"), dict(ns))
    except (_ErroTexto, ValueError, ZeroDivisionError, SyntaxError, TypeError, NameError, OverflowError):
        return None, None
    if isinstance(w, bool) or not isinstance(w, (int, float)):
        return None, None
    m = re.fullmatch(r"[−-]?\d+,(\d+)", txt)
    return float(w), (len(m.group(1)) if m else None)


def _conferir_valor_do_rotulo(txt, v, ns, aprox=False):
    """Mensagem de erro se o texto do rótulo lê um número diferente de v; None se bate ou se não se lê."""
    w, casas = _valor_do_texto(txt, ns)
    if w is None:
        return None
    tol = 0.5 * 10 ** -casas + 1e-9 if casas is not None else 1e-4 * max(1.0, abs(w))
    if abs(w - v) > tol:
        return f"o rótulo diz «{txt.strip()}» (= {w:.6g}) mas o desenho está em {v:.6g}"
    return None


def _conferir_rotulo_do_ponto(rotulo, px, py, ns):
    r = rotulo.strip()
    m = re.search(r"\((.+)\)\s*$", r)
    if m:
        inner = m.group(1)
        partes = inner.split(";") if ";" in inner else inner.split(",", 1)
        if len(partes) == 2:
            return (_conferir_valor_do_rotulo(partes[0], px, ns) or _conferir_valor_do_rotulo(partes[1], py, ns))
        return None
    m = re.match(r"^\s*([xy])\s*(=|≈)\s*(.+)$", r)
    if m:
        return _conferir_valor_do_rotulo(m.group(3), px if m.group(1) == "x" else py, ns, aprox=m.group(2) == "≈")
    return None


def _funcoes_do_texto(texto):
    """Funções definidas em fórmulas como $f(x)=\\ln(x+3)$ ou $y=2^x$ (só as que dependem de x): [(nome, ast)]."""
    V = _veq()
    achadas = []
    for math_ in _formulas_de(texto):
        m = re.match(r"^\s*(y|[fgh]\(x\))\s*=\s*(.+?)\s*$", math_.strip().rstrip(".,;"))
        if not m:
            continue
        try:
            ast = _ler_expr_tex(_limpar_linha(m.group(2)))
        except (V.ErroTex, ValueError, IndexError, TypeError):
            continue
        if "x" in V.variaveis(ast):
            achadas.append((m.group(1), ast, m.group(2)))
    return achadas


def _ast_como_funcao(ast):
    V = _veq()

    def f(x):
        try:
            y = V.ev(ast, {"x": x})
        except (V.ErroTex, ZeroDivisionError, OverflowError, ValueError):
            return None
        return y if isinstance(y, float) and math.isfinite(y) else None
    return f


def _verificar_figura_semantica(nome, ident, fig, est, funcoes=None, enunciado_tex=None):
    """A semântica de uma figura: cada curva é a função que o rótulo (e `funcoes`, nos exercícios, e o enunciado, nos
    V/F) diz; cada ponto está numa curva ou numa reta e o seu rótulo diz as suas coordenadas; as retas dos exercícios
    são as do rótulo e a reta que passa num ponto da curva é a tangente."""
    if not isinstance(fig, dict) or not isinstance(fig.get("curvas"), list):
        return
    if not all(isinstance(fig.get(k), list) and len(fig[k]) == 2 and all(_eh_numero(v) for v in fig[k]) for k in ("x", "y")):
        return
    ns = _espaco()
    (x0, x1), (y0, y1) = fig["x"], fig["y"]
    exercicio = funcoes is not None
    curvas = []
    for c in fig["curvas"]:
        if not isinstance(c, dict) or not isinstance(c.get("expr"), str):
            continue
        try:
            code = _codigo_site(c["expr"], "curva")
        except ErroAutor as exc:
            R.falha(nome, ident, str(exc))
            continue
        de = c.get("de") if _eh_numero(c.get("de")) else None
        ate = c.get("ate") if _eh_numero(c.get("ate")) else None
        funcao = (lambda x, code=code: _y_em(code, ns, x))
        curvas.append({"c": c, "f": funcao, "de": de, "ate": ate})
        est["curvas"] += 1
        rotulo = c.get("rotulo") if isinstance(c.get("rotulo"), str) else ""
        # 1. a função declarada em `funcoes` (exercícios) e a do rótulo escrito na figura
        esperadas = []
        if exercicio:
            chave = rotulo if rotulo in funcoes else c["expr"] if c["expr"] in funcoes else None
            if chave is None:
                if not _rotulo_funcao(rotulo):
                    R.falha(nome, ident, f"a curva «{rotulo or c['expr']}» não tem função em `funcoes` para confrontar com o que está desenhado")
            else:
                try:
                    esperadas.append((f"funcoes[{chave!r}]", _compilar(funcoes[chave], "funcoes")))
                except ErroAutor as exc:
                    R.falha(nome, ident, str(exc))
        cod_rot = _rotulo_funcao(rotulo)
        if cod_rot is not None:
            try:
                esperadas.append((f"o rótulo «{rotulo}»", compile(cod_rot, "<rotulo>", "eval")))
            except SyntaxError:
                pass
        elif not exercicio and rotulo:
            R.aviso(nome, ident, f"o rótulo «{rotulo}» da curva não se lê como «y = ...» (não se confere com o desenho)")
        for origem, cod in esperadas:
            usados, dif = _comparar_funcoes(funcao, lambda x, cod=cod: _y_em(cod, ns, x), x0, x1, de, ate)
            if dif:
                R.falha(nome, ident, f"a curva desenhada «{c['expr']}» não é {origem}: em x={dif[0]:.4g} dá {dif[1]} e devia dar {dif[2]}")
            elif usados < 10:
                R.falha(nome, ident, f"a curva «{c['expr']}» e {origem} quase não se comparam (só {usados} pontos definidos na janela)")
            else:
                est["curvas_conferidas"] += 1
    # 2. as funções que o enunciado define têm de estar desenhadas (V/F)
    if enunciado_tex:
        for texto, grave in enunciado_tex:
            for nome_f, ast, tex in _funcoes_do_texto(texto):
                fa = _ast_como_funcao(ast)

                def igual(k, fa=fa):
                    usados, dif = _comparar_funcoes(k["f"], fa, x0, x1, k["de"], k["ate"])
                    return usados >= 10 and dif is None
                if not any(igual(k) for k in curvas):
                    msg = f"o texto define {nome_f}={tex} mas nenhuma curva da figura é essa função"
                    if grave:
                        R.falha(nome, ident, msg)
                    else:
                        R.aviso(nome, ident, msg)
    # 3. pontos
    retasH = [r if _eh_numero(r) else r.get("y") for r in fig.get("retasH", []) or [] if _eh_numero(r) or isinstance(r, dict)]
    retasV = [r if _eh_numero(r) else r.get("x") for r in fig.get("retasV", []) or [] if _eh_numero(r) or isinstance(r, dict)]
    retas = [r for r in fig.get("retas", []) or [] if isinstance(r, dict) and _eh_numero(r.get("declive")) and _eh_numero(r.get("ordenada"))]
    tol_y = 0.006 * (y1 - y0) + 1e-6
    tol_x = 0.006 * (x1 - x0) + 1e-6
    sobre_curva = []
    for p in fig.get("pontos", []) or []:
        if not isinstance(p, dict) or not _eh_numero(p.get("x")) or not _eh_numero(p.get("y")):
            continue
        px, py = p["x"], p["y"]
        est["pontos"] += 1
        rot = p.get("rotulo") if isinstance(p.get("rotulo"), str) else ""
        etiqueta = f"o ponto ({px:.6g}; {py:.6g})" + (f" «{rot}»" if rot else "")
        if not (x0 - 1e-9 <= px <= x1 + 1e-9 and y0 - 1e-9 <= py <= y1 + 1e-9):
            R.falha(nome, ident, f"{etiqueta} está fora da janela da figura")
        em = [k for k in curvas if (k["de"] is None or px >= k["de"] - 1e-9) and (k["ate"] is None or px <= k["ate"] + 1e-9)
              and (lambda v: v is not None and abs(v - py) <= tol_y)(k["f"](px))]
        nas_retas = (any(abs(py - h) <= tol_y for h in retasH) or any(abs(px - v) <= tol_x for v in retasV)
                     or any(abs(r["declive"] * px + r["ordenada"] - py) <= tol_y for r in retas))
        if not em and not nas_retas:
            R.falha(nome, ident, f"{etiqueta} não está em nenhuma curva nem reta da figura")
        else:
            est["pontos_conferidos"] += 1
        if em:
            sobre_curva.append((px, py, em))
        if rot:
            msg = _conferir_rotulo_do_ponto(rot, px, py, ns)
            if msg:
                R.falha(nome, ident, f"{etiqueta}: {msg}")
    # 4. guias e retas (exercícios)
    for lista, eixo, valores in (("retasH", "y", retasH), ("retasV", "x", retasV)):
        for r, v in zip([r for r in fig.get(lista, []) or [] if _eh_numero(r) or isinstance(r, dict)], valores):
            if isinstance(r, dict) and isinstance(r.get("rotulo"), str):
                m = re.match(r"^\s*[A-Za-z]\s*(?:=|≈)\s*(.+)$", r["rotulo"])  # a letra é a do eixo («y», «T», «t»)
                if m and v is not None:
                    msg = _conferir_valor_do_rotulo(m.group(1), v, ns)
                    if msg:
                        R.falha(nome, ident, f"a guia {eixo} = {v:.6g}: {msg}")
    for r in retas:
        est["retas"] += 1
        cod = _rotulo_funcao(r.get("rotulo"))
        if cod is not None:
            f = lambda x, cod=cod: _y_em(compile(cod, "<rotulo>", "eval"), ns, x)
            b, m = f(0.0), None
            if b is not None and f(1.0) is not None:
                m = f(1.0) - b
            if b is None or m is None or abs(b - r["ordenada"]) > 1e-3 or abs(m - r["declive"]) > 1e-3:
                R.falha(nome, ident, f"a reta «{r['rotulo']}» tem declive {r['declive']} e ordenada {r['ordenada']} nos dados")
        # uma reta que passa num ponto marcado de uma curva é a tangente nesse ponto (e uma reta de cor `tg` ou chamada
        # «t» ou «tangente» tem de ser a tangente a alguma curva num ponto marcado)
        nome_da_reta = (r.get("rotulo") or "").strip().lower() if isinstance(r.get("rotulo"), str) else ""
        diz_tangente = r.get("cor") == "tg" or nome_da_reta == "t" or nome_da_reta.startswith("tangente")
        e_tangente = False
        for px, py, em in sobre_curva:
            if abs(r["declive"] * px + r["ordenada"] - py) <= tol_y:
                for k in em:
                    try:
                        d = _der(lambda s, k=k: k["f"](s), px)
                    except (TypeError, ZeroDivisionError, ValueError):
                        continue
                    if not math.isclose(d, r["declive"], rel_tol=2e-3, abs_tol=2e-3):
                        R.falha(nome, ident, f"a reta de declive {r['declive']} passa em ({px:.6g}; {py:.6g}) mas a tangente à curva «{k['c'].get('rotulo') or k['c']['expr']}» aí tem declive {d:.5g}")
                    else:
                        est["tangentes"] += 1
                        e_tangente = True
        if diz_tangente and not e_tangente:
            R.falha(nome, ident, f"a reta de declive {r['declive']} e ordenada {r['ordenada']} está marcada como tangente mas não é tangente a nenhuma curva num ponto marcado da figura")


# ================================================================ exercícios (dados/exercicios.json)
CHAVES_EXERCICIO = {"id", "titulo", "tema", "nivel", "enunciado", "alineas", "passos", "resposta", "dica", "erroComum", "verifica", "funcoes",
                    "solucao", "intervalo"}
CHAVES_ALINEA = {"id", "enunciado", "passos", "resposta", "dica", "erroComum", "verifica", "funcoes", "solucao", "intervalo"}
CHAVES_PASSO = {"titulo", "texto", "figura"}
CHAVES_FIGURA_EX = {"tipo", "x", "y", "curvas", "retas", "retasV", "retasH", "pontos", "area", "legenda", "rotuloX", "rotuloY", "marcasX", "marcasY"}


def _estatisticas_figuras():
    return {"curvas": 0, "curvas_conferidas": 0, "pontos": 0, "pontos_conferidos": 0, "retas": 0, "tangentes": 0}


def _estatisticas_exercicios():
    return {"exercicios": 0, "unidades": 0, "passos": 0, "afirmacoes": 0, "linhas": 0, "linhas_ignoradas": 0,
            "decimais": 0, "figuras": 0, **_estatisticas_figuras()}


def _verificar_figura_exercicio(nome, ident, fig, funcoes, est):
    if not isinstance(fig, dict):
        R.falha(nome, ident, "`figura` tem de ser um objeto")
        return
    est["figuras"] += 1
    _chaves_desconhecidas(nome, ident, fig, CHAVES_FIGURA_EX)
    if fig.get("tipo") != "grafico":
        R.falha(nome, ident, f"figura.tipo tem de ser \"grafico\" (está {fig.get('tipo')!r})")
    for eixo in ("x", "y"):
        v = fig.get(eixo)
        if not (isinstance(v, list) and len(v) == 2 and all(_eh_numero(n) for n in v) and v[0] < v[1]):
            R.falha(nome, ident, f"figura.{eixo} tem de ser [mínimo, máximo], dois números com mínimo < máximo")
            return
    if not isinstance(fig.get("legenda"), str) or len(fig["legenda"].strip()) < 10:
        R.falha(nome, ident, "a figura precisa de `legenda` (descrição para leitores de ecrã)")
    else:
        verificar_texto(nome, ident, "figura.legenda", fig["legenda"], opcoes=False)
    if not isinstance(fig.get("curvas"), list) or not fig["curvas"]:
        R.falha(nome, ident, "figura.curvas tem de ter pelo menos uma curva")
        return
    for c in fig["curvas"]:
        if not isinstance(c, dict) or not isinstance(c.get("expr"), str) or not c["expr"].strip():
            R.falha(nome, ident, "cada curva precisa de `expr` (texto)")
            return
        try:
            ys = _avaliar_curva(c["expr"], *fig["x"])
        except ErroAutor as exc:
            R.falha(nome, ident, f"curva «{c['expr']}»: {exc}")
            return
        if len(ys) < 5:
            R.falha(nome, ident, f"curva «{c['expr']}» só tem {len(ys)} valores finitos na janela")
    _verificar_figura_semantica(nome, ident, fig, est, funcoes=funcoes)


def _textos_da_unidade(u):
    """(campo, texto) de tudo o que a aluna lê numa unidade."""
    for i, p in enumerate(u.get("passos", [])):
        if isinstance(p, dict):
            yield f"passo {i + 1}.titulo", p.get("titulo")
            yield f"passo {i + 1}.texto", p.get("texto")
    yield "resposta", u.get("resposta")
    for campo in ("enunciado", "dica", "erroComum"):
        if campo in u:
            yield campo, u.get(campo)


def _extremo_tex(txt):
    """Extremo de um intervalo escrito em LaTeX: número, ou ±inf."""
    t = txt.replace("{-}", "-").replace("\\,", "").replace("\\;", "").strip()
    if "infty" in t:
        return -math.inf if t.startswith("-") else math.inf
    return _veq().ev(_ler_expr_tex(t), {})


def _conferir_resposta(nome, uid, u):
    """`solucao` (lista de números calculada à parte) tem de ser o conjunto S={...} escrito na resposta e `intervalo`
    ([a, b], com inf) o intervalo escrito: o que a aluna lê é o que o cálculo deu."""
    V = _veq()
    resposta = u.get("resposta") if isinstance(u.get("resposta"), str) else ""
    for campo in ("solucao", "intervalo"):
        if campo not in u:
            continue
        try:
            valor = _avaliar(_compilar(u[campo], campo), _espaco(), u[campo])
        except (ErroAutor, ValueError, ZeroDivisionError, OverflowError, IndexError) as exc:
            R.falha(nome, uid, f"`{campo}`: {exc}")
            continue
        if campo == "solucao":
            m = re.search(r"(?:\\left)?\\\{(.*?)(?:\\right)?\\\}", resposta)
            if not m:
                R.falha(nome, uid, "há `solucao` mas a resposta não tem um conjunto {...}")
                continue
            try:
                escritos = sorted(V.ev(_ler_expr_tex(e), {}) for e in V.separar_virgulas(m.group(1)))
            except (V.ErroTex, ValueError, IndexError, TypeError) as exc:
                R.falha(nome, uid, f"não li o conjunto da resposta: {exc}")
                continue
            calculados = sorted(float(v) for v in valor)
            if len(escritos) != len(calculados) or any(not math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-6) for a, b in zip(escritos, calculados)):
                R.falha(nome, uid, f"a resposta escreve o conjunto {escritos} mas o cálculo dá {calculados}")
        else:
            limpo = resposta.replace("\\left", "").replace("\\right", "")
            m = re.search(r"[\]\[]([^\[\],]+),([^\[\],]+)[\]\[]", limpo)
            if not m:
                R.falha(nome, uid, "há `intervalo` mas a resposta não tem um intervalo ]a,b[")
                continue
            try:
                a, b = _extremo_tex(m.group(1)), _extremo_tex(m.group(2))
            except (V.ErroTex, ValueError, IndexError, TypeError) as exc:
                R.falha(nome, uid, f"não li o intervalo da resposta: {exc}")
                continue
            ca, cb = float(valor[0]), float(valor[1])
            if not all((x == y) if math.isinf(x) or math.isinf(y) else math.isclose(x, y, rel_tol=1e-6, abs_tol=1e-6) for x, y in ((a, ca), (b, cb))):
                R.falha(nome, uid, f"a resposta escreve o intervalo de {a} a {b} mas o cálculo dá de {ca} a {cb}")


def verificar_exercicios(nome, dados, ids, est):
    exs = dados.get("exercicios") if isinstance(dados, dict) else None
    if not isinstance(exs, list) or not exs:
        R.falha(nome, "-", "falta a lista `exercicios`")
        return
    _chaves_desconhecidas(nome, "-", dados, {"exercicios"})
    for n, e in enumerate(exs, 1):
        ident = str(e.get("id")) if isinstance(e, dict) and e.get("id") else f"#{n}"
        if not isinstance(e, dict):
            R.falha(nome, ident, "o exercício tem de ser um objeto")
            continue
        est["exercicios"] += 1
        verificar_caracteres(nome, ident, e)
        _chaves_desconhecidas(nome, ident, e, CHAVES_EXERCICIO)
        if not isinstance(e.get("id"), str) or not re.fullmatch(r"ex-\d\d", e["id"]):
            R.falha(nome, ident, "o id tem de ser ex-NN")
        elif e["id"] in ids:
            R.falha(nome, ident, f"id repetido (também em {ids[e['id']]})")
        else:
            ids[e["id"]] = nome
        if e.get("tema") not in PREFIXOS:
            R.falha(nome, ident, f"`tema` «{e.get('tema')}» não é um dos grupos ({', '.join(PREFIXOS)})")
        if isinstance(e.get("nivel"), bool) or e.get("nivel") not in (1, 2, 3):
            R.falha(nome, ident, "`nivel` tem de ser 1, 2 ou 3")
        if not isinstance(e.get("titulo"), str) or not e["titulo"].strip():
            R.falha(nome, ident, "sem `titulo`")
        else:
            verificar_texto(nome, ident, "titulo", e["titulo"], opcoes=False)
        for campo in ("enunciado", "dica", "erroComum"):
            if campo in e:
                if not isinstance(e[campo], str) or (campo != "enunciado" and not e[campo].strip()):
                    R.falha(nome, ident, f"`{campo}` tem de ser texto")
                else:
                    verificar_texto(nome, ident, campo, e[campo], opcoes=False)
        unidades = []
        if "alineas" in e:
            if not isinstance(e["alineas"], list) or not e["alineas"]:
                R.falha(nome, ident, "`alineas` tem de ser uma lista não vazia")
            else:
                vistos = set()
                for k, a in enumerate(e["alineas"]):
                    if not isinstance(a, dict) or not isinstance(a.get("id"), str):
                        R.falha(nome, ident, f"a alínea #{k + 1} precisa de `id` (a, b, c...)")
                        continue
                    if a["id"] in vistos:
                        R.falha(nome, ident, f"alínea {a['id']} repetida")
                    vistos.add(a["id"])
                    if a["id"] != chr(97 + k):
                        R.aviso(nome, ident, f"a alínea n.º {k + 1} chama-se «{a['id']}» (esperava «{chr(97 + k)}»)")
                    _chaves_desconhecidas(nome, f"{ident}/{a['id']}", a, CHAVES_ALINEA)
                    unidades.append((f"{ident}/{a['id']}", a))
            if "passos" in e or "resposta" in e:
                R.aviso(nome, ident, "o exercício tem alíneas: `passos` e `resposta` do exercício não se usam")
        else:
            unidades.append((ident, e))
        funcoes_ex = e.get("funcoes", {})
        if not isinstance(funcoes_ex, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in funcoes_ex.items()):
            R.falha(nome, ident, "`funcoes` tem de ser um objeto { rótulo da curva: expressão em x (Python) }")
            funcoes_ex = {}
        verifica_ex = e.get("verifica") if isinstance(e.get("verifica"), list) else []
        todas = list(verifica_ex)
        for _, u in unidades:
            if u is not e and isinstance(u.get("verifica"), list):
                todas += u["verifica"]
        numeros = _numeros_do_codigo(todas)
        if verifica_ex or "verifica" in e:
            _verifica_lista(nome, ident, e, est)
        for uid, u in unidades:
            est["unidades"] += 1
            if u is not e:
                verificar_caracteres(nome, uid, u)
                if "enunciado" in u and (not isinstance(u["enunciado"], str) or not u["enunciado"].strip()):
                    R.falha(nome, uid, "a alínea precisa de `enunciado`")
                for campo in ("enunciado", "dica", "erroComum"):
                    if isinstance(u.get(campo), str):
                        verificar_texto(nome, uid, campo, u[campo], opcoes=False)
                if "verifica" in u:
                    _verifica_lista(nome, uid, u, est)
            propria = u.get("verifica") if isinstance(u.get("verifica"), list) else []
            if not propria:
                R.falha(nome, uid, "sem `verifica` próprio: cada exercício ou alínea tem de ter afirmações que recalculem a resposta final (ex.: ig(raizes(lambda s: ..., -9, 9)[0], ln(5)))")
            passos = u.get("passos")
            if not isinstance(passos, list) or not passos:
                R.falha(nome, uid, "faltam os `passos`")
                continue
            if not 3 <= len(passos) <= 6:
                R.aviso(nome, uid, f"{len(passos)} passos (o contrato diz 3 a 6)")
            if not isinstance(u.get("resposta"), str) or "$" not in u["resposta"]:
                R.falha(nome, uid, "a `resposta` final tem de estar escrita em LaTeX")
            else:
                verificar_texto(nome, uid, "resposta", u["resposta"], opcoes=False)
            _conferir_resposta(nome, uid, u)
            funcoes = dict(funcoes_ex)
            if isinstance(u.get("funcoes"), dict):
                funcoes.update(u["funcoes"])
            for i, p in enumerate(passos, 1):
                est["passos"] += 1
                if not isinstance(p, dict) or not isinstance(p.get("titulo"), str) or not p["titulo"].strip() \
                        or not isinstance(p.get("texto"), str) or not p["texto"].strip():
                    R.falha(nome, uid, f"o passo {i} precisa de `titulo` e `texto`")
                    continue
                _chaves_desconhecidas(nome, f"{uid}/passo {i}", p, CHAVES_PASSO)
                verificar_texto(nome, uid, f"passo {i}.titulo", p["titulo"], opcoes=False)
                verificar_texto(nome, uid, f"passo {i}.texto", p["texto"], opcoes=False)
                if len(p["titulo"].replace("$", "").split()) > 8:
                    R.aviso(nome, uid, f"o título do passo {i} tem mais de 8 palavras")
                if "figura" in p:
                    _verificar_figura_exercicio(nome, f"{uid}/passo {i}", p["figura"], funcoes, est)
            # as fórmulas dos passos e da resposta, linha a linha
            ns_f = _espaco()
            funcs_exec = {}
            for chave, expr in funcoes.items():
                try:
                    cod = _compilar(expr, "funcoes")
                except ErroAutor:
                    continue
                funcs_exec[chave] = (lambda x, cod=cod: _y_em(cod, ns_f, x))
            for campo, t in _textos_da_unidade(u):
                if not isinstance(t, str) or not (campo.endswith(".texto") or campo == "resposta"):
                    continue
                for math_ in _formulas_de(t):
                    for linha in _linhas_do_bloco(math_):
                        tex = _limpar_linha(linha)
                        if not tex:
                            continue
                        estado, msg = _conferir_linha(tex, funcs_exec)
                        est["linhas"] += 1
                        if estado == "falha":
                            R.falha(nome, uid, f"{campo}: {msg}")
                        elif estado == "ignorada":
                            est["linhas_ignoradas"] += 1
                            if not msg.startswith("falta uma relação"):
                                est["linhas_nao_lidas"] = est.get("linhas_nao_lidas", 0) + 1
                                if re.search(r"=|<|>|\\approx|\\Leftrightarrow|\\Rightarrow", tex):
                                    NAO_LIDAS.append(f"{uid} {campo}: {tex}  [{msg[:60]}]")
            # todos os decimais que o texto escreve (e que não são dados do enunciado) estão confirmados por um `verifica`
            dados_do_enunciado = _decimais_do_texto(str(e.get("enunciado", ""))) | _decimais_do_texto(str(u.get("enunciado", "")))
            escritos = set()
            for campo, t in _textos_da_unidade(u):
                if isinstance(t, str) and campo != "enunciado":
                    escritos |= _decimais_do_texto(t)
            for d in sorted(escritos - dados_do_enunciado):
                est["decimais"] += 1
                if d not in numeros and str(float(d)).rstrip("0").rstrip(".") not in numeros:
                    R.falha(nome, uid, f"o número {d.replace('.', ',')} escrito no texto não está confirmado por nenhum `verifica` "
                                       f"(ex.: ig(round(<conta>, {len(d.split('.')[1])}), {d}))")


_EST_VF = _estatisticas_figuras()


def _verificar_figura_vf(nome, ident, a, est=None):
    """Os objetos `figura` dos V/F: curvas = a função do rótulo e do enunciado; pontos nas curvas, com as coordenadas dos rótulos."""
    fig = a.get("figura")
    if not isinstance(fig, dict) or not all(isinstance(fig.get(k), list) for k in ("x", "y", "curvas")):
        return
    textos = [(a.get("texto", ""), True), (a.get("explicacao", ""), False)]
    _verificar_figura_semantica(nome, ident, fig, est if est is not None else _EST_VF, enunciado_tex=[(t, g) for t, g in textos if isinstance(t, str)])


# --------------------------------------------------- ficheiros e corrida
def _tipo_pela_pasta_ou_conteudo(caminho, dados):
    if caminho.parent.name in TIPOS:
        return caminho.parent.name
    if isinstance(dados, dict):
        for tipo, chave in LISTA.items():
            if chave in dados:
                return tipo
    return None


def _dica_json(exc):
    m = exc.msg.lower()
    if "escape" in m:
        return " Cada barra do LaTeX tem de ir dobrada: \\\\frac, \\\\ln, \\\\log_2"
    if "control character" in m:
        return " Quebra de linha ou tabulação dentro de um texto: o texto tem de estar numa só linha"
    if "property name" in m:
        return " Provavelmente uma vírgula a mais antes de } ou ]"
    if "delimiter" in m:
        return " Falta uma vírgula (ou aspas) entre dois campos"
    return ""


def verificar_exercicios_ficheiro(caminho, detalhe):
    nome = _rotulo(caminho)
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError) as exc:
        R.falha(nome, "-", f"não consegui ler o ficheiro ({exc})")
        return
    except json.JSONDecodeError as exc:
        R.falha(nome, "-", f"JSON inválido ({exc.msg}, linha {exc.lineno}, coluna {exc.colno}).{_dica_json(exc)}")
        return
    est = _estatisticas_exercicios()
    verificar_exercicios(nome, dados, {}, est)
    _EST_EX.clear()
    _EST_EX.update(est)
    detalhe.append(f"{nome}: {est['exercicios']} exercícios, {est['unidades']} unidades, {est['passos']} passos")


_EST_EX = {}


def verificar_ficheiro(caminho, tipo, ids_por_tipo, estatisticas, detalhe):
    if caminho.name == "exercicios.json":
        verificar_exercicios_ficheiro(caminho, detalhe)
        return
    nome = _rotulo(caminho)
    try:
        texto = caminho.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError) as exc:
        R.falha(nome, "-", f"não consegui ler o ficheiro ({exc})")
        return
    try:
        dados = json.loads(texto)
    except json.JSONDecodeError as exc:
        R.falha(nome, "-", f"JSON inválido ({exc.msg}, linha {exc.lineno}, coluna {exc.colno}).{_dica_json(exc)}")
        return
    tipo = tipo or _tipo_pela_pasta_ou_conteudo(caminho, dados)
    if tipo is None:
        R.falha(nome, "-", "não sei de que tipo é (ponha-o em cartoes/, perguntas/ ou vf/)")
        return
    stem = caminho.stem
    if not isinstance(dados, dict):
        R.falha(nome, "-", "o ficheiro tem de ser um objeto { tema/grupo, lista }")
        return
    if stem not in PREFIXOS:
        R.falha(nome, "-", f"o nome do ficheiro tem de ser um dos grupos: {', '.join(PREFIXOS)}")
        return
    campo = CAMPO_TEMA[tipo]
    if dados.get(campo) != stem:
        R.falha(nome, "-", f"`{campo}` é «{dados.get(campo)}» mas devia ser «{stem}» (o nome do ficheiro)")
    for outro in ("tema", "grupo"):
        if outro != campo and outro in dados and dados[outro] != stem:
            R.falha(nome, "-", f"`{outro}` é «{dados[outro]}» mas devia ser «{stem}»")
    _chaves_desconhecidas(nome, "-", dados, {"tema", "grupo", LISTA[tipo]})
    verificar_caracteres(nome, "-", {k: v for k, v in dados.items() if k != LISTA[tipo]})
    itens = dados.get(LISTA[tipo])
    if not isinstance(itens, list):
        R.falha(nome, "-", f"falta a lista `{LISTA[tipo]}`")
        return
    est = estatisticas[tipo]
    est["ficheiros"] += 1
    antes = est["total"], est["verif"]
    ids = ids_por_tipo[tipo]
    if tipo == "cartoes":
        verificar_cartoes(nome, stem, itens, ids, est)
        detalhe.append(f"{nome}: {len(itens)} cartões, {est['verif'] - antes[1]} com verifica")
    elif tipo == "perguntas":
        pos, niveis, verif = verificar_perguntas(nome, stem, itens, ids, est)
        pct = 100 * verif / len(itens) if itens else 0
        detalhe.append(f"{nome}: {len(itens)} perguntas (níveis {niveis[1]}/{niveis[2]}/{niveis[3]}), "
                       f"{verif} com verificação ({pct:.0f}%), certa por posição {pos}")
    else:
        verificar_vf(nome, stem, itens, ids, est)
        detalhe.append(f"{nome}: {len(itens)} afirmações, {est['verif'] - antes[1]} com verifica")


def _descobrir():
    """{tipo: [ficheiros]} dos que existem; nos tipos sem pasta ou sem ficheiros diz que ainda não existe."""
    por_tipo = {}
    for tipo in TIPOS:
        pasta = DADOS / tipo
        ficheiros = sorted(p for p in pasta.glob("*.json") if not p.name.startswith("_")) if pasta.is_dir() else []
        por_tipo[tipo] = ficheiros
    return por_tipo


def correr(ficheiros=None, avisos=True, semente=0, silencioso=False):
    """Verifica os dados e devolve a lista de falhas (texto). Sem `ficheiros`, verifica tudo."""
    global SEMENTE
    SEMENTE = semente
    R.falhas, R.avisos, R.mostrar_avisos = [], [], avisos
    _EST_VF.update(_estatisticas_figuras())
    _EST_EX.clear()
    ids = {t: {} for t in TIPOS}
    est = {t: {"total": 0, "verif": 0, "ficheiros": 0, "ref": 0, "verifica": 0, "afirmacoes": 0} for t in TIPOS}
    detalhe = []
    if ficheiros:
        for f in ficheiros:
            caminho = Path(f)
            if not caminho.is_file():
                R.falha(str(f), "-", "o ficheiro não existe")
                continue
            verificar_ficheiro(caminho, None, ids, est, detalhe)
    else:
        for tipo, lista in _descobrir().items():
            if not lista:
                print(f"{tipo}: ainda não existe (ignorado)")
                continue
            for caminho in lista:
                verificar_ficheiro(caminho, tipo, ids, est, detalhe)
            em_falta = [g for g in PREFIXOS if not any(p.stem == g for p in lista)]
            if em_falta:
                print(f"{tipo}: ainda não existem os grupos {', '.join(em_falta)}")
        if (DADOS / "exercicios.json").is_file():
            verificar_exercicios_ficheiro(DADOS / "exercicios.json", detalhe)
        else:
            print("exercicios: ainda não existe (ignorado)")
    if not silencioso:
        for linha in detalhe:
            print(linha)
        for tipo in TIPOS:
            e = est[tipo]
            if not e["total"]:
                continue
            pct = 100 * e["verif"] / e["total"]
            extra = f" (ref: {e['ref']}, verifica: {e['verifica']})" if tipo == "perguntas" else ""
            print(f"resumo {ROTULO[tipo]}: {e['total']} em {e['ficheiros']} ficheiro(s); "
                  f"{e['verif']} ({pct:.0f}%) com verificação numérica{extra}; "
                  f"{e['afirmacoes']} afirmações `verifica` avaliadas")
        if _EST_EX:
            e = _EST_EX
            print(f"resumo exercícios: {e['exercicios']} exercícios em {e['unidades']} unidades; {e['afirmacoes']} afirmações `verifica`; "
                  f"{e['linhas'] - e['linhas_ignoradas']} linhas de LaTeX conferidas (mais {e.get('linhas_nao_lidas', 0)} equações, definições, limites e derivadas que não se conferem sozinhas, "
                  f"cobertas pelos `verifica`); "
                  f"{e['decimais']} decimais confirmados; {e['figuras']} figuras ({e['curvas_conferidas']} curvas, "
                  f"{e['pontos_conferidos']} pontos e {e['tangentes']} tangentes conferidos)")
        v = _EST_VF
        if v["curvas"] or v["pontos"]:
            print(f"resumo figuras dos V/F: {v['curvas_conferidas']} de {v['curvas']} curvas e {v['pontos_conferidos']} de {v['pontos']} pontos confrontados com os rótulos e os enunciados")
    if not ficheiros:
        _correr_outros_verificadores(silencioso)
    if not silencioso:
        print(f"logaritmos: {len(R.falhas)} falha(s), {len(R.avisos)} aviso(s)")
    return list(R.falhas)


def _correr_outros_verificadores(silencioso=False):
    """equacoes.json e estudos.json têm o seu verificador (tools/verificar_equacoes.py, verificar_estudos.py): as falhas deles
    contam aqui, para um só comando (tools/verificar.py) cobrir os dados todos."""
    for nome_mod, ficheiro, quem in (("_verificar_equacoes_correr", "verificar_equacoes.py", "equacoes.json"),
                                     ("_verificar_estudos_correr", "verificar_estudos.py", "estudos.json")):
        caminho = RAIZ / "tools" / ficheiro
        if not caminho.is_file():
            continue
        try:
            spec = importlib.util.spec_from_file_location(nome_mod, caminho)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if quem == "equacoes.json":
                dados = mod.correr()
                falhas = [f.replace("FALHA: ", "", 1) for f in mod.falhas]
                if not silencioso and dados:
                    print(f"equacoes.json: {len(dados['predefinidas'])} predefinidas, {mod.contagem['linhas']} linhas de LaTeX lidas, "
                          f"{mod.contagem['curvas']} curvas, {mod.contagem['raizes']} zeros por bisseção")
            else:
                falhas = list(mod.correr())
                if not silencioso:
                    print(f"estudos.json: {len(mod._confirmado)} verificações")
        except Exception as exc:  # noqa: BLE001
            falhas = [f"{ficheiro} rebentou: {type(exc).__name__}: {exc}"]
        for f in falhas:
            R.falha(quem, "-", f)


def main(argv):
    avisos, semente, ficheiros = True, 0, []
    mostrar_nao_lidas = False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--sem-avisos":
            avisos = False
        elif a == "--nao-lidas":
            mostrar_nao_lidas = True
        elif a == "--semente" and i + 1 < len(argv):
            i += 1
            semente = int(argv[i])
        elif a.startswith("--"):
            print(f"opção desconhecida: {a}")
            return 2
        else:
            ficheiros.append(a)
        i += 1
    falhas = correr(ficheiros or None, avisos, semente)
    if mostrar_nao_lidas:
        print(f"{len(NAO_LIDAS)} relações de LaTeX que o leitor não conferiu sozinhas:")
        for linha in NAO_LIDAS:
            print("  ", linha)
    return 1 if falhas else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    sys.exit(main(sys.argv[1:]))
