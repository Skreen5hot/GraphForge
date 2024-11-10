const PREDEFINED_FOLDER_NAME = "GraphForge";
const dbName = 'GraphForgeDB';
let appFolderHandle;

// Pure function to open IndexedDB and return a Promise that resolves with the DB instance
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('handles');
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

// Pure function to store a folder handle in IndexedDB
function storeFolderHandle(db, handle) {
    const transaction = db.transaction(['handles'], 'readwrite');
    const store = transaction.objectStore('handles');
    const request = store.put(handle, 'appFolderHandle');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// Pure function to retrieve a folder handle from IndexedDB
function getStoredFolderHandle(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['handles'], 'readonly');
        const store = transaction.objectStore('handles');
        const request = store.get('appFolderHandle');
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Pure function to create a folder handle inside the app folder
async function createAppFolder() {
    try {
        const baseDirectoryHandle = await window.showDirectoryPicker();
        const folderHandle = await baseDirectoryHandle.getDirectoryHandle(PREDEFINED_FOLDER_NAME, {
            create: true
        });

        // Now that the app folder is created, create the demo project
        await createDemo(folderHandle);

        return folderHandle;
    } catch (error) {
        throw new Error("Error accessing or creating folder: " + error);
    }
}
async function createDemo(appFolderHandle) {
    if (!appFolderHandle) {
        console.error("App folder handle not found. Initialize the app first.");
        return;
    }
    try {
        // Create or access the Project Demo folder
        const demoFolder = await appFolderHandle.getDirectoryHandle("Project Demo", {
            create: true
        });

        // Request read-write permissions for the Project Demo folder
        await demoFolder.requestPermission({
            mode: 'readwrite'
        });

        // Create or access the Source Data folder inside Project Demo
        const sourceDataFolder = await demoFolder.getDirectoryHandle("Source Data", {
            create: true
        });

        // Request read-write permissions for the Source Data folder
        await sourceDataFolder.requestPermission({
            mode: 'readwrite'
        });

        // Create and write to yourData.txt inside Source Data
        const yourDataFile = await sourceDataFolder.getFileHandle("yourData.txt", {
            create: true
        });

        // Request read-write permissions for the yourData.txt file
        await yourDataFile.requestPermission({
            mode: 'readwrite'
        });

        // Write sample data to the file
        const writable = await yourDataFile.createWritable();
        await writable.write("Sample data for your demo.");
        await writable.close();

        console.log("Demo project created successfully with read-write permissions.");
    } catch (error) {
        console.error("Error creating demo project:", error);
    }
}


// Function to initialize the app by setting up the database and retrieving the stored folder handle
async function initializeApp() {
    const db = await openDatabase();
    appFolderHandle = await getStoredFolderHandle(db);
    if (!appFolderHandle) {
        console.log("App folder not initialized.");
        const initializeMessageSection = document.getElementById('initializeMessage');
        initializeMessageSection.classList.remove('hidden'); // Remove hidden class if the folder is not initialized
    } else {
        await showDirectory(); // Call showDirectory if folder exists

    }
}

// Function to re-authorize directory
async function reAuthorizeDirectory() {
    try {
        const permission = await appFolderHandle.requestPermission({
            mode: 'readwrite'
        });
        if (permission === 'granted') {
            console.log("Directory access re-authorized.");
            document.getElementById('reAuthDir').classList.add('hidden'); // Hide the Re-Authorize button after successful re-authorization

            await showDirectory();
        } else {
            console.warn("Directory re-authorization was denied.");
        }
    } catch (error) {
        console.error("Error re-authorizing directory:", error);
    }
}

async function showDirectory() {
    const directoryListElement = document.getElementById("directoryList");

    // Check if the directoryList element exists
    if (!directoryListElement) {
        console.error("Error: directoryList element not found.");
        return;
    }

    if (!appFolderHandle) {
        alert("Please initialize the app folder first.");
        return;
    }

    try {
        const permission = await appFolderHandle.queryPermission({
            mode: 'readwrite'
        });
        if (permission !== 'granted') {
            alert("Access to the directory is not authorized. Please re-authorize.");
            document.getElementById('reAuthDir').classList.remove('hidden');
            return;
        }
        // Clear the existing list before showing the new structure
        directoryListElement.innerHTML = '';

        // List all top-level directories in the root (appFolderHandle)
        console.log("Listing available folders inside the root appFolderHandle:");
        for await (const [name, handle] of appFolderHandle.entries()) {
            if (handle.kind === "directory") {
                console.log(`Found entry: directory - ${name}`);

                // Create a list item for the top-level directory
                const topLevelDirItem = document.createElement("li");
                topLevelDirItem.textContent = name;
                topLevelDirItem.className = "project";
                topLevelDirItem.setAttribute('data-name', name);
                topLevelDirItem.innerHTML = `<div class="projectHeader">${name}</div>`;


                directoryListElement.appendChild(topLevelDirItem);

                // Create a nested <ul> for the directory's contents
                const nestedList = document.createElement("ul");
                topLevelDirItem.appendChild(nestedList);

                // Recursively display contents of this directory without adding the directory name again
                await showEntireDirectory(handle, name, nestedList);
            }
        }
    } catch (error) {
        console.error("Error accessing folders in root appFolderHandle:", error);
    }
}

// Function to recursively read the directory and display it in the <ul>
async function showEntireDirectory(directoryHandle, currentPath, parentElement) {
    try {
        // List all entries in the current directory
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'directory') {
                // Create a list item for subdirectory, showing only the folder name
                const directoryItem = document.createElement('li');
                directoryItem.className = "project-folder";
                directoryItem.setAttribute('data-name', entry.name);
                directoryItem.innerHTML = `🖿 ${entry.name} <span class="upload-doc" onclick="uploadDocument(event)">+ Doc</span>`;

                parentElement.appendChild(directoryItem);

                // Create a sublist for the directory's contents
                const sublist = document.createElement('ul');
                directoryItem.appendChild(sublist);

                // Recursively read subdirectories and add them to the list
                await showEntireDirectory(entry, entry.name, sublist);
            } else if (entry.kind === 'file') {
                // Add files to the list, showing only the file name
                const fileItem = document.createElement('li');
                fileItem.textContent = entry.name;
                fileItem.className = "file";
                fileItem.setAttribute('data-name', entry.name);
                parentElement.appendChild(fileItem);
            }
        }
    } catch (error) {
        console.error(`Error reading directory at ${currentPath}:`, error);
    }
}

