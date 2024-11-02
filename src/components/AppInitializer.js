import { createQuerySection } from './QuerySection';

export function initializeApp() {
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
