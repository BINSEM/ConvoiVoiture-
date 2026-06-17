import React, { useState, useEffect, useRef } from 'react';
import { googleSignIn, initAuth, logout, manualTokenSignIn } from '../driveAuth';
import { jsPDF } from 'jspdf';

const DocumentManager: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualTokenVal, setManualTokenVal] = useState('');
  const [manualEmailVal, setManualEmailVal] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const isIframe = window.self !== window.top;

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error("Erreur de connexion Google Drive:", err);
      let msg = err.message || String(err);
      if (msg.includes("auth/user-cancelled") || msg.includes("cancelled")) {
        msg = "La connexion a été annulée. Si vous utilisez l'aperçu AI Studio (iframe), les restrictions de navigation bloquent souvent les redirections ou popups Google Auth. Veuillez cliquer sur le bouton 'Ouvrir l'application' ci-dessus pour vous connecter sans restriction.";
      } else if (msg.includes("auth/unauthorized-domain")) {
        msg = "Ce domaine n'est pas encore autorisé par Firebase. Veuillez s'assurer d'utiliser l'application via un onglet direct autonome.";
      } else if (msg.includes("auth/network-request-failed") || msg.includes("network-request-failed")) {
        msg = "La requête réseau Firebase a échoué (auth/network-request-failed / CORS policy).\n\n" +
              "Cela se produit généralement parce que le domaine de l'application n'est pas encore enregistré dans la liste des Domaines Autorisés (Authorized Domains) de votre projet Firebase.\n\n" +
              "Pour corriger cela en 2 minutes :\n" +
              "1. Rendez-vous sur la console Firebase (https://console.firebase.google.com/)\n" +
              "2. Allez dans Authentication -> onglet Settings (Paramètres) -> Domaines Autorisés (Authorized Domains)\n" +
              "3. Cliquez sur 'Ajouter un domaine' (Add domain) et ajoutez :\n" +
              "   • " + window.location.host + "\n\n" +
              "Alternativement, vous pouvez utiliser l'authentification manuelle par Jeton ci-dessous en attendant de configurer votre projet Firebase.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenVal.trim()) {
      setErrorMsg("Veuillez saisir un jeton d'accès Google Drive valide.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await manualTokenSignIn(manualTokenVal.trim(), manualEmailVal.trim() || undefined);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error("Erreur d'importation du jeton manuel :", err);
      setErrorMsg("Erreur de jeton manuel: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await logout();
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error("Erreur de déconnexion:", err);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Erreur d'accès à la caméra:", err);
      setErrorMsg("Impossible d'accéder à la caméra. Vérifiez vos permissions.");
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const captureAndConvertToPDF = () => {
    if (!videoRef.current) return;
    
    // Create a canvas to capture the image
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Stop camera
    stopCamera();
    
    // Convert to PDF
    try {
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Document_Scanne_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("Erreur lors de la conversion PDF:", err);
      setErrorMsg("Erreur lors de la création du PDF.");
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center text-slate-500 font-sans">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Initialisation de Google Drive...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between p-6 md:p-8 font-sans">
      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* En-tête de section */}
        <div className="text-center md:text-left space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-55/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase">
            <i data-lucide="cloud" className="w-3.5 h-3.5"></i>
            Intégration Google Workspace
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Sauvegarde & Documents</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Conservez vos rapports d'inspections, anomalies constatées sous forme de photos HD, fiches techniques et kilométrages directement dans votre espace Google Drive sécurisé.
          </p>
        </div>

        {user ? (
          /* CONNECTED STATE */
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border-2 border-indigo-500" />
                ) : (
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 font-bold rounded-full border border-indigo-250 flex items-center justify-center text-lg uppercase shadow-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{user.displayName || 'Conducteur Convoyeur'}</h4>
                  <p className="text-[11px] text-slate-400 font-medium font-mono truncate max-w-[200px] md:max-w-xs">{user.email}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-extrabold text-[10px] uppercase border border-emerald-500/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connecté
              </span>
            </div>

            <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-3">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">État des dossiers sur votre Drive</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-855/40 flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Convoyeur Professionnel</p>
                    <p className="text-[10px] text-slate-400 font-medium">Dossier racine synchronisé</p>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-855/40 flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Images d'inspections</p>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Sauvegardées par immatriculation</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/80">
               <button onClick={startCamera} className="w-full sm:w-auto px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                 <i data-lucide="camera" className="w-4 h-4"></i>
                 Scanner un document (PDF)
               </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={handleSignOut} className="px-4 py-2 bg-slate-200 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Déconnexion Google
              </button>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-125 dark:border-indigo-900 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-250 text-base">Connexion Google Drive Requise</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Connectez votre compte cloud pour débloquer la sauvegarde automatique à l'arrivée de vos convoyages, ainsi que l'archivage de l'historique complet des véhicules livrés.
              </p>
            </div>

            {isIframe && (
              <div className="p-4 bg-amber-50 dark:bg-amber-955/35 border border-amber-200/50 dark:border-amber-900/40 rounded-xl text-left text-amber-800 dark:text-amber-350 space-y-3 max-w-md mx-auto">
                <div className="flex items-center gap-2 font-black text-[10px] uppercase text-amber-600 dark:text-amber-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Restriction iframe détectée</span>
                </div>
                <p className="text-[11px] leading-relaxed font-semibold">
                  Les navigateurs bloquent la connexion sécurisée Google au sein des fenêtres intégrées (iframe). Veuillez <strong>ouvrir l'application dans un nouvel onglet</strong> autonome pour vous connecter en un clic.
                </p>
                <div className="pt-1">
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-[10px] tracking-wide rounded-xl shadow-sm transition-all uppercase cursor-pointer decoration-none"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ouvrir l'application
                  </a>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-905/45 rounded-xl text-left text-rose-800 dark:text-rose-300 space-y-1.5 max-w-md mx-auto">
                <div className="flex items-center gap-2 font-black text-[10px] uppercase text-rose-600 dark:text-rose-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Erreur de Connexion</span>
                </div>
                <p className="text-[11px] leading-relaxed font-semibold whitespace-pre-line">
                  {errorMsg}
                </p>
              </div>
            )}

            {/* Options de Connexion (Standard ou Manuel) */}
            <div className="space-y-4 pt-2">
              {!showManual ? (
                <div className="flex flex-col items-center gap-3">
                  <button onClick={handleSignIn} className="gsi-material-button bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-white dark:text-slate-800 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-all transform active:scale-95 font-bold text-xs uppercase duration-150 w-full max-w-sm justify-center">
                    <div className="gsi-material-button-icon shrink-0">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-sans font-bold">Se connecter avec Google</span>
                  </button>

                  <button 
                    onClick={() => setShowManual(true)} 
                    className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors cursor-pointer bg-none border-none outline-none mt-1"
                  >
                    Problème de connexion (Iframe/Navigateur) ? Authentifier manuellement
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSignIn} className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 max-w-md mx-auto text-left shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Authentification avec Jeton</span>
                    <button 
                      type="button"
                      onClick={() => setShowManual(false)}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer bg-none border-none outline-none"
                    >
                      Retour
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-450 dark:text-slate-400 font-medium leading-relaxed pb-0.5">
                    Entrez un jeton d'accès OAuth2 (Google Access Token) valide obtenu via le <strong>Google OAuth Playground</strong> ou d'autres consoles API pour autoriser directement l'accès à Drive :
                  </p>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Jeton d'accès (Access Token)</label>
                    <input 
                      type="password"
                      placeholder="ya29.a0Axoo..."
                      value={manualTokenVal}
                      onChange={(e) => setManualTokenVal(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg outline-none font-mono focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Adresse Email Google (Facultatif)</label>
                    <input 
                      type="email"
                      placeholder="Ex: selameast@gmail.com"
                      value={manualEmailVal}
                      onChange={(e) => setManualEmailVal(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg outline-none font-mono focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Valider le Jeton manuel
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-6 text-center max-w-sm mx-auto">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          Secured with Google Cloud API & Drive SDK v3
        </p>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden relative">
             {/* Guide rectangle pour le document */}
             <div className="absolute inset-0 z-10 border-[16px] border-black/50 pointer-events-none">
               <div className="w-full h-full border-2 border-indigo-500/80 rounded-xl"></div>
             </div>
             
             <video 
               ref={videoRef} 
               autoPlay 
               playsInline 
               className="w-full h-full object-cover" 
             />
          </div>
          <div className="bg-slate-900 px-6 py-8 flex items-center justify-between text-white pb-safe">
            <button 
              onClick={stopCamera} 
              className="text-slate-300 hover:text-white text-xs uppercase tracking-widest font-bold"
            >
              Annuler
            </button>
            <button 
              onClick={captureAndConvertToPDF} 
              className="w-16 h-16 rounded-full bg-indigo-500 border-4 border-indigo-200 outline outline-offset-4 outline-white hover:bg-indigo-600 transition-colors cursor-pointer"
            >
            </button>
            <div className="w-14"></div> {/* spacer */}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;