// Function to upload a document to a specific project's "Source Data" directory
async function uploadDocument(event) {
    try {
        // Get the closest elements with the 'project' and 'project-folder' classes
        const folderElement = event.target.closest('.project-folder');
        const projectElement = event.target.closest('.project');

        // Retrieve the project and folder names from data attributes
        const projectName = projectElement.getAttribute('data-name');
        const folderName = folderElement.getAttribute('data-name');

        if (!projectName || !folderName) {
            console.error("Project or folder name not found.");
            return;
        }

        // Navigate through the directory structure to find the target folder
        const projectHandle = await appFolderHandle.getDirectoryHandle(projectName, {
            create: false
        });
        const targetFolderHandle = await projectHandle.getDirectoryHandle(folderName, {
            create: false
        });

        // Prompt the user to select a file for upload
        const [fileHandle] = await window.showOpenFilePicker();
        if (!fileHandle) {
            console.log("No file selected.");
            return;
        }

        // Create or retrieve a file handle in the specified folder
        const newFileHandle = await targetFolderHandle.getFileHandle(fileHandle.name, {
            create: true
        });

        // Request write permission for the new file handle
        const permission = await newFileHandle.requestPermission({
            mode: 'readwrite'
        });
        if (permission !== 'granted') {
            console.error("Permission denied for writing to the file.");
            return;
        }

        // Write file content to the new file handle
        const writable = await newFileHandle.createWritable();
        const fileData = await fileHandle.getFile();
        await writable.write(fileData);
        await writable.close();
        await showDirectory();
        console.log(`File '${fileHandle.name}' uploaded successfully to '${projectName}/${folderName}'`);
    } catch (error) {
        console.error("Error uploading document:", error);
    }
}

// Function to create a new project with a "Source Data" subdirectory
async function createNewProject() {
    try {
        // Prompt the user to enter a name for the new project
        const projectName = prompt("Enter the name of the new project:");
        if (!projectName) {
            console.log("Project creation canceled.");
            return;
        }

        // Create the new project directory in the root directory (appFolderHandle)
        const projectHandle = await appFolderHandle.getDirectoryHandle(projectName, {
            create: true
        });

        // Create the "Source Data" subdirectory within the new project directory
        await projectHandle.getDirectoryHandle("Source Data", {
            create: true
        });

        console.log(`Project '${projectName}' with 'Source Data' folder created successfully.`);

        // Refresh the directory list UI
        await showDirectory();
    } catch (error) {
        console.error("Error creating new project:", error);
    }
}

// Event listeners for UI buttons
document.addEventListener('DOMContentLoaded', () => {
    const initializeButton = document.getElementById('initializeButton');
    const reAuthDirButton = document.getElementById('reAuthDir');


    initializeButton.addEventListener('click', async () => {
        const db = await openDatabase();
        appFolderHandle = await createAppFolder();
        await storeFolderHandle(db, appFolderHandle);
        // Call showDirectory to display the folder content at the end
        await showDirectory();
        const initializeMessageSection = document.getElementById('initializeMessage');
        initializeMessageSection.classList.add('hidden'); // Remove hidden class if the folder is not initialized
    });
    // New event listener for re-authorization button
    reAuthDirButton.addEventListener('click', reAuthorizeDirectory);


    // Initialize app when page loads
    initializeApp();
});