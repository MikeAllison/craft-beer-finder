/***************
  Search config
****************/

var app = app || {};

(function() {

  app.config = {
    init: function() {
      this.settings = {
        search: {
          // itemType - Can change: This can be set to anything that you'd like to search for (i.e. 'craft beer' or 'brewery')
          itemType: 'craft beer',

          // rankBy -  Can change: Can be either google.maps.places.RankBy.DISTANCE or google.maps.places.RankBy.PROMINENCE (not a string)
          rankBy: google.maps.places.RankBy.DISTANCE,

          // unitSystem - Can change: Can be either google.maps.UnitSystem.IMPERIAL or google.maps.UnitSystem.METRIC
          unitSystem: google.maps.UnitSystem.IMPERIAL,

          // orderByDistance - Can change: Setting 'true' will force a reordering of results by distance (results from Google's RankBy.DISTANCE aren't always in order)
          // Set to 'false' if using 'rankBy: google.maps.places.RankBy.PROMINENCE' and don't want results ordered by distance
          // Sometimes using 'RankBy.PROMINENCE' and 'orderByDistance: true' returns the most accurate results by distance
          orderByDistance: true,

          // radius - Can change: Radius is required if rankBy is set to google.maps.places.RankBy.PROMINENCE (max: 50000)
          radius: '25000',

          // SEARCH SORTING/FILTERING:
          // These settings will help narrow down to relevant results
          // Types (primaryTypes/secondaryTypes/excludedTypes) can be any Google Place Type: https://developers.google.com/places/supported_types

          // primaryTypes - Any result having these types will be sorted and listed first (examples: [], ['type1'], ['type1, 'type2'], etc.)
          primaryTypes: ['bar', 'liquor_store'],

          // secondaryTypes: Any result having these types will be listed after primaryTypes (examples: [], ['type1'], ['type1, 'type2'], etc.)
          secondaryTypes: ['restaurant'],

          // excludedTypes: Any result having these types will excluded from the results (examples: [], ['type1'], ['type1, 'type2'], etc.)
          excludedTypes: []
        }
      };
      // Set your API key for Google Maps services
      this.google = {
        apiKey: 'AIzaSyDL1jtXcarRSvWvqBa54WVLqIbxG3aTICY'
      };
      this.google.geocodingAPI = {
        reqURL: 'https://maps.googleapis.com/maps/api/geocode/json?'
      };
    }
  };

})();

/********************************************************************
  formSearch() - Controls the flow of a search initiated by the form
*********************************************************************/

