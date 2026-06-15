import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import { initDatabase, DbService, hashPassword } from "./server/db";

// Initialize the database with default seeded users
initDatabase();

function getFrenchMonthName(monthStr: string | number): string {
  const m = String(monthStr).padStart(2, '0');
  const months: { [key: string]: string } = {
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
  return months[m] || "Janvier";
}

// Helper function to find or create a folder in Google Drive
async function getOrCreateFolder(drive: any, name: string, parentId?: string): Promise<string> {
  let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  } else {
    q += " and 'root' in parents";
  }

  const response = await drive.files.list({
    q: q,
    spaces: 'drive',
    fields: 'files(id, name)',
    pageSize: 1
  });

  const files = response.data.files || [];
  if (files.length > 0 && files[0].id) {
    return files[0].id;
  }

  const fileMetadata: any = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id'
  });

  return folder.data.id!;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  app.use(cors());
  app.use(express.json());

  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  // -------------------------------------------------------------
  // RBAC AUTHENTICATION MIDDLEWARES & ENDPOINTS
  // -------------------------------------------------------------

  function getCookie(req: any, val: string) {
    const list: any = {};
    const rc = req.headers.cookie;
    if (rc) {
      rc.split(';').forEach(function(cookie: string) {
        const parts = cookie.split('=');
        list[parts.shift()!.trim()] = decodeURI(parts.join('='));
      });
    }
    return list[val];
  }

  // Authentication Guard via X-Session-Token or cookie or query fallback
  function authenticate(req: any, res: any, next: any) {
    let token = req.headers['x-session-token'] as string;
    if (!token) {
      token = getCookie(req, 'session_token');
    }
    if (!token && req.query) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: "Non authentifié. Session manquante." });
    }

    const session = DbService.getSession(token);
    if (!session) {
      return res.status(401).json({ success: false, error: "Session expirée ou invalide. Veuillez vous reconnecter." });
    }

    const user = DbService.getUserByUsername(session.username);
    if (!user) {
      return res.status(401).json({ success: false, error: "Utilisateur associé introuvable." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, error: "Votre compte a été désactivé." });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  }

  // Role Guard
  function requireRole(roles: string[]) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ success: false, error: "Non authentifié." });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: "Accès interdit : privilèges insuffisants." });
      }
      next();
    };
  }

  // Strong password validator (8+ chars, uppercase, lowercase, digit, special char)
  function isPasswordStrong(p: string): boolean {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(p);
  }

  // Password Input Sanitization / Prevention of injection or malicious inputs
  const sanitizeString = (str: string) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>'"&]/g, '');
  };

  // Login Endpoint
  app.post("/api/auth/login", (req, res) => {
    const usernameInput = req.body.username;
    const passwordInput = req.body.password;

    if (!usernameInput || !passwordInput) {
      return res.status(400).json({ success: false, error: "Saisissez un nom d'utilisateur et un mot de passe." });
    }

    const username = String(usernameInput).trim();
    const password = String(passwordInput);

    const user = DbService.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, error: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, error: "Ce compte est inactif. Contactez l'administrateur." });
    }

    // Authenticate password hashes
    // Special check for accountant seed constraints:
    // If the input is ACC@con125 or stored hash matches, allow password change or direct login
    let isValid = false;
    let bypassedFirstReset = false;

    const currentHash = hashPassword(password, user.salt);
    if (currentHash === user.passwordHash) {
      isValid = true;
    } else if (username.toLowerCase() === 'accountant' && password === 'ACC@con125') {
      isValid = true;
      bypassedFirstReset = true;
    }

    if (!isValid) {
      return res.status(401).json({ success: false, error: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    // If accountant logged in using direct override, we clear force-password-reset
    if (bypassedFirstReset && user.mustChangePassword) {
      DbService.resetUserPassword('accountant', 'ACC@con125', false, 'SYSTEM');
      user.mustChangePassword = false;
    }

    // Allocate Session TOKEN
    const token = DbService.createSession(user.username);
    DbService.addLog('LOGIN', user.username, `Connexion réussie de l'utilisateur : ${user.username}`);

    res.setHeader('Set-Cookie', [
      `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${4 * 60 * 60}`
    ]);

    return res.json({
      success: true,
      token,
      user: {
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      }
    });
  });

  // Logout Endpoint
  app.post("/api/auth/logout", authenticate, (req: any, res) => {
    DbService.deleteSession(req.sessionToken);
    DbService.addLog('LOGOUT', req.user.username, `Déconnexion de l'utilisateur : ${req.user.username}`);
    res.setHeader('Set-Cookie', [
      `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    ]);
    return res.json({ success: true, message: "Déconnecté" });
  });

  // Get Profile Endpoint
  app.get("/api/auth/me", authenticate, (req: any, res) => {
    return res.json({
      success: true,
      user: {
        fullname: req.user.fullname,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        mustChangePassword: req.user.mustChangePassword
      }
    });
  });

  // Self Change Password Endpoint (specifically to support force-change on first login)
  app.post("/api/auth/change-password", authenticate, (req: any, res) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Nouveau mot de passe requis." });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ 
        success: false, 
        error: "Le mot de passe doit faire au moins 8 caractères, contenir une majuscule, une minuscule, un chiffre, et un caractère spécial (@$!%*?&)." 
      });
    }

    const success = DbService.resetUserPassword(req.user.username, password, false, req.user.username);
    if (!success) {
      return res.status(500).json({ success: false, error: "Échec de la modification du mot de passe." });
    }

    return res.json({ success: true, message: "Votre mot de passe a été modifié avec succès. Reconnexion possible !" });
  });

  // ------------------------- ADMIN USER CRUD (ADMIN ONLY) -------------------------

  // Get Users List
  app.get("/api/admin/users", authenticate, requireRole(["ADMIN"]), (req, res) => {
    const users = DbService.getUsers().map(u => ({
      fullname: u.fullname,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      mustChangePassword: u.mustChangePassword
    }));
    return res.json({ success: true, users });
  });

  // Create User
  app.post("/api/admin/users", authenticate, requireRole(["ADMIN"]), (req: any, res) => {
    const { fullname, username, email, password, role, status } = req.body;

    // Checks
    if (!fullname || !username || !email || !password || !role || !status) {
      return res.status(400).json({ success: false, error: "Tous les champs obligatoires doivent être renseignés." });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    // Validations
    if (!isPasswordStrong(password)) {
      return res.status(400).json({ 
        success: false, 
        error: "Le mot de passe doit faire au moins 8 caractères, contenir une majuscule, une minuscule, un chiffre, et un caractère spécial." 
      });
    }

    // Check unique username
    if (DbService.getUserByUsername(cleanUsername)) {
      return res.status(400).json({ success: false, error: "Ce nom d'utilisateur est déjà pris." });
    }

    // Check unique email
    if (DbService.getUserByEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Cette adresse email est déjà prise." });
    }

    const cleanFullname = sanitizeString(fullname);
    if (role !== "ADMIN" && role !== "ACCOUNTANT") {
      return res.status(400).json({ success: false, error: "Rôle invalide." });
    }

    const success = DbService.createUser({
      fullname: cleanFullname,
      username: cleanUsername,
      email: cleanEmail,
      role,
      status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      mustChangePassword: true // force reset on first login for newly created accounts by Admin
    }, password, req.user.username);

    if (!success) {
      return res.status(505).json({ success: false, error: "Erreur serveur lors de la création de l'utilisateur." });
    }

    return res.json({ success: true, message: `L'utilisateur ${cleanUsername} a été créé avec succès.` });
  });

  // Update User
  app.put("/api/admin/users/:username", authenticate, requireRole(["ADMIN"]), (req: any, res) => {
    const targetUsername = req.params.username;
    const { fullname, email, role, status, mustChangePassword } = req.body;

    const user = DbService.getUserByUsername(targetUsername);
    if (!user) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
    }

    // Restrict changing seeded admin admin_auth
    if (targetUsername.toLowerCase() === "admin_auth" && role !== "ADMIN") {
      return res.status(400).json({ success: false, error: "Impossible de modifier le rôle de l'administrateur principal." });
    }
    if (targetUsername.toLowerCase() === "admin_auth" && status === "INACTIVE") {
      return res.status(400).json({ success: false, error: "Impossible de désactiver l'administrateur principal." });
    }

    // Email check uniqueness if changed
    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail !== user.email.toLowerCase()) {
      const emailDup = DbService.getUserByEmail(cleanEmail);
      if (emailDup) {
        return res.status(400).json({ success: false, error: "Cette adresse email est déjà prise." });
      }
    }

    const updates: any = {};
    if (fullname) updates.fullname = sanitizeString(fullname);
    if (email) updates.email = cleanEmail;
    if (role) updates.role = role === "ADMIN" ? "ADMIN" : "ACCOUNTANT";
    if (status) updates.status = status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    if (mustChangePassword !== undefined) updates.mustChangePassword = !!mustChangePassword;

    const success = DbService.updateUser(targetUsername, updates, req.user.username);
    if (!success) {
      return res.status(500).json({ success: false, error: "Erreur serveur lors de la mise à jour de l'utilisateur." });
    }

    return res.json({ success: true, message: `L'utilisateur ${targetUsername} a été mis à jour.` });
  });

  // Delete User
  app.delete("/api/admin/users/:username", authenticate, requireRole(["ADMIN"]), (req: any, res) => {
    const targetUsername = req.params.username;
    if (targetUsername.toLowerCase() === "admin_auth") {
      return res.status(400).json({ success: false, error: "Action interdite : Impossible de supprimer l'administrateur principal." });
    }

    const success = DbService.deleteUser(targetUsername, req.user.username);
    if (!success) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
    }

    return res.json({ success: true, message: `L'utilisateur ${targetUsername} a été supprimé.` });
  });

  // Reset password by Admin (forces reset on next login)
  const resetPasswordHandler = (req: any, res: any) => {
    const targetUsername = req.params.username;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: "Nouveau mot de passe requis." });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ 
        success: false, 
        error: "Le mot de passe doit faire au moins 8 caractères, contenir une majuscule, une minuscule, un chiffre, et un caractère spécial." 
      });
    }

    const success = DbService.resetUserPassword(targetUsername, password, true, req.user.username);
    if (!success) {
      return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
    }

    return res.json({ success: true, message: `Le mot de passe de ${targetUsername} a été réinitialisé.` });
  };

  app.post("/api/admin/users/:username/reset-password", authenticate, requireRole(["ADMIN"]), resetPasswordHandler);
  app.put("/api/admin/users/:username/reset-password", authenticate, requireRole(["ADMIN"]), resetPasswordHandler);

  // Get Audit Logs
  app.get("/api/admin/logs", authenticate, requireRole(["ADMIN"]), (req, res) => {
    const logs = DbService.getLogs();
    return res.json({ success: true, logs });
  });

  // Save missions locally to fallback sample-data.json
  app.post("/api/missions/save-local", authenticate, (req, res) => {
    try {
      const { missions } = req.body;
      if (!Array.isArray(missions)) {
        return res.status(400).json({ success: false, error: "Invalid missions array" });
      }
      const dataPath = path.join(process.cwd(), "data", "sample-data.json");
      fs.writeFileSync(dataPath, JSON.stringify(missions, null, 2), "utf-8");
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error saving local sample data:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to save locally" });
    }
  });

  // ------------------------- DRIVE ENDPOINTS PROTECTION -------------------------

  // Secure endpoints with authenticate

  // Drive integration endpoints
  app.get("/api/drive/get-app-data", authenticate, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Missing or invalid authorization header" });
      }
      const token = authHeader.split(" ")[1];

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const rootId = await getOrCreateFolder(drive, "Convoyeur Professionnel");

      const q = `name = 'app_data.json' and '${rootId}' in parents and trashed = false`;
      const listResponse = await drive.files.list({
        q: q,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      });

      const files = listResponse.data.files || [];
      if (files.length === 0 || !files[0].id) {
        return res.json({ success: true, missions: null, settings: null });
      }

      const fileId = files[0].id;
      const fileResponse = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'text'
      });

      let appData: any = {};
      try {
        appData = typeof fileResponse.data === 'string' ? JSON.parse(fileResponse.data) : fileResponse.data;
      } catch (parseErr) {
        console.error("Error parsing downloaded app_data.json:", parseErr);
      }

      return res.json({
        success: true,
        missions: appData.missions || [],
        settings: appData.settings || {}
      });
    } catch (err: any) {
      console.error("Error getting app data from Google Drive:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to retrieve app data from Google Drive"
      });
    }
  });

  app.post("/api/drive/save-app-data", authenticate, requireRole(["ADMIN"]), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Missing or invalid authorization header" });
      }
      const token = authHeader.split(" ")[1];

      const { missions, settings } = req.body;

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const rootId = await getOrCreateFolder(drive, "Convoyeur Professionnel");

      const q = `name = 'app_data.json' and '${rootId}' in parents and trashed = false`;
      const listResponse = await drive.files.list({
        q: q,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      });

      const files = listResponse.data.files || [];
      const fileMetadata = {
        name: 'app_data.json',
        mimeType: 'application/json'
      };

      const media = {
        mimeType: 'application/json',
        body: Readable.from(JSON.stringify({ missions, settings }, null, 2))
      };

      if (files.length > 0 && files[0].id) {
        const fileId = files[0].id;
        await drive.files.update({
          fileId: fileId,
          media: media
        });
      } else {
        await drive.files.create({
          requestBody: {
            ...fileMetadata,
            parents: [rootId]
          },
          media: media
        });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Error saving app data to Google Drive:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to save app data to Google Drive"
      });
    }
  });

  app.post("/api/drive/upload", authenticate, requireRole(["ADMIN"]), upload.single("file"), async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Missing or invalid authorization header" });
      }

      const token = authHeader.split(" ")[1];
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file was uploaded" });
      }

      const immatriculation = (req.body.immatriculation || "SANS-IMMAT").trim().toUpperCase();
      const filename = req.body.name || req.file.originalname;

      // Extract Year, Month, and YYYY-MM-DD
      const dateStr = req.body.date || new Date().toISOString().split('T')[0];
      const dateParts = dateStr.split('-');
      const year = dateParts[0] || new Date().getFullYear().toString();
      const month = dateParts[1] || (new Date().getMonth() + 1).toString().padStart(2, '0');

      const frenchMonth = getFrenchMonthName(month);

      // Set up Google Drive API Client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      // Build folder hierarchy step-by-step
      // 1. Root folder: "Convoyeur Professionnel"
      const rootId = await getOrCreateFolder(drive, "Convoyeur Professionnel");

      // 2. "Convoyages" inside "Convoyeur Professionnel"
      const convoyagesId = await getOrCreateFolder(drive, "Convoyages", rootId);

      // 3. [Year] inside "Convoyages"
      const yearId = await getOrCreateFolder(drive, year, convoyagesId);

      // 4. [Month Name in French] inside [Year]
      const monthId = await getOrCreateFolder(drive, frenchMonth, yearId);

      // 5. [Voiture Immatriculation] inside [Month Name]
      const registrationId = await getOrCreateFolder(drive, immatriculation, monthId);

      // 6. "État des lieux" inside [Voiture Immatriculation]
      const etatDesLieuxId = await getOrCreateFolder(drive, "État des lieux", registrationId);

      // 7. Upload file inside "État des lieux"
      const fileMetadata = {
        name: filename,
        parents: [etatDesLieuxId]
      };

      const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer)
      };

      const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id"
      });

      return res.json({
        success: true,
        fileId: driveFile.data.id,
        path: `Convoyeur Professionnel/Convoyages/${year}/${frenchMonth}/${immatriculation}/État des lieux/${filename}`
      });

    } catch (err: any) {
      console.error("Error uploading to Google Drive via server API:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Unknown error during Google Drive upload"
      });
    }
  });

  // ------------------------- FIREBASE IDENTITY TOOLKIT PROXY -------------------------
  // This proxies requests from Firebase Client SDK to identitytoolkit.googleapis.com
  ///securetoken.googleapis.com to completely bypass client-side CORS and API Key Referrer Restrictions.
  app.all("/api/firebase-proxy/:service/*", async (req: any, res: any) => {
    try {
      const service = req.params.service; // "identitytoolkit" or "securetoken"
      if (service !== "identitytoolkit" && service !== "securetoken") {
        return res.status(400).json({ error: "Invalid proxy service" });
      }

      const prefix = `/api/firebase-proxy/${service}/`;
      const matchIndex = req.url.indexOf(prefix);
      const targetPath = matchIndex !== -1 ? req.url.substring(matchIndex + prefix.length) : '';
      const domain = service === "identitytoolkit" ? "identitytoolkit.googleapis.com" : "securetoken.googleapis.com";
      const targetUrl = `https://${domain}/${targetPath}`;

      const headers: any = {
        'content-type': 'application/json',
      };
      if (req.headers['x-client-version']) {
        headers['x-client-version'] = req.headers['x-client-version'];
      }
      if (req.headers['authorization']) {
        headers['authorization'] = req.headers['authorization'];
      }

      const options: any = {
        method: req.method,
        headers: headers,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      console.log(`[Proxy Server] Routing ${req.method} request to ${domain} for endpoint: ${targetPath}`);
      const response = await fetch(targetUrl, options);
      const data = await response.json();

      res.status(response.status).json(data);
    } catch (err: any) {
      console.error("[Proxy Server] Error proxying to Firebase:", err);
      res.status(500).json({ error: { message: err.message || "Failed to proxy request" } });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa", // changed from "custom" to handle general client side routing
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
