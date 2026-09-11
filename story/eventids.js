/* =========================================================================
   イベントID の台帳

   ゲームの中で起きるできごとに、ひとつずつ **固有のID** を付けています。
   このIDで「もう見たか」「まだか」「条件を満たしているか」を判定します。

   ★ここに1行足すだけで、イベント一覧.md にも自動で載ります。
     （`node spec_dump.js && python3 spec.py` で作り直されます）

   ---- 書きかた -------------------------------------------------------------
     id      … 固有のID。**一度決めたら変えないでください**
                （セーブデータに「見たイベント」として残るためです）
     n       … イベント名（一覧に出る名前）
     chara   … 対象キャラクターの id。誰か1人でなければ null
     kind    … 種類。"固定行事" "好感度" "出会い" "部活" "バイト" "誕生日" "進行" "DLC"
     when    … 発生条件（人が読む文章）
     where   … 発生場所（背景のキー。assets/bg/ の名前と同じ）
     needs   … 先に見ておく必要があるイベントIDの並び（任意）
     cond    … いま条件を満たしているかを返す関数（任意）
     sex     … その主人公のときだけ起きるイベント。"m" 男性／"f" 女性。
                書かなければ「男女どちらでも起きる（共通）」です。
                ★ 立場が入れかわるだけ（バレンタインのもらう／渡す など）なら、
                  **IDは共通のままにして、文章のほうを差しかえてください**
                  （story/events_f.js）。IDを分けるのは、片方にしか無い
                  イベントを足すときだけにすると、管理が楽です。
     auto    … true なら、この台帳ではなくデータから自動で作られたもの

   ---- IDの付けかた（そろえておくと探しやすい）------------------------------
     sys_◯◯        物語の進行（入学式・卒業式など）
     fx_◯◯_MMDD    毎年の固定行事（月日つき）
     bday_◯◯       誕生日
     aff_◯◯_1..3   好感度イベント
     meet_◯◯       はじめての出会い
     club_◯◯       部室での初対面
     job_◯◯        バイト先に来る

   ※ 電話・おでかけの「ふつうの会話」はここに入れません。数が多すぎるので、
     story/<名前>.js の tel / date と story/events.js の DATE で別に持っています。
   ========================================================================= */
"use strict";

const EVENT_DEFS = [
  /* ---- 物語の進行 ---- */
  { id:"sys_prologue", n:"入学式（プロローグ）", chara:null, kind:"進行",
    when:"ゲームを始めたとき", where:"school" },
  { id:"sys_firstweek", n:"はじめての予定表", chara:null, kind:"進行",
    when:"入学式のあと、最初の月曜", where:"room", needs:["sys_prologue"] },
  { id:"sys_graduate", n:"卒業式", chara:null, kind:"進行",
    when:"3年目3月1日（さいごの日をこえたとき）", where:"sakura", needs:["sys_prologue"],
    cond:()=>(typeof LAST!=="undefined")&&S.t>=LAST },
  { id:"sys_confess", n:"告白", chara:null, kind:"進行",
    when:"卒業式のあと、好感度600以上の子がいるとき", where:"sakura",
    needs:["sys_graduate"],
    cond:()=>(S.girls||[]).some(g=>affPoint(g)>=600) },
  { id:"sys_epilogue", n:"エピローグ", chara:null, kind:"進行",
    when:"告白のあと", where:"sunset", needs:["sys_graduate"] },
  { id:"sys_ending", n:"エンディング", chara:null, kind:"進行",
    when:"エピローグのあと", where:"sakura", needs:["sys_epilogue"] },

  /* ---- 部活・バイトを決める ---- */
  { id:"sys_joinclub", n:"入部する", chara:null, kind:"進行",
    when:"「入部する」をえらんだとき（帰宅部のあいだ、いつでも）", where:"ground",
    cond:()=>S.club==="none" },
  { id:"sys_pickjob", n:"バイト先をえらぶ", chara:null, kind:"進行",
    when:"バイト先を決めていないときに「バイト」をえらんだとき", where:"town",
    cond:()=>!S.job },

  /* ---- 主人公の誕生日 ---- */
  { id:"bday_hero", n:"主人公の誕生日", chara:null, kind:"誕生日",
    when:"設定した誕生日（毎年）", where:"klass",
    cond:()=>!!S.bd && evFutureDate(S.bd.m,S.bd.d) }
];

