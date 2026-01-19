
(function(){
  const $ = s => document.querySelector(s); const $$ = s => Array.from(document.querySelectorAll(s));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const startOfWeek = (d=new Date()) => { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; };
  const endOfWeek = (d=new Date()) => { const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; };
  const iso = d => new Date(d).toISOString().slice(0,10);

  const storeKey='solo_leveling_weekly_gate_pwa_v3_1';
  const defaultData = () => ({ config:{ baseWorkout:50, baseChore:20, perMin:2, waterTarget:2.0 }, workouts:[], chores:[], sessions:[], nutrition:[], levelsCleared:0, lastWeekISO: iso(startOfWeek()) });
  const load = () => { try{ return JSON.parse(localStorage.getItem(storeKey)) || defaultData(); }catch(e){ return defaultData(); } };
  const save = (d) => localStorage.setItem(storeKey, JSON.stringify(d));
  let DATA = load();

  const inWeek = (dateStr, s, e) => { const d=new Date(dateStr); return d>=s && d<=e; };
  const wExp = w => (Number(w.duration||0) > 0 ? Number(w.duration)*(DATA.config.perMin||2) + Number(w.intensity||0)*10 : (Number(w.sets||0)>0 ? Number(w.sets)*5 : DATA.config.baseWorkout||50));
  const cExp = c => (Number(c.minutes||0)*0.5 + (DATA.config.baseChore||20));

  function classifyWorkout(minutes, sets, intensity){ if(Number(sets)>0) return 'Strength'; if(Number(minutes)>=10 && Number(intensity)>=2) return 'Cardio'; if(Number(minutes)>0) return 'Walk'; return 'Workout'; }

  function weeklyStatus(when=new Date()){
    const s=startOfWeek(when), e=endOfWeek(when);
    const wThis=DATA.workouts.filter(w=>inWeek(w.date,s,e));
    const cThis=DATA.chores.filter(c=>inWeek(c.date,s,e));
    const strengthCount = wThis.filter(w=>/Strength/i.test(w.type||''))?.length || 0;
    const totalWorkouts = wThis.length;
    const extraCount = Math.max(0, totalWorkouts - Math.min(strengthCount, 2));
    const extraDone = Math.min(1, extraCount);
    const hasWalk = wThis.some(w=>/Walk/i.test(w.type||''));
    const hasVac = cThis.some(c=>/Vacuum/i.test(c.chore||''));
    const hasSweep = cThis.some(c=>/Sweep/i.test(c.chore||''));
    const hasDust = cThis.some(c=>/Dust/i.test(c.chore||''));
    const hasBath = cThis.some(c=>/Bathroom/i.test(c.chore||''));
    const cleanCount = [hasVac,hasSweep,hasDust,hasBath].filter(Boolean).length;
    const readMin = cThis.filter(c=>/Reading/i.test(c.chore||'')).reduce((a,c)=>a+Number(c.minutes||0),0);
    const readHours = Math.floor(readMin/60);
    const need = { strength2: strengthCount >= 2, extraWorkout: extraDone >= 1, fullClean: cleanCount === 4, oneWalk: hasWalk, read2h: readMin >= 120 };
    const counters = { strength: Math.min(2, strengthCount), extra: extraDone, clean: cleanCount, walk: hasWalk?1:0, readH: Math.min(2, readHours) };
    const allOk = Object.values(need).every(Boolean);
    return { need, counters, allOk, s, e };
  }

  function renderWeekly(){
    const now=new Date(); const {need,counters,allOk,s,e}=weeklyStatus(now);
    $('#weekRange').textContent = `${iso(s)} → ${iso(e)}`;
    const items=[
      {title:'💪 Strength workouts', num:counters.strength, denom:2, ok:need.strength2},
      {title:'🏃 Extra workout (any/cardio)', num:counters.extra, denom:1, ok:need.extraWorkout},
      {title:'🧹 House clean (Vacuum · Sweep · Dust · Bathroom)', num:counters.clean, denom:4, ok:need.fullClean},
      {title:'🚶 Walk', num:counters.walk, denom:1, ok:need.oneWalk},
      {title:'📚 Reading (2h / week)', num:counters.readH, denom:2, ok:need.read2h}
    ];
    const cont=$('#wmq'); cont.innerHTML='';
    items.forEach(it=>{ const chip=document.createElement('div'); chip.className='qchip'; const t=document.createElement('div'); t.className='qtitle'; t.innerHTML=`${it.ok?'✅':'⬜️'} <span>${it.title}</span> <span style="margin-left:auto">${it.num}/${it.denom}</span>`; const bar=document.createElement('div'); bar.className='qbar'; const fill=document.createElement('span'); fill.style.width=`${Math.min(100,Math.round((it.num/it.denom)*100))}%`; bar.appendChild(fill); chip.appendChild(t); chip.appendChild(bar); if(it.ok) t.classList.add('qdone'); cont.appendChild(chip); });

    const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0);
    const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0);
    const weekWExp = DATA.workouts.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+wExp(x),0);
    const weekCExp = DATA.chores.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+cExp(x),0);
    $('#totalExp').textContent = Math.round(wExpTotal + cExpTotal);
    $('#weekExp').textContent = Math.round(weekWExp + weekCExp);

    const gs=$('#gateStatus'); gs.textContent = allOk ? 'Gate Cleared ✅' : 'Gate Closed ⛔'; gs.className = 'gate ' + (allOk? 'open':'closed');
    $('#levelsCleared').textContent = DATA.levelsCleared || 0;
  }

  // Nutrition / calendar helpers
  function upsertNutrition(date, clean, water){ const i=DATA.nutrition.findIndex(n=>n.date===date); const rec={date,clean:!!clean,water:Number(water||0)}; if(i>=0) DATA.nutrition[i]=rec; else DATA.nutrition.push(rec); save(DATA); }
  function getNut(date){ return DATA.nutrition.find(n=>n.date===date); }
  function isCB(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }
  function monthStats(y,m){ const days=new Date(y,m+1,0).getDate(); let count=0,streak=0,best=0; for(let d=1; d<=days; d++){ const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good=isCB(getNut(ds)); if(good){ streak++; count++; best=Math.max(best,streak);} else { streak=0; } } return {count,streak,best}; }

  let cal = {year:new Date().getFullYear(), month:new Date().getMonth()};
  function renderCalendar(){ const y=cal.year,m=cal.month; const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const jsDow=first.getDay(); const offset=(jsDow+6)%7; $('#calTitle').textContent = first.toLocaleString(undefined,{month:'long', year:'numeric'}); const head=$('#calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); }); const grid=$('#calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ const pad=document.createElement('div'); pad.style.minHeight='72px'; grid.appendChild(pad); } for(let d=1; d<=days; d++){ const btn=document.createElement('button'); btn.type='button'; btn.className='day'; const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const rec=getNut(ds); const good=isCB(rec); const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; const mark=document.createElement('span'); mark.className='mark ' + (rec? (good?'good':'bad') : 'none'); mark.textContent = rec? (good?'CB':'X') : '—'; btn.appendChild(dn); btn.appendChild(mark); btn.onclick=()=>{ $('#qDate').value = ds; $('#qClean').checked = !!(rec && rec.clean); $('#qWater').value = rec? rec.water : ''; updateWaterBar(); }; grid.appendChild(btn); } const st=monthStats(y,m); $('#qMonthCount').textContent=st.count; $('#qStreak').textContent=st.streak; $('#qBest').textContent=st.best; }
  function updateWaterBar(){ const target=Number(DATA.config.waterTarget||2.0); const date=$('#qDate').value||todayISO(); const rec=getNut(date) || {water:0,clean:false}; const pct=Math.min(100, Math.round((Number(rec.water||0)/target)*100)); $('#waterBar').style.width = pct+'%'; $('#waterTargetLbl').textContent = target.toFixed(1); }

  // ------------- Add modals -------------
  function openModal(id){ $(id).style.display='flex'; $(id).setAttribute('aria-hidden','false'); }
  function closeModal(id){ $(id).style.display='none'; $(id).setAttribute('aria-hidden','true'); }
  $('#ctaWorkout').addEventListener('click', ()=> openModal('#workoutModal'));
  $('#ctaChore').addEventListener('click', ()=> openModal('#choreModal'));
  $('#mWClose').addEventListener('click', ()=> closeModal('#workoutModal'));
  $('#mCClose').addEventListener('click', ()=> closeModal('#choreModal'));

  // Quick add workout
  $('#mWSave').addEventListener('click', ()=>{ const minutes=Number($('#mWMin').value||0), sets=Number($('#mWSets').value||0), intensity=Number($('#mWInt').value||3); const type=classifyWorkout(minutes, sets, intensity); DATA.workouts.push({ date: todayISO(), type, duration: minutes, sets, intensity }); save(DATA); closeModal('#workoutModal'); renderWeekly(); });

  // Live session logic
  const MUSCLE_EXS = {
    'Back':[ 'Deadlift', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Pull-ups', 'Face Pull' ],
    'Chest':[ 'Bench Press', 'Incline DB Press', 'Pec Deck', 'Cable Fly', 'Push-ups' ],
    'Legs':[ 'Back Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Extension', 'Leg Curl', 'Calf Raise' ],
    'Shoulders':[ 'Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Front Raise' ],
    'Arms':[ 'Barbell Curl', 'Dumbbell Curl', 'Triceps Pushdown', 'Skull Crushers' ],
    'Full Body':[ 'Row', 'Bench', 'Squat', 'Pull-ups', 'Dips' ]
  };
  let LIVE = null; // {group, sets:[{ex, kg, reps}]}

  function switchTab(tab){ $$('#wTabs .chip').forEach(ch=>ch.classList.toggle('active', ch.getAttribute('data-tab')===tab)); $('#paneQuick').style.display = (tab==='quick'?'block':'none'); $('#paneLive').style.display = (tab==='live'?'block':'none'); }
  $$('#wTabs .chip').forEach(ch=> ch.addEventListener('click', ()=> switchTab(ch.getAttribute('data-tab'))));

  // Start live by choosing group
  $$('#muscleChips .chip').forEach(ch=> ch.addEventListener('click', ()=>{
    $$('#muscleChips .chip').forEach(x=>x.classList.remove('active')); ch.classList.add('active');
    const group = ch.getAttribute('data-m'); LIVE = { group, sets:[], date: todayISO() };
    // fill exercise dropdown
    const exSel = $('#liveEx'); exSel.innerHTML=''; (MUSCLE_EXS[group]||[]).forEach(name=>{ const o=document.createElement('option'); o.textContent=name; exSel.appendChild(o); });
    $('#liveBox').style.display='block'; $('#setsBox').innerHTML=''; updateLiveStats();
  }));

  function updateLiveStats(){ const total = LIVE? LIVE.sets.length : 0; const vol = LIVE? Math.round(LIVE.sets.reduce((a,s)=>a + Number(s.kg||0)*Number(s.reps||0),0)) : 0; $('#liveTotalSets').textContent = total; $('#liveVolume').textContent = vol; }

  $('#addSetBtn').addEventListener('click', ()=>{
    if(!LIVE) return; const ex=$('#liveEx').value; const kg=Number($('#liveKg').value||0); const reps=Number($('#liveReps').value||0); if(!(kg>0 && reps>0)) return;
    LIVE.sets.push({ex, kg, reps}); const chip=document.createElement('span'); chip.className='set'; chip.textContent = `${ex}: ${kg}×${reps}`; $('#setsBox').appendChild(chip); updateLiveStats();
  });

  $('#finishLiveBtn').addEventListener('click', ()=>{
    if(!LIVE) return; const totalSets = LIVE.sets.length; const volume = LIVE.sets.reduce((a,s)=>a+s.kg*s.reps,0); const type = `Strength — ${LIVE.group}`; DATA.workouts.push({ date: LIVE.date, type, duration: 0, sets: totalSets, intensity: 0, details: { volume, sets: LIVE.sets } }); save(DATA); LIVE=null; closeModal('#workoutModal'); renderWeekly();
  });

  // Chores add
  $('#mCSave').addEventListener('click', ()=>{ const minutes=Number($('#mCMin').value||0); const day=todayISO(); const add=n=>DATA.chores.push({ date: day, chore: n, minutes }); if($('#cVac').checked) add('Vacuum'); if($('#cSweep').checked) add('Sweep'); if($('#cDust').checked) add('Dust'); if($('#cBath').checked) add('Bathroom'); if($('#cRead').checked) add('Reading'); save(DATA); closeModal('#choreModal'); renderWeekly(); });

  // Settings
  $('#settingsBtn').addEventListener('click', ()=> openModal('#settingsModal'));
  $('#closeSettings').addEventListener('click', ()=> closeModal('#settingsModal'));
  $('#saveCfg').addEventListener('click',()=>{ DATA.config.baseWorkout=Number($('#cfgBaseWorkout').value||50); DATA.config.baseChore=Number($('#cfgBaseChore').value||20); DATA.config.perMin=Number($('#cfgPerMin').value||2); DATA.config.waterTarget=Number($('#cfgWaterTarget').value||2.0); save(DATA); closeModal('#settingsModal'); renderWeekly(); });

  // Clean Boy events
  function addWaterML(ml){ const addL=Number(ml)/1000; const d=$('#qDate').value||todayISO(); const rec=getNut(d)||{date:d,clean:false,water:0}; const nw=Number(rec.water||0)+addL; upsertNutrition(d, rec.clean, nw); $('#qWater').value=nw.toFixed(2); updateWaterBar(); }
  $$('button[data-ml]').forEach(b=> b.addEventListener('click', ()=> addWaterML(b.getAttribute('data-ml'))));
  $('#waterCustomBtn').addEventListener('click', ()=>{ const v=prompt('Add water (ml):','200'); if(!v) return; const n=Number(v); if(!isNaN(n) && n>0) addWaterML(n); });
  $('#qSave').addEventListener('click', ()=>{ const d=$('#qDate').value||todayISO(); const c=$('#qClean').checked; const w=Number($('#qWater').value||0); upsertNutrition(d,c,w); renderWeekly(); });

  // Month nav
  let cal = {year:new Date().getFullYear(), month:new Date().getMonth()};
  function getNut(date){ return DATA.nutrition.find(n=>n.date===date); }
  function isCB(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }
  function renderCalendar(){ const y=cal.year,m=cal.month; const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const jsDow=first.getDay(); const offset=(jsDow+6)%7; $('#calTitle').textContent = first.toLocaleString(undefined,{month:'long', year:'numeric'}); const head=$('#calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); }); const grid=$('#calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ const pad=document.createElement('div'); pad.style.minHeight='72px'; grid.appendChild(pad); } for(let d=1; d<=days; d++){ const btn=document.createElement('button'); btn.type='button'; btn.className='day'; const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const rec=getNut(ds); const good=isCB(rec); const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; const mark=document.createElement('span'); mark.className='mark ' + (rec? (good?'good':'bad') : 'none'); mark.textContent = rec? (good?'CB':'X') : '—'; btn.appendChild(dn); btn.appendChild(mark); btn.onclick=()=>{ $('#qDate').value = ds; $('#qClean').checked = !!(rec && rec.clean); $('#qWater').value = rec? rec.water : ''; updateWaterBar(); }; grid.appendChild(btn); } const st=(function(){ const daysInMonth=new Date(y,m+1,0).getDate(); let count=0,streak=0,best=0; for(let d=1; d<=daysInMonth; d++){ const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good=isCB(getNut(ds)); if(good){ streak++; count++; best=Math.max(best,streak);} else { streak=0; } } return {count,streak,best}; })(); $('#qMonthCount').textContent=st.count; $('#qStreak').textContent=st.streak; $('#qBest').textContent=st.best; }
  $('#prevMonth').addEventListener('click',()=>{ cal.month--; if(cal.month<0){cal.month=11; cal.year--; } renderCalendar(); });
  $('#nextMonth').addEventListener('click',()=>{ cal.month++; if(cal.month>11){cal.month=0; cal.year++; } renderCalendar(); });

  function settleWeek(){ const currentISO = iso(startOfWeek()); if (DATA.lastWeekISO !== currentISO) { const prevMonday = new Date(DATA.lastWeekISO); const st = weeklyStatus(prevMonday); if (st.allOk) DATA.levelsCleared = Number(DATA.levelsCleared||0) + 1; DATA.lastWeekISO = currentISO; save(DATA); } }

  function init(){ settleWeek(); renderWeekly(); $('#qDate').value = todayISO(); renderCalendar(); updateWaterBar(); $('#cfgBaseWorkout').value=DATA.config.baseWorkout||50; $('#cfgBaseChore').value=DATA.config.baseChore||20; $('#cfgPerMin').value=DATA.config.perMin||2; $('#cfgWaterTarget').value=DATA.config.waterTarget||2.0; }

  init();
})();
