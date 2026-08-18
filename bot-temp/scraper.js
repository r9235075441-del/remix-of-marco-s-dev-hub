const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

const browserOptions = {
    headless: 'new',
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu-sandbox'
    ],
    timeout: 60000
};

const SEEN_JOBS_FILE = path.join(__dirname, 'seen_jobs.json');

// Load already sent jobs to prevent duplicates
function loadSeenJobs() {
    if (fs.existsSync(SEEN_JOBS_FILE)) {
        return JSON.parse(fs.readFileSync(SEEN_JOBS_FILE, 'utf8'));
    }
    return [];
}

// Save newly sent jobs
function saveSeenJobs(jobs) {
    const seen = loadSeenJobs();
    // We save unique signature of Title + Company
    const newSignatures = jobs.map(j => `${j.title.trim()}||${j.company.trim()}`.toLowerCase());
    const updated = [...new Set([...seen, ...newSignatures])];
    fs.writeFileSync(SEEN_JOBS_FILE, JSON.stringify(updated));
}

// Helper to filter out jobs we've already sent
function filterNewJobs(jobs) {
    const seen = loadSeenJobs();
    return jobs.filter(job => {
        const signature = `${job.title.trim()}||${job.company.trim()}`.toLowerCase();
        return !seen.includes(signature);
    });
}

async function scrapeInternshala(browser) {
    console.log('Scraping Internshala...');
    try {
        const page = await browser.newPage();
        await page.goto('https://internshala.com/fresher-jobs/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.container-fluid.individual_internship');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.profile a');
                const compEl = job.querySelector('.company_name');
                const locEl = job.querySelector('.locations a');
                if (titleEl && titleEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'Remote',
                        description: 'Verified fresher opportunity from Internshala.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Internshala scrape failed:', e.message);
        return [];
    }
}

async function scrapeNaukri(browser) {
    console.log('Scraping Naukri...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.naukri.com/fresher-jobs?k=fresher&experience=0', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.title') || job.querySelector('a.title');
                const compEl = job.querySelector('.company-name') || job.querySelector('.comp-name');
                const locEl = job.querySelector('.locWdth') || job.querySelector('.location');
                if (titleEl && titleEl.href && !titleEl.href.includes('javascript:')) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'Pan-India',
                        description: 'Entry-level role listed on Naukri.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Naukri scrape failed:', e.message);
        return [];
    }
}

async function scrapeLinkedIn(browser) {
    console.log('Scraping LinkedIn...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.linkedin.com/jobs/search/?keywords=fresher&location=India&f_E=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.base-card, .job-search-card');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.base-search-card__title');
                const compEl = job.querySelector('.base-search-card__subtitle');
                const locEl = job.querySelector('.job-search-card__location');
                const linkEl = job.querySelector('.base-card__full-link') || job.querySelector('a');
                if (titleEl && linkEl && linkEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'LinkedIn entry-level/fresher position.',
                        url: linkEl.href.split('?')[0]
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('LinkedIn scrape failed:', e.message);
        return [];
    }
}

async function scrapeFoundit(browser) {
    console.log('Scraping Foundit (Monster India)...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.foundit.in/srp/results?query=fresher&experienceRanges=0~0', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-apply-card');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.job-tittle h3');
                const compEl = job.querySelector('.company-name');
                const locEl = job.querySelector('.details-info .location');
                const linkEl = job.querySelector('a');
                if (titleEl && linkEl && linkEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'Foundit (Monster India) fresher role.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Foundit scrape failed:', e.message);
        return [];
    }
}

async function scrapeTimesJobs(browser) {
    console.log('Scraping TimesJobs...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&luc=1&txtKeywords=fresher&cboWorkExp1=0', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('li.job-bx');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('header h2 a');
                const compEl = job.querySelector('h3.joblist-comp-name');
                const locEl = job.querySelector('.srp-zindex.location-tru span');
                if (titleEl && titleEl.href && !titleEl.href.includes('javascript:')) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.replace('(More Jobs)', '').trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'Verified entry-level role from TimesJobs.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('TimesJobs scrape failed:', e.message);
        return [];
    }
}

