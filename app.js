
(function(){
  // ---------- Utilities ----------
  const $ = s=>document.querySelector(s);
  const fmt = new Intl.DateTimeFormat(undefined,{weekday:'long', day:'2-digit', month:'short'});
  const fmtRight = d => fmt.format(d).replace(',', ''); // "Sunday, 26 Oct" -> "Sunday 26 Oct"
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function ymd(d){ return d.toISOString().slice(0,10); }
  function parseDate(s){ const t = new Date(s); return isNaN(+t)?null:t; }
  function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function getLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
  function setLS(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Theme ----------
  const themeBtn = $('#themeBtn');
  const savedTheme = getLS('theme', null);
  if(savedTheme){ document.documentElement.classList.toggle('theme-light', savedTheme==='light'); }
  themeBtn.addEventListener('click', ()=>{
    const light = !document.documentElement.classList.contains('theme-light');
    document.documentElement.classList.toggle('theme-light', light);
    setLS('theme', light?'light':'dark');
  });

  // ---------- Fetch fitness.json (live stats) ----------
  async function loadFitness(){
    const box = $('#fitness');
    try{
      const res = await fetch('fitness.json?ts='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw new Error(res.status);
      const j = await res.json();
      const w = (j.workouts||[]).map(w=>`• ${w.type||w.name||'Workout'} · ${w.minutes??w.duration??0} min`).join('<br>');
      box.innerHTML = `
        <div><b>${j.date||'—'}</b></div>
        <div>Steps: ${j.steps??'—'} · Distance: ${(j.distance_km??0).toFixed(2)} km</div>
        <div>Active: ${j.active_energy_kcal??'—'} kcal · Exercise: ${j.exercise_minutes??'—'} min</div>
        <div style="margin-top:6px">${w||'—'}</div>
      `;
    }catch(e){
      box.textContent = '—';
    }
  }

  // ---------- Parse plan.json flexibly ----------
  async function loadPlan(){
    try{
      const res = await fetch('plan.json?ts='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw new Error(res.status);
      return await res.json();
    }catch(e){
      return null;
    }
  }

  function normalizePlan(raw){
    // Goal shape: [{title, type, workoutNumber, dayIndex(0-6), exercises:[{name, reps, sets, range, link}], ...}] per week
    // Accept several shapes and convert.
    if(!raw) return { weeks: [] };

    let weeks = [];
    if(Array.isArray(raw.weeks)) weeks = raw.weeks;
    else if(Array.isArray(raw.plan)) weeks = raw.plan;
    else if(Array.isArray(raw)) {
      // could be weeks already
      if(raw.length && (raw[0].days || raw[0].exercises)) weeks = raw;
    }

    // Ensure weeks array of {days:[...]}
    weeks = weeks.map(w=>{
      const days = Array.isArray(w.days) ? w.days : (Array.isArray(w) ? w : []);
      const normDays = days.map((d, di)=>{
        const exercises = Array.isArray(d.exercises) ? d.exercises : (Array.isArray(d.items)? d.items : []);
        // Map exercise fields
        const exs = exercises.map(x=>{
          const name = x.name || x.title || x.exercise || 'Exercise';
          const reps = x.reps || x.repRange || x.range || x.rpe || x.setsReps || x.notes || null;
          const link = x.vimeo || x.vimeo_id || x.vimeoId ?
              (String(x.vimeo).match(/^https?/) ? x.vimeo : `https://vimeo.com/${x.vimeo_id||x.vimeoId||x.vimeo}`)
              : (x.link || x.url || null);
          const isMobility = /incline|walk|mobility|plank|stretch/i.test(name);
          return { name, reps, link, isMobility };
        });
        const title = d.title || d.name || '';
        const type = d.type || (title.split(' - ')[1] || '').trim() || '';
        const wNum = d.workoutNumber || d.workout || null;
        const dayName = d.day || d.dayName || dayNames[di%7];
        return { title, type, workoutNumber: wNum, dayName, rawTitle: title, exercises: exs };
      });
      return { days: normDays };
    });

    // If there are 0 weeks, return empty
    return { weeks };
  }

  // Fill to 26 weeks (6 months) by repeating
  function expandWeeks(weeks, target=26){
    if(!weeks.length){ 
      // make 1 week of incline/mobility placeholders
      const days = [...Array(7)].map((_,i)=>({dayName:dayNames[i], type: i===6?'Rest':'Incline Walk + Mobility', workoutNumber: i+1, exercises: i===6?[]:[{name:'Incline Walk + Mobility', reps:'20–30 min · 5–7% incline', link:null, isMobility:true}]}));
      weeks = [{days}];
    }
    const out=[];
    for(let i=0;i<target;i++){
      out.push( JSON.parse(JSON.stringify(weeks[i % weeks.length])) );
    }
    return out;
  }

  // Attach dates starting from anchor Sunday 26 Oct 2025
  function dateifyWeeks(weeks){
    const anchor = new Date(Date.UTC(2025,9,26)); // 2025-10-26
    // shift to local timezone date (drop UTC midnight problem)
    const a = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
    let day = new Date(a);
    weeks.forEach((w, wi)=>{
      w.days.forEach((d, di)=>{
        const dt = new Date(a.getFullYear(), a.getMonth(), a.getDate() + wi*7 + di);
        d.date = dt;
      });
    });
    return weeks;
  }

  // Ensure 6 training + 1 rest; any empty day becomes Incline Walk + Mobility
  function enforceSixOne(weeks){
    weeks.forEach(w=>{
      let trainCount=0;
      w.days.forEach((d, i)=>{ if((d.exercises||[]).length) trainCount++; });
      w.days.forEach((d, i)=>{
        if(!(d.exercises && d.exercises.length)){
          if(i===6){ // keep last day as rest if already at 6 training
            d.type = 'Rest';
            d.workoutNumber = d.workoutNumber || (i+1);
            d.exercises = [];
          }else{
            d.type = 'Incline Walk + Mobility';
            d.workoutNumber = d.workoutNumber || (i+1);
            d.exercises = [{name:'Incline Walk + Mobility', reps:'20–30 min · 5–7% incline', isMobility:true}];
          }
        }
      });
    });
  }

  function renderWeek(weekIdx){
    const days = weeks[weekIdx].days;
    const container = $('#week');
    container.innerHTML = '';
    days.forEach((d, di)=>{
      const node = document.importNode($('#dayTpl').content, true);
      const art = node.querySelector('.day');
      const left = node.querySelector('.left');
      const right = node.querySelector('.right');
      const ul = node.querySelector('.exercises');

      // heading text
      const Wn = d.workoutNumber || (di+1);
      const type = d.type || guessType(d);
      left.textContent = `${dayNames[d.date.getDay()]} – Workout ${Wn} – ${type || 'Training'}`;
      right.textContent = `${dayNames[d.date.getDay()]} ${String(d.date.getDate()).padStart(2,'0')} ${mon[d.date.getMonth()]}`;

      // is today?
      const today = new Date();
      const isToday = d.date.getFullYear()===today.getFullYear() && d.date.getMonth()===today.getMonth() && d.date.getDate()===today.getDate();
      if(isToday){ art.classList.add('today'); requestAnimationFrame(()=>art.scrollIntoView({behavior:'smooth', block:'start'})); }

      // exercises
      (d.exercises||[])
        .filter(ex => ex.isMobility || !!ex.link)  // only show non-mobility items with a video link
        .forEach((ex, idx)=>{
          const li = document.createElement('li');
          li.className='ex';
          const key = `done:${ymd(d.date)}:${slug(ex.name)}`;
          const chk = document.createElement('input');
          chk.type='checkbox';
          chk.checked = !!getLS(key,false);
          chk.addEventListener('change', e=> setLS(key, chk.checked));

          const ttl = document.createElement('div');
          ttl.className='title';
          ttl.innerHTML = `<div>${ex.name}</div><div class="meta">${ex.reps || ''}</div>`;

          li.appendChild(chk);
          li.appendChild(ttl);

          if(ex.link){
            const a = document.createElement('a');
            a.className='vid';
            a.textContent='Video';
            a.target='_blank';
            a.rel='noopener';
            a.href = normalizeLink(ex.link);
            li.appendChild(a);
          }
          ul.appendChild(li);
        });

      container.appendChild(node);
    });
  }

  function normalizeLink(s){
    if(!s) return '#';
    if(/^https?:/.test(s)) return s;
    // vimeo id
    if(/^[0-9]+$/.test(String(s))) return `https://vimeo.com/${s}`;
    return s;
  }

  function guessType(d){
    const t = d.rawTitle||'';
    const m = t.match(/-\s*([^\-]+)$/);
    if(m) return m[1].trim();
    return '';
  }

  // ---------- Wiring ----------
  let weeks = [];
  let currentWeek = 0;

  async function init(){
    await loadFitness();

    const raw = await loadPlan();
    const norm = normalizePlan(raw);
    weeks = expandWeeks(norm.weeks, 26);
    dateifyWeeks(weeks);
    enforceSixOne(weeks);

    // pick the week that contains TODAY
    const today = new Date();
    currentWeek = weeks.findIndex(w=> w.days.some(d=> d.date.getFullYear()===today.getFullYear() && d.date.getMonth()===today.getMonth() && d.date.getDate()===today.getDate() ));
    if(currentWeek<0) currentWeek = 0;

    renderWeek(currentWeek);

    // nav
    $('#prev').onclick = ()=>{ if(currentWeek>0){ currentWeek--; renderWeek(currentWeek);} };
    $('#next').onclick = ()=>{ if(currentWeek<weeks.length-1){ currentWeek++; renderWeek(currentWeek);} };
    $('#today').onclick = ()=>{ init(); };
  }

  init();
})();