/* -------------------------------------------------------------------------
   ここから下は、すでにあるデータから自動で作ります。
   固定行事・誕生日・好感度イベント・出会い・部活・バイトは、
   もとのデータ（FIXED / BDAYS / AFF_EV / INTRO / CLUBMEET / JOBMEET）が
   本体なので、そちらを直せばIDも一覧もついてきます。
   ------------------------------------------------------------------------- */
const EVKIND_BG = { exam:"klass", match:"ground", vacs:"sea", invite:"fest",
  sports:"ground", culture:"school", trip:"town", trip2:"town", trip3:"town",
  newyear:"shrine", valen:"klass", white:"klass" };

/* そのキャラを攻略できるのは、どちらの性別の主人公か。
   相手が女性なら男性主人公（"m"）、相手が男性なら女性主人公（"f"）。
   ★ assets/config.js の GAME_RULE.target を変えているときは、
     targetSex() が答えを決めるので、それに合わせます。 */
/* その子が相手役をつとめる部活のキー。
   CLUBS の相手役（linkCast がいまのキャストぶんだけ付ける）を先に見て、
   付いていなければ、その子のファイルの p.clubs から引きます。 */
function clubKeyOf(gid){
  if(typeof CLUBS!=="undefined"){
    const k=Object.keys(CLUBS).find(k2=>CLUBS[k2].mate===gid);
    if(k)return k;
  }
  const st=(typeof STORY!=="undefined")&&STORY[gid];
  const c=st&&st.p&&(st.p.clubs||[])[0];
  return (c&&typeof CLUBS!=="undefined"&&CLUBS[c])?c:null;
}
function evSexOf(gid){
  const g=(typeof ALLG!=="undefined")&&ALLG.find(x=>x.id===gid);
  if(!g)return null;
  if(typeof targetSex!=="function")return (g.sex==="m")?"f":"m";
  return (targetSex("m")===g.sex) ? "m" : "f";
}

/* 2けたにそろえる（4月5日 → 0405） */
const evMMDD = (m,d) => (m<10?"0":"")+m+(d<10?"0":"")+d;

/* その月日が、これから先（今日をふくむ）にまだ来るか */
function evFutureDate(m,d,y){
  if(typeof CAL==="undefined")return true;
  for(let t=Math.max(0,S.t|0); t<CAL.length; t++){
    const c=CAL[t];
    if(c.m===m && c.d===d && (!y || c.y===y)) return true;
  }
  return false;
}