async function scrapeFreshersworld(browser) {
    console.log('Scraping Freshersworld...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.freshersworld.com/jobs/jobsearch/fresher-jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-container');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.seo-job-title');
                const compEl = job.querySelector('.job-comp-name');
                const locEl = job.querySelector('.job-location');
                const wrapperA = job.parentElement.tagName === 'A' ? job.parentElement : job.querySelector('a');
                
                if (titleEl && wrapperA && wrapperA.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'Opportunity sourced from Freshersworld.',
                        url: wrapperA.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Freshersworld scrape failed:', e.message);
        return [];
    }
}

async function scrapeShine(browser) {
    console.log('Scraping Shine.com...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.shine.com/job-search/fresher-jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('div[class^="jobCard_jobCard"]');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('h2 a') || job.querySelector('a');
                const compEl = job.querySelector('div[class^="jobCard_jobCard_cName"] span') || job.querySelector('.jobCard_jobCard_cName__mYnow');
                const locEl = job.querySelector('div[class^="jobCard_locationIcon"]');
                
                if (titleEl && titleEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'Shine.com verified fresher posting.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Shine.com scrape failed:', e.message);
        return [];
    }
}

async function scrapeSimplyHired(browser) {
    console.log('Scraping SimplyHired...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.simplyhired.co.in/search?q=fresher&l=india', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('#job-list li');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('a');
                const compEl = job.querySelector('span[data-testid="companyName"]');
                const locEl = job.querySelector('span[data-testid="searchSerpJobLocation"]');
                
                if (titleEl && titleEl.href && !titleEl.href.includes('javascript:')) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'SimplyHired fresher listing.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('SimplyHired scrape failed:', e.message);
        return [];
    }
}

async function scrapeApna(browser) {
    console.log('Scraping Apna Jobs...');
    try {
        const page = await browser.newPage();
        await page.goto('https://apna.co/jobs/fresher-jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = Array.from(document.querySelectorAll('a')).filter(a => a.href && a.href.includes('/job/'));
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('h3') || job;
                const compEl = job.querySelector('p') || job.parentElement.querySelector('p');
                
                jobsList.push({
                    title: titleEl.innerText.trim() || 'Fresher Job',
                    company: compEl ? compEl.innerText.trim() : 'Unknown',
                    location: 'India',
                    description: 'Apna verified fresher opportunity.',
                    url: job.href
                });
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Apna scrape failed:', e.message);
        return [];
    }
}

async function scrapeWorkIndia(browser) {
    console.log('Scraping WorkIndia...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.workindia.in/fresher-jobs/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.JobCard, div[data-testid="job-card"]');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('h2, h3');
                const compEl = job.querySelector('.Company, .company-name, p');
                const linkEl = job.querySelector('a') || job.parentElement;
                
                if (linkEl && linkEl.href && titleEl) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: 'India',
                        description: 'WorkIndia fresher role.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('WorkIndia scrape failed:', e.message);
        return [];
    }
}

async function scrapeInstahyre(browser) {
    console.log('Scraping Instahyre...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.instahyre.com/search/?q=fresher', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.employer-block');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.position-title');
                const compEl = job.querySelector('.employer-name');
                const locEl = job.querySelector('.job-locations');
                const linkEl = job.querySelector('a#explore-btn') || job.querySelector('a');
                
                if (titleEl && linkEl && linkEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: 'Instahyre tech fresher opening.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Instahyre scrape failed:', e.message);
        return [];
    }
}

async function scrapeHirist(browser) {
    console.log('Scraping Hirist...');
    try {
        const page = await browser.newPage();
        // Uses Hirist tech fresher page
        await page.goto('https://www.hirist.tech/search/fresher-0-1-years-0-0-1.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-container, .job-item');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.job-title, .title');
                const compEl = job.querySelector('.company-name, .company');
                const linkEl = job.querySelector('a');
                
                if (titleEl && linkEl && linkEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: 'India',
                        description: 'Hirist IT/Tech fresher position.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Hirist scrape failed:', e.message);
        return [];
    }
}

