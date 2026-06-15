// Logique métier du Smart Planner

import { DashboardService } from './dashboard.js';

export const PlannerService = {
  // Liste simulée d'opportunités entrantes avec dates associées
  mockedOpportunities: [
    { id: 'opt1', platform: 'Otoqi', from: 'Paris (75)', to: 'Lyon (69)', price: 180, distance: 460, date: '2026-06-08' },
    { id: 'opt2', platform: 'Hiflow', from: 'Lyon (69)', to: 'Marseille (13)', price: 130, distance: 315, date: '2026-06-09' },
    { id: 'opt3', platform: 'Driiveme', from: 'Marseille (13)', to: 'Nice (06)', price: 65, distance: 200, date: '2026-06-10' },
    { id: 'opt4', platform: 'Expedicar', from: 'Paris (75)', to: 'Lille (59)', price: 85, distance: 220, date: '2026-06-12' },
    { id: 'opt5', platform: 'Otoqi', from: 'Lyon (69)', to: 'Genève (CH)', price: 90, distance: 150, date: '2026-06-08' },
    { id: 'opt6', platform: 'Hiflow', from: 'Nice (06)', to: 'Paris (75)', price: 300, distance: 930, date: '2026-06-15' },
    { id: 'opt7', platform: 'Expedicar', from: 'Lille (59)', to: 'Strasbourg (67)', price: 150, distance: 520, date: '2026-06-16' },
    { id: 'opt8', platform: 'Otoqi', from: 'Strasbourg (67)', to: 'Paris (75)', price: 160, distance: 490, date: '2026-06-14' },
    { id: 'opt9', platform: 'Hiflow', from: 'Bordeaux (33)', to: 'Toulouse (31)', price: 110, distance: 245, date: '2026-06-17' }
  ],

  // Tournée prévue par l'utilisateur
  plannedMissions: [],

  init() {
    this.renderOpportunities();
    this.renderPlannedMissions();

    const searchInput = document.getElementById('sp_search_input');
    const filterPlatform = document.getElementById('sp_filter_platform');
    const filterDateRange = document.getElementById('sp_filter_date_range');
    const filterDateStart = document.getElementById('sp_filter_date_start');
    const filterDateEnd = document.getElementById('sp_filter_date_end');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.renderOpportunities();
        this.drawMap();
      });
    }
    if (filterPlatform) {
      filterPlatform.addEventListener('change', () => this.renderOpportunities());
    }
    if (filterDateRange) {
      filterDateRange.addEventListener('change', (e) => {
        const val = e.target.value;
        const customContainer = document.getElementById('sp_custom_date_container');
        if (customContainer) {
          if (val === 'custom') {
            customContainer.classList.remove('hidden');
          } else {
            customContainer.classList.add('hidden');
          }
        }
        this.renderOpportunities();
      });
    }
    if (filterDateStart) {
      filterDateStart.addEventListener('change', () => this.renderOpportunities());
    }
    if (filterDateEnd) {
      filterDateEnd.addEventListener('change', () => this.renderOpportunities());
    }

    // Set up HTML5 Drag and Drop zone on the planned missions list
    const plannedList = document.getElementById('sp_planned_list');
    if (plannedList) {
      let dragCounter = 0;

      plannedList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      plannedList.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        plannedList.classList.add('border-2', 'border-dashed', 'border-indigo-400', 'dark:border-indigo-500', 'bg-indigo-50/10', 'dark:bg-indigo-950/10', 'rounded-2xl');
      });

      plannedList.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
          plannedList.classList.remove('border-2', 'border-dashed', 'border-indigo-400', 'dark:border-indigo-500', 'bg-indigo-50/10', 'dark:bg-indigo-950/10', 'rounded-2xl');
        }
      });

      plannedList.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        plannedList.classList.remove('border-2', 'border-dashed', 'border-indigo-400', 'dark:border-indigo-500', 'bg-indigo-50/10', 'dark:bg-indigo-950/10', 'rounded-2xl');
        const id = e.dataTransfer.getData('text/plain');
        if (id) {
          this.addToPlan(id);
          DashboardService.showNotification("Mission planifiée avec succès !", "success");
        }
      });
    }

    // Set up a ResizeObserver to redraw the France D3 map dynamically when its width or height changes (tabs, resize)
    const mapContainer = document.getElementById('d3_planner_map');
    if (mapContainer && window.ResizeObserver) {
      let resizeTimeout;
      const observer = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          this.drawMap();
        }, 150);
      });
      observer.observe(mapContainer);
    }
  },

  handleDragStart(event, id) {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    
    // Add visual indicator to the node being dragged
    const dragTarget = event.currentTarget;
    if (dragTarget) {
      dragTarget.classList.add('opacity-40');
      // Timeout allows the ghost image to be drawn with original styling, 
      // but the card in the list receives dragged-state visual indicator.
      setTimeout(() => {
        if (dragTarget && dragTarget.parentElement) {
          dragTarget.classList.remove('opacity-40');
          dragTarget.classList.add('opacity-25', 'border-indigo-300', 'dark:border-indigo-800');
        }
      }, 0);
    }
  },

  handleDragEnd(event) {
    const dragTarget = event.currentTarget;
    if (dragTarget) {
      dragTarget.classList.remove('opacity-25', 'border-indigo-300', 'dark:border-indigo-800');
    }
  },

  getBadgeColor(platform) {
    switch (platform.toLowerCase()) {
      case 'otoqi': return 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/45 dark:border-orange-500/20';
      case 'driiveme': return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400 border border-cyan-200/45 dark:border-cyan-500/20';
      case 'hiflow': return 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-200/45 dark:border-violet-500/20';
      case 'expedicar': return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/45 dark:border-rose-500/20';
      default: return 'bg-slate-50 text-slate-700 dark:bg-slate-800/45 dark:text-slate-400 border border-slate-200/45 dark:border-slate-700/50';
    }
  },

  formatOppDate(dateStr) {
    if (!dateStr) return "N/A";
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`; // ex: 08/06
      }
      return dateStr;
    } catch(e) {
      return dateStr;
    }
  },

  getRangeLimits(range) {
    const now = new Date();
    const base = (now.getFullYear() === 2026) ? now : new Date("2026-06-08");

    const getFormattedDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${date}`;
    };

    if (range === 'today') {
      const d = new Date(base);
      const str = getFormattedDate(d);
      return { start: str, end: str };
    } else if (range === 'this_week') {
      const dStart = new Date(base);
      const day = dStart.getDay();
      const diff = dStart.getDate() - day + (day === 0 ? -6 : 1);
      dStart.setDate(diff);

      const dEnd = new Date(dStart);
      dEnd.setDate(dStart.getDate() + 6);
      return { start: getFormattedDate(dStart), end: getFormattedDate(dEnd) };
    } else if (range === 'next_week') {
      const dStart = new Date(base);
      const day = dStart.getDay();
      const diff = dStart.getDate() - day + (day === 0 ? -6 : 1) + 7;
      dStart.setDate(diff);

      const dEnd = new Date(dStart);
      dEnd.setDate(dStart.getDate() + 6);
      return { start: getFormattedDate(dStart), end: getFormattedDate(dEnd) };
    }
    return null;
  },

  renderOpportunities() {
    const listEl = document.getElementById('sp_opportunities_list');
    const countEl = document.getElementById('sp_count_opportunites');
    if (!listEl) return;

    let search = document.getElementById('sp_search_input')?.value.toLowerCase() || '';
    let platform = document.getElementById('sp_filter_platform')?.value || 'all';
    let dateRange = document.getElementById('sp_filter_date_range')?.value || 'all';

    let filterStart = null;
    let filterEnd = null;

    if (dateRange === 'custom') {
      filterStart = document.getElementById('sp_filter_date_start')?.value || null;
      filterEnd = document.getElementById('sp_filter_date_end')?.value || null;
    } else if (dateRange !== 'all') {
      const limits = this.getRangeLimits(dateRange);
      if (limits) {
        filterStart = limits.start;
        filterEnd = limits.end;
      }
    }

    const filtered = this.mockedOpportunities.filter(o => {
      // Exclure celles déjà planifiées
      if (this.plannedMissions.find(p => p.id === o.id)) return false;

      const matchesSearch = o.from.toLowerCase().includes(search) || o.to.toLowerCase().includes(search);
      const matchesPlatform = platform === 'all' || o.platform.toLowerCase() === platform.toLowerCase();
      
      let matchesDate = true;
      if (filterStart || filterEnd) {
        const itemDate = o.date || '';
        if (filterStart && itemDate < filterStart) matchesDate = false;
        if (filterEnd && itemDate > filterEnd) matchesDate = false;
      }

      return matchesSearch && matchesPlatform && matchesDate;
    });

    if (countEl) countEl.innerText = filtered.length;

    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-slate-500 italic text-center mt-4">Aucune opportunité disponible ou correspondante.</p>`;
      return;
    }

    listEl.innerHTML = filtered.map(o => `
      <div draggable="true" ondragstart="window.PlannerService.handleDragStart(event, '${o.id}')" ondragend="window.PlannerService.handleDragEnd(event)" class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 hover:border-indigo-500/60 dark:hover:border-indigo-550 hover:shadow-lg hover:shadow-indigo-550/5 transition-all cursor-grab active:cursor-grabbing group shadow-sm select-none" onclick="PlannerService.addToPlan('${o.id}')">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-black px-2.5 py-1 rounded-full ${this.getBadgeColor(o.platform)} tracking-wide shadow-xs">${o.platform}</span>
            <span class="text-[9px] font-bold bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-450 px-2 py-1 rounded-lg flex items-center gap-1 border border-slate-200/30 dark:border-slate-800/40">
              <i data-lucide="calendar" class="w-3 h-3 text-slate-450 shrink-0"></i>
              <span>${this.formatOppDate(o.date)}</span>
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-450">${o.price} €</span>
            <button onclick="event.stopPropagation(); window.PlannerService.deleteOpportunity('${o.id}')" class="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 rounded-lg transition-all active:scale-95 cursor-pointer animate-fade-in" title="Supprimer l'opportunité">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs sm:text-sm my-2 gap-2">
          <div class="flex-1 min-w-0 text-left">
            <p class="font-black text-slate-800 dark:text-slate-200 truncate" title="${o.from}">${o.from}</p>
          </div>
          <div class="px-1.5 shrink-0 flex items-center justify-center">
            <i data-lucide="arrow-right" class="w-4 h-4 text-slate-300 dark:text-slate-700 transition-transform group-hover:translate-x-0.5"></i>
          </div>
          <div class="flex-1 min-w-0 text-right">
            <p class="font-black text-slate-800 dark:text-slate-200 truncate" title="${o.to}">${o.to}</p>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3.5 pt-2.5 border-t border-slate-100/60 dark:border-slate-900/60 text-[10px] text-slate-400">
          <span class="font-bold flex items-center gap-1"><i data-lucide="navigation-2" class="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0"></i> ~${o.distance} km</span>
          <span class="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-black transition-colors flex items-center gap-1 uppercase tracking-wider text-[9px] font-sans">
            <span>Planifier +</span>
            <i data-lucide="plus-circle" class="w-3 h-3 text-indigo-500 dark:text-indigo-400"></i>
          </span>
        </div>
      </div>
    `).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  autoSync() {
    this.plannedMissions = [];
    
    // On copie toutes les opportunités
    let available = [...this.mockedOpportunities];
    if (available.length === 0) return;
    
    // On démarre par exemple par la plus rentable ou la première
    let current = available.find(o => o.from.includes('Paris'));
    if (!current) current = available.sort((a,b)=>b.price - a.price)[0];
    
    while(current) {
        this.plannedMissions.push(current);
        available = available.filter(o => o.id !== current.id);
        
        const currentToRegion = current.to.match(/\((\d+)\)/)?.[1] || current.to.split(' ')[0];
        
        let next = available.find(o => o.from.includes(currentToRegion));
        if (!next && available.length > 0) {
            next = available[0];
        }
        
        current = next;
    }
    
    // Affichage d'une notification
    DashboardService.showNotification("Synchronisation intelligente réussie ! Tournée optimisée générée.", "success");
    
    this.renderOpportunities();
    this.renderPlannedMissions();
  },

  
  handleCityClick(name) {
    const searchInput = document.getElementById('sp_search_input');
    if (searchInput) {
      searchInput.value = name;
      this.renderOpportunities(); // Filter Backlog
      this.renderPlannedMissions(); // Filter Route path
    }
  },

  addToPlan(id) {
    const opp = this.mockedOpportunities.find(o => o.id === id);
    if (!opp) return;

    this.plannedMissions.push(opp);
    this.renderOpportunities();
    this.renderPlannedMissions();
  },

  removeFromPlan(id) {
    this.plannedMissions = this.plannedMissions.filter(o => o.id !== id);
    this.renderOpportunities();
    this.renderPlannedMissions();
  },

  renderPlannedMissions() {
    const listEl = document.getElementById('sp_planned_list');
    const emptyEl = document.getElementById('sp_empty_state');
    
    if (!listEl) return;

    if (this.plannedMissions.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      // Supprimer toutes les div qui ne sont pas l'empty state
      Array.from(listEl.children).forEach(child => {
        if (child.id !== 'sp_empty_state') child.remove();
      });
      this.updateRentabilitySummary();
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    // Construire la liste (on laisse le span hidden d'empty state)
    // On efface d'abord les anciennes alertes
    Array.from(listEl.children).forEach(child => {
      if (child.id !== 'sp_empty_state') child.remove();
    });

    // Analyser si "intelligent" (la précédente finit-elle où la nouvelle commence ?)
    let previousTo = null;

    this.plannedMissions.forEach((m, index) => {
      let isSmart = false;
      const originRegion = m.from.match(/\((\d+)\)/)?.[1] || '';
      
      if (previousTo) {
        // Simple comparaison pour deviner si le départ correspond à la dernière arrivée !
        const prevRegion = previousTo.match(/\((\d+)\)/)?.[1] || '';
        
        // Matcher soit avec le num de dépt soit contenu de la ville
        if ((prevRegion && originRegion && prevRegion === originRegion) || m.from.includes(previousTo.split(' ')[0])) {
           isSmart = true;
        }
      }
      
      const itemNode = document.createElement('div');
      itemNode.className = "flex relative group items-start";
      
      let badgeHtml = '';
      if (index > 0) {
        if (isSmart) {
           badgeHtml = `
             <div class="absolute -top-[11px] left-8 bg-[#ebfbf3] dark:bg-emerald-950/40 text-[#129c72] dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 z-10 border border-[#b2edd3]/60 dark:border-emerald-800">
               <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               Enchaînement Intelligent (zéro retour à vide)
             </div>`;
        } else {
           badgeHtml = `
             <div class="absolute -top-[11px] left-8 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 z-10 border border-amber-200/50 dark:border-amber-900/40">
               <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
               Voyage à vide de ${m.distance_between || 'liaison'} km nécessaire
             </div>`;
        }
      }

      const timelineLine = `<div class="w-0.5 bg-slate-250 dark:bg-slate-800 h-full absolute left-3 top-5 -z-10 group-last:hidden"></div>`;
      
      itemNode.innerHTML = `
        ${badgeHtml}
        ${timelineLine}
        <div class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] mt-2 shrink-0 z-10 shadow-md">
          ${index + 1}
        </div>
        
        <div class="ml-4 flex-1 bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm flex items-center justify-between mb-4 relative ${index > 0 && !isSmart ? 'border-amber-200 dark:border-amber-900/30' : ''} ${index > 0 && isSmart ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-slate-200 dark:border-slate-850'} transition-all hover:shadow-md">
          
          <!-- MOBILE ACCORDION / ADAPTIVE LAYOUT (md:hidden) -->
          <div class="md:hidden flex-1 flex flex-col gap-3">
             <div class="flex items-center justify-between">
               <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${this.getBadgeColor(m.platform)} tracking-wide shadow-xs">${m.platform}</span>
               <div class="flex flex-col text-right">
                 <span class="font-black font-mono text-[#059669] dark:text-emerald-400 text-sm leading-none">${m.price.toFixed(2)} €</span>
                 <span class="text-[8px] font-bold text-slate-400 mt-1">${(m.price/m.distance).toFixed(3)} €/km</span>
               </div>
             </div>
             
             <div class="flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
               <div class="flex-1 min-w-0">
                 <span class="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block mb-0.5">Départ</span>
                 <span class="font-bold text-slate-800 dark:text-slate-100 text-[11px] truncate block" title="${m.from}">${m.from}</span>
               </div>
               <div class="flex flex-col items-center justify-center px-1 shrink-0">
                 <span class="text-[8px] text-slate-450 dark:text-slate-500 font-bold leading-none mb-1">${m.distance} km</span>
                 <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-350 dark:text-slate-650 shrink-0"></i>
               </div>
               <div class="flex-1 min-w-0 text-right">
                 <span class="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest block mb-0.5">Arrivée</span>
                 <span class="font-bold text-slate-800 dark:text-slate-100 text-[11px] truncate block" title="${m.to}">${m.to}</span>
               </div>
             </div>
          </div>

          <!-- DESKTOP GRID LAYOUT (hidden md:flex) -->
          <div class="hidden md:flex flex-1 items-center justify-between">
            <!-- Info parcours -->
            <div class="grid grid-cols-12 gap-2 flex-1 items-center">
               <div class="col-span-4 flex flex-col pl-1">
                 <span class="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5 block">Départ</span>
                 <span class="font-extrabold text-slate-850 dark:text-slate-100 text-[13px] md:text-sm truncate" title="${m.from}">${m.from}</span>
               </div>
               
               <div class="col-span-4 flex flex-col items-center justify-center px-1 text-slate-300">
                  <span class="text-[9px] text-slate-450 dark:text-slate-500 font-bold mb-1">${m.distance} km</span>
                  <div class="w-full flex items-center gap-1">
                    <div class="flex-1 border-t border-dashed border-slate-300 dark:border-slate-700"></div>
                    <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-350 dark:text-slate-600 shrink-0"></i>
                    <div class="flex-1 border-t border-dashed border-slate-300 dark:border-slate-700"></div>
                  </div>
                  <span class="text-[9px] font-black px-2 py-0.5 rounded mt-2 uppercase tracking-wide shrink-0 ${this.getBadgeColor(m.platform)}">${m.platform}</span>
               </div>

               <div class="col-span-4 flex flex-col text-right pr-2">
                 <span class="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mb-1.5 block">Arrivée</span>
                 <span class="font-extrabold text-slate-850 dark:text-slate-100 text-[13px] md:text-sm truncate" title="${m.to}">${m.to}</span>
               </div>
            </div>
            
            <!-- Pricing -->
            <div class="ml-4 md:ml-6 flex items-center gap-4 pl-4 md:pl-6 border-l border-slate-100 dark:border-slate-800 min-w-[110px] justify-end">
               <div class="flex flex-col text-right">
                 <span class="font-black font-mono text-[#059669] dark:text-emerald-400 text-sm md:text-base leading-none">${m.price.toFixed(2)} €</span>
                 <span class="text-[9px] font-bold text-slate-400 mt-1">${(m.price/m.distance).toFixed(3)} €/km</span>
               </div>
            </div>
          </div>
          
          <!-- Shared Action Remove button -->
          <div class="ml-3 sm:ml-4 pl-3 sm:pl-4 border-l border-slate-100 dark:border-slate-800 shrink-0 self-center">
             <button onclick="PlannerService.removeFromPlan('${m.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer" title="Retirer">
               <i data-lucide="x" class="w-4 h-4 text-slate-400"></i>
             </button>
          </div>

        </div>
      `;
      listEl.appendChild(itemNode);

      previousTo = m.to;
    });

    this.updateRentabilitySummary();
    this.drawMap();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  cityCoordinates: {
    // Île-de-France
    'Paris': [2.3522, 48.8566],
    
    // Occitanie & Sud-Ouest
    'Toulouse': [1.4442, 43.6047],
    'Blagnac': [1.3916, 43.6358],
    'Albi': [2.1372, 43.9289],
    'Bordeaux': [-0.5792, 44.8378],
    'Agen': [0.6150, 44.2008],
    'Auch': [0.5857, 43.6456],
    'Montauban': [1.3548, 44.0175],
    'Foix': [1.6053, 42.9639],
    'Tarbes': [0.0789, 43.2329],
    'Cahors': [1.4422, 44.4475],
    'Rodez': [2.5734, 44.3516],
    'Pau': [-0.3708, 43.2951],
    'Biarritz': [-1.5586, 43.4832],
    'Bayonne': [-1.4748, 43.4929],
    'Dax': [-1.0536, 43.7103],
    'Mont-de-Marsan': [-0.5019, 43.8903],
    'Mérignac': [-0.6478, 44.8386],
    'Pessac': [-0.6311, 44.8067],
    'Talence': [-0.6277, 44.8117],
    'Bègles': [-0.5486, 44.8080],
    'Villeneuve-sur-Lot': [0.7042, 44.4079],
    'Castelsarrasin': [1.1075, 44.0383],
    'Moissac': [1.0954, 44.1039],
    'Figeac': [2.0344, 44.6083],
    'Graulhet': [1.9886, 43.7611],
    'Gaillac': [1.8978, 43.9014],
    'Lavaur': [1.8214, 43.6991],
    'Castres': [2.2400, 43.6000],
    'Mazamet': [2.3736, 43.4925],
    'Carmaux': [2.1550, 44.0539],
    'Millau': [3.0783, 44.0978],
    'Villefranche-de-Rouergue': [2.0353, 44.3519],
    'Decazeville': [2.2536, 44.5594],
    'Carla-Bayle': [1.3934, 43.1519],
    'Pamiers': [1.6111, 43.1114],
    'Muret': [1.3267, 43.4125],
    'Colomiers': [1.3361, 43.6131],
    'Tournefeuille': [1.3486, 43.5850],
    'Carcassonne': [2.3522, 43.2121],
    'Narbonne': [3.0039, 43.1833],
    'Béziers': [3.2178, 43.3444],
    'Sète': [3.6962, 43.4016],
    
    // Grand Sud-Est
    'Lyon': [4.8357, 45.7640],
    'Villeurbanne': [4.8787, 45.7719],
    'Marseille': [5.3698, 43.2965],
    'Nice': [7.2620, 43.7102],
    'Montpellier': [3.8767, 43.6108],
    'Grenoble': [5.7245, 45.1885],
    'Saint-Étienne': [4.3872, 45.4397],
    'Toulon': [5.9280, 43.1242],
    'Arles': [4.6278, 43.6766],
    'Orange': [4.8083, 44.1381],
    'Montélimar': [4.7478, 44.5562],
    'Valence': [4.8913, 44.9333],
    'Nîmes': [4.3601, 43.8367],
    
    // Nord, Ouest & Centre-Val de Loire
    'Lille': [3.0573, 50.6292],
    'Nantes': [-1.5536, 47.2184],
    'Rennes': [-1.6778, 48.1173],
    'Rouen': [1.0993, 49.4431],
    'Le Havre': [0.1079, 49.4944],
    'Caen': [-0.3707, 49.1829],
    'Brest': [-4.4861, 48.3903],
    'Le Mans': [0.1996, 48.0061],
    'Angers': [-0.5632, 47.4784],
    'Amiens': [2.2957, 49.8941],
    'Limoges': [1.2501, 45.8354],
    'Tours': [0.6848, 47.3941],
    'Clermont-Ferrand': [3.0870, 45.7772],
    'Orléans': [1.9090, 47.9030],
    'Bourges': [2.3962, 47.0810],
    'Blois': [1.3344, 47.5861],
    'Chartres': [1.4883, 48.4439],
    
    // Grand Est & Bourgogne-Franche-Comté
    'Strasbourg': [7.7521, 48.5734],
    'Dijon': [5.0415, 47.3220],
    'Nancy': [6.1844, 48.6921],
    'Reims': [4.0317, 49.2583],
    'Metz': [6.1757, 49.1193],
    'Besançon': [6.0241, 47.2378],
    'Mulhouse': [7.3389, 47.7458],
    'Troyes': [4.0744, 48.2974],
    'Auxerre': [3.5684, 47.7983],
    'Nevers': [3.1590, 46.9933],
    'Chalon-sur-Saône': [4.8543, 46.7820],
    'Mâcon': [4.8322, 46.3033],
    
    // Europe close limits
    'Genève': [6.1432, 46.2044],
    'Berlin': [13.4050, 52.5200],
    'Munich': [11.5820, 48.1351],
    'Frankfurt': [8.6821, 50.1109],
    'Hamburg': [9.9937, 53.5511],
    'Cologne': [6.9531, 50.9375],
    'Stuttgart': [9.1829, 48.7758],
    'Madrid': [-3.7038, 40.4168],
    'Barcelona': [2.1734, 41.3851],
    'Barcelone': [2.1734, 41.3851],
    'Valencia': [-0.3763, 39.4699],
    'Seville': [-5.9845, 37.3891],
    'Zaragoza': [-0.8877, 41.6488],
    'Málaga': [-4.4203, 36.7212],
    'Bilbao': [-2.9350, 43.2630]
  },

  currentMapMode: 'planned', // Mode par défaut: 'planned' ou 'history'

  setMapMode(mode) {
    this.currentMapMode = mode;
    
    // Mettre à jour les classes actives des boutons de l'onglet Carte
    const btnPlanned = document.getElementById('sp_map_mode_planned');
    const btnHistory = document.getElementById('sp_map_mode_history');
    
    if (btnPlanned && btnHistory) {
      if (mode === 'planned') {
        // Mode Planned actif
        btnPlanned.className = "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all shadow-sm bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200/20 dark:border-slate-600/75";
        btnHistory.className = "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
      } else {
        // Mode History actif
        btnHistory.className = "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all shadow-sm bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200/20 dark:border-slate-600/75";
        btnPlanned.className = "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
      }
    }
    
    // Redessiner la carte
    this.drawMap();
  },

  getStableCoords(cityName) {
    if (!cityName) return [2.3522, 48.8566];
    
    if (this.cityCoordinates[cityName]) {
      return this.cityCoordinates[cityName];
    }

    const normalize = (str) => {
      return str.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    };

    const normTarget = normalize(cityName);
    if (normTarget) {
      // Sort keys descending to match longer specific city names first
      const sortedEntries = Object.entries(this.cityCoordinates).sort((a, b) => b[0].length - a[0].length);
      for (const [key, coords] of sortedEntries) {
        const normKey = normalize(key);
        if (normTarget.includes(normKey) || normKey.includes(normTarget)) {
          return coords;
        }
      }
    }

    // Deterministic fallback hash for absolute fallback within France geography bounds
    let hash = 0;
    for (let i = 0; i < cityName.length; i++) {
      hash = cityName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lng = 2.0 + ((Math.abs(hash) % 100) / 18);  // range ~ -3.5 to 7.5
    const lat = 46.5 + (((Math.abs(hash) >> 8) % 100) / 18) - 2; // range ~ 41 to 49
    return [lng, lat];
  },

  drawMap() {
    const mapContainerId = '#d3_planner_map';
    const container = document.querySelector(mapContainerId);
    if (!container || !window.d3) return;

    // Clear previous map (and button if it was added)
    d3.select(mapContainerId).selectAll('svg').remove();
    d3.select(mapContainerId).selectAll('.map-reset-btn').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // Add Reset Button
    const resetButton = document.createElement('button');
    resetButton.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500"></i>`;
    resetButton.className = "map-reset-btn absolute top-3 right-3 z-30 p-2 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer backdrop-blur-sm";
    resetButton.onclick = () => {
      if (this.currentMapZoom && this.currentMapContainerGroup) {
        d3.select(container).select('svg').transition().duration(500).call(this.currentMapZoom.transform, d3.zoomIdentity);
      }
    };
    container.appendChild(resetButton);
    if (window.lucide) window.lucide.createIcons();

    const svg = d3.select(mapContainerId)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Setup tooltip
    let tooltip = d3.select('body').select('.d3-segment-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('class', 'd3-segment-tooltip absolute bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none z-[100] transition-opacity duration-150 transform -translate-x-1/2 -translate-y-full')
        .style('opacity', 0)
        .style('margin-top', '-10px');
    }

    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Group for zoomable content
    this.currentMapContainerGroup = svg.append('g').attr('class', 'map-content');                
    
    // Zoom behavior
    this.currentMapZoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        this.currentMapContainerGroup.attr('transform', event.transform);
      });
    svg.call(this.currentMapZoom);

    // Load France, Spain, and Germany GeoJSONs and draw
    Promise.all([
      d3.json('/france-regions.json'),
      d3.json('/spain.json'),
      d3.json('/germany.json')
    ])
      .then(([franceGeo, spainGeo, germanyGeo]) => {
        // Create projection fit to France map data to keep France at the center
        const projection = d3.geoMercator().fitExtent([[40, 40], [width - 40, height - 40]], franceGeo);
        const pathGenerator = d3.geoPath().projection(projection);

        // 1a. Draw Spain map
        if (spainGeo) {
          const spainGroup = this.currentMapContainerGroup.append('g').attr('class', 'spain-map');
          spainGroup.selectAll('path')
            .data(spainGeo.features)
            .enter()
            .append('path')
            .attr('d', pathGenerator)
            .attr('fill', isDarkMode ? '#111827' : '#f8fafc')
            .attr('stroke', isDarkMode ? '#1f2937' : '#e2e8f0') 
            .attr('stroke-width', isDarkMode ? 1.0 : 0.8)
            .attr('opacity', 0.8)
            .attr('style', 'cursor: default; transition: fill 0.3s, stroke 0.3s, opacity 0.3s;')
            .on('mouseover', function(event, d) {
               d3.select(this)
                 .attr('fill', isDarkMode ? '#1e293b' : '#f1f5f9')
                 .attr('stroke', isDarkMode ? '#38bdf8' : '#6366f1')
                 .attr('stroke-width', isDarkMode ? 1.4 : 1.1)
                 .attr('opacity', 1.0);
               
               const regionName = d.properties?.name || d.properties?.nom || "Espagne";
               tooltip.transition().duration(100).style('opacity', 1);
               tooltip.html(`<div class="flex flex-col items-center"><span class="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Espagne</span><span class="text-[11px] font-black text-white">${regionName}</span></div>`);
            })
            .on('mousemove', function(event) {
               tooltip
                 .style('left', (event.pageX) + 'px')
                 .style('top', (event.pageY) + 'px');
            })
            .on('mouseleave', function() {
               d3.select(this)
                 .attr('fill', isDarkMode ? '#111827' : '#f8fafc')
                 .attr('stroke', isDarkMode ? '#1f2937' : '#e2e8f0')
                 .attr('stroke-width', isDarkMode ? 1.0 : 0.8)
                 .attr('opacity', 0.8);
               tooltip.transition().duration(200).style('opacity', 0);
            });
        }

        // 1b. Draw Germany map
        if (germanyGeo) {
          const germanyGroup = this.currentMapContainerGroup.append('g').attr('class', 'germany-map');
          germanyGroup.selectAll('path')
            .data(germanyGeo.features)
            .enter()
            .append('path')
            .attr('d', pathGenerator)
            .attr('fill', isDarkMode ? '#111827' : '#f8fafc')
            .attr('stroke', isDarkMode ? '#1f2937' : '#e2e8f0') 
            .attr('stroke-width', isDarkMode ? 1.0 : 0.8)
            .attr('opacity', 0.8)
            .attr('style', 'cursor: default; transition: fill 0.3s, stroke 0.3s, opacity 0.3s;')
            .on('mouseover', function(event, d) {
               d3.select(this)
                 .attr('fill', isDarkMode ? '#1e293b' : '#f1f5f9')
                 .attr('stroke', isDarkMode ? '#38bdf8' : '#6366f1')
                 .attr('stroke-width', isDarkMode ? 1.4 : 1.1)
                 .attr('opacity', 1.0);
               
               const regionName = d.properties?.name || d.properties?.nom || "Allemagne";
               tooltip.transition().duration(100).style('opacity', 1);
               tooltip.html(`<div class="flex flex-col items-center"><span class="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Allemagne</span><span class="text-[11px] font-black text-white">${regionName}</span></div>`);
            })
            .on('mousemove', function(event) {
               tooltip
                 .style('left', (event.pageX) + 'px')
                 .style('top', (event.pageY) + 'px');
            })
            .on('mouseleave', function() {
               d3.select(this)
                 .attr('fill', isDarkMode ? '#111827' : '#f8fafc')
                 .attr('stroke', isDarkMode ? '#1f2937' : '#e2e8f0')
                 .attr('stroke-width', isDarkMode ? 1.0 : 0.8)
                 .attr('opacity', 0.8);
               tooltip.transition().duration(200).style('opacity', 0);
            });
        }

        // 1c. Draw France map on top
        const mapGroup = this.currentMapContainerGroup.append('g').attr('class', 'france-map');
        mapGroup.selectAll('path')
          .data(franceGeo.features)
          .enter()
          .append('path')
          .attr('d', pathGenerator)
          .attr('fill', isDarkMode ? '#151f32' : '#fcfdfe')
          .attr('stroke', isDarkMode ? '#24334c' : '#cbd5e1') 
          .attr('stroke-width', isDarkMode ? 1.2 : 0.9)
          .attr('style', 'cursor: default; transition: fill 0.3s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s;')
          .on('mouseover', function(event, d) {
             d3.select(this)
               .attr('fill', isDarkMode ? '#1e2e4a' : '#f1f5f9')
               .attr('stroke', isDarkMode ? '#38bdf8' : '#6366f1')
               .attr('stroke-width', isDarkMode ? 1.5 : 1.2);
             
             const regionName = d.properties?.nom || d.properties?.name || "France";
             tooltip.transition().duration(100).style('opacity', 1);
             tooltip.html(`<div class="flex flex-col items-center"><span class="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">France</span><span class="text-[11px] font-black text-white">${regionName}</span></div>`);
          })
          .on('mousemove', function(event) {
             tooltip
               .style('left', (event.pageX) + 'px')
               .style('top', (event.pageY) + 'px');
          })
          .on('mouseleave', function() {
             d3.select(this)
               .attr('fill', isDarkMode ? '#151f32' : '#fcfdfe')
               .attr('stroke', isDarkMode ? '#24334c' : '#cbd5e1')
               .attr('stroke-width', isDarkMode ? 1.2 : 0.9);
             tooltip.transition().duration(200).style('opacity', 0);
          });

        // 2. Prepare Missions, Routes & Markers (calls renderMapMissions)
        this.renderMapMissions(this.currentMapContainerGroup, projection, tooltip, isDarkMode);

        // 3. Activer la simulation de télémétrie des convois en direct !
        this.triggerLiveSimulation(this.currentMapContainerGroup, projection, tooltip, isDarkMode);
      })
      .catch(err => console.error('Error loading map files:', err));
  },

  triggerLiveSimulation(mapContentGroup, projection, tooltip, isDarkMode) {
    if (!mapContentGroup || !projection || !window.d3) return;

    // Supprimer les anciens marqueurs de simulation s'il y en a
    mapContentGroup.selectAll('.sim-marker-car-group').remove();

    // Déterminer les segments cibles selon le mode de carte actuel
    const isHistory = this.currentMapMode === 'history';
    const pathSelector = isHistory ? 'path.history-segment' : 'path.route-segment';
    
    // Sélectionner tous les éléments de chemin rendus par D3
    const pathElements = mapContentGroup.selectAll(pathSelector);
    if (pathElements.empty()) return;

    const simulationGroup = mapContentGroup.append('g')
      .attr('class', 'sim-marker-car-group');

    // Dictionnaire de véhicules pour les modes planifiés
    const randomVehicles = [
      'Tesla Model 3 ⚡', 'Peugeot E-208 🔋', 'Renault Rafale 🏎️', 
      'DS 7 Crossback 🚙', 'Hyundai Ioniq 6 ⚡', 'BMW i4 M50 🔋',
      'Volkswagen ID.3 🚗', 'Citroën EC4 ⚡', 'Megane E-Tech 🔋'
    ];

    const self = this;

    pathElements.each(function(d, i) {
      // En mode planifié, ignorer les corridors de transit en pointillés
      if (!isHistory && d.isTransit) return;

      const pathNode = d3.select(this).node();
      if (!pathNode || typeof pathNode.getTotalLength !== 'function') return;

      const pathLength = pathNode.getTotalLength();
      if (pathLength < 10) return;

      // Extraire des informations spécifiques sur l'entité
      let vehicleName = "Convoi Standard";
      let displayPlate = "FR-744-QX";
      let detailsText = "Convoyage en direct";
      let priceText = "0 €";
      let distanceText = "0 km";

      if (isHistory) {
        vehicleName = d.vehicle || 'Véhicule';
        displayPlate = d.id && d.id.slice ? `CV-${d.id.slice(0, 5).toUpperCase()}` : "FR-920-TR";
        priceText = `${d.price} €`;
        distanceText = `${d.distance} km`;
        detailsText = `Client : ${d.platform || 'Direct'}`;
      } else {
        const randId = Math.floor(Math.sin(i + 1) * 1000);
        vehicleName = randomVehicles[Math.abs(randId) % randomVehicles.length];
        displayPlate = `PL-${Math.abs(randId) % 900 + 100}-DV`;
        priceText = d.price ? `${d.price} €` : "Opportunité";
        distanceText = d.distance ? `${d.distance} km` : "Inconnu";
        detailsText = "Mission planifiée (Simulation)";
      }

      // Créer le conteneur du marqueur véhicule
      const marker = simulationGroup.append('g')
        .attr('class', 'sim-marker-car cursor-pointer')
        .datum(d);

      // Onde de choc lumineuse en arrière-plan
      marker.append('circle')
        .attr('r', 10)
        .attr('fill', isHistory ? '#818cf8' : '#10b981')
        .attr('opacity', 0.25)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '6;12;6')
        .attr('dur', `${1.8 + Math.random() * 0.8}s`)
        .attr('repeatCount', 'indefinite');

      // Noyau solide
      marker.append('circle')
        .attr('r', 5.5)
        .attr('fill', isHistory ? '#4f46e5' : '#059669')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.8);

      // Flèche directionnelle
      marker.append('path')
        .attr('d', "M-2,1.5 L0,-2.5 L2,1.5 Z")
        .attr('fill', '#ffffff')
        .attr('transform', 'scale(0.85)');

      const durationTime = 12000 + (Math.random() * 8000); // 12-20 secondes pour traverser
      
      const animateVehicle = () => {
        marker.transition()
          .duration(durationTime)
          .ease(d3.easeLinear)
          .attrTween('transform', function() {
            return function(t) {
              const point = pathNode.getPointAtLength(t * pathLength);
              const p0 = pathNode.getPointAtLength(Math.max(0, t * pathLength - 2));
              const p1 = pathNode.getPointAtLength(Math.min(pathLength, t * pathLength + 2));
              const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI) + 90;
              
              const percent = Math.round(t * 100);
              const elementNode = marker.node();
              if (elementNode) {
                elementNode._currentTelemetry = {
                  vehicle: vehicleName,
                  plate: displayPlate,
                  percent: percent,
                  from: isHistory ? d.source.name : d.source.name,
                  to: isHistory ? d.target.name : d.target.name,
                  distance: distanceText,
                  price: priceText,
                  details: detailsText
                };
              }

              return `translate(${point.x}, ${point.y}) rotate(${angle || 0})`;
            };
          })
          .on('end', () => {
            setTimeout(() => {
              animateVehicle();
            }, 1000);
          });
      };

      animateVehicle();

      // Événements Hover
      marker.on('mouseenter', function(event, dData) {
        d3.select(this).select('circle').transition().duration(150).attr('r', 15);
        
        const tel = this._currentTelemetry || {
          vehicle: vehicleName,
          plate: displayPlate,
          percent: 50,
          from: "Départ",
          to: "Arrivée",
          distance: distanceText,
          price: priceText,
          details: detailsText
        };

        tooltip.transition().duration(100).style('opacity', 1);
        tooltip.html(`
          <div class="flex flex-col gap-1 text-left min-w-[170px]">
            <div class="flex items-center justify-between border-b border-slate-700/65 pb-1 mb-1 gap-2">
              <span class="text-[11px] text-white font-extrabold">${tel.vehicle}</span>
              <span class="text-[8px] font-mono font-black tracking-wide px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">${tel.plate}</span>
            </div>
            <div class="text-[10px] text-indigo-300 font-extrabold flex items-center justify-between">
              <span>${tel.from}</span>
              <span class="text-xs text-slate-500 mx-1">➔</span>
              <span>${tel.to}</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 text-[9px] text-slate-400 font-semibold pt-1 border-t border-slate-800">
              <div>Vitesse: <span class="text-slate-100 font-bold font-mono">110 km/h</span></div>
              <div>Progression: <span class="text-emerald-400 font-bold font-mono">${tel.percent}%</span></div>
              <div>Intérêt : <span class="text-slate-100 font-bold font-mono">${tel.price}</span></div>
              <div>Distance : <span class="text-slate-200 font-bold font-mono">${tel.distance}</span></div>
            </div>
            <div class="text-[8px] italic text-slate-500 text-center leading-none mt-1 border-t border-slate-800/60 pt-1">
              ${tel.details}
            </div>
          </div>
        `);

        // Mettre à jour l'overlay HUD
        const telemetryHud = document.getElementById('map_live_hud_title');
        const telemetryHudModel = document.getElementById('map_live_hud_model');
        const telemetryHudRoute = document.getElementById('map_live_hud_route');
        const telemetryHudProgress = document.getElementById('map_live_hud_progress');
        
        if (telemetryHud && telemetryHudModel && telemetryHudRoute && telemetryHudProgress) {
          telemetryHud.innerText = "🛰️ TÉLÉMÉTRIE CAPTÉE";
          telemetryHudModel.innerHTML = `<span class="px-1 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-amber-400 font-mono">${tel.plate}</span> ${tel.vehicle}`;
          telemetryHudRoute.innerText = `${tel.from} ➔ ${tel.to} (${tel.distance})`;
          telemetryHudProgress.style.width = `${tel.percent}%`;
        }
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX) + 'px')
          .style('top', (event.pageY) + 'px');
      })
      .on('mouseleave', function(event) {
        d3.select(this).select('circle').transition().duration(200).attr('r', 10);
        tooltip.transition().duration(200).style('opacity', 0);
      });
    });
  },
  
  renderMapMissions(mapContainerGroup, projection, tooltip, isDarkMode) {
    const extractCity = (str) => {
      if (!str) return null;
      
      const normalize = (val) => {
        return val.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      };

      const normStr = normalize(str);
      if (!normStr) return null;

      // Sort keys of cityCoordinates by length descending to match longer specific matches first (e.g. "Mont-de-Marsan" before "Mons" if any)
      const sortedKeys = Object.keys(this.cityCoordinates).sort((a, b) => b.length - a.length);
      for (const city of sortedKeys) {
        const normCity = normalize(city);
        if (normStr.includes(normCity)) {
          return city;
        }
      }
      return null;
    };

    const search = document.getElementById('sp_search_input')?.value.toLowerCase() || '';
    
    // ==========================================
    // MODULE HISTORIQUE DE TRAJETS INTERACTIF
    // ==========================================
    if (this.currentMapMode === 'history') {
      const allMissions = (window.app && window.app.missions) ? window.app.missions : [];
      
      // Filtrer les missions historiques selon la recherche (ville départ, arrivée, véhicule, plateforme)
      const filteredMissions = search 
        ? allMissions.filter(m => 
            (m.depart || '').toLowerCase().includes(search) || 
            (m.destination || '').toLowerCase().includes(search) ||
            (m.vehicle || '').toLowerCase().includes(search) ||
            (m.plateforme || '').toLowerCase().includes(search)
          )
        : allMissions;

      const segments = [];
      const cityMap = new Map();

      filteredMissions.forEach((m, index) => {
        const fromCity = extractCity(m.depart) || (m.depart || 'Paris').split(' ')[0].replace(/[^a-zA-ZàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ-]/g, '');
        const toCity = extractCity(m.destination) || (m.destination || 'Lyon').split(' ')[0].replace(/[^a-zA-ZàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ-]/g, '');

        const fromCoords = this.getStableCoords(fromCity);
        const toCoords = this.getStableCoords(toCity);

        const segment = {
          id: m.id || `hist-${index}`,
          source: { name: fromCity, coords: fromCoords, type: 'history' },
          target: { name: toCity, coords: toCoords, type: 'history' },
          price: m.gain || 0,
          distance: m.kilometrage || 0,
          vehicle: m.vehicle || 'Véhicule',
          date: m.date || '2026-06-01',
          platform: m.plateforme || 'Autre',
          statut: m.statut || 'Terminée',
          peage: m.peage || 0,
          carburant: m.carburant || 0,
          index: index
        };

        segments.push(segment);

        if (!cityMap.has(fromCity)) {
          cityMap.set(fromCity, { name: fromCity, coords: fromCoords, type: 'history' });
        }
        if (!cityMap.has(toCity)) {
          cityMap.set(toCity, { name: toCity, coords: toCoords, type: 'history' });
        }
      });

      const routeCities = Array.from(cityMap.values());

      // Si aucune mission n'est disponible, afficher toutes les villes en passif
      if (routeCities.length === 0) {
        Object.entries(this.cityCoordinates).forEach(([name, coords]) => {
          routeCities.push({ name, coords, type: 'passive' });
        });
      }

      const pathGroup = mapContainerGroup.append('g').attr('class', 'routes-history');

      // Dessiner des arcs élégants (courbes quadratiques de Bezier)
      const calculateArc = (d) => {
        const x1 = projection(d.source.coords)[0];
        const y1 = projection(d.source.coords)[1];
        const x2 = projection(d.target.coords)[0];
        const y2 = projection(d.target.coords)[1];

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dr = Math.sqrt(dx * dx + dy * dy);

        if (dr < 12) {
          return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        // Varier la courbure selon l'index pour séparer les trajets superposés multiples !
        const curvature = 0.12 + (d.index % 4) * 0.05; 
        const cx = (x1 + x2) / 2 - dy * curvature;
        const cy = (y1 + y2) / 2 + dx * curvature;

        return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
      };

      // Tracer les courbes décoratives
      const pathElements = pathGroup.selectAll('path.history-segment')
        .data(segments)
        .enter()
        .append('path')
        .attr('class', 'history-segment')
        .attr('d', calculateArc)
        .attr('fill', 'none')
        .attr('stroke', isDarkMode ? '#818cf8' : '#4f46e5') // Indigo sophistiqué
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.6)
        .attr('style', 'transition: stroke 0.3s, opacity 0.3s, stroke-width 0.3s;')
        .attr('stroke-dasharray', function() {
          const l = this.getTotalLength() || 300;
          return `${l} ${l}`;
        })
        .attr('stroke-dashoffset', function() {
          return this.getTotalLength() || 300;
        });

      // Animation fluide de dessin progressif
      pathElements.transition()
        .duration(1500)
        .delay((d, i) => Math.min(i * 120, 1500))
        .ease(d3.easeQuadOut)
        .attr('stroke-dashoffset', 0);

      // Hitbox épaisse invisible pour une sensibilité de survol incroyable
      pathGroup.selectAll('path.history-segment-hitbox')
        .data(segments)
        .enter()
        .append('path')
        .attr('class', 'history-segment-hitbox')
        .attr('d', calculateArc)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .attr('style', 'cursor: pointer;')
        .on('mouseenter', function(event, d) {
          // Mettre en surbrillance la courbe hovered en vert émeraude néon
          d3.selectAll('path.history-segment')
            .filter(node => node.id === d.id)
            .attr('stroke', isDarkMode ? '#34d399' : '#059669')
            .attr('stroke-width', 4.5)
            .attr('opacity', 1.0);

          tooltip.transition().duration(100).style('opacity', 1);
          tooltip.html(`
            <div class="flex flex-col gap-1 pr-1 text-left">
              <div class="flex items-center justify-between border-b border-slate-700/60 pb-1 mb-1 gap-4">
                <span class="text-[10px] text-white font-extrabold uppercase tracking-wider">${d.vehicle}</span>
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded leading-none ${
                  d.statut === 'Payée' || d.statut === 'Validée' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }">${d.statut}</span>
              </div>
              <div class="flex items-center gap-1.5 text-xs text-indigo-300 font-extrabold mb-1">
                <span>${d.source.name}</span>
                <span class="text-[9px] text-slate-500">➔</span>
                <span>${d.target.name}</span>
              </div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-400 font-medium font-sans">
                <div>Date : <span class="text-slate-200 font-mono font-bold">${PlannerService.formatOppDate(d.date)}</span></div>
                <div>Distance : <span class="text-slate-200 font-mono font-bold">${d.distance} km</span></div>
                <div>Réseau : <span class="text-slate-200 font-extrabold">${d.platform}</span></div>
                <div>Gain Brut : <span class="text-emerald-400 font-extrabold font-mono">${d.price} €</span></div>
              </div>
            </div>
          `);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', (event.pageX) + 'px')
            .style('top', (event.pageY) + 'px');
        })
        .on('mouseleave', function(event, d) {
          // Rétablir l'apparence normale
          d3.selectAll('path.history-segment')
            .filter(node => node.id === d.id)
            .attr('stroke', isDarkMode ? '#818cf8' : '#4f46e5')
            .attr('stroke-width', 2.5)
            .attr('opacity', 0.6);

          tooltip.transition().duration(200).style('opacity', 0);
        });

      // Tracer les villes en g.city
      const nodes = mapContainerGroup.selectAll('g.city')
        .data(routeCities)
        .enter()
        .append('g')
        .attr('class', d => `city ${d.name === search ? 'selected' : ''}`)
        .attr('transform', d => `translate(${projection(d.coords)[0]},${projection(d.coords)[1]})`)
        .style('cursor', 'pointer')
        .on('click', (event, d) => window.PlannerService.handleCityClick(d.name));

      // Cercles d'animation d'ondes pulsées sous chaque ville active d'historique
      nodes.filter(d => d.type === 'history')
        .append('circle')
        .attr('r', 7)
        .attr('fill', isDarkMode ? '#818cf8' : '#4f46e5')
        .attr('opacity', 0.3)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '5;10;5')
        .attr('dur', '2.5s')
        .attr('repeatCount', 'indefinite');

      nodes.append('circle')
        .attr('r', 4.5)
        .attr('fill', d => {
          if (d.type === 'passive') return isDarkMode ? '#4b5563' : '#94a3b8';
          return isDarkMode ? '#818cf8' : '#4f46e5'; 
        })
        .attr('stroke', isDarkMode ? '#0f172a' : '#fff')
        .attr('stroke-width', 1.8);

      nodes.append('text')
        .text(d => d.name)
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('x', 6)
        .attr('y', 3)
        .attr('fill', isDarkMode ? '#f1f5f9' : '#334155');

      return;
    }

    // ==========================================
    // MODULE TOURNEE PLANIFIEE (TRADITIONNEL)
    // ==========================================
    // Filter planned missions based on search
    const filteredMissions = search 
      ? this.plannedMissions.filter(m => m.from.toLowerCase().includes(search) || m.to.toLowerCase().includes(search))
      : this.plannedMissions;

    const routeCities = [];
    const segments = [];

    if (filteredMissions.length === 0) {
      // Always show all major cities in a passive layout so the map is detailed and functional
      Object.entries(this.cityCoordinates).forEach(([name, coords]) => {
        routeCities.push({ name, coords, type: 'passive' });
      });
    } else {
      filteredMissions.forEach((m, i) => {
        const fromCity = extractCity(m.from);
        let fromCoords = fromCity ? this.cityCoordinates[fromCity] : [2.3 + Math.random()*2, 46 + Math.random()*2];
        let fromName = fromCity || m.from.split(' ')[0];

        const toCity = extractCity(m.to);
        let toCoords = toCity ? this.cityCoordinates[toCity] : [2.3 + Math.random()*2, 46 + Math.random()*2];
        let toName = toCity || m.to.split(' ')[0];

        let startNode;
        if (routeCities.length === 0 || routeCities[routeCities.length - 1].name !== fromName) {
          startNode = { name: fromName, coords: fromCoords, type: i === 0 ? 'start' : 'waypoint' };
          
          if (routeCities.length > 0) {
            segments.push({
              source: routeCities[routeCities.length - 1],
              target: startNode,
              isTransit: true
            });
          }
          routeCities.push(startNode);
        } else {
          startNode = routeCities[routeCities.length - 1];
        }

        let endNode = { name: toName, coords: toCoords, type: i === this.plannedMissions.length - 1 ? 'end' : 'waypoint' };
        routeCities.push(endNode);

        segments.push({
          source: startNode,
          target: endNode,
          isTransit: false,
          distance: m.distance,
          time: (m.distance / 80).toFixed(1), // Average 80 km/h
          price: m.price
        });
      });
    }

    if (routeCities.length < 2) return;

    const lineGenerator = d3.line()
      .x(d => projection(d.coords)[0])
      .y(d => projection(d.coords)[1]);

    const pathGroup = mapContainerGroup.append('g').attr('class', 'routes');

    // Draw visible segments
    const pathElements = pathGroup.selectAll('path.route-segment')
      .data(segments)
      .enter()
      .append('path')
      .attr('class', 'route-segment')
      .attr('d', d => lineGenerator([d.source, d.target]))
      .attr('fill', 'none')
      .attr('stroke', d => d.isTransit ? (isDarkMode ? '#64748b' : '#94a3b8') : (isDarkMode ? '#4ade80' : '#059669'))
      .attr('stroke-width', d => d.isTransit ? 2 : 3)
      .attr('stroke-dasharray', d => d.isTransit ? '5,5' : 'none')
      .attr('opacity', 0.8)
      .attr('stroke-dashoffset', 100);

    pathElements.transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Draw invisible thicker segments for easier hover interaction
    pathGroup.selectAll('path.route-segment-hitbox')
      .data(segments.filter(d => !d.isTransit))
      .enter()
      .append('path')
      .attr('class', 'route-segment-hitbox')
      .attr('d', d => lineGenerator([d.source, d.target]))
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15) // much wider for hovering
      .attr('style', 'cursor: pointer;')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('stroke', isDarkMode ? 'rgba(74, 222, 128, 0.4)' : 'rgba(5, 150, 105, 0.4)');
          
        tooltip.transition().duration(100).style('opacity', 1);
        tooltip.html(`
          <div class="flex flex-col gap-1 text-left">
            <span class="text-[10px] text-slate-400 uppercase tracking-widest">${d.source.name} ➔ ${d.target.name}</span>
            <div class="flex items-center gap-2">
              <span class="text-emerald-400 font-black">${d.price} €</span>
              <span class="text-slate-500 border-l border-slate-600 pl-2 font-mono">${d.distance} km</span>
              <span class="text-slate-500 border-l border-slate-600 pl-2 font-mono">~${d.time} h</span>
            </div>
          </div>
        `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX) + 'px')
          .style('top', (event.pageY) + 'px');
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).attr('stroke', 'transparent');
        tooltip.transition().duration(200).style('opacity', 0);
      });

    // Draw nodes/cities
    const nodes = mapContainerGroup.selectAll('g.city')
      .data(routeCities)
      .enter()
      .append('g')
      .attr('class', d => `city ${d.name === search ? 'selected' : ''}`)
      .attr('transform', d => `translate(${projection(d.coords)[0]},${projection(d.coords)[1]})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => window.PlannerService.handleCityClick(d.name));

    // Add glowing background for start/end nodes
    nodes.filter(d => d.type === 'start' || d.type === 'end')
      .append('circle')
      .attr('r', 8)
      .attr('fill', d => d.type === 'start' ? '#3b82f6' : (d.type === 'end' ? '#f43f5e' : '#fff'))
      .attr('opacity', 0.3)
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '6;10;6')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    nodes.append('circle')
      .attr('r', 4.5)
      .attr('fill', d => {
        if (d.type === 'start') return '#3b82f6';
        if (d.type === 'end') return '#f43f5e';
        if (d.type === 'passive') return isDarkMode ? '#4b5563' : '#94a3b8';
        return isDarkMode ? '#10b981' : '#059669'; // Active itinerary waypoint is emerald green
      })
      .attr('stroke', isDarkMode ? '#0f172a' : '#fff')
      .attr('stroke-width', 1.8);

    nodes.append('text')
      .text(d => d.name)
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('x', 6)
      .attr('y', 3)
      .attr('fill', isDarkMode ? '#f1f5f9' : '#334155');
  },

  updateRentabilitySummary() {
    let totalGain = 0;
    let totalKm = 0;
    this.plannedMissions.forEach(m => {
       totalGain += m.price;
       totalKm += m.distance;
    });

    const gainElements = document.querySelectorAll('#sp_total_gain');
    const rentElements = document.querySelectorAll('#sp_avg_rent');

    gainElements.forEach(el => {
      el.innerText = totalGain.toFixed(2) + ' €';
    });
    rentElements.forEach(el => {
      el.innerText = totalKm > 0 ? (totalGain / totalKm).toFixed(3) + ' €/km' : '0.000 €/km';
    });
  },

  toggleAddPanel() {
    const panel = document.getElementById('sp_add_panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  },

  switchAddMode(mode) {
    const modeInput = document.getElementById('sp_mode_input');
    const modeImport = document.getElementById('sp_mode_import');
    const tabInput = document.getElementById('sp_tab_input');
    const tabImport = document.getElementById('sp_tab_import');

    if (mode === 'input') {
      modeInput.classList.remove('hidden');
      modeImport.classList.add('hidden');
      
      tabInput.className = "flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700";
      tabImport.className = "flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg text-slate-400";
    } else {
      modeInput.classList.add('hidden');
      modeImport.classList.remove('hidden');
      
      tabImport.className = "flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700";
      tabInput.className = "flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg text-slate-400";
    }
  },

  submitNewOpportunity() {
    const platform = document.getElementById('sp_new_platform').value.trim();
    const from = document.getElementById('sp_new_from').value.trim();
    const to = document.getElementById('sp_new_to').value.trim();
    const price = parseFloat(document.getElementById('sp_new_price').value);
    const distance = parseFloat(document.getElementById('sp_new_distance').value);
    const date = document.getElementById('sp_new_date').value || '2026-06-08';

    if (!platform || !from || !to || isNaN(price) || isNaN(distance)) {
      DashboardService.showNotification("Veuillez remplir tous les champs correctement.", "error");
      return;
    }

    const newOpp = {
      id: 'opt_manual_' + Date.now(),
      platform,
      from,
      to,
      price,
      distance,
      date
    };

    this.mockedOpportunities.unshift(newOpp);
    this.renderOpportunities();
    DashboardService.showNotification("Nouvelle opportunité ajoutée.", "success");
    
    // Clear inputs
    document.getElementById('sp_new_platform').value = '';
    document.getElementById('sp_new_from').value = '';
    document.getElementById('sp_new_to').value = '';
    document.getElementById('sp_new_price').value = '';
    document.getElementById('sp_new_distance').value = '';
    document.getElementById('sp_new_date').value = '';
    this.toggleAddPanel();
  },

  submitImportOpportunity() {
    const data = document.getElementById('sp_new_import_data').value.trim();
    if (!data) return;

    // Parse CSV minimally
    const lines = data.split('\n').filter(l => l.trim().length > 0);
    let addedCount = 0;

    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 5) {
        const platform = parts[0];
        const from = parts[1];
        const to = parts[2];
        const price = parseFloat(parts[3]);
        const distance = parseFloat(parts[4]);
        const date = parts[5] || '2026-06-08';

        if (platform && from && to && !isNaN(price) && !isNaN(distance)) {
          this.mockedOpportunities.unshift({
            id: 'opt_import_' + Date.now() + Math.random().toString(36).substring(7),
            platform,
            from,
            to,
            price,
            distance,
            date
          });
          addedCount++;
        }
      }
    });

    if (addedCount > 0) {
      this.renderOpportunities();
      DashboardService.showNotification(`${addedCount} opportunités importées.`, "success");
      document.getElementById('sp_new_import_data').value = '';
      this.toggleAddPanel();
    } else {
      DashboardService.showNotification("Format invalide. Utilisez: Plateforme, Départ, Arrivée, Prix, Km", "error");
    }
  },

  deleteOpportunity(id) {
    const opp = this.mockedOpportunities.find(o => o.id === id);
    const details = opp ? `${opp.platform} (${opp.from} ➔ ${opp.to})` : "cette opportunité";
    const desc = `Voulez-vous vraiment supprimer définitivement l'opportunité "${details}" du planificateur ? Cette action est irréversible.`;

    if (window.ModalService && typeof window.ModalService.confirmDelete === 'function') {
      window.ModalService.confirmDelete(details, () => {
        this.mockedOpportunities = this.mockedOpportunities.filter(o => o.id !== id);
        this.plannedMissions = this.plannedMissions.filter(o => o.id !== id);
        this.renderOpportunities();
        this.renderPlannedMissions();
        this.drawMap();
        DashboardService.showNotification("L'opportunité a été supprimée.", "info");
      }, desc);
    } else {
      if (confirm(desc)) {
        this.mockedOpportunities = this.mockedOpportunities.filter(o => o.id !== id);
        this.plannedMissions = this.plannedMissions.filter(o => o.id !== id);
        this.renderOpportunities();
        this.renderPlannedMissions();
        this.drawMap();
        DashboardService.showNotification("L'opportunité a été supprimée.", "info");
      }
    }
  },

  importOpportunitiesFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      DashboardService.showNotification("La librairie d'import Excel SheetJS n'est pas chargée. Impossible de continuer.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("Le fichier Excel ne contient pas de feuilles de calcul.");
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet);

        if (rawRows.length === 0) {
          DashboardService.showNotification("Aucune ligne de données trouvée.", "warning");
          return;
        }

        const MAPPER_OPP = {
          platform: ['plateforme', 'platform', 'client', 'partenaire', 'platforme', 'source'],
          from: ['départ', 'depart', 'de', 'from', 'origine', 'origin', 'dep'],
          to: ['destination', 'vers', 'to', 'arrivée', 'arrivee', 'arr'],
          price: ['gain brut (€)', 'gain brut', 'gain (€)', 'gain', 'revenu', 'montant', 'prix', 'price', 'gains'],
          distance: ['kilométrage (km)', 'kilometrage (km)', 'kilométrage', 'kilometrage', 'km', 'kms', 'distance'],
          date: ['date', 'Date', 'le', 'le (date)']
        };

        const parseDate = (val) => {
          if (val instanceof Date) {
            return val.toISOString().slice(0, 10);
          }
          if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) {
              return date.toISOString().slice(0, 10);
            }
          }
          if (typeof val === 'string') {
            const str = val.trim();
            const dmy = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
            if (dmy) {
              return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
            }
            const ymd = str.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
            if (ymd) {
              return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
            }
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
              return d.toISOString().slice(0, 10);
            }
          }
          return '2026-06-08';
        };

        const parseNum = (val) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = val.toString().replace(/\s/g, '').replace(/[^\d.,\-]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        };

        let addedCount = 0;

        rawRows.forEach((row) => {
          const normRow = {};
          for (const rawKey of Object.keys(row)) {
            const keyLower = rawKey.toLowerCase().trim();
            let matchedField = null;
            for (const [field, synonyms] of Object.entries(MAPPER_OPP)) {
              if (synonyms.some(syn => syn.toLowerCase() === keyLower)) {
                matchedField = field;
                break;
              }
            }
            if (matchedField) {
              normRow[matchedField] = row[rawKey];
            } else {
              normRow[rawKey] = row[rawKey];
            }
          }

          const platform = normRow.platform ? normRow.platform.toString().trim() : 'Otoqi';
          const from = normRow.from ? normRow.from.toString().trim() : 'Paris';
          const to = normRow.to ? normRow.to.toString().trim() : 'Lyon';
          const price = parseNum(normRow.price);
          const distance = parseNum(normRow.distance);
          const date = parseDate(normRow.date);

          if (platform && from && to && price > 0) {
            this.mockedOpportunities.unshift({
              id: 'opt_excel_' + Date.now() + Math.random().toString(36).substring(7),
              platform,
              from,
              to,
              price,
              distance: distance || 100,
              date
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          this.renderOpportunities();
          DashboardService.showNotification(`${addedCount} opportunités importées depuis Excel.`, "success");
          this.toggleAddPanel();
        } else {
          DashboardService.showNotification("Aucune opportunité valide trouvée dans l'Excel.", "warning");
        }
      } catch (err) {
        console.error(err);
        DashboardService.showNotification("Erreur de lecture de l'Excel : " + err.message, "error");
      }
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  },

  openHelpModal() {
    const modal = document.getElementById('plannerHelpModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeHelpModal() {
    const modal = document.getElementById('plannerHelpModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
};

window.PlannerService = PlannerService;
