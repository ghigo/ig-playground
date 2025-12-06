import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export class GoogleDriveService {
  private drive: any;
  private folderId: string;

  constructor(folderId: string, serviceAccountKeyPath: string) {
    this.folderId = folderId;

    // Load service account credentials
    const keyFile = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf-8'));

    // Create JWT client
    const auth = new google.auth.JWT(
      keyFile.client_email,
      undefined,
      keyFile.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * List all JSON files in the configured folder
   */
  async listJsonFiles(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and (name contains '.json') and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'name',
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Failed to list files from Google Drive: ${(error as Error).message}`);
    }
  }

  /**
   * Download a file by ID and return its contents as a string
   */
  async downloadFile(fileId: string): Promise<string> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to download file from Google Drive: ${(error as Error).message}`);
    }
  }

  /**
   * Find files matching a pattern (e.g., "followers_*.json")
   * Returns files sorted by name
   */
  async findFiles(pattern: string): Promise<Array<{ id: string; name: string }>> {
    try {
      // Convert simple pattern to regex
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);

      const allFiles = await this.listJsonFiles();
      const matchingFiles = allFiles.filter(file => regex.test(file.name));

      // Sort by name to ensure consistent ordering (e.g., followers_1, followers_2, etc.)
      return matchingFiles.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(`Failed to find files matching pattern "${pattern}": ${(error as Error).message}`);
    }
  }

  /**
   * Download and parse all files matching a pattern
   * Returns combined data from all matched files
   */
  async downloadAndParseFiles(pattern: string): Promise<any[]> {
    const files = await this.findFiles(pattern);

    if (files.length === 0) {
      throw new Error(`No files found matching pattern: ${pattern}`);
    }

    console.log(`✓ Found ${files.length} file(s) in Google Drive:`);
    files.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file.name}`);
    });
    console.log();

    let allData: any[] = [];

    for (const file of files) {
      console.log(`📥 Downloading ${file.name}...`);
      const content = await this.downloadFile(file.id);
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        allData = allData.concat(data);
      } else {
        allData.push(data);
      }
    }

    return allData;
  }

  /**
   * Get the folder ID being used
   */
  getFolderId(): string {
    return this.folderId;
  }
}
