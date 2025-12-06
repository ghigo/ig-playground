import dotenv from 'dotenv';
import { Config } from './types';
import { AccountManager } from './account-manager';

dotenv.config();

export function getConfig(accountUsername?: string): Config {
  const outputFormat = (process.env.OUTPUT_FORMAT || 'csv') as 'csv' | 'google-sheets';
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  const googleServiceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';
  const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  let igUsername: string;
  let igPassword: string;
  let igHandle: string | undefined;

  if (accountUsername) {
    // Load credentials from accounts.json
    const accountManager = new AccountManager();
    const account = accountManager.getAccount(accountUsername);

    if (!account) {
      throw new Error(
        `Account "${accountUsername}" not found in accounts.json\n` +
        `Available accounts: ${accountManager.getAllUsernames().join(', ') || 'none'}\n` +
        `Please add your account to accounts.json`
      );
    }

    igUsername = account.username;
    igPassword = account.password;
    igHandle = account.handle;
  } else {
    // Fallback to .env for backward compatibility
    igUsername = process.env.IG_USERNAME || '';
    igPassword = process.env.IG_PASSWORD || '';
    igHandle = process.env.IG_HANDLE;

    if (!igUsername || !igPassword) {
      throw new Error(
        'Instagram credentials not found.\n' +
        'Either:\n' +
        '  1. Provide an account username (npm start username)\n' +
        '  2. Or set IG_USERNAME and IG_PASSWORD in .env file'
      );
    }
  }

  // Only require Google Sheets config if that output format is selected
  if (outputFormat === 'google-sheets' && !googleSheetId) {
    throw new Error('Google Sheet ID is required when OUTPUT_FORMAT=google-sheets');
  }

  return {
    igUsername,
    igPassword,
    igHandle,
    outputFormat,
    googleSheetId,
    googleServiceAccountKeyPath,
    googleDriveFolderId,
    headless: process.env.HEADLESS === 'true',
    scrapeDelay: parseInt(process.env.SCRAPE_DELAY || '3000', 10),
    cacheDays: parseInt(process.env.CACHE_DAYS || '10', 10),
  };
}
