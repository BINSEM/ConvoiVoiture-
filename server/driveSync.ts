import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { DbService } from "./db";

// Map of French month names
const FRENCH_MONTH_NAMES: { [key: string]: string } = {
  "01": "Janvier",
  "02": "Février",
  "03": "Mars",
  "04": "Avril",
  "05": "Mai",
  "06": "Juin",
  "07": "Juillet",
  "08": "Août",
  "09": "Septembre",
  "10": "Octobre",
  "11": "Novembre",
  "12": "Décembre"
};

// Map of month names (reverse) for folder discovery
const MONTH_NAMES_TO_NUM: { [key: string]: string } = {
  "january": "01", "february": "02", "march": "03", "april": "04", "may": "05", "june": "06",
  "july": "07", "august": "08", "september": "09", "october": "10", "november": "11", "december": "12",
  "janvier": "01", "février": "02", "mars": "03", "avril": "04", "mai": "05", "juin": "06",
  "juillet": "07", "août": "08", "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12"
};

// Find or create a folder helper
async function findOrCreateFolder(drive: any, name: string, parentId?: string): Promise<string> {
  let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  } else {
    q += " and 'root' in parents";
  }

  const response = await drive.files.list({
    q: q,
    spaces: "drive",
    fields: "files(id, name)",
    pageSize: 1
  });

  const files = response.data.files || [];
  if (files.length > 0 && files[0].id) {
    return files[0].id;
  }

  const fileMetadata: any = {
    name: name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id"
  });

  return folder.data.id!;
}

// Group missions by Year and Month
export function groupMissionsByMonth(missions: any[]): { [key: string]: any[] } {
  const groups: { [key: string]: any[] } = {};
  for (const m of missions) {
    const dateStr = m.date || new Date().toISOString().split("T")[0];
    const parts = dateStr.split("-");
    const year = parts[0] || "2026";
    const month = parts[1] || "06";
    const key = `${year}-${month}`; // e.g. "2026-06"
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(m);
  }
  return groups;
}

// Smart merger of local and remote mission arrays
export function mergeMissionLists(local: any[], remote: any[]): any[] {
  const merged = [...local];
  for (const rm of remote) {
    if (!rm || !rm.id) continue;
    const localIdx = merged.findIndex(lm => lm.id === rm.id);
    if (localIdx === -1) {
      merged.push(rm);
    } else {
      const lm = merged[localIdx];
      // Keep the most comprehensive or terminated state
      const lmSignature = lm.inspection?.signature || lm.signatureData || lm.signatureCaptured;
      const rmSignature = rm.inspection?.signature || rm.signatureData || rm.signatureCaptured;
      
      const isRemoteBetter = 
        (rm.statut === "Terminée" && lm.statut !== "Terminée") ||
        (rmSignature && !lmSignature) ||
        (Object.keys(rm).length > Object.keys(lm).length);

      if (isRemoteBetter) {
        merged[localIdx] = { ...lm, ...rm };
      } else {
        // Just merge properties
        merged[localIdx] = { ...rm, ...lm };
      }
    }
  }
  return merged;
}

