import React, { useState } from 'react';
import classNames from 'classnames';
import styles from './App.module.css';
import { API_URL } from './config';

const FormAdd = ({ onAdd }) => {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const request = await fetch(`${API_URL}/route/?dep=${fromText}&arr=${toText}`);
      const geojson = await request.json();
      onAdd({ fromText, toText, geojson });
      setLoading(false);
      setFromText('');
      setToText('');
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <form className="columns" onSubmit={onSubmit}>
      <div className="column field is-horizontal is-one-quarter is-offset-one-quarter">
        <div className="field-label is-normal">
          <label className="label">From</label>
        </div>
        <div className="field-body">
          <div className="field">
            <input className="input" type="text" placeholder="Paris Nord" value={fromText} onChange={e => setFromText(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="column field is-horizontal is-one-quarter">
        <div className="field-label is-normal">
          <label className="label">To</label>
        </div>
        <div className="field-body">
          <div className="field">
            <input className="input" type="text" placeholder="Berlin" value={toText} onChange={e => setToText(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="column">
        <button className={classNames('button is-primary', { 'is-loading': loading })} type="submit" disabled={!fromText || !toText}>Add</button>
      </div>
    </form>
  );
};

const Trips = ({ trips, onRemove }) => {
  if (trips.length === 0) {
    return null;
  }

  return (
    <div className="columns">
      <div className="column is-half is-offset-one-quarter">
        <table className="table is-fullwidth">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip, i) => (
              <tr key={i}>
                <td>{trip.fromText}</td>
                <td>{trip.toText}</td>
                <td>
                  <button onClick={() => onRemove(i)} className="button is-danger is-small">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const mergeGeojsons = (geojsons) => {
  if (geojsons.length === 0) {
    return '';
  } else if (geojsons.length === 1) {
    return JSON.stringify(geojsons[0]);
  }

  return JSON.stringify({
    "type": "FeatureCollection",
    "features": geojsons,
  });
};

const getFilename = () => {
  const date = new Date();

  return `${date.getFullYear()}${date.getUTCMonth()}${date.getUTCDay()}T${date.getUTCHours()}${date.getUTCMinutes()}${date.getUTCSeconds()}.geojson`;
};

const App = () => {
  const [trips, setTrips] = useState([]);

  const onAdd = (trip) => {
    setTrips(trips => [...trips, trip]);
  };
  const onRemove = (i) => {
    const newTrips = [...trips];
    newTrips.splice(i, 1);
    setTrips(newTrips);
  };

  const geojson = mergeGeojsons(trips.map(trip => trip.geojson));
  const downloadHref = `data:text/json;charset=utf-8,${encodeURIComponent(geojson)}`;

  return (
    <div>
      <h1 className="title has-text-centered">TrainMap</h1>
      <FormAdd onAdd={onAdd} />
      <Trips trips={trips} onRemove={onRemove} />
      <div className={styles.Result}>
        <textarea className="textarea" value={geojson} readOnly />
        <a disabled={!geojson} title="Download as geojson" className="button is-primary" download={getFilename()} href={geojson ? downloadHref : null}>Download</a>
      </div>
    </div>
  );
};

export default App;
