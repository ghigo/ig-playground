export interface IGProfile {
  username: string;
  fullName: string;
  followers: number;
  following: number;
  posts: number;
  bio: string;
  isVerified: boolean;
  isPrivate: boolean;
  profilePicUrl: string;
  externalUrl?: string;
  category?: string;
  isBusinessAccount: boolean;
  lastUpdated?: string; // ISO timestamp of when data was last fetched
  unfollowed?: boolean; // True if user no longer follows/is followed by this account
}

export interface Config {
  igUsername: string;
  igPassword: string;
  igHandle?: string; // Optional: Instagram handle (if different from username/email)
  outputFormat: 'csv' | 'google-sheets';
  googleSheetId?: string;
  googleServiceAccountKeyPath?: string;
  headless: boolean;
  scrapeDelay: number;
  cacheDays: number; // Number of days to cache profile data
}
