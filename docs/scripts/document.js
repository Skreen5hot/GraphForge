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
    const folderHandle = await baseDirectoryHandle.getDirectoryHandle(PREDEFINED_FOLDER_NAME, { create: true });

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
await demoFolder.requestPermission({ mode: 'readwrite' });

// Create or access the Source Data folder inside Project Demo
const sourceDataFolder = await demoFolder.getDirectoryHandle("Source Data", {
create: true
});

// Request read-write permissions for the Source Data folder
await sourceDataFolder.requestPermission({ mode: 'readwrite' });

// Create and write to yourData.txt inside Source Data
const yourDataFile = await sourceDataFolder.getFileHandle("yourData.txt", {
create: true
});

// Request read-write permissions for the yourData.txt file
await yourDataFile.requestPermission({ mode: 'readwrite' });

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
// Clear the existing list before showing the new structure
directoryListElement.innerHTML = '';

// List all top-level directories in the root (appFolderHandle)
console.log("Listing available folders inside the root appFolderHandle:");
for await (const [name, handle] of appFolderHandle.entries()) {
if (handle.kind === "directory") {
  console.log(`Found entry: directory - ${name}`);

  // Create a list item for the top-level directory
  const topLevelDirItem = document.createElement("li");
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


async function readDirectory() {
if (!appFolderHandle) {
alert("Please initialize the app folder first.");
return;
}

try {
// Log all entries in the root folder to see available directories
console.log("Listing available folders inside the root appFolderHandle:");

// Iterate through all top-level entries
for await (const entry of appFolderHandle.values()) {
console.log(`Found entry: ${entry.kind} - ${entry.name}`);

if (entry.kind === 'directory') {
  // Recursively read contents of each project directory
  await readEntireDirectory(entry, `/${entry.name}`);
}
}
} catch (error) {
console.error("Error accessing folders in root appFolderHandle:", error);
}
}

// Function to recursively read the contents of a directory
async function readEntireDirectory(directoryHandle, currentPath) {
try {
// List all entries in the current directory
for await (const entry of directoryHandle.values()) {
const entryPath = `${currentPath}/${entry.name}`;

if (entry.kind === 'directory') {
  console.log(`Directory: ${entryPath}`);
  // Recursively read subdirectories
  await readEntireDirectory(entry, entryPath);
} else if (entry.kind === 'file') {
  console.log(`File: ${entryPath}`);
}
}
} catch (error) {
console.error(`Error reading directory at ${currentPath}:`, error);
}
}




// Event listeners for UI buttons
document.addEventListener('DOMContentLoaded', () => {
  const initializeButton = document.getElementById('initializeButton');
  const createDemoButton = document.getElementById('createDemo');

  initializeButton.addEventListener('click', async () => {
    const db = await openDatabase();
    appFolderHandle = await createAppFolder();
    await storeFolderHandle(db, appFolderHandle);
    // Call showDirectory to display the folder content at the end
    await showDirectory();
                          const initializeMessageSection = document.getElementById('initializeMessage');
initializeMessageSection.classList.add('hidden'); // Remove hidden class if the folder is not initialized
  });

      // Button to read the directory and log its contents
  readDirectoryButton.addEventListener('click', readDirectory);

  // Initialize app when page loads
  initializeApp();
});