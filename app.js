
(function(){
  const $ = s => document.querySelector(s); const $$ = s => Array.from(document.querySelectorAll(s));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const startOfWeek = (d=new Date()) => { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; };
  const endOfWeek = (d=new Date()) => { const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; };
  const iso = d => new Date(d).toISOString().slice(0,10);

  const storeKey='solo_leveling_weekly_gate_pwa_v3_1';
  const defaultData = () => ({
    config:{ baseWorkout:50, baseChore:20, perMin:2, waterTarget:2.0,
      kw:{ strength:'strength, weights, gym, lift, deadlift, squat, bench, press', cardio:'run, cardio, bike, cycling, swim, row', walk:'walk, walking', vacuum:'vacuum, hoover', sweep:'sweep, broom', dust:'dust, dusting', bath:'bathroom, toilet, wc', read:'read, reading, book' }
    },
    workouts:[], chores:[], sessions:[], nutrition:[], levelsCleared:0, lastWeekISO: iso(startOfWeek()),
  });
  const load = () => { try{ return JSON.parse(localStorage.getItem(storeKey)) || defaultData(); }catch(e){ return defaultData(); } };
  const save = (d) => localStorage.setItem(storeKey, JSON.stringify(d));
  let DATA = load();

  const parseKw = s => s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const inWeek = (dateStr, s, e) => { const d=new Date(dateStr); return d>=s && d<=e; };
  const wExp = w => (Number(w.duration||0) > 0 ? Number(w.duration)*(DATA.config.perMin||2) + Number(w.intensity||0)*10 : (Number(w.sets||0)>0 ? Number(w.sets)*5 : DATA.config.baseWorkout||50));
  const cExp = c => (Number(c.minutes||0)*0.5 + (DATA.config.baseChore||20)); // pomodoros removed

  function weeklyStatus(when=new Date()){
    const s=startOfWeek(when), e=endOfWeek(when);
    const k=DATA.config.kw, K={ strength:parseKw(k.strength), cardio:parseKw(k.cardio), walk:parseKw(k.walk), vacuum:parseKw(k.vacuum), sweep:parseKw(k.sweep), dust:parseKw(k.dust), bath:parseKw(k.bath), read:parseKw(k.read) };
    const wThis=DATA.workouts.filter(w=>inWeek(w.date,s,e));
    const cThis=DATA.chores.filter(c=>inWeek(c.date,s,e));
    const contains=(t,a)=>{ const T=(t||'').toLowerCase(); return a.some(k=>T.includes(k)); };

    const strengthCount = wThis.filter(w=>contains(w.type, K.strength)).length;
    const totalWorkouts = wThis.length;
    const extraCount = Math.max(0, totalWorkouts - Math.min(strengthCount, 2));
    const extraDone = Math.min(1, extraCount);
    const hasWalk = wThis.some(w=>contains(w.type, K.walk));

    const hasVac = cThis.some(c=>contains(c.chore, K.vacuum));
    const hasSweep = cThis.some(c=>contains(c.chore, K.sweep));
    const hasDust = cThis.some(c=>contains(c.chore, K.dust));
    const hasBath = cThis.some(c=>contains(c.chore, K.bath));
    const cleanCount = [hasVac,hasSweep,hasDust,hasBath].filter(Boolean).length;

    const readMin = cThis.filter(c=>contains(c.chore, K.read)).reduce((a,c)=>a+Number(c.minutes||0),0);
    const readHours = Math.floor(readMin/60);

    const need = { strength2: strengthCount >= 2, extraWorkout: extraDone >= 1, fullClean: cleanCount === 4, oneWalk: hasWalk, read2h: readMin >= 120 };
    const counters = { strength: Math.min(2, strengthCount), extra: extraDone, clean: cleanCount, walk: hasWalk?1:0, readH: Math.min(2, readHours) };

    const allOk = Object.values(need).every(Boolean);
    return { need, counters, allOk, s, e };
  }

  function renderWeeklyQuests(){
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
    items.forEach(it=>{ const chip=document.createElement('div'); chip.className='qchip'; const title=document.createElement('div'); title.className='qtitle'; title.innerHTML=`${it.ok?'✅':'⬜️'} <span>${it.title}</span> <span style="margin-left:auto">${it.num}/${it.denom}</span>`; const bar=document.createElement('div'); bar.className='qbar'; const fill=document.createElement('span'); fill.style.width=`${Math.min(100,Math.round((it.num/it.denom)*100))}%`; bar.appendChild(fill); chip.appendChild(title); chip.appendChild(bar); if(it.ok) title.classList.add('qdone'); cont.appendChild(chip); });

    const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0);
    const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0);
    const weekWExp = DATA.workouts.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+wExp(x),0);
    const weekCExp = DATA.chores.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+cExp(x),0);
    $('#levelsCleared').textContent = DATA.levelsCleared || 0;
    $('#gateStatus').textContent = allOk ? 'Gate Cleared ✅' : 'Gate Closed ⛔';
    $('#totalExp').textContent = Math.round(wExpTotal + cExpTotal);
    $('#weekExp').textContent = Math.round(weekWExp + weekCExp);
  }

  // Clean Boy helpers
  function upsertNutrition(date, clean, water){ const i=DATA.nutrition.findIndex(n=>n.date===date); const rec={date,clean:!!clean,water:Number(water||0)}; if(i>=0) DATA.nutrition[i]=rec; else DATA.nutrition.push(rec); save(DATA); }
  function getNutrition(date){ return DATA.nutrition.find(n=>n.date===date); }
  function isCleanBoy(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }
  function monthStats(year, month){ const daysInMonth=new Date(year,month+1,0).getDate(); let count=0,streak=0,best=0; for(let d=1; d<=daysInMonth; d++){ const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good=isCleanBoy(getNutrition(ds)); if(good){ streak++; count++; best=Math.max(best,streak);} else { streak=0; } } return {count,best,streak}; }
  function updateWaterBar(){ const target=Number(DATA.config.waterTarget||2.0); const date=$('#qDate').value||todayISO(); const rec=getNutrition(date) || {water:0}; const pct=Math.min(100,Math.round((Number(rec.water||0)/target)*100)); $('#waterBar').style.width=pct+'%'; $('#waterTargetLbl').textContent=target.toFixed(1); }

  // Calendar render
  let cal={year:new Date().getFullYear(), month:new Date().getMonth()};
  function renderCalendar(){ const y=cal.year,m=cal.month; const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const jsDow=first.getDay(); const offset=(jsDow+6)%7; $('#calTitle').textContent = first.toLocaleString(undefined,{month:'long',year:'numeric'}); const head=$('#calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); }); const grid=$('#calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ const pad=document.createElement('div'); pad.style.minHeight='72px'; grid.appendChild(pad); } for(let d=1; d<=days; d++){ const btn=document.createElement('button'); btn.type='button'; btn.className='day'; const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const rec=getNutrition(ds); const good=isCleanBoy(rec); const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; const mark=document.createElement('span'); mark.className='mark ' + (rec? (good?'good':'bad') : 'none'); mark.textContent = rec? (good?'CB':'X') : '—'; btn.appendChild(dn); btn.appendChild(mark); btn.onclick=()=>{ $('#qDate').value=ds; $('#qClean').checked=!!(rec&&rec.clean); $('#qWater').value=rec? rec.water:''; updateWaterBar(); }; grid.appendChild(btn); } const st=monthStats(y,m); $('#qMonthCount').textContent=st.count; $('#qStreak').textContent=st.streak; $('#qBest').textContent=st.best; }

  // Big CTA modals
  function openModal(id){ $(id).style.display='flex'; $(id).setAttribute('aria-hidden','false'); }
  function closeModal(id){ $(id).style.display='none'; $(id).setAttribute('aria-hidden','true'); }
  $('#ctaWorkout').addEventListener('click', ()=> openModal('#workoutModal'));
  $('#ctaChore').addEventListener('click',  ()=> openModal('#choreModal'));
  $('#mWClose').addEventListener('click', ()=> closeModal('#workoutModal'));
  $('#mCClose').addEventListener('click', ()=> closeModal('#choreModal'));
  $('#mWSave').addEventListener('click', ()=>{ const w={ date: todayISO(), type: $('#mWType').value||'Strength', duration: Number($('#mWMin').value||0), sets: Number($('#mWSets').value||0), intensity: Number($('#mWInt').value||3) }; DATA.workouts.push(w); save(DATA); closeModal('#workoutModal'); renderWeeklyQuests(); });
  $('#mCSave').addEventListener('click', ()=>{ const c={ date: todayISO(), chore: $('#mCName').value||'Chore', minutes: Number($('#mCMin').value||0) }; DATA.chores.push(c); save(DATA); closeModal('#choreModal'); renderWeeklyQuests(); });

  // Clean Boy events
  $$('button[data-ml]').forEach(b=> b.addEventListener('click', ()=>{ const addL=Number(b.getAttribute('data-ml'))/1000; const d=$('#qDate').value||todayISO(); const rec=getNutrition(d)||{date:d,clean:false,water:0}; const nw=Number(rec.water||0)+addL; upsertNutrition(d, rec.clean, nw); $('#qWater').value=nw.toFixed(2); updateWaterBar(); }));
  $('#waterCustomBtn').addEventListener('click', ()=>{ const v=prompt('Add water (ml):','200'); if(!v) return; const n=Number(v); if(!isNaN(n) && n>0){ const d=$('#qDate').value||todayISO(); const rec=getNutrition(d)||{date:d,clean:false,water:0}; const nw=Number(rec.water||0)+n/1000; upsertNutrition(d, rec.clean, nw); $('#qWater').value=nw.toFixed(2); updateWaterBar(); }});
  $('#qSave').addEventListener('click', ()=>{ const d=$('#qDate').value||todayISO(); const c=$('#qClean').checked; const w=Number($('#qWater').value||0); upsertNutrition(d,c,w); renderWeeklyQuests(); });

  // Settings
  $('#saveCfg').addEventListener('click',()=>{ DATA.config.baseWorkout=Number($('#cfgBaseWorkout').value||50); DATA.config.baseChore=Number($('#cfgBaseChore').value||20); DATA.config.perMin=Number($('#cfgPerMin').value||2); DATA.config.waterTarget=Number($('#cfgWaterTarget').value||2.0); DATA.config.kw={ strength:$('#kwStrength').value, cardio:$('#kwCardio').value, walk:$('#kwWalk').value, vacuum:$('#kwVac').value, sweep:$('#kwSweep').value, dust:$('#kwDust').value, bath:$('#kwBath').value, read:$('#kwRead').value }; save(DATA); alert('Settings saved.'); renderWeeklyQuests(); });
  $('#exportBtn').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='solo_leveling_weekly_pwa_v3_3_1_save.json'; a.click(); });
  $('#importFile').addEventListener('change',(e)=>{ const f=e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ try{ DATA=JSON.parse(fr.result); save(DATA); renderWeeklyQuests(); alert('Import complete.'); }catch(err){ alert('Invalid file'); } }; fr.readAsText(f); });
  $('#resetAll').addEventListener('click',()=>{ if(confirm('Reset EVERYTHING?')){ DATA = defaultData(); save(DATA); renderAll(); } });
  $('#keywordsBtn').addEventListener('click',()=> alert('Keywords are under Settings → Keyword Detection. Edit and Save.'));

  function renderAll(){ renderWeeklyQuests(); renderCalendar(); updateWaterBar(); $('#qDate').value=todayISO(); }

  // boot
  const currentISO = iso(startOfWeek()); if (DATA.lastWeekISO !== currentISO) { const prevMonday = new Date(DATA.lastWeekISO); const st = weeklyStatus(prevMonday); if (st.allOk) DATA.levelsCleared = Number(DATA.levelsCleared||0) + 1; DATA.lastWeekISO = currentISO; save(DATA); }
  renderAll();
})();
