/**
 * Orchestrateur Principal (Controller/App.js)
 * Lie l'ensemble des modules, synchronise les états et gère les événements du DOM.
 */

import { StorageService } from './components/storage.js';
import { StatsService } from './components/stats.js';
import { FiltersService } from './components/filters.js';
import { TableService } from './components/table.js';
import { ModalService } from './components/modal.js';
import { DashboardService } from './components/dashboard.js';
import { ExportService } from './components/export.js';
import { InspectionService } from './components/inspection.js';
import { PlannerService } from './components/planner.js';
import { CalculatorService } from './components/calculator.js';

window.CalculatorService = CalculatorService;
window.PlannerService = PlannerService;
window.InspectionService = InspectionService;
window.ExportService = ExportService;

// Intercepteur global Fetch pour injecter l'ID de session RBAC (X-Session-Token) dans toutes les requêtes
const originalFetch = window.fetch;
const customFetch = function(url, options = {}) {
  const token = localStorage.getItem('rbac_session_token');
  if (token) {
    document.cookie = "session_token=" + token + "; Path=/; Max-Age=" + (4 * 60 * 60) + "; SameSite=Lax";
    options.headers = options.headers || {};
    if (!(options.headers instanceof Headers)) {
      options.headers['X-Session-Token'] = token;
    } else {
      options.headers.set('X-Session-Token', token);
    }
  }
  return originalFetch(url, options);
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    configurable: true,
    writable: true,
    enumerable: true
  });
} catch (e) {
  console.warn("Impossible d'intercepter window.fetch avec defineProperty, tentative d'affectation directe:", e);
  try {
    window.fetch = customFetch;
  } catch (err) {
    console.error("Impossible d'intercepter globalement window.fetch :", err);
  }
}

class ConvoyageApp {
  constructor() {
    this.missions = [];
    this.filteredMissions = [];
    this.currentUser = null;
    this.sessionToken = null;
    
    this.filters = {
      query: '',
      immatriculation: '',
      dateRange: 'month',
      platform: 'all',
      status: 'all',
      rentability: 'all',
      dashboardYear: 'all',
      dashboardTrimester: 'all',
      dashboardMonth: 'all',
      dashboardSort: 'desc'
    };

    this.sortState = [
      { field: 'date', direction: 'desc' }
    ];

    this.settings = {};
    this.isDarkMode = false;
  }

  /**
   * Initialisation générale de l'accès sécurisé (RBAC)
   */
  async init() {
    this.sessionToken = localStorage.getItem('rbac_session_token');
    if (!this.sessionToken) {
      this.showLoginOverlay();
      return;
    }

    try {
      const resp = await fetch('/api/auth/me');
      if (resp.status === 401 || resp.status === 403) {
        throw new Error('Non authentifié');
      }
      const data = await resp.json();
      if (data.success) {
        this.currentUser = data.user;
        this.applyRbacPermissions();
        
        // Cacher l'overlay de login
        const overlay = document.getElementById('login_overlay');
        if (overlay) overlay.style.display = 'none';

        // Demander un changement forcé si le flag est actif
        if (this.currentUser.mustChangePassword) {
          this.showForceResetOverlay();
          return;
        }

        // Lancement effectif des fonctionnalités de l'appli
        await this.loadAppCore();
      } else {
        throw new Error('Échec du chargement utilisateur');
      }
    } catch (err) {
      console.warn("Validation RBAC initiale échouée, nettoyage de la session :", err);
      localStorage.removeItem('rbac_session_token');
      document.cookie = "session_token=; Path=/; Max-Age=0; SameSite=Lax";
      this.sessionToken = null;
      this.currentUser = null;
      this.showLoginOverlay();
    }
  }

