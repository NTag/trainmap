const express         = require('express');
const axios           = require('axios');
const cors            = require('cors');
const fs              = require('fs');
const chalk           = require('chalk');
const parse           = require('csv-parse');
const Fuse            = require('fuse.js');
const simplifyGeojson = require('simplify-geojson');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.static('front/build'));

const RAILDAR_URL = 'http://raildar.fr/osrm-engine/viaroute?z=10&output=json&alt=false';

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
      s.forEach(station => {
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
  let lat = 0, lng = 0;
  let res, shift;
  let latlngs = []
  let i = 0;
  while (i < geom.length) {
    res = 0; shift = 0;
    do {
      b = geom.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    delta = res >> 1;
    if (res & 1) delta = ~delta
    lat += delta;

    res = 0; shift = 0;
    do {
      b = geom.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    delta = res >> 1;
    if (res & 1) delta = ~delta
    lng += delta;

    latlngs.push([lng/1e6, lat/1e6]);
  }
  return latlngs;
};

app.get('/api/stations', (req, res) => {
  const name = req.query.name;

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
    keys: [
      'name',
      'slug',
    ],
  };
  const fuse = new Fuse(stations, options);
  const result = fuse.search(name);
  res.send(result.slice(0, 10));
});

app.get('/api/route', async (req, res) => {
  let { dep, arr, simplify } = req.query;
  if (stationsById[dep] && stationsById[arr]) {
    dep = stationsById[dep].latitude + ',' + stationsById[dep].longitude;
    arr = stationsById[arr].latitude + ',' + stationsById[arr].longitude;
  }

  if (dep === '48.841172,2.320514') {
    dep = '48.839526,2.318630';
  }
  if (arr === '48.841172,2.320514') {
    arr = '48.839526,2.318630';
  }

  const id = `${dep}-${arr}`;
  const file = `./data/${id}.json`;

  try {
    let data;
    if (fs.existsSync(file)) {
      data = JSON.parse(await readFile(file));
    } else {
      const response = await axios.get(RAILDAR_URL + `&loc=${dep}&loc=${arr}`);
      data = response.data;
      fs.writeFile(file, JSON.stringify(data), { encoding: 'utf8' }, () => {});
    }

    if (data.route_geometry) {
      const coordinates = decodepoly(data.route_geometry);
      const geojson = {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [coordinates],
        },
      };
      const finalGeojson = simplify == '1' ? simplifyGeojson(geojson, 0.01) : geojson;
      res.send(finalGeojson);
    } else {
      res.sendStatus(404);
    }
  } catch(error) {
    console.error(error);
    res.status(500);
    res.send('Error ' + error.message);
  }
});

loadingStations.then(() => {
  app.listen(port, () => console.log(`${chalk.green('[✓]')} Train routing server listening on port ${chalk.green(`${port}`)}!`));
});
