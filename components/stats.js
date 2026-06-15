/**
 * Module de calculs statistiques et d'initialisation des graphiques (Chart.js)
 */

export const StatsService = {
  /**
   * Calcule tous les agrégats financiers à partir de la liste des missions
   * @param {Array} missions 
   * @param {Object} settings
   */
  calculateFinancials(missions, settings, filters = null) {
    const usureRate = settings ? (settings.usureKilometrique !== undefined ? Number(settings.usureKilometrique) : 0.22) : 0.22;
    
    let totalMissions = missions.length;
    let totalRevenusBruts = 0;
    let totalCarburant = 0;
    let totalPeage = 0;
    let totalLavage = 0;
    let totalPrixRetour = 0;
    let totalKilometrage = 0;
    let totalFraisEnAttente = 0;
    let totalFraisRembourses = 0;
    let totalUsureKilometrique = 0;
    let returnTripsCount = 0;
    let successfulMissionsCount = 0;
    const activeMonths = new Set();
    const fraisFixesMensuels = settings ? (settings.fraisFixesMensuels || 0) : 0;
    
    let minDate = null;
    let maxDate = null;

    missions.forEach(m => {
      const isCanceled = (m.statut || '').trim().toLowerCase() === 'annulée';
      if (!isCanceled) successfulMissionsCount++;

      if (m.date) {
        activeMonths.add(m.date.substring(0, 7)); // yyyy-MM
        const d = new Date(m.date);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }

      totalRevenusBruts += (Number(m.gain) || 0);
      
      const carb = Number(m.carburant) || 0;
      const peag = Number(m.peage) || 0;
      totalCarburant += carb;
      totalPeage += peag;
      totalLavage += (Number(m.lavage) || 0);
      
      if (m.fraisRembourses === 'Remboursé') {
        totalFraisRembourses += (carb + peag);
      } else {
        totalFraisEnAttente += (carb + peag);
      }
      
      const pRetour = (Number(m.prixRetour) || 0);
      totalPrixRetour += pRetour;
      if (pRetour > 0) {
        returnTripsCount++;
      }

      const km = (Number(m.kilometrage) || 0);
      totalKilometrage += km;

      // Calcul de l'usure kilométrique du véhicule personnel sur le trajet retour
      const transportType = (m.transportRetour || '').toLowerCase().trim();
      const isVehiculePersonnel = !isCanceled && (
        transportType.includes('perso') || 
        transportType.includes('véhicule personnel') || 
        transportType.includes('voiture personnelle') || 
        transportType === 'vp'
      );
      if (isVehiculePersonnel) {
        totalUsureKilometrique += km * usureRate;
      }
    });

    const totalExpenses = totalCarburant + totalPeage + totalLavage + totalPrixRetour;
    const depensesNonRemboursees = totalLavage + totalPrixRetour;
    const beneficeNet = totalRevenusBruts - depensesNonRemboursees;

    // --- DEBUT CALCUL AUTOMATIQUE URSSAF MENSUEL ---
    let chargesUrssaf = 0;
    let urssafDetailedMois = [];
    let urssafLabel = settings ? `${settings.urssafRate || 23}%` : '23%';

    const isAuto = settings ? !!settings.urssafAutoCalc : false;
    const activityType = settings ? (settings.urssafActivityType || 'service_commercial') : 'service_commercial';
    const hasAcre = settings ? (settings.urssafAcre === 'yes') : false;
    const hasVl = settings ? !!settings.urssafvl : false;
    const hasCfp = settings ? !!settings.urssafCfp : false;

    // Définition des taux d'activité de base (2025/2026 en France)
    let baseActivityRate = 0.211; // Par défaut : 21.1% pour les activités de services
    if (activityType === 'liberal_cipav') {
      baseActivityRate = 0.232; // 23.2%
    } else if (activityType === 'vente') {
      baseActivityRate = 0.123; // 12.3%
    }

    // Taux versement libératoire (VL)
    let vlRate = 0;
    if (hasVl) {
      if (activityType === 'vente') vlRate = 0.01;      // 1.0%
      else if (activityType === 'liberal_bnc' || activityType === 'liberal_cipav') vlRate = 0.022; // 2.2%
      else vlRate = 0.017; // 1.7% pour services commerciaux / artisanaux
    }

    // Taux contribution formation professionnelle (CFP)
    let cfpRate = 0;
    if (hasCfp) {
      if (activityType === 'vente') cfpRate = 0.001; // 0.1%
      else if (activityType === 'service_commercial') cfpRate = 0.002; // 0.2%
      else cfpRate = 0.002; // 0.2%
    }

    // Grouper les CA par mois civil
    const monthlyCA = {};
    missions.forEach(m => {
      const isCanceled = (m.statut || '').trim().toLowerCase() === 'annulée';
      if (isCanceled) return;
      
      const gain = Number(m.gain) || 0;
      let monthKey = 'Sans Date';
      if (m.date) {
        monthKey = m.date.substring(0, 7); // yyyy-MM
      }
      monthlyCA[monthKey] = (monthlyCA[monthKey] || 0) + gain;
    });

    const sortOrder = (filters && filters.dashboardSort) ? filters.dashboardSort : 'desc';
    let sortedMonths = Object.keys(monthlyCA);
    
    if (sortOrder === 'asc') {
      sortedMonths.sort();
    } else if (sortOrder === 'desc') {
      sortedMonths.sort().reverse();
    } else if (sortOrder === 'revenue_desc') {
      sortedMonths.sort((a, b) => (monthlyCA[b] || 0) - (monthlyCA[a] || 0));
    } else if (sortOrder === 'revenue_asc') {
      sortedMonths.sort((a, b) => (monthlyCA[a] || 0) - (monthlyCA[b] || 0));
    } else {
      sortedMonths.sort().reverse();
    }

    sortedMonths.forEach(monthKey => {
      const ca = monthlyCA[monthKey];
      let notes = [];
      let basePart = 0;

      if (isAuto) {
        if (hasAcre) {
          const acreCeiling = 3864; // PMSS mensuel de référence
          let acreRate = baseActivityRate * 0.5;
          if (ca <= acreCeiling) {
            basePart = ca * acreRate;
            notes.push(`ACRE (100% à ${(acreRate*100).toFixed(2)}%)`);
          } else {
            basePart = (acreCeiling * acreRate) + ((ca - acreCeiling) * baseActivityRate);
            notes.push(`ACRE partiel jusqu'à 3864€`);
          }
        } else {
          basePart = ca * baseActivityRate;
        }

        let vlPart = ca * vlRate;
        if (hasVl) notes.push(`VL (+${(vlRate*100).toFixed(1)}%)`);

        let cfpPart = ca * cfpRate;
        if (hasCfp) notes.push(`CFP (+${(cfpRate*100).toFixed(1)}%)`);

        const totalUrssafForMonth = basePart + vlPart + cfpPart;
        chargesUrssaf += totalUrssafForMonth;

        let label = '';
        if (monthKey !== 'Sans Date') {
          const [yr, mo] = monthKey.split('-');
          const dObj = new Date(yr, parseInt(mo) - 1, 1);
          label = dObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        } else {
          label = 'Sans Date';
        }

        const calculatedRate = ca > 0 ? (totalUrssafForMonth / ca) * 100 : (baseActivityRate + vlRate + cfpRate) * 100;

        urssafDetailedMois.push({
          monthKey,
          monthLabel: label,
          ca,
          urssafAmount: totalUrssafForMonth,
          rateUsed: calculatedRate,
          notes: notes.join(', ') || `Taux principal ${(baseActivityRate*100).toFixed(1)}%`
        });
      } else {
        // Mode manuel
        const monthBaseRate = (settings ? settings.urssafRate : 23) / 100;
        const totalUrssafForMonth = ca * monthBaseRate;
        chargesUrssaf += totalUrssafForMonth;

        let label = '';
        if (monthKey !== 'Sans Date') {
          const [yr, mo] = monthKey.split('-');
          const dObj = new Date(yr, parseInt(mo) - 1, 1);
          label = dObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        } else {
          label = 'Sans Date';
        }

        urssafDetailedMois.push({
          monthKey,
          monthLabel: label,
          ca,
          urssafAmount: totalUrssafForMonth,
          rateUsed: monthBaseRate * 105 / 105 * 100, // exact rate
          notes: 'Taux fixe configuré'
        });
      }
    });

    if (isAuto) {
      let parts = [];
      const actRatePercent = (baseActivityRate * 100).toFixed(1);
      if (hasAcre) parts.push(`ACRE (${(baseActivityRate * 50).toFixed(2)}%)`);
      else parts.push(`Activité ${actRatePercent}%`);
      
      if (hasVl) parts.push(`VL +${(vlRate * 100).toFixed(1)}%`);
      if (hasCfp) parts.push(`CFP +${(cfpRate * 100).toFixed(1)}%`);
      urssafLabel = parts.join(' • ');
    } else {
      urssafLabel = `Forfaitaire (${(settings ? settings.urssafRate : 23)}%)`;
    }
    // --- FIN CALCUL AUTOMATIQUE URSSAF MENSUEL ---
    
    // Proratisation des frais fixes mensuels
    let proratedMonths = 0;
    let durationLabel = '';
    if (minDate && maxDate) {
      const diffTime = Math.abs(maxDate - minDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusif
      proratedMonths = diffDays / 30.44; 
      durationLabel = `~${diffDays} jour(s)`;
    } else if (missions.length > 0) {
      proratedMonths = 1;
      durationLabel = `1 mois`;
    }
    
    const totalFraisFixes = fraisFixesMensuels * proratedMonths;

    // --- CALCULS CA SPECIFIQUES (EXPERT COMPTABLE) ---
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthFormatted = now.toISOString().substring(0, 7);
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    let caMensuel = 0;
    let caTrimestriel = 0;
    let caAnnuel = 0;

    Object.keys(monthlyCA).forEach(mKey => {
      if (mKey === 'Sans Date') return;
      const [yr, mo] = mKey.split('-').map(Number);
      
      // Annuel
      if (yr === currentYear) {
        caAnnuel += monthlyCA[mKey];
        
        // Trimestriel
        const q = Math.floor((mo - 1) / 3) + 1;
        if (q === currentQuarter) {
          caTrimestriel += monthlyCA[mKey];
        }
        
        // Mensuel
        if (mKey === currentMonthFormatted) {
          caMensuel += monthlyCA[mKey];
        }
      }
    });

    // Calcul de l'amortissement annuel du véhicule personnel
    const deprecEnabled = settings ? !!settings.deprecEnabled : false;
    const purchasePrice = settings ? (settings.deprecPurchase !== undefined ? Number(settings.deprecPurchase) : 20000) : 20000;
    const residualPrice = settings ? (settings.deprecResidual !== undefined ? Number(settings.deprecResidual) : 5000) : 5000;
    const deprecYears = settings ? (settings.deprecYears !== undefined ? Number(settings.deprecYears) : 5) : 5;

    let totalDepreciation = 0;
    if (deprecEnabled && deprecYears > 0) {
      const annualDepreciation = Math.max(0, purchasePrice - residualPrice) / deprecYears;
      totalDepreciation = (annualDepreciation / 12) * proratedMonths;
    }

    const revenuApresCharges = totalRevenusBruts - chargesUrssaf;
    const rentabiliteKm = totalKilometrage > 0 ? (beneficeNet / totalKilometrage) : 0;
    const coutMoyenRetour = returnTripsCount > 0 ? (totalPrixRetour / returnTripsCount) : 0;
    const beneficeNetReel = beneficeNet - chargesUrssaf - totalFraisFixes - totalUsureKilometrique - totalDepreciation; // Gain - Dépenses - URSSAF - Frais Fixes proratisés - Usure Véhicule Personnel - Amortissement

    const parcoursMoyen = totalMissions > 0 ? (totalKilometrage / totalMissions) : 0;
    const completionRate = totalMissions > 0 ? (successfulMissionsCount / totalMissions) * 100 : 100;

    return {
      totalMissions,
      totalRevenusBruts,
      totalCarburant,
      totalPeage,
      totalLavage,
      totalPrixRetour,
      totalExpenses,
      totalFraisFixes,
      proratedMonths,
      durationLabel,
      beneficeNet,
      chargesUrssaf,
      urssafDetailedMois,
      urssafModeLabel: urssafLabel,
      urssafAutoCalcActive: isAuto,
      revenuApresCharges,
      rentabiliteKm,
      coutMoyenRetour,
      beneficeNetReel,
      totalKilometrage,
      parcoursMoyen,
      completionRate,
      totalFraisEnAttente,
      totalFraisRembourses,
      totalUsureKilometrique,
      totalDepreciation,
      deprecEnabled,
      caMensuel,
      caTrimestriel,
      caAnnuel
    };
  },

  /**
   * Regroupe les données par plateforme pour le graphique de parts de marché
   */
  groupByPlatform(missions) {
    const platforms = {};
    missions.forEach(m => {
      const plat = m.plateforme || 'Autre';
      platforms[plat] = (platforms[plat] || 0) + 1;
    });
    return platforms;
  },

  /**
   * Regroupe les bénéfices et dépenses par mois chronologique
   */
  getMonthlyTrends(missions) {
    const months = {};
    
    // Trier chronologiquement
    const sorted = [...missions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sorted.forEach(m => {
      if (!m.date) return;
      const dateObj = new Date(m.date);
      const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      
      const gain = Number(m.gain) || 0;
      const depenses = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const depensesNonRemboursees = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const benefice = gain - depensesNonRemboursees;

      if (!months[yearMonth]) {
        months[yearMonth] = {
          label: dateObj.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          revenu: 0,
          dépenses: 0,
          bénéfice: 0,
          count: 0
        };
      }
      
      months[yearMonth].revenu += gain;
      months[yearMonth].dépenses += depenses;
      months[yearMonth].bénéfice += benefice;
      months[yearMonth].count += 1;
    });

    return Object.values(months);
  },

  /**
   * Regroupe les données par semaine de l'année en cours
   */
  getWeeklyTrends(missions) {
    const weeks = {};
    
    // Obtenir le numéro de semaine ISO
    const getWeekNumber = (d) => {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
      return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    };

    missions.forEach(m => {
      if (!m.date) return;
      const d = new Date(m.date);
      const year = d.getFullYear();
      const week = getWeekNumber(d);
      const weekKey = `${year}-W${week}`;

      const gain = Number(m.gain) || 0;
      const depenses = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const depensesNonRemboursees = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const benefice = gain - depensesNonRemboursees;

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          label: `Sem. ${week}`,
          revenu: 0,
          depenses: 0,
          benefice: 0,
          count: 0
        };
      }

      weeks[weekKey].revenu += gain;
      weeks[weekKey].depenses += depenses;
      weeks[weekKey].benefice += benefice;
      weeks[weekKey].count += 1;
    });

    // Renvoyer les 8 dernières semaines actives, triées chronologiquement
    const sortedVals = Object.keys(weeks).sort().map(k => weeks[k]);
    return sortedVals.slice(-8);
  },

  // Variables pour stocker les instances des graphiques Chart.js et éviter les conflits au rendu
  charts: {
    revenueChart: null,
    platformChart: null,
    weeklyChart: null,
    largeRevenueChart: null,
    largePlatformChart: null,
    platformRadarChart: null,
    mileageProfitScatterChart: null
  },

  // Variables pour mémoriser les dernières données de rendu afin de recalibrer au resize
  lastMissions: null,
  lastDarkMode: false,
  lastSettings: null,
  resizeRegistered: false,

  /**
   * Nettoie les graphiques existants pour éviter les bugs de superposition Chart.js
   */
  destroyCharts() {
    if (this.charts.revenueChart) {
      this.charts.revenueChart.destroy();
      this.charts.revenueChart = null;
    }
    if (this.charts.platformChart) {
      this.charts.platformChart.destroy();
      this.charts.platformChart = null;
    }
    if (this.charts.weeklyChart) {
      this.charts.weeklyChart.destroy();
      this.charts.weeklyChart = null;
    }
    if (this.charts.largeRevenueChart) {
      this.charts.largeRevenueChart.destroy();
      this.charts.largeRevenueChart = null;
    }
    if (this.charts.largePlatformChart) {
      this.charts.largePlatformChart.destroy();
      this.charts.largePlatformChart = null;
    }
    if (this.charts.platformRadarChart) {
      this.charts.platformRadarChart.destroy();
      this.charts.platformRadarChart = null;
    }
    if (this.charts.mileageProfitScatterChart) {
      this.charts.mileageProfitScatterChart.destroy();
      this.charts.mileageProfitScatterChart = null;
    }
  },

  /**
   * Initialise ou met à jour les courbes financières
   */
  renderCharts(missions, isDarkMode, settings) {
    this.lastMissions = missions;
    this.lastDarkMode = isDarkMode;
    this.lastSettings = settings;

    // Enregistrement d'un écouteur de redimensionnement de fenêtre avec anti-rebond (debounce)
    if (!this.resizeRegistered) {
      this.resizeRegistered = true;
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (this.lastMissions) {
            this.renderCharts(this.lastMissions, this.lastDarkMode, this.lastSettings);
          }
        }, 200);
      });
    }

    this.destroyCharts();

    const canvasRevenue = document.getElementById('revenueChart');
    const canvasPlatform = document.getElementById('platformChart');
    const canvasWeekly = document.getElementById('weeklyChart');
    const canvasLargeRevenue = document.getElementById('largeStatsRevenueChart');
    const canvasLargePlatform = document.getElementById('largePlatformStatsChart');
    const canvasRadar = document.getElementById('platformRadarChart');
    const canvasScatter = document.getElementById('mileageProfitScatterChart');

    if (!canvasRevenue && !canvasPlatform && !canvasWeekly && !canvasLargeRevenue && !canvasLargePlatform && !canvasRadar && !canvasScatter) return;

    // Détection responsive
    const isMobile = window.innerWidth < 768;

    // Couleurs adaptées au thème actif
    const textColor = isDarkMode ? '#f3f4f6' : '#1f2937';
    const gridColor = isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.6)';

    // 1. Données de tendances mensuelles
    const monthlyData = this.getMonthlyTrends(missions);
    if (monthlyData.length > 0) {
      const makeRevenueChartConfig = () => {
        if (isMobile) {
          // Sur mobile, on convertit le graphique à barres en tarte / beignet (doughnut) des totaux cumulés pour optimiser la lisibilité
          let totalRevenu = 0;
          let totalBenefice = 0;
          let totalDepenses = 0;
          monthlyData.forEach(d => {
            totalRevenu += Number(d.revenu) || 0;
            totalBenefice += Number(d.bénéfice) || 0;
            totalDepenses += Number(d.dépenses) || 0;
          });

          return {
            type: 'doughnut',
            data: {
              labels: ['Revenus Bruts', 'Bénéfice Net', 'Dépenses'],
              datasets: [{
                data: [totalRevenu.toFixed(2), totalBenefice.toFixed(2), totalDepenses.toFixed(2)],
                backgroundColor: [
                  'rgba(37, 99, 235, 0.8)', // Bleu
                  'rgba(22, 163, 74, 0.8)', // Vert
                  'rgba(220, 38, 38, 0.8)'  // Rouge
                ],
                borderColor: isDarkMode ? '#0f172a' : '#ffffff',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 10 } }
                },
                tooltip: {
                  padding: 10,
                  cornerRadius: 6,
                  bodyFont: { family: 'Inter' }
                }
              }
            }
          };
        } else {
          // Sur écran large (PC / tablette), le graphique à barres mensuel classique est rendu
          return {
            type: 'bar',
            data: {
              labels: monthlyData.map(d => d.label),
              datasets: [
                {
                  label: 'Revenus Bruts (€)',
                  data: monthlyData.map(d => d.revenu.toFixed(2)),
                  backgroundColor: 'rgba(37, 99, 235, 0.75)', // --secondary
                  borderColor: '#2563eb',
                  borderWidth: 1.5,
                  borderRadius: 6
                },
                {
                  label: 'Bénéfice Net (€)',
                  data: monthlyData.map(d => d.bénéfice.toFixed(2)),
                  backgroundColor: 'rgba(22, 163, 74, 0.75)', // --success
                  borderColor: '#16a34a',
                  borderWidth: 1.5,
                  borderRadius: 6
                },
                {
                  label: 'Dépenses (€)',
                  data: monthlyData.map(d => d.dépenses.toFixed(2)),
                  backgroundColor: 'rgba(220, 38, 38, 0.75)', // --danger
                  borderColor: '#dc2626',
                  borderWidth: 1.5,
                  borderRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  labels: { color: textColor, font: { family: 'Inter', weight: 500 } }
                },
                tooltip: {
                  padding: 12,
                  cornerRadius: 8,
                  bodyFont: { family: 'Inter' },
                  titleFont: { family: 'Inter', weight: 'bold' }
                }
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: textColor, font: { family: 'Inter' } }
                },
                y: {
                  grid: { color: gridColor },
                  ticks: { color: textColor, font: { family: 'Inter' } }
                }
              }
            }
          };
        }
      };

      if (canvasRevenue) {
        const ctx = canvasRevenue.getContext('2d');
        this.charts.revenueChart = new Chart(ctx, makeRevenueChartConfig());
      }
      
      if (canvasLargeRevenue) {
        const ctx = canvasLargeRevenue.getContext('2d');
        this.charts.largeRevenueChart = new Chart(ctx, makeRevenueChartConfig());
      }
    }

    // 2. Part par plateforme de convoyage
    const platformGroups = this.groupByPlatform(missions);
    if (Object.keys(platformGroups).length > 0) {
      const makePlatformChartConfig = () => {
        if (isMobile) {
          // Sur mobile, les étiquettes du diagramme circulaire débordent souvent, on le remplace donc par un graphique à barres horizontales
          return {
            type: 'bar',
            data: {
              labels: Object.keys(platformGroups),
              datasets: [{
                label: 'Volume par plateforme',
                data: Object.values(platformGroups),
                backgroundColor: [
                  '#1e3a8a', // Otoqi dark blue
                  '#2563eb', // Hiflow standard blue
                  '#10b981', // Driiveme green/emerald
                  '#f59e0b', // Expedicar amber
                  '#8b5cf6', // Aubergine/Violet
                  '#6b7280'
                ],
                borderRadius: 4,
                borderWidth: 1,
                borderColor: isDarkMode ? '#0f172a' : '#ffffff'
              }]
            },
            options: {
              indexAxis: 'y', // Mode horizontal
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  padding: 10,
                  cornerRadius: 6,
                  bodyFont: { family: 'Inter' }
                }
              },
              scales: {
                x: {
                  grid: { color: gridColor },
                  ticks: { color: textColor, font: { family: 'Inter', size: 9 } }
                },
                y: {
                  grid: { display: false },
                  ticks: { color: textColor, font: { family: 'Inter', size: 9, weight: 600 } }
                }
              }
            }
          };
        } else {
          // Sur PC, le graphique en beignet (pie-like doughnut) reste parfait
          return {
            type: 'doughnut',
            data: {
              labels: Object.keys(platformGroups),
              datasets: [{
                data: Object.values(platformGroups),
                backgroundColor: [
                  '#1e3a8a', // Otoqi dark blue
                  '#2563eb', // Hiflow standard blue
                  '#10b981', // Driiveme green/emerald
                  '#f59e0b', // Expedicar amber
                  '#8b5cf6', // Aubergine/Violet pour d'autres
                  '#6b7280'
                ],
                hoverOffset: 6,
                borderWidth: isDarkMode ? 2 : 1,
                borderColor: isDarkMode ? '#0f172a' : '#ffffff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'right',
                  labels: { color: textColor, font: { family: 'Inter', weight: 500 } }
                },
                tooltip: {
                  padding: 10,
                  cornerRadius: 6,
                  bodyFont: { family: 'Inter' }
                }
              }
            }
          };
        }
      };

      if (canvasPlatform) {
        const ctx = canvasPlatform.getContext('2d');
        this.charts.platformChart = new Chart(ctx, makePlatformChartConfig());
      }

      if (canvasLargePlatform) {
        const ctx = canvasLargePlatform.getContext('2d');
        this.charts.largePlatformChart = new Chart(ctx, makePlatformChartConfig());
      }
    }

    // 3. Rentabilité hebdomadaire
    const weeklyData = this.getWeeklyTrends(missions);
    if (canvasWeekly && weeklyData.length > 0) {
      const ctx = canvasWeekly.getContext('2d');
      this.charts.weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: weeklyData.map(d => d.label),
          datasets: [{
            label: 'Bénéfice Hebdomadaire (€)',
            data: weeklyData.map(d => d.benefice.toFixed(2)),
            fill: true,
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            borderColor: '#2563eb',
            borderWidth: 2.5,
            tension: 0.35,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Inter', weight: 500 } }
            },
            tooltip: {
              padding: 12,
              cornerRadius: 8,
              bodyFont: { family: 'Inter' }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Inter' } }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter' } }
            }
          }
        }
      });
    }

    // 4. Graphique Radar - Comparatif de performance sur les 6 derniers mois
    if (canvasRadar) {
      // Filtrer les missions des 6 derniers mois (basé sur la date la plus récente disponible pour un affichage robuste)
      let maxDate = null;
      missions.forEach(m => {
        if (m.date) {
          const d = new Date(m.date);
          if (!maxDate || d > maxDate) maxDate = d;
        }
      });

      const referenceDate = maxDate ? new Date(maxDate) : new Date();
      const sixMonthsAgo = new Date(referenceDate);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentMissions = missions.filter(m => {
        if (!m.date) return false;
        const d = new Date(m.date);
        return d >= sixMonthsAgo && d <= referenceDate;
      });

      // Regrouper par plateforme
      const platformMissions = {};
      recentMissions.forEach(m => {
        const p = m.plateforme || 'Autre';
        if (!platformMissions[p]) platformMissions[p] = [];
        platformMissions[p].push(m);
      });

      // Mesures de normalisation
      // Trouver les bornes de référence pour calculer le score 0-100 indépendant
      let maxMissionsCount = 0;
      let maxAvgGain = 0;
      let maxRentabiliteKm = 0;

      const statsByPlatform = {};
      Object.entries(platformMissions).forEach(([platform, list]) => {
        const count = list.length;
        if (count > maxMissionsCount) maxMissionsCount = count;

        let totalGain = 0;
        let totalNetProfit = 0;
        let totalKm = 0;
        let totalPrixRetour = 0;

        list.forEach(m => {
          totalGain += Number(m.gain) || 0;
          const expensesNonRemb = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
          totalNetProfit += (Number(m.gain) || 0) * (1 - (settings ? settings.urssafRate : 23)/100) - expensesNonRemb;
          totalKm += Number(m.kilometrage) || 0;
          totalPrixRetour += Number(m.prixRetour) || 0;
        });

        const avgGain = count > 0 ? totalGain / count : 0;
        if (avgGain > maxAvgGain) maxAvgGain = avgGain;

        const rentabiliteKm = totalKm > 0 ? totalNetProfit / totalKm : 0;
        if (rentabiliteKm > maxRentabiliteKm) maxRentabiliteKm = rentabiliteKm;

        const avgPrixRetour = count > 0 ? totalPrixRetour / count : 0;

        statsByPlatform[platform] = {
          count,
          totalGain,
          totalNetProfit,
          avgGain,
          rentabiliteKm,
          avgPrixRetour
        };
      });

      // Définir les couleurs de chaque plateforme pour le tracé radar
      const getPlatformColors = (platformName) => {
        const name = platformName.toLowerCase();
        if (name.includes('otoqi')) {
          return {
            border: '#1e3a8a',
            bg: 'rgba(30, 58, 138, 0.25)'
          };
        } else if (name.includes('hiflow')) {
          return {
            border: '#2563eb',
            bg: 'rgba(37, 99, 235, 0.25)'
          };
        } else if (name.includes('driiveme')) {
          return {
            border: '#10b981',
            bg: 'rgba(16, 185, 129, 0.25)'
          };
        } else if (name.includes('expedicar')) {
          return {
            border: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.25)'
          };
        } else {
          // Palette dynamique pour d'autres clients
          return {
            border: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.25)'
          };
        }
      };

      // Créer les datasets normalisés
      const datasets = Object.entries(statsByPlatform).map(([platform, stats]) => {
        const colors = getPlatformColors(platform);

        // Score 1 : Volume d'Activité
        const scoreVolume = maxMissionsCount > 0 ? (stats.count / maxMissionsCount) * 100 : 0;

        // Score 2 : Gain Moyen Course
        const scoreGain = maxAvgGain > 0 ? (stats.avgGain / maxAvgGain) * 100 : 0;

        // Score 3 : Marge d'Exploitation (%)
        const scoreMarge = stats.totalGain > 0 ? Math.max(0, Math.min(100, (stats.totalNetProfit / stats.totalGain) * 100)) : 0;

        // Score 4 : Rentabilité KM
        const scoreRentabilite = maxRentabiliteKm > 0 ? (stats.rentabiliteKm / maxRentabiliteKm) * 100 : 0;

        // Score 5 : Optimisation du retour (Plus le prix moyen de retour est faible en proportion du gain, plus le score est élevé)
        const scoreRetour = stats.avgGain > 0 ? Math.max(0, Math.min(100, 100 - (stats.avgPrixRetour / stats.avgGain) * 100)) : 100;

        return {
          label: platform,
          data: [
            Math.round(scoreVolume),
            Math.round(scoreGain),
            Math.round(scoreMarge),
            Math.round(scoreRentabilite),
            Math.round(scoreRetour)
          ],
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 2,
          pointBackgroundColor: colors.border,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: colors.border,
          pointRadius: 4,
          pointHoverRadius: 6
        };
      });

      const ctx = canvasRadar.getContext('2d');
      this.charts.platformRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: [
            "Volume d'Activité",
            "Gain Moyen Course",
            "Marge d'Exploitation",
            "Rentabilité au KM",
            "Optimisation du Retour"
          ],
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor, font: { family: 'Inter', weight: 600, size: 11 } }
            },
            tooltip: {
              padding: 10,
              cornerRadius: 8,
              bodyFont: { family: 'Inter' },
              titleFont: { family: 'Inter', weight: 'bold' }
            }
          },
          scales: {
            r: {
              angleLines: { color: gridColor },
              grid: { color: gridColor },
              pointLabels: { 
                color: textColor, 
                font: { family: 'Inter', size: 10, weight: 'bold' } 
              },
              ticks: {
                color: textColor,
                backdropColor: 'transparent',
                font: { family: 'Inter', size: 8 },
                stepSize: 20
              },
              suggestedMin: 0,
              suggestedMax: 100
            }
          }
        }
      });
    }

    // 5. Graphique de Corrélation Kilométrage vs Bénéfice Net (Nuage de Points)
    if (canvasScatter) {
      const scatterPoints = [];
      const pointBackgroundColors = [];
      const pointBorderColors = [];

      missions.forEach(m => {
        const isCanceled = (m.statut || '').trim().toLowerCase() === 'annulée';
        if (isCanceled) return;

        const gain = Number(m.gain) || 0;
        const km = Number(m.kilometrage) || 0;
        if (km <= 0) return;

        const carb = Number(m.carburant) || 0;
        const peag = Number(m.peage) || 0;
        const lavage = Number(m.lavage) || 0;
        const prixRetour = Number(m.prixRetour) || 0;

        // On évalue les dépenses non remboursées comme dans calculateFinancials
        const isReimbursed = m.fraisRembourses === 'Remboursé' || m.fraisRembourses === 'Oui' || m.fraisRembourses === undefined;
        const nonReimbursedExpenses = lavage + prixRetour + (isReimbursed ? 0 : (carb + peag));
        const netProfit = gain - nonReimbursedExpenses;

        const rentabilite = km > 0 ? (netProfit / km) : 0;

        let ptColor = 'rgba(59, 130, 246, 0.75)'; // Bleu standard (indigo/blue)
        let bdColor = '#3b82f6';

        if (netProfit < 0 || rentabilite < 0.25) {
          ptColor = 'rgba(239, 68, 68, 0.75)'; // Rouge
          bdColor = '#ef4444';
        } else if (rentabilite >= 0.50) {
          ptColor = 'rgba(16, 185, 129, 0.75)'; // Vert
          bdColor = '#10b981';
        }

        scatterPoints.push({
          x: km,
          y: netProfit,
          depart: m.depart || 'Inconnu',
          destination: m.destination || 'Inconnu',
          date: m.date || 'Sans date',
          vehicle: m.vehicle || 'Véhicule inconnu',
          immatriculation: m.immatriculation || 'Non spécifiée',
          plateforme: m.plateforme || 'Autre',
          gain: gain
        });

        pointBackgroundColors.push(ptColor);
        pointBorderColors.push(bdColor);
      });

      const ctx = canvasScatter.getContext('2d');
      this.charts.mileageProfitScatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Missions de convoyage',
            data: scatterPoints,
            backgroundColor: pointBackgroundColors,
            borderColor: pointBorderColors,
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointHoverBorderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false // Légende non requise car on décrit les couleurs en légende HTML stylisée
            },
            tooltip: {
              padding: 12,
              cornerRadius: 10,
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              titleColor: isDarkMode ? '#f1f5f9' : '#0f172a',
              bodyColor: isDarkMode ? '#cbd5e1' : '#334155',
              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
              borderWidth: 1,
              callbacks: {
                title: function(context) {
                  const raw = context[0].raw;
                  return `🧭 Trajet : ${raw.depart} ➔ ${raw.destination}`;
                },
                label: function(context) {
                  const raw = context.raw;
                  const rent = raw.x > 0 ? (raw.y / raw.x) : 0;
                  return [
                    `📅 Date : ${raw.date}`,
                    `🆔 Immatriculation : ${raw.immatriculation}`,
                    `💰 Gain Net : ${raw.y.toFixed(2)} €`,
                    `💵 Gain Brut (CA) : ${raw.gain.toFixed(2)} €`,
                    `🚗 Véhicule : ${raw.vehicle}`,
                    `📱 Plateforme : ${raw.plateforme}`,
                    `📏 Distance : ${raw.x} km`,
                    `📈 Rentabilité : ${rent.toFixed(3)} €/km`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Kilométrage du Trajet (km)',
                color: textColor,
                font: { family: 'Inter', size: 11, weight: 'bold' }
              },
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
            },
            y: {
              title: {
                display: true,
                text: 'Bénéfice Net Estimé (€)',
                color: textColor,
                font: { family: 'Inter', size: 11, weight: 'bold' }
              },
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
            }
          }
        }
      });
    }
  }
};
