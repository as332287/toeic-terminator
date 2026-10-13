const QUESTION_FILES = [
  "data/questions-001-050.json",
  "data/questions-051-100.json",
  "data/questions-101-150.json",
  "data/questions-151-200.json",
  "data/questions-201-250.json",
  "data/questions-251-300.json",
  "data/questions-301-325.json",
  "data/questions-326-350.json",
  "data/questions-351-400.json",
  "data/questions-401-450.json",
  "data/questions-451-475.json",
  "data/questions-476-500.json",
  "data/questions-501-550.json",
  "data/questions-551-600.json",
  "data/questions-601-650.json",
  "data/questions-651-700.json",
  "data/questions-701-750.json",
  "data/questions-751-800.json"
];
const STORAGE_KEY = "toeic-terminator-progress-v1";
const ANALYSIS_CACHE = new Map();

const $ = (id) => document.getElementById(id);
const letters = ["A","B","C","D"];

let dataset = null;
let questions = [];
let filtered = [];
let currentId = 1;
let state = loadState();

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if(saved && typeof saved === "object"){
      return {
        answers: saved.answers || {},
        starred: Array.isArray(saved.starred) ? saved.starred : [],
        lastQuestion: Number(saved.lastQuestion) || 1,
        theme: saved.theme || "light"
      };
    }
  }catch{}
  return {answers:{},starred:[],lastQuestion:1,theme:"light"};
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function setTheme(theme){
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  saveState();
}
function byId(id){ return questions[id-1]; }
function responseFor(id){ return state.answers[String(id)] || null; }
function isStarred(id){ return state.starred.includes(id); }

function updateStats(){
  const entries = Object.entries(state.answers).filter(([id]) => Number(id)>=1 && Number(id)<=questions.length);
  const done = entries.length;
  const correct = entries.filter(([,a]) => a.correct).length;
  const wrong = done - correct;
  $("doneCount").textContent = done;
  $("correctCount").textContent = correct;
  $("wrongCount").textContent = wrong;
  $("accuracy").textContent = done ? Math.round(correct/done*100)+"%" : "0%";
  $("progressBar").style.width = (done/questions.length*100)+"%";
}

function questionsInSelectedRange(){
  const value = $("rangeSelect").value;
  if(value === "all") return [...questions];
  const [start,end] = value.split("-").map(Number);
  return questions.filter(q => q.id >= start && q.id <= end);
}

function applyFilter(mode){
  const ranged = questionsInSelectedRange();
  if(mode === "unanswered") filtered = ranged.filter(q => !responseFor(q.id));
  else if(mode === "wrong") filtered = ranged.filter(q => responseFor(q.id) && !responseFor(q.id).correct);
  else if(mode === "starred") filtered = ranged.filter(q => isStarred(q.id));
  else if(mode === "inferred") filtered = ranged.filter(q => q.answerSource === "model_inferred");
  else filtered = ranged;

  if(!filtered.some(q=>q.id===currentId)){
    currentId = filtered[0]?.id || currentId;
  }
  render();
}

function currentIndex(){
  return filtered.findIndex(q=>q.id===currentId);
}

function sourceBadge(q){
  if(q.answerSource === "reviewed_override") return "✓ 原答案疑誤・已校正";
  if(q.answerSource === "model_inferred"){
    const level = q.answerConfidence === "low" ? "低信心推定" : q.answerConfidence === "medium" ? "推定答案" : "推定答案";
    return "⚠ " + level;
  }
  return "原答案";
}

function renderEmpty(){
  $("qNumber").textContent = "沒有題目";
  $("answerSourceBadge").textContent = "";
  $("questionText").innerHTML = '<div class="empty">目前這個篩選沒有題目。</div>';
  $("optionList").innerHTML = "";
  $("resultBox").classList.add("hidden");
  $("analysisPanel").classList.add("hidden");
  $("prevBtn").disabled = true;
  $("nextBtn").disabled = true;
  $("retryBtn").classList.add("hidden");
}

