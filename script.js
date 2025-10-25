// map dimensions - scaled down from original image size (1968x1580)
// the 2.4 can be increased or decreased to adjust the size of the map
const mapWidth = 1968 / 2.4;
const mapHeight = 1580 / 2.4;

// extent of our datapoints, coordinates-wise (i.e. geographic bounds for SF)
const longitudeRange = [-122.52876879101329, -122.34501499128038];
const latitudeRange = [37.69947941416328, 37.81633202723721];

// set up map frame for projection (3D -> 2D) - creates a GeoJSON object
// that defines the corners of our map so D3 can fit the projection
const mapFrameGeoJSON = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [longitudeRange[0], latitudeRange[0]],
      [longitudeRange[1], latitudeRange[1]]
    ]
  }
};

// Create projection to convert 3D -> 2D (lat/lon coordinates to screen pixels) 
// fitExtent automatically scales the projection to our map size
const projection = d3.geoMercator()
  .fitExtent([[0, 0], [mapWidth, mapHeight]], mapFrameGeoJSON);

const svg = d3.select("#map").append("svg")
  .attr("width", mapWidth)
  .attr("height", mapHeight)
  .style("border", "1px solid black");

// add background map to SVG
svg.append("image")
  .attr("width", mapWidth)
  .attr("height", mapHeight)
  .attr("xlink:href", "sf_map.png");

// create separate SVG groups for layering both circles on top of the moviedata points
// ref: https://observablehq.com/@d3/gallery
const circlesLayer = svg.append('g').attr('class', 'circles-layer');
const pointsLayer = svg.append('g').attr('class', 'points-layer-main');

let allData = [];  // global var to store all the data once loaded

// circles start state
let circleA = { x: mapWidth / 3, y: mapHeight / 2, radius: 50 };  // store x, y, and radius in pixels
let circleB = { x: (2 * mapWidth) / 3, y: mapHeight / 2, radius: 50 };

// Check if a point (px, py) is inside a circle
function isInCircle(px, py, circle) {
  const dx = px - circle.x;
  const dy = py - circle.y;
  return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
}

// check if point is in both circles 
function isInIntersection(px, py) {
  return isInCircle(px, py, circleA) && isInCircle(px, py, circleB);
}

// helper to get unique vals from movie data for dropdown filters (set handles dups)
function getUniqueValues(data, field) {
  const values = new Set();
  data.forEach(d => {const value = d[field];
    if (value && value.trim() !== '') {
      values.add(value.trim());
    }
  });
  return Array.from(values).sort();
}

// update visualization based on curr filter settings
// call this whenever any filter changes (circles, year, director, neighborhood)
// need to make sure this is fast (0.1s update rate)
function updateFilters() {
  const startTime = performance.now();

  // get all curr filter vals from the UI
  const yearMin = +document.getElementById('yearMin').value;  // find HTML slider value
  const yearMax = +document.getElementById('yearMax').value;
  const selectedDirector = document.getElementById('directorFilter').value;
  const selectedNeighborhood = document.getElementById('neighborhoodFilter').value;

  document.getElementById('year-range-display').textContent = `${yearMin} - ${yearMax}`;   // update visual display of slider

  let visibleCount = 0;   // count of points to show in intersection

  // loop through each location point and check if it passes all filters
  // ref: https://observablehq.com/@stanfordvis/making-d3-charts-interactive
  d3.selectAll('.location-point')
    .each(function(d) {
      const circle = d3.select(this);
      const px = +circle.attr('cx');  // position-x
      const py = +circle.attr('cy');  // pos-y
      const baseRadius = +circle.attr('data-base-radius');  // size

      const inIntersection = isInIntersection(px, py);  // first check: in both circles

      // 2nd check: do any movies at this location match the other filters? (struct is only true if all filters match)
      // since multiple movies can be at the same location, we filter the movies array
      const matchingMovies = d.movies.filter(movie => {
        const year = +movie['Release Year'];
        const inYearRange = (!year || (year >= yearMin && year <= yearMax));  // check if in year range
        const directorMatch = (selectedDirector === 'all' || movie.Director === selectedDirector);
        const neighborhoodMatch = (selectedNeighborhood === 'all' || movie['Analysis Neighborhood'] === selectedNeighborhood);

        return inYearRange && directorMatch && neighborhoodMatch;
      });

      const visible = inIntersection && matchingMovies.length > 0;  // only show location if in intersection and matches diretor and neighborhood filters

      // update appearance based on whether it's visible
      // visible = red and full size; hidden = gray and smaller
      if (visible) {
        visibleCount += matchingMovies.length;
        circle.attr('fill', 'red')
          .attr('opacity', 0.7)
          .attr('r', baseRadius);
      } else {
        circle.attr('fill', 'gray')
          .attr('opacity', 0.3)
          .attr('r', baseRadius * 0.7);
      }
    });

  document.getElementById('visibleCount').textContent = visibleCount;  // update HTML element that displays the total count of visible locs
}

