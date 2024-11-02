// Initialize App - handles first query section and new sections
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('service-worker.js').then(registration => {
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
