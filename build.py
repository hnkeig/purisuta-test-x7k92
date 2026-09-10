#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スターメイト ─ 配布用の1ファイル版をつくる

  python3 build.py

やることは2つです。

 1. assets フォルダを見て、入っている素材の一覧を assets/list.js に書き出す
    （立ち絵・背景・BGM・SEを入れたり消したりしたら、必ず1回実行してください）

 2. index.html / style.css / 各 js をまとめて starmate.html を書き出す
    素材は base64 にして中に埋めこむので、できたファイル1つで動きます。

開発するときは、分かれたままのファイルを触ってください。
"""
import atexit, os, sys, re, json, base64, mimetypes

# ---------------------------------------------------------------------------
#  say() … 画面に出すだけの関数（作る処理そのものには関係しません）
#
#  `python3 build.py | head -3` のように、表示を途中で打ち切られると
#  「読む相手がもういません（BrokenPipeError）」で Python が止まってしまい、
#  starmate.html を書き出す前に終わってしまいます。
#  それを防ぐため、表示に失敗しても黙って先へ進むようにしています。
#  （ふつうに `python3 build.py` と打つときは、なにも変わりません）
# ---------------------------------------------------------------------------
def say(*a):
    try:
        print(*a)
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass


def _quiet_exit():
    """終わるときに、閉じられたパイプへ書こうとして
       赤いエラー文が出るのを防ぐ（後始末だけの処理）"""
    try:
        sys.stdout.flush()
    except BaseException:
        try:
            os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        except BaseException:
            pass


atexit.register(_quiet_exit)


HERE   = os.path.dirname(os.path.abspath(__file__))
OUT    = os.path.join(HERE, "starmate.html")
ASSETS = os.path.join(HERE, "assets")

IMG_EXT = (".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg")
SND_EXT = (".mp3", ".ogg", ".m4a", ".wav")
FNT_EXT = (".woff2", ".woff", ".ttf", ".otf")


def read(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        sys.exit(f"エラー: {name} が見つかりません（build.py と同じ場所に置いてください）")
    with open(path, encoding="utf-8") as f:
        return f.read()


def ls(d, exts):
    """フォルダの中の、拡張子が合うファイル名を並べて返す"""
    p = os.path.join(ASSETS, d)
    if not os.path.isdir(p):
        return []
    return sorted(f for f in os.listdir(p)
                  if f.lower().endswith(exts) and not f.startswith("."))


def scan_assets():
    """assets の中身を調べて、一覧（と、埋めこむファイルの一覧）を返す"""
    art = {"chara": {}, "bg": [], "bgm": [], "se": [], "ui": [], "font": []}
    files = []                                    # 1ファイル版に埋めこむ相対パス

    chara_dir = os.path.join(ASSETS, "chara")
    if os.path.isdir(chara_dir):
        for gid in sorted(os.listdir(chara_dir)):
            base = os.path.join(chara_dir, gid)
            if not os.path.isdir(base) or gid.startswith("_") or gid.startswith("."):
                continue
            # 一覧には「ファイル名（拡張子つき）」を入れます。
            # こうしておくと png でも webp でも jpg でも同じように使えます。
            ent = {"base": "", "front": "", "face": [], "outfit": [],
                   "full": {}, "bust": {}, "save": []}
            # ★ この子のファイルは、いったんここに貯めます。
            #    使われない子（下の判定で落ちる子）の絵まで 1ファイル版に
            #    埋めこんでしまわないようにするためです。
            mine = []
            for f in sorted(os.listdir(base)):
                if f.lower().startswith("base.") and f.lower().endswith(IMG_EXT):
                    ent["base"] = f
                    mine.append(f"chara/{gid}/{f}")
                if f.lower().startswith("front.") and f.lower().endswith(IMG_EXT):
                    ent["front"] = f
                    mine.append(f"chara/{gid}/{f}")
            # face / outfit（重ね絵用）と save（きろく画面の顔画像）は、
            # どれも「そのフォルダの直下だけ」を見ます。
            for sub in ("face", "outfit", "save"):
                for f in ls(f"chara/{gid}/{sub}", IMG_EXT):
                    ent[sub].append(f)
                    mine.append(f"chara/{gid}/{sub}/{f}")
            # 立ち絵（full/）と顔画像（bust/）。
            # どちらも「直下」＋「服の名前のフォルダ」という同じ形で覚えます。
            for kind in ("full", "bust"):
                kdir = os.path.join(base, kind)
                if not os.path.isdir(kdir):
                    continue
                top = ls(f"chara/{gid}/{kind}", IMG_EXT)
                if top:
                    ent[kind][""] = top
                    for f in top:
                        mine.append(f"chara/{gid}/{kind}/{f}")
                for sub in sorted(os.listdir(kdir)):
                    if not os.path.isdir(os.path.join(kdir, sub)) or sub.startswith("."):
                        continue
                    fs = ls(f"chara/{gid}/{kind}/{sub}", IMG_EXT)
                    if fs:
                        ent[kind][sub] = fs
                        for f in fs:
                            mine.append(f"chara/{gid}/{kind}/{sub}/{f}")
            ent["face"].sort()
            ent["outfit"].sort()
            ent["save"].sort()
            if ent["base"] or ent["full"] or ent["bust"] or ent["save"]:
                art["chara"][gid] = ent
                files.extend(mine)          # 使う子のぶんだけ、埋めこみます
            elif ent["face"] or ent["outfit"]:
                say(f"  ⚠ chara/{gid}: base.png（体の絵）も full/ も無いので使われません")

    for f in ls("bg", IMG_EXT):
        art["bg"].append(f)                       # 背景も拡張子ごと覚えておく
        files.append("bg/" + f)
    for f in ls("ui", IMG_EXT):                   # タイトルのロゴ・ボタン画像
        art["ui"].append(f)
        files.append("ui/" + f)
    for f in ls("font", FNT_EXT):                 # ゲーム全体の書体
        art["font"].append(f)
        files.append("font/" + f)
    for kind in ("bgm", "se"):
        for f in ls(kind, SND_EXT):
            art[kind].append(f)                   # 音は拡張子ごと覚えておく
            files.append(kind + "/" + f)

    return art, files


def write_list(art):
    """assets/list.js の中身を書きかえる（印にはさまれた部分だけ）"""
    path = os.path.join(ASSETS, "list.js")
    if not os.path.exists(path):
        os.makedirs(ASSETS, exist_ok=True)
        open(path, "w", encoding="utf-8").write(
            '"use strict";\n/* ART_LIST_BEGIN */\n/* ART_LIST_END */\n')
    s = open(path, encoding="utf-8").read()
    body = "/* ART_LIST_BEGIN */\nconst ART_LIST = " + \
           json.dumps(art, ensure_ascii=False, indent=2) + ";\n/* ART_LIST_END */"
    s2 = re.sub(r'/\* ART_LIST_BEGIN \*/.*?/\* ART_LIST_END \*/', lambda m: body, s, flags=re.S)
    open(path, "w", encoding="utf-8").write(s2)

    n = sum((1 if v["base"] else 0) + len(v["face"]) + len(v["outfit"])
            + (1 if v["front"] else 0) + len(v["save"])
            + sum(len(x) for x in v["full"].values())
            + sum(len(x) for x in v["bust"].values())
            for v in art["chara"].values())
    say(f"  素材の一覧: 立ち絵 {len(art['chara'])}人ぶん（{n}枚）／"
          f"背景 {len(art['bg'])}／BGM {len(art['bgm'])}／SE {len(art['se'])}／"
          f"UI {len(art['ui'])}／書体 {len(art['font'])}")


def embed(files):
    """1ファイル版のために、素材を base64 のデータURLにする"""
    if not files:
        return ""
    data, total = {}, 0
    for rel in files:
        p = os.path.join(ASSETS, rel)
        if not os.path.exists(p):
            continue
        raw = open(p, "rb").read()
        total += len(raw)
        mime = mimetypes.guess_type(p)[0] or "application/octet-stream"
        data[rel] = "data:" + mime + ";base64," + base64.b64encode(raw).decode()
    mb = total / 1024 / 1024
    say(f"  素材の埋めこみ: {len(data)} ファイル（{mb:.1f} MB）")
    if mb > 25:
        say("  ⚠ 素材が大きいので、1ファイル版は開くのに時間がかかります。")
        say("    人に渡すときは、フォルダごと渡す方が快適かもしれません。")
    return "/* ===== assets（埋めこみ） ===== */\nconst ART_DATA = " + \
           json.dumps(data, ensure_ascii=False) + ";\n"


def main():
    art, files = scan_assets()
    write_list(art)

    html = read("index.html")

    # <link rel="stylesheet" href="style.css"> → <style>…</style>
    css = read("style.css")
    link = re.search(r'[ \t]*<link[^>]*href=["\']style\.css["\'][^>]*>\s*\n?', html)
    if not link:
        sys.exit("エラー: index.html に style.css の <link> が見つかりません")
    html = html[:link.start()] + "<style>\n" + css.rstrip() + "\n</style>\n" + html[link.end():]

    # <script src="..."></script> をまとめて1つの <script> に
    tags = list(re.finditer(r'[ \t]*<script src=["\']([^"\']+)["\']></script>\s*\n?', html))
    if not tags:
        sys.exit("エラー: index.html に <script src=...> が見つかりません")
    js = []
    for t in tags:
        name = t.group(1)
        body = read(name)
        body = re.sub(r'^[ \t]*"use strict";[ \t]*\n', "", body, flags=re.M)
        js.append(f"/* ===== {name} ===== */\n{body.rstrip()}\n")
        say(f"  取りこみ: {name}  ({len(body.encode())/1024:.1f} KB)")

    blob = embed(files)
    merged = '<script>\n"use strict";\n' + blob + "\n".join(js) + "</script>\n"
    html = html[:tags[0].start()] + merged + html[tags[-1].end():]

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    size = os.path.getsize(OUT) / 1024
    say(f"\n  書き出しました: starmate.html  ({size:.1f} KB)")
    say("  このファイル1つで動きます。")


if __name__ == "__main__":
    main()
