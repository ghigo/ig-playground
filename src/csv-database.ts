import * as fs from 'fs';
import * as path from 'path';
import { IGProfile } from './types';

export class CSVDatabase {
  private filePath: string;
  private profileMap: Map<string, IGProfile>;

  constructor(filename: string = 'instagram_followers.csv') {
    const outputDir = path.join(process.cwd(), 'output');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.filePath = path.join(outputDir, filename);
    this.profileMap = new Map();
  }

  /**
   * Load existing data from CSV file
   */
  async load(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      console.log('   No existing database found, will create new file');
      return;
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length <= 1) {
      console.log('   Existing database is empty');
      return;
    }

    // Skip header line
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      const profile = this.parseCSVLine(line);
      if (profile) {
        this.profileMap.set(profile.username, profile);
      }
    }

    console.log(`   Loaded ${this.profileMap.size} existing profiles from database`);
  }

  /**
   * Parse a CSV line into an IGProfile object
   */
  private parseCSVLine(line: string): IGProfile | null {
    // CSV format: Username,Full Name,Followers,Following,Posts,Bio,Verified,Private,Business Account,Category,External URL,Profile URL,Scraped At,Last Updated,Unfollowed
    const parts = this.parseCSVRow(line);

    if (parts.length < 13) {
      return null;
    }

    return {
      username: parts[0],
      fullName: parts[1],
      followers: parseInt(parts[2]) || 0,
      following: parseInt(parts[3]) || 0,
      posts: parseInt(parts[4]) || 0,
      bio: parts[5],
      isVerified: parts[6] === 'true',
      isPrivate: parts[7] === 'true',
      isBusinessAccount: parts[8] === 'true',
      category: parts[9] || undefined,
      externalUrl: parts[10] || undefined,
      profilePicUrl: parts[11],
      lastUpdated: parts[13] || parts[12], // Use Last Updated if available, otherwise Scraped At
      unfollowed: parts[14] === 'true',
    };
  }

  /**
   * Parse a CSV row handling quoted fields
   */
  private parseCSVRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle escaped quotes
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
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
    return this.profileMap.get(username);
  }

  /**
   * Update or insert a profile
   */
  upsert(profile: IGProfile): void {
    this.profileMap.set(profile.username, {
      ...profile,
      lastUpdated: new Date().toISOString(),
      unfollowed: false, // They're in the current list, so not unfollowed
    });
  }

  /**
   * Mark users as unfollowed if they're not in the current follower list
   */
  markUnfollowed(currentUsernames: string[]): number {
    const currentSet = new Set(currentUsernames);
    let markedCount = 0;

    for (const [username, profile] of this.profileMap.entries()) {
      // If profile is not in current list and not already marked as unfollowed
      if (!currentSet.has(username) && !profile.unfollowed) {
        profile.unfollowed = true;
        markedCount++;
      }
      // If profile is back in the list, unmark them
      else if (currentSet.has(username) && profile.unfollowed) {
        profile.unfollowed = false;
      }
    }

    return markedCount;
  }

  /**
   * Save all profiles to CSV file
   */
  async save(): Promise<void> {
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
      'Unfollowed'
    ];

    const rows: string[] = [headers.join(',')];

    // Sort by unfollowed status (active followers first) then by username
    const profiles = Array.from(this.profileMap.values()).sort((a, b) => {
      if (a.unfollowed !== b.unfollowed) {
        return a.unfollowed ? 1 : -1;
      }
      return a.username.localeCompare(b.username);
    });

    for (const profile of profiles) {
      const row = [
        this.escapeCSV(profile.username),
        this.escapeCSV(profile.fullName),
        profile.followers.toString(),
        profile.following.toString(),
        profile.posts.toString(),
        this.escapeCSV(profile.bio),
        profile.isVerified.toString(),
        profile.isPrivate.toString(),
        profile.isBusinessAccount.toString(),
        this.escapeCSV(profile.category || ''),
        this.escapeCSV(profile.externalUrl || ''),
        this.escapeCSV(`https://instagram.com/${profile.username}`),
        this.escapeCSV(profile.lastUpdated || new Date().toISOString()),
        this.escapeCSV(profile.lastUpdated || new Date().toISOString()),
        (profile.unfollowed || false).toString()
      ];

      rows.push(row.join(','));
    }

    fs.writeFileSync(this.filePath, rows.join('\n'), 'utf-8');
  }

  /**
   * Escape special characters in CSV fields
   */
  private escapeCSV(value: string): string {
    if (!value) return '';

    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Get the file path of the database
   */
  getFilePath(): string {
    return this.filePath;
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
}
