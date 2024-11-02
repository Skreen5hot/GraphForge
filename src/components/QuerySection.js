import { runQuery } from '../services/queryService';

export function createQuerySection() {
    // Create the query section container
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
