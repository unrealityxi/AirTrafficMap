import style from "./styles/style.scss";

/**
 * AIRCRAFT RADAR V 1.0
 * 
 * Charts currently flying aircrafts on world map, 
 * with basic aircraft information available on 
 * clicking airplane icon.
 * 
 */


(function() {
  "use strict";
  let CORSBypassAddress = "https://cors-anywhere.herokuapp.com/";

  const USER_IP_DATA_URL = "https://api.ipdata.co/?api-key=test";
  const openSky = "https://opensky-network.org/api/states/all";
  const virtualRadar = CORSBypassAddress + "https://public-api.adsbexchange.com/VirtualRadar/AircraftList.json";
  const AIR_DATA_URL = openSky;

  // refresh rate of the map in MS
  const AUTOREFRESH = 5000;

  let map;
  let popupOverlay;
  /**
   * Elements that make the popup.
   */
  let popup = document.getElementById("popup");
  let popupBody = document.getElementById("popup-content");
  let closePopupButton = document.getElementById("popup-closer");

  /**
   *
   * @param {string} URL
   * Fetches data from given URL
   */
  function get(URL) {
    return fetch(URL).then(function(response) {
      return response.json();
    });
  }

  /**
   *
   * @param geoIpData Information on users IP address including lon and lat
   *
   * Returns user coords object {lat, lon}
   */
  function getUserCoordinates(geoIpData) {
    let userCoordinates = { lat: geoIpData.latitude, lon: geoIpData.longitude };
    return userCoordinates;
  }

  /**
   *
   * @param {lon, lat} coords
   *
   * Creates, configures, and draws OpenLayer map at
   * div with id "map", with area at @coords in focus
   */
  function drawInitialMap(coords) {
    popupOverlay = new ol.Overlay({
      element: popup,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    });

    map = new ol.Map({
      target: "map",
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM({ crossOrigin: "anonymous" })
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([coords.lon, coords.lat]),
        zoom: 9
      }),
      overlays: [popupOverlay]
    });

    registerMapEventHandlers();

    return map;
  }

  function registerMapEventHandlers() {
    // Registers click handler for airplane icon
    map.on("click", function(e) {
      let icon = map.getFeaturesAtPixel(e.pixel);
      if (!icon) return popupOverlay.setPosition(undefined);

      let plane = icon[0];
      let coordinate = e.coordinate; // click coords for location of the popup
      popupOverlay.setPosition(coordinate);
      setPopupContent(plane.airplaneData);
    });

    // Shows that plane icon is clickable by changing cursor to pointer
    map.on("pointermove", function(evt) {

      let showPointer = map.hasFeatureAtPixel(evt.pixel);
      if (showPointer) {
        map.getTargetElement().style.cursor = "pointer"
      } else {
        map.getTargetElement().style.cursor = "auto"
      }
      
    });

    closePopupButton.onclick = function() {
      popupOverlay.setPosition(undefined);
      closePopupButton.blur();
      return false;
    };
  }

  /**
   *
   * @param {[...]} airplaneData Mixed array of aircraft metadata
   *
   * Each index in array represents certain aircraft property
   * ie 5 lat, 6 lon ...
   *
   * See OpenSky API for more details
   */
  function setPopupContent(airplaneData) {
    popupBody.innerHTML = `
    <div class='column'>Callsign </div><div class='column left'> ${
      airplaneData[1]
    }</div>
  <div class='column'>From </div><div class='column left'> ${
      airplaneData[2]
    }</div>
  <div class='column'>Latitude </div><div class='column left'> ${
      airplaneData[5]
    } °</div>
  <div class='column'>Longitude </div><div class='column left'> ${
      airplaneData[6]
    } °</div>
  `;
  }

  /**
   *
   * @param {*} flightData JSON response from OpenSky API
   * @param {*} oldDataLayer OpenLayers vector layer charting currently visible aircrafts
   *
   * Parses and updates air traffic data periodically.
   */
  function processAirTrafficData(flightData, oldDataLayer) {
    hideLoader();

    let airplaneMarkers = getAirplaneMarkers(flightData);
    let flightDataOverlay = getFlightDataOverlay(airplaneMarkers);

    // Updates map with new data
    map.removeLayer(oldDataLayer);
    map.addLayer(flightDataOverlay);

    // request update of data and refresh the map.
    return setTimeout(() => {
      get(AIR_DATA_URL).then(data =>
        processAirTrafficData(data, flightDataOverlay)
      )
    }, AUTOREFRESH );
  }

  /**
   *
   * @param {markers []} airplaneMarkers Array of openLayer markers
   *
   * Creates an OL overlay from marker icon array
   */
  function getFlightDataOverlay(airplaneMarkers) {
    let vectorSource = new ol.source.Vector({
      features: airplaneMarkers
    });

    let markerVectorLayer = new ol.layer.Vector({
      source: vectorSource
    });

    return markerVectorLayer;
  }

  /**
   *
   * @param {[...[]]} flightData Array of openSky flight information
   *
   * Creates array of OpenLayer icon markers with each entry
   * representing location and direction of one airplane.
   */
  function getAirplaneMarkers(flightData) {
    let airplaneMarkers = [];

    flightData.states.forEach(state => {
      let lon = state[5];
      let lat = state[6];
      let rotation = state[10];

      if (!lat || !lon || !rotation) {
        return;
      }

      lon = Number(lon);
      lat = Number(lat);
      rotation = decimalDegreesToRadians(rotation);
      let planeIcon = createPlaneIcon([lon, lat], rotation);
      // Adds all aircraft data onto icon object
      // making it available to read on click on said object
      planeIcon.airplaneData = state;
      airplaneMarkers.push(planeIcon);
    });

    return airplaneMarkers;
  }

  /**
   *
   * @param {[lat, lon]} coords
   * @param {radians} rotation
   *
   * Creates OL icon representing an airplane.
   */
  function createPlaneIcon(coords, rotation) {
    // creates airplane icon
    let planeIcon = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat(coords))
    });
    // styles icon and sets rotation angle
    planeIcon.setStyle(
      new ol.style.Style({
        image: new ol.style.Icon(
          /** @type {module:ol/style/Icon~Options} */ ({
            rotation: rotation,
            src:
              "http://www.iconninja.com/files/165/574/453/plane-airport-air-airplane-icon.png",
            size: [128, 128],
            scale: 0.2
          })
        )
      })
    );

    return planeIcon;
  }

  /**
   *
   * @param {decimalDegrees} dd
   *
   * Rough conversion of decimal degrees to radians.
   */
  function decimalDegreesToRadians(dd) {
    let absDd = Math.abs(dd);
    let deg = absDd | 0;
    return deg * (Math.PI / 180);
  }

  function showLoader(message, color = null) {
    let loader = document.querySelector(".loader-message");
    loader.innerHTML = message;
    if (color) {
      loader.classList.add(color);
    }
  }

  function hideLoader() {
    let loader = document.querySelector(".loader");
    loader.classList.add("invisible");
    // loader.style.display = "none";
    setTimeout(() => loader.classList.add("hidden"), 2000);
  }

  /**
   * Gets everything runing.
   */
  showLoader("Gettin your IP address");
  get(USER_IP_DATA_URL)
    .then(getUserCoordinates)
    .then(drawInitialMap)
    .then(mapAPI => {
      showLoader("Getting airplane data");
      return get(AIR_DATA_URL);
    })
    .then(processAirTrafficData)
    .catch(e => console.log(e));
})();