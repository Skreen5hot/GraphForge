document.addEventListener('DOMContentLoaded', () => {
    const contextMenu = document.getElementById('context-menu');

    // Show context menu
    document.querySelectorAll('.project, .project-folder, .file').forEach(item => {
        item.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            const { clientX: mouseX, clientY: mouseY } = event;

            contextMenu.style.top = mouseY + 'px';
            contextMenu.style.left = mouseX + 'px';
            contextMenu.style.display = 'block';

            // Store selected item for later actions
            contextMenu.setAttribute('data-selected', item.getAttribute('data-name'));
        });
    });


    // Hide context menu on click elsewhere
    window.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    // Handle context menu actions
    contextMenu.addEventListener('click', (event) => {
        const action = event.target.id;
        const selectedItem = contextMenu.getAttribute('data-selected');
        if (action && selectedItem) {
            alert(`${action.charAt(0).toUpperCase() + action.slice(1)}: ${selectedItem}`);
            contextMenu.style.display = 'none';
        }
    });
});



let appFolderHandle;
const PREDEFINED_FOLDER_NAME = "Demo Project";

// Open IndexedDB for storing the folder handle
const dbName = 'GraphForgeDB';
let db;

// Function to open the database
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.createObjectStore('handles');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Store folder handle in IndexedDB
function storeFolderHandle(handle) {
    const transaction = db.transaction(['handles'], 'readwrite');
    const store = transaction.objectStore('handles');
    const request = store.put(handle, 'appFolderHandle');

    request.onsuccess = () => {
        console.log("Folder handle saved in IndexedDB.");
    };

    request.onerror = (event) => {
        console.error("Error saving folder handle:", event.target.error);
    };
}

// Retrieve folder handle from IndexedDB
function getStoredFolderHandle() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['handles'], 'readonly');
        const store = transaction.objectStore('handles');
        const request = store.get('appFolderHandle');

        request.onsuccess = (event) => {
            const handle = event.target.result;
            resolve(handle);
        };

        request.onerror = (event) => {
            console.error("Error retrieving folder handle:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Check if we have permission to access the folder
async function verifyPermission(handle) {
    const options = { mode: 'readwrite' };
    if (await handle.queryPermission(options) === 'granted') return true;
    if (await handle.requestPermission(options) === 'granted') return true;
    return false;
}

// Create or retrieve the GraphForge folder handle
async function createAppFolder() {
    try {
        const baseDirectoryHandle = await window.showDirectoryPicker();
        appFolderHandle = await baseDirectoryHandle.getDirectoryHandle(PREDEFINED_FOLDER_NAME, { create: true });
        console.log(`App folder "${PREDEFINED_FOLDER_NAME}" created or accessed:`, appFolderHandle);
        createFile();
        storeFolderHandle(appFolderHandle);
    } catch (error) {
        console.error("Error accessing or creating folder:", error);
        alert("Please select a folder outside of system-protected directories like Documents, Desktop, or Downloads.");
    }
}

// Initialize the app on load
async function initializeApp() {
    await openDatabase(); // Open the database first
    appFolderHandle = await getStoredFolderHandle();
    if (!appFolderHandle) {
        console.log("App folder not initialized.");
    } else {
        console.log(`App folder "${PREDEFINED_FOLDER_NAME}" handle retrieved from IndexedDB.`);
    }
}

// List files in the folder
async function listFiles() {
    await initializeApp(); // Ensure the app is initialized first

    if (!appFolderHandle) {
        alert("Please initialize the app folder first.");
        return;
    }

    const fileNamesElement = document.getElementById("fileNames");
    fileNamesElement.innerHTML = ""; // Clear previous file names

    for await (const entry of appFolderHandle.values()) {
        const listItem = document.createElement("li");
        listItem.textContent = entry.name; // Add file name to list
        listItem.classList.add("file");
        fileNamesElement.appendChild(listItem);
    }
}

// Create and write to a file
async function createFile() {
    if (!appFolderHandle) {
        alert("Please initialize the app folder first.");
        return;
    }
    const fileHandle = await appFolderHandle.getFileHandle('example.txt', { create: true });
    const writableStream = await fileHandle.createWritable();
    await writableStream.write("Hello, this is GraphForge!");
    await writableStream.close();
    console.log("Content written to file: example.txt");
}

// Read file content
async function readFileContent() {
    if (!appFolderHandle) {
        alert("Please initialize the app folder first.");
        return;
    }
    try {
        const fileHandle = await appFolderHandle.getFileHandle('example.txt');
        const file = await fileHandle.getFile();
        const content = await file.text();
        alert(`File content of example.txt:\n${content}`);
    } catch (error) {
        console.error("Error reading file:", error);
        alert("Error reading file. Ensure the file exists.");
    }
}

// Initialize the app when the page loads
window.onload = initializeApp;