// draw query circles on the map
function renderQueryCircles() {
  circlesLayer.selectAll('.query-circle').remove();     // remvoe old circles before drawing new ones
  circlesLayer.selectAll('.query-circle-label').remove();

  // draw A
  const circleAGroup = circlesLayer.append('circle')
    .attr('class', 'query-circle')
    .attr('cx', circleA.x)
    .attr('cy', circleA.y)
    .attr('r', circleA.radius)
    .attr('fill', 'rgba(52, 152, 219, 0.15)')
    .attr('stroke', '#3498db')
    .attr('stroke-width', 2)
    .attr('cursor', 'move')

    // drag behavior, ref:https://observablehq.com/@stanfordvis/making-d3-charts-interactive
    .call(d3.drag()
      .on('drag', function(event) {
        // update position
        circleA.x = Math.max(0, Math.min(mapWidth, event.x));
        circleA.y = Math.max(0, Math.min(mapHeight, event.y));
        // re-render the circles & update which points are visible
        renderQueryCircles();
        updateFilters();
      })
    );

  // add text label for A
  circlesLayer.append('text')
    .attr('class', 'query-circle-label')
    .attr('x', circleA.x)
    .attr('y', circleA.y)
    .attr('fill', '#3498db')
    .attr('font-size', '20px')
    .attr('font-weight', 'bold')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('pointer-events', 'none')   // none means the label won't interfere with dragging
    .text('A');


  // draw B
  const circleBGroup = circlesLayer.append('circle')
    .attr('class', 'query-circle')
    .attr('cx', circleB.x)
    .attr('cy', circleB.y)
    .attr('r', circleB.radius)
    .attr('fill', 'rgba(46, 204, 113, 0.15)')
    .attr('stroke', '#2ecc71')
    .attr('stroke-width', 2)
    .attr('cursor', 'move')
    .call(d3.drag()
      .on('drag', function(event) {
        circleB.x = Math.max(0, Math.min(mapWidth, event.x));
        circleB.y = Math.max(0, Math.min(mapHeight, event.y));
        renderQueryCircles();
        updateFilters();
      })
    );

  // Label for circle B
  circlesLayer.append('text')
    .attr('class', 'query-circle-label')
    .attr('x', circleB.x)
    .attr('y', circleB.y)
    .attr('fill', '#2ecc71')
    .attr('font-size', '20px')
    .attr('font-weight', 'bold')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('pointer-events', 'none')
    .text('B');
}

