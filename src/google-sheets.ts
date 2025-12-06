import { google } from 'googleapis';
import { IGProfile } from './types';
import * as fs from 'fs';

export class GoogleSheetsService {
  private sheets;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(spreadsheetId: string, serviceAccountKeyPath: string, sheetName: string = 'Sheet1') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;

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
      // Check if spreadsheet exists and get sheet info
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      console.log(`Google Sheet found. Initializing sheet "${this.sheetName}"...`);

      // Check if the sheet with this name exists
      const sheetExists = response.data.sheets?.some(
        sheet => sheet.properties?.title === this.sheetName
      );

      if (!sheetExists) {
        // Create the sheet
        console.log(`   Creating new sheet: "${this.sheetName}"`);
        await this.createSheet();
      } else {
        console.log(`   Using existing sheet: "${this.sheetName}"`);
      }

      // Clear existing data and set headers
      await this.clearAndSetHeaders();
    } catch (error) {
      console.error('Error accessing Google Sheet:', error);
      throw new Error('Could not access Google Sheet. Make sure the service account has access to the sheet.');
    }
  }

  private async createSheet(): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: this.sheetName,
              },
            },
          },
        ],
      },
    });
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
      'Business Account',
      'Category',
      'External URL',
      'Profile URL',
      'Scraped At',
    ];

    // Get the sheet ID for the named sheet
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheet = response.data.sheets?.find(
      s => s.properties?.title === this.sheetName
    );

    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet "${this.sheetName}" not found`);
    }

    const sheetId = sheet.properties.sheetId;

    // Clear existing data
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:M`,
    });

    // Set headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1:M1`,
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
                sheetId: sheetId,
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

    console.log(`   Sheet "${this.sheetName}" headers initialized`);
  }

  async addProfile(profile: IGProfile): Promise<void> {
    const row = [
      profile.username,
      profile.fullName,
      profile.followers,
      profile.following,
      profile.posts,
      profile.bio,
      profile.isVerified ? 'Yes' : 'No',
      profile.isPrivate ? 'Yes' : 'No',
      profile.isBusinessAccount ? 'Yes' : 'No',
      profile.category || '',
      profile.externalUrl || '',
      `https://instagram.com/${profile.username}`,
      new Date().toISOString(),
    ];

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:M`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  }

  async addProfiles(profiles: IGProfile[]): Promise<void> {
    if (profiles.length === 0) return;

    const rows = profiles.map(profile => [
      profile.username,
      profile.fullName,
      profile.followers,
      profile.following,
      profile.posts,
      profile.bio,
      profile.isVerified ? 'Yes' : 'No',
      profile.isPrivate ? 'Yes' : 'No',
      profile.isBusinessAccount ? 'Yes' : 'No',
      profile.category || '',
      profile.externalUrl || '',
      `https://instagram.com/${profile.username}`,
      new Date().toISOString(),
    ]);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:M`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`   Added ${profiles.length} profiles to sheet "${this.sheetName}"`);
  }
}
