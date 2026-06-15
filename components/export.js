/**
 * Module d'exportation des données de convoyage (CSV, Excel, Impression PDF)
 */

function getISOWeekString(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Inconnue";
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `Semaine ${weekNo} (${d.getFullYear()})`;
}

function getMonthString(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Inconnu";
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export const ExportService = {
  getColumns() {
    return [
      { id: 'date', label: 'Date' },
      { id: 'vehicle', label: 'Véhicule' },
      { id: 'itinéraire', label: 'Itinéraire' },
      { id: 'statut', label: 'Statut' },
      { id: 'gain', label: 'Gain Brut' },
      { id: 'dépenses', label: 'Dépenses' },
      { id: 'bénéfice', label: 'Bénéfice' },
      { id: 'presta', label: 'Presta' }
    ];
  },

  /**
   * Génère et télécharge un fichier CSV formaté pour le public francophone (délimiteur point-virgule)
   * @param {Array} missions 
   */
  exportToCSV(missions) {
    if (missions.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const headers = [
      "ID", "Date", "Véhicule", "Immatriculation", "Départ", "Destination", 
      "Heure Départ", "Heure Arrivée", "Durée (min)", "Kilométrage (km)", 
      "Plateforme", "Statut", "Gain (€)", "Carburant (€)", "Péage (€)", "Frais Remboursés",
      "Lavage (€)", "Type Transports", "Prix Transports (€)", "Dépenses Totales (€)", 
      "Bénéfice Net (€)", "Rentabilité (€/km)", "Observations", "Incidents/Retards"
    ];

    const rows = missions.map(m => {
      const exp = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const depensesNonRemboursees = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const net = (Number(m.gain) || 0) - depensesNonRemboursees;
      const rent = m.kilometrage > 0 ? (net / m.kilometrage).toFixed(3) : "0";

      return [
        m.id,
        m.date,
        `"${(m.vehicle || '').replace(/"/g, '""')}"`,
        m.immatriculation,
        `"${(m.depart || '').replace(/"/g, '""')}"`,
        `"${(m.destination || '').replace(/"/g, '""')}"`,
        m.heureDepart || '',
        m.heureArrivee || '',
        m.dureeTrajet || 0,
        m.kilometrage || 0,
        m.plateforme || '',
        m.statut || '',
        m.gain || 0,
        m.carburant || 0,
        m.peage || 0,
        m.fraisRembourses || "En attente",
        m.lavage || 0,
        m.transportRetour || '',
        m.prixRetour || 0,
        exp.toFixed(2),
        net.toFixed(2),
        rent,
        `"${(m.observations || '').replace(/"/g, '""')}"`,
        `"${(m.incidents || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\ufeff" + // BOM pour forcer Excel à lire l'UTF-8 correctement
      [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `missions_convoyage_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Génère et télécharge un bilan CSV groupé par semaine (ISO)
   * @param {Array} missions 
   */
  exportToCSVWeekly(missions) {
    if (missions.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const groups = {};
    missions.forEach(m => {
      const weekStr = getISOWeekString(m.date);
      if (!groups[weekStr]) groups[weekStr] = [];
      groups[weekStr].push(m);
    });

    const sortedWeeks = Object.keys(groups).sort().reverse();

    const headers = [
      "Semaine", "Nombre de Missions", "Distance Totale (km)", "Gain Brut (€)", 
      "Carburant (€)", "Péage (€)", "Lavage (€)", "Transports (€)", 
      "Dépenses Totales (€)", "Bénéfice Net (€)", "Rendement Moyen (€/km)"
    ];

    const rows = sortedWeeks.map(week => {
      const list = groups[week];
      const count = list.length;
      let totalKm = 0;
      let totalGain = 0;
      let totalCarb = 0;
      let totalPeage = 0;
      let totalLavage = 0;
      let totalRetour = 0;

      list.forEach(m => {
        totalKm += Number(m.kilometrage) || 0;
        totalGain += Number(m.gain) || 0;
        totalCarb += Number(m.carburant) || 0;
        totalPeage += Number(m.peage) || 0;
        totalLavage += Number(m.lavage) || 0;
        totalRetour += Number(m.prixRetour) || 0;
      });

      const totalExp = totalCarb + totalPeage + totalLavage + totalRetour;
      const depensesNonRemboursees = totalLavage + totalRetour;
      const net = totalGain - depensesNonRemboursees;
      const rent = totalKm > 0 ? (net / totalKm).toFixed(3) : "0.000";

      return [
        week,
        count,
        totalKm,
        totalGain.toFixed(2),
        totalCarb.toFixed(2),
        totalPeage.toFixed(2),
        totalLavage.toFixed(2),
        totalRetour.toFixed(2),
        totalExp.toFixed(2),
        net.toFixed(2),
        rent
      ];
    });

    const csvContent = "\ufeff" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bilan_hebdomadaire_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Génère et télécharge un bilan CSV groupé par mois
   * @param {Array} missions 
   */
  exportToCSVMonthly(missions) {
    if (missions.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const groups = {};
    missions.forEach(m => {
      const monthStr = getMonthString(m.date);
      if (!groups[monthStr]) groups[monthStr] = [];
      groups[monthStr].push(m);
    });

    const sortedMonths = Object.keys(groups).sort((a, b) => {
      const parseFullMonth = (str) => {
        const parts = str.split(' ');
        const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
        const mIdx = monthNames.indexOf(parts[0].toLowerCase());
        const year = parseInt(parts[1]) || 2026;
        return new Date(year, mIdx >= 0 ? mIdx : 0, 1);
      };
      return parseFullMonth(b) - parseFullMonth(a);
    });

    const headers = [
      "Mois", "Nombre de Missions", "Distance Totale (km)", "Gain Brut (€)", 
      "Carburant (€)", "Péage (€)", "Lavage (€)", "Transports (€)", 
      "Dépenses Totales (€)", "Bénéfice Net (€)", "Rendement Moyen (€/km)"
    ];

    const rows = sortedMonths.map(month => {
      const list = groups[month];
      const count = list.length;
      let totalKm = 0;
      let totalGain = 0;
      let totalCarb = 0;
      let totalPeage = 0;
      let totalLavage = 0;
      let totalRetour = 0;

      list.forEach(m => {
        totalKm += Number(m.kilometrage) || 0;
        totalGain += Number(m.gain) || 0;
        totalCarb += Number(m.carburant) || 0;
        totalPeage += Number(m.peage) || 0;
        totalLavage += Number(m.lavage) || 0;
        totalRetour += Number(m.prixRetour) || 0;
      });

      const totalExp = totalCarb + totalPeage + totalLavage + totalRetour;
      const depensesNonRemboursees = totalLavage + totalRetour;
      const net = totalGain - depensesNonRemboursees;
      const rent = totalKm > 0 ? (net / totalKm).toFixed(3) : "0.000";

      return [
        month,
        count,
        totalKm,
        totalGain.toFixed(2),
        totalCarb.toFixed(2),
        totalPeage.toFixed(2),
        totalLavage.toFixed(2),
        totalRetour.toFixed(2),
        totalExp.toFixed(2),
        net.toFixed(2),
        rent
      ];
    });

    const csvContent = "\ufeff" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bilan_mensuel_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Génère et télécharge un fichier Excel (XLSX) en chargeant SheetJS de façon asynchrone ou en utilisant l'utilitaire global
   * En cas d'indisponibilité, redirige vers l'export CSV.
   * @param {Array} missions 
   */
  exportToExcel(missions) {
    if (typeof XLSX === 'undefined') {
      console.warn("SheetJS n'est pas disponible, repli sur l'export CSV.");
      this.exportToCSV(missions);
      return;
    }

    const data = missions.map(m => {
      const exp = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const depensesNonRemboursees = (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const net = (Number(m.gain) || 0) - depensesNonRemboursees;
      const rent = m.kilometrage > 0 ? (net / m.kilometrage) : 0;

      return {
        "ID": m.id,
        "Date": m.date,
        "Véhicule": m.vehicle,
        "Immatriculation": m.immatriculation,
        "Départ": m.depart,
        "Destination": m.destination,
        "Départ Heure": m.heureDepart,
        "Arrivée Heure": m.heureArrivee,
        "Durée (min)": m.dureeTrajet,
        "Kilométrage (km)": m.kilometrage,
        "Plateforme / Client": m.plateforme,
        "Statut": m.statut,
        "Gain Brut (€)": Number(m.gain) || 0,
        "Carburant (€)": Number(m.carburant) || 0,
        "Péage (€)": Number(m.peage) || 0,
        "Frais Remboursés": m.fraisRembourses || "En attente",
        "Lavage (€)": Number(m.lavage) || 0,
        "Type Retour": m.transportRetour,
        "Prix Retour (€)": Number(m.prixRetour) || 0,
        "Dépenses Totales (€)": Number(exp.toFixed(2)),
        "Bénéfice Net (€)": Number(net.toFixed(2)),
        "Rentabilité (€/km)": Number(rent.toFixed(3)),
        "Observations": m.observations || '',
        "Incidents / Retards": m.incidents || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Missions");

    // Ajuster la largeur des colonnes
    const max_len = 15;
    worksheet["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: max_len }));

    XLSX.writeFile(workbook, `convoyeur_finances_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  /**
   * Imprime un rapport d'activité mensuel, trimestriel ou annuel parfaitement stylisé
   * @param {Array} missions 
   * @param {Object} stats
   * @param {Object} settings
   * @param {string} groupingType 'none' | 'monthly' | 'trimester' | 'yearly'
   */
  /**
   * Imprime un rapport d'activité mensuel, trimestriel ou annuel parfaitement stylisé
   * @param {Array} missions 
   * @param {Object} stats
   * @param {Object} settings
   * @param {string} groupingType 'none' | 'monthly' | 'trimester' | 'yearly'
   * @param {Array} selectedColumns - Liste des IDs des colonnes à inclure (ex: ['date', 'vehicle'])
   */
  printReport(missions, stats, settings, groupingType = 'none', selectedColumns = null) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres pop-up pour imprimer le bilan.");
      return;
    }

    // Définition des colonnes disponibles et leur label
    const allColumns = [
      { id: 'date', label: 'Date', width: '10%' },
      { id: 'vehicle', label: 'Véhicule', width: '20%' },
      { id: 'itinéraire', label: 'Itinéraire', width: '30%' },
      { id: 'statut', label: 'Statut', width: '10%' },
      { id: 'gain', label: 'Gain Brut', width: '10%', align: 'text-right' },
      { id: 'dépenses', label: 'Dépenses', width: '10%', align: 'text-right' },
      { id: 'bénéfice', label: 'Bénéfice', width: '10%', align: 'text-right' },
      { id: 'presta', label: 'Presta', width: '10%' }
    ];

    // Filtrer les colonnes si une sélection est fournie
    const columns = selectedColumns ? allColumns.filter(c => selectedColumns.includes(c.id)) : allColumns;

    // Helper pour générer les cellules d'une ligne
    const generateCells = (m, depenses, benef) => {
      return columns.map(c => {
        let content = '';
        switch (c.id) {
          case 'date': content = new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); break;
          case 'vehicle': content = `<strong>${m.vehicle}</strong> <br><span class="text-xs text-gray-500">${m.immatriculation}</span>`; break;
          case 'itinéraire': content = `${m.depart} ➔ ${m.destination}`; break;
          case 'statut': content = `<span class="badge ${m.statut.toLowerCase() === 'payée' ? 'badge-success' : m.statut.toLowerCase() === 'validée' ? 'badge-info' : 'badge-warn'}">${m.statut}</span>`; break;
          case 'gain': content = `<span class="text-right">${Number(m.gain).toFixed(2)} €</span>`; break;
          case 'dépenses': content = `<span class="text-right text-red">${depenses.toFixed(2)} €</span>`; break;
          case 'bénéfice': content = `<span class="text-right text-green"><strong>${benef.toFixed(2)} €</strong></span>`; break;
          case 'presta': content = `<span class="text-xs">${m.plateforme}</span>`; break;
        }
        return `<td ${c.align ? `class="${c.align}"` : ''}>${content}</td>`;
      }).join("");
    };

    const todayStr = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const urssafRate = settings ? settings.urssafRate : 23;

    // Trier les missions par date décroissante
    const sortedMissions = [...missions].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Détermination du sous-titre du rapport d'activité
    let titleAddon = "D'ACTIVITÉ";
    if (groupingType === 'monthly') titleAddon = "MENSUEL DE CONVOYAGE";
    else if (groupingType === 'trimester') titleAddon = "TRIMESTRIEL DE CONVOYAGE";
    else if (groupingType === 'yearly') titleAddon = "ANNUEL DE CONVOYAGE";

    // Helper pour grouper
    const getGroupKeyAndLabel = (dateString, type) => {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) {
        return { key: "unknown", label: "Inconnu", sortVal: 0 };
      }
      const year = d.getFullYear();
      const month = d.getMonth();
      
      if (type === 'monthly') {
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        return {
          key: `${year}-${String(month + 1).padStart(2, '0')}`,
          label: `${monthNames[month]} ${year}`,
          sortVal: year * 12 + month
        };
      } else if (type === 'trimester') {
        const q = Math.floor(month / 3) + 1;
        const qLabel = q === 1 ? "1er Trimestre" : `${q}ème Trimestre`;
        return {
          key: `${year}-Q${q}`,
          label: `${qLabel} ${year}`,
          sortVal: year * 4 + q
        };
      } else if (type === 'yearly') {
        return {
          key: `${year}`,
          label: `Année ${year}`,
          sortVal: year
        };
      }
      
      return { key: "all", label: "Toutes les missions", sortVal: 1 };
    };

    let contentHtml = "";

    if (groupingType && groupingType !== 'none') {
      const groups = {};
      sortedMissions.forEach(m => {
        const info = getGroupKeyAndLabel(m.date, groupingType);
        if (!groups[info.key]) {
          groups[info.key] = {
            label: info.label,
            sortVal: info.sortVal,
            missions: []
          };
        }
        groups[info.key].missions.push(m);
      });

      // Trier les groupes par valeur de tri décroissante
      const sortedKeys = Object.keys(groups).sort((a, b) => groups[b].sortVal - groups[a].sortVal);

      contentHtml = sortedKeys.map(key => {
        const group = groups[key];
        let totalGroupGain = 0;
        let totalGroupExpenses = 0;
        let totalGroupNet = 0;

        const groupRows = group.missions.map(m => {
          const depenses = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
          const benef = (Number(m.gain) || 0) - depenses;

          totalGroupGain += (Number(m.gain) || 0);
          totalGroupExpenses += depenses;
          totalGroupNet += benef;

          return `
            <tr>
              ${generateCells(m, depenses, benef)}
            </tr>
          `;
        }).join("");

        return `
          <div class="group-container" style="margin-top: 25px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f1f5f9; padding: 10px 15px; border-radius: 8px; border-left: 5px solid #1e3a8a; margin-bottom: 12px;">
              <span style="font-size: 14px; font-weight: bold; color: #1e3a8a;">${group.label}</span>
              <span style="font-size: 11px; color: #4b5563; font-weight: bold;">
                Missions : ${group.missions.length} | 
                CA : ${totalGroupGain.toFixed(2)} € | 
                Dépenses : <span style="color:#dc2626">${totalGroupExpenses.toFixed(2)} €</span> | 
                Net : <span style="color:#16a34a">${totalGroupNet.toFixed(2)} €</span>
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  ${columns.map(c => `<th width="${c.width}">${c.label}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${groupRows}
              </tbody>
            </table>
          </div>
        `;
      }).join("");

    } else {
      const tableRows = sortedMissions.map(m => {
        const depenses = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
        const benef = (Number(m.gain) || 0) - depenses;
        return `
          <tr>
            ${generateCells(m, depenses, benef)}
          </tr>
        `;
      }).join("");

      contentHtml = `
        <table style="margin-top: 15px;">
          <thead>
            <tr>
              ${columns.map(c => `<th width="${c.width}">${c.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Bilan Financier Convoyeur - ${settings.nom}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111827;
            background-color: #fff;
            margin: 0;
            padding: 30px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .company-info h1 {
            color: #1e3a8a;
            font-size: 22px;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .company-info p {
            margin: 2px 0;
            color: #4b5563;
          }
          .report-info {
            text-align: right;
          }
          .report-info h2 {
            font-size: 16px;
            margin: 0 0 5px 0;
            color: #1e3a8a;
          }
          .report-info p {
            margin: 2px 0;
            color: #4b5563;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 30px;
          }
          .stat-card {
            border: 1px solid #e5e7eb;
            background-color: #f9fafb;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
          }
          .stat-card .label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .stat-card .value {
            font-size: 16px;
            font-weight: bold;
            color: #111827;
          }
          .stat-card.primary {
            border-color: #1e3a8a;
            background-color: #eff6ff;
          }
          .stat-card.primary .value {
            color: #1e3a8a;
          }
          .stat-card.success {
            border-color: #16a34a;
            background-color: #f0fdf4;
          }
          .stat-card.success .value {
            color: #16a34a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 12px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 8px 10px;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .text-right {
            text-align: right;
          }
          .text-green {
            color: #16a34a;
          }
          .text-red {
            color: #dc2626;
          }
          .text-xs {
            font-size: 10px;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .badge-success { background-color: #dcfce7; color: #15803d; }
          .badge-info { background-color: #dbeafe; color: #1d4ed8; }
          .badge-warn { background-color: #fef3c7; color: #b45309; }
          .footer {
            margin-top: 50px;
            border-top: 1px dashed #cccccc;
            padding-top: 15px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${settings.nom}</h1>
            <p>${settings.statutEntreprise}</p>
            <p>Siret: (À renseigner dans les paramètres)</p>
            <p>Email: ${window.localStorage.getItem('currentUserEmail') || 'convoyeur@gmail.com'}</p>
          </div>
          <div class="report-info">
            <h2>BILAN COMPTABLE ${titleAddon}</h2>
            <p>Date d'édition : ${todayStr}</p>
            <p>Missions éditées : <strong>${stats.totalMissions}</strong></p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Revenus Bruts (CA)</div>
            <div class="value">${stats.totalRevenusBruts.toFixed(2)} €</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Dépenses</div>
            <div class="value text-red">${stats.totalExpenses.toFixed(2)} €</div>
          </div>
          <div class="stat-card primary">
            <div class="label">Bénéfice Commercial</div>
            <div class="value">${stats.beneficeNet.toFixed(2)} €</div>
          </div>
          <div class="stat-card success">
            <div class="label">Bénéfice Après URSSAF (${urssafRate}%)</div>
            <div class="value">${stats.beneficeNetReel.toFixed(2)} €</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">Charges URSSAF cumulées</div>
            <div class="value text-red">${stats.chargesUrssaf.toFixed(2)} €</div>
          </div>
          <div class="stat-card">
            <div class="label">Rentabilité Moyenne</div>
            <div class="value">${stats.rentabiliteKm.toFixed(3)} € / km</div>
          </div>
          <div class="stat-card">
            <div class="label">Coût Moyen Transports</div>
            <div class="value">${stats.coutMoyenRetour.toFixed(2)} €</div>
          </div>
          <div class="stat-card">
            <div class="label">Distance Totale</div>
            <div class="value">${stats.totalKilometrage} km</div>
          </div>
        </div>

        <h3 style="color: #1e3a8a; margin-top:30px; border-bottom: 1px solid #e5e7eb; padding-bottom:5px;">LISTE RECAPITULATIVE DES MISSIONS</h3>
        
        ${contentHtml}

        <div style="margin-top:20px; text-align:right; font-size:12px;">
          <p><strong>Total des cotisations URSSAF dues estimées : ${stats.chargesUrssaf.toFixed(2)} €</strong></p>
          <p><em>Rappel réglementaire : Ce document fait office de relevé de recettes pour l'auto-entreprise. Il doit être conservé pendant 10 ans.</em></p>
        </div>

        <div class="footer">
          Document généré automatiquement depuis l'application de Gestion de Convoyage Automobile.<br>
          Aucune signature requise de manière électronique.
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    
    // Attendre que la page se dessine pour lancer l'impression
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  }
};
