// Code related to controlling the flow of searches

var app = app || {};

(function() {

  app.controllers = app.controllers || {};

  app.controllers.stopExecution = function(msg) {
    app.views.alerts.show(msg.type, msg.text);
    app.views.results.clear();
    app.views.placeModal.hide();
    app.views.page.enableButtons();
    return;
  };

  app.controllers.addRecentSearch = function() {
    return new Promise(function(resolve) {
      app.models.recentSearches.add();
      resolve();
    });
  };

  // formSearch - Controls the flow of a search initiated by the form
  app.controllers.formSearch = function() {
    // Clear user location (search location gets overwritten)
    app.models.userLoc.init();

    app.controllers.getGeocode()
      .then(app.controllers.reqPlaces)
      .then(app.controllers.reqMultiDistance)
      .then(app.controllers.sortPlaces)
      .then(app.controllers.addRecentSearch)
      .then(app.controllers.updatePage)
      .then(app.views.page.enableButtons)
      .catch(app.controllers.stopExecution);
  };

  // geolocationSearch - Controls the flow of a search initiated by the 'My Location' button
  app.controllers.geolocationSearch = function() {
    // Clear search location (user location gets overwritten)
    app.models.searchLoc.init();

    app.controllers.getCurrentLocation()
      .then(app.controllers.reverseGeocode)
      .then(app.controllers.reqPlaces)
      .then(app.controllers.reqMultiDistance)
      .then(app.controllers.sortPlaces)
      .then(app.controllers.updatePage)
      .then(app.views.page.enableButtons)
      .catch(app.controllers.stopExecution);
  };

  // recentSearch - Controls the flow of a search initiated by clicking a location in Recent Searches
  app.controllers.recentSearch = function(location) {
    // Clear user location & set search location
    app.models.userLoc.init();
    app.controllers.setSearchLocation(location);

    app.controllers.reqPlaces()
      .then(app.controllers.reqMultiDistance)
      .then(app.controllers.sortPlaces)
      .then(app.controllers.updatePage)
      .then(app.views.page.enableButtons)
      .catch(app.controllers.stopExecution);
  };

  // getDetails - Controls the flow for acquiring details when a specific place is selected
  app.controllers.getDetails = function(place) {
    var requestedPlace = app.models.places.find(place);

    app.controllers.setSelectedPlaceDetails(requestedPlace)
      .then(app.controllers.reqPlaceDetails)
      .then(app.controllers.reqTransitDistance)
      .then(app.controllers.updateModal)
      .catch(app.controllers.stopExecution);
  };

  // switchToGeolocation - Requests distance from your location to a place (triggered from placeModal)
  app.controllers.switchToGeolocation = function() {
    app.controllers.getCurrentLocation()
      .then(app.controllers.reqDrivingDistance)
      .then(app.controllers.reqTransitDistance)
      .then(app.controllers.updateModal)
      .then(app.controllers.reqMultiDistance)
      .then(app.controllers.sortPlaces)
      .then(app.controllers.updatePage)
      .catch(app.controllers.stopExecution);
  };

  // requestMoreResults - Requests more results if > 20 results are returned
  app.controllers.requestMoreResults = function() {
    var paginationObj = app.models.places.paginationObj;
    paginationObj.nextPage();
    // TO-DO: Fix this hack
    // Need to wait for AJAX request to finish before moving on and can't use JS promise
    window.setTimeout(function() {
      app.controllers.reqMultiDistance()
        .then(app.controllers.sortPlaces)
        .then(app.controllers.updatePage)
        .then(app.views.page.enableButtons)
        .catch(app.controllers.stopExecution);
    }, 2000);
  };

})();
