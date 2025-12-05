import puppeteer, { Browser, Page } from 'puppeteer';
import * as readline from 'readline';
import { IGProfile } from './types';

export class InstagramScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;

  constructor(private headless: boolean = false) {}

  async init(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();

    // Set a realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport
    await this.page.setViewport({ width: 1280, height: 800 });
  }

  async login(username: string, password: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    console.log('Navigating to Instagram login page...');
    await this.page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
    });

    // Wait for login form
    await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });

    // Random delay to mimic human behavior
    await this.delay(1000 + Math.random() * 1000);

    // Enter credentials
    console.log('Entering credentials...');
    await this.page.type('input[name="username"]', username, { delay: 100 });
    await this.delay(500 + Math.random() * 500);
    await this.page.type('input[name="password"]', password, { delay: 100 });
    await this.delay(1000);

    // Click login button
    console.log('Clicking login button...');
    await this.page.click('button[type="submit"]');

    // Wait for navigation or 2FA prompt
    await this.delay(5000);

    // Check if 2FA is required (check multiple times to be sure)
    let is2FARequired = await this.check2FARequired();

    if (!is2FARequired) {
      // Wait a bit more and check again
      await this.delay(2000);
      is2FARequired = await this.check2FARequired();
    }

    if (is2FARequired) {
      console.log('\n⚠️  2FA REQUIRED ⚠️');
      console.log('The browser window will stay open.');
      console.log('Please check your authenticator app and enter the code below.\n');
      await this.handle2FA();
    }

    // Extra wait after 2FA to ensure page loads
    await this.delay(3000);

    // Handle "Save Your Login Info?" dialog
    await this.handleSaveLoginInfo();

    // Handle "Turn on Notifications" dialog
    await this.handleNotifications();

    // Final wait to ensure we're fully logged in
    await this.delay(2000);

    this.isLoggedIn = true;
    console.log('Successfully logged in!');
  }

  private async check2FARequired(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for 2FA input field
      const twoFactorInput = await this.page.$('input[name="verificationCode"]');
      return twoFactorInput !== null;
    } catch (error) {
      return false;
    }
  }

  private async handle2FA(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for 2FA code input field to appear
      console.log('Waiting for 2FA input field...');
      await this.page.waitForSelector('input[name="verificationCode"]', { timeout: 60000 });

      // Give user time to see the screen
      await this.delay(1000);

      // Prompt user for 2FA code
      const code = await this.prompt2FACode();

      console.log('Entering 2FA code...');
      // Clear the field first
      await this.page.click('input[name="verificationCode"]', { clickCount: 3 });

      // Enter 2FA code
      await this.page.type('input[name="verificationCode"]', code, { delay: 150 });
      await this.delay(1500);

      // Click confirm button
      console.log('Submitting 2FA code...');
      await this.page.click('button[type="submit"]');

      // Wait for navigation after 2FA
      console.log('Waiting for 2FA verification...');
      await this.delay(5000);

      console.log('2FA verification completed');
    } catch (error) {
      console.error('Error during 2FA handling:', error);
      throw error;
    }
  }

  private prompt2FACode(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('Enter your 2FA code: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private async handleSaveLoginInfo(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait a bit for the dialog to appear
      await this.delay(3000);

      // Try to find and click "Not Now" button using XPath (works with Puppeteer)
      const buttons = await this.page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'not now') or contains(text(), 'Not now')]");

      if (buttons.length > 0) {
        console.log('Dismissing "Save Login Info" dialog...');
        await buttons[0].click();
        await this.delay(2000);
      }
    } catch (error) {
      // Dialog might not appear, continue
      console.log('No "Save Login Info" dialog found, continuing...');
    }
  }

  private async handleNotifications(): Promise<void> {
    if (!this.page) return;

    try {
      await this.delay(3000);

      // Try to find and click "Not Now" button for notifications
      const buttons = await this.page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'not now') or contains(text(), 'Not now')]");

      if (buttons.length > 0) {
        console.log('Dismissing notifications dialog...');
        await buttons[0].click();
        await this.delay(2000);
      }
    } catch (error) {
      // Dialog might not appear, continue
      console.log('No notifications dialog found, continuing...');
    }
  }

  async getFollowersList(username: string): Promise<string[]> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    console.log(`Navigating to ${username}'s profile...`);
    await this.page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await this.delay(3000);

    // Try to dismiss any lingering dialogs on the profile page
    try {
      const buttons = await this.page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'not now')]");
      if (buttons.length > 0) {
        console.log('Dismissing dialog on profile page...');
        await buttons[0].click();
        await this.delay(2000);
      }
    } catch (error) {
      // No dialog, continue
    }

    // Click on followers link
    console.log('Looking for followers link...');
    let followersLink = await this.page.$('a[href*="/followers/"]');

    // If not found, wait a bit and try again
    if (!followersLink) {
      console.log('Followers link not found, waiting and retrying...');
      await this.delay(3000);
      followersLink = await this.page.$('a[href*="/followers/"]');
    }

    if (!followersLink) {
      // Take a screenshot for debugging
      console.log('Taking screenshot for debugging...');
      await this.page.screenshot({ path: 'debug-profile.png' });
      throw new Error('Could not find followers link. Profile might be private or Instagram UI has changed. Screenshot saved to debug-profile.png');
    }

    console.log('Opening followers list...');
    await followersLink.click();
    await this.delay(3000);

    // Wait for followers dialog to appear
    await this.page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

    console.log('Scrolling through followers list...');
    const followers = await this.scrollAndCollectFollowers();

    console.log(`Collected ${followers.length} followers`);
    return followers;
  }

  private async scrollAndCollectFollowers(): Promise<string[]> {
    if (!this.page) return [];

    const followers = new Set<string>();
    let previousCount = 0;
    let stableCount = 0;

    // Find the scrollable container
    const dialogSelector = 'div[role="dialog"] div';

    while (stableCount < 5) {
      // Extract usernames from the current view
      const currentFollowers = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('div[role="dialog"] a[href^="/"]'));
        return links
          .map(link => {
            const href = link.getAttribute('href');
            if (href && href.length > 1 && !href.includes('explore')) {
              const username = href.split('/')[1].split('?')[0];
              return username;
            }
            return null;
          })
          .filter((u): u is string => u !== null && u.length > 0);
      });

      currentFollowers.forEach(follower => followers.add(follower));

      // Scroll the dialog
      await this.page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (dialog) {
          const scrollableDiv = dialog.querySelector('div > div > div:last-child');
          if (scrollableDiv) {
            scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
          }
        }
      });

      await this.delay(1500);

      // Check if we're still finding new followers
      if (followers.size === previousCount) {
        stableCount++;
      } else {
        stableCount = 0;
        previousCount = followers.size;
        console.log(`Found ${followers.size} followers so far...`);
      }
    }

    return Array.from(followers);
  }

  async getProfileInfo(username: string): Promise<IGProfile> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    console.log(`Fetching profile info for @${username}...`);

    try {
      await this.page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await this.delay(2000);

      // Extract profile information
      const profileInfo = await this.page.evaluate(() => {
        // Try to get data from meta tags or page content
        const getMetaContent = (property: string): string => {
          const meta = document.querySelector(`meta[property="${property}"]`);
          return meta?.getAttribute('content') || '';
        };

        // Get username from URL or page
        const usernameElement = document.querySelector('header h2') as HTMLElement;
        const username = usernameElement?.innerText || '';

        // Get stats (followers, following, posts)
        const statElements = document.querySelectorAll('header section ul li');
        let posts = 0, followers = 0, following = 0;

        statElements.forEach((stat, index) => {
          const text = (stat as HTMLElement).innerText;
          const count = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;

          if (index === 0) posts = count;
          if (index === 1) followers = count;
          if (index === 2) following = count;
        });

        // Alternative method to get stats
        if (posts === 0 && followers === 0 && following === 0) {
          const links = document.querySelectorAll('header section ul li a, header section ul li span');
          links.forEach((link) => {
            const text = (link as HTMLElement).innerText.toLowerCase();
            const titleAttr = link.getAttribute('title');

            if (text.includes('post') || titleAttr?.includes('post')) {
              posts = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
            } else if (text.includes('follower') || titleAttr?.includes('follower')) {
              followers = parseInt((titleAttr || text).replace(/[^0-9]/g, ''), 10) || 0;
            } else if (text.includes('following') || titleAttr?.includes('following')) {
              following = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
            }
          });
        }

        // Get full name
        const fullNameElement = document.querySelector('header section div span') as HTMLElement;
        const fullName = fullNameElement?.innerText || '';

        // Get bio
        const bioElement = document.querySelector('header section div._aa_c h1 + span, header section div._aa_c h1 + div') as HTMLElement;
        const bio = bioElement?.innerText || '';

        // Check if verified
        const isVerified = document.querySelector('svg[aria-label="Verified"]') !== null;

        // Check if private
        const isPrivate = document.querySelector('h2:has-text("This Account is Private"), article:has-text("This Account is Private")') !== null;

        // Get profile pic
        const profilePic = document.querySelector('header img');
        const profilePicUrl = profilePic?.getAttribute('src') || '';

        return {
          username,
          fullName,
          followers,
          following,
          posts,
          bio,
          isVerified,
          isPrivate,
          profilePicUrl,
        };
      });

      return profileInfo as IGProfile;
    } catch (error) {
      console.error(`Error fetching profile for @${username}:`, error);

      // Return minimal profile info on error
      return {
        username,
        fullName: '',
        followers: 0,
        following: 0,
        posts: 0,
        bio: '',
        isVerified: false,
        isPrivate: false,
        profilePicUrl: '',
      };
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
