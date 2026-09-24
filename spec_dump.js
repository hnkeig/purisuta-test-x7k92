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
  /* ★ ここが読むのは「組み立てたあとの starmate.html」です。
     本文やゲーム側を直しただけで build.py を走らせていないと、
     **ひとつ前の中身から仕様書が作られて**しまいます。
     いちばん新しい材料より古ければ、そのことを知らせます。 */
  (()=>{
    const built=fs.statSync(path.join(HERE,'starmate.html')).mtimeMs;
    const src=[];
    for(const f of ['game.js','style.css','index.html','story.js','assets.js'])
      if(fs.existsSync(path.join(HERE,f)))src.push(path.join(HERE,f));
    for(const d of ['story','assets'])
      if(fs.existsSync(path.join(HERE,d)))
        for(const f of fs.readdirSync(path.join(HERE,d)))
          if(f.endsWith('.js'))src.push(path.join(HERE,d,f));
    const newer=src.filter(f=>fs.statSync(f).mtimeMs>built+1000);
    if(newer.length){
      console.log('  ※ starmate.html より新しいファイルがあります（'+newer.length+'個）。');
      console.log('    仕様書を最新にするには、先に  python3 build.py  を実行してください。');
      console.log('    例: '+path.relative(HERE,newer[0]));
    }
  })();
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1200,height:675}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(600);
  const d=await p.evaluate(()=>{

  /* ---- そのイベントの「文章がどこに書いてあるか」------------------------
     イベント一覧.md の「文章の場所」の欄になります。
     ここを直したら、イベントを足したときにも迷わないよう、
     story/eventids.js の書きかたに合わせて足してください。 */
  const EVTEXT_SYS={
    sys_prologue :"`story/events.js` の `TXT.pro` ＋ `story/<キャラid>.js` の `pro`",
    sys_firstweek:"―（予定表の画面だけ。文章はありません）",
    sys_graduate :"`story/events.js` の `TXT.ending`",
    sys_confess  :"`story/events.js` の `TXT.ending`（`go` `pick` `nobody`）",
    sys_epilogue :"`story/events.js` の `TXT.epi` ＋ `story/<キャラid>.js` の `after`（卒業後の一言）・`course`（進路）",
    sys_ending   :"`story/events.js` の `TXT.epi`（`closeWith` `closeSolo` `last`）",
    sys_joinclub :"`story/events.js` の `CLUBPICK`（えらぶ画面）＋ `CLUBJOIN`（入部の場面）",
    sys_pickjob  :"―（店の名前だけ。`assets/config.js` の `JOBS`）",
    bday_hero    :"`story/events.js` の `TXT.mybday`"
  };
  /* fx_◯◯_MMDD の ◯◯ ＝ FIXED の id */
  const EVTEXT_FX={
    exam   :"`story/events.js` の `TXT.exam`（優等生の反応は `story/events_f.js` でも差しかえ）",
    match  :"`story/events.js` の `TXT.match`",
    vacs   :"`story/events.js` の `TXT.vac`",
    invite :"`story/events.js` の `TXT.invite`",
    sports :"`story/events.js` の `TXT.sports`",
    culture:"`story/events.js` の `TXT.culture` ＋ `TXT.cultresult`",
    trip   :"`story/events.js` の `TXT.trip`",
    trip2  :"`story/events.js` の `TXT.trip`",
    trip3  :"`story/events.js` の `TXT.trip`",
    newyear:"`story/events.js` の `TXT.newyear`",
    valen  :"`story/events.js` の `TXT.valen`（もらう側）／`TXT.valenGive`（渡す側）",
    white  :"`story/events.js` の `TXT.whiteGet`（もらう側）／`TXT.white`（渡す側）"
  };
  function evTextWhere(e){
    if(EVTEXT_SYS[e.id])return EVTEXT_SYS[e.id];
    const g=e.chara;
    if(e.kind==="好感度"){
      const n=String(e.id).split("_").pop();
      return "`story/"+g+".js` の `ev[" + (Number(n)-1) + "]`（"+n+"本目）";
    }
    if(e.kind==="出会い") return "`story/"+g+".js` の `intro`";
    if(e.kind==="部活")   return "`story/"+g+".js` の `clubmeet`";
    if(e.kind==="バイト") return "`story/"+g+".js` の `job`";
    if(e.kind==="アフター")return "`story/"+g+".js` の `afterStory`";
    if(e.kind==="誕生日") return "`story/events.js` の `TXT.bday` ＋ `story/"+g+".js` の `bdayGift`";
    if(e.kind==="固定行事"){
      const m=String(e.id).match(/^fx_(.+)_\d{4}$/);
      return (m&&EVTEXT_FX[m[1]])||"`story/events.js` の `TXT`";
    }
    if(e.kind==="DLC")    return "追加シナリオのファイル（`DLC_EVENTS` に足したところ）";
    return "―";
  }

  return ({
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
      after:STORY[k].after?Object.keys(STORY[k].after):[],
      /* そのファイルに、どの項目が書いてあるか（イベント一覧.md の「ファイルの中身」） */
      has:["q","pro","tel","telFar","date","ev","intro","clubmeet","job",
           "bdayGift","after","course","afterStory","prof"]
          .reduce((o,key)=>{const v=STORY[k][key];
            o[key]=!!v&&!(Array.isArray(v)&&!v.length); return o;},{})})),
    affEv:Object.keys(AFF_EV).map(k=>({k,n:AFF_EV[k].length,at:AFF_EV[k].map(e=>e.at)})),
    /* イベントID の台帳（イベント一覧.md のもと） */
    events:evAll().map(e=>({id:e.id,n:e.n,chara:e.chara||null,kind:e.kind,
      sex:e.sex||null,
      when:e.when,where:e.where,needs:(e.needs||[]).slice(),auto:!!e.auto,
      text:evTextWhere(e)})),
    /* ---- 枝分かれ（同じイベントの中で、相手や好感度で変わるところ）----
       イベント一覧.md の「枝分かれ」の章のもとになります。 */
    branches:(()=>{
      const cut=t=>String(t||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
      const TN={normal:"普通",friend:"友達",crush:"気になる人",love:"好き"};
      /* バイト先で会う（1人 4バイト先 × 4好感度） */
      const job=[];
      for(const d of castGal()){
        for(const jk of Object.keys(JOBS)) for(const t of JOBTIERS){
          const E=(JOBMEET[d.id]||{})[jk];
          const e=E&&!E.b?E[t]:null;
          job.push({gid:d.id, name:d.name, sex:evSexOf(d.id),
            job:jk, jobName:JOBS[jk].n, tier:t, tierName:TN[t],
            ある:!!e, bg:JOBS[jk].bg,
            head:e?cut(e.b[0]):"", line:e?e.b.length:0,
            opts:e?e.o.map(o=>({t:cut(o.t),d:o.d})):[]});
        }
      }
      /* 修学旅行（1日目〜3日目・夜）の枝 */
      const T=TXT.trip||{}, N=T.night||{};
      const n=x=>Array.isArray(x)?x.length:(x?1:0);
      const tiersOf=o=>o?JOBTIERS.filter(t=>o[t]!==undefined).map(t=>TN[t]).join("・"):"";
      const trip=[
        {day:"1日目",key:"intro",      cond:"かならず",                            tier:"",      line:n(T.intro)},
        {day:"1日目",key:"invited",    cond:"好感度いちばんの子が誘ってくる",      tier:tiersOf(T.invited),  line:Object.keys(T.invited||{}).length},
        {day:"1日目",key:"accepted",   cond:"その誘いを受けたとき",                tier:tiersOf(T.accepted), line:Object.keys(T.accepted||{}).length},
        {day:"1日目",key:"declined",   cond:"その誘いを断ったとき",                tier:tiersOf(T.declined), line:Object.keys(T.declined||{}).length},
        {day:"1日目",key:"ask",        cond:"誰も誘ってこないとき（自分で選ぶ）",  tier:"",      line:n(T.ask)},
        {day:"1日目",key:"ok",         cond:"自分から誘って、受けてもらえたとき",  tier:"",      line:n(T.ok)},
        {day:"1日目",key:"refuse",     cond:"自分から誘って、断られたとき",        tier:"",      line:n(T.refuse)},
        {day:"1日目",key:"day1",       cond:"相手がいるときの自由行動",            tier:tiersOf(T.day1), line:Object.keys(T.day1||{}).length},
        {day:"1日目",key:"aloneDay1",  cond:"相手がいないときの自由行動",          tier:"",      line:n(T.aloneDay1)},
        {day:"1日目の夜",key:"night.friends",cond:"「好き」の子がいないとき（同室の友達と）",tier:"",line:n(N.friends)},
        {day:"1日目の夜",key:"night.meet",   cond:"「好き」の子がいるとき",         tier:"",      line:n(N.meet)+n(N.with)},
        {day:"1日目の夜",key:"night.opts",   cond:"そのときの選択肢",               tier:"",      line:n(N.opts)},
        {day:"1日目の夜",key:"night.after",  cond:"選んだあと",                     tier:"",      line:n(N.after&&N.after.line)+n(N.after&&N.after.say)},
        {day:"2日目",key:"day2",       cond:"相手がいるとき",                      tier:tiersOf(T.day2), line:Object.keys(T.day2||{}).length},
        {day:"2日目",key:"aloneDay2",  cond:"相手がいないとき",                    tier:"",      line:n(T.aloneDay2)},
        {day:"3日目",key:"day3.with",  cond:"相手がいるとき",                      tier:"",      line:n((T.day3||{}).with)},
        {day:"3日目",key:"day3.alone", cond:"相手がいないとき",                    tier:"",      line:n((T.day3||{}).alone)}
      ];
      /* 夜の選択肢そのもの */
      const tripOpts=(N.opts||[]).map(o=>({t:cut(o.t),d:o.d||100}));
      /* 好感度4段階で文章が変わるところ（バイト・修学旅行いがい） */
      const tierBox=[];
      const push=(ev,where,what,o)=>{ if(!o)return;
        const have=JOBTIERS.filter(t=>o[t]!==undefined);
        if(!have.length)return;
        tierBox.push({ev,where,what,
          tiers:have.map(t=>TN[t]),
          ぜんぶ:have.length===4,
          落ちる:JOBTIERS.filter(t=>o[t]===undefined).map(t=>TN[t])}); };
      push("テスト（中間・期末・学年末）","TXT.exam.top","順位を言い合うところ",(TXT.exam||{}).top);
      push("バレンタイン（渡す側）","TXT.valenGive.react","渡したときの反応",(TXT.valenGive||{}).react);
      push("ホワイトデー（もらう側）","TXT.whiteGet.react","もらったときの反応",(TXT.whiteGet||{}).react);
      push("ホワイトデー（渡す側）","TXT.white.react","渡したときの反応",(TXT.white||{}).react);
      push("お正月（初詣）","TXT.newyear.tier","おみくじのあとの会話",(TXT.newyear||{}).tier);
      push("修学旅行 1日目","TXT.trip.day1","自由行動",(TXT.trip||{}).day1);
      push("修学旅行 2日目","TXT.trip.day2","自由行動",(TXT.trip||{}).day2);
      push("修学旅行 1日目","TXT.trip.invited","誘われかた",(TXT.trip||{}).invited);
      /* 相手役（cue）で引くところ */
      const cue=castGal().filter(x=>x.cue).map(x=>({gid:x.id,name:x.name,cue:x.cue}));
      /* 1人ぶんの会話の本数 */
      const perChara=castGal().map(d=>{
        const S2=STORY[d.id]||{};
        const cnt=o=>o?Object.keys(o).map(k=>`${TN[k]||k} ${o[k].length}本`).join("／"):"―";
        return {gid:d.id,name:d.name,
          tel:cnt(S2.tel), date:cnt(S2.date),
          telFar:(S2.telFar||[]).length,
          aff:(S2.ev||[]).length, after:Object.keys(S2.after||{}).length,
          q:Object.keys(S2.q||{}).length};
      });
      /* 卒業後の進路（1人5通り）。条件はまだ仮です */
      const PN={study:"学力",sport:"運動",art:"芸術",charm:"魅力",care:"気配り",trend:"流行",rich:"リッチ度"};
      const course=[];
      for(const d of castGal()){
        const C=(typeof COURSE!=="undefined")?COURSE[d.id]:null;
        const k=(typeof courseStatOf==="function")?courseStatOf(d):"";
        for(const key of (typeof COURSEKEYS!=="undefined"?COURSEKEYS:["near","away","top","same","main"])){
          const c=C&&C[key];
          course.push({gid:d.id, name:d.name, sex:evSexOf(d.id), key,
            得意:PN[k]||k,
            n:c?c.n:"", cond:c?c.cond:"", b:c?c.b.map(cut):[]});
        }
      }
      /* アフターストーリー（結ばれて卒業したあと） */
      const after=castGal().map(d=>{
        const A=(typeof AFTERSTORY!=="undefined")?AFTERSTORY[d.id]:null;
        return {gid:d.id, name:d.name, sex:evSexOf(d.id),
          ある:!!A, when:A?A.when:"", bg:A?A.bg:"",
          cg:A?((A.cg)||((typeof AFTER_RULE!=="undefined"&&AFTER_RULE.cg)||30)):0,
          前:A?(A.b||[]).length:0, 後:A?(A.b2||[]).length:0,
          スチル文:A?(A.cgb||[]).length:0,
          出だし:A?cut((A.b||[])[0]):"",
          opts:A?(A.o||[]).map(o=>cut(o.t)):[]};
      });
      /* 誕生日プレゼント（1人 好感度4段階 × 贈りもの3種類） */
      const bday=[];
      for(const d of castGal()){
        const B=(typeof BDAYGIFT!=="undefined")?BDAYGIFT[d.id]:null;
        for(const t of BDAYTIERS) for(const k of BDAYKINDS){
          const r=B&&B[t]&&B[t][k];
          bday.push({gid:d.id, name:d.name, sex:evSexOf(d.id),
            tier:t, tierName:BDAYTIERNAME[t], kind:k, kindName:BDAYKINDNAME[k],
            ある:!!r, line:r?cut(r.line):"", say:r?cut(r.say):"",
            ex:r?(r.ex||""):"", d:r?(+r.d||0):0});
        }
      }
      return {job, trip, tripOpts, tierBox, cue, perChara, course, after, bday,
              bdayKinds:BDAYKINDS.map(k=>BDAYKINDNAME[k]),
              bdayTiers:BDAYTIERS.map(t=>BDAYTIERNAME[t]),
              courseOrder:(typeof COURSEKEYS!=="undefined")?COURSEKEYS:[]};
    })(),
    /* ---- セリフの選ばれかた（セリフのしくみ.md のもと）---- */
    lines:(()=>{
      const cut=t=>String(t||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
      const TN={normal:"普通",friend:"友達",crush:"気になる人",love:"好き"};
      const T=(typeof TXT!=="undefined")?TXT:{};
      /* おでかけ先ごとの選択肢 */
      const places=Object.keys((typeof DATE!=="undefined")?DATE:{}).map(k=>{
        const P0=PLACES.find(p=>p.id===k)||{};
        return {id:k, n:P0.n||k, need:P0.need||"", s:P0.s||"",
          rounds:DATE[k].length,
          opts:DATE[k].map(r=>r.length),
          ks:DATE[k].map(r=>r.map(o=>o.k||"ok")),
          例:cut((DATE[k][0]&&DATE[k][0][0]&&DATE[k][0][0].t)||"")};
      });
      /* あいさつ3種（q） */
      const q=castGal().map(d=>{
        const st=(typeof STORY!=="undefined")&&STORY[d.id], o=(st&&st.q)||{};
        return {gid:d.id, name:d.name, sex:evSexOf(d.id),
          hi:cut(o.hi), ok:cut(o.ok), bad:cut(o.bad)};});
      /* 電話の第一声（いちばん最初の1本だけ、見本として） */
      const tel=castGal().map(d=>{
        const st=(typeof STORY!=="undefined")&&STORY[d.id];
        const t=(st&&st.tel)||{};
        return {gid:d.id, name:d.name, sex:evSexOf(d.id),
          far:cut(st&&st.telFar),
          n:Object.keys(TN).map(k=>((t[k]||[]).length)),
          例:Object.keys(TN).map(k=>cut((t[k]||[])[0]||""))};});
      /* おでかけの返事 */
      const date=castGal().map(d=>{
        const st=(typeof STORY!=="undefined")&&STORY[d.id];
        const t=(st&&st.date)||{};
        return {gid:d.id, name:d.name, sex:evSexOf(d.id),
          n:Object.keys(TN).map(k=>((t[k]||[]).length)),
          例:Object.keys(TN).map(k=>cut((t[k]||[])[0]||""))};});
      /* その子の好き／苦手な場所 */
      const pref=castGal().map(d=>{
        const g=castAll().find(x=>x.id===d.id)||{};
        const nm2=id=>(PLACES.find(p=>p.id===id)||{}).n||id;
        return {gid:d.id, name:d.name, sex:evSexOf(d.id),
          like:(g.like||[]).map(nm2), hate:(g.hate||[]).map(nm2)};});
      return {places, q, tel, date, pref,
        datePlay:{ask:cut(T.datePlay&&T.datePlay.ask),
          res:Object.keys((T.datePlay&&T.datePlay.res)||{}).map(k=>({k, t:cut(T.datePlay.res[k])}))},
        dateShift:(typeof DATE_SHIFT!=="undefined")?DATE_SHIFT:{},
        dateAff:(typeof DATE_AFF!=="undefined")?DATE_AFF:{},
        rankJa:(typeof RANKJA!=="undefined")?RANKJA:{},
        telRule:{far:28, farAdd:50, highAdd:40, lowAdd:25, highAt:400, stress:-4},
        dateRule:{needAff:80, needRich:8, base:50, like:110, hate:-90, normal:20,
          need80:70, need40:30, need15:-40, stress65:-40, rnd:25, air:0.55,
          recent:21, recentMul:0.6, capDiv:1250, capMin:0.15},
        affTierDef:(typeof AFFTIER_DEF!=="undefined")?AFFTIER_DEF:{},
        mood:["まだ知らない","ほぼ他人","顔は知っている"],
        girlLineKinds:[["tel","電話の第一声"],["date","おでかけの返事"]]};
    })(),
    charaNames:(typeof CHARA_NAMES!=="undefined")?CHARA_NAMES:{},
    endThresh:{true:780, happy:680, friend:600},
    when:new Date().toISOString().slice(0,10)
  });
  });
  fs.writeFileSync(path.join(HERE,'spec_dump.json'), JSON.stringify(d,null,1));
  console.log('  spec_dump.json を書き出しました（項目 '+Object.keys(d).length+'）');
  if(errs.length)console.log('  ※ページのエラー:',errs.slice(0,3));
  await b.close();
})();