  /**
   * Orchestre la connexion de l'utilisateur sur la mire de login s'il n'est pas authentifié
   */
  showLoginOverlay() {
    document.body.classList.add('overflow-hidden');
    const overlay = document.getElementById('login_overlay');
    if (overlay) overlay.style.display = 'flex';
    
    const form = document.getElementById('login_form');
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login_username').value;
        const password = document.getElementById('login_password').value;
        const errorMsg = document.getElementById('login_error_msg');

        if (errorMsg) errorMsg.classList.add('hidden');

        try {
          const resp = await originalFetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
          });
          const data = await resp.json();
          if (data.success) {
            localStorage.setItem('rbac_session_token', data.token);
            this.sessionToken = data.token;
            this.currentUser = data.user;
            
            // Appliquer les permissions
            this.applyRbacPermissions();

            const overlayNode = document.getElementById('login_overlay');
            if (overlayNode) overlayNode.style.display = 'none';

            if (data.user.mustChangePassword) {
              this.showForceResetOverlay();
            } else {
              await this.loadAppCore();
            }
          } else {
            if (errorMsg) {
              errorMsg.innerText = data.error || "Identifiants invalides.";
              errorMsg.classList.remove('hidden');
            }
          }
        } catch (err) {
          console.error("Échec de la connexion :", err);
          if (errorMsg) {
            errorMsg.innerText = "Erreur de connexion serveur.";
            errorMsg.classList.remove('hidden');
          }
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Gère l'affichage forcé de réinitialisation de mot de passe lors de la première connexion
   */
  showForceResetOverlay() {
    const overlay = document.getElementById('force_reset_overlay');
    if (overlay) overlay.classList.remove('hidden');

    const form = document.getElementById('force_reset_form');
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('reset_password').value;
        const confirmPass = document.getElementById('reset_password_confirm').value;
        const errorMsg = document.getElementById('reset_error_msg');

        if (errorMsg) errorMsg.classList.add('hidden');

        if (password !== confirmPass) {
          if (errorMsg) {
            errorMsg.innerText = "Les mots de passe ne correspondent pas.";
            errorMsg.classList.remove('hidden');
          }
          return;
        }

        // Critères de robustesse
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!regex.test(password)) {
          if (errorMsg) {
            errorMsg.innerText = "Le mot de passe ne respecte pas les contraintes (8+ caractères, Maj, Min, Chiffre, Caractère spécial).";
            errorMsg.classList.remove('hidden');
          }
          return;
        }

        try {
          const resp = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
          });
          const data = await resp.json();
          if (data.success) {
            overlay.classList.add('hidden');
            DashboardService.showNotification("Votre mot de passe a été modifié avec succès !", "success");
            this.currentUser.mustChangePassword = false;
            await this.loadAppCore();
          } else {
            if (errorMsg) {
              errorMsg.innerText = data.error || "Une erreur s'est produite.";
              errorMsg.classList.remove('hidden');
            }
          }
        } catch (err) {
          console.error("Échec du changement de mot de passe :", err);
          if (errorMsg) {
            errorMsg.innerText = "Erreur de connexion serveur.";
            errorMsg.classList.remove('hidden');
          }
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Charger et initialiser le coeur applicatif utile
   */
  async loadAppCore() {
    // 1. Charger les préférences et paramètres utilisateur
    this.settings = StorageService.loadSettings();
    this.isDarkMode = StorageService.getTheme() === 'dark';
    this.applyTheme();

    // Synchronisation automatique avec le thème du système (Bureau ou Mobile)
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e) => {
        this.isDarkMode = e.matches;
        this.applyTheme();
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSystemThemeChange);
      }
    }

    // 2. Charger les missions (chargement initial et démo)
    if (!localStorage.getItem('convoyage_manually_cleared_v3')) {
      localStorage.setItem('convoyage_missions', JSON.stringify([]));
      localStorage.setItem('convoyage_manually_cleared_v3', 'true');
      this.missions = [];
    } else {
      this.missions = await StorageService.loadMissions();
    }

    // 3. Préparer les filtres dynamiques (liste des clients distincts)
    this.populateClientFilters();

    // 4. Lier l'interface utilisateur
    this.bindEvents();

    // 5. Appliquer la vue active par défaut
    let defaultView = this.settings.activeView || 'dashboard';
    if (defaultView === 'documents') {
      defaultView = 'account';
    }
    const userRoleRaw = (this.currentUser && this.currentUser.role) ? this.currentUser.role.toUpperCase() : '';
    if (userRoleRaw === 'ACCOUNTANT') {
      const blocked = ['planner', 'documents', 'settings', 'admin-users', 'admin-logs'];
      if (blocked.includes(defaultView)) {
        defaultView = 'dashboard';
      }
    }
    this.switchView(defaultView);

    // 6. Mettre à jour les données affichées
    this.refreshUI();
    
    // 7. Initialisation du Planner intelligent (ADMIN uniquement)
    if (userRoleRaw === 'ADMIN') {
      PlannerService.init();
    }
    
    // Connecter le panel administration si Admin
    if (this.currentUser.role === 'ADMIN') {
      this.initAdminPanel();
    }

    DashboardService.showNotification(`Bonjour ${this.currentUser.fullname} (${this.currentUser.role === 'ADMIN' ? 'Admin' : 'Comptable'}). Sûreté validée !`, "success");
    document.body.classList.remove('overflow-hidden');
  }

  /**
   * Applique le thème configuré dans l'ensemble de l'arbre DOM
   */
  applyTheme() {
    const html = document.documentElement;
    const themeIconLight = document.getElementById('theme-icon-light');
    const themeIconDark = document.getElementById('theme-icon-dark');
    const themeText = document.getElementById('theme-toggle-text');

    if (this.isDarkMode) {
      html.classList.add('dark');
      if (themeIconLight) themeIconLight.classList.add('hidden');
      if (themeIconDark) themeIconDark.classList.remove('hidden');
      if (themeText) themeText.innerText = 'Mode Clair';
    } else {
      html.classList.remove('dark');
      if (themeIconLight) themeIconLight.classList.remove('hidden');
      if (themeIconDark) themeIconDark.classList.add('hidden');
      if (themeText) themeText.innerText = 'Mode Sombre';
    }
    
    // Enregistrer puis redessiner les graphiques pour adapter les polices et couleurs de grilles
    StorageService.saveTheme(this.isDarkMode ? 'dark' : 'light');
    StatsService.renderCharts(this.filteredMissions, this.isDarkMode, this.settings);
  }

  /**
   * Alterne entre le thème sombre et clair
   */
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    DashboardService.showNotification(
      `Thème ${this.isDarkMode ? 'sombre' : 'clair'} activé`, 
      'info'
    );
  }

  /**
   * Remplit la liste déroulante filtre des clients à partir des données réelles
   */
  populateClientFilters() {
    const list = FiltersService.getUniquePlatforms(this.missions);
    const filterSelect = document.getElementById('filter_platform');
    
    if (filterSelect) {
      // Conserver la première option par défaut 'Toutes les plateformes'
      const firstOption = filterSelect.options[0];
      filterSelect.innerHTML = '';
      filterSelect.appendChild(firstOption);

      list.forEach(plat => {
        const opt = document.createElement('option');
        opt.value = plat;
        opt.innerText = plat;
        filterSelect.appendChild(opt);
      });
    }

    // Remplir aussi les suggestions de plateforme dans la modal de saisie
    const modalSelect = document.getElementById('m_plateforme');
    if (modalSelect && modalSelect.tagName === 'SELECT') {
      // S'assurer de proposer au moins les plateformes courantes si elles n'existent pas encore
      const basePlatSet = new Set(['Otoqi', 'Hiflow', 'Driiveme', 'Expedicar', ...list]);
      modalSelect.innerHTML = '';
      basePlatSet.forEach(plat => {
        const opt = document.createElement('option');
        opt.value = plat;
        opt.innerText = plat;
        modalSelect.appendChild(opt);
      });
    }
  }

  /**
   * Bascule entre les différentes sections de l'application (SPA Mode)
   * @param {string} viewId - 'dashboard', 'missions', 'stats', 'settings'
   */
  switchView(viewId) {
    if (viewId === 'documents') {
      viewId = 'account';
    }
    const userRoleRaw = (this.currentUser && this.currentUser.role) ? this.currentUser.role.toUpperCase() : '';
    if (userRoleRaw === 'ACCOUNTANT') {
      const blocked = ['planner', 'documents', 'settings', 'admin-users', 'admin-logs'];
      if (blocked.includes(viewId)) {
        viewId = 'dashboard';
      }
    }
    this.settings.activeView = viewId;
    StorageService.saveSettings(this.settings);

    // 1. Cacher toutes les sections
    const sections = ['section-dashboard', 'section-missions', 'section-stats', 'section-settings', 'section-planner', 'section-admin-users', 'section-admin-logs', 'section-account'];
    sections.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.add('hidden');
    });

    // Load profile specific info if viewing Account
    if (viewId === 'account' && this.currentUser) {
      const parts = this.currentUser.fullname.split(' ');
      const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      const elAvatar = document.getElementById('account_avatar');
      if (elAvatar) elAvatar.innerText = initials || '--';

      const elFullname = document.getElementById('account_fullname');
      if (elFullname) elFullname.innerText = this.currentUser.fullname;

      const elRole = document.getElementById('account_role');
      if (elRole) elRole.innerText = this.currentUser.role === 'ADMIN' ? 'Administrateur' : 'Expert Comptable';

      const elUsername = document.getElementById('account_username');
      if (elUsername) elUsername.innerText = this.currentUser.username;

      const elEmail = document.getElementById('account_email');
      if (elEmail) elEmail.innerText = this.currentUser.email;

      // Hidden reset messages
      const errEl = document.getElementById('acc_error_msg');
      if (errEl) errEl.classList.add('hidden');
      const succEl = document.getElementById('acc_success_msg');
      if (succEl) succEl.classList.add('hidden');
      const newP = document.getElementById('acc_new_password');
      if (newP) newP.value = '';
      const confP = document.getElementById('acc_confirm_password');
      if (confP) confP.value = '';

      // Gérer la visibilité du gestionnaire documentaire selon le rôle (Admin uniquement)
      const elDocsRoot = document.getElementById('react-documents-root');
      if (elDocsRoot) {
        if (this.currentUser.role === 'ADMIN') {
          elDocsRoot.classList.remove('hidden');
        } else {
          elDocsRoot.classList.add('hidden');
        }
      }
    }

    // 2. Afficher la section demandée
    const activeSection = document.getElementById(`section-${viewId}`);
    if (activeSection) {
      activeSection.classList.remove('hidden');
      // Animation douce d'entrée
      activeSection.classList.add('animate-fade-in');
      setTimeout(() => {
        activeSection.classList.remove('animate-fade-in');
      }, 500);
    }

    // 3. Mettre à jour graphiquement le bouton actif de la Sidebar commerciale et de la barre mobile
    const navButtons = document.querySelectorAll('[data-view]');
    navButtons.forEach(btn => {
      const isMobile = btn.classList.contains('mobile-nav-btn');
      
      let activeBtnClass, inertBtnClass;

      if (isMobile) {
        // Classes pour barre mobile
        activeBtnClass = 'text-indigo-600 border-t-indigo-600';
        inertBtnClass = 'text-slate-500 border-transparent';
      } else {
        // Classes pour sidebar
        activeBtnClass = 'bg-slate-800 text-white font-bold border-l-4 border-emerald-500 shadow-md';
        inertBtnClass = 'text-slate-400 hover:bg-slate-800 hover:text-white font-semibold border-l-4 border-transparent';
      }

      const btnView = btn.getAttribute('data-view');
      
      // Clean up previous classes safely
      activeBtnClass.split(' ').forEach(cls => btn.classList.remove(cls));
      inertBtnClass.split(' ').forEach(cls => btn.classList.remove(cls));
      
      if (!isMobile) {
        // Remove hardcoded classes from sidebar only that conflict
        btn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white', 'text-indigo-600', 'dark:text-indigo-400', 'bg-slate-100', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-400', 'hover:bg-slate-50', 'dark:hover:bg-slate-800/50');
      }
      
      if (btnView === viewId) {
        activeBtnClass.split(' ').forEach(cls => btn.classList.add(cls));
      } else {
        inertBtnClass.split(' ').forEach(cls => btn.classList.add(cls));
      }
    });

    // 4. Cacher la sidebar mobile si elle est ouverte
    const sidebar = document.getElementById('sidebarPanel');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
      sidebar.classList.add('-translate-x-full');
    }
    if (overlay && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
    }

    // Re-rendre les graphiques spécifiques si on ouvre l'onglet d'analyse avancée
    if (viewId === 'stats' || viewId === 'dashboard') {
      setTimeout(() => {
        StatsService.renderCharts(this.filteredMissions, this.isDarkMode, this.settings);
      }, 50);
    }

    // Re-rendre la carte de la tournée si on ouvre le Smart Planner
    if (viewId === 'planner' && window.PlannerService) {
      setTimeout(() => {
        window.PlannerService.drawMap();
      }, 50);
    }

    // 5. Charger les données d'administration dynamiquement
    if (viewId === 'admin-users') {
      this.loadAdminUsers();
    } else if (viewId === 'admin-logs') {
      this.loadAdminLogs();
    }
  }

  /**
   * Actualise les calculs, filtre la liste des missions et actualise l'ensemble de l'écran
   */
  refreshUI() {
    // 1. Filtrer et trier la liste complète
    this.filteredMissions = FiltersService.process(this.missions, this.filters, this.sortState);

    // 2. Calculer les statistiques globales (agrégat brut s'appliquant aux missions FILTRÉES ou totales selon préférence)
    // Ici, nous calculons et affichons le dashboard sur la base des données FILTRÉES par défaut (extrêmement puissant pour le suivi d'un mois précis)
    const financials = StatsService.calculateFinancials(this.filteredMissions, this.settings, this.filters);

    // 3. Mettre à jour les KPI du Dashboard
    DashboardService.updateMetricCards(financials, this.settings);

    const userRole = (this.currentUser && this.currentUser.role) ? this.currentUser.role.toUpperCase() : '';
    if (userRole === 'ACCOUNTANT') {
      this.applyAccountantDashboardLayout();
    }

    // 4. Mettre à jour le tableau interactif
    const isReadOnly = userRole === 'ACCOUNTANT';
    TableService.render(this.filteredMissions, this.sortState, (action, id) => {
      this.handleRowAction(action, id);
    }, isReadOnly);

    // 5. Redessiner les graphiques
    StatsService.renderCharts(this.filteredMissions, this.isDarkMode, this.settings);

    // 6. Synchroniser les sélecteurs du tri multi-critères graphique
    this.updateMultiSortInputs();

    // 7. Vérifier et afficher les notifications pour les missions de moins de 24h
    this.checkUpcomingMissions();
  }

  /**
   * Vérifie s'il y a des missions prévues dans les prochaines 24h et affiche une alerte visuelle.
   */
  checkUpcomingMissions() {
    const container = document.getElementById('upcoming-missions-alert');
    if (!container) return;

    if (!this.currentUser) {
      container.classList.add('hidden');
      return;
    }

    const now = new Date();
    const upcoming = [];

    this.missions.forEach(m => {
      // Ignorer les missions déjà payées ou annulées
      if (m.statut === 'Payée' || m.statut === 'Annulée') return;

      const dateStr = m.date; // Ex: "2026-06-14"
      const timeStr = m.heureDepart || '00:00'; // Ex: "08:30"
      
      // Construire l'objet date en heure locale
      const missionDateTime = new Date(`${dateStr}T${timeStr}`);
      if (isNaN(missionDateTime.getTime())) return;

      const diffMs = missionDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Si la mission démarre dans les prochaines 24h (ou a commencé depuis moins de 2h de battement)
      if (diffHours >= -2 && diffHours <= 24) {
        upcoming.push({
          mission: m,
          diffHours,
          dateTime: missionDateTime
        });
      }
    });

    if (upcoming.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }

    // Trier pour afficher la plus proche en premier
    upcoming.sort((a, b) => a.dateTime - b.dateTime);

    let cardsHtml = '';
    upcoming.forEach(item => {
      const m = item.mission;
      const diff = item.diffHours;
      let timeText = '';
      
      if (diff < 0) {
        timeText = `A commencé il y a ${Math.abs(Math.round(diff))}h`;
      } else if (diff < 1) {
        const mins = Math.round(diff * 60);
        if (mins <= 0) {
          timeText = `Commence maintenant`;
        } else {
          timeText = `Commence dans ${mins} min${mins > 1 ? 's' : ''}`;
        }
      } else {
        timeText = `Commence dans ${Math.round(diff)}h`;
      }

      const dateFormatted = new Date(m.date).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      cardsHtml += `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-all shadow-sm">
          <div class="flex items-center gap-2.5 w-full sm:w-auto">
            <div class="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-xl shrink-0 animate-pulse">
              <i data-lucide="bell" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-xs font-black text-slate-800 dark:text-slate-150">${m.vehicle}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 rounded">${m.immatriculation}</span>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-none">
                <span class="font-bold text-slate-650 dark:text-slate-300">${m.depart}</span> ➔ <span class="font-bold text-slate-650 dark:text-slate-300">${m.destination}</span>
              </p>
            </div>
          </div>
          
          <div class="flex items-center justify-between sm:justify-end gap-3.5 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-2 sm:pt-0">
            <div class="text-left sm:text-right">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 font-sans">${timeText}</div>
              <div class="text-[10px] text-slate-400 font-bold font-mono">${dateFormatted} • ${m.heureDepart || '00:00'}</div>
            </div>
            <button class="text-[11px] bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/30 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-black px-3 py-1.5 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all flex items-center gap-1 active:scale-95 cursor-pointer" onclick="window.app.handleRowAction('edit', '${m.id}')">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Détails
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="bg-gradient-to-r from-amber-50 to-amber-100/30 dark:from-amber-950/15 dark:to-transparent p-4 rounded-xl sm:rounded-2xl border border-amber-200/55 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
        <div class="flex items-center gap-2.5 mb-3">
          <div class="p-1.5 bg-amber-500 text-white rounded-lg shrink-0">
            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="font-black text-amber-800 dark:text-amber-400 text-xs sm:text-sm">🔔 Convoyages imminents (Prochaines 24 heures)</h3>
            <p class="text-[10px] text-amber-600/90 dark:text-amber-500/80 font-medium">Vous avez des missions dont le départ est prévu très prochainement.</p>
          </div>
        </div>
        <div class="space-y-2">
          ${cardsHtml}
        </div>
      </div>
    `;

    container.classList.remove('hidden');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Synchronise l'état visuel des boutons/listes de tri multi-critères avec this.sortState
   */
  updateMultiSortInputs() {
    const f1 = document.getElementById('sort_field_1');
    const d1 = document.getElementById('sort_dir_1');
    const f2 = document.getElementById('sort_field_2');
    const d2 = document.getElementById('sort_dir_2');
    const f3 = document.getElementById('sort_field_3');
    const d3 = document.getElementById('sort_dir_3');

    if (!f1) return; // Non initialisé / dans une autre vue

    // Valeurs par défaut initiales
    f1.value = 'date';
    d1.value = 'desc';
    if (f2) f2.value = 'none';
    if (f3) f3.value = 'none';

    if (Array.isArray(this.sortState) && this.sortState.length > 0) {
      if (this.sortState[0]) {
        f1.value = this.sortState[0].field;
        d1.value = this.sortState[0].direction;
      }
      if (this.sortState[1] && f2 && d2) {
        f2.value = this.sortState[1].field;
        d2.value = this.sortState[1].direction;
      }
      if (this.sortState[2] && f3 && d3) {
        f3.value = this.sortState[2].field;
        d3.value = this.sortState[2].direction;
      }
    }
  }

  /**
   * Sauvegarde l'état actuel de la liste de toutes les missions dans le stockage persistant local
   */
  saveMissions() {
    const saved = StorageService.saveMissions(this.missions);
    
    // In creating or updating any mission, write/save it locally to server's `/data/sample-data.json` file
    fetch('/api/missions/save-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missions: this.missions })
    }).catch(err => console.error("Error saving local copy to backend:", err));

    if (saved && this.googleDriveToken) {
      this.backupToDrive(this.googleDriveToken, false);
    }
    return saved;
  }

  /**
   * Enregistre ou modifie une mission à la validation du formulaire
   * @param {Event} e 
   */
  handleFormSubmit(e) {
    e.preventDefault();

    const getNumVal = (id) => Number(document.getElementById(id).value) || 0;
    const getStrVal = (id) => document.getElementById(id).value.trim();

    // S'assurer de respecter le calcul de durée
    let dur = 0;
    const hDep = getStrVal('m_heureDepart');
    const hArr = getStrVal('m_heureArrivee');
    if (hDep && hArr) {
      const d1 = new Date(`2026-05-23T${hDep}:00`);
      const d2 = new Date(`2026-05-23T${hArr}:00`);
      let diff = (d2 - d1) / 1000 / 60; // en minutes
      if (diff < 0) diff += 1440; // chevauchement jour suivant
      dur = diff;
    }

    const missionData = {
      date: getStrVal('m_date'),
      vehicle: getStrVal('m_vehicle'),
      immatriculation: getStrVal('m_immatriculation').toUpperCase(),
      depart: getStrVal('m_depart'),
      destination: getStrVal('m_destination'),
      heureDepart: hDep,
      heureArrivee: hArr,
      dureeTrajet: dur,
      kilometrage: getNumVal('m_kilometrage'),
      plateforme: getStrVal('m_plateforme'),
      statut: getStrVal('m_statut'),
      gain: getNumVal('m_gain'),
      carburant: getNumVal('m_carburant'),
      peage: getNumVal('m_peage'),
      fraisRembourses: getStrVal('m_fraisRembourses'),
      lavage: getNumVal('m_lavage'),
      transportRetour: getStrVal('m_transportRetour'),
      prixRetour: getNumVal('m_prixRetour'),
      observations: getStrVal('m_observations'),
      incidents: getStrVal('m_incidents'),
      privateNotes: getStrVal('m_privateNotes')
    };

    // Validations obligatoires
    if (!missionData.date || !missionData.vehicle || !missionData.immatriculation || !missionData.depart || !missionData.destination) {
      DashboardService.showNotification("Veuillez remplir les informations de livraison indispensables (Véhicule, Immat, Villes, Date)", "warning");
      return;
    }

    if (ModalService.activeMissionId) {
      // Mode MODIFICATION
      const index = this.missions.findIndex(m => m.id === ModalService.activeMissionId);
      if (index !== -1) {
        this.missions[index] = { ...this.missions[index], ...missionData };
        DashboardService.showNotification(`Mission #${this.missions[index].immatriculation} mise à jour !`, "success");
        if (this.googleDriveToken) {
          this.uploadMissionToDrive(this.missions[index], this.googleDriveToken);
        }
      }
    } else {
      // Mode NOUVELLE MISSION
      const prefix = `conv-${new Date(missionData.date).getFullYear()}`;
      const randomSuf = Math.floor(100 + Math.random() * 900);
      missionData.id = `${prefix}-${randomSuf}`;
      
      this.missions.push(missionData);
      DashboardService.showNotification(`Course enregistrée avec succès sous la référence ${missionData.id} !`, "success");
      
      // Automatically add to smart planner opportunities list
      if (window.PlannerService) {
        const newOpp = {
          id: `opt_auto_${missionData.id}`,
          platform: missionData.plateforme || 'Autre',
          from: missionData.depart,
          to: missionData.destination,
          price: Number(missionData.gain) || 0,
          distance: Number(missionData.kilometrage) || 0,
          date: missionData.date || '2026-06-08'
        };
        window.PlannerService.mockedOpportunities.unshift(newOpp);
        if (typeof window.PlannerService.renderOpportunities === 'function') {
          window.PlannerService.renderOpportunities();
        }
      }

      if (this.googleDriveToken) {
        this.uploadMissionToDrive(missionData, this.googleDriveToken);
      }
    }

    // Sauvegarder et actualiser
    this.saveMissions();
    this.populateClientFilters();
    ModalService.closeModal();
    this.refreshUI();
  }

  /**
   * Import missions list from an Excel sheet (.xlsx, .xls)
   * @param {File} file 
   */
  importMissionsFromExcel(file) {
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
          DashboardService.showNotification("Aucune ligne de données trouvée dans le fichier Excel.", "warning");
          return;
        }

        // Synonyms mapping array for robust imports
        const MAPPER = {
          id: ['id', 'ID', 'référence', 'ref', 'reference'],
          date: ['date', 'Date', 'le', 'le (date)'],
          vehicle: ['véhicule', 'vehicule', 'vehicle', 'Voiture', 'voiture', 'Modèle', 'modele', 'model'],
          immatriculation: ['immatriculation', 'immat', 'plaque', 'plate'],
          depart: ['départ', 'depart', 'de', 'from', 'origine', 'origin'],
          destination: ['destination', 'vers', 'to', 'arrivée', 'arrivee'],
          heureDepart: ['départ heure', 'depart heure', 'heure départ', 'heure depart', 'heure_dep', 'heure de départ', 'heure de depart', 'heure dep', 'départ rdv', 'depart rdv'],
          heureArrivee: ['arrivée heure', 'arrivee heure', 'heure arrivée', 'heure arrivee', 'heure_arr', 'heure d\'arrivée', 'heure d\'arrivee', 'heure arr'],
          dureeTrajet: ['durée (min)', 'duree (min)', 'durée', 'duree', 'duration'],
          kilometrage: ['kilométrage (km)', 'kilometrage (km)', 'kilométrage', 'kilometrage', 'km', 'kms', 'distance'],
          plateforme: ['plateforme / client', 'plateforme', 'client', 'partenaire', 'platform'],
          statut: ['statut', 'status', 'état', 'etat'],
          gain: ['gain brut (€)', 'gain brut', 'gain (€)', 'gain', 'revenu', 'montant', 'prix', 'price', 'gains'],
          carburant: ['carburant (€)', 'carburant', 'essence', 'diesel', 'fuel'],
          peage: ['péage (€)', 'peage', 'autoroute', 'toll', 'tolls'],
          fraisRembourses: ['frais remboursés', 'frais rembourses', 'remboursé', 'rembourse', 'reimbursed', 'frais remboursés ?'],
          lavage: ['lavage (€)', 'lavage', 'nettoyage', 'wash'],
          transportRetour: ['type retour', 'retour', 'moyen retour', 'transport retour'],
          prixRetour: ['prix retour (€)', 'prix retour', 'coût retour', 'cout retour'],
          observations: ['observations', 'obs', 'remarques', 'notes', 'observations / notes'],
          incidents: ['incidents / retards', 'incidents', 'retards', 'problèmes', 'problemes', 'incident']
        };

        const parseExcelDate = (val) => {
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
          return new Date().toISOString().slice(0, 10);
        };

        const parseExcelTime = (val) => {
          if (!val) return '';
          if (typeof val === 'number') {
            let totalMinutes = Math.round(val * 1440);
            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
          if (typeof val === 'string') {
            const str = val.trim();
            const match = str.match(/^(\d{1,2})[:hH](\d{2})/);
            if (match) {
              return `${match[1].padStart(2, '0')}:${match[2]}`;
            }
            return str;
          }
          return '';
        };

        const parseExcelNumber = (val) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = val.toString().replace(/\s/g, '').replace(/[^\d.,\-]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        };

        const parseExcelString = (val) => {
          if (val === null || val === undefined) return '';
          return val.toString().trim();
        };

        let addCount = 0;
        let updateCount = 0;

        rawRows.forEach((row) => {
          // Normalize row keys
          const normRow = {};
          for (const rawKey of Object.keys(row)) {
            const keyLower = rawKey.toLowerCase().trim();
            let matchedField = null;
            for (const [field, synonyms] of Object.entries(MAPPER)) {
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

          // Build final mission structure
          const date = parseExcelDate(normRow.date);
          const vehicle = parseExcelString(normRow.vehicle || 'Voiture');
          const immatriculation = parseExcelString(normRow.immatriculation || 'NC').toUpperCase();
          const depart = parseExcelString(normRow.depart || 'Nouveau départ');
          const destination = parseExcelString(normRow.destination || 'Nouvelle arrivée');
          const heureDepart = parseExcelTime(normRow.heureDepart);
          const heureArrivee = parseExcelTime(normRow.heureArrivee);

          // Calculate duration if not provided
          let dureeTrajet = parseExcelNumber(normRow.dureeTrajet);
          if (!dureeTrajet && heureDepart && heureArrivee) {
            const d1 = new Date(`2026-05-23T${heureDepart}:00`);
            const d2 = new Date(`2026-05-23T${heureArrivee}:00`);
            let diff = (d2 - d1) / 1000 / 60;
            if (diff < 0) diff += 1440;
            dureeTrajet = diff;
          }

          // Validate or format status
          let statut = parseExcelString(normRow.statut || 'Planifiée');
          // Standardize status format
          const statLower = statut.toLowerCase();
          if (statLower.includes('pay') || statLower.includes('régl')) statut = 'Payée';
          else if (statLower.includes('term') || statLower.includes('fin')) statut = 'Terminée';
          else if (statLower.includes('cours') || statLower.includes('prog')) statut = 'En cours';
          else statut = 'Planifiée';

          const finalMission = {
            date,
            vehicle,
            immatriculation,
            depart,
            destination,
            heureDepart,
            heureArrivee,
            dureeTrajet,
            kilometrage: parseExcelNumber(normRow.kilometrage),
            plateforme: parseExcelString(normRow.plateforme || 'Autre'),
            statut,
            gain: parseExcelNumber(normRow.gain),
            carburant: parseExcelNumber(normRow.carburant),
            peage: parseExcelNumber(normRow.peage),
            fraisRembourses: parseExcelString(normRow.fraisRembourses || 'En attente'),
            lavage: parseExcelNumber(normRow.lavage),
            transportRetour: parseExcelString(normRow.transportRetour || 'Train'),
            prixRetour: parseExcelNumber(normRow.prixRetour),
            observations: parseExcelString(normRow.observations),
            incidents: parseExcelString(normRow.incidents),
            privateNotes: parseExcelString(normRow.privateNotes)
          };

          // Check if explicit valid ID is present
          const rowId = parseExcelString(normRow.id);
          const hasPrefixedId = rowId && rowId.trim().length > 3;

          let existingIndex = -1;
          if (hasPrefixedId) {
            finalMission.id = rowId;
            existingIndex = this.missions.findIndex(m => m.id === rowId);
          } else {
            // Check for potential duplicates (date + immatriculation + depart + destination match)
            existingIndex = this.missions.findIndex(m => 
              m.date === finalMission.date && 
              m.immatriculation === finalMission.immatriculation && 
              m.depart === finalMission.depart && 
              m.destination === finalMission.destination
            );
            if (existingIndex !== -1) {
              finalMission.id = this.missions[existingIndex].id;
            } else {
              const prefix = `conv-${new Date(finalMission.date).getFullYear()}`;
              const randomSuf = Math.floor(100 + Math.random() * 900);
              finalMission.id = `${prefix}-${randomSuf}`;
            }
          }

          if (existingIndex !== -1) {
            this.missions[existingIndex] = { ...this.missions[existingIndex], ...finalMission };
            updateCount++;
          } else {
            this.missions.push(finalMission);
            addCount++;
          }
        });

        // Save, filter, and render
        this.saveMissions();
        this.populateClientFilters();
        this.refreshUI();

        let msg = `${addCount + updateCount} missions traitées avec succès !`;
        if (addCount > 0 && updateCount > 0) {
          msg += ` (${addCount} ajoutées, ${updateCount} mises à jour)`;
        } else if (addCount > 0) {
          msg += ` (${addCount} nouvelles missions)`;
        } else if (updateCount > 0) {
          msg += ` (${updateCount} mises à jour)`;
        }
        DashboardService.showNotification(msg, "success");
      } catch (err) {
        console.error(err);
        DashboardService.showNotification("Erreur lors de la lecture du fichier Excel : " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Traite les actions de ligne (Marquer validé/payé, Dupliquer, Éditer, Supprimer)
   * @param {string} action 
   * @param {string} id 
   */
  handleRowAction(action, id) {
    const m = this.missions.find(item => item.id === id);
    if (!m) return;

    // L'action "details" de divulgation progressive doit toujours être autorisée (Comptable & Convoyeur)
    if (action === 'details') {
      TableService.openDetailDrawer(m);
      return;
    }

    const userRole = (this.currentUser && this.currentUser.role) ? this.currentUser.role.toUpperCase() : '';
    if (userRole === 'ACCOUNTANT') {
      const restrictedActions = ['duplicate', 'edit', 'delete', 'validate'];
      if (restrictedActions.includes(action)) {
        DashboardService.showNotification("Vous n'avez pas les autorisations nécessaires.", 'danger');
        return;
      }
    }

    if (action === 'validate') {
      // Valider ou basculer en Payé directement d'un bouton rapide !
      m.statut = 'Payée';
      this.saveMissions();
      this.refreshUI();
      DashboardService.showNotification(`La mission pour le véhicule "${m.vehicle}" est validée et payée !`, 'success');
      
      // Auto-upload to Google Drive if terminated (Payée / Terminée) and Drive token is present
      if (this.googleDriveToken) {
        this.uploadMissionToDrive(m, this.googleDriveToken);
        if (window.InspectionService && typeof window.InspectionService.uploadMissionToDrive === 'function') {
          window.InspectionService.uploadMissionToDrive(m);
        }
      }
    } 
    
    else if (action === 'inspect') {
      InspectionService.openInspection(id);
    }
    
    else if (action === 'duplicate') {
      // Ouvre le formulaire prérempli avec la date du jour
      ModalService.openDuplicateModal(m);
    } 
    
    else if (action === 'edit') {
      // Modifier
      ModalService.openEditModal(m);
    } 
    
    else if (action === 'delete') {
      // Supprimer
      ModalService.confirmDelete(m.vehicle, () => {
        this.missions = this.missions.filter(item => item.id !== id);
        this.saveMissions();
        this.populateClientFilters();
        this.refreshUI();
        DashboardService.showNotification("La mission a été définitivement supprimée.", 'danger');
      });
    }
    
    else if (action === 'documents') {
      this.switchView('account');
      window.dispatchEvent(new CustomEvent('open-mission-documents', { detail: m }));
    }
  }

  /**
   * Met à jour l'interface utilisateur de synchronisation Google Drive
   */
  updateDriveSyncUI(token) {
    const statusEl = document.getElementById('drive_sync_status');
    const btnBackup = document.getElementById('btn_drive_backup');
    const btnRestore = document.getElementById('btn_drive_restore');
    const btnAutoSync = document.getElementById('btn_drive_autosync');

    if (!statusEl) return;

    if (token) {
      statusEl.className = "py-2.5 px-3 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/25 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 flex items-center gap-2 font-bold font-sans";
      statusEl.innerHTML = `<i data-lucide="circle-check-big" class="w-4 h-4 text-emerald-500 shrink-0"></i> Connecté à Google Drive • Synchronisation active`;
      
      if (btnBackup) btnBackup.disabled = false;
      if (btnRestore) btnRestore.disabled = false;
      if (btnAutoSync) btnAutoSync.disabled = false;
    } else {
      statusEl.className = "py-2.5 px-3 rounded-xl text-xs bg-amber-50 dark:bg-amber-950/25 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40 flex items-center gap-2 font-bold font-sans";
      statusEl.innerHTML = `<i data-lucide="circle-alert" class="w-4 h-4 shrink-0"></i> Connectez-vous via l'onglet Mon Compte pour activer la synchronisation`;
      
      if (btnBackup) btnBackup.disabled = true;
      if (btnRestore) btnRestore.disabled = true;
      if (btnAutoSync) btnAutoSync.disabled = true;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Synchronisation bidirectionnelle automatique
   */
  async autoSyncDrive(token) {
    if (this._isAutoSyncing) return;
    this._isAutoSyncing = true;
    try {
      const res = await fetch('/api/drive/get-app-data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && (data.missions || data.settings)) {
        let updated = false;

        // Sync settings
        if (data.settings) {
          const currentSettings = StorageService.loadSettings();
          if (JSON.stringify(currentSettings) !== JSON.stringify(data.settings)) {
            this.settings = { ...this.settings, ...data.settings };
            StorageService.saveSettings(this.settings);
            updated = true;
          }
        }

        // Sync missions
        if (data.missions) {
          const localMissions = await StorageService.loadMissions();
          
          const isSampleData = localMissions.length > 0 && localMissions.some(m => m.id && m.id.includes('sample'));
          
          let finalMissions;
          if (isSampleData) {
            finalMissions = data.missions;
            updated = true;
          } else {
            // Smart Bidirectional Merge by ID
            const merged = [...localMissions];
            let addedCount = 0;
            data.missions.forEach(cm => {
              if (cm && cm.id && !merged.some(lm => lm.id === cm.id)) {
                merged.push(cm);
                addedCount++;
              }
            });
            finalMissions = merged;
            if (addedCount > 0) {
              updated = true;
            }
          }

          if (updated) {
            this.missions = finalMissions;
            StorageService.saveMissions(this.missions);
            this.populateClientFilters();
            this.refreshUI();
            DashboardService.showNotification("Données fusionnées et synchronisées avec Google Drive !", "success");
          }
        }

        // Push merged state back up to cloud
        await this.backupToDrive(token, false);
      } else {
        // First sync: Upload local missions to cloud drive
        await this.backupToDrive(token, false);
      }
    } catch (err) {
      console.error("Auto Sync Error:", err);
    } finally {
      this._isAutoSyncing = false;
    }
  }

  /**
   * Sauvegarde une mission individuelle sur Google Drive
   */
  async uploadMissionToDrive(mission, token) {
    try {
      const missionBlob = new Blob([JSON.stringify(mission, null, 2)], { type: 'application/json' });
      const filename = `Mission_${mission.immatriculation}_${mission.id}.json`;
      const file = new File([missionBlob], filename, { type: 'application/json' });
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("immatriculation", mission.immatriculation);
      formData.append("name", filename);
      formData.append("date", mission.date);

      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`Mission ${mission.id} sauvegardée automatiquement sur Google Drive dans ${data.path}`);
      } else {
        throw new Error(data.error || "Échecs de l'upload");
      }
    } catch (err) {
      console.error("Erreur de sauvegarde automatique sur Google Drive:", err);
    }
  }

  /**
   * Sauvegarde manuelle locale -> cloud
   */
  async backupToDrive(token, showToast = true) {
    try {
      const localMissions = await StorageService.loadMissions();
      const localSettings = StorageService.loadSettings();

      const res = await fetch('/api/drive/save-app-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          missions: localMissions,
          settings: localSettings
        })
      });

      const data = await res.json();
      if (data.success) {
        if (showToast) {
          DashboardService.showNotification("Sauvegarde réussie sur votre Google Drive !", "success");
        }
      } else {
        throw new Error(data.error || "Unknown server error");
      }
    } catch (err) {
      console.error("Backup to Drive failed:", err);
      if (showToast) {
        DashboardService.showNotification("Échec de la sauvegarde sur Google Drive.", "danger");
      }
    }
  }

  /**
   * Restauration forcée cloud -> locale
   */
  async restoreFromDrive(token) {
    try {
      const res = await fetch('/api/drive/get-app-data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (data.missions) {
          this.missions = data.missions;
          StorageService.saveMissions(this.missions);
        }
        if (data.settings) {
          this.settings = { ...this.settings, ...data.settings };
          StorageService.saveSettings(this.settings);
        }
        
        this.populateClientFilters();
        this.refreshUI();
        DashboardService.showNotification("Restauration complète depuis Google Drive réussie !", "success");
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      console.error("Restore from Drive failed:", err);
      DashboardService.showNotification("Échec de la récupération depuis Google Drive.", "danger");
    }
  }

  /**
   * Lie les multiples éléments de l'interface graphique aux actions JS du controller
   */
  bindEvents() {
    // 1. Boutons de navigation (Sidebar SPA)
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = btn.getAttribute('data-view');
        this.switchView(viewId);
      });
    });

    // Logout
    const btnLogout = document.getElementById('btn_logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        localStorage.clear();
        document.cookie = "session_token=; Path=/; Max-Age=0; SameSite=Lax";
        window.location.reload();
      });
    }

    // Rediriger vers Mon Compte lors du clic sur l'avatar ou le nom
    const profileAvatar = document.getElementById('userHeaderAvatar');
    const profileName = document.getElementById('user_welcome_name');
    if (profileAvatar) profileAvatar.addEventListener('click', () => this.switchView('account'));
    if (profileName) profileName.addEventListener('click', () => this.switchView('account'));

    // Gérer la soumission du changement de mot de passe profil
    const accPassForm = document.getElementById('accountPasswordForm');
    if (accPassForm) {
      accPassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('acc_error_msg');
        const succEl = document.getElementById('acc_success_msg');
        if (errEl) errEl.classList.add('hidden');
        if (succEl) succEl.classList.add('hidden');

        const newPass = document.getElementById('acc_new_password')?.value;
        const confirmPass = document.getElementById('acc_confirm_password')?.value;

        if (newPass !== confirmPass) {
          if (errEl) {
            errEl.innerText = "Erreur: Les deux saisies de mot de passe ne correspondent pas.";
            errEl.classList.remove('hidden');
          }
          return;
        }

        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!regex.test(newPass)) {
          if (errEl) {
            errEl.innerText = "Erreur: Le mot de passe ne correspond pas aux critères de robustesse requis.";
            errEl.classList.remove('hidden');
          }
          return;
        }

        try {
          const resp = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPass })
          });
          const data = await resp.json();
          if (data.success) {
            if (succEl) {
              succEl.innerText = "Succès! Votre mot de passe a été mis à jour avec succès.";
              succEl.classList.remove('hidden');
            }
            document.getElementById('acc_new_password').value = '';
            document.getElementById('acc_confirm_password').value = '';
          } else {
            if (errEl) {
              errEl.innerText = data.error || "Opération échouée backend.";
              errEl.classList.remove('hidden');
            }
          }
        } catch (err) {
          console.error("Password update error:", err);
          if (errEl) {
            errEl.innerText = "Erreur de communication avec le serveur.";
            errEl.classList.remove('hidden');
          }
        }
      });
    }

    // 2. Toggle Thème Sombre
    const btnTheme = document.getElementById('theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => this.toggleTheme());
    }

    // 3. Barre de recherche et filtres directifs
    const fQuery = document.getElementById('search_query');
    const fRange = document.getElementById('filter_date');
    const fPlatform = document.getElementById('filter_platform');
    const fStatus = document.getElementById('filter_status');
    const fRentability = document.getElementById('filter_rentability');
    const fImmat = document.getElementById('filter_immatriculation');
    const btnClearImmat = document.getElementById('btn_clear_immat');
    const suggestionsBox = document.getElementById('immat_suggestions_box');

    const triggerFilters = () => {
      this.filters.query = fQuery ? fQuery.value : '';
      this.filters.immatriculation = fImmat ? fImmat.value : '';
      this.filters.dateRange = fRange ? fRange.value : 'month';
      this.filters.platform = fPlatform ? fPlatform.value : 'all';
      this.filters.status = fStatus ? fStatus.value : 'all';
      this.filters.rentability = fRentability ? fRentability.value : 'all';
      
      if (btnClearImmat) {
        if (this.filters.immatriculation) {
          btnClearImmat.classList.remove('hidden');
        } else {
          btnClearImmat.classList.add('hidden');
        }
      }

      // Réinitialiser la page à 1 lors du changement de filtre pour éviter les pages fantômes
      TableService.currentPage = 1;
      this.refreshUI();
    };

    const updateSuggestions = () => {
      if (!suggestionsBox || !fImmat) return;
      const val = fImmat.value.toUpperCase().trim();
      
      const uniqueImmats = FiltersService.getUniqueImmatriculations(this.missions);
      const filtered = uniqueImmats.filter(immat => immat.toUpperCase().includes(val));

      if (filtered.length === 0) {
        suggestionsBox.innerHTML = `
          <div class="px-3.5 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
            Aucune immat. trouvée
          </div>
        `;
      } else {
        suggestionsBox.innerHTML = filtered.map(immat => `
          <div class="px-3.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-mono font-medium cursor-pointer transition-colors border-b border-slate-50/50 dark:border-slate-800/10 last:border-0 text-slate-700 dark:text-slate-300 flex items-center justify-between" data-suggestion="${immat}">
            <span>${immat}</span>
            <span class="text-[9px] font-sans font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-450 dark:text-slate-500 rounded">Plaque</span>
          </div>
        `).join('');

        suggestionsBox.querySelectorAll('[data-suggestion]').forEach(el => {
          el.addEventListener('click', () => {
            fImmat.value = el.dataset.suggestion;
            triggerFilters();
            suggestionsBox.classList.add('hidden');
          });
        });
      }
    };

    if (fImmat) {
      fImmat.addEventListener('input', () => {
        if (suggestionsBox) suggestionsBox.classList.remove('hidden');
        updateSuggestions();
        triggerFilters();
      });

      fImmat.addEventListener('focus', () => {
        if (suggestionsBox) suggestionsBox.classList.remove('hidden');
        updateSuggestions();
      });
    }

    if (btnClearImmat && fImmat) {
      btnClearImmat.addEventListener('click', () => {
        fImmat.value = '';
        triggerFilters();
        if (suggestionsBox) suggestionsBox.classList.add('hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (suggestionsBox && fImmat && !fImmat.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
      }
    });

    if (fQuery) fQuery.addEventListener('input', triggerFilters);
    if (fRange) fRange.addEventListener('change', triggerFilters);
    if (fPlatform) fPlatform.addEventListener('change', triggerFilters);
    if (fStatus) fStatus.addEventListener('change', triggerFilters);
    if (fRentability) fRentability.addEventListener('change', triggerFilters);

    // Réinitialiser les filtres
    const btnResetFilters = document.getElementById('btn_reset_filters');
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', () => {
        if (fQuery) fQuery.value = '';
        if (fImmat) fImmat.value = '';
        if (fRange) fRange.value = 'month';
        if (fPlatform) fPlatform.value = 'all';
        if (fStatus) fStatus.value = 'all';
        if (fRentability) fRentability.value = 'all';
        triggerFilters();
        DashboardService.showNotification("Filtres réinitialisés", "info");
      });
    }

    // Contrôles du Tableau de Bord (Filtres et Tri spécifiques)
    const dbYear = document.getElementById('db_filter_year');
    const dbTrimester = document.getElementById('db_filter_trimester');
    const dbMonth = document.getElementById('db_filter_month');
    const dbSort = document.getElementById('db_sort_order');

    const triggerDashboardFilters = () => {
      this.filters.dashboardYear = dbYear ? dbYear.value : 'all';
      this.filters.dashboardTrimester = dbTrimester ? dbTrimester.value : 'all';
      this.filters.dashboardMonth = dbMonth ? dbMonth.value : 'all';
      this.filters.dashboardSort = dbSort ? dbSort.value : 'desc';
      this.refreshUI();
    };

    if (dbYear) dbYear.addEventListener('change', triggerDashboardFilters);
    if (dbTrimester) dbTrimester.addEventListener('change', triggerDashboardFilters);
    if (dbMonth) dbMonth.addEventListener('change', triggerDashboardFilters);
    if (dbSort) dbSort.addEventListener('change', triggerDashboardFilters);

    // Réinitialiser les filtres du Tableau de Bord
    const btnDbReset = document.getElementById('btn_db_reset');
    if (btnDbReset) {
      btnDbReset.addEventListener('click', () => {
        if (dbYear) dbYear.value = 'all';
        if (dbTrimester) dbTrimester.value = 'all';
        if (dbMonth) dbMonth.value = 'all';
        if (dbSort) dbSort.value = 'desc';
        triggerDashboardFilters();
        DashboardService.showNotification("Filtres du tableau de bord réinitialisés", "info");
      });
    }

    // 4. Tri par en-tête des colonnes du tableau (Support de tri multi-colonnes)
    document.querySelectorAll('[data-sort]').forEach(header => {
      header.addEventListener('click', (e) => {
        const field = header.getAttribute('data-sort');
        const isShift = e.shiftKey;

        if (!Array.isArray(this.sortState)) {
          this.sortState = [this.sortState];
        }

        const existingIndex = this.sortState.findIndex(item => item.field === field);

        if (isShift) {
          // Tri multi-colonnes cumulatif
          if (existingIndex !== -1) {
            // Inverser la direction pour cette colonne existante
            this.sortState[existingIndex].direction = this.sortState[existingIndex].direction === 'asc' ? 'desc' : 'asc';
            DashboardService.showNotification(`Ordre de tri modulé pour la colonne : ${field}`, "info");
          } else {
            // Ajouter la colonne à la fin du tri
            this.sortState.push({ field, direction: 'desc' });
            DashboardService.showNotification(`Ajout au tri multiniveau : ${field}`, "info");
          }
        } else {
          // Tri simple classique
          if (this.sortState.length === 1 && this.sortState[0].field === field) {
            // Inverser la direction de l'unique colonne triée
            this.sortState[0].direction = this.sortState[0].direction === 'asc' ? 'desc' : 'asc';
          } else {
            // Réinitialiser la liste pour ne trier que sur cette colonne
            this.sortState = [{ field, direction: 'desc' }];
          }
        }

        // Mettre à jour la visibilité du bouton de réinitialisation du tri
        const btnResetSort = document.getElementById('btn_reset_sort');
        if (btnResetSort) {
          if (this.sortState.length > 1 || (this.sortState.length === 1 && (this.sortState[0].field !== 'date' || this.sortState[0].direction !== 'desc'))) {
            btnResetSort.classList.remove('hidden');
          } else {
            btnResetSort.classList.add('hidden');
          }
        }

        this.refreshUI();
      });
    });

    const btnApplyMultiSort = document.getElementById('btn_apply_multi_sort');
    if (btnApplyMultiSort) {
      btnApplyMultiSort.addEventListener('click', () => {
        const state = [];
        const f1 = document.getElementById('sort_field_1')?.value;
        const d1 = document.getElementById('sort_dir_1')?.value;
        if (f1 && f1 !== 'none') {
          state.push({ field: f1, direction: d1 });
        }

        const f2 = document.getElementById('sort_field_2')?.value;
        const d2 = document.getElementById('sort_dir_2')?.value;
        if (f2 && f2 !== 'none' && !state.some(item => item.field === f2)) {
          state.push({ field: f2, direction: d2 });
        }

        const f3 = document.getElementById('sort_field_3')?.value;
        const d3 = document.getElementById('sort_dir_3')?.value;
        if (f3 && f3 !== 'none' && !state.some(item => item.field === f3)) {
          state.push({ field: f3, direction: d3 });
        }

        if (state.length > 0) {
          this.sortState = state;
          
          // Mettre à jour la visibilité du bouton de réinitialisation du tri
          const btnResetSort = document.getElementById('btn_reset_sort');
          if (btnResetSort) {
            btnResetSort.classList.remove('hidden');
          }
          
          this.refreshUI();
          DashboardService.showNotification("Tri multi-critères appliqué avec succès !", "success");
        } else {
          DashboardService.showNotification("Veuillez sélectionner au moins un critère de tri.", "warning");
        }
      });
    }

    const btnResetSort = document.getElementById('btn_reset_sort');
    if (btnResetSort) {
      btnResetSort.addEventListener('click', () => {
        this.sortState = [{ field: 'date', direction: 'desc' }];
        btnResetSort.classList.add('hidden');
        this.refreshUI();
        DashboardService.showNotification("Tri intelligent réinitialisé (Date décroissante)", "info");
      });
    }

    // 4.5. Tri rapide mobile
    const mobileSortDate = document.getElementById('mobileSortDate');
    const mobileSortGain = document.getElementById('mobileSortGain');

    const handleMobileSort = (field) => {
      if (!Array.isArray(this.sortState)) {
        this.sortState = [this.sortState];
      }
      if (this.sortState.length === 1 && this.sortState[0].field === field) {
        this.sortState[0].direction = this.sortState[0].direction === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortState = [{ field, direction: 'desc' }];
      }

      // Mettre à jour la visibilité du bouton de réinitialisation du tri
      const currentResetBtn = document.getElementById('btn_reset_sort');
      if (currentResetBtn) {
        if (this.sortState.length > 1 || (this.sortState.length === 1 && (this.sortState[0].field !== 'date' || this.sortState[0].direction !== 'desc'))) {
          currentResetBtn.classList.remove('hidden');
        } else {
          currentResetBtn.classList.add('hidden');
        }
      }

      this.refreshUI();
      const dirText = this.sortState[0].direction === 'asc' ? 'croissant' : 'décroissant';
      const label = field === 'date' ? 'date' : 'Gain Brut';
      DashboardService.showNotification(`Trié par ${label} ${dirText}`, "info");
    };

    if (mobileSortDate) {
      mobileSortDate.addEventListener('click', () => handleMobileSort('date'));
    }
    if (mobileSortGain) {
      mobileSortGain.addEventListener('click', () => handleMobileSort('gain'));
    }

    // 5. Pagination
    const btnPagePrev = document.getElementById('btnPagePrev');
    const btnPageNext = document.getElementById('btnPageNext');
    const selectPageSize = document.getElementById('pageSizeSelect');

    if (btnPagePrev) {
      btnPagePrev.addEventListener('click', () => {
        if (TableService.currentPage > 1) {
          TableService.currentPage--;
          this.refreshUI();
          // Défilement doux vers le haut du tableau pour le confort
          document.getElementById('section-missions').scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    if (btnPageNext) {
      btnPageNext.addEventListener('click', () => {
        TableService.currentPage++;
        this.refreshUI();
        document.getElementById('section-missions').scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (selectPageSize) {
      selectPageSize.addEventListener('change', () => {
        TableService.pageSize = Number(selectPageSize.value) || 10;
        TableService.currentPage = 1;
        this.refreshUI();
      });
    }

    // 6. Gestion du Formulaire de saisie de mission & Modals
    const btnAddMission = document.getElementById('btn_add_mission');
    const btnQuickAdd = document.getElementById('btn_quick_add');
    const btnCloseModal = document.getElementById('btn_close_modal');
    const btnCancelModal = document.getElementById('btn_cancel_modal');
    const formMission = document.getElementById('missionForm');

    if (btnAddMission) btnAddMission.addEventListener('click', () => ModalService.openAddModal());
    if (btnQuickAdd) btnQuickAdd.addEventListener('click', () => {
      this.switchView('missions');
      ModalService.openAddModal();
    });
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => ModalService.closeModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => ModalService.closeModal());
    if (formMission) formMission.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Fermeture de la modal en cliquant à l'extérieur
    const modalBg = document.getElementById('missionModal');
    if (modalBg) {
      modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
          ModalService.closeModal();
        }
      });
    }

    // 7. Actions d'exportations
    const btnCsvToggle = document.getElementById('btn_export_csv_toggle');
    const csvMenu = document.getElementById('export_csv_menu');
    const btnCsvStd = document.getElementById('btn_export_csv_std');
    const btnCsvWeekly = document.getElementById('btn_export_csv_weekly');
    const btnCsvMonthly = document.getElementById('btn_export_csv_monthly');
    const btnExportExcel = document.getElementById('btn_export_excel');

    const btnPdfToggle = document.getElementById('btn_print_pdf_toggle');
    const pdfMenu = document.getElementById('print_pdf_menu');
    const btnPdfStd = document.getElementById('btn_print_pdf_std');
    const btnPdfMonthly = document.getElementById('btn_print_pdf_monthly');
    const btnPdfTrimester = document.getElementById('btn_print_pdf_trimester');
    const btnPdfYearly = document.getElementById('btn_print_pdf_yearly');

    if (btnCsvToggle && csvMenu) {
      btnCsvToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        csvMenu.classList.toggle('hidden');
        if (pdfMenu) pdfMenu.classList.add('hidden'); // Fermer l'autre menu
      });

      // Fermer le menu si clic en dehors
      document.addEventListener('click', (e) => {
        if (!csvMenu.classList.contains('hidden') && !csvMenu.contains(e.target) && e.target !== btnCsvToggle) {
          csvMenu.classList.add('hidden');
        }
      });

      if (btnCsvStd) {
        btnCsvStd.addEventListener('click', () => {
          ExportService.exportToCSV(this.filteredMissions);
          csvMenu.classList.add('hidden');
          DashboardService.showNotification("Fichier CSV téléchargé avec succès !", "success");
        });
      }

      if (btnCsvWeekly) {
        btnCsvWeekly.addEventListener('click', () => {
          ExportService.exportToCSVWeekly(this.filteredMissions);
          csvMenu.classList.add('hidden');
          DashboardService.showNotification("Bilan hebdomadaire CSV exporté avec succès !", "success");
        });
      }

      if (btnCsvMonthly) {
        btnCsvMonthly.addEventListener('click', () => {
          ExportService.exportToCSVMonthly(this.filteredMissions);
          csvMenu.classList.add('hidden');
          DashboardService.showNotification("Bilan mensuel CSV exporté avec succès !", "success");
        });
      }
    }

    if (btnPdfToggle && pdfMenu) {
      btnPdfToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        pdfMenu.classList.toggle('hidden');
        if (csvMenu) csvMenu.classList.add('hidden'); // Fermer l'autre menu
      });

      // Fermer le menu si clic en dehors
      document.addEventListener('click', (e) => {
        if (!pdfMenu.classList.contains('hidden') && !pdfMenu.contains(e.target) && e.target !== btnPdfToggle) {
          pdfMenu.classList.add('hidden');
        }
      });

      const handlePrint = (type, modeLabel) => {
        const stats = StatsService.calculateFinancials(this.filteredMissions, this.settings);
        ExportService.printReport(this.filteredMissions, stats, this.settings, type);
        pdfMenu.classList.add('hidden');
        DashboardService.showNotification(`Impression du bilan fiscal (${modeLabel}) lancé !`, "info");
      };

      if (btnPdfStd) {
        btnPdfStd.addEventListener('click', () => handlePrint('none', 'standard'));
      }
      if (btnPdfMonthly) {
        btnPdfMonthly.addEventListener('click', () => handlePrint('monthly', 'mensuel'));
      }
      if (btnPdfTrimester) {
        btnPdfTrimester.addEventListener('click', () => handlePrint('trimester', 'trimestriel'));
      }
      if (btnPdfYearly) {
        btnPdfYearly.addEventListener('click', () => handlePrint('yearly', 'annuel'));
      }
    }

    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => {
        ExportService.exportToExcel(this.filteredMissions);
        DashboardService.showNotification("Fichier Excel généré !", "success");
      });
    }

    const btnImportExcel = document.getElementById('btn_import_excel');
    const inputImportExcel = document.getElementById('input_import_excel');
    if (btnImportExcel && inputImportExcel) {
      btnImportExcel.addEventListener('click', () => {
        inputImportExcel.click();
      });
      inputImportExcel.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        this.importMissionsFromExcel(file);
        // Clear input to allow re-importing the same file
        inputImportExcel.value = '';
      });
    }

    // 8. Sauvegarde des Paramètres de l'entreprise et de l'utilisateur
    const formSettings = document.getElementById('settingsForm');
    if (formSettings) {
      // Préremplir les champs existants
      document.getElementById('set_nom_complet').value = this.settings.nom || '';
      document.getElementById('set_entreprise').value = this.settings.statutEntreprise || '';
      document.getElementById('set_urssaf').value = this.settings.urssafRate || 23;
      document.getElementById('set_default_fuel_price').value = this.settings.defaultFuelPrice !== undefined ? this.settings.defaultFuelPrice : 1.85;
      document.getElementById('set_avg_consumption').value = this.settings.averageConsumption !== undefined ? this.settings.averageConsumption : 6.5;
      document.getElementById('set_frais_fixes').value = this.settings.fraisFixesMensuels || 0;
      document.getElementById('set_usure_kilometrique').value = this.settings.usureKilometrique !== undefined ? this.settings.usureKilometrique : 0.22;
      document.getElementById('set_deprec_enabled').checked = !!this.settings.deprecEnabled;
      document.getElementById('set_deprec_purchase').value = this.settings.deprecPurchase !== undefined ? this.settings.deprecPurchase : 20000;
      document.getElementById('set_deprec_residual').value = this.settings.deprecResidual !== undefined ? this.settings.deprecResidual : 5000;
      document.getElementById('set_deprec_years').value = this.settings.deprecYears !== undefined ? this.settings.deprecYears : 5;

      // Préremplir les options de calcul automatique URSSAF
      const setUrssafAuto = document.getElementById('set_urssaf_auto');
      const setUrssafActivity = document.getElementById('set_urssaf_activity');
      const setUrssafAcre = document.getElementById('set_urssaf_acre');
      const setUrssafVl = document.getElementById('set_urssaf_vl');
      const setUrssafCfp = document.getElementById('set_urssaf_cfp');
      const urssafAutoFields = document.getElementById('urssaf_auto_fields');

      if (setUrssafAuto) {
        setUrssafAuto.checked = !!this.settings.urssafAutoCalc;
        
        const adjustManualInputState = () => {
          const manualInput = document.getElementById('set_urssaf');
          if (setUrssafAuto.checked) {
            urssafAutoFields.classList.remove('hidden');
            if (manualInput) {
              manualInput.disabled = true;
              manualInput.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
            }
          } else {
            urssafAutoFields.classList.add('hidden');
            if (manualInput) {
              manualInput.disabled = false;
              manualInput.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
            }
          }
        };

        adjustManualInputState();
        setUrssafAuto.addEventListener('change', adjustManualInputState);
      }

      if (setUrssafActivity) setUrssafActivity.value = this.settings.urssafActivityType || 'service_commercial';
      if (setUrssafAcre) setUrssafAcre.value = this.settings.urssafAcre || 'no';
      if (setUrssafVl) setUrssafVl.checked = !!this.settings.urssafvl;
      if (setUrssafCfp) setUrssafCfp.checked = !!this.settings.urssafCfp;
 
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        this.settings.nom = document.getElementById('set_nom_complet').value.trim() || 'BINIAM Semere';
        this.settings.statutEntreprise = document.getElementById('set_entreprise').value.trim() || 'Auto-Entrepreneur';
        this.settings.urssafRate = Number(document.getElementById('set_urssaf').value) || 23;
        this.settings.defaultFuelPrice = Number(document.getElementById('set_default_fuel_price').value) || 1.85;
        this.settings.averageConsumption = Number(document.getElementById('set_avg_consumption').value) || 6.5;
        this.settings.fraisFixesMensuels = Number(document.getElementById('set_frais_fixes').value) || 0;
        this.settings.usureKilometrique = Number(document.getElementById('set_usure_kilometrique').value) || 0;
        this.settings.deprecEnabled = document.getElementById('set_deprec_enabled').checked;
        this.settings.deprecPurchase = Number(document.getElementById('set_deprec_purchase').value) || 20000;
        this.settings.deprecResidual = Number(document.getElementById('set_deprec_residual').value) || 5000;
        this.settings.deprecYears = Number(document.getElementById('set_deprec_years').value) || 5;

        // Récupérer les nouveaux paramètres
        this.settings.urssafAutoCalc = document.getElementById('set_urssaf_auto').checked;
        this.settings.urssafActivityType = document.getElementById('set_urssaf_activity').value;
        this.settings.urssafAcre = document.getElementById('set_urssaf_acre').value;
        this.settings.urssafvl = document.getElementById('set_urssaf_vl').checked;
        this.settings.urssafCfp = document.getElementById('set_urssaf_cfp').checked;
 
        StorageService.saveSettings(this.settings);
        this.refreshUI();
        DashboardService.showNotification("Paramètres sauvegardés !", "success");
        
        // Mettre à jour l'en-tête de bienvenue
        const welcomeUserEl = document.getElementById('user_welcome_name');
        if (welcomeUserEl) welcomeUserEl.innerText = this.settings.nom;
      });
    }
 
    // Réinitialisation d'usine totale (Bouton Reset)
    const btnFactoryReset = document.getElementById('btn_danger_reset');
    if (btnFactoryReset) {
      btnFactoryReset.addEventListener('click', () => {
        if (confirm("⚠️ Voulez-vous TOUT réinitialiser ? Toutes vos missions de convoyage ajoutées personnellement seront définitivement perdues, et la démo sera rechargée.")) {
          StorageService.resetAll().then(m => {
            this.missions = m;
            this.settings = StorageService.loadSettings();
            this.populateClientFilters();
            
            // Re-remplir les paramètres du formulaire settings
            document.getElementById('set_nom_complet').value = this.settings.nom || 'BINIAM Semere';
            document.getElementById('set_entreprise').value = this.settings.statutEntreprise || 'Auto-Entrepreneur';
            document.getElementById('set_urssaf').value = this.settings.urssafRate || 23;
            document.getElementById('set_default_fuel_price').value = this.settings.defaultFuelPrice !== undefined ? this.settings.defaultFuelPrice : 1.85;
            document.getElementById('set_avg_consumption').value = this.settings.averageConsumption !== undefined ? this.settings.averageConsumption : 6.5;
            document.getElementById('set_frais_fixes').value = this.settings.fraisFixesMensuels || 0;
            document.getElementById('set_usure_kilometrique').value = this.settings.usureKilometrique !== undefined ? this.settings.usureKilometrique : 0.22;
            document.getElementById('set_deprec_enabled').checked = !!this.settings.deprecEnabled;
            document.getElementById('set_deprec_purchase').value = this.settings.deprecPurchase !== undefined ? this.settings.deprecPurchase : 20000;
            document.getElementById('set_deprec_residual').value = this.settings.deprecResidual !== undefined ? this.settings.deprecResidual : 5000;
            document.getElementById('set_deprec_years').value = this.settings.deprecYears !== undefined ? this.settings.deprecYears : 5;

            // Re-remplir le calcul d'URSSAF automatique
            const setUrssafAuto = document.getElementById('set_urssaf_auto');
            if (setUrssafAuto) {
              setUrssafAuto.checked = !!this.settings.urssafAutoCalc;
              const setUrssafActivity = document.getElementById('set_urssaf_activity');
              const setUrssafAcre = document.getElementById('set_urssaf_acre');
              const setUrssafVl = document.getElementById('set_urssaf_vl');
              const setUrssafCfp = document.getElementById('set_urssaf_cfp');
              const urssafAutoFields = document.getElementById('urssaf_auto_fields');
              const manualInput = document.getElementById('set_urssaf');

              if (setUrssafActivity) setUrssafActivity.value = this.settings.urssafActivityType || 'service_commercial';
              if (setUrssafAcre) setUrssafAcre.value = this.settings.urssafAcre || 'no';
              if (setUrssafVl) setUrssafVl.checked = !!this.settings.urssafvl;
              if (setUrssafCfp) setUrssafCfp.checked = !!this.settings.urssafCfp;

              if (setUrssafAuto.checked) {
                if (urssafAutoFields) urssafAutoFields.classList.remove('hidden');
                if (manualInput) {
                  manualInput.disabled = true;
                  manualInput.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
                }
              } else {
                if (urssafAutoFields) urssafAutoFields.classList.add('hidden');
                if (manualInput) {
                  manualInput.disabled = false;
                  manualInput.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-400', 'cursor-not-allowed');
                }
              }
            }

            TableService.currentPage = 1;
            this.refreshUI();
            DashboardService.showNotification("Base réinitialisée à zéro.", "danger");
          });
        }
      });
    }

    // 9. Synchronisation Google Drive (Sauvegarde et Restauration)
    window.addEventListener('google-drive-ready', async (e) => {
      const token = e.detail;
      this.googleDriveToken = token;
      this.updateDriveSyncUI(token);
      await this.autoSyncDrive(token);
    });

    window.addEventListener('google-drive-lost', () => {
      this.googleDriveToken = null;
      this.updateDriveSyncUI(null);
    });

    const btnBackup = document.getElementById('btn_drive_backup');
    const btnRestore = document.getElementById('btn_drive_restore');
    const btnAutoSync = document.getElementById('btn_drive_autosync');

    if (btnBackup) {
      btnBackup.addEventListener('click', async () => {
        if (!this.googleDriveToken) return;
        btnBackup.disabled = true;
        const origText = btnBackup.innerHTML;
        btnBackup.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i> Envoi en cours...`;
        if (window.lucide) window.lucide.createIcons();
        await this.backupToDrive(this.googleDriveToken, true);
        btnBackup.innerHTML = origText;
        btnBackup.disabled = false;
        if (window.lucide) window.lucide.createIcons();
      });
    }

    if (btnRestore) {
      btnRestore.addEventListener('click', async () => {
        if (!this.googleDriveToken) return;
        if (confirm("⚠️ Souhaitez-vous restaurer les données Cloud ? Vos missions locales seront écrasées par celles enregistrées sur Google Drive.")) {
          btnRestore.disabled = true;
          const origText = btnRestore.innerHTML;
          btnRestore.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i> Récupération...`;
          if (window.lucide) window.lucide.createIcons();
          await this.restoreFromDrive(this.googleDriveToken);
          btnRestore.innerHTML = origText;
          btnRestore.disabled = false;
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    if (btnAutoSync) {
      btnAutoSync.addEventListener('click', async () => {
        if (!this.googleDriveToken) return;
        btnAutoSync.disabled = true;
        const origText = btnAutoSync.innerHTML;
        btnAutoSync.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i> Synchronisation...`;
        if (window.lucide) window.lucide.createIcons();
        await this.autoSyncDrive(this.googleDriveToken);
        btnAutoSync.innerHTML = origText;
        btnAutoSync.disabled = false;
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Vérifier si un jeton d'accès est déjà configuré à l'initialisation
    if (window.googleDriveAccessToken) {
      this.googleDriveToken = window.googleDriveAccessToken;
      this.updateDriveSyncUI(this.googleDriveToken);
      this.autoSyncDrive(this.googleDriveToken);
    }
  }

  /**
   * Applique les règles visuelles de l'app en fonction du rôle (Admin / Comptable)
   */
  applyRbacPermissions() {
    if (!this.currentUser) return;

    const userRole = (this.currentUser.role || '').toUpperCase();

    // 1. Configurer l'identité de l'avatar et du profil utilisateur en bas de page
    const avatar = document.getElementById('userHeaderAvatar');
    if (avatar) {
      const parts = this.currentUser.fullname.split(' ');
      const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      avatar.innerText = initials || '--';
    }

    const welcomeName = document.getElementById('user_welcome_name');
    if (welcomeName) welcomeName.innerText = this.currentUser.fullname;

    const welcomeRole = document.getElementById('user_welcome_role');
    if (welcomeRole) {
      welcomeRole.innerText = (userRole === 'ADMIN') ? 'Administrateur' : 'Expert Comptable';
    }

    // 2. visibilité des éléments de navigation selon le grade
    const adminMenuGroup = document.getElementById('admin-menu-group');

    if (userRole === 'ACCOUNTANT') {
      document.body.classList.add('is-accountant');

      // Hide desktop nav items
      const restrictedDesktop = ['nav_planner', 'nav_settings'];
      restrictedDesktop.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      if (adminMenuGroup) adminMenuGroup.classList.add('hidden');

      // Hide mobile nav items
      const restrictedMobile = ['planner', 'settings'];
      document.querySelectorAll('.mobile-nav-btn[data-view]').forEach(btn => {
        if (restrictedMobile.includes(btn.getAttribute('data-view'))) {
          btn.classList.add('hidden');
        }
      });

      // Masquer les boutons d'actions rapides de création de missions sur le dashboard et dans la liste
      const rbacButtons = [
        'btn_quick_add',
        'btn_dashboard_add_mission',
        'btn_add_mission',
        'btn_hero_add_mission'
      ];
      
      rbacButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.add('hidden');
          btn.style.setProperty('display', 'none', 'important');
        }
      });

      // Forcer le re-calcul des cartes
      this.applyAccountantDashboardLayout();
    } else {
      document.body.classList.remove('is-accountant');
      
      const unrestricted = ['nav_planner', 'nav_settings'];
      unrestricted.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
      });

      if (adminMenuGroup) adminMenuGroup.classList.remove('hidden');
      
      const rbacButtons = [
        'btn_quick_add',
        'btn_dashboard_add_mission',
        'btn_add_mission',
        'btn_hero_add_mission'
      ];
      
      rbacButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.remove('hidden');
          btn.style.display = ''; // Restore default
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Ajuste la structure visuelle du Dashboard pour l'Expert Comptable
   * - Affiche uniquement : CA Mensuel, CA Trimestriel, CA Annuel
   * - Conserve et affiche les boutons d'impressions pdf
   * - Masque tous les graphiques d'analyse d'activité et échéancier de cotisations
   */
  applyAccountantDashboardLayout() {
    // 1. Permuter les grilles de KPIs
    const dbKpiGridAdmin = document.getElementById('db_kpi_grid_admin');
    const dbKpiGridAdmin2 = document.getElementById('db_kpi_grid_admin_2');
    const accountantKpiGrid = document.getElementById('accountant_kpi_grid');

    // Pour l'expert comptable, on veut montrer le dashboard admin standard s'ils demandent "full access"
    // mais on garde les filtres spécialisés si besoin.
    // Selon la demande "full access to dashboard", on s'assure que dbKpiGridAdmin est visible.
    if (dbKpiGridAdmin) dbKpiGridAdmin.classList.remove('hidden');
    if (dbKpiGridAdmin2) dbKpiGridAdmin2.classList.remove('hidden');
    if (accountantKpiGrid) accountantKpiGrid.classList.remove('hidden');

    // 2. S'assurer que les analyses sont visibles (Full access)
    const dbChartsGroup1 = document.getElementById('db_charts_group_1');
    const dbChartsGroup2 = document.getElementById('db_charts_group_2');
    const dbUrssafReportingCard = document.getElementById('db_urssaf_reporting_card');

    if (dbChartsGroup1) dbChartsGroup1.classList.remove('hidden');
    if (dbChartsGroup2) dbChartsGroup2.classList.remove('hidden');
    if (dbUrssafReportingCard) dbUrssafReportingCard.classList.remove('hidden');

    // Dévoilement progressif automatique pour l'Expert Comptable
    const kpiContainer = document.getElementById('advanced_kpis_container');
    const chartsContainer = document.getElementById('advanced_charts_container');
    if (kpiContainer) {
      kpiContainer.classList.remove('hidden');
      const label = document.getElementById('toggle_kpis_btn_text');
      if (label) label.innerText = 'Masquer les indicateurs avancés';
      const iconOpen = document.getElementById('toggle_kpis_icon_open');
      const iconClosed = document.getElementById('toggle_kpis_icon_closed');
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClosed) iconClosed.classList.remove('hidden');
    }
    if (chartsContainer) {
      chartsContainer.classList.remove('hidden');
      const label = document.getElementById('toggle_charts_btn_text');
      if (label) label.innerText = 'Masquer les analyses et graphiques';
      const iconOpen = document.getElementById('toggle_charts_icon_open');
      const iconClosed = document.getElementById('toggle_charts_icon_closed');
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClosed) iconClosed.classList.remove('hidden');
    }

    // 3. Calculer les statistiques du chiffre d'affaires
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth(); // 0-11
    const currentTrimestre = Math.floor(currentMonthNum / 3) + 1; // 1, 2, 3, 4

    let caMensuel = 0;
    let caTrimestriel = 0;
    let caAnnuel = 0;

    this.missions.forEach(m => {
      const isCanceled = (m.statut || '').trim().toLowerCase() === 'annulée';
      if (isCanceled) return;

      if (m.date) {
        const parts = m.date.split('-');
        if (parts.length >= 2) {
          const mYear = parseInt(parts[0], 10);
          const mMonth = parseInt(parts[1], 10) - 1; // Convert to 0-11
          const mTrimestre = Math.floor(mMonth / 3) + 1;

          const gain = Number(m.gain) || 0;

          if (mYear === currentYear) {
            caAnnuel += gain;
            if (mTrimestre === currentTrimestre) {
              caTrimestriel += gain;
            }
            if (mMonth === currentMonthNum) {
              caMensuel += gain;
            }
          }
        }
      }
    });

    const formatEuro = (v) => {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
    };

    const elMensuel = document.getElementById('stat_accountant_ca_mensuel');
    const elTrimestriel = document.getElementById('stat_accountant_ca_trimestriel');
    const elAnnuel = document.getElementById('stat_accountant_ca_annuel');

    if (elMensuel) window.DashboardService.animateValue('stat_accountant_ca_mensuel', caMensuel, formatEuro);
    if (elTrimestriel) window.DashboardService.animateValue('stat_accountant_ca_trimestriel', caTrimestriel, formatEuro);
    if (elAnnuel) window.DashboardService.animateValue('stat_accountant_ca_annuel', caAnnuel, formatEuro);

    // Ajustement dynamique des étiquettes descriptives
    const monthNamesFr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const labelMensuel = document.getElementById('stat_accountant_ca_mensuel_label');
    const labelTrimestriel = document.getElementById('stat_accountant_ca_trimestriel_label');
    const labelAnnuel = document.getElementById('stat_accountant_ca_annuel_label');

    if (labelMensuel) labelMensuel.innerText = `Mois de ${monthNamesFr[currentMonthNum]} ${currentYear}`;
    if (labelTrimestriel) labelTrimestriel.innerText = `Trimestre T${currentTrimestre} ${currentYear}`;
    if (labelAnnuel) labelAnnuel.innerText = `Année civile ${currentYear}`;

    // 4. Générer le Tableau de Bord complet pour l'Expert Comptable
    const accountantReportSec = document.getElementById('accountant_report_section');
    if (accountantReportSec) accountantReportSec.classList.remove('hidden');

    // Extra force hiding for creation buttons
    const rbacButtons = ['btn_quick_add', 'btn_dashboard_add_mission', 'btn_add_mission', 'btn_hero_add_mission'];
    rbacButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.add('hidden');
        btn.style.setProperty('display', 'none', 'important');
      }
    });

    let totalMissions = 0;
    let totalExpenses = 0;
    let totalGainFiltered = 0;
    let totalDistanceFiltered = 0;

    const tbody = document.getElementById('accountant_report_tbody');
    if (tbody) tbody.innerHTML = '';

    const sortedMissions = [...(this.filteredMissions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedMissions.forEach(m => {
      const isCanceled = (m.statut || '').trim().toLowerCase() === 'annulée';
      if (isCanceled) return;

      totalMissions++;
      const mGain = Number(m.gain) || 0;
      const mExpenses = (Number(m.carburant) || 0) + (Number(m.peage) || 0) + (Number(m.lavage) || 0) + (Number(m.prixRetour) || 0);
      const mNet = mGain - mExpenses;
      const mDistance = Number(m.kilometrage) || 0;

      totalGainFiltered += mGain;
      totalExpenses += mExpenses;
      totalDistanceFiltered += mDistance;

      if (tbody) {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all font-sans";
        
        const mDateStr = m.date ? new Date(m.date).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        }) : '--';

        const statusBadge = (m.statut || '').trim().toLowerCase() === 'payée' 
          ? `<span class="px-2 py-0.5 text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 border border-emerald-150/45 rounded-full uppercase">Payée</span>`
          : (m.statut || '').trim().toLowerCase() === 'validée'
            ? `<span class="px-2 py-0.5 text-[9px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400 border border-blue-150/45 rounded-full uppercase">Validée</span>`
            : `<span class="px-2 py-0.5 text-[9px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-655 dark:text-amber-400 border border-amber-150/45 rounded-full uppercase">En cours</span>`;

        tr.innerHTML = `
          <td class="py-3 px-4 whitespace-nowrap font-semibold text-slate-500 font-mono">${mDateStr}</td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-bold text-slate-800 dark:text-white">${m.vehicle || '--'}</div>
            <div class="text-[9px] text-slate-405 font-medium font-mono">${m.immatriculation || '--'}</div>
          </td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-705 dark:text-slate-300 max-w-[200px]" title="${m.depart || ''} ➔ ${m.destination || ''}">
            ${m.depart || ''} <span class="text-indigo-400 font-bold">➔</span> ${m.destination || ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap text-slate-500 font-semibold">${m.plateforme || '--'}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap font-bold text-slate-900 dark:text-white font-mono">${formatEuro(mGain)}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap font-semibold text-rose-500 dark:text-rose-450 font-mono">${formatEuro(mExpenses)}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap font-bold font-mono ${mNet >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600' }">${formatEuro(mNet)}</td>
          <td class="py-3 px-4 text-center whitespace-nowrap">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
      }
    });

    if (totalMissions === 0 && tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-slate-400 italic">Aucune mission trouvée pour les filtres sélectionnés.</td>
        </tr>
      `;
    }

    const totalNetFiltered = totalGainFiltered - totalExpenses;
    const avgRentabilityFiltered = totalDistanceFiltered > 0 ? (totalNetFiltered / totalDistanceFiltered) : 0;

    const elTotalMissions = document.getElementById('stat_accountant_total_missions');
    const elTotalExpenses = document.getElementById('stat_accountant_total_expenses');
    const elTotalNet = document.getElementById('stat_accountant_total_net');
    const elAvgRentability = document.getElementById('stat_accountant_avg_rentability');

    if (elTotalMissions) elTotalMissions.innerText = totalMissions;
    if (elTotalExpenses) elTotalExpenses.innerText = formatEuro(totalExpenses);
    if (elTotalNet) elTotalNet.innerText = formatEuro(totalNetFiltered);
    if (elAvgRentability) elAvgRentability.innerText = `${avgRentabilityFiltered.toFixed(3)} €/km`;

    // Connecter les boutons d'action d'export d'activité du comptable
    const btnPrintPdf = document.getElementById('btn_accountant_print_pdf');
    if (btnPrintPdf) {
      btnPrintPdf.onclick = () => {
        const stats = window.StatsService ? window.StatsService.calculateFinancials(this.filteredMissions, this.settings) : {};
        if (window.ExportService) {
          // Remplir les colonnes dans la modal
          const columns = window.ExportService.getColumns();
          const container = document.getElementById('pdfColumnSelection');
          container.innerHTML = columns.map(c => `
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="${c.id}" checked class="form-checkbox text-indigo-600 rounded">
              ${c.label}
            </label>
          `).join('');

          // Ouvrir la modal
          const modal = document.getElementById('pdfExportModal');
          modal.classList.remove('hidden');
          modal.classList.add('flex');

          // Écouteur pour confirmer l'export
          const btnConfirm = document.getElementById('btn_confirm_pdf_export');
          const btnCancel = document.getElementById('btn_cancel_pdf_export');

          const close = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
          };

          btnCancel.onclick = close;
          btnConfirm.onclick = () => {
            const selected = Array.from(container.querySelectorAll('input:checked')).map(i => i.value);
            window.ExportService.printReport(this.filteredMissions, stats, this.settings, 'none', selected);
            if (window.DashboardService) {
              window.DashboardService.showNotification("Impression du rapport fiscal d'activité lancée.", "info");
            }
            close();
          };
        }
      };
    }

    const btnExportExcel = document.getElementById('btn_accountant_export_excel');
    if (btnExportExcel) {
      btnExportExcel.onclick = () => {
        if (window.ExportService) {
          window.ExportService.exportToExcel(this.filteredMissions);
          if (window.DashboardService) {
            window.DashboardService.showNotification("Export du rapport au format Excel effectué.", "success");
          }
        }
      };
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Connecter l'ensemble des écouteurs d'interactivité de la console d'administration
   */
  initAdminPanel() {
    this.usersList = [];
    this.logsList = [];

    // Formulaire d'ouverture du modal de création (supporte les deux IDs caniaux)
    const btnOpenCreate = document.getElementById('btn_add_user') || document.getElementById('btn_open_create_user_modal');
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', () => {
        this.openUserCrudModal(null);
      });
    }

    // Boutons d'annulation et fermeture d'édition utilisateur
    const btnCloseCrud = document.getElementById('btn_close_crud_modal');
    const btnCancelCrud = document.getElementById('btn_cancel_crud');
    if (btnCloseCrud) btnCloseCrud.addEventListener('click', () => this.closeUserCrudModal());
    if (btnCancelCrud) btnCancelCrud.addEventListener('click', () => this.closeUserCrudModal());

    const userForm = document.getElementById('userCrudForm');
    if (userForm) {
      const newForm = userForm.cloneNode(true);
      userForm.parentNode.replaceChild(newForm, userForm);
      newForm.addEventListener('submit', (e) => this.handleUserCrudSubmit(e));
    }

    // Événements de recherche et filtrage des comptes
    const searchUsers = document.getElementById('admin_user_search') || document.getElementById('admin_users_search_input');
    const filterUsersRole = document.getElementById('admin_user_filter_role') || document.getElementById('admin_users_role_filter');
    const filterUsersStatus = document.getElementById('admin_user_filter_status');
    
    if (searchUsers) searchUsers.addEventListener('input', () => this.renderAdminUsers());
    if (filterUsersRole) filterUsersRole.addEventListener('change', () => this.renderAdminUsers());
    if (filterUsersStatus) filterUsersStatus.addEventListener('change', () => this.renderAdminUsers());

    // Événements de recherche et filtrage du Log d'audit
    const searchLogs = document.getElementById('admin_logs_search_input');
    const filterLogsAction = document.getElementById('admin_logs_action_filter');
    const btnRefreshLogs = document.getElementById('btn_refresh_logs');

    if (searchLogs) searchLogs.addEventListener('input', () => this.renderAdminLogs());
    if (filterLogsAction) filterLogsAction.addEventListener('change', () => this.renderAdminLogs());
    if (btnRefreshLogs) {
      btnRefreshLogs.addEventListener('click', () => {
        this.loadAdminLogs();
      });
    }
  }

  /**
   * Charger la liste des utilisateurs du RBAC
   */
  async loadAdminUsers() {
    try {
      const resp = await fetch('/api/admin/users');
      const data = await resp.json();
      if (data.users) {
        this.usersList = data.users;
        this.renderAdminUsers();
      }
    } catch (err) {
      console.error("Impossible d'obtenir les comptes :", err);
    }
  }

  /**
   * Popule et dessine le tableau HTML d'administration des utilisateurs
   */
  renderAdminUsers() {
    const tableBody = document.getElementById('admin_users_table_body');
    if (!tableBody) return;

    const queryEl = document.getElementById('admin_user_search') || document.getElementById('admin_users_search_input');
    const roleEl = document.getElementById('admin_user_filter_role') || document.getElementById('admin_users_role_filter');
    const statusEl = document.getElementById('admin_user_filter_status');

    const query = (queryEl?.value || '').toLowerCase().trim();
    const roleFilter = (roleEl?.value || 'all');
    const statusFilter = (statusEl?.value || 'all');

    tableBody.innerHTML = '';

    const filtered = this.usersList.filter(u => {
      const matchQuery = !query || 
        u.fullname.toLowerCase().includes(query) || 
        u.username.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchQuery && matchRole && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-slate-450 font-medium text-xs font-sans">
            Aucun compte utilisateur enregistré ne correspond à ces critères.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";

      const createdDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '--';

      const roleBadge = u.role === 'ADMIN' 
        ? `<span class="px-2.5 py-1 text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-full border border-indigo-150/40 uppercase">ADMIN</span>`
        : `<span class="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-655 dark:text-amber-400 rounded-full border border-amber-150/40 uppercase">COMPTABLE</span>`;

      const statusBadge = u.status === 'ACTIVE'
        ? `<span class="flex items-center gap-1.5 text-xs text-emerald-555 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-550 animate-pulse"></span>Actif</span>`
        : `<span class="flex items-center gap-1.5 text-xs text-slate-400 font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Inactif</span>`;

      tr.innerHTML = `
        <td class="px-5 py-3.5 whitespace-nowrap">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-indigo-505 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center rounded-lg uppercase shadow-inner">
              ${u.fullname[0]}
            </div>
            <div>
              <p class="text-xs font-bold text-slate-900 dark:text-white">${u.fullname}</p>
              <p class="text-[9px] text-slate-405 font-medium font-sans">Mdp initialisé : ${u.mustChangePassword ? 'Non (Requis)' : 'Oui'}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-3.5 whitespace-nowrap text-xs font-bold text-slate-805 dark:text-slate-300 font-mono">${u.username}</td>
        <td class="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-slate-500 font-sans">${u.email}</td>
        <td class="px-5 py-3.5 whitespace-nowrap">${roleBadge}</td>
        <td class="px-5 py-3.5 whitespace-nowrap">${statusBadge}</td>
        <td class="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400 font-semibold font-sans">${createdDate}</td>
        <td class="px-5 py-3.5 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <button class="btn-action-edit p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors cursor-pointer" title="Modifier">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button class="btn-action-reset-pass p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer" title="Modifier son mot de passe">
              <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
            </button>
            <button class="btn-action-delete p-1.5 text-slate-400 hover:text-rose-605 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer" title="Supprimer">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      `;

      // Assignation dynamique des actions
      tr.querySelector('.btn-action-edit').addEventListener('click', () => {
        this.openUserCrudModal(u);
      });

      tr.querySelector('.btn-action-reset-pass').addEventListener('click', () => {
        this.promptPasswordReset(u);
      });

      tr.querySelector('.btn-action-delete').addEventListener('click', () => {
        this.confirmDeleteUser(u);
      });

      tableBody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Ouvre le modal de création / modification d'utilisateur
   */
  openUserCrudModal(user = null) {
    this.editingUser = user;
    const modal = document.getElementById('userCrudModal');
    const title = document.getElementById('userCrudModalTitle');
    const passContainer = document.getElementById('crud_password_container');
    const passInput = document.getElementById('crud_password');
    const errorMsg = document.getElementById('crud_error_msg');

    if (errorMsg) errorMsg.classList.add('hidden');

    if (modal) modal.style.display = 'flex';

    if (user) {
      if (title) title.innerText = "Modifier l'Utilisateur";
      document.getElementById('crud_fullname').value = user.fullname;
      document.getElementById('crud_username').value = user.username;
      document.getElementById('crud_username').disabled = true;
      document.getElementById('crud_email').value = user.email;
      document.getElementById('crud_role').value = user.role;
      document.getElementById('crud_status').value = user.status;

      if (passContainer) passContainer.classList.add('hidden');
      if (passInput) passInput.removeAttribute('required');
    } else {
      if (title) title.innerText = "Créer un Nouvel Utilisateur";
      document.getElementById('crud_fullname').value = '';
      document.getElementById('crud_username').value = '';
      document.getElementById('crud_username').disabled = false;
      document.getElementById('crud_email').value = '';
      document.getElementById('crud_role').value = 'ACCOUNTANT';
      document.getElementById('crud_status').value = 'ACTIVE';

      if (passContainer) passContainer.classList.remove('hidden');
      if (passInput) passInput.setAttribute('required', 'required');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Ferme le modal d'édition utilisateur
   */
  closeUserCrudModal() {
    const modal = document.getElementById('userCrudModal');
    if (modal) modal.style.display = 'none';
    this.editingUser = null;
  }

  /**
   * Valide le formulaire de création ou de mise à jour d'un compte
   */
  async handleUserCrudSubmit(e) {
    e.preventDefault();
    const errorMsg = document.getElementById('crud_error_msg');
    if (errorMsg) errorMsg.classList.add('hidden');

    const fullname = document.getElementById('crud_fullname').value;
    const username = document.getElementById('crud_username').value;
    const email = document.getElementById('crud_email').value;
    const role = document.getElementById('crud_role').value;
    const status = document.getElementById('crud_status').value;
    const password = document.getElementById('crud_password')?.value;

    const payload = { fullname, email, role, status };

    let url = '/api/admin/users';
    let method = 'POST';

    if (this.editingUser) {
      url = `/api/admin/users/${this.editingUser.username}`;
      method = 'PUT';
    } else {
      // Configuration d'un nouvel utilisateur
      payload.username = username;
      payload.password = password;

      // Valider la robustesse du mot de passe
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(password)) {
        if (errorMsg) {
          errorMsg.innerText = "Le mot de passe provisoire doit contenir d'au moins 8 caractères, un chiffre, une majuscule, une minuscule et un signe spécial.";
          errorMsg.classList.remove('hidden');
        }
        return;
      }
    }

    try {
      const resp = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.success) {
        this.closeUserCrudModal();
        DashboardService.showNotification(this.editingUser ? "Compte mis à jour." : "Compte de sécurité créé !", "success");
        this.loadAdminUsers();
      } else {
        if (errorMsg) {
          errorMsg.innerText = data.error || "Une erreur s'est produite.";
          errorMsg.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error("Échec de la sauvegarde utilisateur :", err);
      if (errorMsg) {
        errorMsg.innerText = "Le serveur est inaccessible pour le moment.";
        errorMsg.classList.remove('hidden');
      }
    }
  }

  /**
   * Procédure de reset du mot de passe initiée par l'Admin
   */
  async promptPasswordReset(user) {
    const newPass = prompt(`Saisir le nouveau mot de passe fort pour : ${user.fullname} (${user.username})`);
    if (newPass === null) return;

    // Validation de robustesse
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regex.test(newPass)) {
      alert("Erreur: Le mot de passe ne convient pas aux critères d'exigences et n'a pas été affecté.");
      return;
    }

    try {
      const resp = await fetch(`/api/admin/users/${user.username}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass })
      });
      const data = await resp.json();
      if (data.success) {
        DashboardService.showNotification(`Mot de passe réaffecté. Nouvelle connexion forcée pour : ${user.username}`, "success");
        this.loadAdminUsers();
      } else {
        alert("Erreur: " + (data.error || "Opération refusée backend."));
      }
    } catch (err) {
      console.error("Reset pass error:", err);
    }
  }

  /**
   * Action de suppression d'utilisateurs
   */
  async confirmDeleteUser(user) {
    if (user.username === this.currentUser.username) {
      alert("Erreur: Impossible de supprimer le compte d'administration en cours d'utilisation !");
      return;
    }

    if (!confirm(`Confirmez-vous la suppression irréversible du compte utilisateur : ${user.fullname} (${user.username}) ?`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/admin/users/${user.username}`, {
        method: 'DELETE'
      });
      const data = await resp.json();
      if (data.success) {
        DashboardService.showNotification("Utilisateur supprimé du registre.", "success");
        this.loadAdminUsers();
      } else {
        alert("Erreur: " + (data.error || "Action impossible."));
      }
    } catch (err) {
      console.error("Delete user error:", err);
    }
  }

  /**
   * Charge le flux unifié d'audit logs
   */
  async loadAdminLogs() {
    try {
      const resp = await fetch('/api/admin/logs');
      const data = await resp.json();
      if (resp.status === 200) {
        this.logsList = data.logs || [];
        this.renderAdminLogs();
      }
    } catch(err) {
      console.error("Audit log error:", err);
    }
  }

  /**
   * Popule et dessine le tableau HTML d'audit logs d'activité
   */
  renderAdminLogs() {
    const tableBody = document.getElementById('admin_logs_table_body');
    if (!tableBody) return;

    // Ajout d'une transition d'opacité pour une expérience fluide
    tableBody.style.transition = 'opacity 0.3s ease-in-out';
    tableBody.style.opacity = '0';

    const query = (document.getElementById('admin_logs_search_input')?.value || '').toLowerCase().trim();
    const actionFilter = (document.getElementById('admin_logs_action_filter')?.value || 'all');

    tableBody.innerHTML = '';

    const filtered = this.logsList.filter(l => {
      const matchQuery = !query ||
        (l.username || '').toLowerCase().includes(query) ||
        (l.action || '').toLowerCase().includes(query) ||
        (l.details || '').toLowerCase().includes(query) ||
        (l.ipAddress || '').toLowerCase().includes(query);
      
      const matchAction = actionFilter === 'all' || 
        (l.action || '').toUpperCase().includes(actionFilter.toUpperCase());

      return matchQuery && matchAction;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-8 text-center text-slate-450 font-medium text-xs font-sans">
            Aucun log d'événement enregistré correspondant.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(l => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors";

      const logDate = l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) : '--';

      const act = String(l.action || '');
      // Design de badges visuels pour chaque événement d'audit majeur
      let actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-slate-50 dark:bg-slate-900 text-slate-505 rounded-md border border-slate-205 dark:border-slate-800 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">${act}</span>`;
      
      if (act.startsWith('AUTH_LOGIN_SUCCESS')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded border border-emerald-150/40 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">CONNEXION</span>`;
      } else if (act.startsWith('AUTH_LOGIN_ERROR')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded border border-rose-150/40 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">ERR COMPTE</span>`;
      } else if (act.startsWith('AUTH_LOGOUT')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">DECONNEXION</span>`;
      } else if (act.includes('USER_CREATE')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded border border-indigo-155/40 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">AJOUT COMPTE</span>`;
      } else if (act.includes('USER_UPDATE')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded border border-blue-155/40 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">MAJ COMPTE</span>`;
      } else if (act.includes('PASSWORD_RESET') || act.includes('PASSWORD_CHANGE')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-450 rounded border border-amber-155/30 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">MODIF PASS</span>`;
      } else if (act.includes('USER_DELETE')) {
        actionTag = `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded border border-rose-200 uppercase font-sans tracking-wide block text-center max-w-[130px] truncate">SUPPR COMPTE</span>`;
      }

      tr.innerHTML = `
        <td class="px-5 py-3 text-xs text-slate-400 font-bold font-mono whitespace-nowrap">${logDate}</td>
        <td class="px-5 py-3 font-extrabold text-xs text-slate-800 dark:text-white whitespace-nowrap">
          <div class="flex items-center gap-1.5 font-sans">
            <i data-lucide="user-cog" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>${l.username || 'SYS'}</span>
          </div>
        </td>
        <td class="px-5 py-3 whitespace-nowrap">${actionTag}</td>
        <td class="px-5 py-3 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">${l.details || '--'}</td>
        <td class="px-5 py-3 text-xs text-slate-400 font-medium font-mono whitespace-nowrap">${l.ipAddress || '127.0.0.1'}</td>
      `;

      tableBody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
    
    // Rétablir l'opacité pour finaliser la transition
    setTimeout(() => {
      tableBody.style.opacity = '1';
    }, 50);
  }
}

// Lancer l'application de convoyage au montage du DOM !
document.addEventListener('DOMContentLoaded', () => {
  const app = new ConvoyageApp();
  window.app = app;
  app.init();
});
