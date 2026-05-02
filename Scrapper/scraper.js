#!/usr/bin/env node

const MegaCrawler = require('./crawler');
const chalk = require('chalk');
const readline = require('readline');

const args = process.argv.slice(2);

// ─── Parse CLI args ──────────────────────────────────────────────────────
function parseArgs(args) {
    const opts = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--depth' || args[i] === '-d') {
            opts.maxDepth = parseInt(args[++i], 10);
        } else if (args[i] === '--concurrency' || args[i] === '-c') {
            opts.concurrency = parseInt(args[++i], 10);
        } else if (args[i] === '--no-resolve') {
            opts.resolveShortLinks = false;
        } else if (args[i] === '--no-js') {
            opts.waitForJS = false;
        } else if (args[i] === '--output' || args[i] === '-o') {
            opts.output = { format: 'json', file: args[++i] };
        } else if (args[i] === '--timeout' || args[i] === '-t') {
            opts.timeout = parseInt(args[++i], 10);
        } else if (args[i] === '--help' || args[i] === '-h') {
            showHelp();
            process.exit(0);
        } else if (!args[i].startsWith('-')) {
            opts.url = args[i];
        }
    }
    return opts;
}

function showHelp() {
    console.log('');
    console.log(chalk.cyan.bold('  🕷️  MEGA SCRAPPER — Usage'));
    console.log('');
    console.log(chalk.white('  node scraper.js <url> [options]'));
    console.log('');
    console.log(chalk.yellow('  Options:'));
    console.log(chalk.gray('    -d, --depth <n>        ') + chalk.white('Max crawl depth (default: 3)'));
    console.log(chalk.gray('    -c, --concurrency <n>  ') + chalk.white('Parallel pages (default: 5)'));
    console.log(chalk.gray('    -o, --output <file>    ') + chalk.white('Output file (default: results.json)'));
    console.log(chalk.gray('    -t, --timeout <ms>     ') + chalk.white('Page timeout in ms (default: 30000)'));
    console.log(chalk.gray('    --no-resolve           ') + chalk.white('Skip short link resolution'));
    console.log(chalk.gray('    --no-js                ') + chalk.white('Don\'t wait for JS rendering'));
    console.log(chalk.gray('    -h, --help             ') + chalk.white('Show this help'));
    console.log('');
    console.log(chalk.yellow('  Examples:'));
    console.log(chalk.gray('    node scraper.js https://example.com'));
    console.log(chalk.gray('    node scraper.js https://example.com -d 5 -c 10'));
    console.log(chalk.gray('    node scraper.js https://example.com --no-js -o links.json'));
    console.log('');
}

// ─── Interactive mode ────────────────────────────────────────────────────
async function interactiveMode() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('');
    console.log(chalk.cyan.bold('  ╔══════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('  ║') + chalk.white.bold('   🕷️  MEGA SCRAPPER v1.0 — Interactive Mode  🕷️     ') + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('  ╚══════════════════════════════════════════════════════╝'));
    console.log('');

    const url = await ask(chalk.green('  🎯 Enter URL to crawl: '));
    if (!url) {
        console.log(chalk.red('  No URL provided. Exiting.'));
        rl.close();
        return;
    }

    const depthStr = await ask(chalk.green('  📏 Max depth (default 3): '));
    const concStr = await ask(chalk.green('  ⚡ Concurrency (default 5): '));
    const resolveStr = await ask(chalk.green('  🔗 Resolve short links? (Y/n): '));
    const jsStr = await ask(chalk.green('  🌐 Wait for JS rendering? (Y/n): '));

    rl.close();

    const opts = {};
    if (depthStr) opts.maxDepth = parseInt(depthStr, 10);
    if (concStr) opts.concurrency = parseInt(concStr, 10);
    if (resolveStr && resolveStr.toLowerCase() === 'n') opts.resolveShortLinks = false;
    if (jsStr && jsStr.toLowerCase() === 'n') opts.waitForJS = false;

    const crawler = new MegaCrawler(opts);
    await crawler.crawl(url);
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
    const opts = parseArgs(args);

    if (opts.url) {
        // CLI mode
        const crawler = new MegaCrawler(opts);
        await crawler.crawl(opts.url);
    } else {
        // Interactive mode
        await interactiveMode();
    }
}

main().catch(err => {
    console.error(chalk.red(`\n  Fatal: ${err.message}`));
    process.exit(1);
});
