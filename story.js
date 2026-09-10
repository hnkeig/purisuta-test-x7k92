/* =========================================================================
   スターメイト ／ story.js（索引）

   ★ このファイルに文章は入っていません。
     ・女の子ごとのセリフ … story/kanade.js ／ rena.js ／ hinata.js ／
                            luka.js ／ minamo.js ／ sakuya.js
     ・行事や部活の文章   … story/events.js

   ここは、その6人ぶんを1つの表にまとめているだけの場所です。
   文章を直したいときは、このファイルは触らなくて大丈夫です。
   （女の子を増やすときだけ、下の STORY に1行足してください）
   ========================================================================= */
"use strict";

const STORY = {
  kanade: ST_kanade,
  rena:   ST_rena,
  hinata: ST_hinata,
  luka:   ST_luka,
  minamo: ST_minamo,
  sakuya: ST_sakuya
};

/* 6人ぶんの中身を、ゲームが使う形の表に並べかえる */
const AFF_EV = {};      /* 好感度イベント */
const INTRO = {};       /* はじめての出会い */
const CLUBMEET = {};    /* 部室での初対面 */
const JOBMEET = {};     /* バイト先に来たとき */
for (const id in STORY) {
  const s = STORY[id];
  if (s.ev && s.ev.length) AFF_EV[id]   = s.ev;
  if (s.intro)             INTRO[id]    = s.intro;
  if (s.clubmeet)          CLUBMEET[id] = s.clubmeet;
  if (s.job)               JOBMEET[id]  = s.job;
}

/* =======================================================================
   女の子の一覧を、story/<名前>.js の p:{...} から組み立てます。
   ★ここは自動です。女の子を増やしても、このファイルを直す必要はありません。
   ======================================================================= */
const CHARA = Object.keys(STORY)
  .filter(id => STORY[id].p)
  .sort((a, b) => (STORY[a].p.order || 99) - (STORY[b].p.order || 99))
  .map(id => {
    const s = STORY[id], p = s.p;
    /* 表示名は story/names.js が優先。無ければ、その子のファイルに書いてある名前。
       ★ id は変えないこと（セーブ・イベントID・素材フォルダが id で結びついています） */
    const nm = (typeof CHARA_NAMES !== "undefined" && CHARA_NAMES[id]) || {};
    return {
      id, name: nm.name || s.name, role: nm.role || s.role,
      sei: nm.sei || (s.name || "").split(/\s+/)[0] || "",
      mei: nm.mei || (s.name || "").split(/\s+/)[1] || "",
      hair: p.hair, hair2: p.hair2, eye: p.eye, uni: p.uni, ribbon: p.ribbon,
      style: p.style,
      ideal: { ...p.ideal }, like: (p.like || []).slice(), hate: (p.hate || []).slice(),
      aff: (p.aff === undefined ? 100 : p.aff), last: 0,
      q: s.q, req: p.req || null,
      /* くわしく画面のプロフィールに出すもの */
      club: s.club || "", bday: p.bday ? { ...p.bday } : null,
      prof: s.prof ? { ...s.prof } : null,
      /* その子じしんの能力（ゲージ表示のもと）。story/<名前>.js の p.stat */
      stat: p.stat ? { ...p.stat } : null
    };
  });

/* 最初からいる子と、条件を満たすと現れる子 */
const GIRLS  = CHARA.filter(g => !g.req);
const HIDDEN = CHARA.filter(g =>  g.req);
const ALLG   = CHARA;

/* 間柄のしきい値・テストの点・並び順も、同じところから作る */
const AFFTIERS = {};
const ACADEMIC = {};
const AFF_PRIORITY = CHARA.map(g => g.id);
for (const g of CHARA) {
  const p = STORY[g.id].p;
  if (p.tier) AFFTIERS[g.id] = { ...p.tier };
  if (p.exam) ACADEMIC[g.id] = { base: p.exam.base, grow: p.exam.grow, w: p.exam.w.slice() };
}

/* 誕生日イベント（game.js の FIXED に足されます） */
const BDAYS = CHARA.filter(g => STORY[g.id].p.bday).map(g => {
  const p = STORY[g.id].p;
  /* 「◯◯の誕生日」の◯◯は、story/names.js の mei（名だけ）を使います。
     名前を変えたら、行事の名前も自動でついてきます。 */
  return { m: p.bday.m, d: p.bday.d, id: "bday", who: g.id,
           n: (g.mei || p.bdName || g.name) + "の誕生日", g: "🎂", c: "bd", bg: p.bdBg || "klass" };
});
