const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

let chromium = {};
let puppeteer;
if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  // running on the Vercel platform.
  chromium = require('chrome-aws-lambda');
  puppeteer = require('puppeteer-core');
} else {
  // running locally.
  puppeteer = require('puppeteer');
}

const app = express();
const port = 3000;

app.use(cors());

app.get('/', (req, res) => {
  res.send('Game Information API');
});

app.listen(port, () => {
  console.log(`Server running on ${port}, http://localhost:${port}`);
});

app.get('/how-long-to-beat', (request, response) => {
  const searchTerm = request.query.title;
  const year = request.query.year;

  getHLTBInformation(searchTerm, year).then(result => {
    response.status(200).send(result);
  }).catch((error) => {
    if (error.name === 'FetchError') {
      response.status(400).send('Title query wasn\'t given with request');
    } else {
      response.status(500).send(error);
    }
  });
});

app.get('/metacritic', (request, response) => {
  const searchTerm = request.query.title;

  response.set('Access-Control-Allow-Origin', '*');

  getMetacriticInformation(searchTerm).then(result => {
    response.status(200).json(result);
  }).catch((error) => {
    if (error.name === 'FetchError') {
      response.status(400).send('Title query wasn\'t given with request');
    } else {
      response.status(500).send(error);
    }
  });
});

app.get('/nsg-reviews-status', (request, response) => {
  checkNSGReviewsStatus().then(result => {
    if( result.status === 200) {
      response.status(200).send(result);
    } else if (result.status === 503) {
      response.status(503).send({ error: 'NSG Reviews is unavailable' });
    } else {
      response.status(500).send({ error: 'Someting went wrong' });
    }
  }).catch((error) => {
    if (error.name === 'FetchError') {
      response.status(400).send('Title query wasn\'t given with request');
    } else {
      response.status(500).send(error);
    }
  });
});

app.get('/nsg-reviews', (request, response) => {
  getNSGReviewsInformation(request.query.title).then(result => {
      response.status(200).send(result);
  }).catch((error) => {
    if (error.name === 'FetchError') {
      response.status(400).send('Title query wasn\'t given with request');
    } else {
      response.status(500).send(error);
    }
  });
});

const getHLTBInformation = async (searchTerm, year) => {
  const response = await fetch(`https://www.howlongtobeat.com/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://howlongtobeat.com/',
    },
    body: JSON.stringify({
      'searchType': 'games',
      'searchTerms': [searchTerm],
      'searchPage': 1,
      'size': 20,
      'searchOptions': {
        'games': {
          'userId': 0,
          'platform': '',
          'sortCategory': 'popular',
          'rangeCategory': 'main',
          'rangeTime': {
            'min': 0,
            'max': 0
          },
          rangeYear: {
            min: [year],
            max: [year]
          },
          'gameplay': {
            'perspective': '',
            'flow': '',
            'genre': ''
          },
          'modifier': ''
        },
        'users': {
          'sortCategory': 'postcount'
        },
        'filter': '',
        'sort': 0,
        'randomizer': 0
      }
    })
  });
  return await response.json();
};

const getMetacriticInformation = async (searchTerm) => {
  let browser = null;
  let metacriticResults = [];

  await (async () => {
    try {
      if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        browser = await puppeteer.launch({
          args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath,
          headless: 'new',
          ignoreHTTPSErrors: true,
        });
      } else {
        browser = await puppeteer.launch({ headless: 'new' });
      }

      const page = await browser.newPage();
      let metacriticURL = `https://www.metacritic.com/search/${searchTerm}`;
      console.log(`Get Metacritic information with url: ${metacriticURL}`);

      await page.goto(metacriticURL);

      try {
        const textSelector = await page.waitForSelector('text/No Results Found', { timeout: 250 });
        const noResultsFound = await textSelector?.evaluate(el => el.textContent);
        if (noResultsFound) {
          metacriticResults.push(`No results found for ${searchTerm}`);
        }
      } catch (error) {
        if (error.name === 'TimeoutError') {
          const element =  await page.waitForSelector('.c-pageSiteSearch-results', { timeout: 250 });
          if (element) {

            // For debugging purposes
            // page.on('console', async (message) => {
            //   const messageArguments = message.args();
            //   for (let i = 0; i < messageArguments.length; ++i) {
            //     console.log(await messageArguments[i].jsonValue());
            //   }
            // });

            metacriticResults = await page.evaluate( (searchTerm) => {
              const searchResults = [];
              const searchResultsElements = document.querySelector('.c-pageSiteSearch-results').children[1].querySelectorAll('.g-grid-container');
              for (let i = 0; searchResultsElements[i]; i++) {
                const elementText = searchResultsElements[i].textContent;
                // console.log({ searchTerm, title: elementText.trim().split('\n')[0] });
                // if (elementText.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()) && elementText.includes('game')) { // All results containing the search term and are games
                if (elementText.trim().split('\n')[0].toLocaleLowerCase()  === searchTerm.toLocaleLowerCase() && elementText.includes('game')) { // All results with the exact search term and is a game
                  const title = searchResultsElements[i].querySelector('.g-grid-container .u-grid-columns a .u-text-overflow-ellipsis p').textContent.trim();
                  const score = searchResultsElements[i].querySelector('.c-siteReviewScore span').textContent;
                  const url = searchResultsElements[i].querySelector('.g-grid-container .u-grid-columns a').href;

                  searchResults.push({ title, score, url });
                }
              }
              return searchResults;
            }, searchTerm);
          }
        } else {
          metacriticResults.push(error)
        }
      }
    } catch (error) {
      return error;
    } finally {
      if (browser !== null) {
        await browser.close();
      }
    }
  })();
  return metacriticResults;
};

const checkNSGReviewsStatus = async () => {
  return await fetch(`https://www.nsgreviews.com`);
};

const getNSGReviewsInformation = async (searchTerm) => {
  const response = await fetch(`https://www.nsgreviews.com/list/query?search=${searchTerm}&sort=release_date&dir=asc&notuser=true`);
  return await response.json();
};
