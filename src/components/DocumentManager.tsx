import React, { useState, useEffect, useRef } from 'react';
import { googleSignIn, initAuth, logout, manualTokenSignIn } from '../driveAuth';
import { jsPDF } from 'jspdf';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Trash2, 
  Eye, 
  FileText, 
  Cloud, 
  Server, 
  Upload, 
  Camera, 
  ShieldAlert, 
  ArrowRightLeft, 
  RefreshCw, 
  KeyRound, 
  Plus, 
  Sparkles,
  Info,
  CameraOff
} from 'lucide-react';

interface DocumentItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  bytes: number;
  date: string;
  source: 'local' | 'drive';
  url: string;
}

// Default High-Fidelity SVG templates encoded inline for offline mock documents
const defaultLicense = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="100%" height="100%" fill="%23f0f9ff" rx="20" ry="20"/><rect x="20" y="20" width="560" height="340" fill="%23ffffff" rx="15" ry="15" stroke="%2338bdf8" stroke-width="4"/><circle cx="100" cy="140" r="50" fill="%23cbd5e1" stroke="%2394a3b8" stroke-width="2"/><circle cx="100" cy="120" r="22" fill="%2364748b"/><path d="M70 180 C 70 145, 130 145, 130 180 Z" fill="%2364748b"/><text x="180" y="70" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="%230284c7">RÉPUBLIQUE FRANÇAISE</text><text x="180" y="95" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="%230369a1">RÉSEAU DE CONVOYAGE PROFESSIONNEL</text><line x1="180" y1="110" x2="540" y2="110" stroke="%23e2e8f0" stroke-width="2"/><text x="180" y="140" font-family="monospace" font-size="13" font-weight="extrabold" fill="%23334155">NOM: DUPONT</text><text x="180" y="165" font-family="monospace" font-size="13" font-weight="extrabold" fill="%23334155">PRÉNOM: Jean-Baptiste</text><text x="180" y="190" font-family="monospace" font-size="13" fill="%23475569">RÉF. AGENT: #CONVOY-7842</text><text x="180" y="215" font-family="monospace" font-size="13" fill="%23475569">PERMIS: CATÉGORIE B, C1, C, D1, CE</text><text x="180" y="240" font-family="monospace" font-size="13" fill="%2322c55e" font-weight="bold">STATUT ACCRÉDITATION: VALIDÉ</text><rect x="180" y="260" width="360" height="70" fill="%23fafafa" stroke="%23e2e8f0" rx="8" ry="8"/><text x="195" y="285" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="%2364748b">FÉDÉRATION NATIONALE DU TRANSPORT</text><text x="195" y="305" font-family="system-ui, sans-serif" font-size="10" fill="%2394a3b8">Dossier habilité sous référence n° FR-89412-P</text></svg>';

