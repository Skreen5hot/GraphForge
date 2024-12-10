/**
 * A pure function that extracts the predicate and count data from the query result.
 * 
 * @param {Array} bindings - The array of bindings from the query result.
 * @returns {Object} - An object containing the x and y values for Plotly.
 */
function preparePlotData(bindings) {
    const x = [];  // Array to hold the x-axis data (e.g., predicates)
    const y = [];  // Array to hold the y-axis data (e.g., counts)
    let xLabel = '';
    let yLabel = '';

    // Check if there are exactly two columns in the first binding
    if (bindings.length > 0) {
        const firstBinding = bindings[0].entries; // The entries of the first binding

        const keys = Array.from(firstBinding.keys());

        // Ensure there are exactly two columns
        if (keys.length !== 2) {
            console.log('Error: Query results should contain exactly two columns.');
            return null;  // Return null if the condition is not met
        }

        // Dynamically assign the labels based on the query result
        xLabel = keys[0];  // Assuming the first key corresponds to the x-axis variable
        yLabel = keys[1];  // Assuming the second key corresponds to the y-axis variable

        // Check if the second column contains numeric values
        bindings.forEach(binding => {
            const entries = Array.from(binding.entries);
            const yValue = parseFloat(entries[1][1].value); // Try to parse the second column as a number

            // If the second column is not numeric, return null to skip rendering the plot
            if (isNaN(yValue)) {
                console.log('Error: The second column must contain numeric values.');
                return null;  // Return null if the second column is not numeric
            }

            x.push(entries[0][1].value);  // Add the first column value (predicate) to x
            y.push(yValue);  // Add the second column value (count) to y
        });
    }

    // Return null if there are any issues (e.g., more than 2 columns or non-numeric values)
    if (x.length === 0 || y.length === 0) {
        return null;
    }

    // Return the data and labels for plotting
    return {
        x: x,
        y: y,
        xLabel: xLabel,
        yLabel: yLabel,
        title: `Top ${xLabel} by ${yLabel}`  // Set a dynamic title
    };
}


/**
 * A pure function that renders a Plotly graph with the provided data.
 * 
 * @param {Object} plotData - The data for the plot, containing x (predicates) and y (counts).
 */
function renderPlotlyGraph(plotData) {
    const data = [{
        x: plotData.x,
        y: plotData.y,
        type: 'bar',
        name: plotData.yLabel  // Dynamically using the yLabel for the legend name
    }];
    
    const layout = {
        title: plotData.title || 'Query Results',
        xaxis: { title: plotData.xLabel || 'X Axis' },
        yaxis: { title: plotData.yLabel || 'Y Axis' }
    };
    
    // Create the plot using Plotly
    Plotly.newPlot('graphDiv', data, layout);
}


// Main executeQuery function
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
            let bindings = [];
            let tableHTML = '<table border = "1"><thead><tr>';
            let headers = [];
            let count = 0;
            
            bindingsStream.on('data', (binding) => {
                count++;
                if (count === 1) {
                    for (const [key] of binding.entries) {
                        headers.push(key);
                        tableHTML += `<th>${key}</th>`;
                    }
                    tableHTML += '</tr></thead><tbody>';
                }
                tableHTML += '<tr>';
                for (const [key, value] of binding.entries) {
                    tableHTML += `<td>${value.value}</td>`;
                }
                tableHTML += '</tr>';
                bindings.push(binding);  // Collect bindings for plotting
            });

            bindingsStream.on('end', () => {
                tableHTML += '</tbody></table>';
                log(`Processed ${count} bindings.`);
                document.getElementById('results').innerHTML = tableHTML;
                
                // Prepare and render the plot if we have exactly two columns and the second column is numeric
                const plotData = preparePlotData(bindings);
                if (plotData) {
                    renderPlotlyGraph(plotData);  // Only render if plotData is valid
                } else {
                    console.log('Plot not rendered due to invalid data.');
                }
            
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

