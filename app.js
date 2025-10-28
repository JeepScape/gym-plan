(function(){
  const $ = s=>document.querySelector(s);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ymd = d => d.toISOString().slice(0,10);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  function getLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
  function setLS(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  // ---- Theme button (fixed)
  const themeBtn = $('#themeBtn');
  const savedTheme = getLS('theme', null);
  if(savedTheme){ document.documentElement.classList.toggle('theme-light', savedTheme==='light'); themeBtn.setAttribute('aria-pressed', savedTheme==='light'); }
  themeBtn?.addEventListener('click', ()=>{
    const light = !document.documentElement.classList.contains('theme-light');
    document.documentElement.classList.toggle('theme-light', light);
    themeBtn.setAttribute('aria-pressed', light);
    setLS('theme', light?'light':'dark');
  });

  // ---- Protein calculator
  function calcProtein(){
    const bw = parseFloat($('#bw').value||'0')||0;
    const pf = parseFloat(document.querySelector('input[name="pf"]:checked')?.value || '1.8');
    const grams = Math.round(bw * pf);
    $('#grams').textContent = grams + ' g';
    setLS('protein', {bw, pf});
  }
  // restore
  const p = getLS('protein', null);
  if(p){ $('#bw').value = p.bw; const rb = document.querySelector('input[name="pf"][value="'+p.pf+'"]'); if(rb){ rb.checked = true; } }
  $('#bw').addEventListener('input', calcProtein);
  document.querySelectorAll('input[name="pf"]').forEach(r=> r.addEventListener('change', calcProtein));
  calcProtein();

  // ---- Fitness
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
    }catch(e){ box.textContent = '—'; }
  }

  // ---- Plan
  async function fetchPlan(){
    const res = await fetch('plan.json?ts='+Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error('plan not found');
    return res.json();
  }

  function normalizePlan(raw){
    // Expect raw.weeks[].days[] with .date, .type, .exercises[{name, rep_range, video}]
    const weeks = Array.isArray(raw.weeks) ? raw.weeks.slice() : (Array.isArray(raw.plan) ? raw.plan.slice() : []);
    return weeks.map(w => ({
      start: w.start || null,
      label: w.label || '',
      days: (w.days||[]).map(d => ({
        date: d.date || null,
        type: d.type || d.title || '',
        notes: d.notes || '',
        exercises: (d.exercises||[]).map(x => ({
          name: x.name || x.title || 'Exercise',
          reps: x.rep_range || x.reps || x.setsReps || '',
          link: x.video || x.vimeo || x.url || x.link || null
        }))
      }))
    }));
  }

  // Build 26 anchor weeks starting Sun 26 Oct 2025 using the sequence from plan.json
  function buildCalendar(srcWeeks){
    const anchor = new Date(2025,9,26); // Sun 26 Oct 2025
    const seq = srcWeeks.length ? srcWeeks : [{days:new Array(7).fill({}).map((_,i)=>({type:i===6?'Rest / Recovery':'Incline Walk + Mobility', exercises:[]}))}];
    const out = [];
    for(let w=0; w<26; w++){
      const tmpl = seq[w % seq.length];
      const days = (tmpl.days||new Array(7)).map((d, i)=>{
        const dt = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + w*7 + i);
        // Keep only exercises with a video link; allow mobility without links
        const exs = (d.exercises||[]).filter(ex => {
          const isMob = /incline|walk|mobility|plank|stretch/i.test(ex.name||'');
          return isMob || !!ex.link;
        });
        // If a strength day ends up empty, fill with incline walk
        let type = d.type || '';
        let exercises = exs;
        if((!exercises || exercises.length===0) && (type.toLowerCase().startsWith('workout') || /chest|back|legs|pull|push|arms|shoulder/i.test(type))){
          type = 'Incline Walk + Mobility';
        }
        return {
          date: dt,
          type: type || 'Incline Walk + Mobility',
          notes: d.notes || '',
          exercises: (exercises && exercises.length) ? exercises : [{name:'Incline Walk + Mobility', reps:'20–30 min · 5–7% incline', link:null}]
        };
      });
      out.push({days});
    }
    return out;
  }

  function renderWeek(weeks, idx){
    const container = $('#week');
    container.innerHTML = '';
    const days = weeks[idx].days;
    days.forEach((d, di)=>{
      const node = document.importNode($('#dayTpl').content, true);
      const art = node.querySelector('.day');
      const left = node.querySelector('.left');
      const right = node.querySelector('.right');
      const ul = node.querySelector('.exercises');

      const Wn = di+1;
      const type = d.type || 'Training';
      const dayName = dayNames[d.date.getDay()];
      left.textContent = `${dayName} – Workout ${Wn} – ${type.replace(/^Workout\\s*\\d+\\s*-\\s*/i,'')}`;
      right.textContent = `${dayName} ${String(d.date.getDate()).padStart(2,'0')} ${mon[d.date.getMonth()]}`;

      // highlight if today
      const t = new Date();
      const isToday = d.date.getFullYear()===t.getFullYear() && d.date.getMonth()===t.getMonth() && d.date.getDate()===t.getDate();
      if(isToday){ art.classList.add('today'); requestAnimationFrame(()=>art.scrollIntoView({behavior:'smooth', block:'start'})); }

      (d.exercises||[]).forEach(ex=>{
        const li = document.createElement('li');
        li.className = 'ex';
        const key = `done:${ymd(d.date)}:${slug(ex.name)}`;

        const chk = document.createElement('input');
        chk.type='checkbox';
        chk.checked = !!getLS(key,false);
        chk.addEventListener('change', ()=> setLS(key, chk.checked));

        const ttl = document.createElement('div');
        ttl.className='title';
        ttl.innerHTML = `<div>${ex.name}</div><div class="meta">${ex.reps||''}</div>`;

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
    if(/^https?:/i.test(s)) return s;
    if(/^[0-9]+$/.test(String(s))) return `https://vimeo.com/${s}`;
    return s;
  }

  // ---- Nav
  let weeks = [];
  let currentWeek = 0;
  function pickWeekContainingToday(weeks){
    const t = new Date();
    const idx = weeks.findIndex(w => w.days.some(d => d.date.getFullYear()===t.getFullYear() && d.date.getMonth()===t.getMonth() && d.date.getDate()===t.getDate()));
    return idx>=0 ? idx : 0;
  }

  async function init(){
    await loadFitness();
    const raw = await fetchPlan();
    const norm = normalizePlan(raw);
    weeks = buildCalendar(norm);
    currentWeek = pickWeekContainingToday(weeks);
    renderWeek(weeks, currentWeek);

    $('#prev').onclick = ()=>{ if(currentWeek>0){ currentWeek--; renderWeek(weeks, currentWeek);} };
    $('#next').onclick = ()=>{ if(currentWeek<weeks.length-1){ currentWeek++; renderWeek(weeks, currentWeek);} };
    $('#today').onclick = ()=>{ currentWeek = pickWeekContainingToday(weeks); renderWeek(weeks, currentWeek); };
  }

  init();
})();