function buildEventDefs(){
  const out = EVENT_DEFS.slice();
  const has = id => out.some(e=>e.id===id);

  /* 固定行事（毎年くり返すものは、月日でひとつのIDにまとめます）
     FIXED には誕生日（下でまとめます）と追加シナリオ（DLC）も合流しています */
  if(typeof FIXED!=="undefined")for(const f of FIXED){
    if(f.id==="bday")continue;                       /* 誕生日は下でまとめて */
    const dlc = (typeof f.run==="function");
    const id  = f.eid || "fx_"+f.id+"_"+evMMDD(f.m,f.d);
    if(has(id))continue;
    out.push({ id, n:f.n, chara:f.who||null, kind:dlc?"DLC":"固定行事", auto:true, sex:(f.who?evSexOf(f.who):(f.sex||null)),
      when:`${f.m}月${f.d}日`+(f.y?`（${f.y}年目だけ）`:"（毎年）")
        +(f.id==="match"?"／運動部のときだけ":"")
        +(f.need?`／好感度 ${f.need} 以上の子がいるとき`:""),
      where:f.bg||EVKIND_BG[f.id]||"klass",
      cond:()=>{
        if(!evFutureDate(f.m,f.d,f.y))return false;                 /* もう過ぎている */
        if(f.id==="match" && typeof SPORTS_CLUB!=="undefined"
           && !SPORTS_CLUB[S.club])return false;                    /* 運動部だけ */
        if(f.need && !(S.girls||[]).some(g=>g.aff>=f.need))return false;
        return true;
      } });
  }

  /* 誕生日 */
  if(typeof BDAYS!=="undefined")for(const b of BDAYS){
    out.push({ id:"bday_"+b.who, n:b.n, chara:b.who, kind:"誕生日", auto:true, sex:evSexOf(b.who),
      when:`${b.m}月${b.d}日（毎年）／その子が登場していること`, where:b.bg||"klass",
      cond:()=>evFutureDate(b.m,b.d) && (S.girls||[]).some(g=>g.id===b.who) });
  }

  /* 好感度イベント（3本ずつ。前のものを見てから次が出ます） */
  if(typeof AFF_EV!=="undefined")for(const gid in AFF_EV){
    AFF_EV[gid].forEach((e,i)=>{
      out.push({ id:`aff_${gid}_${i+1}`, n:e.t, chara:gid, kind:"好感度", auto:true, sex:evSexOf(gid),
        when:`好感度 ${e.at} 以上／週の終わり`,
        where:e.bg||"sunset",
        needs:i>0?[`aff_${gid}_${i}`]:[],
        cond:()=>{const g=(S.girls||[]).find(x=>x.id===gid); return !!g&&affPoint(g)>=e.at;} });
    });
  }

  /* はじめての出会い（隠れヒロイン） */
  if(typeof INTRO!=="undefined")for(const gid in INTRO){
    const g=(typeof ALLG!=="undefined")&&ALLG.find(x=>x.id===gid);
    const req=g&&g.req;
    out.push({ id:"meet_"+gid, n:(g?g.name:gid)+"と出会う", chara:gid, kind:"出会い", auto:true, sex:evSexOf(gid),
      when:req?`${req.n}が${req.v}以上になったとき`:"最初から知っている",
      where:INTRO[gid].bg||"school",
      cond:()=>{ if(!req)return true;
        return Math.round((S.p&&S.p[req.p])||0)>=req.v; } });
  }

  /* 部室での初対面（その子が相手役になる部活の部室） */
  if(typeof CLUBMEET!=="undefined")for(const gid in CLUBMEET){
    const g=(typeof ALLG!=="undefined")&&ALLG.find(x=>x.id===gid);
    /* ★ CLUBS[].mate は「いま選んでいる主人公のぶん」しか付いていません。
       台帳は男女ぜんぶを載せるので、付いていない子は、その子のファイル
       （story/<id>.js の p.clubs）から部活を引きます。 */
    const ck=clubKeyOf(gid);
    const cn=(ck&&CLUBS[ck])?CLUBS[ck].n:"その子のいる部活";
    out.push({ id:"club_"+gid, n:(g?g.name:gid)+"と部室で会う", chara:gid, kind:"部活", auto:true, sex:evSexOf(gid),
      when:`${cn}に入部したとき`, where:(ck&&CLUBS[ck]&&CLUBS[ck].bg)||"klass",
      cond:()=>ck?S.club===ck:false });
  }

  /* バイト先に来る（背景はえらんだバイト先によって変わります） */
  if(typeof JOBMEET!=="undefined")for(const gid in JOBMEET){
    const g=(typeof ALLG!=="undefined")&&ALLG.find(x=>x.id===gid);
    out.push({ id:"job_"+gid, n:(g?g.name:gid)+"がバイト先に来る", chara:gid, kind:"バイト", auto:true, sex:evSexOf(gid),
      when:"バイトのコマンド1回につき1.0%の抽選／好感度50以上",
      where:"（えらんだバイト先）",
      cond:()=>{const x=(S.girls||[]).find(y=>y.id===gid); return !!S.job&&!!x&&x.aff>=50;} });
  }

  /* ※ 追加シナリオ（DLC）は FIXED に合流しているので、上の固定行事といっしょに拾われます */
  return out;
}
