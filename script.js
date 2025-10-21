// --- Map Setup ---
const mapWidth = 1968 / 2.4;
const mapHeight = 1580 / 2.4;

const longitudeRange = [-122.52876879101329, -122.34501499128038];
const latitudeRange = [37.69947941416328, 37.81633202723721];

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

const projection = d3.geoMercator()
  .fitExtent([[0, 0], [mapWidth, mapHeight]], mapFrameGeoJSON);

const svg = d3.select("#map").append("svg")
  .attr("width", mapWidth)
  .attr("height", mapHeight)
  .style("border", "1px solid #ddd");

// Add map image
svg.append("image")
  .attr("width", mapWidth)
  .attr("height", mapHeight)
  .attr("xlink:href", "sf_map.png");

// --- Global State ---
let allData = [];
let circleA = { x: mapWidth / 3, y: mapHeight / 2, radius: 1.0 }; // radius in km
let circleB = { x: (2 * mapWidth) / 3, y: mapHeight / 2, radius: 1.0 };

// --- Helper Functions ---

// Convert km to pixels (approximate, using latitude)
function kmToPixels(km) {
  const avgLat = (latitudeRange[0] + latitudeRange[1]) / 2;
  const kmPerDegree = 111.0 * Math.cos(avgLat * Math.PI / 180);
  const degreesPerKm = 1 / kmPerDegree;

  // Project two points to get pixel scale
  const centerLon = (longitudeRange[0] + longitudeRange[1]) / 2;
  const p1 = projection([centerLon, avgLat]);
  const p2 = projection([centerLon + degreesPerKm, avgLat]);

  const pixelsPerKm = Math.abs(p2[0] - p1[0]);
  return km * pixelsPerKm;
}

// Check if point is inside circle
function isInCircle(px, py, circle) {
  const radiusPixels = kmToPixels(circle.radius);
  const dx = px - circle.x;
  const dy = py - circle.y;
  return (dx * dx + dy * dy) <= (radiusPixels * radiusPixels);
}

// Check if point is in intersection of both circles
function isInIntersection(px, py) {
  return isInCircle(px, py, circleA) && isInCircle(px, py, circleB);
}

// Get unique values from data for dropdowns
function getUniqueValues(data, field) {
  const values = new Set();
  data.forEach(d => {
    const value = d[field];
    if (value && value.trim() !== '') {
      values.add(value.trim());
    }
  });
  return Array.from(values).sort();
}

// --- Render Functions ---

function updateFilters() {
  const startTime = performance.now();

  // Get filter values
  const yearMin = +document.getElementById('yearMin').value;
  const yearMax = +document.getElementById('yearMax').value;
  const selectedDirector = document.getElementById('directorFilter').value;
  const selectedNeighborhood = document.getElementById('neighborhoodFilter').value;

  // Update year display
  document.getElementById('year-range-display').textContent = `${yearMin} - ${yearMax}`;

  let visibleCount = 0;

  // Update all circles
  d3.selectAll('.location-point')
    .each(function(d) {
      const circle = d3.select(this);
      const px = +circle.attr('cx');
      const py = +circle.attr('cy');

      // Check all filters
      const inIntersection = isInIntersection(px, py);

      const year = +d['Release Year'];
      const inYearRange = (!year || (year >= yearMin && year <= yearMax));

      const directorMatch = (selectedDirector === 'all' || d.Director === selectedDirector);
      const neighborhoodMatch = (selectedNeighborhood === 'all' || d['Analysis Neighborhood'] === selectedNeighborhood);

      const visible = inIntersection && inYearRange && directorMatch && neighborhoodMatch;

      if (visible) {
        visibleCount++;
        circle.attr('fill', '#e74c3c')
          .attr('opacity', 0.7)
          .attr('r', 3);
      } else {
        circle.attr('fill', '#bdc3c7')
          .attr('opacity', 0.3)
          .attr('r', 2);
      }
    });

  // Update stats
  document.getElementById('visibleCount').textContent = visibleCount;

  const endTime = performance.now();
  console.log(`Filter update took ${(endTime - startTime).toFixed(2)}ms`);
}

