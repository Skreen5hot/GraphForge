// Initialize App - handles first query section and new sections
document.addEventListener('DOMContentLoaded', function () {
  setupRouting();

  const sidebar = document.querySelector('.sidebar');
  const rightPanel = document.querySelector('.right-panel');
  const sidebarToggle = document.querySelector('.toggle-sidebar');
  const rightPanelToggle = document.querySelector('.toggle-right-panel');

  // Toggle sidebar visibility
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '❯' : '❮';
  });

  // Toggle right panel visibility
  rightPanelToggle.addEventListener('click', () => {
    rightPanel.classList.toggle('collapsed');
    rightPanelToggle.textContent = rightPanel.classList.contains('collapsed') ? '❮' : '❯';
  });

  initializeApp();
});

function menuFunction() {
  var x = document.getElementById("myTopnav");
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}
function setActive(element) {
  // Remove the "active" class from all links
  var links = document.querySelectorAll(".topnav a");
  links.forEach(link => link.classList.remove("active"));

  // Add the "active" class to the clicked link
  element.classList.add("active");
}
function initializeApp() {

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js?v2.4').then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      }).catch(error => {
        console.log('Service Worker registration failed:', error);
      });
    });
  }



  const querySectionsContainer = document.getElementById('query-sections-container');
  const addQueryButton = document.getElementById('add-query-section');

  // Add the initial query section on load
  addQuerySection(querySectionsContainer);

  // Event listener for adding new query sections
  addQueryButton.addEventListener('click', () => addQuerySection(querySectionsContainer));
}

function addQuerySection(container) {
  const querySection = createQuerySection();
  container.prepend(querySection);  // Adds the section to the top
}

// Query Section UI Component
function createQuerySection() {
  const querySection = document.createElement('section');
  querySection.classList.add('query-section');

  // Create query input
  const queryInput = document.createElement('textarea');
  queryInput.classList.add('query-input');
  queryInput.placeholder = 'Enter your query...';

  // Create run query button
  const runButton = document.createElement('button');
  runButton.textContent = 'Run Query';
  runButton.classList.add('run-query-button');

  // Create results box
  const resultsBox = document.createElement('div');
  resultsBox.classList.add('query-results');
  resultsBox.textContent = 'Results will appear here.';

  // Attach event listener to run the query on button click
  runButton.addEventListener('click', () => runQuery(queryInput.value, resultsBox));

  // Append elements to the query section
  querySection.appendChild(queryInput);
  querySection.appendChild(runButton);
  querySection.appendChild(resultsBox);

  return querySection;
}

// Query Service - Handles query logic and rendering results
function runQuery(query, resultsBox) {
  resultsBox.textContent = 'Running query...';

  // Simulated response with Plotly chart example
  setTimeout(() => {
    resultsBox.textContent = ''; // Clear previous content
    const chartContainer = document.createElement('div');
    chartContainer.style.height = '300px';
    chartContainer.style.width = '100%';

    resultsBox.appendChild(chartContainer);

    // Sample data for Plotly
    const data = [{
      x: [1, 2, 3, 4, 5],
      y: [10, 15, 13, 17, 19],
      type: 'scatter'
    }];

    Plotly.newPlot(chartContainer, data);
  }, 1000);
}

// Set up routing for SPA
function setupRouting() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.page-section');
  function navigate() {
    const hash = location.hash || '#home';
    sections.forEach(section => section.classList.add('hidden'));
    document.querySelector(hash).classList.remove('hidden');
  }
  navLinks.forEach(link => link.addEventListener('click', () => navigate()));
  window.addEventListener('hashchange', navigate);
  navigate(); // Initial load
}

// Check if the protocol is 'file:' (indicating a local file system)
if (window.location.protocol !== 'file:') {
  // Create a link element for the manifest
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = 'manifest.json';  // Adjust path as needed

  // Append it to the head
  document.head.appendChild(link);
} else {
  console.log("Manifest not loaded due to local environment.");
}