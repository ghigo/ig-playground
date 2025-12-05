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
}
