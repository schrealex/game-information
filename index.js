const express = require('express');
const https = require('https');
const cors = require('cors');
let hltb = require('howlongtobeat');

const app = express();
const port = 3000;

let hltbService = new hltb.HowLongToBeatService();

app.use(cors());

app.get('/', (req, res) => {
  res.send('Game Information API');
});

app.listen(port, () => {
  console.log(`Server running on ${port}, http://localhost:${port}`);
});

app.get('/get-game-info', (request, response) => {
  const gameTitle = request.query.title;

  hltbService.search(gameTitle).then(result => {
    response.status(200).send(result);
  });
});
