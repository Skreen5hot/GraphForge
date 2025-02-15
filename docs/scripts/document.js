    // SECTION: Main
    const PREDEFINED_FOLDER_NAME = "GraphForge";
    const dbName = 'GraphForgeDB';
    let appFolderHandle;
    let selectedFileHandle;
    let selectedProjectFolderHandle;

    // Initialize the app
    async function initializeDocuments() {
      const db = await openDatabase();
      appFolderHandle = await getStoredFolderHandle(db);
      const initializeMessageSection = document.getElementById('initializeMessage');

      if (!appFolderHandle) {
        console.log("App folder not initialized.");
        initializeMessageSection.classList.remove('hidden');
      } else {
        await showDirectory();
      }
    }

    // Re-authorize directory access
    async function reAuthorizeDirectory() {
      try {
        const permission = await appFolderHandle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          console.log("Directory access re-authorized.");
          document.getElementById('reAuthDir').classList.add('hidden');
          await showDirectory();
        } else {
          console.warn("Directory re-authorization was denied.");
        }
      } catch (error) {
        console.error("Error re-authorizing directory:", error);
      }
    }

    // Show the directory structure
    async function showDirectory() {
      const directoryListElement = document.getElementById("directoryList");

      if (!directoryListElement || !appFolderHandle) {
        console.error("Error: directoryList element or appFolderHandle not found.");
        return;
      }

      try {
        const permission = await appFolderHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          alert("Access to the directory is not authorized. Please re-authorize.");
          document.getElementById('reAuthDir').classList.remove('hidden');
          return;
        }

        directoryListElement.innerHTML = '';
        for await (const [name, handle] of appFolderHandle.entries()) {
          if (handle.kind === "directory") {
            const topLevelDirItem = document.createElement("li");
            topLevelDirItem.className = "project";
            topLevelDirItem.setAttribute('data-name', name);
            topLevelDirItem.innerHTML = `<div class="projectHeader">${name}</div>`;

            const nestedList = document.createElement("ul");
            topLevelDirItem.appendChild(nestedList);
            await showEntireDirectory(handle, name, nestedList);
            directoryListElement.appendChild(topLevelDirItem);
          }
        }
      } catch (error) {
        console.error("Error accessing folders:", error);
      }
    }

    async function getFileDates(directoryHandle) {
      // Ensure that the input is a directory handle
      if (!directoryHandle || directoryHandle.kind !== 'directory') {
        throw new Error('Invalid directory handle');
      }

      const fileDates = [];

      try {
        // Iterate over entries in the directory
        for await (const entry of directoryHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            const fileName = entry.name;
            const modificationDate = file.lastModified; // Timestamp of last modification

            // Push the file name and modification date into the result array
            fileDates.push({
              name: fileName,
              modificationDate: new Date(modificationDate).toLocaleString() // Convert timestamp to readable date
            });
          }
        }

        return fileDates;
      } catch (error) {
        console.error('Error reading files from the directory:', error);
        return []; // Return an empty array in case of error
      }
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



    // Function to read and display file content
    async function readFileContent(fileHandle) {
      try {
        const file = await fileHandle.getFile();
        const text = await file.text();

        // Ensure XML special characters are escaped to prevent HTML rendering issues
        const escapedText = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        // Get the existing <pre id="editable-code"> element if it exists
        const existingPre = document.getElementById('editable-code');
        if (existingPre) {
          // Remove the existing <pre> element if it exists
          existingPre.remove();
        }

        // Create the new <pre> element dynamically
        const pre = document.createElement('pre');
        pre.id = 'editable-code';
        pre.contentEditable = 'true';

        // Split the content by lines and add line numbers
        const lines = escapedText.split('\n');
        let numberedContent = '';
        lines.forEach((line, index) => {
          const trimmedLine = line.replace(/^\s+/, ''); // Remove leading spaces
          const indentation = line.replace(trimmedLine, ''); // Capture indentation

          numberedContent += `<p class="line-number-wrapper">${index + 1}</p><p class="line-content">${indentation}${trimmedLine}</p>\n`;
        });

        // Set the content to the <pre> element
        pre.innerHTML = numberedContent;

        // Insert the <pre> element into the DOM inside the 'content' div
        document.querySelector('#fileContent .content').appendChild(pre);
      } catch (error) {
        console.error("Error reading file:", error);
      }
    }


    async function showEntireDirectory(directoryHandle, currentPath, parentElement) {
      const projectHandles = []; // Collect project handles

      try {
        for await (const entry of directoryHandle.values()) {
          const itemElement = document.createElement('li');
          if (entry.kind === 'directory') {
            itemElement.className = "project-folder";
            itemElement.setAttribute('data-name', entry.name);
            itemElement.innerHTML = `🖿 ${entry.name} <span class="upload-doc" onclick="uploadDocument(event)">+ Doc</span>`;
            parentElement.appendChild(itemElement);

            const sublist = document.createElement('ul');
            itemElement.appendChild(sublist);

            // Check if the directory is a "Source Data" folder
            if (entry.name === "Source Data") {
              // Push an object containing the handle and name to projectHandles
              projectHandles.push({ handle: entry, name: entry.name }); // Corrected here
            }

            // Recursive call to show nested directories
            await showEntireDirectory(entry, entry.name, sublist);
          } else if (entry.kind === 'file') {
            itemElement.className = "file";
            itemElement.setAttribute('data-name', entry.name);
            itemElement.textContent = entry.name;

            // Add click event listener for file to display its contents
            itemElement.addEventListener('click', () => readFileContent(entry));

            parentElement.appendChild(itemElement);
          }
        }
      } catch (error) {
        console.error(`Error reading directory at ${currentPath}:`, error);
      }

      // Process projects after traversing the directory
      if (projectHandles.length > 0) {
        const projectsToRun = await processProjects(projectHandles); // Corrected here
        console.log(projectsToRun);
      }
    }


    // Function to create a new project with a "Source Data" subdirectory
    async function createNewProject() {
      try {
        const projectName = prompt("Enter the name of the new project:");
        if (!projectName) {
          console.log("Project creation canceled.");
          return;
        }

        const projectHandle = await appFolderHandle.getDirectoryHandle(projectName, { create: true });
        const sourceDataFolder = await projectHandle.getDirectoryHandle("Source Data", { create: true });
        const yourDataFile = await sourceDataFolder.getFileHandle("quads.nq", { create: true });

        console.log(`Project '${projectName}' with 'Source Data' folder created successfully.`);
        await showDirectory();
      } catch (error) {
        console.error("Error creating new project:", error);
      }
    }

    // Open IndexedDB and return a promise with the DB instance
    function openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = event => event.target.result.createObjectStore('handles');
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
      });
    }

    // Store a folder handle in IndexedDB
    function storeFolderHandle(db, handle) {
      const transaction = db.transaction(['handles'], 'readwrite');
      const store = transaction.objectStore('handles');
      const request = store.put(handle, 'appFolderHandle');
      return new Promise((resolve, reject) => {
        request.onsuccess = resolve;
        request.onerror = event => reject(event.target.error);
      });
    }

    // Retrieve a folder handle from IndexedDB
    function getStoredFolderHandle(db) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['handles'], 'readonly');
        const store = transaction.objectStore('handles');
        const request = store.get('appFolderHandle');
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
      });
    }

    // Create the app folder
    async function createAppFolder() {
      try {
        const baseDirectoryHandle = await window.showDirectoryPicker();
        const folderHandle = await baseDirectoryHandle.getDirectoryHandle(PREDEFINED_FOLDER_NAME, { create: true });
        await createDemo(folderHandle);
        return folderHandle;
      } catch (error) {
        throw new Error("Error accessing or creating folder: " + error);
      }
    }

    // Create a demo project inside the app folder
    async function createDemo(appFolderHandle) {
      if (!appFolderHandle) {
        console.error("App folder handle not found. Initialize the app first.");
        return;
      }

      try {
        const demoFolder = await appFolderHandle.getDirectoryHandle("Project Demo", { create: true });
        const sourceDataFolder = await demoFolder.getDirectoryHandle("Source Data", { create: true });
        const fileUrl1 = 'https://raw.githubusercontent.com/BFO-ontology/BFO/v2019-08-26/bfo_classes_only.owl';
        const fileUrl2 = 'https://raw.githubusercontent.com/owlcs/pizza-ontology/refs/heads/master/pizza.owl';

        // Fetch the BFO ontology content
        const bfoOwlContent = await fetchFile(fileUrl1);

        // Fetch the Pizza ontology content
        const pizzaContent = await fetchFile(fileUrl2);

        // Create a new file for bfo.owl and write the content
        const bfoOwlFile = await sourceDataFolder.getFileHandle("bfo.owl", { create: true });
        const writable = await bfoOwlFile.createWritable();
        await writable.write(bfoOwlContent);
        await writable.close();

// Create a new file for pizza.owl and write the content
const pizzaFile = await sourceDataFolder.getFileHandle("pizza.owl", { create: true });
const writable2 = await pizzaFile.createWritable();
await writable2.write(pizzaContent);
await writable2.close();

        //const yourDataFile = await sourceDataFolder.getFileHandle("quads.nq", { create: true });

        console.log("Demo project created successfully with read-write permissions.");
      } catch (error) {
        console.error("Error creating demo project:", error);
      }
    }

    // Upload a document to a project's folder
    async function uploadDocument(event) {
      try {
        const folderElement = event.target.closest('.project-folder');
        const projectElement = event.target.closest('.project');
        const projectName = projectElement.getAttribute('data-name');
        const folderName = folderElement.getAttribute('data-name');

        if (!projectName || !folderName) {
          console.error("Project or folder name not found.");
          return;
        }

        const projectHandle = await appFolderHandle.getDirectoryHandle(projectName, { create: false });
        const targetFolderHandle = await projectHandle.getDirectoryHandle(folderName, { create: false });
        const [fileHandle] = await window.showOpenFilePicker();

        if (!fileHandle) {
          console.log("No file selected.");
          return;
        }

        const newFileHandle = await targetFolderHandle.getFileHandle(fileHandle.name, { create: true });
        const writable = await newFileHandle.createWritable();
        const file = await fileHandle.getFile();
        await writable.write(file);
        await writable.close();
        await showDirectory();
        alert("File uploaded successfully.");


      } catch (error) {
        console.error("Error uploading document:", error);
      }
    }

    // Fetch the file content from an external URL
    async function fetchFile(fileUrl) {
      try {
        // Attempt to fetch the file from the provided URL
        const response = await fetch(fileUrl);

        // Handle the response accordingly
        if (response.ok) {
          // Return the text content of the .owl file
          return await response.text();
        } else {
          console.error('Failed to fetch the URL:', response.status);
          throw new Error(`Failed to fetch URL: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching the URL:', error);
        throw error;
      }
    }

    // Utility function to retrieve the Source Data folder for the selected project
    async function getFileSystemFolder(projectName) {
      if (!appFolderHandle || !projectName) return null;

      try {
        const projectFolderHandle = await appFolderHandle.getDirectoryHandle(projectName, { create: false });
        return await projectFolderHandle.getDirectoryHandle("Source Data", { create: false });
      } catch (error) {
        console.error("Error retrieving Source Data folder:", error);
        return null;
      }
    }

    // Function to rename a file
    async function renameFile() {
      if (!selectedFileHandle || !selectedProjectFolderHandle) return;

      const newFileName = prompt("Enter new file name:", selectedFileHandle);
      if (!newFileName) return console.log("Rename operation canceled.");

      const sourceDataFolder = await getFileSystemFolder(selectedProjectFolderHandle);
      if (!sourceDataFolder) return;

      try {
        const fileHandle = await sourceDataFolder.getFileHandle(selectedFileHandle);
        const newFileHandle = await sourceDataFolder.getFileHandle(newFileName, { create: true });

        const writableStream = await newFileHandle.createWritable();
        const fileData = await fileHandle.getFile();
        await writableStream.write(await fileData.arrayBuffer());
        await writableStream.close();

        await sourceDataFolder.removeEntry(selectedFileHandle);
        console.log(`File renamed from '${selectedFileHandle}' to '${newFileName}'`);

        selectedFileHandle = newFileName;
        await showDirectory();
      } catch (error) {
        console.error("Error renaming file:", error);
      }
    }

    // Function to delete a file
    async function deleteFile() {
      if (!selectedFileHandle || !selectedProjectFolderHandle) return;

      const confirmDelete = confirm(`Are you sure you want to delete '${selectedFileHandle}'?`);
      if (!confirmDelete) return console.log("Delete operation canceled.");

      const sourceDataFolder = await getFileSystemFolder(selectedProjectFolderHandle);
      if (!sourceDataFolder) return;

      try {
        await sourceDataFolder.removeEntry(selectedFileHandle);
        console.log(`File '${selectedFileHandle}' deleted`);

        await showDirectory();
      } catch (error) {
        console.error(`Error deleting file '${selectedFileHandle}':`, error);
      }
    }

    // Function to duplicate a file
    async function duplicateFile() {
      if (!selectedFileHandle || !selectedProjectFolderHandle) return;

      const sourceDataFolder = await getFileSystemFolder(selectedProjectFolderHandle);
      if (!sourceDataFolder) return;

      try {
        const originalFileHandle = await sourceDataFolder.getFileHandle(selectedFileHandle);
        const originalName = selectedFileHandle;
        let newName = originalName.replace(/(\.\w+)$/, '_copy$1');
        let duplicateIndex = 1;

        while (await sourceDataFolder.getFileHandle(newName).catch(() => false)) {
          newName = originalName.replace(/(\.\w+)$/, `_copy(${duplicateIndex})$1`);
          duplicateIndex++;
        }

        const originalFile = await originalFileHandle.getFile();
        const newFileHandle = await sourceDataFolder.getFileHandle(newName, { create: true });
        const writableStream = await newFileHandle.createWritable();
        await writableStream.write(await originalFile.arrayBuffer());
        await writableStream.close();

        console.log(`File '${originalName}' duplicated as '${newName}'`);
        await showDirectory();
      } catch (error) {
        console.error("Error duplicating file:", error);
      }
    }

    // Right-click event listener for the directory list
    document.getElementById("directoryList").addEventListener("contextmenu", (event) => {
      event.preventDefault();

      if (event.target.classList.contains("file")) {
        selectedFileHandle = event.target.getAttribute("data-name"); // Store the selected file name

        const projectElement = event.target.closest(".project");
        if (projectElement) {
          selectedProjectFolderHandle = projectElement.getAttribute("data-name"); // Set the project name for future reference
        }

        const contextMenu = document.getElementById("context-menu");
        contextMenu.style.display = "block";
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        console.log("Right-clicked on file:", selectedFileHandle);
        console.log("In project:", selectedProjectFolderHandle);
      }
    });

    // Generic function for handling context menu actions
    function addContextMenuListener(menuItemId, actionFn) {
      document.getElementById(menuItemId).addEventListener("click", () => {
        actionFn();
        document.getElementById("context-menu").style.display = "none"; // Hide menu after action
      });
    }

    // Hide the context menu on click outside
    document.addEventListener("click", (event) => {
      const contextMenu = document.getElementById("context-menu");
      if (!contextMenu.contains(event.target)) {
        contextMenu.style.display = "none";
      }
    });

    // Add event listeners to context menu options
    addContextMenuListener("renameOption", renameFile);
    addContextMenuListener("deleteOption", deleteFile);
    addContextMenuListener("duplicateOption", duplicateFile);

    // SECTION: Hooks
    document.addEventListener('DOMContentLoaded', () => {
      const initializeButton = document.getElementById('initializeButton');
      const reAuthDirButton = document.getElementById('reAuthDir');

      initializeButton.addEventListener('click', async () => {
        const db = await openDatabase();
        appFolderHandle = await createAppFolder();
        await storeFolderHandle(db, appFolderHandle);
        await showDirectory();
        document.getElementById('initializeMessage').classList.add('hidden');
      });

      reAuthDirButton.addEventListener('click', reAuthorizeDirectory);
    });

    // Trigger app initialization on load
    window.onload = initializeDocuments;


    let store = new N3.Store();
    let prefixes = {}; // Global object to store prefixes
    const DEBUG = false;

    function log(message) {
      if (DEBUG) {
        console.log(message);
      }
      document.getElementById('results').innerHTML += message + ' < br > ';
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
                    
// Function to clear the store and load new quads
async function loadQuadsToStore() {
  if (!selectedProjectFolderHandle) {
    console.error("No project folder is selected.");
    throw new Error("No project folder is selected.");
  }

  try {
    console.log("Attempting to get quads.nq file handle from the selected project folder.");

    const sourceDataHandle = await selectedProjectFolderHandle.getDirectoryHandle('Source Data', { create: false });
    if (!sourceDataHandle) {
      throw new Error("Source Data folder not found.");
    }

    const quadsFileHandle = await sourceDataHandle.getFileHandle('quads.nq', { create: false });
    if (!quadsFileHandle) {
      throw new Error("quads.nq file not found in the Source Data folder.");
    }

    const quadsFile = await quadsFileHandle.getFile();
    const quadsText = await quadsFile.text();
    console.log("Quads file text retrieved:", quadsText.slice(0, 100));

    // Clear the store and load the quads
    store = new N3.Store();
    const parser = new N3.Parser({ format: 'application/n-quads' });
    
    return new Promise((resolve, reject) => {
      parser.parse(quadsText, (error, quad, prefixes) => {
        if (error) {
          console.error("Error parsing quad:", error);
          reject(error);
        } else if (quad) {
          store.add(quad);
        } else {
          console.log("Quads loaded into the store. Total quads:", store.size);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Error loading quads file:", error);
    throw error;
  }
}

// Set the app's main folder handle
async function setAppFolderHandle(event) {
  console.log("Attempting to set app folder handle.");

  // Get the closest project element from the clicked target
  const projectElement = event.target.closest(".project");

  if (projectElement) {
    const projectName = projectElement.getAttribute("data-name"); // Get the project name for reference
    console.log("Project name selected:", projectName);

    if (appFolderHandle) {
      try {
        console.log("Attempting to get directory handle for project:", projectName);
        // Retrieve the selected project's folder handle from appFolderHandle
        selectedProjectFolderHandle = await appFolderHandle.getDirectoryHandle(projectName);
        console.log("Selected project folder handle:", selectedProjectFolderHandle);
      } catch (error) {
        console.error("Error accessing project folder handle:", error);
      }
    } else {
      console.error("App folder handle is not set.");
    }
  } else {
    console.error("No project element found in the event target.");
  }
}

// Event listener for handling project selection
document.getElementById('directoryList').addEventListener('click', async (event) => {
  console.log("Directory list clicked:", event.target);

  const projectHeader = event.target.closest('.projectHeader');
  if (projectHeader) {
    const projectElement = projectHeader.closest('.project');
    const projectName = projectElement?.dataset.name;

    if (projectName) {
      try {
        console.log("Handling project selection for:", projectName);

        // Set the app folder handle for the selected project
        await setAppFolderHandle(event);

        // Load the quads file into the store
        await loadQuadsToStore();
      } catch (error) {
        console.error("Error handling project selection:", error);
      }
    } else {
      console.error("No project name found in the project element.");
    }
  } else {
    console.error("No project header clicked.");
  }
});

async function executeQuery() {
  const queryEngine = new Comunica.QueryEngine();
  let query = document.getElementById('queryInput').value.trim();
  // Replace 'a' with 'rdf:type' in contexts where it's safe to do so
  query = query.replace(/\ba\s+(?=\w+:[\w-]+|<[^>]+>)/g, 'rdf:type ');
  // Check for prefixes and process them separately if needed
  const prefixRegex = /^PREFIX\s+\w+:\s*<[^>]+>\s*/gm;
  const prefixStatements = query.match(prefixRegex) || [];
  query = query.replace(prefixRegex, ''); // Remove from main query
  // Wrap unbracketed IRIs in angle brackets
  query = query.replace(/(\bhttp:\/\/[^\s<>]+)(?=\s|$)/g, '<$1>');
  // Leave CURIEs as is, without adding angle brackets
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
