const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const chalk = require('chalk');
const parse = require('csv-parse');
const Fuse = require('fuse.js');
const simplifyGeojson = require('simplify-geojson');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.static('front/build'));

const OSRM_URL = 'https://signal.eu.org/osm/eu/route/v1/train';

const stationsById = {};
const stations = [];

const loadingStations = new Promise((resolve, reject) => {
  fs.readFile('./stations.csv', { encoding: 'utf8' }, (err, data) => {
    if (err) {
      reject(err);
      return;
    }

    console.log(`${chalk.blue('[i]')} Loading stations…`);
    parse(data, { columns: true, delimiter: ';' }, (err, s) => {
      s.forEach((station) => {
        if (station['info:fr']) {
          station.name += ` (${station['info:fr']})`;
        }
        stationsById[station.id] = station;
        if (station.is_suggestable === 't') {
          stations.push(station);
        }
      });
      console.log(`${chalk.blue('[.]')} ${chalk.green(`${s.length}`)} stations loaded.`);

      resolve();
    });
  });
});

const readFile = (file) => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const decodepoly = (geom) => {
  let b;
  let delta;
  let lat = 0,
    lng = 0;
  let res, shift;
  let latlngs = [];
  let i = 0;
  while (i < geom.length) {
    res = 0;
    shift = 0;
    do {
      b = geom.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    delta = res >> 1;
    if (res & 1) delta = ~delta;
    lat += delta;

    res = 0;
    shift = 0;
    do {
      b = geom.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    delta = res >> 1;
    if (res & 1) delta = ~delta;
    lng += delta;

    latlngs.push([lng / 1e5, lat / 1e5]);
  }
  return latlngs;
};

app.get('/api/stations', (req, res) => {
  const name = req.query.name;
  const countries = (req.query.countries || '')
    .split(',')
    .filter((country) => !!country)
    .map((country) => country.toUpperCase());

  const stationsToSearch =
    countries.length === 0 ? stations : stations.filter(({ country }) => countries.includes(country));

  const options = {
    shouldSort: true,
    findAllMatches: true,
    includeScore: true,
    includeMatches: true,
    threshold: 0.4,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 3,
    keys: ['name', 'slug'],
  };
  const fuse = new Fuse(stationsToSearch, options);
  const result = fuse.search(name);
  res.send(result.slice(0, 10));
});

app.get('/api/route', async (req, res) => {
  let { dep, arr, simplify } = req.query;
  if (stationsById[dep] && stationsById[arr]) {
    dep = stationsById[dep].longitude + ',' + stationsById[dep].latitude;
    arr = stationsById[arr].longitude + ',' + stationsById[arr].latitude;
  }

  dep = dep.replace(/[^0-9,.-]/g, '');
  arr = arr.replace(/[^0-9,.-]/g, '');

  if (dep === '2.320514,48.841172') {
    dep = '2.318630,48.839526';
  }
  if (arr === '2.320514,48.841172') {
    arr = '2.318630,48.839526';
  }

  const id = `${dep}-${arr}`;
  const file = `./data/${id}.json`;

  try {
    let data;
    if (fs.existsSync(file)) {
      data = JSON.parse(await readFile(file));
    } else {
      const response = await axios.get(`${OSRM_URL}/${dep};${arr}`);
      data = response.data;
      fs.writeFile(file, JSON.stringify(data), { encoding: 'utf8' }, () => {});
    }

    if (data.routes.length > 0) {
      const coordinates = decodepoly(data.routes[0].geometry);
      const geojson = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
      };
      const finalGeojson = simplify == '1' ? simplifyGeojson(geojson, 0.01) : geojson;
      res.send(finalGeojson);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error(error);
    res.status(500);
    res.send('Error ' + error.message);
  }
});

loadingStations.then(() => {
  app.listen(port, () =>
    console.log(`${chalk.green('[✓]')} Train routing server listening on port ${chalk.green(`${port}`)}!`),
  );
});
