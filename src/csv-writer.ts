import * as fs from 'fs';
import * as path from 'path';
import { IGProfile } from './types';

export class CSVWriter {
  private filePath: string;
  private writeStream: fs.WriteStream | null = null;

  constructor(filename: string = 'instagram_followers.csv') {
    // Save to 'output' folder in project root
    const outputDir = path.join(process.cwd(), 'output');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Add timestamp to filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const nameWithTimestamp = filename.replace('.csv', `_${timestamp}.csv`);

    this.filePath = path.join(outputDir, nameWithTimestamp);
  }

  async initialize(): Promise<void> {
    // Create write stream
    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'w' });

    // Write CSV headers
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

    this.writeStream.write(headers.join(',') + '\n');
    console.log(`CSV file created: ${this.filePath}`);
  }

  async addProfile(profile: IGProfile): Promise<void> {
    if (!this.writeStream) {
      throw new Error('CSV writer not initialized');
    }

    const row = [
      this.escapeCSV(profile.username),
      this.escapeCSV(profile.fullName),
      profile.followers,
      profile.following,
      profile.posts,
      this.escapeCSV(profile.bio),
      profile.isVerified ? 'Yes' : 'No',
      profile.isPrivate ? 'Yes' : 'No',
      `https://instagram.com/${profile.username}`,
      new Date().toISOString(),
    ];

    this.writeStream.write(row.join(',') + '\n');
  }

  async addProfiles(profiles: IGProfile[]): Promise<void> {
    for (const profile of profiles) {
      await this.addProfile(profile);
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.writeStream) {
        this.writeStream.end(() => {
          console.log(`\n✅ CSV file saved: ${this.filePath}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getFilePath(): string {
    return this.filePath;
  }

  private escapeCSV(value: string): string {
    if (!value) return '';

    // If the value contains comma, newline, or quote, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }
}
