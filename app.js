
(function(){
  const $ = s => document.querySelector(s);
  const todayISO = () => new Date().toISOString().slice(0,10);
  const startOfWeek = (d=new Date()) => { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; } // Monday
  const endOfWeek = (d=new Date()) => { const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
  const iso = d => new Date(d).toISOString().slice(0,10);

  const storeKey='solo_leveling_weekly_gate_pwa_v3_1';

  const defaultData = () => ({
    config:{ baseWorkout:50, baseChore:20, perMin:2, waterTarget:2.0,
      kw:{ strength:'strength, weights, gym, lift, deadlift, squat, bench, press', cardio:'run, cardio, bike, cycling, swim, row', walk:'walk, walking',
           vacuum:'vacuum, hoover', sweep:'sweep, broom', dust:'dust, dusting', bath:'bathroom, toilet, wc', read:'read, reading, book' }
    },
    workouts:[], chores:[], sessions:[], 
    nutrition:[], // {date, clean:bool, water:number}
    levelsCleared:0, lastWeekISO: iso(startOfWeek()),
  });

  const load = () => { try{ return JSON.parse(localStorage.getItem(storeKey)) || defaultData(); }catch(e){ return defaultData(); } };
  const save = (d) => localStorage.setItem(storeKey, JSON.stringify(d));
  let DATA = load();

  const parseKw = s => s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const inWeek = (dateStr, s, e) => { const d=new Date(dateStr); return d>=s && d<=e; };

  const wExp = w => (Number(w.duration||0) > 0 ? Number(w.duration)* (DATA.config.perMin||2) + Number(w.intensity||0)*10 : (Number(w.sets||0) > 0 ? Number(w.sets)*5 : DATA.config.baseWorkout||50));
  const cExp = c => (Number(c.pomodoros||0)*10 + Number(c.minutes||0)*0.5 + (DATA.config.baseChore||20));

  function weeklyStatus(when=new Date()){
    const s = startOfWeek(when), e = endOfWeek(when);
    const k = DATA.config.kw, K = {
      strength: parseKw(k.strength), cardio: parseKw(k.cardio), walk: parseKw(k.walk),
      vacuum: parseKw(k.vacuum), sweep: parseKw(k.sweep), dust: parseKw(k.dust), bath: parseKw(k.bath), read: parseKw(k.read)
    };
    const wThis = DATA.workouts.filter(w=>inWeek(w.date,s,e));
    const cThis = DATA.chores.filter(c=>inWeek(c.date,s,e));
    const containsKw = (text, arr) => { const t=(text||'').toLowerCase(); return arr.some(k=>t.includes(k)); };

    const strengthCount = wThis.filter(w=>containsKw(w.type, K.strength)).length;
    const totalWorkouts = wThis.length;
    const extraCount = Math.max(0, totalWorkouts - Math.min(strengthCount, 2));
    const extraDone = Math.min(1, extraCount);
    const hasWalk = wThis.some(w=>containsKw(w.type, K.walk));

    const hasVac = cThis.some(c=>containsKw(c.chore, K.vacuum));
    const hasSweep = cThis.some(c=>containsKw(c.chore, K.sweep));
    const hasDust = cThis.some(c=>containsKw(c.chore, K.dust));
    const hasBath = cThis.some(c=>containsKw(c.chore, K.bath));
    const cleanCount = [hasVac,hasSweep,hasDust,hasBath].filter(Boolean).length;

    const readMin = cThis.filter(c=>containsKw(c.chore, K.read)).reduce((a,c)=>a+Number(c.minutes||0),0);
    const readHours = Math.floor(readMin/60);

    const need = { strength2: strengthCount >= 2, extraWorkout: extraDone >= 1, fullClean: cleanCount === 4, oneWalk: hasWalk, read2h: readMin >= 120 };
    const counters = { strength: Math.min(2, strengthCount), extra: extraDone, clean: cleanCount, walk: hasWalk?1:0, readH: Math.min(2, readHours) };

    const allOk = Object.values(need).every(Boolean);
    return { need, counters, allOk, s, e };
  }

  function settlePreviousWeekIfNeeded(){
    const currentISO = iso(startOfWeek());
    if (DATA.lastWeekISO !== currentISO) {
      const prevMonday = new Date(DATA.lastWeekISO);
      const statusPrev = weeklyStatus(prevMonday);
      if (statusPrev.allOk) DATA.levelsCleared = Number(DATA.levelsCleared||0) + 1;
      DATA.lastWeekISO = currentISO; save(DATA);
    }
  }

  function totalSets(exs){ return exs.reduce((a,e)=>a+Number(e.sets||0),0); }
  function totalVolume(exs){ return exs.reduce((a,e)=>a+Number(e.volume||0),0); }

  // ---- Strength Session Builder (per-set simplified like v3.1) ----
  const PLANS = {
    A: { id:'A', name:'Back/Shoulder & Abs', intro:'Start: 5 min stairs. Choose ~3 back exercises, one lower-back, one shoulder, plus abs.',
      exercises:[ 'Stairs (warm-up 5 min)', 'Seated Cable Row', 'Pull-ups', 'Lat Pulldown', 'Lower Back (e.g., Back Extensions)', 'Shoulder (choice)', 'Abs' ] },
    B: { id:'B', name:'Chest/Calves & Shoulder + Abs', intro:'Start: 5 min stairs, warm-up. Then HS Bench, Pec Deck, Pullover, Shoulder (choice), Standing Calves, Abs.',
      exercises:[ 'Stairs (warm-up 5 min)', 'General Warm-up', 'Hammer Strength Bench Press', 'Pec Deck', 'Pullover', 'Shoulder (choice)', 'Standing Calves', 'Abs' ] }
  };
  let CURRENT=null;

  function startSession(){
    const pid = document.getElementById('planSelect').value; const plan = PLANS[pid];
    CURRENT = { date: document.getElementById('sessDate').value || todayISO(), planId: pid, notes:'',
      exercises: plan.exercises.map(n=>({name:n, sets:0, setList:[], volume:0})) };
    document.getElementById('sessionBox').style.display='block';
    document.getElementById('sessionIntro').textContent = `${plan.name} — ${plan.intro}`;
    renderSessionExercises();
  }
  function clearSession(){ CURRENT=null; document.getElementById('sessionBox').style.display='none'; document.getElementById('exercises').innerHTML=''; }

  function renderSessionExercises(){
    const box = document.getElementById('exercises'); box.innerHTML=''; if(!CURRENT) return;
    CURRENT.exercises.forEach((ex,i)=>{
      const row = document.createElement('div'); row.className='ex-row';
      const name = document.createElement('div'); name.className='ex-name'; name.textContent = ex.name; row.appendChild(name);
      const setsBox = document.createElement('div'); setsBox.className='ex-sets';
      const minus = document.createElement('button'); minus.className='btn secondary'; minus.textContent='−'; minus.onclick=()=>{ ex.sets=Math.max(0,(ex.sets||0)-1); renderSessionExercises(); };
      const cnt = document.createElement('span'); cnt.className='counter'; cnt.textContent = `${ex.sets||0} sets`;
      const plus = document.createElement('button'); plus.className='btn'; plus.textContent='+'; plus.onclick=()=>{ ex.sets=(ex.sets||0)+1; renderSessionExercises(); };
      setsBox.appendChild(minus); setsBox.appendChild(cnt); setsBox.appendChild(plus); row.appendChild(setsBox);
      box.appendChild(row);
    });
  }

  function saveSession(){
    if(!CURRENT) return; CURRENT.notes = document.getElementById('sessNotes').value.trim();
    DATA.sessions.push(CURRENT);
    const setsTotal = totalSets(CURRENT.exercises);
    DATA.workouts.push({ date: CURRENT.date, type: `Strength — Plan ${CURRENT.planId}`, duration: 0, sets: setsTotal, intensity: 0 });
    save(DATA); clearSession(); render();
  }

  function renderSessions(){
    const tb = document.querySelector('#sessionTable tbody'); tb.innerHTML='';
    DATA.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((s,idx)=>{
      const planName = PLANS[s.planId]?.name || s.planId; const exShort = s.exercises.map(e=>`${e.name} (${e.sets})`).join(', ');
      const tr=document.createElement('tr'); tr.innerHTML = `<td>${s.date}</td><td>${planName}</td><td>${totalSets(s.exercises)}</td><td>${Math.round(totalVolume(s.exercises))}</td><td></td><td><button class="btn secondary">✖</button></td>`; tr.querySelector('button').onclick=()=>{ DATA.sessions.splice(idx,1); save(DATA); render(); };
      tb.appendChild(tr);
    });
  }

  // ---- Clean Boy daily ----
  function upsertNutrition(date, clean, water){
    const idx = DATA.nutrition.findIndex(n=>n.date===date);
    const rec = {date, clean: !!clean, water: Number(water||0)};
    if(idx>=0) DATA.nutrition[idx] = rec; else DATA.nutrition.push(rec);
    save(DATA);
  }
  function getNutrition(date){ return DATA.nutrition.find(n=>n.date===date); }
  function isCleanBoy(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }

  function monthStats(year, month){ const daysInMonth = new Date(year, month+1, 0).getDate(); let count=0, streak=0, best=0; let prevClean=false; for(let d=1; d<=daysInMonth; d++){ const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good = isCleanBoy(getNutrition(ds)); if(good){ streak = prevClean? streak+1 : 1; count++; prevClean=true; } else { best = Math.max(best, streak); streak=0; prevClean=false; } } best = Math.max(best, streak); return {daysInMonth, count, best, streak}; }

  let cal = {year: new Date().getFullYear(), month: new Date().getMonth()};

  function renderCalendar(){
    const y = cal.year, m = cal.month;
    const first = new Date(y, m, 1);
    const days = new Date(y, m+1, 0).getDate();
    const jsDow = first.getDay();
    const offset = (jsDow+6)%7;
    document.getElementById('calTitle').textContent = first.toLocaleString(undefined,{month:'long', year:'numeric'});
    const head = document.getElementById('calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); });
    const grid = document.getElementById('calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ grid.appendChild(document.createElement('div')); }
    for(let d=1; d<=days; d++){
      const cell=document.createElement('div'); cell.className='day'; const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const rec = getNutrition(ds); const good = isCleanBoy(rec); const mark=document.createElement('span'); mark.className='mark ' + (rec? (good?'good':'bad') : 'none'); mark.textContent = rec? (good?'CB':'X') : '—'; const dn=document.createElement('div'); dn.className='d'; dn.textContent = d; cell.appendChild(dn); cell.appendChild(mark); cell.onclick=()=>{ document.getElementById('qDate').value = ds; document.getElementById('qClean').checked = !!(rec && rec.clean); document.getElementById('qWater').value = rec? rec.water: ''; updateWaterBar(); }; grid.appendChild(cell); }
    const st = monthStats(y,m); document.getElementById('qMonthCount').textContent = st.count; document.getElementById('qStreak').textContent = st.streak; document.getElementById('qBest').textContent = st.best;
  }

  function updateWaterBar(){ const target=Number(DATA.config.waterTarget||2.0); const date=document.getElementById('qDate').value || todayISO(); const rec=getNutrition(date) || {water:0}; const pct=Math.min(100, Math.round((Number(rec.water||0)/target)*100)); document.getElementById('waterBar').style.width = pct+'%'; document.getElementById('waterTargetHint').textContent = target.toFixed(1); }

  // ---- Generic render ----
  function render(){
    settlePreviousWeekIfNeeded();
    const now = new Date();
    const {need, counters, allOk, s, e} = weeklyStatus(now);

    const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0);
    const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0);
    const weekWExp = DATA.workouts.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+wExp(x),0);
    const weekCExp = DATA.chores.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+cExp(x),0);

    document.getElementById('levelsCleared').textContent = DATA.levelsCleared || 0;
    const gs = document.getElementById('gateStatus'); gs.textContent = allOk ? 'Gate Cleared ✅' : 'Gate Closed ⛔';
    document.getElementById('totalExp').textContent = Math.round(wExpTotal + cExpTotal);
    document.getElementById('weekExp').textContent = Math.round(weekWExp + weekCExp);
    document.getElementById('weekRange').textContent = `${iso(s)} → ${iso(e)}`;

    const ul = document.getElementById('mqList'); ul.innerHTML='';
    addQuestItem(ul, `Strength Workouts`, `${counters.strength}/2`, need.strength2);
    addQuestItem(ul, `Extra Workout (any/cardio)`, `${counters.extra}/1`, need.extraWorkout);
    addQuestItem(ul, `House Clean`, `${counters.clean}/4`, need.fullClean, {
      badges:[ {label:'Vacuum', ok: needBadge('vac')}, {label:'Sweep', ok: needBadge('sweep')}, {label:'Dust', ok: needBadge('dust')}, {label:'Bathroom', ok: needBadge('bath')} ]
    });
    addQuestItem(ul, `Walk`, `${counters.walk}/1`, need.oneWalk);
    addQuestItem(ul, `Reading`, `${counters.readH}/2`, need.read2h);

    renderWorkouts();
    renderChores();
    renderSessions();
    renderCalendar();
    updateWaterBar();
  }

  function needBadge(which){
    const k = DATA.config.kw, K = { vacuum: parseKw(k.vacuum), sweep: parseKw(k.sweep), dust: parseKw(k.dust), bath: parseKw(k.bath) };
    const s=startOfWeek(new Date()), e=endOfWeek(new Date());
    const cThis = DATA.chores.filter(c=>inWeek(c.date,s,e));
    const containsKw = (text, arr) => { const t=(text||'').toLowerCase(); return arr.some(k=>t.includes(k)); };
    if(which==='vac') return cThis.some(c=>containsKw(c.chore,K.vacuum));
    if(which==='sweep') return cThis.some(c=>containsKw(c.chore,K.sweep));
    if(which==='dust') return cThis.some(c=>containsKw(c.chore,K.dust));
    if(which==='bath') return cThis.some(c=>containsKw(c.chore,K.bath));
    return false;
  }

  function addQuestItem(ul, title, counter, ok, opts={}){
    const li=document.createElement('li'); li.className = ok? 'ok' : 'fail';
    const dot = document.createElement('span'); dot.className='dot'; li.appendChild(dot);
    const text = document.createTextNode(` ${title} — ${counter}`); li.appendChild(text);
    if(opts.badges){ const box = document.createElement('div'); box.className='subbadges'; opts.badges.forEach(b=>{ const sp=document.createElement('span'); sp.className='badge ' + (b.ok?'ok':'fail'); sp.textContent=b.label + (b.ok?' ✓':''); box.appendChild(sp); }); li.appendChild(box);} 
    ul.appendChild(li);
    return li;
  }

  function renderWorkouts(){
    const tb = document.querySelector('#workoutTable tbody'); tb.innerHTML='';
    DATA.workouts.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((w,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${w.date}</td><td>${w.type||''}</td><td>${w.duration||0}</td><td>${w.sets||0}</td><td>${w.intensity||0}</td><td>${Math.round(wExp(w))}</td><td><button class=\"btn secondary\">✖</button></td>`;
      tr.querySelector('button').addEventListener('click',()=>{ DATA.workouts.splice(idx,1); save(DATA); render(); });
      tb.appendChild(tr);
    });
  }

  function renderChores(){
    const tb = document.querySelector('#choreTable tbody'); tb.innerHTML='';
    DATA.chores.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((c,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${c.date}</td><td>${c.chore||''}</td><td>${c.pomodoros||0}</td><td>${c.minutes||0}</td><td>${Math.round(cExp(c))}</td><td><button class=\"btn secondary\">✖</button></td>`;
      tr.querySelector('button').addEventListener('click',()=>{ DATA.chores.splice(idx,1); save(DATA); render(); });
      tb.appendChild(tr);
    });
  }

  // Events
  document.getElementById('startSession').addEventListener('click', startSession);
  document.getElementById('clearSession').addEventListener('click', clearSession);
  document.getElementById('saveSession').addEventListener('click', saveSession);

  document.getElementById('addWorkout').addEventListener('click',()=>{
    const w={ date: document.getElementById('wDate').value || todayISO(), type: document.getElementById('wType').value.trim(), duration: Number(document.getElementById('wDur').value||0), sets: Number(document.getElementById('wSets').value||0), intensity: Number(document.getElementById('wIntens').value||0) };
    DATA.workouts.push(w); save(DATA);
    document.getElementById('wType').value=''; document.getElementById('wDur').value=''; document.getElementById('wSets').value=''; document.getElementById('wIntens').value='0';
    render();
  });

  document.getElementById('addChore').addEventListener('click',()=>{
    const c={ date: document.getElementById('cDate').value || todayISO(), chore: document.getElementById('cName').value.trim(), pomodoros: Number(document.getElementById('cPomo').value||0), minutes: Number(document.getElementById('cMin').value||0) };
    DATA.chores.push(c); save(DATA);
    document.getElementById('cName').value=''; document.getElementById('cPomo').value=''; document.getElementById('cMin').value='';
    render();
  });

  document.getElementById('qSave').addEventListener('click',()=>{
    const date = document.getElementById('qDate').value || todayISO();
    const clean = document.getElementById('qClean').checked;
    const water = Number(document.getElementById('qWater').value||0);
    upsertNutrition(date, clean, water); render();
  });

  document.getElementById('qAdd250').addEventListener('click',()=>{ document.getElementById('qWater').value = (Number(document.getElementById('qWater').value||0)+0.25).toFixed(2); });
  document.getElementById('qAdd500').addEventListener('click',()=>{ document.getElementById('qWater').value = (Number(document.getElementById('qWater').value||0)+0.5).toFixed(2); });

  document.getElementById('prevMonth').addEventListener('click',()=>{ cal.month--; if(cal.month<0){cal.month=11; cal.year--;} renderCalendar(); });
  document.getElementById('nextMonth').addEventListener('click',()=>{ cal.month++; if(cal.month>11){cal.month=0; cal.year++;} renderCalendar(); });

  document.getElementById('saveCfg').addEventListener('click',()=>{
    DATA.config.baseWorkout = Number(document.getElementById('cfgBaseWorkout').value||50);
    DATA.config.baseChore = Number(document.getElementById('cfgBaseChore').value||20);
    DATA.config.perMin = Number(document.getElementById('cfgPerMin').value||2);
    DATA.config.waterTarget = Number(document.getElementById('cfgWaterTarget').value||2.0);
    DATA.config.kw = {
      strength: document.getElementById('kwStrength').value, cardio: document.getElementById('kwCardio').value, walk: document.getElementById('kwWalk').value,
      vacuum: document.getElementById('kwVac').value, sweep: document.getElementById('kwSweep').value, dust: document.getElementById('kwDust').value, bath: document.getElementById('kwBath').value, read: document.getElementById('kwRead').value
    };
    save(DATA); alert('Settings saved.'); render();
  });

  document.getElementById('exportBtn').addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify(DATA,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'solo_leveling_weekly_pwa_v3_1_save.json'; a.click();
  });
  document.getElementById('importFile').addEventListener('change',(e)=>{
    const file = e.target.files[0]; if(!file) return; const fr = new FileReader();
    fr.onload = ()=>{ try{ const d=JSON.parse(fr.result); DATA=d; save(DATA); render(); alert('Import complete.'); }catch(err){ alert('Invalid file.'); } };
    fr.readAsText(file);
  });

  document.getElementById('resetAll').addEventListener('click',()=>{ if(confirm('Reset EVERYTHING?')){ DATA = defaultData(); save(DATA); render(); } });

  document.getElementById('keywordsBtn').addEventListener('click',()=>{ alert('Keywords are under Settings → Keyword Detection. Edit and Save.'); });

  // Init
  document.getElementById('sessDate').value = todayISO();
  document.getElementById('qDate').value = todayISO();

  render();
})();
