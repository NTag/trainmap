import React, { useState, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import Autosuggest from 'react-autosuggest';
import styles from './App.module.css';
import suggestTheme from './Typeahead.module.css';
import { API_URL } from './config';

const debounce = (func, delay) => {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

const renderSuggestion = (suggestion) => (
  <div>
    {suggestion.item.name}
  </div>
);
const getSuggestionValue = (suggestion) => suggestion.item.name;

const StationInput = ({ placeholder, onSelected, selected }) => {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!selected) {
      setText('');
    }
  }, [selected]);

  const fetchSuggestions = async ({ value }) => {
    const response = await fetch(`${API_URL}/stations?name=${value}`);
    const data = await response.json();
    setSuggestions(data);
  };
  const onSuggestionsClearRequested = () => {
    setSuggestions([]);
  };
  const onSuggestionsFetchRequested = useCallback(debounce(fetchSuggestions, 200), []);

  return (
    <Autosuggest
      theme={suggestTheme}
      suggestions={suggestions}
      onSuggestionsFetchRequested={debounce(onSuggestionsFetchRequested, 200)}
      onSuggestionsClearRequested={onSuggestionsClearRequested}
      getSuggestionValue={getSuggestionValue}
      renderSuggestion={renderSuggestion}
      onSuggestionSelected={(event, { suggestion }) => onSelected(suggestion.item)}
      inputProps={{
        className: 'input',
        placeholder,
        value: text,
        onChange: (e, { newValue }) => setText(newValue),
      }}
    />
  );
};

const FormAdd = ({ onAdd }) => {
  const [fromStation, setFromStation] = useState();
  const [toStation, setToStation] = useState();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const request = await fetch(`${API_URL}/route/?simplify=1&dep=${fromStation.id}&arr=${toStation.id}`);
      const geojson = await request.json();
      onAdd({ fromText: fromStation.name, toText: toStation.name, geojson });
      setLoading(false);
      setFromStation();
      setToStation();
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
            <StationInput placeholder="Paris Nord" onSelected={setFromStation} selected={!!fromStation} />
          </div>
        </div>
      </div>
      <div className="column field is-horizontal is-one-quarter">
        <div className="field-label is-normal">
          <label className="label">To</label>
        </div>
        <div className="field-body">
          <div className="field">
            <StationInput placeholder="Berlin Hbf" onSelected={setToStation} selected={!!toStation} />
          </div>
        </div>
      </div>
      <div className="column">
        <button className={classNames('button is-primary', { 'is-loading': loading })} type="submit" disabled={!fromStation || !toStation}>Add</button>
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
      <h3 className="subtitle has-text-centered">
        <a title="This project is open-source" href="https://github.com/NTag/trainmap" target="_blank" rel="noopener noreferrer">Github</a>
        {' • '}
        Everything comes from <a title="Final logic comes entirely from Raildar ❤️" href="http://raildar.fr/osrm/osrm.html" target="_blank" rel="noopener noreferrer">Raildar</a>
      </h3>
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
