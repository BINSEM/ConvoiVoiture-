/**
 * Module de recherche, filtrage et tri du catalogue de missions
 */

export const FiltersService = {
  /**
   * Filtre et trie la liste complète des missions selon les critères saisis
   * @param {Array} missions - Liste brute des missions
   * @param {Object} criteria - Critères actifs { query, dateRange, platform, status, rentability }
   * @param {Object} sortState - État du tri { field, direction } (ex: { field: 'date', direction: 'desc' })
   */
  process(missions, criteria, sortState) {
    let result = [...missions];

    if (!criteria) return result;

    // 1. Recherche instantanée globale (véhicule, imat, départ, destination, plateforme, observations)
    if (criteria.query && criteria.query.trim() !== '') {
      const q = criteria.query.toLowerCase().trim();
      result = result.filter(m => {
        return (
          (m.vehicle && m.vehicle.toLowerCase().includes(q)) ||
          (m.immatriculation && m.immatriculation.toLowerCase().includes(q)) ||
          (m.depart && m.depart.toLowerCase().includes(q)) ||
          (m.destination && m.destination.toLowerCase().includes(q)) ||
          (m.plateforme && m.plateforme.toLowerCase().includes(q)) ||
          (m.observations && m.observations.toLowerCase().includes(q))
        );
      });
    }

    // 1b. Filtre spécifique par immatriculation (saisie semi-automatique)
    if (criteria.immatriculation && criteria.immatriculation.trim() !== '') {
      const targetImmat = criteria.immatriculation.toLowerCase().trim();
      result = result.filter(m => {
        return m.immatriculation && m.immatriculation.toLowerCase().includes(targetImmat);
      });
    }

    // 2. Filtre par date
    const hasDashboardFilter = 
      (criteria.dashboardYear && criteria.dashboardYear !== 'all') ||
      (criteria.dashboardTrimester && criteria.dashboardTrimester !== 'all') ||
      (criteria.dashboardMonth && criteria.dashboardMonth !== 'all');

    if (criteria.dateRange && criteria.dateRange !== 'all' && !hasDashboardFilter) {
      const now = new Date();
      
      const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // ajuster pour lundi
        return new Date(date.setDate(diff));
      };

      result = result.filter(m => {
        if (!m.date) return false;
        const mDate = new Date(m.date);

        if (criteria.dateRange === 'week') {
          // Semaine civile en cours
          const startOfWeek = getStartOfWeek(now);
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 7);
          return mDate >= startOfWeek && mDate < endOfWeek;
        } 
        
        if (criteria.dateRange === 'month') {
          // Mois en cours
          return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
        } 
        
        if (criteria.dateRange === 'prev_month') {
          // Mois dernier
          let prevMonth = now.getMonth() - 1;
          let prevYear = now.getFullYear();
          if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
          }
          return mDate.getMonth() === prevMonth && mDate.getFullYear() === prevYear;
        }

        if (criteria.dateRange === 'year') {
          // Année civile en cours
          return mDate.getFullYear() === now.getFullYear();
        }

        return true;
      });
    }

    // 2b. Filtres Dashboard spécifiques (Année, Trimestre, Mois)
    if (criteria.dashboardYear && criteria.dashboardYear !== 'all') {
      result = result.filter(m => {
        if (!m.date) return false;
        const mDate = new Date(m.date);
        return mDate.getFullYear() === Number(criteria.dashboardYear);
      });
    }

    if (criteria.dashboardTrimester && criteria.dashboardTrimester !== 'all') {
      result = result.filter(m => {
        if (!m.date) return false;
        const mDate = new Date(m.date);
        const month = mDate.getMonth(); // 0-based
        if (criteria.dashboardTrimester === 'q1') return month >= 0 && month <= 2;
        if (criteria.dashboardTrimester === 'q2') return month >= 3 && month <= 5;
        if (criteria.dashboardTrimester === 'q3') return month >= 6 && month <= 8;
        if (criteria.dashboardTrimester === 'q4') return month >= 9 && month <= 11;
        return true;
      });
    }

    if (criteria.dashboardMonth && criteria.dashboardMonth !== 'all') {
      result = result.filter(m => {
        if (!m.date) return false;
        const mDate = new Date(m.date);
        return mDate.getMonth() === Number(criteria.dashboardMonth);
      });
    }

    // 3. Filtre par client / plateforme
    if (criteria.platform && criteria.platform !== 'all') {
      result = result.filter(m => m.plateforme === criteria.platform);
    }

    // 4. Filtre par statut
    if (criteria.status && criteria.status !== 'all') {
      result = result.filter(m => m.statut === criteria.status);
    }

    // 5. Filtre par niveau de rentabilité
    if (criteria.rentability && criteria.rentability !== 'all') {
      result = result.filter(m => {
        const gain = Number(m.gain) || 0;
        const kms = Number(m.kilometrage) || 0;
        const expensesForNet = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
        const netProfit = gain - expensesForNet;
        const rentabilityKm = kms > 0 ? (netProfit / kms) : 0;

        if (criteria.rentability === 'high') {
          return rentabilityKm >= 0.40; // Très rentable (> 0.40€/km)
        } else if (criteria.rentability === 'medium') {
          return rentabilityKm >= 0.15 && rentabilityKm < 0.40; // Rentabilité standard / moyenne
        } else if (criteria.rentability === 'low') {
          return rentabilityKm < 0.15; // Moins de 0.15€/km
        }
        return true;
      });
    }

    // 6. Tri des colonnes (Multi-colonnes ou simple)
    if (sortState) {
      // S'assurer qu'on dispose d'un tableau de critères de tri
      const criteriaList = Array.isArray(sortState)
        ? sortState
        : (sortState.field ? [sortState] : []);

      if (criteriaList.length > 0) {
        result.sort((a, b) => {
          for (const item of criteriaList) {
            const field = item.field;
            const dir = item.direction === 'asc' ? 1 : -1;

            let valA, valB;

            // Associer les clés calculées adaptées au besoin de tri
            if (field === 'beneficeNet') {
              const expA = (Number(a.lavage) || 0) + (Number(a.prixRetour) || 0);
              const expB = (Number(b.lavage) || 0) + (Number(b.prixRetour) || 0);
              valA = (Number(a.gain) || 0) - expA;
              valB = (Number(b.gain) || 0) - expB;
            } else if (field === 'depensesTotales') {
              valA = (Number(a.carburant) || 0) + (Number(a.peage) || 0) + (Number(a.lavage) || 0) + (Number(a.prixRetour) || 0);
              valB = (Number(b.carburant) || 0) + (Number(b.peage) || 0) + (Number(b.lavage) || 0) + (Number(b.prixRetour) || 0);
            } else if (field === 'gain' || field === 'kilometrage') {
              valA = Number(a[field]) || 0;
              valB = Number(b[field]) || 0;
            } else {
              valA = a[field];
              valB = b[field];
            }

            let comparison = 0;
            // Gérer les tris selon les types
            if (typeof valA === 'string' && typeof valB === 'string') {
              comparison = valA.localeCompare(valB, 'fr', { numeric: true }) * dir;
            } else {
              // Nombres ou valeurs non déterminées
              const numA = (valA !== undefined && valA !== null) ? Number(valA) : 0;
              const numB = (valB !== undefined && valB !== null) ? Number(valB) : 0;
              comparison = (isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB);
              comparison = comparison * dir;
            }

            // S'ils ne sont pas égaux pour cette colonne, on retourne le résultat du tri
            if (comparison !== 0) {
              return comparison;
            }
          }
          // Égalité parfaite sur tous les tris spécifiés
          return 0;
        });
      }
    }

    return result;
  },

  /**
   * Extrait la liste dynamique des plateformes présentes pour peupler les listes déroulantes de filtres
   */
  getUniquePlatforms(missions) {
    const list = missions.map(m => m.plateforme).filter(Boolean);
    return [...new Set(list)].sort();
  },

  /**
   * Extrait la liste dynamique des immatriculations présentes
   */
  getUniqueImmatriculations(missions) {
    const list = missions.map(m => m.immatriculation).filter(Boolean);
    return [...new Set(list)].sort();
  }
};
