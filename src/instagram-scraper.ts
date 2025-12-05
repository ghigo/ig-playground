import puppeteer, { Browser, Page } from 'puppeteer';
import * as readline from 'readline';
import * as path from 'path';
import { IGProfile } from './types';

export class InstagramScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;

  constructor(private headless: boolean = false) {}

  async init(): Promise<void> {
    // Use a persistent user data directory to save session/cookies
    const userDataDir = path.join(process.cwd(), '.browser-data');

    this.browser = await puppeteer.launch({
      headless: this.headless,
      userDataDir, // This saves cookies and session data
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

    console.log('Checking if already logged in...');
    await this.page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
    });

    await this.delay(2000);

    // Check if we're already logged in by looking for common elements
    const isAlreadyLoggedIn = await this.checkIfLoggedIn();

    if (isAlreadyLoggedIn) {
      console.log('✓ Already logged in! Using saved session.');
      this.isLoggedIn = true;

      // Handle any dialogs that might appear
      await this.handleSaveLoginInfo();
      await this.handleNotifications();

      return;
    }

    console.log('Not logged in. Proceeding with login...');
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
    console.log('Waiting for page to fully load after 2FA...');
    await this.delay(5000);

    // Handle "Save Your Login Info?" dialog
    await this.handleSaveLoginInfo();

    // Handle "Turn on Notifications" dialog
    await this.handleNotifications();

    // Final wait to ensure we're fully logged in and all dialogs are handled
    console.log('Finalizing login...');
    await this.delay(3000);

    this.isLoggedIn = true;
    console.log('Successfully logged in!');
  }

  async getCurrentUsername(): Promise<string> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in');
    }

    try {
      console.log('   Method 1: Trying to extract from page data...');

      // Navigate to the home page
      await this.page.goto('https://www.instagram.com/', {
        waitUntil: 'networkidle2',
      });
      await this.delay(3000);

      // Method 1: Try to extract username from the page's JavaScript state
      try {
        const username = await this.page.evaluate(() => {
          // Instagram stores user data in window._sharedData or similar
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const content = script.textContent || '';

            // Look for username in various patterns
            const patterns = [
              /"username":"([^"]+)"/,
              /'username':'([^']+)'/,
              /viewerId.*?"username":"([^"]+)"/,
            ];

            for (const pattern of patterns) {
              const match = content.match(pattern);
              if (match && match[1]) {
                return match[1];
              }
            }
          }
          return null;
        });

        if (username) {
          console.log(`   ✓ Found username in page data: @${username}`);
          return username;
        }
      } catch (e) {
        console.log('   ✗ Method 1 failed');
      }

      // Method 2: Navigate to settings page and extract from URL or page
      console.log('   Method 2: Checking settings page...');
      try {
        await this.page.goto('https://www.instagram.com/accounts/edit/', {
          waitUntil: 'networkidle2',
        });
        await this.delay(2000);

        // Check the username input field on the edit profile page
        const usernameInput = await this.page.$('input[name="username"]');
        if (usernameInput) {
          const username = await usernameInput.evaluate(el => (el as HTMLInputElement).value);
          if (username) {
            console.log(`   ✓ Found username in settings: @${username}`);
            return username;
          }
        }
      } catch (e) {
        console.log('   ✗ Method 2 failed');
      }

      // Method 3: Look for profile link with specific aria-label
      console.log('   Method 3: Searching navigation for profile link...');
      try {
        await this.page.goto('https://www.instagram.com/', {
          waitUntil: 'networkidle2',
        });
        await this.delay(2000);

        // Try XPath to find profile link
        const profileLinkElements = await this.page.$x("//a[contains(@href, '/') and not(contains(@href, 'explore')) and not(contains(@href, 'reels')) and not(contains(@href, 'direct'))]");

        for (const element of profileLinkElements) {
          const href = await element.evaluate(el => (el as Element).getAttribute('href'));

          if (href && href.match(/^\/[a-zA-Z0-9._]+\/?$/)) {
            const username = href.replace(/\//g, '');

            if (username && username.length > 0 && username !== 'explore' && username !== 'reels' && username !== 'direct') {
              // Verify by visiting the profile
              await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2',
              });
              await this.delay(3000);

              // Look for edit profile button or text
              const isOwnProfile = await this.page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('edit profile') ||
                       document.querySelector('a[href="/accounts/edit/"]') !== null;
              });

              if (isOwnProfile) {
                console.log(`   ✓ Verified profile: @${username}`);
                return username;
              }
            }
          }
        }
      } catch (e) {
        console.log('   ✗ Method 3 failed');
      }

      throw new Error('Could not automatically detect Instagram username. Please add IG_HANDLE to your .env file.');
    } catch (error) {
      throw new Error(`Failed to detect Instagram username: ${error}. Please add IG_HANDLE to your .env file with your Instagram handle.`);
    }
  }

  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for elements that only appear when logged in
      // Look for the search bar, home icon, or user navigation
      const loggedInIndicators = await Promise.all([
        this.page.$('svg[aria-label="Home"]'),
        this.page.$('svg[aria-label="Search"]'),
        this.page.$('a[href^="/"][href$="/"]'), // Profile link
      ]);

      // If any of these elements exist, we're likely logged in
      const hasLoggedInElements = loggedInIndicators.some(el => el !== null);

      // Also check we're NOT on a login page
      const loginInput = await this.page.$('input[name="username"]');
      const isOnLoginPage = loginInput !== null;

      return hasLoggedInElements && !isOnLoginPage;
    } catch (error) {
      return false;
    }
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
      await this.delay(2000);

      // Check the "Save login info" checkbox if it exists
      try {
        console.log('Looking for "Save login info" checkbox...');
        const checkboxSelectors = [
          'input[type="checkbox"]',
          'input[name="saveBrowserToken"]',
        ];

        for (const selector of checkboxSelectors) {
          const checkbox = await this.page.$(selector);
          if (checkbox) {
            const isChecked = await checkbox.evaluate(el => (el as HTMLInputElement).checked);
            if (!isChecked) {
              console.log('Checking "Save login info" checkbox...');
              await checkbox.click();
              await this.delay(500);
            } else {
              console.log('"Save login info" checkbox already checked');
            }
            break;
          }
        }
      } catch (e) {
        console.log('No checkbox found or already checked');
      }

      // Prompt user for 2FA code
      const code = await this.prompt2FACode();

      console.log('Entering 2FA code...');
      // Clear the field first
      await this.page.click('input[name="verificationCode"]', { clickCount: 3 });
      await this.delay(500);

      // Enter 2FA code slowly so user can see it
      await this.page.type('input[name="verificationCode"]', code, { delay: 200 });
      await this.delay(2000);

      // Take screenshot before clicking button
      console.log('Taking screenshot before button click...');
      await this.page.screenshot({ path: 'debug-before-2fa-submit.png' });

      // Click confirm button - try multiple selectors
      console.log('Submitting 2FA code...');
      console.log('Current URL:', this.page.url());
      let buttonClicked = false;

      // First, try to find the SPECIFIC confirm/next button for 2FA using text content
      const xpathButtons = await this.page.$x("//button[contains(text(), 'Confirm') or contains(text(), 'confirm') or contains(text(), 'Next') or contains(text(), 'next')]");

      if (xpathButtons.length > 0) {
        console.log(`Found ${xpathButtons.length} button(s) with Confirm/Next text`);
        const button = xpathButtons[0] as any;

        // Get button text for debugging
        const buttonText = await button.evaluate((el: any) => el.textContent);
        console.log(`Clicking button with text: "${buttonText}"`);

        await button.click();
        buttonClicked = true;
        console.log('Clicked button using XPath (Confirm/Next)');
      }

      // If XPath didn't work, try CSS selectors
      if (!buttonClicked) {
        const buttonSelectors = [
          'button[type="submit"]',
          'button:not([type="button"])',
          'div[role="button"]',
        ];

        for (const selector of buttonSelectors) {
          try {
            const buttons = await this.page.$$(selector);
            if (buttons.length > 0) {
              console.log(`Found ${buttons.length} button(s) with selector: ${selector}`);
              // Click the first one
              await buttons[0].click();
              buttonClicked = true;
              console.log(`Clicked button using selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
      }

      // If still no button, try pressing Enter in the input field
      if (!buttonClicked) {
        console.log('No button found, pressing Enter in the input field...');
        await this.page.focus('input[name="verificationCode"]');
        await this.page.keyboard.press('Enter');
        buttonClicked = true;
      }

      // Wait a bit and take screenshot after clicking
      await this.delay(3000);
      console.log('Taking screenshot after button click...');
      await this.page.screenshot({ path: 'debug-after-2fa-submit.png' });
      console.log('Current URL after click:', this.page.url());

      // Check if we're still on the 2FA page
      const still2FA = await this.page.$('input[name="verificationCode"]');
      if (still2FA) {
        console.log('⚠️  Still on 2FA page! Button click may not have worked.');
        console.log('Screenshots saved: debug-before-2fa-submit.png and debug-after-2fa-submit.png');

        // Try pressing Enter as a last resort
        console.log('Trying Enter key as backup...');
        await this.page.focus('input[name="verificationCode"]');
        await this.page.keyboard.press('Enter');
        await this.delay(3000);
      }

      // Wait for navigation after 2FA - give it more time
      console.log('Waiting for 2FA verification and page load...');
      await this.delay(8000); // Increased from 5000

      console.log('2FA verification completed');
      console.log('Final URL:', this.page.url());
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
        const button = buttons[0] as any;
        await button.click();
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
        const button = buttons[0] as any;
        await button.click();
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

    // Check if we're still logged in after navigation
    console.log('Verifying login status...');
    const stillLoggedIn = await this.checkIfLoggedIn();

    if (!stillLoggedIn) {
      console.log('⚠️  Session lost after navigation! Taking screenshot...');
      await this.page.screenshot({ path: 'debug-session-lost.png' });

      throw new Error(
        'Session was lost after navigation. This can happen if:\n' +
        '  1. Instagram detected automation\n' +
        '  2. Cookies weren\'t saved properly\n' +
        '  3. The "Save login info" wasn\'t checked during 2FA\n\n' +
        'Try these fixes:\n' +
        '  1. Delete the .browser-data folder and try again\n' +
        '  2. Make sure you see "Checking Save login info checkbox" during 2FA\n' +
        '  3. Run with HEADLESS=false to watch what happens\n\n' +
        'Screenshot saved to debug-session-lost.png'
      );
    }

    console.log('✓ Still logged in');

    // Try to dismiss any lingering dialogs on the profile page
    try {
      const buttons = await this.page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'not now')]");
      if (buttons.length > 0) {
        console.log('Dismissing dialog on profile page...');
        const button = buttons[0] as any;
        await button.click();
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
      // Check one more time if we're logged in
      const finalLoginCheck = await this.checkIfLoggedIn();
      if (!finalLoginCheck) {
        throw new Error('Session was lost. You appear to be logged out. Delete .browser-data folder and try again.');
      }

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
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Prevent infinite loop

    while (stableCount < 10 && scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;

      // Extract usernames from the current view
      const currentFollowers = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('div[role="dialog"] a[href^="/"]'));
        return links
          .map(link => {
            const href = link.getAttribute('href');
            if (href && href.length > 1 && !href.includes('explore') && !href.includes('p/')) {
              const username = href.split('/')[1].split('?')[0];
              return username;
            }
            return null;
          })
          .filter((u): u is string => u !== null && u.length > 0 && u !== '');
      });

      currentFollowers.forEach(follower => followers.add(follower));

      // Scroll the dialog - try multiple methods
      const scrolled = await this.page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return false;

        // Try to find the scrollable element
        const scrollableSelectors = [
          'div[style*="overflow"]',
          'div > div > div:last-child',
          'div:has(> div > div > div)',
        ];

        for (const selector of scrollableSelectors) {
          const scrollableDiv = dialog.querySelector(selector);
          if (scrollableDiv) {
            const beforeScroll = scrollableDiv.scrollTop;
            scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
            return scrollableDiv.scrollTop !== beforeScroll; // Returns true if scrolled
          }
        }

        return false;
      });

      await this.delay(2000); // Increased delay for Instagram to load more

      // Check if we're still finding new followers
      if (followers.size === previousCount) {
        stableCount++;
      } else {
        stableCount = 0;
        previousCount = followers.size;
        console.log(`Found ${followers.size} followers so far...`);
      }

      // If we couldn't scroll, increase stable count
      if (!scrolled) {
        stableCount += 2;
      }
    }

    console.log(`Scroll complete. Total attempts: ${scrollAttempts}`);
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

        // Get full name - try multiple selectors
        let fullName = '';
        const fullNameSelectors = [
          'header section > div:first-child span',
          'header section span:not([class*="username"])',
          'section > div > div > span',
        ];

        for (const selector of fullNameSelectors) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && element.innerText && !element.innerText.includes('@')) {
            fullName = element.innerText.trim();
            break;
          }
        }

        // Get bio - try multiple approaches
        let bio = '';
        const bioSelectors = [
          'header section > div:last-child span',
          'section > div > div:last-child > span',
          'header section div._aa_c h1 + span',
        ];

        for (const selector of bioSelectors) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && element.innerText && !element.innerText.match(/^\d+$/)) {
            const text = element.innerText.trim();
            if (text.length > 0 && !text.includes('follower') && !text.includes('following')) {
              bio = text;
              break;
            }
          }
        }

        // Check if verified
        const isVerified = document.querySelector('svg[aria-label="Verified"]') !== null;

        // Check if private - check page text content
        const bodyText = document.body.innerText.toLowerCase();
        const isPrivate = bodyText.includes('this account is private') ||
                         bodyText.includes('this user is private');

        // Get profile pic
        const profilePic = document.querySelector('header img');
        const profilePicUrl = profilePic?.getAttribute('src') || '';

        // Get external URL (website link)
        let externalUrl = '';
        const linkElements = document.querySelectorAll('header a[href^="http"], header a[rel="me nofollow"]');
        for (const link of Array.from(linkElements)) {
          const href = link.getAttribute('href');
          if (href && !href.includes('instagram.com')) {
            externalUrl = href;
            break;
          }
        }

        // Get category (for business/creator accounts)
        let category = '';
        // Try to find category text in the header
        const headerElements = document.querySelectorAll('header section div, header section span');
        for (const element of Array.from(headerElements)) {
          const text = (element as HTMLElement).innerText || '';
          // Look for category-like text (usually short, capitalized, not numbers)
          if (text.length > 0 && text.length < 50 &&
              !text.includes('@') &&
              !text.match(/^\d+$/) &&
              !text.includes('follower') &&
              !text.includes('following') &&
              !text.includes('post')) {
            // Common business categories
            if (text.match(/entrepreneur|artist|musician|photographer|designer|business|creator|influencer|brand|company|restaurant|fitness|coach|consultant/i)) {
              category = text.trim();
              break;
            }
          }
        }

        // Check if business account
        const isBusinessAccount = bodyText.includes('contact') || bodyText.includes('email') || category.length > 0;

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
          externalUrl,
          category,
          isBusinessAccount,
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
        externalUrl: '',
        category: '',
        isBusinessAccount: false,
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
