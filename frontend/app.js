const $=id=>document.getElementById(id);
const API=window.location.origin;
const HISTORY_KEY="routeforge-history-v2";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function setHealth(ok){$("health").className=`health ${ok?"ok":"bad"}`;$(`health`).innerHTML=`<span class="pulse"></span><span>${ok?"Router online":"Router offline"}</span>`}
async function health(){try{const r=await fetch(`${API}/healthz`,{cache:"no-store"});setHealth(r.ok)}catch{setHealth(false)}}
function loadHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]")}catch{return[]}}
function saveHistory(item){const h=[item,...loadHistory()].slice(0,8);localStorage.setItem(HISTORY_KEY,JSON.stringify(h));renderHistory()}
function renderHistory(){const h=loadHistory();$("historyList").innerHTML=h.length?h.map(x=>`<article class="history-item"><p>${esc(x.prompt)}</p><footer><b>${esc(x.model)}</b><span>${esc(x.mode)} · ${esc(x.time)}</span></footer></article>`).join(""):`<div class="empty-history">Your recent routing decisions will appear here.</div>`}
function costLabel(v){const n=Number(v);return `${n<34?"Quality first":n>66?"Cost first":"Balanced"} · ${n}%`}
function setLoading(on){const b=$("routeBtn");b.disabled=on;b.querySelector(".btn-icon").textContent=on?"…":"↗";b.querySelector(".btn-label").textContent=on?"Routing…":"Route prompt"}
function showError(msg){$("error").textContent=msg;$("error").hidden=false}
function animateDecision(body){
  $("result").hidden=false;
  $("result").scrollIntoView({behavior:"smooth",block:"nearest"});
  $("selectedModel").textContent=body.selected_model;
  $("mode").textContent=body.policy.selection_mode;
  $("latency").textContent=`${Number(body.routing_latency_ms).toFixed(2)} ms`;
  const selected=body.candidates.find(c=>c.model===body.selected_model)||body.candidates[0];
  $("quality").textContent=selected?`${(selected.predicted_quality*100).toFixed(1)}%`:"—";
  $("utility").textContent=selected?selected.utility.toFixed(4):"—";
  $("candidateCount").textContent=`${body.candidates.length} candidates`;
  $("requestId").textContent=body.request_id;
  $("resultTime").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  const max=Math.max(...body.candidates.map(c=>c.utility),0.0001);
  $("candidates").innerHTML=body.candidates.map((c,i)=>`<div class="candidate ${c.model===body.selected_model?"selected":""}" style="animation-delay:${Math.min(i*45,450)}ms"><span class="rank">${String(i+1).padStart(2,"0")}</span><span class="name" title="${esc(c.model)}">${esc(c.model)}</span><span class="q">${(c.predicted_quality*100).toFixed(1)}%</span><span class="u">${c.utility.toFixed(4)}</span><span></span><span class="bar"><i style="width:${Math.max(3,c.utility/max*100)}%"></i></span><span></span><span></span></div>`).join("");
}
async function route(){
 const prompt=$("prompt").value;$("error").hidden=true;
 if(!prompt.trim()){showError("Enter a prompt before routing.");$("prompt").focus();return}
 setLoading(true);
 try{
  const r=await fetch(`${API}/v1/route`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,metadata:{cost_saving_preference:Number($("cost").value),request_id:crypto.randomUUID()}})});
  let body;try{body=await r.json()}catch{throw new Error("Router returned an invalid response.")}
  if(!r.ok)throw new Error(body.detail||"Router rejected the request.");
  animateDecision(body);
  saveHistory({prompt:prompt.trim().slice(0,150),model:body.selected_model,mode:body.policy.selection_mode,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});
 }catch(e){showError(e.message||"Unable to reach RouteForge. Check that the router is running.")}
 finally{setLoading(false)}
}
$("prompt").addEventListener("input",e=>{$("charCount").textContent=`${e.target.value.length.toLocaleString()} / 200k`});
$("cost").addEventListener("input",e=>{$("costValue").textContent=costLabel(e.target.value)});
$("routeBtn").addEventListener("click",route);
$("prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();route()}});
$("clearHistory").addEventListener("click",()=>{localStorage.removeItem(HISTORY_KEY);renderHistory()});
renderHistory();health();setInterval(health,15000);