function renderQueryCircles() {
  // Remove existing circles
  svg.selectAll('.query-circle').remove();
  svg.selectAll('.query-circle-label').remove();

  // Circle A
  const radiusAPixels = kmToPixels(circleA.radius);
  const circleAGroup = svg.append('circle')
    .attr('class', 'query-circle')
    .attr('cx', circleA.x)
    .attr('cy', circleA.y)
    .attr('r', radiusAPixels)
    .attr('fill', 'rgba(52, 152, 219, 0.15)')
    .attr('stroke', '#3498db')
    .attr('stroke-width', 2)
    .attr('cursor', 'move')
    .call(d3.drag()
      .on('drag', function(event) {
        circleA.x = Math.max(0, Math.min(mapWidth, event.x));
        circleA.y = Math.max(0, Math.min(mapHeight, event.y));
        renderQueryCircles();
        updateFilters();
      })
    );

  svg.append('text')
    .attr('class', 'query-circle-label')
    .attr('x', circleA.x)
    .attr('y', circleA.y)
    .attr('class', 'circle-label')
    .attr('fill', '#3498db')
    .attr('font-size', '20px')
    .attr('font-weight', 'bold')
    .style('pointer-events', 'none')
    .text('A');

  // Circle B
  const radiusBPixels = kmToPixels(circleB.radius);
  const circleBGroup = svg.append('circle')
    .attr('class', 'query-circle')
    .attr('cx', circleB.x)
    .attr('cy', circleB.y)
    .attr('r', radiusBPixels)
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

  svg.append('text')
    .attr('class', 'query-circle-label')
    .attr('x', circleB.x)
    .attr('y', circleB.y)
    .attr('class', 'circle-label')
    .attr('fill', '#2ecc71')
    .attr('font-size', '20px')
    .attr('font-weight', 'bold')
    .style('pointer-events', 'none')
    .text('B');
}

function renderDataPoints() {
  const tooltip = d3.select('#tooltip');

  svg.selectAll('.location-point')
    .data(allData)
    .enter()
    .append('circle')
    .attr('class', 'location-point')
    .attr('cx', d => {
      const [x, y] = projection([+d.Longitude, +d.Latitude]);
      return x;
    })
    .attr('cy', d => {
      const [x, y] = projection([+d.Longitude, +d.Latitude]);
      return y;
    })
    .attr('r', 3)
    .attr('fill', '#e74c3c')
    .attr('opacity', 0.7)
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      // Build tooltip content
      let content = `<strong>${d.Title}</strong>`;

      if (d['Release Year']) {
        content += ` (${d['Release Year']})`;
      }

      content += '<br>';

      if (d.Locations) {
        content += `<br><strong>Location:</strong> ${d.Locations}`;
      }

      if (d.Director) {
        content += `<br><strong>Director:</strong> ${d.Director}`;
      }

      const actors = [d['Actor 1'], d['Actor 2'], d['Actor 3']].filter(a => a && a.trim() !== '');
      if (actors.length > 0) {
        content += `<br><strong>Actors:</strong> ${actors.join(', ')}`;
      }

      if (d['Analysis Neighborhood']) {
        content += `<br><strong>Neighborhood:</strong> ${d['Analysis Neighborhood']}`;
      }

      if (d['Fun Facts'] && d['Fun Facts'].trim() !== '') {
        content += `<br><br><strong>Fun Fact:</strong> ${d['Fun Facts']}`;
      }

      tooltip.html(content)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .classed('visible', true);

      // Highlight the point
      d3.select(this)
        .attr('r', 5)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    })
    .on('mousemove', function(event) {
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseleave', function() {
      tooltip.classed('visible', false);

      // Reset highlight
      const currentFill = d3.select(this).attr('fill');
      const isVisible = currentFill === 'rgb(231, 76, 60)' || currentFill === '#e74c3c';
      d3.select(this)
        .attr('r', isVisible ? 3 : 2)
        .attr('stroke', 'none');
    });
}