const defaultTechnical = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850"><rect width="100%" height="100%" fill="%23f8fafc" rx="10" ry="10"/><rect x="20" y="20" width="560" height="810" fill="white" rx="5" ry="5" stroke="%23cbd5e1" stroke-width="2"/><text x="50" y="70" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="%231e293b">FICHE TECHNIQUE VÉHICULE</text><text x="50" y="95" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="%234f46e5">PROTOCOLE CONVOYAGE: VOLVO FH SHIELD</text><line x1="50" y1="115" x2="550" y2="115" stroke="%23e2e8f0" stroke-width="2"/><text x="50" y="150" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="%23475569">CARACTÉRISTIQUES MOTORISATION</text><text x="50" y="180" font-family="monospace" font-size="12" fill="%23334155">Moteur: D16K750 Euro VI-6</text><text x="320" y="180" font-family="monospace" font-size="12" fill="%23334155">Puissance: 750 ch (551 kW)</text><text x="50" y="205" font-family="monospace" font-size="12" fill="%23334155">Limiteur: Actif 90 km/h</text><text x="320" y="205" font-family="monospace" font-size="12" fill="%23334155">Poids Vide (MTR): 8 450 kg</text><line x1="50" y1="230" x2="550" y2="230" stroke="%23e2e8f0" stroke-width="1"/><text x="50" y="265" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="%23475569">CHECKLIST SÉCURITÉ OBLIGATOIRE</text><text x="50" y="295" font-family="system-ui, sans-serif" font-size="11" fill="%2364748b">1. Vérification des ponts à doubles réducteurs</text><text x="50" y="315" font-family="system-ui, sans-serif" font-size="11" fill="%2364748b">2. Test de l\'avertisseur d\'angle mort active-radar</text><text x="50" y="335" font-family="system-ui, sans-serif" font-size="11" fill="%2364748b">3. Pression pneus à vide : Avant 8.0 bar / Arrière 7.5 bar</text><text x="50" y="355" font-family="system-ui, sans-serif" font-size="11" fill="%2364748b">4. Contrôle des batteries auxiliaires de cabine</text><line x1="50" y1="380" x2="550" y2="380" stroke="%23e2e8f0" stroke-width="1"/><text x="50" y="415" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="%23475569">GABARIT DE SÉCURITÉ CONVOYAGE</text><rect x="50" y="440" width="500" height="350" fill="%23f1f5f9" rx="10" ry="10"/><path d="M120 700 L180 580 L340 580 L400 700 L440 700 L400 680 Z" fill="none" stroke="%234f46e5" stroke-width="3"/><circle cx="190" cy="710" r="25" fill="%231e293b" stroke="white" stroke-width="3"/><circle cx="330" cy="710" r="25" fill="%231e293b" stroke="white" stroke-width="3"/><text x="180" y="520" font-family="system-ui, sans-serif" font-size="14" font-weight="black" fill="%234f46e5">GABARIT TECHNIQUE DE TRANSPORTEUR</text></svg>';

const defaultInsurance = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="100%" height="100%" fill="%23f0fdf4" rx="20" ry="20"/><rect x="20" y="20" width="560" height="340" fill="%23ffffff" rx="15" ry="15" stroke="%2310b981" stroke-width="4"/><text x="50" y="70" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="%23047857">CARTE VERTE D\'ASSURANCE FLOTTE</text><text x="50" y="95" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="%23065f46">ASSURANCE MULTI-CONDUITE COMPTE DE TIERS</text><line x1="50" y1="115" x2="550" y2="115" stroke="%23a7f3d0" stroke-width="2"/><text x="50" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="extrabold" fill="%23064e3b">CONTRAT PROFESSIONNEL AXA</text><text x="50" y="180" font-family="monospace" font-size="12" fill="%23065f46">Assuré: Convoyage Professionnel Services</text><text x="320" y="180" font-family="monospace" font-size="12" fill="%23065f46">Contrat N°: FL-894-AX-2026</text><text x="50" y="210" font-family="monospace" font-size="12" fill="%23065f46">Validité: Du 01/01/2026 au 31/12/2026</text><text x="320" y="210" font-family="monospace" font-size="12" fill="%23065f46">Territoires couverts: Zone UE</text><rect x="50" y="240" width="500" height="90" fill="%23ecfdf5" rx="8" ry="8"/><text x="70" y="270" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="%23047857">ASSISTANCE EXCLUSIVE PANNE ET ACCIDENT (24H/24) :</text><text x="70" y="295" font-family="monospace" font-size="16" font-weight="black" fill="%23065f46">N° Vert: 0 800 15 25 35 (Appel Gratuit)</text></svg>';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const initialLocalSeeds: DocumentItem[] = [
  {
    id: 'seed_license',
    name: 'Permis_Conduire_Jean_Dupont.jpg',
    mimeType: 'image/jpeg',
    size: '124 KB',
    bytes: 126976,
    date: '12/05/2026',
    source: 'local',
    url: defaultLicense
  },
  {
    id: 'seed_technical',
    name: 'Fiche_Technique_Volvo_FH16.jpg',
    mimeType: 'image/jpeg',
    size: '280 KB',
    bytes: 286720,
    date: '18/05/2026',
    source: 'local',
    url: defaultTechnical
  },
  {
    id: 'seed_insurance',
    name: 'Carte_Verte_Flotte_AXA.jpg',
    mimeType: 'image/jpeg',
    size: '94 KB',
    bytes: 96256,
    date: '02/06/2026',
    source: 'local',
    url: defaultInsurance
  }
];

