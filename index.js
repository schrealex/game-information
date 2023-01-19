const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = 3000;
// Test 

// let hltbService = new hltb.HowLongToBeatService();

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

const getHLTBInformation = async (searchTerm, year) => {
  const response = await fetch(`https://www.howlongtobeat.com/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://howlongtobeat.com/',
    },
    body: JSON.stringify({
      "searchType": "games",
      "searchTerms": [searchTerm],
      "searchPage": 1,
      "size": 20,
      "searchOptions": {
        "games": {
          "userId": 0,
          "platform": "",
          "sortCategory": "popular",
          "rangeCategory": "main",
          "rangeTime": {
            "min": 0,
            "max": 0
          },
          rangeYear: {
            min: [year],
            max: [year]
          },
          "gameplay": {
            "perspective": "",
            "flow": "",
            "genre": ""
          },
          "modifier": ""
        },
        "users": {
          "sortCategory": "postcount"
        },
        "filter": "",
        "sort": 0,
        "randomizer": 0
      }
    })
  })
  return await response.json();
}