// --- Setup UI Controls ---

function setupControls() {
  // Radius sliders
  const radiusASlider = document.getElementById('radiusA');
  const radiusBSlider = document.getElementById('radiusB');
  const radiusAValue = document.getElementById('radiusA-value');
  const radiusBValue = document.getElementById('radiusB-value');

  radiusASlider.addEventListener('input', function() {
    circleA.radius = +this.value;
    radiusAValue.textContent = this.value;
    renderQueryCircles();
    updateFilters();
  });

  radiusBSlider.addEventListener('input', function() {
    circleB.radius = +this.value;
    radiusBValue.textContent = this.value;
    renderQueryCircles();
    updateFilters();
  });

  // Year range sliders
  const yearMinSlider = document.getElementById('yearMin');
  const yearMaxSlider = document.getElementById('yearMax');

  yearMinSlider.addEventListener('input', function() {
    const minVal = +this.value;
    const maxVal = +yearMaxSlider.value;
    if (minVal > maxVal) {
      yearMaxSlider.value = minVal;
    }
    updateFilters();
  });

  yearMaxSlider.addEventListener('input', function() {
    const maxVal = +this.value;
    const minVal = +yearMinSlider.value;
    if (maxVal < minVal) {
      yearMinSlider.value = maxVal;
    }
    updateFilters();
  });

  // Director filter
  document.getElementById('directorFilter').addEventListener('change', updateFilters);

  // Neighborhood filter
  document.getElementById('neighborhoodFilter').addEventListener('change', updateFilters);

  // Reset button
  document.getElementById('resetButton').addEventListener('click', function() {
    // Reset circle positions and radii
    circleA = { x: mapWidth / 3, y: mapHeight / 2, radius: 1.0 };
    circleB = { x: (2 * mapWidth) / 3, y: mapHeight / 2, radius: 1.0 };

    // Reset sliders
    radiusASlider.value = 1.0;
    radiusBSlider.value = 1.0;
    radiusAValue.textContent = '1.0';
    radiusBValue.textContent = '1.0';

    // Reset year range
    yearMinSlider.value = 1940;
    yearMaxSlider.value = 2025;

    // Reset dropdowns
    document.getElementById('directorFilter').value = 'all';
    document.getElementById('neighborhoodFilter').value = 'all';

    // Re-render
    renderQueryCircles();
    updateFilters();
  });
}

// --- Initialize ---

d3.csv("SF_Film_Locations_Filtered.csv").then(data => {
  // Filter out rows without valid coordinates
  allData = data.filter(d => {
    const lon = +d.Longitude;
    const lat = +d.Latitude;
    return Number.isFinite(lon) && Number.isFinite(lat);
  });

  console.log(`Loaded ${allData.length} valid locations`);

  // Update total count
  document.getElementById('totalCount').textContent = allData.length;

  // Populate director dropdown
  const directors = getUniqueValues(allData, 'Director');
  const directorSelect = document.getElementById('directorFilter');
  directors.forEach(director => {
    const option = document.createElement('option');
    option.value = director;
    option.textContent = director;
    directorSelect.appendChild(option);
  });

  // Populate neighborhood dropdown
  const neighborhoods = getUniqueValues(allData, 'Analysis Neighborhood');
  const neighborhoodSelect = document.getElementById('neighborhoodFilter');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.value = neighborhood;
    option.textContent = neighborhood;
    neighborhoodSelect.appendChild(option);
  });

  // Render everything
  renderDataPoints();
  renderQueryCircles();
  setupControls();
  updateFilters();

  console.log('Visualization initialized successfully!');
});
