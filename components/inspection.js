// Inspection Workflow Logic

export const InspectionService = {
  escapeHtml(str) {
    if (window.escapeHtml) return window.escapeHtml(str);
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  activeMissionId: null,
  damages: [],
  photosObjUrl: [], // To store object URLs for cleanup
  cameraStream: null, // Track media steam
  facingMode: "environment", // Default back lens

  currentDamageStage: "departure", // Stage state: departure or arrival
  signatureData: null,
  signatureCaptured: false,

  // Depart details & Dashboard pictures
  departRef: "",
  departClient: "",
  departKm: "",
  departFuel: "1/2",
  departDate: "",
  departTime: "",
  dashPhotoDep: null,
  dashPhotoArr: null,
  depositReceiptPhoto: null,
  contractPhoto: null,
  hasDepositReceipt: false,

  // Arrivée details
  arriveeKm: "",
  arriveeFuel: "1/2",
  arriveeDate: "",
  arriveeTime: "",

  renderSelectableMissions() {
    const listEl = document.getElementById("ins_selectable_missions_list");
    if (!listEl) return;
    listEl.innerHTML = "";

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

    missions.forEach((m) => {
      const isCompleted = (m.inspection && m.inspection.status === "Validée") || m.statut === "Terminée";
      const card = document.createElement("div");
      card.className =
        "bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-4 rounded-xl flex flex-col justify-between gap-3 hover:shadow-md transition-all";
      card.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-full">${this.escapeHtml(m.plateforme || "Otoqi")}</span>
            <span class="text-[10px] uppercase font-bold text-slate-400 font-mono">${this.escapeHtml(m.immatriculation || "Sans Immat")}</span>
          </div>
          <h4 class="font-extrabold text-xs text-slate-800 dark:text-white uppercase truncate">${this.escapeHtml(m.vehicle || m.modele || "Véhicule N/A")}</h4>
          <p class="text-[11px] text-slate-500 truncate">
            <span class="font-semibold">${this.escapeHtml(m.depart || "N/A")}</span> ➔ <span class="font-semibold">${this.escapeHtml(m.destination || "N/A")}</span>
          </p>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] text-emerald-500 font-extrabold">${m.gain || 0} € net</span>
            <span class="text-[10px] px-2 py-0.5 ${isCompleted ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"} font-black uppercase tracking-wider rounded">
              ${isCompleted ? "Validée" : "À inspecter"}
            </span>
          </div>
        </div>
        <button onclick="InspectionService.openInspection('${m.id}')" class="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-505 text-white rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-colors mt-1 uppercase tracking-wider">
          ${isCompleted ? "Voir le rapport" : "Lancer l'inspection"}
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
    if (!document.getElementById("inspectionModal")) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "État des lieux : Le module d'inspection physique n'est pas activé sur cette interface.",
          "info",
        );
      }
      return;
    }

    const noView = document.getElementById("ins_no_mission_view");
    const activeView = document.getElementById("ins_active_workflow_view");
    const successView = document.getElementById("section_ins_success_view");

    if (!missionId) {
      this.activeMissionId = null;
      if (noView) noView.classList.remove("hidden");
      if (activeView) activeView.classList.add("hidden");
      if (successView) successView.classList.add("hidden");
      this.renderSelectableMissions();
      return;
    }

    this.activeMissionId = missionId;
    this.damages = []; // reset
    this.currentDamageStage = "departure";
    this.signatureData = null;
    this.signatureCaptured = false;

    // Find mission to display details
    const mission = app.missions.find((m) => m.id === missionId);

    if (
      mission &&
      (mission.statut === "Terminée" || (mission.inspection && mission.inspection.status === "Validée"))
    ) {
      this.showSuccessModal(mission);
      return;
    }

    if (noView) noView.classList.add("hidden");
    if (activeView) activeView.classList.remove("hidden");
    if (successView) successView.classList.add("hidden");

    if (mission) {
      const vehicleInfoEl = document.getElementById("ins_vehicle_info");
      const plateInfoEl = document.getElementById("ins_plate_info");
      if (vehicleInfoEl) {
        vehicleInfoEl.textContent =
          mission.vehicle || mission.modele || "Véhicule NS";
      }
      if (plateInfoEl) {
        plateInfoEl.textContent = mission.immatriculation || "Plaque NS";
      }

      // Also set sidebar helper variables in layout
      const sideVeh = document.getElementById("ins_sidebar_vehicle");
      const sidePlate = document.getElementById("ins_sidebar_plate");
      const sideDep = document.getElementById("ins_sidebar_depart");
      const sideDest = document.getElementById("ins_sidebar_dest");

      if (sideVeh)
        sideVeh.textContent = mission.vehicle || mission.modele || "NS";
      if (sidePlate) {
        sidePlate.textContent = mission.immatriculation || "NS";
        sidePlate.classList.remove("animate-pulse");
      }
      if (sideDep) sideDep.textContent = mission.depart || "NS";
      if (sideDest) sideDest.textContent = mission.destination || "NS";
    }

    // Initialize departure status input fields with defaults
    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    this.departRef = "";
    this.departClient = mission ? mission.client || "" : "";
    this.departKm = "";
    this.departFuel = "1/2";
    this.departDate = todayStr;
    this.departTime = timeStr;

    this.arriveeKm = "";
    this.arriveeFuel = "1/2";
    this.arriveeDate = todayStr;
    this.arriveeTime = timeStr;

    this.dashPhotoDep = null;
    this.dashPhotoArr = null;
    this.depositReceiptPhoto = null;
    this.contractPhoto = null;
    this.hasDepositReceipt = false;

    // Reset optional deposit receipt UI
    const hasReceiptChk = document.getElementById("ins_has_deposit_receipt");
    if (hasReceiptChk) hasReceiptChk.checked = false;
    const depositContainer = document.getElementById(
      "ins_deposit_receipt_container",
    );
    if (depositContainer) {
      depositContainer.className =
        "relative h-28 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col items-center justify-center cursor-not-allowed opacity-40 overflow-hidden group transition-all border-dashed";
    }

    // Reset arrival inputs in HTML if they exist
    const kmArrEl = document.getElementById("ins_arrivee_km");
    if (kmArrEl) kmArrEl.value = "";
    const dateArrEl = document.getElementById("ins_arrivee_date");
    if (dateArrEl) dateArrEl.value = todayStr;
    const timeArrEl = document.getElementById("ins_arrivee_time");
    if (timeArrEl) timeArrEl.value = timeStr;

    // Clear signature canvas placeholder & checkbox
    const chk = document.getElementById("ins_driver_confirm_check");
    if (chk) chk.checked = false;

    // Clear dashboard photo previews
    const previewDep = document.getElementById("ins_preview_dash_dep");
    const placeholderDep = document.getElementById("ins_placeholder_dash_dep");
    if (previewDep) {
      previewDep.src = "";
      previewDep.classList.add("hidden");
    }
    if (placeholderDep) placeholderDep.classList.remove("hidden");

    const previewArr = document.getElementById("ins_preview_dash_arr");
    const placeholderArr = document.getElementById("ins_placeholder_dash_arr");
    if (previewArr) {
      previewArr.src = "";
      previewArr.classList.add("hidden");
    }
    if (placeholderArr) placeholderArr.classList.remove("hidden");

    const previewDeposit = document.getElementById(
      "ins_preview_deposit_receipt",
    );
    const placeholderDeposit = document.getElementById(
      "ins_placeholder_deposit_receipt",
    );
    if (previewDeposit) {
      previewDeposit.src = "";
      previewDeposit.classList.add("hidden");
    }
    if (placeholderDeposit) placeholderDeposit.classList.remove("hidden");

    const previewContract = document.getElementById(
      "ins_preview_contract_photo",
    );
    const placeholderContract = document.getElementById(
      "ins_placeholder_contract_photo",
    );
    if (previewContract) {
      previewContract.src = "";
      previewContract.classList.add("hidden");
    }
    if (placeholderContract) placeholderContract.classList.remove("hidden");

    // Set input elements in HTML
    const refEl = document.getElementById("ins_depart_ref");
    const clientEl = document.getElementById("ins_depart_client");
    const kmEl = document.getElementById("ins_depart_km");
    const dateEl = document.getElementById("ins_depart_date");
    const timeEl = document.getElementById("ins_depart_time");
    const fDepInput = document.getElementById("ins_depart_fuel");

    if (refEl) refEl.value = "";
    if (clientEl) clientEl.value = this.departClient;
    if (kmEl) kmEl.value = "";
    if (dateEl) dateEl.value = todayStr;
    if (timeEl) timeEl.value = timeStr;
    if (fDepInput) fDepInput.value = "1/2";

    this.selectFuel("1/2");
    this.renderDamagesList();

    this.showStep("intro");
    const iModal = document.getElementById("inspectionModal");
    if (iModal) {
      iModal.classList.remove("hidden");
      iModal.classList.add("flex");
    }
  },

  showSuccessModal(mission) {
    if (!document.getElementById("inspectionModal")) {
      return;
    }
    this.successMissionId = mission.id;

    const elements = {
      ins_success_vehicle: mission.vehicle || mission.modele || "N/A",
      ins_success_plate: mission.immatriculation || "N/A",
      ins_success_depart: mission.depart || "N/A",
      ins_success_destination: mission.destination || "N/A",
      ins_success_platform: mission.plateforme || "N/A",
      ins_success_gain: `${mission.gain || 0} €`,
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    }
    
    const titleContainer = document.getElementById("ins_success_title_container");
    const descText = document.getElementById("ins_success_description_text");
    if (titleContainer) {
      if (mission.statut === "Annulée") {
        titleContainer.className = "flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-extrabold text-base uppercase border-b border-rose-100 dark:border-rose-900/30 pb-2";
        titleContainer.innerHTML = `<i data-lucide="x-circle" class="w-6 h-6 text-rose-500 animate-bounce" id="ins_success_icon"></i><span id="ins_success_title">Mission Annulée</span>`;
        if (descText) descText.textContent = "Le rapport d'annulation a été généré et sera synchronisé avec vos dossiers. Détails archivés :";
      } else {
        titleContainer.className = "flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-base uppercase border-b border-emerald-100 dark:border-emerald-900/30 pb-2";
        titleContainer.innerHTML = `<i data-lucide="check-circle" class="w-6 h-6 text-emerald-500 animate-bounce" id="ins_success_icon"></i><span id="ins_success_title">Convoyage Mandat Clôturé !</span>`;
        if (descText) descText.textContent = "Le rapport final de mission a été généré. Les informations clés sont archivées localement :";
      }
      if (window.lucide) window.lucide.createIcons();
    }

    let report = `DÉTAILS DE LA MISSION DE CONVOYAGE :\n`;
    report += `---------------------------------------\n`;
    report += `Véhicule: ${mission.vehicle || mission.modele || "N/A"}\n`;
    report += `Immatriculation: ${mission.immatriculation || "N/A"}\n`;
    report += `Trajet de convoyage: ${mission.depart || "N/A"} ➔ ${mission.destination || "N/A"}\n`;
    report += `Plateforme: ${mission.plateforme || "N/A"}\n`;
    report += `Commission / Gain: ${mission.gain || 0} €\n`;
    report += `Statut de mission: ${mission.statut || "N/A"}\n\n`;

    report += `RAPPORT D'ÉTAT DES LIEUX AU DÉPART :\n`;
    report += `---------------------------------------\n`;
    if (mission.inspection) {
      report += `Date d'inspection: ${new Date(mission.inspection.date || new Date()).toLocaleString("fr-FR")}\n`;
      report += `Nº Contrat / Référence: ${mission.inspection.reference || "Non spécifié"}\n`;
      report += `Client de livraison: ${mission.inspection.client || "Non spécifié"}\n`;
      report += `Kilométrage de départ: ${mission.inspection.kmDepart ? mission.inspection.kmDepart + " km" : "Non spécifié"}\n`;
      report += `Niveau jauge carburant: ${mission.inspection.carburant || "Non spécifié"}\n`;
      const dateDepStr = mission.inspection.dateDepart
        ? new Date(mission.inspection.dateDepart).toLocaleDateString("fr-FR")
        : "Non spécifié";
      report += `Départ prévu le: ${dateDepStr} à ${mission.inspection.heureDepart || "Non spécifié"}\n`;
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

    const reportTextEl = document.getElementById("ins_success_report_text");
    if (reportTextEl) {
      reportTextEl.textContent = report;
    }

    const photosContainer = document.getElementById(
      "ins_success_photos_container",
    );
    photosContainer.innerHTML = "";
    let allPhotos = [];
    if (mission.inspection && mission.inspection.damages) {
      mission.inspection.damages.forEach((d) => {
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
    if (mission.cancelContractPhoto) {
      allPhotos.push(mission.cancelContractPhoto);
    }

    if (allPhotos.length > 0) {
      allPhotos.forEach((url, i) => {
        const imgDiv = document.createElement("div");
        imgDiv.className =
          "relative w-23 h-23 rounded-xl overflow-hidden shadow-md flex-shrink-0 cursor-pointer group hover:scale-105 transition-transform duration-150 border border-slate-750 bg-slate-950 flex flex-col items-center justify-center";

        let label = "Avarie";
        if (mission.inspection) {
          if (url === mission.inspection.dashboardDepartPhoto)
            label = "TDB Départ";
          if (url === mission.inspection.dashboardArriveePhoto)
            label = "TDB Arrivée";
          if (url === mission.inspection.depositReceiptPhoto)
            label = "Reçu Caution";
          if (url === mission.inspection.contractPhoto) label = "Contrat";
        }
        if (url === mission.cancelContractPhoto) {
          label = "Contrat Annulation";
        }

        imgDiv.innerHTML = `
          <img src="${url}" class="w-full h-18 object-cover">
          <span class="text-[8px] text-slate-400 bg-slate-900 w-full text-center py-0.5 font-bold uppercase truncate">${label}</span>
        `;
        imgDiv.onclick = () => {
          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Visualisation de l'image de l'inspection...",
              "info",
            );
          }
          InspectionService.openLightbox(url);
        };
        photosContainer.appendChild(imgDiv);
      });
    } else {
      photosContainer.innerHTML =
        '<div class="w-full text-center py-4 px-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800"><i data-lucide="cloud-check" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i><p class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Photos HD correctement archivées sur Google Drive.</p></div>';
    }

    const noView = document.getElementById("ins_no_mission_view");
    const activeView = document.getElementById("ins_active_workflow_view");
    const successView = document.getElementById("section_ins_success_view");

    if (noView) noView.classList.add("hidden");
    if (activeView) activeView.classList.add("hidden");
    if (successView) successView.classList.remove("hidden");

    const sModal = document.getElementById("ins_success_modal");
    if (sModal) {
      sModal.classList.remove("hidden");
      sModal.classList.add("flex");
    }

    const driveBtn = document.getElementById("btn_ins_success_drive_upload");
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
          console.log(
            "Auto-triggering Google Drive upload for mission:",
            mission.id,
          );
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
    document.getElementById("inspectionModal").classList.add("hidden");
    document.getElementById("inspectionModal").classList.remove("flex");
    document.body.style.overflow = "";

    // Stop any live camera Stream
    this.stopCameraStream();

    // Revoke object URLs
    this.photosObjUrl.forEach(URL.revokeObjectURL);
    this.photosObjUrl = [];
  },

  toggleCancelDropdown() {
    const dropdown = document.getElementById("ins_cancel_inline_dropdown");
    if (dropdown) {
      if (dropdown.classList.contains("hidden")) {
        dropdown.classList.remove("hidden");
        dropdown.classList.add("flex");
        document.getElementById("ins_cancel_reason_select_inline").value = "";
        document.getElementById("ins_cancel_reason_other_inline").value = "";
        
        const commentsField = document.getElementById("ins_cancel_comments_inline");
        if (commentsField) commentsField.value = "";
        
        this.cancelContractPhoto = null;
        const preview = document.getElementById("ins_cancel_contract_preview");
        const placeholder = document.getElementById("ins_cancel_contract_placeholder");
        if (preview) {
          preview.src = "";
          preview.classList.add("hidden");
        }
        if (placeholder) placeholder.classList.remove("hidden");
        
        this.onCancelReasonChangeInline();
        this.validateCancelMissionInline();
      } else {
        dropdown.classList.add("hidden");
        dropdown.classList.remove("flex");
      }
    }
  },

  validateCancelMissionInline() {
    const select = document.getElementById("ins_cancel_reason_select_inline");
    const otherInput = document.getElementById("ins_cancel_reason_other_inline");
    const btn = document.getElementById("ins_btn_confirm_cancel");
    if (!select || !otherInput || !btn) return;

    let isValid = true;
    let reason = select.value;
    if (!reason) {
      isValid = false;
    } else if (reason === "Autre") {
      if (!otherInput.value.trim()) {
        isValid = false;
      }
    }

    if (!this.cancelContractPhoto) {
      isValid = false;
    }

    btn.disabled = !isValid;
  },

  onCancelReasonChangeInline() {
    const select = document.getElementById("ins_cancel_reason_select_inline");
    const otherInput = document.getElementById("ins_cancel_reason_other_inline");
    if (select.value === "Autre") {
      otherInput.classList.remove("hidden");
    } else {
      otherInput.classList.add("hidden");
    }
    this.validateCancelMissionInline();
  },

  viewCancelContractPhoto() {
    this.askPhotoSource('cancel_contract');
  },

  async confirmCancelMissionInline() {
    const select = document.getElementById("ins_cancel_reason_select_inline");
    const otherInput = document.getElementById("ins_cancel_reason_other_inline");
    const commentsInput = document.getElementById("ins_cancel_comments_inline");
    
    let reason = select.value;
    if (reason === "Autre") {
      reason = otherInput.value.trim();
    }
    
    if (!reason) {
      if (window.DashboardService) {
        window.DashboardService.showNotification("Veuillez spécifier la raison de l'annulation.", "error");
      }
      return;
    }
    
    // Process cancellation
    const mission = window.app && window.app.missions ? window.app.missions.find((m) => m.id === this.activeMissionId) : null;
    if (!mission) return;
    
    if (window.DashboardService) {
      window.DashboardService.showNotification("Annulation de la mission en cours...", "info");
    }
    
    mission.statut = "Annulée";
    mission.cancelReason = reason;
    mission.cancelComments = commentsInput ? commentsInput.value.trim() : "";
    mission.cancelContractPhoto = this.cancelContractPhoto;
    mission.inspection = mission.inspection || {};
    mission.inspection.status = "Annulée";
    mission.inspection.date = new Date().toISOString();
    
    if (!mission.immatriculation) {
      mission.immatriculation = "SANS_PLAQUE";
    }
    
    // Update local cache
    if (window.app && window.app.missions) {
      const idx = window.app.missions.findIndex((m) => m.id === mission.id);
      if (idx !== -1) {
        window.app.missions[idx] = mission;
      }
      if (typeof window.app.saveMissions === 'function') {
        window.app.saveMissions();
      }
    }
    
    // Save to server/drive
    if (typeof window.app?.uploadMissionToDrive === "function") {
      await window.app.uploadMissionToDrive(mission, window.app.googleDriveToken);
    }
    
    // Log the cancellation
    try {
      await fetch('/api/admin/add-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.googleDriveAccessToken || window.app?.googleDriveToken || ''}`
        },
        body: JSON.stringify({
          action: 'MISSION_CANCEL',
          details: `Mission ${mission.id} annulée. Motif : ${reason}`
        })
      });
    } catch (e) {
      console.error("Error logging mission cancellation:", e);
    }

    // Also upload photos and report text
    // (This is now handled automatically by showSuccessModal's auto-trigger mechanism)
    
    if (window.DashboardService) {
      window.DashboardService.showNotification("Mission annulée avec succès.", "success");
    }
    if (window.app && typeof window.app.refreshUI === 'function') {
      window.app.refreshUI();
    }
    
    this.toggleCancelDropdown();
    this.showSuccessModal(mission);
  },

  askPhotoSource(target = "damage") {
    this.activeCameraTarget = target;
    const modal = document.getElementById("ins_photo_source_modal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closePhotoSourceModal() {
    const modal = document.getElementById("ins_photo_source_modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  startCameraStreamFromSource() {
    this.closePhotoSourceModal();
    this.startCameraStream(this.activeCameraTarget);
  },

  async startCameraStream(target = "damage") {
    this.activeCameraTarget = target;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Votre appareil ne supporte pas la capture vidéo directe. Utilisation du mode natif.",
          "warning",
        );
      }
      this.triggerNativeCamera();
      return;
    }

    const modal = document.getElementById("ins_camera_modal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }

    const errOverlay = document.getElementById("ins_camera_error");
    if (errOverlay) {
      errOverlay.classList.add("hidden");
      errOverlay.classList.remove("flex");
    }

    const statusText = document.getElementById("ins_camera_status");
    if (statusText) {
      statusText.classList.remove("hidden");
      statusText.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-3">
          <svg class="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs font-bold text-slate-300">DÉMARRAGE DE LA CAMÉRA FULL-SCREEN...</span>
        </div>
      `;
    }

    try {
      // High-resolution constraints optimized for modern full-screen capture
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraStream = stream;

      const video = document.getElementById("ins_camera_video");
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = async () => {
          try {
            await video.play();
          } catch (err) {
            console.warn("Auto-play blocked:", err);
          }
          if (statusText) {
            statusText.classList.add("hidden");
          }
        };
      }

      // Check and apply continuous autofocus and other advanced capabilities if device supports them
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === "function") {
        try {
          const capabilities = track.getCapabilities();
          const advancedConstraints = {};

          if (
            capabilities.focusMode &&
            capabilities.focusMode.includes("continuous")
          ) {
            advancedConstraints.focusMode = "continuous";
          }
          if (
            capabilities.whiteBalanceMode &&
            capabilities.whiteBalanceMode.includes("continuous")
          ) {
            advancedConstraints.whiteBalanceMode = "continuous";
          }
          if (
            capabilities.exposureMode &&
            capabilities.exposureMode.includes("continuous")
          ) {
            advancedConstraints.exposureMode = "continuous";
          }

          if (Object.keys(advancedConstraints).length > 0) {
            await track.applyConstraints({ advanced: [advancedConstraints] });
          }
        } catch (capError) {
          console.warn(
            "Could not apply continuous focusing capabilities:",
            capError,
          );
        }
      }
    } catch (err) {
      const isPermissionDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.toLowerCase().includes("permission") ||
        err.message?.toLowerCase().includes("denied");
      if (isPermissionDenied) {
        console.warn("Erreur getUserMedia (Accès refusé):", err.message || err);
        this.showCameraError(err);
        return;
      } else {
        console.error("Erreur getUserMedia:", err);
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        this.cameraStream = stream;
        const video = document.getElementById("ins_camera_video");
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play().catch((e) => console.warn("Play fallback failed:", e));
            if (statusText) {
              statusText.classList.add("hidden");
            }
          };
        }
      } catch (fallbackErr) {
        console.error("Erreur fallback getUserMedia:", fallbackErr);
        this.showCameraError(fallbackErr);
      }
    }
  },

  showCameraError(err) {
    const errOverlay = document.getElementById("ins_camera_error");
    const statusText = document.getElementById("ins_camera_status");
    if (statusText) {
      statusText.classList.add("hidden");
    }
    if (errOverlay) {
      errOverlay.classList.remove("hidden");
      errOverlay.classList.add("flex");
      
      const descEl = errOverlay.querySelector("p span");
      if (descEl) {
        let msg = "L'application a besoin d'accéder à votre appareil photo pour capturer les photos d'inspection de l'état des lieux.<br><br>";
        if (err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          msg += "🔒 <strong>Accès explicitement bloqué</strong>. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur (en cliquant sur l'icône de cadenas ou de réglages à gauche de la barre d'adresse de l'URL ou dans vos réglages système) puis cliquez sur Réessayer.";
        } else {
          msg += `⚠️ <strong>Erreur de périphérique:</strong> ${err ? (err.message || err.name || err) : "Périphérique caméra non détecté ou déjà utilisé par une autre application"}. Vérifiez l'état de votre caméra ou vos paramètres de confidentialité.`;
        }
        descEl.innerHTML = msg;
      }
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  },

  retryCameraStream() {
    const errOverlay = document.getElementById("ins_camera_error");
    if (errOverlay) {
      errOverlay.classList.add("hidden");
      errOverlay.classList.remove("flex");
    }
    this.startCameraStream(this.activeCameraTarget);
  },

  fallbackToNativeCamera() {
    this.stopCameraStream();
    this.triggerNativeCamera();
  },

  stopCameraStream() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    const video = document.getElementById("ins_camera_video");
    if (video) {
      video.srcObject = null;
    }
    const modal = document.getElementById("ins_camera_modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    const errOverlay = document.getElementById("ins_camera_error");
    if (errOverlay) {
      errOverlay.classList.add("hidden");
      errOverlay.classList.remove("flex");
    }
  },

  async handleTapToFocus(event) {
    const video = document.getElementById("ins_camera_video");
    const indicator = document.getElementById("ins_camera_focus_indicator");
    const feedback = document.getElementById("ins_camera_feedback_text");
    if (!video) return;

    // Get click/tap coordinates relative to the full viewport bounding rect
    const rect = video.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Reposition physical visual focus target
    if (indicator) {
      indicator.style.left = `${x - 32}px`;
      indicator.style.top = `${y - 32}px`;
      indicator.classList.remove(
        "opacity-0",
        "scale-150",
        "border-yellow-400",
        "border-emerald-500",
      );
      indicator.classList.add("opacity-100", "scale-100", "border-yellow-400");
    }

    if (feedback) {
      feedback.innerText = "Mise au point...";
      feedback.className =
        "text-center text-[10px] text-yellow-400 font-bold uppercase tracking-wider drop-shadow-md";
    }

    // Try applying point-of-interest focus constraints natively if device stream supports it
    if (this.cameraStream) {
      const track = this.cameraStream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === "function") {
        try {
          const caps = track.getCapabilities();
          const focusConstraints = {};

          if (caps.focusMode && caps.focusMode.includes("single")) {
            focusConstraints.focusMode = "single";
          }
          if (caps.pointsOfInterest) {
            const normX = Math.max(0, Math.min(1, x / rect.width));
            const normY = Math.max(0, Math.min(1, y / rect.height));
            focusConstraints.pointsOfInterest = [{ x: normX, y: normY }];
          }

          if (Object.keys(focusConstraints).length > 0) {
            await track.applyConstraints({ advanced: [focusConstraints] });
          }
        } catch (e) {
          console.warn(
            "Native camera point-of-interest assignment not active:",
            e,
          );
        }
      }
    }

    // Simulate reactive physical lens searching effect (instant micro-blur & zoom spring)
    video.classList.add("blur-[1px]", "scale-[1.015]");

    setTimeout(() => {
      video.classList.remove("blur-[1px]", "scale-[1.015]");

      if (indicator) {
        indicator.classList.remove("border-yellow-400");
        indicator.classList.add("border-emerald-500");
      }

      if (feedback) {
        feedback.innerText = "Mise au point OK";
        feedback.className =
          "text-center text-[10px] text-emerald-400 font-bold uppercase tracking-wider drop-shadow-md";
      }

      if (navigator.vibrate) {
        navigator.vibrate(30);
      }

      // Automatically transition focus indicator to hidden state
      setTimeout(() => {
        if (indicator) {
          indicator.classList.remove("opacity-100");
          indicator.classList.add("opacity-0", "scale-150");
        }
        if (feedback) {
          feedback.innerText = "Prêt pour le cliché";
          feedback.className =
            "text-center text-[10px] text-slate-350 font-bold uppercase tracking-wider drop-shadow-md";
        }
      }, 1000);
    }, 350);
  },

  async switchCamera() {
    this.facingMode =
      this.facingMode === "environment" ? "user" : "environment";
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
      await this.startCameraStream();
    } else {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          `Objectif basculé sur : ${this.facingMode === "environment" ? "Arrière" : "Avant"}`,
          "info",
        );
      }
    }
  },

  overlayTimestamp(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const mission = app.missions.find((m) => m.id === this.activeMissionId);
        const immat =
          mission && mission.immatriculation
            ? mission.immatriculation
            : "SANS PLAQUE";
        const textStr = `${immat} | ${new Date().toLocaleString("fr-FR")}`;

        const fontSize = Math.max(8, Math.floor(img.width / 85));
        ctx.font = `bold ${fontSize}px monospace`;

        const textWidth = ctx.measureText(textStr).width;
        const padding = 2;

        const rectWidth = textWidth + padding * 2;
        const rectHeight = fontSize + padding * 2;

        const rectX = img.width - rectWidth - 4;
        const rectY = img.height - rectHeight - 4;

        // Draw translucent soft white background block (demi-transparent with 0.62 opacity)
        ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

        // Draw subtle border around the block
        ctx.strokeStyle = "rgba(15, 23, 42, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

        // Render text
        ctx.fillStyle = "#0f172a";
        ctx.textBaseline = "middle";
        ctx.fillText(textStr, rectX + padding, rectY + rectHeight / 2);

        resolve(canvas.toDataURL("image/jpeg", 0.70));
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
    });
  },

  initSignaturePad() {
    const canvas = document.getElementById("ins_sig_canvas");
    if (!canvas) return;

    // Clone to strip existing event listeners and avoid duplicates
    const cloned = canvas.cloneNode(true);
    canvas.replaceWith(cloned);

    // Context must be obtained from the active in-DOM cloned element
    const ctx = cloned.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const rect = cloned.getBoundingClientRect();
    cloned.width = rect.width * dpr;
    cloned.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set contrast stroke colors
    const isDark = document.documentElement.classList.contains("dark");
    ctx.strokeStyle = isDark ? "#ffffff" : "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const placeholder = document.getElementById("ins_sig_placeholder");

    const getXY = (e) => {
      const r = cloned.getBoundingClientRect();
      if (e.touches && e.touches[0]) {
        return {
          x: e.touches[0].clientX - r.left,
          y: e.touches[0].clientY - r.top,
        };
      }
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      };
    };

    const startDraw = (e) => {
      drawing = true;
      const pos = getXY(e);
      lastX = pos.x;
      lastY = pos.y;
      if (placeholder) placeholder.classList.add("hidden");
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
        // Directly save the drawing as high-quality data URL
        this.signatureData = cloned.toDataURL();
        this.signatureCaptured = true;
      }
    };

    cloned.addEventListener("mousedown", startDraw);
    cloned.addEventListener("mousemove", draw);
    cloned.addEventListener("mouseup", stopDraw);
    cloned.addEventListener("mouseleave", stopDraw);

    cloned.addEventListener("touchstart", startDraw, { passive: false });
    cloned.addEventListener("touchmove", draw, { passive: false });
    cloned.addEventListener("touchend", stopDraw);
  },

  clearSignature() {
    const canvas = document.getElementById("ins_sig_canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureData = null;
    this.signatureCaptured = false;

    const placeholder = document.getElementById("ins_sig_placeholder");
    if (placeholder) placeholder.classList.remove("hidden");
  },

  toggleConfirmCheck() {
    const chk = document.getElementById("ins_driver_confirm_check");
    const btn = document.getElementById("ins_step_2_next_btn");
    if (chk && btn) {
      if (chk.checked) {
        btn.disabled = false;
        btn.classList.remove(
          "bg-slate-800",
          "text-slate-500",
          "cursor-not-allowed",
        );
        btn.classList.add(
          "bg-indigo-600",
          "hover:bg-indigo-500",
          "text-white",
          "cursor-pointer",
        );
      } else {
        btn.disabled = true;
        btn.classList.add(
          "bg-slate-800",
          "text-slate-500",
          "cursor-not-allowed",
        );
        btn.classList.remove(
          "bg-indigo-600",
          "hover:bg-indigo-500",
          "text-white",
          "cursor-pointer",
        );
      }
    }
  },

  capturePhoto() {
    const video = document.getElementById("ins_camera_video");
    const canvas = document.getElementById("ins_camera_canvas");
    if (!video || !canvas) return;

    const flash = document.getElementById("ins_camera_flash");
    if (flash) {
      flash.classList.remove("opacity-0");
      flash.classList.add("opacity-80");
      setTimeout(() => {
        flash.classList.remove("opacity-80");
        flash.classList.add("opacity-0");
      }, 80);
    }

    try {
      const MAX_WIDTH = 1280;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      
      if (width > MAX_WIDTH) {
        const ratio = MAX_WIDTH / width;
        width = MAX_WIDTH;
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);

        // Draw French formatted timestamp and vehicle license plate directly
        const mission = app.missions.find((m) => m.id === this.activeMissionId);
        const immat =
          mission && mission.immatriculation
            ? mission.immatriculation
            : "SANS PLAQUE";
        const textStr = `${immat} | ${new Date().toLocaleString("fr-FR")}`;

        const fontSize = Math.max(8, Math.floor(width / 85));
        ctx.font = `bold ${fontSize}px monospace`;

        const textWidth = ctx.measureText(textStr).width;
        const padding = 2;

        const rectWidth = textWidth + padding * 2;
        const rectHeight = fontSize + padding * 2;

        const rectX = width - rectWidth - 4;
        const rectY = height - rectHeight - 4;

        // Draw translucent soft white background block (demi-transparent with 0.62 opacity)
        ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

        // Draw subtle border around the block
        ctx.strokeStyle = "rgba(15, 23, 42, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

        // Render text
        ctx.fillStyle = "#0f172a";
        ctx.textBaseline = "middle";
        ctx.fillText(textStr, rectX + padding, rectY + rectHeight / 2);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.70);
        this.photosObjUrl.push(dataUrl);

        if (this.activeCameraTarget === "dash_dep") {
          this.dashPhotoDep = dataUrl;
          const previewDep = document.getElementById("ins_preview_dash_dep");
          const placeholderDep = document.getElementById(
            "ins_placeholder_dash_dep",
          );
          if (previewDep) {
            previewDep.src = dataUrl;
            previewDep.classList.remove("hidden");
          }
          if (placeholderDep) placeholderDep.classList.add("hidden");

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo de tableau de bord (Départ) enregistrée !",
              "success",
            );
          }
        } else if (this.activeCameraTarget === "deposit_receipt") {
          this.depositReceiptPhoto = dataUrl;
          const previewDeposit = document.getElementById(
            "ins_preview_deposit_receipt",
          );
          const placeholderDeposit = document.getElementById(
            "ins_placeholder_deposit_receipt",
          );
          if (previewDeposit) {
            previewDeposit.src = dataUrl;
            previewDeposit.classList.remove("hidden");
          }
          if (placeholderDeposit) placeholderDeposit.classList.add("hidden");

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo du reçu de la caution enregistrée !",
              "success",
            );
          }
        } else if (this.activeCameraTarget === "contract") {
          this.contractPhoto = dataUrl;
          const previewContract = document.getElementById(
            "ins_preview_contract_photo",
          );
          const placeholderContract = document.getElementById(
            "ins_placeholder_contract_photo",
          );
          if (previewContract) {
            previewContract.src = dataUrl;
            previewContract.classList.remove("hidden");
          }
          if (placeholderContract) placeholderContract.classList.add("hidden");

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo du contrat de convoyage enregistrée !",
              "success",
            );
          }
        } else if (this.activeCameraTarget === "dash_arr") {
          this.dashPhotoArr = dataUrl;
          const previewArr = document.getElementById("ins_preview_dash_arr");
          const placeholderArr = document.getElementById(
            "ins_placeholder_dash_arr",
          );
          if (previewArr) {
            previewArr.src = dataUrl;
            previewArr.classList.remove("hidden");
          }
          if (placeholderArr) placeholderArr.classList.add("hidden");

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo de tableau de bord (Arrivée) enregistrée !",
              "success",
            );
          }
        } else if (this.activeCameraTarget === "cancel_contract") {
          this.cancelContractPhoto = dataUrl;
          const preview = document.getElementById("ins_cancel_contract_preview");
          const placeholder = document.getElementById("ins_cancel_contract_placeholder");
          if (preview) {
            preview.src = dataUrl;
            preview.classList.remove("hidden");
          }
          if (placeholder) placeholder.classList.add("hidden");

          this.validateCancelMissionInline();

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo du contrat enregistrée !",
              "success",
            );
          }
        } else {
          const container = document.getElementById(
            "ins_photo_preview_container",
          );
          if (container) {
            container.classList.remove("hidden");
            const previewDamage = document.getElementById("ins_preview_damage");
            const placeholderDamage = document.getElementById(
              "ins_placeholder_damage",
            );
            if (previewDamage) {
              previewDamage.src = dataUrl;
              previewDamage.classList.remove("hidden");
            }
            if (placeholderDamage) placeholderDamage.classList.add("hidden");

            const imgDiv = document.createElement("div");
            imgDiv.className =
              "relative w-14 h-14 rounded-lg overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group border border-slate-800";
            imgDiv.innerHTML = `
              <img src="${dataUrl}" class="w-full h-full object-cover transition-transform group-hover:scale-105" onclick="InspectionService.openLightbox('${dataUrl}')">
              <button type="button" onclick="InspectionService.removeDamagePhoto(this)" class="absolute top-0.5 right-0.5 bg-red-500/95 text-white rounded-full p-1 shadow-sm active:scale-95"><i data-lucide="x" class="w-2.5 h-2.5"></i></button>
            `;
            container.appendChild(imgDiv);
            if (window.lucide) window.lucide.createIcons();
          }

          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "Photo ajoutée avec succès !",
              "success",
            );
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
    const input =
      document.getElementById("ins_camera_fallback_input") ||
      document.getElementById("ins_photo_input");
    if (input) {
      input.setAttribute("capture", "environment"); // Force camera
      input.click();
    }
  },

  triggerNativeGallery() {
    this.closePhotoSourceModal();
    const input = document.getElementById("ins_photo_input");
    if (input) {
      input.removeAttribute("capture"); // Allow gallery
      input.click();
    }
  },

  toggleCameraInfo() {
    if (window.DashboardService) {
      window.DashboardService.showNotification(
        "Conseil : Veillez à ce que l'avarie soit bien nette et centrée.",
        "info",
      );
    }
  },

  openLightbox(url) {
    const lightbox = document.getElementById("ins_lightbox");
    const img = document.getElementById("ins_lightbox_img");
    if (lightbox && img && url) {
      img.src = url;
      lightbox.classList.remove("hidden");
      lightbox.classList.add("flex");
    }
  },

  closeLightbox() {
    const lightbox = document.getElementById("ins_lightbox");
    const img = document.getElementById("ins_lightbox_img");
    if (lightbox && img) {
      lightbox.classList.add("hidden");
      lightbox.classList.remove("flex");
      setTimeout(() => (img.src = ""), 200);
    }
  },

  showStep(stepId) {
    // Hide all steps
    [
      "intro",
      "depart_status",
      "depart_confirmation",
      "arrival_inspection",
      "arrival_status",
      "summary",
      "add_damage",
    ].forEach((step) => {
      const el = document.getElementById(`ins_step_${step}`);
      if (el) el.classList.add("hidden");
    });
    // Show target step
    const target = document.getElementById(`ins_step_${stepId}`);
    if (target) {
      target.classList.remove("hidden");
      target.classList.add("flex");
    }
  },

  startInspection() {
    this.showStep("depart_status");
  },

  confirmDepartStatusStep() {
    this.confirmStage1Step();
  },

  confirmStage1Step() {
    this.departRef = document.getElementById("ins_depart_ref").value;
    this.departClient = document.getElementById("ins_depart_client").value;
    this.departKm = document.getElementById("ins_depart_km").value;
    this.departFuel = document.getElementById("ins_depart_fuel").value;
    this.departDate = document.getElementById("ins_depart_date").value;
    this.departTime = document.getElementById("ins_depart_time").value;

    if (!this.departKm || isNaN(parseInt(this.departKm))) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Veuillez saisir un kilométrage de départ valide !",
          "error",
        );
      }
      return;
    }

    if (!this.dashPhotoDep) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "La photo du tableau de bord au départ est obligatoire !",
          "error",
        );
      }
      return;
    }

    this.showStep("depart_confirmation");
    setTimeout(() => {
      this.initSignaturePad();
      this.toggleConfirmCheck();
    }, 50);
  },

  confirmStage2Step() {
    const chk = document.getElementById("ins_driver_confirm_check");
    if (!chk || !chk.checked) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Vous devez confirmer que le véhicule est opérationnel pour continuer.",
          "error",
        );
      }
      return;
    }
    this.showStep("arrival_inspection");
    this.renderDamagesList();
  },

  confirmStage3Step() {
    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    this.showStep("arrival_status");

    const kmArrEl = document.getElementById("ins_arrivee_km");
    const dateArrEl = document.getElementById("ins_arrivee_date");
    const timeArrEl = document.getElementById("ins_arrivee_time");

    if (kmArrEl && !kmArrEl.value) {
      const depKmValue = parseInt(this.departKm) || 0;
      kmArrEl.value = depKmValue > 0 ? depKmValue + 150 : "";
    }
    if (dateArrEl && !dateArrEl.value) dateArrEl.value = todayStr;
    if (timeArrEl && !timeArrEl.value) timeArrEl.value = timeStr;

    const mission = app.missions.find((m) => m.id === this.activeMissionId);
    const destNameEl = document.getElementById("ins_arrival_dest_name");
    if (destNameEl && mission) {
      destNameEl.textContent = mission.destination || "N/A";
    }

    this.selectArrivalFuel(this.arriveeFuel || "1/2");
  },

  goToArrivalStatus() {
    this.confirmStage3Step();
  },

  selectArrivalFuel(val) {
    this.arriveeFuel = val;
    const input = document.getElementById("ins_arrivee_fuel");
    if (input) input.value = val;

    ["0", "1/4", "1/2", "3/4", "1"].forEach((k) => {
      const idKey = k.replace("/", "_");
      const btn = document.getElementById(`arr_fuel_btn_${idKey}`);
      if (btn) {
        if (k === val) {
          btn.className =
            "flex-1 text-[10px] font-black py-1.5 rounded bg-emerald-600 text-white shadow-sm border border-emerald-500 cursor-pointer transition-all";
        } else {
          btn.className =
            "flex-1 text-[10px] font-black py-1.5 rounded text-slate-400 hover:bg-slate-800 cursor-pointer transition-all";
        }
      }
    });
  },

  confirmArrivalStatusStep() {
    this.confirmStage4Step();
  },

  confirmStage4Step() {
    this.arriveeKm = document.getElementById("ins_arrivee_km")?.value || "";
    this.arriveeFuel =
      document.getElementById("ins_arrivee_fuel")?.value || "1/2";
    this.arriveeDate = document.getElementById("ins_arrivee_date")?.value || "";
    this.arriveeTime = document.getElementById("ins_arrivee_time")?.value || "";

    if (!this.arriveeKm || isNaN(parseInt(this.arriveeKm))) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Veuillez renseigner le kilométrage d'arrivée !",
          "error",
        );
      }
      return;
    }

    const depKm = parseInt(this.departKm) || 0;
    const arrKm = parseInt(this.arriveeKm) || 0;
    if (arrKm < depKm) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          `Erreur: Kilométrage d'arrivée (${arrKm} km) inférieur au départ (${depKm} km) !`,
          "error",
        );
      }
      return;
    }

    if (!this.dashPhotoArr) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "La photo du tableau de bord à l'arrivée est obligatoire !",
          "error",
        );
      }
      return;
    }

    this.submitInspection();
  },

  selectFuel(val) {
    this.departFuel = val;
    const input = document.getElementById("ins_depart_fuel");
    if (input) input.value = val;

    ["0", "1/4", "1/2", "3/4", "1"].forEach((k) => {
      const idKey = k.replace("/", "_");
      const btn = document.getElementById(`fuel_btn_${idKey}`);
      if (btn) {
        if (k === val) {
          btn.className =
            "flex-1 text-[10px] font-black py-1.5 rounded bg-indigo-600 text-white shadow-sm border border-indigo-500 cursor-pointer transition-all";
        } else {
          btn.className =
            "flex-1 text-[10px] font-black py-1.5 rounded text-slate-400 hover:bg-slate-800 cursor-pointer transition-all";
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

      if (type === "dep") {
        this.dashPhotoDep = dataUrl;
        const previewDep = document.getElementById("ins_preview_dash_dep");
        const placeholderDep = document.getElementById(
          "ins_placeholder_dash_dep",
        );
        if (previewDep) {
          previewDep.src = dataUrl;
          previewDep.classList.remove("hidden");
        }
        if (placeholderDep) placeholderDep.classList.add("hidden");
      } else if (type === "deposit_receipt") {
        this.depositReceiptPhoto = dataUrl;
        const previewDeposit = document.getElementById(
          "ins_preview_deposit_receipt",
        );
        const placeholderDeposit = document.getElementById(
          "ins_placeholder_deposit_receipt",
        );
        if (previewDeposit) {
          previewDeposit.src = dataUrl;
          previewDeposit.classList.remove("hidden");
        }
        if (placeholderDeposit) placeholderDeposit.classList.add("hidden");
      } else if (type === "contract") {
        this.contractPhoto = dataUrl;
        const previewContract = document.getElementById(
          "ins_preview_contract_photo",
        );
        const placeholderContract = document.getElementById(
          "ins_placeholder_contract_photo",
        );
        if (previewContract) {
          previewContract.src = dataUrl;
          previewContract.classList.remove("hidden");
        }
        if (placeholderContract) placeholderContract.classList.add("hidden");
      } else if (type === "cancel_contract") {
        this.cancelContractPhoto = dataUrl;
        const previewContract = document.getElementById("ins_cancel_contract_preview");
        const placeholderContract = document.getElementById("ins_cancel_contract_placeholder");
        if (previewContract) {
          previewContract.src = dataUrl;
          previewContract.classList.remove("hidden");
        }
        if (placeholderContract) placeholderContract.classList.add("hidden");
        this.validateCancelMissionInline();
      } else {
        this.dashPhotoArr = dataUrl;
        const previewArr = document.getElementById("ins_preview_dash_arr");
        const placeholderArr = document.getElementById(
          "ins_placeholder_dash_arr",
        );
        if (previewArr) {
          previewArr.src = dataUrl;
          previewArr.classList.remove("hidden");
        }
        if (placeholderArr) placeholderArr.classList.add("hidden");
      }

      if (window.DashboardService) {
        let label = "tableau de bord (Départ)";
        if (type === "arr") label = "tableau de bord (Arrivée)";
        if (type === "deposit_receipt") label = "reçu de caution";
        if (type === "contract") label = "contrat de convoyage";
        if (type === "cancel_contract") label = "contrat d'annulation";
        window.DashboardService.showNotification(
          `Photo de ${label} enregistrée avec horodatage !`,
          "success",
        );
      }
    };
    reader.readAsDataURL(file);
  },

  async handleAIScan(input) {
    const file = input.files[0];
    if (!file) return;

    const loader = document.getElementById("ins_ai_scan_loading");
    if (loader) loader.classList.remove("hidden");

    const formData = new FormData();
    formData.append("image", file);

    try {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Gemini analyse l'image de votre état des lieux...",
          "info",
        );
      }
      const res = await fetch("/api/scan-inspection", {
        method: "POST",
        body: formData,
      });
      const resData = await res.json();
      if (resData.success && resData.data) {
        const data = resData.data;
        if (data.contrat_id) {
          document.getElementById("ins_depart_ref").value = data.contrat_id;
        }
        if (data.km_depart) {
          document.getElementById("ins_depart_km").value = data.km_depart;
        }
        if (data.carburant) {
          this.selectFuel(data.carburant);
        }
        if (data.client) {
          document.getElementById("ins_depart_client").value = data.client;
        }
        if (data.date_depart) {
          document.getElementById("ins_depart_date").value = data.date_depart;
        }
        if (data.heure_depart) {
          document.getElementById("ins_depart_time").value = data.heure_depart;
        }

        if (window.DashboardService) {
          window.DashboardService.showNotification(
            "État des lieux existant analysé par Gemini avec succès !",
            "success",
          );
        }
      } else {
        throw new Error(resData.error || "Gemini n'a pas pu lire les données.");
      }
    } catch (e) {
      console.error(e);
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Échec de l'import : " + e.message,
          "error",
        );
      }
    } finally {
      if (loader) loader.classList.add("hidden");
      input.value = ""; // reset
    }
  },

  loadRealDemoValues() {
    const ref = "5139872-1537056";
    const client = "Avis France";
    const km = 10;
    const fuel = "1/2";
    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    document.getElementById("ins_depart_ref").value = ref;
    document.getElementById("ins_depart_client").value = client;
    document.getElementById("ins_depart_km").value = km;
    document.getElementById("ins_depart_date").value = todayStr;
    document.getElementById("ins_depart_time").value = timeStr;

    this.selectFuel(fuel);

    // Mock dashboard photos
    this.dashPhotoDep =
      "https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=400&auto=format&fit=crop";
    this.dashPhotoArr =
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=400&auto=format&fit=crop";

    const previewDep = document.getElementById("ins_preview_dash_dep");
    const placeholderDep = document.getElementById("ins_placeholder_dash_dep");
    if (previewDep) {
      previewDep.src = this.dashPhotoDep;
      previewDep.classList.remove("hidden");
    }
    if (placeholderDep) placeholderDep.classList.add("hidden");

    const previewArr = document.getElementById("ins_preview_dash_arr");
    const placeholderArr = document.getElementById("ins_placeholder_dash_arr");
    if (previewArr) {
      previewArr.src = this.dashPhotoArr;
      previewArr.classList.remove("hidden");
    }
    if (placeholderArr) placeholderArr.classList.add("hidden");

    if (window.DashboardService) {
      window.DashboardService.showNotification(
        "Exemple DriiveMe chargé avec succès !",
        "success",
      );
    }
  },

  viewDashPhoto(type) {
    const isDep = type === "dep" || type === "depart";
    const target = isDep ? "dash_dep" : "dash_arr";
    const url = isDep ? this.dashPhotoDep : this.dashPhotoArr;

    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource(target);
    }
  },

  viewDepositPhoto() {
    if (!this.hasDepositReceipt) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Veuillez d'abord cocher 'Avec reçu ?' pour prendre une photo du reçu.",
          "info",
        );
      }
      return;
    }
    const url = this.depositReceiptPhoto;
    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource("deposit_receipt");
    }
  },

  toggleDepositReceipt(checked) {
    this.hasDepositReceipt = checked;

    const chk = document.getElementById("ins_has_deposit_receipt");
    if (chk) chk.checked = checked;

    const depositContainer = document.getElementById(
      "ins_deposit_receipt_container",
    );
    if (depositContainer) {
      if (checked) {
        depositContainer.classList.remove("opacity-40", "cursor-not-allowed");
        depositContainer.classList.add("cursor-pointer");
      } else {
        depositContainer.classList.add("opacity-40", "cursor-not-allowed");
        depositContainer.classList.remove("cursor-pointer");

        // Also clear the photo if it was set
        this.depositReceiptPhoto = null;
        const previewDeposit = document.getElementById(
          "ins_preview_deposit_receipt",
        );
        const placeholderDeposit = document.getElementById(
          "ins_placeholder_deposit_receipt",
        );
        if (previewDeposit) {
          previewDeposit.src = "";
          previewDeposit.classList.add("hidden");
        }
        if (placeholderDeposit) {
          placeholderDeposit.classList.remove("hidden");
        }
      }
    }
  },

  viewContractPhoto() {
    const url = this.contractPhoto;
    if (url) {
      this.openLightbox(url);
    } else {
      this.askPhotoSource("contract");
    }
  },

  goToSummary() {
    this.showStep("summary");
    this.renderSummary();
  },

  // ADD DAMAGE FLOW
  openAddDamageWithStage(stage = "departure") {
    this.currentDamageStage = stage;
    this.openAddDamage();
  },

  openAddDamage(zoneName = "Avant") {
    document.getElementById("ins_damage_zone").value = zoneName;
    document.getElementById("ins_damage_type").value = "Rayure";
    document.getElementById("ins_damage_severity").value = "Léger";
    document.getElementById("ins_damage_notes").value = "";

    const photoContainer = document.getElementById(
      "ins_photo_preview_container",
    );
    photoContainer.innerHTML = "";
    photoContainer.classList.add("hidden");
    document.getElementById("ins_photo_input").value = "";

    const previewDamage = document.getElementById("ins_preview_damage");
    const placeholderDamage = document.getElementById("ins_placeholder_damage");
    if (previewDamage) {
      previewDamage.src = "";
      previewDamage.classList.add("hidden");
    }
    if (placeholderDamage) {
      placeholderDamage.classList.remove("hidden");
    }

    this.showStep("add_damage");
  },

  removeDamagePhoto(btn) {
    const item = btn.parentElement;
    const container = document.getElementById("ins_photo_preview_container");
    if (item && container) {
      item.remove();
      const imgs = container.querySelectorAll("img");
      const previewDamage = document.getElementById("ins_preview_damage");
      const placeholderDamage = document.getElementById(
        "ins_placeholder_damage",
      );
      if (imgs.length === 0) {
        container.classList.add("hidden");
        if (previewDamage) {
          previewDamage.src = "";
          previewDamage.classList.add("hidden");
        }
        if (placeholderDamage) placeholderDamage.classList.remove("hidden");
      } else {
        if (previewDamage) {
          previewDamage.src = imgs[imgs.length - 1].src;
        }
      }
    }
  },

  handlePhotoUpload(evt) {
    const files = evt.target.files;
    if (!files || files.length === 0) return;

    if (this.activeCameraTarget === "dash_dep") {
      this.handleDashPhoto(evt.target, "dep");
      evt.target.value = "";
      return;
    }
    if (this.activeCameraTarget === "deposit_receipt") {
      this.handleDashPhoto(evt.target, "deposit_receipt");
      evt.target.value = "";
      return;
    }
    if (this.activeCameraTarget === "contract") {
      this.handleDashPhoto(evt.target, "contract");
      evt.target.value = "";
      return;
    }
    if (this.activeCameraTarget === "cancel_contract") {
      this.handleDashPhoto(evt.target, "cancel_contract");
      evt.target.value = "";
      return;
    }
    if (this.activeCameraTarget === "dash_arr") {
      this.handleDashPhoto(evt.target, "arr");
      evt.target.value = "";
      return;
    }

    const container = document.getElementById("ins_photo_preview_container");
    container.classList.remove("hidden");

    // Convert to inline Base64 data URLs for preview and persistence
    for (let f of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let dataUrl = e.target.result;
        dataUrl = await this.overlayTimestamp(dataUrl);
        this.photosObjUrl.push(dataUrl);

        const previewDamage = document.getElementById("ins_preview_damage");
        const placeholderDamage = document.getElementById(
          "ins_placeholder_damage",
        );
        if (previewDamage) {
          previewDamage.src = dataUrl;
          previewDamage.classList.remove("hidden");
        }
        if (placeholderDamage) placeholderDamage.classList.add("hidden");

        const imgDiv = document.createElement("div");
        imgDiv.className =
          "relative w-14 h-14 rounded-lg overflow-hidden shadow-sm flex-shrink-0 cursor-pointer group border border-slate-800";
        imgDiv.innerHTML = `
          <img src="${dataUrl}" class="w-full h-full object-cover transition-transform group-hover:scale-105" onclick="InspectionService.openLightbox('${dataUrl}')">
          <button type="button" onclick="InspectionService.removeDamagePhoto(this)" class="absolute top-0.5 right-0.5 bg-red-500/95 text-white rounded-full p-1 shadow-sm active:scale-95"><i data-lucide="x" class="w-2.5 h-2.5"></i></button>
        `;
        container.appendChild(imgDiv);

        if (window.lucide) window.lucide.createIcons();
      };
      reader.readAsDataURL(f);
    }
    evt.target.value = "";
  },

  saveDamage() {
    const zone = document.getElementById("ins_damage_zone").value;
    const type = document.getElementById("ins_damage_type").value;
    const severity = document.getElementById("ins_damage_severity").value;
    const notes = document.getElementById("ins_damage_notes").value;

    const container = document.getElementById("ins_photo_preview_container");
    const imgs = container.querySelectorAll("img");
    const photoUrls = Array.from(imgs).map((img) => img.src);

    if (!notes || notes.trim().length < 3) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "La description (notes) est obligatoire et doit faire au moins 3 caractères !",
          "error",
        );
      }
      return;
    }

    if (photoUrls.length === 0) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Une photo de preuve est obligatoire pour déclarer ce problème !",
          "error",
        );
      }
      return;
    }

    this.damages.push({
      id: Date.now().toString(),
      stage: this.currentDamageStage,
      zone,
      type,
      severity,
      notes,
      photoUrls,
    });

    if (this.currentDamageStage === "departure") {
      this.showStep("depart_status");
    } else {
      this.showStep("arrival_inspection");
    }
    this.renderDamagesList();
  },

  cancelAddDamage() {
    if (this.currentDamageStage === "departure") {
      this.showStep("depart_status");
    } else {
      this.showStep("arrival_inspection");
    }
  },

  deleteDamage(id) {
    this.damages = this.damages.filter((d) => d.id !== id);
    this.renderDamagesList();
  },

  renderDamagesList() {
    // Render departure damages list
    const depListEl = document.getElementById("ins_departure_damages_list");
    if (depListEl) {
      const depDamages = this.damages.filter((d) => d.stage === "departure");
      depListEl.innerHTML = "";
      if (depDamages.length === 0) {
        depListEl.innerHTML = `
          <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-500">
            <i data-lucide="shield-check" class="w-8 h-8 mx-auto mb-1.5 opacity-40 text-indigo-400"></i>
            <p class="text-[10px] font-bold uppercase tracking-wider">Aucune anomalie signalée</p>
            <p class="text-[9px] text-slate-500">Le véhicule est présumé intact au départ.</p>
          </div>
        `;
      } else {
        depDamages.forEach((d) => {
          let severityColor =
            "text-amber-500 bg-amber-500/10 border border-amber-500/20";
          if (d.severity === "Important")
            severityColor =
              "text-rose-500 bg-rose-500/10 border border-rose-500/20";

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
              <p class="text-[10px] text-slate-300 italic font-sans break-words bg-slate-950/40 p-1.5 rounded border border-slate-950 mt-1">"${d.notes || "Pas de notes"}"</p>
              
              ${
                d.photoUrls && d.photoUrls.length > 0
                  ? `
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  ${d.photoUrls
                    .map(
                      (url, i) => `
                    <div class="w-12 h-12 rounded bg-slate-950 border border-slate-850 overflow-hidden cursor-pointer hover:border-indigo-500 hover:scale-[1.03] transition-all" onclick="InspectionService.openLightbox('${url}')">
                      <img src="${url}" class="w-full h-full object-cover">
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>
          `;
        });
      }
    }

    // Render arrival damages list
    const arrListEl = document.getElementById("ins_arrival_damages_list");
    if (arrListEl) {
      const arrDamages = this.damages.filter((d) => d.stage === "arrival");
      arrListEl.innerHTML = "";
      if (arrDamages.length === 0) {
        arrListEl.innerHTML = `
          <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-slate-505">
            <i data-lucide="shield-check" class="w-8 h-8 mx-auto mb-1.5 opacity-40 text-emerald-400"></i>
            <p class="text-[10px] font-bold uppercase tracking-wider">Aucune nouvelle anomalie</p>
            <p class="text-[9px] text-slate-500">Aucun dommage de convoyage déclaré.</p>
          </div>
        `;
      } else {
        arrDamages.forEach((d) => {
          let severityColor =
            "text-amber-500 bg-amber-500/10 border border-amber-500/20";
          if (d.severity === "Important")
            severityColor =
              "text-rose-500 bg-rose-500/10 border border-rose-500/20";

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
              <p class="text-[10px] text-slate-300 italic font-sans break-words bg-slate-950/40 p-1.5 rounded border border-slate-950 mt-1">"${d.notes || "Pas de notes"}"</p>
              
              ${
                d.photoUrls && d.photoUrls.length > 0
                  ? `
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  ${d.photoUrls
                    .map(
                      (url, i) => `
                    <div class="w-12 h-12 rounded bg-slate-950 border border-slate-850 overflow-hidden cursor-pointer hover:border-indigo-500 hover:scale-[1.03] transition-all" onclick="InspectionService.openLightbox('${url}')">
                      <img src="${url}" class="w-full h-full object-cover">
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>
          `;
        });
      }
    }

    if (window.lucide) window.lucide.createIcons();
    this.updateRadarCharts();
  },

  updateRadarCharts() {
    if (typeof Chart === "undefined") return;

    const zonesLabels = [
      "Avant",
      "Arrière",
      "Côtés",
      "Toit",
      "Vitrage",
      "Intérieur",
      "Jantes",
    ];

    const countDamages = (damagesArr) => {
      const counts = [0, 0, 0, 0, 0, 0, 0];
      damagesArr.forEach((d) => {
        const zoneLower = (d.zone || "").toLowerCase();
        if (zoneLower.includes("avant")) counts[0]++;
        else if (zoneLower.includes("arrière")) counts[1]++;
        else if (
          zoneLower.includes("côté") ||
          zoneLower.includes("flanc") ||
          zoneLower.includes("droit") ||
          zoneLower.includes("gauche")
        )
          counts[2]++;
        else if (
          zoneLower.includes("toit") ||
          zoneLower.includes("pavillon") ||
          zoneLower.includes("capot")
        )
          counts[3]++;
        else if (
          zoneLower.includes("vitrage") ||
          zoneLower.includes("pare-brise")
        )
          counts[4]++;
        else if (
          zoneLower.includes("intérieur") ||
          zoneLower.includes("habitacle")
        )
          counts[5]++;
        else if (zoneLower.includes("jantes") || zoneLower.includes("pneus"))
          counts[6]++;
        else counts[0]++; // fallback
      });
      return counts;
    };

    const isDark = !!(window.app && window.app.isDarkMode);
    const gridColor = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const angleLineColor = isDark
      ? "rgba(255, 255, 255, 0.12)"
      : "rgba(0, 0, 0, 0.08)";

    // DEPARTURE
    const depDamages = this.damages.filter((d) => d.stage === "departure");
    const depContainer = document.getElementById(
      "ins_departure_radar_container",
    );
    if (depContainer) {
      depContainer.classList.remove("hidden");
      const ctx = document.getElementById("ins_departure_radar_chart");
      if (ctx) {
        if (this._depRadarChart) this._depRadarChart.destroy();
        const maxVal = Math.max(3, ...countDamages(depDamages));
        this._depRadarChart = new Chart(ctx, {
          type: "radar",
          data: {
            labels: zonesLabels,
            datasets: [
              {
                label: "Dommages Départ",
                data: countDamages(depDamages),
                backgroundColor: "rgba(99, 102, 241, 0.18)",
                borderColor: "rgba(99, 102, 241, 1)",
                pointBackgroundColor: "rgba(99, 102, 241, 1)",
                pointHoverBackgroundColor: "#fff",
                borderWidth: 2,
                pointRadius: 4,
              },
            ],
          },
          options: {
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: maxVal,
                ticks: { display: false, stepSize: 1 },
                grid: { color: gridColor },
                angleLines: { color: angleLineColor },
                pointLabels: {
                  color: textColor,
                  font: { family: "Inter", size: 9, weight: "600" },
                },
              },
            },
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false,
          },
        });
      }
    }

    // ARRIVAL
    const arrDamages = this.damages.filter((d) => d.stage === "arrival");
    const arrContainer = document.getElementById("ins_arrival_radar_container");
    if (arrContainer) {
      arrContainer.classList.remove("hidden");
      const ctx = document.getElementById("ins_arrival_radar_chart");
      if (ctx) {
        if (this._arrRadarChart) this._arrRadarChart.destroy();
        const maxVal = Math.max(3, ...countDamages(arrDamages));
        this._arrRadarChart = new Chart(ctx, {
          type: "radar",
          data: {
            labels: zonesLabels,
            datasets: [
              {
                label: "Nouveaux Dommages",
                data: countDamages(arrDamages),
                backgroundColor: "rgba(244, 63, 94, 0.18)",
                borderColor: "rgba(244, 63, 94, 1)",
                pointBackgroundColor: "rgba(244, 63, 94, 1)",
                pointHoverBackgroundColor: "#fff",
                borderWidth: 2,
                pointRadius: 4,
              },
            ],
          },
          options: {
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: maxVal,
                ticks: { display: false, stepSize: 1 },
                grid: { color: gridColor },
                angleLines: { color: angleLineColor },
                pointLabels: {
                  color: textColor,
                  font: { family: "Inter", size: 9, weight: "600" },
                },
              },
            },
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false,
          },
        });
      }
    }
  },

  renderSummary() {
    if (!document.getElementById("inspectionModal")) {
      return;
    }
    const listEl = document.getElementById("ins_summary_damages");
    const photosEl = document.getElementById("ins_summary_photos");

    const mission = app.missions.find((m) => m.id === this.activeMissionId);

    // Summary info
    const summaryDateEl = document.getElementById("ins_summary_date");
    if (summaryDateEl) {
      summaryDateEl.textContent = new Date().toLocaleString("fr-FR");
    }
    const summaryDamageCountEl = document.getElementById(
      "ins_summary_damage_count",
    );
    if (summaryDamageCountEl) {
      summaryDamageCountEl.textContent = this.damages.length;
    }

    // Fill contract and departure details
    const refSummary = document.getElementById("ins_summary_ref");
    if (refSummary) refSummary.textContent = this.departRef || "Non spécifié";

    const clientSummary = document.getElementById("ins_summary_client");
    if (clientSummary)
      clientSummary.textContent = this.departClient || "Non spécifié";

    const kmSummary = document.getElementById("ins_summary_km");
    if (kmSummary)
      kmSummary.textContent = this.departKm
        ? `${this.departKm} km`
        : "Non spécifié";

    const fuelSummary = document.getElementById("ins_summary_fuel");
    if (fuelSummary)
      fuelSummary.textContent = this.departFuel || "Non spécifié";

    const dtSummary = document.getElementById("ins_summary_depart_datetime");
    if (dtSummary) {
      const formattedDate = this.departDate
        ? new Date(this.departDate).toLocaleDateString("fr-FR")
        : "N/A";
      dtSummary.textContent = `${formattedDate} à ${this.departTime || "N/A"}`;
    }

    // Fill arrival details inside summary
    const arrDestSummary = document.getElementById("ins_summary_arr_dest");
    if (arrDestSummary && mission) {
      arrDestSummary.textContent = mission.destination || "N/A";
    }

    const kmArrSummary = document.getElementById("ins_summary_arr_km");
    if (kmArrSummary)
      kmArrSummary.textContent = this.arriveeKm
        ? `${this.arriveeKm} km`
        : "Non spécifié";

    const fuelArrSummary = document.getElementById("ins_summary_arr_fuel");
    if (fuelArrSummary)
      fuelArrSummary.textContent = this.arriveeFuel || "Non spécifié";

    const dtArrSummary = document.getElementById(
      "ins_summary_arrivee_datetime",
    );
    if (dtArrSummary) {
      const formattedDate = this.arriveeDate
        ? new Date(this.arriveeDate).toLocaleDateString("fr-FR")
        : "N/A";
      dtArrSummary.textContent = `${formattedDate} à ${this.arriveeTime || "N/A"}`;
    }

    const galleryGrid = document.getElementById("ins_gallery_grid");
    const galleryCount = document.getElementById("ins_gallery_count");

    // Fill mission details
    if (mission) {
      const summaryElements = {
        ins_summary_vehicle:
          mission.vehicle || mission.modele || "Véhicule N/A",
        ins_summary_plate: mission.immatriculation || "N/A",
        ins_summary_depart: mission.depart || "N/A",
        ins_summary_destination: mission.destination || "N/A",
        ins_summary_platform: mission.plateforme || "N/A",
      };

      for (const [id, value] of Object.entries(summaryElements)) {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = value;
        }
      }

      const fmtEuro = (v) =>
        Number(v || 0).toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
        });
      const gainEl = document.getElementById("ins_summary_gain");
      if (gainEl) {
        gainEl.textContent = fmtEuro(mission.gain);
      }
    }

    listEl.innerHTML = "";

    let allPhotos = [];
    if (this.dashPhotoDep) {
      allPhotos.push({ url: this.dashPhotoDep, label: "TDB Départ" });
    }
    if (this.dashPhotoArr) {
      allPhotos.push({ url: this.dashPhotoArr, label: "TDB Restitution" });
    }
    if (this.contractPhoto) {
      allPhotos.push({ url: this.contractPhoto, label: "Contrat" });
    }
    if (this.depositReceiptPhoto) {
      allPhotos.push({ url: this.depositReceiptPhoto, label: "Reçu Dépôt" });
    }

    this.damages.forEach((d) => {
      if (d.photoUrls && d.photoUrls.length > 0) {
        d.photoUrls.forEach((url, idx) => {
          allPhotos.push({
            url,
            label: `${d.zone} - ${d.type} ${d.photoUrls.length > 1 ? "(" + (idx + 1) + ")" : ""}`,
          });
        });
      }

      listEl.innerHTML += `
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-left">
          <div class="flex flex-col">
            <span class="text-sm font-bold text-slate-900 dark:text-white">${d.zone} - ${d.type}</span>
            <span class="text-[10px] text-slate-500">${d.severity} // ${d.notes || "Pas de notes"}</span>
          </div>
        </div>
      `;
    });

    if (this.damages.length === 0) {
      listEl.innerHTML =
        '<p class="text-xs text-emerald-500 font-bold py-2"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Véhicule en parfait état signalé</p>';
    }

    if (galleryGrid) {
      if (galleryCount) {
        galleryCount.textContent = `${allPhotos.length} photo${allPhotos.length > 1 ? "s" : ""}`;
      }
      galleryGrid.innerHTML = "";
      if (allPhotos.length > 0) {
        allPhotos.forEach((photo) => {
          galleryGrid.innerHTML += `
            <div class="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" onclick="InspectionService.openLightbox('${photo.url}')">
              <img src="${photo.url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                <span class="text-[8px] text-white font-bold block truncate" title="${photo.label}">${photo.label}</span>
              </div>
            </div>
          `;
        });
      } else {
        galleryGrid.innerHTML =
          '<div class="col-span-full py-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">Aucune photo dans la galerie</div>';
      }
    }

    this.updateSMSLinks();

    if (window.lucide) window.lucide.createIcons();
  },

  updateSMSLinks() {
    const mission = app.missions.find((m) => m.id === this.activeMissionId);
    if (!mission) return;

    const contactPhone =
      document.getElementById("ins_summary_contact_phone")?.value ||
      "+33612345678";

    let text = `ANOMALIES & DÉTAILS CONVOYAGE\n`;
    text += `=========================\n`;
    text += `Véhicule: ${mission.vehicle || mission.modele || "N/A"}\n`;
    text += `Immatriculation: ${mission.immatriculation || "N/A"}\n`;
    text += `Itinéraire: ${mission.depart || "N/A"} -> ${mission.destination || "N/A"}\n`;
    text += `Plateforme: ${mission.plateforme || "N/A"}\n`;
    text += `Date Signalement: ${new Date().toLocaleString("fr-FR")}\n`;
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

    const textarea = document.getElementById("ins_summary_sms_textarea");
    if (textarea) {
      textarea.value = text;
    }

    const smsBtn = document.getElementById("ins_summary_sms_btn");
    if (smsBtn) {
      smsBtn.href = `sms:${contactPhone}?body=${encodeURIComponent(text)}`;
    }

    const callBtn = document.getElementById("ins_summary_call_btn");
    if (callBtn) {
      callBtn.href = `tel:${contactPhone}`;
    }
  },

  copySMS() {
    const textarea = document.getElementById("ins_summary_sms_textarea");
    if (textarea) {
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      navigator.clipboard
        .writeText(textarea.value)
        .then(() => {
          if (window.DashboardService) {
            window.DashboardService.showNotification(
              "État des lieux copié !",
              "success",
            );
          }
        })
        .catch(() => {
          try {
            document.execCommand("copy");
            if (window.DashboardService) {
              window.DashboardService.showNotification(
                "Réussi (presse-papier) !",
                "success",
              );
            }
          } catch (e) {
            if (window.DashboardService) {
              window.DashboardService.showNotification(
                "Veuillez sélectionner et copier.",
                "warning",
              );
            }
          }
        });
    }
  },

  updateDriveBtnState(mission) {
    const driveBtn = document.getElementById("btn_ins_success_drive_upload");
    if (driveBtn) {
      if (mission.driveSaved) {
        driveBtn.disabled = true;
        driveBtn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-300"></i> Sauvegardé dans Drive`;
        driveBtn.className =
          "px-4 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 font-black uppercase tracking-wider rounded-xl transition-all cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md opacity-75";
      } else {
        driveBtn.disabled = false;
        driveBtn.innerHTML = `<i data-lucide="cloud-upload" class="w-4 h-4"></i> Enregistrer dans Google Drive`;
        driveBtn.className =
          "px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs text-white font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md";
      }
    }

    // Update index.html success modal details grid field
    const successDriveStatus = document.getElementById(
      "ins_success_drive_status",
    );
    if (successDriveStatus) {
      if (mission.driveSaved) {
        successDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-400 bg-emerald-505/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><i data-lucide="check-circle" class="w-3 h-3 text-emerald-400"></i> Sauvegardé</span>`;
      } else {
        successDriveStatus.innerHTML = `<span class="inline-flex items-center gap-1 font-bold text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500"></i> Non sauvegardé</span>`;
      }
    }

    // Update index.html summary details grid field
    const summaryDriveStatus = document.getElementById(
      "ins_summary_drive_status",
    );
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
    const mission = app.missions.find((m) => m.id === missionId);
    if (!mission) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Aucune mission active trouvée pour l'upload.",
          "error",
        );
      }
      return;
    }
    if (mission.driveSaved) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Cette mission est déjà sauvegardée sur Google Drive.",
          "info",
        );
      }
      return;
    }
    this.uploadMissionToDrive(mission);
  },

  async uploadMissionToDrive(mission) {
    if (mission._isUploadingToDrive) {
      console.log(
        "[Drive Upload Shield] Save already in progress for this mission. Ignoring concurrent request.",
      );
      return false;
    }
    mission._isUploadingToDrive = true;

    const driveToken = window.googleDriveAccessToken;
    if (!driveToken) {
      delete mission._isUploadingToDrive;
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Veuillez d'abord connecter votre compte Google Drive dans l'onglet Documents.",
          "warning",
        );
      } else {
        alert("Activez d'abord Google Drive dans l'onglet de documents !");
      }
      return false;
    }

    if (!mission.immatriculation) {
      delete mission._isUploadingToDrive;
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Numéro d'immatriculation requis pour l'enregistrement.",
          "error",
        );
      }
      return false;
    }

    const driveBtn = document.getElementById("btn_ins_success_drive_upload");
    let originalBtnHTML = "";
    if (driveBtn) {
      originalBtnHTML = driveBtn.innerHTML;
      driveBtn.disabled = true;
      driveBtn.innerHTML = `<i class="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full mr-1.5"></i> Envoi en cours...`;
      driveBtn.classList.remove("bg-emerald-600", "hover:bg-emerald-500");
      driveBtn.classList.add(
        "bg-emerald-700",
        "cursor-not-allowed",
        "opacity-75",
      );
    }

    if (window.DashboardService) {
      window.DashboardService.showNotification(
        "Sauvegarde en cours sur Google Drive...",
        "info",
      );
    }

    try {
      // 1. Generate text report content
      let reportContent = `RAPPORT D'ÉTAT DES LIEUX DE CONVOYAGE\n`;
      reportContent += `=======================================\n\n`;
      reportContent += `DÉTAILS DE LA MISSION :\n`;
      reportContent += `---------------------------------------\n`;
      reportContent += `Véhicule: ${mission.vehicle || mission.modele || "N/A"}\n`;
      reportContent += `Immatriculation: ${mission.immatriculation || "N/A"}\n`;
      reportContent += `Statut: ${mission.statut || "N/A"}\n`;
      if (mission.statut === "Annulée") {
        reportContent += `Raison d'annulation: ${mission.cancelReason || "N/A"}\n`;
        if (mission.cancelComments) {
          reportContent += `Commentaires annulation: ${mission.cancelComments}\n`;
        }
      }
      reportContent += `Trajet de convoyage: ${mission.depart || "N/A"} ➔ ${mission.destination || "N/A"}\n`;
      reportContent += `Plateforme: ${mission.plateforme || "N/A"}\n`;
      reportContent += `Commission / Gain: ${mission.gain || 0} €\n`;

      const inspectionDate =
        mission.inspection && mission.inspection.date
          ? new Date(mission.inspection.date)
          : new Date();
      reportContent += `Date d'inspection: ${inspectionDate.toLocaleString("fr-FR")}\n`;
      if (mission.inspection) {
        reportContent += `Nº Contrat / Référence: ${mission.inspection.reference || "Non spécifié"}\n`;
        reportContent += `Client de livraison: ${mission.inspection.client || "Non spécifié"}\n`;
        reportContent += `Kilométrage de départ: ${mission.inspection.kmDepart ? mission.inspection.kmDepart + " km" : "Non spécifié"}\n`;
        reportContent += `Niveau jauge carburant (Départ): ${mission.inspection.carburant || "Non spécifié"}\n`;
        const dStr = mission.inspection.dateDepart
          ? new Date(mission.inspection.dateDepart).toLocaleDateString("fr-FR")
          : "Non spécifié";
        reportContent += `Départ prévu le: ${dStr} à ${mission.inspection.heureDepart || "Non spécifié"}\n`;
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
        reportContent += `Kilométrage d'arrivée: ${mission.inspection.kmArrivee ? mission.inspection.kmArrivee + " km" : "Non spécifié"}\n`;
        reportContent += `Niveau jauge carburant (Arrivée): ${mission.inspection.carburantArrivee || "Non spécifié"}\n`;
        const aStr = mission.inspection.dateArrivee
          ? new Date(mission.inspection.dateArrivee).toLocaleDateString("fr-FR")
          : "Non spécifié";
        reportContent += `Date d'arrivée: ${aStr} à ${mission.inspection.heureArrivee || "Non spécifié"}\n`;
      }

      const damages = (mission.inspection && mission.inspection.damages) || [];

      reportContent += `\nRAPPORT D'ANOMALIES AU DÉPART :\n`;
      reportContent += `---------------------------------------\n`;
      const depDamages = damages.filter((d) => d.stage === "departure");
      if (depDamages.length === 0) {
        reportContent += `✓ Aucun dommage signalé au départ. Le véhicule est entièrement intact.\n`;
      } else {
        depDamages.forEach((d, index) => {
          reportContent += `${index + 1}. Zone: ${d.zone || "N/A"} // Type: ${d.type || "N/A"} // Sévérité: ${d.severity || "N/A"}\n`;
          if (d.notes) reportContent += `   Notes: "${d.notes}"\n`;
          let nbPhotos = d.photoUrls ? d.photoUrls.length : 0;
          reportContent += `   Nombre de photos: ${nbPhotos}\n\n`;
        });
      }

      reportContent += `\nRAPPORT D'ANOMALIES À L'ARRIVÉE :\n`;
      reportContent += `---------------------------------------\n`;
      const arrDamages = damages.filter((d) => d.stage === "arrival");
      if (arrDamages.length === 0) {
        reportContent += `✓ Aucun dommage ni incident d'arrivée déclaré.\n`;
      } else {
        arrDamages.forEach((d, index) => {
          reportContent += `${index + 1}. Zone: ${d.zone || "N/A"} // Type: ${d.type || "N/A"} // Sévérité: ${d.severity || "N/A"}\n`;
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

      // Extract clean date from mission
      let mDate = mission.date || (mission.inspection && mission.inspection.date) || new Date().toISOString().split("T")[0];
      if (mDate.includes("T")) mDate = mDate.split("T")[0];

      const reportBlob = new Blob([reportContent], { type: "text/plain" });
      const reportFile = new File([reportBlob], "notes.txt", {
        type: "text/plain",
      });

      const reportFormData = new FormData();
      reportFormData.append("file", reportFile);
      reportFormData.append("immatriculation", mission.immatriculation);
      reportFormData.append("name", "notes.txt");
      reportFormData.append("date", mDate);

      const reportRes = await fetch("/api/drive/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${driveToken}`,
        },
        body: reportFormData,
      });

      if (!reportRes.ok) {
        let errObj = {};
        try {
          errObj = await reportRes.json();
        } catch (e) {}
        throw new Error(errObj.error || "Failed to upload report to Drive");
      }

      // 2. Upload photo files
      let uploadedCount = 0;
      for (const d of damages) {
        const photoUrls = d.photoUrls || [];
        for (let i = 0; i < photoUrls.length; i++) {
          try {
            const url = photoUrls[i];
            let blob;
            if (url.startsWith("data:")) {
              const arr = url.split(",");
              const mimeMatch = arr[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
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

            const stageLabel =
              d.stage === "departure" ? "DefautDep" : "DefautArr";
            const extension = blob.type.split("/")[1] || "jpg";
            const filename = `${stageLabel}_${(d.zone || "Zone").replace(/\s+/g, "_")}_${(d.type || "Type").replace(/\s+/g, "_")}_${i + 1}.${extension}`;

            const file = new File([blob], filename, { type: blob.type });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("immatriculation", mission.immatriculation);
            formData.append("name", filename);
            formData.append("date", mDate);

            const uploadRes = await fetch("/api/drive/upload", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${driveToken}`,
              },
              body: formData,
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
        { url: mission.inspection?.dashboardDepartPhoto, prefix: "TDB_Depart" },
        {
          url: mission.inspection?.dashboardArriveePhoto,
          prefix: "TDB_Arrivee",
        },
        {
          url: mission.inspection?.depositReceiptPhoto,
          prefix: "Recu_Caution",
        },
        { url: mission.inspection?.contractPhoto, prefix: "Contrat_Convoyage" },
        { url: mission.cancelContractPhoto, prefix: "Contrat_Annulation" },
      ];
      for (const tdb of extraPhotos) {
        if (tdb.url) {
          try {
            let blob;
            if (tdb.url.startsWith("data:")) {
              const arr = tdb.url.split(",");
              const mimeMatch = arr[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
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

            const extension = blob.type.split("/")[1] || "jpg";
            const filename = `${tdb.prefix}_${mission.immatriculation}.${extension}`;

            const file = new File([blob], filename, { type: blob.type });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("immatriculation", mission.immatriculation);
            formData.append("name", filename);
            formData.append("date", mDate);

            await fetch("/api/drive/upload", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${driveToken}`,
              },
              body: formData,
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
          if (sigUrl.startsWith("data:")) {
            const arr = sigUrl.split(",");
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : "image/png";
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
            formData.append("date", mDate);

            await fetch("/api/drive/upload", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${driveToken}`,
              },
              body: formData,
            });
          }
        } catch (err) {
          console.error("Erreur d'upload de la signature à Google Drive:", err);
        }
      }

      // Mark mission as saved in Google Drive
      const missionIndex = app.missions.findIndex((m) => m.id === mission.id);
      if (missionIndex !== -1) {
        app.missions[missionIndex].driveSaved = true;
        if (app.missions[missionIndex].statut !== "Annulée") {
          app.missions[missionIndex].statut = "Terminée";
        }
        app.saveMissions();
        if (window.app && window.app.refreshUI) {
          window.app.refreshUI();
        }
      }

      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Mission, rapport d'état des lieux et signature sauvegardés sur Google Drive !",
          "success",
        );
      }

      this.updateDriveBtnState(mission);
      delete mission._isUploadingToDrive;
      return true;
    } catch (err) {
      delete mission._isUploadingToDrive;
      console.error("Erreur d'enregistrement Google Drive:", err);
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Échec de la sauvegarde Google Drive: " +
            (err.message || "Erreur inconnue"),
          "error",
        );
      }
      if (driveBtn) {
        driveBtn.disabled = false;
        driveBtn.innerHTML = originalBtnHTML;
        driveBtn.classList.remove(
          "bg-emerald-700",
          "cursor-not-allowed",
          "opacity-75",
        );
        driveBtn.classList.add("bg-emerald-600", "hover:bg-emerald-500");
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
      return false;
    }
  },

  async submitInspection() {
    // Save inspection on the mission
    const missionIndex = app.missions.findIndex(
      (m) => m.id === this.activeMissionId,
    );
    if (missionIndex !== -1) {
      const mission = app.missions[missionIndex];
      mission.inspection = {
        date: new Date().toISOString(),
        damages: this.damages,
        status: "Validée",
        vehicle: mission.vehicle || mission.modele || "N/A",
        immatriculation: mission.immatriculation || "N/A",
        depart: mission.depart || "N/A",
        destination: mission.destination || "N/A",
        plateforme: mission.plateforme || "N/A",
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
        heureArrivee: this.arriveeTime,
      };

      // Auto-assign master status to 'Terminée' since the final arrival check is complete
      mission.statut = "Terminée";

      app.saveMissions();
      app.refreshUI();

      // Check if Google Drive accessToken is available for automatic backup
      const driveToken = window.googleDriveAccessToken;
      if (driveToken && mission.immatriculation) {
        this.uploadMissionToDrive(mission);
      }
    }

    const savedMission = app.missions.find(
      (m) => m.id === this.activeMissionId,
    );

    this.closeInspection();

    if (savedMission) {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          `Inspection validée pour ${savedMission.vehicle || savedMission.modele || "N/A"} ! Départ autorisé.`,
          "success",
        );
      }
      this.showSuccessModal(savedMission);
    } else {
      if (window.DashboardService) {
        window.DashboardService.showNotification(
          "Inspection validée avec succès !",
          "success",
        );
      }
    }
  },
};

window.InspectionService = InspectionService;
