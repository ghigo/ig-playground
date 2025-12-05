import { InstagramScraper } from './instagram-scraper';
import { GoogleSheetsService } from './google-sheets';
import { getConfig } from './config';
import { IGProfile } from './types';

async function main() {
  console.log('🚀 Instagram Follower Scraper Starting...\n');

  try {
    // Load configuration
    const config = getConfig();
    console.log(`📋 Configuration loaded`);
    console.log(`   Instagram Account: ${config.igUsername}`);
    console.log(`   Google Sheet ID: ${config.googleSheetId}`);
    console.log(`   Headless Mode: ${config.headless}`);
    console.log(`   Scrape Delay: ${config.scrapeDelay}ms\n`);

    // Initialize Google Sheets
    console.log('📊 Initializing Google Sheets...');
    const sheetsService = new GoogleSheetsService(
      config.googleSheetId,
      config.googleServiceAccountKeyPath
    );
    await sheetsService.initializeSheet();
    console.log('✓ Google Sheets initialized\n');

    // Initialize Instagram Scraper
    console.log('🌐 Initializing Instagram Scraper...');
    const scraper = new InstagramScraper(config.headless);
    await scraper.init();
    console.log('✓ Browser initialized\n');

    // Login to Instagram
    console.log('🔐 Logging into Instagram...');
    await scraper.login(config.igUsername, config.igPassword);
    console.log('✓ Successfully logged in\n');

    // Get followers list
    console.log('👥 Fetching followers list...');
    const followers = await scraper.getFollowersList(config.igUsername);
    console.log(`✓ Found ${followers.length} followers\n`);

    if (followers.length === 0) {
      console.log('⚠️  No followers found. Exiting...');
      await scraper.close();
      return;
    }

    // Scrape profile information for each follower
    console.log(`📝 Scraping profile information for ${followers.length} followers...`);
    console.log('   This may take a while...\n');

    const profiles: IGProfile[] = [];
    const batchSize = 10; // Save to sheet every 10 profiles

    for (let i = 0; i < followers.length; i++) {
      const username = followers[i];
      const progress = `[${i + 1}/${followers.length}]`;

      try {
        console.log(`${progress} Scraping @${username}...`);
        const profile = await scraper.getProfileInfo(username);
        profiles.push(profile);

        // Display quick stats
        console.log(`   → ${profile.fullName || 'N/A'} | Followers: ${profile.followers} | Following: ${profile.following} | Posts: ${profile.posts}`);

        // Save to Google Sheets in batches
        if (profiles.length >= batchSize) {
          await sheetsService.addProfiles(profiles);
          console.log(`   ✓ Saved batch of ${profiles.length} profiles to Google Sheets\n`);
          profiles.length = 0; // Clear array
        }

        // Delay to avoid rate limiting
        if (i < followers.length - 1) {
          await delay(config.scrapeDelay);
        }
      } catch (error) {
        console.error(`   ✗ Error scraping @${username}:`, error);
        // Continue with next follower
      }
    }

    // Save remaining profiles
    if (profiles.length > 0) {
      await sheetsService.addProfiles(profiles);
      console.log(`\n✓ Saved final batch of ${profiles.length} profiles to Google Sheets`);
    }

    console.log('\n✅ Scraping completed successfully!');
    console.log(`📊 Total profiles scraped: ${followers.length}`);
    console.log(`🔗 View your Google Sheet: https://docs.google.com/spreadsheets/d/${config.googleSheetId}`);

    // Close browser
    await scraper.close();
    console.log('\n👋 Browser closed. Goodbye!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the main function
main().catch(console.error);