(function() {

  app.controllers = app.controllers || {};

  app.controllers.formSearch = function() {
    var tboxVal = app.views.form.cityStateTbox.value;
    if (!tboxVal) {
      app.views.alerts.show('error', 'Please enter a location.');
      app.views.page.enableButtons();
      return;
    }

    app.views.progressModal.start('Getting Location');

    app.models.searchLoc.isGeoSearch = false;

    app.modules.getGeocode(tboxVal)
      .then(function(response) {
        app.views.progressModal.update(25, 'Requesting Places');

        app.models.searchLoc.lat = response.results[0].geometry.location.lat;
        app.models.searchLoc.lng = response.results[0].geometry.location.lng;

        var address = response.results[0].formatted_address.replace(/((\s\d+)?,\sUSA)/i, '');
        address = address.split(/,\s/);
        app.models.searchLoc.city = address.shift();
        app.models.searchLoc.state = address.pop();

        return app.modules.reqPlaces(app.models.searchLoc.lat, app.models.searchLoc.lng);
      })
      .then(function(results) {
        app.views.progressModal.update(50, 'Requesting Distances');

        app.models.places.add(results);

        var places = app.models.places.get(),
            placesCoords = [];

        // Push lat, lng for places onto new destinations array ( [{lat, lng}, {lat, lng}] )
        places.forEach(function(place) {
          placesCoords.push({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
        });

        return app.modules.reqMultiDistance(app.models.searchLoc.lat, app.models.searchLoc.lng, placesCoords);
      })
      .then(function(results) {
        app.views.progressModal.update(75, 'Sorting Places');

        var places = app.models.places.get();

        results.rows[0].elements.forEach(function(element, i) {
          if (element.distance) {
            places[i].drivingInfo = {
              value: element.distance.value,
              distance: element.distance.text,
              duration: element.duration.text
            };
          }
        });

        var sortedPlaces = app.modules.sortPlaces(places);

        app.models.places.add(sortedPlaces);
        app.models.searchLoc.totalItems = sortedPlaces.primary.length + sortedPlaces.secondary.length;
        app.models.recentSearches.add(app.models.searchLoc);

        app.views.progressModal.update(99, 'Preparing Results');

        // Smooth the display of results
        window.setTimeout(function() {
          var cityState = app.models.searchLoc.cityState(),
              recentSearches = app.models.recentSearches.get();

          app.views.form.setTboxPlaceholder(cityState);
          app.views.alerts.show('success', app.models.searchLoc.totalItems + ' matches! Click on an item for more details.');
          app.views.results.render(sortedPlaces);
          app.views.recentSearches.render(recentSearches);
          app.views.page.enableButtons();
        }, 999);
      })
      .catch(app.controllers.stopExecution);
  };

})();

/*******************************************************************************************
  geolocationSearch() - Controls the flow of a search initiated by the 'My Location' button
********************************************************************************************/

(function() {

  app.controllers = app.controllers || {};

  app.controllers.geolocationSearch = function() {
    app.views.progressModal.start('Getting Location');

    app.models.searchLoc.isGeoSearch = true;

    app.modules.getCurrentLocation()
      .then(function(position) {
        app.views.progressModal.update(20, 'Getting Location');

        app.models.searchLoc.lat = position.coords.latitude;
        app.models.searchLoc.lng = position.coords.longitude;

        return app.modules.reverseGeocode(app.models.searchLoc.lat, app.models.searchLoc.lng);
      })
      .then(function(response) {
        app.views.progressModal.update(40, 'Requesting Places');

        app.models.searchLoc.city = response.results[0].address_components[2].long_name;
        app.models.searchLoc.state = response.results[0].address_components[4].short_name;

        return app.modules.reqPlaces(app.models.searchLoc.lat, app.models.searchLoc.lng);
      })
      .then(function(results) {
        app.views.progressModal.update(60, 'Requesting Distances');
        app.models.places.add(results);

        var places = app.models.places.get(),
            placesCoords = [];

        // Push lat, lng for places onto new destinations array ( [{lat, lng}, {lat, lng}] )
        places.forEach(function(place) {
          placesCoords.push({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
        });

        return app.modules.reqMultiDistance(app.models.searchLoc.lat, app.models.searchLoc.lng, placesCoords);
      })
      .then(function(results) {
        app.views.progressModal.update(80, 'Sorting Places');
        var places = app.models.places.get();

        results.rows[0].elements.forEach(function(element, i) {
          if (element.distance) {
            places[i].drivingInfo = {
              value: element.distance.value,
              distance: element.distance.text,
              duration: element.duration.text
            };
          }
        });

        var sortedPlaces = app.modules.sortPlaces(places);

        app.models.places.add(sortedPlaces);
        app.models.searchLoc.totalItems = sortedPlaces.primary.length + sortedPlaces.secondary.length;
        app.models.recentSearches.add(app.models.searchLoc);

        app.views.progressModal.update(99, 'Preparing Results');

        // Smooth the display of results
        window.setTimeout(function() {
          var cityState = app.models.searchLoc.cityState(),
              recentSearches = app.models.recentSearches.get();

          app.views.form.setTboxPlaceholder(cityState);
          app.views.alerts.show('success', app.models.searchLoc.totalItems + ' matches! Click on an item for more details.');
          app.views.results.render(sortedPlaces);
          app.views.recentSearches.render(recentSearches);
          app.views.page.enableButtons();
        }, 999);
      })
      .catch(app.controllers.stopExecution);
  };

})();

/****************************************************************************************************
  recentSearch() - Controls the flow of a search initiated by clicking a location in Recent Searches
*****************************************************************************************************/

(function() {

  app.controllers = app.controllers || {};

  app.controllers.recentSearch = function(location) {
    app.views.progressModal.start('Requesting Places');

    app.models.searchLoc.isGeoSearch = false;
    app.models.searchLoc.setBasicDetails(location);

    app.modules.reqPlaces(app.models.searchLoc.lat, app.models.searchLoc.lng)
      .then(function(results) {
        app.views.progressModal.update(33, 'Requesting Distances');

        app.models.places.add(results);

        var places = app.models.places.get(),
            placesCoords = [];

        // Push lat, lng for places onto new destinations array ( [{lat, lng}, {lat, lng}] )
        places.forEach(function(place){
          placesCoords.push({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
        });

        return app.modules.reqMultiDistance(app.models.searchLoc.lat, app.models.searchLoc.lng, placesCoords);
      })
      .then(function(results) {
        app.views.progressModal.update(66, 'Sorting Places');

        var places = app.models.places.get();

        results.rows[0].elements.forEach(function(element, i) {
          if (element.distance) {
            places[i].drivingInfo = {
              value: element.distance.value,
              distance: element.distance.text,
              duration: element.duration.text
            };
          }
        });

        var sortedPlaces = app.modules.sortPlaces(places);

        app.models.places.add(sortedPlaces);
        app.models.searchLoc.totalItems = sortedPlaces.primary.length + sortedPlaces.secondary.length;

        app.views.progressModal.update(99, 'Preparing Results');

        // Smooth the display of results
        window.setTimeout(function() {
          var cityState = app.models.searchLoc.cityState();

          app.views.form.setTboxPlaceholder(cityState);
          app.views.alerts.show('success', app.models.searchLoc.totalItems + ' matches! Click on an item for more details.');
          app.views.results.render(sortedPlaces);
          app.views.page.enableButtons();
        }, 999);
      })
      .catch(app.controllers.stopExecution);
  };

})();

(function() {

  app.controllers = app.controllers || {};

  app.controllers.stopExecution = function(msg) {
    $('#progressModal').modal('hide');
    $('#progressModal').on('hidden.bs.modal', function() {
      app.views.progressModal.init();
    });
    app.views.alerts.show(msg.type, msg.text);
    app.views.results.clear();
    app.views.placeModal.hide();
    app.views.page.enableButtons();
    return;
  };

  /******************************************************************************************
    getDetails() - Controls the flow for acquiring details when a specific place is selected
  *******************************************************************************************/
  app.controllers.getDetails = function(place) {
    app.models.selectedPlace.init();

    var requestedPlace = app.models.places.find(place);

    app.models.selectedPlace.setBasicDetails(requestedPlace);
    app.models.selectedPlace.setDrivingInfo(requestedPlace.drivingInfo.distance, requestedPlace.drivingInfo.duration);

    app.modules.reqPlaceDetails(requestedPlace.place_id)
      .then(function(results) {
        app.models.selectedPlace.setSpecificDetails(results);

        var origin = { lat: app.models.searchLoc.lat, lng: app.models.searchLoc.lng };
        var destination = { lat: app.models.selectedPlace.lat, lng: app.models.selectedPlace.lng };

        return app.modules.reqTransitDistance(origin, destination);
      })
      .then(function(results) {
        var distance, duration;
        // Guard against no transit option to destination
        if (results.rows[0].elements[0].distance && results.rows[0].elements[0].duration) {
          distance = results.rows[0].elements[0].distance.text;
          duration = results.rows[0].elements[0].duration.text;
        }
        // Save distance and duration info
        app.models.selectedPlace.setTransitInfo(distance, duration);

        app.views.placeModal.populate(app.models.selectedPlace);
        app.views.placeModal.show();
      })
      .catch(app.controllers.stopExecution);
  };

  /*****************************************************************************************************
    switchToGeolocation() - Requests distance from your location to a place (triggered from placeModal)
  ******************************************************************************************************/
  app.controllers.switchToGeolocation = function() {
    app.models.searchLoc.isGeoSearch = true;

    app.modules.getCurrentLocation()
      .then(function(position) {
        app.models.searchLoc.lat = position.coords.latitude;
        app.models.searchLoc.lng = position.coords.longitude;

        var origin = {
              lat: app.models.searchLoc.lat,
              lng: app.models.searchLoc.lng
            },
            destination = {
              lat: app.models.selectedPlace.lat,
              lng: app.models.selectedPlace.lng
            };

        return app.modules.reqDrivingDistance(origin, destination);
      })
      .then(function(results) {
        var distance, duration;
        // Guard against no transit option to destination
        if (results.rows[0].elements[0].distance && results.rows[0].elements[0].duration) {
          distance = results.rows[0].elements[0].distance.text;
          duration = results.rows[0].elements[0].duration.text;
        }
        // Save distance and duration info
        app.models.selectedPlace.setDrivingInfo(distance, duration);

        var origin = {
              lat: app.models.searchLoc.lat,
              lng: app.models.searchLoc.lng
            },
            destination = {
              lat: app.models.selectedPlace.lat,
              lng: app.models.selectedPlace.lng
            };

        return app.modules.reqTransitDistance(origin, destination);
      })
      .then(function(results) {
        var distance, duration;
        // Guard against no transit option to destination
        if (results.rows[0].elements[0].distance && results.rows[0].elements[0].duration) {
          distance = results.rows[0].elements[0].distance.text;
          duration = results.rows[0].elements[0].duration.text;
        }
        // Save distance and duration info
        app.models.selectedPlace.setTransitInfo(distance, duration);

        app.views.placeModal.populate(app.models.selectedPlace);
        app.views.placeModal.show();

        var places = app.models.places.get();
        // Flatten to a one-dimensional array
        if (places.primary || places.secondary) {
          places = places.primary.concat(places.secondary);
        }
        // Push lat, lng for places onto new destinations array ( [{lat, lng}, {lat, lng}] )
        var placesCoords = [];
        places.forEach(function(place) {
          placesCoords.push({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
        });

        return app.modules.reqMultiDistance(app.models.searchLoc.lat, app.models.searchLoc.lng, placesCoords);
      })
      .then(function(results) {
        var places = app.models.places.get();

        // Flatten to a one-dimensional array
        if (places.primary || places.secondary) {
          places = places.primary.concat(places.secondary);
        }

        results.rows[0].elements.forEach(function(element, i) {
          if (element.distance) {
            places[i].drivingInfo = {
              value: element.distance.value,
              distance: element.distance.text,
              duration: element.duration.text
            };
          }
        });

        var sortedPlaces = app.modules.sortPlaces(places);

        app.models.places.add(sortedPlaces);
        app.models.searchLoc.totalItems = sortedPlaces.primary.length + sortedPlaces.secondary.length;

        app.views.alerts.show('success', app.models.searchLoc.totalItems + ' matches! Click on an item for more details.');
        app.views.results.render(sortedPlaces);
        app.views.placeModal.init();
      })
      .catch(app.controllers.stopExecution);
  };

})();

/***************
  Start the app
****************/

$(function() {

  app.config.init();

  app.models.searchLoc.init();
  app.models.places.init();

  app.views.page.init();
  app.views.map.init();
  app.views.form.init();
  app.views.locationBtn.init();
  app.views.alerts.init();
  app.views.results.init();
  app.views.recentSearches.init();
  app.views.recentSearches.render(app.models.recentSearches.get());
  app.views.progressModal.init();
  app.views.placeModal.init();

});

/**************
  Places Model
***************/

(function() {

  app.models = app.models || {};

  app.models.places = {
    init: function() {
      sessionStorage.removeItem('places');
    },
    // Adds an array of results of search to sessionStorage
    add: function(places) {
      sessionStorage.setItem('places', JSON.stringify(places));
    },
    // Retrieves an array of results of search from sessionStorage
    get: function() {
      return JSON.parse(sessionStorage.getItem('places'));
    },
    find: function(requestedPlace) {
      var places = this.get(),
          primaryPlaces = places.primary,
          secondaryPlaces = places.secondary;

      for (var i = 0, priLength = primaryPlaces.length; i < priLength; i++) {
        if (primaryPlaces[i].place_id === requestedPlace.place_id) {
          return primaryPlaces[i];
        }
      }

      for (var j = 0, secLength = secondaryPlaces.length; j < secLength; j++) {
        if (secondaryPlaces[j].place_id === requestedPlace.place_id) {
          return secondaryPlaces[j];
        }
      }
    }
  };

})();

/***********************
  Recent Searches Model
************************/

(function() {

  app.models = app.models || {};

  app.models.recentSearches = {
    add: function(searchLoc) {
      var cachedSearches = this.get(),
          newLocation = {};

      if (!cachedSearches) {
        cachedSearches = [];
      } else if (cachedSearches.length >= 5) {
        cachedSearches.pop();
      }

      newLocation.lat = searchLoc.lat;
      newLocation.lng = searchLoc.lng;
      newLocation.city = searchLoc.city;
      newLocation.state = searchLoc.state;
      newLocation.totalItems = searchLoc.totalItems;
      cachedSearches.unshift(newLocation);

      localStorage.setItem('recentSearches', JSON.stringify(cachedSearches));
    },
    get: function() {
      return JSON.parse(localStorage.getItem('recentSearches'));
    }
  };

})();

/***********************
  Search Location Model
************************/

(function() {

  app.models = app.models || {};

  app.models.searchLoc = {
    init: function() {
      this.lat = null;
      this.lng = null;
      this.city = null;
      this.state = null;
      this.totalItems = null;
      this.isGeoSearch = null;
    },
    setBasicDetails: function(location) {
      this.lat = location.lat;
      this.lng = location.lng;
      this.city = location.city;
      this.state = location.state;
      this.totalItems = location.totalItems;
    },
    cityState: function() {
      if (this.city === null || this.state === null) {
        return undefined;
      }
      return this.city + ', ' + this.state;
    }
  };

})();

/**********************
  Selected Place Model
***********************/

(function() {

  app.models = app.models || {};

  app.models.selectedPlace = {
    init: function() {
      this.placeId = null;
      this.lat = null;
      this.lng = null;
      this.name = null;
      this.openNow = null;
      this.website = null;
      this.address = null;
      this.googleMapsUrl = null;
      this.phoneNum = null;
      this.drivingInfo = {};
      this.transitInfo = {};
      this.hoursOpen = null;
    },
    setOpenNow: function(openNow) {
      this.openNow = openNow ? 'Yes' : 'No';
    },
    setWebsite: function(website) {
      this.website = website ? website : '';
    },
    setAddress: function(address) {
      this.address = address.replace(/, United States/i, '');
    },
    setGoogleMapsUrl: function(googleMapsUrl) {
      this.googleMapsUrl = googleMapsUrl ? googleMapsUrl : '';
    },
    setPhoneNum: function(phoneNum) {
      this.phoneNum = phoneNum ? phoneNum : '';
    },
    setDrivingInfo: function(distance, duration) {
      this.drivingInfo.distance = distance ? distance : '';
      this.drivingInfo.duration = duration ? duration : '';
    },
    setTransitInfo: function(distance, duration) {
      this.transitInfo.distance = distance ? distance : '';
      this.transitInfo.duration = duration ? duration : '';
    },
    setHoursOpen: function(hoursOpen) {
      this.hoursOpen = hoursOpen ? hoursOpen : '';
    },
    setBasicDetails: function(place) {
      this.placeId = place.place_id;
      this.lat = place.geometry.location.lat;
      this.lng = place.geometry.location.lng;
      this.name = place.name;
    },
    setSpecificDetails: function(place) {
      this.setWebsite(place.website);
      this.setAddress(place.formatted_address);
      this.setGoogleMapsUrl(place.url);
      this.setPhoneNum(place.formatted_phone_number);
      // This is needed to guard against items without opening_hours
      if (place.opening_hours) {
        this.setOpenNow(place.opening_hours.isOpen());
        this.setHoursOpen(place.opening_hours.weekday_text);
      }
    }
  };

})();

/*************************************************
  Code related to Google Maps Distance Matrix API
**************************************************/

(function() {

  app.modules = app.modules || {};

  /**************************************************************************************************************
    reqMultiDistance() - Requests distance (driving) from Google Maps Distance Matrix for a collection of places
  ***************************************************************************************************************/
  app.modules.reqMultiDistance = function(lat, lng, destinations) {
    return new Promise(function(resolve, reject) {
      var maxDests = 25, // Google's limit of destinations for a single Distance Maxtrix request
          totalReqs = Math.ceil(destinations.length / maxDests),
          groupedResults = {};

      for (i = 1; i <= totalReqs; i++) {
        var reqGroup = [],
            latLngObjs = [];

        reqGroup = destinations.splice(0, maxDests);

        reqGroup.forEach(function(destination) {
          latLngObjs.push(new google.maps.LatLng(destination.lat, destination.lng));
        });

        sendRequest(latLngObjs, i);
      }

      function sendRequest(latLngObjs, reqNum) {
        var service = new google.maps.DistanceMatrixService(),
            params = {
              origins: [new google.maps.LatLng(lat, lng)], // lat, lng from getDistanceMatrix args
              destinations: latLngObjs,
              travelMode: google.maps.TravelMode.DRIVING,
              unitSystem: app.config.settings.search.unitSystem
            };

        service.getDistanceMatrix(params, function(results, status) {
          if (status != google.maps.DistanceMatrixStatus.OK) {
            reject({ type: 'error', text: 'An error occurred. Please try again.' });
            return;
          }

          groupedResults[reqNum] = results;

          resolveResults(groupedResults);
        });
      }

      function resolveResults(groupedResults) {
        var flattenedResults = {
              originAddresses: [],
              destinationAddresses: [],
              rows: [{ elements: [] }]
            };

        // Check to see if all async requests have finished before combining results
        if (Object.keys(groupedResults).length === totalReqs) {
          flattenedResults.originAddresses = groupedResults[1].originAddresses;

          for (i = 1; i <= totalReqs; i++) {
            flattenedResults.destinationAddresses = flattenedResults.destinationAddresses.concat(groupedResults[i].destinationAddresses);
            flattenedResults.rows[0].elements = flattenedResults.rows[0].elements.concat(groupedResults[i].rows[0].elements);
          }

          resolve(flattenedResults);
        }
      }

    });
  };

  /************************************************************************************************************
    reqDrivingDistance() - Requests driving distance from Google Maps Distance Matrix for models.selectedPlace
    origin - a JS object with .lat and .lng keys
    destination - a JS object with .lat and .lng keys
  *************************************************************************************************************/
  app.modules.reqDrivingDistance = function(origin, destination) {
    return new Promise(function(resolve, reject) {
      var service = new google.maps.DistanceMatrixService(),
          params = {
            origins: [new google.maps.LatLng(origin.lat, origin.lng)],
            destinations: [new google.maps.LatLng(destination.lat, destination.lng)],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: app.config.settings.search.unitSystem
          };

      service.getDistanceMatrix(params, callback);

      function callback(results, status) {
        if (status != google.maps.DistanceMatrixStatus.OK) {
          reject({ type: 'error', text: 'An error occurred. Please try again.' });
          return;
        }

        resolve(results);
      }
    });
  };

  /***********************************************************************************************************
    reqTransitDistance() - Requests subway distance from Google Maps Distance Matrix for models.selectedPlace
    origin - a JS object with .lat and .lng keys
    destination - a JS object with .lat and .lng keys
  ************************************************************************************************************/
  app.modules.reqTransitDistance = function(origin, destination) {
    return new Promise(function(resolve, reject) {
      var service = new google.maps.DistanceMatrixService(),
          params = {
            origins: [new google.maps.LatLng(origin.lat, origin.lng)],
            destinations: [new google.maps.LatLng(destination.lat, destination.lng)],
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: { modes: [google.maps.TransitMode.SUBWAY] },
            unitSystem: app.config.settings.search.unitSystem
          };

      service.getDistanceMatrix(params, callback);

      function callback(results, status) {
        if (status != google.maps.DistanceMatrixStatus.OK) {
          reject({ type: 'error', text: 'An error occurred. Please try again.' });
          return;
        }

        resolve(results);
      }
    });
  };

})();

/**************************************
  Code related to Google Geocoding API
***************************************/

(function() {

  app.modules = app.modules || {};

  /******************************************************************************************
    getGeocode() - Takes a city, state and converts it to lat/lng using Google Geocoding API
  *******************************************************************************************/
  app.modules.getGeocode = function(location) {
    return new Promise(function(resolve, reject) {
      // AJAX request for lat/lng for form submission
      var httpRequest = new XMLHttpRequest(),
          params = 'key=' + app.config.google.apiKey + '&address=' + encodeURIComponent(location);

      httpRequest.open('GET', app.config.google.geocodingAPI.reqURL + params, true);

      httpRequest.onload = function() {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
          if (httpRequest.status !== 200) {
            reject({ type: 'error', text: 'An error occurred. Please try again.' });
            return;
          }

          var response = JSON.parse(httpRequest.responseText);
          if (response.status === 'ZERO_RESULTS' || response.results[0].geometry.bounds === undefined) {
            reject({ type: 'error', text: 'Sorry, that location could not be found.' });
            return;
          }

          resolve(response);
        }
      };

      httpRequest.send();
    });
  };

  /******************************************************
    reverseGeocode() - Converts lat/lng to a city, state
  *******************************************************/
  app.modules.reverseGeocode = function(lat, lng) {
    return new Promise(function(resolve, reject) {
      var httpRequest = new XMLHttpRequest(),
          params = 'key=' + app.config.google.apiKey + '&latlng=' + lat + ',' + lng;

      httpRequest.open('GET', app.config.google.geocodingAPI.reqURL + params, true);
      httpRequest.send();

      httpRequest.onload = function() {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
          if (httpRequest.status !== 200) {
            reject({ type: 'error', text: 'An error occurred. Please try again.' });
            return;
          }

          var response = JSON.parse(httpRequest.responseText);

          resolve(response);
        }
      };
    });
  };

})();

/***********************************
  Code related to HTML5 Geolocation
************************************/

(function() {

  app.modules = app.modules || {};

  /*************************************************************************************
    getCurrentLocation() - HTML5 geocoding request for lat/lng for 'My Location' button
  **************************************************************************************/
  app.modules.getCurrentLocation = function() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) {
        reject({ type: 'error', text: 'Sorry, geolocation is not supported in your browser.' });
        return;
      }

      var success = function(position) {
        resolve(position);
      };

      var error = function() {
        reject({ type: 'error', text: 'An error occurred. Please try again.' });
        return;
      };

      var options = { enableHighAccuracy: true };

      navigator.geolocation.getCurrentPosition(success, error, options);
    });
  };

})();

/***********************************
  Code related to Google Places API
************************************/

(function() {

  app.modules = app.modules || {};

  /****************************************************
    reqPlaces() - Sends a lat/lng to Google Places API
  *****************************************************/
  app.modules.reqPlaces = function(lat, lng) {
    return new Promise(function(resolve, reject) {
      // Google map isn't shown on page but is required for PlacesService constructor
      var service = new google.maps.places.PlacesService(app.views.map),
          params = {
            location: new google.maps.LatLng(lat, lng),
            rankBy: app.config.settings.search.rankBy,
            keyword: app.config.settings.search.itemType
          },
          places = [];

      // Radius is required on request if ranked by PROMINENCE
      if (params.rankBy === google.maps.places.RankBy.PROMINENCE) {
        params.radius = app.config.settings.search.radius;
      }

      service.nearbySearch(params, callback);

      function callback(results, status, pagination) {
        if (status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          reject({ type: 'info', text: 'Your request returned no results.' });
          return;
        }

        if (status != google.maps.places.PlacesServiceStatus.OK) {
          reject({ type: 'error', text: 'An error occurred. Please try again.' });
          return;
        }

        places = places.concat(results);

        if (pagination.hasNextPage) {
          pagination.nextPage();
        } else {
          resolve(places);
        }

      }
    });
  };

  /****************************************************************************
    reqPlaceDetails() - This requests details of the selectedPlace from Google
  *****************************************************************************/
  app.modules.reqPlaceDetails = function(placeId) {
    return new Promise(function(resolve, reject) {
      // Google map isn't shown on page but is required for PlacesService constructor
      var service = new google.maps.places.PlacesService(app.views.map),
          params = { placeId: placeId };

      service.getDetails(params, callback);

      function callback(results, status) {
        if (status != google.maps.places.PlacesServiceStatus.OK) {
          reject({ type: 'error', text: 'An error occurred. Please try again.' });
          return;
        }

        resolve(results);
      }
    });
  };

})();

/*********************************
  Code related to sorting results
**********************************/

(function() {

  app.modules = app.modules || {};

  /***************************************************
    insertionSort() - Sorts place results by distance
  ****************************************************/
  app.modules.insertionSort = function(unsorted) {
    var length = unsorted.length;

    for (var i = 0; i < length; i++) {
      var temp = unsorted[i];

      for (var j = i-1; j >= 0 && (parseFloat(unsorted[j].drivingInfo.value) > parseFloat(temp.drivingInfo.value)); j--) {
        unsorted[j+1] = unsorted[j];
      }

      unsorted[j+1] = temp;
    }
  };

  /******************************************************************
    sortPlaces() - Handles processing of places returned from Google
  *******************************************************************/
  app.modules.sortPlaces = function(places) {
    var primaryTypes = app.config.settings.search.primaryTypes,
        secondaryTypes = app.config.settings.search.secondaryTypes,
        excludedTypes = app.config.settings.search.excludedTypes,
        primaryResults = [],
        secondaryResults = [],
        sortedResults = { primary: null, secondary: null };

    // Sorts results based on relevent/exlcuded categories in app.config.settings.search
    for (var i = 0, length = places.length; i < length; i++) {
      var hasPrimaryType = false,
          hasSecondaryType = false,
          hasExcludedType = false;

      // Check for primary types and push onto array for primary results
      primaryTypes.forEach(function(primaryType) {
        if (places[i].types.includes(primaryType)) {
          hasPrimaryType = true;
        }
      });
      // Push onto the array
      if (hasPrimaryType) {
        primaryResults.push(places[i]);
      }

      // If the primary array doesn't contain the result, check for secondary types...
      // ...but make sure that it doesn't have a type on the excluded list
      if (!primaryResults.includes(places[i])) {
        secondaryTypes.forEach(function(secondaryType) {
          if (places[i].types.includes(secondaryType)) {
            hasSecondaryType = true;

            excludedTypes.forEach(function(excludedType) {
              if(places[i].types.includes(excludedType)) {
                hasExcludedType = true;
              }
            });
          }
        });

        // Push onto array for secondary results if it has a secondary (without excluded) type
        if (hasSecondaryType && !hasExcludedType) {
          secondaryResults.push(places[i]);
        }
      }
    }

    // Re-sort option because Google doesn't always return places by distance accurately
    if (app.config.settings.search.orderByDistance) {
      app.modules.insertionSort(primaryResults);
      app.modules.insertionSort(secondaryResults);
    }

    if (primaryResults.length === 0 && secondaryResults.length === 0) {
      reject({ type: 'info', text: 'Your request returned no results.' });
      return;
    }

    sortedResults.primary = primaryResults;
    sortedResults.secondary = secondaryResults;

    return sortedResults;
  };

})();

/**********************
  Code for page alerts
***********************/

(function() {

  app.views = app.views || {};

  app.views.alerts = {
    init: function() {
      // Collect DOM elements
      this.alert = document.getElementById('alert');
      // Set default values
      this.alert.classList.add('hidden');
    },
    clear: function() {
      this.alert = document.getElementById('alert');
      this.alert.classList.add('hidden');

      var alertTypes = ['alert-danger', 'alert-info', 'alert-success'];
      for (var i = 0, length = alertTypes.length; i < length; i++) {
        this.alert.classList.remove(alertTypes[i]);
      }
      
      this.alert.textContent = null;
    },
    show: function(type, msg) {
      var alertClass;

      if (type === 'error') {
        alertClass = 'alert-danger';
      } else if (type === 'info') {
        alertClass = 'alert-info';
      } else if (type === 'success') {
        alertClass = 'alert-success';
      }

      this.alert.textContent = msg;
      this.alert.classList.add(alertClass);
      this.alert.classList.remove('hidden');
    }
  };

})();

/*******************************
  Code for the form and buttons
********************************/

(function() {

  app.views = app.views || {};

  // City/State Form
  app.views.form = {
    init: function() {
      // Collect DOM elements
      this.cityStateTbox = document.getElementById('cityStateTbox');
      this.searchBtn = document.getElementById('searchBtn');
      // Set default values
      this.cityStateTbox.setAttribute('autofocus', true);
      this.cityStateTbox.setAttribute('placeholder', 'New York, NY');
      // Add click handlers
      this.cityStateTbox.addEventListener('click', function() {
        this.value = null;
      });
      this.cityStateTbox.addEventListener('keyup', function(e) {
        if (e.keyCode === 13) {
          app.views.page.disableButtons();
          app.views.page.clear();
          $('#resultsTab').tab('show');
          app.controllers.formSearch();
        }
      });
      this.searchBtn.addEventListener('click', function() {
        app.views.page.disableButtons();
        app.views.page.clear();
        $('#resultsTab').tab('show');
        app.controllers.formSearch();
      });
    },
    setTboxPlaceholder: function(cityState) {
      this.cityStateTbox.value = null;
      this.cityStateTbox.setAttribute('placeholder', cityState);
    },
    disableSearchBtn: function() {
      this.searchBtn.setAttribute('disabled', true);
    },
    enableSearchBtn: function() {
      this.searchBtn.removeAttribute('disabled');
    }
  };

  // Location Button
  app.views.locationBtn = {
    init: function() {
      // Collect DOM elements
      this.locationBtn = document.getElementById('locationBtn');
      // Add click handlers
      this.locationBtn.addEventListener('click', function() {
        app.views.page.disableButtons();
        app.views.page.clear();
        $('#resultsTab').tab('show');
        app.controllers.geolocationSearch();
      });
    },
    disable: function() {
      this.locationBtn.setAttribute('disabled', true);
    },
    enable: function() {
      this.locationBtn.removeAttribute('disabled');
    }
  };

})();

/********************************************
  Code interacting with elements on the page
*********************************************/

(function() {

  app.views = app.views || {};

  // Google Map's map object (needed for API but not displayed on page)
  app.views.map = {
    init: function() {
      // Collect DOM elements
      app.views.map = document.getElementById('map');
    }
  };

  // Control multiple items on the page
  app.views.page = {
    init: function() {
      // Initialize page settings
      var searchItemTypeCaps = '',
          searchItemTypes = app.config.settings.search.itemType.split(/\s+/);

      searchItemTypes.forEach(function(searchItemType, i) {
        searchItemTypeCaps += ' ' + searchItemType.charAt(0).toUpperCase() + searchItemType.slice(1);
      });

      var pageTitle = searchItemTypeCaps + ' Locator';

      document.title = pageTitle;
      document.getElementById('heading').textContent = pageTitle;
    },
    clear: function() {
      app.views.alerts.clear();
      app.views.results.clear();
    },
    disableButtons: function() {
      app.views.form.disableSearchBtn();
      app.views.locationBtn.disable();
    },
    enableButtons: function() {
      app.views.form.enableSearchBtn();
      app.views.locationBtn.enable();
    }
  };

})();

/****************************************
  Code for the modal of a selected place
*****************************************/

(function() {

  app.views = app.views || {};

  // Modal that displays details when selecting a place
  app.views.placeModal = {
    init: function() {
      this.placeModal = document.getElementById('placeModal');
      this.placeModalTitle = document.getElementById('placeModalTitle');
      this.placeModalOpenNow = document.getElementById('placeModalOpenNow');
      this.placeModalWebsite = document.getElementById('placeModalWebsite');
      this.placeModalAddress = document.getElementById('placeModalAddress');
      this.placeModalPhoneNum = document.getElementById('placeModalPhoneNum');
      this.placeModalDrivingInfo = document.getElementById('placeModalDrivingInfo');
      this.placeModalDistanceWarning = document.getElementById('placeModalDistanceWarning');
      this.placeModalTransitInfo = document.getElementById('placeModalTransitInfo');
      this.placeModalHoursOpen = document.getElementById('placeModalHoursOpen');
      // Set default values
      this.placeModalDistanceWarning.classList.add('hidden');
      this.placeModalDistanceWarning.innerHTML = 'These transit times reflect ' +
        'the distance from the city in your search.<br>Click this message to ' +
        'update the search results to show transit times from your current location.';
    },
    populate: function(selectedPlace) {
      // Reset hidden fields on each render
      var sections = document.getElementById('placeModalBody').children;
      for (var i = 0, length = sections.length; i < length; i++) {
        sections[i].classList.remove('hidden');
      }

      var currentDay = new Date().getDay();
      // Adjust to start week on Monday for hoursOpen
      currentDay -= 1;
      // Adjust for Sundays: JS uses a value of 0 and Google uses a value of 6
      currentDay = currentDay === -1 ? 6 : currentDay;
      this.placeModalTitle.textContent = selectedPlace.name;

      if (selectedPlace.openNow) {
        this.placeModalOpenNow.textContent = selectedPlace.openNow;
      } else {
        this.placeModalOpenNow.parentElement.classList.add('hidden');
      }

      if (selectedPlace.website) {
        this.placeModalWebsite.setAttribute('href', selectedPlace.website);
        this.placeModalWebsite.textContent = selectedPlace.website;
      } else {
        this.placeModalWebsite.parentElement.classList.add('hidden');
      }

      if (selectedPlace.address) {
        this.placeModalAddress.setAttribute('href', selectedPlace.googleMapsUrl);
        this.placeModalAddress.textContent = selectedPlace.address;
      } else {
        this.placeModalAddress.parentElement.classList.add('hidden');
      }

      if (selectedPlace.phoneNum) {
        this.placeModalPhoneNum.setAttribute('href', 'tel:' + selectedPlace.phoneNum);
        this.placeModalPhoneNum.textContent = selectedPlace.phoneNum;
      } else {
        this.placeModalPhoneNum.parentElement.classList.add('hidden');
      }

      // Only show message if geolocation search isn't being used
      if (app.models.searchLoc.isGeoSearch) {
        this.placeModalDistanceWarning.classList.add('hidden');
      }

      this.placeModalDistanceWarning.addEventListener('mouseover', function() {
        this.classList.add('hovered');
      });

      this.placeModalDistanceWarning.addEventListener('mouseout', function() {
        this.classList.remove('hovered');
        this.classList.remove('clicked');
      });

      this.placeModalDistanceWarning.addEventListener('click', function() {
        this.classList.add('clicked');
        this.textContent = 'Updating...';

        app.controllers.switchToGeolocation();
      });

      if (selectedPlace.drivingInfo.duration || selectedPlace.drivingInfo.distance) {
        this.placeModalDrivingInfo.textContent = selectedPlace.drivingInfo.duration + ' (' + selectedPlace.drivingInfo.distance + ')';
      } else {
        this.placeModalDrivingInfo.textContent = 'No driving options';
      }
      if (selectedPlace.transitInfo.duration || selectedPlace.transitInfo.distance) {
        this.placeModalTransitInfo.textContent = selectedPlace.transitInfo.duration + ' (' + selectedPlace.transitInfo.distance + ')';
      } else {
        this.placeModalTransitInfo.textContent = 'No transit options';
      }

      this.placeModalHoursOpen.textContent = null;
      var hoursOpenFragment = document.createDocumentFragment();
      if (selectedPlace.hoursOpen) {
        for (var j = 0, hrsLength = selectedPlace.hoursOpen.length; j < hrsLength; j++) {
          var li = document.createElement('li');
          // Split hoursOpen on ':'
          var dayTime = selectedPlace.hoursOpen[j].split(/:\s/);
          // <span> is needed to highlight hours for current day
          li.innerHTML = '<span><strong>' + dayTime[0] + ':</strong>' + dayTime[1] + '</span>';
          // Highlight current day of week
          if (j === currentDay) {
            li.classList.add('current-day');
          }
          hoursOpenFragment.appendChild(li);
        }

        this.placeModalHoursOpen.appendChild(hoursOpenFragment);
      } else {
        this.placeModalHoursOpen.parentElement.classList.add('hidden');
      }
    },
    show: function() {
      $('#placeModal').modal('show');
    },
    hide: function() {
      $('#placeModal').modal('hide');
    }
  };

})();

/************************************
  Code for the modal of progress bar
*************************************/

(function() {

  app.views = app.views || {};

  // Progress Modal
  app.views.progressModal = {
    init: function() {
      // Collect DOM elements
      this.progressStatus = document.getElementById('progressStatus');
      this.progressBar = document.getElementById('progressBar');
      // Set default values
      this.progressValue = 0;
      this.message = '';
      this.progressBar.children[0].textContent = "0%";
      this.progressBar.setAttribute('aria-valuenow', '0');
      this.progressBar.setAttribute('aria-valuemin', '0');
      this.progressBar.setAttribute('aria-valuemax', '100');
      this.progressBar.setAttribute('style', 'min-width: 2em; width: 0');
    },
    start: function(message) {
      $('#progressModal').modal('show');

      this.progressValue = 1;
      this.message = message;

      this.progressStatus.textContent = app.views.progressModal.message;

      var updateProgress = window.setInterval(function() {
        if (app.views.progressModal.progressValue >= 100 || app.views.progressModal.progressValue === 0) {
          $('#progressModal').modal('hide');
          $('#progressModal').on('hidden.bs.modal', function() {
            app.views.progressModal.init();
          });
          window.clearInterval(updateProgress);
        }
        this.progressStatus.textContent = app.views.progressModal.message;
        this.progressBar.setAttribute('aria-valuenow', app.views.progressModal.progressValue);
        this.progressBar.setAttribute('style', 'min-width: 2em; width: ' + app.views.progressModal.progressValue + '%');
        this.progressBar.children[0].textContent = app.views.progressModal.progressValue + '%';
        app.views.progressModal.progressValue += 1;
      }, 333);
    },
    update: function(progressValue, message) {
      this.message = message;
      if (this.progressValue > progressValue) {
        return;
      }
      this.progressValue = progressValue;
    }
  };

})();

/***********************************
  Code for the Recent Searches list
************************************/

(function() {

  app.views = app.views || {};

  // Recent searches list
  app.views.recentSearches = {
    init: function() {
      // Collect DOM elements
      this.recentSearchesList = document.getElementById('recentSearchesList');
    },
    render: function(recentSearches) {
      this.recentSearchesList.textContent = null;

      if (!recentSearches) {
        var li = document.createElement('li');
        li.classList.add('list-group-item');
        li.classList.add('text-center');
        li.textContent = 'You have no recent searches.';
        this.recentSearchesList.appendChild(li);
        return;
      }

      var recentSearchesFragment = document.createDocumentFragment();

      for (var i = 0, length = recentSearches.length; i < length; i++) {
        var li = document.createElement('li'),
            span = document.createElement('span');

        li.classList.add('list-group-item');
        li.textContent = recentSearches[i].city + ', ' + recentSearches[i].state;

        span.classList.add('badge');
        span.textContent = recentSearches[i].totalItems;

        li.appendChild(span);

        li.addEventListener('click', (function(location) {
          return function() {
            app.views.page.disableButtons();
            app.views.page.clear();
            $('#resultsTab').tab('show');
            app.controllers.recentSearch(location);
          };
        })(recentSearches[i]));

        (function(li) {
          li.addEventListener('click', function() {
            li.classList.add('clicked');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseover', function() {
            li.classList.add('hovered');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseout', function() {
            li.classList.remove('hovered');
            li.classList.remove('clicked');
          });
        })(li);

        recentSearchesFragment.appendChild(li);
      }

      this.recentSearchesList.appendChild(recentSearchesFragment);
    }
  };

})();

/***************************
  Code for the results list
****************************/

(function() {

  app.views = app.views || {};

  // Results list
  app.views.results = {
    init: function() {
      // Collect DOM elements
      this.primaryResults = document.getElementById('primaryResults');
      this.primaryResultsList = document.getElementById('primaryResultsList');
      this.secondaryResults = document.getElementById('secondaryResults');
      this.secondaryResultsList = document.getElementById('secondaryResultsList');
      // Set default values
      this.primaryResults.classList.add('hidden');
      this.secondaryResults.classList.add('hidden');
    },
    clear: function() {
      this.secondaryResults.classList.add('hidden');
      this.secondaryResults.classList.add('hidden');
      this.primaryResultsList.textContent = null;
      this.secondaryResultsList.textContent = null;
    },
    render: function(places) {
      this.primaryResults.classList.add('hidden');
      this.secondaryResults.classList.add('hidden');
      this.primaryResultsList.textContent = null;
      this.secondaryResultsList.textContent = null;

      if (!places) {
        app.views.alerts.show('info', 'Your request returned no results.');
        return;
      }

      // Add primary results to DOM
      var primaryResultsFragment = document.createDocumentFragment(),
          primaryPlaces = places.primary;

      for (var i = 0, priLength = primaryPlaces.length; i < priLength; i++) {
        var li = document.createElement('li'),
            span = document.createElement('span');

        li.classList.add('list-group-item');
        li.textContent = primaryPlaces[i].name;

        span.classList.add('badge');
        span.textContent = primaryPlaces[i].drivingInfo.distance;

        li.appendChild(span);

        li.addEventListener('click', (function(place) {
          return function() {
            app.controllers.getDetails(place);
          };
        })(primaryPlaces[i]));

        (function(li) {
          li.addEventListener('click', function() {
            li.classList.add('clicked');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseover', function() {
            li.classList.add('hovered');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseout', function() {
            li.classList.remove('hovered');
            li.classList.remove('clicked');
          });
        })(li);

        primaryResultsFragment.appendChild(li);
      }

      // Add secondary results to DOM
      var secondaryResultsFragment = document.createDocumentFragment(),
          secondaryPlaces = places.secondary;

      for (var j = 0, secLength = secondaryPlaces.length; j < secLength; j++) {
        var li = document.createElement('li'),
            span = document.createElement('span');

        li.classList.add('list-group-item');
        li.textContent = secondaryPlaces[j].name;

        span.classList.add('badge');
        span.textContent = secondaryPlaces[j].drivingInfo.distance;

        li.appendChild(span);

        li.addEventListener('click', (function(place) {
          return function() {
            app.controllers.getDetails(place);
          };
        })(secondaryPlaces[j]));

        (function(li) {
          li.addEventListener('click', function() {
            li.classList.add('clicked');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseover', function() {
            li.classList.add('hovered');
          });
        })(li);

        (function(li) {
          li.addEventListener('mouseout', function() {
            li.classList.remove('hovered');
            li.classList.remove('clicked');
          });
        })(li);

        secondaryResultsFragment.appendChild(li);
      }

      if (places.primary.length > 0) {
        this.primaryResults.classList.remove('hidden');
        this.primaryResultsList.appendChild(primaryResultsFragment);
      }

      if (places.secondary.length > 0) {
        this.secondaryResults.classList.remove('hidden');
        this.secondaryResultsList.appendChild(secondaryResultsFragment);
      }
      // Select results tab and panel to show new results
      $('#resultsTab').tab('show');
    }
  };

})();
