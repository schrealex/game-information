const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

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

  getMetacriticInformation(searchTerm).then(result => {
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
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const listPageData = [];

    await page.goto(`https://www.metacritic.com/search/game/${searchTerm}/results`, { waitUntil: 'load' });

    let searchResultsVisible = await page.$('.module.search_results') !== null;

    while (searchResultsVisible) {
      await page.waitForSelector('.search_results.module > .result.first_result');

      const gameResults = await page.$$('.search_results.module > .result');

      for (const [index, gameResult] of gameResults.entries()) {
        const title = await page.evaluate((element) => element.querySelector('.product_title.basic_stat > a').textContent, gameResult);
        const metacriticScore = await page.evaluate((element) => element.querySelector('.metascore_w').textContent, gameResult);
        const url = await page.evaluate((element) => element.querySelector('.product_title.basic_stat a[href]').href, gameResult);

        listPageData.push({
          title: title.trim(),
          metacriticScore: metacriticScore.trim(),
          pageUrl: url.trim()
        });
        searchResultsVisible = index < (gameResults.length - 1);
        console.log({ searchResultsVisible, listPageData });
      }
    }
    await browser.close();
    return await JSON.parse(JSON.stringify(listPageData));
  } catch (error) {
    console.log(error);
  }
};
