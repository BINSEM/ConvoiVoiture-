import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE = path.join(process.cwd(), 'data', 'rbac_db.json');

export interface User {
  fullname: string;
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
  role: 'ADMIN' | 'ACCOUNTANT';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  actingUser: string;
  details: string;
}

export interface Session {
  token: string;
  username: string;
  expiresAt: number;
}

interface RbacSchema {
  users: User[];
  logs: AuditLog[];
  sessions: Session[];
}

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Hash password helper
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Generate secure salt
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Load and Save Database State
function loadDb(): RbacSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse rbac_db.json:', e);
    }
  }

  // default initial schema
  return {
    users: [],
    logs: [],
    sessions: []
  };
}

function saveDb(data: RbacSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write rbac_db.json:', e);
  }
}

// Initialize Database & Seed default users
export function initDatabase() {
  const db = loadDb();
  let modified = false;

  // 1. Seed admin: admin_auth / BIN@con125
  const adminExists = db.users.some(u => u.username === 'admin_auth');
  if (!adminExists) {
    const salt = generateSalt();
    const passwordHash = hashPassword('BIN@con125', salt);
    db.users.push({
      fullname: 'Administrateur',
      username: 'admin_auth',
      email: 'admin@convoypro.fr',
      salt,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false
    });
    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'USER_CREATION',
      actingUser: 'SYSTEM',
      details: 'Seeded default administrator account: admin_auth'
    });
    modified = true;
  }

  // 2. Seed/Force accountant: accountant / ACC@con125
  const accountantIndex = db.users.findIndex(u => u.username === 'accountant');
  const saltAcc = generateSalt();
  const passwordHashAcc = hashPassword('ACC@con125', saltAcc);
  
  if (accountantIndex === -1) {
    db.users.push({
      fullname: 'Expert Comptable',
      username: 'accountant',
      email: 'accountant@convoypro.fr',
      salt: saltAcc,
      passwordHash: passwordHashAcc,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
      mustChangePassword: false
    });
    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'USER_CREATION',
      actingUser: 'SYSTEM',
      details: 'Seeded default accountant account: accountant (ACC@con125)'
    });
    modified = true;
  } else {
    // Force reset to the user's requested password to ensure any old instances are updated
    db.users[accountantIndex].salt = saltAcc;
    db.users[accountantIndex].passwordHash = passwordHashAcc;
    db.users[accountantIndex].mustChangePassword = false;
    db.users[accountantIndex].status = 'ACTIVE';
    db.users[accountantIndex].role = 'ACCOUNTANT';
    modified = true;
  }

  if (modified) {
    saveDb(db);
  }
}

// DB APIs
export const DbService = {
  getUsers(): User[] {
    return loadDb().users;
  },

  getUserByUsername(username: string): User | undefined {
    return loadDb().users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  getUserByEmail(email: string): User | undefined {
    return loadDb().users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  createUser(user: Omit<User, 'salt' | 'passwordHash'>, rawPassword: string, actingUser: string): boolean {
    const db = loadDb();
    if (db.users.some(u => u.username.toLowerCase() === user.username.toLowerCase() || u.email.toLowerCase() === user.email.toLowerCase())) {
      return false; // Duplicate check
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(rawPassword, salt);
    const newUser: User = {
      ...user,
      salt,
      passwordHash
    };

    db.users.push(newUser);
    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'USER_CREATION',
      actingUser,
      details: `Created user ${user.username} (${user.fullname}) with role ${user.role}`
    });

    saveDb(db);
    return true;
  },

  updateUser(username: string, updates: Partial<Omit<User, 'username' | 'salt' | 'passwordHash'>>, actingUser: string): boolean {
    const db = loadDb();
    const index = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return false;

    const oldUser = db.users[index];
    
    // Log any role or status changes
    let changeDetails = [];
    if (updates.role && updates.role !== oldUser.role) {
      changeDetails.push(`role changed from ${oldUser.role} to ${updates.role}`);
      db.logs.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        event: 'ROLE_CHANGE',
        actingUser,
        details: `Updated role of ${username} from ${oldUser.role} to ${updates.role}`
      });
    }
    if (updates.status && updates.status !== oldUser.status) {
      changeDetails.push(`status changed from ${oldUser.status} to ${updates.status}`);
    }

    db.users[index] = {
      ...oldUser,
      ...updates
    };

    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'USER_MODIFICATION',
      actingUser,
      details: `Modified user ${username}: ${changeDetails.join(', ') || 'personal details updated'}`
    });

    saveDb(db);
    return true;
  },

  deleteUser(username: string, actingUser: string): boolean {
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (userIndex === -1) return false;

    // Do not allow deleting the seed admin admin_auth
    if (username.toLowerCase() === 'admin_auth') return false;

    db.users.splice(userIndex, 1);
    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'USER_DELETION',
      actingUser,
      details: `Deleted user: ${username}`
    });

    saveDb(db);
    return true;
  },

  resetUserPassword(username: string, newRawPassword: string, mustChange: boolean, actingUser: string): boolean {
    const db = loadDb();
    const index = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return false;

    const salt = generateSalt();
    const passwordHash = hashPassword(newRawPassword, salt);

    db.users[index].salt = salt;
    db.users[index].passwordHash = passwordHash;
    db.users[index].mustChangePassword = mustChange;

    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'PASSWORD_RESET',
      actingUser,
      details: `Reset password for user: ${username}${mustChange ? ' (force change on login activated)' : ''}`
    });

    saveDb(db);
    return true;
  },

  // Audit Logs retrieval
  getLogs(): AuditLog[] {
    return loadDb().logs.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
  },

  addLog(event: string, actingUser: string, details: string) {
    const db = loadDb();
    db.logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      actingUser,
      details
    });
    saveDb(db);
  },

  // Session Token Handling
  createSession(username: string): string {
    const db = loadDb();
    const token = crypto.randomBytes(32).toString('hex');
    // Session expires in 365 days (until manual sign out)
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;

    // Clean up older sessions for this user to avoid leak
    db.sessions = db.sessions.filter(s => s.username !== username && s.expiresAt > Date.now());

    db.sessions.push({
      token,
      username,
      expiresAt
    });

    saveDb(db);
    return token;
  },

  getSession(token: string): Session | undefined {
    const db = loadDb();
    const session = db.sessions.find(s => s.token === token);
    if (session && session.expiresAt > Date.now()) {
      return session;
    }
    return undefined;
  },

  deleteSession(token: string) {
    const db = loadDb();
    db.sessions = db.sessions.filter(s => s.token !== token);
    saveDb(db);
  }
};
