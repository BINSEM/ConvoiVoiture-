// Inspection Workflow Logic

export const InspectionService = {
  activeMissionId: null,
  damages: [],
  photosObjUrl: [], // To store object URLs for cleanup
  cameraStream: null, // Track media steam
  facingMode: 'environment', // Default back lens

  currentDamageStage: 'departure', // Stage state: departure or arrival
  signatureData: null,
  signatureCaptured: false,

  // Depart details & Dashboard pictures
  departRef: '',
  departClient: '',
  departKm: '',
  departFuel: '1/2',
  departDate: '',
  departTime: '',
  dashPhotoDep: null,
  dashPhotoArr: null,
  depositReceiptPhoto: null,
  contractPhoto: null,

  // Arrivée details
  arriveeKm: '',
  arriveeFuel: '1/2',
  arriveeDate: '',
  arriveeTime: '',

  renderSelectableMissions() {
    const listEl = document.getElementById('ins_selectable_missions_list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const missions = app.missions || [];
    if (missions.length === 0) {
      listEl.innerHTML = `
        <div class="col-span-full py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
          <i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-slate-400"></i>
          Aucune mission disponible pour l'état des lieux.
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    missions.forEach(m => {
      const isCompleted = m.inspection && m.inspection.status === 'Validée';
      const card = document.createElement('div');
      card.className = "bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 rounded-xl flex flex-col justify-between gap-3 hover:shadow-md transition-all";
      card.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-full">${m.plateforme || 'Otoqi'}</span>
            <span class="text-[10px] uppercase font-bold text-slate-400 font-mono">${m.immatriculation || 'Sans Immat'}</span>
          </div>
          <h4 class="font-extrabold text-xs text-slate-800 dark:text-white uppercase truncate">${m.vehicle || m.modele || 'Véhicule N/A'}</h4>
          <p class="text-[11px] text-slate-500 truncate">
            <span class="font-semibold">${m.depart || 'N/A'}</span> ➔ <span class="font-semibold">${m.destination || 'N/A'}</span>
          </p>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] text-emerald-500 font-extrabold">${m.gain || 0} € net</span>
            <span class="text-[10px] px-2 py-0.5 ${isCompleted ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'} font-black uppercase tracking-wider rounded">
              ${isCompleted ? 'Validée' : 'À inspecter'}
            </span>
          </div>
        </div>
        <button onclick="InspectionService.openInspection('${m.id}')" class="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-505 text-white rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-colors mt-1 uppercase tracking-wider">
          ${isCompleted ? 'Voir le rapport' : "Lancer l'inspection"}
        </button>
      `;
      listEl.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  },

  cancelSelection() {
    this.openInspection(null);
  },

  openInspection(missionId) {
    if (!document.getElementById('inspectionModal')) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("État des lieux : Le module d'inspection physique n'est pas activé sur cette interface.", "info");
      }
      return;
    }

    const noView = document.getElementById('ins_no_mission_view');
    const activeView = document.getElementById('ins_active_workflow_view');
    const successView = document.getElementById('section_ins_success_view');

    if (!missionId) {
      this.activeMissionId = null;
      if (noView) noView.classList.remove('hidden');
      if (activeView) activeView.classList.add('hidden');
      if (successView) successView.classList.add('hidden');
      this.renderSelectableMissions();
      return;
    }

    this.activeMissionId = missionId;
    this.damages = []; // reset
    this.currentDamageStage = 'departure';
    this.signatureData = null;
    this.signatureCaptured = false;

    // Find mission to display details
    const mission = app.missions.find(m => m.id === missionId);
    
    if (mission && mission.inspection && mission.inspection.status === 'Validée') {
      this.showSuccessModal(mission);
      return;
    }

    if (noView) noView.classList.add('hidden');
    if (activeView) activeView.classList.remove('hidden');
    if (successView) successView.classList.add('hidden');

    if (mission) {
      const vehicleInfoEl = document.getElementById('ins_vehicle_info');
      const plateInfoEl = document.getElementById('ins_plate_info');
      if (vehicleInfoEl) {
        vehicleInfoEl.textContent = mission.vehicle || mission.modele || 'Véhicule NS';
      }
      if (plateInfoEl) {
        plateInfoEl.textContent = mission.immatriculation || 'Plaque NS';
      }

      // Also set sidebar helper variables in layout
      const sideVeh = document.getElementById('ins_sidebar_vehicle');
      const sidePlate = document.getElementById('ins_sidebar_plate');
      const sideDep = document.getElementById('ins_sidebar_depart');
      const sideDest = document.getElementById('ins_sidebar_dest');

      if (sideVeh) sideVeh.textContent = mission.vehicle || mission.modele || 'NS';
      if (sidePlate) {
        sidePlate.textContent = mission.immatriculation || 'NS';
        sidePlate.classList.remove('animate-pulse');
      }
      if (sideDep) sideDep.textContent = mission.depart || 'NS';
      if (sideDest) sideDest.textContent = mission.destination || 'NS';
    }

    // Initialize departure status input fields with defaults
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    this.departRef = '';
    this.departClient = mission ? (mission.client || '') : '';
    this.departKm = '';
    this.departFuel = '1/2';
    this.departDate = todayStr;
    this.departTime = timeStr;
    
    this.arriveeKm = '';
    this.arriveeFuel = '1/2';
    this.arriveeDate = todayStr;
    this.arriveeTime = timeStr;

    this.dashPhotoDep = null;
    this.dashPhotoArr = null;
    this.depositReceiptPhoto = null;
    this.contractPhoto = null;

    // Reset arrival inputs in HTML if they exist
    const kmArrEl = document.getElementById('ins_arrivee_km');
    if (kmArrEl) kmArrEl.value = '';
    const dateArrEl = document.getElementById('ins_arrivee_date');
    if (dateArrEl) dateArrEl.value = todayStr;
    const timeArrEl = document.getElementById('ins_arrivee_time');
    if (timeArrEl) timeArrEl.value = timeStr;

    // Clear signature canvas placeholder & checkbox
    const chk = document.getElementById('ins_driver_confirm_check');
    if (chk) chk.checked = false;

    // Clear dashboard photo previews
    const previewDep = document.getElementById('ins_preview_dash_dep');
    const placeholderDep = document.getElementById('ins_placeholder_dash_dep');
    if (previewDep) {
      previewDep.src = '';
      previewDep.classList.add('hidden');
    }
    if (placeholderDep) placeholderDep.classList.remove('hidden');

    const previewArr = document.getElementById('ins_preview_dash_arr');
    const placeholderArr = document.getElementById('ins_placeholder_dash_arr');
    if (previewArr) {
      previewArr.src = '';
      previewArr.classList.add('hidden');
    }
    if (placeholderArr) placeholderArr.classList.remove('hidden');

    const previewDeposit = document.getElementById('ins_preview_deposit_receipt');
    const placeholderDeposit = document.getElementById('ins_placeholder_deposit_receipt');
    if (previewDeposit) {
      previewDeposit.src = '';
      previewDeposit.classList.add('hidden');
    }
    if (placeholderDeposit) placeholderDeposit.classList.remove('hidden');

    const previewContract = document.getElementById('ins_preview_contract_photo');
    const placeholderContract = document.getElementById('ins_placeholder_contract_photo');
    if (previewContract) {
      previewContract.src = '';
      previewContract.classList.add('hidden');
    }
    if (placeholderContract) placeholderContract.classList.remove('hidden');

    // Set input elements in HTML
    const refEl = document.getElementById('ins_depart_ref');
    const clientEl = document.getElementById('ins_depart_client');
    const kmEl = document.getElementById('ins_depart_km');
    const dateEl = document.getElementById('ins_depart_date');
    const timeEl = document.getElementById('ins_depart_time');
    const fDepInput = document.getElementById('ins_depart_fuel');

    if(refEl) refEl.value = '';
    if(clientEl) clientEl.value = this.departClient;
    if(kmEl) kmEl.value = '';
    if(dateEl) dateEl.value = todayStr;
    if(timeEl) timeEl.value = timeStr;
    if(fDepInput) fDepInput.value = '1/2';

    this.selectFuel('1/2');
    this.renderDamagesList();
    
    this.showStep('intro');
    const iModal = document.getElementById('inspectionModal');
    if (iModal) {
      iModal.classList.remove('hidden');
      iModal.classList.add('flex');
    }
  },

  showSuccessModal(mission) {
    if (!document.getElementById('inspectionModal')) {
      return;
    }
    this.successMissionId = mission.id;
    
    const elements = {
      'ins_success_vehicle': mission.vehicle || mission.modele || 'N/A',
      'ins_success_plate': mission.immatriculation || 'N/A',
      'ins_success_depart': mission.depart || 'N/A',
      'ins_success_destination': mission.destination || 'N/A',
      'ins_success_platform': mission.plateforme || 'N/A',
      'ins_success_gain': `${mission.gain || 0} €`
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    }

    let report = `DÉTAILS DE LA MISSION DE CONVOYAGE :\n`;
    report += `---------------------------------------\n`;
    report += `Véhicule: ${mission.vehicle || mission.modele || 'N/A'}\n`;
    report += `Immatriculation: ${mission.immatriculation || 'N/A'}\n`;
    report += `Trajet de convoyage: ${mission.depart || 'N/A'} ➔ ${mission.destination || 'N/A'}\n`;
    report += `Plateforme: ${mission.plateforme || 'N/A'}\n`;
    report += `Commission / Gain: ${mission.gain || 0} €\n`;
    report += `Statut de mission: ${mission.statut || 'N/A'}\n\n`;

    report += `RAPPORT D'ÉTAT DES LIEUX AU DÉPART :\n`;
    report += `---------------------------------------\n`;
    if (mission.inspection) {
      report += `Date d'inspection: ${new Date(mission.inspection.date || new Date()).toLocaleString('fr-FR')}\n`;
      report += `Nº Contrat / Référence: ${mission.inspection.reference || 'Non spécifié'}\n`;
      report += `Client de livraison: ${mission.inspection.client || 'Non spécifié'}\n`;
      report += `Kilométrage de départ: ${mission.inspection.kmDepart ? (mission.inspection.kmDepart + ' km') : 'Non spécifié'}\n`;
      report += `Niveau jauge carburant: ${mission.inspection.carburant || 'Non spécifié'}\n`;
      const dateDepStr = mission.inspection.dateDepart ? new Date(mission.inspection.dateDepart).toLocaleDateString('fr-FR') : 'Non spécifié';
      report += `Départ prévu le: ${dateDepStr} à ${mission.inspection.heureDepart || 'Non spécifié'}\n`;
      if (mission.inspection.depositReceiptPhoto) {
        report += `✓ Reçu de caution de garantie : Photo du reçu enregistrée\n`;
      } else {
        report += `Reçu de caution de garantie : Aucun reçu de caution fourni\n`;
      }
      if (mission.inspection.contractPhoto) {
        report += `✓ Photo du contrat de convoyage : Enregistrée\n`;
      } else {
        report += `Photo du contrat de convoyage : Aucun contrat fourni\n`;
      }
      report += `\n`;
      
      const dList = mission.inspection.damages || [];
      report += `Détails des anomalies et dommages signalés (${dList.length}) :\n`;
      report += `---------------------------------------\n`;
      if (dList.length === 0) {
        report += `✓ Aucun dommage signalé. Le véhicule est en parfait état de marche.\n`;
      } else {
        dList.forEach((d, index) => {
          report += `${index + 1}. Zone: ${d.zone} // Type: ${d.type} // Sévérité: ${d.severity}\n`;
          if (d.notes) report += `   Notes: "${d.notes}"\n`;
          report += `   Nombre de photos: ${d.photoUrls ? d.photoUrls.length : 0}\n\n`;
        });
      }
    } else {
      report += `Aucune donnée d'inspection enregistrée.`;
    }

    const reportTextEl = document.getElementById('ins_success_report_text');
    if (reportTextEl) {
      reportTextEl.textContent = report;
    }

    const photosContainer = document.getElementById('ins_success_photos_container');
    photosContainer.innerHTML = '';
    let allPhotos = [];
    if (mission.inspection && mission.inspection.damages) {
      mission.inspection.damages.forEach(d => {
        if (d.photoUrls) allPhotos.push(...d.photoUrls);
      });
    }

    // Also include dashboard photos in the success gallery
    if (mission.inspection && mission.inspection.dashboardDepartPhoto) {
      allPhotos.push(mission.inspection.dashboardDepartPhoto);
    }
    if (mission.inspection && mission.inspection.dashboardArriveePhoto) {
      allPhotos.push(mission.inspection.dashboardArriveePhoto);
    }
    if (mission.inspection && mission.inspection.depositReceiptPhoto) {
      allPhotos.push(mission.inspection.depositReceiptPhoto);
    }
    if (mission.inspection && mission.inspection.contractPhoto) {
      allPhotos.push(mission.inspection.contractPhoto);
    }

    if (allPhotos.length > 0) {
      allPhotos.forEach((url, i) => {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'relative w-23 h-23 rounded-xl overflow-hidden shadow-md flex-shrink-0 cursor-pointer group hover:scale-105 transition-transform duration-150 border border-slate-750 bg-slate-950 flex flex-col items-center justify-center';
        
        let label = "Avarie";
        if (mission.inspection) {
          if (url === mission.inspection.dashboardDepartPhoto) label = "TDB Départ";
          if (url === mission.inspection.dashboardArriveePhoto) label = "TDB Arrivée";
          if (url === mission.inspection.depositReceiptPhoto) label = "Reçu Caution";
          if (url === mission.inspection.contractPhoto) label = "Contrat";
        }

        imgDiv.innerHTML = `
          <img src="${url}" class="w-full h-18 object-cover">
          <span class="text-[8px] text-slate-400 bg-slate-900 w-full text-center py-0.5 font-bold uppercase truncate">${label}</span>
        `;
        imgDiv.onclick = () => {
          if (window.DashboardService) {
            window.DashboardService.showNotification("Visualisation de l'image de l'inspection...", "info");
          }
          InspectionService.openLightbox(url);
        };
        photosContainer.appendChild(imgDiv);
      });
    } else {
      photosContainer.innerHTML = '<p class="text-xs text-slate-500 italic">Aucune photo prise.</p>';
    }

    const noView = document.getElementById('ins_no_mission_view');
    const activeView = document.getElementById('ins_active_workflow_view');
    const successView = document.getElementById('section_ins_success_view');

    if (noView) noView.classList.add('hidden');
    if (activeView) activeView.classList.add('hidden');
    if (successView) successView.classList.remove('hidden');

    const sModal = document.getElementById('ins_success_modal');
    if (sModal) {
      sModal.classList.remove('hidden');
      sModal.classList.add('flex');
    }

    const driveBtn = document.getElementById('btn_ins_success_drive_upload');
    if (driveBtn) {
      driveBtn.onclick = () => {
        this.uploadMissionToDrive(mission);
      };
    }
    this.updateDriveBtnState(mission);

    // Verify if the mission is already saved; if NOT, automatically trigger saving by invoking the button's click
    if (!mission.driveSaved) {
      if (driveBtn && !driveBtn.disabled) {
        setTimeout(() => {
          console.log("Auto-triggering Google Drive upload for mission:", mission.id);
          driveBtn.click();
        }, 300);
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  closeInspection() {
    this.activeMissionId = null;
    document.getElementById('inspectionModal').classList.add('hidden');
    document.getElementById('inspectionModal').classList.remove('flex');
    document.body.style.overflow = '';
    
    // Stop any live camera Stream
    this.stopCameraStream();

    // Revoke object URLs
    this.photosObjUrl.forEach(URL.revokeObjectURL);
    this.photosObjUrl = [];
  },

  askPhotoSource(target = 'damage') {
    this.activeCameraTarget = target;
    const modal = document.getElementById('ins_photo_source_modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closePhotoSourceModal() {
    const modal = document.getElementById('ins_photo_source_modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  startCameraStreamFromSource() {
    this.closePhotoSourceModal();
    this.startCameraStream(this.activeCameraTarget);
  },

  async startCameraStream(target = 'damage') {
    this.activeCameraTarget = target;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Votre appareil ne supporte pas la capture vidéo directe. Utilisation du mode natif.", "warning");
      }
      this.triggerNativeCamera();
      return;
    }

    const modal = document.getElementById('ins_camera_modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraStream = stream;

      const video = document.getElementById('ins_camera_video');
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().catch(err => console.warn("Auto-play blocked:", err));
        };
      }
      
      const statusText = document.getElementById('ins_camera_status');
      if (statusText) {
        statusText.innerText = `Caméra active (${this.facingMode === 'environment' ? 'Arrière' : 'Avant'}) • Touchez l'obturateur rose`;
      }
    } catch (err) {
      const isPermissionDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('denied');
      if (isPermissionDenied) {
        console.warn("Erreur getUserMedia (Accès refusé):", err.message || err);
      } else {
        console.error("Erreur getUserMedia:", err);
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.cameraStream = stream;
        const video = document.getElementById('ins_camera_video');
        if (video) {
          video.srcObject = stream;
          video.play().catch(e => console.warn("Play general failed:", e));
        }
      } catch (fallbackErr) {
        const isFallbackPermissionDenied = fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError' || fallbackErr.message?.toLowerCase().includes('permission') || fallbackErr.message?.toLowerCase().includes('denied');
        if (isFallbackPermissionDenied) {
          console.warn("Erreur fallback getUserMedia (Accès refusé):", fallbackErr.message || fallbackErr);
        } else {
          console.error("Erreur fallback getUserMedia:", fallbackErr);
        }
        if (window.DashboardService) {
          window.DashboardService.showNotification("Accès caméra refusé. Mode capture photo natif activé.", "warning");
        }
        this.stopCameraStream();
        this.triggerNativeCamera();
      }
    }
  },

  stopCameraStream() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    const video = document.getElementById('ins_camera_video');
    if (video) {
      video.srcObject = null;
    }
    const modal = document.getElementById('ins_camera_modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
      await this.startCameraStream();
    } else {
      if (window.DashboardService) {
        window.DashboardService.showNotification(`Objectif basculé sur : ${this.facingMode === 'environment' ? 'Arrière' : 'Avant'}`, "info");
      }
    }
  },

  overlayTimestamp(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const mission = app.missions.find(m => m.id === this.activeMissionId);
        const immat = mission && mission.immatriculation ? mission.immatriculation : 'SANS PLAQUE';
        const textStr = `${immat} | ${new Date().toLocaleString('fr-FR')}`;

        const fontSize = Math.max(8, Math.floor(img.width / 85));
        ctx.font = `bold ${fontSize}px monospace`;
        
        const textWidth = ctx.measureText(textStr).width;
        const padding = 2;
        
        const rectWidth = textWidth + padding * 2;
        const rectHeight = fontSize + padding * 2;
        
        const rectX = img.width - rectWidth - 4;
        const rectY = img.height - rectHeight - 4;

        // Draw translucent soft white background block (demi-transparent with 0.62 opacity)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        
        // Draw subtle border around the block
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        
        // Render text
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStr, rectX + padding, rectY + rectHeight / 2);
        
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
    });
  },

  initSignaturePad() {
    const canvas = document.getElementById('ins_sig_canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    
    const placeholder = document.getElementById('ins_sig_placeholder');
    
    const getXY = (e) => {
      const r = canvas.getBoundingClientRect();
      if (e.touches && e.touches[0]) {
        return {
          x: e.touches[0].clientX - r.left,
          y: e.touches[0].clientY - r.top
        };
      }
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top
      };
    };

    const startDraw = (e) => {
      drawing = true;
      const pos = getXY(e);
      lastX = pos.x;
      lastY = pos.y;
      if (placeholder) placeholder.classList.add('hidden');
    };

    const draw = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getXY(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    };

    const stopDraw = () => {
      if (drawing) {
        drawing = false;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rect.width;
        tempCanvas.height = rect.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0, rect.width, rect.height);
        this.signatureData = tempCanvas.toDataURL();
        this.signatureCaptured = true;
      }
    };

    const cloned = canvas.cloneNode(true);
    canvas.replaceWith(cloned);
    
    cloned.addEventListener('mousedown', startDraw);
    cloned.addEventListener('mousemove', draw);
    cloned.addEventListener('mouseup', stopDraw);
    cloned.addEventListener('mouseleave', stopDraw);
    
    cloned.addEventListener('touchstart', startDraw, { passive: false });
    cloned.addEventListener('touchmove', draw, { passive: false });
    cloned.addEventListener('touchend', stopDraw);
  },

  clearSignature() {
    const canvas = document.getElementById('ins_sig_canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureData = null;
    this.signatureCaptured = false;
    
    const placeholder = document.getElementById('ins_sig_placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  },

  toggleConfirmCheck() {
    const chk = document.getElementById('ins_driver_confirm_check');
    const btn = document.getElementById('ins_step_2_next_btn');
    if (chk && btn) {
      if (chk.checked) {
        btn.disabled = false;
        btn.classList.remove('bg-slate-800', 'text-slate-500', 'cursor-not-allowed');
        btn.classList.add('bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'cursor-pointer');
      } else {
        btn.disabled = true;
        btn.classList.add('bg-slate-800', 'text-slate-500', 'cursor-not-allowed');
        btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'cursor-pointer');
      }
    }
  },

  capturePhoto() {
    const video = document.getElementById('ins_camera_video');
    const canvas = document.getElementById('ins_camera_canvas');
    if (!video || !canvas) return;

    const flash = document.getElementById('ins_camera_flash');
    if (flash) {
      flash.classList.remove('opacity-0');
      flash.classList.add('opacity-80');
      setTimeout(() => {
        flash.classList.remove('opacity-80');
        flash.classList.add('opacity-0');
      }, 80);
    }

    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);

        // Draw French formatted timestamp and vehicle license plate directly
        const mission = app.missions.find(m => m.id === this.activeMissionId);
        const immat = mission && mission.immatriculation ? mission.immatriculation : 'SANS PLAQUE';
        const textStr = `${immat} | ${new Date().toLocaleString('fr-FR')}`;

        const fontSize = Math.max(8, Math.floor(width / 85));
        ctx.font = `bold ${fontSize}px monospace`;
        
        const textWidth = ctx.measureText(textStr).width;
        const padding = 2;
        
        const rectWidth = textWidth + padding * 2;
        const rectHeight = fontSize + padding * 2;
        
        const rectX = width - rectWidth - 4;
        const rectY = height - rectHeight - 4;

        // Draw translucent soft white background block (demi-transparent with 0.62 opacity)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        
        // Draw subtle border around the block
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        
        // Render text
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStr, rectX + padding, rectY + rectHeight / 2);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.photosObjUrl.push(dataUrl);

        if (this.activeCameraTarget === 'dash_dep') {
          this.dashPhotoDep = dataUrl;
          const previewDep = document.getElementById('ins_preview_dash_dep');
          const placeholderDep = document.getElementById('ins_placeholder_dash_dep');
          if (previewDep) {
            previewDep.src = dataUrl;
            previewDep.classList.remove('hidden');
          }
          if (placeholderDep) placeholderDep.classList.add('hidden');
          
          if (window.DashboardService) {
            window.DashboardService.showNotification("Photo de tableau de bord (Départ) enregistrée !", "success");
          }
        } else if (this.activeCameraTarget === 'deposit_receipt') {
          this.depositReceiptPhoto = dataUrl;
          const previewDeposit = document.getElementById('ins_preview_deposit_receipt');
          const placeholderDeposit = document.getElementById('ins_placeholder_deposit_receipt');
          if (previewDeposit) {
            previewDeposit.src = dataUrl;
            previewDeposit.classList.remove('hidden');
          }
          if (placeholderDeposit) placeholderDeposit.classList.add('hidden');
          
          if (window.DashboardService) {
            window.DashboardService.showNotification("Photo du reçu de la caution enregistrée !", "success");
          }
        } else if (this.activeCameraTarget === 'contract') {
          this.contractPhoto = dataUrl;
          const previewContract = document.getElementById('ins_preview_contract_photo');
          const placeholderContract = document.getElementById('ins_placeholder_contract_photo');
          if (previewContract) {
            previewContract.src = dataUrl;
            previewContract.classList.remove('hidden');
          }
          if (placeholderContract) placeholderContract.classList.add('hidden');
          
          if (window.DashboardService) {
            window.DashboardService.showNotification("Photo du contrat de convoyage enregistrée !", "success");
          }
        } else if (this.activeCameraTarget === 'dash_arr') {
          this.dashPhotoArr = dataUrl;
          const previewArr = document.getElementById('ins_preview_dash_arr');
          const placeholderArr = document.getElementById('ins_placeholder_dash_arr');
          if (previewArr) {
            previewArr.src = dataUrl;
            previewArr.classList.remove('hidden');
          }
          if (placeholderArr) placeholderArr.classList.add('hidden');
          
          if (window.DashboardService) {
            window.DashboardService.showNotification("Photo de tableau de bord (Arrivée) enregistrée !", "success");
          }
        } else {
          const container = document.getElementById('ins_photo_preview_container');
          if (container) {
            container.classList.remove('hidden');
            const imgDiv = document.createElement('div');
            imgDiv.className = 'relative w-20 h-20 rounded-xl overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group';
            imgDiv.innerHTML = `
              <img src="${dataUrl}" class="w-full h-full object-cover transition-transform group-hover:scale-105" onclick="InspectionService.openLightbox('${dataUrl}')">
              <button type="button" onclick="this.parentElement.remove()" class="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1.5 shadow-sm active:scale-95"><i data-lucide="x" class="w-3 h-3"></i></button>
            `;
            container.appendChild(imgDiv);
            if (window.lucide) window.lucide.createIcons();
          }

          if (window.DashboardService) {
            window.DashboardService.showNotification("Photo ajoutée avec succès !", "success");
          }
        }
      }
    } catch (err) {
      console.error("Failure while writing frame:", err);
    }

    this.stopCameraStream();
  },

  triggerNativeCamera() {
    this.stopCameraStream(); // Stop the active camera stream if it's open
    const input = document.getElementById('ins_camera_fallback_input') || document.getElementById('ins_photo_input');
    if (input) {
      input.setAttribute('capture', 'environment'); // Force camera
      input.click();
    }
  },

  triggerNativeGallery() {
    this.closePhotoSourceModal();
    const input = document.getElementById('ins_photo_input');
    if (input) {
      input.removeAttribute('capture'); // Allow gallery
      input.click();
    }
  },

  toggleCameraInfo() {
    if (window.DashboardService) {
      window.DashboardService.showNotification("Conseil : Veillez à ce que l'avarie soit bien nette et centrée.", "info");
    }
  },

  openLightbox(url) {
    const lightbox = document.getElementById('ins_lightbox');
    const img = document.getElementById('ins_lightbox_img');
    if (lightbox && img && url) {
      img.src = url;
      lightbox.classList.remove('hidden');
      lightbox.classList.add('flex');
    }
  },

  closeLightbox() {
    const lightbox = document.getElementById('ins_lightbox');
    const img = document.getElementById('ins_lightbox_img');
    if (lightbox && img) {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
      setTimeout(() => img.src = '', 200);
    }
  },

  showStep(stepId) {
    // Hide all steps
    ['intro', 'depart_status', 'depart_confirmation', 'arrival_inspection', 'arrival_status', 'summary', 'add_damage'].forEach(step => {
      const el = document.getElementById(`ins_step_${step}`);
      if(el) el.classList.add('hidden');
    });
    // Show target step
    const target = document.getElementById(`ins_step_${stepId}`);
    if(target) {
      target.classList.remove('hidden');
      target.classList.add('flex');
    }
  },

  startInspection() {
    this.showStep('depart_status');
  },

  confirmDepartStatusStep() {
    this.confirmStage1Step();
  },

  confirmStage1Step() {
    this.departRef = document.getElementById('ins_depart_ref').value;
    this.departClient = document.getElementById('ins_depart_client').value;
    this.departKm = document.getElementById('ins_depart_km').value;
    this.departFuel = document.getElementById('ins_depart_fuel').value;
    this.departDate = document.getElementById('ins_depart_date').value;
    this.departTime = document.getElementById('ins_depart_time').value;

    if (!this.departKm || isNaN(parseInt(this.departKm))) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Veuillez saisir un kilométrage de départ valide !", "error");
      }
      return;
    }

    if (!this.dashPhotoDep) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("La photo du tableau de bord au départ est obligatoire !", "error");
      }
      return;
    }

    this.showStep('depart_confirmation');
    setTimeout(() => {
      this.initSignaturePad();
      this.toggleConfirmCheck();
    }, 50);
  },

  confirmStage2Step() {
    const chk = document.getElementById('ins_driver_confirm_check');
    if (!chk || !chk.checked) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Vous devez confirmer que le véhicule est opérationnel pour continuer.", "error");
      }
      return;
    }
    this.showStep('arrival_inspection');
    this.renderDamagesList();
  },

  confirmStage3Step() {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    this.showStep('arrival_status');

    const kmArrEl = document.getElementById('ins_arrivee_km');
    const dateArrEl = document.getElementById('ins_arrivee_date');
    const timeArrEl = document.getElementById('ins_arrivee_time');

    if (kmArrEl && !kmArrEl.value) {
      const depKmValue = parseInt(this.departKm) || 0;
      kmArrEl.value = depKmValue > 0 ? depKmValue + 150 : '';
    }
    if (dateArrEl && !dateArrEl.value) dateArrEl.value = todayStr;
    if (timeArrEl && !timeArrEl.value) timeArrEl.value = timeStr;

    const mission = app.missions.find(m => m.id === this.activeMissionId);
    const destNameEl = document.getElementById('ins_arrival_dest_name');
    if (destNameEl && mission) {
      destNameEl.textContent = mission.destination || 'N/A';
    }

    this.selectArrivalFuel(this.arriveeFuel || '1/2');
  },

  goToArrivalStatus() {
    this.confirmStage3Step();
  },

  selectArrivalFuel(val) {
    this.arriveeFuel = val;
    const input = document.getElementById('ins_arrivee_fuel');
    if (input) input.value = val;

    ['0', '1/4', '1/2', '3/4', '1'].forEach(k => {
      const idKey = k.replace('/', '_');
      const btn = document.getElementById(`arr_fuel_btn_${idKey}`);
      if (btn) {
        if (k === val) {
          btn.className = "flex-1 text-[10px] font-black py-1.5 rounded bg-emerald-600 text-white shadow-sm border border-emerald-500 cursor-pointer transition-all";
        } else {
          btn.className = "flex-1 text-[10px] font-black py-1.5 rounded text-slate-400 hover:bg-slate-800 cursor-pointer transition-all";
        }
      }
    });
  },

  confirmArrivalStatusStep() {
    this.confirmStage4Step();
  },

  confirmStage4Step() {
    this.arriveeKm = document.getElementById('ins_arrivee_km')?.value || '';
    this.arriveeFuel = document.getElementById('ins_arrivee_fuel')?.value || '1/2';
    this.arriveeDate = document.getElementById('ins_arrivee_date')?.value || '';
    this.arriveeTime = document.getElementById('ins_arrivee_time')?.value || '';

    if (!this.arriveeKm || isNaN(parseInt(this.arriveeKm))) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Veuillez renseigner le kilométrage d'arrivée !", "error");
      }
      return;
    }

    const depKm = parseInt(this.departKm) || 0;
    const arrKm = parseInt(this.arriveeKm) || 0;
    if (arrKm < depKm) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(`Erreur: Kilométrage d'arrivée (${arrKm} km) inférieur au départ (${depKm} km) !`, "error");
      }
      return;
    }

    if (!this.dashPhotoArr) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("La photo du tableau de bord à l'arrivée est obligatoire !", "error");
      }
      return;
    }

    this.submitInspection();
  },

  selectFuel(val) {
    this.departFuel = val;
    const input = document.getElementById('ins_depart_fuel');
    if (input) input.value = val;

    ['0', '1/4', '1/2', '3/4', '1'].forEach(k => {
      const idKey = k.replace('/', '_');
      const btn = document.getElementById(`fuel_btn_${idKey}`);
      if (btn) {
        if (k === val) {
          btn.className = "flex-1 text-[10px] font-black py-1.5 rounded bg-indigo-600 text-white shadow-sm border border-indigo-500 cursor-pointer transition-all";
        } else {
          btn.className = "flex-1 text-[10px] font-black py-1.5 rounded text-slate-400 hover:bg-slate-800 cursor-pointer transition-all";
        }
      }
    });
  },

  handleDashPhoto(input, type) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      let dataUrl = e.target.result;
      dataUrl = await this.overlayTimestamp(dataUrl);

      if (type === 'dep') {
        this.dashPhotoDep = dataUrl;
        const previewDep = document.getElementById('ins_preview_dash_dep');
        const placeholderDep = document.getElementById('ins_placeholder_dash_dep');
        if (previewDep) {
          previewDep.src = dataUrl;
          previewDep.classList.remove('hidden');
        }
        if (placeholderDep) placeholderDep.classList.add('hidden');
      } else if (type === 'deposit_receipt') {
        this.depositReceiptPhoto = dataUrl;
        const previewDeposit = document.getElementById('ins_preview_deposit_receipt');
        const placeholderDeposit = document.getElementById('ins_placeholder_deposit_receipt');
        if (previewDeposit) {
          previewDeposit.src = dataUrl;
          previewDeposit.classList.remove('hidden');
        }
        if (placeholderDeposit) placeholderDeposit.classList.add('hidden');
      } else if (type === 'contract') {
        this.contractPhoto = dataUrl;
        const previewContract = document.getElementById('ins_preview_contract_photo');
        const placeholderContract = document.getElementById('ins_placeholder_contract_photo');
        if (previewContract) {
          previewContract.src = dataUrl;
          previewContract.classList.remove('hidden');
        }
        if (placeholderContract) placeholderContract.classList.add('hidden');
      } else {
        this.dashPhotoArr = dataUrl;
        const previewArr = document.getElementById('ins_preview_dash_arr');
        const placeholderArr = document.getElementById('ins_placeholder_dash_arr');
        if (previewArr) {
          previewArr.src = dataUrl;
          previewArr.classList.remove('hidden');
        }
        if (placeholderArr) placeholderArr.classList.add('hidden');
      }

      if (window.DashboardService) {
        let label = "tableau de bord (Départ)";
        if (type === 'arr') label = "tableau de bord (Arrivée)";
        if (type === 'deposit_receipt') label = "reçu de caution";
        if (type === 'contract') label = "contrat de convoyage";
        window.DashboardService.showNotification(`Photo de ${label} enregistrée avec horodatage !`, "success");
      }
    };
    reader.readAsDataURL(file);
  },

  async handleAIScan(input) {
    const file = input.files[0];
    if (!file) return;

    const loader = document.getElementById('ins_ai_scan_loading');
    if (loader) loader.classList.remove('hidden');

    const formData = new FormData();
    formData.append('image', file);

    try {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Gemini analyse l'image de votre état des lieux...", "info");
      }
      const res = await fetch('/api/scan-inspection', {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.success && resData.data) {
        const data = resData.data;
        if (data.contrat_id) {
          document.getElementById('ins_depart_ref').value = data.contrat_id;
        }
        if (data.km_depart) {
          document.getElementById('ins_depart_km').value = data.km_depart;
        }
        if (data.carburant) {
          this.selectFuel(data.carburant);
        }
        if (data.client) {
          document.getElementById('ins_depart_client').value = data.client;
        }
        if (data.date_depart) {
          document.getElementById('ins_depart_date').value = data.date_depart;
        }
        if (data.heure_depart) {
          document.getElementById('ins_depart_time').value = data.heure_depart;
        }

        if (window.DashboardService) {
          window.DashboardService.showNotification("État des lieux existant analysé par Gemini avec succès !", "success");
        }
      } else {
        throw new Error(resData.error || "Gemini n'a pas pu lire les données.");
      }
    } catch (e) {
      console.error(e);
      if (window.DashboardService) {
        window.DashboardService.showNotification("Échec de l'import : " + e.message, "error");
      }
    } finally {
      if (loader) loader.classList.add('hidden');
      input.value = ''; // reset
    }
  },

  loadRealDemoValues() {
    const ref = '5139872-1537056';
    const client = 'Avis France';
    const km = 10;
    const fuel = '1/2';
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    document.getElementById('ins_depart_ref').value = ref;
    document.getElementById('ins_depart_client').value = client;
    document.getElementById('ins_depart_km').value = km;
    document.getElementById('ins_depart_date').value = todayStr;
    document.getElementById('ins_depart_time').value = timeStr;

    this.selectFuel(fuel);

    // Mock dashboard photos
    this.dashPhotoDep = "https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=400&auto=format&fit=crop";
    this.dashPhotoArr = "https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=400&auto=format&fit=crop";

    const previewDep = document.getElementById('ins_preview_dash_dep');
    const placeholderDep = document.getElementById('ins_placeholder_dash_dep');
    if (previewDep) {
      previewDep.src = this.dashPhotoDep;
      previewDep.classList.remove('hidden');
    }
    if (placeholderDep) placeholderDep.classList.add('hidden');

    const previewArr = document.getElementById('ins_preview_dash_arr');
    const placeholderArr = document.getElementById('ins_placeholder_dash_arr');
    if (previewArr) {
      previewArr.src = this.dashPhotoArr;
      previewArr.classList.remove('hidden');
    }
    if (placeholderArr) placeholderArr.classList.add('hidden');

    if (window.DashboardService) {
      window.DashboardService.showNotification("Exemple DriiveMe chargé avec succès !", "success");
    }
  },

  viewDashPhoto(type) {
    const isDep = type === 'dep' || type === 'depart';
    const target = isDep ? 'dash_dep' : 'dash_arr';
    const url = isDep ? this.dashPhotoDep : this.dashPhotoArr;
    
    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource(target);
    }
  },

  viewDepositPhoto() {
    const url = this.depositReceiptPhoto;
    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource('deposit_receipt');
    }
  },

  viewContractPhoto() {
    const url = this.contractPhoto;
    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource('contract');
    }
  },

  goToSummary() {
    this.showStep('summary');
    this.renderSummary();
  },

  // ADD DAMAGE FLOW
  openAddDamageWithStage(stage = 'departure') {
    this.currentDamageStage = stage;
    this.openAddDamage();
  },

  openAddDamage(zoneName = 'Avant') {
    document.getElementById('ins_damage_zone').value = zoneName;
    document.getElementById('ins_damage_type').value = 'Rayure';
    document.getElementById('ins_damage_severity').value = 'Léger';
    document.getElementById('ins_damage_notes').value = '';
    
    const photoContainer = document.getElementById('ins_photo_preview_container');
    photoContainer.innerHTML = '';
    photoContainer.classList.add('hidden');
    document.getElementById('ins_photo_input').value = '';

    const previewDamage = document.getElementById('ins_preview_damage');
    const placeholderDamage = document.getElementById('ins_placeholder_damage');
    if (previewDamage) {
      previewDamage.src = '';
      previewDamage.classList.add('hidden');
    }
    if (placeholderDamage) {
      placeholderDamage.classList.remove('hidden');
    }
    
    this.showStep('add_damage');
  },

  removeDamagePhoto(btn) {
    const item = btn.parentElement;
    const container = document.getElementById('ins_photo_preview_container');
    if (item && container) {
      item.remove();
      const imgs = container.querySelectorAll('img');
      const previewDamage = document.getElementById('ins_preview_damage');
      const placeholderDamage = document.getElementById('ins_placeholder_damage');
      if (imgs.length === 0) {
        container.classList.add('hidden');
        if (previewDamage) {
          previewDamage.src = '';
          previewDamage.classList.add('hidden');
        }
        if (placeholderDamage) placeholderDamage.classList.remove('hidden');
      } else {
        if (previewDamage) {
          previewDamage.src = imgs[imgs.length - 1].src;
        }
      }
    }
  },

  handlePhotoUpload(evt) {
    const files = evt.target.files;
    if(!files || files.length === 0) return;
    
    if (this.activeCameraTarget === 'dash_dep') {
      this.handleDashPhoto(evt.target, 'dep');
      evt.target.value = '';
      return;
    }
    if (this.activeCameraTarget === 'deposit_receipt') {
      this.handleDashPhoto(evt.target, 'deposit_receipt');
      evt.target.value = '';
      return;
    }
    if (this.activeCameraTarget === 'contract') {
      this.handleDashPhoto(evt.target, 'contract');
      evt.target.value = '';
      return;
    }
    if (this.activeCameraTarget === 'dash_arr') {
      this.handleDashPhoto(evt.target, 'arr');
      evt.target.value = '';
      return;
    }

    const container = document.getElementById('ins_photo_preview_container');
    container.classList.remove('hidden');
    
    // Convert to inline Base64 data URLs for preview and persistence
    for(let f of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let dataUrl = e.target.result;
        dataUrl = await this.overlayTimestamp(dataUrl);
        this.photosObjUrl.push(dataUrl);
        
        const previewDamage = document.getElementById('ins_preview_damage');
        const placeholderDamage = document.getElementById('ins_placeholder_damage');
        if (previewDamage) {
          previewDamage.src = dataUrl;
          previewDamage.classList.remove('hidden');
        }
        if (placeholderDamage) placeholderDamage.classList.add('hidden');

        const imgDiv = document.createElement('div');
        imgDiv.className = 'relative w-14 h-14 rounded-lg overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group border border-slate-800';
        imgDiv.innerHTML = `
          <img src="${dataUrl}" class="w-full h-full object-cover transition-transform group-hover:scale-105" onclick="InspectionService.openLightbox('${dataUrl}')">
          <button type="button" onclick="InspectionService.removeDamagePhoto(this)" class="absolute top-0.5 right-0.5 bg-red-500/95 text-white rounded-full p-1 shadow-sm active:scale-95"><i data-lucide="x" class="w-2.5 h-2.5"></i></button>
        `;
        container.appendChild(imgDiv);
        
        if (window.lucide) window.lucide.createIcons();
      };
      reader.readAsDataURL(f);
    }
    evt.target.value = '';
  },

  saveDamage() {
    const zone = document.getElementById('ins_damage_zone').value;
    const type = document.getElementById('ins_damage_type').value;
    const severity = document.getElementById('ins_damage_severity').value;
    const notes = document.getElementById('ins_damage_notes').value;
    
    const container = document.getElementById('ins_photo_preview_container');
    const imgs = container.querySelectorAll('img');
    const photoUrls = Array.from(imgs).map(img => img.src);

    if (!notes || notes.trim().length < 3) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("La description (notes) est obligatoire et doit faire au moins 3 caractères !", "error");
      }
      return;
    }

    if (photoUrls.length === 0) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Une photo de preuve est obligatoire pour déclarer ce problème !", "error");
      }
      return;
    }

    this.damages.push({
      id: Date.now().toString(),
      stage: this.currentDamageStage,
      zone, type, severity, notes, photoUrls
    });

    if (this.currentDamageStage === 'departure') {
      this.showStep('depart_status');
    } else {
      this.showStep('arrival_inspection');
    }
    this.renderDamagesList();
  },

  cancelAddDamage() {
    if (this.currentDamageStage === 'departure') {
      this.showStep('depart_status');
    } else {
      this.showStep('arrival_inspection');
    }
  },
  
  deleteDamage(id) {
    this.damages = this.damages.filter(d => d.id !== id);
    this.renderDamagesList();
  },

  renderDamagesList() {
    // Render departure damages list
    const depListEl = document.getElementById('ins_departure_damages_list');
    if (depListEl) {
      const depDamages = this.damages.filter(d => d.stage === 'departure');
      depListEl.innerHTML = '';
      if (depDamages.length === 0) {
        depListEl.innerHTML = `
          <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-500">
            <i data-lucide="shield-check" class="w-8 h-8 mx-auto mb-1.5 opacity-40 text-indigo-400"></i>
            <p class="text-[10px] font-bold uppercase tracking-wider">Aucune anomalie signalée</p>
            <p class="text-[9px] text-slate-500">Le véhicule est présumé intact au départ.</p>
          </div>
        `;
      } else {
        depDamages.forEach(d => {
          let severityColor = 'text-amber-500 bg-amber-500/10 border border-amber-500/20';
          if(d.severity === 'Important') severityColor = 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
          
          depListEl.innerHTML += `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 relative animate-fade-in text-left">
              <div class="flex items-start justify-between min-w-0 pr-6">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-xs text-slate-200">${d.zone}</span>
                  <span class="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${severityColor}">${d.severity}</span>
                </div>
                <p class="text-[10px] text-slate-400 font-bold ml-2 shrink-0">${d.type}</p>
                <button type="button" onclick="InspectionService.deleteDamage('${d.id}')" class="absolute top-2.5 right-2.5 p-1.5 text-slate-500 hover:text-rose-450 bg-slate-950/70 border border-slate-800 rounded-lg shadow transition-colors hover:border-rose-900 duration-150">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
                </button>
              </div>
              <p class="text-[10px] text-slate-300 italic font-sans break-words bg-slate-950/40 p-1.5 rounded border border-slate-950 mt-1">"${d.notes || 'Pas de notes'}"</p>
              
              ${d.photoUrls && d.photoUrls.length > 0 ? `
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  ${d.photoUrls.map((url, i) => `
                    <div class="w-12 h-12 rounded bg-slate-950 border border-slate-850 overflow-hidden cursor-pointer hover:border-indigo-500 hover:scale-[1.03] transition-all" onclick="InspectionService.openLightbox('${url}')">
                      <img src="${url}" class="w-full h-full object-cover">
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
    }

    // Render arrival damages list
    const arrListEl = document.getElementById('ins_arrival_damages_list');
    if (arrListEl) {
      const arrDamages = this.damages.filter(d => d.stage === 'arrival');
      arrListEl.innerHTML = '';
      if (arrDamages.length === 0) {
        arrListEl.innerHTML = `
          <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-505">
            <i data-lucide="shield-check" class="w-8 h-8 mx-auto mb-1.5 opacity-40 text-emerald-400"></i>
            <p class="text-[10px] font-bold uppercase tracking-wider">Aucune nouvelle anomalie</p>
            <p class="text-[9px] text-slate-500">Aucun dommage de convoyage déclaré.</p>
          </div>
        `;
      } else {
        arrDamages.forEach(d => {
          let severityColor = 'text-amber-500 bg-amber-500/10 border border-amber-500/20';
          if(d.severity === 'Important') severityColor = 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
          
          arrListEl.innerHTML += `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 relative animate-fade-in text-left">
              <div class="flex items-start justify-between min-w-0 pr-6">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-xs text-slate-200">${d.zone}</span>
                  <span class="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${severityColor}">${d.severity}</span>
                </div>
                <p class="text-[10px] text-slate-400 font-bold ml-2 shrink-0">${d.type}</p>
                <button type="button" onclick="InspectionService.deleteDamage('${d.id}')" class="absolute top-2.5 right-2.5 p-1.5 text-slate-500 hover:text-rose-450 bg-slate-950/70 border border-slate-800 rounded-lg shadow transition-colors hover:border-rose-900 duration-150">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
                </button>
              </div>
              <p class="text-[10px] text-slate-300 italic font-sans break-words bg-slate-950/40 p-1.5 rounded border border-slate-950 mt-1">"${d.notes || 'Pas de notes'}"</p>
              
              ${d.photoUrls && d.photoUrls.length > 0 ? `
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  ${d.photoUrls.map((url, i) => `
                    <div class="w-12 h-12 rounded bg-slate-950 border border-slate-850 overflow-hidden cursor-pointer hover:border-indigo-500 hover:scale-[1.03] transition-all" onclick="InspectionService.openLightbox('${url}')">
                      <img src="${url}" class="w-full h-full object-cover">
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
    }

    if (window.lucide) window.lucide.createIcons();
  },

  renderSummary() {
    if (!document.getElementById('inspectionModal')) {
      return;
    }
    const listEl = document.getElementById('ins_summary_damages');
    const photosEl = document.getElementById('ins_summary_photos');
    
    const mission = app.missions.find(m => m.id === this.activeMissionId);
    
    // Summary info
    const summaryDateEl = document.getElementById('ins_summary_date');
    if (summaryDateEl) {
      summaryDateEl.textContent = new Date().toLocaleString('fr-FR');
    }
    const summaryDamageCountEl = document.getElementById('ins_summary_damage_count');
    if (summaryDamageCountEl) {
      summaryDamageCountEl.textContent = this.damages.length;
    }

    // Fill contract and departure details
    const refSummary = document.getElementById('ins_summary_ref');
    if (refSummary) refSummary.textContent = this.departRef || 'Non spécifié';

    const clientSummary = document.getElementById('ins_summary_client');
    if (clientSummary) clientSummary.textContent = this.departClient || 'Non spécifié';

    const kmSummary = document.getElementById('ins_summary_km');
    if (kmSummary) kmSummary.textContent = this.departKm ? `${this.departKm} km` : 'Non spécifié';

    const fuelSummary = document.getElementById('ins_summary_fuel');
    if (fuelSummary) fuelSummary.textContent = this.departFuel || 'Non spécifié';

    const dtSummary = document.getElementById('ins_summary_depart_datetime');
    if (dtSummary) {
      const formattedDate = this.departDate ? new Date(this.departDate).toLocaleDateString('fr-FR') : 'N/A';
      dtSummary.textContent = `${formattedDate} à ${this.departTime || 'N/A'}`;
    }

    // Fill arrival details inside summary
    const arrDestSummary = document.getElementById('ins_summary_arr_dest');
    if (arrDestSummary && mission) {
      arrDestSummary.textContent = mission.destination || 'N/A';
    }

    const kmArrSummary = document.getElementById('ins_summary_arr_km');
    if (kmArrSummary) kmArrSummary.textContent = this.arriveeKm ? `${this.arriveeKm} km` : 'Non spécifié';

    const fuelArrSummary = document.getElementById('ins_summary_arr_fuel');
    if (fuelArrSummary) fuelArrSummary.textContent = this.arriveeFuel || 'Non spécifié';

    const dtArrSummary = document.getElementById('ins_summary_arrivee_datetime');
    if (dtArrSummary) {
      const formattedDate = this.arriveeDate ? new Date(this.arriveeDate).toLocaleDateString('fr-FR') : 'N/A';
      dtArrSummary.textContent = `${formattedDate} à ${this.arriveeTime || 'N/A'}`;
    }

    // Live previews for TDB
    const tdbDepImg = document.getElementById('ins_summary_img_dep');
    const tdbDepPlaceholder = document.getElementById('ins_summary_img_dep_placeholder');
    if (this.dashPhotoDep) {
      if (tdbDepImg) {
        tdbDepImg.src = this.dashPhotoDep;
        tdbDepImg.classList.remove('hidden');
      }
      if (tdbDepPlaceholder) tdbDepPlaceholder.classList.add('hidden');
    } else {
      if (tdbDepImg) tdbDepImg.classList.add('hidden');
      if (tdbDepPlaceholder) tdbDepPlaceholder.classList.remove('hidden');
    }

    const tdbArrImg = document.getElementById('ins_summary_img_arr');
    const tdbArrPlaceholder = document.getElementById('ins_summary_img_arr_placeholder');
    if (this.dashPhotoArr) {
      if (tdbArrImg) {
        tdbArrImg.src = this.dashPhotoArr;
        tdbArrImg.classList.remove('hidden');
      }
      if (tdbArrPlaceholder) tdbArrPlaceholder.classList.add('hidden');
    } else {
      if (tdbArrImg) tdbArrImg.classList.add('hidden');
      if (tdbArrPlaceholder) tdbArrPlaceholder.classList.remove('hidden');
    }
    
    // Fill mission details
    if (mission) {
      const summaryElements = {
        'ins_summary_vehicle': mission.vehicle || mission.modele || 'Véhicule N/A',
        'ins_summary_plate': mission.immatriculation || 'N/A',
        'ins_summary_depart': mission.depart || 'N/A',
        'ins_summary_destination': mission.destination || 'N/A',
        'ins_summary_platform': mission.plateforme || 'N/A'
      };

      for (const [id, value] of Object.entries(summaryElements)) {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = value;
        }
      }
      
      const fmtEuro = (v) => Number(v || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
      const gainEl = document.getElementById('ins_summary_gain');
      if (gainEl) {
        gainEl.textContent = fmtEuro(mission.gain);
      }
    }
    
    listEl.innerHTML = '';
    photosEl.innerHTML = '';
    
    let allPhotos = [];
    this.damages.forEach(d => {
      allPhotos.push(...d.photoUrls);
      listEl.innerHTML += `
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-left">
          <div class="flex flex-col">
            <span class="text-sm font-bold text-slate-900 dark:text-white">${d.zone} - ${d.type}</span>
            <span class="text-[10px] text-slate-500">${d.severity} // ${d.notes || 'Pas de notes'}</span>
          </div>
        </div>
      `;
    });
    
    if(this.damages.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-emerald-500 font-bold py-2"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Véhicule en parfait état signalé</p>';
    }

    if(allPhotos.length > 0) {
      allPhotos.forEach(url => {
        photosEl.innerHTML += `<div class="w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onclick="InspectionService.openLightbox('${url}')"><img src="${url}" class="w-full h-full object-cover"></div>`;
      });
    } else {
      photosEl.innerHTML = '<p class="text-xs text-slate-400">Aucune photo prise.</p>';
    }

    this.updateSMSLinks();

    if (window.lucide) window.lucide.createIcons();
  },

  updateSMSLinks() {
    const mission = app.missions.find(m => m.id === this.activeMissionId);
    if (!mission) return;
    
    const contactPhone = document.getElementById('ins_summary_contact_phone')?.value || '+33612345678';
    
    let text = `ANOMALIES & DÉTAILS CONVOYAGE\n`;
    text += `=========================\n`;
    text += `Véhicule: ${mission.vehicle || mission.modele || 'N/A'}\n`;
    text += `Immatriculation: ${mission.immatriculation || 'N/A'}\n`;
    text += `Itinéraire: ${mission.depart || 'N/A'} -> ${mission.destination || 'N/A'}\n`;
    text += `Plateforme: ${mission.plateforme || 'N/A'}\n`;
    text += `Date Signalement: ${new Date().toLocaleString('fr-FR')}\n`;
    text += `-------------------------\n`;
    text += `Nombre d'Anomalies: ${this.damages.length}\n`;
    
    if (this.damages.length === 0) {
      text += `✓ Aucun dommage détecté lors de l'inspection de départ.\n`;
    } else {
      this.damages.forEach((d, index) => {
        text += `${index + 1}. Zone: ${d.zone} | Type: ${d.type} | Gravité: ${d.severity}\n`;
        if (d.notes) text += `   Notes: "${d.notes}"\n`;
      });
    }
    
    const textarea = document.getElementById('ins_summary_sms_textarea');
    if (textarea) {
      textarea.value = text;
    }
    
    const smsBtn = document.getElementById('ins_summary_sms_btn');
    if (smsBtn) {
      smsBtn.href = `sms:${contactPhone}?body=${encodeURIComponent(text)}`;
    }
    
    const callBtn = document.getElementById('ins_summary_call_btn');
    if (callBtn) {
      callBtn.href = `tel:${contactPhone}`;
    }
  },

  copySMS() {
    const textarea = document.getElementById('ins_summary_sms_textarea');
    if (textarea) {
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(textarea.value).then(() => {
        if (window.DashboardService) {
          window.DashboardService.showNotification("État des lieux copié !", "success");
        }
      }).catch(() => {
        try {
          document.execCommand('copy');
          if (window.DashboardService) {
            window.DashboardService.showNotification("Réussi (presse-papier) !", "success");
          }
        } catch (e) {
          if (window.DashboardService) {
            window.DashboardService.showNotification("Veuillez sélectionner et copier.", "warning");
          }
        }
      });
    }
  },

  updateDriveBtnState(mission) {
    const driveBtn = document.getElementById('btn_ins_success_drive_upload');
    if (driveBtn) {
      if (mission.driveSaved) {
        driveBtn.disabled = true;
        driveBtn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-300"></i> Sauvegardé dans Drive`;
        driveBtn.className = "px-4 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 font-black uppercase tracking-wider rounded-xl transition-all cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md opacity-75";
      } else {
        driveBtn.disabled = false;
        driveBtn.innerHTML = `<i data-lucide="cloud-upload" class="w-4 h-4"></i> Enregistrer dans Google Drive`;
        driveBtn.className = "px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs text-white font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md";
      }
    }

    // Update index.html success modal details grid field
    const successDriveStatus = document.getElementById('ins_success_drive_status');
    if (successDriveStatus) {
      if (mission.driveSaved) {
        successDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-400 bg-emerald-505/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><i data-lucide="check-circle" class="w-3 h-3 text-emerald-400"></i> Sauvegardé</span>`;
      } else {
        successDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500"></i> Non sauvegardé</span>`;
      }
    }

    // Update index.html summary details grid field
    const summaryDriveStatus = document.getElementById('ins_summary_drive_status');
    if (summaryDriveStatus) {
      if (mission.driveSaved) {
        summaryDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-400 bg-emerald-505/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i> Sauvegardé</span>`;
      } else {
        summaryDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500"></i> Non sauvegardé</span>`;
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  uploadCurrentMissionToDrive() {
    const missionId = this.successMissionId || this.activeMissionId;
    const mission = app.missions.find(m => m.id === missionId);
    if (!mission) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Aucune mission active trouvée pour l'upload.", "error");
      }
      return;
    }
    if (mission.driveSaved) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Cette mission est déjà sauvegardée sur Google Drive.", "info");
      }
      return;
    }
    this.uploadMissionToDrive(mission);
  },

  async uploadMissionToDrive(mission) {
    const driveToken = window.googleDriveAccessToken;
    if (!driveToken) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Veuillez d'abord connecter votre compte Google Drive dans l'onglet Documents.", "warning");
      } else {
        alert("Activez d'abord Google Drive dans l'onglet de documents !");
      }
      return false;
    }

    if (!mission.immatriculation) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Numéro d'immatriculation requis pour l'enregistrement.", "error");
      }
      return false;
    }

    const driveBtn = document.getElementById('btn_ins_success_drive_upload');
    let originalBtnHTML = "";
    if (driveBtn) {
      originalBtnHTML = driveBtn.innerHTML;
      driveBtn.disabled = true;
      driveBtn.innerHTML = `<i class="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full mr-1.5"></i> Envoi en cours...`;
      driveBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
      driveBtn.classList.add('bg-emerald-700', 'cursor-not-allowed', 'opacity-75');
    }

    if (window.DashboardService) {
      window.DashboardService.showNotification("Sauvegarde en cours sur Google Drive...", "info");
    }

    try {
      // 1. Generate text report content
      let reportContent = `RAPPORT D'ÉTAT DES LIEUX DE CONVOYAGE\n`;
      reportContent += `=======================================\n\n`;
      reportContent += `DÉTAILS DE LA MISSION :\n`;
      reportContent += `---------------------------------------\n`;
      reportContent += `Véhicule: ${mission.vehicle || mission.modele || 'N/A'}\n`;
      reportContent += `Immatriculation: ${mission.immatriculation || 'N/A'}\n`;
      reportContent += `Trajet de convoyage: ${mission.depart || 'N/A'} ➔ ${mission.destination || 'N/A'}\n`;
      reportContent += `Plateforme: ${mission.plateforme || 'N/A'}\n`;
      reportContent += `Commission / Gain: ${mission.gain || 0} €\n`;
      
      const inspectionDate = mission.inspection && mission.inspection.date ? new Date(mission.inspection.date) : new Date();
      reportContent += `Date d'inspection: ${inspectionDate.toLocaleString('fr-FR')}\n`;
      if (mission.inspection) {
        reportContent += `Nº Contrat / Référence: ${mission.inspection.reference || 'Non spécifié'}\n`;
        reportContent += `Client de livraison: ${mission.inspection.client || 'Non spécifié'}\n`;
        reportContent += `Kilométrage de départ: ${mission.inspection.kmDepart ? (mission.inspection.kmDepart + ' km') : 'Non spécifié'}\n`;
        reportContent += `Niveau jauge carburant (Départ): ${mission.inspection.carburant || 'Non spécifié'}\n`;
        const dStr = mission.inspection.dateDepart ? new Date(mission.inspection.dateDepart).toLocaleDateString('fr-FR') : 'Non spécifié';
        reportContent += `Départ prévu le: ${dStr} à ${mission.inspection.heureDepart || 'Non spécifié'}\n`;
        if (mission.inspection.depositReceiptPhoto) {
          reportContent += `✓ Reçu de caution de garantie : Photo du reçu enregistrée\n`;
        } else {
          reportContent += `✗ Reçu de caution de garantie : Aucun reçu fourni\n`;
        }
        if (mission.inspection.contractPhoto) {
          reportContent += `✓ Photo du contrat de convoyage : Enregistrée\n`;
        } else {
          reportContent += `✗ Photo du contrat de convoyage : Non fournie\n`;
        }

        reportContent += `\nÉTAT D'ARRIVÉE À DESTINATION FINALE :\n`;
        reportContent += `---------------------------------------\n`;
        reportContent += `Kilométrage d'arrivée: ${mission.inspection.kmArrivee ? (mission.inspection.kmArrivee + ' km') : 'Non spécifié'}\n`;
        reportContent += `Niveau jauge carburant (Arrivée): ${mission.inspection.carburantArrivee || 'Non spécifié'}\n`;
        const aStr = mission.inspection.dateArrivee ? new Date(mission.inspection.dateArrivee).toLocaleDateString('fr-FR') : 'Non spécifié';
        reportContent += `Date d'arrivée: ${aStr} à ${mission.inspection.heureArrivee || 'Non spécifié'}\n`;
      }

      const damages = (mission.inspection && mission.inspection.damages) || [];
      
      reportContent += `\nRAPPORT D'ANOMALIES AU DÉPART :\n`;
      reportContent += `---------------------------------------\n`;
      const depDamages = damages.filter(d => d.stage === 'departure');
      if (depDamages.length === 0) {
        reportContent += `✓ Aucun dommage signalé au départ. Le véhicule est entièrement intact.\n`;
      } else {
        depDamages.forEach((d, index) => {
          reportContent += `${index + 1}. Zone: ${d.zone || 'N/A'} // Type: ${d.type || 'N/A'} // Sévérité: ${d.severity || 'N/A'}\n`;
          if (d.notes) reportContent += `   Notes: "${d.notes}"\n`;
          let nbPhotos = d.photoUrls ? d.photoUrls.length : 0;
          reportContent += `   Nombre de photos: ${nbPhotos}\n\n`;
        });
      }

      reportContent += `\nRAPPORT D'ANOMALIES À L'ARRIVÉE :\n`;
      reportContent += `---------------------------------------\n`;
      const arrDamages = damages.filter(d => d.stage === 'arrival');
      if (arrDamages.length === 0) {
        reportContent += `✓ Aucun dommage ni incident d'arrivée déclaré.\n`;
      } else {
        arrDamages.forEach((d, index) => {
          reportContent += `${index + 1}. Zone: ${d.zone || 'N/A'} // Type: ${d.type || 'N/A'} // Sévérité: ${d.severity || 'N/A'}\n`;
          if (d.notes) reportContent += `   Notes: "${d.notes}"\n`;
          let nbPhotos = d.photoUrls ? d.photoUrls.length : 0;
          reportContent += `   Nombre de photos: ${nbPhotos}\n\n`;
        });
      }

      reportContent += `\nENGAGEMENT & SIGNATURE DU CONDUCTEUR :\n`;
      reportContent += `---------------------------------------\n`;
      reportContent += `Confirmation du véhicule: Prêt & Opérationnel (Départ validé par signature manuscrite).\n`;
      if (mission.inspection?.signature) {
        reportContent += `✓ Signature manuscrite collectée et enregistrée en image jointe.\n`;
      } else {
        reportContent += `✗ Signature manuscrite non collectée.\n`;
      }

      const reportBlob = new Blob([reportContent], { type: 'text/plain' });
      const reportFile = new File([reportBlob], "Rapport_Etat_Des_Lieux.txt", { type: 'text/plain' });
      
      const reportFormData = new FormData();
      reportFormData.append("file", reportFile);
      reportFormData.append("immatriculation", mission.immatriculation);
      reportFormData.append("name", "Rapport_Etat_Des_Lieux.txt");
      
      const reportRes = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`
        },
        body: reportFormData
      });

      if (!reportRes.ok) {
        throw new Error("Failed to upload report to Drive");
      }

      // 2. Upload photo files
      let uploadedCount = 0;
      for (const d of damages) {
        const photoUrls = d.photoUrls || [];
        for (let i = 0; i < photoUrls.length; i++) {
          try {
            const url = photoUrls[i];
            let blob;
            if (url.startsWith('data:')) {
              const arr = url.split(',');
              const mimeMatch = arr[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              blob = new Blob([u8arr], { type: mime });
            } else {
              const response = await fetch(url);
              blob = await response.blob();
            }
            
            const stageLabel = d.stage === 'departure' ? 'DefautDep' : 'DefautArr';
            const extension = blob.type.split('/')[1] || 'jpg';
            const filename = `${stageLabel}_${(d.zone || 'Zone').replace(/\s+/g, '_')}_${(d.type || 'Type').replace(/\s+/g, '_')}_${i + 1}.${extension}`;
            
            const file = new File([blob], filename, { type: blob.type });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("immatriculation", mission.immatriculation);
            formData.append("name", filename);
            
            const uploadRes = await fetch('/api/drive/upload', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${driveToken}`
              },
              body: formData
            });
            
            if (uploadRes.ok) {
              uploadedCount++;
            }
          } catch (err) {
            console.error("Erreur d'upload de photo d'inspection:", err);
          }
        }
      }

      // 3. Upload dashboard and deposit receipt photos if they exist
      const extraPhotos = [
        { url: mission.inspection?.dashboardDepartPhoto, prefix: 'TDB_Depart' },
        { url: mission.inspection?.dashboardArriveePhoto, prefix: 'TDB_Arrivee' },
        { url: mission.inspection?.depositReceiptPhoto, prefix: 'Recu_Caution' },
        { url: mission.inspection?.contractPhoto, prefix: 'Contrat_Convoyage' }
      ];
      for (const tdb of extraPhotos) {
        if (tdb.url) {
          try {
            let blob;
            if (tdb.url.startsWith('data:')) {
              const arr = tdb.url.split(',');
              const mimeMatch = arr[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              blob = new Blob([u8arr], { type: mime });
            } else {
              const response = await fetch(tdb.url);
              blob = await response.blob();
            }
            
            const extension = blob.type.split('/')[1] || 'jpg';
            const filename = `${tdb.prefix}_${mission.immatriculation}.${extension}`;
            
            const file = new File([blob], filename, { type: blob.type });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("immatriculation", mission.immatriculation);
            formData.append("name", filename);
            
            await fetch('/api/drive/upload', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${driveToken}`
              },
              body: formData
            });
          } catch (err) {
            console.error("Erreur d'upload photo TDB aux Drive:", err);
          }
        }
      }

      // 4. Upload signature photo if it exists
      if (mission.inspection?.signature) {
        try {
          const sigUrl = mission.inspection.signature;
          let blob;
          if (sigUrl.startsWith('data:')) {
            const arr = sigUrl.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
          }
          
          if (blob) {
            const filename = `Signature_Conducteur_${mission.immatriculation}.png`;
            const file = new File([blob], filename, { type: blob.type });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("immatriculation", mission.immatriculation);
            formData.append("name", filename);
            
            await fetch('/api/drive/upload', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${driveToken}`
              },
              body: formData
            });
          }
        } catch (err) {
          console.error("Erreur d'upload de la signature à Google Drive:", err);
        }
      }

      // Mark mission as saved in Google Drive
      const missionIndex = app.missions.findIndex(m => m.id === mission.id);
      if (missionIndex !== -1) {
        app.missions[missionIndex].driveSaved = true;
        app.missions[missionIndex].statut = 'Terminée';
        app.saveMissions();
        if (window.app && window.app.refreshUI) {
          window.app.refreshUI();
        }
      }

      if (window.DashboardService) {
        window.DashboardService.showNotification("Mission, rapport d'état des lieux et signature sauvegardés sur Google Drive !", "success");
      }

      this.updateDriveBtnState(mission);
      return true;
    } catch (err) {
      console.error("Erreur d'enregistrement Google Drive:", err);
      if (window.DashboardService) {
        window.DashboardService.showNotification("Échec de la sauvegarde Google Drive.", "error");
      }
      if (driveBtn) {
        driveBtn.disabled = false;
        driveBtn.innerHTML = originalBtnHTML;
        driveBtn.classList.remove('bg-emerald-700', 'cursor-not-allowed', 'opacity-75');
        driveBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
        if (window.lucide) { window.lucide.createIcons(); }
      }
      return false;
    }
  },

  async submitInspection() {
    // Save inspection on the mission
    const missionIndex = app.missions.findIndex(m => m.id === this.activeMissionId);
    if(missionIndex !== -1) {
      const mission = app.missions[missionIndex];
      mission.inspection = {
        date: new Date().toISOString(),
        damages: this.damages,
        status: 'Validée',
        vehicle: mission.vehicle || mission.modele || 'N/A',
        immatriculation: mission.immatriculation || 'N/A',
        depart: mission.depart || 'N/A',
        destination: mission.destination || 'N/A',
        plateforme: mission.plateforme || 'N/A',
        gain: mission.gain || 0,
        // Added details from state
        reference: this.departRef,
        client: this.departClient,
        kmDepart: this.departKm,
        carburant: this.departFuel,
        dateDepart: this.departDate,
        heureDepart: this.departTime,
        dashboardDepartPhoto: this.dashPhotoDep,
        dashboardArriveePhoto: this.dashPhotoArr,
        depositReceiptPhoto: this.depositReceiptPhoto,
        contractPhoto: this.contractPhoto,
        // Active signoff & Driver validation
        signature: this.signatureData,
        confirmedOperative: true,
        // Arrivée
        kmArrivee: this.arriveeKm,
        carburantArrivee: this.arriveeFuel,
        dateArrivee: this.arriveeDate,
        heureArrivee: this.arriveeTime
      };
      
      // Auto-assign master status to 'Validée' since the final arrival check is complete
      mission.statut = 'Validée';
      
      app.saveMissions();
      app.refreshUI();
 
      // Check if Google Drive accessToken is available for automatic backup
      const driveToken = window.googleDriveAccessToken;
      if (driveToken && mission.immatriculation) {
        this.uploadMissionToDrive(mission);
      }
    }
    
    const savedMission = app.missions.find(m => m.id === this.activeMissionId);
    
    this.closeInspection();
 
    if (savedMission) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(`Inspection validée pour ${savedMission.vehicle || savedMission.modele || 'N/A'} ! Départ autorisé.`, "success");
      }
      this.showSuccessModal(savedMission);
    } else {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Inspection validée avec succès !", "success");
      }
    }
  }
};

window.InspectionService = InspectionService;
