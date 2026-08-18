require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { scrapeAllSources } = require('./scraper');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const QUEUE_FILE = path.join(__dirname, 'queued_jobs.json');

if (!token || !chatId) {
    console.error("Please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the .env file");
    process.exit(1);
}

const bot = new TelegramBot(token, { 
    polling: true, // Enabled polling to handle user commands
    request: {
        family: 6 
    }
});

// --- Queue Management ---

function loadQueue() {
    if (fs.existsSync(QUEUE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        } catch (e) {
            return { mnc: [], linkedin: [], naukri: [], popular: [], other: [] };
        }
    }
    return { mnc: [], linkedin: [], naukri: [], popular: [], other: [] };
}

function saveQueue(queue) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function addToQueue(newBuckets) {
    const queue = loadQueue();
    queue.mnc.push(...newBuckets.mnc);
    queue.linkedin.push(...newBuckets.linkedin);
    queue.naukri.push(...newBuckets.naukri);
    queue.popular.push(...newBuckets.popular);
    queue.other.push(...newBuckets.other);
    saveQueue(queue);
}

function getNextJobsFromQueue(count = 30) {
    const queue = loadQueue();
    const selected = [];
    
    // Priority order for extraction
    const order = ['mnc', 'linkedin', 'naukri', 'popular', 'other'];
    
    for (const key of order) {
        while (queue[key].length > 0 && selected.length < count) {
            selected.push(queue[key].shift());
        }
    }
    
    saveQueue(queue);
    return selected;
}

function getQueueStats() {
    const queue = loadQueue();
    return queue.mnc.length + queue.linkedin.length + queue.naukri.length + queue.popular.length + queue.other.length;
}
/**
 * Helper function to clean text for Telegram
 */
function cleanText(str) {
    if (!str) return 'Unknown';
    // Remove newlines, carriage returns, and tabs
    let cleaned = str.replace(/[\n\r\t]+/g, ' ');
    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    return cleaned.trim();
}

/**
 * Helper to remove emojis/flags from location strings
 */
function cleanLocation(str) {
    let cleaned = cleanText(str);
    // Regex to remove common emojis and ALL country flags (Regional Indicator Symbols)
    cleaned = cleaned.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    // Truncate if it's ridiculously long
    if (cleaned.length > 20) {
        cleaned = cleaned.substring(0, 17) + '...';
    }
    return cleaned.trim() || 'India';
}

/**
 * Formats a list of jobs into a readable message
 * @param {Array} jobs - List of job objects
 * @param {Number} startIndex - For numbering continuity
 * @param {Boolean} isFirst - If this is the start of the set
 * @returns {String} Formatted message
 */
function formatMessage(jobs, startIndex = 0, isFirst = true) {
    const dateStr = new Date().toISOString().split('T')[0];
    
    let message = isFirst ? `🌅 *Fresh Job Opportunities for Today:*\n\n` : "";

    jobs.forEach((job, index) => {
        const actualIndex = startIndex + index + 1;
        const safeTitle = cleanText(job.title);
        const safeCompany = cleanText(job.company);
        const safeLocation = cleanLocation(job.location);

        // More readable format with spacing
        message += `${actualIndex}. **${safeTitle}**\n`;
        message += `🏢 ${safeCompany}\n`;
        message += `📍 ${safeLocation}\n`;
        message += `🔗 [Apply Here](${job.url})\n\n`; // Double newline for proper spacing
    });

    if (!isFirst) {
        message += `---\n📅 Updated: ${dateStr}`;
    }

    return message;
}

/**
 * Main routine that scrapes jobs and sends the message
 */
async function sendDailyJobs() {
    try {
        console.log(`[${new Date().toISOString()}] Running daily job search...`);
        
        // Send a starting message to Telegram before scraping
        await bot.sendMessage(chatId, "⏳ *Starting today's job search...*\n\nInitializing scrapers to fetch fresh jobs from 80+ portals... 🚀", {
            parse_mode: 'Markdown'
        });

        // 1. Run the Scraper first to fill the queue
        const newBuckets = await scrapeAllSources(async (progressMsg) => {
            console.log(`[Scraper] ${progressMsg}`);
        });

        // 2. Add found jobs to the persistent queue
        addToQueue(newBuckets);

        // 3. Pull the top 30 to send
        const jobsToSend = getNextJobsFromQueue(30);
        
        if (jobsToSend.length === 0) {
            await bot.sendMessage(chatId, `⚠️ No new fresher postings found today across our portals. We'll check again tomorrow!`);
            return;
        }

        // Split 30 jobs into 2 posts of 15 each for better formatting
        const chunkSize = 15;
        for (let i = 0; i < jobsToSend.length; i += chunkSize) {
            const chunk = jobsToSend.slice(i, i + chunkSize);
            const isFirst = (i === 0);
            
            const message = formatMessage(chunk, i, isFirst);
            
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
            await new Promise(r => setTimeout(r, 1000));
        }

        const remaining = getQueueStats();
        if (remaining > 0) {
            await bot.sendMessage(chatId, `💡 *${remaining} more jobs* are in the queue. Type "send the next jobs" to see them!`, { parse_mode: 'Markdown' });
        }

        console.log(`✅ Daily job list sent successfully. ${remaining} jobs left in queue.`);
    } catch (error) {
        console.error('❌ Error in daily job routine:', error);
        await bot.sendMessage(chatId, "❌ *Error during scraping:* " + error.message, { parse_mode: 'Markdown' });
    }
}

// --- Interactive Commands ---

bot.on('message', async (msg) => {
    const text = msg.text ? msg.text.toLowerCase() : '';
    const incomingChatId = msg.chat.id.toString();

    // Only respond to the authorized chat ID
    if (incomingChatId !== chatId) return;

    if (text === '/start') {
        await bot.sendMessage(chatId, 
            "👋 *Welcome to the Automated Job Bot!*\n\n" +
            "• I scrape 80 portals daily at 08:00 AM.\n" +
            "• I prioritize MNCs, LinkedIn, and Naukri.\n" +
            "• If I find extra jobs, I store them in a queue.\n\n" +
            "💬 *Commands:*\n" +
            "Type `send the next jobs` to get more jobs from the queue right now!",
            { parse_mode: 'Markdown' }
        );
    } 
    else if (text === 'send the next jobs') {
        const jobs = getNextJobsFromQueue(30);
        const remaining = getQueueStats();

        if (jobs.length === 0) {
            await bot.sendMessage(chatId, "📭 *The queue is empty!* I'll find more jobs during the next 08:00 AM scrape.");
        } else {
            // Split into 2 posts of 15
            const chunkSize = 15;
            for (let i = 0; i < jobs.length; i += chunkSize) {
                const chunk = jobs.slice(i, i + chunkSize);
                const message = formatMessage(chunk, i, (i === 0));
                
                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                await new Promise(r => setTimeout(r, 1000));
            }

            if (remaining > 0) {
                await bot.sendMessage(chatId, `💡 *${remaining} more jobs* still in the queue. Type it again for more!`, { parse_mode: 'Markdown' });
            } else {
                await bot.sendMessage(chatId, "✅ *That's all for now!* Queue is clear.", { parse_mode: 'Markdown' });
            }
        }
    }
});

// Schedule the task to run every day at 8:00 AM
// Format: "0 8 * * *" (minute hour day month day-of-week)
console.log('Bot is running. Scheduled to send jobs daily at 08:00 AM.');
cron.schedule('0 8 * * *', () => {
    sendDailyJobs();
});

// Uncomment the following line to run it immediately on startup for testing
sendDailyJobs();
