import fs from "fs";

let content = fs.readFileSync("components/inspection.js", "utf-8");

const startStr = "// Live previews for TDB";
const endStr = "this.updateSMSLinks();";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const newLogic = `
    const galleryGrid = document.getElementById('ins_gallery_grid');
    const galleryCount = document.getElementById('ins_gallery_count');
    
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
    
    let allPhotos = [];
    if (this.dashPhotoDep) {
      allPhotos.push({ url: this.dashPhotoDep, label: 'TDB Départ' });
    }
    if (this.dashPhotoArr) {
      allPhotos.push({ url: this.dashPhotoArr, label: 'TDB Restitution' });
    }
    if (this.contractPhoto) {
      allPhotos.push({ url: this.contractPhoto, label: 'Contrat' });
    }
    if (this.depositReceiptPhoto) {
      allPhotos.push({ url: this.depositReceiptPhoto, label: 'Reçu Dépôt' });
    }

    this.damages.forEach(d => {
      if (d.photoUrls && d.photoUrls.length > 0) {
        d.photoUrls.forEach((url, idx) => {
          allPhotos.push({ url, label: \`\${d.zone} - \${d.type} \${d.photoUrls.length > 1 ? '('+(idx+1)+')' : ''}\` });
        });
      }
      
      listEl.innerHTML += \`
        <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-left">
          <div class="flex flex-col">
            <span class="text-sm font-bold text-slate-900 dark:text-white">\${d.zone} - \${d.type}</span>
            <span class="text-[10px] text-slate-500">\${d.severity} // \${d.notes || 'Pas de notes'}</span>
          </div>
        </div>
      \`;
    });
    
    if(this.damages.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-emerald-500 font-bold py-2"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Véhicule en parfait état signalé</p>';
    }

    if (galleryGrid) {
      if (galleryCount) {
        galleryCount.textContent = \`\${allPhotos.length} photo\${allPhotos.length > 1 ? 's' : ''}\`;
      }
      galleryGrid.innerHTML = '';
      if (allPhotos.length > 0) {
        allPhotos.forEach(photo => {
          galleryGrid.innerHTML += \`
            <div class="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" onclick="InspectionService.openLightbox('\${photo.url}')">
              <img src="\${photo.url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                <span class="text-[8px] text-white font-bold block truncate" title="\${photo.label}">\${photo.label}</span>
              </div>
            </div>
          \`;
        });
      } else {
        galleryGrid.innerHTML = '<div class="col-span-full py-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">Aucune photo dans la galerie</div>';
      }
    }

    `;

    const newContent = content.substring(0, startIdx) + newLogic + content.substring(endIdx);
    fs.writeFileSync("components/inspection.js", newContent);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find start or end index.");
}
