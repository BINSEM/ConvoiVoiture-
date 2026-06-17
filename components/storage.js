/**
 * Module de gestion du stockage local (localStorage)
 * Permet de sauvegarder, charger et réinitialiser les missions et les paramètres.
 */

const STORAGE_KEYS = {
  MISSIONS: 'convoyage_missions',
  SETTINGS: 'convoyage_settings',
  THEME: 'convoyage_theme'
};

const DEFAULT_SETTINGS = {
  nom: 'BINIAM Semere',
  statutEntreprise: 'Auto-Entrepreneur Convoyeur',
  urssafRate: 23, // Taux de cotisation URSSAF par défaut (23%)
  urssafAutoCalc: false,
  urssafActivityType: 'service_commercial',
  urssafAcre: 'no',
  urssafvl: false,
  urssafCfp: false,
  carburantMoyenLittre: 1.85, 
  currency: 'EUR',
  activeView: 'dashboard',
  defaultFuelPrice: 1.85,
  averageConsumption: 6.5,
  usureKilometrique: 0.22,
  deprecEnabled: false,
  deprecPurchase: 20000,
  deprecResidual: 5000,
  deprecYears: 5
};

export const StorageService = {
  /**
   * Recharge les missions du stockage local.
   * Si vide, charge les données exemples depuis le fichier JSON.
   */
  async loadMissions() {
    try {
      if (window.localforage) {
        const stored = await window.localforage.getItem(STORAGE_KEYS.MISSIONS);
        if (stored) return stored;
      } else {
        const stored = localStorage.getItem(STORAGE_KEYS.MISSIONS);
        if (stored) return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des missions:', error);
    }
    return [];
  },

  /**
   * Sauvegarde les missions dans le stockage local
   * @param {Array} m - Liste des missions
   */
  async saveMissions(m) {
    try {
      if (window.localforage) {
        await window.localforage.setItem(STORAGE_KEYS.MISSIONS, m);
      } else {
        localStorage.setItem(STORAGE_KEYS.MISSIONS, JSON.stringify(m));
      }
      return true;
    } catch (error) {
      if (error && error.name === 'QuotaExceededError') {
        if (window.DashboardService) {
           window.DashboardService.showNotification("Stockage saturé. Impossible d'enregistrer la mission avec les photos. Veuillez synchroniser puis vider le cache.", "error");
        }
      }
      console.error('Erreur lors de la sauvegarde des missions:', error);
      return false;
    }
  },

  /**
   * Charge les paramètres utilisateur
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
    return DEFAULT_SETTINGS;
  },

  /**
   * Sauvegarde les paramètres utilisateur
   * @param {Object} s - Paramètres
   */
  saveSettings(s) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
      return false;
    }
  },

  /**
   * Enregistre la préférence de thème (system/dark/light)
   * @param {string} theme - 'system', 'dark' ou 'light'
   */
  saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  /**
   * Récupère la préférence du thème (system/dark/light) ou retourne 'system' par défaut
   */
  getTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) {
      return saved;
    }
    return 'system';
  },

  /**
   * Réinitialise totalement les données avec la configuration d'origine
   */
  async resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.MISSIONS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      return await this.loadMissions();
    } catch (error) {
      console.error('Erreur lors du reset:', error);
      return [];
    }
  }
};
