import * as fs from 'fs';
import * as path from 'path';

export interface AccountCredentials {
  username: string;
  password: string;
  handle?: string; // Optional: if different from username
}

export class AccountManager {
  private accountsFilePath: string;
  private accounts: Map<string, AccountCredentials>;

  constructor(accountsFilePath: string = './accounts.json') {
    this.accountsFilePath = accountsFilePath;
    this.accounts = new Map();
    this.loadAccounts();
  }

  /**
   * Load accounts from JSON file
   */
  private loadAccounts(): void {
    if (!fs.existsSync(this.accountsFilePath)) {
      console.log(`⚠️  No accounts file found at ${this.accountsFilePath}`);
      console.log('   Create accounts.json with your Instagram credentials');
      return;
    }

    try {
      const data = fs.readFileSync(this.accountsFilePath, 'utf-8');
      const accountsData = JSON.parse(data);

      for (const [username, credentials] of Object.entries(accountsData)) {
        this.accounts.set(username, credentials as AccountCredentials);
      }

      console.log(`✓ Loaded ${this.accounts.size} account(s) from ${this.accountsFilePath}`);
    } catch (error) {
      throw new Error(`Failed to load accounts file: ${(error as Error).message}`);
    }
  }

  /**
   * Get credentials for a specific account
   */
  getAccount(username: string): AccountCredentials | undefined {
    return this.accounts.get(username);
  }

  /**
   * Check if an account exists
   */
  hasAccount(username: string): boolean {
    return this.accounts.has(username);
  }

  /**
   * Get all account usernames
   */
  getAllUsernames(): string[] {
    return Array.from(this.accounts.keys());
  }

  /**
   * Get the session file path for an account
   */
  getSessionPath(username: string): string {
    const sessionsDir = path.join(process.cwd(), 'sessions');

    // Create sessions directory if it doesn't exist
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    return path.join(sessionsDir, `${username}.json`);
  }
}
