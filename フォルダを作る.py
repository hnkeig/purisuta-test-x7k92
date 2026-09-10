#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スターメイト ─ 素材を入れるフォルダを、まとめて作る

  python3 フォルダを作る.py

assets/README.md に出てくる置き場所を、中身が空のまま一度に作ります。
すでにあるフォルダやファイルには、いっさい手を触れません（消しません）。

・女の子を増やしたとき（キャラの増やしかた.md）は、下の GIRLS に
  その子のフォルダ名を書き足して、もう一度これを実行してください。
・使わないフォルダは、そのまま消してかまいません。
  ゲームは「あるものだけ」を見るので、無くても動きます。
"""
import atexit, os, sys

# ---------------------------------------------------------------------------
#  say() … 画面に出すだけの関数（作る処理そのものには関係しません）
#  `python3 フォルダを作る.py | head -3` のように表示を打ち切られても、
#  フォルダを作りきってから終わるようにしています。
# ---------------------------------------------------------------------------
def say(*a):
    try:
        print(*a)
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass


def _quiet_exit():
    try:
        sys.stdout.flush()
    except BaseException:
        try:
            os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        except BaseException:
            pass


atexit.register(_quiet_exit)


HERE = os.path.dirname(os.path.abspath(__file__))

# 女の子のフォルダ名（assets/README.md の「フォルダ名」の表と同じ）
GIRLS = ["kanade", "rena", "hinata", "luka", "minamo", "sakuya"]

# 服の名前つきフォルダ。full/ と bust/ の下に作ります。
# ここにあるのは「ゲームが実際に着せる服」だけです
# （assets/config.js の OUTFIT_RULE が指定するもの）。
#   ※ uniform_w（制服・冬）は full/ bust/ の“直下”がその役なので、作りません。
#   ※ jersey casual2 coat dress apron stage は予備で、いまはどの場面でも
#      指定されないため作りません。使う場面を足したときに手で作ってください。
OUTFITS = ["uniform_s",  # 制服・夏（4〜9月）
           "casual",     # 私服（家・公園・街・カフェ・映画館・遊園地・水族館）
           "gym",        # 体操着（グラウンド）
           "club",       # 部活の服（音楽室・美術室）
           "pajama",     # パジャマ（自室）
           "swim",       # 水着（海・プール）
           "yukata",     # 浴衣（夏祭り・花火大会）
           "kimono"]     # 晴れ着（神社・初詣）


def wanted():
    """作るフォルダを、上から順にならべて返す"""
    d = ["assets/bg", "assets/bgm", "assets/se", "assets/ui", "assets/font"]
    for g in GIRLS:
        d.append(f"assets/chara/{g}/full")
        for o in OUTFITS:
            d.append(f"assets/chara/{g}/full/{o}")
        d.append(f"assets/chara/{g}/bust")
        for o in OUTFITS:
            d.append(f"assets/chara/{g}/bust/{o}")
        d.append(f"assets/chara/{g}/save")     # きろく画面の顔
        d.append(f"assets/chara/{g}/face")     # ※重ね絵モード用
        d.append(f"assets/chara/{g}/outfit")   # ※重ね絵モード用
    return d


def main():
    made, had = [], 0
    for rel in wanted():
        p = os.path.join(HERE, rel)
        if os.path.isdir(p):
            had += 1
            continue
        os.makedirs(p, exist_ok=True)
        made.append(rel)

    if made:
        say(f"  作りました（{len(made)} フォルダ）:")
        for m in made:
            say("    " + m)
    say(f"\n  すでにあった: {had} フォルダ ／ 作った: {len(made)} フォルダ")
    say("  中身は空です。assets/README.md を見ながら、絵と音を入れてください。")
    say("  入れたり消したりしたら、かならず一度 `python3 build.py` を実行してください。")


if __name__ == "__main__":
    main()
