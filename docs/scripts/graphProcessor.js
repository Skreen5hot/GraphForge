let store = new N3.Store();
let prefixes = {}; // Global object to store prefixes
const DEBUG = false;

function log(message) {
    if (DEBUG) {
        console.log(message);
    }
    document.getElementById('results').innerHTML += message + ' < br > ';
}

async function checkAndTriplify(directoryHandle) {
    if (!directoryHandle || !(directoryHandle instanceof FileSystemDirectoryHandle)) {
        console.error('Invalid directory handle:', directoryHandle);
        return;
    }

    const name = directoryHandle.name;
    console.log(`Processing project: ${name}`);

    let quadsFileHandle;
    let needsTriplify = false;

    // Check for `quads.nq` or create it if missing
    try {
        quadsFileHandle = await directoryHandle.getFileHandle('quads.nq', { create: false });
        console.log(`Found quads.nq in project: ${name}`);
    } catch (error) {
        console.warn(`quads.nq not found in project: ${name}. Creating it.`);
        // Create `quads.nq` if it doesn't exist
        quadsFileHandle = await directoryHandle.getFileHandle('quads.nq', { create: true });
        needsTriplify = true; // Force triplify since the file was missing
    }

    // If not already flagged to triplify, check file modification dates
    if (!needsTriplify) {
        const quadsModified = await (await quadsFileHandle.getFile()).lastModified;

        for await (const [fileName, fileHandle] of directoryHandle.entries()) {
            if (fileHandle.kind === 'file' && (fileName.endsWith('.owl') || fileName.endsWith('.ttl'))) {
                const sourceModified = await (await fileHandle.getFile()).lastModified;

                // If any source file is newer, mark as needing triplify
                if (sourceModified > quadsModified) {
                    needsTriplify = true;
                    break;
                }
            }
        }
    }

    if (needsTriplify) {
        console.log(`Updating quads.nq for project: ${name}`);
        const writableStream = await quadsFileHandle.createWritable();

        try {
            await writableStream.write(new Blob([])); // Clear file content
            console.log("File content cleared");

            let totalWritten = 0; // Track how much is written

            for await (const [fileName, fileHandle] of directoryHandle.entries()) {
                if (fileHandle.kind === 'file' && (fileName.endsWith('.owl') || fileName.endsWith('.ttl'))) {
                    const file = await fileHandle.getFile();
                    console.log(`Processing file: ${fileName}`);

                    // Wait for triplify to resolve
                    const output = await triplify(file);  // Assuming this returns RDF quads

                    if (!output || output.length === 0) {
                        console.warn(`No RDF quads generated for file: ${fileName}`);
                        continue; // Skip if no quads are generated
                    }

                    // Create an N3.Writer instance with N-Quads format
                    const writer = new N3.Writer({ format: 'application/n-quads' });

                    // Convert N3Store (output) to quads
                    output.forEach(quad => {
                        writer.addQuad(quad);  // Add each quad
                    });

                    // Use a Promise to handle the async nature of writer.end()
                    await new Promise((resolve, reject) => {
                        writer.end((error, result) => {
                            if (error) {
                                reject(`Error generating N-Quads file: ${error}`);
                                return;
                            }

                            // The result is the N-Quads formatted string
                            const outputString = result;
                            console.log(`Generated N-Quads content for file: ${fileName}`);

                            // Write the output string to the writable stream
                            if (typeof outputString === 'string') {
                                writableStream.write(outputString);
                                totalWritten += outputString.length;
                                console.log(`Written ${outputString.length} bytes to quads.nq`);
                            } else {
                                reject(`Output is not a valid string: ${outputString}`);
                            }
                            resolve();  // Resolve once the write operation is complete
                        });
                    });
                }
            }
            await writableStream.close();
            console.log(`Total bytes written to quads.nq: ${totalWritten}`);
        } catch (error) {
            console.error("Error in triplefy process:", error);
            await writableStream.abort();
        }
    } else {
        console.log(`No updates needed for project: ${name}`);
    }
}

async function processProjects(projects) {
    if (!Array.isArray(projects)) {
        console.error('Invalid projects array:', projects);
        return;
    }

    for (const project of projects) {
        const { handle, name } = project; // Properly extract handle and name

        // Ensure the handle is valid before processing
        if (!handle || !(handle instanceof FileSystemDirectoryHandle)) {
            console.error('Invalid handle in project:', project);
            continue;
        }

        try {
            await checkAndTriplify(handle); // Pass only the handle
        } catch (error) {
            console.error(`Error processing project: ${name}`, error);
        }
    }
}