// Render all the film location points on the map
function renderDataPoints() {   // called once during initialization
  const tooltip = d3.select('#tooltip');  // movie info that appears when hovering over a point

  // Since multiple movies can be filmed at the same location, we group by coordinates and count movies per location
  // Then make dot size proportional to number of movies at each location
  const locationMap = new Map();
  allData.forEach(d => {
    const key = `${d.Longitude},${d.Latitude}`;
    if (!locationMap.has(key)) {   // we only need one entry per location and then create a list of all movies at each location
      locationMap.set(key, {
        longitude: d.Longitude,
        latitude: d.Latitude,
        movies: [],
        data: d
      });
    }
    locationMap.get(key).movies.push(d);  // if this location already exists, simply add the movie to the list 
  });

  const locationData = Array.from(locationMap.values());  // D3 needs an array

  // Scale dot size based on number of movies at that location (using sqrt scale so area is proportional to count (not radius))
  // ref: https://observablehq.com/@d3/learn-d3-scales?collection=@d3/learn-d3
  const maxMovies = d3.max(locationData, d => d.movies.length);   // loc with most movies to determine max radius 
  const radiusScale = d3.scaleSqrt()  // even though we learned that humans understimate scaling when it comes to circular shapes, I decided to scale proprtinally (both for ease of use, but more importanlty, for sticking to that exepctation)
    .domain([1, maxMovies])   // input range
    .range([3, 10]);   // set max circle size to 10 pixels

  // create one circle element for each location
  // ref: https://observablehq.com/@stanfordvis/d3-excercises
  pointsLayer.selectAll('.location-point')
    .data(locationData)
    .enter()
    .append('circle')
    .attr('class', 'location-point')

    // use projection to convert lat/lon to x,y pixel coordinates
    .attr('cx', d => {
      const [x, y] = projection([+d.longitude, +d.latitude]);
      return x;
    })
    .attr('cy', d => {
      const [x, y] = projection([+d.longitude, +d.latitude]);
      return y;
    })

    .attr('r', d => radiusScale(d.movies.length))  // set radius based on # of movies
    .attr('data-base-radius', d => radiusScale(d.movies.length))  // Store for later
    .attr('data-movie-count', d => d.movies.length)
    .attr('fill', 'red')
    .attr('opacity', 0.7)
    .attr('cursor', 'pointer')  // change cursor to pointer when hovering over a location point
    
    // showing film info on hover
    .on('mouseenter', function(event, d) {  // run this funcitons when we user hovers over a lcoaiton dot 
      // add content to tooltip: all movies at this location
      let content = `<strong>Location:</strong> ${d.movies[0].Locations || 'Unknown'}<br>`;  // we have to check all columns for NULL
      content += `<strong>Number of Movies:</strong> ${d.movies.length}<br><br>`;

      d.movies.forEach((movie, index) => {  // loop through each movie at this location
        if (index > 0) content += '<br><br>';   // add a line btw movies (for some reason this isn't working; I tried everything I can think of, but still can't make it work)

        content += `<strong>${movie.Title}</strong>`;

        if (movie['Release Year']) {
          content += ` (${movie['Release Year']})`;
        }

        if (movie.Director) {
          content += `<br><em>Director:</em> ${movie.Director}`;
        }

        // we have max 3 actors
        const actors = [movie['Actor 1'], movie['Actor 2'], movie['Actor 3']].filter(a => a && a.trim() !== '');
        if (actors.length > 0) {
          content += `<br><em>Actors:</em> ${actors.join(', ')}`;
        }

        if (movie['Fun Facts'] && movie['Fun Facts'].trim() !== '') {
          content += `<br><em>Fun Fact:</em> ${movie['Fun Facts']}`;
        }
      });

      // each movie list (i.e. each location) only has 1 neigborhood
      if (d.movies[0]['Analysis Neighborhood']) {  // we have to check all columns for NULL
        content += `<br><br><strong>Neighborhood:</strong> ${d.movies[0]['Analysis Neighborhood']}`;
      }

      // position tooltip 
      tooltip
        .html(content)
        .style('display', 'block')
        .style('left', (event.pageX + 15) + 'px')  // position tooltip 15 pixels tight of the cursor
        .style('top', (event.pageY - 10) + 'px')
        .classed('visible', true);

      // make the location point bigger when hovering over it and add white outline
      const baseRadius = +d3.select(this).attr('data-base-radius');   // original size
      d3.select(this)
        .attr('r', baseRadius + 3)  // increase original radius by 3 pixels
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    })
    .on('mousemove', function(event) {
      // continoulsy update tooltip position as mouse moves (without doing this the tooltip sometimes )
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function() {
      // hide tooltip when mouse leaves
      tooltip
        .classed('visible', false)
        .style('display', 'none');

      // reset location point back to normal size and remove stroke
      const baseRadius = +d3.select(this).attr('data-base-radius');
      const currentFill = d3.select(this).attr('fill');
      const isVisible = currentFill === 'rgb(231, 76, 60)' || currentFill === 'red';
      d3.select(this)
        .attr('r', isVisible ? baseRadius : baseRadius * 0.7)
        .attr('stroke', 'none');
    });
}

// Setup all interactive controls (sliders, dropdowns, reset button)
function setupControls() {
  // get refs to the radius sliders 
  const radiusASlider = document.getElementById('radiusA');
  const radiusBSlider = document.getElementById('radiusB');

  // slider for circle A: whem slider changes, update the circle object and re-render
  // ref: https://observablehq.com/@stanfordvis/making-d3-charts-interactive
  radiusASlider.addEventListener('input', function() {
    circleA.radius = +this.value;  // + converts string to number
    renderQueryCircles();
    updateFilters();
  });

  // slider for circle B
  radiusBSlider.addEventListener('input', function() {
    circleB.radius = +this.value;
    renderQueryCircles();
    updateFilters();
  });

  // year range filter - using one slider and setting it up form both sides to get specified range
  const yearMinSlider = document.getElementById('yearMin');
  const yearMaxSlider = document.getElementById('yearMax');
  const rangeTrack = document.querySelector('.range-track');

  // update the visual highlighting on the slider track from both sides
  function updateYearRangeVisual() {
    // calc relative percentages for positioning the highlighting
    const minPercent = ((+yearMinSlider.value - 1915) / (2023 - 1915)) * 100;
    const maxPercent = ((+yearMaxSlider.value - 1915) / (2023 - 1915)) * 100;

    // set new highliting from both sides
    rangeTrack.style.setProperty('--range-left', minPercent + '%');
    rangeTrack.style.setProperty('--range-width', (maxPercent - minPercent) + '%');
  }

  // update left end of the slider
  yearMinSlider.addEventListener('input', function() {
    const minVal = +this.value;
    const maxVal = +yearMaxSlider.value;
    if (minVal > maxVal) {     // min can't be greater than max
      yearMaxSlider.value = minVal;
    }
    updateYearRangeVisual();
    updateFilters();
  });

  // update right end of the slider 
  yearMaxSlider.addEventListener('input', function() {
    const maxVal = +this.value;
    const minVal = +yearMinSlider.value;
    if (maxVal < minVal) {  // max can't be less than min
      yearMinSlider.value = maxVal;
    }
    updateYearRangeVisual();
    updateFilters();
  });

  updateYearRangeVisual();    // initialize highliting on page load

  document.getElementById('directorFilter').addEventListener('change', updateFilters);   // trigger update in visible locations when director selection changes
  document.getElementById('neighborhoodFilter').addEventListener('change', updateFilters);   // trigger update in visible locations when neighborhood selection changes

  // reset button: clears all filters back to defaults
  document.getElementById('resetButton').addEventListener('click', function() {
    // reset circle positions to starting locations and sizes
    circleA = { x: mapWidth / 3, y: mapHeight / 2, radius: 50 };
    circleB = { x: (2 * mapWidth) / 3, y: mapHeight / 2, radius: 50 };
    radiusASlider.value = 50;
    radiusBSlider.value = 50;

    // Reset year filter to show all years (1915-2023)
    yearMinSlider.value = 1915;
    yearMaxSlider.value = 2023;
    updateYearRangeVisual();  // Update the slider highliting

    // reset dropdown filters 
    document.getElementById('directorFilter').value = 'all';
    document.getElementById('neighborhoodFilter').value = 'all';

    renderQueryCircles();     // re-render with new settings
    updateFilters();
  });
}

// Data loading and initialization
// Since we use D3 v7, the csv function uses Promises instead of asynchronous callbacks to load data
d3.csv("SF_Film_Locations_Filtered.csv").then(data => {
  // filter out rows without valid lat/loncoordinates
  allData = data.filter(d => {
    const lon = +d.Longitude;
    const lat = +d.Latitude;
    return Number.isFinite(lon) && Number.isFinite(lat);   // check that both are valid numbers
  });

  document.getElementById('totalCount').textContent = allData.length;  // set total count of locations on bottom of the website

  // create director dropdown with unique directors from dataset
  const directors = getUniqueValues(allData, 'Director');
  const directorSelect = document.getElementById('directorFilter');
  directors.forEach(director => {
    const option = document.createElement('option');
    option.value = director;
    option.textContent = director;
    directorSelect.appendChild(option);
  });

  // create neighborhood dropdown
  const neighborhoods = getUniqueValues(allData, 'Analysis Neighborhood');
  const neighborhoodSelect = document.getElementById('neighborhoodFilter');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.value = neighborhood;
    option.textContent = neighborhood;
    neighborhoodSelect.appendChild(option);
  });

  // initalize visualization (order matters: circles shuold be on top of location points)
  renderDataPoints();
  renderQueryCircles();
  setupControls();
  updateFilters();
});
