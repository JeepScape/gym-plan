(function(){
  const $ = s=>document.querySelector(s);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const slug = s => (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const ymd = d => d.toISOString().slice(0,10);
  function getLS(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } }
  function setLS(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  // ---- Theme button
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
  const p = getLS('protein', null);
  if(p){ $('#bw').value = p.bw; const rb = document.querySelector('input[name="pf"][value="'+p.pf+'"]'); if(rb){ rb.checked = true; } }
  $('#bw').addEventListener('input', calcProtein);
  document.querySelectorAll('input[name="pf"]').forEach(r=> r.addEventListener('change', calcProtein));
  calcProtein();

  // ---- Fitness display
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
  loadFitness();

  // ---- Plan rendering
  async function fetchPlan(){
    const res = await fetch('plan.json?ts='+Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error('plan not found');
    return res.json();
  }

  function renderWeek(week){
    const container = $('#week');
    container.innerHTML = '';
    week.days.forEach((d)=>{
      const node = document.importNode($('#dayTpl').content, true);
      const art = node.querySelector('.day');
      const left = node.querySelector('.left');
      const right = node.querySelector('.right');
      const ul = node.querySelector('.exercises');

      const date = new Date(d.date + 'T00:00:00');
      left.textContent = d.header_left || 'Training';
      right.textContent = d.header_right || `${dayNames[date.getDay()]} ${String(date.getDate()).padStart(2,'0')} ${mon[date.getMonth()]}`;

      const t = new Date();
      if (date.getFullYear()===t.getFullYear() && date.getMonth()===t.getMonth() && date.getDate()===t.getDate()){
        art.classList.add('today');
        requestAnimationFrame(()=>art.scrollIntoView({behavior:'smooth', block:'start'}));
      }

      (d.exercises||[]).forEach(ex=>{
        const li = document.createElement('li');
        li.className = 'ex';

        const chk = document.createElement('input');
        const k = `done:${d.date}:${slug(ex.name)}`;
        chk.type = 'checkbox';
        chk.checked = !!getLS(k,false);
        chk.addEventListener('change', ()=> setLS(k, chk.checked));
        li.appendChild(chk);

        const title = document.createElement('div');
        const bits = [];
        if (ex.muscle) bits.push(`Muscle: ${ex.muscle}`);
        if (ex.sets) bits.push(`Sets: ${ex.sets}`);
        if (ex.reps) bits.push(`Reps: ${ex.reps}`);
        title.innerHTML = `<div><strong>${ex.name}</strong></div><div class="meta">${bits.join(' • ')}</div>`;
        li.appendChild(title);

        if (ex.video){
          const a = document.createElement('a');
          a.className='vid';
          a.textContent='Video';
          a.target='_blank';
          a.rel='noopener';
          a.href = (/^https?:/i.test(ex.video) ? ex.video : `https://vimeo.com/${ex.video}`);
          li.appendChild(a);
        }

        ul.appendChild(li);
      });

      container.appendChild(node);
    });
  }

  function pickWeekContainingToday(weeks){
    const t = new Date();
    const idx = weeks.findIndex(w => w.days.some(d => {
      const dd = new Date(d.date+'T00:00:00');
      return dd.getFullYear()===t.getFullYear() && dd.getMonth()===t.getMonth() && dd.getDate()===t.getDate();
    }));
    return idx>=0 ? idx : 0;
  }

  async function init(){
    const plan = await fetchPlan();
    const weeks = plan.weeks || [];
    let current = pickWeekContainingToday(weeks);
    renderWeek(weeks[current]);

    $('#prev').onclick = ()=>{ if(current>0){ current--; renderWeek(weeks[current]); } };
    $('#next').onclick = ()=>{ if(current<weeks.length-1){ current++; renderWeek(weeks[current]); } };
    $('#today').onclick = ()=>{ current = pickWeekContainingToday(weeks); renderWeek(weeks[current]); };
  }

  init();
})();