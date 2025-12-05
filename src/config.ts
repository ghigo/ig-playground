import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export function getConfig(): Config {
  const igUsername = process.env.IG_USERNAME;
  const igPassword = process.env.IG_PASSWORD;
  const igHandle = process.env.IG_HANDLE; // Optional: if login uses email but handle is different
  const outputFormat = (process.env.OUTPUT_FORMAT || 'csv') as 'csv' | 'google-sheets';
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  const googleServiceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';

  if (!igUsername || !igPassword) {
    throw new Error('Instagram credentials not found in .env file');
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
    headless: process.env.HEADLESS === 'true',
    scrapeDelay: parseInt(process.env.SCRAPE_DELAY || '3000', 10),
  };
}