async function triplify(file) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Processing file in triplify:', file.name);

            // Use FileReader to read the content of the file
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                const fileExtension = file.name.split('.').pop().toLowerCase();
                let quads = "";

                try {
                    if (fileExtension === "ttl") {
                        quads = parseWithN3(content, "Turtle");
                    } else if (fileExtension === "owl" || fileExtension === "rdf") {
                        quads = parseWithRdfParser(content);
                    } else {
                        console.error("Unsupported file format:", file.name);
                        reject(new Error("Unsupported file format"));
                        return;
                    }
                    console.log(`Quads generated for ${file.name}:`, quads);
                    resolve(quads); // Return the quads as output
                } catch (error) {
                    console.error(`Error parsing content for ${file.name}:`, error);
                    reject(error);
                }
            };

            reader.onerror = function () {
                console.error(`Error reading file: ${file.name}`);
                reject(new Error("Error reading file"));
            };

            reader.readAsText(file); // Pass the File object to readAsText
        } catch (error) {
            console.error('Unexpected error in triplify:', error);
            reject(error);
        }
    });
}

function parseWithN3(content, format) {
    return new Promise((resolve, reject) => {
        const parser = new N3.Parser({ format: format });

        parser.parse(content, (error, quad, prefixDeclarations) => {
            if (error) {
                reject('Error parsing file: ' + error); // Reject the promise if there is an error
            } else if (quad) {
                store.add(quad); // Add the quad to the store
            } else {
                log('File loaded successfully. Triples count: ' + store.size);
                resolve(store); // Resolve the promise with the store after parsing completes
            }
        });
    });
}


function parseWithRdfParser(content) {
    const rdfParser = new DOMParser();
    const xmlDoc = rdfParser.parseFromString(content, "text/xml");
    const triples = [];

    // Function to extract triples from the XML content
    function extractTriples(subject, predicate, object) {
        let objectValue;
        if (typeof object === 'string') {
            objectValue = object;
        } else if (object && typeof object === 'object') {
            objectValue = object.getAttribute && object.getAttribute('rdf:resource') || object.textContent && object.textContent.trim();
        }
        if (objectValue) {
            // Ensure subject is never empty
            const safeSubject = subject || '_:blank';
            store.addQuad(
                N3.DataFactory.namedNode(safeSubject),
                N3.DataFactory.namedNode(predicate),
                objectValue.startsWith('http') ? N3.DataFactory.namedNode(objectValue) : N3.DataFactory.literal(objectValue)
            );
        }
    }

    // Function to traverse the XML structure and extract triples
    function traverseXML(node, subject) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const nodeName = node.nodeName;
            const newSubject = node.getAttribute('rdf:about') || node.getAttribute('rdf:ID') || subject;

            if (nodeName === 'owl:Class') {
                for (let child of node.childNodes) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        if (child.nodeName === 'owl:equivalentClass') {
                            handleEquivalentClass(child, newSubject);
                        } else {
                            extractTriples(newSubject, child.nodeName, child);
                        }
                    }
                }
            } else if (nodeName !== 'rdf:RDF' && nodeName !== 'rdf:Description') {
                for (let child of node.childNodes) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const predicate = child.nodeName;
                        if (child.hasAttribute('rdf:resource')) {
                            extractTriples(newSubject, predicate, child);
                        } else if (child.childNodes.length > 0) {
                            traverseXML(child, newSubject);
                        } else {
                            extractTriples(newSubject, predicate, child);
                        }
                    }
                }
            } else {
                for (let child of node.childNodes) {
                    traverseXML(child, newSubject);
                }
            }
        }
    }

    // Function to handle equivalent class processing
    function handleEquivalentClass(node, subject) {
        for (let child of node.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.nodeName === 'owl:Class') {
                    const oneOf = child.getElementsByTagName('owl:oneOf')[0];
                    if (oneOf) {
                        const members = oneOf.getElementsByTagName('rdf:Description');
                        for (let member of members) {
                            const memberURI = member.getAttribute('rdf:about');
                            if (memberURI) {
                                extractTriples(memberURI, 'rdf:type', subject);
                            }
                        }
                    }
                }
            }
        }
    }

    const rdfRoot = xmlDoc.documentElement;
    if (rdfRoot) {
        traverseXML(rdfRoot, '');
    }

    // Log all the triples before adding them to the store
    console.log('All extracted triples:', triples);

    // Add each triple to the store (ensuring each object is added separately)
    triples.forEach(triple => {
        console.log('Final Triple:', triple);  // Log the final triple being added to the store
        // Ensure we treat objects as literals or resources
        store.addQuad(N3.DataFactory.namedNode(triple.subject), N3.DataFactory.namedNode(triple.predicate),
            triple.object.startsWith('http') ? N3.DataFactory.namedNode(triple.object) : N3.DataFactory.literal(triple.object));
    });

    console.log('File loaded successfully. Triples count: ' + store.size);

    // Return store size or a message if no quads
    return store.size > 0 ? store : "No triples generated";
}