async function render(){
  updateStats();
  if(!filtered.length){ renderEmpty(); return; }

  const q = byId(currentId);
  if(!q){ currentId = filtered[0].id; return render(); }

  state.lastQuestion = q.id;
  saveState();

  $("qNumber").textContent = `第 ${q.id} 題`;
  $("answerSourceBadge").textContent = sourceBadge(q);
  $("answerSourceBadge").title = q.answerSource === "model_inferred" ? "原答案檔缺漏或無效，這題答案由文法與語意推定" : "答案來自原始簡解檔";
  $("questionText").textContent = q.question;
  $("starBtn").textContent = isStarred(q.id) ? "★" : "☆";

  const saved = responseFor(q.id);
  $("optionList").innerHTML = "";
  q.options.forEach((text, i)=>{
    const label = letters[i];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "option";
    b.textContent = `${label}. ${text || "（原 PDF 空白）"}`;
    if(saved){
      b.disabled = true;
      if(label === q.answer) b.classList.add("correct");
      if(label === saved.choice && label !== q.answer) b.classList.add("wrong");
    }
    b.addEventListener("click",()=>answerQuestion(q,label));
    $("optionList").appendChild(b);
  });

  if(saved){
    showResult(q,saved);
    await showAnalysis(q);
    $("retryBtn").classList.remove("hidden");
  }else{
    $("resultBox").classList.add("hidden");
    $("analysisPanel").classList.add("hidden");
    $("retryBtn").classList.add("hidden");
  }

  const idx=currentIndex();
  $("prevBtn").disabled=idx<=0;
  $("nextBtn").disabled=idx<0 || idx>=filtered.length-1;
  $("datasetStatus").textContent = `題庫：${dataset.title}｜${questions.length} 題｜目前第 ${q.id} 題`;
}

function answerQuestion(q,choice){
  const correct = choice === q.answer;
  state.answers[String(q.id)] = {choice,correct,answeredAt:new Date().toISOString()};
  state.lastQuestion = q.id;
  saveState();
  render();
}

function showResult(q,saved){
  const box=$("resultBox");
  box.className="result "+(saved.correct?"good":"bad");
  box.innerHTML = saved.correct
    ? `✅ 答對了｜${q.answer}. ${q.options[letters.indexOf(q.answer)]}`
    : `❌ 答錯了｜你選 ${saved.choice}，正確答案是 ${q.answer}. ${q.options[letters.indexOf(q.answer)]}`;
}

function pad3(n){ return String(n).padStart(3,"0"); }
async function loadAnalysisChunk(id){
  const start = Math.floor((id-1)/50)*50+1;
  const end = Math.min(start+49,800);
  const key=`${start}-${end}`;
  if(ANALYSIS_CACHE.has(key)) return ANALYSIS_CACHE.get(key);
  try{
    const r=await fetch(`data/analysis-${pad3(start)}-${pad3(end)}.json`,{cache:"no-store"});
    if(!r.ok) throw new Error("analysis not found");
    const json=await r.json();
    ANALYSIS_CACHE.set(key,json);
    return json;
  }catch{
    const empty={};
    ANALYSIS_CACHE.set(key,empty);
    return empty;
  }
}

function fallbackAnalysis(q){
  const answerText=q.options[letters.indexOf(q.answer)] || q.answer;
  const completed=q.question.replace(/-{4,}/,answerText);
  return {
    translation:"這題的人工完整翻譯尚未載入；目前先顯示答案與來源註記。",
    skeleton:[completed],
    grammar:[
      q.answerNote || `本題依句意與搭配選 ${q.answer}. ${answerText}。`,
      "完整文法解析資料會以題號分批檔載入，不影響作答與進度保存。"
    ],
    vocab:[],
    options:q.options.map((term,i)=>({label:letters[i],term,meaning:"待補充",usage:""})),
    collocations:q.answerNote?[q.answerNote]:[],
    example:{en:"",zh:""}
  };
}

