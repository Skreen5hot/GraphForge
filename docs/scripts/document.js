// SECTION: Main
const PREDEFINED_FOLDER_NAME = "GraphForge";
const dbName = 'GraphForgeDB';
let appFolderHandle;
      let selectedFileHandle;
      let selectedProjectFolderHandle;

// Initialize the app
async function initializeApp() {
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

// Function to read and display file content
async function readFileContent(fileHandle) {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();

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
      const lines = text.split('\n');
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



// Modify showEntireDirectory to add event listeners to file items
async function showEntireDirectory(directoryHandle, currentPath, parentElement) {
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
    await projectHandle.getDirectoryHandle("Source Data", { create: true });
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
    const yourDataFile = await sourceDataFolder.getFileHandle("yourData.txt", { create: true });
    const writable = await yourDataFile.createWritable();
    await writable.write("Sample data for your demo.");
    await writable.close();

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
// Generic function for handling context menu actions
function addContextMenuListener(menuItemId, actionFn) {
  document.getElementById(menuItemId).addEventListener("click", () => {
    actionFn();
    document.getElementById("context-menu").style.display = "none"; // Hide menu after action
  });
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
window.onload = initializeApp;
