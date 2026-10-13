"""Verificação dos dados do tema «Exponenciais e logaritmos» (logaritmos/dados/**).

Correr (a partir da raiz do site):
    python -X utf8 -I tools/verificar_log.py                 tudo o que existir
    python -X utf8 -I tools/verificar_log.py f1.json f2.json  só esses ficheiros
    opções: --sem-avisos (esconde os AVISO)   --semente N (outras amostras aleatórias)

Imprime `FALHA: <ficheiro>: <id>: <o quê>` por cada problema e sai com código 1 se houver
falhas. Os AVISO não fazem falhar (contagens por grupo, falta de erroComum, distribuição da
posição certa...), para não bloquear trabalho em curso. Pastas ou ficheiros que ainda não
existem são ignorados.

Verifica, por tipo:
  cartões    (dados/cartoes/<grupo>.json):   campos, ids, texto, `verifica`
  perguntas  (dados/perguntas/<grupo>.json): 4 opções distintas, `certa`, `nivel`, texto,
             `ref` + `valor` das opções, `verifica`, >= 60 % com verificação numérica
  V/F        (dados/vf/<grupo>.json):        `verdadeira`, explicação, `verifica`, `figura`

Verificação numérica (expressões Python dos campos `ref`, `valor` e `verifica`):
  nomes disponíveis: sqrt pi e exp ln log(base 10) logb(a, x) abs min max sin cos tan
                     ig(x, y) der(f, x) lim(f, x0) inf
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
TIPOS = ("cartoes", "perguntas", "vf")   # exercicios.json: extensão por acabar, desligada
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
                        "sin cos tan ig der lim inf; variáveis a b x y z t k n)")
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
        if _verifica_lista(nome, ident, a, est):
            est["verif"] += 1


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


def verificar_ficheiro(caminho, tipo, ids_por_tipo, estatisticas, detalhe):
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
        print(f"logaritmos: {len(R.falhas)} falha(s), {len(R.avisos)} aviso(s)")
    return list(R.falhas)


def main(argv):
    avisos, semente, ficheiros = True, 0, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--sem-avisos":
            avisos = False
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
    return 1 if falhas else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    sys.exit(main(sys.argv[1:]))
