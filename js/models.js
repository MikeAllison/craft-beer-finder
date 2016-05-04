var app = app || {};

(function() {

  app.models = {
    userLocation: {
      init: function() {
        this.lat = null;
        this.lng = null;
        this.formattedAddress = null;
        this.totalItems = null;
      },
      setLat: function(lat) {
        this.lat = lat;
      },
      setLng: function(lng) {
        this.lng = lng;
      },
      setFormattedAddress: function(address) {
        this.formattedAddress = address.replace(/((\s\d+)?,\sUSA)/i, '');
      },
      setTotalItems: function(totalItems) {
        this.totalItems = totalItems;
      }
    },
    searchLocation: {
      init: function() {
        this.lat = null;
        this.lng = null;
        this.formattedAddress = null;
        this.totalItems = null;
      },
      setLat: function(lat) {
        this.lat = lat;
      },
      setLng: function(lng) {
        this.lng = lng;
      },
      setFormattedAddress: function(address) {
        this.formattedAddress = address.replace(/((\s\d+)?,\sUSA)/i, '');
      },
      setTotalItems: function(totalItems) {
        this.totalItems = totalItems;
      }
    },
    selectedPlace: {
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
      setPlaceId: function(placeId) {
        this.placeId = placeId;
      },
      setLat: function(lat) {
        this.lat = lat;
      },
      setLng: function(lng) {
        this.lng = lng;
      },
      setName: function(name) {
        this.name = name;
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
      }
    },
    places: {
      init: function() {
        sessionStorage.clear();
        this.paginationObj = {};
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
        var places = this.get();

        for (var i=0; i < places.length; i++) {
          if (places[i].place_id === requestedPlace.place_id) {
            return places[i];
          }
        }
      },
      setPaginationObj: function(paginationObj) {
        this.paginationObj = paginationObj;
      }
    },
    recentSearches: {
      add: function() {
        var cachedSearches = this.get();

        if (!cachedSearches) {
          cachedSearches = [];
        } else if (cachedSearches.length >= 5) {
          cachedSearches.pop();
        }

        var newLocation = {};
        newLocation.lat = app.models.userLocation.lat || app.models.searchLocation.lat;
        newLocation.lng = app.models.userLocation.lng || app.models.searchLocation.lng;
        newLocation.formattedAddress = app.models.userLocation.formattedAddress || app.models.searchLocation.formattedAddress;
        newLocation.totalItems = app.models.userLocation.totalItems || app.models.searchLocation.totalItems;
        cachedSearches.unshift(newLocation);

        localStorage.setItem('recentSearches', JSON.stringify(cachedSearches));
      },
      get: function() {
        return JSON.parse(localStorage.getItem('recentSearches'));
      }
    }
  };

})();
