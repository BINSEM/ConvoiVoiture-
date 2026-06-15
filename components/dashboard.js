/**
 * Module d'interface du Dashboard de statistiques financières
 * Gère la mise à jour des compteurs visuels et l'affichage des alertes toasts.
 */

export const DashboardService = {
  /**
   * Animation de transition (compteur numérique) d'une valeur
   */
  animateValue(id, endValue, formatter = (v) => v.toString()) {
    const el = document.getElementById(id);
    if (!el) return;

    const parseNumber = (str) => {
      if (!str) return 0;
      const cleaned = str.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
      if (!cleaned) return 0;
      let normalized = cleaned;
      if (normalized.includes(',') && normalized.includes('.')) {
        if (normalized.indexOf(',') < normalized.indexOf('.')) {
          normalized = normalized.replace(/,/g, '');
        } else {
          normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (normalized.includes(',')) {
        normalized = normalized.replace(/,/g, '.');
      }
      const val = parseFloat(normalized);
      return isNaN(val) ? 0 : val;
    };

    const startValue = parseNumber(el.innerText);
    const target = parseFloat(endValue) || 0;

    if (startValue === target) {
      el.innerText = formatter(target);
      return;
    }

    if (el.dataset.animId) {
      cancelAnimationFrame(parseInt(el.dataset.animId, 10));
    }

    const duration = 800; // 800ms
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress * (2 - progress);
      const current = startValue + (target - startValue) * ease;
      
      el.innerText = formatter(current);
      
      if (progress < 1) {
        el.dataset.animId = requestAnimationFrame(update);
      } else {
        el.innerText = formatter(target);
        delete el.dataset.animId;
      }
    };

    el.dataset.animId = requestAnimationFrame(update);
  },

  /**
   * Met à jour l'ensemble des compteurs et KPI financiers du Dashboard principal
   * @param {Object} stats - Objet calculé de statistiques issu de StatsService
   * @param {Object} settings - Paramètres de l'utilisateur (urssafRate, nom, etc.)
   */
  updateMetricCards(stats, settings) {
    const formatEuro = (v) => {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
    };

    const updateText = (id, text, isClass = false) => {
      const el = document.getElementById(id);
      if (el) {
        if (isClass) {
          el.className = text;
        } else {
          el.innerText = text;
        }
      }
    };

    const urssafRate = settings ? settings.urssafRate : 23;

    // 1. Mettre à jour les KPI du haut
    DashboardService.animateValue('stat_total_missions', stats.totalMissions || 0, (v) => Math.round(v).toString());
    DashboardService.animateValue('stat_revenus_bruts', stats.totalRevenusBruts || 0, formatEuro);
    DashboardService.animateValue('stat_charges_urssaf', stats.chargesUrssaf || 0, formatEuro);
    
    if (stats.urssafAutoCalcActive) {
      updateText('stat_charges_urssaf_label', `Cotisations (Auto)`);
    } else {
      updateText('stat_charges_urssaf_label', `Cotisations (${urssafRate}%)`);
    }
    
    DashboardService.animateValue('stat_bénéfice_net', stats.beneficeNet || 0, formatEuro);
    DashboardService.animateValue('stat_bénéfice_net_reel', stats.beneficeNetReel || 0, formatEuro);
    DashboardService.animateValue('stat_revenus_apres_charges', stats.revenuApresCharges || 0, formatEuro);
    DashboardService.animateValue('stat_dépenses_totales', stats.totalExpenses || 0, formatEuro);
    DashboardService.animateValue('stat_frais_en_attente', stats.totalFraisEnAttente || 0, formatEuro);
    DashboardService.animateValue('stat_frais_rembourses', stats.totalFraisRembourses || 0, formatEuro);
    DashboardService.animateValue('stat_rentabilite_km', stats.rentabiliteKm || 0, (v) => `${v.toFixed(3)} €/km`);
    DashboardService.animateValue('stat_cout_moyen_retour', stats.coutMoyenRetour || 0, formatEuro);
    DashboardService.animateValue('stat_total_kilometrage', stats.totalKilometrage || 0, (v) => `${Math.round(v).toLocaleString('fr-FR')} km`);
    DashboardService.animateValue('stat_parcours_moyen', stats.parcoursMoyen || 0, (v) => `~${Math.round(v).toLocaleString('fr-FR')} km / trajet`);

    // Mettre à jour les KPI Expert Comptable
    DashboardService.animateValue('stat_accountant_ca_mensuel', stats.caMensuel || 0, formatEuro);
    DashboardService.animateValue('stat_accountant_ca_trimestriel', stats.caTrimestriel || 0, formatEuro);
    DashboardService.animateValue('stat_accountant_ca_annuel', stats.caAnnuel || 0, formatEuro);
    
    const fraisFixesEl = document.getElementById('stat_frais_fixes_details');
    if (fraisFixesEl) {
      if (stats.totalFraisFixes > 0 && stats.proratedMonths > 0) {
        let periodText = stats.proratedMonths > 1
          ? `${stats.proratedMonths.toFixed(2)} mois (${stats.durationLabel})`
          : `${(stats.proratedMonths * 30.44).toFixed(0)} jours`;
        if (stats.proratedMonths === 1 && stats.durationLabel === '1 mois') periodText = '1 mois';
        fraisFixesEl.innerText = `- ${formatEuro(stats.totalFraisFixes)} frais fixes (proratisé sur ${periodText})`;
        fraisFixesEl.classList.remove('hidden');
      } else {
        fraisFixesEl.classList.add('hidden');
      }
    }

    const usureVehiculeEl = document.getElementById('stat_usure_vehicule_details');
    if (usureVehiculeEl) {
      if (stats.totalUsureKilometrique > 0) {
        usureVehiculeEl.innerText = `- ${formatEuro(stats.totalUsureKilometrique)} d'usure kilométrique (${(settings ? (settings.usureKilometrique !== undefined ? Number(settings.usureKilometrique) : 0.22) : 0.22).toFixed(2)} €/km)`;
        usureVehiculeEl.classList.remove('hidden');
      } else {
        usureVehiculeEl.classList.add('hidden');
      }
    }

    const deprecEl = document.getElementById('stat_deprec_details');
    if (deprecEl) {
      if (stats.deprecEnabled && stats.totalDepreciation > 0) {
        deprecEl.innerText = `- ${formatEuro(stats.totalDepreciation)} d'amortissement véhicule`;
        deprecEl.classList.remove('hidden');
      } else {
        deprecEl.classList.add('hidden');
      }
    }

    const completionEl = document.getElementById('stat_taux_completion');
    const completionContainerEl = document.getElementById('stat_taux_completion_container');
    if (completionEl && completionContainerEl) {
      completionEl.innerText = `Taux complétion ${stats.completionRate.toFixed(0)}%`;
      if (stats.completionRate >= 90) {
        completionContainerEl.className = 'text-[10px] text-emerald-500 font-bold flex flex-row items-center gap-1 mt-1';
      } else if (stats.completionRate >= 50) {
        completionContainerEl.className = 'text-[10px] text-amber-500 font-bold flex flex-row items-center gap-1 mt-1';
      } else {
        completionContainerEl.className = 'text-[10px] text-rose-500 font-bold flex flex-row items-center gap-1 mt-1';
      }
    }

    // Mettre à jour l'indicateur de classe de rentabilité pour attirer l'oeil
    const rentabilityEl = document.getElementById('stat_rentabilite_km');
    if (rentabilityEl) {
      if (stats.rentabiliteKm >= 0.40) {
        rentabilityEl.className = 'text-2xl font-black text-emerald-600 dark:text-emerald-400';
      } else if (stats.rentabiliteKm >= 0.15) {
        rentabilityEl.className = 'text-2xl font-black text-indigo-600 dark:text-indigo-400';
      } else {
        rentabilityEl.className = 'text-2xl font-black text-rose-500';
      }
    }

    // Mettre à jour la répartition des charges secondaires dans le tiroir d'analyse
    updateText('breakdown_carburant', formatEuro(stats.totalCarburant));
    updateText('breakdown_peage', formatEuro(stats.totalPeage));
    updateText('breakdown_lavage', formatEuro(stats.totalLavage));
    updateText('breakdown_retour', formatEuro(stats.totalPrixRetour));

    // Pourcentage de charges d'exploitation sur chiffre d'affaires (CA)
    const exploitationPercentage = stats.totalRevenusBruts > 0
      ? ((stats.totalExpenses / stats.totalRevenusBruts) * 100).toFixed(1)
      : '0';
    updateText('exploitation_ratio_percentage', `${exploitationPercentage}% du CA`);

    // Mettre à jour l'échéancier et les déclarations mensuelles URSSAF
    const urssafContainer = document.getElementById('urssaf_monthly_container');
    const activeBadge = document.getElementById('urssaf_active_mode_badge');
    
    if (activeBadge) {
      if (stats.urssafAutoCalcActive) {
        activeBadge.innerText = 'Calcul automatique activé';
        activeBadge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 font-mono';
      } else {
        activeBadge.innerText = `Forfaitaire (${urssafRate}%)`;
        activeBadge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-850 font-mono';
      }
    }

    if (urssafContainer) {
      if (stats.urssafDetailedMois && stats.urssafDetailedMois.length > 0) {
        urssafContainer.innerHTML = stats.urssafDetailedMois.map(m => {
          const formattedCA = formatEuro(m.ca);
          const formattedUrssaf = formatEuro(m.urssafAmount);
          const classForUrssaf = m.urssafAmount > 0 ? "text-rose-600 dark:text-rose-450" : "text-slate-400";
          return `
            <div class="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/20 dark:bg-[#111726]/60 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-200">
              <div>
                <div class="flex items-center justify-between mb-1.5 pb-1.5 border-b border-slate-100/60 dark:border-slate-800/60">
                  <span class="text-xs font-black text-slate-800 dark:text-slate-200 font-sans">${m.monthLabel}</span>
                  <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-mono">${m.rateUsed.toFixed(1)}%</span>
                </div>
                <div class="flex items-center justify-between text-xs mt-1">
                  <span class="text-slate-400">CA déclaré :</span>
                  <span class="font-bold text-slate-700 dark:text-slate-300 font-mono">${formattedCA}</span>
                </div>
              </div>
              
              <div class="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2.5 mt-2.5 flex items-center justify-between">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cotisation due :</span>
                <span class="text-sm font-black font-mono ${classForUrssaf}">${formattedUrssaf}</span>
              </div>
              <div class="text-[9.5px] text-slate-400 mt-1 font-sans italic text-right truncate" title="${m.notes}">
                ${m.notes}
              </div>
            </div>
          `;
        }).join('');
      } else {
        urssafContainer.innerHTML = `
          <div class="col-span-full text-center py-6 text-slate-400 text-xs">
            Aucun chiffre d'affaires décaissé sur cette sélection.
          </div>
        `;
      }
    }
  },

  /**
   * Notifications Toast élégantes
   * @param {string} msg 
   * @param {string} type - 'success', 'warning', 'danger', 'info'
   */
  showNotification(msg, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(toastContainer);
    }

    // Créer la notification
    const toast = document.createElement('div');
    toast.className = `flex items-center w-full max-w-xs p-4 text-gray-900 bg-white rounded-xl shadow-lg dark:text-gray-300 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 transition-transform transform -translate-y-2 opacity-0 select-none pointer-events-auto`;
    
    // Configurer l'icône selon le type
    let iconHTML = '';
    if (type === 'success') {
      iconHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-emerald-500 bg-emerald-100 rounded-lg dark:bg-emerald-950/50 dark:text-emerald-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>
      `;
    } else if (type === 'danger' || type === 'error') {
      iconHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-rose-500 bg-rose-100 rounded-lg dark:bg-rose-950/50 dark:text-rose-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
      `;
    } else if (type === 'warning') {
      iconHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-amber-500 bg-amber-100 rounded-lg dark:bg-amber-950/50 dark:text-amber-300">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
      `;
    } else {
      iconHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-indigo-500 bg-indigo-100 rounded-lg dark:bg-indigo-950/50 dark:text-indigo-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
      `;
    }

    toast.innerHTML = `
      ${iconHTML}
      <div class="ml-3 text-sm font-medium pr-2">${msg}</div>
      <button class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 hover:bg-gray-100 inline-flex h-8 h-8 dark:text-gray-500 dark:bg-slate-800 dark:hover:text-white dark:hover:bg-slate-700" onclick="this.parentElement.remove()">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    toastContainer.appendChild(toast);

    // Fade-in animation
    setTimeout(() => {
      toast.classList.remove('opacity-0', '-translate-y-2');
      toast.classList.add('opacity-100', 'translate-y-0');
    }, 50);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  },

  /**
   * Progressive disclosure toggle for advanced financial indicators
   */
  toggleAdvancedKPIs() {
    const container = document.getElementById('advanced_kpis_container');
    const label = document.getElementById('toggle_kpis_btn_text');
    const iconOpen = document.getElementById('toggle_kpis_icon_open');
    const iconClosed = document.getElementById('toggle_kpis_icon_closed');

    if (!container) return;

    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      if (label) label.innerText = 'Masquer les indicateurs avancés';
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClosed) iconClosed.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
      if (label) label.innerText = 'Afficher les indicateurs avancés';
      if (iconOpen) iconOpen.classList.remove('hidden');
      if (iconClosed) iconClosed.classList.add('hidden');
    }
  },

  /**
   * Progressive disclosure toggle for activity reports and charts
   */
  toggleAdvancedCharts() {
    const container = document.getElementById('advanced_charts_container');
    const label = document.getElementById('toggle_charts_btn_text');
    const iconOpen = document.getElementById('toggle_charts_icon_open');
    const iconClosed = document.getElementById('toggle_charts_icon_closed');

    if (!container) return;

    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      if (label) label.innerText = 'Masquer les analyses et graphiques';
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClosed) iconClosed.classList.remove('hidden');

      // OPTIMIZATION: Trigger chart rendering when the dashboard panels are first shown
      if (window.StatsService && window.app) {
        window.StatsService.renderCharts(
          window.app.filteredMissions || [],
          window.app.isDarkMode || false,
          window.app.settings || {}
        );
      }
    } else {
      container.classList.add('hidden');
      if (label) label.innerText = 'Afficher les analyses et graphiques';
      if (iconOpen) iconOpen.classList.remove('hidden');
      if (iconClosed) iconClosed.classList.add('hidden');
    }
  }
};

window.DashboardService = DashboardService;
