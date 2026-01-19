
(function(){
  document.addEventListener('DOMContentLoaded', () => {
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
    const wExp = w => (Number(w.duration||0) > 0 ? Number(w.duration)*(DATA.config.perMin||2) + Number(w.intensity||0)*10 : (totalSets(w)>0 ? totalSets(w)*5 : DATA.config.baseWorkout||50));
    const cExp = c => (Number(c.minutes||0)*0.5 + (DATA.config.baseChore||20));

    // Emoji helper for calendar
    function iconsForDay(ds){ const w = DATA.workouts.filter(x=>x.date===ds); const c = DATA.chores.filter(x=>x.date===ds); let s=''; if (w.some(x=>/Strength/i.test(x.type||''))) s+='🏋️'; if (w.some(x=>/Cardio/i.test(x.type||''))) s+='🏃'; if (w.some(x=>/Walk/i.test(x.type||''))) s+='🚶'; if (c.some(x=>/Reading/i.test(x.chore||''))) s+='📚'; if (c.some(x=>!(/Reading/i.test(x.chore||'')))) s+='🧹'; const rec=getNut(ds); if(rec&&rec.water>0) s+='💧'; if(rec&&rec.clean && Number(rec.water)>=Number(DATA.config.waterTarget||2.0)) s+='🥗'; return s; }

    // --- Workout Studio (full) ---
    const STUDIO = { current:null, editIndex:null }; // current: {date, groups:[], exercises:[{name, group, sets:[{kg,reps,rest,rpe}]}]}

    const LIB = {
      Back:['Deadlift','Barbell Row','Lat Pulldown','Seated Cable Row','Pull-ups','Face Pull'],
      Chest:['Bench Press','Incline DB Press','Pec Deck','Cable Fly','Push-ups'],
      Legs:['Back Squat','Leg Press','Romanian Deadlift','Leg Extension','Leg Curl','Calf Raise'],
      Shoulders:['Overhead Press','Lateral Raise','Rear Delt Fly','Front Raise'],
      Arms:['Barbell Curl','Dumbbell Curl','Triceps Pushdown','Skull Crushers'],
      Core:['Hanging Leg Raise','Cable Crunch','Plank'],
      Cardio:['Treadmill','Bike','Rower','Elliptical']
    };

    function openStudio(editIdx=null){
      STUDIO.editIndex = editIdx;
      if (editIdx!=null){ // edit existing
        const w = DATA.workouts[editIdx];
        STUDIO.current = w.details?.studio || { date:w.date, groups:[], exercises:[] };
        $('#studioDelete').style.display = 'inline-block';
      } else {
        STUDIO.current = { date: todayISO(), groups:[], exercises:[] };
        $('#studioDelete').style.display = 'none';
      }
      $('#studioDate').value = STUDIO.current.date || todayISO();
      $('#exContainer').innerHTML='';
      $('#studio').style.display='block';
    }
    function closeStudio(){ $('#studio').style.display='none'; STUDIO.current=null; STUDIO.editIndex=null; }

    function addExerciseCard(group){
      const name = LIB[group]?.[0] || `${group} Exercise`;
      addExercise(group, name);
    }
    function addExercise(group, name){
      const ex = { name, group, sets:[] };
      STUDIO.current.exercises.push(ex);
      renderExercises();
    }
    function totalSets(w){ if (w?.details?.studio?.exercises) return w.details.studio.exercises.reduce((a,e)=>a+e.sets.length,0); if (w?.sets!=null) return Number(w.sets)||0; return 0; }
    function computeVolume(st){ return st.exercises.reduce((a,e)=> a + e.sets.reduce((b,s)=> b + Number(s.kg||0)*Number(s.reps||0),0), 0); }

    function renderExercises(){
      const box = $('#exContainer'); box.innerHTML='';
      STUDIO.current.groups = Array.from(new Set(STUDIO.current.exercises.map(e=>e.group)));
      STUDIO.current.exercises.forEach((ex,idx)=>{
        const card = document.createElement('div'); card.className='ex-card';
        const head = document.createElement('div'); head.className='ex-head';
        const nameSel = document.createElement('select'); (LIB[ex.group]||[ex.name]).forEach(n=>{ const o=document.createElement('option'); o.textContent=n; if(n===ex.name) o.selected=true; nameSel.appendChild(o); });
        nameSel.onchange=()=>{ ex.name=nameSel.value; };
        const grpSel = document.createElement('select'); Object.keys(LIB).forEach(g=>{ const o=document.createElement('option'); o.textContent=g; if(g===ex.group) o.selected=true; grpSel.appendChild(o); });
        grpSel.onchange=()=>{ ex.group=grpSel.value; renderExercises(); };
        const del = document.createElement('button'); del.className='btn danger'; del.textContent='Delete exercise'; del.onclick=()=>{ STUDIO.current.exercises.splice(idx,1); renderExercises(); };
        head.append('Exercise:', nameSel, ' Group:', grpSel, del);
        card.appendChild(head);
        // sets
        ex.sets.forEach((s,sidx)=>{
          const row=document.createElement('div'); row.className='set-row';
          const kg=document.createElement('input'); kg.type='number'; kg.step='0.5'; kg.min='0'; kg.value=s.kg||0; kg.onchange=()=>{ s.kg=Number(kg.value||0); };
          const reps=document.createElement('input'); reps.type='number'; reps.min='1'; reps.value=s.reps||8; reps.onchange=()=>{ s.reps=Number(reps.value||0); };
          const rest=document.createElement('input'); rest.placeholder='rest (s)'; rest.type='number'; rest.min='0'; rest.value=s.rest||60; rest.onchange=()=>{ s.rest=Number(rest.value||0); };
          const rpe=document.createElement('input'); rpe.placeholder='RPE'; rpe.type='number'; rpe.min='0'; rpe.max='10'; rpe.step='0.5'; rpe.value=s.rpe||8; rpe.onchange=()=>{ s.rpe=Number(rpe.value||0); };
          const rm=document.createElement('button'); rm.className='btn secondary'; rm.textContent='Remove set'; rm.onclick=()=>{ ex.sets.splice(sidx,1); renderExercises(); };
          row.append('kg',kg,'reps',reps,'rest',rest,'RPE',rpe,rm);
          card.appendChild(row);
        });
        const addRow=document.createElement('div'); addRow.className='set-row';
        const akg=document.createElement('input'); akg.type='number'; akg.step='0.5'; akg.min='0'; akg.placeholder='kg';
        const areps=document.createElement('input'); areps.type='number'; areps.min='1'; areps.placeholder='reps';
        const arest=document.createElement('input'); arest.type='number'; arest.min='0'; arest.placeholder='rest (s)';
        const arpe=document.createElement('input'); arpe.type='number'; arpe.min='0'; arpe.max='10'; arpe.step='0.5'; arpe.placeholder='RPE';
        const addBtn=document.createElement('button'); addBtn.className='btn'; addBtn.textContent='Add set'; addBtn.onclick=()=>{ ex.sets.push({kg:Number(akg.value||0), reps:Number(areps.value||0), rest:Number(arest.value||0), rpe:Number(arpe.value||0)}); renderExercises(); };
        addRow.append('kg',akg,'reps',areps,'rest',arest,'RPE',arpe,addBtn);
        card.appendChild(addRow);
        box.appendChild(card);
      });
      // Group add shortcuts
      const addBtns=document.createElement('div'); addBtns.className='chipset';
      Object.keys(LIB).forEach(g=>{ const b=document.createElement('span'); b.className='chip'; b.textContent='Add '+g+' exercise'; b.onclick=()=> addExerciseCard(g); addBtns.appendChild(b); });
      box.appendChild(addBtns);
    }

    $('#studioBack').addEventListener('click', closeStudio);
    $('#studioSave').addEventListener('click', ()=>{
      STUDIO.current.date = $('#studioDate').value || todayISO();
      const setCount = STUDIO.current.exercises.reduce((a,e)=>a+e.sets.length,0);
      const vol = computeVolume(STUDIO.current);
      const type = (STUDIO.current.groups.length? 'Strength — '+STUDIO.current.groups.join('/') : 'Strength');
      const rec = { date: STUDIO.current.date, type, duration: 0, sets: setCount, intensity: 0, details: { studio: STUDIO.current, volume: vol } };
      if (STUDIO.editIndex!=null){ DATA.workouts[STUDIO.editIndex]=rec; }
      else { DATA.workouts.push(rec); }
      save(DATA); closeStudio(); renderAll();
    });
    $('#studioDelete').addEventListener('click', ()=>{ if(STUDIO.editIndex!=null){ DATA.workouts.splice(STUDIO.editIndex,1); save(DATA); closeStudio(); renderAll(); } });

    // --- Activity Manager ---
    function openDrawer(id){ const el=$(id); if(el){ el.style.display='flex'; el.setAttribute('aria-hidden','false'); } }
    function closeDrawer(id){ const el=$(id); if(el){ el.style.display='none'; el.setAttribute('aria-hidden','true'); } }
    $$('[data-close]').forEach(b=> b.addEventListener('click', ()=> closeDrawer(b.getAttribute('data-close'))));

    $('#openManager').addEventListener('click', ()=>{ renderManager(); openDrawer('#manager'); });
    function renderManager(){
      const tw=$('#tblWorkouts tbody'); tw.innerHTML='';
      DATA.workouts.forEach((w,idx)=>{
        const tr=document.createElement('tr'); tr.innerHTML = `<td>${w.date}</td><td>${w.type||''}</td><td>${w.duration||0}</td><td>${totalSets(w)}</td><td></td>`;
        const td=tr.lastElementChild; const eb=document.createElement('button'); eb.className='btn secondary'; eb.textContent='Edit'; eb.onclick=()=>{ openStudio(idx); renderExercises(); }; const db=document.createElement('button'); db.className='btn danger'; db.textContent='Delete'; db.onclick=()=>{ if(confirm('Delete workout?')){ DATA.workouts.splice(idx,1); save(DATA); renderManager(); renderAll(); } }; td.append(eb, ' ', db); tw.appendChild(tr);
      });
      const tc=$('#tblChores tbody'); tc.innerHTML='';
      DATA.chores.forEach((c,idx)=>{
        const tr=document.createElement('tr'); tr.innerHTML = `<td>${c.date}</td><td>${c.chore||''}</td><td>${c.minutes||0}</td><td></td>`;
        const td=tr.lastElementChild; const eb=document.createElement('button'); eb.className='btn secondary'; eb.textContent='Edit'; eb.onclick=()=>{ $('#mCMin').value=c.minutes||0; ['Vacuum','Sweep','Dust','Bathroom','Reading'].forEach(name=>{ $('#c'+name.replace(/ .*/, '')).checked = (c.chore||'').toLowerCase().includes(name.toLowerCase()); }); openDrawer('#choreModal'); }; const db=document.createElement('button'); db.className='btn danger'; db.textContent='Delete'; db.onclick=()=>{ if(confirm('Delete chore?')){ DATA.chores.splice(idx,1); save(DATA); renderManager(); renderAll(); } }; td.append(eb,' ',db); tc.appendChild(tr);
      });
    }

    // --- Weekly / calendar / hydration ---
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
      const {need,counters,allOk,s,e}=weeklyStatus(new Date());
      $('#weekRange').textContent = `${iso(s)} → ${iso(e)}`;
      const items=[
        {title:'💪 Strength workouts', num:counters.strength, denom:2},
        {title:'🏃 Extra workout (any/cardio)', num:counters.extra, denom:1},
        {title:'🧹 House clean (Vacuum · Sweep · Dust · Bathroom)', num:counters.clean, denom:4},
        {title:'🚶 Walk', num:counters.walk, denom:1},
        {title:'📚 Reading (2h / week)', num:counters.readH, denom:2}
      ];
      const cont=$('#wmq'); cont.innerHTML='';
      items.forEach(it=>{ const chip=document.createElement('div'); chip.className='qchip'; const t=document.createElement('div'); t.className='qtitle'; t.innerHTML=`<span>${it.title}</span> <span style="margin-left:auto">${it.num}/${it.denom}</span>`; const bar=document.createElement('div'); bar.className='qbar'; const fill=document.createElement('span'); fill.style.width=`${Math.min(100,Math.round((it.num/it.denom)*100))}%`; bar.appendChild(fill); chip.appendChild(t); chip.appendChild(bar); cont.appendChild(chip); });

      const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0);
      const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0);
      const weekWExp = DATA.workouts.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+wExp(x),0);
      const weekCExp = DATA.chores.filter(x=>inWeek(x.date,s,e)).reduce((a,x)=>a+cExp(x),0);
      $('#totalExp').textContent=Math.round(wExpTotal+cExpTotal);
      $('#weekExp').textContent=Math.round(weekWExp+weekCExp);

      const gs=$('#gateStatus'); gs.textContent = allOk ? 'Gate Cleared ✅' : 'Gate Closed ⛔'; gs.className='gate ' + (allOk? 'open':'closed');
      $('#levelsCleared').textContent = DATA.levelsCleared || 0;
    }

    function upsertNutrition(date, clean, water){ const i=DATA.nutrition.findIndex(n=>n.date===date); const rec={date,clean:!!clean,water:Number(water||0)}; if(i>=0) DATA.nutrition[i]=rec; else DATA.nutrition.push(rec); save(DATA); }
    function getNut(date){ return DATA.nutrition.find(n=>n.date===date); }
    function isCB(n){ return !!(n && n.clean && Number(n.water)>=Number(DATA.config.waterTarget||2.0)); }

    let cal = {year:new Date().getFullYear(), month:new Date().getMonth()};
    function renderCalendar(){ const y=cal.year,m=cal.month; const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate(); const jsDow=first.getDay(); const offset=(jsDow+6)%7; $('#calTitle').textContent=first.toLocaleString(undefined,{month:'long',year:'numeric'}); const head=$('#calHead'); head.innerHTML=''; ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{ const h=document.createElement('div'); h.className='head'; h.textContent=d; head.appendChild(h); }); const grid=$('#calGrid'); grid.innerHTML=''; for(let i=0;i<offset;i++){ const pad=document.createElement('div'); pad.style.minHeight='78px'; grid.appendChild(pad);} for(let d=1; d<=days; d++){ const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const cell=document.createElement('button'); cell.type='button'; cell.className='day'; const dn=document.createElement('div'); dn.className='d'; dn.textContent=d; const rec=getNut(ds); const good=isCB(rec); const mark=document.createElement('span'); mark.className='mark '+(rec?(good?'good':'bad'):'none'); mark.textContent=rec?(good?'CB':'X'):'—'; const icons=document.createElement('div'); icons.className='icons'; icons.textContent=iconsForDay(ds); cell.append(dn, mark, icons); cell.onclick=()=>{ $('#qDate').value=ds; $('#qClean').checked=!!(rec&&rec.clean); $('#qWater').value=rec?rec.water:''; updateWaterBar(); }; grid.appendChild(cell);} const st=(function(){ let count=0,streak=0,best=0; for(let d=1; d<=days; d++){ const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const good=isCB(getNut(ds)); if(good){ streak++; count++; best=Math.max(best,streak);} else { streak=0; } } return {count,streak,best}; })(); $('#qMonthCount').textContent=st.count; $('#qStreak').textContent=st.streak; $('#qBest').textContent=st.best; }

    function updateWaterBar(){ const target=Number(DATA.config.waterTarget||2.0); const date=$('#qDate').value||todayISO(); const rec=getNut(date)||{water:0,clean:false}; const pct=Math.min(100,Math.round((Number(rec.water||0)/target)*100)); $('#waterBar').style.width=pct+'%'; $('#waterTargetLbl').textContent=target.toFixed(1); }

    // Dock actions
    $('#ctaWorkout').addEventListener('click', ()=>{ openStudio(); renderExercises(); });
    $('#ctaChore').addEventListener('click', ()=> openDrawer('#choreModal'));

    // Chore save
    $('#mCSave').addEventListener('click', ()=>{ const minutes=Number($('#mCMin').value||0); const day=todayISO(); const add=n=>DATA.chores.push({date:day,chore:n,minutes}); if($('#cVac').checked) add('Vacuum'); if($('#cSweep').checked) add('Sweep'); if($('#cDust').checked) add('Dust'); if($('#cBath').checked) add('Bathroom'); if($('#cRead').checked) add('Reading'); save(DATA); closeDrawer('#choreModal'); renderAll(); });

    // Settings
    $('#settingsBtn').addEventListener('click', ()=> openDrawer('#settingsModal'));
    $('#saveCfg').addEventListener('click',()=>{ DATA.config.baseWorkout=Number($('#cfgBaseWorkout').value||50); DATA.config.baseChore=Number($('#cfgBaseChore').value||20); DATA.config.perMin=Number($('#cfgPerMin').value||2); DATA.config.waterTarget=Number($('#cfgWaterTarget').value||2.0); save(DATA); closeDrawer('#settingsModal'); renderAll(); });

    // Clean Boy
    $$('button[data-ml]').forEach(b=> b.addEventListener('click', ()=>{ const addL=Number(b.getAttribute('data-ml'))/1000; const d=$('#qDate').value||todayISO(); const rec=getNut(d)||{date:d,clean:false,water:0}; const nw=Number(rec.water||0)+addL; upsertNutrition(d,rec.clean,nw); $('#qWater').value=nw.toFixed(2); updateWaterBar(); renderCalendar(); }));
    $('#waterCustomBtn').addEventListener('click', ()=>{ const v=prompt('Add water (ml):','200'); if(!v) return; const n=Number(v); if(!isNaN(n) && n>0){ const d=$('#qDate').value||todayISO(); const rec=getNut(d)||{date:d,clean:false,water:0}; const nw=Number(rec.water||0)+n/1000; upsertNutrition(d,rec.clean,nw); $('#qWater').value=nw.toFixed(2); updateWaterBar(); renderCalendar(); }});
    $('#qSave').addEventListener('click', ()=>{ const d=$('#qDate').value||todayISO(); const c=$('#qClean').checked; const w=Number($('#qWater').value||0); upsertNutrition(d,c,w); renderAll(); });

    // Month nav
    $('#prevMonth').addEventListener('click',()=>{ cal.month--; if(cal.month<0){cal.month=11; cal.year--; } renderCalendar(); });
    $('#nextMonth').addEventListener('click',()=>{ cal.month++; if(cal.month>11){cal.month=0; cal.year++; } renderCalendar(); });

    // Week settle
    function settleWeek(){ const currentISO = iso(startOfWeek()); if (DATA.lastWeekISO !== currentISO) { const prevMonday = new Date(DATA.lastWeekISO); const st = weeklyStatus(prevMonday); if (st.allOk) DATA.levelsCleared = Number(DATA.levelsCleared||0)+1; DATA.lastWeekISO=currentISO; save(DATA);} }

    function renderAll(){ renderWeekly(); renderCalendar(); updateWaterBar(); $('#qDate').value=todayISO(); }

    settleWeek(); renderAll();
  });
})();
