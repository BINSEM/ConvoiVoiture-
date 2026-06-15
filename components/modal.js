/**
 * Module d'interaction pour les fenêtres surgissantes (modals popups)
 * Gère l'affichage, le pré-remplissage et la validation en temps réel du formulaire de mission.
 */

import { StorageService } from './storage.js';

export const ModalService = {
  activeMissionId: null,

  cityCoordinates: {
    'Paris': [48.8566, 2.3522],
    'Lyon': [45.7640, 4.8357],
    'Marseille': [43.2965, 5.3698],
    'Nice': [43.7102, 7.2620],
    'Lille': [50.6292, 3.0573],
    'Strasbourg': [48.5734, 7.7521],
    'Bordeaux': [44.8378, -0.5792],
    'Toulouse': [43.6047, 1.4442],
    'Nantes': [47.2184, -1.5536],
    'Genève': [46.2044, 6.1432],
    'Montpellier': [43.6108, 3.8767],
    'Rennes': [48.1173, -1.6778],
    'Reims': [49.2583, 4.0317],
    'Saint-Étienne': [45.4397, 4.3872],
    'Toulon': [43.1242, 5.9280],
    'Le Havre': [49.4944, 0.1079],
    'Grenoble': [45.1885, 5.7245],
    'Dijon': [47.3220, 5.0415],
    'Angers': [47.4784, -0.5632],
    'Nîmes': [43.8367, 4.3601],
    'Villeurbanne': [45.7719, 4.8787],
    'Mulhouse': [47.7458, 7.3389],
    'Caen': [49.1829, -0.3707],
    'Nancy': [48.6921, 6.1844],
    'Brest': [48.3904, -4.4860],
    'Le Mans': [48.0061, 0.1996],
    'Amiens': [49.8941, 2.2957],
    'Limoges': [45.8354, 1.2501],
    'Tours': [47.3941, 0.6848],
    'Clermont-Ferrand': [45.7772, 3.0870],
    'Besançon': [47.2378, 6.0241],
    'Orléans': [47.9030, 1.9090],
    'Metz': [49.1193, 6.1757],
    'Rouen': [49.4431, 1.0993],
    'Perpignan': [42.6986, 2.8956]
  },

  calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  async geocodeCity(cityName) {
    if (!cityName) return null;
    
    // Nettoyer le nom de la ville (ex: "Paris (75)" -> "Paris")
    const cleaned = cityName.replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
    if (!cleaned) return null;

    // Vérifier notre dictionnaire local pour de l'instantané hors-ligne
    const lower = cleaned.toLowerCase();
    for (const [key, coords] of Object.entries(this.cityCoordinates)) {
      if (key.toLowerCase() === lower || lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) {
        return { name: key, lat: coords[0], lon: coords[1] };
      }
    }

    // Sinon, requête API publique Nominatim OpenStreetMap
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned + ', France')}&limit=1`, {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'fr'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return {
            name: data[0].display_name.split(',')[0],
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
          };
        }
      }
    } catch (e) {
      console.warn("Geocoding failed for:", cleaned, e);
    }
    
    return null;
  },

  async triggerGeoEstimation() {
    const inputDepart = document.getElementById('m_depart');
    const inputDestination = document.getElementById('m_destination');
    const inputKilometrage = document.getElementById('m_kilometrage');
    const geoBanner = document.getElementById('m_geo_estimation');
    const geoText = document.getElementById('m_geo_estimation_text');

    if (!inputDepart || !inputDestination) return;

    const depVal = inputDepart.value.trim();
    const destVal = inputDestination.value.trim();

    if (!depVal || !destVal) {
      if (geoBanner) geoBanner.classList.add('hidden');
      return;
    }

    if (geoBanner && geoText) {
      geoBanner.classList.remove('hidden');
      geoBanner.classList.add('flex');
      geoText.innerHTML = `<span class="text-slate-400 italic">Recherche géolocalisée en cours...</span>`;
    }

    try {
      const pt1 = await this.geocodeCity(depVal);
      const pt2 = await this.geocodeCity(destVal);

      if (pt1 && pt2) {
        const directDist = this.calculateHaversine(pt1.lat, pt1.lon, pt2.lat, pt2.lon);
        const roadDist = Math.round(directDist * 1.22);
        
        const decimalHours = roadDist / 85;
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        const durationStr = `${hours}h${minutes.toString().padStart(2, '0')}`;

        if (inputKilometrage) {
          // Mettre à jour uniquement si nécessaire pour ne pas bloquer la saisie personnalisée
          if (!inputKilometrage.value || Math.abs(Number(inputKilometrage.value) - roadDist) > 30 || inputKilometrage.dataset.autoFilled === 'true') {
            inputKilometrage.value = roadDist;
            inputKilometrage.dataset.autoFilled = 'true';
            inputKilometrage.dispatchEvent(new Event('input'));
          }
        }

        // Auto-remplir l'heure d'arrivée estimée
        const inputHeureDepart = document.getElementById('m_heureDepart');
        const inputHeureArrivee = document.getElementById('m_heureArrivee');
        if (inputHeureDepart && inputHeureDepart.value && inputHeureArrivee && !inputHeureArrivee.value) {
          const [h, m] = inputHeureDepart.value.split(':').map(Number);
          const totalMinutes = h * 60 + m + Math.round(decimalHours * 60);
          const endHour = Math.floor(totalMinutes / 60) % 24;
          const endMin = totalMinutes % 60;
          inputHeureArrivee.value = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
          inputHeureArrivee.dispatchEvent(new Event('change'));
        }

        if (geoText) {
          geoText.innerHTML = `
            <span>📍 Calculé auto. (D3.Geo) de <strong>${pt1.name}</strong> à <strong>${pt2.name}</strong> : 
            <strong class="text-emerald-600 dark:text-emerald-400 font-mono font-black">${roadDist} km</strong> (~ 
            <strong class="text-emerald-600 dark:text-emerald-400 font-mono font-black">${durationStr}</strong>)</span>
          `;
        }
      } else {
        if (geoText) {
          geoText.innerHTML = `<span class="text-amber-500 font-bold">⚠️ Villes non reconnues pour l'auto-recherche. Utilisez le calcul manuel.</span>`;
        }
      }
    } catch (err) {
      console.error(err);
      if (geoText) {
        geoText.innerHTML = `<span class="text-rose-500">❌ Erreur lors de l'estimation de l'itinéraire.</span>`;
      }
    }
  },

  /**
   * Initialise les écouteurs de calculs automatiques sur le formulaire de mission
   */
  initFormCalculations() {
    const inputGain = document.getElementById('m_gain');
    const inputCarburant = document.getElementById('m_carburant');
    const inputPeage = document.getElementById('m_peage');
    const inputLavage = document.getElementById('m_lavage');
    const inputPrixRetour = document.getElementById('m_prixRetour');
    const inputKilometrage = document.getElementById('m_kilometrage');
    const helperCarburant = document.getElementById('m_carburant_helper');

    const totalExpBadge = document.getElementById('calc_total_expenses');
    const netProfitBadge = document.getElementById('calc_net_profit');

    const settings = StorageService.loadSettings();
    const defaultFuelPrice = settings.defaultFuelPrice !== undefined ? settings.defaultFuelPrice : 1.85;
    const averageConsumption = settings.averageConsumption !== undefined ? settings.averageConsumption : 6.5;

    // Mettre à jour le texte d'aide du carburant avec les paramètres configurés
    if (helperCarburant) {
      helperCarburant.innerText = `Auto-calcul : ${averageConsumption} L/100 @ ${defaultFuelPrice.toFixed(2)} €/L`;
    }

    const calculateRealTime = () => {
      const gain = Number(inputGain.value) || 0;
      const carb = Number(inputCarburant.value) || 0;
      const peage = Number(inputPeage.value) || 0;
      const lavage = Number(inputLavage.value) || 0;
      const retour = Number(inputPrixRetour.value) || 0;

      const totalExpenses = carb + peage + lavage + retour;
      const nonReimbursed = lavage + retour;
      const netProfit = gain - nonReimbursed;

      if (totalExpBadge) {
        totalExpBadge.innerText = totalExpenses.toFixed(2) + ' €';
      }
      if (netProfitBadge) {
        netProfitBadge.innerText = netProfit.toFixed(2) + ' €';
        // Ajuster la couleur en fonction du bénéfice
        if (netProfit > 0) {
          netProfitBadge.className = 'font-bold text-emerald-600 dark:text-emerald-400';
        } else if (netProfit < 0) {
          netProfitBadge.className = 'font-bold text-rose-600 dark:text-rose-400';
        } else {
          netProfitBadge.className = 'font-bold text-gray-600 dark:text-gray-400';
        }
      }
    };

    // Calcul automatique du coût de carburant estimé basé sur la distance (m_kilometrage)
    if (inputKilometrage) {
      inputKilometrage.oninput = () => {
        const km = Number(inputKilometrage.value) || 0;
        const estFuel = (km / 100) * averageConsumption * defaultFuelPrice;
        if (inputCarburant) {
          inputCarburant.value = estFuel > 0 ? estFuel.toFixed(2) : '';
        }
        calculateRealTime();
      };
    }

    const inputs = [inputGain, inputCarburant, inputPeage, inputLavage, inputPrixRetour];
    inputs.forEach(input => {
      if (input) {
        // Enregistrer l'ancien oninput ou écouter si c'est l'input carburant
        const existingOninput = input.oninput;
        input.oninput = (e) => {
          if (existingOninput) existingOninput(e);
          calculateRealTime();
        };
      }
    });

    // Écouteurs pour la géolocalisation automatique de l'itinéraire et de la distance
    const inputDepart = document.getElementById('m_depart');
    const inputDestination = document.getElementById('m_destination');
    const inputHeureDepart = document.getElementById('m_heureDepart');

    if (inputDepart && inputDestination) {
      let geoTimeout;
      const debouncedGeo = () => {
        clearTimeout(geoTimeout);
        geoTimeout = setTimeout(() => this.triggerGeoEstimation(), 600);
      };

      inputDepart.addEventListener('input', debouncedGeo);
      inputDestination.addEventListener('input', debouncedGeo);
      
      inputDepart.addEventListener('change', () => this.triggerGeoEstimation());
      inputDestination.addEventListener('change', () => this.triggerGeoEstimation());
      
      inputDepart.addEventListener('blur', () => this.triggerGeoEstimation());
      inputDestination.addEventListener('blur', () => this.triggerGeoEstimation());

      if (inputHeureDepart) {
        inputHeureDepart.addEventListener('change', () => this.triggerGeoEstimation());
      }
    }

    // Calculer une première fois
    calculateRealTime();
    this.triggerGeoEstimation();
  },

  /**
   * Ouvre la modal d'ajout de mission
   */
  openAddModal() {
    this.activeMissionId = null;
    const form = document.getElementById('missionForm');
    if (form) form.reset();

    const title = document.getElementById('modalTitle');
    if (title) title.innerText = 'Ajouter une Mission de Convoyage';

    // Renseigner la date du jour par défaut
    const inputDate = document.getElementById('m_date');
    if (inputDate) {
      inputDate.value = new Date().toISOString().slice(0, 10);
    }

    const modal = document.getElementById('missionModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    this.initFormCalculations();
  },

  /**
   * Ouvre la modal de modification en pré-remplissant les valeurs
   * @param {Object} m - Données de la mission
   */
  openEditModal(m) {
    this.activeMissionId = m.id;
    const form = document.getElementById('missionForm');
    if (!form) return;

    // Remplir les champs
    document.getElementById('m_date').value = m.date || '';
    document.getElementById('m_vehicle').value = m.vehicle || '';
    document.getElementById('m_immatriculation').value = m.immatriculation || '';
    document.getElementById('m_depart').value = m.depart || '';
    document.getElementById('m_destination').value = m.destination || '';
    document.getElementById('m_heureDepart').value = m.heureDepart || '';
    document.getElementById('m_heureArrivee').value = m.heureArrivee || '';
    document.getElementById('m_kilometrage').value = m.kilometrage || '';
    document.getElementById('m_plateforme').value = m.plateforme || 'Otoqi';
    document.getElementById('m_statut').value = m.statut || 'En attente';
    document.getElementById('m_gain').value = m.gain || '';
    document.getElementById('m_carburant').value = m.carburant || '';
    document.getElementById('m_peage').value = m.peage || '';
    document.getElementById('m_fraisRembourses').value = m.fraisRembourses || 'En attente';
    document.getElementById('m_lavage').value = m.lavage || '';
    let transportVal1 = m.transportRetour || '';
    const lowerTransport1 = transportVal1.toLowerCase();
    if (lowerTransport1.includes('train') || lowerTransport1.includes('ter') || lowerTransport1.includes('tgv') || lowerTransport1.includes('sncf')) {
      transportVal1 = 'Train';
    } else if (lowerTransport1.includes('covoit') || lowerTransport1.includes('blabla')) {
      transportVal1 = 'Covoiturage';
    } else if (lowerTransport1.includes('bus') || lowerTransport1.includes('flix') || lowerTransport1.includes('car ')) {
      transportVal1 = 'Bus';
    } else if (lowerTransport1.includes('avion') || lowerTransport1.includes('plane') || lowerTransport1.includes('flight') || lowerTransport1.includes('air')) {
      transportVal1 = 'Avion';
    } else if (transportVal1) {
      transportVal1 = 'Autre';
    } else {
      transportVal1 = 'Train';
    }
    document.getElementById('m_transportRetour').value = transportVal1;
    document.getElementById('m_prixRetour').value = m.prixRetour || '';
    document.getElementById('m_observations').value = m.observations || '';
    document.getElementById('m_incidents').value = m.incidents || '';
    document.getElementById('m_privateNotes').value = m.privateNotes || '';

    const title = document.getElementById('modalTitle');
    if (title) title.innerText = `Modifier la Mission - ${m.immatriculation}`;

    const modal = document.getElementById('missionModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    this.initFormCalculations();
  },

  /**
   * Ouvre la modal en mode "duplication d'itinéraire"
   * Pratique pour renouveler le même trajet, en réinitialisant la date au jour d'aujourd'hui
   * @param {Object} m 
   */
  openDuplicateModal(m) {
    this.activeMissionId = null; // Nouvelle mission
    const form = document.getElementById('missionForm');
    if (!form) return;

    // Remplir les champs duplicables, mais avec la date du jour
    document.getElementById('m_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('m_vehicle').value = m.vehicle || '';
    document.getElementById('m_immatriculation').value = ''; // Nouvelle immat éventuelle
    document.getElementById('m_depart').value = m.depart || '';
    document.getElementById('m_destination').value = m.destination || '';
    document.getElementById('m_heureDepart').value = m.heureDepart || '';
    document.getElementById('m_heureArrivee').value = m.heureArrivee || '';
    document.getElementById('m_kilometrage').value = m.kilometrage || '';
    document.getElementById('m_plateforme').value = m.plateforme || 'Otoqi';
    document.getElementById('m_statut').value = 'En attente'; // Nouveau statut
    document.getElementById('m_gain').value = m.gain || '';
    document.getElementById('m_carburant').value = m.carburant || '';
    document.getElementById('m_peage').value = m.peage || '';
    document.getElementById('m_fraisRembourses').value = 'En attente'; // Toujours 'En attente' pour un doublon
    document.getElementById('m_lavage').value = m.lavage || '';
    let transportVal2 = m.transportRetour || '';
    const lowerTransport2 = transportVal2.toLowerCase();
    if (lowerTransport2.includes('train') || lowerTransport2.includes('ter') || lowerTransport2.includes('tgv') || lowerTransport2.includes('sncf')) {
      transportVal2 = 'Train';
    } else if (lowerTransport2.includes('covoit') || lowerTransport2.includes('blabla')) {
      transportVal2 = 'Covoiturage';
    } else if (lowerTransport2.includes('bus') || lowerTransport2.includes('flix') || lowerTransport2.includes('car ')) {
      transportVal2 = 'Bus';
    } else if (lowerTransport2.includes('avion') || lowerTransport2.includes('plane') || lowerTransport2.includes('flight') || lowerTransport2.includes('air')) {
      transportVal2 = 'Avion';
    } else if (transportVal2) {
      transportVal2 = 'Autre';
    } else {
      transportVal2 = 'Train';
    }
    document.getElementById('m_transportRetour').value = transportVal2;
    document.getElementById('m_prixRetour').value = m.prixRetour || '';
    document.getElementById('m_observations').value = `Dupliqué du trajet d'origine du ${m.date}.`;
    document.getElementById('m_incidents').value = '';
    document.getElementById('m_privateNotes').value = '';

    const title = document.getElementById('modalTitle');
    if (title) title.innerText = `Dupliquer le trajet : ${m.depart} ➔ ${m.destination}`;

    const modal = document.getElementById('missionModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    this.initFormCalculations();
  },

  /**
   * Ferme la modal active
   */
  closeModal() {
    const modal = document.getElementById('missionModal');
    if (modal) {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }
    this.activeMissionId = null;
  },

  /**
   * Ouvre une popup de confirmation de suppression
   * @param {string} vehicleModel 
   * @param {function} onConfirm 
   * @param {string|null} customDesc
   */
  confirmDelete(vehicleModel, onConfirm, customDesc = null) {
    const confirmModal = document.getElementById('confirmDeleteModal');
    if (!confirmModal) {
      const msg = customDesc || `Êtes-vous sûr de vouloir supprimer la mission pour le véhicule "${vehicleModel}"?`;
      if (confirm(msg)) {
        onConfirm();
      }
      return;
    }

    const cancelBtn = document.getElementById('btnCancelDelete');
    const confirmBtn = document.getElementById('btnConfirmDelete');
    const desc = document.getElementById('deleteModalDesc');

    if (desc) {
      desc.innerText = customDesc || `Cette action est irréversible. La mission pour le véhicule "${vehicleModel}" sera définitivement effacée.`;
    }

    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');

    const cleanUp = () => {
      confirmModal.classList.remove('flex');
      confirmModal.classList.add('hidden');
      // Enlever les clones pour éviter d'empiler les listeners
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    };

    document.getElementById('btnCancelDelete').addEventListener('click', cleanUp);
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
      onConfirm();
      cleanUp();
    });
  }
};

window.ModalService = ModalService;

