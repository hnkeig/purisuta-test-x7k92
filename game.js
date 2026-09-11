/* =========================================================================
   スターメイト
   game.js
   プログラム本体。予定の処理・パラメータ計算・セーブ・描画など。
   ========================================================================= */
"use strict";
/* =======================================================================
   0. 画面フィット
   ======================================================================= */
/* ノベル画面の本文の大きさ。1 = メッセージ枠いっぱいに3行、0.7 = その7割 */
const VNFS_SCALE=0.70;

/* ★ゲーム名。タイトルを変えたいときは、この1行だけ書きかえてください。
   ・タイトル画面のロゴ（assets/ui/logo.* を置いていないとき）
   ・ブラウザのタブに出る名前
   の両方が、ここから決まります。
   （説明書やファイル名は別なので、そちらは必要に応じて直してください） */
const GAME_TITLE="スターメイト";
try{ document.title=GAME_TITLE; }catch(e){}

function insets(){
  const el=document.getElementById("safe");
  if(!el)return {t:0,r:0,b:0,l:0};
  const c=getComputedStyle(el);
  return {t:parseFloat(c.paddingTop)||0, r:parseFloat(c.paddingRight)||0,
          b:parseFloat(c.paddingBottom)||0, l:parseFloat(c.paddingLeft)||0};
}
/* ---- 無料ホームページの「広告よけ」-------------------------------------
   忍者ホームページ（gozaru.jp など）の無料スペースに置くと、
   サーバーがページの終わりに、こういう固まりを勝手に足します。

     <div style="text-align:center">
       <div style="display:inline-block;position:relative;z-index:9999">
         …336×280 くらいの広告…
       </div>
     </div>

   ・**まんなか寄せ**で、
   ・**z-index が 9999**（ゲームのどの部品よりも上）
   なので、そのままだとゲーム画面の上のまんなかに、幅300px ほどの
   「見えない板」が乗っているのと同じことになります。その結果、

     ・選択肢の**まんなかだけ押せない**（両はしは押せる）
     ・スマホは画面が小さいので、**ボタンがほとんど押せない**
       （タップ自体はページに届くので、音だけは鳴る）

   という、まさに報告どおりの不具合になります。

   広告そのものは消しません（消すと無料スペースの規約ちがいになります）。
   かわりに、**ゲーム画面のほうを広告のぶんだけずらして**、重ならないように
   します。ふつうの場所（自分のサーバー、file://、1ファイル版）に置いた
   ときは、よける相手がいないので、なにも起きません。

   assets/config.js の HOST_AD で切りかえられます。 */
const HOSTAD=(typeof HOST_AD!=="undefined")?HOST_AD:{};
const HOSTPAD={t:0,b:0};
/* ゲーム自身の入れもの。これ以外の body 直下の箱を「よその物」とみなします */
const HOSTMINE={safe:1,rotate:1,fit:1};
function hostScan(){
  const was=HOSTPAD.t+"/"+HOSTPAD.b;
  HOSTPAD.t=0; HOSTPAD.b=0;
  const body=document.body;
  if(body && HOSTAD.avoid!==false){
    const vh=(window.visualViewport&&visualViewport.height)||innerHeight||1;
    let t=0,b=0;
    for(let i=0;i<body.children.length;i++){
      const el=body.children[i], tag=el.tagName;
      if(tag==="SCRIPT"||tag==="STYLE"||tag==="LINK"||tag==="NOSCRIPT"||tag==="TEMPLATE")continue;
      if(el.id && HOSTMINE[el.id])continue;
      const s=getComputedStyle(el);
      if(s.display==="none"||s.visibility==="hidden"||parseFloat(s.opacity)===0)continue;
      const r=el.getBoundingClientRect();
      /* 1×1 の計測用タグや、画面の外に出ているものは数えません */
      if(r.width<60||r.height<16)continue;
      if(r.bottom<=0||r.top>=vh)continue;
      if((r.top+r.bottom)/2 < vh/2) t=Math.max(t,Math.min(r.bottom,vh));
      else                          b=Math.max(b,Math.min(vh-r.top,vh));
    }
    /* 空けすぎてゲームが遊べなくならないように、上限を決めておきます */
    const mt=(typeof HOSTAD.maxTop   ==="number")?HOSTAD.maxTop   :0.45;
    const mb=(typeof HOSTAD.maxBottom==="number")?HOSTAD.maxBottom:0.30;
    HOSTPAD.t=Math.max(0,Math.round(Math.min(t,vh*mt)));
    HOSTPAD.b=Math.max(0,Math.round(Math.min(b,vh*mb)));
  }
  return was!==(HOSTPAD.t+"/"+HOSTPAD.b);   /* 前とちがったら true */
}
/* ---- ノベル画面の見た目の設定（assets/config.js の VN_UI）--------------
   位置と大きさは、ぜんぶ「割合」です。fit() より前に置いてください。 */
const VNUI=(typeof VN_UI!=="undefined")?VN_UI:{};
const vnu=(k,d)=>(typeof VNUI[k]==="number"?VNUI[k]:d);
/* 絵の「よこ÷たて」を読みとって、入れものを絵とぴったり同じ形にする
   （そうしないと、上下や左右にすき間ができて位置がずれます） */
function artAspect2(src,varName){
  const im=new Image();
  im.onload=()=>{ if(im.naturalHeight)
    document.getElementById("stage").style.setProperty(varName,
      (im.naturalWidth/im.naturalHeight).toFixed(4)); };
  im.src=src;
}
/* メッセージ枠の「よこ÷たて」。新しい枠を置くと、その絵の形にそろえます */
const VNPANEL={ar:960/218, def:960/218};
/* 顔の写真枠の「よこ÷たて」。ui_photo_frame.png を置くと、その絵の形になります */
const VNPHOTO={ar:402/505, def:402/505, maskOK:false};

function fit(){
  const st=document.getElementById("stage"), ft=document.getElementById("fit");
  const ins=insets();
  /* よその広告が乗っていたら、そのぶんも空ける（ふだんは 0） */
  hostScan();
  const insT=ins.t+HOSTPAD.t, insB=ins.b+HOSTPAD.b;
  const vvW=(window.visualViewport&&visualViewport.width)||innerWidth;
  const vvH=(window.visualViewport&&visualViewport.height)||innerHeight;
  const vw=Math.max(240,Math.round(vvW-ins.l-ins.r));
  /* 下限は 120。ふつうの画面では効きませんが、広告よけで上を大きく空けたとき、
     ゲーム画面が入れものからはみ出さないようにするためのものです */
  const vh=Math.max(120,Math.round(vvH-insT-insB));
  ft.style.left=ins.l+"px"; ft.style.right=ins.r+"px";
  ft.style.top=insT+"px";  ft.style.bottom=insB+"px";
  const mob=(vw<1100||vh<620), portrait=vh>vw*1.05;
  document.body.classList.toggle("mb",mob);
  document.body.classList.toggle("pt",mob&&portrait);
  let W,H;
  if(mob&&!portrait){ W=Math.min(vw,1000); H=Math.round(W*vh/vw); }
  else { W=1200; H=675; }
  st.style.width=W+"px"; st.style.height=H+"px";
  /* メッセージ枠の文字サイズ。
     まず「帯いっぱいに3行が入るギリギリの大きさ」を枠の実寸から逆算し、
     そこに VNFS_SCALE を掛けたものを本文サイズにする。
     枠は画像の比率 960:218 で横幅いっぱいに置かれ、本文はその上36%から下の帯。
     行間は 1.45（style.css の #vnBody line-height と必ず合わせること）。
     ★本文だけ大きさを変えたいときは VNFS_SCALE を上げ下げしてください。
       1 = 帯いっぱい／0.7 = その7割。名前欄と選択肢の大きさは変わりません。 */
  /* 顔画像を左に置くぶん、メッセージ枠は右から始める。
     出ていないときも場所は空けておく（文字の大きさが場面ごとに変わらないように） */
  const FW=(typeof FACE_WINDOW!=="undefined")?FACE_WINDOW:{on:true,width:0.185,widthMb:0.165,height:1.45};
  const edge=mob?5:8;
  /* メッセージ枠の下のすき間。VN_UI の panelBottom（画面の高さに対する割合）で変えられます */
  const V0=(typeof VN_UI!=="undefined")?VN_UI:{};
  const vnb=(typeof V0.panelBottom==="number")
    ? Math.max(0,Math.round(H*V0.panelBottom)) : (mob?7:12);
  st.style.setProperty("--vnwb", vnb+"px");
  const fww=FW.on ? Math.round(W*(mob?(FW.widthMb||0.165):(FW.width||0.185))) : 0;
  const wgap=FW.on ? (mob?4:6) : 0;
  st.style.setProperty("--fww", fww+"px");
  st.style.setProperty("--vnwl", (edge+fww+wgap)+"px");
  const fw=W-(edge*2)-fww-wgap;     /* メッセージ枠の横幅 */
  /* 枠の高さは、枠の絵の「よこ÷たて」から出す。
     assets/ui/ui_dialogue_panel.png を置くと、その絵の形にそろいます */
  const frameH=fw/VNPANEL.ar;
  st.style.setProperty("--vnar", VNPANEL.ar.toFixed(4));
  /* 本文が入る帯（枠の高さに対する割合）。新しい枠のときは VN_UI の値を使う */
  const bTop=(typeof V0.bodyTop==="number")?V0.bodyTop:0.36;
  const bH  =(typeof V0.bodyH  ==="number")?V0.bodyH  :(1-0.36-0.035);
  const bodyH=frameH*bH;            /* 本文が入る帯の高さ */
  const full=Math.max(11,Math.min(40,(bodyH-4)/(3*1.45)));   /* 帯いっぱいの大きさ */
  /* 本文の大きさ。新しい枠のときは VN_UI の bodyScale（帯いっぱい＝1）を使います */
  const fsScale=(typeof V0.bodyScale==="number")?V0.bodyScale:VNFS_SCALE;
  const fs=Math.max(10, full*fsScale);
  st.style.setProperty("--vnfs", fs.toFixed(1)+"px");
  /* 本文の入れものは「ちょうど3行ぶん」の高さにして、帯のまんなかに置く。
     こうしておくと、文字を小さくしても1ページ3行までという決まりは変わらない。 */
  const textH=fs*1.45*3;
  st.style.setProperty("--vnbh", (Math.ceil(textH)+1)+"px");
  st.style.setProperty("--vnbtop", ((frameH*bTop+(bodyH-textH)/2)/frameH*100).toFixed(2)+"%");
  /* 名前欄と選択肢ボタンは枠の大きさに合わせる（本文の縮小には連動させない） */
  st.style.setProperty("--vnnfs", Math.max(11,Math.min(30, full*0.95)).toFixed(1)+"px");
  st.style.setProperty("--vncfs", Math.max(12,Math.min(22, full*0.60)).toFixed(1)+"px");
  /* 顔画像は画面のいちばん下まで伸ばす（下にすき間ができないように） */
  st.style.setProperty("--fwh", (Math.round(frameH*(FW.height||1.45))+vnb)+"px");
  /* SAVE/LOAD などの小さなボタンは、メッセージ枠の右上（枠のすぐ上）に置く。
     新しいクイックメニュー（画面の右上）のときは、下の --qm* を使います */
  st.style.setProperty("--vnbarb", (vnb+Math.round(frameH)+(mob?3:5))+"px");
  /* クイックメニュー（画面の右上）。大きさは正方形、位置は画面のはしからの割合 */
  const qv=(k,d)=>(typeof V0[k]==="number"?V0[k]:d);
  st.style.setProperty("--qmb", Math.round(H*(mob?qv("qmSizeMb",0.132):qv("qmSize",0.102)))+"px");
  st.style.setProperty("--qmg", Math.round(W*qv("qmGap",0.0078))+"px");
  st.style.setProperty("--qmr", Math.round(W*qv("qmRight",0.016))+"px");
  st.style.setProperty("--qmt", Math.round(H*qv("qmTop",0.016))+"px");
  /* ---- 顔の写真枠 ----------------------------------------------------
     横はば（photoW）と左の余白（photoX）は、画面の横に対する割合です。
     高さは絵の形なりに決まるので、**横はばを大きくすると上へ伸びます**。
     枠がメッセージ枠の左はしに重なったぶん（--vnclr）だけ、本文と名前
     プレートを右へずらして、文字が写真の下にかくれないようにします。 */
  /* ---- 立ち絵の大きさ -------------------------------------------------
     ★ かならず「高さ」で決めます。横はばで決めると、画面の低いスマホでは
       そこから出た高さが画面をこえてしまい、頭が上に切れます。
       横はばは絵の形（400:627）なりに、CSS が自動で出します。 */
  st.style.setProperty("--chh", Math.round(H*qv("charH",0.929))+"px");
  st.style.setProperty("--chb", Math.round(H*qv("charBottom",0.0385))+"px");
  st.style.setProperty("--pb",  Math.round(H*qv("photoBottom",0.02))+"px");
  let pfw=Math.round(W*(mob?qv("photoWMb",0.225):qv("photoW",0.250)));
  /* 写真枠は横はばから高さが決まるので、画面が低いと上へ伸びすぎます。
     高さが画面の photoMaxH をこえたら、そのぶん横はばを縮めます */
  const pfar0=(V0.photoInImage===true)?VNPHOTO.def:(VNPHOTO.ar||VNPHOTO.def);
  const pfmax=Math.round(H*qv("photoMaxH",0.62));
  if(pfw/pfar0 > pfmax) pfw=Math.round(pfmax*pfar0);
  const pfx=Math.round(W*qv("photoX",0.008));
  st.style.setProperty("--pfw", pfw+"px");
  st.style.setProperty("--px",  pfx+"px");
  /* 傾けているぶん、右のはしは計算より少し外へ出る。
     ★ ここに「いま出ている顔の絵」の形をまぜないこと。子ごとに形が少しちがうと、
       話す人が変わるたびに本文と名前プレートが動いてしまいます。 */
  const pfh=pfw/pfar0;
  const outR=Math.round(Math.abs(Math.sin(qv("photoTilt",-3.5)*Math.PI/180))*pfh*0.5);
  st.style.setProperty("--vnclr",
    Math.max(0, (pfx+pfw+outR)-(edge+fww+wgap)+Math.round(W*qv("photoClear",0.014)))+"px");
  /* ---- 頭を写真の外へすこし出す ---------------------------------------
     顔の絵を入れる箱を、枠より photoHeadOut ぶん**上へのばして**あります。
     窓の中（.pfimg）と、頭を出す層（.pfhead）は、この**同じ箱に同じやりかた**で
     絵を入れるので、絵がずれることがありません。
     .pfhead は「窓のはばのまま、上へのびた帯」で、枠の絵の上に描かれます。 */
  const pfhp =Math.round(pfh);
  const phout=Math.round(pfh*qv("photoHeadOut",0.05));
  const winT =Math.round(pfh*qv("photoTop",0.057));
  const winL =Math.round(pfw*qv("photoLeft",0.072));
  const winR =Math.round(pfw*qv("photoRight",0.072));
  st.style.setProperty("--pfh",  pfhp+"px");
  st.style.setProperty("--phout",phout+"px");
  st.style.setProperty("--phcut",(phout+winT)+"px");   /* 窓の上のふち＝頭の切れめ */
  st.style.setProperty("--phl",  winL+"px");
  st.style.setProperty("--phr",  winR+"px");
  /* 窓のかたちの絵（mask）が使えないときの、四角い切りぬき。
     箱が上へのびたぶん（phout）を、上の数字に足しておきます */
  st.style.setProperty("--pclip", VNPHOTO.maskOK ? "none"
    : `inset(${phout+winT}px ${winR}px ${Math.round(pfh*qv("photoBot",0.176))}px ${winL}px)`);
  /* クイックメニューのうしろの帯。高さと、ボタンより左へどれだけのばすか */
  st.style.setProperty("--qmbarh", Math.round(H*qv("qmBarH",0.085))+"px");
  st.style.setProperty("--qmbarl", Math.round(W*qv("qmBarLeft",0.050))+"px");
  /* タイトルのロゴとメニューボタンの横はば（assets/ui/ の画像を使うとき）。
     文字のままのときは使われないので、置いていなくても影響はありません。 */
  const UR=(typeof UI_RULE!=="undefined")?UI_RULE:{};
  st.style.setProperty("--tlogow", Math.round(W*(mob?(UR.logoWMb||0.34):(UR.logoW||0.30)))+"px");
  st.style.setProperty("--tbtnw",  Math.round(W*(mob?(UR.btnWMb ||0.32):(UR.btnW ||0.285)))+"px");
  /* 縦の頭打ち。絵が縦長すぎても4つのボタンが画面からはみ出さないようにする。
     （％で書くと入れものの高さと循環してしまうので、ここで実寸に直しています） */
  st.style.setProperty("--tlogoh", Math.round(H*(mob?0.30:0.34))+"px");
  st.style.setProperty("--tbtnh",  Math.round(H*(mob?(UR.btnHMb||0.13):(UR.btnH||0.135)))+"px");
  /* ロゴとボタンのあいだのすき間（画面の高さに対する割合） */
  st.style.setProperty("--tmgap",  Math.round(H*(mob?(UR.menuGapMb||0.030):(UR.menuGap||0.045)))+"px");
  /* ボタンどうしのすき間（画面の高さに対する割合） */
  st.style.setProperty("--tbgap",  Math.round(H*(UR.btnGap===undefined?0.013:UR.btnGap))+"px");
  st.style.transform="scale("+Math.min(vw/W, vh/H)+")";
  if(mob&&!portrait){
    const gap = 5, cols = 5;
    const ic  = Math.max(36, Math.min(58, Math.floor((H-21)/4.98)));
    st.style.setProperty("--ic",ic+"px");
    st.style.setProperty("--iccols",cols);
    st.style.setProperty("--icgap",gap+"px");
    st.style.setProperty("--icw",(cols*ic+(cols-1)*gap)+"px");
    document.body.classList.toggle("sh",H<378);
    document.body.classList.toggle("sh2",H<312);
  }else{
    document.body.classList.remove("sh","sh2");
    st.style.removeProperty("--ic");
  }
}
addEventListener("resize",fit);
if(window.visualViewport)visualViewport.addEventListener("resize",fit);
addEventListener("orientationchange",()=>{setTimeout(fit,120);setTimeout(fit,420);});
fit();
/* 広告はページを開いたあとから読みこまれて、あとで大きくなります。
   しばらく見はって、大きさが変わったら画面を合わせなおします。 */
(function watchHost(){
  if(HOSTAD.avoid===false)return;
  const recheck=()=>{ if(hostScan())fit(); };
  [200,600,1200,2500,5000,9000].forEach(ms=>setTimeout(recheck,ms));
  addEventListener("load",recheck);
  try{
    let tm=0;
    new MutationObserver(()=>{clearTimeout(tm);tm=setTimeout(recheck,250);})
      .observe(document.body,{childList:true});
  }catch(e){}
})();


/* =======================================================================
   0.5 サウンド（BGM／効果音）— すべてWeb Audioで合成
   ======================================================================= */
const MAJ=[0,2,4,7,9], MIN=[0,3,5,7,10];
const TRACKS={
 spring:{n:"春",     bpm:108,key:60,pent:MAJ,lead:"triangle",pad:"sine",
   prog:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],
   mel:"3.5.6.5.3.2.1.2."+"3.5.8.7.6.5.3.-."+"6.5.3.5.6.8.7.6."+"5.3.2.1.2.3.-.-."},
 summer:{n:"夏",     bpm:126,key:62,pent:MAJ,lead:"square",pad:"triangle",
   prog:[[0,4,7],[5,9,12],[7,11,14],[5,9,12]],
   mel:"6.7.8.7.6.5.6.-."+"8.9.0.9.8.7.6.5."+"3.5.6.8.6.5.3.2."+"1.2.3.5.6.5.3.-."},
 autumn:{n:"秋",     bpm:88, key:57,pent:MIN,lead:"sine",pad:"triangle",
   prog:[[0,3,7],[8,12,15],[3,7,10],[10,14,17]],
   mel:"3...5...6...5..."+"8...7...6...3..."+"5...6...8...9..."+"6...5...3...-..."},
 winter:{n:"冬",     bpm:74, key:62,pent:MIN,lead:"sine",pad:"sine",
   prog:[[0,3,7],[5,8,12],[8,12,15],[7,11,14]],
   mel:"1...3...5...3..."+"6...5...3...1..."+"5...6...8...6..."+"3...2...1...-..."},
 vspring:{n:"春休み",bpm:116,key:65,pent:MAJ,lead:"triangle",pad:"sine",
   prog:[[5,9,12],[7,11,14],[4,7,11],[9,12,16]],
   mel:"5.6.8.6.5.3.5.-."+"6.8.9.8.6.5.3.-."+"3.5.6.5.3.2.1.-."+"2.3.5.6.5.3.2.-."},
 vsummer:{n:"夏休み",bpm:138,key:67,pent:MAJ,lead:"square",pad:"triangle",
   prog:[[0,4,7],[9,12,16],[5,9,12],[7,11,14]],
   mel:"8.8.6.8.9.8.6.5."+"6.6.5.6.8.6.5.3."+"5.5.3.5.6.8.9.0."+"9.8.6.5.6.5.3.-."},
 vwinter:{n:"冬休み",bpm:82, key:63,pent:MAJ,lead:"sine",pad:"sine",
   prog:[[0,4,7],[4,7,11],[5,9,12],[7,11,14]],
   mel:"3...5.6.5...3..."+"2...3.5.3...2..."+"5...6.8.6...5..."+"3...2.1.2...3..."}
};
const AU={ctx:null,master:null,mus:null,sfx:null,echo:null,on:true,bgmVol:0.8,seVol:0.8,cur:null,tr:null,step:0,next:0,timer:null};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function audioInit(){
  if(AU.ctx)return;
  const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
  AU.ctx=new C();
  AU.master=AU.ctx.createGain(); AU.master.gain.value=0.5; AU.master.connect(AU.ctx.destination);
  AU.mus=AU.ctx.createGain(); AU.mus.gain.value=0.0; AU.mus.connect(AU.master);
  AU.sfx=AU.ctx.createGain(); AU.sfx.gain.value=AU.seVol; AU.sfx.connect(AU.master);
  const d=AU.ctx.createDelay(1.0); d.delayTime.value=0.30;
  const fb=AU.ctx.createGain(); fb.gain.value=0.24;
  const wet=AU.ctx.createGain(); wet.gain.value=0.30;
  d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(AU.mus);
  AU.echo=d;
  /* 「止められていたのが動きだした」ときに、タイトルの案内を消すため */
  AU.ctx.onstatechange=()=>{ try{ sndHint(); }catch(e){} };
}
function tone(freq,at,dur,wave,vol,dest,echo){
  const c=AU.ctx,o=c.createOscillator(),g=c.createGain();
  o.type=wave; o.frequency.setValueAtTime(freq,at);
  g.gain.setValueAtTime(0.0001,at);
  g.gain.linearRampToValueAtTime(vol,at+0.014);
  g.gain.exponentialRampToValueAtTime(0.0001,at+dur);
  o.connect(g); g.connect(dest||AU.mus); if(echo&&AU.echo)g.connect(AU.echo);
  o.start(at); o.stop(at+dur+0.06);
}
const CHMAP={"1":0,"2":1,"3":2,"4":3,"5":4,"6":0,"7":1,"8":2,"9":3,"0":4};
function seqTick(){
  if(!AU.tr||!AU.ctx)return;
  const T=AU.tr, spb=60/T.bpm, sp=spb/4;          // 16分音符
  while(AU.next < AU.ctx.currentTime+0.30){
    const st=AU.step%64, bar=Math.floor(st/16), b=st%16, ch=T.prog[bar], root=T.key+ch[0];
    if(b===0||b===8) tone(mtof(root-12),AU.next,spb*0.85,"triangle",0.16);
    if(b%4===0){ ch.forEach((n,i)=>tone(mtof(T.key+n),AU.next,spb*0.9,T.pad,0.030+i*0.002)); }
    if(b%2===0&&b%4!==0){ tone(mtof(T.key+ch[(b/2)%3]+12),AU.next,sp*1.6,T.pad,0.022); }
    const c=T.mel[st];
    if(c&&c!=="."&&c!=="-"){
      const idx=CHMAP[c], oct=("67890".indexOf(c)>=0)?12:0;
      let len=sp; let k=st+1;
      while(T.mel[k%64]==="-"||T.mel[k%64]==="."){ if(T.mel[k%64]==="-"){len+=sp;k++;} else break; }
      tone(mtof(T.key+T.pent[idx]+oct+12),AU.next,Math.max(len,sp*1.4),T.lead,0.085,null,true);
    }
    AU.next+=sp; AU.step++;
  }
}
/* ---- 音のファイル差しかえ --------------------------------------------
   assets/bgm/<名前>.mp3 や assets/se/<名前>.mp3 があれば、そのファイルを鳴らす。
   置いていない音は、これまでどおりその場で合成した音が鳴る。 */
const AUFILE={bgm:null, cache:{}};
function auPath(kind,name){
  const L=(typeof ART_LIST!=="undefined"&&ART_LIST[kind])||[];
  const hit=artName(L,name);           /* 大文字小文字はくべつしません */
  return hit?artURL(kind+"/"+hit):null;
}
function auPlayFile(kind,name,loop){
  const src=auPath(kind,name); if(!src)return false;
  try{
    if(loop){
      if(AUFILE.bgm){AUFILE.bgm.pause();AUFILE.bgm=null;}
      const a=new Audio(src); a.loop=true;
      a.volume=AU.on?Math.min(1,AU.bgmVol):0;
      AUFILE.bgm=a; a.play().catch(()=>{});
    }else{
      if(!AU.on||AU.seVol<=0)return true;
      const a=AUFILE.cache[src]||(AUFILE.cache[src]=new Audio(src));
      a.currentTime=0; a.volume=Math.min(1,AU.seVol); a.play().catch(()=>{});
    }
    return true;
  }catch(e){ return false; }
}
function auStopFile(){ if(AUFILE.bgm){AUFILE.bgm.pause();AUFILE.bgm=null;} }
function auSyncVol(){
  if(AUFILE.bgm)AUFILE.bgm.volume=AU.on?Math.min(1,AU.bgmVol):0;
}

function bgm(name){
  if(AU.cur===name)return;
  if(auPlayFile("bgm",name,true)){ AU.cur=name; AU.tr=null;
    if(AU.ctx&&AU.mus){const n=AU.ctx.currentTime;AU.mus.gain.cancelScheduledValues(n);
      AU.mus.gain.setValueAtTime(0.0001,n);}
    return; }
  auStopFile();
  if(!AU.ctx)return;
  AU.cur=name;
  const T=TRACKS[name]; if(!T)return;
  const g=AU.mus.gain, now=AU.ctx.currentTime;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value,now); g.linearRampToValueAtTime(0.0001,now+0.5);
  setTimeout(()=>{
    AU.tr=T; AU.step=0; AU.next=AU.ctx.currentTime+0.06;
    if(!AU.timer)AU.timer=setInterval(seqTick,40);
    const n=AU.ctx.currentTime;
    AU.mus.gain.cancelScheduledValues(n);
    AU.mus.gain.setValueAtTime(0.0001,n);
    AU.mus.gain.linearRampToValueAtTime(AU.on?0.85*AU.bgmVol:0.0001,n+0.9);
  },520);
}
/* 音を置いていないときに、代わりに鳴らす音。
   assets/se/title.mp3 を置くと称号の音がそれになり、
   置いていなければ、いままでどおり pinpon（正解音）が鳴ります。 */
const SEALT={ title:"pinpon" };
function se(kind){
  if(auPlayFile("se",kind,false))return;
  if(SEALT[kind]){ se(SEALT[kind]); return; }
  if(!AU.ctx||!AU.on||AU.seVol<=0)return;
  const t=AU.ctx.currentTime;
  const g=AU.ctx.createGain(); g.gain.value=0.5; g.connect(AU.sfx||AU.master);
  const put=(f,dt,du,w,v)=>tone(f,t+dt,du,w,v,g,false);
  if(kind==="click"){ put(760,0,0.055,"square",0.20); }
  else if(kind==="ok"){ put(660,0,0.06,"square",0.20); put(990,0.055,0.10,"square",0.18); }
  else if(kind==="cancel"){ put(500,0,0.07,"square",0.16); put(330,0.06,0.11,"square",0.14); }
  else if(kind==="great"){ [880,1108,1318,1760].forEach((f,i)=>put(f,i*0.055,0.16,"triangle",0.20)); }
  else if(kind==="good"){ put(1046,0,0.12,"triangle",0.20); }
  else if(kind==="bad"){ put(210,0,0.16,"sawtooth",0.14); put(160,0.08,0.18,"sawtooth",0.12); }
  else if(kind==="heart"){ [784,988,1174].forEach((f,i)=>put(f,i*0.08,0.30,"sine",0.18)); }
  else if(kind==="page"){ put(520,0,0.05,"triangle",0.14); }
  else if(kind==="pinpon"){ put(1318,0,0.20,"sine",0.30); put(1046,0.19,0.34,"sine",0.30);
                            put(2637,0,0.16,"sine",0.07); put(2093,0.19,0.26,"sine",0.07); }
  else if(kind==="pinpon2"){ [0,0.40].forEach(o=>{ put(1318,o,0.20,"sine",0.30); put(1046,o+0.19,0.34,"sine",0.30);
                            put(2637,o,0.16,"sine",0.07); put(2093,o+0.19,0.26,"sine",0.07); }); }
  else if(kind==="bubu"){ [175,178].forEach(f=>{ put(f,0,0.14,"sawtooth",0.13); put(f,0.17,0.52,"sawtooth",0.15); });
                          put(88,0.17,0.52,"square",0.06); }
}
function applyVol(){
  auSyncVol();                       /* 差しかえたBGMファイルの音量も合わせる */
  if(!AU.ctx)return;
  const n=AU.ctx.currentTime;
  AU.mus.gain.cancelScheduledValues(n);
  AU.mus.gain.linearRampToValueAtTime(AU.on?0.85*AU.bgmVol:0.0001,n+0.25);
  AU.sfx.gain.setTargetAtTime(AU.on?AU.seVol:0.0001,n,0.05);
}
function audioToggle(){ AU.on=!AU.on; applyVol(); saveOpt(); sndHint();
  if(S.girls&&S.girls.length)drawIcons(); }

/* ---- 自動再生の制限への対応 --------------------------------------------
   ブラウザは「利用者がまだ一度も触っていないページ」では音を鳴らせません
   （タイトルのBGMが、ボタンを押すまで鳴らなかったのはこれが理由です）。
   仕様なので消せませんが、次の2段がまえで、できるだけ早く鳴らします。

     ① 読みこんだ直後に、いちど鳴らしてみる（許してくれるブラウザもある）
     ② はねられたときのために、画面の**どこか**を最初にクリック／タップ／
        キー入力した瞬間に、鳴らしなおす（ボタンの上でなくてかまいません）

   それでも鳴っていないあいだは、タイトルに小さな案内を出します。 */
function audioWake(){
  audioInit();
  if(!AU.ctx)return;
  if(AU.ctx.state==="suspended"){ try{ AU.ctx.resume(); }catch(e){} }
  applyVol();
  /* 差しかえBGM（音源ファイル）が自動再生をはねられて止まっていたら、鳴らしなおす */
  if(AUFILE.bgm&&AUFILE.bgm.paused){ try{ AUFILE.bgm.play().catch(()=>{}); }catch(e){} }
  if(!AU.cur) bgm(S.inGame?bgmFor(S.t):titleBgmName());
  sndHint(); setTimeout(sndHint,400);
}
let AUARMED=false;
function audioArm(){
  if(AUARMED)return; AUARMED=true;
  const evs=["pointerdown","touchstart","keydown"];
  const go=()=>{
    audioWake();
    /* 鳴りだしたら、もう見張らなくてよい */
    if(AU.ctx&&AU.ctx.state==="running")evs.forEach(e=>removeEventListener(e,go,true));
  };
  evs.forEach(e=>addEventListener(e,go,{passive:true,capture:true}));
}
/* 音が鳴らせない状態か。自分で音を切っているときは「ふつう」とみなします */
function audioBlocked(){
  if(!AU.on||AU.bgmVol<=0)return false;
  if(!AU.ctx||AU.ctx.state!=="running")return true;
  return !!(AUFILE.bgm&&AUFILE.bgm.paused);
}
/* タイトルの「クリックすると音が鳴ります」の出し入れ */
function sndHint(){
  const el=document.getElementById("tsnd"); if(!el)return;
  const t=document.getElementById("title");
  el.classList.toggle("on", !!t && t.style.display!=="none" && audioBlocked());
}
const OPTKEY="starmate_opt";
function saveOpt(){ try{ localStorage.setItem(OPTKEY,JSON.stringify(
  {on:AU.on,bgm:AU.bgmVol,se:AU.seVol,speed:S.speed,tspeed:S.tspeed,bgfade:S.bgfade,
   dbgWeek:DBG_WEEKSUM})); }catch(e){} }
function loadOpt(){
  try{ const o=JSON.parse(localStorage.getItem(OPTKEY)||"null"); if(!o)return;
    if(typeof o.on==="boolean")AU.on=o.on;
    if(typeof o.bgm==="number")AU.bgmVol=clamp(o.bgm,0,1);
    if(typeof o.se==="number")AU.seVol=clamp(o.se,0,1);
    if(Number.isInteger(o.speed)&&o.speed>=0&&o.speed<SPEEDS.length)S.speed=o.speed;
    if(Number.isInteger(o.tspeed)&&o.tspeed>=0&&o.tspeed<TSPEEDS.length)S.tspeed=o.tspeed;
    if(Number.isInteger(o.bgfade)&&o.bgfade>=0&&o.bgfade<BGFADES.length)S.bgfade=o.bgfade;
    if(typeof o.dbgWeek==="boolean")DBG_WEEKSUM=o.dbgWeek;
  }catch(e){}
}
/* クリック音を全ボタンに */
document.addEventListener("click",e=>{
  const b=e.target.closest("button,.ic,.slot,.gcard");
  if(!b||b.disabled||b.classList.contains("off"))return;
  se(b.classList.contains("pk")||b.id==="go"?"ok":"click");
},true);

/* =======================================================================
   1. カレンダー
   ======================================================================= */
const MLEN={4:30,5:31,6:30,7:31,8:31,9:30,10:31,11:30,12:31,1:31,2:28,3:31};
const MORDER=[4,5,6,7,8,9,10,11,12,1,2,3];
const DOW=["月","火","水","木","金","土","日"];
const CAL=(()=>{const a=[];let y=1,mi=0,d=5;
  for(;;){a.push({y,m:MORDER[mi],d});
    if(y===3&&MORDER[mi]===3&&d===1)break;
    if(++d>MLEN[MORDER[mi]]){d=1;if(++mi>=12){mi=0;y++;}}}
  return a;})();
const LAST=CAL.length-1;                       // 1060 (3年目3月1日 木)
const dow=t=>t%7;                              // 0=月 … 6=日

/* =======================================================================
   2. データ
   ======================================================================= */
const P={study:"学 力",sport:"運 動",art:"芸 術",charm:"魅 力",
         care:"気配り",trend:"流 行",rich:"リッチ度"};
const CMD={
  rest :{n:"休養",   g:"💤",p:null,   s:-15,tx:"ゆっくり体を休めた"},
  study:{n:"勉強",   g:"📖",p:"study",s:5,  tx:"机に向かった"},
  sport:{n:"運動",   g:"🏃",p:"sport",s:5,  tx:"体を動かした"},
  art  :{n:"芸術",   g:"🎨",p:"art",  s:5,  tx:"創作にうちこんだ"},
  trend:{n:"流行",   g:"📱",p:"trend",s:3,  tx:"街の流行をチェックした"},
  charm:{n:"自分磨き",g:"✨",p:"charm",s:4, tx:"鏡の前で自分を磨いた"},
  care :{n:"手伝い", g:"🤝",p:"care", s:3,  tx:"家の手伝いをした"},
  job  :{n:"バイト", g:"💰",p:"rich", s:7,  tx:"バイトに精を出した"}
};
const CMDKEYS=Object.keys(CMD);

/* =======================================================================
   好感度のものさし
   ・MAXAFF が好感度の上限。表示の★も、上限に対する割合で出す
   ・段階（普通／友達／気になる人／好き）のしきい値は、女の子ごとに違う。
     しきい値は「0〜1000 のものさし」で書く（AFFSCALE）。
     MAXAFF がいくつでも、割合で判定するので数字を直す必要はない。
   ======================================================================= */
const MAXAFF=1000;
const AFFSCALE=1000;
/* AFFTIERS（間柄のしきい値）は story.js が story/<名前>.js から組み立てます */
const AFFTIER_DEF={friend:300,crush:600,love:800};
const AFFORDER=["normal","friend","crush","love"];
const AFFNAME={normal:"普通",friend:"友達",crush:"気になる人",love:"好き"};
/* 好感度が同じだったとき、どの子を先に立てるか（story/<名前>.js の order 順） */

const affPoint=g=>(g&&g.aff||0)*AFFSCALE/MAXAFF;   /* 0〜1000 に直した値 */
function affTier(g){
  const t=AFFTIERS[g&&g.id]||AFFTIER_DEF, p=affPoint(g);
  return p>=t.love?"love":p>=t.crush?"crush":p>=t.friend?"friend":"normal";
}
const affTierName=g=>AFFNAME[affTier(g)];

/* =======================================================================
   女の子じしんの能力（くわしく画面のゲージ）

   ・出す項目は、主人公と同じ6つ。
     ストレスとリッチ度は、女の子には持たせません。
   ・上限は主人公と同じ 999。
   ・はじめの数字は story/<名前>.js の p.stat に書いてあります。
   ・★伸びかたは、いまのところ「1か月ごとに GIRL_GROW ずつ」の仮のものです。
     ちゃんとした育ちかたを決めたら、girlStat() の中だけを直せば済みます。
   ======================================================================= */
const GIRL_STATK=["study","sport","art","charm","care","trend"];
const GIRL_MAX=999;
let GIRL_GROW=20;             /* ★1か月に伸びる量（仮）。ここを変えれば伸びかたが変わります */
const GIRL_GROW_DEF=20;
const GIRL_BASE_DEF=60;       /* p.stat が書かれていない子の、とりあえずの値 */
/* ゲームが始まってから、何か月たったか */
function girlMonths(){
  if(typeof MIDXof!=="function")return 0;
  return Math.max(0, MIDXof(S.t)-MIDXof(0));
}
function girlStat(g,k){
  const st=(g&&g.stat)||null;
  const base=(st&&st[k]!==undefined)?st[k]:GIRL_BASE_DEF;
  return clamp(Math.round(base+GIRL_GROW*girlMonths()),0,GIRL_MAX);
}
/* 同じセリフが続けて出ないように、前に出したものを覚えておく */
function pickLine(list,key){
  if(!list||!list.length)return null;
  if(list.length===1)return list[0];
  if(!S.said)S.said={};
  let i,n=0;
  do{ i=Math.floor(Math.random()*list.length); }while(S.said[key]===i && ++n<8);
  S.said[key]=i;
  return list[i];
}
/* その子の、いまの間柄に合ったセリフを1本えらぶ。
   kind は story/かのじょ.js の中の名前（"tel" = 電話 ／ "date" = おでかけの返事） */
function girlLine(g,kind){
  const st=(typeof STORY!=="undefined")&&STORY[g.id];
  const arr=tierText(st&&st[kind],g);
  return pickLine(Array.isArray(arr)?arr:(arr?[arr]:null), g.id+":"+kind+":"+affTier(g));
}
/* 段階べつに書き分けた文章から、その子に合うものを1つ取り出す。
   その段階が書かれていなければ、下の段階 → 上の段階 の順でおぎなう。 */
function tierText(tbl,g){
  if(!tbl)return null;
  const o=["love","crush","friend","normal"], i=o.indexOf(affTier(g));
  for(let k=i;k<o.length;k++) if(tbl[o[k]])return tbl[o[k]];
  for(let k=i-1;k>=0;k--) if(tbl[o[k]])return tbl[o[k]];
  return null;
}
/* {line:"セリフ", say:"地の文", d:好感度} を、その順に画面へ出す */
function tierPlay(t,g,ex){
  if(!t)return 0;
  const V={名前:g.name};
  if(t.line)line(g,fmt(t.line,V),ex||t.ex);
  if(t.say)(Array.isArray(t.say)?t.say:[t.say]).forEach(s=>say(fmt(s,V)));
  if(t.d)addAff(g,t.d);
  return t.d||0;
}
const affAtLeast=(g,tier)=>AFFORDER.indexOf(affTier(g))>=AFFORDER.indexOf(tier);
/* いちばん好感度の高い子。同点なら AFF_PRIORITY の順 */
function topGirl(list){
  const pr=x=>{const i=AFF_PRIORITY.indexOf(x);return i<0?99:i;};
  return (list||[]).slice()
    .sort((a,b)=>(b.aff-a.aff)||(pr(a.id)-pr(b.id)))[0]||null;
}

/* =======================================================================
   部活熟練度
   ・部活コマンドを実行するたびに伸びる（0〜100）
   ・運動部  … 3か月に1回の練習試合の勝敗を左右する
   ・文化部  … 文化祭の出し物がうまくいくかを左右する（生徒会も文化部あつかい）
   ======================================================================= */

const SPORTS_CLUB={base:1,socc:1,tenn:1,bask:1};        /* 運動部 */
const CULTURE_CLUB={band:1,dram:1,art:1,gov:1};          /* 文化部（生徒会を含む） */
const isSportsClub=()=>!!SPORTS_CLUB[S.club];
const isCultureClub=()=>!!CULTURE_CLUB[S.club];
const profOf=(c)=>Math.round((S.prof&&S.prof[c||S.club])||0);
const profName=(c)=>((CLUBS[c||S.club]||{}).n||"")+"熟練度";
/* 部活1回ぶんの伸び。高くなるほど鈍る */
function addProf(r){
  if(S.club==="none")return 0;
  if(!S.prof)S.prof={};
  const cur=S.prof[S.club]||0;
  const base=r==="great"?0.75:r==="ok"?0.42:0.12;
  const g=base*Math.max(0.12,1-cur/115);
  S.prof[S.club]=clamp(cur+g,0,100);
  return g;
}
/* 熟練度の見出し（くわしく画面用） */
function profRank(v){
  return v>=90?"名門レベル":v>=70?"かなりの腕前":v>=50?"一人前":v>=30?"様になってきた":v>=12?"かけだし":"はじめたばかり";
}
function cmdList(){ return S.club==="none" ? CMDKEYS : ["club"].concat(CMDKEYS); }
function cmdOf(k){
  if(k==="club"){const c=CLUBS[S.club];
    return {n:c.n,g:c.g,p:null,gain:c.gain,club:true,s:c.st,tx:c.n+"の活動に打ちこんだ"};}
  if(k==="job"){
    /* バイト先をまだ決めていないうちは、店の名前を出さない
       （押したときに jobMenu() で選んでもらう） */
    if(!S.job){const J=JOBS.conv;
      return {n:"バイト",g:"\ud83d\udcbc",p:null,gain:J.gain,job:true,s:J.st,tx:"バイトのシフトに入った"};}
    const J=JOBS[S.job];
    return {n:J.n.length>5?"バイト":J.n,g:J.g,p:null,gain:J.gain,job:true,s:J.st,tx:J.n+"のシフトに入った"};}
  return CMD[k];
}


/* 部活 */
const CLUBS={
 none:{n:"帰宅部",g:"🏠",gain:null,st:0,girl:null,d:"部活はしない。自由時間が多く、ストレスが溜まりにくい"},
 base:{n:"野球部",g:"⚾",gain:{sport:5.0,care:2.0},st:7,girl:"hinata",mate:"hinata",d:"体力と根性。運動◎ 気配り○",bg:"ground"},
 socc:{n:"サッカー部",g:"⚽",gain:{sport:5.0,trend:2.0},st:7,girl:"hinata",mate:"hinata",d:"走り続ける。運動◎ 流行○",bg:"ground"},
 tenn:{n:"テニス部",g:"🎾",gain:{sport:4.0,charm:3.0},st:6,girl:"hinata",mate:"hinata",d:"華のある競技。運動○ 魅力◎",bg:"ground"},
 bask:{n:"バスケ部",g:"🏀",gain:{sport:5.0,charm:2.0},st:7,girl:"hinata",mate:"hinata",d:"スピードと連携。運動◎ 魅力○",bg:"ground"},
 band:{n:"軽音楽部",g:"🎸",gain:{art:5.0,trend:3.0},st:5,girl:"luka",mate:"luka",d:"音を鳴らす。芸術◎ 流行◎",bg:"music"},
 dram:{n:"演劇部",g:"🎭",gain:{art:3.0,charm:5.0},st:5,girl:"sakuya",mate:"sakuya",d:"舞台に立つ。芸術○ 魅力◎",bg:"klass"},
 art :{n:"美術部",g:"🖌️",gain:{art:5.0,care:2.0},st:4,girl:"minamo",mate:"minamo",d:"静かに描く。芸術◎ 気配り○",bg:"artroom"},
 gov :{n:"生徒会",g:"🏛️",gain:{study:4.0,care:4.0},st:6,girl:"rena",mate:"rena",d:"学校を動かす。学力◎ 気配り◎",bg:"klass"}
};
/* =======================================================================
   星座
   ・誕生日から決まります
   ・その星座が得意なぶんだけ、はじまりのステータスが少しだけ高くなります
   ・m,d は「その星座が始まる日」／ up が高くなるもの／ v はその量
   ======================================================================= */
const ZODIAC=[
 {m:1, d:20,n:"みずがめ座",g:"\u2652",up:"art",  v:6, d2:"自分の見かたを持っている。芸術が高めではじまる"},
 {m:2, d:19,n:"うお座",    g:"\u2653",up:"art",  v:6, d2:"感じやすく、想像がふくらむ。芸術が高めではじまる"},
 {m:3, d:21,n:"おひつじ座",g:"\u2648",up:"sport",v:6, d2:"まっすぐで、じっとしていられない。運動が高めではじまる"},
 {m:4, d:20,n:"おうし座",  g:"\u2649",up:"rich", v:14,d2:"堅実で、ものを大事にする。リッチ度が高めではじまる"},
 {m:5, d:21,n:"ふたご座",  g:"\u264a",up:"trend",v:6, d2:"新しいものに目が早い。流行が高めではじまる"},
 {m:6, d:22,n:"かに座",    g:"\u264b",up:"care", v:6, d2:"身内を大切にする。気配りが高めではじまる"},
 {m:7, d:23,n:"しし座",    g:"\u264c",up:"charm",v:6, d2:"人の輪の真ん中にいる。魅力が高めではじまる"},
 {m:8, d:23,n:"おとめ座",  g:"\u264d",up:"study",v:6, d2:"こまかいところに気がつく。学力が高めではじまる"},
 {m:9, d:23,n:"てんびん座",g:"\u264e",up:"charm",v:6, d2:"かたよらず、感じがいい。魅力が高めではじまる"},
 {m:10,d:24,n:"さそり座",  g:"\u264f",up:"study",v:6, d2:"ひとつのことを深く掘る。学力が高めではじまる"},
 {m:11,d:22,n:"いて座",    g:"\u2650",up:"sport",v:6, d2:"遠くへ行きたがる。運動が高めではじまる"},
 {m:12,d:22,n:"やぎ座",    g:"\u2651",up:"rich", v:14,d2:"こつこつ積み上げる。リッチ度が高めではじまる"}
];
function zodiacOf(m,d){
  if(m===1&&d<20)return ZODIAC[11];        /* 1/1〜1/19 は やぎ座 */
  let z=ZODIAC[11];
  for(const x of ZODIAC) if(m>x.m||(m===x.m&&d>=x.d))z=x;
  return z;
}
/* はじまりのステータス。基本値に、星座のぶんを足したもの */
const BASE_P={study:8,sport:8,art:6,charm:10,care:10,trend:6,rich:30};
function startStats(bd){
  const b=bd||S.bd||{m:5,d:5}, z=zodiacOf(b.m,b.d), p={...BASE_P};
  p[z.up]+=z.v;
  return p;
}

const BLOOD={
 A :{n:"A型",st:1.12,roll:0,   gain:{study:1.10,art:1.05}, d:"几帳面。学力・芸術が伸びやすいが、ストレスも溜まりやすい"},
 B :{n:"B型",st:1.00,roll:0.08,gain:{},                    d:"気分屋。大成功も大失敗も出やすい"},
 O :{n:"O型",st:0.85,roll:0,   gain:{sport:1.10},           d:"タフ。ストレスに強く、運動が伸びやすい"},
 AB:{n:"AB型",st:0.95,roll:0,  gain:{"*":1.05},             d:"器用。すべてが少しだけ伸びやすい"}
};
/* 季節・長期休み */
function vacOf(c){
  if(c.m===7&&c.d>=21)return "vsummer";
  if(c.m===8)return "vsummer";
  if(c.m===12&&c.d>=25)return "vwinter";
  if(c.m===1&&c.d<=7)return "vwinter";
  if(c.m===3&&c.d>=19)return "vspring";
  if(c.m===4&&c.d<=4)return "vspring";
  return null;
}
const seasonOf=m=>(m>=3&&m<=5)?"spring":(m>=6&&m<=8)?"summer":(m>=9&&m<=11)?"autumn":"winter";
function bgmFor(t){const c=CAL[Math.min(t,LAST)];return vacOf(c)||seasonOf(c.m);}
const VACNAME={vsummer:"夏休み",vwinter:"冬休み",vspring:"春休み"};

/* デートに行ける場所。s: を書くと、その季節にだけ選べる
   （春=3〜5月／夏=6〜8月／秋=9〜11月／冬=12〜2月） */
const PLACES=[
  {id:"park",  n:"公園を散歩", need:"charm"},
  {id:"movie", n:"映画館",     need:"art"},
  {id:"amuse", n:"遊園地",     need:"sport"},
  {id:"aqua",  n:"水族館",     need:"art"},
  {id:"lib",   n:"図書館",     need:"study"},
  {id:"cafe",  n:"カフェ",     need:"trend"},
  {id:"sea",   n:"海へ行く",   need:"sport"},
  {id:"shrine",n:"神社",       need:"care"},
  /* ---- 季節かぎり ---- */
  {id:"hanami",n:"お花見",           need:"charm", s:"spring"},
  {id:"ichigo",n:"いちご狩り",       need:"care",  s:"spring"},
  {id:"pool",  n:"プール",           need:"sport", s:"summer"},
  {id:"hanabi",n:"花火大会",         need:"trend", s:"summer"},
  {id:"momiji",n:"紅葉狩り",         need:"art",   s:"autumn"},
  {id:"budou", n:"ぶどう狩り",       need:"care",  s:"autumn"},
  {id:"illum", n:"イルミネーション", need:"trend", s:"winter"},
  {id:"skate", n:"スケートリンク",   need:"sport", s:"winter"}
];
/* いまの季節に行ける場所だけを返す */
const placesNow=()=>{
  const c=CAL[Math.min(S.t||0,LAST)], sn=seasonOf(c.m);
  return PLACES.filter(p=>!p.s||p.s===sn);
};

/* =======================================================================
   デート先での選択肢
   ・選択肢の中身は story/events.js の DATE にあります
   ・その子がその場所を「好き／ふつう／嫌い」のどれと思っているかで、
     同じ選択肢でも結果が変わります（好き＝そのまま／ふつう＝1段さがる／
     嫌い＝さらにさがり、いちばん悪い選択肢は「最悪」になる）
   ======================================================================= */
const RANKJA={great:"最高",good:"良好",ok:"普通",bad:"微妙",worst:"最悪"};
const DATE_SHIFT={
  /* 好きな場所：書いたとおり。「最高」が出る */
  like  :{great:"great", good:"good", ok:"ok",  bad:"bad"},
  /* ふつうの場所：ひと段さがる。「最高」は出ない */
  normal:{great:"good",  good:"ok",   ok:"ok",  bad:"bad"},
  /* 嫌いな場所：上限は「良好」。苦手なことを選ぶと「最悪」 */
  hate  :{great:"good",  good:"ok",   ok:"bad", bad:"worst"}
};
/* 結果ごとの好感度（0〜1000のものさし） */
const DATE_AFF={great:130, good:70, ok:10, bad:-50, worst:-120};

const placePref=(g,pid)=>
  (g.like||[]).indexOf(pid)>=0 ? "like" :
  (g.hate||[]).indexOf(pid)>=0 ? "hate" : "normal";

/* 同じ場所へ何度行っても選択肢が変わるように、訪問回数で3組を回す */
function dateSet(pid){
  const rounds=(typeof DATE!=="undefined"&&DATE[pid])||null;
  if(!rounds||!rounds.length)return null;
  if(!S.visit)S.visit={};
  return rounds[(S.visit[pid]||0)%rounds.length]||null;
}

/* GIRLS / HIDDEN / ALLG は story.js が story/<名前>.js から組み立てます。
   攻略対象を増やすときは story/ にファイルを1つ足して、
   index.html に <script> を1行書くだけです。 */

/* =======================================================================
   いまのキャスト（主人公の性別で切りかわります）

     castNow()    … いま攻略できる相手のうち、最初からいる子
     castHidden() … いま攻略できる相手のうち、条件つきで出てくる子
     castAll()    … 性別を問わず、いる子ぜんぶ（きろく・おまけの検索用）

   ★ 「その子を id でさがす」だけのときは castAll() を使ってください。
     セーブに残っている子が、いまのキャストに入っていないことがあります
     （両方入りのゲームで、男性主人公のセーブを開いたときなど）。
   ======================================================================= */
const castAll   = ()=>(typeof ALLG!=="undefined")?ALLG:[];
const castOfSex = ()=>(typeof castFor==="function")?castFor(S.sex||"m")
                    :((typeof ALLG!=="undefined")?ALLG:[]);
const castNow    = ()=>castOfSex().filter(g=>!g.req);
const castHidden = ()=>castOfSex().filter(g=> g.req);
/* おまけ（シーン鑑賞・スチル・プロフィール）に並べる顔ぶれ。
   ★ おまけは「集めたものを見る場所」なので、既定では男女ぜんぶ並べます。
     castOfSex() にしてしまうと、タイトル画面の S.sex（既定は男性）で
     しぼられて、**男性キャラのスチルがいつまでも出ません**。
     いま選んでいる主人公のぶんだけにしたいときは
     assets/config.js の GAME_RULE.galleryAll を false に。 */
function castGal(){
  const mine=castOfSex();
  if(typeof GAME_RULE!=="undefined"&&GAME_RULE.galleryAll===false)return mine;
  /* いま選んでいる主人公の攻略対象を先に、そのあとにもう片方を並べます
     （ALLG のままだと order 順で男女が交互になって、読みづらいので） */
  const ok=new Set(mine.map(g=>g.id));
  return [...mine, ...castAll().filter(g=>!ok.has(g.id))];
}
/* ※ 固定行事のふるい分けは fixedOk()（下のほう）が受けもちます。
     誕生日は G(f.who)——つまり S.girls——で見るので、いま登場していない子の
     誕生日は出ません。ここに似た関数を作ると、二重になって混乱します。 */
/* 主人公の性別を選ばせるか（男女どちらのキャストもそろっているときだけ） */
function sexPickable(){
  const R=(typeof GAME_RULE!=="undefined")?GAME_RULE:{};
  const mode=R.protagonist||"auto";
  if(mode==="m"||mode==="f")return false;
  const has=s=>castFor(s).length>0;
  if(mode==="both")return true;
  return has("m")&&has("f");          /* "auto" */
}
/* はじめから遊ぶときの、はじめの性別 */
function sexDefault(){
  const R=(typeof GAME_RULE!=="undefined")?GAME_RULE:{};
  const mode=R.protagonist||"auto";
  if(mode==="m"||mode==="f")return mode;
  const d=(R.defaultSex==="f")?"f":"m";
  if(castFor(d).length)return d;                    /* その側に相手がいる */
  return castFor(d==="f"?"m":"f").length ? (d==="f"?"m":"f") : d;
}
const sexName=s=>(s==="f")?"女性":"男性";





/* ---- 日本の祝日 ---- */
const HOL_FIX={"1-1":"元日","2-11":"建国記念の日","2-23":"天皇誕生日","3-20":"春分の日",
  "4-29":"昭和の日","5-3":"憲法記念日","5-4":"みどりの日","5-5":"こどもの日",
  "8-11":"山の日","9-23":"秋分の日","11-3":"文化の日","11-23":"勤労感謝の日"};
const HOL_NTH=[{m:1,n:2,name:"成人の日"},{m:7,n:3,name:"海の日"},
               {m:9,n:3,name:"敬老の日"},{m:10,n:2,name:"スポーツの日"}];
/* ---- カレンダーに出す絵文字 ---- */
const HOL_EMO={"元日":"🎍","建国記念の日":"🎌","天皇誕生日":"🎌","春分の日":"🌷","昭和の日":"🌿",
  "憲法記念日":"📜","みどりの日":"🌿","こどもの日":"🎏","山の日":"⛰️","秋分の日":"🌾",
  "文化の日":"🎨","勤労感謝の日":"🍚","成人の日":"👘","海の日":"🌊","敬老の日":"🍵",
  "スポーツの日":"⚽","振替休日":"🎌"};
const MON_EMO={4:"🌸",5:"🎏",6:"☔",7:"🎐",8:"🌻",9:"🌾",10:"🍁",11:"🍂",12:"🎄",1:"🎍",2:"❄️",3:"🌷"};
const evEmo=e=>(e&&e.g)||(e&&e.id==="bday"?"🎂":"✨");
const holEmo=n=>HOL_EMO[n]||"🎌";
function fromG(g){let n=0;
  for(let y=1;y<=3;y++)for(let i=0;i<12;i++){const m=MORDER[i];
    if(g<n+MLEN[m])return {y,m,d:g-n+1}; n+=MLEN[m];}
  return null;}
function nthMonday(y,m,n){
  const w1=gdow(y,m,1);
  const first=1+((0-w1)+7)%7;
  return first+(n-1)*7;
}
function holName(y,m,d){
  const k=m+"-"+d;
  if(HOL_FIX[k])return HOL_FIX[k];
  for(const h of HOL_NTH) if(h.m===m && nthMonday(y,m,h.n)===d) return h.name;
  return null;
}
function holidayOf(y,m,d){
  const n=holName(y,m,d); if(n)return n;
  const g=gidx(y,m,d), w=((g-4)%7+7)%7;
  if(w===0&&g>0){const p=fromG(g-1); if(p&&holName(p.y,p.m,p.d))return "振替休日";}
  return null;
}
function holidayAt(t){const c=CAL[t]; return c?holidayOf(c.y,c.m,c.d):null;}
function isRest(t){ return dow(t)===6 || !!holidayAt(t); }

/* 固定イベント（年・月・日） */
const FIXED=[
 {m:5, d:20, id:"exam",  n:"中間テスト",  g:"📝", c:"ex", bg:"klass"},
 {m:6, d:15, id:"match", n:"練習試合", g:"⚾", c:"ev", bg:"ground"},
 {m:7, d:15, id:"exam",  n:"期末テスト",  g:"📝", c:"ex", bg:"klass"},
 {m:7, d:21, id:"vacs",  n:"夏休み開始",  g:"🌻", c:"vc", bg:"sea"},
 {m:8, d:10, id:"invite",n:"夏祭り",g:"🎆",need:200,pw:100, c:"ev", bg:"fest"},
 {m:9, d:15, id:"match", n:"練習試合", g:"⚾", c:"ev", bg:"ground"},
 {m:9, d:20, id:"sports",n:"体育祭",     g:"🏃", c:"ev", bg:"ground"},
 {m:10,d:25, id:"culture",n:"文化祭", g:"🎪", c:"ev", bg:"school"},
 {m:11,d:10, y:2, id:"trip",  n:"修学旅行 1日目", g:"🚌", c:"ev", bg:"town"},
 {m:11,d:11, y:2, id:"trip2", n:"修学旅行 2日目", g:"🚌", c:"ev", bg:"town"},
 {m:11,d:12, y:2, id:"trip3", n:"修学旅行 3日目", g:"🚌", c:"ev", bg:"town"},
 {m:12,d:24, id:"invite",n:"クリスマス",g:"🎄",need:350,pw:140, c:"ev", bg:"night"},
 {m:12,d:15, id:"match", n:"練習試合", g:"⚾", c:"ev", bg:"ground"},
 {m:12,d:25, id:"vacs",  n:"冬休み開始", g:"⛄", c:"vc", bg:"night"},
 {m:1, d:1,  id:"newyear",n:"お正月",    g:"⛩️", c:"ev", bg:"shrine"},
 {m:1, d:20, id:"exam",  n:"学年末テスト",g:"📝", c:"ex", bg:"klass"},
 {m:2, d:14, id:"valen", n:"バレンタイン",g:"🍫", c:"ev", bg:"klass"},
 {m:3, d:14, id:"white", n:"ホワイトデー",g:"🍬", c:"ev", bg:"klass"},
 {m:3, d:15, id:"match", n:"練習試合", g:"⚾", c:"ev", bg:"ground"},
 {m:3, d:19, id:"vacs",  n:"春休み開始", g:"🌸", c:"vc", bg:"sakura"}
];
/* 誕生日は story/<名前>.js の p.bday から足す（女の子を増やすと自動で増えます）。
   そのあと、学校の年度の順（4月はじまり）にならべ直す。 */
if(typeof BDAYS!=="undefined")Array.prototype.push.apply(FIXED,BDAYS);
/* 追加シナリオ（DLC）。story/ のファイルで DLC_EVENTS に足すと、ここで合流します。
   ふつうの固定イベントと同じ形に、run:async(ev)=>{...} を足したものを入れてください。 */
if(typeof DLC_EVENTS!=="undefined")Array.prototype.push.apply(FIXED,DLC_EVENTS);
/* 学校の年度の順（4月はじまり）にならべる。
   同じ日に「◯年目だけ」と「毎年」があったら、◯年目のほうを先にする
   （fixedAt が先に見つけたほうを使うため） */
FIXED.sort((a,b)=>MORDER.indexOf(a.m)-MORDER.indexOf(b.m)
  || a.d-b.d || (b.y||0)-(a.y||0));
/* その行事が、いまのプレイで起きるか。
   ★ 誕生日は「いま攻略できる子」のぶんだけ出します（G は S.girls をさがします）。
     両方入りのゲームでは、同じ日に男女それぞれの誕生日が入ることがあるので、
     **見つかった1件目で打ち切らず、起きるものをさがします。** */
function fixedOk(f){
  if(f.id==="bday"&&!G(f.who))return false;
  if(f.id==="match"&&!isSportsClub())return false;    /* 運動部のときだけ */
  return true;
}
const fixedFind=(y,m,d)=>
  FIXED.filter(e=>e.m===m&&e.d===d&&(!e.y||e.y===y)).find(fixedOk)||null;
function fixedAt(t){
  const c=CAL[t]; if(!c)return null;
  const f=fixedFind(c.y,c.m,c.d);
  if(f)return f;
  if(S.bd&&c.m===S.bd.m&&c.d===S.bd.d)return {m:c.m,d:c.d,id:"mybday",n:"あなたの誕生日",c:"bd",bg:"klass"};
  return null;
}
function eventOn(y,m,d){
  const f=fixedFind(y,m,d);
  if(f)return f;
  if(S.bd&&m===S.bd.m&&d===S.bd.d)return {m,d,id:"mybday",n:"あなたの誕生日",g:"🎉",c:"bd",bg:"klass"};
  return null;
}
function gidx(y,m,d){let n=0;
  for(let yy=1;yy<=3;yy++)for(let i=0;i<12;i++){const mm=MORDER[i];
    if(yy===y&&mm===m)return n+(d-1); n+=MLEN[mm];}
  return -1;}
const gdow=(y,m,d)=>((gidx(y,m,d)-4)%7+7)%7;

/* =======================================================================
   3. 状態
   ======================================================================= */
const S={name:"桜坂 優",t:0,
  /* 主人公の性別。"m" 男性／"f" 女性。
     ★ 攻略できる相手が誰になるかは、これと assets/config.js の
       GAME_RULE.target で決まります（既定は異性）。
       古いセーブには入っていないので、そのときは "m" になります。 */
  sex:"m",
  p:{study:8,sport:8,art:6,charm:10,care:10,trend:6,rich:30},
  stress:0,girls:[],plan:new Array(6).fill(null),cur:0,pick:null,res:new Array(6).fill(null),
  sel:null,sei:"桜坂",mei:"優",ev:{},evseen:{},log:[],gen:0,speed:2,tspeed:2,bgfade:2,job:null,club:"none",blood:"A",bd:{m:5,d:5},sunPick:null,
  prof:{}, rec:{cmd:{},date:{},tel:{},great:0,match:[0,0,0],cult:[0,0],cold:0}};
/* 3年間の記録。エピローグのふりかえりで使う */
function recInit(){ return {cmd:{},date:{},tel:{},great:0,match:[0,0,0],cult:[0,0],cold:0}; }
function rec(box,key,n){ if(!S.rec)S.rec=recInit();
  if(key===undefined){S.rec[box]=(S.rec[box]||0)+(n||1);return;}
  if(!S.rec[box])S.rec[box]={}; S.rec[box][key]=(S.rec[box][key]||0)+(n||1); }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const G=id=>S.girls.find(g=>g.id===id);
/* 役どころ（cue）でさがす。
   ★ 主人公の性別を変えると、登場する子ごと入れかわります。
     ですから、みんなが出るイベント（テスト・体育祭など）の中では
     G("rena") のように名ざしにせず、こちらで引いてください。
     札は story/<id>.js の p.cue にあります。
       "osana" 幼なじみ ／ "top" 優等生・生徒会 ／ "sport" 運動部
     その札の子がいないキャストなら null が返るので、
     呼ぶ側は「いなければ、その場面を飛ばす」と書いておけば安全です。 */
function Gcue(cue){
  if(typeof STORY==="undefined")return null;
  return (S.girls||[]).find(g=>{
    const s=STORY[g.id]; return s&&s.p&&s.p.cue===cue;
  })||null;
}
let resolver=null;

/* =======================================================================
   3.5 イベントID
   ・イベントひとつひとつに固有のIDが付いています（story/eventids.js の台帳）
   ・見たイベントは S.evseen に「見た日」として残ります（セーブに入ります）
   ・使いかた
       evSeen("aff_kanade_1")    … もう見たか
       evDay("aff_kanade_1")     … 見た日（何日目か）。まだなら null
       evReady("aff_kanade_2")   … いま発生条件を満たしているか（まだ見ていない）
       evUnlocks("aff_kanade_1") … このイベントが条件になっているイベント
       evMark("aff_kanade_1")    … 見たことにする（ゲーム側が自動で呼びます）
   ・イベント一覧.md は、この台帳から自動で作られます
   ======================================================================= */
let EVENTS=null, EVENT_LIST=null;
function evAll(){
  if(!EVENT_LIST){
    EVENT_LIST=(typeof buildEventDefs==="function")?buildEventDefs():[];
    EVENTS={}; for(const e of EVENT_LIST) EVENTS[e.id]=e;
  }
  return EVENT_LIST;
}
function evDef(id){ evAll(); return EVENTS[id]||null; }
function evSeen(id){ return !!(S.evseen && S.evseen[id]!==undefined); }
function evDay(id){ return evSeen(id)?S.evseen[id]:null; }
function evMark(id){
  if(!id)return;
  if(!S.evseen)S.evseen={};
  if(S.evseen[id]===undefined)S.evseen[id]=S.t;
}
function evReset(id){ if(S.evseen)delete S.evseen[id]; }
/* まだ見ていなくて、必要なイベントを見終わっていて、条件も満たしている */
function evReady(id){
  const d=evDef(id); if(!d)return false;
  if(evSeen(id))return false;
  if(d.needs&&d.needs.some(n=>!evSeen(n)))return false;
  if(typeof d.cond==="function"){ try{ if(!d.cond())return false; }catch(e){ return false; } }
  return true;
}
/* このイベントが「発生条件」になっているイベントのID */
function evUnlocks(id){ return evAll().filter(e=>e.needs&&e.needs.indexOf(id)>=0).map(e=>e.id); }
/* 一覧。{id,n,chara,kind,when,where,seen,day,ready} の形でかえします */
/* イベントの一覧。
   ★ いまの主人公では起きないもの（sex が反対のもの）は、はじめから外します。
     f.all を true にすると、性別を問わず全部返します（仕様書づくり用）。 */
function evList(f){
  const my=(S.sex==="f")?"f":"m";
  return evAll()
    .filter(e=>(f&&f.all) || !e.sex || e.sex===my)
    .filter(e=>!f||(!f.kind||e.kind===f.kind)&&(!f.chara||e.chara===f.chara))
    .map(e=>({id:e.id,n:e.n,chara:e.chara,kind:e.kind,sex:e.sex||null,when:e.when,where:e.where,
              needs:(e.needs||[]).slice(),seen:evSeen(e.id),day:evDay(e.id),ready:evReady(e.id)}));
}
/* 昔のセーブ（好感度イベントを S.ev["kanade0"] で持っていたもの）を引きつぐ */
function evMigrate(){
  if(!S.evseen)S.evseen={};
  if(!S.ev||typeof AFF_EV==="undefined")return;
  for(const gid in AFF_EV){
    (AFF_EV[gid]||[]).forEach((e,i)=>{
      const id="aff_"+gid+"_"+(i+1);
      if(S.ev[gid+i] && S.evseen[id]===undefined) S.evseen[id]=S.t;
    });
  }
}

/* =======================================================================
   4. 立ち絵
   ・assets/chara/<名前>/ に絵があればそれを重ねて使う
       base.png（体） → outfit/○○.png（服） → face/○○.png（表情） → front.png（前髪など）
   ・絵が1枚も無い子は、これまでどおり下の SVG で描く
   ======================================================================= */
const ARTDIR="assets/";
/* 素材ファイルが取りこまれていれば、その中身（データURL）を返す。
   1ファイル版では ART_DATA に base64 が入っている。フォルダ版ではパスをそのまま使う。 */
function artURL(path){
  if(typeof ART_DATA!=="undefined" && ART_DATA[path]) return ART_DATA[path];
  return ARTDIR+path;
}
/* その素材に、ほんとうに手が届くか。
   1ファイル版（ART_ONEFILE）は、埋めこまれていないものには手が届きません。
   イベントスチルは、ふだん埋めこまない（重いので）ので、これで見わけます。
   フォルダ版とサーバー版は、いつでも true です。 */
function artHave(path){
  if(typeof ART_ONEFILE==="undefined" || !ART_ONEFILE) return true;
  return !!(typeof ART_DATA!=="undefined" && ART_DATA[path]);
}
const artOf=id=>(typeof ART_LIST!=="undefined" && ART_LIST.chara && ART_LIST.chara[id])||null;
const hasArt=id=>{const a=artOf(id);
  return !!(a && (a.base || (a.full && Object.keys(a.full).length)));};
/* 一覧は「ファイル名（拡張子つき）」で持っています。
   名前（拡張子なし）から、実際のファイル名を探します。
   こうしておくと png でも webp でも jpg でも同じように使えます。 */
function artName(list,name){
  if(!list||!name)return null;
  /* ★ 大文字小文字はくべつしません。Windows や Mac では Logo.png と
     logo.png が同じものとして保存できてしまい、そのままだと
     「置いたのに出ない」ことになるためです。 */
  const k=String(name).toLowerCase();
  return list.find(f=>f.replace(/\.[^.]+$/,"").toLowerCase()===k)||null;
}

/* ---- タイトル画面のUI画像（assets/ui/） -------------------------------
   ロゴとメニューボタンを、置いた絵に差しかえます。
   置いていないものは、いままでどおり文字のまま出ます（1つずつ差しかえOK）。 */
const UIRULE=(typeof UI_RULE!=="undefined")?UI_RULE
  :{logo:"logo",buttons:{new:"btn_new",load:"btn_load",omake:"btn_omake",opt:"btn_opt"},
    bg:"title",bgm:"title"};
function uiArt(name){
  const L=(typeof ART_LIST!=="undefined"&&ART_LIST.ui)||[];
  const f=artName(L,name);
  return f?artURL("ui/"+f):null;
}
/* ---- ゲーム全体の書体（assets/font/） ---------------------------------
   assets/font/ にフォントファイル（.woff2 / .woff / .ttf / .otf）を置くと、
   ゲームじゅうの文字がその書体になります。**置きかえるだけ**でよく、
   ファイル名は何でもかまいません（1つだけ置いてください）。
   置いていなければ、いままでどおり端末の標準の書体を使います。

   太字ぶん（Bold）も置きたいときは、ファイル名に bold か 700 を入れてください
   （例: myfont-Bold.woff2）。そのファイルは太字のときだけ使われます。 */
const FONTFMT={woff2:"woff2", woff:"woff", ttf:"truetype", otf:"opentype"};
function fontArtSet(){
  const L=(typeof ART_LIST!=="undefined"&&ART_LIST.font)||[];
  if(!L.length)return null;
  const isBold=f=>/bold|[-_.]700/i.test(f);
  const reg=L.find(f=>!isBold(f))||L[0];
  const bold=L.find(isBold);
  const face=(f,w)=>{
    const ext=(f.split(".").pop()||"").toLowerCase();
    return `@font-face{font-family:"GameFont";src:url("${artURL("font/"+f)}")`
      +` format("${FONTFMT[ext]||"truetype"}");font-weight:${w};font-display:swap;}`;
  };
  let css=face(reg, bold?"400":"400 900");
  if(bold)css+=face(bold,"700 900");
  const el=document.createElement("style");
  el.id="gameFont"; el.textContent=css;
  document.head.appendChild(el);
  /* もとの書体は「代わり」として後ろに残しておく（無い文字はそちらで出ます） */
  const base=getComputedStyle(document.documentElement).getPropertyValue("--ff").trim();
  document.documentElement.style.setProperty("--ff",`"GameFont",${base}`);
  return reg;
}

/* ボタンの読みあげ用の名前（画像に差しかわっても、意味が消えないように） */
const TBTN_LABEL={new:"はじめから",load:"つづきから",omake:"おまけ",opt:"オプション"};
/* タイトルのBGM。assets/bgm/title.* があればそれ、無ければ春の合成音 */
function titleBgmName(){
  const n=UIRULE.bgm||"title";
  return auPath("bgm",n)?n:"spring";
}
/* ---- タイトルの背景（季節で切りかわります）-----------------------------
   **最後にセーブした記録の「ゲームの中の月」**から季節を出して、
   その季節の絵を出します。オートセーブもふくめて、いちばん新しい記録を見ます。

     assets/bg/title_spring.png   春（3〜4〜5月）
     assets/bg/title_summer.png   夏（6〜7〜8月）
     assets/bg/title_autumn.png   秋（9〜10〜11月）
     assets/bg/title_winter.png   冬（12〜1〜2月）

   ・その季節の絵が無ければ `assets/bg/title.png`、それも無ければSVGの校門
     （1枚ずつ足していけます。冬だけ用意する、といった置きかたもできます）
   ・**セーブがまだ1つも無いときは「春」**です
     （ゲームは1年目4月5日の入学式から始まるため）
   ・季節の区切りは、BGMなどと同じ `seasonOf()` を使っています
   ・タイトルへ戻るたびに `showTitle()` が出しなおすので、
     セーブしてタイトルへ戻れば、その場で絵が変わります
   ------------------------------------------------------------------- */
const SEASONJA={spring:"春",summer:"夏",autumn:"秋",winter:"冬"};
const SEASONS=["spring","summer","autumn","winter"];
let DBG_TSEASON=null;      /* 🛠️デバッグから、季節を決めうちで見るときに使います */
function lastSaveSeason(){
  if(DBG_TSEASON)return DBG_TSEASON;
  let newest=null;
  try{
    const d=storeGet();
    for(const k in d){
      const v=d[k];
      if(!v||typeof v!=="object"||typeof v.t!=="number")continue;
      if(!newest||(v.ts||0)>(newest.ts||0))newest=v;
    }
  }catch(e){}
  if(!newest)return "spring";                    /* まだ1回も遊んでいない */
  const c=CAL[clamp(newest.t|0,0,LAST)];
  return (c&&seasonOf(c.m))||"spring";
}
function titleBgHTML(){
  const L=(typeof ART_LIST!=="undefined"&&ART_LIST.bg)||[];
  const base=UIRULE.bg||"title";
  const hit=artName(L,base+"_"+lastSaveSeason()) || artName(L,base);
  return hit?`<img class="bgimg" src="${artURL("bg/"+hit)}" alt="">`:BG.school();
}
/* ---- タイトル背景にかける「うすい膜」-----------------------------------
   ふだんは **かけません**（背景の絵の色を、そのまま出すため）。
   絵が明るくて文字が読みにくいときだけ、assets/config.js の UI_RULE で
     veil      … 濃さ 0〜1（0＝かけない）
     veilColor … 膜の色（"#ffdcec" うすいピンク／"#000000" 暗い膜 など）
   を指定すると、下にいくほど濃くなる膜がかかります。 */
function hexRGBA(hex,a){
  let h=String(hex||"").replace("#","");
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(!/^[0-9a-f]{6}$/i.test(h))h="ffdcec";           /* 書きまちがえても止まらない */
  const n=parseInt(h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${Math.round(a*1000)/1000})`;
}
function applyTitleVeil(){
  const el=document.querySelector(".tveil"); if(!el)return;
  const v=Math.max(0,Math.min(1,+(UIRULE.veil||0)));
  if(!v){ el.style.background="none"; return; }       /* かけない（ふだんはこちら） */
  const c=UIRULE.veilColor||"#ffdcec";
  el.style.background=`linear-gradient(180deg,${hexRGBA(c,v*0.15)} 0%,`
    +`${hexRGBA(c,v*0.52)} 45%,${hexRGBA(c,v)} 100%)`;
}

/* ---- ロゴとメニューを、画面のどこに置くか -------------------------------
   assets/config.js の UI_RULE で決めます。
     menuAlign … "left" 左寄せ／"center" まんなか／"right" 右寄せ
     menuX     … 画面のはしからの余白（横はばに対する割合）
     menuY     … 上下の位置。0＝まんなか。プラスで下、マイナスで上へ
     logoX     … ロゴだけ、さらに左右にずらしたいとき（マイナスで左へ）
   ボタンの中の「アイコンと文字の置き場所」も、ここで一緒に入れています。 */
function applyTitleMenuPos(){
  const st=$("stage"); if(!st)return;
  const a=UIRULE.menuAlign||"left";
  const pc=(k,d)=>((typeof UIRULE[k]==="number"?UIRULE[k]:d)*100);
  const x=pc("menuX",0.085);
  st.style.setProperty("--tali", a==="left"?"flex-start":a==="right"?"flex-end":"center");
  st.style.setProperty("--tpadl", (a==="left"?x:1.5)+"%");
  st.style.setProperty("--tpadr", (a==="right"?x:1.5)+"%");
  st.style.setProperty("--tmy",   pc("menuY",0)+"%");
  st.style.setProperty("--tlogox",pc("logoX",0)+"%");
  /* 下の一行（あらすじ）も、ロゴとおなじ側にそろえる */
  st.style.setProperty("--tfootl", (a==="left"?x:a==="right"?100-x:50)+"%");
  st.style.setProperty("--tfootx", a==="center"?"-50%":a==="right"?"-100%":"0");
  /* ボタンの中の、アイコンと文字の位置（土台の絵に対する割合） */
  st.style.setProperty("--bix", pc("btnIconX", 0.105)+"%");
  st.style.setProperty("--bih", pc("btnIconH", 0.52 )+"%");
  st.style.setProperty("--blx", pc("btnLabelX",0.53 )+"%");
  st.style.setProperty("--bly", pc("btnLabelY",0.42 )+"%");
  st.style.setProperty("--blh", pc("btnLabelH",0.34 )+"%");
  st.style.setProperty("--bey", pc("btnEnY",   0.76 )+"%");
  st.style.setProperty("--beh", pc("btnEnH",   0.13 )+"%");
}

/* ---- メニューボタンの素材（土台＋アイコン＋文字の3枚重ね）----------------
     assets/ui/ui_title_base_<名前>_normal.png   土台（ふだん）
     assets/ui/ui_title_base_<名前>_hover.png    土台（カーソルが乗ったとき・任意）
     assets/ui/ui_title_icon_<名前>.png          左のアイコン（任意）
     assets/ui/ui_title_label_<名前>_ja.png      日本語の文字（任意）
     assets/ui/ui_title_label_<名前>_en.png      英語の小さい文字（任意）
   <名前> は UI_RULE.parts で決めます
   （はじめから＝newgame／つづきから＝continue／おまけ＝extra／オプション＝option）。
   土台が見つからないボタンは、1枚絵（UI_RULE.buttons）→ 文字、の順に落ちます。 */
const TPARTS_DEF={new:"newgame", load:"continue", omake:"extra", opt:"option"};
function tbtnParts(key){
  const n=(UIRULE.parts||TPARTS_DEF)[key];
  if(!n)return null;
  const base=uiArt("ui_title_base_"+n+"_normal");
  if(!base)return null;                    /* 土台が無ければ、この作りは使わない */
  return {base, hover:uiArt("ui_title_base_"+n+"_hover"),
          icon:uiArt("ui_title_icon_"+n),
          ja:  uiArt("ui_title_label_"+n+"_ja"),
          en:  uiArt("ui_title_label_"+n+"_en")};
}
/* 絵の「よこ÷たて」をおぼえて、入れものの形を絵とぴったり同じにする。
   （これをしないと上下にすき間ができて、中のアイコンや文字の位置がずれます） */
function artAspect(img,varName){
  if(!img)return;
  const set=()=>{ if(img.naturalWidth&&img.naturalHeight)
    $("stage").style.setProperty(varName,(img.naturalWidth/img.naturalHeight).toFixed(4)); };
  if(img.complete)set(); else img.addEventListener("load",set,{once:true});
}
/* アイコンと文字の大きさを「素材の原寸どおり」に合わせる。
   UI_RULE の btnIconH などが "auto"（既定）のとき、絵の実寸から
   「土台の何％の高さか」を計算して当てはめます。
   ★こうしておくと、素材を作りなおしても、数字を直さずにそのまま合います。
     大きさを自分で決めたいときは、"auto" のかわりに 0.42 のような数を書きます。 */
const TPART_H=[[".pi","btnIconH"],[".pl","btnLabelH"],[".pe","btnEnH"]];
function tbtnFit(btn){
  const u=btn.querySelector(".u0"); if(!u)return;
  const go=()=>{
    if(!u.naturalHeight)return;
    $("stage").style.setProperty("--tbtnar",(u.naturalWidth/u.naturalHeight).toFixed(4));
    for(const [sel,key] of TPART_H){
      const el=btn.querySelector(sel); if(!el)continue;
      if(typeof UIRULE[key]==="number"){ el.style.height=""; continue; }  /* 数で決めうち */
      const set=()=>{ if(el.naturalHeight)
        el.style.height=(el.naturalHeight/u.naturalHeight*100).toFixed(2)+"%"; };
      if(el.complete)set(); else el.addEventListener("load",set,{once:true});
    }
  };
  if(u.complete)go(); else u.addEventListener("load",go,{once:true});
}

/* ロゴとメニューボタンを、画像があれば差しかえる。
   絵が無いものは文字のまま。画像と文字が混ざっていても崩れません。 */
function applyTitleArt(){
  applyTitleVeil();
  applyTitleMenuPos();
  const logo=$("tlogo");
  if(logo){
    const src=uiArt(UIRULE.logo||"logo");
    if(logo.dataset.src!==(src||"")){
      logo.dataset.src=src||"";
      logo.classList.toggle("img",!!src);
      logo.innerHTML=src?`<img src="${src}" alt="${GAME_TITLE}">`:GAME_TITLE;
      if(src)artAspect(logo.querySelector("img"),"--tlogoar");
    }
  }
  const B=UIRULE.buttons||{};
  $("title").querySelectorAll(".tbtn").forEach(b=>{
    const key=b.dataset.t, lab=TBTN_LABEL[key]||"";
    /* ① 3枚重ねの素材があれば、そちらを使う */
    const p=tbtnParts(key);
    if(p){
      if(b.dataset.src!==p.base){           /* まだ差しかえていなければ組み立てる */
        b.dataset.src=p.base;
        b.classList.add("img","parts");
        b.innerHTML=`<img class="u0" src="${p.base}" alt="${lab}">`
          +(p.hover?`<img class="u1" src="${p.hover}" alt="">`:"")
          +(p.icon ?`<img class="pi" src="${p.icon}" alt="">`:"")
          +(p.ja   ?`<img class="pl" src="${p.ja}"   alt="">`:"")
          +(p.en   ?`<img class="pe" src="${p.en}"   alt="">`:"");
      }
      tbtnFit(b);        /* 大きさは毎回あわせ直す（設定を変えたときのため） */
      return;
    }
    /* ② むかしからの1枚絵 */
    const base=B[key]; if(!base)return;
    const src=uiArt(base); if(!src)return;
    if(b.dataset.src===src)return;          /* もう差しかえてある */
    b.dataset.src=src;
    const on=uiArt(base+"_on");
    b.classList.add("img");
    b.innerHTML=`<img class="u0" src="${src}" alt="${lab}">`+
                (on?`<img class="u1" src="${on}" alt="">`:"");
    artAspect(b.querySelector(".u0"),"--tbtnar");
  });
}

/* いまの場面で着てほしい服の名前を、望ましい順にならべる。
   main = その場面で着るべきもの ／ fb = 無かったときの代わり */
function outfitWant(bgKey){
  const R=(typeof OUTFIT_RULE!=="undefined")?OUTFIT_RULE:{def:"uniform_w",month:{},bg:{},fallback:[]};
  const main=[];
  if(S.vnOutfit)main.push(S.vnOutfit);                    /* 場面ごとの指定が最優先 */
  if(bgKey&&R.bg&&R.bg[bgKey])main.push(R.bg[bgKey]);
  const c=CAL[Math.min(S.t||0,LAST)];
  if(c&&R.month&&R.month[c.m])main.push(R.month[c.m]);
  main.push(R.def);
  return {main:main.filter(Boolean), fb:(R.fallback||[]).filter(Boolean)};
}
/* いまの場面で着ている服を決める（重ね絵ぶん） */
function outfitOf(g,bgKey){
  const a=artOf(g.id); if(!a||!a.outfit||!a.outfit.length)return null;
  const W=outfitWant(bgKey);
  for(const n of W.main.concat(W.fb)) if(artName(a.outfit,n))return n;
  return a.outfit[0].replace(/\.[^.]+$/,"");
}

/* ---- 1枚絵モード -------------------------------------------------------
   assets/chara/<名前>/full/ に「1枚で完成している立ち絵」があれば、
   重ね絵よりも優先して使います。
     full/normal.png            … 服はひととおり。表情ぶんだけ用意すればOK
     full/casual/normal.png     … 服ちがいを足したいとき（フォルダ名＝服の名前）
   その場面の服が無ければ既定のものへ、その表情が無ければ normal へ落ちます。 */
/* 立ち絵（full/）と顔画像（bust/）で共通の探しかた。
     ① その場面の服 → ② 直下（ふだん着ているもの）→ ③ 代わりの服
   ②を③より先にするのが大事で、こうしないと「教室なのに私服」になります。
   その服が無ければ直下へ、その表情が無ければ normal へ落ちます。 */
function pickArt(gid,kind,exp){
  const a=artOf(gid), set=a&&a[kind];
  if(!set)return null;
  const pick=dir=>{
    const list=set[dir];
    if(!list||!list.length)return null;
    return artName(list,exp)||artName(list,"normal")||list[0];
  };
  const W=outfitWant(S.vnBgKey);
  const dirs=W.main.filter(n=>set[n])
              .concat([""])                        /* "" ＝ そのフォルダの直下 */
              .concat(W.fb.filter(n=>set[n]))
              .concat(Object.keys(set));           /* 念のため、あるものから */
  for(const d of dirs){
    const f=pick(d);
    if(f)return "chara/"+gid+"/"+kind+"/"+(d?d+"/":"")+f;
  }
  return null;
}
function fullArt(g,exp){ return pickArt(g.id,"full",exp); }

/* ---- 顔枠に出す絵 ------------------------------------------------------
   assets/chara/<名前>/bust/<表情>.png があればそれを使い、
   無ければ立ち絵の顔の部分を切り取ります。 */
const FACEWIN=(typeof FACE_WINDOW!=="undefined")?FACE_WINDOW
  :{on:true,standing:"normal",width:0.185,widthMb:0.165,height:1.45};
function bustURL(g,exp){
  const p=pickArt(g.id,"bust",exp);
  return p?artURL(p):null;
}
function bustArt(g,exp){
  const u=bustURL(g,exp);
  return u?`<img src="${u}" alt="">`:null;
}

/* ---- イベントスチル（1枚絵）--------------------------------------------
     assets/chara/hinata/cg/01.png        1番
     assets/chara/hinata/cg/01_a.png      1番の差分
     assets/cg/01.png                     みんなのスチル（who を省いたとき）
   番号は 1〜CGRULE.slots。差分は、この枠には数えません。
   題名は story/cg.js（CG_TITLES）に書きます。 */
const CGRULE=(typeof CG_RULE!=="undefined")?CG_RULE:{};
const cgSlots=()=>(typeof CGRULE.slots==="number"?CGRULE.slots:30);
const CGTTL=(typeof CG_TITLES!=="undefined")?CG_TITLES:{};
/* その子（who 省略で共通）の、スチルのファイル名の一覧 */
function cgList(who){
  if(typeof ART_LIST==="undefined")return [];
  if(!who||who==="common")return ART_LIST.cg||[];
  const a=ART_LIST.chara&&ART_LIST.chara[who];
  return (a&&a.cg)||[];
}
const cgDir=who=>(!who||who==="common")?"cg/":("chara/"+who+"/cg/");
/* ファイル名を「番号」と「差分キー」に分ける。01_smile.png → {n:1,d:"smile"} */
function cgParse(f){
  const m=String(f).replace(/\.[^.]+$/,"").match(/^(\d+)(?:[_-](.+))?$/);
  return m ? {n:+m[1], d:(m[2]||"").toLowerCase()} : null;
}
/* 番号（と差分）から、実際のファイル名をさがす */
function cgFile(who,n,diff){
  const want=(diff||"").toLowerCase();
  const hit=cgList(who).map(f=>({f,p:cgParse(f)}))
    .filter(x=>x.p && x.p.n===+n && x.p.d===want)[0];
  return hit?hit.f:null;
}
/* 出せる絵のURL。差分が無ければ、差分なしの絵に落ちます。
   1ファイル版で埋めこまれていないときは null（＝絵なしで話だけ進みます） */
function cgURL(who,n,diff){
  let f=cgFile(who,n,diff);
  if(!f&&diff)f=cgFile(who,n,"");        /* その差分が無ければ、もとの絵 */
  if(!f)return null;
  const p=cgDir(who)+f;
  return artHave(p)?artURL(p):null;
}
/* その番号のスチルが（差分もふくめて）1枚でもあるか */
const cgHas=(who,n)=>!!cgURL(who,n);
/* 見出しに出す題名。story/cg.js に書いていなければ「スチル 07」 */
function cgTitle(who,n,diff){
  const e=(CGTTL[who||"common"]||{})[n];
  const two=String(n).padStart(2,"0");
  if(e===undefined||e===null)return "スチル "+two;
  if(typeof e==="string")return e||("スチル "+two);
  const base=e.t||("スチル "+two);
  const d=diff&&e.d&&e.d[diff];
  return d?(base+"（"+d+"）"):base;
}
/* その番号にある差分キーの一覧（差分なしは含みません） */
function cgDiffs(who,n){
  return cgList(who).map(cgParse).filter(p=>p&&p.n===+n&&p.d).map(p=>p.d);
}
/* 差分の見出し。story/cg.js に書いていなければ、差分キーをそのまま出します */
function cgDiffName(who,n,d){
  const e=(CGTTL[who||"common"]||{})[n];
  return (e&&e.d&&e.d[d])||d;
}

/* 重ね絵のHTMLを作る。crop のときは顔だけ切り取る */
function charaArt(g,exp,mode){
  const a=artOf(g.id), dir="chara/"+g.id+"/";
  const one=fullArt(g,exp);                  /* 1枚絵があれば、それだけを使う */
  let src;
  if(one){ src=[one]; }
  else{
    const face=artName(a.face,exp)||artName(a.face,"normal");
    const outfit=artName(a.outfit, outfitOf(g, S.vnBgKey));
    src=[dir+a.base];
    if(outfit)src.push(dir+"outfit/"+outfit);
    if(face)  src.push(dir+"face/"+face);
    if(a.front)src.push(dir+a.front);
  }
  const imgs=src.map(s=>`<img src="${artURL(s)}" alt="">`).join("");
  if(mode!=="crop") return `<div class="chara">${imgs}</div>`;
  const H=(typeof ART_HEAD!=="undefined"&&ART_HEAD[g.id])||
          (typeof ART_HEAD_DEF!=="undefined"?ART_HEAD_DEF:{x:0.30,y:0.03,w:0.40});
  /* left も margin-top も「入れものの横幅」に対する％なので、四角でない枠でもずれない */
  const st=`width:${(100/H.w).toFixed(2)}%;left:${(-H.x/H.w*100).toFixed(2)}%;`+
           `margin-top:${(-H.y/H.w*100).toFixed(2)}%`;
  return `<div class="chara crop"><div class="in" style="${st}">${imgs}</div></div>`;
}

function portrait(g,exp,mode){
  if(g&&hasArt(g.id)) return charaArt(g,exp||"normal",mode);
  const crop=(mode==="crop"), sprite=(mode==="sprite"), bust=(mode==="bust");
  const skin="#ffe2d2",skinS="#f3c3ae";
  const closed=(exp==="happy");
  const blush=(exp==="blush"||exp==="happy")?.55:(exp==="sad"?.15:0);
  let back="",extra="";
  if(g.style==="long"){
    back=`<path d="M62,150 C58,300 78,330 110,336 L190,336 C222,330 242,300 238,150 Z" fill="${g.hair2}"/>
          <ellipse cx="150" cy="150" rx="88" ry="100" fill="${g.hair2}"/>`;
  }else if(g.style==="hime"){
    back=`<path d="M66,150 C62,290 80,320 108,326 L192,326 C220,320 238,290 234,150 Z" fill="${g.hair2}"/>
          <ellipse cx="150" cy="150" rx="86" ry="98" fill="${g.hair2}"/>`;
    extra=`<path d="M70,140 L70,265 Q86,272 96,262 L94,140 Z" fill="${g.hair}"/>
           <path d="M230,140 L230,265 Q214,272 204,262 L206,140 Z" fill="${g.hair}"/>`;
  }else if(g.style==="wave"){
    back=`<path d="M56,150 C48,296 70,340 108,348 L192,348 C230,340 252,296 244,150 Z" fill="${g.hair2}"/>
          <ellipse cx="150" cy="150" rx="90" ry="100" fill="${g.hair2}"/>`;
    extra=`<path d="M62,206 q30,22 6,50 q-24,28 2,56" stroke="${g.hair}" stroke-width="20" fill="none" stroke-linecap="round"/>
           <path d="M238,206 q-30,22 -6,50 q24,28 -2,56" stroke="${g.hair}" stroke-width="20" fill="none" stroke-linecap="round"/>
           <path d="M92,236 q26,26 2,54" stroke="${g.hair}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".8"/>
           <path d="M208,236 q-26,26 -2,54" stroke="${g.hair}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".8"/>
           <g transform="translate(212,62) rotate(18)"><ellipse rx="17" ry="11" fill="${g.ribbon}"/>
             <ellipse cx="-15" cy="6" rx="12" ry="8" fill="${g.ribbon}"/><ellipse cx="15" cy="6" rx="12" ry="8" fill="${g.ribbon}"/>
             <circle r="5" fill="#fff" opacity=".7"/></g>`;
  }else if(g.style==="short"){
    back=`<ellipse cx="150" cy="150" rx="84" ry="96" fill="${g.hair2}"/>
          <path d="M66,150 C62,240 78,266 104,272 L196,272 C222,266 238,240 234,150 Z" fill="${g.hair2}"/>`;
    extra=`<path d="M68,146 L68,242 Q86,256 102,242 L98,146 Z" fill="${g.hair}"/>
           <path d="M232,146 L232,242 Q214,256 198,242 L202,146 Z" fill="${g.hair}"/>
           <rect x="118" y="52" width="64" height="9" rx="4" fill="${g.ribbon}"/>`;
  }else if(g.style==="drill"){
    back=`<ellipse cx="150" cy="150" rx="86" ry="98" fill="${g.hair2}"/>
          <path d="M64,150 C60,272 78,302 106,308 L194,308 C222,302 240,272 236,150 Z" fill="${g.hair2}"/>`;
    extra=[[58,-1],[242,1]].map(([cx,dir])=>[0,1,2,3].map(i=>
      `<circle cx="${cx+dir*(i%2?11:0)}" cy="${196+i*40}" r="${36-i*5}" fill="${i%2?g.hair:g.hair2}"/>`).join("")).join("")
      +`<g transform="translate(150,44)"><path d="M-26,10 q26,-24 52,0 q-26,10 -52,0 z" fill="${g.ribbon}"/>
        <circle cy="4" r="7" fill="#fff" opacity=".8"/></g>`;
  }else{
    back=`<ellipse cx="150" cy="150" rx="82" ry="94" fill="${g.hair2}"/>
          <path d="M56,168 C24,196 22,268 44,290 C64,308 84,286 82,250 C80,214 76,186 56,168 Z" fill="${g.hair}"/>
          <path d="M244,168 C276,196 278,268 256,290 C236,308 216,286 218,250 C220,214 224,186 244,168 Z" fill="${g.hair}"/>
          <ellipse cx="62" cy="176" rx="15" ry="10" fill="${g.ribbon}"/>
          <ellipse cx="238" cy="176" rx="15" ry="10" fill="${g.ribbon}"/>`;
  }
  const uid=g.id+(mode||"f");
  const eye=cx=>{
    if(closed)return `<path d="M${cx-15},166 Q${cx},150 ${cx+15},166" stroke="#4a3a35" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    const ry=exp==="angry"?14:(exp==="sad"||exp==="worry")?16:19;
    return `<g><clipPath id="c${cx}${uid}"><ellipse cx="${cx}" cy="163" rx="15.5" ry="${ry}"/></clipPath>
      <ellipse cx="${cx}" cy="163" rx="15.5" ry="${ry}" fill="#fff"/>
      <g clip-path="url(#c${cx}${uid})">
        <circle cx="${cx}" cy="165" r="12.5" fill="${g.eye}"/>
        <circle cx="${cx}" cy="166" r="6" fill="#2a2233"/>
        <circle cx="${cx+4.5}" cy="157" r="4.6" fill="#fff"/>
        <circle cx="${cx-5}" cy="172" r="2.4" fill="#fff" opacity=".8"/></g>
      <path d="M${cx-16},${164-ry} Q${cx},${159-ry} ${cx+16},${164-ry}" stroke="#4a3a35" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>`;
  };
  const bY=exp==="angry"?128:(exp==="sad"||exp==="worry")?134:130;
  const brow=(cx,dir)=>{const tl=exp==="angry"?dir*7:exp==="sad"?-dir*7:exp==="worry"?-dir*4:0;
    return `<path d="M${cx-14},${bY+tl} Q${cx},${bY-5+tl*.4} ${cx+14},${bY-tl}" stroke="${g.hair2}" stroke-width="4.2" fill="none" stroke-linecap="round"/>`;};
  let mouth;
  if(exp==="happy")mouth=`<path d="M135,200 Q150,220 165,200 Z" fill="#c2536a"/>`;
  else if(exp==="sad")mouth=`<path d="M139,210 Q150,201 161,210" stroke="#a85268" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  else if(exp==="angry")mouth=`<path d="M137,206 L163,206" stroke="#a85268" stroke-width="3.4" stroke-linecap="round"/>`;
  else if(exp==="worry")mouth=`<path d="M140,206 Q150,202 160,207" stroke="#a85268" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  else if(exp==="blush")mouth=`<path d="M140,202 Q150,213 160,202" stroke="#b84d63" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  else mouth=`<path d="M142,204 Q150,210 158,204" stroke="#b8687c" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  /* bust ＝ 顔画像用。頭のてっぺんから鎖骨あたりまで。背景は付けません */
  const vb=crop?"58 60 184 184":sprite?"0 0 300 470":bust?"46 30 208 310":"0 0 300 366";
  return `<svg viewBox="${vb}"${bust?' preserveAspectRatio="xMidYMax meet"':""} xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="bg${uid}" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="#fff3f7"/><stop offset="1" stop-color="#ffe0ec"/></linearGradient></defs>
   ${(sprite||bust)?"":`<rect x="-50" y="-50" width="420" height="480" fill="url(#bg${uid})"/>`}
   ${back}
   <ellipse cx="150" cy="252" rx="24" ry="28" fill="${skin}"/>
   ${sprite?`<path d="M92,300 Q150,262 208,300 L240,470 L60,470 Z" fill="#f2f4fb"/>
     <path d="M92,300 Q66,318 60,470 L104,470 L100,320 Z" fill="#e6eaf5"/>
     <path d="M208,300 Q234,318 240,470 L196,470 L200,320 Z" fill="#e6eaf5"/>
     <rect x="66" y="430" width="168" height="40" fill="${g.uni}" opacity=".85"/>`
    :`<path d="M96,296 Q150,264 204,296 L222,360 L78,360 Z" fill="#f2f4fb"/>`}
   <path d="M104,290 L150,338 L196,290 L214,300 L150,360 L86,300 Z" fill="${g.uni}"/>
   <path d="M150,322 l-16,-9 l0,19 z M150,322 l16,-9 l0,19 z" fill="${g.ribbon}"/>
   <circle cx="150" cy="322" r="5.5" fill="${g.ribbon}"/>
   <ellipse cx="150" cy="158" rx="65" ry="76" fill="${skin}"/>
   <ellipse cx="150" cy="196" rx="52" ry="42" fill="${skinS}" opacity=".18"/>
   ${eye(122)}${eye(178)}${brow(122,1)}${brow(178,-1)}
   <path d="M150,178 q5,10 -3,12" stroke="${skinS}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
   ${mouth}
   <ellipse cx="112" cy="190" rx="15" ry="8" fill="#ff7a95" opacity="${blush}"/>
   <ellipse cx="188" cy="190" rx="15" ry="8" fill="#ff7a95" opacity="${blush}"/>
   <path d="M68,134 C68,60 106,38 150,38 C194,38 232,60 232,134
            C224,110 210,100 196,107 C190,130 168,142 150,122
            C132,142 110,132 100,110 C86,120 74,116 68,134 Z" fill="${g.hair}"/>
   <path d="M104,72 C124,52 152,46 174,52 C150,56 124,62 108,84 Z" fill="#fff" opacity=".22"/>
   ${extra}</svg>`;
}

/* =======================================================================
   5. 部屋の背景
   ======================================================================= */
document.getElementById("room").innerHTML=`
<defs>
 <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0f5"/><stop offset="1" stop-color="#dff0fb"/></linearGradient>
 <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7efe3"/><stop offset="1" stop-color="#e8dccb"/></linearGradient>
 <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99a63"/><stop offset="1" stop-color="#a97742"/></linearGradient>
 <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d5b98f"/><stop offset="1" stop-color="#bb9868"/></linearGradient>
</defs>
<rect width="1200" height="675" fill="url(#wall)"/>
<rect y="520" width="1200" height="155" fill="url(#floor)"/>
<rect y="512" width="1200" height="12" fill="#8d6c46"/>
<!-- 窓 -->
<rect x="690" y="40" width="470" height="470" rx="6" fill="#efe6d6"/>
<rect x="704" y="54" width="442" height="442" fill="url(#sky)"/>
<circle cx="1090" cy="120" r="46" fill="#fff" opacity=".55"/>
<circle cx="1050" cy="132" r="34" fill="#fff" opacity=".45"/>
<circle cx="880" cy="96" r="30" fill="#fff" opacity=".4"/>
<rect x="704" y="330" width="442" height="166" fill="#cfe6f2" opacity=".55"/>
<g stroke="#e6ddcc" stroke-width="9"><line x1="925" y1="54" x2="925" y2="496"/><line x1="704" y1="300" x2="1146" y2="300"/></g>
<rect x="690" y="40" width="470" height="470" rx="6" fill="none" stroke="#dcd0bb" stroke-width="14"/>
<!-- ベランダ手すり -->
<rect x="710" y="368" width="430" height="9" fill="#e9e4d8"/>
<g fill="#e9e4d8">${Array.from({length:16},(_,i)=>`<rect x="${722+i*27}" y="377" width="7" height="112"/>`).join("")}</g>
<!-- 観葉植物 -->
<path d="M960,500 l16,-96 l40,0 l16,96 z" fill="#d9a06a"/>
<g fill="#5aa06a">
 <ellipse cx="996" cy="360" rx="16" ry="44" transform="rotate(-16 996 360)"/>
 <ellipse cx="1024" cy="372" rx="14" ry="40" transform="rotate(18 1024 372)"/>
 <ellipse cx="968" cy="378" rx="14" ry="38" transform="rotate(-34 968 378)"/>
 <ellipse cx="1006" cy="336" rx="12" ry="34"/>
</g>
<!-- カーテン -->
<path d="M660,30 q34,240 8,486 l86,0 q-30,-250 -6,-486 z" fill="#f6dbe6"/>
<path d="M1160,30 q-34,240 -8,486 l-86,0 q30,-250 6,-486 z" fill="#f6dbe6"/>
<rect x="650" y="24" width="520" height="16" rx="8" fill="#c9a86f"/>
<!-- 棚 -->
<rect x="330" y="176" width="290" height="13" fill="url(#wood)"/>
<rect x="330" y="268" width="290" height="13" fill="url(#wood)"/>
<g>${["#e56b7c","#f2b544","#5eb0d8","#7ec27a","#b98ede","#ef8f5a","#6fc9c0"].map((c,i)=>
  `<rect x="${352+i*26}" y="${212}" width="19" height="56" fill="${c}"/>`).join("")}</g>
<rect x="540" y="222" width="66" height="46" rx="6" fill="#f0e2ce"/>
<rect x="548" y="230" width="50" height="30" rx="3" fill="#e8b7c8"/>
<rect x="404" y="120" width="74" height="56" rx="4" fill="#8d6c46"/>
<rect x="411" y="127" width="60" height="42" fill="#cfe0c8"/>
<rect x="492" y="128" width="62" height="48" rx="4" fill="#8d6c46"/>
<rect x="498" y="134" width="50" height="36" fill="#e8d3b8"/>
<ellipse cx="352" cy="164" rx="26" ry="14" fill="#7fb877"/>
<rect x="340" y="140" width="24" height="26" rx="4" fill="#e08b5a"/>
<!-- コルクボード -->
<rect x="70" y="52" width="250" height="150" rx="8" fill="#d8ab72" stroke="#a97742" stroke-width="7"/>
<g>${[[96,74,58,44,"#cfe0ef"],[176,70,64,48,"#f2dfe6"],[104,132,70,52,"#e6efd8"],[196,128,74,54,"#efe4cf"]]
  .map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#fff"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" fill="${c}"/>`).join("")}</g>
<!-- 机 -->
<rect x="60" y="352" width="330" height="16" rx="4" fill="url(#wood)"/>
<rect x="70" y="368" width="16" height="152" fill="#a97742"/>
<rect x="364" y="368" width="16" height="152" fill="#a97742"/>
<rect x="86" y="368" width="278" height="10" fill="#c08c55" opacity=".55"/>
<rect x="104" y="300" width="70" height="52" rx="4" fill="#f4d55e"/>
<rect x="112" y="308" width="54" height="36" fill="#fff"/>
<path d="M139,318 l10,-8 l10,8 l0,14 l-20,0 z" fill="#f28aa8"/>
<g stroke="#f0f0f0" stroke-width="7" fill="none"><path d="M212,352 l0,-60 l40,-26"/></g>
<circle cx="256" cy="262" r="20" fill="#f4f4f4"/>
<rect x="196" y="346" width="34" height="8" rx="3" fill="#dcdcdc"/>
<rect x="284" y="316" width="52" height="36" rx="4" fill="#5a6a86"/>
<rect x="290" y="322" width="40" height="24" fill="#9fd4e8"/>
<!-- 日差し -->
<path d="M700,520 L1100,520 L980,675 L470,675 Z" fill="#fff3c9" opacity=".30"/>
<!-- 椅子 -->
<rect x="418" y="286" width="104" height="122" rx="18" fill="#f4f2ec" stroke="#ddd8cc" stroke-width="3"/>
<rect x="432" y="300" width="76" height="94" rx="12" fill="#e9e5da"/>
<rect x="404" y="408" width="132" height="20" rx="9" fill="#f4f2ec" stroke="#ddd8cc" stroke-width="3"/>
<rect x="463" y="428" width="14" height="60" fill="#b9b4a8"/>
<g stroke="#b9b4a8" stroke-width="9" stroke-linecap="round">
 <line x1="470" y1="486" x2="410" y2="512"/><line x1="470" y1="486" x2="530" y2="512"/><line x1="470" y1="486" x2="470" y2="516"/></g>
<!-- 掛け時計 -->
<circle cx="612" cy="96" r="30" fill="#fdfaf2" stroke="#c9a86f" stroke-width="5"/>
<g stroke="#7a6a55" stroke-width="4" stroke-linecap="round"><line x1="612" y1="96" x2="612" y2="78"/><line x1="612" y1="96" x2="626" y2="102"/></g>
<circle cx="612" cy="96" r="3.5" fill="#7a6a55"/>
<!-- 机の小物 -->
<rect x="196" y="330" width="26" height="24" rx="4" fill="#e9dcc6"/>
<g stroke="#6b8fd8" stroke-width="4" stroke-linecap="round"><line x1="203" y1="330" x2="201" y2="314"/><line x1="211" y1="330" x2="212" y2="310"/><line x1="218" y1="330" x2="221" y2="316"/></g>
<g>${["#e56b7c","#5eb0d8","#7ec27a"].map((c,i)=>`<rect x="${330+i*11}" y="${318}" width="9" height="34" fill="${c}"/>`).join("")}</g>
<!-- ベッド -->
<rect x="628" y="536" width="486" height="100" rx="16" fill="#c6d3e4"/>
<rect x="628" y="536" width="486" height="30" rx="14" fill="#e4ebf4"/>
<rect x="648" y="524" width="120" height="40" rx="14" fill="#fdfaf2" stroke="#e0dccf" stroke-width="3"/>
<path d="M880,536 q40,-16 78,0 l0,26 q-40,-14 -78,0 z" fill="#f6dbe6"/>
<g transform="translate(806,540)">
  <circle cx="0" cy="16" r="17" fill="#e8c9a0"/><circle cx="-13" cy="2" r="7" fill="#e8c9a0"/><circle cx="13" cy="2" r="7" fill="#e8c9a0"/>
  <circle cx="-6" cy="13" r="2.6" fill="#5a4636"/><circle cx="6" cy="13" r="2.6" fill="#5a4636"/>
  <ellipse cx="0" cy="21" rx="6" ry="5" fill="#f6e3cd"/><circle cx="0" cy="19" r="2" fill="#5a4636"/>
</g>
<!-- ローテーブル -->
<rect x="1000" y="576" width="180" height="14" rx="6" fill="url(#wood)"/>
<rect x="1012" y="590" width="12" height="60" fill="#a97742"/>
<rect x="1156" y="590" width="12" height="60" fill="#a97742"/>
<!-- ラグ -->
<ellipse cx="330" cy="600" rx="270" ry="66" fill="#efe0d0"/>
<ellipse cx="330" cy="600" rx="230" ry="52" fill="#e5d2be"/>
`;

/* コマンド画面の部屋も、会話シーンの部屋と同じ絵にする。
   assets/bg/room.png を置いたら、上のSVGのかわりにそれを敷きます。
   （置いていなければ、いままでどおりSVGのままです）
   ここをそろえておかないと、「自室でしていること」を画面のままで進めたときに、
   ちがう部屋が出ているように見えてしまいます。 */
function roomArtSet(){
  const el=document.getElementById("room"); if(!el)return;
  const hit=artName((typeof ART_LIST!=="undefined"&&ART_LIST.bg)||[],"room");
  if(!hit)return;
  el.innerHTML=`<image href="${artURL("bg/"+hit)}" x="0" y="0" width="1200" height="675"`
    +` preserveAspectRatio="xMidYMid slice"/>`;
}
roomArtSet();
fontArtSet();     /* assets/font/ に置いた書体があれば、それを使う */


/* =======================================================================
   5.5 ノベルゲーム画面（背景・立ち絵・メッセージ）
   ======================================================================= */
const sky=(a,b)=>`<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc47a"/><stop offset="1" stop-color="#5f9a55"/></linearGradient></defs>
  <rect width="1200" height="675" fill="url(#sk)"/>`;
const svgw=inner=>`<svg viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const petals=(n,c)=>Array.from({length:n},(_,i)=>{const x=(i*137)%1200,y=(i*211)%560;
  return `<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".75" transform="rotate(${(i*37)%180} ${x} ${y})"/>`;}).join("");
const BG={
 school:()=>svgw(sky("#8fd0f5","#e7f4fb")+
  `<circle cx="960" cy="120" r="60" fill="#fff" opacity=".5"/>
   <rect y="470" width="1200" height="205" fill="#d9c08d"/><rect y="462" width="1200" height="12" fill="#c2a670"/>
   <rect x="230" y="180" width="740" height="292" fill="#f0ead9"/><rect x="230" y="166" width="740" height="20" fill="#d8cdb4"/>
   <rect x="540" y="120" width="120" height="52" fill="#e4dcc6"/><rect x="592" y="76" width="16" height="48" fill="#9a917d"/>
   ${[0,1,2].map(r=>[...Array(11)].map((_,c)=>`<rect x="${256+c*64}" y="${206+r*88}" width="44" height="50" fill="#9ec9e6"/>`).join("")).join("")}
   <rect x="560" y="380" width="80" height="92" fill="#b98f5e"/>
   <g fill="#6b4b35"><rect x="110" y="330" width="20" height="150"/><rect x="1070" y="330" width="20" height="150"/></g>
   <g fill="#ffc2d6"><circle cx="120" cy="290" r="76"/><circle cx="56" cy="330" r="52"/><circle cx="186" cy="332" r="52"/>
    <circle cx="1080" cy="290" r="72"/><circle cx="1020" cy="330" r="48"/><circle cx="1140" cy="330" r="48"/></g>
   ${petals(26,"#ffd3e2")}`),
 sakura:()=>svgw(sky("#ffd0e0","#ffeccd")+
  `<rect y="500" width="1200" height="175" fill="#cbb489"/>
   <rect x="560" y="240" width="46" height="270" fill="#6b4b35"/>
   <path d="M583,420 L470,330 M583,380 L700,300" stroke="#6b4b35" stroke-width="18"/>
   <g fill="#ffb8d2"><circle cx="580" cy="210" r="150"/><circle cx="400" cy="270" r="110"/><circle cx="770" cy="262" r="118"/>
    <circle cx="240" cy="320" r="76"/><circle cx="940" cy="316" r="82"/></g>
   <g fill="#ffd3e2" opacity=".8"><circle cx="520" cy="170" r="60"/><circle cx="700" cy="200" r="52"/></g>
   ${petals(48,"#ffe1ec")}`),
 klass:()=>svgw(`<rect width="1200" height="675" fill="#efe6d2"/>
   <rect y="430" width="1200" height="245" fill="#d3b184"/><rect y="422" width="1200" height="12" fill="#b9925f"/>
   <rect x="60" y="120" width="420" height="230" rx="6" fill="#2f5c46" stroke="#a8763f" stroke-width="14"/>
   <g stroke="#dfe8e2" stroke-width="4" opacity=".7"><line x1="100" y1="180" x2="300" y2="180"/><line x1="100" y1="215" x2="380" y2="215"/><line x1="100" y1="250" x2="250" y2="250"/></g>
   <rect x="640" y="80" width="520" height="330" fill="#efe6d2"/>
   <rect x="660" y="100" width="480" height="290" fill="#a9d8f0"/>
   <g stroke="#efe6d2" stroke-width="12"><line x1="900" y1="100" x2="900" y2="390"/><line x1="660" y1="250" x2="1140" y2="250"/></g>
   <rect x="640" y="80" width="520" height="330" fill="none" stroke="#e0d6bf" stroke-width="16"/>
   ${[0,1,2].map(r=>[0,1,2,3].map(c=>`<g transform="translate(${120+c*250},${470+r*70})"><rect width="150" height="14" rx="4" fill="#e8d3ac"/><rect x="10" y="14" width="10" height="60" fill="#c9a86f"/><rect x="130" y="14" width="10" height="60" fill="#c9a86f"/></g>`).join("")).join("")}`),
 ground:()=>svgw(sky("#7cc5f0","#dff0fb")+
  `<circle cx="1000" cy="110" r="52" fill="#fff8d0" opacity=".9"/>
   <rect y="360" width="1200" height="315" fill="#d9a05f"/>
   <rect x="80" y="250" width="420" height="112" fill="#e8e0cc"/>
   ${[0,1].map(r=>[...Array(6)].map((_,c)=>`<rect x="${100+c*66}" y="${266+r*48}" width="40" height="34" fill="#9ec9e6"/>`).join("")).join("")}
   <g fill="#7fb877"><circle cx="880" cy="330" r="46"/><circle cx="960" cy="340" r="38"/></g>
   <g stroke="#fff" stroke-width="7" opacity=".85" fill="none">
     <path d="M-40,470 Q600,430 1240,470"/><path d="M-40,560 Q600,520 1240,560"/></g>
   <g fill="#e8e0cc" opacity=".5"><rect x="0" y="640" width="1200" height="35"/></g>`),
 sunset:()=>svgw(sky("#ff9d6e","#ffe6b0")+
  `<circle cx="620" cy="420" r="86" fill="#fff0b8" opacity=".95"/>
   <rect y="470" width="1200" height="205" fill="#7c9a63"/>
   <path d="M0,470 Q300,430 600,470 T1200,470 L1200,540 L0,540 Z" fill="#8fb070"/>
   <rect y="540" width="1200" height="135" fill="#6d8a58"/>
   <g fill="#5a4636"><rect x="150" y="270" width="12" height="210"/><rect x="120" y="290" width="72" height="9"/></g>
   <g fill="#5a4636"><rect x="1020" y="290" width="11" height="190"/><rect x="994" y="308" width="64" height="8"/></g>
   <g fill="#4a3a2c" opacity=".7">${[0,1,2,3].map(i=>`<path d="M${180+i*230},${140+i*22} q10,-9 20,0 q10,-9 20,0" fill="none" stroke="#4a3a2c" stroke-width="4"/>`).join("")}</g>`),
 room:()=>svgw(`<rect width="1200" height="675" fill="#3a3350"/>
   <rect y="470" width="1200" height="205" fill="#5a4a5e"/>
   <rect x="700" y="80" width="420" height="380" rx="6" fill="#2a2440"/>
   <rect x="716" y="96" width="388" height="348" fill="#161a34"/>
   <circle cx="1030" cy="170" r="34" fill="#ffe9a8" opacity=".9"/>
   ${Array.from({length:26},(_,i)=>`<circle cx="${730+(i*67)%370}" cy="${110+(i*97)%320}" r="${1.6+(i%3)*0.7}" fill="#fff" opacity=".8"/>`).join("")}
   <g stroke="#2a2440" stroke-width="10"><line x1="910" y1="96" x2="910" y2="444"/></g>
   <rect x="80" y="380" width="360" height="16" fill="#8a6a48"/>
   <rect x="96" y="396" width="16" height="90" fill="#74563a"/><rect x="408" y="396" width="16" height="90" fill="#74563a"/>
   <circle cx="200" cy="330" r="34" fill="#ffe9b0" opacity=".85"/>
   <path d="M200,330 l-70,50 l140,0 z" fill="#ffe9b0" opacity=".18"/>
   <rect x="150" y="356" width="8" height="26" fill="#ddd"/>`),
 night:()=>svgw(sky("#1c2350","#5b3f66")+
  `${Array.from({length:40},(_,i)=>`<circle cx="${(i*163)%1200}" cy="${(i*71)%320}" r="${1.2+(i%3)*0.8}" fill="#fff" opacity=".85"/>`).join("")}
   <circle cx="1010" cy="110" r="44" fill="#fff6d0"/><circle cx="992" cy="100" r="40" fill="#5b3f66" opacity=".55"/>
   <rect y="470" width="1200" height="205" fill="#241d3a"/>
   ${[0,1,2,3,4,5].map(i=>`<rect x="${40+i*205}" y="${300+((i*53)%110)}" width="150" height="180" fill="#2e2650"/>`).join("")}
   ${Array.from({length:60},(_,i)=>`<rect x="${56+((i*97)%1120)}" y="${330+((i*61)%130)}" width="9" height="11" fill="#ffe08a" opacity=".85"/>`).join("")}
   ${Array.from({length:70},(_,i)=>`<circle cx="${(i*171)%1200}" cy="${430+((i*83)%230)}" r="2.6" fill="#ffe9b8" opacity=".9"/>`).join("")}`),
 shrine:()=>svgw(sky("#2b2f60","#7a5a7a")+
  `<rect y="500" width="1200" height="175" fill="#2c2438"/>
   <g fill="#d0402f"><rect x="330" y="200" width="30" height="310"/><rect x="840" y="200" width="30" height="310"/>
    <rect x="270" y="176" width="660" height="26" rx="8"/><rect x="290" y="228" width="620" height="20"/></g>
   <rect x="258" y="160" width="684" height="18" rx="9" fill="#a82c1e"/>
   ${[0,1,2,3,4,5].map(i=>`<g transform="translate(${180+i*180},120)"><ellipse rx="26" ry="34" fill="#ff8a5c"/><rect x="-26" y="-6" width="52" height="12" fill="#e0523a"/></g>`).join("")}
   ${Array.from({length:30},(_,i)=>`<circle cx="${(i*191)%1200}" cy="${(i*67)%140}" r="1.8" fill="#fff" opacity=".8"/>`).join("")}
   <g fill="#3a3048" opacity=".9">${[...Array(7)].map((_,i)=>`<ellipse cx="${130+i*160}" cy="${560+((i*29)%30)}" rx="34" ry="52"/>`).join("")}</g>`),
 fest:()=>svgw(sky("#242a55","#6a4470")+
  `<rect y="470" width="1200" height="205" fill="#2b2340"/>
   ${[...Array(9)].map((_,i)=>`<g transform="translate(${70+i*135},${86+((i%2)*18)})"><line x1="0" y1="-40" x2="0" y2="-14" stroke="#8a7a5a" stroke-width="3"/><ellipse rx="30" ry="40" fill="#ff9a5c"/><rect x="-30" y="-8" width="60" height="14" fill="#e0523a"/><text y="10" font-size="22" text-anchor="middle" fill="#a8321e">祭</text></g>`).join("")}
   <path d="M0,66 Q300,110 600,66 T1200,66" stroke="#6b5b46" stroke-width="4" fill="none"/>
   <g><rect x="120" y="300" width="300" height="170" fill="#efe2c6"/><path d="M100,300 L440,300 L410,250 L130,250 Z" fill="#d94f5c"/>
     <rect x="140" y="360" width="260" height="16" fill="#c9a86f"/></g>
   <g><rect x="800" y="310" width="290" height="160" fill="#efe2c6"/><path d="M780,310 L1110,310 L1082,262 L808,262 Z" fill="#4f8fd9"/>
     <rect x="820" y="366" width="250" height="16" fill="#c9a86f"/></g>
   <g fill="#241d33" opacity=".85">${[...Array(8)].map((_,i)=>`<ellipse cx="${90+i*150}" cy="${580+((i*31)%26)}" rx="36" ry="56"/>`).join("")}</g>`),
 park:()=>svgw(sky("#8fd0f5","#e7f4fb")+
  `<circle cx="180" cy="120" r="54" fill="#fff" opacity=".55"/><circle cx="240" cy="140" r="40" fill="#fff" opacity=".5"/>
   <rect y="420" width="1200" height="255" fill="url(#gr)"/>
   <path d="M0,470 Q600,410 1200,470 L1200,540 Q600,486 0,540 Z" fill="#d9c08d"/>
   <g fill="#6b4b35"><rect x="200" y="290" width="26" height="150"/><rect x="960" y="300" width="24" height="140"/></g>
   <g fill="#5fa25c"><circle cx="213" cy="250" r="96"/><circle cx="130" cy="300" r="62"/><circle cx="300" cy="296" r="66"/>
    <circle cx="972" cy="262" r="86"/><circle cx="900" cy="306" r="54"/><circle cx="1046" cy="304" r="56"/></g>
   <g><rect x="500" y="470" width="220" height="14" rx="5" fill="#b98f5e"/><rect x="512" y="484" width="12" height="50" fill="#8a6a48"/>
     <rect x="696" y="484" width="12" height="50" fill="#8a6a48"/><rect x="500" y="430" width="220" height="12" rx="5" fill="#b98f5e"/></g>`),
 cafe:()=>svgw(`<rect width="1200" height="675" fill="#e8d9c2"/>
   <rect y="430" width="1200" height="245" fill="#c9a06f"/>
   <rect x="60" y="90" width="380" height="300" rx="8" fill="#f7f0e2" stroke="#b98f5e" stroke-width="12"/>
   <rect x="80" y="110" width="340" height="260" fill="#a9d8f0"/>
   <g stroke="#f7f0e2" stroke-width="10"><line x1="250" y1="110" x2="250" y2="370"/></g>
   <rect x="620" y="120" width="480" height="270" fill="#c9a86f"/>
   ${[0,1,2].map(r=>[...Array(7)].map((_,c)=>`<rect x="${644+c*64}" y="${140+r*84}" width="40" height="56" rx="4" fill="${["#e08b5a","#7fb877","#d94f6c","#5fa2c9","#e0b84f"][(r*7+c)%5]}"/>`).join("")).join("")}
   <ellipse cx="600" cy="520" rx="260" ry="42" fill="#8a6a48"/><ellipse cx="600" cy="506" rx="260" ry="42" fill="#b98f5e"/>
   <g transform="translate(430,452)"><ellipse rx="42" ry="14" fill="#fff"/><path d="M-38,-2 q38,44 76,0 z" fill="#fff"/><path d="M40,4 q26,10 0,24" stroke="#fff" stroke-width="8" fill="none"/></g>
   <g transform="translate(760,452)"><ellipse rx="42" ry="14" fill="#ffe6ec"/><path d="M-38,-2 q38,44 76,0 z" fill="#ffe6ec"/></g>`),
 movie:()=>svgw(`<rect width="1200" height="675" fill="#141020"/>
   <rect x="120" y="60" width="960" height="380" rx="6" fill="#2a2438"/>
   <rect x="140" y="80" width="920" height="340" fill="#d8e6f0"/>
   <rect x="140" y="80" width="920" height="340" fill="#8fb6d8" opacity=".5"/>
   <circle cx="600" cy="230" r="90" fill="#fff" opacity=".55"/>
   <path d="M120,60 L1080,60 L1080,52 L120,52 Z" fill="#4a3550"/>
   <path d="M60,60 q60,190 -20,380 l140,0 q-40,-200 20,-380 z" fill="#6b2d44"/>
   <path d="M1140,60 q-60,190 20,380 l-140,0 q40,-200 -20,-380 z" fill="#6b2d44"/>
   ${[0,1,2].map(r=>[...Array(9)].map((_,c)=>`<rect x="${90+c*128}" y="${500+r*58}" width="98" height="70" rx="14" fill="#2b2340"/>`).join("")).join("")}`),
 amuse:()=>svgw(sky("#ff9d6e","#ffd9a8")+
  `<rect y="500" width="1200" height="175" fill="#7c6a55"/>
   <g transform="translate(880,300)"><circle r="170" fill="none" stroke="#e8e0cc" stroke-width="10"/>
    <circle r="24" fill="#e8e0cc"/>
    ${[...Array(12)].map((_,i)=>{const a=i*Math.PI/6;const x=(170*Math.cos(a)).toFixed(1),y=(170*Math.sin(a)).toFixed(1);
      return `<line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#e8e0cc" stroke-width="5"/><circle cx="${x}" cy="${y}" r="17" fill="${["#e05a6c","#f0a83f","#5fa2c9","#7fb877"][i%4]}"/>`;}).join("")}
    <path d="M-40,196 L0,20 L40,196 Z" fill="#c9b89a"/></g>
   <path d="M0,430 C120,250 260,470 400,300 C500,180 560,340 640,300" stroke="#e8e0cc" stroke-width="12" fill="none"/>
   <g fill="#c9b89a">${[...Array(6)].map((_,i)=>`<rect x="${40+i*100}" y="${330+((i*57)%110)}" width="10" height="${170-((i*57)%110)}"/>`).join("")}</g>
   ${petals(18,"#ffe1a8")}`),
 aqua:()=>svgw(sky("#0f4b7a","#0a2b52")+
  `<rect width="1200" height="675" fill="#0e4570" opacity=".5"/>
   ${Array.from({length:9},(_,i)=>`<path d="M${(i*151)%1200},675 q40,-260 0,-520" stroke="#7fd8f0" stroke-width="${3+i%3}" fill="none" opacity=".16"/>`).join("")}
   <g fill="#bfe9f7" opacity=".8">${[...Array(11)].map((_,i)=>{const x=90+((i*173)%1020),y=120+((i*211)%400);
     return `<path d="M${x},${y} q26,-16 52,0 q-26,16 -52,0 z"/><path d="M${x+52},${y} l16,-11 l0,22 z"/>`;}).join("")}</g>
   <g fill="#2e7f5c" opacity=".85">${[...Array(9)].map((_,i)=>`<path d="M${60+i*140},675 q22,-140 -6,-230 q40,80 26,230 z"/>`).join("")}</g>
   ${Array.from({length:34},(_,i)=>`<circle cx="${(i*163)%1200}" cy="${(i*127)%620}" r="${2+(i%4)}" fill="#dff6ff" opacity=".45"/>`).join("")}`),
 lib:()=>svgw(`<rect width="1200" height="675" fill="#e3d6bd"/>
   <rect y="500" width="1200" height="175" fill="#a9814f"/>
   ${[0,1,2].map(r=>`<g><rect x="40" y="${90+r*140}" width="470" height="120" fill="#c9a86f"/>`+
     [...Array(13)].map((_,c)=>`<rect x="${52+c*35}" y="${100+r*140}" width="26" height="100" fill="${["#c4485c","#3f7fb0","#d99a3f","#5f9a55","#8a5fb0","#c96a3f"][(r*13+c)%6]}"/>`).join("")+
     `<rect x="40" y="${208+r*140}" width="470" height="12" fill="#8a6a48"/></g>`).join("")}
   <rect x="700" y="80" width="420" height="330" rx="6" fill="#efe6d2" stroke="#c9a86f" stroke-width="12"/>
   <rect x="718" y="98" width="384" height="294" fill="#dceef7"/>
   <g stroke="#efe6d2" stroke-width="10"><line x1="910" y1="98" x2="910" y2="392"/><line x1="718" y1="245" x2="1102" y2="245"/></g>
   <ellipse cx="820" cy="530" rx="230" ry="40" fill="#8a6a48"/><ellipse cx="820" cy="516" rx="230" ry="40" fill="#b98f5e"/>`),
 artroom:()=>svgw(`<rect width="1200" height="675" fill="#efe6d2"/>
   <rect y="450" width="1200" height="225" fill="#c9a86f"/>
   <rect x="700" y="70" width="440" height="330" fill="#efe6d2"/>
   <rect x="720" y="90" width="400" height="290" fill="#bfe0f0"/>
   <g stroke="#efe6d2" stroke-width="12"><line x1="920" y1="90" x2="920" y2="380"/><line x1="720" y1="235" x2="1120" y2="235"/></g>
   <g stroke="#8a6a48" stroke-width="14" stroke-linecap="round">
     <line x1="300" y1="470" x2="230" y2="200"/><line x1="300" y1="470" x2="370" y2="200"/><line x1="300" y1="470" x2="300" y2="240"/></g>
   <rect x="196" y="150" width="210" height="170" fill="#fdfaf0" stroke="#8a6a48" stroke-width="8"/>
   <g><circle cx="250" cy="215" r="26" fill="#f0b64a"/><path d="M206,290 l52,-70 l40,50 l34,-40 l64,60 z" fill="#7fb877"/></g>
   <g transform="translate(560,430)"><ellipse rx="80" ry="16" fill="#a9814f"/>
     ${["#e05a6c","#f0a83f","#5fa2c9","#7fb877","#b98ede","#fff"].map((c,i)=>`<circle cx="${-56+i*22}" cy="-6" r="11" fill="${c}"/>`).join("")}</g>
   <g fill="#8a6a48"><rect x="880" y="430" width="14" height="120"/><rect x="960" y="430" width="14" height="120"/></g>
   <rect x="850" y="410" width="180" height="22" rx="6" fill="#b98f5e"/>`),
 music:()=>svgw(`<rect width="1200" height="675" fill="#e8dccb"/>
   <rect y="440" width="1200" height="235" fill="#a9814f"/>
   ${[...Array(10)].map((_,i)=>`<rect x="${20+i*122}" y="60" width="104" height="380" rx="8" fill="#dcd0bb"/>`).join("")}
   <g transform="translate(300,300)"><path d="M-130,140 L130,140 L150,60 Q0,-10 -150,60 Z" fill="#2b2340"/>
     <rect x="-150" y="52" width="300" height="16" fill="#3a3050"/>
     ${[...Array(14)].map((_,i)=>`<rect x="${-140+i*20}" y="68" width="15" height="46" fill="#fdfaf2"/>`).join("")}
     ${[...Array(10)].map((_,i)=>`<rect x="${-128+i*20+((i%3===2)?8:0)}" y="68" width="8" height="28" fill="#2b2340"/>`).join("")}</g>
   <g transform="translate(880,290)"><rect x="-16" y="-90" width="32" height="200" rx="12" fill="#c4485c"/>
     <ellipse cy="150" rx="86" ry="72" fill="#c4485c"/><ellipse cy="150" rx="30" ry="28" fill="#5a2430"/>
     <g stroke="#efe6d2" stroke-width="2">${[...Array(6)].map((_,i)=>`<line x1="${-12+i*5}" y1="-86" x2="${-12+i*5}" y2="210"/>`).join("")}</g></g>`),
 town:()=>svgw(sky("#8fd0f5","#ffe6c9")+
  `<rect y="470" width="1200" height="205" fill="#b8b0a4"/>
   ${[0,1,2,3,4,5].map(i=>`<g><rect x="${20+i*200}" y="${210+((i*47)%80)}" width="170" height="270" fill="${["#f0e2ce","#e6d3c4","#dfe6ea","#f2dfe6","#e8e0cc","#dfe9dc"][i]}"/>
     <rect x="${20+i*200}" y="${196+((i*47)%80)}" width="170" height="22" fill="${["#d94f5c","#4f8fd9","#e0a03f","#7fb877","#b06fc9","#e07a3f"][i]}"/>
     <rect x="${44+i*200}" y="${400}" width="122" height="70" fill="#cfe0ef"/></g>`).join("")}
   <path d="M0,180 Q600,120 1200,180" stroke="#c9a86f" stroke-width="8" fill="none"/>
   ${[...Array(8)].map((_,i)=>`<g transform="translate(${80+i*150},175)"><ellipse rx="20" ry="26" fill="#ff9a5c"/></g>`).join("")}
   <g fill="#8a8378" opacity=".55">${[...Array(6)].map((_,i)=>`<ellipse cx="${120+i*190}" cy="${560+((i*23)%30)}" rx="30" ry="48"/>`).join("")}</g>`),
 home:()=>svgw(`<rect width="1200" height="675" fill="#f3e6d2"/>
   <rect y="460" width="1200" height="215" fill="#c9a06f"/>
   <rect x="60" y="120" width="330" height="240" rx="8" fill="#efe6d2" stroke="#c9a86f" stroke-width="12"/>
   <rect x="78" y="138" width="294" height="204" fill="#bfe0f0"/>
   <g stroke="#efe6d2" stroke-width="10"><line x1="225" y1="138" x2="225" y2="342"/></g>
   <rect x="620" y="150" width="420" height="230" fill="#d8cbb4"/>
   <rect x="640" y="170" width="380" height="80" fill="#e6dcc6"/>
   <rect x="640" y="266" width="380" height="94" fill="#e6dcc6"/>
   <ellipse cx="600" cy="500" rx="300" ry="52" fill="#8a6a48"/><ellipse cx="600" cy="484" rx="300" ry="52" fill="#b98f5e"/>
   <g transform="translate(470,440)"><ellipse rx="46" ry="15" fill="#fdfaf2"/><path d="M-42,-2 q42,40 84,0 z" fill="#fdfaf2"/></g>
   <g transform="translate(700,440)"><rect x="-40" y="-20" width="80" height="30" rx="6" fill="#e0a03f"/><ellipse cy="10" rx="40" ry="12" fill="#c9832f"/></g>
   <rect x="1080" y="300" width="90" height="180" fill="#7fb877"/>`),
 pet:()=>svgw(`<rect width="1200" height="675" fill="#f2e6d0"/>
   <rect y="470" width="1200" height="205" fill="#c9a06f"/>
   ${[0,1].map(r=>[0,1,2,3].map(c=>{const x=70+c*150,y=90+r*160,i=r*4+c;
     const col=["#f0dcc0","#d9a06a","#efefef","#c9c2b4","#e8c08a","#f5e6cf","#cfa87a","#e2d2b8"][i];
     return `<g><rect x="${x}" y="${y}" width="120" height="120" rx="8" fill="#efe6d2" stroke="#a9814f" stroke-width="5"/>
       <g stroke="#b99a6a" stroke-width="3">${[1,2,3,4].map(k=>`<line x1="${x+k*24}" y1="${y+6}" x2="${x+k*24}" y2="${y+114}"/>`).join("")}</g>
       <g transform="translate(${x+60},${y+82})"><ellipse rx="28" ry="22" fill="${col}"/>
         <circle cx="-22" cy="-16" r="11" fill="${col}"/><circle cx="22" cy="-16" r="11" fill="${col}"/>
         <circle cx="-10" cy="-2" r="4" fill="#4a3a2c"/><circle cx="10" cy="-2" r="4" fill="#4a3a2c"/>
         <ellipse cy="10" rx="7" ry="5" fill="#d99a8a"/></g></g>`;}).join("")).join("")}
   <rect x="700" y="90" width="440" height="290" rx="10" fill="#7fc4e0" stroke="#c9a86f" stroke-width="12"/>
   ${Array.from({length:9},(_,i)=>`<g fill="#ffd06a"><path d="M${740+((i*97)%360)},${140+((i*61)%200)} q22,-13 44,0 q-22,13 -44,0 z"/></g>`).join("")}
   <g><ellipse cx="300" cy="520" rx="120" ry="26" fill="#b98f5e"/>
     <g transform="translate(300,470)"><ellipse rx="52" ry="42" fill="#f0dcc0"/>
       <circle cx="-46" cy="-22" r="18" fill="#f0dcc0"/><circle cx="46" cy="-22" r="18" fill="#f0dcc0"/>
       <circle cx="-18" cy="-4" r="6" fill="#4a3a2c"/><circle cx="18" cy="-4" r="6" fill="#4a3a2c"/>
       <ellipse cy="14" rx="10" ry="7" fill="#d99a8a"/></g></g>
   <rect x="820" y="430" width="240" height="16" rx="6" fill="#b98f5e"/>
   <g fill="#7fb877">${[0,1,2].map(i=>`<circle cx="${860+i*80}" cy="${412}" r="18"/>`).join("")}</g>`),
 sea:()=>svgw(sky("#6fc4f2","#cdeefb")+
  `<circle cx="240" cy="120" r="56" fill="#fff8d0"/>
   <g fill="#fff" opacity=".7"><circle cx="820" cy="120" r="40"/><circle cx="870" cy="136" r="30"/><circle cx="770" cy="140" r="28"/></g>
   <rect y="330" width="1200" height="200" fill="#2f8fd0"/>
   <rect y="330" width="1200" height="60" fill="#4aa8de"/>
   ${[...Array(7)].map((_,i)=>`<path d="M${-40+i*190},${420+((i*31)%70)} q46,-16 92,0 q-46,16 -92,0" fill="#bfe9f7" opacity=".7"/>`).join("")}
   <path d="M0,520 Q600,470 1200,520 L1200,675 L0,675 Z" fill="#f0e0bc"/>
   <path d="M0,530 Q600,486 1200,530" stroke="#dff2fb" stroke-width="14" fill="none" opacity=".8"/>`),
 /* ---- 季節のデートスポット用 ---- */
 momiji:()=>svgw(sky("#a8d8ef","#f6ead6")+
  `<circle cx="200" cy="120" r="50" fill="#fff" opacity=".5"/>
   <path d="M0,430 Q300,360 620,410 Q900,452 1200,396 L1200,675 L0,675 Z" fill="#c9a86a"/>
   <rect y="470" width="1200" height="205" fill="#b8935a"/>
   <path d="M0,470 Q600,432 1200,470 L1200,510 Q600,472 0,510 Z" fill="#a9834c"/>
   <g fill="#6b4b35"><rect x="150" y="300" width="28" height="180"/><rect x="560" y="330" width="22" height="150"/>
     <rect x="980" y="290" width="30" height="190"/></g>
   <g><circle cx="164" cy="252" r="104" fill="#d94f2b"/><circle cx="76" cy="304" r="64" fill="#e8702f"/>
      <circle cx="256" cy="300" r="70" fill="#c23a22"/>
      <circle cx="571" cy="284" r="82" fill="#e79b26"/><circle cx="508" cy="322" r="52" fill="#d97a22"/>
      <circle cx="995" cy="238" r="96" fill="#e0642a"/><circle cx="912" cy="292" r="60" fill="#c9421f"/>
      <circle cx="1078" cy="290" r="62" fill="#eda133"/></g>
   ${Array.from({length:40},(_,i)=>{
      const x=((i*263)+(i*i*47))%1180, y=180+(((i*179)+(i*i*29))%460), r=(i*53)%360;
      return `<path transform="translate(${x},${y}) rotate(${r})" d="M0,-9 C5,-4 5,4 0,9 C-5,4 -5,-4 0,-9 z"
        fill="${["#d94f2b","#e79b26","#c9421f","#eda133"][i%4]}" opacity=".9"/>`;}).join("")}`),
 illum:()=>svgw(sky("#151a3c","#3a2a52")+
  `${Array.from({length:30},(_,i)=>`<circle cx="${(i*197)%1200}" cy="${(i*67)%260}" r="${1+(i%3)*0.7}" fill="#fff" opacity=".7"/>`).join("")}
   <rect y="500" width="1200" height="175" fill="#1a1730"/>
   <path d="M0,500 Q600,470 1200,500 L1200,540 Q600,510 0,540 Z" fill="#241f3e"/>
   ${[190,600,1010].map((x,k)=>`
     <rect x="${x-9}" y="${300+k*14}" width="18" height="205" fill="#3a2f2a"/>
     <path d="M${x},${170+k*14} L${x-118},${430+k*14} L${x+118},${430+k*14} Z" fill="#123a2c" opacity=".9"/>
     ${Array.from({length:46},(_,i)=>{const t=i/46, y=185+k*14+t*236, w=112*t;
       const px=x-w+((i*53)%Math.max(1,Math.round(w*2)));
       return `<circle cx="${px.toFixed(0)}" cy="${y.toFixed(0)}" r="3.4" fill="${["#ffe08a","#bfe9ff","#ffd0e4"][i%3]}" opacity=".95"/>`;}).join("")}
     <path d="M${x-22},${152+k*14} l22,-34 l22,34 l-16,0 l0,22 l-12,0 l0,-22 z" fill="#ffe8a8"/>`).join("")}
   ${Array.from({length:80},(_,i)=>`<circle cx="${(i*151)%1200}" cy="${470+((i*79)%190)}" r="2.4" fill="#ffe9b8" opacity=".8"/>`).join("")}`),
 skate:()=>svgw(sky("#5d7fa8","#9fc0dc")+
  `<rect width="1200" height="120" fill="#43597a"/>
   ${[0,1,2,3,4,5,6,7].map(i=>`<ellipse cx="${70+i*152}" cy="118" rx="34" ry="11" fill="#ffe9b0" opacity=".75"/>
     <ellipse cx="${70+i*152}" cy="112" rx="17" ry="8" fill="#fff6d8"/>`).join("")}
   <rect y="150" width="1200" height="250" fill="#7f9cbd"/>
   ${[0,1,2,3,4,5,6].map(i=>`<rect x="${20+i*172}" y="176" width="128" height="196" rx="8" fill="#6c88a8"/>`).join("")}
   <rect y="372" width="1200" height="46" fill="#eef4fa"/>
   <rect y="368" width="1200" height="10" fill="#c9d9e8"/>
   ${Array.from({length:26},(_,i)=>`<circle cx="${24+i*46}" cy="392" r="6" fill="${["#ffd9e6","#cdeaff","#fff0b8"][i%3]}"/>`).join("")}
   <rect y="418" width="1200" height="257" fill="#dcecfa"/>
   <path d="M0,418 Q600,462 1200,418 L1200,500 Q600,548 0,500 Z" fill="#eaf5fd" opacity=".9"/>
   ${Array.from({length:18},(_,i)=>`<path d="M${(i*179)%1140},${478+((i*83)%168)} q66,-16 132,3" stroke="#a9c9e4" stroke-width="3.5" fill="none" opacity=".85"/>`).join("")}
   <g opacity=".55" fill="#5d7fa8">${[[210,452],[520,438],[860,460],[1030,442]].map(([x,y])=>
     `<ellipse cx="${x}" cy="${y}" rx="15" ry="30"/><circle cx="${x}" cy="${y-40}" r="12"/>`).join("")}</g>
   ${Array.from({length:30},(_,i)=>`<circle cx="${(i*211)%1200}" cy="${30+((i*97)%340)}" r="${1.6+(i%3)*0.9}" fill="#fff" opacity=".8"/>`).join("")}`)
};
BG.klass2=BG.klass;

/* =======================================================================
   メッセージウィンドウのUI（画像の枠・下部ボタンバー・AUTO/SKIP）
   ======================================================================= */
let AUTOON=false, SKIPON=false;
let VNARM=null;      /* いま送り待ちのページを、AUTO/SKIPの切りかえ時に起こすための入口 */
let PENDCH=[];       /* いま待機中の choose の後始末 */
/* ロードやタイトル復帰のときに、走っている進行をきちんと止める */
function flowAbort(){
  S.gen++;
  const list=PENDCH; PENDCH=[];
  list.forEach(e=>{ try{ if(e.cleanup)e.cleanup(); }catch(_){}});
  vnStopAuto();
}
const AUTO_BASE=900, AUTO_PER_CHAR=42;   /* AUTOの待ち時間（ms） */

/* CSS変数に画像を渡す */
function vnImgInit(){
  const r=document.documentElement.style;
  r.setProperty("--mf",`url("${IMG.msg}")`);
  r.setProperty("--x1",`url("${IMG.close}")`);
  r.setProperty("--x2",`url("${IMG.closeH}")`);
  r.setProperty("--cb",`url("${IMG.cbtn}")`);
  r.setProperty("--cb2",`url("${IMG.cbtn2}")`);
}
const VNBAR=[
  ["save", "SAVE",  "きろく画面をひらく"],
  ["load", "LOAD",  "きろく画面をひらく"],
  ["auto", "AUTO",  "文章が自動で進みます"],
  ["skip", "SKIP",  "文章を早送りします"],
  ["menu", "MENU",  "くわしく画面をひらく"],
  ["config","CONFIG","設定をひらく"],
  ["title","TITLE", "タイトル画面にもどる"],
];
/* ---- ノベル画面の素材（assets/ui/）------------------------------------
   置いていないものは、いままでどおりの絵で出ます（1つずつ差しかえOK）。

     ui_btn_<なまえ>_normal.png   クイックメニューのボタン（ふだん）
     ui_btn_<なまえ>_hover.png    〃（カーソルが乗ったとき）
        <なまえ> = save / load / auto / skip / menu / config / title / close
     ui_dialogue_panel.png        メッセージ枠
     ui_nameplate.png             名前のプレート
     ui_photo_frame.png           顔を入れる写真の枠
     ui_photo_mask.png            写真の窓のかたち（枠と同じ大きさ・同じ位置で）
     ui_photo_name_<キャラid>.png 写真の右下にのせる、手書きふうの名前
        <キャラid> = kanade / rena / hinata / luka / minamo / sakuya
   ---------------------------------------------------------------------- */
function vnBtnArt(k,hover){
  return uiArt("ui_btn_"+k+(hover?"_hover":"_normal"))
      || (hover?uiArt("ui_btn_"+k+"_hover_v2"):null);   /* 名前ゆれの保険 */
}
const vnQmBarArt =()=>uiArt("ui_quickmenu_bar");   /* クイックメニューのうしろの帯 */
const vnPanelArt =()=>uiArt("ui_dialogue_panel");
const vnNameArt  =()=>uiArt("ui_nameplate");
const vnPhotoArt =()=>uiArt("ui_photo_frame");
const vnPhotoMask=()=>uiArt("ui_photo_mask");
/* 写真の右下にのせる、その子の名前の絵。無い子は出しません */
const vnPhotoName=gid=>uiArt("ui_photo_name_"+gid);
/* クイックメニューに新しい絵を使うか（1つでもあれば、その並びかたにします） */
const vnQmOn=()=>VNBAR.some(([k])=>!!vnBtnArt(k,false));

function drawVnBar(){
  const bar=$("vnBar");
  const qm=vnQmOn();
  bar.classList.toggle("qm",qm);
  /* おまけのシーン鑑賞など、ゲーム中でないときは AUTO / SKIP だけ出す。
     新しい並びのときは、まだ絵の無いボタンも**場所だけ空けて**おきます
     （あとから絵を足しても、ならびがずれません） */
  const use=S.inGame?VNBAR:VNBAR.filter(([k])=>k==="auto"||k==="skip");
  bar.innerHTML=use.map(([k,n,t])=>{
    const on=(k==="auto"&&AUTOON)||(k==="skip"&&SKIPON);
    if(qm){
      const a=vnBtnArt(k,false), h=vnBtnArt(k,true)||a;
      /* 絵がまだ無いボタンは、同じ大きさの「仮のひし形」で出しておく */
      return `<div class="sb${on?" on":""}${a?"":" ph"}" data-vb="${k}" title="${t}"
        ${a?`style="background-image:url('${a}');--h:url('${h}')"`:""}
        >${a?"":`<b>${n}</b>`}</div>`;
    }
    return `<div class="sb${on?" on":""}" data-vb="${k}" title="${t}"
       style="background-image:url('${IMG[k]}');--h:url('${IMG[k+"H"]}')"></div>`;
  }).join("");
  bar.querySelectorAll("[data-vb]").forEach(el=>{
    el.onpointerdown=e=>e.stopPropagation();
    el.onclick=e=>{e.stopPropagation();vnBarClick(el.dataset.vb);};
  });
}
/* ---- ノベル画面の見た目を、置いた素材に合わせる -------------------------
   assets/config.js の VN_UI で、位置と大きさを割合で決めます。
   素材が無いところは、いままでどおりの絵と配置のままです。 */
function applyVnArt(){
  const st=$("stage"); if(!st)return;
  artRefresh();     /* 素材が変わったかもしれないので、絵を描きなおさせる */
  applyCgRule();    /* イベントスチルの入れかた（CG_RULE） */
  const pv=(k,d)=>(vnu(k,d)*100).toFixed(2)+"%";
  /* クイックメニューのうしろの帯 */
  const qb=vnQmBarArt();
  st.style.setProperty("--qmbar", qb?`url("${qb}")`:"none");
  /* メッセージ枠 */
  const panel=vnPanelArt();
  document.body.classList.toggle("vnart",!!panel);
  if(panel){
    st.style.setProperty("--mf",`url("${panel}")`);
    const im=new Image();
    im.onload=()=>{ if(im.naturalHeight){ VNPANEL.ar=im.naturalWidth/im.naturalHeight; fit(); } };
    im.src=panel;
  }else{
    VNPANEL.ar=VNPANEL.def;
  }
  /* 本文の入る場所（枠の絵に対する割合） */
  st.style.setProperty("--vnbl", pv("bodyL",0.043));
  st.style.setProperty("--vnbr", pv("bodyR",0.050));
  st.style.setProperty("--vnalpha", String(vnu("panelAlpha",0.88)));
  st.style.setProperty("--vnxh", pv("closeSize",0.26));
  /* 名前のプレート */
  const np=vnNameArt();
  st.style.setProperty("--vnnp", np?`url("${np}")`:"none");
  if(np)artAspect2(np,"--vnnar");
  st.style.setProperty("--vnnw", pv("nameW",0.305));
  st.style.setProperty("--vnnx", pv("nameX",0.013));
  st.style.setProperty("--vnny", pv("nameY",0.245));
  st.style.setProperty("--vnntx",pv("nameTextX",0.155));
  /* 顔の写真枠 */
  const pf=vnPhotoArt(), pm=vnPhotoMask();
  /* 写真の枠を「絵のほうに描きこむ」作り（VN_UI.photoInImage）。
     このときは枠の絵もマスクも使わず、bust/ の絵をそのまま置きます。 */
  /* 枠つきの顔画像がまだ1枚も無いあいだは、この作りに切りかえません
     （切りかえると、絵が無いのに本文だけ右へよけてしまうため） */
  const anyBust=(()=>{ const C=(typeof ART_LIST!=="undefined"&&ART_LIST.chara)||{};
    for(const k in C){ const b=C[k]&&C[k].bust;
      if(b)for(const d in b) if(b[d]&&b[d].length) return true; }
    return false; })();
  const inimg=(VNUI.photoInImage===true)&&anyBust;
  document.body.classList.toggle("photoin",inimg);
  /* ★ 枠の絵があれば、「絵に描きこむ作り」でも photo は付けたままにします。
     枠つきの絵をまだ描いていない子には、こちらの枠が使われます
     （1人ずつ差しかえていく途中でも、みんな写真の枠に入って見えます）。
     枠つきの絵がある子は .solo が付いて、そちらが優先されます。 */
  document.body.classList.toggle("photo",!!pf);
  st.style.setProperty("--pshadow", (VNUI.photoShadow===false) ? "none"
    : "drop-shadow(0 6px 15px rgba(0,0,0,.28))");
  st.style.setProperty("--pframe",pf?`url("${pf}")`:"none");
  if(pf){ const im=new Image();
    im.onload=()=>{ if(im.naturalHeight){
      VNPHOTO.ar=im.naturalWidth/im.naturalHeight;
      st.style.setProperty("--pfar",VNPHOTO.ar.toFixed(4)); fit(); } };
    im.src=pf; }
  else VNPHOTO.ar=VNPHOTO.def;
  /* 写真枠の右下にのせる、手書きふうの名前（ui_photo_name_<キャラid>.png） */
  st.style.setProperty("--pnw", pv("photoNameW",0.42));
  st.style.setProperty("--pnr", pv("photoNameRight",0.085));
  st.style.setProperty("--pnb", pv("photoNameBottom",0.035));
  /* ★ 窓のかたちの絵（mask）は、ブラウザが「よその場所のファイル」として
     きびしくあつかいます。フォルダ版を file:// で直にひらくと読みこめず、
     しかも読めなかったときは **顔がまるごと消えます**。
     （枠や背景の絵は同じ file:// でも平気なので、枠だけ出て中が空になります）
     そこで、data: で埋めこんだ1ファイル版と、http(s) で開いたときだけ使い、
     それ以外は下の四角い切りぬき（VN_UI の photoTop など）に落とします。 */
  const maskOK = !!pm && (/^data:/.test(pm) || location.protocol!=="file:");
  VNPHOTO.maskOK = maskOK;
  st.style.setProperty("--pmask", maskOK?`url("${pm}")`:"none");
  st.style.setProperty("--ptilt", (vnu("photoTilt",-3.5))+"deg");
  st.style.setProperty("--pfitx", pv("photoFitX",0.50));
  st.style.setProperty("--pfity", pv("photoFitY",0.14));
  /* 閉じる（×）。右クリックでも同じことができます */
  const c0=vnBtnArt("close",false), c1=vnBtnArt("close",true)||c0;
  if(c0){ st.style.setProperty("--x1",`url("${c0}")`); st.style.setProperty("--x2",`url("${c1}")`); }
  $("vnClose").style.display=(VNUI.closeBtn===false)?"none":"";
  /* 窓の切りぬきと、頭のはみ出しの寸法は fit() が px で入れます
     （枠の絵の形が分かってからでないと決められないので） */
  fit();
}
function setAuto(v){ AUTOON=v; if(v)SKIPON=false; drawVnBar(); if(VNARM)VNARM(); }
function setSkip(v){ SKIPON=v; if(v)AUTOON=false; drawVnBar(); if(VNARM)VNARM(); }
function vnStopAuto(){ if(AUTOON||SKIPON){AUTOON=false;SKIPON=false;drawVnBar();if(VNARM)VNARM();} }

async function vnBarClick(k){
  if(k==="auto"){ se("click"); setAuto(!AUTOON); return; }
  if(k==="skip"){ se("click"); setSkip(!SKIPON); return; }
  vnStopAuto();
  if(k==="save"||k==="load"){ se("click"); await openSaveMenu(false); return; }
  if(k==="menu"){ se("click"); await showInfo(); return; }
  if(k==="config"){ se("click"); await settingsMenu(); return; }
  if(k==="title"){
    se("click");
    const ok=await confirmBox("タイトルにもどりますか？",
      "セーブしていない進行は失われます。","もどる",true);
    if(!ok)return;
    flowAbort(); S.inGame=false; S.busy=false;
    await goTitle();
  }
}
/* ×でウィンドウを隠す／画面のどこかを押すと戻る */
function vnHide(v){
  $("vnWin").classList.toggle("hide",v);
  $("vnBar").classList.toggle("hide",v);
  $("vnFaceWin").classList.toggle("hide",v);   /* 顔画像も一緒に引っこめる */
  /* ★ 選択肢も、ほかと同じ .hide（display:none）で消します。
     以前は visibility を切りかえていましたが、選択肢のボタンには
     transition が掛かっているため、**ほかより少し遅れて**消えていました。 */
  $("vnChoices").classList.toggle("hide",v);
}
const vnHidden=()=>$("vnWin").classList.contains("hide");

/* 背景。assets/bg/<名前>.png があればそれを使い、無ければ今までどおりSVGで描く */
/* その背景の中身（画像かSVG）を作る */
function bgHTML(k){
  const list=(typeof ART_LIST!=="undefined"&&ART_LIST.bg)||[];
  const hit=artName(list,k);
  return hit ? `<img class="bgimg" src="${artURL("bg/"+hit)}" alt="">`
             : (BG[k]||BG.school)();
}
/* assets/bg/<名前>.png（jpg なども可）が置いてあるか */
function bgHave(k){
  if(!k)return false;
  const list=(typeof ART_LIST!=="undefined"&&ART_LIST.bg)||[];
  const hit=artName(list,k);
  return !!hit && artHave("bg/"+hit);
}
/* ---- 行事ごとの背景 ----------------------------------------------------
   体育祭・文化祭・修学旅行・初詣は、専用の絵を置けます。
   上から順にさがして、**assets/bg/ にある絵**を使います。
   どれも置いていなければ、いちばん最後の名前（もとからある背景）です。

     体育祭 2年目  → sports2.png → sports.png → ground（もとの絵）
     文化祭 3年目  → culture3.png → culture.png → school
     修学旅行 2日目 → trip2.png  → trip.png    → town
     初詣 1年目    → newyear1.png → newyear.png → shrine

   ★ 1枚だけ描くなら sports.png のように番号なしで置けば、3年とも同じ絵です。
     学年や日ごとに変えたくなったら、番号つきを足すだけで切りかわります。
   絵の大きさは、ほかの背景と同じ 2400×1350（16:9）が目安です。 */
const EVBG={
  sports : y=>["sports"+y, "sports", "ground"],
  culture: y=>["culture"+y,"culture","school"],
  newyear: y=>["newyear"+y,"newyear","shrine"],
  trip   : y=>["trip1","trip","town"],
  trip2  : y=>["trip2","trip","town"],
  trip3  : y=>["trip3","trip","town"]
};
/* その行事で使う背景の名前を決める */
function evBg(ev){
  if(!ev)return "klass";
  const f=EVBG[ev.id];
  if(!f)return ev.bg||"klass";
  const cand=f(examYear())||[];
  return cand.find(bgHave) || cand[cand.length-1] || ev.bg || "klass";
}
/* 背景の切りかわりにかける時間（ミリ秒）。
   オプションの「背景の切りかえ」で決まります。
   SKIP中は待たされたくないので、いつでも 0（一瞬）にします。 */
function bgFadeMs(){
  if(SKIPON)return 0;
  const b=BGFADES[S.bgfade]; return b?b.ms:0;
}
/* 背景の切りかえの「はじまった時刻」と「かかる時間」をおぼえておきます。
   立ち絵と顔の絵は、これを見て**背景が出きるまで待って**から出ます。 */
const BGF={t:null, t0:0, ms:0};
/* 立ち絵と顔を出すまで、あと何ミリ秒待てばよいか。
   assets/config.js の VN_UI.charAfterBg で決まります。
     true（既定）… 背景が出きってから出す
     false        … いままでどおり、背景といっしょに出す
     0〜1 の数字  … 背景の切りかえの、何割まで待つか（0.6 なら少し重なる） */
function bgWaitMs(){
  if(SKIPON)return 0;
  const v=VNUI.charAfterBg;
  const r=(typeof v==="number")?v:(v===false?0:1);
  if(r<=0||!BGF.ms)return 0;
  const w=Math.round(BGF.t0+BGF.ms*r-Date.now());
  return w>0 ? Math.min(w,4000) : 0;      /* 念のため、待ちすぎない上限 */
}
/* 背景を切りかえる。
   新しい背景を上に重ねて、じわっと不透明にしていきます（クロスフェード）。
   古い層は切りかわりきってから捨てます。 */
function vnBGset(k){
  /* ちゃんとした背景を入れるときは、「自室のまま」モードを抜ける
     （コマンドのアイコンとステータスが、また出てくるようにする） */
  if(k)$("stage").classList.remove("roomvn");
  const same=(S.vnBgKey===k);
  S.vnBgKey=k;
  const el=$("vnBg"); if(!el)return;
  /* 同じ背景がもう出ているなら、描きなおさない（むだな明滅を防ぐ） */
  if(same && el.firstElementChild) return;

  const layer=document.createElement("div");
  layer.className="bgl";
  layer.innerHTML=bgHTML(k);

  const ms=bgFadeMs();
  if(!el.firstElementChild || ms<=0){        /* 1枚目、または「なし」のとき */
    clearTimeout(BGF.t);
    BGF.t0=0; BGF.ms=0;                      /* 待たずに立ち絵を出してよい */
    el.innerHTML=""; el.appendChild(layer);
    return;
  }
  /* ここから、じわっと切りかわります。立ち絵と顔は、これが終わるまで待ちます */
  BGF.t0=Date.now(); BGF.ms=ms;
  /* 立てつづけに切りかわったときに層がたまらないようにする。
     残した層はすぐ不透明にして「土台」にする（ここを飛ばすと、
     消えかけの層だけが残って、一瞬まっ暗になってしまいます）。 */
  while(el.children.length>1) el.removeChild(el.firstElementChild);
  const base=el.firstElementChild;
  if(base){ base.style.transition=""; base.style.opacity="1"; }

  layer.style.opacity="0";
  layer.style.transition="opacity "+ms+"ms linear";
  el.appendChild(layer);
  /* 次の描画のタイミングで不透明にする（そうしないと transition が効きません） */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ layer.style.opacity="1"; }));
  clearTimeout(BGF.t);
  BGF.t=setTimeout(()=>{
    while(el.firstElementChild && el.firstElementChild!==layer)
      el.removeChild(el.firstElementChild);
    layer.style.transition=""; layer.style.opacity="";
  }, ms+80);
}
/* ---- イベントスチル（1枚絵）を出す／消す ------------------------------
     vnStill("hinata", 1)           1番のスチルを出す
     vnStill("hinata", 1, "smile")  その差分を出す（無ければ、もとの絵）
     vnStill(null)                  消す（立ち絵と顔が、また出てきます）

   ・立ち絵より上、メッセージ枠より下に出るので、文章はスチルの上に読めます
   ・絵が置いていないとき（1ファイル版で埋めこんでいないときも）は、
     なにも出さずに false を返します。話はそのまま進みます
   ・出したスチルは、おまけの「スチル」に記録されます
   ・場面を閉じると（vnClose）、自動で消えます */
function vnStill(who,n,diff){
  const el=$("vnStill"); if(!el)return false;
  const B=document.body;
  if(!who||!n){                              /* 消す */
    B.classList.remove("cgon","cgnochar","cgnoface");
    artSet(el,"",null);
    return false;
  }
  const u=cgURL(who,n,diff);
  if(!u)return false;                        /* 絵が無い＝なにも出さない */
  B.classList.add("cgon");
  B.classList.toggle("cgnochar", CGRULE.charOff!==false);
  B.classList.toggle("cgnoface", CGRULE.faceOff!==false);
  const html=`<img src="${u}" alt="">`;
  const key=who+"|"+n+"|"+(diff||"");
  if(CGRULE.bgFade===false){ artClear(el); el.dataset.artk=key; el.innerHTML=html; }
  else artSet(el,html,key);
  galCG(who,n);
  return true;
}
/* いまスチルが出ているか */
const vnStillOn=()=>document.body.classList.contains("cgon");
/* 入れかた（画面いっぱいに切る／絵ぜんぶを出す）を、CG_RULE から画面に伝えます */
function applyCgRule(){
  const st=$("stage"); if(!st)return;
  st.style.setProperty("--cgfit", CGRULE.fit||"cover");
  st.style.setProperty("--cgfx", Math.round(((typeof CGRULE.focusX==="number")?CGRULE.focusX:0.5)*100)+"%");
  st.style.setProperty("--cgfy", Math.round(((typeof CGRULE.focusY==="number")?CGRULE.focusY:0.5)*100)+"%");
}
/* その場面だけ、着せる服を決めうちしたいとき（例: vnOutfit("swim")）。
   null に戻すと、背景と月から自動で決まる。 */
function vnOutfit(name){ S.vnOutfit=name||null; }
/* 立ち絵を出さないモード。
   電話中や、まだ待ち合わせ場所に着いていない「誘っているだけ」の場面で使う。
   名前と声（セリフ）は出るが、姿は見えない、という状態。 */
let VNFACEOFF=false;
function vnFaceOff(v){ VNFACEOFF=!!v;
  if(VNFACEOFF){ artSet($("vnChar"),"",null); vnFaceWin(null); } }
/* 会話（ノベル）画面をひらく。
   コマンド画面の上にかぶさるので、**会話画面のほうを**うっすらから出します
   （背景の切りかえと同じ見えかた）。
   もう開いているとき（場面が変わっただけ）は、背景のクロスフェードにまかせます。 */
function vnOpen(bg){
  /* ★ 「もう出ているか」は S.vnOn ではなく、**画面に出ているか**で見ます。
     vnClose() は S.vnOn をすぐ false にしますが、会話画面はうすくなりきるまで
     残っています。そこを S.vnOn で見ると、場面が続けて変わったときに
     いったん透明にされて、コマンド画面が2コマだけ見えてしまいます。 */
  const already = $("vn").style.display!=="none";
  S.vnOn=true; $("vn").style.display="block"; S.vnOutfit=null; vnBGset(bg); msgReset();
  $("vnBody").innerHTML=""; $("vnChoices").innerHTML="";
  /* 場面を開きなおすときは、立ち絵と顔はフェードせず、すぐ空にします
     （前の場面の絵が、新しい場面にうすく残って見えないように） */
  artClear($("vnChar")); artClear($("vnFaceWin"));
  artClear($("vnStill"));
  document.body.classList.remove("cgon","cgnochar","cgnoface");
  $("vnFaceWin").classList.remove("on");
  $("vnName").classList.remove("on");
  VNFACEOFF=false;
  vnHide(false); drawVnBar();
  if(already)fadeStop("vn"); else fadeIn("vn");
}
/* 会話画面を閉じる。うすくしながら消すので、下のコマンド画面がすっと出てきます。
   now=true なら、待たずにすぐ消します（タイトルへ戻るときなど）。 */
function vnClose(now){
  S.vnOn=false; vnStopAuto(); VNFACEOFF=false;
  /* 背景を待っている立ち絵があれば、取り消します
     （場面を閉じたあとに、あとから立ち絵が出てこないように） */
  artStop($("vnChar"));
  hideBoard(); vnFaceWin(null); vnStill(null);
  /* ★ 背景の層も、いっしょに片づけます。
     ここを残しておくと、つぎに会話が始まったときに
     **いったん前の場面の背景が出てから**新しい背景へクロスフェードしてしまいます
     （入学式のあとの最初のコマンド、休日のコマンドなどで目立ちます）。
     片づけるのは、会話画面が消えきってから（それまでは見えているので）。
     場面から場面へ続けて移るときは fadeIn が割りこむので、ここは走りません
     ＝そのときは、いままでどおり背景どうしのクロスフェードになります。 */
  const done=()=>{ $("vn").style.display="none";
    clearTimeout(BGF.t); $("vnBg").innerHTML=""; S.vnBgKey=null; };
  if(now){ fadeStop("vn"); done(); return; }
  fadeOut("vn", done);
}
/* いま画面に立っている子の名前。地の文かセリフかで、名前欄の出しわけに使う */
let VNSPK="";
/* メッセージ枠の左の顔枠。表情はここで変わります */
function vnFaceWin(g,exp){
  const el=$("vnFaceWin");
  if(!el)return;
  /* 出ていないときは、うすくしてから消します（いきなり消えないように） */
  if(!g || !FACEWIN.on || VNFACEOFF){
    artSet(el,"",null,()=>el.classList.remove("on")); return; }
  /* 同じ絵かどうかの見わけ。服は場面（背景）で決まるので、それも入れます */
  const fkey=g.id+"|"+(exp||"")+"|"+(S.vnBgKey||"")+"|"+(S.vnOutfit||"")+"|"+ARTGEN;
  /* 画像が無いときは、SVGで「頭から鎖骨まで」を描きます。
     立ち絵の画像だけある子は、その顔のあたりを切り取って使います。 */
  const bust = bustArt(g,exp);
  const art  = bust || portrait(g,exp,hasArt(g.id)?"crop":"bust");
  /* 写真の右下にのせる、手書きふうの名前。
     assets/ui/ui_photo_name_<キャラid>.png（例 ui_photo_name_hinata.png）。
     置いていない子には、なにも出ません。 */
  const sig=vnPhotoName(g.id);
  /* assets/ui/ui_photo_frame.png があれば、写真の枠に入れて少し傾けます。
     窓のかたちは ui_photo_mask.png（無ければ VN_UI の数字で四角く切りぬき） */
  /* 頭を写真の外へ出す層。窓より上に出たところだけを、枠の絵の上に描きます。
     bust/ の画像（背景が透明なもの）のときだけ。立ち絵の切り抜きやSVGでは
     出しません（切り抜きの中まで書きかわって、顔がずれてしまうため）。 */
  const head = (bust && VNUI.photoHead!==false)
    ? `<div class="pfhead">${bust}</div>` : ``;
  const nameimg = sig?`<img class="pfname" src="${sig}" alt="">`:``;
  if(document.body.classList.contains("photoin")){
    /* ---- 写真の枠を、絵のほうに描きこんである場合 ----------------------
       bust/ の絵に、白い枠・傾き・頭のはみ出しまで入っている作りです。
       ゲームは切りぬきも回転もせず、**そのまま置く**だけにします。
       （枠の絵 ui_photo_frame.png は、この作りでは使いません）
       bust/ の絵がまだ無い子は、いままでどおりの顔を出します。 */
    const bu=bustURL(g,exp);
    el.classList.toggle("solo",!!bu);
    el.classList.add("on");
    /* 枠つきの絵がまだ無い子は、下（枠を重ねる作り）に落とします。
       枠の絵も置いていなければ、いままでどおりの顔だけになります。 */
    if(!bu){ el.classList.remove("solo");
      artSet(el, framedHTML(art,head,nameimg), fkey); return; }
    artSet(el, `<div class="pf"><img class="pfsolo" src="${bu}" alt="">`+nameimg+`</div>`,
      fkey);
    /* ★ ここで絵の大きさを測って fit() をやりなおしては **いけません**。
       子ごとに絵の形が少しちがうと、そのたびに本文と名前プレートの位置が
       1〜2px 動いて、「話す人が変わるたびにウィンドウがずれる」ように見えます。
       置き場所は画面の大きさだけで決めて、いつでも同じにします。 */
    return;
  }
  el.classList.remove("solo");
  el.classList.add("on");
  artSet(el, framedHTML(art,head,nameimg), fkey);
}
/* 顔を写真の枠に入れたHTML。枠の絵を置いていなければ、顔だけ返します */
function framedHTML(art,head,nameimg){
  return vnPhotoArt()
    ? `<div class="pf"><div class="pfimg">${art}</div><div class="pfframe"></div>`
      + head + nameimg + `</div>`
    : art;
}
function vnFace(g,exp){
  if(!g){ artSet($("vnChar"),"",null); $("vnName").classList.remove("on");
    $("vnName").style.display="";VNSPK="";vnFaceWin(null);return;}
  const e=exp||"normal";
  /* 顔枠を使うときは、立ち絵の表情は動かさない（立ち絵が1枚で済みます） */
  const bodyExp = FACEWIN.on ? (FACEWIN.standing||"normal") : e;
  /* 立ち絵も、じわっと入れかわります（服は場面で決まるので key に入れます） */
  artSet($("vnChar"), VNFACEOFF?"":portrait(g,bodyExp,"sprite"),
         VNFACEOFF?"":g.id+"|"+bodyExp+"|"+(S.vnBgKey||"")+"|"+(S.vnOutfit||"")+"|"+ARTGEN);
  vnFaceWin(g,e);
  VNSPK=g.name;
  $("vnName").textContent=g.name; $("vnName").style.display=""; $("vnName").classList.add("on");
}
/* 名前欄を書きかえる。空なら名前欄そのものを隠す */
function setSpeaker(n){
  const e=$("vnName"); if(!e)return;
  e.style.display="";                 /* 古いインライン指定が残っていたら消す */
  if(n){ e.innerHTML=`<span class="t"></span>`; e.querySelector(".t").textContent=n;
         e.classList.add("on"); }
  else e.classList.remove("on");
}
async function scene(bg,fn){
  const keep=$("msg").style.display;
  $("msg").style.display="none";
  vnOpen(bg);
  try{ return await fn(); } finally { vnClose(); $("msg").style.display=keep; }
}
/* ---- 自室のまま話す場面（電話・おでかけに誘うところ） -------------------
   コマンド画面はもともと自室の絵なので、わざわざ「部屋の場面」へ切りかえず、
   そのうしろの絵をそのまま見せたまま、いつものメッセージウィンドウで話します。

     ・背景（#vnBg）は入れません → うしろの #room がそのまま透けて見えます
     ・コマンドのアイコンとステータスだけ、話のじゃまなので隠します（.roomvn）
     ・話し送りは、いつものノベル画面と同じで「どこを押しても進む」

   おでかけは、行き先が決まったところで vnBGset がその場所の絵を入れます。
   そのとき .roomvn は自動で外れて、ふつうの場面になります。 */
function roomVnOpen(){
  const already = $("vn").style.display!=="none";   /* ↑ vnOpen と同じ理由 */
  $("stage").classList.add("roomvn");
  S.vnOn=true; $("vn").style.display="block"; S.vnOutfit=null;
  clearTimeout(BGF.t);
  S.vnBgKey=null;
  /* 絵の入っていない層を1枚だけ置きます。役目は2つ。
       ・部屋をすこし暗くして、文字とボタンを読みやすくする（.roomveil）
       ・行き先が決まったときに、部屋から場所へ「じわっと」切りかえる土台になる */
  $("vnBg").innerHTML='<div class="bgl roomveil"></div>';
  msgReset();
  $("vnBody").innerHTML=""; $("vnChoices").innerHTML="";
  /* 場面を開きなおすときは、立ち絵と顔はフェードせず、すぐ空にします
     （前の場面の絵が、新しい場面にうすく残って見えないように） */
  artClear($("vnChar")); artClear($("vnFaceWin"));
  artClear($("vnStill"));
  document.body.classList.remove("cgon","cgnochar","cgnoface");
  $("vnFaceWin").classList.remove("on");
  $("vnName").classList.remove("on");
  VNFACEOFF=false; vnHide(false); drawVnBar();
  /* ★ ここで fadeIn / fadeStop を呼ばないと、直前の「消えていく途中」が
     残っていて、話の最中に会話画面が消えてしまいます */
  if(already)fadeStop("vn"); else fadeIn("vn");
}
function roomVnClose(){
  $("stage").classList.remove("roomvn");
  /* 背景の層は vnClose() が、消えきってから片づけます
     （ここで先に消すと、うすくなっていく途中で背景だけ先に消えます） */
  vnClose();
}
async function roomScene(fn){
  const keep=$("msg").style.display;
  $("msg").style.display="none";
  roomVnOpen();
  try{ return await fn(); } finally { roomVnClose(); $("msg").style.display=keep; }
}
const CMDBG={rest:"room",study:"lib",sport:"ground",art:"artroom",trend:"town",charm:"room",care:"home",job:"cafe"};
const CLUBBG={base:"ground",socc:"ground",tenn:"ground",bask:"ground",band:"music",dram:"klass",art:"artroom",gov:"klass",none:"room"};
function cmdBG(k){
  if(k==="club")return CLUBBG[S.club]||"ground";
  if(k==="job") return (JOBS[S.job]||JOBS.conv).bg;
  return CMDBG[k]||"room";
}
const placeBG={park:"park",movie:"movie",amuse:"amuse",aqua:"aqua",lib:"lib",cafe:"cafe",sea:"sea",shrine:"shrine",
  hanami:"sakura",ichigo:"park",pool:"sea",hanabi:"fest",
  momiji:"momiji",budou:"park",illum:"illum",skate:"skate"};

function stampSVG(r){
  if(r==="great")return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="100" fill="none" stroke="#fff" stroke-width="28"/>
    <circle cx="120" cy="120" r="100" fill="none" stroke="#f0a800" stroke-width="16"/>
    <circle cx="120" cy="120" r="58" fill="none" stroke="#fff" stroke-width="28"/>
    <circle cx="120" cy="120" r="58" fill="none" stroke="#e5324f" stroke-width="16"/>
    ${[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3+0.4,x=120+128*Math.cos(a),y=120+128*Math.sin(a);
      return `<path d="M${x},${y-15} l4.5,10.5 l10.5,4.5 l-10.5,4.5 l-4.5,10.5 l-4.5,-10.5 l-10.5,-4.5 l10.5,-4.5 z" fill="#ffd75e"/>`;}).join("")}
  </svg>`;
  if(r==="ok")return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="88" fill="none" stroke="#fff" stroke-width="32"/>
    <circle cx="120" cy="120" r="88" fill="none" stroke="#e5324f" stroke-width="19"/></svg>`;
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#fff" stroke-width="36" stroke-linecap="round">
      <line x1="52" y1="52" x2="188" y2="188"/><line x1="188" y1="52" x2="52" y2="188"/></g>
    <g stroke="#3f7fd0" stroke-width="22" stroke-linecap="round">
      <line x1="52" y1="52" x2="188" y2="188"/><line x1="188" y1="52" x2="52" y2="188"/></g></svg>`;
}
async function stamp(r){
  const el=$("vnStamp");
  const lb=r==="great"?["大成功！","#ffd75e"]:r==="ok"?["成功","#ff9db0"]:["失敗","#9ec9f0"];
  el.innerHTML=stampSVG(r)+`<div class="lb" style="color:${lb[1]}">${lb[0]}</div>`;
  el.className=""; void el.offsetWidth; el.className="show";
  se(r==="great"?"pinpon2":r==="ok"?"pinpon":"bubu");
  const base=r==="great"?1500:r==="ok"?1000:1250;
  const m=SPEEDS[S.speed].m;
  const stale=await waitOrClick(m===0?0:base*m);
  el.className="";
  return stale;
}

/* =======================================================================
   6. 描画
   ======================================================================= */
const $=id=>document.getElementById(id);
/* ゲーム画面の下じきを、まとめて出す／隠す。
   タイトル画面ではこれを隠しておかないと、うしろに残ったままになる */
/* body に付ける目じるし。名前は "ttlscr"（タイトル画面）です。
   ★ "ttl" にしてはいけません。style.css の .ttl はパネルの見出し帯の飾りで、
     body.ttl にすると body 自体が見出し帯になってしまい（display:flex や
     padding が付く）、ページに置かれた他のものの位置が狂います。 */
function gameLayer(on){ document.body.classList.toggle("ttlscr", !on); }
function drawDate(){
  const ti=Math.min(S.t,LAST); const c=CAL[ti],w=dow(ti);
  const hol=holidayAt(ti);
  const cls=(w===6||hol)?"sun":w===5?"sat":"";
  /* BGMは季節で切りかわる。ただしタイトル画面のあいだは、
     タイトルのBGM（assets/bgm/title.*）を上書きしないようにする */
  if(AU.ctx&&S.inGame)bgm(bgmFor(S.t));
  const nx=nextEvent(ti);
  const nxt = nx
    ? `<span class="nx">${nx.e.g||"\u2726"} ${nx.e.n}<i>（${nx.c.m}月${nx.c.d}日）</i></span>`
    : `卒業まであと ${Math.max(0,LAST-S.t)} 日`;
  $("dateBar").innerHTML=`${c.y}年目　${c.m}月${c.d}日<span class="${cls}">（${DOW[w]}）</span>
    <small>${hol?`<span style="color:#e5486f;font-weight:800">${hol}</span>　`:""}${S.name}　${nxt}</small>`;
}
/* きょうから先で、いちばん近いイベントを探す。
   ・きょうがイベントの日なら、それを返す
   ・条件を満たしていない誕生日や練習試合は eventOn() が null を返すので飛ばされる */
function nextEvent(t){
  for(let i=Math.max(0,t);i<=LAST;i++){
    const c=CAL[i]; if(!c)continue;
    const e=eventOn(c.y,c.m,c.d);
    if(e)return {e,c,t:i};
  }
  return null;
}
function starLv(){
  const tot=Object.keys(P).reduce((a,k)=>a+S.p[k],0);
  return tot>=760?5:tot>=520?4:tot>=320?3:tot>=150?2:1;
}
/* =======================================================================
   称号（肩書）
   ・story/titles.js の TITLES が元データ（100種）
   ・校内評価 … いま条件を満たしているうち、格（w）がいちばん高いもの
   ・一度でも満たした称号は GAL.tt に残り、おまけ画面の一覧に永久に出る
   ======================================================================= */
function titleOk(t){ try{ return !!t.f(); }catch(e){ return false; } }
/* いまの校内評価にあたる称号 */
function titleNow(){
  if(typeof TITLES==="undefined")return null;
  let best=null;
  for(const t of TITLES) if(titleOk(t)&&(!best||t.w>best.w))best=t;
  return best;
}
/* 条件を満たしたものを記録する。新しく取れたものがあれば知らせる */
function titleScan(quiet){
  if(typeof TITLES==="undefined"||!S.inGame)return [];
  const got=[];
  for(const t of TITLES){
    if(GAL.tt[t.id])continue;
    if(titleOk(t)){ GAL.tt[t.id]=1; got.push(t); }
  }
  if(got.length){
    galSave();
    if(!quiet&&typeof SKIPON!=="undefined"&&!SKIPON){
      const top=got.reduce((a,b)=>b.w>a.w?b:a);
      toast(got.length>1
        ? `称号「${ttName(top)}」ほか${got.length-1}個を手に入れた！`
        : `称号「${ttName(top)}」を手に入れた！`);
      /* 称号だけの音。assets/se/title.mp3 を置くとそれが鳴ります。
         置いていなければ、いままでどおり pinpon（正解音）です */
      se("title");
    }
  }
  return got;
}
/* ストレスの色分け：0〜39=青／40〜79=黄／80〜100=赤 */
function stressCls(v){ return v>=80?"s3":v>=40?"s2":"s1"; }
function drawStatus(){
  const v=k=>Math.round(S.p[k]);
  const st=Math.round(S.stress);
  const L=starLv();
  $("status").innerHTML=`
    <div class="grid">
      <div class="pr st ${stressCls(st)}"><span>ストレス</span><b>${st}</b></div>
      <div class="pr"><span>リッチ度</span><b>${v("rich")}</b></div>
      <div class="pr"><span>学　力</span><b>${v("study")}</b></div>
      <div class="pr"><span>芸　術</span><b>${v("art")}</b></div>
      <div class="pr"><span>運　動</span><b>${v("sport")}</b></div>
      <div class="pr"><span>気配り</span><b>${v("care")}</b></div>
      <div class="pr"><span>流　行</span><b>${v("trend")}</b></div>
      <div class="pr"><span>魅　力</span><b>${v("charm")}</b></div>
    </div>
    <div class="lvl"><span class="lv1">校内評価</span><span class="ttlnm">${
      ttName(titleNow())
    }</span><span class="stars">${"★".repeat(L)}<i>${"★".repeat(5-L)}</i></span></div>`;
  titleScan();
}
/* 好感度は ★ 10個で表す。★1つぶんが MAXAFF/10 ポイント。
   MAXAFF を変えれば、目盛りの刻みも自動でついてくる。 */
const AFFSTARS=10;
function hearts(a){const n=clamp(Math.round(a/(MAXAFF/AFFSTARS)),0,AFFSTARS);
  return `<span class="hearts">${"★".repeat(n)}<i>${"★".repeat(AFFSTARS-n)}</i></span>`;}
/* いまの間柄。段階（普通／友達／気になる人／好き）をそのまま出す。
   「普通」のあいだだけ、どのくらい近づいたかを言葉で分ける。 */
function mood(g){
  const t=affTier(g);
  if(t!=="normal")return AFFNAME[t];
  const b=AFFTIERS[g.id]||AFFTIER_DEF, p=affPoint(g);
  return p>=b.friend*0.6?"顔は知っている":p>0?"ほぼ他人":"まだ知らない";
}
/* ---- コマンドのボタンを絵にさしかえる（assets/ui/）------------------------
   ui_cmd_<なまえ>_normal.png … ふだんの絵　　※これが必須
   ui_cmd_<なまえ>_hover.png  … カーソルが乗ったときの絵（無ければ同じ絵）

     <なまえ> … rest / study / sport / art / trend / charm / care / job
                club / join / tel / out / cal / info / help / save / cfg / dbg

   部活とバイトは、種類ごとに変えることもできます（先にこちらを探します）。
     ui_cmd_club_base_normal.png（野球部）／ ui_cmd_job_conv_normal.png（コンビニ）

   置いていないボタンは、いままでどおり絵文字と文字のままです。
   大きさ・文字を出すかどうかは assets/config.js の CMD_ICON。
   -------------------------------------------------------------------------- */
const CMDICON=(typeof CMD_ICON!=="undefined")?CMD_ICON:{};
function cmdArt(name,sub){
  const key=(sub && uiArt("ui_cmd_"+name+"_"+sub+"_normal")) ? name+"_"+sub : name;
  const a=uiArt("ui_cmd_"+key+"_normal");
  return a ? {n:a, h:uiArt("ui_cmd_"+key+"_hover")||a} : null;
}
/* 絵の入れかた（contain / cover）と、ふわふわ揺らすかどうか */
function applyCmdArt(){
  const st=$("stage"); if(!st)return;
  st.style.setProperty("--cmdfit", CMDICON.fit||"contain");
  document.body.classList.toggle("nobob", CMDICON.bob===false);
  document.body.classList.toggle("cmdlabel", CMDICON.label===true);
}
/* ボタン1つぶんのHTML。絵があれば2枚重ね（ふだん／カーソル）にします */
function icHTML(cls,attr,emoji,label,name,sub){
  const a=cmdArt(name,sub);
  const plain=`<div class="g">${emoji}</div><div class="t">${label}</div>`;
  if(!a)return `<div class="ic ${cls}" ${attr}>${plain}</div>`;
  /* ★ 絵文字と文字も、絵の下に置いたままにしておきます。
     絵が読めなかったとき（ファイルを消した・名前を変えたのに build.py を
     走らせていない、など）に img の onerror で img 印を外すと、
     まっさらな四角ではなく、いままでどおりのボタンに戻ります。 */
  const oops=`onerror="this.closest('.ic').classList.remove('img')"`;
  return `<div class="ic img ${cls}" ${attr} title="${label}">`
       + `<img class="u0" src="${a.n}" alt="" ${oops}><img class="u1" src="${a.h}" alt="">`
       + plain + `</div>`;
}
function drawIcons(){
  /* 「電話」「おでかけ」が押せるのは、休日の流れが実際に選択を待っているあいだだけ。
     日付が休日かどうかだけで決めると、月曜が祝日のときに
     「予定を立てる画面」でも押せるように見えて、押しても何も起きませんでした。 */
  const sun=isRest(S.t)&&!S.busy&&!!S.sunResolve;
  const planning=((dow(S.t)===0)&&!S.busy)||sun;
  let h="";
  if(S.club==="none")
    h+=icHTML(`jn ${planning?"":"off"}`,`data-act="join"`,"🏫","入部する","join");
  cmdList().forEach(k=>{
    const c=cmdOf(k);
    /* 部活とバイトは、種類ごとの絵（ui_cmd_club_base_normal.png など）も探します */
    const sub = k==="club" ? S.club : (k==="job" ? S.job : null);
    h+=icHTML(`b ${planning?"":"off"} ${k==="club"?"cl":""}`,`data-cmd="${k}"`,c.g,c.n,k,sub);
  });
  h+=icHTML(`p ${sun?"":"off"}`,`data-act="tel"`,"📞","電話","tel");
  h+=icHTML(`p ${sun?"":"off"}`,`data-act="out"`,"👜","おでかけ","out");
  h+=icHTML(`o`,`data-act="cal"`,"📅","予定表","cal");
  h+=icHTML(`o`,`data-act="info"`,"📋","くわしく","info");
  h+=icHTML(`o`,`data-act="help"`,"❓","あそび方","help");
  /* きろくは「いま書けない」だけで、よみこみはいつでもできます。
     off にすると押せないように見えて（カーソルも禁止マークになって）
     じっさいは押せる、というちぐはぐな見た目になっていたので、
     うすくするだけの dim にしています。 */
  h+=icHTML(`o ${canSave()?"":"dim"}`,`data-act="save"`,"💾","きろく","save");
  h+=icHTML(`o`,`data-act="cfg"`,"⚙️","せってい","cfg");
  h+=icHTML(`o dbg`,`data-act="dbg"`,"🛠️","デバッグ","dbg");
  $("icons").innerHTML=h;
  $("icons").querySelectorAll(".ic").forEach(el=>el.onclick=()=>iconClick(el));
}
function redraw(){drawDate();drawStatus();drawIcons();}

/* =======================================================================
   7. メッセージ / 選択
   ======================================================================= */
const bodyEl =()=>S.vnOn?$("vnBody"):$("msgBody");
const choiceEl2=null;
const choiceEl=()=>S.vnOn?$("vnChoices"):$("choices");

/* ---- 文字送り（タイプライター） ---- */
const TQ={items:[],timer:null};
const typeMs=()=>SKIPON?0:TSPEEDS[S.tspeed].ms;
const typing=()=>TQ.items.length>0;
function typeEnqueue(pEl){
  if(!S.vnOn || typeMs()===0) return;
  const w=document.createTreeWalker(pEl,NodeFilter.SHOW_TEXT), nodes=[];
  let n; while(n=w.nextNode()) if(n.nodeValue) nodes.push([n,n.nodeValue]);
  if(!nodes.length)return;
  nodes.forEach(([node])=>{node.nodeValue="";});
  TQ.items.push({nodes,i:0,j:0});
  typeStart();
}
function typeStart(){
  if(TQ.timer)return;
  TQ.timer=setInterval(()=>{
    const it=TQ.items[0];
    if(!it){typeStop();return;}
    for(let k=0;k<1;k++){
      if(it.i>=it.nodes.length){TQ.items.shift();break;}
      const [node,full]=it.nodes[it.i];
      if(it.j>=full.length){it.i++;it.j=0;k--;continue;}
      node.nodeValue=full.slice(0,++it.j);
    }
    const b=bodyEl(); if(b)b.scrollTop=1e6;
  },Math.max(6,typeMs()));
}
function typeStop(){ if(TQ.timer){clearInterval(TQ.timer);TQ.timer=null;} }
function typeFlush(){
  TQ.items.forEach(it=>it.nodes.forEach(([node,full])=>{node.nodeValue=full;}));
  TQ.items=[]; typeStop();
  const b=bodyEl(); if(b)b.scrollTop=1e6;
}
/* 文章を進めてよい押しかたか。
   ★ 右クリック（button 1 以上）では進めません。
     右クリックはメッセージウィンドウを消す／戻すためのもので、
     いっしょに文章まで進んでしまうと、読み飛ばしになってしまいます。
     まん中ボタンや、マウスの「戻る／進む」ボタンでも進めません。 */
const mainPress=e=>!e || e.button===undefined || e.button===0;
function waitTyping(){
  if(!typing())return Promise.resolve();
  return new Promise(res=>{
    const target=S.vnOn?$("vn"):$("msg");
    const skip=ev=>{
      if(!mainPress(ev))return;
      if(ev.target.closest("button")||ev.target.closest("[data-vb]")||ev.target.closest("#vnClose"))return;
      if(S.vnOn&&vnHidden()){ vnHide(false); return; }
      typeFlush(); };
    const done=()=>{clearInterval(chk);target.removeEventListener("pointerdown",skip);res();};
    const chk=setInterval(()=>{ if(!typing())done(); },25);
    target.addEventListener("pointerdown",skip);
  });
}

/* =======================================================================
   メッセージのページ送り
   ・say() で書いた文章は、いったんキューに入る
   ・1ページは最大3行。3行に収まるかぎり続けて表示する
   ・「」のセリフは、かならず1ページに1つだけ（クリックで次のセリフへ）
   ・1つの文章が3行を超えるときは、自動で切って次のページへ送る
   ======================================================================= */
let MSGQ=[];          /* まだ出していない文章 */
let PGBRK=false;      /* 次は新しいページから始める */
let PGQUOTE=false;    /* いま出しているページにセリフが入っている */
function pageBreak(){ PGBRK=true; }
const msgHasMore=()=>MSGQ.length>0;
function msgReset(){ MSGQ=[]; PGBRK=false; PGQUOTE=false; typeFlush();
  const b=bodyEl(); if(b)b.innerHTML=""; }

/* タグを壊さずに、見える文字 n 個ぶんで切る */
function htmlCut(h,n){
  let out="",cnt=0,i=0;const open=[];
  while(i<h.length){
    if(h[i]==="<"){
      const j=h.indexOf(">",i);
      if(j<0){ out+=h.slice(i); i=h.length; break; }
      const tag=h.slice(i,j+1);
      const m=/^<\/?\s*([a-zA-Z0-9]+)/.exec(tag);
      const name=m?m[1].toLowerCase():"";
      if(tag[1]==="/"){ for(let k=open.length-1;k>=0;k--) if(open[k].name===name){open.splice(k,1);break;} }
      else if(!/\/\s*>$/.test(tag) && name!=="br") open.push({name,raw:tag});
      out+=tag; i=j+1; continue;
    }
    if(cnt>=n) break;
    out+=h[i]; cnt++; i++;
  }
  if(i>=h.length) return [h,""];
  const head=out+open.slice().reverse().map(t=>`</${t.name}>`).join("");
  const tail=open.map(t=>t.raw).join("")+h.slice(i);
  return [head,tail];
}
/* p に収まる最大の長さを探して切る */
function htmlFit(h,b,p){
  const plain=h.replace(/<[^>]*>/g,"").length;
  let lo=1,hi=plain,best=0;
  while(lo<=hi){
    const mid=(lo+hi)>>1;
    p.innerHTML=htmlCut(h,mid)[0];
    if(b.scrollHeight<=b.clientHeight+1){ best=mid; lo=mid+1; } else hi=mid-1;
  }
  if(!best){ p.innerHTML=h; return [h,""]; }
  const cut=htmlCut(h,best);
  p.innerHTML=cut[0];
  return cut;
}
/* 次の1ページを表示する。何も出すものが無ければ false */
function msgShowNext(){
  const b=bodyEl(); if(!b||!MSGQ.length)return false;
  typeFlush();
  const mkP=it=>{const p=document.createElement("p"); if(it.c)p.className=it.c;
    p.innerHTML=it.h; b.appendChild(p); return p;};
  const fits=()=>b.scrollHeight<=b.clientHeight+1;
  const it=MSGQ.shift();
  let pgNm=it.nm;                 /* このページの名前欄。あとでまとめて当てる */
  let fresh = PGBRK || PGQUOTE || it.q || !b.firstChild;
  if(fresh){ b.innerHTML=""; PGQUOTE=false; }
  PGBRK=false;
  const added=[];
  let p=mkP(it);
  if(!fits()){
    if(!fresh){                       /* 追記であふれたら、ページを改める */
      b.innerHTML=""; PGQUOTE=false; fresh=true; p=mkP(it);
    }
    if(!fits()){                      /* 1つで3行を超えるなら切って次へ回す */
      const cut=htmlFit(it.h,b,p);
      if(cut[1]) MSGQ.unshift({h:cut[1],c:it.c,q:false,nm:it.nm});
    }
  }
  added.push(p);
  if(it.q) PGQUOTE=true;
  if(!PGQUOTE){                       /* セリフでなければ、収まるかぎり続けて出す */
    while(MSGQ.length && !MSGQ[0].q){
      const p2=mkP(MSGQ[0]);
      if(!fits()){ b.removeChild(p2); break; }
      if(!pgNm && MSGQ[0].nm) pgNm=MSGQ[0].nm;   /* 見出しに地の文が続いたら、地の文の名前を出す */
      MSGQ.shift(); added.push(p2);
    }
  }
  if(S.vnOn && pgNm!==undefined) setSpeaker(pgNm);
  added.forEach(x=>typeEnqueue(x));
  b.scrollTop=0;
  return true;
}
function openMsg(title){
  msgReset();
  if(S.vnOn){$("vnBody").innerHTML="";$("vnChoices").innerHTML="";return;}
  $("msg").style.display="block";$("msgTtl").textContent=title||"　";$("msgBody").innerHTML="";$("choices").innerHTML="";}
function closeMsg(){if(!S.vnOn)$("msg").style.display="none";}
/* ---- 名前の差しこみ -----------------------------------------------------
   本文や称号の説明に {{kanade}} と書いておくと、表示するときに
   story/names.js の名前へ置きかわります。
     {{kanade}}      → 桜井 かなで（フルネーム）
     {{kanade.mei}}  → かなで（名だけ）
     {{kanade.sei}}  → 桜井（姓だけ）
     {{kanade.role}} → 幼なじみ / 家庭科部
   こうしておくと、名前を変えても本文を書きかえずに済みます。
   知らない id はそのまま残すので、書きまちがえても文章は消えません。 */
/* 主人公の名前を差しこむ。
     {主}     → 桜坂 優（フルネーム）
     {主.名}  → 優        「{主.名}さん」なら「優さん」
     {主.姓}  → 桜坂
   ★ 主人公の名前はプレイヤーが決めるので、セリフに直に書かず、
     かならずこの差しこみ口を使ってください。
   ★ {主彼}（主人公を指す「彼／彼女」）は下の sexWords が受けもちます。
     ここの正規表現は「主のすぐあとに } か .名 か .姓」だけを見るので、
     {主彼} はここでは置きかわりません。 */
function heroWords(t){
  if(typeof t!=="string"||t.indexOf("{主")<0)return t;
  return t.replace(/\{主(?:\.(名|姓))?\}/g,(all,f)=>
    (f==="名") ? (S.mei||S.name||"")
  : (f==="姓") ? (S.sei||"")
  :              (S.name||""));
}
/* 性別で入れかわる言葉（{彼} など）を、いまの主人公・いまの相手に合わせます。
   使える言葉の表は story/events.js の SEXWORD にあります。 */
/* いま話している相手（キャラid）。ふだんは null で、
   S.sex から「主人公＝どちら／相手＝どちら」を決めます。
   ★ おまけの「シーン鑑賞」は、いま選んでいる主人公と関係なく、
     男女どちらの子の場面も再生できます。そのときだけ、ここに相手の id を
     入れて、{彼} や {くん} をその子に合わせます。
     （入れないと、女性キャラの場面で「彼」、男性キャラの場面で「彼女」に
      なってしまいます） */
let SEXWHO=null;
function sexWords(t){
  if(typeof t!=="string"||t.indexOf("{")<0)return t;
  const W=(typeof SEXWORD!=="undefined")?SEXWORD:null; if(!W)return t;
  let my=(S.sex==="f")?"f":"m";
  let you=(typeof targetSex==="function")?targetSex(my):(my==="f"?"m":"f");
  if(SEXWHO){
    const g=castAll().find(x=>x.id===SEXWHO);
    if(g&&g.sex){
      you=g.sex;
      /* その子が攻略対象になるのは、どちらの主人公のときか */
      my=(typeof targetSex==="function")
           ? ((targetSex("m")===g.sex)?"m":"f")
           : ((g.sex==="f")?"m":"f");
    }
  }
  return t.replace(/\{([^{}]{1,8})\}/g,(all,k)=>{
    const w=W[k]; if(!w)return all;           /* 知らない言葉は、そのままにしておく */
    const s=(w.by==="主人公")?my:you;
    return (w[s]!==undefined)?w[s]:all;
  });
}
function nm(t){
  if(typeof t!=="string")return t;
  t=heroWords(t);                    /* {主.名} などを先に名前へ */
  if(t.indexOf("{{")<0)return sexWords(t);
  return sexWords(t.replace(/\{\{([A-Za-z0-9_]+)(?:\.(mei|sei|name|role))?\}\}/g,(all,id,f)=>{
    const k=f||"name";
    const c=(typeof CHARA_NAMES!=="undefined"&&CHARA_NAMES[id])||null;
    if(c&&c[k])return c[k];
    const g=(typeof ALLG!=="undefined")&&ALLG.find(x=>x.id===id);
    if(g&&g[k])return g[k];
    const s=(typeof STORY!=="undefined")&&STORY[id];
    if(s&&s[k])return s[k];
    return all;                       /* 知らない名前は、そのままにしておく */
  }));
}

/* quote を true にすると「そのページに1つだけ」のセリフ扱いになる */
function say(html,cls,quote){
  const h=nm(String(html));
  const q=!!quote||/^\s*(<[^>]*>\s*)*「/.test(h);
  /* 名前欄に出すもの
       セリフ           … その子の名前（vnFace で決まっている）
       見出し（ev/sys） … 名前欄なし
       それ以外の地の文 … 主人公の名前（心の声として読ませる）
     ここで決めておいて、実際に表示するときに当てはめます。
     こうしないと、次のページを出したあとも前の話し手の名前が残ってしまいます。 */
  /* ★変数名は spk（話し手）。nm は上の「{{名前}}を置きかえる関数」なので、
     ここで nm という名前を使うと、その関数が呼べなくなります。 */
  const spk = q ? VNSPK : (cls==="ev"||cls==="sys") ? "" : S.name;
  MSGQ.push({h,c:cls||"",q,nm:spk});
}
function line(g,t,exp){
  if(S.vnOn){vnFace(g,exp);say(`「${t}」`,null,true);}
  else say(`<span class="sp">${g.name}</span>「${t}」`,null,true);
}
function choose(opts,anywhere,bare){
  /* えらぶ場面ではAUTO/SKIPを止める（ノベルゲームのふつうの作法） */
  if(!bare && S.vnOn) vnStopAuto();
  const cgen=S.gen;
  return new Promise(r=>{
    const box=choiceEl(); box.innerHTML="";
    const win=S.vnOn?$("vnWin"):$("msg");
    const target=S.vnOn?$("vn"):$("msg");
    const ent={cleanup:null}; PENDCH.push(ent);
    const drop=()=>{const i=PENDCH.indexOf(ent); if(i>=0)PENDCH.splice(i,1);};
    let atm=null, tm=null, poll=null, shown=false, gone=false;
    const disarm=()=>{ if(atm){clearTimeout(atm);atm=null;} };
    const arm=()=>{
      if(atm||gone)return;
      if(!S.vnOn||!(AUTOON||SKIPON))return;
      if(!bare && !msgHasMore() && !typing())return;   /* 選択肢の前では止まる */
      const len=($("vnBody").textContent||"").length;
      atm=setTimeout(()=>{ atm=null;
        if(step()){ tick(); return; }
        if(anywhere&&bare) finish(opts[0].v);
      }, SKIPON?45:AUTO_BASE+len*AUTO_PER_CHAR/10);
    };
    const cleanup=()=>{ gone=true; if(tm)clearTimeout(tm); disarm();
      if(poll)clearInterval(poll);
      if(VNARM===rearm)VNARM=null;
      target.removeEventListener("pointerdown",h);
      win.classList.remove("waiting"); };
    const rearm=()=>{ disarm(); arm(); };
    const finish=v=>{ cleanup(); drop(); box.innerHTML=""; if(cgen!==S.gen)return; r(v); };
    const showOpts=()=>{ if(shown||bare)return; shown=true;
      /* 数が多いときは縦一列だとはみ出すので、2段・3段に分ける */
      box.classList.remove("many2","many3");
      if(opts.length>=7)box.classList.add("many3");
      else if(opts.length>=5)box.classList.add("many2");
      opts.forEach(o=>{const b2=document.createElement("button");
        b2.className="btn "+(o.pk?"pk":o.gy?"gy":"");b2.innerHTML=nm(o.t);
        b2.onclick=e=>{e.stopPropagation();finish(o.v);};box.appendChild(b2);});
    };
    const step=()=>{                       /* 進めるものがあれば1つ進める */
      disarm();
      if(typing()){ typeFlush(); return true; }
      if(msgHasMore()){ msgShowNext(); return true; }
      return false;
    };
    const tick=()=>{
      if(gone)return;
      /* 文字送りが終わったら「クリック待ち」。まだ続きの文章があっても▼は出す
         （出さないと、次のページがあるのに合図が消えてしまう） */
      const idle = !typing();
      /* 選択肢が並んだら▼は消す（押すのはボタンなので） */
      win.classList.toggle("waiting", idle && (anywhere||!bare) && !shown);
      if(idle && !msgHasMore()) showOpts();   /* 選択肢は文章を出しきってから */
      arm();
    };
    const h=e=>{
      if(!mainPress(e))return;             /* 右クリックでは進めない */
      if(e.target.closest("button")||e.target.closest("[data-vb]")||e.target.closest("#vnClose"))return;
      if(S.vnOn&&vnHidden()){ vnHide(false); return; }
      if(step()){ tick(); return; }
      if(anywhere) finish(opts[0].v);
    };
    ent.cleanup=cleanup;
    if(S.vnOn) VNARM=rearm;
    if(msgHasMore()) msgShowNext();
    tm=setTimeout(()=>{ if(!gone) target.addEventListener("pointerdown",h); },150);
    poll=setInterval(()=>{ if(gone){clearInterval(poll);return;} tick(); },60);
    tick();
  });
}
/* 送りボタンは出さない。画面のどこを押しても進む＋▼が点滅する。 */
const next=async(t)=>{ const v=await choose([{t:t||"",v:null,pk:true}],true,true); pageBreak(); return v; };

/* 全画面モーダルの付け外し。full=画面いっぱい、zoom=中身ごと拡大、cal=カレンダー専用 */
function modalFull(on,mode){
  const M=$("modal");
  M.classList.remove("full","zoom","cal");
  if(on)M.classList.add("full",mode||"zoom");
}
/* 窓を出す。**すでに出ているときは、フェードせず中身だけ入れかえます。**
   ★ 窓から窓へ移るとき（くわしく → 気になる人 → くわしく など）に
     いちいちフェードすると、そのあいだ**うしろのコマンド画面が見えて**しまいます。 */
function modalShow(fn){
  const M=$("modal");
  if(getComputedStyle(M).display!=="none"){ fadeStop(M); fn(); return; }
  fadeIn(M,fn);
}
/* keep … 押した値がこれに当てはまるときは、**窓を閉じずに**返します。
     つづけてべつの窓を出すときに使います（true でいつも開けたまま）。 */
function openModal(title,html,btns,full,keep){
  if(full)modalFull(true);
  /* 窓は下の画面の上に重なるので、窓のほうをうっすら ⇄ はっきり させます
     （「くわしく」「あそび方」など、この関数を通る窓ぜんぶ） */
  modalShow(()=>{
    /* ★ 窓の中身も差しこみ口を通します（{女の子} などが、そのまま出てしまわないように） */
    $("modal").style.display="flex";$("modTtl").textContent=nm(title);$("modBody").innerHTML=nm(html);});
  const stay=v=>(keep===true)||(typeof keep==="function"&&keep(v));
  const bb=$("modBtns");bb.innerHTML="";
  /* ★ 消えきってから resolve します。先に resolve すると、呼び出し側が
     つぎの窓を開いたときに、まだ消えかけの窓とぶつかります
     （入部・バイトの窓が一瞬光って消え、押した操作がなかったことになりました）。 */
  const shut=()=>fadeOut($("modal"),()=>{
    $("modal").style.display="none"; if(full)modalFull(false); });
  return new Promise(r=>{
    (btns||[{t:"閉じる",v:null}]).forEach(o=>{const b=document.createElement("button");
      b.className="btn "+(o.pk?"pk":"gy");b.textContent=o.t;
      b.onclick=async()=>{ if(!stay(o.v))await shut(); r(o.v);};bb.appendChild(b);});
    $("modBody").querySelectorAll("[data-pick]").forEach(el=>el.onclick=async()=>{
      const v=el.dataset.pick; if(!stay(v))await shut(); r(v);});
  });
}

/* =======================================================================
   8. 成長処理
   ======================================================================= */
function matchScore(g){let s=0,w=0;for(const k in g.ideal){s+=g.ideal[k]*S.p[k];w+=g.ideal[k];}return s/w;}
function gainOf(key,base,mul){
  const eff=1-S.stress/220;
  const dim=Math.max(.04,1-S.p[key]/260);
  const B=BLOOD[S.blood].gain;
  const bm=(B[key]||1)*(B["*"]||1);
  return Math.max(.2,base*eff*dim*mul*bm*rnd(.9,1.1));
}
function addStress(v){ S.stress=clamp(S.stress + (v>0? v*BLOOD[S.blood].st : v), 0, 100); }
function addAff(g,v,silent){
  g.aff=clamp(g.aff+v,0,MAXAFF);
  if(!silent&&Math.abs(v)>=MAXAFF/100)say(`${g.name}の好感度が <span class="${v>0?"up":"dn"}">${v>0?"+":""}${v.toFixed(0)}</span>`);
}
function roll(){
  const m=BLOOD[S.blood].roll, r=Math.random();
  return r<0.20+m ? "great" : (r < 1-(0.20+m) ? "ok" : "fail");
}

/* =======================================================================
   9. 週の予定
   ======================================================================= */
function weekAll(){
  const base=(S.weekStart!==undefined)?S.weekStart:S.t;
  const out=[];
  for(let i=0;i<6;i++){const t=base+i;if(t>LAST)break;out.push(t);}
  return out;
}
function weekDays(){ return weekAll().filter(t=>!isRest(t)); }
function drawWeek(){
  const all=weekAll(), sched=weekDays();
  $("week").innerHTML=all.map(t=>{
    const c=CAL[t],ev=fixedAt(t),hol=holidayAt(t),rest=isRest(t);
    const si=sched.indexOf(t), k=si>=0?S.plan[si]:null, r=si>=0?S.res[si]:null;
    const w=dow(t);
    const wc=(rest||w===6)?"su":(w===5?"sa":"");
    let inner;
    if(r) inner=`<div class="res ${r.k==="great"?"dbl":r.k==="ok"?"ok":"ng"}">${r.k==="great"?"◎":r.k==="ok"?"○":"×"}</div><div class="cn">${r.label}</div>`;
    else if(ev) inner=`<div class="cg">${evEmo(ev)}</div><div class="evt">${ev.n}</div>`;
    else if(rest) inner=`<div class="cg">☀</div><div class="evt hol">${hol||"休日"}</div>`;
    else if(k) inner=`<div class="cg">${cmdOf(k).g}</div><div class="cn">${cmdOf(k).n}</div>`;
    else inner=`<div class="cg" style="opacity:.28">＋</div><div class="cn" style="color:#b9ac9c">みてい</div>`;
    const cur=(si>=0&&S.pick===si&&!r&&!ev)?"cur":"";
    return `<div class="slot ${cur} ${rest?"rest":""}" data-i="${si}">
      <div class="dw ${wc}">${DOW[w]}</div><div class="dd">${c.m}/${c.d}</div>${inner}</div>`;
  }).join("");
  $("week").querySelectorAll(".slot").forEach(el=>el.onclick=()=>{
    const i=+el.dataset.i; if(i<0)return; const t=sched[i]; if(fixedAt(t))return;
    S.pick=(S.pick===i)?null:i; drawWeek();});
  const need=sched.length;
  const n=sched.filter((t,i)=>S.plan[i]||fixedAt(t)).length;
  if(S.pick!==null&&sched[S.pick]!==undefined){
    const t=sched[S.pick];
    $("plTip").innerHTML=`<b style="color:#e5486f">${CAL[t].m}/${CAL[t].d}（${DOW[dow(t)]}）だけ変更中</b>`;
    $("plHint").textContent="この日だけコマンドを選ぶ（もう一度日付を押すと解除）";
  }else{
    const full=(n>=need);
    const uni=full&&sched.length&&sched.every((t,i)=>fixedAt(t)||S.plan[i]===S.plan[sched.findIndex((tt,j)=>!fixedAt(tt))]);
    $("plTip").innerHTML=full
      ? `<b style="color:#2f7d4f">${n} / ${need} 決定</b>${uni?'　<span style="color:#c2306a">同じコマンドをもう一度押すと実行</span>':""}`
      : `${n} / ${need} 日ぶん決定`;
    $("plHint").textContent = full ? "「この予定で実行 ▶」または同じコマンドをもう一度"
                                   : "コマンドを押すと1週間ぶん決まります";
  }
  /* 実行中（1週間を消化しているあいだ）は押せないようにする。
     まとめをコマンド画面で出すようになったので、予定表が見えたままになります。 */
  $("go").disabled=(n<need)||S.busy;
}
function assign(k){
  const days=weekDays();
  if(S.pick!==null && S.pick>=0 && S.pick<days.length && !fixedAt(days[S.pick])){
    S.plan[S.pick]=k;              // 日付を選んでいれば、その日だけ
    S.pick=null; drawWeek(); return;
  }
  // すでに全部そのコマンドで埋まっていれば、もう一度押すと実行
  const same = days.length>0 && days.every((t,i)=>fixedAt(t)||S.plan[i]===k);
  if(same && !$("go").disabled){ S.pick=null; drawWeek(); se("ok"); $("go").click(); return; }
  for(let i=0;i<days.length;i++) if(!fixedAt(days[i])) S.plan[i]=k;   // 既定は1週間まとめて
  S.pick=null;
  drawWeek();
}

/* =======================================================================
   10. アイコン操作
   ======================================================================= */
async function iconClick(el){
  if(el.dataset.act==="save"){await openSaveMenu(false);return;}
  if(el.classList.contains("off"))return;
  if(S.sunResolve){
    if(el.dataset.cmd){
      /* バイト先をまだ決めていないときは、先に決めてもらう。
         休日にここを素通りしていたので、店を決めないまま働けてしまっていました。 */
      if(el.dataset.cmd==="job"&&!S.job){
        const w=await jobMenu(); if(!w)return;
        S.job=w; evMark("sys_pickjob"); toast(`バイト先を ${JOBS[w].n} にしました`); redraw();
        if(!S.sunResolve)return;     /* 選んでいるあいだに場面が変わっていたら、何もしない */
      }
      const f=S.sunResolve;S.sunResolve=null;f({type:"cmd",k:el.dataset.cmd});return;}
    if(el.dataset.act==="tel"){const f=S.sunResolve;S.sunResolve=null;f({type:"tel"});return;}
    if(el.dataset.act==="out"){const f=S.sunResolve;S.sunResolve=null;f({type:"out"});return;}
  }
  if(el.dataset.cmd){
    if(el.dataset.cmd==="job"&&!S.job){
      const w=await jobMenu(); if(!w)return;
      S.job=w; evMark("sys_pickjob"); toast(`バイト先を ${JOBS[w].n} にしました`); redraw();
    }
    assign(el.dataset.cmd); return;
  }
  const a=el.dataset.act;
  if(a==="join"){
    if(S.club!=="none")return;
    const k=await clubMenu();
    if(!k)return;
    S.club=k; evMark("sys_joinclub"); redraw();
    S.pre="club";
    toast(`${CLUBS[k].n} に入部しました`);
    await clubEvent(k);
    S.pre=null;
    redraw();
    return;
  }
  if(a==="cfg"){await settingsMenu();return;}
  if(a==="dbg"){await debugMenu();return;}
  if(a==="save"){await openSaveMenu(false);return;}
  if(a==="cal"){ S.calIdx=MIDXof(S.t); await calendarMenu(); return; }
  if(a==="info"){ await showInfo(); return; }
  if(a==="help"){
    await openModal("あそび方",
      `<div style="font-size:13.5px;line-height:2">
      ・<b>月曜</b>に1週間の予定を決めます。青いコマンドを押すと、<b>その週の平日すべてが同じ予定</b>になります。<br>
      ・1日だけ変えたいときは、<b>先に日付のマスを押してから</b>コマンドを選びます（もう一度日付を押すと解除）。<br>
      ・全部埋まった状態で<b>同じコマンドをもう一度押すと、そのまま実行</b>されます（2回押しで1週間が進みます）。<br>
      ・1日ごとに <b style="color:#e5486f">◎大成功20%</b> / <b style="color:#2f7d4f">○成功60%</b> / <b>×失敗20%</b>。◎は約2倍、×はほぼ伸びません。<br>
      ・ただし<b>🛏休養だけは必ず◎大成功</b>になり、ストレスが確実に大きく下がります。<br>
      ・<b>日曜と祝日</b>は予定表を出さず、右のボタンから直接えらびます。<b>📞電話</b>と<b>👜おでかけ</b>は休日だけ。<br>
      ・日本の祝日（元日・成人の日・海の日・文化の日など16日）が休日になります。日曜と重なると翌日が振替休日に。<br>
      ・青いコマンドを選べば、日曜も1日ぶんの判定つきで過ごせます。<br>
      ・部活に入っていると、いちばん左に<b>部活コマンド</b>が出ます。部ごとに伸びる能力が違います。<br>
      ・帰宅部なら、緑の<b>🏫入部する</b>から途中入部できます（一度入ると変えられません）。<br>
      ・<b>💰バイト</b>は初回に勤め先を選びます（コンビニ／カフェ／本屋／ペットショップ）。伸びるものが違い、⚙せってい で変更できます。<br>
      ・バイト中、ごくまれに知り合いの{女の子}が客としてやってきます。<br>
      ・その部にいる{女の子}とは、入部したときに専用のイベントが起こります。<b>まだ会っていない子なら、そこで知り合えます。</b><br>
      ・<b>📅予定表</b>で年間カレンダーを確認できます。テスト・行事・誕生日・長期休みが色分けされています。<br>
      ・予定を実行すると<b>1日ずつ</b>進みます。◎大成功はピンポンピンポン、○成功はピンポン、×失敗はブブー。<br>
      ・画面をクリックすればすぐ次の日へ進みます。<b>⚙せってい</b>で進行のはやさと音を変えられます。<br>
      ・部活コマンドを実行すると<b>熟練度</b>が伸びます（📋くわしく で確認）。運動部は3か月に1回の<b>⚾練習試合</b>、文化部と生徒会は<b>🎪文化祭の出し物</b>の成否に効きます。<br>
      ・<b>💾きろく</b>でセーブ／ロード（スロット100個＋オートセーブ）。セーブは月曜と日曜だけ、ロードはいつでも。メモを書いておけます。<br>
      ・<b>🛠デバッグ</b>で日付ジャンプやパラメータ書き換えができます。<br>
      ・ストレス70超で風邪をひきやすくなります。休養を挟みましょう。<br>
      ・{女の子}は理想のパラメータに近い人を自然と好きになります。顔アイコンで好みを確認できます。<br>
      ・しばらく会わないでいると、好感度は少しずつ下がっていきます。<br>
      ・<b>特定のパラメータを伸ばすと、新しい{女の子}と出会えます。</b>流行・芸術・魅力を90まで上げてみてください。<br>
      ・会話中は下のボタンが使えます。<b>AUTO</b>は自動送り、<b>SKIP</b>は早送り（どちらも選択肢が出ると止まります）。右上の<b>✕</b>でウィンドウを隠せます（画面を押すと戻ります）。<br>
      <span style="color:#8a7a68;font-size:12px">メッセージウィンドウ・ボタン素材：MessageFrame vol.28（空想曲線 様）</span></div>`,
      null,true);
    return;
  }
}

/* ---- くわしく（自分のステータス＋女の子一覧） ---- */
async function showInfo(){
  const M=$("modal"); M.style.width="720px";
  const html=`
   <div style="display:flex;gap:16px;flex-wrap:wrap">
     <div style="flex:1;min-width:250px;font-size:14px;line-height:1.95">
       <div style="font-weight:800;font-size:15px">${S.sei} ${S.mei}</div>
       <div style="color:#8a7a68;font-size:12.5px;margin-bottom:6px">
         ${S.bd.m}月${S.bd.d}日生まれ・${BLOOD[S.blood].n}・${CLUBS[S.club].g}${CLUBS[S.club].n}${S.job?`・${JOBS[S.job].g}${JOBS[S.job].n}`:""}</div>
       <div style="color:#8a7a68;font-size:12px;margin-bottom:8px">${BLOOD[S.blood].d}</div>
       ${Object.keys(P).map(k=>`<div style="display:flex;justify-content:space-between;max-width:210px"><span>${P[k]}</span><b>${Math.round(S.p[k])}</b></div>`).join("")}
       <div style="display:flex;justify-content:space-between;max-width:210px;margin-top:4px;border-top:1px dotted #c9b183;padding-top:4px">
         <span>ストレス</span><b style="color:${S.stress>70?"#e0342f":"#d97a1f"}">${Math.round(S.stress)}</b></div>
       <div style="font-size:11.5px;color:#8a7a68">70をこえると風邪をひきやすくなります</div>
       ${S.club==="none"?"":`
       <div style="margin-top:10px;border-top:1px dotted #c9b183;padding-top:6px">
         <div style="display:flex;justify-content:space-between;max-width:210px">
           <span>${CLUBS[S.club].g} ${profName()}</span><b style="color:#2f7d4f">${profOf()}</b></div>
         <div style="font-size:11.5px;color:#8a7a68">${profRank(profOf())}　／　部活コマンドで伸びます</div>
         <div style="font-size:11.5px;color:#8a7a68">${isSportsClub()
            ?"3か月に1回の<b>練習試合</b>で、勝てるかどうかの目安になります"
            :"<b>文化祭</b>の出し物がうまくいくかの目安になります"}</div>
       </div>`}
     </div>
     <div style="flex:1;min-width:270px">
       <div style="font-size:12px;color:#8a7a68;margin-bottom:5px">気になる人（クリックでくわしく）</div>
       ${S.girls.map(g=>`<div class="gcard" data-pick="${g.id}">
          <div class="pf">${portrait(g,g.aff>=600?"happy":"normal","crop")}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:13.5px">${g.name}</div>
            <div style="font-size:10.5px;color:#8a7a68">${g.role}</div>
            <div>${hearts(g.aff)}</div>
            <div style="font-size:11px;color:#8a7a68">${mood(g)}</div>
          </div></div>`).join("")}
     </div>
   </div>`;
  /* 気になる人を選んだときは、窓を閉じずにプロフィールへ移ります
     （閉じてから開くと、そのあいだコマンド画面が見えてしまいます） */
  const r=await openModal("くわしく",html,[{t:"閉じる",v:null,pk:true}],true,
                          v=>!!(v&&G(v)));
  M.style.width="640px";
  if(r&&G(r)){ await showGirl(G(r)); await showInfo(); }
}
/* ---- プロフィール画面 --------------------------------------------------
   ・誕生日・星座・部活・好きな場所・苦手な場所
   ・いまの間柄（普通／友達／気になる人／好き）に合わせたプロフィール文
       文章は story/<名前>.js の prof:{normal,friend,crush,love} にあります。
       いまの好感度から毎回えらび直すので、好感度が下がれば文章も戻ります。
   ・その子じしんの能力をゲージで
   ------------------------------------------------------------------- */
const PLNAME=id=>{const p=PLACES.find(x=>x.id===id); return p?p.n:id;};
/* ゲージの色（うすい色 → こい色） */
const PGCOL={study:["#8fc4ff","#3a7fd5"], sport:["#a3e08f","#4fa451"],
             art:["#cdaaf3","#8f5fd0"],   charm:["#ffb2cd","#e5619b"],
             care:["#ffd39a","#f0913f"],  trend:["#8fdcd4","#35a79c"]};
function statBars(g){
  return `<div class="gsts">${GIRL_STATK.map(k=>{
    const v=girlStat(g,k), c=PGCOL[k]||["#ddd","#999"];
    return `<div class="gstr"><span class="k">${P[k]}</span>
      <span class="b"><i style="width:${(v/GIRL_MAX*100).toFixed(1)}%;
        background:linear-gradient(180deg,${c[0]},${c[1]})"></i></span>
      <span class="v">${v}</span></div>`;}).join("")}</div>`;
}
async function showGirl(g){
  const M=$("modal"); M.style.width="720px";
  const tier=affTier(g);
  const z=g.bday?zodiacOf(g.bday.m,g.bday.d):null;
  const prof=(g.prof&&(g.prof[tier]||g.prof.normal))||"";
  const wk=Math.floor((S.t-g.last)/7);
  const row=(k,v)=>`<div class="pfr"><span>${k}</span><b>${v}</b></div>`;
  await openModal(g.name,
    `<div style="display:flex;gap:14px;flex-wrap:wrap">
      <div class="pfport">${portrait(g,tier==="love"?"happy":"normal")}</div>
      <div class="pfmain">
        <div style="font-weight:800;font-size:17px">${g.name}</div>
        <div style="color:#8a7a68;font-size:12px">${nm(g.role)}</div>
        <div style="margin:6px 0 2px">${hearts(g.aff)}
          <span class="tierbadge t-${tier}">${tier==="normal"?mood(g):AFFNAME[tier]}</span></div>
        <div class="pfgrid">
          ${g.bday?row("誕生日",`${g.bday.m}月${g.bday.d}日`):""}
          ${z?row("星座",`${z.g} ${z.n}`):""}
          ${g.club?row("部活",g.club):""}
          ${row("最後に会った", wk<=0?"今週":`${wk}週間前`)}
        </div>
        <div class="pfr2"><span>好きな場所</span><b>${g.like.map(PLNAME).join("・")||"—"}</b></div>
        <div class="pfr2"><span>苦手な場所</span><b>${g.hate.map(PLNAME).join("・")||"—"}</b></div>
      </div>
    </div>
    ${prof?`<div class="pfnote">${nm(prof)}</div>`:""}
    <div class="pfttl">ステータス<span>上限 ${GIRL_MAX}</span></div>
    ${statBars(g)}`,
    /* 「もどる」でも窓は閉じません。すぐ「くわしく」に戻るので、
       いったん閉じるとコマンド画面が見えてしまいます */
    [{t:"もどる",v:null,pk:true}],true,true);
  M.style.width="640px";
}

/* ---- カレンダー（今月と翌月を大きく表示） ---- */
const MIDX=(y,mi)=>(y-1)*12+mi;
const MIDXof=t=>{const c=CAL[Math.min(t,LAST)];return MIDX(c.y,MORDER.indexOf(c.m));};
function calMonthBig(y,m){
  const first=gdow(y,m,1);
  let cells="";
  for(let i=0;i<first;i++)cells+='<div class="cd2 out"></div>';
  const evs=[];
  for(let d=1;d<=MLEN[m];d++){
    const gi=gidx(y,m,d)-4;
    const exist=(gi>=0&&gi<=LAST);
    const ev=eventOn(y,m,d), vac=vacOf({m,d}), hol=holidayOf(y,m,d), w=gdow(y,m,d);
    let cls="cd2";
    if(!exist)cls+=" out";
    if(vac)cls+=" vac";
    if(w===6||hol)cls+=" su"; else if(w===5)cls+=" sa";
    if(hol&&exist)cls+=" hol";
    if(ev&&exist)cls+=" e"+ev.c+" ev";
    if(exist&&gi===S.t)cls+=" today";
    const emo=(exist&&ev)?evEmo(ev):(exist&&hol)?holEmo(hol):"";
    const tag=(exist&&ev)?`<span class="en">${ev.n.length>7?ev.n.slice(0,6)+"…":ev.n}</span>`
             :(exist&&hol)?`<span class="en">${hol.length>7?hol.slice(0,6)+"…":hol}</span>`:"";
    cells+=`<div class="${cls}"><span class="dn2">${d}</span>${emo?`<span class="cem">${emo}</span>`:""}${tag}</div>`;
    if(exist&&ev)evs.push(`<span class="el e${ev.c}">${d}</span>${evEmo(ev)} ${ev.n}`);
    /* 行事と祝日が重なる日（5/5・1/1など）は両方を下に並べる */
    if(exist&&hol)evs.push(`<span class="el ehol">${d}</span>${holEmo(hol)} ${hol}`);
  }
  /* 月を送っても高さが変わらないよう、つねに6週ぶんのマスを敷く */
  for(let i=first+MLEN[m];i<42;i++)cells+='<div class="cd2 out"></div>';
  return `<div class="cm2"><div class="cmh2">${MON_EMO[m]||""} ${y}年目　${m}月</div>
    <div class="cw2">${["月","火","水","木","金","土","日"].map((x,i)=>`<div class="ch2 ${i===6?"su":i===5?"sa":""}">${x}</div>`).join("")}</div>
    <div class="cgd2">${cells}</div>
    <div class="cev2">${evs.map(e=>`<div class="evl">${e}</div>`).join("")||"&nbsp;"}</div></div>`;
}
/* 3年ぶんを走査して、1か月あたりの行事＋祝日の最大行数を求める（行事欄の高さを揃えるため） */
let CEVN=0;
/* 行事のならびに、あらかじめ空けておく行数。
   ★ 画面の低いスマホでは、ここを空けすぎると、そのぶん日づけのマス目が
     つぶれて、数字が重なって読めなくなります（iPhone 12 mini の横向きで
     マスが 6px になっていました）。なので、せまい画面では行数を減らします。
     行事がそれより多い月は、欄のほうがのびるので、消えたりはしません。 */
function calEvLines(){
  const b=document.body.classList;
  const cap=b.contains("sh2")?1:b.contains("sh")?2:b.contains("mb")?3:99;
  return Math.min(calMaxEvLines(), cap);
}
function calMaxEvLines(){
  if(CEVN)return CEVN;
  let mx=1;
  for(let y=1;y<=3;y++)for(const m of MORDER){
    let n=0;
    for(let d=1;d<=MLEN[m];d++){
      const gi=gidx(y,m,d)-4; if(gi<0||gi>LAST)continue;
      if(eventOn(y,m,d))n++;
      if(holidayOf(y,m,d))n++;
    }
    if(n>mx)mx=n;
  }
  return CEVN=mx;
}
function calendarMenu(){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="900px"; modalFull(true,"cal");
    if(S.calIdx===undefined)S.calIdx=MIDXof(S.t);
    const close=()=>{ fadeOut(M,()=>{M.style.display="none";modalFull(false);M.style.width="640px";});
      resolve(); };
    const render=()=>{
      S.calIdx=clamp(S.calIdx,0,34);
      const a=fromMI(S.calIdx), b=fromMI(S.calIdx+1);
      $("modTtl").textContent="カレンダー";
      $("modBody").innerHTML=`
        <div class="clegend">
          <span class="lg eex"></span>テスト <span class="lg eev"></span>行事 <span class="lg ebd"></span>誕生日
          <span class="lg evc"></span>長期休み <span class="lg ehol" style="background:#ffd9e2"></span>祝日
          <span style="color:#8a7a68">（背景の緑は休み期間／赤枠は今日）</span></div>
        <div class="cwrap2" style="--cevn:${calEvLines()}">${calMonthBig(a.y,a.m)}${calMonthBig(b.y,b.m)}</div>`;
      $("modBtns").innerHTML=
        `<button class="btn gy" data-k="-1" ${S.calIdx<=0?"disabled":""}>◀ 前の月</button>
         <button class="btn gy" data-k="now">今月</button>
         <button class="btn gy" data-k="1" ${S.calIdx>=34?"disabled":""}>次の月 ▶</button>
         <button class="btn pk" data-k="x" style="margin-left:auto">閉じる</button>`;
      M.querySelectorAll("[data-k]").forEach(bt=>bt.onclick=()=>{
        const k=bt.dataset.k;
        if(k==="x"){close();return;}
        if(k==="now")S.calIdx=MIDXof(S.t); else S.calIdx+=(+k);
        se("click"); render();
      });
    };
    /* 窓は下の画面の上に重なるので、窓のほうをうっすらから出します */
    modalShow(()=>{ M.style.display="flex"; render(); });
  });
}
function fromMI(i){ return {y:Math.floor(i/12)+1, m:MORDER[i%12]}; }

/* =======================================================================
   11. 1週間の実行
   ======================================================================= */
/* ---- 今週のまとめ（デバッグ用） ---------------------------------------
   その週で変わったものを、ぜんぶ並べて返します。変わっていないものは出しません。
   出すかどうかは DBG_WEEKSUM（デバッグ画面で切りかえ）で決まります。 */
let DBG_WEEKSUM=false;
function weekDiffText(p0,stress0){
  const rows=[];
  Object.keys(P).forEach(k=>{
    const d=Math.round((S.p[k]||0)-(p0[k]||0));
    if(!d)return;
    rows.push(`${P[k].replace(/\s/g,"")} <span class="${d>0?"up":"dn"}">${d>0?"+":""}${d}</span>`);
  });
  const ds=Math.round(S.stress-stress0);
  /* ストレスは増えるほうが悪いので、色を逆にします */
  if(ds)rows.push(`ストレス <span class="${ds>0?"dn":"up"}">${ds>0?"+":""}${ds}</span>`);
  if(!rows.length)return "変わったものはなかった。";
  return rows.join("　／　")+`<br><span style="color:#8a7a68;font-size:11.5px">`
    +`いまのストレス ${Math.round(S.stress)}</span>`;
}

async function runWeek(startIdx){
  const gen=S.gen;
  const all=weekAll(), sched=weekDays();
  S.busy=true; drawIcons();
  $("planner").querySelectorAll("button").forEach(b=>b.disabled=true);
  const keepMsg=$("msg").style.display; $("msg").style.display="none";
  /* 週のはじめの値を控えておく（「今週のまとめ」で増減を出すため） */
  if(!startIdx){ S.weekStress0=S.stress; S.weekP0={...S.p}; }
  const stress0=(S.weekStress0===undefined?S.stress:S.weekStress0);
  const p0=S.weekP0?{...S.weekP0}:{...S.p};
  let opened=false;
  const sp=()=>SPEEDS[S.speed].m;
  try{
    for(let i=(startIdx||0);i<all.length;i++){
      if(gen!==S.gen)return;
      const t=all[i], c=CAL[t], ev=fixedAt(t), si=sched.indexOf(t);
      S.t=t; drawDate();
      S.dayIdx=i;
      if(ev){
        if(si>=0)S.res[si]={k:"ok",label:ev.n};
        drawWeek(); vnOpen(evBg(ev)); opened=true;   /* 行事ごとの背景（EVBG） */
        await runFixed(ev);
        continue;
      }
      if(isRest(t)){                       // 祝日は休日あつかい
        if(opened){vnClose();opened=false;}
        $("msg").style.display="none";
        await restDay();
        S.busy=true; drawIcons();
        continue;
      }
      // 風邪
      if(S.stress>70 && Math.random()<0.16){
        S.res[si]={k:"fail",label:"かぜ"}; drawWeek();
        vnOpen("room"); opened=true; vnFace(null);
        say(`<b>${c.m}月${c.d}日（${DOW[dow(t)]}）</b>`,"ev");
        say("……体が重い。熱をはかると、はっきりと数字が出た。");
        rec("cold");
        if(await stamp("fail"))return;          /* 待っている間にロードされた */
        S.stress=clamp(S.stress-22,0,100); drawStatus();
        say(`今日は一日、布団の中だった。　ストレス <span class="up">-22</span>`);
        if(await waitOrClick(sp()===0?0:900*sp()))return;
        continue;
      }
      const k=S.plan[si], cm=cmdOf(k);
      vnOpen(cmdBG(k)); opened=true; vnFace(null);
      say(`<b>${c.m}月${c.d}日（${DOW[dow(t)]}）</b>　${cm.g} ${cm.n}`,"ev");
      say(`${cm.tx}。`);
      if(await waitOrClick(sp()===0?0:420*sp()))return;
      const R=doDay(k,t);
      S.res[si]={k:R.r,label:cm.n}; drawWeek();
      if(await stamp(R.r))return;
      say(R.gain);
      if(await waitOrClick(sp()===0?0:700*sp()))return;
      if(R.visit)await jobVisit(R.visit);
      if(gen!==S.gen)return;
    }
    if(gen!==S.gen)return;
    S.dayIdx=null;
    /* 「今週のまとめ」は、ふだんは出しません（デバッグ画面で出せます）。
       出すときも自室での話なので、部屋の場面へは切りかえず、
       そのままコマンド画面のメッセージ枠で伝えます。 */
    if(DBG_WEEKSUM){
      if(opened){ vnClose(); opened=false; }
      openMsg("今週のまとめ");
      say(`<b>今週はここまで。</b>`,"ev");
      say(weekDiffText(p0,stress0));
      if(S.stress>70)say("……少し疲れがたまっている。休養を挟んだほうがいいかもしれない。","dn");
      await next("▶ 日曜日へ");
    }
  } finally {
    if(gen===S.gen){
      vnClose(); $("msg").style.display=keepMsg;
      S.busy=false; drawIcons();
    }
  }
  await weekEnd();
}

function doDay(k,t){
  const cm=cmdOf(k);
  rec("cmd",k);
  const r = (k==="rest") ? "great" : roll();   /* 休養は必ず大成功 */
  const mul=r==="great"?2.2:r==="ok"?1.0:0.2;
  let gain=[];
  let visit=null;
  if(cm.gain){
    for(const key in cm.gain){const g=gainOf(key,cm.gain[key],mul);S.p[key]=clamp(S.p[key]+g,0,999);
      gain.push(`${P[key].replace(/\s/g,"")} <span class="up">+${g.toFixed(1)}</span>`);}
    addStress(r==="fail"?rnd(5,9):rnd(2.5,5));
    if(cm.club){const C=CLUBS[S.club];
      if(C.girl&&r!=="fail"){const g=G(C.girl);if(g){addAff(g,r==="great"?9:4,true);g.last=t;}}
      const pg=addProf(r);
      if(pg>0.05)gain.push(`${profName()} <span class="up">+${pg.toFixed(1)}</span>`);}
    if(cm.job&&Math.random()<JOBVISIT)visit=pickVisitor();
  }else if(cm.p){
    const g=gainOf(cm.p,cm.s,mul);
    S.p[cm.p]=clamp(S.p[cm.p]+g,0,999);
    addStress(r==="fail"?rnd(4,7):rnd(1.5,3.5));
    gain.push(`${P[cm.p].replace(/\s/g,"")} <span class="up">+${g.toFixed(1)}</span>`);
  }else{
    const d=r==="great"?rnd(22,28):r==="ok"?rnd(13,18):rnd(4,8);
    S.stress=clamp(S.stress-d,0,100);
    gain.push(`ストレス <span class="up">-${d.toFixed(0)}</span>`);
  }
  drawStatus();
  return {r,gain:gain.join("　"),cm,visit};
}

async function weekEnd(){
  // お小遣い（月がかわったら）
  const nowM=CAL[Math.min(S.t,LAST)].m;
  if(S.lastM===undefined)S.lastM=nowM;
  if(nowM!==S.lastM){
    S.lastM=nowM;
    S.p.rich=clamp(S.p.rich+30,0,999);
    /* お小遣いでは画面を止めない。右上の知らせだけ出して、そのまま進む */
    drawStatus(); toast(`${nowM}月ぶんのお小遣い　リッチ度 +30`);
  }
  // 自然好感度
  for(const g of S.girls){
    const m=matchScore(g);
    const rec=clamp(1-(S.t-g.last)/84,0,1);
    let add=m>=180?12:m>=120?9:m>=70?6:m>=35?3.5:1.2;
    add*=(0.25+0.75*rec);
    const ceil=400+Math.min(200,S.p.charm*10/14);
    if(g.aff>ceil)add*=0.12;
    let net=add;
    if(S.t-g.last>21)net-=4;
    if(net<0&&g.aff<=80)net=0;
    addAff(g,net,true);
  }
  // 新しい出会い
  for(const h of castHidden()){
    if(G(h.id))continue;
    if(S.p[h.req.p]>=h.req.v){
      S.girls.push({...h, ideal:{...h.ideal}, aff:h.aff, last:S.t});
      await introScene(G(h.id));
    }
  }
  // しきい値イベント
  for(const g of S.girls){
    const list=AFF_EV[g.id]||[];
    for(let i=0;i<list.length;i++){
      const key=g.id+i;
      /* S.ev は昔からのしるし。evSeen（イベントID）と両方見て、どちらかが付いていれば済み扱い */
      if(!S.ev[key]&&!evSeen(`aff_${g.id}_${i+1}`)&&g.aff>=list[i].at){
        S.ev[key]=true;await affEvent(g,list[i],i);break;}
    }
  }
}




/* ---- バイト先 ---- */
let JOBVISIT=0.01;                   /* コマンド1回あたりの遭遇率。🛠️デバッグからも変えられます */
const JOBVISIT_DEF=0.01;
const JOBS={
 conv:{n:"コンビニ",   g:"🏪",gain:{rich:7.0,care:2.0},          st:7,bg:"town", fav:"hinata",
       d:"時給はふつう。とにかく忙しい。リッチ度◎ 気配り○"},
 cafe:{n:"カフェ",     g:"☕",gain:{rich:5.0,charm:2.5,care:2.0},st:6,bg:"cafe", fav:"luka",
       d:"接客で人あたりが良くなる。リッチ度○ 魅力○ 気配り○"},
 book:{n:"本屋",       g:"📚",gain:{rich:5.0,study:2.5,art:2.0}, st:5,bg:"lib",  fav:"minamo",
       d:"落ち着いた職場。リッチ度○ 学力○ 芸術○"},
 pet :{n:"ペットショップ",g:"🐹",gain:{rich:5.0,care:3.5,charm:1.5},st:5,bg:"pet",fav:"kanade",
       d:"動物の世話で気がきくようになる。リッチ度○ 気配り◎ 魅力○"}
};
/* 「どの部活・どのバイト先にその子が出るか」も story/<名前>.js の p.clubs / p.job から。
   女の子を増やして clubs:["band"] と書けば、その子が軽音楽部の相手役になります。 */
/* ★ いまのキャストの子だけを結びつけます。
   男女ぶんのキャラをそろえると、同じ部活の相手役を取り合ってしまうので、
   主人公の性別が決まるたび（はじめから／ロード）に、ここをやりなおします。 */
/* ---- 性別で差しかわる文章を組み立てる ----------------------------------
   story/events.js（共通）の上に、story/events_f.js または events_m.js の
   「書いてあるぶんだけ」をかぶせて、TXT の中身を入れかえます。
   ★ ゲームじゅうが TXT.valen のように直接見ているので、
     入れものはそのままにして、中身だけ入れかえます。 */
function deepCopy(o){
  if(Array.isArray(o))return o.map(deepCopy);
  if(o&&typeof o==="object"){const r={};for(const k in o)r[k]=deepCopy(o[k]);return r;}
  return o;
}
function deepMerge(base,over){
  const r=deepCopy(base);
  for(const k in over){
    const v=over[k], b=r[k];
    const obj=x=>x&&typeof x==="object"&&!Array.isArray(x);
    r[k]=(obj(v)&&obj(b))?deepMerge(b,v):deepCopy(v);
  }
  return r;
}
const TXTBASE=(typeof TXT!=="undefined")?deepCopy(TXT):null;
function applyTxtSex(){
  if(!TXTBASE||typeof TXT==="undefined")return;
  const over=(S.sex==="f")?((typeof TXT_F!=="undefined")?TXT_F:null)
                          :((typeof TXT_M!=="undefined")?TXT_M:null);
  const merged=(over&&Object.keys(over).length)?deepMerge(TXTBASE,over):deepCopy(TXTBASE);
  for(const k in TXT)delete TXT[k];
  for(const k in merged)TXT[k]=merged[k];
}
function linkCast(){
  applyTxtSex();
  /* 称号のうち「◯◯と好きになる」は、いまのキャストのぶんだけ並べます
     （story/titles.js の ttSync）。ここを忘れると、一覧に取れない称号が出ます。 */
  if(typeof ttSync==="function")ttSync();
  /* イベント台帳は一度きり作って持ちまわしています。部活の相手役が変わるので、
     ここで捨てて、次に見られたときに作りなおさせます。 */
  EVENTS=null; EVENT_LIST=null;
  if(typeof STORY==="undefined")return;
  const ok=new Set(castOfSex().map(g=>g.id));
  /* まず、前のキャストの結びつきを外します。
     これをしないと、性別を変えたときに「もういない子」が
     部活の相手役として残ってしまいます。 */
  for(const k in CLUBS){ CLUBS[k].mate=null; CLUBS[k].girl=null; }
  for(const k in JOBS){ JOBS[k].fav=null; }
  for(const id in STORY){
    if(!ok.has(id))continue;
    const p=STORY[id].p; if(!p)continue;
    (p.clubs||[]).forEach(k=>{ if(CLUBS[k]){CLUBS[k].mate=id; CLUBS[k].girl=id;} });
    if(p.job&&JOBS[p.job])JOBS[p.job].fav=id;
  }
}
linkCast();
function pickVisitor(){
  const J=JOBS[S.job]||JOBS.conv;
  const cand=S.girls.filter(g=>g.aff>=50);
  if(!cand.length)return null;
  const w=cand.map(g=>(g.id===J.fav?4:1)+g.aff/400);
  let r=Math.random()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<cand.length;i++){ r-=w[i]; if(r<=0)return cand[i].id; }
  return cand[0].id;
}
async function jobVisit(gid){
  const g=G(gid); if(!g)return;
  const J=JOBS[S.job]||JOBS.conv;
  const E=JOBMEET[gid]; if(!E)return;
  galMark("job:"+gid, S.job||"conv"); evMark("job_"+gid);
  se("heart");
  vnFace(g,E.ex||"normal");
  say(`✦ <b>${J.n}に、見知った顔がやってきた</b>`,"ev");
  E.b.forEach(t=>say(t));
  const i=await choose(E.o.map((o,idx)=>({t:o.t,v:idx})));
  se("page");
  vnFace(g,E.o[i].d>=80?"blush":E.o[i].d>0?"happy":"sad");
  say(E.o[i].r);
  addAff(g,E.o[i].d); g.last=S.t;
  redraw(); await next();
}
function jobMenu(){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="640px";
    const close=v=>{ fadeOut(M,()=>{M.style.display="none";M.style.width="640px";}); resolve(v); };
    $("modTtl").textContent="バイト先をえらぶ";
    $("modBody").innerHTML=
      `<div style="font-size:12.5px;color:#8a7a68;margin-bottom:8px">
         バイト先によって伸びるものが変わります。あとから⚙せっていで変えられます。<br>
         働いていると、ときどき知り合いが来ることがあります。</div>`+
      Object.keys(JOBS).map(k=>{const J=JOBS[k];
        return `<div class="clubrow"><div class="cg2">${J.g}</div>
          <div class="ci"><b>${J.n}</b><br><span style="font-size:11.5px;color:#8a7a68">${J.d}</span></div>
          <button class="btn pk sm" data-w="${k}">ここにする</button></div>`;}).join("");
    $("modBtns").innerHTML=`<button class="btn gy" data-w="" style="margin-left:auto">やめる</button>`;
    M.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>close(b.dataset.w||null));
    modalShow(()=>{ M.style.display="flex"; });
  });
}


async function clubEvent(cid){
  const C=CLUBS[cid]; if(!C||!C.mate)return;
  const known=!!G(C.mate);
  if(!known){
    const tpl=ALLG.find(x=>x.id===C.mate); if(!tpl)return;
    S.girls.push({...tpl, ideal:{...tpl.ideal}, aff:tpl.aff, last:S.t});
  }
  const g=G(C.mate); if(!g)return;
  const E=(known?CLUBJOIN:CLUBMEET)[C.mate]||CLUBJOIN[C.mate]||INTRO[C.mate];
  if(!E)return;
  galMark((known?"club:":"clubm:")+C.mate); evMark("club_"+C.mate);
  await scene(C.bg||"klass",async()=>{
    openMsg("入部");
    se("heart");
    say(`✦ <b>${C.g} ${C.n} に入部した</b>`,"ev");
    if(!known)say(`ここで、思いがけない出会いがあった。`,"ev");
    vnFace(g,E.ex||"normal");
    E.b.forEach(t=>say(t));
    const i=await choose(E.o.map((o,idx)=>({t:o.t,v:idx})));
    se("page");
    vnFace(g,E.o[i].d>=80?"blush":E.o[i].d>0?"happy":"sad");
    say(E.o[i].r);
    addAff(g,E.o[i].d); g.last=S.t;
    if(!known){say(`<b>${g.name}</b>と知り合いになった。`,"ev");say(`<span class="sys">${g.role}</span>`);}
    else say(`これから、同じ部で過ごすことになる。`,"sys");
    redraw(); await next();
  });
}

/* ---- 入部メニュー ---- */
function clubMenu(){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="700px";
    const close=v=>{ fadeOut(M,()=>{M.style.display="none";M.style.width="640px";}); resolve(v); };
    $("modTtl").textContent="入部する";
    $("modBody").innerHTML=
      `<div style="font-size:12.5px;color:#8a7a68;margin-bottom:8px">
         一度入ると変えられません。部によって伸びる能力がちがい、その部の子と接点ができます。</div>`+
      Object.keys(CLUBS).filter(k=>k!=="none").map(k=>{
        const C=CLUBS[k], mate=C.mate&&G(C.mate);
        return `<div class="clubrow"><div class="cg2">${C.g}</div>
          <div class="ci"><b>${C.n}</b><br><span style="font-size:11.5px;color:#8a7a68">${C.d}</span>
            ${mate?`<br><span style="font-size:11.5px;color:#c2306a">${mate.name} がいるらしい</span>`:""}</div>
          <button class="btn pk sm" data-j="${k}">入る</button></div>`;}).join("");
    $("modBtns").innerHTML=`<button class="btn gy" data-j="" style="margin-left:auto">やめる</button>`;
    M.querySelectorAll("[data-j]").forEach(b=>b.onclick=async()=>{
      const k=b.dataset.j;
      if(!k){close(null);return;}
      const ok=await confirmBox("入部しますか？",
        `<b>${CLUBS[k].g} ${CLUBS[k].n}</b><br>${CLUBS[k].d}<br><br><span style="color:#c2306a">あとから変えることはできません。</span>`,"入部する");
      if(!ok)return;
      close(k);
    });
    modalShow(()=>{ M.style.display="flex"; });
  });
}

async function introScene(g){
  const E=INTRO[g.id];
  galMark("intro:"+g.id); evMark("meet_"+g.id);
  await scene(E.bg,async()=>{
    openMsg("出会い");
    se("heart");
    say(`✦ <b>${g.req.n}が ${g.req.v} を超えた —— 新しい出会い</b>`,"ev");
    vnFace(g,E.ex);
    E.b.forEach(t=>say(t));
    const i=await choose(E.o.map((o,idx)=>({t:o.t,v:idx})));
    se("page");
    vnFace(g,E.o[i].d>=100?"blush":E.o[i].d>=60?"happy":"normal");
    say(E.o[i].r);
    addAff(g,E.o[i].d); g.last=S.t;
    say(`<b>${g.name}</b>と知り合いになった。`,"ev");
    say(`<span class="sys">${g.role}</span>`);
    redraw(); await next();
  });
}

/* =======================================================================
   12. 日曜日
   ======================================================================= */
async function restDay(){
  const gen=S.gen;
  S.busy=false; redraw();
  const c=CAL[S.t], hol=holidayAt(S.t);
  $("sunHint").querySelector(".ttl span").textContent = hol?("☀ "+hol):"☀ 日曜日";
  $("sunBody").innerHTML=`
    <div style="font-size:14px;line-height:1.9">
      <b>${c.y}年目 ${c.m}月${c.d}日（${DOW[dow(S.t)]}）</b>　${hol?`<span style="color:#e5486f;font-weight:800">${hol}</span>　`:""}${VACNAME[vacOf(c)]||seasonName(c.m)}<br>
      <span style="color:#8a7a68">休日は「📞電話」と「👜おでかけ」が使えます。<br>
      青いコマンドを選べば、休日も1日ぶんの判定つきで過ごせます。</span>
      <div style="margin-top:8px">${S.girls.map(g=>`${g.name} ${hearts(g.aff)}`).join("　")}</div>
    </div>`;
  /* 「電話」「おでかけ」で〈やめる〉を選んだときは、日を進めずにコマンド選択へ戻る */
  for(;;){
  /* 受け口（sunResolve）を先に用意してから絵を描きなおす。
     drawIcons が sunResolve を見て「電話」「おでかけ」を出しわけるため、順番が大事です */
  $("sunHint").style.display="block";
  const pick=await new Promise(r=>{ S.sunResolve=r; drawIcons(); });
  if(gen!==S.gen)return;
  $("sunHint").style.display="none";
  if(pick.type==="cmd"){
    S.busy=true; drawIcons();
    const keepMsg=$("msg").style.display; $("msg").style.display="none";
    const c=CAL[S.t], k=pick.k, cm=cmdOf(k), sp=SPEEDS[S.speed].m;
    vnOpen(cmdBG(k)); vnFace(null);
    try{
      say(`<b>${c.m}月${c.d}日（<span style="color:#ff9db0">${DOW[dow(S.t)]}</span>）</b>${holidayAt(S.t)?`　<span class="ev">${holidayAt(S.t)}</span>`:""}　${cm.g} ${cm.n}`,"ev");
      say(`${cm.tx}。`);
      if(await waitOrClick(sp===0?0:420*sp))return;
      const R=doDay(k,S.t);
      if(await stamp(R.r))return;
      say(R.gain);
      /* ★ 平日とおなじで、ボタンを押させずに、ひとりでに次へ進みます。
         待つ長さは「進行のはやさ」で決まり、押せばすぐ飛ばせます。
         （オプションで「クリックで送る」を選んでいる人は、いままでどおり
           押すまで待ちます＝ sp が 0 のとき waitOrClick(0) は押し待ちです） */
      if(await waitOrClick(sp===0?0:700*sp))return;
      if(R.visit)await jobVisit(R.visit);
      if(gen!==S.gen)return;
    } finally {
      /* ロードされていたら、新しいゲームの画面を閉じてしまわない */
      if(gen===S.gen){ vnClose(); $("msg").style.display=keepMsg; S.busy=false; }
    }
  }else{
    const flow = pick.type==="tel" ? telFlow : dateFlow;
    S.busy=true; drawIcons();
    /* 電話も「誰を誘おうか」も自室でしていること。場面は切りかえない */
    const done=await roomScene(flow);
    S.busy=false;
    if(gen!==S.gen)return;
    if(!done){ redraw(); continue; }   /* 何もしなかったので、休日はまだ終わらない */
  }
  break;
  }
  redraw();
}
const seasonName=m=>SEASONJA[seasonOf(m)];

async function dateFlow(){
  openMsg("デートに誘う");
  vnFaceOff(true);          /* 誘っているあいだは姿を見せない */
  say("誰を誘おうか。");
  const id=await choose([...S.girls.map(g=>({t:`${g.name}<br><small style="opacity:.8">${mood(g)}</small>`,v:g.id})),{t:"やめる",v:null,gy:true}]);
  if(!id)return false;      /* 何もしていないので、日は進めない */
  const g=G(id);
  if(g.aff<80){
    line(g,"ごめんなさい、その日はちょっと……","sad");
    say("断られてしまった。まずは日々の中で存在を知ってもらおう。");
    S.stress=clamp(S.stress+6,0,100);drawStatus();await next();return true;
  }
  if(S.p.rich<8){
    say("……財布の中身を確かめた。今月はもう厳しい。","dn");
    say("お金がないと、どこにも連れて行けない。バイトも大事だ。");
    await next();return true;
  }
  line(g,girlLine(g,"date")||"うん、いいよ！",affAtLeast(g,"crush")?"blush":"happy");
  say("どこへ行こうか？");
  /* 季節かぎりの場所は、その季節だけ並ぶ */
  const pid=await choose(placesNow().map(p=>({t:p.n,v:p.id})));
  const PL=PLACES.find(p=>p.id===pid);
  /* 行き先が決まって、はじめて自室を出る。ここで背景を入れる
     （vnBGset が「自室のまま」モードを外すので、アイコンとステータスも元に戻ります） */
  se("page");
  const pbg=placeBG[pid]||"park";
  if(S.vnOn) vnBGset(pbg);
  else { $("msg").style.display="none"; vnOpen(pbg); }
  say(`<b>${PL.n}</b> へ出かけた。`,"ev");
  vnFaceOff(false); vnFace(g,"normal");   /* 待ち合わせ場所で、ようやく顔を合わせる */
  /* その場所を好きか、ふつうか、嫌いか。第一声もここで決まる */
  const pref=placePref(g,pid);
  let v=50,cmt,ex0="normal";
  if(pref==="like"){v+=110;cmt="ここ、来たかったんだ！";ex0="happy";}
  else if(pref==="hate"){v-=90;cmt="……ここ、ちょっと苦手かも";ex0="sad";}
  else{v+=20;cmt="うん、悪くないね";}
  const need=S.p[PL.need];
  v += need>=80?70 : need>=40?30 : need<15?-40 : 0;
  v += (matchScore(g)-45)/1.2;
  if(S.stress>65){v-=40;say("疲れた顔をしていたかもしれない。");}
  v+=rnd(-25,25);
  v*=0.55;                      /* 場の空気ぶん。あとは選択肢しだい */
  line(g,cmt,ex0);

  /* ---- 何をするか選ぶ ---- */
  const set=dateSet(pid);
  let rank="ok";
  if(set&&set.length){
    say(TXT.datePlay.ask);
    const i=await choose(set.map((o,idx)=>({t:o.t,v:idx})));
    const opt=set[i]||set[0];
    rank=(DATE_SHIFT[pref]||DATE_SHIFT.normal)[opt.k||"ok"]||"ok";
    if(!S.visit)S.visit={};
    S.visit[pid]=(S.visit[pid]||0)+1;      /* 次に来たときは別の3つになる */
    se("page");
    say(opt.r);
  }
  v += DATE_AFF[rank]||0;
  if(v>0){
    v*=clamp(1-g.aff/1250,0.15,1);
    if(S.t-g.last<21){v*=0.6;say("<span style='color:#8a7a68'>（最近も会ったばかりだ）</span>");}
  }
  /* ---- 結果 ---- */
  const ex = rank==="great"?"blush" : rank==="good"?"happy" : rank==="ok"?"normal":"sad";
  vnFace(g,ex);
  if(rank==="great")se("heart");
  say(TXT.datePlay.res[rank], rank==="great"?"ev":(rank==="bad"||rank==="worst")?"dn":null);
  if(rank==="great"||rank==="good")line(g,g.q.ok,ex);
  else if(rank==="bad"||rank==="worst")line(g,g.q.bad,"sad");
  if(rank==="great")await stamp("great");
  else if(rank==="worst")await stamp("fail");
  rec("date",g.id); if(rank==="great")rec("great");
  addAff(g,v);g.last=S.t;
  S.stress=clamp(S.stress+(v>=60?-10:6),0,100);
  S.p.rich=Math.max(0,S.p.rich-rnd(5,9));
  S.p.charm=clamp(S.p.charm+1.2,0,999);
  redraw();await next();
  return true;
}

async function telFlow(){
  openMsg("電話");
  vnFaceOff(true);          /* 電話なので、最後まで姿は見えない */
  say("受話器を取った。誰にかけよう。");
  const id=await choose([...S.girls.map(g=>({t:g.name,v:g.id})),{t:"やめる",v:null,gy:true}]);
  if(!id){closeMsg();return false;}   /* 何もしていないので、日は進めない */
  const g=G(id);
  const far=(S.t-g.last>=28);
  const v=far?50:(g.aff>=400?40:25);
  const st=(typeof STORY!=="undefined")&&STORY[g.id];
  /* 間柄べつのセリフ（story/かのじょ.js の tel）から1本。無ければ、いつものあいさつ */
  const t=(far&&st&&st.telFar)?st.telFar:(girlLine(g,"tel")||g.q.hi);
  line(g,t,affAtLeast(g,"crush")?"blush":"happy");
  say("たわいのない話を、少しだけ。");
  rec("tel",g.id);
  addAff(g,v);g.last=S.t;
  S.stress=clamp(S.stress-4,0,100);
  redraw();await next();closeMsg();
  return true;
}

/* =======================================================================
   13. イベント
   ======================================================================= */
async function affEvent(g,e,idx){
  if(idx!==undefined){ galMark(`aff:${g.id}:${idx}`); evMark(`aff_${g.id}_${idx+1}`); }
  await scene(e.bg||"klass",async()=>{
    openMsg(e.t);
    vnFace(g,e.ex||"normal");
    say(`✦ <b>${e.t}</b>`,"ev");
    /* 名前欄は say() が行ごとに決めます（セリフ＝その子／地の文＝主人公／見出し＝なし）。
       ここで直に style をいじると、あとの場面まで名前欄が出っぱなしになります。 */
    e.b.forEach(t=>say(t));
    const i=await choose(e.o.map((o,idx)=>({t:o.t,v:idx})));
    se("page");
    vnFace(g, e.o[i].d>=60?"blush": e.o[i].d>0?"happy":"sad");
    say(e.o[i].r);
    addAff(g,e.o[i].d);g.last=S.t;
    if(e.o[i].d>=60)se("heart");
    redraw();await next();
  });
}

/* その行事のイベントID（誕生日はキャラごと、ほかは「行事の名前＋月日」） */
function fixedEvId(ev){
  if(!ev)return null;
  if(ev.id==="bday")   return ev.who?"bday_"+ev.who:null;
  if(ev.id==="mybday") return "bday_hero";
  if(ev.eid)           return ev.eid;               /* 追加シナリオが自分で持つID */
  return "fx_"+ev.id+"_"+((ev.m<10?"0":"")+ev.m+(ev.d<10?"0":"")+ev.d);
}
async function runFixed(ev){
  evMark(fixedEvId(ev));
  /* 追加シナリオは、自分で run を持っています */
  if(typeof ev.run==="function"){ await ev.run(ev); return; }
  if(ev.id==="exam")       await evExam(ev);
  else if(ev.id==="invite")await evInvite(ev);
  else if(ev.id==="culture")await evCulture(ev);
  else if(ev.id==="match")  await evMatch(ev);
  else if(ev.id==="valen") await evValentine();
  else if(ev.id==="trip")  await evTrip1();
  else if(ev.id==="trip2") await evTrip2();
  else if(ev.id==="trip3") await evTrip3();
  else if(ev.id==="bday")  await evBday(ev);
  else if(ev.id==="mybday")await evMyBday();
  else if(ev.id==="sports")await evSports();
  else if(ev.id==="newyear")await evNewYear();
  else if(ev.id==="white") await evWhite();
  else if(ev.id==="vacs")  await evVac(ev);
}

/* -------- テストの成績表 --------------------------------------------
   5教科の点数を出して、順位とともに掲示板に貼り出します。
   点数は「そのテストの日」から決まるので、何度描き直しても変わりません。 */
const SUBJ=["国語","数学","英語","理科","社会"];
/* 女の子の学力のめやす（100点満点）と、教科ごとの得意・苦手
   grow = 1学年あがるごとに、その子の点がどれだけ伸びるか
   （もともと低い子ほど伸びしろが大きい） */
/* ACADEMIC（テストの点）は story.js が story/<名前>.js から組み立てます */
/* ---- 学年ごとの「ハードル」 ------------------------------------------
   まわりも3年かけて伸びるので、同じ順位を取るのに必要な学力は年々上がります。
   EXAMBAR[学年-1] が、そのときの「必要な学力の倍率」です。
     例）学年1位（学力260相当）を取るには
         1年目 260 ／ 2年目 260×1.38＝359 ／ 3年目 260×1.78＝463
   ★テストを難しく／やさしくしたいときは、この3つの数字を変えてください。 */
const EXAMBAR=[1.00, 1.38, 1.78];
function examYear(){ const c=CAL[Math.min(S.t,LAST)]; return (c&&c.y)||1; }
function examBar(y){ return EXAMBAR[clamp((y||examYear())-1,0,2)]; }
/* ハードルで割った「実質の学力」。順位も点数も、これを使って決めます */
function examStudy(y){ return S.p.study/examBar(y); }
/* 同じ日なら同じ値になる、かんたんな乱数 */
function examRnd(seed){const x=Math.sin(seed*127.1+311.7)*43758.5453; return x-Math.floor(x);}
function examScores(base,w,seed){
  return w.map((v,i)=>clamp(Math.round(base+v+(examRnd(seed+i*13)*11-5.5)),2,100));
}
function myExamScores(seed){
  const st=examStudy();          /* 学年が上がるほど、同じ学力でも点は伸びにくい */
  /* 100点に近づくほど伸びにくい曲線。頭打ちにならないので、
     学力が高い人どうしでも順位の差がつきます。
       学力 50→48点　100→65点　200→84点　300→93点　400→97点 */
  const base=100-76*Math.exp(-st/130);
  /* 学力いがいも、少しだけ教科の得意・苦手にひびく */
  const w=[S.p.art*0.035, 0, S.p.trend*0.035, S.p.sport*0.012, S.p.care*0.035]
          .map(v=>Math.min(6,v)-1.5);
  return examScores(base,w,seed+7);
}
/* ---- 学年順位 -------------------------------------------------------
   合計点が「学年240人の中でどのあたりか」を、ふつうの成績分布
   （平均290点・ばらつき78点）にあてはめて出します。
   上のほうほど1点の差が大きくひびくので、満点に近づける意味があります。
   ★順位を甘く／辛くしたいときは EXAM_MEAN と EXAM_SD を動かしてください。
     平均を上げる＝順位が下がる／ばらつきを大きくする＝上位に入りやすい */
const EXAM_MEAN=290, EXAM_SD=78, EXAM_N=240;
/* 正規分布の累積（よく使われる近似式） */
function normCdf(z){
  const t=1/(1+0.2316419*Math.abs(z));
  const d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return z>0?1-p:p;
}
function examRank(tot){
  return clamp(Math.round(EXAM_N*(1-normCdf((tot-EXAM_MEAN)/EXAM_SD))),1,EXAM_N);
}
/* 「学年1位」「学年10位以内」…という言いかた。掲示板の順位から決めるので、
   貼り出された順位と文章がくいちがいません。 */
function examRankText(rank){
  const R=TXT.exam.rank;
  return rank<=1?R[0]:rank<=10?R[1]:rank<=50?R[2]:rank<=150?R[3]:R[4];
}
/* その順位を取るのに必要な学力のめやす（逆算。デバッグ画面と仕様書で使います） */
function examNeed(rank,y){
  let lo=0, hi=999;
  for(let i=0;i<26;i++){
    const mid=(lo+hi)/2;
    const base=100-76*Math.exp(-(mid/examBar(y))/130);
    /* 教科ごとの得意苦手ぶん（だいたい −5点）を見こんでおく */
    if(examRank(Math.round(base*5)-5)<=rank)hi=mid; else lo=mid;
  }
  return Math.ceil(hi);
}

function examBoard(ev){
  const seed=S.t+1;
  const yr=examYear();
  const rows=[{name:S.name,me:true,sc:myExamScores(seed)}];
  S.girls.forEach(g=>{
    const a=ACADEMIC[g.id]; if(!a)return;
    /* 女の子も学年ごとに伸びる */
    rows.push({name:g.name,sc:examScores(a.base+(yr-1)*a.grow,a.w,seed+g.id.length*29)});
  });
  rows.forEach(r=>r.tot=r.sc.reduce((a,b)=>a+b,0));
  rows.sort((a,b)=>b.tot-a.tot);
  /* 合計点から学年順位（240人中）を出す。同じ順位にならないようにずらす */
  let prev=0;
  rows.forEach(r=>{
    let k=examRank(r.tot);
    if(k<=prev)k=prev+1;
    prev=k; r.rank=k;
  });
  const me=rows.find(r=>r.me);
  const head=`<tr><th>順位</th><th class="nm">名前</th>`+
    SUBJ.map(s=>`<th>${s}</th>`).join("")+`<th class="to">合計</th></tr>`;
  const body=rows.map(r=>
    `<tr class="${r.me?"me":""}"><td class="rk">${r.rank}<small>位</small></td>`+
    `<td class="nm">${r.me?"★ ":""}${r.name}</td>`+
    r.sc.map(v=>`<td class="${v>=90?"hi":v<40?"lo":""}">${v}</td>`).join("")+
    `<td class="to">${r.tot}</td></tr>`).join("");
  showBoard(`<div class="bdT">\ud83d\udccb ${ev.n}　成績上位者</div>`+
    `<table class="bdTbl">${head}${body}</table>`+
    `<div class="bdN">${yr}年目・学年240人中　あなたは <b>${me.rank}位</b>`+
    `（合計 ${me.tot}点／平均 ${Math.round(me.tot/5)}点）`+
    `${yr>1?`　<i>※${yr}年目はまわりも伸びています（同じ順位に必要な学力 ${examBar(yr).toFixed(2)}倍）</i>`:""}</div>`);
  return me;
}
function showBoard(html){
  const b=$("board"); if(!b)return;
  b.innerHTML=html; b.style.display="block";
  b.style.removeProperty("--bdz");
  /* メッセージ枠の上までに収める。入りきらなければ、入るまで文字を縮める。
     （offsetTop / offsetHeight は画面の拡大縮小がかかる前の値なので、そのまま比べられる） */
  const lim=$("vnWin").offsetTop, top=b.offsetTop;
  const max=(lim>top+50)?(lim-top-6):Math.round($("stage").offsetHeight*0.6);
  b.style.maxHeight=max+"px";
  let z=1;
  while(b.scrollHeight>b.clientHeight+1 && z>0.58){
    z-=0.05; b.style.setProperty("--bdz", z.toFixed(2));
  }
}
function hideBoard(){const b=$("board"); if(b){b.style.display="none"; b.innerHTML="";}}

async function evExam(ev){
  const c=CAL[S.t], E=TXT.exam;
  say(`✦ <b>${ev.n}</b>（${c.m}/${c.d}）`,"ev");
  const board=examBoard(ev);
  say(`\u3010掲示板\u3011学年順位 <b>${board.rank}位</b>／240人中　合計 <b>${board.tot}点</b>`,"ev");
  /* 順位の言いまわしは、貼り出された順位そのものから決める（掲示板と必ず一致します） */
  const rank=examRankText(board.rank);
  say(fmt(E.result,{順位:rank}));
  S.stress=clamp(S.stress+rnd(8,14),0,100);
  const good=board.rank<=50, bad=board.rank>150;
  /* 優等生の子（p.cue==="top"）が、順位に反応する。
     男主人公なら天堂 玲奈、女主人公なら殿城 龍之介。いなければ飛ばします */
  const hon=Gcue("top");
  if(hon&&good){addAff(hon,40);line(hon,E.topGood);}
  else if(hon&&bad){addAff(hon,-20);line(hon,E.topBad);}
  /* いちばん好感度の高い子が、いまの間柄なりの反応をする（優等生が上のときは重ねない） */
  const top=topGirl(S.girls);
  if(top&&!(hon&&top.id===hon.id&&(good||bad))){
    const t=tierText(E.top,top);
    if(t){ vnFace(top, good?"happy":bad?"worry":"normal");
      tierPlay(good?t.good:bad?t.bad:(t.mid||t.good), top);
      top.last=S.t; }
  }
  drawStatus();await next("▶ 次の日へ");
  hideBoard();
}

async function evInvite(ev){
  const c=CAL[S.t], E=TXT.invite;
  say(`✦ <b>${ev.n}</b>（${c.m}/${c.d}）`,"ev");
  say(E.ask);
  const id=await choose([...S.girls.map(g=>({t:fmt(E.pickGirl,{名前:g.name}),v:g.id})),{t:E.pickAlone,v:null,gy:true}]);
  if(!id){
    say(E.alone);
    S.stress=clamp(S.stress-14,0,100);
    S.girls.forEach(g=>{if(g.aff>=500){say(fmt(E.aloneLonely,{名前:g.name}));addAff(g,-30);}});
    drawStatus();await next("▶ 次の日へ");return;
  }
  const g=G(id);
  if(g.aff<ev.need){
    line(g,E.refuse);
    say(E.refuseNarr);
    await next("▶ 次の日へ");return;
  }
  say(E.body[ev.n]||"");
  const bonus=(ev.pw+(matchScore(g)-45)+rnd(-20,20))*clamp(1-g.aff/1250,0.2,1);
  line(g,g.q.ok);
  addAff(g,bonus);g.last=S.t;
  S.girls.forEach(o=>{if(o!==g&&o.aff>=550){say(fmt(E.jealous,{名前:o.name}));addAff(o,-30);}});
  S.stress=clamp(S.stress-12,0,100);
  redraw();await next("▶ 次の日へ");
}


/* 練習試合の勝敗判定。数値を変えたいときはここ
   全力=ぶれ幅が大きい（格上に挑むとき有利）／組み立て=安定／支え=その中間 */
const MATCH_SWING=[20,13,16], MATCH_BONUS=[4,0,2];
function matchPower(idx){ return 16+idx*9; }        /* 相手の強さ 16 → 106。最後は最上級でも気が抜けない */
function matchJudge(prof,idx,sport,opt){
  const power=matchPower(idx);
  const score=prof+Math.min(10,sport/14)+MATCH_BONUS[opt]+rnd(-MATCH_SWING[opt],MATCH_SWING[opt]);
  return score>=power?"win":score>=power-10?"draw":"lose";
}
/* 文化祭の出し物の成否判定 */
function cultNeed(year){ return [26,52,74][clamp(year-1,0,2)]; }
function cultJudge(prof,year,art){
  const need=cultNeed(year);
  const score=prof+Math.min(12,art/16)+rnd(-10,10);   /* 芸術の効きすぎを防ぐため上限あり */
  return score>=need+16?"great":score>=need-8?"ok":"bad";
}
/* ---- 練習試合（運動部・年4回） ---- */
const MATCH_FOE=["となりの市立高校","去年の県大会ベスト8の高校","強豪と名高い私立高校",
                 "同じ地区の宿敵校","全国常連の強豪校"];
function matchIndex(){                    /* 何回目の試合か（0から） */
  const c=CAL[S.t];
  const order=[[1,6],[1,9],[1,12],[1,3],[2,6],[2,9],[2,12],[2,3],[3,6],[3,9],[3,12]];
  const i=order.findIndex(o=>o[0]===c.y&&o[1]===c.m);
  return i<0?0:i;
}
async function evMatch(ev){
  const c=CAL[S.t], E=TXT.match, C=CLUBS[S.club];
  const idx=matchIndex();
  const foe=MATCH_FOE[Math.min(MATCH_FOE.length-1,Math.floor(idx/2.4))];
  const power=matchPower(idx);
  const prof=profOf();
  say(fmt(E.head,{月:c.m,日:c.d,部活:C.n}),"ev");
  fmt(E.intro,{相手:foe,熟練度:profName(),熟練値:prof}).forEach(t=>say(t));
  say(prof>=power+8?E.moodHigh:prof>=power-12?E.moodMid:E.moodLow);
  const i=await choose(E.opts.map((o,j)=>({t:o,v:j})));
  se("page");
  say(E.optNarr[i]);
  const res=matchJudge(prof,idx,S.p.sport,i);
  rec("match",res==="win"?0:res==="draw"?1:2);
  await stamp(res==="win"?"great":res==="draw"?"ok":"fail");
  E[res].forEach(t=>say(t));
  const gain=res==="win"?6:res==="draw"?3:1.5;
  if(!S.prof)S.prof={};
  S.prof[S.club]=clamp((S.prof[S.club]||0)+gain,0,100);
  say(fmt(E.up,{熟練度:profName(),値:gain.toFixed(1)}));
  const mate=C.girl?G(C.girl):null;
  if(mate){ vnFace(mate,res==="win"?"happy":res==="draw"?"normal":"sad");
    line(mate,res==="win"?E.mateWin:res==="draw"?E.mateDraw:E.mateLose);
    mate.last=S.t; }
  redraw(); await next("▶ 次の日へ");
}

async function evCulture(ev){
  const c=CAL[S.t], E=TXT.culture;
  const home=(S.club==="none");
  const list=CULTURE[S.club]||CULTURE.none;
  const P0=list[clamp(c.y-1,0,list.length-1)];
  /* 文化祭の背景。assets/bg/culture<学年>.png（無ければ culture.png）を置いていれば
     それを使い、置いていなければ、いままでどおり出し物ごとの背景（P0.bg）です。 */
  const cbg=(EVBG.culture(c.y)||[]).slice(0,-1).find(bgHave) || P0.bg || "school";
  if(S.vnOn)vnBGset(cbg);
  vnFace(null);
  say(fmt(E.head,{月:c.m,日:c.d,年:c.y}),"ev");
  say(home?fmt(E.homeLine,{出し物:P0.n})
          :fmt(E.clubLine,{部活:CLUBS[S.club].n,語:S.club==="gov"?E.wordGov:E.wordClub,出し物:P0.n}),"ev");
  P0.b.forEach(t=>say(t));
  await next();

  /* 文化部（生徒会を含む）は、熟練度で出し物の成否が決まる */
  if(isCultureClub()){
    const R=TXT.cultresult, prof=profOf();
    say(fmt(R.intro,{熟練度:profName(),熟練値:prof}));
    const res=cultJudge(prof,c.y,S.p.art);
    rec("cult",res==="bad"?1:0);
    await stamp(res==="great"?"great":res==="ok"?"ok":"fail");
    ((res==="bad"&&c.y===3)?R.badLast:R[res]).forEach(t=>say(t));
    const gain=res==="great"?5:res==="ok"?3:1;
    if(!S.prof)S.prof={};
    S.prof[S.club]=clamp((S.prof[S.club]||0)+gain,0,100);
    say(fmt(R.up,{熟練度:profName(),値:gain.toFixed(1)}));
    drawStatus(); await next();
  }

  /* いちばん好感度の高い子 */
  const cand=S.girls.filter(g=>g.aff>=100).sort((a,b)=>b.aff-a.aff);
  const g=cand[0];
  if(!g){
    say(home?E.noneHome:E.noneClub);
    S.stress=clamp(S.stress-(home?14:8),0,100);
    drawStatus(); await next(); return;
  }
  se("heart");
  vnFace(g,"happy");
  say(fmt(home?E.visitHome:E.visitClub,{名前:g.name}));
  line(g,g.q.hi);
  const opts=home?E.optsHome:E.optsClub;
  const dd=home?[80,30,-20]:[90,60,-40];
  const i=await choose(opts.map((o,idx)=>({t:o.t,v:idx})));
  se("page");
  const d=dd[i];
  vnFace(g,d>=80?"blush":d>0?"happy":"sad");
  say(`「${d>0?g.q.ok:g.q.bad}」`);
  say(opts[i].r);
  addAff(g,d*clamp(1-g.aff/1250,0.2,1));
  g.last=S.t;
  S.stress=clamp(S.stress-(home?14:8),0,100);
  redraw(); await next();
}

/* =======================================================================
   バレンタイン と ホワイトデー
   ・主人公が「もらう側」か「渡す側」かで、中身がまるごと変わります。
     もらう側 … 仲のいい子ぜんぶがくれる（従来どおり）
     渡す側   … 渡せるのはひとりだけ。誰を選ぶかが、そのまま答えになる
   ・どちらになるかは assets/config.js の GAME_RULE.valentine で決まります。
       "auto"（既定）男性主人公はもらう側／女性主人公は渡す側
       "get"  いつももらう側 ／ "give" いつも渡す側
   ・ホワイトデーは、かならずバレンタインの逆になります。
   ・S.valen には「2月14日にやりとりした相手」が入り、3月14日が使います。
     もらう側 … くれた子ぜんぶ ／ 渡す側 … 渡した相手ひとり
   ======================================================================= */
function valenSide(){
  const r=(typeof GAME_RULE!=="undefined"&&GAME_RULE.valentine)||"auto";
  if(r==="get"||r==="give")return r;
  return (S.sex==="f")?"give":"get";
}
async function evValentine(){
  if(valenSide()==="give") await evValenGive();
  else                     await evValenGet();
}
async function evWhite(){
  if(valenSide()==="give") await evWhiteGet();   /* 渡した人は、もらう側 */
  else                     await evWhiteGive();
}

/* ---- バレンタイン：もらう側 -------------------------------------------
   ・「普通」の子はくれない
   ・「友達」「気になる人」は義理チョコ
   ・「好き」の子だけ本命チョコ
   誰が本命をくれたかは覚えておいて、ホワイトデーで使う。 */
async function evValenGet(){
  const E=TXT.valen;
  say(E.head,"ev");
  S.valen=[];
  const got=S.girls.filter(g=>affTier(g)!=="normal");
  if(!got.length){say(E.none);}
  else for(const g of got){
    const honmei=affTier(g)==="love";
    const H=honmei?E.honmei:E.giri;
    say(fmt(H.got,{名前:g.name}),"ev");
    if(honmei){ se("heart"); tierPlay(H,g,"blush"); }
    else       { tierPlay(tierText(H,g),g,"happy"); }
    g.last=S.t;
    S.valen.push({id:g.id,h:honmei});
  }
  S.stress=clamp(S.stress-8,0,100);
  redraw();await next("▶ 次の日へ");
}

/* ---- バレンタイン：渡す側 ---------------------------------------------
   渡せるのは、ひとりだけ。
   ・「ちゃんとしたチョコを買う」（リッチ度）か「手作りする」（気配り）
   ・相手の反応は、いまの間柄（普通／友達／気になる人／好き）で変わります
   ・「好き」の子に渡したときは本命あつかいで、ホワイトデーの返しも大きい
   ・渡さなかったときは、何も起きません（もらっていないので、下がりもしない） */
async function evValenGive(){
  const E=TXT.valenGive;
  say(E.head,"ev");
  S.valen=[];
  const list=S.girls.slice();
  if(!list.length){ say(E.none); await next("▶ 次の日へ"); return; }
  say(E.ask);
  const id=await choose([...list.map(g=>({t:fmt(E.pick,{名前:g.name}),v:g.id})),
                         {t:E.pickNone,v:null,gy:true}]);
  if(!id){ say(E.skip,"dn"); await next("▶ 次の日へ"); return; }
  const g=list.find(x=>x.id===id);
  const how=await choose([{t:E.opts[0],v:"buy"},{t:E.opts[1],v:"hand"}]);
  let mul=1;
  if(how==="buy"){
    if(S.p.rich<E.cost){ say(E.poor,"dn"); mul=0.5; }
    else { S.p.rich-=E.cost; say(E.buy); }
  }else{
    const q=S.p.care;
    say(q>=80?E.handGood:E.handPoor);
    mul = q>=150?1.25 : q>=80?1.0 : 0.6;
  }
  se("heart");
  /* ★ ここが「相手の好感度で反応が変わる」ところ。
     E.react の normal／friend／crush／love から、いまの間柄のものを選びます。 */
  const t=tierText(E.react,g);
  const d=tierPlay(t,g,affAtLeast(g,"crush")?"blush":"happy");
  if(d) addAff(g, d*(mul-1), true);       /* 上で基本ぶんは足りているので差ぶんだけ */
  g.last=S.t;
  const honmei=affTier(g)==="love";
  S.valen.push({id:g.id,h:honmei});
  S.stress=clamp(S.stress-8,0,100);
  redraw();await next("▶ 次の日へ");
}

/* ---- ホワイトデー：もらう側 -------------------------------------------
   2月14日に渡した相手が、お返しをくれます。
   ・くれるかどうかと、その言いかたは、いまの間柄で変わります
   ・「普通」の間柄なら、律儀に返ってくるだけ。「好き」なら待っていた側になる */
async function evWhiteGet(){
  const E=TXT.whiteGet;
  say(E.head,"ev");
  const raw=(S.valen||[]).map(v=>typeof v==="string"?{id:v,h:false}:v);
  const list=raw.map(v=>({g:G(v.id),h:!!v.h})).filter(x=>x.g);
  if(!list.length){ say(E.none); S.valen=[]; await next("▶ 次の日へ"); return; }
  for(const {g,h} of list){
    say(fmt(E.got,{名前:g.name}),"ev");
    se("heart");
    const t=tierText(E.react,g);
    const d=tierPlay(t,g,affAtLeast(g,"crush")?"blush":"happy");
    if(h&&d) addAff(g, E.honmeiBonus||0, true);
    g.last=S.t;
  }
  S.valen=[];
  S.stress=clamp(S.stress-8,0,100);
  redraw();await next("▶ 次の日へ");
}

/* =======================================================================
   修学旅行（2泊3日）
   1日目に相手を決めて、2日目まで同じ相手と行動する。
   「気になる人」「好き」の子は向こうから誘ってくる（断ることもできる）。
   ======================================================================= */

/* 誘ってくる子を1人えらぶ。「好き」は必ず、「気になる人」はときどき。 */
function tripInviter(){
  const cand=S.girls.filter(g=>affAtLeast(g,"crush"));
  const pr=x=>{const i=AFF_PRIORITY.indexOf(x);return i<0?99:i;};
  cand.sort((a,b)=>(b.aff-a.aff)||(pr(a.id)-pr(b.id)));
  for(const g of cand){
    if(affTier(g)==="love")return g;
    if(Math.random()<0.5)return g;        /* 「気になる人」は誘ってくることがある */
  }
  return null;
}
/* こちらから誘う。except は「さっき断った子」で、選べない */
async function tripAsk(E,except){
  const list=S.girls.filter(g=>!except||g.id!==except.id);
  const id=await choose([...list.map(g=>({t:fmt(E.pickGirl,{名前:g.name}),v:g.id})),
                         {t:fmt(E.pickAlone,{友達:E.friendName}),v:null,gy:true}]);
  if(!id)return null;
  const g=G(id);
  if(affTier(g)==="normal"){            /* まだ誘える仲ではない → 1人で回る */
    tierPlay(E.refuse,g,"worry");
    return null;
  }
  tierPlay(E.ok,g,"happy"); g.last=S.t;
  return g;
}

/* ---- 1日目 ---- */
async function evTrip1(){
  const E=TXT.trip;
  say(E.head1,"ev");
  say(E.intro);
  S.trip={who:null};
  let partner=null;
  const inv=tripInviter();
  if(inv){
    const tier=affTier(inv);
    const t=E.invited[tier]||E.invited.crush;
    se("heart"); vnFace(inv,tier==="love"?"blush":"worry");
    tierPlay(t,inv,tier==="love"?"blush":"worry");
    const ok=await choose([{t:E.yes,v:1,pk:true},{t:E.no,v:0,gy:true}]);
    if(ok){
      tierPlay((E.accepted||{})[tier],inv,"happy");
      inv.last=S.t; partner=inv;
    }else{
      tierPlay((E.declined||{})[tier],inv,"sad");
      partner=await tripAsk(E,inv);      /* 断った相手は選べない */
    }
  }else{
    say(E.ask);
    partner=await tripAsk(E,null);
  }
  /* 自由行動 1日目 */
  if(partner){
    S.trip.who=partner.id;
    tierPlay(tierText(E.day1,partner),partner,"happy");
    partner.last=S.t;
  }else{
    (E.aloneDay1||[]).forEach(s=>say(fmt(s,{友達:E.friendName})));
  }
  S.stress=clamp(S.stress-14,0,100);
  redraw(); await next();
  /* ---- 1日目の夜 ---- */
  await tripNight();
  redraw(); await next("▶ 次の日へ");
}

/* 夜。いちばん好感度が高く、かつ「好き」の子がいればその子と。いなければ同室の友達と */
async function tripNight(){
  const E=TXT.trip, N=E.night;
  const loves=S.girls.filter(g=>affTier(g)==="love");
  const g=topGirl(loves);
  say(N.head,"ev");
  if(!g){
    vnFace(null);
    (N.friends||[]).forEach(s=>say(fmt(s,{友達:E.friendName})));
    S.stress=clamp(S.stress-10,0,100);
    return;
  }
  se("heart");
  say(N.meet);
  vnFace(g,"blush");
  say(fmt(N.with,{名前:g.name}));
  const i=await choose(N.opts.map((o,idx)=>({t:o.t,v:idx})));
  const o=N.opts[i]||N.opts[0];
  say(o.r); addAff(g,o.d||100);
  tierPlay(N.after,g,"blush");
  g.last=S.t;
  S.stress=clamp(S.stress-16,0,100);
}

/* ---- 2日目 ---- */
async function evTrip2(){
  const E=TXT.trip;
  say(E.head2,"ev");
  const g=(S.trip&&S.trip.who)?G(S.trip.who):null;
  if(g){ tierPlay(tierText(E.day2,g),g,"happy"); g.last=S.t; }
  else  { (E.aloneDay2||[]).forEach(s=>say(fmt(s,{友達:E.friendName}))); }
  S.stress=clamp(S.stress-16,0,100);
  redraw(); await next("▶ 次の日へ");
}

/* ---- 3日目（帰り） ---- */
async function evTrip3(){
  const E=TXT.trip;
  say(E.head3,"ev");
  const g=(S.trip&&S.trip.who)?G(S.trip.who):null;
  if(g){ tierPlay(E.day3.with,g,"normal"); g.last=S.t; }
  else  { (E.day3.alone||[]).forEach(s=>say(fmt(s,{友達:E.friendName}))); }
  S.trip=null;
  S.stress=clamp(S.stress-8,0,100);
  redraw(); await next("▶ 次の日へ");
}


async function evBday(ev){
  const g=G(ev.who), E=TXT.bday;
  say(fmt(E.head,{名前:g.name}),"ev");
  if(g.aff<150){say(fmt(E.far,{名前:g.name}));
    await next("▶ 次の日へ");return;}
  se("heart");
  say(fmt(E.ask,{名前:g.name}));
  const opts=[{t:E.opts[0],v:"hand"},
              {t:E.opts[1],v:"buy"},
              {t:E.opts[2],v:"word"},
              {t:E.opts[3],v:null,gy:true}];
  const k=await choose(opts);
  if(k==="hand"){
    const q=S.p.care+S.p.art;
    const d=q>=200?140:q>=120?100:q>=60?60:20;
    say(q>=120?E.handGood:E.handPoor);
    line(g,q>=120?E.handLineGood:E.handLinePoor);
    addAff(g,d);
  }else if(k==="buy"){
    if(S.p.rich<30){say(E.buyPoor,"dn");addAff(g,-10);}
    else{S.p.rich-=30;
      const d=80+Math.min(80,S.p.trend/3);
      say(E.buyOk);
      line(g,E.buyLine);
      addAff(g,d);}
  }else if(k==="word"){
    say(E.word);
    line(g,E.wordLine);
    addAff(g,40);
  }else{
    say(E.nothing,"dn");
    addAff(g,-40);
  }
  g.last=S.t;
  redraw();await next("▶ 次の日へ");
}

async function evMyBday(){
  const E=TXT.mybday;
  say(E.head,"ev");
  const got=S.girls.filter(g=>g.aff>=350);
  if(!got.length){say(E.none);}
  else{se("heart");
    for(const g of got){
      line(g,g.aff>=700?E.lineHigh:g.aff>=500?E.lineMid:E.lineLow);
      addAff(g,g.aff>=700?60:40);g.last=S.t;
    }}
  S.stress=clamp(S.stress-10,0,100);
  redraw();await next("▶ 次の日へ");
}

async function evSports(){
  const E=TXT.sports;
  say(E.head,"ev");
  say(E.intro);
  const k=await choose([{t:E.opts[0],v:"relay"},
                        {t:E.opts[1],v:"normal"},
                        {t:E.opts[2],v:"back"}]);
  const sp=S.p.sport;
  /* 運動部の子（p.cue==="sport"）がリレーの相方。
     男主人公なら夏川 ひなた、女主人公なら立花 大地。
     その札の子がいないデータでも落ちないように、居ないときは捨て先を用意する */
  const h=Gcue("sport")||{aff:0,last:0,name:"",id:"",q:{ok:"",bad:"",hi:""}};
  if(k==="relay"){
    if(sp>=150){se("great");say(E.relayWin[0],"ev");
      E.relayWin.slice(1).forEach(t=>say(t));
      S.girls.forEach(g=>addAff(g,g.aff>=200?50:20));
      addAff(h,60);}
    else{se("bad");say(E.relayLose[0],"dn");
      E.relayLose.slice(1).forEach(t=>say(t));
      addStress(18);addAff(h,-20);}
  }else if(k==="normal"){
    const g2=gainOf("sport",7,1.4);S.p.sport+=g2;
    say(fmt(E.normal,{値:g2.toFixed(1)}));
    addAff(h,30);
  }else{
    const g2=gainOf("care",8,1.4);S.p.care+=g2;
    say(fmt(E.back,{値:g2.toFixed(1)}));
    S.girls.forEach(g=>{if(g.aff>=250)addAff(g,20);});
  }
  h.last=S.t;
  redraw();await next("▶ 次の日へ");
}

async function evNewYear(){
  const E=TXT.newyear;
  say(E.head,"ev");
  say(E.intro);
  const id=await choose([...S.girls.map(g=>({t:fmt(E.pickGirl,{名前:g.name}),v:g.id})),{t:E.pickAlone,v:null,gy:true}]);
  if(!id){say(E.alone);
    S.stress=clamp(S.stress-20,0,100);S.p.rich=clamp(S.p.rich+40,0,999);
    say(E.otoshidama);
    redraw();await next("▶ 次の日へ");return;}
  const g=G(id);
  S.p.rich=clamp(S.p.rich+40,0,999);
  /* 「普通」の間柄なら、まだ一緒に初詣に行く仲ではない */
  if(affTier(g)==="normal"){line(g,E.refuse,"worry");await next("▶ 次の日へ");return;}
  se("heart");
  E.scene.forEach(t=>say(t));
  const luck=Math.random();
  if(luck<0.15){say(E.daikichi,"ev");addAff(g,120);}
  else if(luck<0.7){say(E.chukichi);addAff(g,80);}
  else{say(E.suekichi);addAff(g,70);}
  /* おみくじのあと、いまの間柄なりのやりとりがある */
  tierPlay(tierText(E.tier,g), g, affAtLeast(g,"crush")?"blush":"happy");
  g.last=S.t;
  S.stress=clamp(S.stress-16,0,100);
  redraw();await next("▶ 次の日へ");
}

/* ホワイトデー
   お返しは「ひとりだけ」。誰を選ぶかがそのまま答えになる。
   選ばれた子の反応は間柄で変わり、本命をくれた子は喜びが大きい。
   選ばれなかった子は、少しだけ気持ちが離れる。 */
/* ---- ホワイトデー：渡す側（従来どおり） ---- */
async function evWhiteGive(){
  const E=TXT.white;
  say(E.head,"ev");
  /* 古いセーブでは id の文字列だけが入っている */
  const raw=(S.valen||[]).map(v=>typeof v==="string"?{id:v,h:false}:v);
  const list=raw.map(v=>({g:G(v.id),h:!!v.h})).filter(x=>x.g);
  if(!list.length){say(E.none);
    S.valen=[]; await next("▶ 次の日へ");return;}
  say(fmt(E.ask,{面々:list.map(x=>x.g.name).join("、")}));
  const id=await choose([...list.map(x=>({t:fmt(E.pick,{名前:x.g.name}),v:x.g.id})),
                         {t:E.pickNone,v:null,gy:true}]);
  if(!id){
    say(E.skip,"dn");
    list.forEach(x=>addAff(x.g,x.h?-90:-50));
    S.valen=[]; redraw(); await next("▶ 次の日へ"); return;
  }
  const pick=list.find(x=>x.g.id===id), g=pick.g;
  const how=await choose([{t:E.opts[0],v:"buy"},{t:E.opts[1],v:"hand"}]);
  let mul=1;
  if(how==="buy"){
    if(S.p.rich<25){ say(E.poor,"dn"); mul=0.5; }
    else { S.p.rich-=25; say(E.buy); }
  }else{
    const q=S.p.care;
    say(q>=80?E.handGood:E.handPoor);
    mul = q>=150?1.25 : q>=80?1.0 : 0.6;
  }
  se("heart");
  const t=tierText(E.react,g);
  const d=tierPlay(t,g,affAtLeast(g,"crush")?"blush":"happy");
  /* 上の tierPlay ですでに基本ぶんを足しているので、差ぶんだけ調整する */
  if(d){ addAff(g, d*(mul-1) + (pick.h?E.honmeiBonus||0:0), true); }
  g.last=S.t;
  /* 選ばれなかった子 */
  const rest=list.filter(x=>x.g.id!==id);
  if(rest.length){
    say(fmt(E.others,{面々:rest.map(x=>x.g.name).join("、")}),"dn");
    rest.forEach(x=>addAff(x.g,x.h?-70:-30));
  }
  S.valen=[];
  redraw();await next("▶ 次の日へ");
}

async function evVac(ev){
  const v=vacOf(CAL[Math.min(S.t+1,LAST)])||vacOf(CAL[S.t]), E=TXT.vac;
  say(`✦ <b>${ev.n}</b>`,"ev");
  say(E[v]||E.other);
  S.stress=clamp(S.stress-18,0,100);
  say(E.relief);
  drawStatus();await next("▶ 次の日へ");
}

/* =======================================================================
   14. エンディング
   ======================================================================= */
async function ending(){
  await scene("sakura",endingScene);
}
async function endingScene(){
  const E=TXT.ending;
  evMark("sys_graduate");
  openMsg("卒業式");
  say(E.head,"ev");
  say(E.intro);
  await next();
  const cands=S.girls.filter(g=>g.aff>=600).sort((a,b)=>b.aff-a.aff);
  let target=null;
  if(cands.length){
    say(E.go);
    const id=await choose([...cands.map(g=>({t:fmt(E.pick,{名前:g.name}),v:g.id,pk:true})),{t:E.pickNone,v:null,gy:true}]);
    target=id?G(id):null;
    if(target)evMark("sys_confess");
  }else{say(E.nobody);await next();}
  await epilogue(target);
  evMark("sys_ending");
  /* 会話画面から結果の画面へも、幕を下ろしてから切りかえます */
  /* 会話画面の上に結果の画面が重なるので、結果のほうをうっすらから出します */
  await fadeIn("ending", ()=>{ finish(target); });
}

/* =======================================================================
   エピローグ
   ・3年間のふりかえり（実際の遊びかたを見て文章をえらぶ）
   ・登場した子それぞれの、卒業後
   ・主人公自身のこれから
   ======================================================================= */
/* 結ばれた相手は lover。ほかの子は、そのときの間柄でわける */
const afterKey=(g,lover)=>(lover&&g.id===lover.id)?"lover":affTier(g);

async function epilogue(lover){
  const E=TXT.epi, R=S.rec||recInit();
  evMark("sys_epilogue");
  vnBGset("sunset"); vnFace(null);
  say(E.head,"ev");
  E.open.forEach(t=>say(t));
  await next();

  /* ---- いちばん多かった過ごしかた ---- */
  const cmd=R.cmd||{};
  let topCmd=null, topN=0;
  for(const k in cmd) if(cmd[k]>topN){topN=cmd[k];topCmd=k;}
  if(topCmd&&E.spent[topCmd])say(fmt(E.spent[topCmd],{回数:topN}));

  /* ---- いちばん高かったパラメータ ---- */
  let topP=null, topV=-1;
  for(const k in S.p) if(E.best[k]&&S.p[k]>topV){topV=S.p[k];topP=k;}
  if(topP)say(fmt(E.best[topP],{値:Math.round(topV)}));
  await next();

  /* ---- 部活とバイトと体調 ---- */
  vnBGset(S.club==="none"?"room":(CLUBS[S.club].bg||"ground"));
  if(S.club==="none")say(E.club.none);
  else{
    const pv=profOf();
    say(fmt(E.club[pv>=70?"high":pv>=35?"mid":"low"],
      {部活:CLUBS[S.club].n,熟練度:profName(),熟練値:pv}));
    const m=R.match||[0,0,0];
    if(m[0]+m[1]+m[2]>0) say(fmt(E.match[m[0]>=m[2]?"win":"lose"],{勝:m[0],負:m[2]}));
    const c=R.cult||[0,0];
    if(c[0]+c[1]>0) say(c[1]?E.cult.ng:fmt(E.cult.ok,{成功:c[0]}));
  }
  if(S.job&&JOBS[S.job])say(fmt(E.job,{バイト:JOBS[S.job].n}));
  say(R.cold?fmt(E.cold,{回数:R.cold}):E.fine);
  await next();

  /* ---- 人との関わり ---- */
  vnBGset("town");
  say(S.girls.length>3?fmt(E.met.more,{人数:S.girls.length}):E.met.three);
  const sum=o=>Object.keys(o||{}).reduce((a,k)=>a+o[k],0);
  const dn=sum(R.date);
  say(dn===0?E.date.none:fmt(E.date[dn>=12?"many":"few"],{回数:dn}));
  if(R.great)say(fmt(E.great,{回数:R.great}));
  const tn=sum(R.tel);
  if(tn)say(fmt(E.tel,{回数:tn}));
  await next();

  /* ---- しめくくり ---- */
  vnBGset("sakura");
  if(lover){ vnFace(lover,"blush"); se("heart");
    fmt(E.closeWith,{名前:lover.name}).forEach(t=>say(t)); }
  else { vnFace(null); E.closeSolo.forEach(t=>say(t)); }
  await next();

  /* ---- それぞれの、これから ---- */
  vnFace(null); vnBGset("school");
  say(E.afterHead,"ev");
  await next();
  /* 好感度の高い順。結ばれた相手はいちばん最後にする */
  const list=[...S.girls].sort((a,b)=>{
    if(lover){ if(a.id===lover.id)return 1; if(b.id===lover.id)return -1; }
    return b.aff-a.aff;
  });
  for(const g of list){
    const st=(typeof STORY!=="undefined")&&STORY[g.id];
    const key=afterKey(g,lover);
    const lines=st&&st.after&&(st.after[key]||st.after.normal);
    if(!lines||!lines.length)continue;
    vnFace(g, key==="lover"?"blush" : key==="love"?"sad" : key==="crush"?"normal":"happy");
    /* ここは主人公がその子の卒業後を語る場面なので、名前欄は主人公になります
       （say() が行ごとに決めます） */
    lines.forEach(t=>say(t));
    await next();
  }

  /* ---- 主人公のこれから ---- */
  vnFace(null); vnBGset("sunset");
  if(topP&&E.me[topP]) fmt(E.me[topP],{名前:S.name}).forEach(t=>say(t));
  await next();
  E.last.forEach(t=>say(t));
  await next("▶ 結果を見る");
}
function finish(g){
  const E=TXT.ending, para=a=>a.map(x=>`<p>${x}</p>`).join("");
  let ttl,exp="normal",body;
  if(!g){
    ttl=E.solo.t; body=para(E.solo.b);
  }else if(g.aff>=780){
    ttl=fmt(E.trueEnd.t,{名前:g.name});exp="blush";
    body=para(fmt(E.trueEnd.b,{名前:g.name,告白:E.trueEnd.line[g.id]||""}));
  }else if(g.aff>=680){
    ttl=fmt(E.happy.t,{名前:g.name});exp="happy";
    body=para(fmt(E.happy.b,{名前:g.name}));
  }else{
    ttl=fmt(E.friend.t,{名前:g.name});exp="sad";
    body=para(fmt(E.friend.b,{名前:g.name}));
  }
  if(g)galEnd(g.id, g.aff>=780?3:g.aff>=680?2:1);
  const rank=[...S.girls].sort((a,b)=>b.aff-a.aff).map(x=>
    `<tr><td style="padding:2px 14px 2px 0">${x.name}</td><td>${hearts(x.aff)}</td><td style="padding-left:10px">${Math.round(x.aff)}</td></tr>`).join("");
  $("ending").innerHTML=`
    <div style="font-size:30px;font-weight:900;color:#c2306a;text-shadow:2px 2px 0 #fff,0 2px 8px rgba(0,0,0,.15)">${ttl}</div>
    <div style="display:flex;gap:20px;align-items:flex-start;max-width:900px;text-align:left;background:rgba(255,255,255,.8);border:2px solid #f0b6c9;border-radius:14px;padding:16px">
      <div style="width:200px;flex:0 0 auto;border-radius:10px;overflow:hidden">${g?portrait(g,exp):""}</div>
      <div style="flex:1;font-size:14.5px;line-height:1.95;color:#5a4650">${body}
        <table style="margin-top:12px;font-size:13px">${rank}</table>
        <div style="margin-top:6px;font-size:12.5px;color:#8a7a68">最終パラメータ：${Object.keys(P).map(k=>P[k].replace(/\s/g,"")+" "+Math.round(S.p[k])).join(" / ")}${S.club==="none"?"":" / "+profName()+" "+profOf()}</div>
      </div>
    </div>
    <button class="btn pk" style="font-size:16px;padding:11px 26px" onclick="location.reload()">もう一度、入学する</button>
    <button class="btn gy" style="font-size:15px;padding:11px 22px;margin-left:8px" onclick="S.gen++;S.inGame=false;goTitle();">タイトルへ</button>`;
  $("ending").style.display="flex";
}


/* ---- オプション（タイトルからもゲーム中からも） ---- */
function optionsMenu(inGame){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="620px"; modalFull(true);
    /* タイトルから開いたときだけ、閉じるときに幕を下ろします */
    /* 窓は下の画面の上に重なるので、**窓のほうを**うすくしながら消します */
    const close=async()=>{
      await fadeOut(M,()=>{ M.style.display="none";modalFull(false);M.style.width="640px"; });
      saveOpt(); resolve();
    };
    const render=()=>{
      $("modTtl").textContent="オプション";
      $("modBody").innerHTML=`
        <div class="cfgrow"><span class="cl">BGMの音量</span>
          <input type="range" class="vsl" id="vBgm" min="0" max="100" value="${Math.round(AU.bgmVol*100)}">
          <span class="vnum" id="vBgmN">${Math.round(AU.bgmVol*100)}</span></div>
        <div class="cfgrow"><span class="cl">効果音の音量</span>
          <input type="range" class="vsl" id="vSe" min="0" max="100" value="${Math.round(AU.seVol*100)}">
          <span class="vnum" id="vSeN">${Math.round(AU.seVol*100)}</span></div>
        <div class="cfgrow"><span class="cl">音ぜんたい</span>
          <span class="chips">
            <span class="chip ${AU.on?"on":""}" data-c="snd:1">🔊 ならす</span>
            <span class="chip ${AU.on?"":"on"}" data-c="snd:0">🔇 ならさない</span></span></div>
        <div class="cfgrow"><span class="cl">文字送りの速さ</span>
          <span class="chips">${TSPEEDS.map((t,i)=>`<span class="chip ${S.tspeed===i?"on":""}" data-c="tsp:${i}">${t.n}</span>`).join("")}</span></div>
        <div class="cfgrow"><span class="cl">進行のはやさ</span>
          <span class="chips">${SPEEDS.map((sp,i)=>`<span class="chip ${S.speed===i?"on":""}" data-c="spd:${i}">${sp.n}</span>`).join("")}</span></div>
        <div class="cfgrow"><span class="cl">背景の切りかえ</span>
          <span class="chips">${BGFADES.map((b,i)=>`<span class="chip ${S.bgfade===i?"on":""}" data-c="bgf:${i}">${b.n}</span>`).join("")}</span></div>
        ${inGame?`<div class="cfgrow"><span class="cl">バイト先</span>
          <span class="chips">${Object.keys(JOBS).map(k=>`<span class="chip ${S.job===k?"on":""}" data-c="job:${k}">${JOBS[k].g} ${JOBS[k].n}</span>`).join("")}</span></div>`:""}
        <div class="savenote">
          <b>文字送りの速さ</b>は会話シーンの表示速度です。「一瞬」で全文がすぐ出ます。表示中に画面を押すと最後まで飛ばせます。<br>
          <b>進行のはやさ</b>は1日ごとの判定演出のテンポです。<br>
          <b>背景の切りかえ</b>は、場面が変わるときに背景がじわっと入れかわる長さです。
          「なし」でいままでどおり一瞬で切りかわります（SKIP中はいつでも一瞬です）。</div>`;
      $("modBtns").innerHTML=`<button class="btn gy" data-c="test">音を試す</button>
        <button class="btn pk" data-c="close" style="margin-left:auto">閉じる</button>`;
      const bind=(id,nid,set)=>{const el=$(id);if(!el)return;
        el.oninput=()=>{const v=+el.value/100;set(v);$(nid).textContent=el.value;applyVol();};
        el.onchange=()=>{saveOpt();se("click");};};
      bind("vBgm","vBgmN",v=>AU.bgmVol=v);
      bind("vSe","vSeN",v=>AU.seVol=v);
      M.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{
        const [a,v]=b.dataset.c.split(":");
        if(a==="snd"){ if((v==="1")!==AU.on)audioToggle(); render(); }
        else if(a==="tsp"){ S.tspeed=+v; saveOpt(); se("click"); render(); }
        else if(a==="spd"){ S.speed=+v; saveOpt(); se("click"); render(); }
        else if(a==="bgf"){ S.bgfade=+v; saveOpt(); se("click"); render(); }
        else if(a==="job"){ S.job=v; se("click"); render(); redraw(); }
        else if(a==="test"){ se("great"); }
        else close();
      });
    };
    /* 窓は下の画面の上に重なるので、窓のほうをうっすらから出します */
    modalShow(()=>{ M.style.display="flex"; render(); });
  });
}
const settingsMenu=()=>optionsMenu(true);

/* ---- ちょっとした一覧を重ねて出す小窓（デバッグ用） ---- */
function closeAlertBox(){ const el=$("dbgBox"); if(el)el.style.display="none"; }
function alertBox(title,html){
  let el=$("dbgBox");
  if(!el){ el=document.createElement("div"); el.id="dbgBox"; $("stage").appendChild(el); }
  el.innerHTML=`<div class="dbgbT">${title}<span class="dbgbX">×</span></div>
    <div class="dbgbB">${html}</div>`;
  el.style.display="flex";
  el.querySelector(".dbgbX").onclick=()=>{el.style.display="none";};
}

/* ---- デバッグ ---- */
function debugMenu(){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="720px";
    const close=()=>{ fadeOut(M,()=>{M.style.display="none";M.style.width="640px";});
      closeAlertBox(); resolve(); };
    const render=()=>{
      const c=CAL[Math.min(S.t,LAST)];
      $("modTtl").textContent="🛠️ デバッグ";
      $("modBody").innerHTML=`
        <div class="dbgsec"><b>日付ジャンプ</b>　<span style="color:#8a7a68;font-size:11.5px">その週の月曜に飛びます</span>
          <div class="dbgline">
            <select id="dY">${[1,2,3].map(y=>`<option value="${y}" ${y===c.y?"selected":""}>${y}年目</option>`).join("")}</select>
            <select id="dM">${MORDER.map(m=>`<option value="${m}" ${m===c.m?"selected":""}>${m}月</option>`).join("")}</select>
            <select id="dD">${[...Array(31)].map((_,i)=>`<option value="${i+1}" ${i+1===c.d?"selected":""}>${i+1}日</option>`).join("")}</select>
            <button class="btn gy sm" data-d="jump">飛ぶ</button>
            <button class="btn gy sm" data-d="w1">＋1週</button>
            <button class="btn gy sm" data-d="w4">＋4週</button>
            <button class="btn gy sm" data-d="end">卒業直前へ</button>
          </div></div>
        <div class="dbgsec"><b>パラメータ</b>
          <div class="dbgline">
            ${Object.keys(P).map(k=>`<label class="dbgp">${P[k].replace(/\s/g,"")}<input type="number" id="dp_${k}" value="${Math.round(S.p[k])}" min="0" max="999"></label>`).join("")}
            <label class="dbgp">ストレス<input type="number" id="dp_stress" value="${Math.round(S.stress)}" min="0" max="100"></label>
          </div></div>
        <div class="dbgsec"><b>好感度</b>
          <div class="dbgline">
            ${S.girls.map(g=>`<label class="dbgp">${g.name.split(" ")[1]}<input type="number" id="da_${g.id}" value="${Math.round(g.aff)}" min="0" max="${MAXAFF}" step="10"></label>`).join("")}
          </div></div>
        <div class="dbgsec"><b>設定変更</b>
          <div class="dbgline">
            <label class="dbgp" style="width:130px">部活<select id="dClub">${Object.keys(CLUBS).map(k=>`<option value="${k}" ${S.club===k?"selected":""}>${CLUBS[k].n}</option>`).join("")}</select></label>
            <label class="dbgp" style="width:104px">${S.club==="none"?"熟練度（帰宅部）":profName()}<input type="number" id="dProf" value="${profOf()}" min="0" max="100" ${S.club==="none"?"disabled":""}></label>
            <label class="dbgp" style="width:96px">血液型<select id="dBlood">${Object.keys(BLOOD).map(k=>`<option value="${k}" ${S.blood===k?"selected":""}>${BLOOD[k].n}</option>`).join("")}</select></label>
            <button class="btn gy sm" data-d="max">全能力999</button>
            <button class="btn gy sm" data-d="love">全好感度100</button>
            <button class="btn gy sm" data-d="zero">ストレス0</button>
            <button class="btn gy sm" data-d="rich">お金+500</button>
            <button class="btn gy sm" data-d="ev">好感度イベント解除</button>
          </div></div>
        <div class="dbgsec"><b>登場キャラ</b>
          <span style="color:#8a7a68;font-size:11.5px">押すと、その子を出したり引っこめたりできます（かくれている3人もすぐ出せます）</span>
          <div class="dbgline">
            ${castOfSex().map(x=>{const on=!!G(x.id);
              return `<span class="chip sm ${on?"on":""}" data-d="girl:${x.id}">${on?"◉":"○"} ${x.name}</span>`;}).join("")}
            <button class="btn gy sm" data-d="gall">全員出す</button>
            <button class="btn gy sm" data-d="gmin">はじめの3人だけ</button>
          </div></div>

        <div class="dbgsec"><b>3年間の記録</b>
          <span style="color:#8a7a68;font-size:11.5px">称号やエピローグの判定に使われる数です</span>
          <div class="dbgline">
            <label class="dbgp" style="width:88px">おでかけ<input type="number" id="dr_date" value="${ttRec("date")}" min="0" max="999"></label>
            <label class="dbgp" style="width:88px">電話<input type="number" id="dr_tel" value="${ttRec("tel")}" min="0" max="999"></label>
            <label class="dbgp" style="width:100px">デート最高<input type="number" id="dr_great" value="${(S.rec&&S.rec.great)||0}" min="0" max="999"></label>
            <label class="dbgp" style="width:88px">風邪<input type="number" id="dr_cold" value="${(S.rec&&S.rec.cold)||0}" min="0" max="99"></label>
            <label class="dbgp" style="width:100px">勉強コマンド<input type="number" id="dr_study" value="${ttCmd("study")}" min="0" max="999"></label>
          </div>
          <div class="dbgline">
            <label class="dbgp" style="width:76px">試合 勝<input type="number" id="dr_w" value="${ttRecN("match",0)}" min="0" max="99"></label>
            <label class="dbgp" style="width:76px">試合 分<input type="number" id="dr_d" value="${ttRecN("match",1)}" min="0" max="99"></label>
            <label class="dbgp" style="width:76px">試合 負<input type="number" id="dr_l" value="${ttRecN("match",2)}" min="0" max="99"></label>
            <label class="dbgp" style="width:96px">文化祭 成功<input type="number" id="dr_c0" value="${ttRecN("cult",0)}" min="0" max="9"></label>
            <label class="dbgp" style="width:96px">文化祭 失敗<input type="number" id="dr_c1" value="${ttRecN("cult",1)}" min="0" max="9"></label>
            <button class="btn gy sm" data-d="reczero">記録を全部0に</button>
          </div></div>

        <div class="dbgsec"><b>称号</b>
          <span style="color:#8a7a68;font-size:11.5px">
            いまの校内評価：<b>${ttName(titleNow())}</b>　／
            集めた数：<b>${TITLES.filter(t=>GAL.tt[t.id]).length} / ${TITLES.length}</b></span>
          <div class="dbgline">
            <button class="btn gy sm" data-d="ttall">全部取得したことにする</button>
            <button class="btn gy sm" data-d="ttnone">取得記録を全部消す</button>
            <button class="btn gy sm" data-d="ttnow">いま取れるぶんだけ記録</button>
            <button class="btn gy sm" data-d="ttlist">いま取れるものを見る</button>
          </div></div>

        <div class="dbgsec"><b>イベントID</b>
          <span style="color:#8a7a68;font-size:11.5px">
            イベントひとつずつに固有のIDが付いています（一覧は <b>イベント一覧.md</b>）。
            見た：<b>${evList().filter(e=>e.seen).length} / ${evList().length}</b>　／
            いま条件を満たしている：<b>${evList().filter(e=>e.ready).length}</b></span>
          <div class="dbgline">
            <button class="btn gy sm" data-d="evidseen">見たイベントを見る</button>
            <button class="btn gy sm" data-d="evidready">いま起きるものを見る</button>
            <button class="btn gy sm" data-d="evidall">ぜんぶ見る</button>
            <button class="btn gy sm" data-d="evidnone">「見た」の記録を消す</button>
          </div></div>

        <div class="dbgsec"><b>イベントをその場で見る</b>
          <div class="dbgline">
            <label class="dbgp" style="width:210px">固定イベント<select id="dEv">
              ${FIXED.map((e,i)=>`<option value="${i}">${e.m}/${e.d}${e.y?`（${e.y}年目）`:""}　${e.n}</option>`).join("")}
            </select></label>
            <button class="btn pk sm" data-d="evnow">このイベントを見る</button>
            <button class="btn gy sm" data-d="datenow">おでかけに誘う</button>
            <button class="btn gy sm" data-d="telnow">電話する</button>
            <button class="btn gy sm" data-d="boardnow">テストの掲示板だけ出す</button>
          </div>
          <div style="color:#8a7a68;font-size:11.5px;margin-top:4px">
            テストの点は学年で変わります。いまは<b>${examYear()}年目</b>（同じ順位に必要な学力 ${examBar().toFixed(2)}倍）。
            <span style="margin-left:8px">必要な学力のめやす：
              1位 <b>${examNeed(1)}</b>／10位以内 <b>${examNeed(10)}</b>／50位以内 <b>${examNeed(50)}</b>／平均 <b>${examNeed(150)}</b></span></div>
        </div>

        <div class="dbgsec"><b>おまけ（シーン鑑賞・エンディング）</b>
          <span style="color:#8a7a68;font-size:11.5px">解放 ${Object.keys(GAL.sc).length} 件／エンディング ${Object.keys(GAL.end).length} 人</span>
          <div class="dbgline">
            <button class="btn gy sm" data-d="galall">シーンを全部解放</button>
            <button class="btn gy sm" data-d="galend">エンディングを全部解放</button>
            <button class="btn gy sm" data-d="galnone">おまけの記録を全部消す</button>
          </div></div>

        <div class="dbgsec"><b>主人公</b>
          <div class="dbgline">
            <label class="dbgp" style="width:96px">みょうじ<input type="text" id="dSei" value="${S.sei}" maxlength="6"></label>
            <label class="dbgp" style="width:96px">なまえ<input type="text" id="dMei" value="${S.mei}" maxlength="6"></label>
            <label class="dbgp" style="width:78px">誕生月<select id="dBm">
              ${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${i+1===S.bd.m?"selected":""}>${i+1}月</option>`).join("")}</select></label>
            <label class="dbgp" style="width:78px">誕生日<select id="dBd">
              ${[...Array(31)].map((_,i)=>`<option value="${i+1}" ${i+1===S.bd.d?"selected":""}>${i+1}日</option>`).join("")}</select></label>
            <span class="dbgnote">星座：<b>${zodiacOf(S.bd.m,S.bd.d).g} ${zodiacOf(S.bd.m,S.bd.d).n}</b>
              （${P[zodiacOf(S.bd.m,S.bd.d).up].replace(/\s/g,"")}＋${zodiacOf(S.bd.m,S.bd.d).v}）</span>
          </div></div>

        <div class="dbgsec"><b>今週のまとめ</b>
          <span style="color:#8a7a68;font-size:11.5px">週の終わりに、その週で変わったステータスを並べて出します（ふだんは出しません）</span>
          <div class="dbgline">
            <span class="chips">
              <span class="chip sm ${DBG_WEEKSUM?"on":""}" data-d="wsum:1">出す</span>
              <span class="chip sm ${DBG_WEEKSUM?"":"on"}" data-d="wsum:0">出さない</span>
            </span>
            <span class="dbgnote">この切りかえはブラウザに覚えさせます</span>
          </div></div>

        <div class="dbgsec"><b>タイトルの背景（季節）</b>
          <span style="color:#8a7a68;font-size:11.5px">
            ふだんは<b>最後にセーブした記録の季節</b>（オートセーブもふくむ／記録が無ければ春）。
            用意した絵をたしかめたいときは、ここで決めうちにできます
            ── いまは <b>${SEASONJA[lastSaveSeason()]}</b>${DBG_TSEASON?"（決めうち中）":""}</span>
          <div class="dbgline">
            <span class="chips">
              <span class="chip sm ${DBG_TSEASON?"":"on"}" data-d="tsn:">じどう</span>
              ${SEASONS.map(s=>`<span class="chip sm ${DBG_TSEASON===s?"on":""}" data-d="tsn:${s}">${SEASONJA[s]}</span>`).join("")}
            </span>
            <span class="dbgnote">絵が無い季節は title.png（それも無ければSVGの校門）になります</span>
          </div></div>

        <div class="dbgsec"><b>バイトの来客イベント</b>
          <span style="color:#8a7a68;font-size:11.5px">ふだんはバイト1回につき ${(JOBVISIT_DEF*100).toFixed(0)}%</span>
          <div class="dbgline">
            <label class="dbgp" style="width:92px">来客率（％）<input type="number" id="dJv" value="${+(JOBVISIT*100).toFixed(1)}" min="0" max="100" step="0.5"></label>
            <label class="dbgp" style="width:146px">来る子<select id="dJg">
              <option value="">ランダム（抽選）</option>
              ${S.girls.map(g=>`<option value="${g.id}">${g.name}</option>`).join("")}
            </select></label>
            <button class="btn gy sm" data-d="jv100">来客率100%</button>
            <button class="btn gy sm" data-d="jvdef">もとの${(JOBVISIT_DEF*100).toFixed(0)}%に戻す</button>
            <button class="btn pk sm" data-d="jvnow">いま来客イベントを見る</button>
          </div>
          <div style="color:#8a7a68;font-size:11.5px;margin-top:4px">
            バイト先は「${(JOBS[S.job]||JOBS.conv).n}」。来客率はセーブされません（ページを開き直すと${(JOBVISIT_DEF*100).toFixed(0)}%に戻ります）。</div>
        </div>`;
      $("modBtns").innerHTML=`<button class="btn pk" data-d="apply">この内容を反映</button>
        <button class="btn gy" data-d="close" style="margin-left:auto">閉じる</button>`;
      M.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>act(b.dataset.d));
    };
    const readAll=()=>{
      Object.keys(P).forEach(k=>{const v=+$("dp_"+k).value; if(!isNaN(v))S.p[k]=clamp(v,0,999);});
      const st=+$("dp_stress").value; if(!isNaN(st))S.stress=clamp(st,0,100);
      S.girls.forEach(g=>{const v=+$("da_"+g.id).value; if(!isNaN(v))g.aff=clamp(v,0,MAXAFF);});
      const cl=$("dClub").value;
      if($("dProf")&&!$("dProf").disabled&&S.club!=="none"){
        const pv=+$("dProf").value; if(!isNaN(pv)){ if(!S.prof)S.prof={}; S.prof[S.club]=clamp(pv,0,100); }
      }
      S.club=cl; S.blood=$("dBlood").value;
      if($("dJv")){const jv=+$("dJv").value; if(!isNaN(jv))JOBVISIT=clamp(jv,0,100)/100;}
      /* 3年間の記録。おでかけ・電話は「まとめて1人ぶん」として入れなおす */
      if($("dr_date")){
        if(!S.rec)S.rec=recInit();
        const num=(id,mx)=>{const v=+$(id).value; return isNaN(v)?0:clamp(Math.round(v),0,mx);};
        const first=(S.girls[0]&&S.girls[0].id)||"kanade";
        S.rec.date={[first]:num("dr_date",999)};
        S.rec.tel ={[first]:num("dr_tel",999)};
        S.rec.cmd =Object.assign({},S.rec.cmd,{study:num("dr_study",999)});
        S.rec.great=num("dr_great",999);
        S.rec.cold =num("dr_cold",99);
        S.rec.match=[num("dr_w",99),num("dr_d",99),num("dr_l",99)];
        S.rec.cult =[num("dr_c0",9),num("dr_c1",9)];
      }
      /* 主人公 */
      if($("dSei")){
        S.sei=($("dSei").value||"桜坂").trim()||"桜坂";
        S.mei=($("dMei").value||"優").trim()||"優";
        S.name=S.sei+" "+S.mei;
        const bm=+$("dBm").value, bd=+$("dBd").value;
        if(!isNaN(bm)&&!isNaN(bd))S.bd={m:bm,d:Math.min(bd,MLEN[bm])};
      }
    };
    const act=a=>{
      if(a==="close"){close();return;}
      if(a==="apply"){ readAll(); se("ok"); redraw(); toast("反映しました"); render(); return; }
      if(a==="max"){ Object.keys(P).forEach(k=>S.p[k]=999); render(); return; }
      if(a==="love"){ S.girls.forEach(g=>{g.aff=MAXAFF;g.last=S.t;}); render(); return; }
      if(a==="zero"){ S.stress=0; render(); return; }
      if(a.startsWith("wsum:")){ DBG_WEEKSUM=a.endsWith("1"); saveOpt(); se("click"); render(); return; }
      /* タイトルの背景の季節を決めうちにする（絵のたしかめ用。覚えさせません） */
      if(a.startsWith("tsn:")){
        DBG_TSEASON=a.slice(4)||null;
        $("titleBg").innerHTML=titleBgHTML();      /* いま出ているタイトルにもすぐ反映 */
        se("click"); render(); return;
      }
      if(a==="rich"){ S.p.rich=clamp(S.p.rich+500,0,999); render(); return; }
      if(a==="ev"){ S.ev={};
        for(const gid in AFF_EV)AFF_EV[gid].forEach((e,i)=>evReset("aff_"+gid+"_"+(i+1)));
        toast("好感度イベントをもう一度見られます"); return; }
      /* ---- 登場キャラ ---- */
      if(a.startsWith("girl:")){
        const id=a.slice(5), i=S.girls.findIndex(x=>x.id===id);
        if(i>=0){ if(S.girls.length<=1){toast("ひとりは残してください");return;} S.girls.splice(i,1); }
        else { const d=ALLG.find(x=>x.id===id); S.girls.push({...d,ideal:{...d.ideal},aff:d.aff,last:S.t}); }
        se("click"); redraw(); render(); return;
      }
      if(a==="gall"){ castOfSex().forEach(d=>{ if(!G(d.id))S.girls.push({...d,ideal:{...d.ideal},aff:d.aff,last:S.t}); });
        se("ok"); redraw(); render(); return; }
      if(a==="gmin"){ S.girls=S.girls.filter(x=>castNow().some(y=>y.id===x.id));
        castNow().forEach(d=>{ if(!G(d.id))S.girls.push({...d,ideal:{...d.ideal},aff:d.aff,last:S.t}); });
        se("ok"); redraw(); render(); return; }
      /* ---- 記録 ---- */
      if(a==="reczero"){ S.rec=recInit(); toast("記録を0にしました"); render(); return; }
      /* ---- 称号 ---- */
      if(a==="ttall"){ ((typeof ttListAll==="function")?ttListAll():TITLES).forEach(t=>GAL.tt[t.id]=1); galSave();
        toast("称号を全部取得ずみにしました"); render(); return; }
      if(a==="ttnone"){ GAL.tt={}; galSave(); toast("称号の記録を消しました"); render(); return; }
      if(a==="ttnow"){ const got=titleScan(true); galSave();
        toast(got.length?`${got.length}個ふえました`:"新しく取れるものはありません"); render(); return; }
      if(a==="ttlist"){
        const now=TITLES.filter(t=>titleOk(t));
        toast(`いま条件を満たしているのは ${now.length} 個`);
        alertBox("いま条件を満たしている称号",
          now.map(t=>`<div style="padding:1px 0">🏅 <b>${t.n}</b><span style="color:#8a7a68;font-size:11.5px">（${t.c}）${nm(t.d)}</span></div>`).join("")
          ||"<div>ひとつもありません</div>");
        return;
      }
      /* ---- イベントID ---- */
      if(a==="evidseen"||a==="evidready"||a==="evidall"){
        const mode=a.slice(4);
        const all=evList();
        const list=mode==="seen"?all.filter(e=>e.seen)
                 :mode==="ready"?all.filter(e=>e.ready):all;
        const ttl=mode==="seen"?"もう見たイベント"
                 :mode==="ready"?"いま条件を満たしているイベント":"イベント一覧";
        const g=id=>{const x=ALLG.find(y=>y.id===id);return x?x.name:"";};
        const kinds=[...new Set(list.map(e=>e.kind))];
        alertBox(`${ttl}（${list.length} 件）`,
          list.length?kinds.map(k=>
            `<div style="margin:5px 0 2px;font-weight:700">${k}</div>`+
            list.filter(e=>e.kind===k).map(e=>
              `<div style="padding:1px 0">${e.seen?"✓":e.ready?"▶":"・"}
                <b>${e.n}</b>
                <span style="color:#8a7a68;font-size:11.5px">
                  <code>${e.id}</code>${e.chara?"／"+g(e.chara):""}／${e.when}
                  ${e.seen?`／${e.day+1}日目に見た`:""}</span></div>`).join("")
          ).join(""):"<div>ひとつもありません</div>");
        return;
      }
      if(a==="evidnone"){ S.evseen={}; toast("「見た」の記録を消しました"); render(); return; }
      /* ---- おまけ ---- */
      if(a==="galall"){ galList().forEach(x=>GAL.sc[x.k]=1); galSave();
        toast("シーンを全部解放しました"); render(); return; }
      if(a==="galend"){ castGal().forEach(x=>GAL.end[x.id]=3); galSave();
        toast("エンディングを全部解放しました"); render(); return; }
      if(a==="galnone"){ GAL.sc={}; GAL.end={}; galSave();
        toast("おまけの記録を消しました"); render(); return; }
      /* ---- イベントをその場で見る ---- */
      if(a==="boardnow"){ readAll(); redraw();
        if(!S.vnOn){ S.vnOn=true; fadeIn("vn",()=>{ $("vn").style.display="block";
          $("vnBg").innerHTML=BG.klass(); }); }
        else fadeStop("vn");
        M.style.display="none";
        examBoard({n:`テスト（${examYear()}年目）`});
        const off=()=>{ hideBoard(); $("vn").removeEventListener("click",off);
          if(!S.inGame||!S.busy){ vnClose(); }
          M.style.display="flex"; M.style.width="720px"; render(); };
        $("vn").addEventListener("click",off,{once:true});
        toast("画面を押すと閉じます");
        return;
      }
      if(a==="evnow"||a==="datenow"||a==="telnow"){
        readAll(); redraw();
        let fn=null, bg="klass", label="";
        if(a==="datenow"){ fn=dateFlow; bg="town"; label="おでかけ"; }
        else if(a==="telnow"){ fn=telFlow; bg="room"; label="電話"; }
        else {
          const ev=FIXED[+$("dEv").value];
          if(!ev){ toast("イベントが選ばれていません"); return; }
          if(ev.id==="bday"&&!G(ev.who)){ toast(`${ev.n}：その子がまだ登場していません`); return; }
          if(ev.id==="match"&&!isSportsClub()){ toast("練習試合は運動部のときだけ見られます"); return; }
          fn=()=>runFixed(ev); bg=evBg(ev); label=ev.n;
        }
        se("ok"); M.style.display="none";
        (async()=>{
          try{ await scene(bg,async()=>{ await fn(); }); }catch(e){ toast("途中で止まりました"); }
          redraw(); M.style.display="flex"; M.style.width="720px"; render();
          toast(label+" を見おわりました");
        })();
        return;
      }
      if(a==="jv100"){ readAll(); JOBVISIT=1; render(); toast("バイトのたびに必ず来ます"); return; }
      if(a==="jvdef"){ readAll(); JOBVISIT=JOBVISIT_DEF; render(); return; }
      if(a==="jvnow"){
        const sel=$("dJg").value;
        readAll();
        const gid=sel||pickVisitor();
        if(!gid||!G(gid)){ toast("来られる子がいません（好感度50以上の子が必要）"); return; }
        se("ok");
        M.style.display="none";
        (async()=>{
          const J=JOBS[S.job]||JOBS.conv;
          await scene(J.bg,()=>jobVisit(gid));
          redraw(); M.style.display="flex"; M.style.width="720px"; render();
        })();
        return;
      }
      // 日付移動
      readAll();
      let t=S.t;
      if(a==="jump"){ const g=gidx(+$("dY").value,+$("dM").value,+$("dD").value)-4;
        if(g<0||g>LAST){ toast("その日は範囲外です"); return; } t=g; }
      else if(a==="w1") t=S.t+7;
      else if(a==="w4") t=S.t+28;
      else if(a==="end") t=LAST-13;
      t=clamp(t,0,LAST); t=t-(t%7);
      S.t=t;
      close();
      const d=snapshot(); restore(d);
      $("planner").style.display="none"; $("sunHint").style.display="none";
      closeMsg(); vnClose(); AU.cur=null; redraw();
      toast(`${CAL[S.t].y}年目 ${CAL[S.t].m}月${CAL[S.t].d}日へ`);
      main(true);
    };
    /* 窓は下の画面の上に重なるので、窓のほうをうっすらから出します */
    modalShow(()=>{ M.style.display="flex"; render(); });
  });
}

/* =======================================================================
   16. セーブ／ロード
   ======================================================================= */
const SAVEKEY="starmate_v1";
const SPEEDKEY="starmate_speed2";
const TSPEEDS=[{n:"一瞬",ms:0},{n:"はやい",ms:11},{n:"ふつう",ms:24},{n:"ゆっくり",ms:46}];
/* 背景が切りかわるときのフェードの長さ（ミリ秒）。オプションで選べます */
const BGFADES=[{n:"なし",ms:0},{n:"はやい",ms:180},{n:"ふつう",ms:360},{n:"ゆっくり",ms:700}];
const SPEEDS=[{n:"一瞬",m:0.02},{n:"はやい",m:0.55},{n:"ふつう",m:1},{n:"じっくり",m:1.6},{n:"クリックで送る",m:0}];

/* =======================================================================
   画面の切りかえ（クロスフェード）

   黒い幕ははさみません。背景が切りかわるときと同じ見えかたにします。
   やっていることは1つだけ——
     **上に重なっているほうの画面だけを、うっすら ⇄ はっきり させる。**
   下の画面はずっと見えているので、すっと入れかわって見えます。

     出てくる画面が上に来るとき（タイトル・窓・エンディング）→ fadeIn()
     消える画面が上にあるとき（はじめから画面・会話画面・窓）  → fadeOut()

   長さは オプションの「背景の切りかえ」（S.bgfade）と同じ。
   「なし」を選んでいるときと、SKIP中は、すぐ切りかわります。

   ★ 途中で別の切りかえが始まったときのために、要素ごとに番号を持たせて
     います（fadeTok）。古いほうは、そこで手を引きます。
     これが無いと「消しかけていたものを、あとから消してしまう」ことがあります。
   ======================================================================= */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* 2回ぶん描画を待つ（そうしないと transition が効かないことがあります） */
const raf2=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
function scrMs(){ if(SKIPON)return 0; const b=BGFADES[S.bgfade]; return (b&&b.ms)||0; }
const FADE=new WeakMap();
function fadeTok(el){ const n=(FADE.get(el)||0)+1; FADE.set(el,n); return n; }
const fadeEl=el=>(typeof el==="string")?$(el):el;
/* 出てくる画面を、うっすら → はっきり。show() で出してから始めます。
   ★ 返り値は「最後までやりきったか」です。false は、**途中でべつの切りかえに
     追いこされた**という意味。あとしまつ（下の画面を片づけるなど）は、
     かならず true のときだけにしてください。
     （false なのに片づけると、新しい切りかえの下の画面まで消してしまい、
       まっさらな画面から動かせなくなります） */
async function fadeIn(el,show){
  el=fadeEl(el);
  const ms=scrMs(), my=el?fadeTok(el):0;
  if(show)show();
  if(!el)return true;
  /* 消えかけていたものを出しなおすことがあるので、押せない状態を先に戻します
     （ここを忘れると、出ているのに押せない窓ができます） */
  el.style.pointerEvents="";
  if(ms<=0){ el.style.transition=""; el.style.opacity=""; return true; }
  el.style.transition="none"; el.style.opacity="0";
  await raf2();
  if(FADE.get(el)!==my)return false;
  el.style.transition="opacity "+ms+"ms linear";
  el.style.opacity="1";
  await sleep(ms);
  if(FADE.get(el)!==my)return false;
  el.style.transition=""; el.style.opacity="";
  return true;
}
/* 消える画面を、はっきり → うっすら。消えきってから hide() を呼びます。
   返り値の意味は fadeIn と同じです。 */
async function fadeOut(el,hide){
  el=fadeEl(el);
  const ms=scrMs(), my=el?fadeTok(el):0;
  if(!el||ms<=0){ if(hide)hide();
    if(el){el.style.transition="";el.style.opacity="";el.style.pointerEvents="";} return true; }
  el.style.transition="opacity "+ms+"ms linear";
  el.style.opacity="0"; el.style.pointerEvents="none";
  await sleep(ms);
  if(FADE.get(el)!==my)return false;   /* 途中でまた出されたら、消さない */
  if(hide)hide();
  el.style.transition=""; el.style.opacity=""; el.style.pointerEvents="";
  return true;
}
/* ---- 立ち絵と顔の絵を、じわっと出し入れする --------------------------
   ・はじめて出すとき     … まるごとフェードイン
   ・べつの絵に入れかえる … 古い絵を「幽霊」として上に重ね、うすくして捨てる
       （新しい絵を 0 から出すだけだと、入れかわる一瞬うしろが見えて
         「まばたき」になってしまいます）
   ・消すとき             … うすくしてから消す

   key は「その絵の見わけ」です。前と同じなら、描きなおしません
   （同じ表情のまま何度も呼ばれることがあるので、ちらつき防止にもなります）。
   hide は、消えきったあとにやること（顔枠の .on を外す、など）。

   ★★ 「まだ画面に出ていない絵」は、けっして幽霊にしないこと ★★
     ひと続きの処理の中で、絵を2回つづけて指定することがあります。
       例）待ち合わせ場所で vnFace(g,"normal") → すぐ line(g,"…","sad")
     このとき最初の normal は**一度も画面に出ないまま**入れかわります。
     それを幽霊にしてしまうと、「出るはずのなかった顔」が一瞬見えてしまいます。
     そこで、絵を置いてから2コマぶんは「まだ出ていない」しるし（ARTPEND）を
     付けておき、そのあいだの差しかえは、だまって入れかえます。 */
const ARTPEND=new WeakMap();
/* 「まだ画面に出ていない」しるしを付け、2コマ後に外す */
function artSeen(el){
  ARTPEND.set(el,true);
  raf2().then(()=>{ ARTPEND.set(el,false); });
}
/* まちぼうけの番号。新しい指示が来たら、待っていた古いものは取り消します */
const ARTLATE=new WeakMap();
function artStop(el){ ARTLATE.set(el,(ARTLATE.get(el)||0)+1); }
/* 背景が切りかわりきるのを待ってから出す絵（立ち絵と、メッセージ枠の顔） */
const artWaits=el=>(el.id==="vnChar"||el.id==="vnFaceWin");
/* 絵を入れかえる。
   ★ 背景が切りかわっている最中に立ち絵や顔を出そうとしたときは、
     背景が出きるまで待ってから出します（VN_UI.charAfterBg）。
     消すとき（key が空）は待たずに、すぐ消します。 */
function artSet(el,html,key,hide){
  el=fadeEl(el); if(!el)return;
  const wait=key ? bgWaitMs() : 0;
  if(wait>0 && artWaits(el)){
    artStop(el);
    const my=ARTLATE.get(el);
    setTimeout(()=>{ if(ARTLATE.get(el)===my) artSetNow(el,html,key,hide); }, wait);
    return;
  }
  artStop(el);                 /* 待っていたものがあれば、取り消す */
  artSetNow(el,html,key,hide);
}
function artSetNow(el,html,key,hide){
  const now=el.dataset.artk||"";
  key=key||"";
  if(now===key)return;
  const ms=scrMs(), had=(now!=="");
  const unseen=(ARTPEND.get(el)===true);     /* まだ一度も画面に出ていない絵か */
  el.dataset.artk=key;
  if(!key){                                  /* 消す */
    if(ms<=0||!had||unseen){
      fadeStop(el); el.innerHTML=""; ARTPEND.set(el,false);
      if(hide)hide(); return; }
    fadeOut(el,()=>{ el.innerHTML=""; if(hide)hide(); });
    return;
  }
  if(unseen){
    /* まだ出ていない絵なので、だまって入れかえます。
       すでに幽霊（ひとつ前の、ちゃんと出ていた絵）がいるときは、そのまま残します */
    const g0=el.querySelector(".ghost");
    el.innerHTML=html;
    if(g0)el.appendChild(g0);
    artSeen(el);
    return;
  }
  if(!had){                                  /* はじめて出す */
    el.innerHTML=html; artSeen(el);
    if(ms>0)fadeIn(el); else fadeStop(el);
    return;
  }
  if(ms<=0){ fadeStop(el); el.innerHTML=html; return; }
  /* 入れかえ。古い中身を「幽霊」にして、新しい絵の上に重ねる。
     ★ 幽霊は position:absolute で重ねるだけなので、
       絵の見た目の指定（CSS）は、いままでどおり効きます。 */
  fadeStop(el);                              /* 消えかけていたら、止めて出しなおす */
  const g=document.createElement("div");
  g.className="ghost"; g.innerHTML=el.innerHTML;
  el.innerHTML=html; el.appendChild(g);
  artSeen(el);
  g.style.transition="opacity "+ms+"ms linear";
  raf2().then(()=>{ g.style.opacity="0"; });
  setTimeout(()=>{ if(g.parentNode)g.parentNode.removeChild(g); }, ms+80);
}
/* 素材や設定を入れかえたら、これを呼んで「描きなおし」をさせます。
   立ち絵と顔の絵は、同じ絵なら描きなおさない作りなので、
   これが無いと差しかえた絵に切りかわりません（applyVnArt() が呼んでいます）。 */
let ARTGEN=0;
function artRefresh(){ ARTGEN++; }
/* 中身をすぐ空にする（フェードしません）。場面を開きなおすときなど */
function artClear(el){ el=fadeEl(el); if(!el)return;
  artStop(el);                 /* 背景待ちの絵があれば、取り消す */
  fadeStop(el); el.dataset.artk=""; el.innerHTML=""; ARTPEND.set(el,false); }
/* いま動いているフェードを打ち切って、はっきり見えている状態に戻す。
   上に別の画面がかぶさるので、下のフェードはもう要らない、というときに使います */
function fadeStop(el){
  el=fadeEl(el); if(!el)return;
  fadeTok(el);
  el.style.transition=""; el.style.opacity=""; el.style.pointerEvents="";
}
function loadSpeed(){ try{ const raw=localStorage.getItem(SPEEDKEY); if(raw===null)return;
  const v=+raw; if(Number.isInteger(v)&&v>=0&&v<SPEEDS.length)S.speed=v; }catch(e){} }
/* 時間がたつか、画面をクリックするまで待つ。
   ・SAVE/LOAD などのボタンを押したときは「送り」あつかいにしない
   ・待っているあいだにロードされたら打ち切って true（＝もう別のゲーム）を返す */
async function waitOrClick(ms){
  if(msgHasMore()) msgShowNext();
  await waitTyping();
  if(SKIPON)return false;
  const cgen=S.gen;
  return new Promise(res=>{
    let done=false, tm=null, watch=null;
    const off=()=>{ if(tm)clearTimeout(tm); if(watch)clearInterval(watch);
      document.removeEventListener("pointerdown",fin,true); };
    const fin=e=>{
      if(!mainPress(e))return;             /* 右クリックでは進めない */
      if(e&&e.target&&e.target.closest&&
         e.target.closest("button,[data-vb],#vnClose,.chip,.ic,select,input"))return;
      if(done)return; done=true; off(); res(false);
    };
    if(ms>0) tm=setTimeout(fin,ms);
    setTimeout(()=>{ if(!done)document.addEventListener("pointerdown",fin,true); },120);
    watch=setInterval(()=>{ if(!done&&cgen!==S.gen){done=true;off();res(true);} },80);
  });
}
let MEM=null, STORE_OK=true;
function storeGet(){
  try{ const v=localStorage.getItem(SAVEKEY); return v?JSON.parse(v):(MEM||{}); }
  catch(e){ STORE_OK=false; return MEM||{}; }
}
function storeSet(o){
  MEM=o;
  try{ localStorage.setItem(SAVEKEY,JSON.stringify(o)); return true; }
  catch(e){ STORE_OK=false; return false; }
}
function snapshot(){
  return {v:2, ts:Date.now(), name:S.name, sei:S.sei, mei:S.mei, sex:(S.sex==="f"?"f":"m"), t:S.t, p:{...S.p}, stress:S.stress,
    girls:S.girls.map(g=>({id:g.id,aff:g.aff,last:g.last})),
    club:S.club, job:S.job, blood:S.blood, bd:{...S.bd}, ev:{...S.ev}, evseen:{...(S.evseen||{})},
    valen:(S.valen||[]).slice(), lastPlan:(S.lastPlan||null), lastM:S.lastM,
    prof:{...(S.prof||{})}, trip:(S.trip?{...S.trip}:null), visit:{...(S.visit||{})},
    said:{...(S.said||{})}, rec:JSON.parse(JSON.stringify(S.rec||recInit())),
    /* 週の途中でも正しく再開できるように、その週の状態も持っておく */
    weekStart:S.weekStart, dayIdx:(S.dayIdx===undefined?null:S.dayIdx),
    plan:(S.plan||[]).slice(), res:(S.res||[]).map(r=>r?{...r}:null),
    weekStress0:S.weekStress0, weekP0:(S.weekP0?{...S.weekP0}:null), pre:(S.pre||null)};
}

/* ---- セーブデータを「あるべき形」にそろえる ----------------------------
   「ファイルから読み込む」では、外から持ってきた JSON をそのまま受けとります。
   手で書きかえたファイルや、途中で切れたファイルだと、配列のはずのところに
   文字や数値が入っていることがあり、そのままだとゲームが止まってしまいます。
   （きろく画面が開けなくなり、消すこともできなくなります）
   ここで型のちがうものを既定値に置きかえておきます。
   **正しいセーブデータは、なにも変わりません。** */
function saneSave(d){
  if(!d || typeof d!=="object" || Array.isArray(d)) return null;
  const isObj=v=>(v&&typeof v==="object"&&!Array.isArray(v));
  const fix6=v=>{ const a=Array.isArray(v)?v.slice(0,6):[];
    while(a.length<6)a.push(null); return a; };
  const o={...d};
  o.girls    = Array.isArray(d.girls)?d.girls.filter(isObj):[];
  o.plan     = fix6(d.plan);
  o.res      = fix6(d.res);
  o.valen    = Array.isArray(d.valen)?d.valen.slice():[];
  o.lastPlan = Array.isArray(d.lastPlan)?d.lastPlan.slice():null;
  /* ここは「ものの入れもの」なので、object 以外なら無かったことにする */
  ["p","ev","bd","prof","visit","said","rec","trip","pre"].forEach(k=>{
    if(d[k]!==undefined && d[k]!==null && !isObj(d[k])) delete o[k];
  });
  return o;
}

/* 好感度が0〜100だったころのセーブを、いまの0〜1000に読みかえる。
   v が 2 になる前のデータが対象。もとのデータはさわらず、写しを返す。 */
function migrateSave(d){
  d=saneSave(d);
  if(!d || (d.v||1)>=2) return d;
  return {...d, v:2,
    girls:(d.girls||[]).map(g=>({...g, aff:clamp((g.aff||0)*10,0,MAXAFF)}))};
}

function restore(d){
  d=migrateSave(d)||{};                /* 読めない形でも、初期値で始められるようにする */
  CEVN=0;                              /* 誕生日が変わると行事の行数も変わるので測りなおす */
  S.name=d.name||"桜坂 優";
  S.sei=d.sei||S.name.split(" ")[0]||"桜坂"; S.mei=d.mei||S.name.split(" ")[1]||"優"; S.t=clamp(d.t|0,0,LAST); S.p={...S.p,...(d.p||{})};
  S.stress=d.stress||0; S.club=d.club||"none"; S.job=d.job||null; S.blood=d.blood||"A";
  S.bd=d.bd?{...d.bd}:{m:5,d:5}; S.ev={...(d.ev||{})};
  S.evseen=(d.evseen&&typeof d.evseen==="object"&&!Array.isArray(d.evseen))?{...d.evseen}:{};
  S.prof={...(d.prof||{})}; S.trip=d.trip?{...d.trip}:null; S.visit={...(d.visit||{})};
  S.said={...(d.said||{})};
  S.rec=d.rec?JSON.parse(JSON.stringify(d.rec)):recInit();
  S.weekStart=d.weekStart; S.dayIdx=(d.dayIdx===undefined?null:d.dayIdx);
  S.plan=(d.plan||new Array(6).fill(null)).slice();
  S.res=(d.res||new Array(6).fill(null)).map(r=>r?{...r}:null);
  S.weekStress0=(d.weekStress0===undefined?S.stress:d.weekStress0);
  S.weekP0=(d.weekP0&&typeof d.weekP0==="object")?{...d.weekP0}:null;
  S.pre=d.pre||null;
  S.pick=null;
  S.valen=(d.valen||[]).slice(); S.lastPlan=d.lastPlan||null; S.lastM=d.lastM;
  /* 主人公の性別。古いセーブには入っていないので、そのときは男性です */
  S.sex=(d.sex==="f")?"f":"m";
  linkCast();                /* その性別に合わせて、部活とバイトの相手役を決めなおす */
  S.girls=(d.girls||[]).map(v=>{const t=castAll().find(x=>x.id===v.id); if(!t)return null;
    return {...t, ideal:{...t.ideal}, aff:(v.aff!==undefined?v.aff:t.aff),
            last:(v.last!==undefined?v.last:0)};}).filter(Boolean);
  if(!S.girls.length)S.girls=castNow().map(g=>({...g,ideal:{...g.ideal}}));
  /* 週の状態（plan/res/weekStart/dayIdx）は上で入れなおしているので、ここでは消さない。
     古いセーブには入っていないため、その場合は上の既定値（未定・すべて空）になる */
  S.busy=false; S.vnOn=false; S.sunResolve=null; S.lastToast=0;
  evMigrate();                         /* 古いセーブから「見たイベント」を引きつぐ */
}
function canSave(){ return $("planner").style.display==="block" || $("sunHint").style.display==="block"; }
function autoSave(){ const d=storeGet(); const m=d.a&&d.a.memo; d.a=snapshot(); if(m)d.a.memo=m; storeSet(d); }
function toast(msg){
  let el=$("toast");
  if(!el){el=document.createElement("div");el.id="toast";$("stage").appendChild(el);}
  el.textContent=nm(String(msg)); el.className="show";
  clearTimeout(S.toastT); S.toastT=setTimeout(()=>el.className="",1600);
}
const slotLabel=k=>k==="a"?"オートセーブ":"スロット "+k;

/* ---- きろく画面のカードに出す顔 --------------------------------------
   assets/chara/<名前>/save/<間柄>.png（friend / crush / love）を使います。
   その間柄の絵が無ければ、ひとつ下の間柄へ順に落とします。
   1枚も置いていない子は、いままでどおり立ち絵の顔のあたりを切り取ります。 */
const SAVEFACE=(typeof SAVE_FACE!=="undefined")?SAVE_FACE
  :{tiers:["friend","crush","love"], min:"friend"};
function saveFaceArt(gid,tier){
  const a=artOf(gid), set=a&&a.save;
  if(!set||!set.length)return null;
  const order=SAVEFACE.tiers||["friend","crush","love"];
  let i=order.indexOf(tier); if(i<0)i=order.length-1;
  for(;i>=0;i--){                        /* その間柄 → ひとつ下 → …の順に探す */
    const f=artName(set,order[i]);
    if(f)return "chara/"+gid+"/save/"+f;
  }
  const n=artName(set,"normal");         /* 念のため normal.png も見る */
  return n?"chara/"+gid+"/save/"+n:null;
}
function saveFaceHTML(gd,tier){
  const p=saveFaceArt(gd.id,tier);
  if(p)return `<img src="${artURL(p)}" alt="">`;
  return portrait(gd,tier==="love"?"blush":"normal","crop");
}

function slotInfo(d){
  if(!d)return null;
  d=migrateSave(d);
  if(!d)return null;                    /* 読めない形のデータだった */
  const c=CAL[Math.min(d.t||0,LAST)];
  const g=topGirl(d.girls||[]);
  const gd=g&&ALLG.find(x=>x.id===g.id);
  /* 「友達」以上になっている子がいれば、その子の顔をカードに出す
     （どこから顔を出すかは assets/config.js の SAVE_FACE.min） */
  const face=(gd&&affAtLeast(g,SAVEFACE.min||"friend"))
    ? `<span class="sface" title="${gd.name}">${saveFaceHTML(gd,affTier(g))}</span>`
    : `<span class="sface ph"></span>`;   /* いないときは、場所だけ空けてカードの形をそろえる */
  const dt=new Date(d.ts||0);
  const z=n=>("0"+n).slice(-2);
  return {memo:d.memo||"", date:`${c.y}年目 ${c.m}月${c.d}日（${DOW[(d.t||0)%7]}）`,
    name:d.name||"？", club:(CLUBS[d.club]||CLUBS.none).n, face,
    top:gd?`${gd.name} ${hearts(g.aff)} <span style="color:#8a7a68">${affTierName(g)}</span>`:"—",
    when:`${dt.getFullYear()}/${z(dt.getMonth()+1)}/${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}`};
}
const SLOTS=100;
function hasAnySave(){ const d=storeGet(); return Object.keys(d).length>0; }

function confirmBox(title,msg,okLabel,danger){
  return new Promise(res=>{
    const el=document.createElement("div"); el.className="confirm";
    el.innerHTML=`<div class="cbox"><div class="ct">${title}</div><div class="cm">${msg}</div>
      <div class="cb"><button class="btn ${danger?"dg":"pk"}">${okLabel||"はい"}</button>
      <button class="btn gy">やめる</button></div></div>`;
    $("stage").appendChild(el);
    const b=el.querySelectorAll("button");
    b[0].onclick=()=>{el.remove();se("ok");res(true);};
    b[1].onclick=()=>{el.remove();se("cancel");res(false);};
  });
}

function promptBox(title,msg,value,okLabel){
  return new Promise(res=>{
    const el=document.createElement("div"); el.className="confirm";
    el.innerHTML=`<div class="cbox"><div class="ct">${title}</div><div class="cm">${msg}</div>
      <input type="text" class="memoin" maxlength="30" placeholder="メモ（30文字まで・空でもOK）">
      <div class="cb"><button class="btn pk">${okLabel||"きめる"}</button><button class="btn gy">やめる</button></div></div>`;
    $("stage").appendChild(el);
    const inp=el.querySelector("input"); inp.value=value||"";
    setTimeout(()=>{try{inp.focus();inp.select();}catch(e){}},60);
    const b=el.querySelectorAll("button");
    const ok=()=>{const v=inp.value.trim();el.remove();se("ok");res(v);};
    b[0].onclick=ok;
    b[1].onclick=()=>{el.remove();se("cancel");res(null);};
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")ok();};
  });
}

function saveMenu(fromTitle){
  return new Promise(resolve=>{
    const M=$("modal"); M.style.width="760px"; modalFull(true);
    if(S.page===undefined)S.page=0;
    /* タイトルから開いたときは、閉じるときも幕を下ろします
       （ゲーム中に開いたきろく画面は、画面ごと変わるわけではないので幕なし） */
    /* よみこむときは、窓を開けたまま openSaveMenu に渡します
       （むこうでゲーム画面を用意してから、窓をうすくして入れかえます） */
    const close=async v=>{
      if(typeof v==="string" && v.indexOf("load:")===0){ resolve(v); return; }
      await fadeOut(M,()=>{ M.style.display="none"; modalFull(false); M.style.width="640px"; });
      resolve(v);
    };
    /* カード（タイル）1枚ぶん。並べかたは style.css の .slotgrid です。
       いちばん好感度の高い子の名前と★は出しません（顔でわかるため）。 */
    const row=(k,label)=>{
      const d=storeGet(), i=slotInfo(d[k]);
      return `<div class="slotrow${(k==="a"||k==="q")?" auto":""}${i?"":" empty"}">
        <div class="sk">${label}</div>
        <div class="sbody">
          ${i&&i.face?i.face:'<span class="sface ph"></span>'}
          <div class="si">${i?`<b>${i.date}</b>
             <div class="sn">${i.name}　<span class="sc">${i.club}</span></div>
             ${i.memo?`<div class="memo">📝 ${i.memo}</div>`:""}
             <div class="sw">${i.when}</div>`
            :'<span class="nodata">— データなし —</span>'}</div>
        </div>
        <div class="sb">
          ${k==="a"?"":`<button class="btn gy sm" data-a="save:${k}" ${fromTitle||!canSave()?"disabled":""}>書く</button>`}
          <button class="btn pk sm" data-a="load:${k}" ${i?"":"disabled"}>よむ</button>
          <button class="btn gy sm" data-a="memo:${k}" ${i?"":"disabled"}>📝</button>
          <button class="btn gy sm" data-a="del:${k}" ${i?"":"disabled"}>消す</button>
        </div></div>`;
    };
    const render=()=>{
      const per=10, pages=SLOTS/per, from=S.page*per+1;
      let rows=row("a","オートセーブ");
      for(let n=from;n<from+per;n++) rows+=row(String(n),"スロット "+n);
      $("modTtl").textContent="きろく";
      $("modBody").innerHTML=
        `<div class="pager">
           <button class="btn gy sm" data-a="pg:-1">◀</button>
           <select id="pgSel">${[...Array(pages)].map((_,i)=>`<option value="${i}" ${i===S.page?"selected":""}>${i*per+1} 〜 ${i*per+per}</option>`).join("")}</select>
           <button class="btn gy sm" data-a="pg:1">▶</button>
           <span style="font-size:11.5px;color:#8a7a68">スロットは 1〜${SLOTS} まであります</span>
         </div><div class="slotgrid">${rows}</div>
         <div class="savenote">${STORE_OK
          ? "ブラウザの中に保存されます。同じブラウザで開けば続きから遊べます。"
          : "⚠ このブラウザでは保存領域が使えません。今回のセーブは<b>このタブを閉じるまで</b>しか残りません。下の「ファイルに書き出す」で保存してください。"}
          ${fromTitle?"":(canSave()?"":"<br>※ セーブは<b>月曜の予定画面</b>か<b>日曜の画面</b>でだけできます。")}</div>`;
      $("modBtns").innerHTML=
        `<button class="btn gy" data-a="export">ファイルに書き出す</button>
         <button class="btn gy" data-a="import">ファイルから読み込む</button>
         <button class="btn pk" data-a="close" style="margin-left:auto">閉じる</button>`;
      M.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>handle(b.dataset.a));
      const sel=$("pgSel"); if(sel)sel.onchange=()=>{S.page=+sel.value;render();};
      $("modBody").scrollTop=0;
    };
    const handle=async a=>{
      const [cmd,k]=a.split(":");
      const d=storeGet();
      if(cmd==="pg"){ S.page=(S.page+ +k+SLOTS/10)%(SLOTS/10); render(); return; }
      if(cmd==="save"){
        const i=slotInfo(d[k]);
        const memo=await promptBox("セーブしますか？",
          i?`<b>${slotLabel(k)}</b> には既にデータがあります。<br>${i.date}　${i.name}<br><span style="color:#c2306a">上書きされます。</span>`
           :`<b>${slotLabel(k)}</b> に、いまの状態をきろくします。`,
          (d[k]&&d[k].memo)||"", i?"上書きする":"きろくする");
        if(memo===null)return;
        d[k]=snapshot(); d[k].memo=memo;
        const done=storeSet(d); render(); toast(done?"きろくしました":"一時的に保存しました");
      }
      else if(cmd==="memo"){
        const i=slotInfo(d[k]); if(!i)return;
        const memo=await promptBox("メモを書きかえる",
          `<b>${slotLabel(k)}</b><br>${i.date}　${i.name}`,
          d[k].memo||"", "きめる");
        if(memo===null)return;
        d[k].memo=memo; storeSet(d); render(); toast("メモを変えました");
      }
      else if(cmd==="del"){
        const i=slotInfo(d[k]); if(!i)return;
        const ok=await confirmBox("消しますか？",`<b>${slotLabel(k)}</b><br>${i.date}　${i.name}<br><br>この記録を消します。もとに戻せません。`,"消す",true);
        if(!ok)return;
        delete d[k]; storeSet(d); render(); toast("消しました");
      }
      else if(cmd==="load"){
        const i=slotInfo(d[k]); if(!i)return;
        const ok=await confirmBox("よみこみますか？",
          `<b>${slotLabel(k)}</b><br>${i.date}　${i.name}<br>${i.top}` +
          (fromTitle?"":"<br><br><span style='color:#c2306a'>いま遊んでいる内容は失われます。</span>"),"よみこむ");
        if(!ok)return;
        close("load:"+k);
      }
      else if(cmd==="export"){
        const blob=new Blob([JSON.stringify(storeGet(),null,1)],{type:"application/json"});
        const a2=document.createElement("a");
        a2.href=URL.createObjectURL(blob); a2.download="starmate_save.json"; a2.click();
        setTimeout(()=>URL.revokeObjectURL(a2.href),3000);
        toast("ファイルを書き出しました");
      }
      else if(cmd==="import"){
        const inp=document.createElement("input"); inp.type="file"; inp.accept=".json,application/json";
        inp.onchange=()=>{ const f=inp.files[0]; if(!f)return;
          const r=new FileReader();
          r.onload=async()=>{ try{ const o=JSON.parse(r.result);
              if(typeof o!=="object")throw 0;
              const n=Object.keys(o).length;
              const ok=await confirmBox("よみこみますか？",`ファイルから <b>${n}件</b> の記録を読み込み、同じ番号のスロットに上書きします。`,"読み込む");
              if(!ok)return;
              storeSet(Object.assign(storeGet(),o)); render(); toast("読み込みました");
            }catch(e){ toast("ファイルを読めませんでした"); } };
          r.readAsText(f); };
        inp.click();
      }
      else close(null);
    };
    /* 窓は下の画面の上に重なるので、窓のほうをうっすらから出します */
    modalShow(()=>{ M.style.display="flex"; render(); });
  });
}

async function openSaveMenu(fromTitle){
  const r=await saveMenu(fromTitle);
  if(r&&r.startsWith("load:")){
    const d=storeGet()[r.split(":")[1]];
    if(!d)return;
    restore(d);
    flowAbort();
    SCRGEN++;
    /* きろくの窓は開けたままにして、その下にゲーム画面を用意します。
       用意ができてから窓をうすくすると、すっと入れかわって見えます。 */
    $("title").style.display="none";
    $("setup").style.display="none"; S.inGame=true; gameLayer(true);
    $("ending").style.display="none";
    $("planner").style.display="none";
    $("sunHint").style.display="none";
    closeMsg(); vnClose(true);
    AU.cur=null;
    redraw();
    main(true);
    fadeStop("vn");          /* 上の窓が消えるので、会話画面のフェードは要りません */
    await raf2();
    await fadeOut($("modal"), ()=>{
      $("modal").style.display="none"; modalFull(false); $("modal").style.width="640px"; });
  }
}


/* =======================================================================
   18. ギャラリー（おまけ）
   ======================================================================= */
const GALKEY="starmate_gal";
let GAL={sc:{},end:{},tt:{},cg:{}};
function galLoad(){try{const o=JSON.parse(localStorage.getItem(GALKEY)||"null");
  if(o){GAL.sc=o.sc||{};GAL.end=o.end||{};GAL.tt=o.tt||{};GAL.cg=o.cg||{};}}catch(e){}}
function galSave(){try{localStorage.setItem(GALKEY,JSON.stringify(GAL));}catch(e){}}
function galMark(k,v){ if(GAL.sc[k]===undefined||v){GAL.sc[k]=v||1;galSave();} }
function galEnd(gid,rank){ if((GAL.end[gid]||0)<rank){GAL.end[gid]=rank;galSave();} }
/* 見たイベントスチルを覚えておく（おまけの「スチル」で開けるようになります） */
function galCG(who,n){ const k=(who||"common")+":"+(+n);
  if(!GAL.cg[k]){GAL.cg[k]=1;galSave();} }
const galCGgot=(who,n)=>!!GAL.cg[(who||"common")+":"+(+n)];
const ENDNAME={1:"フレンドエンド",2:"ハッピーエンド",3:"トゥルーエンド"};
/* その子が相手役になる部活。いま入っている部活が当てはまるなら、それを優先する
   （ひなたは野球・サッカー・テニス・バスケの4つで相手役になるため） */
function clubOfMate(mid){
  if(CLUBS[S.club]&&CLUBS[S.club].mate===mid)return S.club;
  const k=Object.keys(CLUBS).find(k2=>CLUBS[k2].mate===mid);
  if(k)return k;
  /* いま選んでいる主人公のキャストでない子（おまけに並べるとき）は、
     CLUBS の相手役が付いていないので、その子のファイルから引きます */
  const s=(typeof STORY!=="undefined")&&STORY[mid];
  return (s&&s.p&&(s.p.clubs||[])[0])||null;
}

function galList(){
  const out=[];
  /* おまけに並べる顔ぶれ（既定は男女ぜんぶ。GAME_RULE.galleryAll） */
  const ok=new Set(castGal().map(g=>g.id));
  const use=id=>ok.has(id);
  Object.keys(AFF_EV).forEach(g=>{ if(!use(g))return;
    AFF_EV[g].forEach((e,i)=>out.push({k:`aff:${g}:${i}`,cat:"好感度",gid:g,t:e.t}));});
  Object.keys(INTRO).forEach(g=>{ if(!use(g))return;
    out.push({k:`intro:${g}`,cat:"出会い",gid:g,t:"はじめての出会い"});});
  /* ★ CLUBS の相手役は、いま選んでいる主人公のぶんしか付いていません。
       おまけには両方ならべたいので、部活の相手役は CLUBJOIN／CLUBMEET を
       書いてある子そのものから引きます（clubOfMate が p.clubs も見ます）。 */
  const mates=[...new Set([...Object.keys(CLUBJOIN),...Object.keys(CLUBMEET)])];
  mates.forEach(m=>{ if(!use(m))return;
    const cn=(CLUBS[clubOfMate(m)]||{}).n; if(!cn)return;
    if(CLUBJOIN[m])out.push({k:`club:${m}`,cat:"部活",gid:m,t:cn+"に入部"});
    if(CLUBMEET[m])out.push({k:`clubm:${m}`,cat:"部活",gid:m,t:cn+"で出会う"});
  });
  Object.keys(JOBMEET).forEach(g=>{ if(!use(g))return;
    out.push({k:`job:${g}`,cat:"バイト",gid:g,t:"バイト先での再会"});});
  return out;
}
function sceneDef(k){
  const a=k.split(":");
  if(a[0]==="aff"){const e=(AFF_EV[a[1]]||[])[+a[2]]; if(!e)return null;
    return {title:e.t,gid:a[1],bg:e.bg,ex:e.ex,body:e.b,opts:e.o};}
  if(a[0]==="intro"){const e=INTRO[a[1]]; if(!e)return null;
    return {title:"はじめての出会い",gid:a[1],bg:e.bg,ex:e.ex,body:e.b,opts:e.o};}
  if(a[0]==="club"||a[0]==="clubm"){
    const src=(a[0]==="club"?CLUBJOIN:CLUBMEET)[a[1]]; if(!src)return null;
    const ck=clubOfMate(a[1]);
    return {title:(CLUBS[ck]||{}).n+(a[0]==="club"?"に入部":"で出会う"),gid:a[1],
            bg:(CLUBS[ck]||{}).bg||"klass",ex:src.ex,body:src.b,opts:src.o};}
  if(a[0]==="job"){const e=JOBMEET[a[1]]; if(!e)return null;
    const j=JOBS[GAL.sc["job:"+a[1]]]||JOBS.conv;
    return {title:j.n+"での再会",gid:a[1],bg:j.bg,ex:e.ex,body:e.b,opts:e.o};}
  return null;
}
async function replayScene(def){
  const g=ALLG.find(x=>x.id===def.gid);
  /* 回想のあいだは、{彼}／{くん} をこの子に合わせます（上の SEXWHO） */
  SEXWHO=def.gid||null;
  /* タイトル画面（z-index 12）がノベル画面（z-index 5）を覆ってしまうので、
     回想のあいだだけ隠す。終わったら必ず元に戻す。 */
  const tEl=$("title"), tKeep=tEl.style.display;
  const sEl=$("setup"), sKeep=sEl.style.display;
  tEl.style.display="none"; sEl.style.display="none";
  try{
  await scene(def.bg||"klass",async()=>{
    openMsg("回想");
    vnFace(g,def.ex||"normal");
    say(`✦ <b>${def.title}</b>　<span class="sys">（回想 ─ 好感度は変わりません）</span>`,"ev");
    def.body.forEach(t=>say(t));
    const i=await choose(def.opts.map((o,idx)=>({t:o.t,v:idx})));
    se("page");
    vnFace(g,def.opts[i].d>=60?"blush":def.opts[i].d>0?"happy":"sad");
    say(def.opts[i].r);
    await next("▶ 回想を終わる");
  });
  } finally { SEXWHO=null; tEl.style.display=tKeep; sEl.style.display=sKeep; }
}

/* 称号の一覧で、下の帯に出す説明 */
let TTHOVER=null;
/* 称号の名前。{主プリンス} のような差しこみ口が入っていることがあるので、
   画面に出すときは、かならずこれを通します。 */
function ttName(t){ return t ? nm(t.n) : "—"; }
function ttBarHTML(id){
  const all=(typeof ttListAll==="function")?ttListAll()
           :((typeof TITLES!=="undefined")?TITLES:[]);
  const t=all.find(x=>x.id===id);
  if(!t)return `<span class="ttbh">称号にカーソルを合わせると、ここに取りかたが出ます</span>`;
  const got=!!GAL.tt[t.id];
  return `<span class="ttbn">${got?"🏅":"🔒"} ${ttName(t)}</span>`+
         `<span class="ttbc">${t.c}</span>`+
         `<span class="ttbd">${nm(t.d)}</span>`+
         `<span class="ttbs ${got?"got":""}">${got?"取得ずみ":"未取得"}</span>`;
}
function galleryMenu(){
  return new Promise(resolve=>{
    /* ★ おまけは全画面で出します。
       タブ（シーン鑑賞／スチル／プロフィール／称号／BGM）で中身の量がまるで違うので、
       窓の大きさを内容に合わせていると、押すたびに窓が伸び縮みして落ち着きません。
       予定表・くわしく・きろく・せっていと同じ「全画面」にそろえました。
       mode に "gal" を渡しているのは、文字ごと1.3倍にする zoom を避けるためです
       （一覧はマス目なので、拡大すると一度に見える数が減ってしまいます）。 */
    const M=$("modal"); modalFull(true,"gal");
    if(!S.galTab)S.galTab="sc";
    /* おまけはタイトルから開くので、閉じるときも幕を下ろします */
    const close=async()=>{
      await fadeOut(M,()=>{ M.style.display="none"; modalFull(false); M.style.width="640px"; });
      TTHOVER=null;
      if(AU.ctx){AU.cur=null;bgm(S.inGame?bgmFor(S.t):titleBgmName());}
      resolve();
    };
    const tabs=()=>`<div class="gtabs">
      ${[["sc","🖼 シーン鑑賞"],["cg","🎞 スチル"],["pf","👤 プロフィール"],["tt","🏅 称号"],["bg","🎵 BGM"]].map(([k,n])=>
        `<span class="gtab ${S.galTab===k?"on":""}" data-g="tab:${k}">${n}</span>`).join("")}</div>`;
    const render=()=>{
      $("modTtl").textContent="おまけ";
      let body=tabs();
      if(S.galTab==="sc"){
        const list=galList();
        const got=list.filter(x=>GAL.sc[x.k]).length;
        body+=`<div class="savenote" style="margin:0 0 7px">解放 ${got} / ${list.length}　クリックすると、そのシーンをもう一度見られます。</div>
          <div class="ggrid">${list.map(x=>{
            const open=!!GAL.sc[x.k], g=ALLG.find(y=>y.id===x.gid);
            return `<div class="gcell ${open?"":"lock"}" ${open?`data-g="play:${x.k}"`:""}>
              <div class="gface">${open?portrait(g,"happy","crop"):`<div class="glock">？</div>`}</div>
              <div class="ginfo"><div class="gcat">${x.cat}</div>
                <div class="gt">${open?x.t:"？？？"}</div>
                <div class="gn">${open?g.name:"—"}</div></div></div>`;}).join("")}</div>`;
      }else if(S.galTab==="cg"){
        /* ---- イベントスチル（1枚絵）---------------------------------
           1人 CG_RULE.slots 枚（既定30枚）の枠を並べます。
           絵を置いていない番号は、うすい空き枠のままです。 */
        const cast=[...castGal().map(g=>[g.id,g.name]),["common","みんな・その他"]]
          .filter(([id])=>cgList(id).length>0);
        if(S.cgView){
          const {who,n}=S.cgView, d=S.cgView.d||"";
          const ds=cgDiffs(who,n), u=cgURL(who,n,d);
          body+=`<div class="cgview">
            ${u?`<img src="${u}" alt="">`:`<div class="glock" style="height:220px">？</div>`}
            <div class="cgcap">${cgTitle(who,n,d)}</div>
            ${ds.length?`<div class="chips" style="justify-content:center;margin-top:6px">
              <span class="chip ${d?"":"on"}" data-g="cgd:">もとの絵</span>
              ${ds.map(k=>`<span class="chip ${d===k?"on":""}" data-g="cgd:${k}">${cgDiffName(who,n,k)}</span>`).join("")}
            </div>`:""}</div>`;
        }else if(!cast.length){
          body+=`<div class="savenote" style="margin:0">
            まだイベントスチル（1枚絵）は置かれていません。<br>
            <b>assets/chara/&lt;キャラid&gt;/cg/</b> に <b>01.png 〜 ${String(cgSlots()).padStart(2,"0")}.png</b>
            を入れると、ここに並びます（みんなのスチルは <b>assets/cg/</b>）。<br>
            表情ちがいなどの差分は <b>01_a.png</b> のように「_」のあとに名前を付けます。
            差分は ${cgSlots()}枚の枠には数えません。<br>
            題名は <b>story/cg.js</b> に書けます。</div>`;
        }else{
          /* 番号を 1〜枠数 まで並べた配列（数えるのにも、並べるのにも使います） */
          const nums=Array.from({length:cgSlots()},(_,i)=>i+1);
          const nHave=id=>nums.filter(n=>cgHas(id,n)).length;
          const nGot =id=>nums.filter(n=>cgHas(id,n)&&galCGgot(id,n)).length;
          const all=cast.length*cgSlots();
          const got=cast.reduce((s,[id])=>s+nGot(id),0);
          body+=`<div class="savenote" style="margin:0 0 7px">解放 ${got} / ${all}
            見たことのあるスチルを選ぶと、大きく見られます。</div>`;
          for(const [id,nm2] of cast){
            body+=`<div class="cgh2"><span>${nm2}</span>`
                + `<i>${nGot(id)} / ${nHave(id)}</i></div><div class="cggrid">`;
            for(const n of nums){
              const has=cgHas(id,n), seen=has&&galCGgot(id,n);
              const u=seen?cgURL(id,n):null;
              const two=String(n).padStart(2,"0");
              body+=`<div class="cgcell ${seen?"":(has?"lock":"none")}" ${seen?`data-g="cg:${id}:${n}"`:""}>
                ${u?`<img src="${u}" alt="">`:`<span class="cgno">${two}</span>`}
                <span class="cgnum">${two}</span></div>`;
            }
            body+=`</div>`;
          }
        }
      }else if(S.galTab==="pf"){
        body+=`<div class="savenote" style="margin:0 0 7px">エンディングを迎えた子は、くわしいプロフィールが見られます。</div>
          <div class="pgrid">${castGal().map(g=>{
            const rank=GAL.end[g.id]||0;
            const met=galList().some(x=>x.gid===g.id&&GAL.sc[x.k]);
            if(!met&&!rank)return `<div class="pcard lock"><div class="pface"><div class="glock">？</div></div>
              <div><div class="pn">？？？</div><div class="pr2">まだ出会っていません</div></div></div>`;
            return `<div class="pcard">
              <div class="pface">${portrait(g,rank>=3?"blush":"normal","crop")}</div>
              <div style="flex:1">
                <div class="pn">${g.name}${rank?` <span class="pend">${ENDNAME[rank]}</span>`:""}</div>
                <div class="pr2">${g.role}</div>
                ${rank?`<div class="pd">理想：${Object.entries(g.ideal).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>P[k].replace(/\s/g,"")+"×"+v).join("、")}</div>
                  <div class="pd">好き：${g.like.map(id=>PLACES.find(p=>p.id===id).n).join("・")}</div>
                  <div class="pd">苦手：${g.hate.map(id=>PLACES.find(p=>p.id===id).n).join("・")}</div>
                  <div class="pd">${g.req?`${g.req.n}を${g.req.v}まで伸ばすと出会える`:"最初から登場"}</div>`
                 :`<div class="pd" style="color:#a08090">エンディングを迎えると、くわしく見られます</div>`}
              </div></div>`;}).join("")}</div>`;
      }else if(S.galTab==="tt"){
        /* ★ 一覧は「集めたもの」なので、男女ぜんぶを並べます（ttListAll）。
           TITLES（いまのキャストぶん）にすると、もう片方の主人公で取った
           「◯◯と好きになる」が消えてしまいます。 */
        const list=(typeof ttListAll==="function")?ttListAll():TITLES;
        const got=list.filter(t=>GAL.tt[t.id]).length;
        /* 校内評価は「いま遊んでいる人」のものなので、ゲーム中だけ光らせます */
        const cur=S.inGame?titleNow():null;
        body+=`<div class="savenote" style="margin:0 0 7px">
            集めた称号 <b>${got} / ${list.length}</b>　${S.inGame?`いまの校内評価：<b>${ttName(cur)}</b>　`:""}
            ひとつにカーソルを合わせる（またはタップする）と、下に取りかたが出ます。</div>
          <div class="ttgrid">${(()=>{
            let out="", last=null;
            for(const t of list){
              if(t.c!==last){
                last=t.c;
                const inCat=list.filter(x=>x.c===t.c);
                const gc=inCat.filter(x=>GAL.tt[x.id]).length;
                out+=`<div class="tth2"><span>${t.c}</span><i>${gc} / ${inCat.length}</i></div>`;
              }
              const open=!!GAL.tt[t.id], now=cur&&cur.id===t.id;
              out+=`<div class="ttc ${open?"":"lock"} ${now?"now":""}" tabindex="0" data-tt="${t.id}"
                title="${ttName(t)}／${nm(t.d)}">
                <span class="ttm">${open?"🏅":"🔒"}</span>
                <span class="ttn">${ttName(t)}</span></div>`;
            }
            return out;})()}</div>`;
      }else{
        body+=`<div class="savenote" style="margin:0 0 7px">曲を選ぶと再生します。閉じると元のBGMに戻ります。</div>
          <div class="bgrid">${Object.keys(TRACKS).map(k=>{
            const t=TRACKS[k], on=(AU.cur===k);
            return `<div class="bcell ${on?"on":""}" data-g="bgm:${k}">
              <div class="bico">${on?"♪":"▶"}</div>
              <div><div class="bn">${t.n}</div><div class="bb">${t.bpm} BPM</div></div></div>`;}).join("")}
          </div>`;
      }
      $("modBody").innerHTML=body;
      $("modBtns").innerHTML=
        (S.galTab==="tt"?`<div class="ttbar" id="ttBar">${ttBarHTML(null)}</div>`:"")+
        (S.galTab==="cg"&&S.cgView?`<button class="btn gy" data-g="cgback">◀ 一覧へもどる</button>`:"")+
        `<button class="btn pk" data-g="close" style="margin-left:auto">閉じる</button>`;
      /* 称号にカーソルを合わせたら、下の帯に取りかたを出す */
      TTHOVER=id=>{const b=$("ttBar"); if(b)b.innerHTML=ttBarHTML(id);};
      M.querySelectorAll("[data-tt]").forEach(el=>{
        const id=el.dataset.tt;
        el.onmouseenter=()=>TTHOVER(id);
        el.onfocus=()=>TTHOVER(id);
        el.onclick=()=>{se("click");TTHOVER(id);};
      });
      /* 開いたときは、いまの称号のところまでスクロールして説明も出しておく */
      if(S.galTab==="tt"){
        const now=M.querySelector(".ttc.now");
        if(now){ TTHOVER(now.dataset.tt);
          try{now.scrollIntoView({block:"center"});}catch(e){} }
      }
      M.querySelectorAll("[data-g]").forEach(el=>el.onclick=async()=>{
        const [a,v]=el.dataset.g.split(":").length>2
          ? [el.dataset.g.split(":")[0], el.dataset.g.split(":").slice(1).join(":")]
          : el.dataset.g.split(":");
        if(a==="tab"){S.galTab=v;S.cgView=null;se("click");render();}
        else if(a==="cg"){const [w,n]=v.split(":");S.cgView={who:w,n:+n,d:""};se("ok");render();}
        else if(a==="cgd"){if(S.cgView){S.cgView.d=v||"";}se("click");render();}
        else if(a==="cgback"){S.cgView=null;se("cancel");render();}
        else if(a==="bgm"){se("click");if(AU.ctx){AU.cur=null;bgm(v);}setTimeout(render,600);}
        else if(a==="play"){
          const def=sceneDef(v); if(!def)return;
          M.style.display="none";
          await replayScene(def);
          M.style.display="flex"; modalFull(true,"gal"); render();
        }
        else close();
      });
    };
    /* 窓は下の画面の上に重なるので、窓のほうをうっすらから出します */
    modalShow(()=>{ M.style.display="flex"; render(); });
  });
}

/* =======================================================================
   15. メインループ
   ======================================================================= */
/* 入学式で顔を出す面々。
   ★ 特定の子を名ざしにすると、主人公の性別を変えたときに誰も出なくなります。
     いま登場している「最初からいる子」のうち、story/<id>.js に pro を
     書いてある子だけが、書いてある順（p.order）に出ます。 */
function proCast(){
  const P=(typeof PRO!=="undefined")?PRO:{};
  return castNow().map(g=>({g, pr:P[g.id]})).filter(x=>x.pr&&x.pr.t);
}
async function prologue(){
  evMark("sys_prologue");
  const T=((typeof TXT!=="undefined")&&TXT.pro)||{};
  await scene("school",async()=>{
  openMsg("入学式");
  say(T.head||"✦ <b>1年目 4月5日（月）── 入学式</b>","ev");
  if(T.open)say(T.open);
  await next();
  for(const {g,pr} of proCast()){
    line(G(g.id)||g, pr.t, pr.exp||"normal");
    if(pr.d)say(pr.d);
    await next();
  }
  vnFace(null);
  if(T.legend)say(T.legend,"ev");
  if(T.ask)say(T.ask);
  await next(T.go||"▶ 高校生活を始める");
  });
}

async function main(fromLoad){
  const gen=++S.gen;
  if(!fromLoad){
    S.pre="pro";
    await prologue(); if(gen!==S.gen)return;
    if(S.club!=="none"){ S.pre="club"; await clubEvent(S.club); if(gen!==S.gen)return; }
    S.pre=null;
  }else if(S.pre){
    /* 入学式や入部シーンの途中でセーブしていたときは、そこからやり直す */
    const pre=S.pre; S.pre=null;
    if(pre==="pro"){ await prologue(); if(gen!==S.gen)return; }
    if(S.club!=="none"){ await clubEvent(S.club); if(gen!==S.gen)return; }
  }
  /* 週の途中でセーブしたデータを読んだときは、その日から続きをやる */
  if(fromLoad && S.dayIdx!==null && S.dayIdx!==undefined && S.weekStart!==undefined){
    $("planner").style.display="block"; redraw(); drawWeek();
    await runWeek(S.dayIdx);
    if(gen!==S.gen)return;
    $("planner").style.display="none";
    const days=weekDays();
    S.dayIdx=null;
    S.t=days[days.length-1]+1;
  }
  if(gen!==S.gen)return;
  while(S.t<=LAST){
    if(gen!==S.gen)return;
    if(dow(S.t)===0){
      S.weekStart=S.t;S.plan=new Array(6).fill(null);S.res=new Array(6).fill(null);S.pick=null;
      S.dayIdx=null;
      evMark("sys_firstweek");
      autoSave();
      $("planner").style.display="block";redraw();drawWeek();
      $("planner").querySelectorAll("button").forEach(b=>b.disabled=false);
      $("go").disabled=true;
      await new Promise(r=>{$("go").onclick=()=>r();});
      const days=weekDays();
      S.lastPlan=S.plan.slice();
      await runWeek();
      if(gen!==S.gen)return;
      $("planner").style.display="none";
      S.t=days[days.length-1]+1;
      if(S.t>LAST)break;
    }
    if(S.t<=LAST&&dow(S.t)===6){await restDay();if(gen!==S.gen)return;S.t++;}
    if(S.t<=LAST&&dow(S.t)!==0&&dow(S.t)!==6)S.t++;   // 保険
    redraw();
  }
  redraw();
  await ending();
}

/* 先週と同じ / クリア */
$("repeat").onclick=()=>{
  if(!S.lastPlan){return;}
  const days=weekDays();
  const fb=S.lastPlan.find(x=>x)||"rest";   /* 先週その曜日が行事だったときの代わり */
  for(let i=0;i<days.length;i++) if(!fixedAt(days[i])) S.plan[i]=S.lastPlan[i]||fb;
  S.pick=null;drawWeek();
};
$("clearAll").onclick=()=>{S.plan=new Array(6).fill(null);S.pick=null;drawWeek();};

/* ---- タイトル画面のセットアップ ---- */
let SETUPSYNC=null;      /* 選択の見た目を S に合わせ直す関数（下で入る） */
(function setupUI(){
  const mS=$("bdM"),dS=$("bdD");
  /* 誕生日は暦どおり1月からならべる（ゲーム内カレンダーの4月はじまりとは別） */
  for(let m=1;m<=12;m++){mS.innerHTML+=`<option value="${m}">${m}</option>`;}
  const fillD=()=>{const m=+mS.value;const cur=+dS.value||1;dS.innerHTML="";
    for(let d=1;d<=MLEN[m];d++)dS.innerHTML+=`<option value="${d}">${d}</option>`;
    dS.value=Math.min(cur,MLEN[m]);};
  mS.value=5;fillD();dS.value=5;

  /* どのステータスが伸びやすいかを、ひとことで書く */
  const gainTxt=g=>{
    if(!g)return "";
    if(g["*"])return "すべてが少しずつ";
    const a=Object.keys(g).sort((x,y)=>g[y]-g[x])
      .map(k=>P[k].replace(/\s/g,"")+(g[k]>=5?"◎":"○"));
    return a.join(" ");
  };
  /* いま選んでいる内容で、はじまりのステータスを出す */
  const statTxt=()=>{
    const bd={m:+mS.value,d:+dS.value}, p=startStats(bd), z=zodiacOf(bd.m,bd.d);
    return Object.keys(P).map(k=>
      `${P[k].replace(/\s/g,"")} <b class="${k===z.up?"hi":""}">${p[k]}</b>`).join("　");
  };
  const info=()=>{
    const bd={m:+mS.value,d:+dS.value}, z=zodiacOf(bd.m,bd.d);
    $("zodiac").textContent=`${z.g} ${z.n}`;
    const B=BLOOD[S.blood], C=CLUBS[S.club], J=S.job?JOBS[S.job]:null;
    $("setupInfo").innerHTML=
      `<b>${z.g} ${z.n}</b>：${z.d2}<br>`+
      `<b>${B.n}</b>：${B.d}${gainTxt(B.gain)?`<br>　└ 伸びやすい：${gainTxt(B.gain)}`:""}<br>`+
      `<b>${C.g} ${C.n}</b>：${C.d}<br>`+
      (J?`<b>${J.g} ${J.n}</b>：${J.d}<br>`
        :`<b>バイト先</b>：まだ決めない（ゲーム中に「🏪コンビニ」を選ぶと、そのとき決められます）<br>`)+
      `<div class="stst">はじまりのステータス：${statTxt()}</div>`;
  };
  mS.onchange=()=>{fillD();info();};
  dS.onchange=info;

  /* ---- 主人公の性別 ----
     男女どちらの攻略対象もそろっているときだけ出します。
     片方しか作っていないうちは、いままでどおり出ません。 */
  const drawSex=()=>{
    const row=$("sexRow"); if(!row)return;
    if(!sexPickable()){ row.style.display="none"; return; }
    row.style.display="flex";
    $("sexSel").innerHTML=["m","f"].map(k=>
      `<span class="chip ${k===S.sex?"on":""}" data-x="${k}">${sexName(k)}主人公</span>`).join("");
  };
  const setSex=k=>{
    S.sex=(k==="f")?"f":"m";
    linkCast();                       /* 部活とバイトの相手役を決めなおす */
    S.club="none"; S.job=null;        /* 相手役が変わるので、選びなおしてもらう */
    drawSex();
    $("clubSel").innerHTML=Object.keys(CLUBS).map(k2=>`<span class="chip ${k2===S.club?"on":""}" data-c="${k2}">${CLUBS[k2].g} ${CLUBS[k2].n}</span>`).join("");
    $("jobSel").innerHTML=
      `<span class="chip ${S.job?"":"on"}" data-j="">まだ決めない</span>`+
      Object.keys(JOBS).map(k2=>`<span class="chip ${S.job===k2?"on":""}" data-j="${k2}">${JOBS[k2].g} ${JOBS[k2].n}</span>`).join("");
    info();
  };
  $("sexSel").onclick=e=>{const c=e.target.closest("[data-x]");if(!c)return;se("click");setSex(c.dataset.x);};

  $("bloodSel").innerHTML=Object.keys(BLOOD).map(k=>`<span class="chip ${k===S.blood?"on":""}" data-b="${k}">${BLOOD[k].n}</span>`).join("");
  $("clubSel").innerHTML=Object.keys(CLUBS).map(k=>`<span class="chip ${k===S.club?"on":""}" data-c="${k}">${CLUBS[k].g} ${CLUBS[k].n}</span>`).join("");
  $("jobSel").innerHTML=
    `<span class="chip ${S.job?"":"on"}" data-j="">まだ決めない</span>`+
    Object.keys(JOBS).map(k=>`<span class="chip ${S.job===k?"on":""}" data-j="${k}">${JOBS[k].g} ${JOBS[k].n}</span>`).join("");

  $("bloodSel").onclick=e=>{const c=e.target.closest("[data-b]");if(!c)return;S.blood=c.dataset.b;
    $("bloodSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.b===S.blood));info();};
  $("clubSel").onclick=e=>{const c=e.target.closest("[data-c]");if(!c)return;S.club=c.dataset.c;
    $("clubSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.c===S.club));info();};
  $("jobSel").onclick=e=>{const c=e.target.closest("[data-j]");if(!c)return;S.job=c.dataset.j||null;
    $("jobSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",(x.dataset.j||null)===S.job));info();};

  SETUPSYNC=()=>{
    drawSex();
    $("bloodSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.b===S.blood));
    $("clubSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.c===S.club));
    $("jobSel").querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",(x.dataset.j||null)===S.job));
    info();
  };
  drawSex();
  info();
})();

/* タイトルの下にあった画面（はじめから画面・ゲーム・エンディング）を片づける。
   クロスフェードのときは、タイトルが濃くなりきってから呼びます。 */
function hideUnderTitle(){
  $("setup").style.display="none";
  $("ending").style.display="none"; $("ending").innerHTML="";
  $("planner").style.display="none"; $("sunHint").style.display="none";
  closeMsg(); vnClose(true); hideBoard(); closeAlertBox();
  /* 開きっぱなしの窓が残っていたら閉じる（デバッグ画面などがタイトルに重なるのを防ぐ）。
     ★ 全画面のクラス（.full/.zoom）も戻します。戻し忘れると、つぎに開いた
       ふつうの窓まで画面いっぱいに広がってしまいます。 */
  fadeStop("modal");
  $("modal").style.display="none"; modalFull(false); $("modal").style.width="640px";
  /* ゲーム画面（部屋・コマンド・日付の帯・ステータス）を隠す。
     エンディングのあとタイトルへ戻ったとき、これらが透けて見えていた */
  gameLayer(false);
}
/* keep=true のときは、下の画面をそのまま残します（フェードが終わってから
   hideUnderTitle() で片づけてください）。goTitle() がそうしています。 */
function showTitle(keep){
  S.inGame=false;
  $("title").style.display="block";
  if(!keep)hideUnderTitle();
  $("titleBg").innerHTML=titleBgHTML();
  applyTitleArt();
  $("title").querySelector('[data-t="load"]').disabled=!hasAnySave();
  if(AU.ctx){AU.cur=null;bgm(titleBgmName());}
  sndHint();
}
function showSetup(){
  /* 前のプレイの選択が残らないように、部活と血液型を選びなおしの状態に戻す */
  S.club="none"; S.blood="A"; S.job=null;
  S.sex=sexDefault();          /* 主人公の性別も、はじめの状態に戻す */
  linkCast();
  if(SETUPSYNC)SETUPSYNC();
  $("setup").style.display="flex";
}
/* 画面の切りかえの通し番号。
   ★ フェードのあいだも画面は押せるので、切りかえの途中でつぎの切りかえが
     始まることがあります。そのとき**古いほうのあとしまつ**（下の画面を
     片づける）が走ると、新しく出したものまで消してしまい、
     まっさらな画面から動かせなくなります。
     切りかえを始めるときに番号を増やし、あとしまつは
     「自分の番号がまだ最新なら」だけにします。 */
let SCRGEN=0;
/* タイトル → はじめから画面。
   はじめから画面はタイトルの下にあるので、**タイトルのほうを**うすくします */
async function goSetup(){
  SCRGEN++;
  showSetup();
  await fadeOut("title", ()=>{ $("title").style.display="none"; });
}
/* どこからでも、タイトルへ戻る。
   タイトルはいちばん上に重なるので、**タイトルを**うっすらから出します。
   下の画面は、濃くなりきってから片づけます。 */
async function goTitle(){
  const my=++SCRGEN;
  const done=await fadeIn("title", ()=>showTitle(true));
  if(done && my===SCRGEN) hideUnderTitle();
}
/* タイトルのメニュー。窓（つづきから・おまけ・オプション）はタイトルの上に
   重なるので、窓のほうがフェードインします（それぞれの中でやっています）。 */
$("title").querySelectorAll("[data-t]").forEach(b=>b.onclick=async()=>{
  audioWake(); se("ok");
  const k=b.dataset.t;
  if(k==="new"){ await goSetup(); return; }
  const my=++SCRGEN;   /* 窓を開くのも「切りかえ」。古いあとしまつを止めます */
  if(k==="load")       await openSaveMenu(true);
  else if(k==="omake") await galleryMenu();
  else                 await optionsMenu(false);
  /* 窓を閉じてタイトルに戻ったら、下に残っている画面を片づけます
     （切りかえの途中で開かれたときは、片づけが飛ばされているため） */
  if(my===SCRGEN && !S.inGame) hideUnderTitle();
});
$("backBtn").onclick=async()=>{ se("cancel"); await goTitle(); };

/* はじめから遊ぶときに、前のプレイの状態を全部まっさらに戻す。
   （タイトルへ戻ってから始め直しても、日付やパラメータが残らないように）
   ここで消す項目は restore() が読みなおす項目とそろえてあります。 */
function resetGame(){
  S.t=0;
  S.p=startStats();          /* 星座のぶんだけ、はじまりの値が変わる */
  S.stress=0; S.ev={}; S.evseen={}; S.prof={};
  S.valen=[]; S.visit={}; S.said={}; S.trip=null; S.pre=null; S.rec=recInit();
  S.lastM=undefined; S.lastPlan=null;
  S.weekStart=undefined; S.dayIdx=null; S.weekStress0=undefined; S.weekP0=null;
  S.plan=new Array(6).fill(null); S.res=new Array(6).fill(null);
  S.pick=null; S.sel=null; S.cur=0; S.busy=false; S.vnOn=false;
  S.sunResolve=null; S.lastToast=0;
  linkCast();                /* 主人公の性別に合わせて、部活とバイトの相手役を決めなおす */
  S.girls=castNow().map(g=>({...g,ideal:{...g.ideal}}));
  CEVN=0;
  flowAbort();                      /* 前のプレイの流れが残っていたら止める */
}
$("startBtn").onclick=async()=>{
  S.sei=($("psei").value||"桜坂").trim()||"桜坂";
  S.mei=($("pmei").value||"優").trim()||"優";
  S.name=S.sei+" "+S.mei;
  S.bd={m:+$("bdM").value,d:+$("bdD").value};
  resetGame();
  audioInit(); se("ok");
  SCRGEN++;
  $("title").style.display="none"; S.inGame=true;
  gameLayer(true); redraw();
  /* ★ 先に main() を始めます。入学式の会話画面（#vn）が、はじめから画面の
     下にすぐ出るので、**コマンド画面が一瞬見えてしまうことがありません**。
     そのうえで、上にある「はじめから画面」をうすくして入れかえます。 */
  main();
  fadeStop("vn");            /* 上の「はじめから画面」が消えるので、二重のフェードは要りません */
  await raf2();
  await fadeOut("setup", ()=>{ $("setup").style.display="none"; });
};
/* =======================================================================
   ゲームパッド
     十字キー／左スティック … カーソル移動
     A … 決定。押すところが無ければ、文章を1ページ進める
     B … やめる・閉じる・もどる（無ければメッセージ枠の表示を戻す）
     X … AUTO 　　Y … SKIP
     LB … メッセージ枠を隠す／戻す　　RB … きろく
     START … くわしく　　SELECT … せってい
   カーソルは、押せるものが画面に出ているときだけ動きます。
   ======================================================================= */
const GP={on:false, prev:[], focus:null, rep:0, dir:"", timer:null, quiet:false};

/* 画面のどこを操作できるか。上にあるものほど優先。
   auto=true なら、その画面が出た瞬間にカーソルを先頭へ置く */
const GPSCOPE=[
  {box:".confirm",  sel:"button", auto:true},
  {box:"#modal",    sel:"button,[data-a],[data-pick],[data-tt]", auto:true},
  {box:"#vnChoices",sel:".btn", auto:true},
  {box:"#choices",  sel:"button", auto:true},
  {box:"#setup",    sel:"button,.chip", auto:true},
  {box:"#title",    sel:"button,[data-t]", auto:true},
  /* 予定を立てる画面では、コマンドのアイコンと曜日の枠をひとつづきに動かす */
  {box:"#planner",  sel:"#icons .ic,#planner .slot,#planner button:not([disabled])",
                    doc:true, auto:true},
  {box:"#sunHint",  sel:"#icons .ic", doc:true, auto:true},
  {box:"#icons",    sel:".ic", auto:true},
  {box:"#vnBar",    sel:".sb", auto:false}   /* 文章中は、動かしたときだけ入る */
];
/* ノベル画面が出ているあいだは、この4つだけを操作する
   （下に隠れているコマンドのアイコンを拾ってしまわないように） */
const GPVNONLY={".confirm":1,"#modal":1,"#vnChoices":1,"#vnBar":1};

const gpVisible=el=>!!(el&&el.offsetParent!==null&&
  el.getClientRects().length&&!el.disabled&&getComputedStyle(el).visibility!=="hidden");

/* いま操作できるものを集める */
function gpScope(){
  const vn=!!(S.vnOn&&gpVisible($("vn")));
  for(const sc of GPSCOPE){
    if(vn&&!GPVNONLY[sc.box])continue;
    const root=document.querySelector(sc.box);
    if(!root||!gpVisible(root))continue;
    const items=[...(sc.doc?document:root).querySelectorAll(sc.sel)].filter(gpVisible);
    if(items.length)return {key:sc.box,items,auto:sc.auto};
  }
  return null;
}
function gpClear(){
  document.querySelectorAll(".gpf").forEach(e=>e.classList.remove("gpf"));
  GP.focus=null;
}
function gpMark(el){
  document.querySelectorAll(".gpf").forEach(e=>e.classList.remove("gpf"));
  GP.focus=el||null;
  if(el){ el.classList.add("gpf");
    /* 称号の一覧では、カーソルが乗ったものの取りかたを下の帯に出す */
    if(TTHOVER&&el.dataset&&el.dataset.tt)TTHOVER(el.dataset.tt);
    if(el.scrollIntoView)try{el.scrollIntoView({block:"nearest"});}catch(e){} }
}
/* いちばん近いものへカーソルを動かす */
function gpMove(dir){
  GP.quiet=false;
  const sc=gpScope(); if(!sc)return;
  if(!GP.focus||sc.items.indexOf(GP.focus)<0){ gpMark(sc.items[0]); se("click"); return; }
  const r=GP.focus.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  let best=null,bd=Infinity;
  for(const el of sc.items){
    if(el===GP.focus)continue;
    const q=el.getBoundingClientRect();
    const dx=q.left+q.width/2-cx, dy=q.top+q.height/2-cy;
    const fwd = dir==="l"?-dx : dir==="r"?dx : dir==="u"?-dy : dy;
    if(fwd<=2)continue;                       /* その向きには無い */
    const side=(dir==="l"||dir==="r")?Math.abs(dy):Math.abs(dx);
    const d=fwd+side*2.2;                     /* まっすぐ近いものを優先 */
    if(d<bd){bd=d;best=el;}
  }
  if(best){gpMark(best);se("click");}
}
/* 決定 */
function gpDecide(){
  const sc=gpScope();
  if(GP.focus&&gpVisible(GP.focus)&&sc&&sc.items.indexOf(GP.focus)>=0){ GP.focus.click(); return; }
  if(sc&&sc.auto){ gpMark(sc.items[0]); se("click"); return; }
  /* 押すところが無ければ、画面をタップしたことにして文章を送る */
  const t=S.vnOn?$("vn"):(gpVisible($("msg"))?$("msg"):null);
  if(t)t.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
}
/* もどる */
function gpCancel(){
  const sc=gpScope();
  if(sc){
    const back=sc.items.find(el=>/やめる|閉じる|もどる|キャンセル|しない/.test(el.textContent||""));
    if(back){back.click();return;}
  }
  if(S.vnOn&&vnHidden()){ vnHide(false); return; }
  if(S.vnOn){ se("cancel"); vnHide(true); }
}
function gpPress(i){
  GP.quiet=false;
  if(i===0)      gpDecide();
  else if(i===1) gpCancel();
  else if(i===2){ if(S.vnOn)vnBarClick("auto"); }
  else if(i===3){ if(S.vnOn)vnBarClick("skip"); }
  else if(i===4){ if(S.vnOn){se("cancel");vnHide(!vnHidden());} }
  else if(i===5){ if(S.vnOn&&S.inGame)vnBarClick("save"); }
  else if(i===8){ if(S.inGame)vnBarClick("config"); }
  else if(i===9){ if(S.inGame)vnBarClick("menu"); }
}
function gpPoll(){
  const pads=(navigator.getGamepads?navigator.getGamepads():[])||[];
  let pad=null; for(const q of pads) if(q&&q.connected){pad=q;break;}
  if(!pad){ if(GP.on){GP.on=false;gpClear();} return; }
  GP.on=true;
  /* ボタンは、押した瞬間だけ効かせる */
  const b=pad.buttons||[];
  for(let i=0;i<b.length;i++){
    const now=!!(b[i]&&(b[i].pressed||b[i].value>0.5));
    if(now&&!GP.prev[i])gpPress(i);
    GP.prev[i]=now;
  }
  /* 方向は十字キーとスティックの両方から */
  const ax=pad.axes||[], DZ=0.55;
  const on=n=>!!(b[n]&&b[n].pressed);
  let dir="";
  if(on(14)||ax[0]<-DZ)dir="l";
  else if(on(15)||ax[0]>DZ)dir="r";
  else if(on(12)||ax[1]<-DZ)dir="u";
  else if(on(13)||ax[1]>DZ)dir="d";
  const t=Date.now();
  if(!dir){ GP.dir=""; }
  else if(dir!==GP.dir){ GP.dir=dir; GP.rep=t+280; gpMove(dir); }
  else if(t>=GP.rep){ GP.rep=t+110; gpMove(dir); }
  /* 選択肢が出た／消えたときは、カーソルを置きなおす */
  const sc=gpScope();
  if(!sc){ if(GP.focus)gpClear(); }
  else if(!GP.focus||sc.items.indexOf(GP.focus)<0){
    if(sc.auto&&!GP.quiet)gpMark(sc.items[0]);
    else if(GP.focus)gpClear();
  }
}
function gpStart(){
  if(GP.timer)return;
  GP.timer=setInterval(()=>{try{gpPoll();}catch(e){}},70);
}
/* ゲーム画面では、右クリックのメニューを出さない。
   絵をかんたんに右クリック保存されないようにするためです。
   ※ 見えなくするだけで、本気で取ろうとする人は止められません
     （開発者ツールからは、どのみち中身が見えます）。
   名前を書きこむ入力欄では、コピー・貼りつけができるよう、ふつうどおり出します。 */
/* 右クリック（スマホは長押しではなく2本指メニュー）。
   ・会話中は「メッセージウィンドウを消す／戻す」。ノベルゲームのふつうの作法です
   ・それ以外の画面では、ブラウザのメニューを出さないだけ
   ・文字を入力する欄の上では、ふつうどおり右クリックできます */
addEventListener("contextmenu",e=>{
  const t=e.target;
  if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
  e.preventDefault();
  if(!S.vnOn)return;
  /* 窓（きろく・せってい・くわしく）が開いているあいだは、なにもしない */
  if(getComputedStyle($("modal")).display!=="none"||document.querySelector(".confirm"))return;
  se("click"); vnHide(!vnHidden());
});

addEventListener("gamepadconnected",()=>{ gpStart(); toast("ゲームパッドを認識しました"); });
addEventListener("gamepaddisconnected",()=>{ gpClear(); });
/* マウスやタップを使ったら、カーソルの枠は消す */
addEventListener("pointerdown",()=>{ GP.quiet=true; if(GP.focus)gpClear(); },true);
if(navigator.getGamepads)gpStart();

vnImgInit(); drawVnBar();
$("vnClose").onclick=e=>{ e.stopPropagation(); se("cancel"); vnHide(true); };
$("vnClose").onpointerdown=e=>e.stopPropagation();
/* ---- 昔の名前で保存されたデータの引っ越し --------------------------------
   このゲームは制作の途中まで「sakurazaka」という名前で作っていました。
   その名前で保存されたセーブ・称号・おまけの記録・設定がブラウザに残っていたら、
   いまの名前（starmate）へ**1回だけ写します**。もとのデータは消しません。

   新しい名前ですでに保存があるときは、何もしません（上書きしません）。
   ずっと先の版で、この処理ごと消してしまってかまいません
   （引っ越しずみの人には、もう関係がないためです）。 */
function migrateKeys(){
  const pairs=[[SAVEKEY,"sakurazaka_v1"], [OPTKEY,"sakurazaka_opt"],
               [SPEEDKEY,"sakurazaka_speed2"], [GALKEY,"sakurazaka_gal"]];
  try{
    for(const [now,old] of pairs){
      if(localStorage.getItem(now)!==null)continue;   /* 新しい方に既にある */
      const v=localStorage.getItem(old);
      if(v!==null)localStorage.setItem(now,v);
    }
  }catch(e){}
}
migrateKeys();
loadSpeed(); loadOpt();
applyVnArt();     /* assets/ui/ に置いたノベル画面の素材があれば、それを使う */
applyCmdArt();    /* コマンドのボタンの絵の、入れかたの設定 */
galLoad(); showTitle();
/* 音は、読みこんだ直後にいちど鳴らしてみる。
   ブラウザに止められた場合は、最初のクリック／タップ／キー入力で鳴りだす */
audioArm(); audioWake();
["psei","pmei"].forEach(id=>$(id).addEventListener("keydown",e=>{if(e.key==="Enter")$("startBtn").click();}));
redraw();