async function scrapeRemoteOk(browser) {
    console.log('Scraping Remote OK...');
    try {
        const page = await browser.newPage();
        await page.goto('https://remoteok.com/remote-entry-level-jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('tr.job');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('h2');
                const compEl = job.querySelector('h3');
                const linkEl = job.querySelector('a.preventLink');
                
                if (titleEl && linkEl && linkEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: 'Remote / Global',
                        description: 'Global remote entry-level opportunity.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Remote OK scrape failed:', e.message);
        return [];
    }
}

async function scrapeGlassdoor(browser) {
    console.log('Scraping Glassdoor...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.glassdoor.co.in/Job/india-fresher-jobs-SRCH_IL.0,5_IN115_KO6,13.htm', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('li[data-test="jobListing"], li[class^="react-job-listing"]');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('a[data-test="job-link"]') || job.querySelector('a');
                const compEl = job.querySelector('.job-search-8wag7x');
                
                if (titleEl && titleEl.href) {
                    jobsList.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: 'India',
                        description: 'Glassdoor fresher job listing.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Glassdoor scrape failed:', e.message);
        return [];
    }
}

async function scrapeCutshort(browser) {
    console.log('Scraping Cutshort...');
    try {
        const page = await browser.newPage();
        await page.goto('https://cutshort.io/jobs/fresher-jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-card, div[class*="job"]');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('.title, h2, h3, a');
                const linkEl = job.tagName === 'A' ? job : job.querySelector('a');
                
                if (titleEl && linkEl && linkEl.href && !linkEl.href.includes('javascript:')) {
                    jobsList.push({
                        title: titleEl.innerText.trim() || 'Fresher Job',
                        company: 'Startup / Unknown', // Cutshort often hides company name slightly
                        location: 'India',
                        description: 'Startup opportunity from Cutshort.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Cutshort scrape failed:', e.message);
        return [];
    }
}

async function scrapeWellfound(browser) {
    console.log('Scraping Wellfound (AngelList)...');
    try {
        const page = await browser.newPage();
        await page.goto('https://wellfound.com/role/software-engineer/fresher', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('div[class*="styles_jobListing"], div[class*="styles_component"]');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const titleEl = job.querySelector('a');
                const compEl = job.querySelector('h2');
                
                if (titleEl && titleEl.href && titleEl.href.includes('/job/')) {
                    jobsList.push({
                        title: titleEl.innerText.trim() || 'Fresher Startup Job',
                        company: compEl ? compEl.innerText.trim() : 'Startup',
                        location: 'India / Remote',
                        description: 'Wellfound entry-level startup role.',
                        url: titleEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('Wellfound scrape failed:', e.message);
        return [];
    }
}

async function scrapeZipRecruiter(browser) {
    console.log('Scraping ZipRecruiter...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.ziprecruiter.in/Jobs/Fresher', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('article.job_result, .jobList-intro');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const linkEl = job.querySelector('a.job_link') || job.querySelector('a');
                const compEl = job.querySelector('.t_org_link, .companyName');
                
                if (linkEl && linkEl.href) {
                    jobsList.push({
                        title: linkEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Unknown',
                        location: 'India',
                        description: 'ZipRecruiter fresher listing.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('ZipRecruiter scrape failed:', e.message);
        return [];
    }
}

async function scrapeNCS(browser) {
    console.log('Scraping National Career Service (NCS)...');
    try {
        const page = await browser.newPage();
        await page.goto('https://www.ncs.gov.in/Pages/Search.aspx?&q=fresher', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-list-card, table tr');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                const linkEl = job.querySelector('a.job-title') || job.querySelector('a');
                
                if (linkEl && linkEl.href && linkEl.href.includes('JobId')) {
                    jobsList.push({
                        title: linkEl.innerText.trim() || 'Government/Public Sector Job',
                        company: 'NCS Govt Portal',
                        location: 'Pan-India',
                        description: 'Official Government/Public Sector entry-level role via NCS.',
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        });
        await page.close();
        return jobs;
    } catch (e) {
        console.error('NCS scrape failed:', e.message);
        return [];
    }
}

async function scrapeGenericSite(browser, config) {
    console.log(`Scraping ${config.name}...`);
    try {
        const page = await browser.newPage();
        await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        const jobs = await page.evaluate((cfg) => {
            const jobElements = document.querySelectorAll(cfg.listSelector || 'a');
            const jobsList = [];
            for (const job of jobElements) {
                if (jobsList.length >= 10) break;
                
                let linkEl = job;
                if (job.tagName !== 'A') {
                    linkEl = job.querySelector(cfg.linkSelector || 'a');
                }
                
                if (linkEl && linkEl.href && !linkEl.href.includes('javascript:')) {
                    if (cfg.urlIncludes && !linkEl.href.includes(cfg.urlIncludes)) continue;
                    
                    const titleEl = cfg.titleSelector ? (job.querySelector(cfg.titleSelector) || linkEl) : linkEl;
                    
                    jobsList.push({
                        title: titleEl.innerText.trim() || 'Entry Level Role',
                        company: cfg.companyName || 'Unknown',
                        location: 'India / Global',
                        description: `Sourced dynamically from ${cfg.name}.`,
                        url: linkEl.href
                    });
                }
            }
            return jobsList;
        }, config);
        await page.close();
        return jobs;
    } catch (e) {
        console.error(`${config.name} scrape failed:`, e.message);
        return [];
    }
}

async function scrapeAllSources(onProgress) {
    console.log('Starting multi-source scraping...');
    const browser = await puppeteer.launch(browserOptions);
    
    const safeProgress = async (msg) => {
        if (onProgress) {
            try { await onProgress(msg); } catch (e) {}
        }
    };

    let step = 1;
    const totalSteps = 80; // Upgraded to 80 portals!

    // Data buckets to maintain strict ordering
    let buckets = {
        mnc: [],
        linkedin: [],
        naukri: [],
        popular: [],
        other: []
    };

    // --- 1. MNC Companies Career Websites ---
    const mncConfigs = [
        { name: 'Amazon Jobs', url: 'https://www.amazon.jobs/en/search?base_query=entry+level&loc_query=India', listSelector: '.job-tile', linkSelector: '.job-link', titleSelector: '.job-title', companyName: 'Amazon' },
        { name: 'Google Careers', url: 'https://www.google.com/about/careers/applications/jobs/results?q=%22Early%20Career%22%20OR%20%22University%20Graduate%22&location=India', listSelector: '.WpHeLc', linkSelector: 'a', titleSelector: 'h3', companyName: 'Google' },
        { name: 'Microsoft Careers', url: 'https://jobs.careers.microsoft.com/global/en/search?q=University%20Graduate&l=India', listSelector: '.mz-job-card', linkSelector: 'a', titleSelector: 'h2', companyName: 'Microsoft' },
        { name: 'Cognizant Careers', url: 'https://careers.cognizant.com/global/en/search-results?keywords=graduate', listSelector: 'li.jobs-list-item', linkSelector: 'a', urlIncludes: 'job', companyName: 'Cognizant' },
        { name: 'Accenture Careers', url: 'https://www.accenture.com/in-en/careers/jobsearch?keyword=entry', listSelector: '.cmp-job-listing__card', linkSelector: 'a', urlIncludes: 'careers/job', companyName: 'Accenture' },
        { name: 'HCLTech Careers', url: 'https://www.hcltech.com/careers', listSelector: '.views-row', linkSelector: 'a', urlIncludes: 'careers', companyName: 'HCLTech' },
        { name: 'Capgemini Careers', url: 'https://www.capgemini.com/in-en/careers/job-search/?keyword=graduate', listSelector: '.job_listing', linkSelector: 'a', urlIncludes: 'job', companyName: 'Capgemini' },
        { name: 'IBM Careers', url: 'https://careers.ibm.com/job/search?q=entry+level', listSelector: '.job-result', linkSelector: 'a', urlIncludes: 'job', companyName: 'IBM' },
        { name: 'Oracle Careers', url: 'https://careers.oracle.com/jobs/#en/sites/jobsearch/filter/keywords=graduate', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Oracle' },
        { name: 'Meta Careers', url: 'https://www.metacareers.com/jobs?q=University', listSelector: '._8tk7', linkSelector: 'a', urlIncludes: 'jobs', companyName: 'Meta' },
        { name: 'Apple Careers', url: 'https://jobs.apple.com/en-in/search?search=graduate', listSelector: '.table-col-1', linkSelector: 'a', urlIncludes: 'details', companyName: 'Apple' },
        { name: 'Cisco Careers', url: 'https://jobs.cisco.com/jobs/SearchJobs/?keyword=graduate', listSelector: '.job-result', linkSelector: 'a', urlIncludes: 'job', companyName: 'Cisco' },
        { name: 'Intel Careers', url: 'https://jobs.intel.com/en/search-jobs/graduate', listSelector: '#search-results-list li', linkSelector: 'a', urlIncludes: 'job', companyName: 'Intel' },
        { name: 'Dell Careers', url: 'https://jobs.dell.com/search-jobs/graduate/India', listSelector: '#search-results-list li', linkSelector: 'a', urlIncludes: 'job', companyName: 'Dell' },
        { name: 'HP Careers', url: 'https://jobs.hp.com/search-jobs/graduate', listSelector: '#search-results-list li', linkSelector: 'a', urlIncludes: 'job', companyName: 'HP' },
        { name: 'Salesforce Careers', url: 'https://careers.salesforce.com/en/jobs/?search=graduate', listSelector: '.job-list-item', linkSelector: 'a', urlIncludes: 'job', companyName: 'Salesforce' },
        { name: 'TCS Careers', url: 'https://www.tcs.com/careers/india', listSelector: '.job-listing', linkSelector: 'a', urlIncludes: 'careers', companyName: 'TCS' },
        { name: 'Infosys Careers', url: 'https://www.infosys.com/careers.html', listSelector: '.job-result', linkSelector: 'a', urlIncludes: 'careers', companyName: 'Infosys' },
        { name: 'SAP Careers', url: 'https://jobs.sap.com/search/?q=graduate&locationsearch=India', listSelector: '.job-tile', linkSelector: 'a', urlIncludes: 'job', companyName: 'SAP' },
        { name: 'Siemens Careers', url: 'https://jobs.siemens.com/jobs?keywords=graduate&location=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'jobs', companyName: 'Siemens' },
        { name: 'NVIDIA Careers', url: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite?q=University', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'NVIDIA' },
        { name: 'Adobe Careers', url: 'https://adobe.wd5.myworkdayjobs.com/external_experienced?q=university', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Adobe' },
        { name: 'JP Morgan', url: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions?keyword=graduate&location=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'JP Morgan' },
        { name: 'Goldman Sachs', url: 'https://www.goldmansachs.com/careers/students/index.html', listSelector: 'a', linkSelector: 'a', urlIncludes: 'job', companyName: 'Goldman Sachs' },
        { name: 'Deloitte Jobs', url: 'https://jobsindia.deloitte.com/search/?q=fresher', listSelector: '.job-tile', linkSelector: 'a', urlIncludes: 'job', companyName: 'Deloitte' },
        { name: 'PwC Careers', url: 'https://pwc.wd3.myworkdayjobs.com/PwC_Global_Careers?q=graduate&locationsearch=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'PwC' },
        { name: 'EY Careers', url: 'https://careers.ey.com/search/?q=graduate&locationsearch=India', listSelector: '.job-tile', linkSelector: 'a', urlIncludes: 'job', companyName: 'EY' },
        { name: 'Walmart Careers', url: 'https://careers.walmart.com/results?q=fresher&loc=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Walmart' },
        { name: 'PayPal Careers', url: 'https://jobsearch.paypal-corp.com/en-US/search?keywords=university&location=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'PayPal' },
        { name: 'Uber Careers', url: 'https://www.uber.com/global/en/careers/list/?location=India&q=University', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Uber' },
        { name: 'Netflix Jobs', url: 'https://jobs.netflix.com/search?q=University', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Netflix' },
        { name: 'Atlassian Jobs', url: 'https://www.atlassian.com/company/careers/all-jobs?search=graduate&location=India', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Atlassian' },
        { name: 'Morgan Stanley', url: 'https://morganstanley.tal.net/vx/lang-en-GB/mobile-0/appcentre-1/brand-2/xf-9975b3310f84/candidate/jobboard/vacancy/2/adv/', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Morgan Stanley' },
        { name: 'Wipro Jobs', url: 'https://careers.wipro.com/careers-home/jobs?keywords=graduate', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Wipro' },
        { name: 'Samsung Careers', url: 'https://www.samsung.com/in/about-us/careers/', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Samsung' },
        { name: 'Sony Careers', url: 'https://www.sony.co.in/section/careers', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'job', companyName: 'Sony' }
    ];

    for (let i = 0; i < mncConfigs.length; i++) {
        await safeProgress(`Scraping ${mncConfigs[i].name} (${step++}/${totalSteps})...`);
        const result = await scrapeGenericSite(browser, mncConfigs[i]);
        buckets.mnc.push(...result);
    }

    // --- 2. LinkedIn ---
    await safeProgress(`Scraping LinkedIn (${step++}/${totalSteps})...`);
    buckets.linkedin.push(...(await scrapeLinkedIn(browser)));

    // --- 3. Naukri ---
    await safeProgress(`Scraping Naukri (${step++}/${totalSteps})...`);
    buckets.naukri.push(...(await scrapeNaukri(browser)));

    // --- 4. Other Standard Portals ---
    const customScrapers = [
        { name: 'Internshala', func: scrapeInternshala },
        { name: 'Foundit (Monster India)', func: scrapeFoundit },
        { name: 'TimesJobs', func: scrapeTimesJobs },
        { name: 'Freshersworld', func: scrapeFreshersworld },
        { name: 'Shine.com', func: scrapeShine },
        { name: 'SimplyHired', func: scrapeSimplyHired },
        { name: 'Apna Jobs', func: scrapeApna },
        { name: 'WorkIndia', func: scrapeWorkIndia },
        { name: 'Instahyre', func: scrapeInstahyre },
        { name: 'Hirist', func: scrapeHirist },
        { name: 'Remote OK', func: scrapeRemoteOk },
        { name: 'Glassdoor', func: scrapeGlassdoor },
        { name: 'Cutshort', func: scrapeCutshort },
        { name: 'Wellfound (AngelList)', func: scrapeWellfound },
        { name: 'ZipRecruiter', func: scrapeZipRecruiter },
        { name: 'National Career Service', func: scrapeNCS }
    ];

    for (const scraper of customScrapers) {
        await safeProgress(`Scraping ${scraper.name} (${step++}/${totalSteps})...`);
        buckets.popular.push(...(await scraper.func(browser)));
    }

    // --- 5. Other Generic Portals ---
    const otherConfigs = [
        { name: 'Upwork', url: 'https://www.upwork.com/freelance-jobs/entry-level/', listSelector: 'section.up-card-section', linkSelector: 'h4 a', titleSelector: 'h4 a', companyName: 'Upwork Client' },
        { name: 'Freelancer', url: 'https://www.freelancer.com/jobs/?keyword=entry%20level', listSelector: '.JobSearchCard-item', linkSelector: 'a.JobSearchCard-primary-heading-link', titleSelector: 'a.JobSearchCard-primary-heading-link', companyName: 'Freelancer Client' },
        { name: 'CareerBuilder', url: 'https://www.careerbuilder.co.in/jobs?keywords=entry+level&location=India', listSelector: '.data-results-content', linkSelector: '.data-results-title', titleSelector: '.data-results-title', companyName: 'Various' },
        { name: 'JobsForHer', url: 'https://www.jobsforher.com/jobs/search?q=fresher', listSelector: '.job-card', linkSelector: '.job-title a', titleSelector: '.job-title a', companyName: 'Various' },
        { name: 'IIMJobs', url: 'https://www.iimjobs.com/search/entry-level', listSelector: '.pd-10', linkSelector: 'a.joblist', titleSelector: 'a.joblist', companyName: 'Various' },
        { name: 'LetsIntern', url: 'https://www.letsintern.com/internships', listSelector: '.internship-item', linkSelector: '.title a', titleSelector: '.title a', companyName: 'Various' },
        { name: 'Hugging Face', url: 'https://huggingface.co/careers', listSelector: 'a.block', linkSelector: 'a', titleSelector: 'h3', companyName: 'Hugging Face' },
        { name: 'Dice', url: 'https://www.dice.com/jobs?q=entry+level&countryCode=IN', listSelector: '.search-card', linkSelector: '.card-title-link', titleSelector: '.card-title-link', companyName: 'Dice Tech' },
        { name: 'We Work Remotely', url: 'https://weworkremotely.com/categories/remote-programming-jobs', listSelector: 'article ul li a', linkSelector: 'a', urlIncludes: '/remote-jobs/', companyName: 'WWR Company' },
        { name: 'Jooble', url: 'https://in.jooble.org/SearchResult?ukw=entry+level', listSelector: 'article', linkSelector: 'a', urlIncludes: 'desc', companyName: 'Jooble Aggregator' },
        { name: 'Toptal', url: 'https://www.toptal.com/careers', listSelector: '.career_job_list', linkSelector: 'a', urlIncludes: 'careers/', companyName: 'Toptal' },
        { name: 'Arc.dev', url: 'https://arc.dev/remote-jobs', listSelector: '.job-card', linkSelector: 'a', urlIncludes: 'remote-jobs', companyName: 'Arc Network' },
        
        // --- 12 NEW Popular Portals ---
        { name: 'Adzuna', url: 'https://www.adzuna.in/search?q=fresher', listSelector: '.a', linkSelector: 'a', titleSelector: 'h2', companyName: 'Adzuna' },
        { name: 'Jobted', url: 'https://in.jobted.com/fresher-jobs', listSelector: '.job', linkSelector: 'a', titleSelector: '.title', companyName: 'Jobted' },
        { name: 'FlexJobs', url: 'https://www.flexjobs.com/search?search=entry+level', listSelector: '#job-list li', linkSelector: 'a.job-link', titleSelector: 'a.job-link', companyName: 'FlexJobs' },
        { name: 'Remote.co', url: 'https://remote.co/remote-jobs/search/?q=entry+level', listSelector: '.job_listing', linkSelector: 'a', titleSelector: 'h3', companyName: 'Remote.co' },
        { name: 'Working Nomads', url: 'https://www.workingnomads.com/jobs?tag=entry-level', listSelector: '.job', linkSelector: 'a', titleSelector: 'h4', companyName: 'Working Nomads' },
        { name: 'Authentic Jobs', url: 'https://authenticjobs.com/?s=entry+level', listSelector: '#listings li', linkSelector: 'a', titleSelector: 'h3', companyName: 'Authentic Jobs' },
        { name: 'Remotive', url: 'https://remotive.com/remote-jobs?search=entry%20level', listSelector: '.job-list-item', linkSelector: 'a', titleSelector: '.position', companyName: 'Remotive' },
        { name: 'Hubstaff Talent', url: 'https://talent.hubstaff.com/search/jobs?search=entry+level', listSelector: '.job', linkSelector: 'a', titleSelector: '.title', companyName: 'Hubstaff Talent' },
        { name: 'DailyRemote', url: 'https://dailyremote.com/remote-jobs?search=entry%20level', listSelector: '.job-row', linkSelector: 'a', titleSelector: 'h2', companyName: 'DailyRemote' },
        { name: 'JobServe', url: 'https://www.jobserve.com/in/en/Job-Search/', listSelector: '.jobItem', linkSelector: 'a', titleSelector: '.jobListHeading', companyName: 'JobServe' },
        { name: 'RemoteOK', url: 'https://remoteok.com/remote-entry-level-jobs', listSelector: 'tr.job', linkSelector: 'a.preventLink', titleSelector: 'h2', companyName: 'RemoteOK' },
        { name: 'Dynamite Jobs', url: 'https://dynamitejobs.com/jobs?search=entry+level', listSelector: '.job-card', linkSelector: 'a', titleSelector: 'h3', companyName: 'Dynamite Jobs' }
    ];

    for (let i = 0; i < otherConfigs.length; i++) {
        await safeProgress(`Scraping ${otherConfigs[i].name} (${step++}/${totalSteps})...`);
        const result = await scrapeGenericSite(browser, otherConfigs[i]);
        buckets.other.push(...result);
    }
    
    await safeProgress('Compiling and strictly ordering results...');
    await browser.close();
    
    // Filter each bucket independently
    const getFreshFromBucket = (bucketArr) => {
        const fresh = filterNewJobs(bucketArr);
        fresh.sort(() => Math.random() - 0.5);
        return fresh;
    };

    const freshMNC = getFreshFromBucket(buckets.mnc);
    const freshLinkedIn = getFreshFromBucket(buckets.linkedin);
    const freshNaukri = getFreshFromBucket(buckets.naukri);
    const freshPopular = getFreshFromBucket(buckets.popular);
    const freshOther = getFreshFromBucket(buckets.other);
    
    // Return them all so the bot can queue them
    const allFreshJobs = {
        mnc: freshMNC,
        linkedin: freshLinkedIn,
        naukri: freshNaukri,
        popular: freshPopular,
        other: freshOther
    };

    const totalFound = freshMNC.length + freshLinkedIn.length + freshNaukri.length + freshPopular.length + freshOther.length;
    console.log(`Successfully found ${totalFound} new jobs.`);
    
    // Mark all as seen so they are never scraped again
    saveSeenJobs([...freshMNC, ...freshLinkedIn, ...freshNaukri, ...freshPopular, ...freshOther]);
    
    return allFreshJobs;
}

module.exports = { scrapeAllSources };
