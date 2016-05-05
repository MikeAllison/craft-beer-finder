// Code related to passing data to models 

var app = app || {};

(function() {

  app.controllers = app.controllers || {};

  // setSelectedPlaceDetails - Sets the initial deails of the requested place for viewing details about it
  app.controllers.setSelectedPlaceDetails = function(place) {
    return new Promise(function(resolve, reject) {
      app.models.selectedPlace.init();
      app.models.selectedPlace.setPlaceId(place.place_id);
      app.models.selectedPlace.setLat(place.geometry.location.lat);
      app.models.selectedPlace.setLng(place.geometry.location.lng);
      app.models.selectedPlace.setName(place.name);
      app.models.selectedPlace.setDrivingInfo(place.drivingInfo.distance, place.drivingInfo.duration);
      resolve();
    });
  };

  // setSearchLocation - Sets the location to be used by Google Places Search when a location is selected from Recent Places
  app.controllers.setSearchLocation = function(location) {
    app.models.searchLocation.setLat(location.lat);
    app.models.searchLocation.setLng(location.lng);
    app.models.searchLocation.setFormattedAddress(location.formattedAddress);
    app.models.searchLocation.setTotalItems(location.totalItems);
  };

})();
