// Forming Paws demo — seeded data, client-side only.
// Production build swaps this for the Supabase backend (profiles, storage, realtime chat).

const DOGS = [
  {id:1, name:"Luna", breed:"Golden Retriever", sex:"F", age:3, weight:62, dist:4,  verified:true,  emoji:"🦮", grad:["#f6b26b","#e8734a"], temperament:["Gentle","Social","Eager to please"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["DNA panel","ok"]], bio:"Sweet-natured Golden with champion bloodlines and a full health vault. Loves water, kids, and long fetch sessions."},
  {id:2, name:"Duke", breed:"German Shepherd", sex:"M", age:4, weight:78, dist:7,  verified:true,  emoji:"🐕‍🦺", grad:["#8d6e63","#4e342e"], temperament:["Loyal","Confident","Trainable"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["Degenerative myelopathy test","ok"]], bio:"Working-line Shepherd with excellent structure and verified hip scores. Calm around other dogs, superb temperament."},
  {id:3, name:"Bella", breed:"French Bulldog", sex:"F", age:2, weight:24, dist:3,  verified:true,  emoji:"🐶", grad:["#b0a1c9","#7e6ba0"], temperament:["Playful","Affectionate","Adaptable"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["BOAS respiratory assessment","ok"],["Spine X-ray","ok"]], bio:"Health-tested Frenchie — including the breathing assessment most listings skip. Compact, cheerful, and city-proof."},
  {id:4, name:"Rocky", breed:"Labrador Retriever", sex:"M", age:5, weight:74, dist:11, verified:true, emoji:"🦴", grad:["#f9d976","#f39c12"], temperament:["Steady","Friendly","Food-driven"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["EIC test","ok"]], bio:"Proven sire with two healthy litters on record. Classic Lab temperament — patient, gentle, endlessly good-natured."},
  {id:5, name:"Daisy", breed:"Poodle (Standard)", sex:"F", age:3, weight:48, dist:9, verified:true, emoji:"🐩", grad:["#f8bbd0","#e57398"], temperament:["Smart","Elegant","Athletic"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["PRA eye test","ok"]], bio:"Standard Poodle with clear eye tests and a show-quality coat. Whip-smart and wonderful with new people."},
  {id:6, name:"Zeus", breed:"Siberian Husky", sex:"M", age:2, weight:55, dist:15, verified:false, emoji:"🐺", grad:["#90caf9","#4a7ab5"], temperament:["Energetic","Vocal","Adventurous"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","pend"],["Eye exam","pend"]], bio:"Gorgeous bi-eyed Husky. Health verification in progress — hip and eye results expected soon via our vet partner program."},
  {id:7, name:"Rosie", breed:"Golden Retriever", sex:"F", age:4, weight:60, dist:18, verified:true, emoji:"🦮", grad:["#ffcc80","#ef8f4e"], temperament:["Calm","Nurturing","Devoted"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["Cardiac exam","ok"]], bio:"Experienced mom of one healthy litter. Full cardiac clearance — rare and valuable in the breed."},
  {id:8, name:"Bruno", breed:"French Bulldog", sex:"M", age:3, weight:27, dist:22, verified:false, emoji:"🐶", grad:["#bcaaa4","#795548"], temperament:["Chill","Comical","Cuddly"], health:[["Vet wellness exam","ok"],["Vaccinations","pend"],["BOAS respiratory assessment","pend"],["Spine X-ray","pend"]], bio:"Charming brindle Frenchie enrolled in our Get-Healthy pathway — vet visits scheduled, verification pending."},
  {id:9, name:"Maple", breed:"Labrador Retriever", sex:"F", age:2, weight:63, dist:27, verified:true, emoji:"🦴", grad:["#d7a86e","#a86b32"], temperament:["Sweet","Curious","Gentle"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["EIC test","ok"]], bio:"Fox-red Lab from health-focused lines. First-time listing from a family home, fully documented."},
  {id:10,name:"Apollo", breed:"Poodle (Standard)", sex:"M", age:4, weight:52, dist:31, verified:true, emoji:"🐩", grad:["#cfd8dc","#78909c"], temperament:["Poised","Clever","Social"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["PRA eye test","ok"]], bio:"Silver Standard Poodle, AKC registered, clear on every breed-recommended screen."},
  {id:11,name:"Nova", breed:"Siberian Husky", sex:"F", age:3, weight:44, dist:36, verified:true, emoji:"🐺", grad:["#b3e5fc","#5a9bd4"], temperament:["Spirited","Independent","Affectionate"], health:[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["Eye exam","ok"]], bio:"Stunning grey-and-white Husky with full clearances and a marathon engine. Loves cold mornings and new friends."},
  {id:12,name:"Tank", breed:"German Shepherd", sex:"M", age:6, weight:82, dist:42, verified:false, emoji:"🐕‍🦺", grad:["#a1887f","#5d4037"], temperament:["Protective","Mellow","Experienced"], health:[["Vet wellness exam","pend"],["Vaccinations","ok"],["OFA hips & elbows","pend"],["DM test","pend"]], bio:"Retired working dog, new to the platform. Currently completing baseline verification with a partner vet."},
];

const $ = id => document.getElementById(id);
const interested = new Set(JSON.parse(localStorage.getItem("fp_interest") || "[]"));
// Demo: these dogs' owners have already "liked" you, so interest becomes an instant match.
const LIKES_YOU = new Set([1, 3, 4, 7, 11]);

function saveInterest(){ localStorage.setItem("fp_interest", JSON.stringify([...interested])); }
function isMatch(id){ return interested.has(id) && LIKES_YOU.has(id); }

/* ---------- filters ---------- */
const breeds = [...new Set(DOGS.map(d => d.breed))].sort();
breeds.forEach(b => { const o = document.createElement("option"); o.value = b; o.textContent = b; $("fBreed").appendChild(o); });
["fBreed","fSex","fVerified"].forEach(id => $(id).addEventListener("change", render));
$("fDist").addEventListener("input", () => { $("distVal").textContent = $("fDist").value; render(); });

function filtered(){
  return DOGS.filter(d =>
    (!$("fBreed").value || d.breed === $("fBreed").value) &&
    (!$("fSex").value || d.sex === $("fSex").value) &&
    d.dist <= +$("fDist").value &&
    (!$("fVerified").checked || d.verified)
  );
}

/* ---------- grid ---------- */
function photoDiv(d, cls){
  return `<div class="${cls}" style="background:linear-gradient(135deg,${d.grad[0]},${d.grad[1]})">
    <span class="badge ${d.verified ? "" : "pending"}">${d.verified ? "✅ Health Verified" : "🕓 Verification Pending"}</span>
    ${d.emoji}
    <span class="dist">${d.dist} mi</span>
  </div>`;
}

function render(){
  const list = filtered();
  $("count").textContent = `${list.length} dog${list.length === 1 ? "" : "s"} found`;
  $("grid").innerHTML = list.length ? list.map(d => `
    <div class="dog-card" data-id="${d.id}">
      ${photoDiv(d, "dog-photo")}
      <div class="dog-body">
        <div class="dog-name">${d.name} <span class="dog-sex">${d.sex === "M" ? "♂" : "♀"}</span></div>
        <div class="dog-meta">${d.breed} · ${d.age} yrs · ${d.weight} lb</div>
        <div class="dog-actions">
          ${actionBtn(d)}
          <button class="btn btn-outline btn-view" data-id="${d.id}">View</button>
        </div>
      </div>
    </div>`).join("")
    : `<div class="empty"><span>🐾</span>No dogs match those filters — try widening the distance.</div>`;
}

function actionBtn(d){
  if (isMatch(d.id)) return `<button class="btn btn-matched btn-chat" data-id="${d.id}">💬 Chat</button>`;
  if (interested.has(d.id)) return `<button class="btn btn-outline btn-interest" data-id="${d.id}">✓ Interested</button>`;
  return `<button class="btn btn-primary btn-interest" data-id="${d.id}">🐾 Interested</button>`;
}

$("grid").addEventListener("click", e => {
  const interestBtn = e.target.closest(".btn-interest");
  const chatBtn = e.target.closest(".btn-chat");
  const viewBtn = e.target.closest(".btn-view");
  if (interestBtn) return toggleInterest(+interestBtn.dataset.id);
  if (chatBtn) return openChat(+chatBtn.dataset.id);
  if (viewBtn) return openModal(+viewBtn.dataset.id);
  const card = e.target.closest(".dog-card");
  if (card) openModal(+card.dataset.id);
});

function toggleInterest(id){
  if (interested.has(id)) { interested.delete(id); }
  else {
    interested.add(id);
    if (LIKES_YOU.has(id)) {
      const t = $("toast");
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2600);
      setTimeout(() => openChat(id), 900);
    }
  }
  saveInterest(); render();
}

/* ---------- modal ---------- */
function openModal(id){
  const d = DOGS.find(x => x.id === id);
  $("modal").innerHTML = `
    <button class="modal-close" id="mClose">✕</button>
    ${photoDiv(d, "dog-photo")}
    <div class="modal-body">
      <h2>${d.name} <span class="dog-sex">${d.sex === "M" ? "♂" : "♀"}</span></h2>
      <div class="dog-meta">${d.breed} · ${d.age} yrs · ${d.weight} lb · ~${d.dist} miles away</div>
      <p style="font-size:.95rem">${d.bio}</p>
      <div class="chips">${d.temperament.map(t => `<span class="chip">${t}</span>`).join("")}</div>
      <div class="health-list">
        <div style="font-weight:800;padding-bottom:6px">🩺 Health vault</div>
        ${d.health.map(([n, s]) => `<div><span>${n}</span><span class="${s}">${s === "ok" ? "Verified ✓" : "Pending…"}</span></div>`).join("")}
      </div>
      <div class="dog-actions">${actionBtn(d)}</div>
      ${d.verified ? "" : `<p style="font-size:.8rem;color:var(--ink-soft);margin-top:12px">Matching unlocks once this dog's baseline health documents are verified. Owner has been referred to a partner vet.</p>`}
    </div>`;
  $("modalBg").classList.add("open");
  $("mClose").onclick = closeModal;
  $("modal").querySelector(".btn-interest")?.addEventListener("click", ev => { toggleInterest(+ev.target.dataset.id); closeModal(); });
  $("modal").querySelector(".btn-chat")?.addEventListener("click", ev => { closeModal(); openChat(+ev.target.dataset.id); });
}
function closeModal(){ $("modalBg").classList.remove("open"); }
$("modalBg").addEventListener("click", e => { if (e.target === $("modalBg")) closeModal(); });

/* ---------- chat ---------- */
const CHAT_SEED = {
  1:["Hi! Luna's owner here — saw the mutual interest 🐾","Her OFA results are in her vault, happy to walk through them."],
  3:["Hello! Bella says hi 🐶","We're free weekends if you'd like to meet at Riverside Dog Park."],
  4:["Rocky's dad here — he's sired two healthy litters, records are all uploaded.","What's your timeline looking like?"],
  7:["Hi there! Rosie is such a sweetheart, excited we matched.","Her cardiac clearance just got re-verified last month."],
  11:["Hey! Nova's owner — love your profile.","She's due for a heat cycle in about 6 weeks if timing works."],
};
let chatWith = null;

function openChat(id){
  const d = DOGS.find(x => x.id === id);
  if (!isMatch(id)) return;
  chatWith = id;
  $("chatName").textContent = `${d.name}'s owner`;
  const stored = JSON.parse(localStorage.getItem("fp_chat_" + id) || "null");
  const msgs = stored || (CHAT_SEED[id] || ["Hi! Thanks for the match 🐾"]).map(t => ({who:"them", t}));
  if (!stored) localStorage.setItem("fp_chat_" + id, JSON.stringify(msgs));
  renderChat(msgs);
  $("chat").classList.add("open");
  $("chatText").focus();
}
function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function renderChat(msgs){
  $("chatMsgs").innerHTML = msgs.map(m => `<div class="msg ${m.who}">${escapeHtml(m.t)}</div>`).join("");
  $("chatMsgs").scrollTop = $("chatMsgs").scrollHeight;
}
function sendMsg(){
  const txt = $("chatText").value.trim();
  if (!txt || chatWith == null) return;
  const key = "fp_chat_" + chatWith;
  const msgs = JSON.parse(localStorage.getItem(key) || "[]");
  msgs.push({who:"me", t:txt});
  localStorage.setItem(key, JSON.stringify(msgs));
  $("chatText").value = "";
  renderChat(msgs);
  setTimeout(() => {
    msgs.push({who:"them", t:"Sounds great — let's set up a meet at a neutral spot. I'll bring the vet records! 🐾"});
    localStorage.setItem(key, JSON.stringify(msgs));
    renderChat(msgs);
  }, 1200);
}
$("chatSend").addEventListener("click", sendMsg);
$("chatText").addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });
$("chatClose").addEventListener("click", () => $("chat").classList.remove("open"));

render();
