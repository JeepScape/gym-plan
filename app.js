(() => {
  const START_SUNDAY = '2025-10-26'; // week 1 anchor (Sunday)
  const MOBILITY_NAMES = ['Incline Walk + Mobility', 'Incline Walk', 'Mobility', 'Plank', 'Stretch'];
  const MOBILITY_FALLBACK = [{ name:'Incline Walk + Mobility', repRange:'20–30 min · 5–7% incline · talkable pace', video:null }];
  const STORAGE_KEY = 'exProgress.v1'; // date|exercise

  const $ = s => document.querySelector(s);
  const weeksEl = $('#weeks');
  const todayStats = $('#todayStats');

  // Theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') document.documentElement.classList.add('light');
  $('#themeBtn').onclick = () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  };

  // Buttons
  $('#prevBtn').onclick = () => moveWeek(-1);
  $('#nextBtn').onclick = () => moveWeek(+1);
  $('#todayBtn').onclick = scrollToToday;

  // Utilities
  const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday:'long' });
  const fmtDayShort = (d) => d.toLocaleDateString(undefined, { weekday:'short' });
  const fmtRight = (d) => d.toLocaleDateString(undefined, { weekday:'long', day:'2-digit', month:'short' });
  const iso = (d) => d.toISOString().slice(0,10);
  const parse = (s) => new Date(s + 'T00:00:00');

  function getSundayOfWeek(date){
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun..6 Sat
    d.setDate(d.getDate()-day);
    d.setHours(0,0,0,0);
    return d;
  }

  function firstWeekIndex(today, anchorSunday) {
    // number of weeks between anchor and today's week
    const diff = (getSundayOfWeek(today) - anchorSunday) / (7*24*3600*1000);
    return Math.max(0, Math.floor(diff));
  }

  // Load JSON helpers
  async function fetchJSON(path){
    const res = await fetch(path + '?v=' + Date.now());
    if (!res.ok) throw new Error('Failed to load '+path);
    return res.json();
  }

  // Progress storage
  const prog = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  function keyFor(dateStr, exName){ return dateStr + '|' + exName; }
  function getChecked(dateStr, exName){ return !!prog[keyFor(dateStr, exName)]; }
  function setChecked(dateStr, exName, val){
    prog[keyFor(dateStr, exName)] = !!val;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
  }

  // Vimeo detector
  function pickVimeoUrl(obj){
    if (!obj) return null;
    const tryList = [
      obj.video, obj.vimeo, obj.url, obj.link,
      obj?.links?.vimeo, obj?.links?.video, obj?.video?.url, obj?.vimeo?.url
    ].filter(Boolean);
    for (const v of tryList){
      const s = typeof v === 'string' ? v : (v.url || v.href || null);
      if (!s) continue;
      if (/vimeo\.com/gi.test(s)) return s;
    }
    return null;
  }

  function isMobilityName(name){
    return MOBILITY_NAMES.some(n => (name||'').toLowerCase().includes(n.toLowerCase()));
  }

  function ensureSixDaysSchedule(days){
    // Convert more than 1 rest/empty day into mobility
    let empties = days.filter(d => (!d.exercises || d.exercises.length === 0)).length;
    if (empties <= 1) {
      // still inject mobility for any remaining empty days so they are not blank
      days.forEach(d => {
        if (!d.exercises || d.exercises.length === 0) d.exercises = JSON.parse(JSON.stringify(MOBILITY_FALLBACK));
      });
      return days;
    }
    // Keep one true rest, others -> mobility
    let keptRest = false;
    days.forEach(d => {
      if (!d.exercises || d.exercises.length === 0) {
        if (!keptRest) { keptRest = true; d.exercises = []; d.rest = true; }
        else d.exercises = JSON.parse(JSON.stringify(MOBILITY_FALLBACK));
      }
    });
    return days;
  }

  function filterExercisesForDisplay(exs){
    const out = [];
    for (const e of exs || []){
      const name = e.name || e.title || e.exercise || '';
      const range = e.repRange || e.reps || e.range || e.setsReps || '';
      const vimeo = pickVimeoUrl(e);
      if (vimeo || isMobilityName(name)) {
        out.push({ name, repRange: range, vimeo });
      }
    }
    return out;
  }

  function buildHeadingLeft(day, idx){
    // Expect something like "Sunday – Workout 1 – Chest"
    const title = day.title || day.name || day.workoutType || day.focus || '';
    const type = title ? (' – ' + title) : '';
    return `${fmtDay(parse(day.isoDate))} – Workout ${idx+1}${type}`;
  }

  function buildDayLineRight(day){
    const d = parse(day.isoDate);
    return d.toLocaleDateString(undefined, { weekday:'long', day:'2-digit', month:'short' });
  }

  async function render(){
    const [plan, fitness] = await Promise.all([fetchJSON('plan.json'), fetchJSON('fitness.json')]);

    // Today card
    if (fitness && fitness.date){
      const w = (fitness.workouts||[]).map(w => `• ${w.type||'Workout'} · ${w.minutes||0} min`).join('<br/>');
      todayStats.innerHTML = `
        <div><strong>${fitness.date}</strong></div>
        <div>Steps: ${fitness.steps||0} · Distance: ${(fitness.distance_km||0).toFixed(2)} km</div>
        <div>Active: ${fitness.active_energy_kcal||0} kcal · Exercise: ${fitness.exercise_minutes||0} min</div>
        <div>Workouts:<br/>${w || '—'}</div>
      `;
    } else {
      todayStats.textContent = 'No fitness.json yet.';
    }

    // Normalize plan
    const weeks = plan.weeks || plan.plan || [];
    // Build flat list of weeks with isoDate per day
    const outWeeks = weeks.map((w, wi) => {
      const days = (w.days || w.workouts || []).map((d, di) => {
        // derive isoDate if missing
        let dateStr = d.isoDate || d.date || null;
        if (!dateStr && (plan.startDate || plan.anchorDate)) {
          const start = parse(plan.startDate || plan.anchorDate);
          const dayDate = new Date(start);
          dayDate.setDate(start.getDate() + wi*7 + di);
          dateStr = iso(dayDate);
        }
        const name = d.name || d.title || '';
        const focus = d.focus || d.type || '';
        const exercises = filterExercisesForDisplay(d.exercises || d.items || d.movements || []);
        return {
          isoDate: dateStr,
          title: focus || name || '',
          rawTitle: name || '',
          exercises
        };
      });
      return { days: ensureSixDaysSchedule(days) };
    });

    // Determine initial week index relative to anchor
    const anchor = parse(START_SUNDAY);
    const today = new Date();
    let viewIndex = firstWeekIndex(today, anchor);

    // Clamp within available weeks
    viewIndex = Math.min(Math.max(viewIndex, 0), outWeeks.length-1);

    function draw(){
      weeksEl.innerHTML = '';
      const week = outWeeks[viewIndex];
      const wLabelStart = parse(week.days[0].isoDate);
      const wLabelEnd = parse(week.days[6].isoDate);
      const h3 = document.createElement('h3');
      h3.textContent = `Week ${viewIndex+1} · ${wLabelStart.toLocaleDateString(undefined,{day:'2-digit',month:'short'})} – ${wLabelEnd.toLocaleDateString(undefined,{day:'2-digit',month:'short'})}`;
      const wrap = document.createElement('div');
      wrap.className = 'week';
      wrap.appendChild(h3);

      week.days.forEach((day, di) => {
        const dEl = document.createElement('div'); dEl.className = 'day card';
        const d = parse(day.isoDate);
        const todayIso = iso(new Date());
        if (iso(d) === todayIso) dEl.classList.add('today');

        const head = document.createElement('div'); head.className='dayhead';
        const left = document.createElement('div'); left.className='dayleft'; left.textContent = buildHeadingLeft(day, di);
        const right = document.createElement('div'); right.className='dayright'; right.textContent = buildDayLineRight(day);
        head.append(left,right);
        dEl.appendChild(head);

        const exs = day.exercises;
        if (!exs || exs.length===0){
          const p = document.createElement('div'); p.className='exercise';
          p.innerHTML = `<div class="ex-left"><div class="ex-title">Rest</div></div>`;
          dEl.appendChild(p);
        } else {
          exs.forEach(ex => {
            const row = document.createElement('div'); row.className='exercise';
            const left = document.createElement('div'); left.className='ex-left';
            const title = document.createElement('div'); title.className='ex-title'; title.textContent = ex.name || 'Exercise';
            const range = document.createElement('div'); range.className='ex-range'; range.textContent = ex.repRange || '';
            left.append(title); if (ex.repRange) left.append(range);
            const actions = document.createElement('div'); actions.className='ex-actions';
            if (ex.vimeo) {
              const a = document.createElement('a'); a.href = ex.vimeo; a.target='_blank'; a.rel='noopener'; a.className='vbtn'; a.textContent='Video';
              actions.appendChild(a);
            }
            const c = document.createElement('input'); c.type='checkbox'; c.checked = getChecked(day.isoDate, ex.name||'');
            c.addEventListener('change', ()=> setChecked(day.isoDate, ex.name||'', c.checked));
            actions.appendChild(c);
            row.append(left, actions);
            dEl.appendChild(row);
          });
        }

        wrap.appendChild(dEl);
      });

      weeksEl.appendChild(wrap);
    }

    function moveWeek(delta){
      viewIndex = Math.min(Math.max(viewIndex+delta, 0), outWeeks.length-1);
      draw(); setTimeout(scrollToToday, 50);
    }

    function scrollToToday(){
      const t = document.querySelector('.day.today');
      if (t) t.scrollIntoView({behavior:'smooth', block:'center'});
    }

    draw();
    setTimeout(scrollToToday, 100);
  }

  // Kickoff
  render().catch(e => {
    console.error(e);
    weeksEl.innerHTML = `<div class="card">Error: ${e.message}</div>`;
  });
})();