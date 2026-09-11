/* =========================================================================
   仕様書のもとになる数値を、実際に動いているゲームから抜き出す道具
     node spec_dump.js          → spec_dump.json を書き出す
   そのあと  python3 spec.py    で 仕様書.md ができます。
   （ゲームを直したら、この2つを走らせるだけで仕様書も最新になります）
   ========================================================================= */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

/* `node spec_dump.js | head -1` のように表示を途中で打ち切られても、
   spec_dump.json を書き出すところまでは走りきるようにしておく。
   （表示が届かなくても、黙って先へ進みます） */
process.stdout.on('error', ()=>{});

const HERE = __dirname;
const FILE = 'file://' + path.join(HERE, 'starmate.html');

(async()=>{
  if(!fs.existsSync(path.join(HERE,'starmate.html'))){
    console.error('starmate.html がありません。先に python3 build.py を実行してください。');
    process.exit(1);
  }
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1200,height:675}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(600);
  const d=await p.evaluate(()=>({
    LAST, days:CAL.length, first:CAL[0], last:CAL[CAL.length-1], MORDER, MLEN,
    P, CMD, CMDKEYS, CLUBS, BLOOD, JOBS, SPORTS_CLUB,
    ZODIAC:ZODIAC.map(z=>({m:z.m,d:z.d,n:z.n,up:z.up,v:z.v,d2:z.d2})), BASE_P,
    PLACES, DATE_SHIFT, DATE_AFF,
    FIXED, HOL_FIX, HOL_NTH,
    MAXAFF, AFFTIERS, AFFNAME, AFF_PRIORITY, AFFSTARS,
    girls:ALLG.map(g=>({id:g.id,name:g.name,role:g.role,ideal:g.ideal,
      like:g.like,hate:g.hate,req:g.req||null,aff0:g.aff,
      club:g.club||"",bday:g.bday||null,stat:g.stat||null,
      prof:g.prof?Object.keys(g.prof):[]})),
    /* 女の子じしんの能力（くわしく画面のゲージ） */
    GIRL:{keys:GIRL_STATK, max:GIRL_MAX, grow:GIRL_GROW_DEF, base:GIRL_BASE_DEF},
    EXAMBAR, ACADEMIC, SUBJ,
    EXAM:{mean:EXAM_MEAN, sd:EXAM_SD, n:EXAM_N},
    examNeed:[1,2,3].map(y=>({y, r1:examNeed(1,y), r10:examNeed(10,y),
      r50:examNeed(50,y), r150:examNeed(150,y)})),
    TITLES:TITLES.map(t=>({id:t.id,c:t.c,n:t.n,w:t.w,d:t.d})),
    TRACKS:Object.keys(TRACKS).map(k=>({k,n:TRACKS[k].n,bpm:TRACKS[k].bpm})),
    ENDNAME, TSPEEDS, SPEEDS, BGFADES, JOBVISIT_DEF, VNFS_SCALE,
    GAME_TITLE, UI_RULE, SAVE_FACE,
    KEYS:{save:SAVEKEY, opt:OPTKEY, speed:SPEEDKEY, gal:GALKEY},
    SAVE_FACE_MIN_JA:AFFNAME[SAVEFACE.min]||SAVEFACE.min,
    SAVE_FACE_TIERS:(SAVEFACE.tiers||[]).map(t=>t+"（"+(AFFNAME[t]||t)+"）"),
    scenes:galList().length,
    placesRounds:(typeof DATE!=="undefined")?Object.keys(DATE).length:0,
    story:Object.keys(STORY).map(k=>({k,
      tel:STORY[k].tel?Object.keys(STORY[k].tel).map(t=>STORY[k].tel[t].length):[],
      date:STORY[k].date?Object.keys(STORY[k].date).map(t=>STORY[k].date[t].length):[],
      ev:STORY[k].ev?STORY[k].ev.map(e=>({t:e.t,at:e.at})):[],
      after:STORY[k].after?Object.keys(STORY[k].after):[]})),
    affEv:Object.keys(AFF_EV).map(k=>({k,n:AFF_EV[k].length,at:AFF_EV[k].map(e=>e.at)})),
    /* イベントID の台帳（イベント一覧.md のもと） */
    events:evAll().map(e=>({id:e.id,n:e.n,chara:e.chara||null,kind:e.kind,
      sex:e.sex||null,
      when:e.when,where:e.where,needs:(e.needs||[]).slice(),auto:!!e.auto})),
    charaNames:(typeof CHARA_NAMES!=="undefined")?CHARA_NAMES:{},
    endThresh:{true:780, happy:680, friend:600},
    when:new Date().toISOString().slice(0,10)
  }));
  fs.writeFileSync(path.join(HERE,'spec_dump.json'), JSON.stringify(d,null,1));
  console.log('  spec_dump.json を書き出しました（項目 '+Object.keys(d).length+'）');
  if(errs.length)console.log('  ※ページのエラー:',errs.slice(0,3));
  await b.close();
})();