const DocumentManager: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualTokenVal, setManualTokenVal] = useState('');
  const [manualEmailVal, setManualEmailVal] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<any | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const isIframe = window.self !== window.top;

  // Documents listing & Filter States
  const [localFiles, setLocalFiles] = useState<DocumentItem[]>([]);
  const [driveFiles, setDriveFilesState] = useState<DocumentItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'local' | 'drive'>('all');
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Lightbox States
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentItem | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [rotateDeg, setRotateDeg] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auth subscriptions
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

    // Load local files from localStorage with initial seeds if not set
    const stored = localStorage.getItem('document_manager_local_files');
    if (stored) {
      try {
        setLocalFiles(JSON.parse(stored));
      } catch (e) {
        setLocalFiles(initialLocalSeeds);
      }
    } else {
      setLocalFiles(initialLocalSeeds);
      localStorage.setItem('document_manager_local_files', JSON.stringify(initialLocalSeeds));
    }

    return () => unsubscribe();
  }, []);

  // Fetch Drive Files when Connected
  useEffect(() => {
    if (token) {
      fetchDriveFiles();
    } else {
      setDriveFilesState([]);
    }
  }, [token]);

  // Escape key handler to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePreviewDoc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchDriveFiles = async () => {
    setIsLoadingDrive(true);
    try {
      // Query images, PDF and GDocs from Google Drive files API via server proxy to avoid CORS
      const response = await fetch(
        '/api/drive/list-files',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.files) {
          const driveFilesMapped: DocumentItem[] = data.files.map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size ? formatBytes(parseInt(f.size, 10)) : 'Inconnue',
            bytes: f.size ? parseInt(f.size, 10) : 0,
            date: f.createdTime ? new Date(f.createdTime).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
            source: 'drive',
            url: f.thumbnailLink || f.webContentLink || `https://drive.google.com/file/d/${f.id}/view`
          }));
          setDriveFilesState(driveFilesMapped);
        }
      } else {
        console.warn("Failed to fetch Google Drive files, status:", response.status);
      }
    } catch (err) {
      console.warn("Error fetching documents from Google Drive:", err);
    } finally {
      setIsLoadingDrive(false);
    }
  };

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
              "Rendez-vous sur la console Firebase -> Authentication -> Settings -> Domaines Autorisés, puis ajoutez l'hôte de votre app.";
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
    setCameraError(null);
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
      setCameraError(err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
    setCameraError(null);
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
      const outputName = `Document_Scanne_${new Date().getTime()}.pdf`;
      pdf.save(outputName);

      // Save scanned image to local document list
      const newDoc: DocumentItem = {
        id: `scanned_${Date.now()}`,
        name: `Scan_Document_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}_${Math.floor(Math.random() * 1000)}.jpg`,
        mimeType: 'image/jpeg',
        size: formatBytes(imgData.length * 0.75),
        bytes: imgData.length * 0.75,
        date: new Date().toLocaleDateString('fr-FR'),
        source: 'local',
        url: imgData
      };
      const updated = [newDoc, ...localFiles];
      setLocalFiles(updated);
      localStorage.setItem('document_manager_local_files', JSON.stringify(updated));
    } catch (err) {
      console.error("Erreur lors de la conversion PDF / Stockage:", err);
      setErrorMsg("Erreur lors de la création du PDF.");
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const triggerSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrorMsg("Erreur: Seules les images (PNG, JPG, JPEG) et les fichiers PDF sont pris en charge.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const newDoc: DocumentItem = {
        id: `local_${Date.now()}`,
        name: file.name,
        mimeType: file.type,
        size: formatBytes(file.size),
        bytes: file.size,
        date: new Date().toLocaleDateString('fr-FR'),
        source: 'local',
        url: result
      };
      const updated = [newDoc, ...localFiles];
      setLocalFiles(updated);
      localStorage.setItem('document_manager_local_files', JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  // Lightbox Operations
  const handleOpenLightbox = (doc: DocumentItem) => {
    setActivePreviewDoc(doc);
    setZoomScale(1);
    setRotateDeg(0);
  };

  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    if (type === 'in') {
      setZoomScale((prev) => Math.min(prev + 0.25, 3));
    } else if (type === 'out') {
      setZoomScale((prev) => Math.max(prev - 0.25, 0.5));
    } else {
      setZoomScale(1);
    }
  };

  const handleRotate = () => {
    setRotateDeg((prev) => (prev + 90) % 360);
  };

  const handleDeleteLocalDoc = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce document de votre espace local ?")) {
      const updated = localFiles.filter((f) => f.id !== id);
      setLocalFiles(updated);
      localStorage.setItem('document_manager_local_files', JSON.stringify(updated));
      setActivePreviewDoc(null);
    }
  };

  // Merge lists according to filtered status
  const displayedDocuments = (() => {
    if (activeFilter === 'local') {
      return localFiles;
    }
    if (activeFilter === 'drive') {
      return driveFiles;
    }
    return [...localFiles, ...driveFiles];
  })();

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center text-slate-500 font-sans">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Initialisation du gestionnaire de fichiers...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between p-6 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Section Header */}
        <div className="text-center md:text-left space-y-2 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-55/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase">
            <Cloud className="w-3.5 h-3.5" />
            Stockage Cloud et Localisé
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Documents de Bord & Clichés d'Inspections</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            Archivez et gérez vos justificatifs, attestations d'assurances, fiches de convois ou états d'inspections. Glissez-déposez des clichés ou capturez-les en direct par caméra avec compression PDF instantanée.
          </p>
        </div>

        {/* DRIVE CONNEXION & AUTH STATE */}
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
          {user ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border-2 border-indigo-550 shadow-sm" />
                ) : (
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-700 font-black rounded-full border border-indigo-200 flex items-center justify-center text-lg uppercase shadow-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{user.displayName || 'Session Google Drive Acteur'}</h4>
                  <p className="text-[11px] text-slate-455 font-medium font-mono truncate max-w-[200px] md:max-w-xs">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-extrabold text-[10px] uppercase border border-emerald-500/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  G-Drive Actif
                </span>
                <button onClick={handleSignOut} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" /> Déconnecter
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-5 justify-between py-1">
              <div className="space-y-1.5 text-center md:text-left">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2 justify-center md:justify-start">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Synchronisation Google Drive Disponible
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed font-semibold">
                  Connectez votre espace cloud personnel pour enregistrer vos archives documentaires d'inspections directement sur votre compte Drive de manière persistante.
                </p>
              </div>

              {!showManual ? (
                <div className="flex flex-col items-center md:items-end gap-2.5 shrink-0">
                  <button onClick={handleSignIn} className="gsi-material-button bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-white dark:text-slate-800 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-all transform active:scale-95 font-bold text-[11px] uppercase duration-150 justify-center">
                    <div className="gsi-material-button-icon shrink-0">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '16px', height: '16px' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="font-sans font-bold">Connexion Google</span>
                  </button>
                  <button onClick={() => setShowManual(true)} className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 hover:underline cursor-pointer bg-transparent border-none">
                    Authentifier par Jeton
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSignIn} className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 w-full max-w-sm text-left shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">ID Jeton d'accès (Access Token)</span>
                    <button type="button" onClick={() => setShowManual(false)} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer bg-none border-none">
                      Retour
                    </button>
                  </div>
                  <div className="space-y-1">
                    <input 
                      type="password"
                      placeholder="Coller ya29.a0Axoo..."
                      value={manualTokenVal}
                      onChange={(e) => setManualTokenVal(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-mono text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer">
                    Valider le Jeton manuel
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl text-left text-rose-800 dark:text-rose-450 space-y-1 max-w-md mx-auto flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-405">Erreur Signalée</h5>
              <p className="text-xs font-semibold leading-relaxed whitespace-pre-line">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs hover:text-black dark:hover:text-white font-bold ml-auto">&times;</button>
          </div>
        )}

        {/* WORKSPACE OPERATIONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* UPLOAD & ACTION BAR */}
          <div className="md:col-span-1 space-y-6">
            {/* FILE DROPZONE */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerSelectFile}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer shadow-sm select-none ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 scale-[1.01]' 
                  : 'border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850/50'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileInputChange} 
                accept="image/*,application/pdf"
                className="hidden" 
              />
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/55 rounded-full text-indigo-600 dark:text-indigo-400">
                <Upload className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Importer un document</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-400 font-medium leading-relaxed">
                  Glissez-déposez ici ou <span className="text-indigo-500 font-bold underline">parcourez vos fichiers</span>.
                </p>
                <p className="text-[9px] text-slate-400 font-sans">Formats soutenus: PNG, JPG, JPEG, PDF (Max. 5MB)</p>
              </div>
            </div>

            {/* SCANNER CAMERA ACCESS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                Numériser en direct
              </h4>
              <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-sans font-medium">
                Activez l'appareil photo arrière de votre terminal pour capturer un bordereau d'expédition, l'enregistrer dans votre galerie et le transformer en certificat PDF.
              </p>
              <button onClick={startCamera} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] uppercase tracking-wide rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                <Camera className="w-4 h-4" /> Activer l'Appareil Photo
              </button>
            </div>
            
            {/* GOOGLE DRIVE INSTRUCTIONS INFO BANNER */}
            <div className="bg-slate-50 dark:bg-slate-905/30 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 space-y-2 text-xs">
              <h5 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-405">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Dépôt Automatique
              </h5>
              <p className="text-slate-505 dark:text-slate-400 leading-relaxed text-[11px] font-sans font-semibold">
                Une fois authentifié à votre compte Google Drive, le système sauvegarde et indexe d'office vos fiches d'états des lieux et photos certifiées par des dossiers d'immatriculations.
              </p>
            </div>
          </div>

          {/* FILES & MEDIA LIST */}
          <div className="md:col-span-2 space-y-4">
            {/* Filter buttons & Sync controls */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                <button 
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all tracking-wider cursor-pointer ${
                    activeFilter === 'all' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-650 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  Tous ({localFiles.length + driveFiles.length})
                </button>
                <button 
                  onClick={() => setActiveFilter('local')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all tracking-wider cursor-pointer ${
                    activeFilter === 'local' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-650 dark:text-slate-400'
                  }`}
                >
                  Dossier Local ({localFiles.length})
                </button>
                <button 
                  onClick={() => setActiveFilter('drive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase transition-all tracking-wider cursor-pointer ${
                    activeFilter === 'drive' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-650 dark:text-slate-400'
                  }`}
                  disabled={!user}
                  title={!user ? "Connectez un compte Google Drive pour accéder à cet onglet" : ""}
                >
                  Drive Cloud ({driveFiles.length})
                </button>
              </div>

              {user && (
                <button 
                  onClick={fetchDriveFiles} 
                  disabled={isLoadingDrive}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                  title="Rafraîchir Google Drive"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* DIRECT LISTING GALLERY GRID */}
            {displayedDocuments.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 p-12 text-center rounded-2xl space-y-3">
                <FileText className="w-12 h-12 text-slate-350 dark:text-slate-700 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-850 dark:text-slate-250 text-sm">Aucun document chargé</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
                    Importez des justificatifs par glisser-déposer ou prenez un cliché via l'appareil photo pour commencer à constituer votre base locale.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {displayedDocuments.map((doc) => {
                  const isPdf = doc.mimeType.includes('pdf');
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => handleOpenLightbox(doc)}
                      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805/80 hover:border-indigo-500/80 dark:hover:border-indigo-500/80 p-3 rounded-2xl cursor-pointer hover:shadow-md transition-all flex flex-col gap-2 overflow-hidden select-none"
                    >
                      {/* Document Preview Thumbnail */}
                      <div className="w-full aspect-[4/3] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 flex items-center justify-center overflow-hidden relative">
                        {isPdf ? (
                          <div className="flex flex-col items-center gap-1.5 p-3">
                            <FileText className="w-8 h-8 text-rose-500 dark:text-rose-400" />
                            <span className="text-[10px] font-black tracking-wide text-rose-600 dark:text-rose-400 uppercase font-sans">PDF ARCHIVE</span>
                          </div>
                        ) : (
                          <>
                            <img 
                              src={doc.url} 
                              alt={doc.name} 
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200" 
                            />
                            {/* Hover Eye Trigger */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <div className="p-2 bg-indigo-600 text-white rounded-full shadow">
                                <Eye className="w-4 h-4" />
                              </div>
                            </div>
                          </>
                        )}

                        {/* Top corner origin badge */}
                        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 py-0.5 px-2 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm text-white ${
                          doc.source === 'drive' ? 'bg-blue-600/80' : 'bg-indigo-605/85'
                        }`}>
                          {doc.source === 'drive' ? <Cloud className="w-2.5 h-2.5" /> : <Server className="w-2.5 h-2.5" />}
                          {doc.source === 'drive' ? 'Drive' : 'Local'}
                        </span>
                      </div>

                      {/* Metadata info */}
                      <div className="space-y-0.5 px-0.5">
                        <p className="text-[11px] font-bold text-slate-850 dark:text-slate-200 truncate pr-1" title={doc.name}>
                          {doc.name}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold font-mono">
                          <span>{doc.date}</span>
                          <span>{doc.size}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-8 text-center max-w-sm mx-auto">
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          Secured with Google Cloud API & Drive SDK v3
        </p>
      </div>

      {/* DETAILED RESPONSIVE LIGHTBOX MODAL */}
      {activePreviewDoc && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col md:flex-row backdrop-blur-md overflow-hidden animate-fade-in">
          {/* Main Visual Image Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4">
            {/* Top Toolbar controls inside lightbox */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center bg-slate-900/60 backdrop-blur-md p-2 rounded-xl border border-slate-800/30">
              <span className="text-white text-xs font-bold font-mono truncate max-w-xs md:max-w-md pl-2">
                {activePreviewDoc.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleZoom('in')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Zoom +"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleZoom('out')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Zoom -"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleZoom('reset')}
                  className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer"
                  title="Réinitialiser zoom"
                >
                  100%
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Rotation à 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Picture Rendering area inside Lightbox */}
            <div className="flex-1 w-full h-full flex items-center justify-center select-none overflow-auto p-12">
              {activePreviewDoc.mimeType.includes('pdf') ? (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 text-center max-w-sm space-y-4 shadow-xl">
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full inline-block">
                    <FileText className="w-12 h-12" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-xs mx-auto">{activePreviewDoc.name}</h5>
                    <p className="text-[11px] text-slate-450 dark:text-slate-400 font-medium leading-relaxed mt-1">
                      Les aperçus de fichiers PDF directs ne sont pas éligibles en mode Sandbox. Veuillez télécharger le fichier pour en visualiser l'entièreté.
                    </p>
                  </div>
                  <a
                    href={activePreviewDoc.url}
                    download={activePreviewDoc.name}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Télécharger le PDF
                  </a>
                </div>
              ) : (
                <div className="relative overflow-hidden flex items-center justify-center max-w-full max-h-full">
                  <img
                    src={activePreviewDoc.url}
                    alt={activePreviewDoc.name}
                    style={{
                      transform: `scale(${zoomScale}) rotate(${rotateDeg}deg)`,
                      transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    draggable="false"
                    className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Details & Attributes Sidebar */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-6 flex flex-col justify-between shrink-0 space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Détails et Propriétés</h4>
                <button 
                  onClick={() => setActivePreviewDoc(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Attributes block */}
              <div className="space-y-4 text-xs font-sans">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Nom du fichier</span>
                  <span className="font-bold text-slate-200 font-mono break-all">{activePreviewDoc.name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Localisation de stockage</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                    activePreviewDoc.source === 'drive' 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' 
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                  }`}>
                    {activePreviewDoc.source === 'drive' ? <Cloud className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                    {activePreviewDoc.source === 'drive' ? 'Google Drive Cloud' : 'Dossier Local'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Date de création / d'import</span>
                  <span className="font-semibold text-slate-300 font-mono">{activePreviewDoc.date}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Taille du fichier</span>
                  <span className="font-semibold text-slate-300 font-mono">{activePreviewDoc.size}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Format de formatage / MIME</span>
                  <span className="font-semibold text-slate-300 font-mono">{activePreviewDoc.mimeType}</span>
                </div>
              </div>
            </div>

            {/* Action panel */}
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <a
                href={activePreviewDoc.url}
                download={activePreviewDoc.name}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-sm text-center flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Télécharger de l'original
              </a>
              {activePreviewDoc.source === 'local' && (
                <button
                  onClick={() => handleDeleteLocalDoc(activePreviewDoc.id)}
                  className="w-full py-2 bg-slate-850 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 border border-slate-800 hover:border-rose-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer du dossier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CAMERA DISCLOSURE INTERACTIVE WRAPPER */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
             {cameraError ? (
               <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-20">
                 <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
                   <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
                     <CameraOff className="w-8 h-8" />
                   </div>
                   
                   <h3 className="text-base font-extrabold text-white uppercase tracking-wider mb-2">Accès Caméra Refusé</h3>
                   
                   <p className="text-xs text-slate-300 font-medium leading-relaxed mb-6 font-sans">
                     L'application a besoin d'accéder à votre appareil photo arrière pour capturer et numériser des documents.<br/><br/>
                     <span className="text-slate-400">
                       Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur (cliquez sur le cadenas à gauche de l'URL ou dans les réglages système de l'appareil) puis cliquez sur Réessayer ci-dessous.
                     </span>
                   </p>
                   
                   <div className="flex flex-col sm:flex-row gap-3 w-full">
                     <button
                       onClick={startCamera}
                       className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                     >
                       <RefreshCw className="w-4 h-4" /> Réessayer
                     </button>
                     <button
                       onClick={stopCamera}
                       className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-200 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                     >
                       Annuler
                     </button>
                   </div>
                 </div>
               </div>
             ) : (
               <>
                 {/* Guide boundaries indicator */}
                 <div className="absolute inset-0 z-10 border-[24px] border-black/60 pointer-events-none">
                   <div className="w-full h-full border-2 border-indigo-500/80 rounded-2xl relative">
                     <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl"></div>
                     <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr"></div>
                     <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl"></div>
                     <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br"></div>
                   </div>
                 </div>
                 
                 <video 
                   ref={videoRef} 
                   autoPlay 
                   playsInline 
                   className="w-full h-full object-cover" 
                 />
               </>
             )}
          </div>
          {!cameraError && (
            <div className="bg-slate-900 px-6 py-8 flex items-center justify-between text-white pb-safe">
              <button 
                onClick={stopCamera} 
                className="text-slate-400 hover:text-white text-[11px] uppercase tracking-widest font-black cursor-pointer"
              >
                Annuler
              </button>
              <button 
                onClick={captureAndConvertToPDF} 
                className="w-16 h-16 rounded-full bg-indigo-500 border-4 border-indigo-200 outline outline-offset-4 outline-white hover:bg-indigo-600 transition-colors cursor-pointer"
                title="Prendre Photo"
              >
              </button>
              <div className="w-14"></div> {/* spacer */}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