export const DriveSyncService = {
  /**
   * Run background non-blocking upload for changed monthly JSON files
   */
  async runBackgroundSync(accessToken: string, missions: any[], actingUser: string) {
    // Start background sync
    Promise.resolve().then(async () => {
      try {
        console.log(`[Background Sync] Starting Drive synchronization for user: ${actingUser}`);
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        const rootId = await findOrCreateFolder(drive, "Convoyeur Professionnel");
        const convoyagesId = await findOrCreateFolder(drive, "Convoyages", rootId);

        // Group local missions
        const groups = groupMissionsByMonth(missions);

        for (const [key, mList] of Object.entries(groups)) {
          const [year, month] = key.split("-");
          const frenchMonth = FRENCH_MONTH_NAMES[month] || "Juin";

          const yearFolderId = await findOrCreateFolder(drive, year, convoyagesId);
          const monthFolderId = await findOrCreateFolder(drive, frenchMonth, yearFolderId);
          const dataFolderId = await findOrCreateFolder(drive, "Data", monthFolderId);

          const fileName = `missions-${year}-${month}.json`;
          const q = `name = '${fileName}' and '${dataFolderId}' in parents and trashed = false`;
          const listRes = await drive.files.list({
            q: q,
            spaces: "drive",
            fields: "files(id, name)",
            pageSize: 1
          });

          const driveFiles = listRes.data.files || [];
          let previousDriveData: any[] = [];
          let fileId = "";

          if (driveFiles.length > 0 && driveFiles[0].id) {
            fileId = driveFiles[0].id;
            try {
              const fileContent = await drive.files.get({
                fileId: fileId,
                alt: "media"
              }, { responseType: "text" });
              previousDriveData = typeof fileContent.data === "string" ? JSON.parse(fileContent.data) : fileContent.data;
              if (!Array.isArray(previousDriveData)) previousDriveData = [];
            } catch (err) {
              console.warn(`[Background Sync] Error parsing existing remote file ${fileName}:`, err);
            }
          }

          // Compare stringified versions of relevant data to verify if it is dirty
          const simplifiedL = mList.map(m => ({ id: m.id, statut: m.statut, date: m.date, info: m.vehicle || m.immatriculation }));
          const simplifiedR = previousDriveData.map(m => ({ id: m.id, statut: m.statut, date: m.date, info: m.vehicle || m.immatriculation }));

          if (JSON.stringify(simplifiedL) === JSON.stringify(simplifiedR) && fileId) {
            console.log(`[Background Sync] Monthly file ${fileName} is clean. Skipping update.`);
            continue; // No changes to this month, skip to preserve historical integrity
          }

          // Generate merged state
          const mergedList = mergeMissionLists(mList, previousDriveData);

          const fileMetadata = {
            name: fileName,
            mimeType: "application/json"
          };
          const media = {
            mimeType: "application/json",
            body: Readable.from(JSON.stringify(mergedList, null, 2))
          };

          if (fileId) {
            await drive.files.update({
              fileId: fileId,
              media: media
            });
            console.log(`[Background Sync] Updated: ${fileName} on Google Drive`);
            DbService.addLog(
              "DRIVE_SYNC_AUTO",
              actingUser,
              `Fichier mensuel synchronisé automatiquement (mise à jour) : ${fileName} (${mergedList.length} missions)`
            );
          } else {
            await drive.files.create({
              requestBody: {
                ...fileMetadata,
                parents: [dataFolderId]
              },
              media: media
            });
            console.log(`[Background Sync] Created: ${fileName} on Google Drive`);
            DbService.addLog(
              "DRIVE_SYNC_AUTO",
              actingUser,
              `Fichier mensuel synchronisé automatiquement (création) : ${fileName} (${mergedList.length} missions)`
            );
          }
        }
      } catch (err: any) {
        console.error("[Background Sync] Error in Drive auto backup:", err);
        DbService.addLog(
          "DRIVE_SYNC_ERROR",
          actingUser,
          `Erreur lors de la synchronisation automatique en arrière-plan : ${err.message || err}`
        );
      }
    });
  },

  /**
   * Run full bidirectional synchronization for all monthly files present on Drive
   */
  async syncAllMonthsBidirectional(accessToken: string, localMissions: any[], actingUser: string): Promise<any[]> {
    console.log(`[Bidirectional Sync] Initializing full monthly database sync for user: ${actingUser}`);
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const rootId = await findOrCreateFolder(drive, "Convoyeur Professionnel");
    const convoyagesId = await findOrCreateFolder(drive, "Convoyages", rootId);

    // List all folders in Convoyages folder (these are years now!)
    const listYearsObj = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and '${convoyagesId}' in parents and trashed = false`,
      spaces: "drive",
      fields: "files(id, name)",
      pageSize: 100
    });

    const yearFolders = listYearsObj.data.files || [];
    let cumulativeMissions: any[] = [...localMissions];
    const processedKeys = new Set<string>();

    for (const yearFolder of yearFolders) {
      if (!yearFolder.id || !yearFolder.name) continue;
      const year = yearFolder.name;
      if (isNaN(Number(year)) || year.length !== 4) continue; // Must be a 4-digit year

      // List all month folders under this year folder
      const listMonthsObj = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and '${yearFolder.id}' in parents and trashed = false`,
        spaces: "drive",
        fields: "files(id, name)",
        pageSize: 100
      });

      const monthFolders = listMonthsObj.data.files || [];
      for (const monthFolder of monthFolders) {
        if (!monthFolder.id || !monthFolder.name) continue;

        const monthNameLower = monthFolder.name.toLowerCase();
        const monthNum = MONTH_NAMES_TO_NUM[monthNameLower];
        if (!monthNum) continue;

        const key = `${year}-${monthNum}`; // e.g. "2026-06"
        processedKeys.add(key);

        // Find or create "Data" folder under monthFolder
        const dataFolderId = await findOrCreateFolder(drive, "Data", monthFolder.id);

        // List JSON files in "Data" folder
        const fileListObj = await drive.files.list({
          q: `name = 'missions-${year}-${monthNum}.json' and '${dataFolderId}' in parents and trashed = false`,
          spaces: "drive",
          fields: "files(id, name)",
          pageSize: 1
        });

        const files = fileListObj.data.files || [];
        let remoteMissions: any[] = [];
        let fileId = "";

        if (files.length > 0 && files[0].id) {
          fileId = files[0].id;
          try {
            const fileContent = await drive.files.get({
              fileId: fileId,
              alt: "media"
            }, { responseType: "text" });

            const data = typeof fileContent.data === "string" ? JSON.parse(fileContent.data) : fileContent.data;
            remoteMissions = Array.isArray(data) ? data : [];
          } catch (err) {
            console.error(`[Bidirectional Sync] Error reading ${year}/${monthFolder.name}/Data/missions-${key}.json:`, err);
          }
        }

        // Filter local missions belonging to this month
        const localMonthly = localMissions.filter(m => {
          const dateStr = m.date || new Date().toISOString().split("T")[0];
          const mParts = dateStr.split("-");
          const mY = mParts[0] || "2026";
          const mM = mParts[1] || "06";
          return `${mY}-${mM}` === key;
        });

        // Merge local and remote
        const mergedMonthly = mergeMissionLists(localMonthly, remoteMissions);

        // Remove previous ones belonging to this month from cumulative, and add the updated merged index
        cumulativeMissions = cumulativeMissions.filter(m => {
          const dateStr = m.date || new Date().toISOString().split("T")[0];
          const mParts = dateStr.split("-");
          const mY = mParts[0] || "2026";
          const mM = mParts[1] || "06";
          return `${mY}-${mM}` !== key;
        });
        cumulativeMissions.push(...mergedMonthly);

        // Upload merged file if changed
        if (JSON.stringify(mergedMonthly) !== JSON.stringify(remoteMissions)) {
          const fileMetadata = {
            name: `missions-${year}-${monthNum}.json`,
            mimeType: "application/json"
          };
          const media = {
            mimeType: "application/json",
            body: Readable.from(JSON.stringify(mergedMonthly, null, 2))
          };

          if (fileId) {
            await drive.files.update({ fileId, media });
          } else {
            await drive.files.create({
              requestBody: { ...fileMetadata, parents: [dataFolderId] },
              media
            });
          }
          console.log(`[Bidirectional Sync] Overwrote/Created updated file for month: ${key} on Google Drive`);
        }
      }
    }

    // Now, scan local months that haven't been processed yet because no corresponding folder existed on Drive
    const localGroups = groupMissionsByMonth(localMissions);
    for (const [key, mList] of Object.entries(localGroups)) {
      if (processedKeys.has(key)) continue;

      const [year, month] = key.split("-");
      const frenchMonth = FRENCH_MONTH_NAMES[month] || "Juin";

      console.log(`[Bidirectional Sync] Creating new folder layout for month: ${year}/${frenchMonth}/Data`);
      const yearFolderId = await findOrCreateFolder(drive, year, convoyagesId);
      const monthFolderId = await findOrCreateFolder(drive, frenchMonth, yearFolderId);
      const dataFolderId = await findOrCreateFolder(drive, "Data", monthFolderId);

      const fileMetadata = {
        name: `missions-${year}-${month}.json`,
        mimeType: "application/json"
      };
      const media = {
        mimeType: "application/json",
        body: Readable.from(JSON.stringify(mList, null, 2))
      };

      await drive.files.create({
        requestBody: { ...fileMetadata, parents: [dataFolderId] },
        media
      });

      cumulativeMissions = cumulativeMissions.filter(m => {
        const dateStr = m.date || new Date().toISOString().split("T")[0];
        const mParts = dateStr.split("-");
        const mY = mParts[0] || "2026";
        const mM = mParts[1] || "06";
        return `${mY}-${mM}` !== key;
      });
      cumulativeMissions.push(...mList);
    }

    DbService.addLog(
      "DRIVE_SYNC_FULL",
      actingUser,
      `Synchronisation bidirectionnelle complète terminée avec succès. Total final : ${cumulativeMissions.length} missions.`
    );

    return cumulativeMissions;
  }
};
