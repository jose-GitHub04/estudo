"""Verificação numérica dos dados do site. Correr: python -I tools/verificar.py

1. valores.json: cada valor exato de sin, cos, tan confrontado com math.sin/cos/tan.
2. reducao.json: cada identidade e cada transformação do ponto, em ângulos aleatórios.
3. cartoes.json: ids únicos, campos obrigatórios, $ equilibrados e, nos cartões que
   trazem `verifica`, cada afirmação confrontada numericamente.
4. Texto: nenhum travessão «—» em ficheiros que o aluno possa ler.
5. Probabilidades: a urna e o jogo recalculados com frações exatas e confrontados com os
   números escritos na página (assets/motor/probabilidade.js faz o mesmo no browser).

Sai com código 1 se algo falhar.
"""
import json
from fractions import Fraction as Fr
import math
import random
import re
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
              "atan": math.atan, "asin": math.asin, "acos": math.acos,
              "radians": math.radians, "degrees": math.degrees,
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


# ---------- 5. perguntas (banco de escolha múltipla) ----------
PREFIXOS = {"definicoes": "def", "razoes": "raz", "circunferencia": "cir", "relacoes": "rel",
            "valores": "val", "reducao": "red", "radianos": "rad", "funcoes": "fun"}
# a lista fixa de opções baralha-se no ecrã, por isso não pode haver opções que apontem umas para as outras
OPCAO_PROIBIDA = re.compile(r"(nenhuma|todas|ambas)\s+(d?as\s+)?(anteriores|acima|outras)|\b[abcd]\)\s*e\s*[abcd]\)", re.I)
PTBR = re.compile(r"\b(tela|arquivo|celular|você|vocês|equipe|ônibus|time de)\b", re.I)


