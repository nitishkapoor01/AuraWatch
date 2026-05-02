const chalk = require('chalk');

const ICONS = {
    rocket: '🚀',
    link: '🔗',
    check: '✅',
    cross: '❌',
    warn: '⚠️',
    search: '🔍',
    globe: '🌐',
    clock: '⏱️',
    fire: '🔥',
    spider: '🕷️',
    chain: '⛓️',
    file: '📄',
    folder: '📁',
    target: '🎯',
    bolt: '⚡',
    shield: '🛡️',
    gear: '⚙️',
    chart: '📊',
    save: '💾',
    done: '🏁'
};

class Logger {
    constructor() {
        this.startTime = Date.now();
    }

    _timestamp() {
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        return chalk.gray(`[${elapsed}s]`);
    }

    banner() {
        console.log('');
        console.log(chalk.cyan.bold('  ╔══════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('  ║') + chalk.white.bold('   🕷️  MEGA SCRAPPER v1.0 — Link Hunter Supreme  🕷️  ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('  ║') + chalk.gray('     Powerful Crawler • Link Resolver • Extractor     ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('  ╚══════════════════════════════════════════════════════╝'));
        console.log('');
    }

    info(msg) {
        console.log(`  ${this._timestamp()} ${chalk.blue('INFO')}  ${msg}`);
    }

    success(msg) {
        console.log(`  ${this._timestamp()} ${chalk.green('OK')}    ${msg}`);
    }

    warn(msg) {
        console.log(`  ${this._timestamp()} ${chalk.yellow('WARN')}  ${msg}`);
    }

    error(msg) {
        console.log(`  ${this._timestamp()} ${chalk.red('ERR')}   ${msg}`);
    }

    link(url, status = 'found') {
        const domain = (() => {
            try { return new URL(url).hostname; } catch { return '??'; }
        })();
        const shortUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
        if (status === 'found') {
            console.log(`  ${this._timestamp()} ${chalk.green(ICONS.link)}    ${chalk.white(shortUrl)} ${chalk.gray(`(${domain})`)}`);
        } else if (status === 'resolved') {
            console.log(`  ${this._timestamp()} ${chalk.magenta(ICONS.chain)}    ${chalk.magenta('→')} ${chalk.white(shortUrl)} ${chalk.gray(`(resolved)`)}`);
        } else if (status === 'error') {
            console.log(`  ${this._timestamp()} ${chalk.red(ICONS.cross)}    ${chalk.red(shortUrl)} ${chalk.gray(`(failed)`)}`);
        }
    }

    crawling(url, depth) {
        const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
        console.log(`  ${this._timestamp()} ${chalk.cyan(ICONS.spider)}    ${chalk.cyan('Crawling')} ${chalk.white.bold(shortUrl)} ${chalk.gray(`[depth: ${depth}]`)}`);
    }

    stats(stats) {
        console.log('');
        console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
        console.log(chalk.cyan('  │') + chalk.white.bold(`  ${ICONS.chart} Crawl Statistics                          `) + chalk.cyan('│'));
        console.log(chalk.cyan('  ├─────────────────────────────────────────────┤'));
        console.log(chalk.cyan('  │') + `  ${ICONS.globe} Pages Crawled:    ${chalk.green.bold(String(stats.pagesCrawled).padStart(8))}            ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ${ICONS.link} Links Found:      ${chalk.blue.bold(String(stats.linksFound).padStart(8))}            ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ${ICONS.chain} Links Resolved:   ${chalk.magenta.bold(String(stats.linksResolved).padStart(8))}            ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ${ICONS.cross} Errors:           ${chalk.red.bold(String(stats.errors).padStart(8))}            ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ${ICONS.clock} Time Taken:       ${chalk.yellow.bold(stats.timeTaken.padStart(8))}            ` + chalk.cyan('│'));
        console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
        console.log('');
    }

    saved(filePath) {
        console.log(`  ${ICONS.save}  ${chalk.green.bold('Results saved to:')} ${chalk.underline(filePath)}`);
        console.log('');
    }

    done() {
        console.log(`  ${ICONS.done}  ${chalk.green.bold('Crawl complete!')} ${chalk.gray('Happy scraping!')}`);
        console.log('');
    }
}

module.exports = { Logger, ICONS };
