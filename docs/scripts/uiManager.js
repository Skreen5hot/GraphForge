// Initialize App - handles first query section and new sections
document.addEventListener('DOMContentLoaded', function () {
    setupRouting();

    const sidebar = document.querySelector('.sidebar');
    const rightPanel = document.querySelector('.right-panel');
    const sidebarToggle = document.querySelector('.toggle-sidebar');
    const rightPanelToggle = document.querySelector('.toggle-right-panel');

    // Toggle sidebar visibility
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '❯' : '❮';
    });

    // Toggle right panel visibility
    rightPanelToggle.addEventListener('click', () => {
        rightPanel.classList.toggle('collapsed');
        rightPanelToggle.textContent = rightPanel.classList.contains('collapsed') ? '❮' : '❯';
    });

    initializeApp();
});

// This is not with the other event listener as the elements do not exist before page load
document.addEventListener('click', function (event) {
    if (event.target.closest('.projectHeader')) {
        toggleToState('.projectHeader');
    }
});

// Hide the context menu on click outside
document.addEventListener("click", (event) => {
    const contextMenu = document.getElementById("context-menu");
    if (!contextMenu.contains(event.target)) {
        contextMenu.style.display = "none";
    }
});

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

// Generic function for handling context menu actions
function addContextMenuListener(menuItemId, actionFn) {
    document.getElementById(menuItemId).addEventListener("click", () => {
        actionFn();
        document.getElementById("context-menu").style.display = "none"; // Hide menu after action
    });
}

// Set up routing for SPA
function setupRouting() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');
    function navigate() {
        const hash = location.hash || '#home';
        sections.forEach(section => section.classList.add('hidden'));
        document.querySelector(hash).classList.remove('hidden');
    }
    navLinks.forEach(link => link.addEventListener('click', () => navigate()));
    window.addEventListener('hashchange', navigate);
    navigate(); // Initial load
}

function menuFunction() {
    var x = document.getElementById("myTopnav");
    if (x.className === "topnav") {
        x.className += " responsive";
    } else {
        x.className = "topnav";
    }
}

function setActive(element) {
    // Remove the "active" class from all links
    var links = document.querySelectorAll(".topnav a");
    links.forEach(link => link.classList.remove("active"));

    // Add the "active" class to the clicked link
    element.classList.add("active");
}

function initializeApp() {
    const querySectionsContainer = document.getElementById('query-sections-container');
    const addQueryButton = document.getElementById('add-query-section');

    // Add the initial query section on load
    addQuerySection(querySectionsContainer);

    // Event listener for adding new query sections
    addQueryButton.addEventListener('click', () => addQuerySection(querySectionsContainer));
}

function addQuerySection(container) {
    const querySection = createQuerySection();
    container.prepend(querySection);  // Adds the section to the top
}

// Query Section UI Component
function createQuerySection() {
    const querySection = document.createElement('section');
    querySection.classList.add('query-section');

    // Create query input
    const queryInput = document.createElement('textarea');
    queryInput.classList.add('query-input');
    queryInput.id = 'queryInput';
    queryInput.placeholder = 'Enter your query...';
    queryInput.value = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  SELECT *
  WHERE   { 
          ?s ?p ?o .                
          } LIMIT 50`;

    // Create run query button
    const runButton = document.createElement('button');
    runButton.textContent = 'Run Query';
    runButton.classList.add('run-query-button');

    // Create results box
    const resultsBox = document.createElement('div');
    resultsBox.classList.add('query-results');
    resultsBox.id = 'results';
    resultsBox.textContent = 'Results will appear here.';
    // Create Graph box
    const graphBox = document.createElement('div');
    graphBox.classList.add('graph-results');
    graphBox.id = 'graphDiv';



    // Attach event listener to run the query on button click
    runButton.addEventListener('click', () => executeQuery());

    // Append elements to the query section
    querySection.appendChild(queryInput);
    querySection.appendChild(runButton);
    querySection.appendChild(resultsBox);
    querySection.appendChild(graphBox);

    return querySection;
}

// Toggle states of elements
function toggleToState(selector, activeClass = 'active') {
    const elements = document.querySelectorAll(selector);
    const clickedElement = event.target.closest(selector);

    if (clickedElement) {
        const isCurrentlyActive = clickedElement.classList.contains(activeClass);
        elements.forEach(el => el.classList.remove(activeClass));
        if (!isCurrentlyActive) {
            clickedElement.classList.add(activeClass);
        }
    }
}

// Check if the protocol is 'file:' (indicating a local file system)
if (window.location.protocol !== 'file:') {
    // Create a link element for the manifest
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.json';  // Adjust path as needed

    // Append it to the head
    document.head.appendChild(link);
} else {
    console.log("Manifest not loaded due to local environment.");
}