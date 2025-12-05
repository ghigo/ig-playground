import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export function getConfig(): Config {
  const igUsername = process.env.IG_USERNAME;
  const igPassword = process.env.IG_PASSWORD;
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  const googleServiceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';

  if (!igUsername || !igPassword) {
    throw new Error('Instagram credentials not found in .env file');
  }

  if (!googleSheetId) {
    throw new Error('Google Sheet ID not found in .env file');
  }

  return {
    igUsername,
    igPassword,
    googleSheetId,
    googleServiceAccountKeyPath,
    headless: process.env.HEADLESS === 'true',
    scrapeDelay: parseInt(process.env.SCRAPE_DELAY || '3000', 10),
  };
}
