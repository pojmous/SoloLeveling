
// v3.1.1: logic identical to v3.1; renders into document
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

  // Minimal builder to mount the existing sections back (Strength, Clean Boy, Logs, Settings)
  function mountSkeleton(){
    const mount = document.getElementById('appMount');
    mount.innerHTML = `
    <details open style="margin-top:16px">
      <summary>💪 Strength Templates & Session Tracker</summary>
      <div class="section">
        <div class="row">
          <select id="planSelect"><option value="A">Plan A — Back/Shoulder & Abs</option><option value="B">Plan B — Chest/Calves & Shoulder + Abs</option></select>
          <input type="date" id="sessDate">
          <button class="btn" id="startSession">Start Session</button>
          <button class="btn secondary" id="clearSession">Clear</button>
        </div>
        <div id="sessionBox" style="margin-top:12px;display:none">
          <div class="mini" id="sessionIntro"></div>
          <div id="exercises"></div>
          <div class="row" style="margin-top:8px"><textarea id="sessNotes" placeholder="Notes (warm-up, weights, how it felt)" rows="2"></textarea></div>
          <div class="row" style="margin-top:8px"><button class="btn" id="saveSession">Save Session</button></div>
        </div>
        <h4 style="margin:16px 0 8px">Saved Strength Sessions</h4>
        <table id="sessionTable"><thead><tr><th>Date</th><th>Plan</th><th>Total Sets</th><th>Exercises (sets)</th><th></th></tr></thead><tbody></tbody></table>
      </div>
    </details>
    <details open>
      <summary>🥗 Side Quest: <b>Clean Boy</b> (Daily)</summary>
      <div class="section">
        <div class="row">
          <input type="date" id="qDate">
          <label>Ate clean <input type="checkbox" id="qClean"></label>
          <label>Water (L) <input type="number" id="qWater" min="0" step="0.1" placeholder="2.0"></label>
          <button class="btn" id="qSave">Save Day</button>
        </div>
        <div class="row">
          <div class="pill">This month: <span id="qMonthCount">0</span> CB days</div>
          <div class="pill">Current streak: <span id="qStreak">0</span> days</div>
        </div>
        <div class="cal" id="calHead"></div>
        <div class="cal" id="calGrid"></div>
      </div>
    </details>
    <details>
      <summary>🏋️ Workout Log (freeform)</summary>
      <div class="section">
        <div class="row">
          <input type="date" id="wDate"><input type="text" id="wType" placeholder="Type"><input type="number" id="wDur" placeholder="Duration (min)" min="0"><input type="number" id="wSets" placeholder="Sets/Reps total" min="0"><select id="wIntens"><option value="0">Intensity (1-5)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
          <button class="btn" id="addWorkout">Add</button>
        </div>
        <table id="workoutTable" style="margin-top:12px"><thead><tr><th>Date</th><th>Type</th><th>Minutes</th><th>Sets/Reps</th><th>Intensity</th><th>EXP</th><th></th></tr></thead><tbody></tbody></table>
      </div>
    </details>
    <details>
      <summary>🧹 Chores & Reading Log</summary>
      <div class="section">
        <div class="row">
          <input type="date" id="cDate"><input type="text" id="cName" placeholder="Chore"><input type="number" id="cPomo" placeholder="Pomodoros" min="0"><input type="number" id="cMin" placeholder="Minutes" min="0">
          <button class="btn" id="addChore">Add</button>
        </div>
        <table id="choreTable" style="margin-top:12px"><thead><tr><th>Date</th><th>Chore</th><th>Pomodoros</th><th>Minutes</th><th>EXP</th><th></th></tr></thead><tbody></tbody></table>
      </div>
    </details>
    <details>
      <summary>⚙️ Settings</summary>
      <div class="section">
        <div class="row">
          <label>Base Workout EXP <input id="cfgBaseWorkout" type="number" value="50"></label>
          <label>Base Chore EXP <input id="cfgBaseChore" type="number" value="20"></label>
          <label>EXP per Workout Minute <input id="cfgPerMin" type="number" value="2"></label>
        </div>
        <div class="row">
          <label>Strength keywords <input id="kwStrength" value="strength, weights, gym, lift, deadlift, squat, bench, press"></label>
          <label>Cardio keywords <input id="kwCardio" value="run, cardio, bike, cycling, swim, row"></label>
          <label>Walk keywords <input id="kwWalk" value="walk, walking"></label>
        </div>
        <div class="row">
          <label>Vacuum keywords <input id="kwVac" value="vacuum, hoover"></label>
          <label>Sweep keywords <input id="kwSweep" value="sweep, broom"></label>
          <label>Dust keywords <input id="kwDust" value="dust, dusting"></label>
          <label>Bathroom keywords <input id="kwBath" value="bathroom, toilet, wc"></label>
          <label>Reading keywords <input id="kwRead" value="read, reading, book"></label>
        </div>
        <div class="row">
          <button class="btn" id="saveCfg">Save Settings</button>
          <button class="btn secondary" id="exportBtn">Export Save</button>
          <label class="btn secondary" for="importFile" style="cursor:pointer">Import Save<input type="file" id="importFile" accept="application/json" style="display:none"></label>
          <button class="btn" id="keywordsBtn">Keywords Help</button>
        </div>
      </div>
    </details>`;
  }

  function addQuestItem(ul, title, counter, ok, opts={}){
    const li=document.createElement('li'); li.className = ok? 'ok' : 'fail';
    const dot = document.createElement('span'); dot.className='dot'; li.appendChild(dot);
    const text = document.createTextNode(` ${title} — ${counter}`); li.appendChild(text);
    if(opts.badges){ const box = document.createElement('div'); box.className='subbadges'; opts.badges.forEach(b=>{ const sp=document.createElement('span'); sp.className='badge ' + (b.ok?'ok':''); sp.textContent=b.label + (b.ok?' ✓':''); box.appendChild(sp); }); li.appendChild(box); }
    ul.appendChild(li); return li;
  }

  function wExp(w){ return (Number(w.duration||0)>0? Number(w.duration)*(DATA.config.perMin||2)+Number(w.intensity||0)*10 : (Number(w.sets||0)>0? Number(w.sets)*5 : DATA.config.baseWorkout||50)); }
  function cExp(c){ return Number(c.pomodoros||0)*10 + Number(c.minutes||0)*0.5 + (DATA.config.baseChore||20); }

  function renderWorkouts(){ const tb=document.querySelector('#workoutTable tbody'); tb.innerHTML=''; DATA.workouts.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((w,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${w.date}</td><td>${w.type||''}</td><td>${w.duration||0}</td><td>${w.sets||0}</td><td>${w.intensity||0}</td><td>${Math.round(wExp(w))}</td><td><button class="btn secondary">✖</button></td>`; tr.querySelector('button').onclick=()=>{ DATA.workouts.splice(idx,1); save(DATA); render(); }; tb.appendChild(tr); }); }
  function renderChores(){ const tb=document.querySelector('#choreTable tbody'); tb.innerHTML=''; DATA.chores.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach((c,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${c.date}</td><td>${c.chore||''}</td><td>${c.pomodoros||0}</td><td>${c.minutes||0}</td><td>${Math.round(cExp(c))}</td><td><button class="btn secondary">✖</button></td>`; tr.querySelector('button').onclick=()=>{ DATA.chores.splice(idx,1); save(DATA); render(); }; tb.appendChild(tr); }); }

  function needBadge(which){ const k=DATA.config.kw, K={ vacuum:parseKw(k.vacuum), sweep:parseKw(k.sweep), dust:parseKw(k.dust), bath:parseKw(k.bath) }; const s=startOfWeek(new Date()), e=endOfWeek(new Date()); const cThis = DATA.chores.filter(c=>{ const d=new Date(c.date); return d>=s && d<=e; }); const contains=(t,a)=> (t||'').toLowerCase() && a.some(k=> (t||'').toLowerCase().includes(k)); if(which==='vac') return cThis.some(c=>contains(c.chore,K.vacuum)); if(which==='sweep') return cThis.some(c=>contains(c.chore,K.sweep)); if(which==='dust') return cThis.some(c=>contains(c.chore,K.dust)); if(which==='bath') return cThis.some(c=>contains(c.chore,K.bath)); return false; }

  function render(){
    mountSkeleton();
    const now = new Date();
    const {need, counters, allOk, s, e} = weeklyStatus(now);

    const wExpTotal = DATA.workouts.reduce((a,x)=>a+wExp(x),0);
    const cExpTotal = DATA.chores.reduce((a,x)=>a+cExp(x),0);
    const weekWExp = DATA.workouts.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+wExp(x),0);
    const weekCExp = DATA.chores.filter(x=>{ const d=new Date(x.date); return d>=s && d<=e; }).reduce((a,x)=>a+cExp(x),0);

    document.getElementById('levelsCleared').textContent = DATA.levelsCleared || 0;
    const gs = document.getElementById('gateStatus'); gs.textContent = allOk ? 'Gate Cleared ✅' : 'Gate Closed ⛔';
    document.getElementById('totalExp').textContent = Math.round(wExpTotal + cExpTotal);
    document.getElementById('weekExp').textContent = Math.round(weekWExp + weekCExp);
    document.getElementById('weekRange').textContent = `${iso(s)} → ${iso(e)}`;

    const ul = document.getElementById('mqList'); ul.innerHTML='';
    addQuestItem(ul, `Strength Workouts`, `${counters.strength}/2`, need.strength2);
    addQuestItem(ul, `Extra Workout (any/cardio)`, `${counters.extra}/1`, need.extraWorkout);
    addQuestItem(ul, `House Clean`, `${counters.clean}/4`, need.fullClean, { badges:[{label:'Vacuum', ok:needBadge('vac')},{label:'Sweep', ok:needBadge('sweep')},{label:'Dust', ok:needBadge('dust')},{label:'Bathroom', ok:needBadge('bath')}] });
    addQuestItem(ul, `Walk`, `${counters.walk}/1`, need.oneWalk);
    addQuestItem(ul, `Reading`, `${counters.readH}/2`, need.read2h);

    renderWorkouts();
    renderChores();

    // Prefill
    document.getElementById('sessDate').value = todayISO();
    document.getElementById('qDate').value = todayISO();

    // Simple handlers
    document.getElementById('addWorkout').onclick = ()=>{ const w={ date: document.getElementById('wDate').value||todayISO(), type: document.getElementById('wType').value.trim(), duration: Number(document.getElementById('wDur').value||0), sets: Number(document.getElementById('wSets').value||0), intensity: Number(document.getElementById('wIntens').value||0) }; DATA.workouts.push(w); save(DATA); render(); };
    document.getElementById('addChore').onclick = ()=>{ const c={ date: document.getElementById('cDate').value||todayISO(), chore: document.getElementById('cName').value.trim(), pomodoros: Number(document.getElementById('cPomo').value||0), minutes: Number(document.getElementById('cMin').value||0) }; DATA.chores.push(c); save(DATA); render(); };
    document.getElementById('qSave').onclick = ()=>{ const c = document.getElementById('qClean').checked; const w = Number(document.getElementById('qWater').value||0); const d=document.getElementById('qDate').value||todayISO(); const i = DATA.nutrition.findIndex(n=>n.date===d); const rec={date:d, clean:c, water:w}; if(i>=0) DATA.nutrition[i]=rec; else DATA.nutrition.push(rec); save(DATA); render(); };
    document.getElementById('saveCfg').onclick = ()=>{ DATA.config.baseWorkout = Number(document.getElementById('cfgBaseWorkout').value||50); DATA.config.baseChore = Number(document.getElementById('cfgBaseChore').value||20); DATA.config.perMin = Number(document.getElementById('cfgPerMin').value||2); DATA.config.kw = { strength: document.getElementById('kwStrength').value, cardio: document.getElementById('kwCardio').value, walk: document.getElementById('kwWalk').value, vacuum: document.getElementById('kwVac').value, sweep: document.getElementById('kwSweep').value, dust: document.getElementById('kwDust').value, bath: document.getElementById('kwBath').value, read: document.getElementById('kwRead').value }; save(DATA); alert('Settings saved.'); render(); };
    document.getElementById('exportBtn').onclick = ()=>{ const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='solo_leveling_weekly_pwa_v3_1_save.json'; a.click(); };
    document.getElementById('importFile').onchange = (e)=>{ const f=e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ try{ DATA=JSON.parse(fr.result); save(DATA); render(); }catch(err){ alert('Invalid file'); } }; fr.readAsText(f); };
    document.getElementById('keywordsBtn').onclick = ()=> alert('Keywords are under Settings → Keyword Detection. Edit and Save.');
  }

  // start
  render();
})();
