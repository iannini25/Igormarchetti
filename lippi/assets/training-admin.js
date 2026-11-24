(() => {
  'use strict';
  let key = '', generation = 0;
  const login = document.getElementById('login');
  const dashboard = document.getElementById('dashboard');
  const status = document.getElementById('status');
  const responses = document.getElementById('responses');
  const accessKey = document.getElementById('admin-key');
  const labels = {
    brazil: 'Brazil', ireland: 'Ireland', portugal: 'Portugal', uk: 'United Kingdom', unsure: 'Not sure yet',
    licensing: 'Licensing and market entry', grc: 'Governance, risk and controls', regulation: 'Main regulations', tools: 'RegTech, cybersecurity and AI tools', all: 'All four workshops',
    under100: 'Under €100', '100_199': '€100-199', '200_299': '€200-299', '300_499': '€300-499', '500plus': '€500 or more', no_budget: 'No budget currently', not_interested: 'Not interested',
    online: 'Online', hybrid: 'Hybrid', in_person: 'In person', english: 'English', portuguese: 'Portuguese'
  };
  const fields = [
    ['target_markets', 'Target markets'], ['priority', 'Workshop priority'], ['budget', 'Budget per attendee'],
    ['format', 'Preferred format'], ['language', 'Preferred language'], ['business_model', 'Business model'],
    ['home_market', 'Home market'], ['comment', 'Comment'], ['referral', 'How they heard about Lippi'],
    ['contact_opt_in', 'Requested a reply'], ['email', 'Contact email']
  ];
  const say = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
  const display = (field, value) => {
    if (field === 'target_markets') return (value || []).map(item => labels[item] || item).join(', ');
    if (field === 'contact_opt_in') return value === true ? 'Yes' : 'No';
    if (['priority', 'budget', 'format', 'language'].includes(field)) return labels[value] || value || '-';
    return value || '-';
  };
  async function api(path) {
    const response = await fetch('/api/training-interest/admin?path=' + encodeURIComponent(path), {
      headers: {Authorization: 'Bearer ' + key}, cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      let message;
      try { message = (await response.json()).error; } catch {}
      throw new Error(message || 'Unable to retrieve responses.');
    }
    return response;
  }
  function signOut() {
    generation++;
    key = '';
    accessKey.value = '';
    responses.replaceChildren();
    dashboard.hidden = true;
    login.hidden = false;
    say('Signed out.');
  }
  async function refresh() {
    const requestGeneration = generation;
    say('Loading responses…');
    const data = await (await api('responses')).json();
    if (generation !== requestGeneration || !key) return;
    responses.replaceChildren();
    document.getElementById('count').textContent = data.count + (data.count === 1 ? ' response' : ' responses');
    for (const row of data.responses) {
      const article = document.createElement('article'); article.className = 'card';
      const metadata = document.createElement('p'); metadata.className = 'meta';
      metadata.textContent = new Date(row.created_at).toLocaleString('en-GB') + ' · Reference ' + row.id;
      const list = document.createElement('dl');
      for (const [field, label] of fields) {
        if (field === 'email' && !row.contact_opt_in) continue;
        const title = document.createElement('dt'), value = document.createElement('dd');
        title.textContent = label; value.textContent = display(field, row[field]); list.append(title, value);
      }
      article.append(metadata, list); responses.append(article);
    }
    if (!data.count) { const empty = document.createElement('p'); empty.textContent = 'No responses yet. Saved responses will appear here.'; responses.append(empty); }
    login.hidden = true; dashboard.hidden = false; say('Responses loaded.');
  }
  login.addEventListener('submit', async event => {
    event.preventDefault();
    generation++;
    const requestGeneration = generation;
    key = accessKey.value; accessKey.value = '';
    const button = login.querySelector('button'); button.disabled = true;
    try { await refresh(); }
    catch (error) { if (generation === requestGeneration) { key = ''; say(error.message, true); } }
    finally { button.disabled = false; }
  });
  document.getElementById('refresh').addEventListener('click', async event => {
    const button = event.currentTarget, requestGeneration = generation; button.disabled = true;
    try { await refresh(); } catch (error) { if (requestGeneration === generation) say(error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById('logout').addEventListener('click', signOut);
  window.addEventListener('pagehide', signOut);
  for (const button of document.querySelectorAll('[data-export]')) button.addEventListener('click', async () => {
    const requestGeneration = generation; button.disabled = true;
    try {
      const result = await api(button.dataset.export), blob = await result.blob();
      if (requestGeneration !== generation || !key) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'lippi-training-interest.' + button.dataset.export.split('.').pop();
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Export downloaded. Keep the file private and use contact details only for the requested reply.');
    } catch (error) { if (requestGeneration === generation) say(error.message, true); }
    finally { button.disabled = false; }
  });
})();
