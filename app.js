
(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const startOfWeek = (d=new Date()) => { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; } // Monday
  const endOfWeek = (d=new Date()) => { const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
  const iso = d => new Date(d).toISOString().slice(0,10);
  const vibrate = (ms=18) => { try{ navigator.vibrate && navigator.vibrate(ms);}catch(_){}}

  const storeKey='solo_leveling_weekly_gate_pwa_v3_1'; // keep same to preserve data

  const defaultData = () => ({
    config:{ baseWorkout:50, baseChore:20, perMin:2, waterTarget:2.0,
      kw:{ strength:'strength, weights, gym, lift, deadlift, squat, bench, press', cardio:'run, cardio, bike, cycling, swim, row', walk:'walk, walking',
           vacuum:'vacuum, hoover', sweep:'sweep, broom', dust:'dust, dusting', bath:'bathroom, toilet, wc', read:'read, reading, book' }
    },
    workouts:[], chores:[], sessions:[], nutrition:[], levelsCleared:0, lastWeekISO: iso(startOfWeek()),
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

  // -------- Spotlight (focus mode) --------
  let focusMode = false; let focusedEl = null;
  function toggleFocus(el){
    const cards = $$('#wrapRoot [data-spotlight], details.card');
    if(!focusMode){ focusMode = true; focusedEl = el; el.classList.add('focus-on'); cards.filter(x=>x!==el).forEach(x=>x.classList.add('focus-dim')); }
    else if (focusedEl===el){ focusMode=false; cards.forEach(x=>{x.classList.remove('focus-dim','focus-on')}); focusedEl=null; }
    else { cards.forEach(x=>x.classList.remove('focus-on')); el.classList.add('focus-on'); focusedEl=el; }
  }
  $$('#wrapRoot [data-spotlight], details.card').forEach(el=>{
    el.addEventListener('click', (e)=>{ if(e.target.closest('button, input, select, textarea, table, .chip')) return; toggleFocus(el); });
  });
  $('#focusToggle').addEventListener('click', ()=> toggleFocus($('#weeklyCard')));

  // -------- Strength session --------
  const PLANS = {
    A: { id:'A', name:'Back/Shoulder & Abs', intro:'Start: 5 min stairs. Choose ~3 back exercises, one lower-back, one shoulder, plus abs.',
      exercises:[ 'Stairs (warm-up 5 min)', 'Seated Cable Row', 'Pull-ups', 'Lat Pulldown', 'Lower Back (e.g., Back Extensions)', 'Shoulder (choice)', 'Abs' ] },
    B: { id:'B', name:'Chest/Calves & Shoulder + Abs', intro:'Start: 5 min stairs, warm-up. Then HS Bench, Pec Deck, Pullover, Shoulder (choice), Standing Calves, Abs.',
      exercises:[ 'Stairs (warm-up 5 min)', 'General Warm-up', 'Hammer Strength Bench Press', 'Pec Deck', 'Pullover', 'Shoulder (choice)', 'Standing Calves', 'Abs' ] }
  };
  let CURRENT=null;

  function startSession(){
    const pid = $('#planSelect').value; const plan = PLANS[pid];
    CURRENT = { date: $('#sessDate').value || todayISO(), planId: pid, notes:'', exercises: plan.exercises.map(n=>({name:n, sets:0, volume:0})) };
    $('#sessionBox').style.display='block';
    $('#sessionIntro').textContent = `${plan.name} — ${plan.intro}`;
    renderSessionExercises(); vibrate();
  }
  function clearSession(){ CURRENT=null; $('#sessionBox').style.display='none'; $('#exercises').innerHTML=''; vibrate(); }

  function renderSessionExercises(){
    const box = $('#exercises'); box.innerHTML=''; if(!CURRENT) return;
    CURRENT.exercises.forEach((ex)=>{
      const row = document.createElement('div'); row.className='ex-row';
      const name = document.createElement('div'); name.className='ex-name'; name.textContent = ex.name; row.appendChild(name);
      const setsBox = document.createElement('div'); setsBox.className='ex-sets';
      const minus = document.createElement('button'); minus.className='btn secondary'; minus.textContent='−'; minus.onclick=()=>{ ex.sets=Math.max(0,(ex.sets||0)-1); renderSessionExercises(); vibrate(); };
      const cnt = document.createElement('span'); cnt.className='counter'; cnt.textContent = `${ex.sets||0} sets`;
      const plus = document.createElement('button'); plus.className='btn'; plus.textContent='+'; plus.onclick=()=>{ ex.sets=(ex.sets||0)+1; renderSessionExercises(); vibrate(); };
      setsBox.appendChild(minus); setsBox.appendChild(cnt); setsBox.appendChild(plus); row.appendChild(setsBox); box.appendChild(row);
    });
  }

  function totalSets(exs){ return exs.reduce((a,e)=>a+Number(e.sets||0),0); }
  function totalVolume(exs){ return exs.reduce((a,e)=>a+Number(e.volume||0),0); }

  function saveSession(){
    if(!CURRENT) return; CURRENT.notes = $('#sessNotes').value.trim();
    DATA.sessions.push(CURRENT);
    const setsTotal = totalSets(CURRENT.exercises);
    DATA.workouts.push({ date: CURRENT.date, type: `Strength — Plan ${CURRENT.planId}`, duration: 0, sets: setsTotal, intensity: 0 });
    save(DATA); clearSession(); render(); vibrate();
  }

  $('#startSession').addEventListener('click', startSession);
  $('#clearSession').addEventListener('click', clearSession);
  $('#saveSession').addEventListener('click', saveSession);

  // Quick +1 Set
  $('#quickSetBtn').addEventListener('click', ()=>{
    DATA.workouts.push({ date: todayISO(), type: 'Strength — Quick', duration: 0, sets: 1, intensity: 0 });
    save(DATA); render(); vibrate();
  });

  function renderSessions(){
    const tb = document.querySelector('#sessionTable tbody'); tb.innerHTML='';
    DATA.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((s,idx)=>{
      const planName = PLANS[s.planId]?.name || s.planId; const vol = totalVolume(s.exercises);
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${s.date}</td><td>${planName}</td><td>${totalSets(s.exercises)}</td><td>${Math.round(vol)} kg</td><td></td><td><button class="btn secondary">✖</button></td>`;
      tr.querySelector('button').onclick=()=>{ DATA.sessions.splice(idx,1); save(DATA); render(); };
      tb.appendChild(tr);
    });
  }

  // -------- Clean Boy / Water --------
  function upsertNutrition(date, clean, water){
    const idx = DATA.nutrition.findIndex(n=>n.date===date); const rec = {date, clean: !!clean, water: Number(water||0)}; if(idx>=0) DATA.nutrition[idx]=rec; else DATA.nutrition.push(rec); save(DATA);
  }
  function getNutrition(date){ return DATA.nutrition.find(n=>n.date===date); }
  function isCleanBoy(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }

  function monthStats(year, month){ const daysInMonth = new Date(year, month+1, 0).getDate(); let count=0, streak=0, best=0; for(let d=1; d<=daysInMonth; d++){ const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good = isCleanBoy(getNutrition(ds)); if(good){ streak++; count++; best=Math.max(best, streak);} else { streak=0; } } return {count, best, streak}; }

  function addWaterML(ml){ const addL = Number(ml)/1000; const date = $('#qDate').value || todayISO(); const existing = getNutrition(date) || {date, clean:false, water:0}; const newVal = Number(existing.water||0) + addL; upsertNutrition(date, existing.clean, newVal); $('#qWater').value = newVal.toFixed(2); updateWaterBar(); vibrate(); }

  // attach micro buttons (both in Clean Boy card and Dock)
  $$('button[data-ml], .chip[data-ml]').forEach(b=> b.addEventListener('click', ()=> addWaterML(b.getAttribute('data-ml'))));

  $('#waterCustomBtn').addEventListener('click', ()=>{
    const v = prompt('Add water (ml):','200'); if(!v) return; const n = Number(v); if(!isNaN(n) && n>0) addWaterML(n);
  });

  $('#qSave').addEventListener('click',()=>{ const date=$('#qDate').value||todayISO(); const clean=$('#qClean').checked; const water=Number($('#qWater').value||0); upsertNutrition(date, clean, water); render(); vibrate(); });

  function renderCalendar(){
    const y=cal.year, m=cal.month; const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const jsDow=first.getDay(); const offset=(jsDow+6)%7; $('#calTitle').textContent = first.toLocaleString(undefined,{month:'long', year:'numeric'});
    const head=$('#calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); });
    const grid=$('#calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ grid.appendChild(document.createElement('div')); }
    for(let d=1; d<=days; d++){
      const cell=document.createElement('div'); cell.className='day'; const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const rec = getNutrition(ds); const good = isCleanBoy(rec);
      const mark = document.createElement('span'); mark.className='mark ' + (rec? (good?'good':'bad') : 'none'); mark.textContent = rec? (good?'CB':'X') : '—'; const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; cell.appendChild(dn); cell.appendChild(mark);
      cell.onclick=()=>{ $('#qDate').value = ds; $('#qClean').checked = !!(rec && rec.clean); $('#qWater').value = rec? rec.water : ''; updateWaterBar(); };
      grid.appendChild(cell);
    }
    const st=monthStats(y,m); $('#qMonthCount').textContent=st.count; $('#qStreak').textContent=st.streak; $('#qBest').textContent=st.best;
  }

  function updateWaterBar(){ const target = Number(DATA.config.waterTarget||2.0); const date = $('#qDate').value || todayISO(); const rec = getNutrition(date) || {water:0,clean:false}; const pct = Math.min(100, Math.round((Number(rec.water||0)/target)*100)); $('#waterBar').style.width = pct+'%'; $('#waterTargetLbl').textContent = target.toFixed(1); }

  // -------- Freeform Logs --------
  $('#addWorkout').addEventListener('click',()=>{
    const w={ date: $('#wDate').value || todayISO(), type: $('#wType').value.trim(), duration: Number($('#wDur').value||0), sets: Number($('#wSets').value||0), intensity: Number($('#wIntens').value||0) };
    DATA.workouts.push(w); save(DATA); $('#wType').value=''; $('#wDur').value=''; $('#wSets').value=''; $('#wIntens').value='0'; render(); vibrate();
  });
  $('#addChore').addEventListener('click',()=>{
    const c={ date: $('#cDate').value || todayISO(), chore: $('#cName').value.trim(), pomodoros: Number($('#cPomo').value||0), minutes: Number($('#cMin').value||0) };
    DATA.chores.push(c); save(DATA); $('#cName').value=''; $('#cPomo').value=''; $('#cMin').value=''; render(); vibrate();
  });

  function renderWorkouts(){ const tb = document.querySelector('#workoutTable tbody'); if(!tb) return; tb.innerHTML=''; DATA.workouts.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((w,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${w.date}</td><td>${w.type||''}</td><td>${w.duration||0}</td><td>${w.sets||0}</td><td>${w.intensity||0}</td><td>${Math.round(wExp(w))}</td><td><button class=\"btn secondary\">✖</button></td>`; tr.querySelector('button').addEventListener('click',()=>{ DATA.workouts.splice(idx,1); save(DATA); render(); }); tb.appendChild(tr); }); }
  function renderChores(){ const tb = document.querySelector('#choreTable tbody'); if(!tb) return; tb.innerHTML=''; DATA.chores.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((c,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${c.date}</td><td>${c.chore||''}</td><td>${c.pomodoros||0}</td><td>${c.minutes||0}</td><td>${Math.round(cExp(c))}</td><td><button class=\"btn secondary\">✖</button></td>`; tr.querySelector('button').addEventListener('click',()=>{ DATA.chores.splice(idx,1); save(DATA); render(); }); tb.appendChild(tr); }); }

  // -------- Quick‑Add Dock Interactions --------
  function openModal(id){ $(id).classList.add('show'); $(id).setAttribute('aria-hidden','false'); }
  function closeModal(id){ $(id).classList.remove('show'); $(id).setAttribute('aria-hidden','true'); }

  $('#openWorkoutModal').addEventListener('click', ()=> openModal('#workoutModal'));
  $('#mWClose').addEventListener('click', ()=> closeModal('#workoutModal'));
  $('#mWSave').addEventListener('click', ()=>{ const w={ date: todayISO(), type: $('#mWType').value||'Strength', duration: Number($('#mWMin').value||0), sets: Number($('#mWSets').value||0), intensity: Number($('#mWInt').value||3) }; DATA.workouts.push(w); save(DATA); closeModal('#workoutModal'); render(); vibrate(); });

  $('#openChoreModal').addEventListener('click', ()=> openModal('#choreModal'));
  $('#mCClose').addEventListener('click', ()=> closeModal('#choreModal'));
  $('#mCSave').addEventListener('click', ()=>{ const c={ date: todayISO(), chore: $('#mCName').value||'Chore', minutes: Number($('#mCMin').value||0), pomodoros: Number($('#mCPomo').value||0) }; DATA.chores.push(c); save(DATA); closeModal('#choreModal'); render(); vibrate(); });

  // Quick cardio/walk
  $('#quickCardio10').addEventListener('click', ()=>{ DATA.workouts.push({date:todayISO(), type:'Cardio — Quick', duration:10, sets:0, intensity:3}); save(DATA); render(); vibrate(); });
  $('#quickWalk10').addEventListener('click', ()=>{ DATA.workouts.push({date:todayISO(), type:'Walk — Quick', duration:10, sets:0, intensity:1}); save(DATA); render(); vibrate(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e)=>{
    if(e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if(e.key==='w' || e.key==='W'){ openModal('#workoutModal'); }
    if(e.key==='1'){ addWaterML(250); }
    if(e.key==='2'){ addWaterML(330); }
    if(e.key==='3'){ addWaterML(500); }
    if(e.key==='s' || e.key==='S'){ $('#quickSetBtn').click(); }
  });

  // -------- Render overall --------
  function render(){
    settlePreviousWeekIfNeeded();
    const now=new Date(); const {need,counters,allOk,s,e}=weeklyStatus(now);
    const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0); const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0); const weekWExp = DATA.workouts.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+wExp(x),0); const weekCExp = DATA.chores.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+cExp(x),0);

    $('#levelsCleared').textContent = DATA.levelsCleared || 0; const gs=$('#gateStatus'); gs.textContent = allOk? 'Gate Cleared ✅' : 'Gate Closed ⛔'; gs.className = 'value ' + (allOk?'ok':'fail'); $('#totalExp').textContent = Math.round(wExpTotal + cExpTotal); $('#weekExp').textContent = Math.round(weekWExp + weekCExp); $('#weekRange').textContent = `${iso(s)} → ${iso(e)}`;

    const ul=$('#mqList'); ul.innerHTML='';
    addQuestItem(ul, `Strength Workouts`, `${counters.strength}/2`, need.strength2);
    addQuestItem(ul, `Extra Workout (any/cardio)`, `${counters.extra}/1`, need.extraWorkout);
    addQuestItem(ul, `House Clean`, `${counters.clean}/4`, need.fullClean);
    addQuestItem(ul, `Walk`, `${counters.walk}/1`, need.oneWalk);
    addQuestItem(ul, `Reading`, `${counters.readH}/2`, need.read2h);

    renderWorkouts(); renderChores(); renderSessions(); renderCalendar(); updateWaterBar();
    // prefill
    $('#cfgBaseWorkout').value = DATA.config.baseWorkout||50; $('#cfgBaseChore').value = DATA.config.baseChore||20; $('#cfgPerMin').value = DATA.config.perMin||2; $('#cfgWaterTarget').value = DATA.config.waterTarget||2.0;
    const kw=DATA.config.kw||{}; $('#kwStrength').value=kw.strength||''; $('#kwCardio').value=kw.cardio||''; $('#kwWalk').value=kw.walk||''; $('#kwVac').value=kw.vacuum||''; $('#kwSweep').value=kw.sweep||''; $('#kwDust').value=kw.dust||''; $('#kwBath').value=kw.bath||''; $('#kwRead').value=kw.read||'';
    $('#sessDate').value = todayISO(); $('#qDate').value = todayISO();
  }

  function addQuestItem(ul, title, counter, ok){ const li=document.createElement('li'); li.className=''; const dot=document.createElement('span'); dot.className='dot'; li.appendChild(dot); const text=document.createTextNode(` ${title} — ${counter}`); li.appendChild(text); if(!ok){ li.style.opacity=.8; li.style.borderColor = '#3a2630'; } ul.appendChild(li); return li; }

  // Save config
  $('#saveCfg').addEventListener('click',()=>{ DATA.config.baseWorkout=Number($('#cfgBaseWorkout').value||50); DATA.config.baseChore=Number($('#cfgBaseChore').value||20); DATA.config.perMin=Number($('#cfgPerMin').value||2); DATA.config.waterTarget=Number($('#cfgWaterTarget').value||2.0); DATA.config.kw={ strength:$('#kwStrength').value, cardio:$('#kwCardio').value, walk:$('#kwWalk').value, vacuum:$('#kwVac').value, sweep:$('#kwSweep').value, dust:$('#kwDust').value, bath:$('#kwBath').value, read:$('#kwRead').value }; save(DATA); alert('Settings saved.'); render(); });

  $('#exportBtn').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='solo_leveling_weekly_pwa_v3_2_save.json'; a.click(); });
  $('#importFile').addEventListener('change',(e)=>{ const f=e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ try{ const d=JSON.parse(fr.result); DATA=d; save(DATA); render(); alert('Import complete.'); }catch(err){ alert('Invalid file.'); } }; fr.readAsText(f); });
  $('#resetAll').addEventListener('click',()=>{ if(confirm('Reset EVERYTHING?')){ DATA = defaultData(); save(DATA); render(); } });
  $('#keywordsBtn').addEventListener('click',()=> alert('Keywords are under Settings → Keyword Detection. Edit and Save.'));

  // Month navigation
  let cal = {year: new Date().getFullYear(), month: new Date().getMonth()};
  $('#prevMonth').addEventListener('click',()=>{ cal.month--; if(cal.month<0){cal.month=11; cal.year--;} renderCalendar(); });
  $('#nextMonth').addEventListener('click',()=>{ cal.month++; if(cal.month>11){cal.month=0; cal.year++;} renderCalendar(); });

  // init
  render();
})();
