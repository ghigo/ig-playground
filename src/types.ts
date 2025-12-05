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
}

export interface Config {
  igUsername: string;
  igPassword: string;
  googleSheetId: string;
  googleServiceAccountKeyPath: string;
  headless: boolean;
  scrapeDelay: number;
}
