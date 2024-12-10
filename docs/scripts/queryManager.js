// Original POC Query Service - Handles query logic and rendering results
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

// Query Service - Handles query logic and rendering results
async function executeQuery() {
    const queryEngine = new Comunica.QueryEngine();
    let query = document.getElementById('queryInput').value.trim();
    
    // Replace 'a' with 'rdf:type' in contexts where it's safe to do so
    query = query.replace(/\ba\s+(?=\w+:[\w-]+|<[^>]+>)/g, 'rdf:type ');

    // Check for prefixes and process them separately if needed
    const prefixRegex = /^PREFIX\s+\w+:\s*<[^>]+>\s*/gm;
    const prefixStatements = query.match(prefixRegex) || [];
    query = query.replace(prefixRegex, ''); // Remove from main query

    // Automatically wrap CURIEs like rdfs:seeAlso in angle brackets
    query = query.replace(/\b([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)\b/g, '<$1>');

    // Wrap unbracketed IRIs in angle brackets
    query = query.replace(/(\bhttp:\/\/[^\s<>]+)(?=\s|$)/g, '<$1>');

    // Leave CURIEs as is, without adding angle brackets again
    // Add prefixes dynamically at the beginning of the query
    const prefixString = Object.entries(prefixes).map(
        ([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`).join('\n');
    query = `${prefixString}\n${query}`;

    // Optionally, reattach PREFIX statements at the beginning if necessary
    if (prefixStatements.length) {
        query = prefixStatements.join('\n') + '\n' + query;
    }

    log('Starting query execution...');
    log('Query: ' + query);
    log('Store size: ' + store.size);

    try {
        const result = await queryEngine.query(query, {
            sources: [store]
        });
        log('Query executed. Result type: ' + result.resultType);
        
        if (result.resultType === 'bindings') {
            const bindingsStream = await result.execute();
            let tableHTML = '<table border = "1"><thead><tr> ';
            let headers = [];
            let count = 0;
            bindingsStream.on('data', (binding) => {
                count++;
                if (count === 1) {
                    for (const [key] of binding.entries) {
                        headers.push(key);
                        tableHTML += `
                  <th>${key}</th>`;
                    }
                    tableHTML += ' </tr> </thead> <tbody > ';
                }
                tableHTML += '<tr>';
                for (const [key, value] of binding.entries) {
                    tableHTML += `
                  <td>${value.value}</td>`;
                }
                tableHTML += ' </tr>';
            });

            bindingsStream.on('end', () => {
                tableHTML += '</tbody> </table>';
                log(`Processed ${count} bindings.`);
                document.getElementById('results').innerHTML = tableHTML;
                log('Query execution completed.');
            });

            bindingsStream.on('error', (error) => {
                log('Error processing bindings: ' + error);
            });
        } else {
            log('Unsupported result type.');
        }
    } catch (error) {
        log('Error executing query: ' + error);
        document.getElementById('results').textContent = 'Error: ' + error.message;
    }
}

