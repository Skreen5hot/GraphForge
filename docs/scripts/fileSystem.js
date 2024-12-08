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
