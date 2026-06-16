/**
 * ==========================================================================
 * CONTROLLER APPLICATION - Progressive Web App Shortcut (EDL Launcher)
 * Gère l'installation Android, l'état de connexion et la redirection.
 * ==========================================================================
 */

// CONFIGURATION DU REDIRECTEUR :
// Remplacez cette URL par votre adresse de production d'État des Lieux si nécessaire.
// Par défaut, nous utilisons l'origine hébergeant cette PWA pour garantir un fonctionnement sans configuration.
const CONFIG = {
  redirectUrl: "https://YOUR-ETAT-DES-LIEUX-URL.COM"
};

// Orchestrateur Principal
document.addEventListener("DOMContentLoaded", () => {
  // Initialisation des icônes de Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Détermination de l'URL cible de redirection
  const targetUrl = (CONFIG.redirectUrl === "https://YOUR-ETAT-DES-LIEUX-URL.COM" || !CONFIG.redirectUrl)
    ? window.location.origin
    : CONFIG.redirectUrl;

  console.log("[PWA Launcher] URL de redirection configurée :", targetUrl);

  const loaderScreen = document.getElementById("loader-screen");
  const landingScreen = document.getElementById("main-landing-screen");
  const offlineScreen = document.getElementById("offline-fallback-screen");
  const btnInstall = document.getElementById("btn-install-pwa");
  const installedMsg = document.getElementById("installed-msg");
  const unsupportedMsg = document.getElementById("unsupported-msg");
  const loaderText = document.getElementById("loader-text");

  let deferredPrompt = null;

  // 1. ET 2. SURVEILLANCE DE L'ÉTAT DE CONNEXION INTERNET ET ROUTAGE ACCÈS ADMIN
  async function verifyAccessAndRoute() {
    const restrictionScreen = document.getElementById("admin-restriction-screen");

    // Masquer tous les écrans d'abord
    landingScreen.classList.add("hidden");
    loaderScreen.classList.add("hidden");
    offlineScreen.classList.add("hidden");
    if (restrictionScreen) restrictionScreen.classList.add("hidden");

    if (!navigator.onLine) {
      // Stratégie Offline : on valide via la dernière valeur vérifiée stockée en cache local
      const wasAdmin = localStorage.getItem("pwa_is_admin") === "true";
      if (!wasAdmin) {
        console.warn("[PWA Launcher] Pas de preuve de droits d'accès administrateur hors-ligne.");
        if (restrictionScreen) restrictionScreen.classList.remove("hidden");
      } else {
        console.log("[PWA Launcher] Accès admin prouvé hors-ligne. Affichage de l'explication hors-ligne.");
        offlineScreen.classList.remove("hidden");
      }
      return;
    }

    // En ligne : on interroge le backend sécurisé
    try {
      // Inclure le token de session RBAC stocké par la base d'origine
      const rbacToken = localStorage.getItem("rbac_session_token");
      const headers = {};
      if (rbacToken) {
        headers['X-Session-Token'] = rbacToken;
      }

      console.log("[PWA Launcher] Vérification du rôle utilisateur au serveur...");
      const resp = await fetch('/api/auth/me', { headers });
      if (!resp.ok) {
        throw new Error("Authentification impossible ou session expirée.");
      }

      const data = await resp.json();
      if (data.success && data.user && data.user.role === 'ADMIN') {
        console.log("[PWA Launcher] Authentification Administrateur validée.");
        localStorage.setItem("pwa_is_admin", "true");

        // Routage selon le display mode détecté
        if (checkIsStandalone()) {
          activateRedirection();
        } else {
          console.log("[PWA Launcher] Mode Navigateur détecté. Présentation de la fiche d'installation.");
          landingScreen.classList.remove("hidden");
        }
      } else {
        console.warn("[PWA Launcher] Accès refusé : utilisateur non-administrateur.");
        localStorage.setItem("pwa_is_admin", "false");
        if (restrictionScreen) restrictionScreen.classList.remove("hidden");
      }
    } catch (err) {
      console.warn("[PWA Launcher] Impossible de valider la session rbac ou l'état :", err);
      localStorage.setItem("pwa_is_admin", "false");
      if (restrictionScreen) restrictionScreen.classList.remove("hidden");
    }
  }

  function updateOnlineStatus() {
    verifyAccessAndRoute();
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // 3. DÉTECTION DU MODE DE LANCEMENT (STANDALONE / NAVIGATEUR)
  function checkIsStandalone() {
    const isStandaloneWindow = window.matchMedia('(display-mode: standalone)').matches;
    const isStandaloneNavigator = (window.navigator.standalone === true);
    const hasQueryLaunched = new URLSearchParams(window.location.search).get("launched") === "true";
    
    return isStandaloneWindow || isStandaloneNavigator || hasQueryLaunched;
  }

  // Activer le chargement et la redirection vers l'app réelle
  function activateRedirection() {
    landingScreen.classList.add("hidden");
    offlineScreen.classList.add("hidden");
    if (document.getElementById("admin-restriction-screen")) {
      document.getElementById("admin-restriction-screen").classList.add("hidden");
    }
    loaderScreen.classList.remove("hidden");
    
    loaderText.innerText = "Connexion sécurisée en cours...";

    // Déclencher la redirection après une animation fluide de 2,2 secondes sur l'appareil
    setTimeout(() => {
      console.log("[PWA Launcher] Redirection automatique lancée vers :", targetUrl);
      window.location.replace(targetUrl);
    }, 2200);
  }

  // 4. CAPTURE DE L'ÉVÉNEMENT D'INSTALLATION CHROME (ANDROID)
  window.addEventListener("beforeinstallprompt", (e) => {
    // Empêcher l'apparition immédiate de la mini-bannière par défaut de Chrome
    e.preventDefault();
    // Conserver l'événement pour l'appeler au clic sur le bouton
    deferredPrompt = e;
    
    console.log("[PWA Launcher] Critères d'installation PWA validés par Chrome Android.");

    // Uniquement afficher le bouton d'installation si l'utilisateur est authentifié comme ADMIN
    const isCurrentlyAdmin = localStorage.getItem("pwa_is_admin") === "true";
    if (isCurrentlyAdmin && btnInstall) {
      btnInstall.classList.remove("hidden");
    }
    // Cacher les aides d'installation manuelle puisque le navigateur supporte l'installation assistée
    if (isCurrentlyAdmin && unsupportedMsg) {
      unsupportedMsg.classList.add("hidden");
    }
  });

  // Gestion du clic d'installation
  if (btnInstall) {
    btnInstall.addEventListener("click", async () => {
      if (!deferredPrompt) {
        console.warn("[PWA Launcher] Événement d'installation indisponible.");
        return;
      }
      
      // Déclencher le prompt Chrome natif
      deferredPrompt.prompt();
      
      // Attendre la réponse de l'utilisateur
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA Launcher] Choix utilisateur d'installation : ${outcome}`);
      
      // Reset de l'événement
      deferredPrompt = null;
      btnInstall.classList.add("hidden");
    });
  }

  // Écoute de l'événement d'installation réussie
  window.addEventListener("appinstalled", (evt) => {
    console.log("[PWA Launcher] L'utilisateur a installé la PWA avec succès.");
    
    // Dissimuler le bouton d'installation
    if (btnInstall) btnInstall.classList.add("hidden");
    
    // Afficher l'alerte verte de validation
    if (installedMsg) installedMsg.classList.remove("hidden");
    if (unsupportedMsg) unsupportedMsg.classList.add("hidden");
  });

  // 5. ROUTAGE INITIAL
  verifyAccessAndRoute();
});

// Enregistrement du Service Worker de cache et de secours hors-ligne
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then((registration) => {
        console.log('[PWA Launcher] Service Worker enregistré avec succès ! Scope :', registration.scope);
      }, (err) => {
        console.error('[PWA Launcher] Échec de l\'enregistrement du Service Worker :', err);
      });
  });
}
