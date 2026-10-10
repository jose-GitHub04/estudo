"""Verificação numérica dos dados do site. Correr: python -I tools/verificar.py

1. valores.json: cada valor exato de sin, cos, tan confrontado com math.sin/cos/tan.
2. reducao.json: cada identidade e cada transformação do ponto, em ângulos aleatórios.
3. cartoes.json: ids únicos, campos obrigatórios, $ equilibrados e, nos cartões que
   trazem `verifica`, cada afirmação confrontada numericamente.
4. Texto: nenhum travessão «—» em ficheiros que o aluno possa ler.

Sai com código 1 se algo falhar.
"""
import json
import math
import random
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "trigonometria" / "dados"
TOL = 1e-9
erros = []


def falha(msg):
    erros.append(msg)
    print("FALHA:", msg)


def avaliar(expr, **vars):
    """Avalia uma expressão dos nossos ficheiros de dados (são nossos, não do aluno)."""
    espaco = {"sqrt": math.sqrt, "pi": math.pi, "sin": math.sin, "cos": math.cos, "tan": math.tan,
              "abs": abs, "k": 0, "ig": lambda x, y: abs(x - y) < 1e-9, **vars}
    return eval(expr, {"__builtins__": {}}, espaco)


def carregar(nome):
    return json.loads((DADOS / nome).read_text(encoding="utf-8"))


# ---------- 1. valores.json ----------
def verificar_valores():
    dados = carregar("valores.json")
    n = 0
    for a in dados["angulos"]:
        rad = math.radians(a["graus"])
        for f, fn in (("sin", math.sin), ("cos", math.cos), ("tan", math.tan)):
            v = a[f]
            real = fn(rad)
            if v is None:
                if f != "tan" or abs(math.cos(rad)) > 1e-9:
                    falha(f"valores.json: {f} {a['graus']}° é null mas está definido")
                continue
            if f == "tan" and abs(math.cos(rad)) < 1e-9:
                falha(f"valores.json: tan {a['graus']}° devia ser null")
                continue
            esperado = avaliar(v["expr"])
            if abs(esperado - real) > TOL:
                falha(f"valores.json: {f} {a['graus']}° = {v['expr']} ({esperado}) mas math dá {real}")
            if not v["tex"]:
                falha(f"valores.json: {f} {a['graus']}° sem tex")
            n += 1
    graus = [a["graus"] for a in dados["angulos"]]
    if graus != sorted(set(graus)) or graus[0] != 0 or graus[-1] != 360:
        falha("valores.json: ângulos fora de ordem ou incompletos")
    print(f"valores.json: {n} valores confrontados com math")


# ---------- 2. reducao.json ----------
def verificar_reducao():
    dados = carregar("reducao.json")
    rnd = random.Random(7)
    total = 0
    for rel in dados["relacoes"]:
        for _ in range(50):
            a = rnd.uniform(0.05, math.pi / 2 - 0.05)
            x, y = math.cos(a), math.sin(a)
            # transformação do ponto
            px, py = (avaliar(e, x=x, y=y) for e in rel["ponto"])
            ang = avaliar(rel["arg"], a=a)
            if abs(math.cos(ang) - px) > TOL or abs(math.sin(ang) - py) > TOL:
                falha(f"reducao.json {rel['id']}: o ponto não cai onde diz")
                break
            for linha in rel["linhas"]:
                esq = {"sin": math.sin, "cos": math.cos, "tan": math.tan}[linha["f"]](ang)
                dir_ = linha["sinal"] * {"sin": math.sin, "cos": math.cos, "tan": math.tan}[linha["res"]](a)
                if abs(esq - dir_) > 1e-8:
                    falha(f"reducao.json {rel['id']}: {linha['f']}({rel['arg']}) != {linha['sinal']}·{linha['res']}(a)")
                    break
        total += len(rel["linhas"])
    if total != 17:
        falha(f"reducao.json: esperava 17 identidades, há {total}")
    print(f"reducao.json: {total} identidades e {len(dados['relacoes'])} transformações do ponto verificadas")


# ---------- 3. cartoes.json ----------
GRUPOS = {"definicoes", "razoes", "circunferencia", "relacoes", "valores", "reducao", "radianos", "funcoes"}


def verificar_cartoes():
    caminho = DADOS / "cartoes.json"
    if not caminho.exists():
        print("cartoes.json: ainda não existe (ignorado)")
        return
    dados = carregar("cartoes.json")
    ids = set()
    rnd = random.Random(11)
    n_verifica = 0
    for c in dados["cartoes"]:
        for campo in ("id", "grupo", "frente", "verso"):
            if not c.get(campo):
                falha(f"cartoes.json: cartão sem {campo}: {c.get('id')}")
        if c["id"] in ids:
            falha(f"cartoes.json: id repetido {c['id']}")
        ids.add(c["id"])
        if c["grupo"] not in GRUPOS:
            falha(f"cartoes.json {c['id']}: grupo desconhecido {c['grupo']}")
        for campo in ("frente", "verso", "porque"):
            if campo in c and c[campo].count("$") % 2:
                falha(f"cartoes.json {c['id']}: número ímpar de $ em {campo}")
        for expr in c.get("verifica", []):
            for _ in range(40):
                a = rnd.uniform(0.1, 1.4)
                k = rnd.randint(-3, 3)
                try:
                    ok = avaliar(expr, a=a, k=k)
                except Exception as e:  # noqa: BLE001
                    falha(f"cartoes.json {c['id']}: não consegui avaliar «{expr}»: {e}")
                    break
                if not ok:
                    falha(f"cartoes.json {c['id']}: afirmação falsa «{expr}» com a={a:.3f}, k={k}")
                    break
            n_verifica += 1
    print(f"cartoes.json: {len(dados['cartoes'])} cartões, {n_verifica} afirmações verificadas")


# ---------- 4. travessões ----------
def verificar_travessoes():
    n = 0
    for p in RAIZ.rglob("*"):
        if not p.is_file() or "katex" in p.parts or ".git" in p.parts:
            continue
        if p.suffix not in {".html", ".js", ".json", ".css", ".md", ".py"}:
            continue
        if p.name == "verificar.py":
            continue
        for i, linha in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if "—" in linha:
                falha(f"travessão «—» em {p.relative_to(RAIZ)}:{i}")
        n += 1
    print(f"travessões: {n} ficheiros verificados")


if __name__ == "__main__":
    verificar_valores()
    verificar_reducao()
    verificar_cartoes()
    verificar_travessoes()
    if erros:
        print(f"\n{len(erros)} falha(s).")
        sys.exit(1)
    print("\nTudo certo.")
