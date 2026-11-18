(() => {
  document.documentElement.classList.add('lippi-js');
  const button = document.querySelector('.lippi-menu-button');
  const nav = document.getElementById('lippi-navigation');
  if (!button || !nav) return;
  const setOpen = open => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-site-header]')) setOpen(false);
  });
  matchMedia('(min-width: 781px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
})();

/* Shared progressive localization. English remains the source; unmapped text remains in English.
   The language picker is available across public sections, except on the regulations page,
   where the full regulatory page's existing picker owns language changes. */
(() => {
  'use strict';
  const locales = ['en','pt','es','it'];
  const names = {en:'English',pt:'Português',es:'Español',it:'Italiano'};
  const labels = {en:'Language',pt:'Idioma',es:'Idioma',it:'Lingua'};
  const words = {"Home":["Início","Inicio","Home"],"Training":["Treinamento","Formación","Formazione"],"Regulatory":["Regulamentação","Regulación","Normativa"],"Articles":["Artigos","Artículos","Articoli"],"Free initial call":["Conversa inicial gratuita","Primera llamada gratuita","Prima chiamata gratuita"],"Book a call":["Agendar uma conversa","Reservar una llamada","Prenota una chiamata"],"Menu":["Menu","Menú","Menu"],"Advisory services":["Consultoria","Asesoría","Consulenza"],"Regulatory updates":["Atualizações regulatórias","Actualizaciones normativas","Aggiornamenti normativi"],"Newsletter":["Boletim","Boletín","Newsletter"],"About Igor":["Sobre Igor","Sobre Igor","Chi è Igor"],"Founder survey":["Pesquisa com fundadores","Encuesta para fundadores","Sondaggio per fondatori"],"Advisory scope":["Escopo da consultoria","Alcance de la asesoría","Ambito della consulenza"],"Independence & conflicts":["Independência e conflitos","Independencia y conflictos","Indipendenza e conflitti"],"Risk and compliance consulting for fintech teams.":["Consultoria em riscos e conformidade para equipes fintech.","Asesoría en riesgos y cumplimiento para equipos fintech.","Consulenza su rischi e conformità per i team fintech."],"Supporting entry and expansion in the EU and Brazil.":["Apoio à entrada e expansão na UE e no Brasil.","Apoyo a la entrada y expansión en la UE y Brasil.","Supporto all'ingresso e all'espansione nell'UE e in Brasile."],"Practical risk, controls and learning for fintech teams.":["Riscos, controles e formação prática para fintechs.","Riesgos, controles y formación práctica para fintechs.","Rischi, controlli e formazione pratica per le fintech."],"Experience across the European Union, the UK and Brazil.":["Experiência na União Europeia, no Reino Unido e no Brasil.","Experiencia en la Unión Europea, el Reino Unido y Brasil.","Esperienza nell'Unione europea, nel Regno Unito e in Brasile."],"Skip to main content":["Ir para o conteúdo","Ir al contenido principal","Vai al contenuto"],"Payments & fintech consulting · EU & Brazil":["Consultoria em pagamentos e fintechs · UE e Brasil","Asesoría en pagos y fintech · UE y Brasil","Consulenza pagamenti e fintech · UE e Brasile"],"Risk and compliance consulting for fintechs.":["Consultoria de riscos e conformidade para fintechs.","Consultoría de riesgos y cumplimiento para fintechs.","Consulenza sui rischi e sulla conformità per le fintech."],"I’m Igor Marchetti Lippi. I help payments and fintech businesses entering or expanding in the EU or Brazil put practical controls, responsibilities and reporting in place.":["Sou Igor Marchetti Lippi. Ajudo empresas de pagamentos e fintechs que entram ou crescem na UE ou no Brasil a estabelecer controles, responsabilidades e relatórios práticos.","Soy Igor Marchetti Lippi. Ayudo a empresas de pagos y fintech que entran o crecen en la UE o Brasil a establecer controles, responsabilidades e informes prácticos.","Sono Igor Marchetti Lippi. Aiuto le imprese di pagamento e le fintech che entrano o crescono nell'UE o in Brasile a definire controlli, responsabilità e reportistica concreti."],"Start with a free 30-minute needs analysis. Then agree a costed project with clear deliverables.":["Comece com uma análise gratuita de necessidades, de 30 minutos. Depois, defina um projeto com preço e entregas claros.","Comience con un análisis gratuito de necesidades de 30 minutos. Después, acuerde un proyecto con presupuesto y entregables claros.","Inizia con un'analisi gratuita delle esigenze di 30 minuti. Poi concordiamo un progetto con preventivo e risultati definiti."],"Book a free needs analysis":["Agendar análise gratuita","Reservar análisis gratuito","Prenota l'analisi gratuita"],"See how I can help ↓":["Veja como posso ajudar ↓","Vea cómo puedo ayudar ↓","Scopri come posso aiutarti ↓"],"25+ years in payments, technology and risk across the European Union, the UK and Brazil":["Mais de 25 anos em pagamentos, tecnologia e riscos na União Europeia, no Reino Unido e no Brasil","Más de 25 años en pagos, tecnología y riesgos en la Unión Europea, el Reino Unido y Brasil","Oltre 25 anni nei pagamenti, nella tecnologia e nel rischio nell'Unione europea, nel Regno Unito e in Brasile"],"Corporate experience. Practical support for your team.":["Experiência corporativa. Apoio prático à sua equipe.","Experiencia corporativa. Apoyo práctico para su equipo.","Esperienza aziendale. Supporto concreto al tuo team."],"Payments and fintech teams growing in the EU or Brazil.":["Equipes de pagamentos e fintechs em expansão na UE ou no Brasil.","Equipos de pagos y fintech en expansión en la UE o Brasil.","Team di pagamenti e fintech in crescita nell'UE o in Brasile."],"A clear first conversation. A defined project.":["Uma conversa inicial clara. Um projeto definido.","Una primera conversación clara. Un proyecto definido.","Un primo confronto chiaro. Un progetto definito."],"Free needs analysis":["Análise gratuita de necessidades","Análisis gratuito de necesidades","Analisi gratuita delle esigenze"],"A costed initial project":["Projeto inicial com orçamento","Proyecto inicial presupuestado","Progetto iniziale con preventivo"],"Practical work and handover":["Implementação prática e transferência","Trabajo práctico y traspaso","Lavoro concreto e passaggio di consegne"],"Explore the work in more detail.":["Conheça o trabalho em mais detalhes.","Explore el trabajo con más detalle.","Scopri il lavoro più nel dettaglio."],"All topics":["Todos os temas","Todos los temas","Tutti i temi"],"Advisory":["Consultoria","Asesoría","Consulenza"],"Learning":["Aprendizagem","Aprendizaje","Formazione"],"About Lippi":["Sobre a Lippi","Sobre Lippi","Informazioni su Lippi"],"What is your fintech’s next step?":["Qual é o próximo passo da sua fintech?","¿Cuál es el siguiente paso de su fintech?","Qual è il prossimo passo della tua fintech?"],"Keep the conversation going.":["Vamos continuar a conversa.","Sigamos conversando.","Continuiamo a parlarne."],"Optional training · Tailored to your project":["Formação opcional · Adaptada ao seu projeto","Formación opcional · Adaptada a su proyecto","Formazione facoltativa · Su misura per il progetto"],"Training that supports your fintech project.":["Formação que apoia seu projeto fintech.","Formación que respalda su proyecto fintech.","Formazione a supporto del tuo progetto fintech."],"Focused workshops to help your team carry out practical risk and governance work.":["Workshops focados para ajudar sua equipe a realizar atividades práticas de riscos e governança.","Talleres específicos para ayudar a su equipo en tareas prácticas de riesgos y gobernanza.","Workshop mirati per aiutare il tuo team a svolgere attività concrete su rischi e governance."],"Start with a free 30-minute needs analysis. We explore your priorities and, where we can help, prepare a costed consulting proposal. Training can form part of the project or be scoped as a focused session.":["Comece com uma conversa gratuita de 30 minutos para analisar necessidades. Avaliamos suas prioridades e, quando pudermos ajudar, preparamos uma proposta de consultoria com preço definido. A formação pode integrar o projeto ou ser uma sessão específica.","Comience con un análisis gratuito de necesidades de 30 minutos. Exploramos sus prioridades y, si podemos ayudar, elaboramos una propuesta de asesoría con presupuesto. La formación puede integrarse en el proyecto o realizarse como una sesión concreta.","Inizia con un'analisi gratuita delle esigenze di 30 minuti. Esaminiamo le priorità e, dove possiamo essere utili, prepariamo una proposta di consulenza con preventivo. La formazione può far parte del progetto oppure essere una sessione mirata."],"Learn what your project needs.":["Implemente o aprendizado de que seu projeto precisa.","Aprenda lo que necesita su proyecto.","Impara ciò che serve al tuo progetto."],"Choose the learning your team needs.":["Escolha a formação de que sua equipe precisa.","Elija la formación que necesita su equipo.","Scegli la formazione più utile al tuo team."],"Learn with Igor Marchetti Lippi.":["Aprenda com Igor Marchetti Lippi.","Aprenda con Igor Marchetti Lippi.","Impara con Igor Marchetti Lippi."],"Practical learning. Relevant to your project.":["Aprendizado prático e relevante para seu projeto.","Aprendizaje práctico y relevante para su proyecto.","Formazione pratica, utile al tuo progetto."],"Notes from the":["Notas sobre o","Notas sobre el","Riflessioni sul"],"fintech conversation.":["universo fintech.","mundo fintech.","mondo fintech."],"Ideas into practice":["Ideias em prática","Ideas en práctica","Dalle idee alla pratica"],"Igor Marchetti Lippi writes about payments, risk and market entry, drawing on experience across the European Union, the UK and Brazil.":["Igor Marchetti Lippi escreve sobre pagamentos, riscos e entrada em mercados, com base na experiência na União Europeia, no Reino Unido e no Brasil.","Igor Marchetti Lippi escribe sobre pagos, riesgos y acceso a mercados desde su experiencia en la Unión Europea, el Reino Unido y Brasil.","Igor Marchetti Lippi scrive di pagamenti, rischio e ingresso nei mercati, attingendo alla sua esperienza nell'Unione europea, nel Regno Unito e in Brasile."],"Join the newsletter":["Assine o boletim","Suscríbase al boletín","Iscriviti alla newsletter"],"The next articles are taking shape.":["Os próximos artigos estão sendo preparados.","Los próximos artículos están tomando forma.","I prossimi articoli sono in preparazione."],"A considered monthly read.":["Uma leitura mensal selecionada.","Una lectura mensual seleccionada.","Una lettura mensile ragionata."],"Practical resources for your team.":["Recursos práticos para sua equipe.","Recursos prácticos para su equipo.","Risorse pratiche per il tuo team."]};
  const sourceText = new WeakMap();
  const sourceAttribute = new WeakMap();
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const picker = document.getElementById('reg-language');
  const requested = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem('lippi-language'); } catch {}
  let lang = locales.includes(requested) ? requested : locales.includes(saved) ? saved : 'en';
  const getTranslated = (value, language) => {
    const index = ['pt','es','it'].indexOf(language);
    return index < 0 ? value : (words[value] && words[value][index]) || value;
  };
  function apply(language) {
    if (!locales.includes(language)) return;
    lang = language;
    document.documentElement.lang = {en:'en',pt:'pt-BR',es:'es',it:'it'}[lang];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script,style,textarea,option')) continue;
      if (!sourceText.has(node)) sourceText.set(node,node.nodeValue);
      const original = sourceText.get(node);
      const trimmed = original.trim();
      if (!trimmed || !words[trimmed]) continue;
      node.nodeValue = original.replace(trimmed,getTranslated(trimmed,lang));
    }
    document.querySelectorAll('[aria-label], [placeholder]').forEach(element => {
      if (!sourceAttribute.has(element)) sourceAttribute.set(element, {aria:element.getAttribute('aria-label'),placeholder:element.getAttribute('placeholder')});
      const original = sourceAttribute.get(element);
      if (original.aria) element.setAttribute('aria-label',getTranslated(original.aria,lang));
      if (original.placeholder) element.setAttribute('placeholder',getTranslated(original.placeholder,lang));
    });
    const ownLabel = document.querySelector('.lippi-language-picker > span');
    if (ownLabel) ownLabel.textContent = labels[lang];
    try { localStorage.setItem('lippi-language',lang); } catch {}
  }
  if (!picker) {
    const nav = document.getElementById('lippi-navigation');
    if (nav) {
      const label = document.createElement('label');
      label.className = 'lippi-language-picker';
      const title = document.createElement('span'); title.textContent = labels[lang];
      const select = document.createElement('select');
      select.id = 'lippi-language'; select.setAttribute('aria-label','Website language');
      for (const code of locales) {
        const option = document.createElement('option'); option.value = code; option.textContent = names[code];
        select.appendChild(option);
      }
      select.value = lang;
      label.append(title,select);
      nav.appendChild(label);
      select.addEventListener('change', () => {
        apply(select.value);
        const url = new URL(location.href);
        if (select.value === 'en') url.searchParams.delete('lang');
        else url.searchParams.set('lang',select.value);
        history.replaceState(null,'',url);
      });
    }
  } else {
    picker.addEventListener('change', () => apply(picker.value));
  }
  apply(lang);
})();
