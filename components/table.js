/**
 * Module d'affichage du tableau récapitulatif des missions
 * Gère le rendu compact (adaptable mobile / desktop), la pagination interactive et le tri des colonnes.
 */

export const TableService = {
  currentPage: 1,
  pageSize: 10,
  
  /**
   * Calcule le nombre de minutes en heures/minutes intelligentes
   *@param {number} minutes 
   */
  formatDuration(minutes) {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins} min`;
    return `${hrs}h${String(mins).padStart(2, '0')}`;
  },

  /**
   * Retourne un badge de couleur pour le statut de la mission
   * @param {string} status 
   */
  getStatusBadge(status) {
    const s = (status || 'En attente').toLowerCase().trim();
    if (s === 'payée' || s === 'paye') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>Payée
      </span>`;
    } else if (s === 'terminée' || s === 'terminee') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-sky-500"></span>Terminée
      </span>`;
    } else if (s === 'validée' || s === 'validee') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-indigo-500"></span>Validée
      </span>`;
    } else if (s === 'en attente') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span>En attente
      </span>`;
    } else {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-gray-400"></span>Annulée
      </span>`;
    }
  },

  /**
   * Retourne la couleur en fonction du taux de rentabilité par km
   */
  getRentabilityColor(rentability) {
    if (rentability >= 0.40) return 'text-emerald-600 dark:text-emerald-400 font-bold';
    if (rentability >= 0.15) return 'text-indigo-600 dark:text-indigo-400 font-medium';
    return 'text-rose-600 dark:text-rose-400';
  },

  /**
   * Retourne un badge stylisé de transport : A (Avion), B (Bus), C (Covoiturage), T (Train)
   */
  getTransportBadge(transport) {
    if (!transport) return '-';
    const lower = transport.toLowerCase().trim();
    let label = transport;
    let symbol = '';
    let bgClass = '';
    let textClass = '';
    let borderClass = '';

    if (lower.includes('train') || lower.includes('ter') || lower.includes('tgv') || lower.includes('sncf') || lower === 't') {
      symbol = 'T';
      label = 'Train';
      bgClass = 'bg-indigo-50 dark:bg-indigo-950/30';
      textClass = 'text-indigo-700 dark:text-indigo-300';
      borderClass = 'border-indigo-100 dark:border-indigo-900/40';
    } else if (lower.includes('covoit') || lower.includes('blabla') || lower === 'c') {
      symbol = 'C';
      label = 'Covoiturage';
      bgClass = 'bg-emerald-50 dark:bg-emerald-950/30';
      textClass = 'text-emerald-700 dark:text-emerald-300';
      borderClass = 'border-emerald-100 dark:border-emerald-900/40';
    } else if (lower.includes('bus') || lower.includes('flix') || lower.includes('car ') || lower === 'b') {
      symbol = 'B';
      label = 'Bus';
      bgClass = 'bg-amber-50 dark:bg-amber-950/30';
      textClass = 'text-amber-700 dark:text-amber-300';
      borderClass = 'border-amber-100 dark:border-amber-900/40';
    } else if (lower.includes('avion') || lower.includes('plane') || lower.includes('flight') || lower.includes('air') || lower === 'a') {
      symbol = 'A';
      label = 'Avion';
      bgClass = 'bg-sky-50 dark:bg-sky-950/30';
      textClass = 'text-sky-700 dark:text-sky-300';
      borderClass = 'border-sky-100 dark:border-sky-900/40';
    } else if (lower.includes('perso') || lower.includes('véhicule personnel') || lower.includes('voiture personnelle') || lower === 'vp' || lower.includes('voiture')) {
      symbol = 'VP';
      label = 'Véh. Personnel';
      bgClass = 'bg-rose-50 dark:bg-rose-950/30';
      textClass = 'text-rose-700 dark:text-rose-300';
      borderClass = 'border-rose-100 dark:border-rose-900/40';
    } else {
      symbol = '?';
      bgClass = 'bg-slate-50 dark:bg-slate-900/40';
      textClass = 'text-slate-600 dark:text-slate-400';
      borderClass = 'border-slate-200 dark:border-slate-800/40';
    }

    if (symbol === '?') {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bgClass} ${textClass} border ${borderClass}">${transport}</span>`;
    }

    return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${bgClass} ${textClass} border ${borderClass}">
      <span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white dark:bg-slate-950 border border-current text-[10px] font-black">${symbol}</span>
      <span>${label}</span>
    </span>`;
  },

  /**
   * Génère le rendu HTML complet de la liste des missions
   * @param {Array} filteredMissions - Missions après traitement (filtre et tri)
   * @param {Object} sortState - État du tri actif
   * @param {function} onActionClick - Callback lors d'un clic sur une action (edit, delete, validate, duplicate)
   * @param {boolean} isReadOnly - Mode lecture seule (pour le rôle ACCOUNTANT)
   */
  render(filteredMissions, sortState, onActionClick, isReadOnly = false) {
    this.isReadOnly = isReadOnly;
    this.currentActionsHandler = onActionClick;
    const tableBody = document.getElementById('missionsTableBody');
    const mobileContainer = document.getElementById('missionsMobileContainer');
    
    if (!tableBody || !mobileContainer) return;

    // 1. Pagination
    const totalItems = filteredMissions.length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;
    
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, totalItems);
    const paginatedItems = filteredMissions.slice(startIndex, endIndex);

    // Mettre à jour les labels de pagination
    const labelCurrentPage = document.getElementById('pageNumCurrent');
    const labelTotalPages = document.getElementById('pageNumTotal');
    const labelItemCount = document.getElementById('paginationInfoText');

    if (labelCurrentPage) labelCurrentPage.innerText = this.currentPage;
    if (labelTotalPages) labelTotalPages.innerText = totalPages;
    if (labelItemCount) {
      labelItemCount.innerHTML = totalItems > 0 
        ? `Affichage de <strong>${startIndex + 1}</strong> à <strong>${endIndex}</strong> sur <strong>${totalItems}</strong> missions`
        : `Aucune mission disponible`;
    }

    // Gérer l'état des boutons de pagination
    const btnPrev = document.getElementById('btnPagePrev');
    const btnNext = document.getElementById('btnPageNext');
    if (btnPrev) btnPrev.disabled = this.currentPage === 1;
    if (btnNext) btnNext.disabled = this.currentPage === totalPages;

    // 2. Rendre le rendu d'en-tête de tri
    this.updateSortHeaders(sortState);

    // 3. Dessiner sur ÉCRAN STANDARD / PC (Tableau Simplifié pour Progressive Disclosure)
    if (paginatedItems.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            <div class="flex flex-col items-center justify-center">
              <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2,2,0,0,1,-2,-2V5a2,2,0,0,1,2,-2h5.586a1,1,0,0,1,0.707,0.293l5.414,5.414a1,1,0,0,1,0.293,0.707V19a2,2,0,0,1,-2,2z" />
              </svg>
              <p class="font-medium text-base">Aucune mission correspondante</p>
              <p class="text-xs text-gray-400 mt-1">Modifiez vos filtres ou ajoutez une nouvelle course.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = paginatedItems.map(m => {
        const fuel = Number(m.carburant) || 0;
        const toll = Number(m.peage) || 0;
        const clean = Number(m.lavage) || 0;
        const retPrice = Number(m.prixRetour) || 0;
        
        const totalExpenses = fuel + toll + clean + retPrice;
        const nonReimbursed = clean + retPrice;
        const netProfit = (Number(m.gain) || 0) - nonReimbursed;
        const rentabilityKm = m.kilometrage > 0 ? (netProfit / m.kilometrage) : 0;
        
        const dayLabel = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short' }) : '';
        const dateFormatted = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';

        return `
          <tr class="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 border-b border-slate-100 dark:border-slate-800/60 text-sm select-text transition-colors duration-150">
            <!-- 1. Actions rapides de flux direct -->
            <td class="px-4 py-3 sticky left-0 bg-white dark:bg-[#111827] z-10 border-r border-slate-100 dark:border-slate-800">
              <div class="flex items-center space-x-1">
                <!-- Bouton d'œil Détails progressive disclosure -->
                <button data-action="details" data-id="${m.id}" title="Fiche détaillée & Audit" class="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>

                ${!isReadOnly && (m.statut.toLowerCase() !== 'payée' && m.statut.toLowerCase() !== 'terminée' && m.statut.toLowerCase() !== 'terminee') ? `
                  <button data-action="validate" data-id="${m.id}" title="Marquer comme Validée/Payée" class="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </button>
                ` : (isReadOnly ? '' : `
                  <span class="p-1 text-gray-300 dark:text-gray-700">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  </span>
                `)}
                ${!isReadOnly ? `
                  <button data-action="duplicate" data-id="${m.id}" title="Dupliquer" class="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8,7v8a2,2,0,0,0,2,2h6M8,7V5a2,2,0,0,1,2,-2h4.586a1,1,0,0,1,0.707,0.293l4.414,4.414a1,1,0,0,1,0.293,0.707V15a2,2,0,0,1,-2,2h-2M8,7H6a2,2,0,0,0,-2,2v10a2,2,0,0,0,2,2h8a2,2,0,0,0,2,-2v-2"/></svg>
                  </button>
                ` : ''}
                <button data-action="documents" data-id="${m.id}" title="Documents" class="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9,12h6m-6,4h6m2,5H7a2,2,0,0,1,-2,-2V5a2,2,0,0,1,2,-2h5.586a1,1,0,0,1,0.707,0.293l5.414,5.414a1,1,0,0,1,0.293,0.707V19a2,2,0,0,1,-2,2z"/></svg>
                </button>
                <button data-action="inspect" data-id="${m.id}" title="État des lieux" class="p-1 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded transition-colors cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                ${!isReadOnly ? `
                  <button data-action="edit" data-id="${m.id}" title="Modifier" class="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button data-action="delete" data-id="${m.id}" title="Effacer" class="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                ` : ''}
              </div>
            </td>

            <!-- 2. Date -->
            <td class="px-3 py-3.5 font-bold text-slate-700 dark:text-slate-300">
              ${dateFormatted} <span class="text-xs font-normal text-slate-400 capitalize">(${dayLabel})</span>
            </td>

            <!-- 3. Véhicule & Immatriculation -->
            <td class="px-3 py-3.5">
              <div class="flex flex-col">
                <span class="font-extrabold text-slate-900 dark:text-white leading-tight">${m.vehicle}</span>
                <span class="font-mono text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-405 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-805 w-fit mt-1">${m.immatriculation}</span>
              </div>
            </td>

            <!-- 4. Itinéraire -->
            <td class="px-3 py-3.5">
              <div class="flex flex-col">
                <div class="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-extrabold leading-snug">
                  <span>${m.depart}</span>
                  <span class="text-slate-350 dark:text-slate-600">➔</span>
                  <span>${m.destination}</span>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-1 font-bold">
                  <span>⏱ ${m.heureDepart || '00:00'} - ${m.heureArrivee || '00:00'}</span>
                  <span>(${this.formatDuration(m.dureeTrajet)})</span>
                </div>
              </div>
            </td>

            <!-- 5. Distance -->
            <td class="px-3 py-3.5 font-mono font-extrabold text-slate-800 dark:text-slate-200">
              ${m.kilometrage} km
            </td>

            <!-- 6. Prestate (Plateforme) -->
            <td class="px-3 py-3.5">
              <span class="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ${m.plateforme}
              </span>
            </td>

            <!-- 7. CA Brut (Gain) -->
            <td class="px-3 py-3.5 font-extrabold text-emerald-600 dark:text-emerald-400 text-right text-sm">
              ${Number(m.gain).toFixed(2)} €
            </td>

            <!-- 8. Bénéfice Net -->
            <td class="px-3 py-3.5 font-bold text-right text-sm ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">
              ${netProfit.toFixed(2)} €
              <div class="text-[9px] font-mono font-normal text-slate-400 dark:text-slate-500 mt-1">
                ${rentabilityKm.toFixed(3)} €/km
              </div>
            </td>

            <!-- 9. Statut -->
            <td class="px-3 py-1 text-center">
              ${this.getStatusBadge(m.statut)}
            </td>
          </tr>
        `;
      }).join("");
    }

    // 4. Dessiner sur ÉCRAN MOBILE (Cards-view Super Compacte pour le Convoyeur)
    if (paginatedItems.length === 0) {
      mobileContainer.innerHTML = `
        <div class="p-8 text-center bg-white dark:bg-[#151d30] rounded-xl border border-slate-100 dark:border-slate-850">
          <p class="text-sm text-gray-400">Aucune mission trouvée pour vos filtres actifs.</p>
        </div>
      `;
    } else {
      mobileContainer.innerHTML = paginatedItems.map(m => {
        const fuel = Number(m.carburant) || 0;
        const toll = Number(m.peage) || 0;
        const clean = Number(m.lavage) || 0;
        const retPrice = Number(m.prixRetour) || 0;
        const totalExpenses = fuel + toll + clean + retPrice;
        const nonReimbursed = clean + retPrice;
        const netProfit = (Number(m.gain) || 0) - nonReimbursed;
        const rentabilityKm = m.kilometrage > 0 ? (netProfit / m.kilometrage) : 0;
        
        const dayLabel = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short' }) : '';
        const dateFormatted = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '';

        const s = (m.statut || 'En attente').toLowerCase().trim();
        let statusDotColor = 'bg-gray-400 ring-gray-450/20';
        let statusTitle = m.statut || 'Status';
        if (s === 'payée' || s === 'paye') {
          statusDotColor = 'bg-emerald-500 ring-emerald-500/20';
        } else if (s === 'validée' || s === 'validee') {
          statusDotColor = 'bg-blue-500 ring-blue-500/20';
        } else if (s === 'en attente') {
          statusDotColor = 'bg-amber-500 ring-amber-500/30';
        }

        // Déterminer le symbole de transport pour la vue mobile
        let transportSymbol = '';
        let transportSymbolBg = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
        if (m.transportRetour) {
          const rL = m.transportRetour.toLowerCase();
          if (rL.includes('train') || rL.includes('ter') || rL.includes('tgv') || rL.includes('sncf') || rL === 't') {
            transportSymbol = 'T';
            transportSymbolBg = 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40';
          } else if (rL.includes('covoit') || rL.includes('blabla') || rL === 'c') {
            transportSymbol = 'C';
            transportSymbolBg = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40';
          } else if (rL.includes('bus') || rL.includes('flix') || rL.includes('car ') || rL === 'b') {
            transportSymbol = 'B';
            transportSymbolBg = 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-955/40 dark:text-amber-300 dark:border-amber-900/40';
          } else if (rL.includes('avion') || rL.includes('plane') || rL.includes('flight') || rL.includes('air') || rL === 'a') {
            transportSymbol = 'A';
            transportSymbolBg = 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/40';
          } else {
            transportSymbol = '?';
            transportSymbolBg = 'bg-slate-50 text-slate-600 border-slate-205 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/40';
          }
        }

        return `
          <div class="bg-white dark:bg-[#151d30] p-3 rounded-xl border border-slate-150 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col space-y-2">
            <!-- Fine bande latérale d'intensité Rentabilité -->
            <div class="absolute left-0 top-0 bottom-0 w-1 ${rentabilityKm >= 0.4 ? 'bg-emerald-500' : rentabilityKm >= 0.15 ? 'bg-indigo-500' : 'bg-rose-500'}"></div>
            
            <!-- Première ligne : Date et Prestation / Google Drive status -->
            <div class="flex items-center justify-between pb-1 pl-1">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${statusDotColor} ring-4 animate-pulse shrink-0"></span>
                <span class="text-xs font-extrabold text-slate-600 dark:text-slate-300 capitalize">${dayLabel} ${dateFormatted}</span>
              </div>
              <div class="flex items-center gap-1 text-[10px]">
                ${m.driveSaved ? `<span class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black border border-emerald-100/30">Drive</span>` : ''}
                <span class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold border border-slate-100 dark:border-slate-800 uppercase">${m.plateforme}</span>
              </div>
            </div>

            <!-- Deuxième ligne : Véhicule & Bénéfice Net -->
            <div class="flex items-start justify-between pl-1">
              <div>
                <h4 class="font-extrabold text-slate-900 dark:text-white text-sm">${m.vehicle}</h4>
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="font-mono text-[10px] bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded border border-slate-150 dark:border-slate-800">${m.immatriculation}</span>
                  <span class="text-[11px] font-bold text-slate-405">${m.kilometrage} km</span>
                </div>
              </div>
              <div class="text-right">
                <p class="text-[9px] uppercase tracking-wider text-slate-400">Net</p>
                <p class="text-base font-black ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${netProfit.toFixed(1)} €</p>
              </div>
            </div>

            <!-- Troisième ligne : Itinéraire compacté ultra-pro -->
            <div class="bg-slate-50/60 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100/50 dark:border-slate-800 text-[11px] dark:text-slate-300 flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1 overflow-hidden truncate">
                <span class="font-bold text-slate-800 dark:text-slate-200 truncate">${m.depart}</span>
                <span class="text-slate-400">➔</span>
                <span class="font-bold text-slate-800 dark:text-slate-200 truncate">${m.destination}</span>
              </div>
              <div class="flex items-center gap-1 divide-x divide-slate-200 dark:divide-slate-800">
                <span class="font-mono text-[9px] text-slate-400 font-bold whitespace-nowrap pl-1">${m.heureDepart || '00'}➔${m.heureArrivee || '00'}</span>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.destination)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-black text-indigo-500 hover:text-indigo-600 pl-1">GPS</a>
              </div>
            </div>

            <!-- Quatrième ligne : 4 mini indicateurs comptabilité routière pour le convoyeur -->
            <div class="grid grid-cols-4 gap-1 text-[10px] text-center bg-slate-50/40 dark:bg-slate-900/10 py-1 border-t border-b border-slate-100/50 dark:border-slate-800 pl-1">
              <div>
                <span class="text-slate-400 block text-[9px]">Brut</span>
                <span class="font-bold text-slate-700 dark:text-slate-200 font-mono">${Number(m.gain).toFixed(0)}€</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[9px]">Frais</span>
                <span class="font-bold text-slate-700 dark:text-slate-200 font-mono">${totalExpenses.toFixed(0)}€</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[9px]">Remb.</span>
                <span class="font-bold text-slate-600 dark:text-slate-350 font-mono">${(m.fraisRembourses === 'Remboursé' && (fuel > 0 || toll > 0)) ? '✅' : ((fuel > 0 || toll > 0) ? '⏳' : '-')}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[9px]">Marg/K</span>
                <span class="${this.getRentabilityColor(rentabilityKm)} font-mono">${rentabilityKm.toFixed(2)}€</span>
              </div>
            </div>

            <!-- Cinquième ligne : Actions de mission complètes -->
            <div class="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 pl-1">
              <button data-action="details" data-id="${m.id}" title="Audit" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100/20 dark:border-indigo-900/10 transition-all active:scale-95 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span class="text-[9px] font-black uppercase">Audit</span>
              </button>

              <button data-action="documents" data-id="${m.id}" title="Documents" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100/20 dark:border-blue-900/10 transition-all active:scale-95 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9,12h6m-6,4h6m2,5H7a2,2,0,0,1,-2,-2V5a2,2,0,0,1,2,-2h5.586a1,1,0,0,1,0.707,0.293l5.414,5.414a1,1,0,0,1,0.293,0.707V19a2,2,0,0,1,-2,2z"/></svg>
                <span class="text-[9px] font-black uppercase">Docs</span>
              </button>

              <button data-action="inspect" data-id="${m.id}" title="Photos" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-100/20 dark:border-sky-900/10 transition-all active:scale-95 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span class="text-[9px] font-black uppercase">Photos</span>
              </button>

              ${!isReadOnly && (s !== 'payée' && s !== 'terminée' && s !== 'terminee') ? `
                <button data-action="validate" data-id="${m.id}" title="Valider" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100/20 dark:border-emerald-900/10 transition-all active:scale-95 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span class="text-[9px] font-black uppercase">Valider</span>
                </button>
              ` : `
                <div class="flex flex-col items-center justify-center gap-1 p-1.5 opacity-40 grayscale">
                   <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                   <span class="text-[9px] font-black uppercase">Payée</span>
                </div>
              `}

              ${!isReadOnly ? `
                <button data-action="duplicate" data-id="${m.id}" title="Copier" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 transition-all active:scale-95 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8,7v8a2,2,0,0,0,2,2h6M8,7V5a2,2,0,0,1,2,-2h4.586a1,1,0,0,1,0.707,0.293l4.414,4.414a1,1,0,0,1,0.293,0.707V15a2,2,0,0,1,-2,2h-2M8,7H6a2,2,0,0,0,-2,2v10a2,2,0,0,0,2,2h8a2,2,0,0,0,2,-2v-2"/></svg>
                  <span class="text-[9px] font-black uppercase">Copier</span>
                </button>
                <button data-action="edit" data-id="${m.id}" title="Modifier" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-100/20 dark:border-amber-900/10 transition-all active:scale-95 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span class="text-[9px] font-black uppercase">Editer</span>
                </button>
                <button data-action="delete" data-id="${m.id}" title="Effacer" class="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-100/20 dark:border-rose-900/10 transition-all active:scale-95 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  <span class="text-[9px] font-black uppercase">Suppr.</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join("");
    }

    // 5. Attacher les écouteurs d'événements à tous les boutons découverts
    this.attachEventListeners(onActionClick);
  },

  /**
   * Ouvre le volet de détails de la mission (Progressive Disclosure)
   * @param {Object} m L'objet mission
   */
  openDetailDrawer(m) {
    const drawer = document.getElementById('missionDetailDrawer');
    if (!drawer) return;

    const mId = document.getElementById('drawer_mission_id');
    if (mId) mId.innerText = `Fiche ID: ${m.id}`;

    const content = document.getElementById('drawer_content');
    if (!content) return;

    const fuel = Number(m.carburant) || 0;
    const toll = Number(m.peage) || 0;
    const clean = Number(m.lavage) || 0;
    const retPrice = Number(m.prixRetour) || 0;
    const totalExpenses = fuel + toll + clean + retPrice;
    const nonReimbursed = clean + retPrice;
    const netProfit = (Number(m.gain) || 0) - nonReimbursed;
    const rentabilityKm = m.kilometrage > 0 ? (netProfit / m.kilometrage) : 0;

    const dateFormatted = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
    const dayLabel = m.date ? new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long' }) : '';

    let statusLine = '';
    const s = (m.statut || 'En attente').toLowerCase().trim();
    if (s === 'payée' || s === 'paye') {
      statusLine = `<span class="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold font-sans">✓ Payée / Archivée</span>`;
    } else if (s === 'validée' || s === 'validee') {
      statusLine = `<span class="px-2.5 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold font-sans">⌛ Validée par l'Admin</span>`;
    } else if (s === 'en attente') {
      statusLine = `<span class="px-2.5 py-1 rounded bg-amber-100 text-amber-850 border border-amber-200 text-xs font-bold font-sans">⏳ En Attente de Justificatif</span>`;
    } else {
      statusLine = `<span class="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold font-sans">✕ Annulée</span>`;
    }

    content.innerHTML = `
      <!-- En-tête rapide -->
      <div class="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-black tracking-widest text-slate-400">Véhicule</span>
          ${statusLine}
        </div>
        <h4 class="text-lg font-black text-slate-850 dark:text-white leading-tight">${m.vehicle}</h4>
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">${m.immatriculation}</span>
          <span class="text-xs font-bold text-slate-500">• ${m.kilometrage} km • Presta: ${m.plateforme}</span>
        </div>
      </div>

      <!-- Itinéraire et Temps réel -->
      <div class="space-y-3.5">
        <h5 class="text-xs font-black uppercase tracking-wider text-slate-400">Itinéraire & Horaires</h5>
        <div class="relative pl-5 border-l-2 border-indigo-200 dark:border-indigo-900/50 space-y-4">
          <!-- Départ -->
          <div class="relative">
            <span class="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-[#111827]"></span>
            <span class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Origine</span>
            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">${m.depart}</p>
            <p class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">⏱ ${m.heureDepart || 'Non renseigné'}</p>
          </div>
          <!-- Arrivée -->
          <div class="relative">
            <span class="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white dark:border-[#111827]"></span>
            <span class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Destination</span>
            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">${m.destination}</p>
            <p class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">⏱ ${m.heureArrivee || 'Non de renseigné'}</p>
          </div>
        </div>
        
        <div class="bg-indigo-50/20 dark:bg-indigo-950/10 p-3 rounded-xl border border-indigo-100/20 dark:border-indigo-900/10 flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
          <span>Durée du trajet</span>
          <span class="font-mono">${this.formatDuration(m.dureeTrajet)}</span>
        </div>
      </div>

      <!-- États Financiers -->
      <div class="space-y-3">
        <h5 class="text-xs font-black uppercase tracking-wider text-slate-400">Ventilation Financière & Audit</h5>
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800">
            <span class="text-[9px] uppercase font-black text-slate-400 tracking-wider">Gain Brut (H.T)</span>
            <p class="text-lg font-black text-slate-850 dark:text-white font-mono mt-0.5">${Number(m.gain).toFixed(2)} €</p>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800">
            <span class="text-[9px] uppercase font-black text-slate-400 tracking-wider">Bénéfice Net</span>
            <p class="text-lg font-black font-mono mt-0.5 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${netProfit.toFixed(2)} €</p>
          </div>
        </div>
        
        <div class="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between items-center py-1">
            <span class="text-slate-500 font-medium">Carburant</span>
            <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${fuel.toFixed(2)} €</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
            <span class="text-slate-500 font-medium">Péages</span>
            <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${toll.toFixed(2)} €</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
            <span class="text-slate-500 font-medium">Frais Remboursés par Presta</span>
            <span class="font-black px-1.5 py-0.5 rounded text-[10px] ${m.fraisRembourses === 'Remboursé' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}">${m.fraisRembourses || 'Non renseigné'}</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
            <span class="text-slate-500 font-medium">Lavage carrosserie</span>
            <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${clean.toFixed(2)} €</span>
          </div>
          <div class="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
            <span class="text-slate-500 font-medium">Transport Retour (${m.transportRetour || 'N/A'})</span>
            <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${retPrice.toFixed(2)} €</span>
          </div>
          <div class="flex justify-between items-center py-2 border-t border-slate-150 dark:border-slate-850 font-bold">
            <span class="text-indigo-600 dark:text-indigo-400">Rendement de Marge</span>
            <span class="font-mono text-sm ${this.getRentabilityColor(rentabilityKm)}">${rentabilityKm.toFixed(3)} €/km</span>
          </div>
        </div>
      </div>

      <!-- Notes terrain & Sécurité -->
      <div class="space-y-3">
        <h5 class="text-xs font-black uppercase tracking-wider text-slate-400">Notes du Convoyeur (Terrain)</h5>
        <div class="space-y-2 text-xs">
          <div class="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-150 dark:border-slate-805 space-y-1">
            <span class="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Observations publiques</span>
            <p class="text-slate-705 dark:text-slate-300 font-medium leading-relaxed">${m.observations || '<span class="italic text-slate-400 font-normal">Aucune observation de parcours</span>'}</p>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-150 dark:border-slate-805 space-y-1">
            <span class="text-[9px] uppercase font-black text-rose-550 tracking-wider block">Incidents / Retards</span>
            <p class="text-rose-650 dark:text-rose-455 font-bold leading-relaxed">${m.incidents || '<span class="italic text-slate-400 font-normal">Zéro incident à signaler</span>'}</p>
          </div>

          <div class="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 dark:border-amber-400/20 space-y-1">
            <span class="text-[9px] uppercase font-black text-amber-600 dark:text-amber-400 tracking-wider block flex items-center gap-1">🔒 Notes de Direction Financière</span>
            <p class="text-slate-705 dark:text-slate-300 font-bold leading-relaxed">${m.privateNotes || '<span class="italic text-slate-405 font-normal">Aucune note d’administration</span>'}</p>
          </div>
        </div>
      </div>
    `;

    // 7. Injecter le footer d'actions rapides (Stické au bas du drawer sur mobile)
    const drawerFooter = document.getElementById('drawer_footer');
    if (drawerFooter) {
      drawerFooter.innerHTML = `
        <div class="grid grid-cols-4 gap-2 w-full">
          <button data-action="documents" data-id="${m.id}" title="Documents" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 transition-all active:scale-95 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9,12h6m-6,4h6m2,5H7a2,2,0,0,1,-2,-2V5a2,2,0,0,1,2,-2h5.586a1,1,0,0,1,0.707,0.293l5.414,5.414a1,1,0,0,1,0.293,0.707V19a2,2,0,0,1,-2,2z"/></svg>
            <span class="text-[9px] font-black uppercase">Docs</span>
          </button>
          
          <button data-action="inspect" data-id="${m.id}" title="Inspection" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40 transition-all active:scale-95 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span class="text-[9px] font-black uppercase">Photos</span>
          </button>

          ${!this.isReadOnly && (s !== 'payée' && s !== 'terminée' && s !== 'terminee') ? `
            <button data-action="validate" data-id="${m.id}" title="Valider" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40 transition-all active:scale-95 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span class="text-[9px] font-black uppercase">Valider</span>
            </button>
          ` : `
            <div class="flex flex-col items-center justify-center gap-1 p-2 opacity-50 grayscale bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
               <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
               <span class="text-[9px] font-black uppercase">Payée</span>
            </div>
          `}
          
          <button data-action="duplicate" data-id="${m.id}" title="Cloner" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 transition-all active:scale-95 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8,7v8a2,2,0,0,0,2,2h6M8,7V5a2,2,0,0,1,2,-2h4.586a1,1,0,0,1,0.707,0.293l4.414,4.414a1,1,0,0,1,0.293,0.707V15a2,2,0,0,1,-2,2h-2M8,7H6a2,2,0,0,0,-2,2v10a2,2,0,0,0,2,2h8a2,2,0,0,0,2,-2v-2"/></svg>
            <span class="text-[9px] font-black uppercase">Copier</span>
          </button>

          ${!this.isReadOnly ? `
            <button data-action="edit" data-id="${m.id}" title="Modifier" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 transition-all active:scale-95 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span class="text-[9px] font-black uppercase">Modifier</span>
            </button>
            
            <button data-action="delete" data-id="${m.id}" title="Supprimer" class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 transition-all active:scale-95 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span class="text-[9px] font-black uppercase">Suppr.</span>
            </button>
          ` : ''}
        </div>
      `;
    }

    // Activer l'affichage
    drawer.classList.remove('translate-x-full');
    drawer.classList.remove('hidden');

    // Ré-attacher les listeners pour le footer du drawer
    this.attachEventListeners(this.currentActionsHandler);

    // Backdrop de fermeture
    let backdrop = document.getElementById('drawerBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'drawerBackdrop';
      backdrop.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-45 transition-opacity duration-300';
      backdrop.onclick = () => this.closeDetailDrawer();
      document.body.appendChild(backdrop);
    } else {
      backdrop.classList.remove('hidden');
    }
  },

  /**
   * Ferme le volet de détails de la mission
   */
  closeDetailDrawer() {
    const drawer = document.getElementById('missionDetailDrawer');
    if (drawer) {
      drawer.classList.add('translate-x-full');
      setTimeout(() => {
        drawer.classList.add('hidden');
      }, 300);
    }

    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) {
      backdrop.classList.add('hidden');
    }
  },

  /**
   * Met à jour les icônes de tri des en-têtes (Support multi-colonnes)
   */
  updateSortHeaders(sortState) {
    const headers = document.querySelectorAll('[data-sort]');
    const criteriaList = Array.isArray(sortState)
      ? sortState
      : (sortState && sortState.field ? [sortState] : []);

    headers.forEach(header => {
      const field = header.getAttribute('data-sort');
      const arrowSpan = header.querySelector('.sort-arrow');
      if (!arrowSpan) return;

      const foundIndex = criteriaList.findIndex(item => item.field === field);
      if (foundIndex !== -1) {
        const item = criteriaList[foundIndex];
        const arrow = item.direction === 'asc' ? '▲' : '▼';
        
        // Afficher l'ordre de tri si multi-colonnes
        const sequence = criteriaList.length > 1 ? ` (${foundIndex + 1})` : '';
        arrowSpan.innerText = ` ${arrow}${sequence}`;
        
        header.classList.add('text-indigo-600', 'dark:text-indigo-400', 'font-black');
      } else {
        arrowSpan.innerText = ' ⇅';
        header.classList.remove('text-indigo-600', 'dark:text-indigo-400', 'font-black');
      }
    });

    // Synchronisation des boutons de tri rapide mobile
    const mobileSortDateBtn = document.getElementById('mobileSortDate');
    const mobileSortGainBtn = document.getElementById('mobileSortGain');
    const mobileSortDateArrow = document.getElementById('mobileSortDateArrow');
    const mobileSortGainArrow = document.getElementById('mobileSortGainArrow');

    const updateBtnState = (btn, arrowEl, field) => {
      if (!btn) return;
      const foundIndex = criteriaList.findIndex(item => item.field === field);
      if (foundIndex !== -1) {
        const item = criteriaList[foundIndex];
        const arrow = item.direction === 'asc' ? '▲' : '▼';
        if (arrowEl) arrowEl.innerText = arrow;
        btn.className = "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer border-indigo-500 dark:border-indigo-400 bg-indigo-50/25 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400";
      } else {
        if (arrowEl) arrowEl.innerText = "⇅";
        btn.className = "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2333] text-slate-700 dark:text-slate-350";
      }
    };

    updateBtnState(mobileSortDateBtn, mobileSortDateArrow, 'date');
    updateBtnState(mobileSortGainBtn, mobileSortGainArrow, 'gain');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * Attache les écouteurs d'événements du clicks d'actions (éditer, cloner, supprimer, etc.)
   */
  attachEventListeners(onActionClick) {
    const containers = [
      document.getElementById('missionsTableBody'),
      document.getElementById('missionsMobileContainer'),
      document.getElementById('drawer_footer')
    ];

    containers.forEach(container => {
      if (!container) return;

      // Uniquement supprimer les anciens listeners pour éviter l'effet cumulatif lors des ré-affichages
      const clone = container.cloneNode(true);
      container.parentNode.replaceChild(clone, container);

      clone.addEventListener('click', (e) => {
        let button = e.target.closest('button');
        if (!button) return;

        const action = button.getAttribute('data-action');
        const id = button.getAttribute('data-id');

        if (action && id) {
          e.preventDefault();
          e.stopPropagation();
          onActionClick(action, id);
        }
      });
    });
  }
};

window.TableService = TableService;
export default TableService;
