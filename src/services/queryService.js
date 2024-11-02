import Plotly from 'plotly.js-dist';

export function runQuery(query, resultsBox) {
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