def verificar_perguntas():
    pasta = DADOS / "perguntas"
    if not pasta.exists():
        print("perguntas: pasta ainda não existe (ignorado)")
        return
    ids, total, com_ref, com_verifica, verificadas = set(), 0, 0, 0, 0
    rnd = random.Random(23)
    por_tema = {}
    for caminho in sorted(pasta.glob("*.json")):
        if caminho.name.startswith("_"):
            continue
        try:
            dados = json.loads(caminho.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            falha(f"{caminho.name}: JSON inválido ({e}). Cada barra do LaTeX tem de ir dobrada: \\\\frac")
            continue
        tema = dados.get("tema")
        if tema != caminho.stem or tema not in PREFIXOS:
            falha(f"{caminho.name}: tema «{tema}» não coincide com o nome do ficheiro ou não existe")
            continue
        for p in dados.get("perguntas", []):
            total += 1
            por_tema[tema] = por_tema.get(tema, 0) + 1
            pid = p.get("id", "?")
            if not str(pid).startswith(PREFIXOS[tema] + "-"):
                falha(f"{pid}: o id deve começar por {PREFIXOS[tema]}-")
            if pid in ids:
                falha(f"{pid}: id repetido")
            ids.add(pid)
            for campo in ("enunciado", "explicacao"):
                if not p.get(campo, "").strip():
                    falha(f"{pid}: sem {campo}")
            opcoes = p.get("opcoes", [])
            if len(opcoes) != 4:
                falha(f"{pid}: tem de ter 4 opções, tem {len(opcoes)}")
                continue
            textos = [o.get("tex", "").strip() for o in opcoes]
            if "" in textos or len(set(textos)) != 4:
                falha(f"{pid}: opções vazias ou repetidas")
            certa = p.get("certa")
            if not isinstance(certa, int) or not 0 <= certa <= 3:
                falha(f"{pid}: «certa» tem de ser 0 a 3")
                continue
            for t in [p.get("enunciado", ""), p.get("explicacao", "")] + textos:
                if t.count("$") % 2:
                    falha(f"{pid}: número ímpar de $ em «{t[:50]}»")
                if OPCAO_PROIBIDA.search(t):
                    falha(f"{pid}: opção que aponta para outras opções («{t[:50]}»)")
                if PTBR.search(t):
                    falha(f"{pid}: palavra de pt-BR em «{t[:50]}»")
            if p.get("nivel") not in (None, 1, 2, 3):
                falha(f"{pid}: nivel tem de ser 1, 2 ou 3")
            # verificação numérica independente da resposta
            tem = False
            if "ref" in p:
                com_ref += 1
                tem = True
                valores = []
                try:
                    ref = avaliar(p["ref"])
                    valores = [avaliar(o["valor"]) for o in opcoes]
                except Exception as e:  # noqa: BLE001
                    falha(f"{pid}: ref/valor ilegível ({e})")
                if valores:
                    if abs(valores[certa] - ref) > 1e-9:
                        falha(f"{pid}: a opção certa vale {valores[certa]} mas ref dá {ref}")
                    for i, v in enumerate(valores):
                        if i != certa and abs(v - ref) <= 1e-9:
                            falha(f"{pid}: a opção {i} também vale {ref}, há duas certas")
                    for i in range(4):
                        for j in range(i + 1, 4):
                            if abs(valores[i] - valores[j]) <= 1e-9:
                                falha(f"{pid}: as opções {i} e {j} têm o mesmo valor")
            if p.get("verifica"):
                com_verifica += 1
                tem = True
            for expr in p.get("verifica", []):
                for _ in range(30):
                    a = rnd.uniform(0.1, 1.4)
                    k = rnd.randint(-3, 3)
                    try:
                        ok = avaliar(expr, a=a, k=k)
                    except Exception as e:  # noqa: BLE001
                        falha(f"{pid}: não consegui avaliar «{expr}»: {e}")
                        break
                    if not ok:
                        falha(f"{pid}: afirmação falsa «{expr}» com a={a:.3f}, k={k}")
                        break
            verificadas += 1 if tem else 0
    pct = (100 * verificadas / total) if total else 0
    print(f"perguntas: {total} perguntas ({', '.join(f'{t} {n}' for t, n in sorted(por_tema.items()))}); "
          f"{verificadas} com verificação numérica ({pct:.0f}%)")
    if total and pct < 55:
        falha(f"perguntas: só {pct:.0f}% têm `ref` ou `verifica` (mínimo 55%)")


# ---------- 6. probabilidades ----------
def _urna(v, o):
    """X = bolas tiradas, sem repor, até sair vermelha: {k: P(X=k)}."""
    t = v + o
    tab = {}
    for k in range(1, o + 2):
        p = Fr(1)
        for i in range(k - 1):
            p *= Fr(o - i, t - i)
        tab[k] = p * Fr(v, t - (k - 1))
    return tab


def verificar_probabilidades():
    tab = _urna(3, 4)
    esperado = {1: Fr(3, 7), 2: Fr(2, 7), 3: Fr(6, 35), 4: Fr(3, 35), 5: Fr(1, 35)}
    if tab != esperado:
        falha(f"urna 3V+4A: tabela {tab} != {esperado}")
    if sum(tab.values()) != 1:
        falha("urna 3V+4A: a soma não dá 1")
    mu = sum(k * p for k, p in tab.items())
    var = sum(p * (k - mu) ** 2 for k, p in tab.items())
    if (mu, var) != (2, Fr(6, 5)):
        falha(f"urna 3V+4A: mu={mu}, var={var} (esperado 2 e 6/5)")
    ganho = Fr(5, 10) * 2 + Fr(2, 10) * (-5) + Fr(3, 10) * 0
    if ganho != 0:
        falha(f"jogo 5V/2A/3Az: ganho médio {ganho} (esperado 0, equitativo)")
    # soma de n dados: μ = 3,5 n, σ² = 35 n / 12 e as proporções citadas na matéria
    def dados(n):
        d = {0: Fr(1)}
        for _ in range(n):
            e = {}
            for t, q in d.items():
                for f in range(1, 7):
                    e[t + f] = e.get(t + f, 0) + q / 6
            d = e
        return d
    for n, p1, p2 in ((6, 0.7107, 0.9606), (10, 0.6870, 0.9495)):
        d = dados(n)
        m = sum(t * q for t, q in d.items())
        v = sum((t - m) ** 2 * q for t, q in d.items())
        if sum(d.values()) != 1 or m != Fr(7 * n, 2) or v != Fr(35 * n, 12):
            falha(f"dados n={n}: soma, μ ou σ² não batem")
        sd = math.sqrt(v)
        a1 = float(sum(q for t, q in d.items() if abs(t - m) < sd))
        a2 = float(sum(q for t, q in d.items() if abs(t - m) < 2 * sd))
        if abs(a1 - p1) > 5e-5 or abs(a2 - p2) > 5e-5:
            falha(f"dados n={n}: proporções {a1:.4f}, {a2:.4f} (esperado {p1}, {p2})")
    d6 = dados(6)
    if abs(float(sum(q for t, q in d6.items() if 17 <= t <= 25)) - 0.71) > 0.005:
        falha("materia.html: P(17 ≤ S ≤ 25) com 6 dados não é ≈ 0,71")
    html = (RAIZ / "probabilidades" / "materia.html").read_text(encoding="utf-8")
    if not all(t in html for t in ("frac47", "frac36=", "frac27")):
        falha("materia.html: falta o exemplo P(X=2) = 4/7 × 3/6 = 2/7")
    print("probabilidades: urna 3V+4A (soma 1, μ = 2, σ² = 6/5) e jogo equitativo confirmados")


def verificar_exercicios():
    """Soluções dos 4 exercícios e do verdadeiro ou falso, recalculadas de forma independente."""
    # Ex. 1: k = 1
    k = Fr(1)
    t1 = [(-1, k / 4), (0, Fr(1, 6)), (1, k / 3), (2, Fr(1, 4))]
    if sum(p for _, p in t1) != 1 or sum(x * p for x, p in t1) != Fr(7, 12):
        falha("ex. 1: k = 1 e μ = 7/12 não batem")
    # Ex. 2: a = 0,35, b = 0,40, μ = 1,9
    a, b = Fr(35, 100), Fr(40, 100)
    if a + b + Fr(1, 4) != 1 or a + 2 * b + Fr(3, 4) != Fr(19, 10):
        falha("ex. 2: a = 0,35, b = 0,40 e μ = 1,9 não batem")
    # Ex. 3: caixa 2V + 3B
    u = _urna(2, 3)
    if list(u.values()) != [Fr(2, 5), Fr(3, 10), Fr(1, 5), Fr(1, 10)]:
        falha(f"ex. 3: tabela {u}")
    mu = sum(k_ * p_ for k_, p_ in u.items())
    var = sum(p_ * (k_ - mu) ** 2 for k_, p_ in u.items())
    cond = u[3] / sum(p_ for k_, p_ in u.items() if k_ >= 2)
    if (mu, var, cond) != (2, 1, Fr(1, 3)):
        falha(f"ex. 3: μ={mu}, σ²={var}, P(X=3|X≥2)={cond}")
    # Ex. 4: Normal(20; 2)
    phi = lambda z: 0.5 * (1 + math.erf(z / math.sqrt(2)))
    if abs((phi(1) - phi(-1)) - 0.6827) > 5e-5 or abs((1 - phi(2)) - 0.02275) > 5e-6             or round(400 * (1 - phi(2))) != 9:
        falha("ex. 4: valores da Normal não batem")
    # Verdadeiro ou falso
    d = json.loads((RAIZ / "probabilidades" / "dados" / "verdadeiro-falso.json").read_text(encoding="utf-8"))
    afs = d["afirmacoes"]
    ids = [x["id"] for x in afs]
    if len(ids) != len(set(ids)):
        falha("verdadeiro-falso.json: ids repetidos")
    if sum(x["verdadeira"] for x in afs) != 7 or len(afs) != 14:
        falha("verdadeiro-falso.json: esperadas 14 afirmações, 7 verdadeiras")
    for x in afs:
        for campo in ("texto", "explicacao"):
            if x[campo].count("$") % 2:
                falha(f"verdadeiro-falso.json: {x['id']}.{campo} com $ desequilibrados")
    print("exercícios: soluções dos 4 exercícios e 14 afirmações de verdadeiro ou falso confirmadas")


if __name__ == "__main__":
    verificar_valores()
    verificar_reducao()
    verificar_cartoes()
    verificar_perguntas()
    verificar_probabilidades()
    verificar_exercicios()
    verificar_travessoes()
    if erros:
        print(f"\n{len(erros)} falha(s).")
        sys.exit(1)
    print("\nTudo certo.")
