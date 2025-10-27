
(function(){
  const $ = (s, d=document)=>d.querySelector(s);
  const $$ = (s, d=document)=>Array.from(d.querySelectorAll(s));
  const fmt = (d)=>d.toLocaleDateString(undefined, {year:'numeric',month:'2-digit',day:'2-digit'});

  const STORAGE_VERSION = 'v2'; // namespace for checkboxes

  // Theme
  const themeBtn = $('#themeBtn');
  const applyTheme = (t)=>{ document.documentElement.classList.toggle('light', t==='light'); localStorage.setItem('theme', t); }
  const nextTheme = ()=> localStorage.getItem('theme')==='light'?'dark':'light';
  applyTheme(localStorage.getItem('theme')|| (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
  themeBtn.addEventListener('click', ()=>applyTheme(nextTheme()));

  // Fitness
  fetch('fitness.json?ts='+Date.now()).then(r=>r.json()).then(data=>{
    const box = $('#fitness');
    const wlines = (data.workouts||[]).map(w=>`• ${w.type||w.name||'Workout'} · ${w.minutes||w.duration||''} min`).join('<br>');
    box.innerHTML = `
      <div class="meta">${data.date||''}</div>
      <div>Steps: ${data.steps||0} · Distance: ${(data.distance_km||0).toFixed(2)} km</div>
      <div>Active: ${data.active_energy_kcal||0} kcal · Exercise: ${data.exercise_minutes||0} min</div>
      <div class="small">Workouts:</div>
      <div class="small">${wlines||'—'}</div>`;
  }).catch(()=>{ $('#fitness').textContent = 'No data'; });

  // Plan
  const hasVideo = (x)=>{
    if(!x) return false;
    const tryKeys = ['video','vimeo','link','url'];
    // walk nested
    let url = null;
    if (typeof x === 'string') url = x;
    else {
      let node = x;
      for (let k of tryKeys){
        if (!node) break;
        if (typeof node[k]==='string'){ url = node[k]; break; }
        node = node[k];
      }
      // also check common shapes
      if(!url){
        url = x.url || (x.video&&x.video.url) || (x.vimeo&&x.vimeo.url) || (x.links&&x.links.vimeo);
      }
    }
    if(url && /vimeo\.com|player\.vimeo\.com/i.test(url)) return url;
    return null;
  };
  const isMobility = (name='')=> /(incline walk|walking|mobility|plank|stretch|hang|bird dog|dead bug)/i.test(name);

  const keyFor = (dateStr, name)=> `${STORAGE_VERSION}|${dateStr}|${name}`;
  const readCheck = (k)=> localStorage.getItem(k)==='1';
  const writeCheck = (k,v)=> localStorage.setItem(k, v?'1':'0');

  function render(plan){
    // Normalize into weeks -> days -> items
    const weeks = plan.weeks || plan.plan || plan || [];
    const cal = $('#calendar'); cal.innerHTML='';

    // Build a list of all day nodes with a comparable date string if available
    const today = new Date();
    const todayKey = today.toISOString().slice(0,10);

    let todayEl = null, targetWeekIdx = 0;

    weeks.forEach((w, wi)=>{
      const weekEl = document.createElement('section');
      weekEl.className = 'week';
      const range = w.range || w.title || '';
      weekEl.innerHTML = `<div class="head"><div>Week ${wi+1}</div><div class="meta">${range}</div></div>`;
      const days = w.days || w.workouts || [];

      days.forEach(d=>{
        const day = document.createElement('article');
        day.className = 'day';
        const dateStr = d.isoDate || d.date || d.label || '';
        const label = d.title || d.day || d.label || '';
        const right = (d.dateLabel || d.rightLabel || '');
        day.innerHTML = `<h3><span>${label||'Day'}</span><span class="meta">${right||dateStr||''}</span></h3><div class="list"></div>`;
        const list = day.querySelector('.list');
        const flat = (d.items||d.exercises||d.movements||[]);

        // Filter: Only exercises with Vimeo links, allow mobility without link
        flat.forEach(ex=>{
          const name = ex.name || ex.title || ex.exercise || '';
          const range = ex.reps || ex.repRange || ex.range || ex.setsReps || '';
          const url = hasVideo(ex.video)||hasVideo(ex);
          if (!url && !isMobility(name)) return; // skip non-mobility without video

          const row = document.createElement('div');
          row.className='item';

          const k = keyFor(dateStr||todayKey, name);
          const checked = readCheck(k);

          row.innerHTML = `
            <div>
              <div class="name">${name||'Exercise'}</div>
              <div class="range">${range||''}</div>
            </div>
            <div class="video">${url? `<a class="btn" href="${url}" target="_blank" rel="noopener">Video</a>`:''}</div>
            <input type="checkbox" ${checked?'checked':''} aria-label="Done">
          `;
          const cb = row.querySelector('input[type=checkbox]');
          cb.addEventListener('change', ()=>writeCheck(k, cb.checked));
          list.appendChild(row);
        });

        // identify today if labels match
        if (dateStr){
          // try to parse
          const dObj = new Date(dateStr);
          if(!isNaN(dObj)){
            if (dObj.toISOString().slice(0,10) === todayKey){
              day.classList.add('today'); todayEl = day; targetWeekIdx = wi;
            }
          } else {
            // try text match like 'Mon 27 Oct'
            const guess = today.toLocaleDateString(undefined,{weekday:'short', day:'2-digit', month:'short'});
            if ((label||'').includes(guess)) { day.classList.add('today'); todayEl = day; targetWeekIdx = wi; }
          }
        }
        weekEl.appendChild(day);
      });

      cal.appendChild(weekEl);
    });

    // Navigation
    const weeksEls = $$('.week');
    let idx = targetWeekIdx;
    function show(i){
      idx = Math.max(0, Math.min(weeksEls.length-1, i));
      weeksEls.forEach((w, j)=> w.style.display = j===idx? 'block':'none');
      setTimeout(()=> { (todayEl && weeksEls[idx].contains(todayEl)) && todayEl.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
    }
    $('#prevBtn').onclick = ()=> show(idx-1);
    $('#nextBtn').onclick = ()=> show(idx+1);
    $('#todayBtn').onclick = ()=> show(targetWeekIdx);
    show(idx);
  }

  fetch('plan.json?ts='+Date.now())
    .then(r=>r.json())
    .then(render)
    .catch(err=>{
      const cal = $('#calendar');
      cal.innerHTML = '<div class="card">Could not load plan.json</div>';
      console.error(err);
    });

})();
