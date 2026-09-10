#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スターメイト ─ 配布用の zip をつくる

  python3 pack.py

index.html が読んでいるファイルを自分で調べて、必要なものを取りこぼさずに
starmate.zip にまとめます。（1ファイル版も先に作り直します）
"""
import atexit, os, re, sys, zipfile, subprocess

# ---------------------------------------------------------------------------
#  say() … 画面に出すだけの関数（作る処理そのものには関係しません）
#
#  `python3 pack.py | head -3` のように、表示を途中で打ち切られると
#  「読む相手がもういません（BrokenPipeError）」で Python が止まってしまい、
#  starmate.zip を書き出す前に終わってしまいます。
#  それを防ぐため、表示に失敗しても黙って先へ進むようにしています。
#  （ふつうに `python3 pack.py` と打つときは、なにも変わりません）
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


HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "starmate.zip")
# 1ファイル版（starmate.html）は zip に入れません。別ファイルでお渡しします。
EXTRA = ["build.py", "pack.py", "README.md", "本文の直しかた.md", "仕様書.md",
         "イベント一覧.md",
         "spec.py", "spec_dump.js", "spec_dump.json",
         "キャラの増やしかた.md", "story/nanase.js",
         "assets/README.md", "引き継ぎメモ.md", "フォルダを作る.py"]
# tests/ の中身は、あるものを全部入れる
import glob as _g, os as _o
EXTRA += sorted("tests/"+_o.path.basename(f)
                for f in _g.glob(_o.path.join(HERE, "tests", "*"))
                if _o.path.isfile(f) and not _o.path.basename(f).startswith("."))

def empty_dirs():
    """assets/ の中の「まだ何も入っていないフォルダ」を並べて返す。

    素材を置く場所（assets/bg、assets/chara/kanade/full …）は、
    中身が空でも zip に「フォルダとして」入れておきます。
    展開したときに置き場所が最初から用意されていれば、
    自分でフォルダを作らずに済むためです。
    """
    out = []
    adir = os.path.join(HERE, "assets")
    for root, dirs, names in os.walk(adir):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        if dirs:                                   # 下にフォルダがあるなら空ではない
            continue
        if [n for n in names if not n.startswith(".")]:
            continue                               # ファイルが入っているなら不要
        out.append(os.path.relpath(root, HERE).replace(os.sep, "/") + "/")
    return sorted(out)


def add_dir(z, name):
    """zip に「空のフォルダ」を1つ記録する"""
    zi = zipfile.ZipInfo(name)
    zi.external_attr = (0o40755 << 16) | 0x10      # ディレクトリの印
    z.writestr(zi, b"")


def main():
    # まず1ファイル版を作り直す（素材の一覧もここで更新される）
    say("  1ファイル版を作り直します…")
    subprocess.run([sys.executable, os.path.join(HERE, "build.py")], check=True)

    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    files = ["index.html"]
    files += re.findall(r'<link[^>]*href=["\']([^"\']+)["\']', html)
    files += re.findall(r'<script src=["\']([^"\']+)["\']', html)

    # assets フォルダの中身（素材）は、あるものを全部入れる
    adir = os.path.join(HERE, "assets")
    for root, _, names in os.walk(adir):
        for n in names:
            if n.startswith("."): continue
            rel = os.path.relpath(os.path.join(root, n), HERE).replace(os.sep, "/")
            if rel not in files: files.append(rel)
    for e in EXTRA:
        if e not in files: files.append(e)

    missing = [f for f in files if not os.path.exists(os.path.join(HERE, f))]
    if missing:
        sys.exit("エラー: つぎのファイルが見つかりません → " + " / ".join(missing))

    edirs = empty_dirs()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for d in edirs:
            add_dir(z, d)                          # 素材の置き場所（空のフォルダ）
        for f in files:
            z.write(os.path.join(HERE, f), f)
    say(f"\n  書き出しました: starmate.zip（{len(files)} ファイル ＋ "
          f"空のフォルダ {len(edirs)} / {os.path.getsize(OUT)/1024:.0f} KB）")
    for f in files:
        if not f.startswith("assets/chara/_template"):
            say("    " + f)
    say("    （ほか assets/chara/_template のテンプレート）")
    if edirs:
        say("\n  素材の置き場所（空のフォルダとして入れました）:")
        for d in edirs:
            say("    " + d)

if __name__ == "__main__":
    main()