async function showAnalysis(q){
  const chunk=await loadAnalysisChunk(q.id);
  const a=chunk[String(q.id)] || fallbackAnalysis(q);
  $("translation").textContent=a.translation || "";
  $("skeleton").innerHTML=(a.skeleton||[]).map((s,i)=>`<div><strong>${i+1}.</strong> ${escapeHtml(s)}</div>`).join("");
  $("grammar").innerHTML=(a.grammar||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join("");
  $("vocabList").innerHTML=(a.vocab||[]).map(v=>wordCard(v)).join("") || '<div class="muted small">本題重點單字整理中。</div>';
  $("optionAnalysis").innerHTML=(a.options||[]).map(v=>optionCard(v,q.answer)).join("");
  $("collocations").innerHTML=(a.collocations||[]).map(s=>`<span class="chip">${escapeHtml(s)}</span>`).join("");
  $("exampleEn").textContent=a.example?.en || "";
  $("exampleZh").textContent=a.example?.zh || "";

  const issues=[...(q.sourceIssues||[])];
  if(q.answerSource==="model_inferred"){
    issues.push(`此題不是原答案：${q.answerNote || "依文法與語意推定"}（信心：${q.answerConfidence || "未標示"}）`);
  }
  if(a.sourceNote) issues.push(a.sourceNote);
  if(issues.length){
    $("sourceIssueBlock").classList.remove("hidden");
    $("sourceIssues").innerHTML=issues.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
  }else $("sourceIssueBlock").classList.add("hidden");

  $("analysisPanel").classList.remove("hidden");
}

function wordCard(v){
  return `<div class="word-card"><strong>${escapeHtml(v.term||"")}</strong> <span class="meta">${escapeHtml(v.pos||"")}</span><div>${escapeHtml(v.meaning||"")}</div><div class="meta">${escapeHtml(v.usage||"")}</div></div>`;
}
function optionCard(v,answer){
  const label=v.label||"";
  return `<div class="word-card ${label===answer?"correct-option":""}"><strong>${escapeHtml(label)}. ${escapeHtml(v.term||"")}</strong><div>${escapeHtml(v.meaning||"")}</div><div class="meta">${escapeHtml(v.usage||"")}</div></div>`;
}
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function move(delta){
  const idx=currentIndex();
  const next=filtered[idx+delta];
  if(next){currentId=next.id;render();window.scrollTo({top:0,behavior:"smooth"});}
}

$("prevBtn").addEventListener("click",()=>move(-1));
$("nextBtn").addEventListener("click",()=>move(1));
$("retryBtn").addEventListener("click",()=>{
  delete state.answers[String(currentId)];
  saveState();render();
});
$("starBtn").addEventListener("click",()=>{
  if(isStarred(currentId)) state.starred=state.starred.filter(x=>x!==currentId);
  else state.starred.push(currentId);
  saveState();render();
});
$("rangeSelect").addEventListener("change",()=>applyFilter($("modeSelect").value));
$("modeSelect").addEventListener("change",e=>applyFilter(e.target.value));
$("randomBtn").addEventListener("click",()=>{
  if(!filtered.length)return;
  currentId=filtered[Math.floor(Math.random()*filtered.length)].id;render();
});
$("jumpForm").addEventListener("submit",e=>{
  e.preventDefault();
  const n=Math.max(1,Math.min(800,Number($("jumpInput").value)||1));
  $("rangeSelect").value="all";
  $("modeSelect").value="all";
  filtered=[...questions];
  currentId=n;
  render();
});
$("resumeBtn").addEventListener("click",()=>{
  currentId=Math.max(1,Math.min(800,state.lastQuestion||1));
  $("resumeCard").classList.add("hidden");render();
});
$("collapseAnalysis").addEventListener("click",()=>{
  $("analysisPanel").classList.add("hidden");
});
$("themeBtn").addEventListener("click",()=>setTheme(state.theme==="dark"?"light":"dark"));

$("exportBtn").addEventListener("click",()=>{
  const payload={version:1,exportedAt:new Date().toISOString(),progress:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`toeic-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("importInput").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    const p=data.progress||data;
    if(!p || typeof p!=="object")throw new Error();
    state={answers:p.answers||{},starred:Array.isArray(p.starred)?p.starred:[],lastQuestion:Number(p.lastQuestion)||1,theme:p.theme||state.theme};
    saveState();
    setTheme(state.theme);
    currentId=state.lastQuestion;
    filtered=[...questions];
    $("rangeSelect").value="all";
    $("modeSelect").value="all";
    render();
    alert("進度匯入完成");
  }catch{alert("這個進度檔格式無法讀取");}
  e.target.value="";
});
$("resetBtn").addEventListener("click",()=>{
  if(!confirm("確定要清除全部作答、錯題與收藏紀錄嗎？"))return;
  state={answers:{},starred:[],lastQuestion:1,theme:state.theme};
  saveState();
  currentId=1;
  filtered=[...questions];
  $("rangeSelect").value="all";
  $("modeSelect").value="all";
  render();
});

function refreshInstallHint(){
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(standalone){
    $("installHint").textContent="已加入主畫面，可直接像 App 一樣開啟。";
  }else if(isiOS){
    $("installHint").textContent="iPhone：Safari 分享 →「加入主畫面」，之後可像 App 一樣開啟。";
  }else{
    $("installHint").textContent="用瀏覽器的「安裝應用程式／加入主畫面」即可像 App 一樣開啟。";
  }
}

async function setupOffline(){
  refreshInstallHint();
  if(!navigator.onLine) $("offlineStatus").textContent="📴 目前正在離線使用題庫。";
  window.addEventListener("offline",()=>{$("offlineStatus").textContent="📴 目前正在離線使用題庫。";});
  window.addEventListener("online",()=>{$("offlineStatus").textContent="✅ 已恢復連線；離線題庫仍保留在手機。";});

  const secureEnough = location.protocol==="https:" || location.hostname==="localhost" || location.hostname==="127.0.0.1";
  if(!("serviceWorker" in navigator) || !secureEnough){
    $("offlineStatus").textContent="發布到 HTTPS 網址後，第一次開啟會自動下載 800 題與全部解析供離線使用。";
    return;
  }

  try{
    $("offlineStatus").textContent="正在下載 800 題與全部解析到裝置…";
    await navigator.serviceWorker.register("service-worker.js");
    await navigator.serviceWorker.ready;
    $("offlineStatus").textContent="✅ 800 題＋全部解析已下載，可離線使用。";
  }catch(err){
    $("offlineStatus").textContent="離線題庫下載失敗，重新整理後會再次嘗試。";
  }
}

async function init(){
  setTheme(state.theme);
  try{
    const parts=await Promise.all(QUESTION_FILES.map(async url=>{
      const r=await fetch(url,{cache:"no-store"});
      if(!r.ok)throw new Error(`HTTP ${r.status}：${url}`);
      return r.json();
    }));
    questions=parts.flatMap(part=>part.questions||[]).sort((a,b)=>a.id-b.id);
    dataset={title:parts[0]?.title||"多益剋星｜800 字彙",questions};
    filtered=[...questions];
    currentId=Math.max(1,Math.min(questions.length,state.lastQuestion||1));
    if(Object.keys(state.answers).length || state.lastQuestion>1){
      $("resumeCard").classList.remove("hidden");
      $("resumeText").textContent=`上次停在第 ${state.lastQuestion} 題，已完成 ${Object.keys(state.answers).length} 題`;
    }
    render();
    setupOffline();
  }catch(err){
    $("datasetStatus").textContent="題庫載入失敗："+err.message;
    $("questionText").textContent="請用 start.bat 啟動題庫，不要直接雙擊 index.html。";
  }
}
init();
