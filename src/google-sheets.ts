import { google } from 'googleapis';
import { IGProfile } from './types';
import * as fs from 'fs';

export class GoogleSheetsService {
  private sheets;
  private spreadsheetId: string;
  private sheetName: string;
  private profileMap: Map<string, IGProfile & { rowIndex: number }>;

  constructor(spreadsheetId: string, serviceAccountKeyPath: string, sheetName: string = 'Sheet1') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.profileMap = new Map();

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

  async initializeSheet(shouldClear: boolean = true): Promise<void> {
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

      if (shouldClear) {
        // Clear existing data and set headers (for fresh import)
        await this.clearAndSetHeaders();
      } else {
        // Load existing data (for updates)
        await this.loadExistingData();
      }
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
      'Last Updated',
      'Unfollowed',
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
      range: `${this.sheetName}!A:O`,
    });

    // Set headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1:O1`,
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

  /**
   * Load existing data from the sheet
   */
  private async loadExistingData(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:O`,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        console.log('   No existing data found in sheet');
        return;
      }

      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || !row[0]) continue;

        const profile: IGProfile = {
          username: row[0] || '',
          fullName: row[1] || '',
          followers: parseInt(row[2]) || 0,
          following: parseInt(row[3]) || 0,
          posts: parseInt(row[4]) || 0,
          bio: row[5] || '',
          isVerified: row[6] === 'Yes' || row[6] === 'true',
          isPrivate: row[7] === 'Yes' || row[7] === 'true',
          isBusinessAccount: row[8] === 'Yes' || row[8] === 'true',
          category: row[9] || undefined,
          externalUrl: row[10] || undefined,
          profilePicUrl: '', // Not stored in sheets
          lastUpdated: row[13] || undefined,
          unfollowed: row[14] === 'true' || row[14] === 'Yes',
        };

        this.profileMap.set(profile.username, {
          ...profile,
          rowIndex: i + 1, // 1-indexed for Sheets API
        });
      }

      console.log(`   Loaded ${this.profileMap.size} existing profiles from sheet`);
    } catch (error) {
      console.log('   No existing data found in sheet');
    }
  }

  /**
   * Check if a profile needs to be updated based on cache duration
   */
  shouldUpdate(username: string, cacheDays: number): boolean {
    const existing = this.profileMap.get(username);

    if (!existing) {
      return true; // New profile, needs fetching
    }

    if (!existing.lastUpdated) {
      return true; // No timestamp, needs updating
    }

    if (existing.unfollowed) {
      return true; // Unfollowed profile, needs checking if they're back
    }

    const lastUpdated = new Date(existing.lastUpdated);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceUpdate >= cacheDays;
  }

  /**
   * Get an existing profile from cache
   */
  get(username: string): IGProfile | undefined {
    const data = this.profileMap.get(username);
    if (!data) return undefined;

    const { rowIndex, ...profile } = data;
    return profile;
  }

  /**
   * Update or insert a profile
   */
  async upsert(profile: IGProfile): Promise<void> {
    const existing = this.profileMap.get(profile.username);
    const now = new Date().toISOString();

    const updatedProfile = {
      ...profile,
      lastUpdated: now,
      unfollowed: false, // They're in the current list, so not unfollowed
    };

    if (existing) {
      // Update existing row
      await this.updateRow(existing.rowIndex, updatedProfile);
      this.profileMap.set(profile.username, {
        ...updatedProfile,
        rowIndex: existing.rowIndex,
      });
    } else {
      // Append new row
      const newRowIndex = this.profileMap.size + 2; // +1 for header, +1 for 1-indexing
      await this.appendRow(updatedProfile);
      this.profileMap.set(profile.username, {
        ...updatedProfile,
        rowIndex: newRowIndex,
      });
    }
  }

  /**
   * Add placeholder entries for usernames that don't exist yet
   */
  async addPlaceholders(usernames: string[]): Promise<number> {
    let addedCount = 0;
    const placeholders: IGProfile[] = [];

    for (const username of usernames) {
      if (!this.profileMap.has(username)) {
        const placeholder: IGProfile = {
          username,
          fullName: '',
          followers: 0,
          following: 0,
          posts: 0,
          bio: '',
          isVerified: false,
          isPrivate: false,
          isBusinessAccount: false,
          category: undefined,
          externalUrl: undefined,
          profilePicUrl: '',
          lastUpdated: undefined,
          unfollowed: false,
        };
        placeholders.push(placeholder);

        const newRowIndex = this.profileMap.size + placeholders.length + 1; // +1 for header
        this.profileMap.set(username, {
          ...placeholder,
          rowIndex: newRowIndex,
        });
        addedCount++;
      }
    }

    if (placeholders.length > 0) {
      await this.appendRows(placeholders);
    }

    return addedCount;
  }

  /**
   * Mark users as unfollowed if they're not in the current follower list
   */
  async markUnfollowed(currentUsernames: string[]): Promise<number> {
    const currentSet = new Set(currentUsernames);
    let markedCount = 0;
    const updates: Array<{ username: string; rowIndex: number }> = [];

    for (const [username, data] of this.profileMap.entries()) {
      if (!currentSet.has(username) && !data.unfollowed) {
        data.unfollowed = true;
        updates.push({ username, rowIndex: data.rowIndex });
        markedCount++;
      } else if (currentSet.has(username) && data.unfollowed) {
        data.unfollowed = false;
        updates.push({ username, rowIndex: data.rowIndex });
      }
    }

    // Batch update unfollowed status
    if (updates.length > 0) {
      await this.batchUpdateUnfollowedColumn(updates);
    }

    return markedCount;
  }

  /**
   * Get list of active follower usernames (not unfollowed)
   */
  getActiveFollowers(): string[] {
    return Array.from(this.profileMap.values())
      .filter(p => !p.unfollowed)
      .map(p => p.username);
  }

  /**
   * Get all follower usernames (including unfollowed)
   */
  getAllFollowers(): string[] {
    return Array.from(this.profileMap.keys());
  }

  /**
   * Get statistics about the database
   */
  getStats(): { total: number; active: number; unfollowed: number } {
    const profiles = Array.from(this.profileMap.values());
    return {
      total: profiles.length,
      active: profiles.filter(p => !p.unfollowed).length,
      unfollowed: profiles.filter(p => p.unfollowed).length,
    };
  }

  /**
   * Update a single row in the sheet
   */
  private async updateRow(rowIndex: number, profile: IGProfile): Promise<void> {
    const row = this.profileToRow(profile);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A${rowIndex}:O${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  }

  /**
   * Append a single row to the sheet
   */
  private async appendRow(profile: IGProfile): Promise<void> {
    const row = this.profileToRow(profile);
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:O`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  }

  /**
   * Append multiple rows to the sheet
   */
  private async appendRows(profiles: IGProfile[]): Promise<void> {
    if (profiles.length === 0) return;

    const rows = profiles.map(p => this.profileToRow(p));
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:O`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
  }

  /**
   * Batch update unfollowed column
   */
  private async batchUpdateUnfollowedColumn(updates: Array<{ username: string; rowIndex: number }>): Promise<void> {
    const data = updates.map(update => {
      const profile = this.profileMap.get(update.username);
      return {
        range: `${this.sheetName}!O${update.rowIndex}`,
        values: [[profile?.unfollowed ? 'true' : 'false']],
      };
    });

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data,
      },
    });
  }

  /**
   * Convert IGProfile to sheet row format
   */
  private profileToRow(profile: IGProfile): any[] {
    return [
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
      profile.lastUpdated || '',
      profile.lastUpdated || '',
      profile.unfollowed ? 'true' : 'false',
    ];
  }

}
