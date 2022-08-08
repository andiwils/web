import selenium from 'selenium-standalone';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Builder } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox';
import { Launcher as ChromeLauncher } from 'chrome-launcher';
import { runIntegrationTests } from '../../../integration/test-runner';
import { seleniumLauncher } from '../src/seleniumLauncher';

async function startSeleniumServer() {
  let server: selenium.ChildProcess;

  let chromeVersion: string;

  try {
    // Detect installed Chrome version to download matching ChromeDriver.
    const chrome = ChromeLauncher.getFirstInstallation();
    const { stdout } = await promisify(exec)(`"${chrome}" --version`);

    const match = stdout.match(/[0-9]+.[0-9]+.[0-9]+.[0-9]+/);
    chromeVersion = match ? match[0] : 'latest';

    await selenium.install({
      drivers: {
        chrome: { version: chromeVersion },
        firefox: { version: 'latest' },
      },
    });
  } catch (err) {
    console.error('Error occurred when installing selenium.');
    throw err;
  }

  try {
    server = await selenium.start({
      drivers: {
        chrome: { version: chromeVersion },
        firefox: { version: 'latest' },
      },
      seleniumArgs: ['--port', '8888'],
    });
  } catch (err) {
    console.error('Error occurred when starting selenium.');
    console.log(err);
    throw err;
  }

  return server;
}

let seleniumServer: selenium.ChildProcess;

describe('test-runner-selenium', function testRunnerSelenium() {
  this.timeout(50000);

  before(async function () {
    seleniumServer = await startSeleniumServer();
  });

  after(() => {
    seleniumServer.kill();
  });

  function createConfig() {
    return {
      browserStartTimeout: 1000 * 60 * 2,
      testsStartTimeout: 1000 * 60 * 2,
      testsFinishTimeout: 1000 * 60 * 2,
      browsers: [
        seleniumLauncher({
          driverBuilder: new Builder()
            .forBrowser('chrome')
            .setChromeOptions(new ChromeOptions().headless())
            .usingServer('http://localhost:8888/wd/hub'),
        }),
        seleniumLauncher({
          driverBuilder: new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(new FirefoxOptions().headless())
            .usingServer('http://localhost:8888/wd/hub'),
        }),
      ],
    };
  }

  runIntegrationTests(createConfig, {
    basic: true,
    many: true,
    focus: false,
    groups: true,
    parallel: true,
    testFailure: true,
    // FIXME: timed out with selenium-standalone v7
    locationChanged: false,
  });
});
