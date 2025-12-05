import { google } from 'googleapis';
import { IGProfile } from './types';
import * as fs from 'fs';

export class GoogleSheetsService {
  private sheets;
  private spreadsheetId: string;

  constructor(spreadsheetId: string, serviceAccountKeyPath: string) {
    this.spreadsheetId = spreadsheetId;

    // Load service account credentials
    if (!fs.existsSync(serviceAccountKeyPath)) {
      throw new Error(`Service account key file not found at: ${serviceAccountKeyPath}`);
    }

    const credentials = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async initializeSheet(): Promise<void> {
    try {
      // Check if sheet exists
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      console.log('Google Sheet found. Initializing...');

      // Clear existing data and set headers
      await this.clearAndSetHeaders();
    } catch (error) {
      console.error('Error accessing Google Sheet:', error);
      throw new Error('Could not access Google Sheet. Make sure the service account has access to the sheet.');
    }
  }

  private async clearAndSetHeaders(): Promise<void> {
    const headers = [
      'Username',
      'Full Name',
      'Followers',
      'Following',
      'Posts',
      'Bio',
      'Verified',
      'Private',
      'Profile URL',
      'Scraped At',
    ];

    // Get the sheet name (default to first sheet)
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheetName = response.data.sheets?.[0]?.properties?.title || 'Sheet1';

    // Clear existing data
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:J`,
    });

    // Set headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    // Format headers (bold)
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: response.data.sheets?.[0]?.properties?.sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      },
    });

    console.log('Sheet headers initialized');
  }

  async addProfile(profile: IGProfile): Promise<void> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheetName = response.data.sheets?.[0]?.properties?.title || 'Sheet1';

    const row = [
      profile.username,
      profile.fullName,
      profile.followers,
      profile.following,
      profile.posts,
      profile.bio,
      profile.isVerified ? 'Yes' : 'No',
      profile.isPrivate ? 'Yes' : 'No',
      `https://instagram.com/${profile.username}`,
      new Date().toISOString(),
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  }

  async addProfiles(profiles: IGProfile[]): Promise<void> {
    if (profiles.length === 0) return;

    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheetName = response.data.sheets?.[0]?.properties?.title || 'Sheet1';

    const rows = profiles.map(profile => [
      profile.username,
      profile.fullName,
      profile.followers,
      profile.following,
      profile.posts,
      profile.bio,
      profile.isVerified ? 'Yes' : 'No',
      profile.isPrivate ? 'Yes' : 'No',
      `https://instagram.com/${profile.username}`,
      new Date().toISOString(),
    ]);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`Added ${profiles.length} profiles to Google Sheet`);
  }
}
