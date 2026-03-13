// API Base URL
const API_BASE = '/api';

// Determine travel status based on travel date vs today
function calculateStatus(travelDateStr) {
    const travelDate = new Date(travelDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    travelDate.setHours(0, 0, 0, 0);

    if (travelDate > today) {
        return 'upcoming';
    }
    if (travelDate.getTime() === today.getTime()) {
        return 'ongoing';
    }
    return 'completed';
}

// Initialize app on document load
document.addEventListener('DOMContentLoaded', () => {
    // Determine current page and initialize accordingly
    const path = window.location.pathname;
    
    if (path === '/' || path === '/dashboard.html') {
        initDashboard();
    } else if (path === '/add' || path === '/index.html') {
        initAddForm();
    } else if (path.includes('/edit/')) {
        const travelId = path.split('/').pop();
        initEditForm(travelId);
    }
    
    // Set active nav link
    setActiveNavLink();
});

// Set active navigation link
function setActiveNavLink() {
    const path = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if ((path === '/' || path === '/dashboard.html') && (href === '/' || href === '/dashboard.html')) {
            link.classList.add('active');
        } else if ((path === '/add' || path === '/index.html') && (href === '/add' || href === '/index.html')) {
            link.classList.add('active');
        }
    });
}

// Initialize Dashboard
async function initDashboard() {
    await loadStats();
    await loadTravels();
    setupFilters();
}

// Load and display statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const stats = await response.json();
        
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">Total Trips</div>
                    <div class="stat-value">${stats.total_trips}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Budget</div>
                    <div class="stat-value">$${stats.total_budget.toFixed(2)}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load and display travels
async function loadTravels() {
    try {
        showMessage('Loading travels...', 'info');
        
        const response = await fetch(`${API_BASE}/travels`);
        const travels = await response.json();
        
        const container = document.getElementById('travels-container');
        if (!container) return;
        
        if (travels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✈️</div>
                    <h3>No travels yet</h3>
                    <p>Start planning your next adventure!</p>
                    <a href="/add" class="btn btn-primary">Add Travel</a>
                </div>
            `;
            hideMessage();
            return;
        }
        
        container.innerHTML = travels.map(travel => createTravelCard(travel)).join('');
        
        // Attach event listeners to action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `/edit/${e.currentTarget.dataset.id}`;
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this travel record?')) {
                    await deleteTravel(e.currentTarget.dataset.id);
                }
            });
        });
        
        hideMessage();
    } catch (error) {
        console.error('Error loading travels:', error);
        showMessage('Error loading travels', 'error');
    }
}

// Create travel card HTML
function createTravelCard(travel) {
    const personNames = JSON.parse(travel.person_names || '[]');
    const namesDisplay = personNames.length > 0 ? personNames.join(', ') : 'No names specified';
    
    return `
        <div class="travel-card">
            <div class="travel-card-header">
                <div class="travel-destination">${escapeHtml(travel.from_location)} → ${escapeHtml(travel.to_location)}</div>
                <span class="travel-status status-${travel.status}">${escapeHtml(formatStatus(travel.status))}</span>
            </div>
            <div class="travel-dates">
                📅 ${formatDate(travel.travel_date)}
            </div>
            <div class="travel-info">
                <div class="info-item">
                    <span class="info-label">👥 Persons:</span>
                    <span class="info-value">${travel.number_of_persons}</span>
                </div>
                ${travel.budget > 0 ? `<div class="info-item">
                    <span class="info-label">💰 Budget:</span>
                    <span class="info-value">$${travel.budget.toFixed(2)}</span>
                </div>` : ''}
            </div>
            <div class="travel-names">
                <strong>Travelers:</strong> ${escapeHtml(namesDisplay)}
            </div>
            ${travel.notes ? `<div class="travel-notes">${escapeHtml(travel.notes)}</div>` : ''}
            <div class="travel-actions">
                <button class="btn btn-secondary edit-btn" data-id="${travel.id}">✏️ Edit</button>
                <button class="btn btn-danger delete-btn" data-id="${travel.id}">🗑️ Delete</button>
            </div>
        </div>
    `;
}

// Setup filters
function setupFilters() {
    const statusFilter = document.getElementById('status-filter');
    const sortBy = document.getElementById('sort-by');
    const sortOrder = document.getElementById('sort-order');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resetBtn = document.getElementById('reset-filters');
    
    const applyFilters = async () => {
        try {
            const status = statusFilter?.value || '';
            const sort = sortBy?.value || 'start_date';
            const order = sortOrder?.value || 'ASC';
            const search = searchInput?.value || '';
            
            let url = `${API_BASE}/travels?sort=${sort}&order=${order}`;
            if (status) url += `&status=${status}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            
            const response = await fetch(url);
            const travels = await response.json();
            
            const container = document.getElementById('travels-container');
            if (travels.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <h3>No travels found</h3>
                        <p>Try adjusting your filters</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = travels.map(travel => createTravelCard(travel)).join('');
            
            // Reattach event listeners
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = `/edit/${e.currentTarget.dataset.id}`;
                });
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (confirm('Are you sure you want to delete this travel record?')) {
                        await deleteTravel(e.currentTarget.dataset.id);
                    }
                });
            });
        } catch (error) {
            console.error('Error applying filters:', error);
            showMessage('Error applying filters', 'error');
        }
    };
    
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (sortBy) sortBy.addEventListener('change', applyFilters);
    if (sortOrder) sortOrder.addEventListener('change', applyFilters);
    if (searchBtn) searchBtn.addEventListener('click', applyFilters);
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (statusFilter) statusFilter.value = '';
            if (sortBy) sortBy.value = 'start_date';
            if (sortOrder) sortOrder.value = 'ASC';
            if (searchInput) searchInput.value = '';
            applyFilters();
        });
    }
}

// Initialize Add Form
function initAddForm() {
    const form = document.getElementById('add-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addTravel();
        });
    }
    
    // Add event listener for number of persons field
    const numPersonsField = document.getElementById('number-of-persons');
    if (numPersonsField) {
        numPersonsField.addEventListener('input', generatePersonNameFields);
        // Ensure a person name field is shown for the default value
        generatePersonNameFields();
    }
}

// Generate dynamic person name fields
function generatePersonNameFields() {
    const numPersons = parseInt(document.getElementById('number-of-persons').value) || 0;
    const container = document.getElementById('person-names-container');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (numPersons > 0) {
        for (let i = 1; i <= numPersons; i++) {
            const nameField = document.createElement('input');
            nameField.type = 'text';
            nameField.id = `person-name-${i}`;
            nameField.name = `person-name-${i}`;
            nameField.placeholder = `Person ${i} name`;
            nameField.required = true;
            nameField.className = 'person-name-field';
            
            container.appendChild(nameField);
        }
    }
}

// Add new travel record
async function addTravel() {
    try {
        const fromLocation = document.getElementById('from-location').value.trim();
        const toLocation = document.getElementById('to-location').value.trim();
        const travelDate = document.getElementById('travel-date').value;
        const numberOfPersons = parseInt(document.getElementById('number-of-persons').value);
        const budget = parseFloat(document.getElementById('budget').value) || 0;
        const status = calculateStatus(travelDate);
        const notes = document.getElementById('notes').value.trim();
        
        // Get person names
        const personNames = [];
        for (let i = 1; i <= numberOfPersons; i++) {
            const nameField = document.getElementById(`person-name-${i}`);
            if (nameField) {
                const name = nameField.value.trim();
                if (!name) {
                    showMessage(`Please enter name for Person ${i}`, 'error');
                    return;
                }
                personNames.push(name);
            }
        }
        
        // Validation
        if (!fromLocation || !toLocation || !travelDate || !numberOfPersons || personNames.length !== numberOfPersons) {
            showMessage('Please fill in all required fields', 'error');
            return;
        }
        
        showMessage('Adding travel...', 'info');
        
        const response = await fetch(`${API_BASE}/travels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from_location: fromLocation,
                to_location: toLocation,
                travel_date: travelDate,
                number_of_persons: numberOfPersons,
                person_names: personNames,
                budget: budget,
                status: status,
                notes: notes
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error adding travel');
        }
        
        const result = await response.json();
        showMessage('Travel record added successfully!', 'success');
        
        // Clear form
        document.getElementById('add-form').reset();
        document.getElementById('person-names-container').innerHTML = '';
        document.getElementById('from-location').focus();
        
        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => window.location.href = '/', 1500);
    } catch (error) {
        console.error('Error adding travel:', error);
        showMessage(error.message, 'error');
    }
}

// Initialize Edit Form
async function initEditForm(travelId) {
    try {
        const response = await fetch(`${API_BASE}/travels/${travelId}`);
        
        if (!response.ok) {
            showMessage('Travel record not found', 'error');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }
        
        const travel = await response.json();
        
        // Populate form
        document.getElementById('from-location').value = travel.from_location;
        document.getElementById('to-location').value = travel.to_location;
        document.getElementById('travel-date').value = travel.travel_date;
        document.getElementById('number-of-persons').value = travel.number_of_persons;
        
        // Generate person name fields and populate them
        generatePersonNameFields();
        const personNames = JSON.parse(travel.person_names || '[]');
        personNames.forEach((name, index) => {
            const nameField = document.getElementById(`person-name-${index + 1}`);
            if (nameField) {
                nameField.value = name;
            }
        });
        
        // Setup form submission
        const form = document.getElementById('edit-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await updateTravel(travelId);
            });
        }
        
        // Add event listener for number of persons field
        const numPersonsField = document.getElementById('number-of-persons');
        if (numPersonsField) {
            numPersonsField.addEventListener('input', () => {
                generatePersonNameFields();
            });
        }
        
        // Setup delete button
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this travel record?')) {
                    deleteTravel(travelId);
                }
            });
        }
    } catch (error) {
        console.error('Error loading travel:', error);
        showMessage('Error loading travel record', 'error');
    }
}

// Update travel record
async function updateTravel(travelId) {
    try {
        const fromLocation = document.getElementById('from-location').value.trim();
        const toLocation = document.getElementById('to-location').value.trim();
        const travelDate = document.getElementById('travel-date').value;
        const numberOfPersons = parseInt(document.getElementById('number-of-persons').value);
        const status = calculateStatus(travelDate);
        
        // Get person names
        const personNames = [];
        for (let i = 1; i <= numberOfPersons; i++) {
            const nameField = document.getElementById(`person-name-${i}`);
            if (nameField) {
                const name = nameField.value.trim();
                if (!name) {
                    showMessage(`Please enter name for Person ${i}`, 'error');
                    return;
                }
                personNames.push(name);
            }
        }
        
        // Validation
        if (!fromLocation || !toLocation || !travelDate || !numberOfPersons || personNames.length !== numberOfPersons) {
            showMessage('Please fill in all required fields', 'error');
            return;
        }
        
        showMessage('Updating travel...', 'info');
        
        const response = await fetch(`${API_BASE}/travels/${travelId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from_location: fromLocation,
                to_location: toLocation,
                travel_date: travelDate,
                number_of_persons: numberOfPersons,
                person_names: personNames,
                status: status
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error updating travel');
        }
        
        showMessage('Travel record updated successfully!', 'success');
        setTimeout(() => window.location.href = '/', 1500);
    } catch (error) {
        console.error('Error updating travel:', error);
        showMessage(error.message, 'error');
    }
}

// Delete travel record
async function deleteTravel(travelId) {
    try {
        showMessage('Deleting travel...', 'info');
        
        const response = await fetch(`${API_BASE}/travels/${travelId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error deleting travel');
        }
        
        showMessage('Travel record deleted successfully!', 'success');
        
        // Reload dashboard or redirect
        if (window.location.pathname === '/' || window.location.pathname === '/dashboard.html') {
            await loadTravels();
            await loadStats();
        } else {
            setTimeout(() => window.location.href = '/', 1500);
        }
    } catch (error) {
        console.error('Error deleting travel:', error);
        showMessage(error.message, 'error');
    }
}

// Utility Functions

// Format status label
function formatStatus(status) {
    if (!status) return '';
    return status.toString().charAt(0).toUpperCase() + status.toString().slice(1);
}

// Format date
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show message
function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
        // Create container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'message-container';
        document.body.insertBefore(container, document.body.firstChild);
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <span class="close-message">&times;</span>
    `;
    
    const container = document.getElementById('message-container');
    container.appendChild(messageEl);
    
    // Close button
    messageEl.querySelector('.close-message').addEventListener('click', () => {
        messageEl.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageEl.remove();
    }, 5000);
}

// Hide all messages
function hideMessage() {
    const container = document.getElementById('message-container');
    if (container) {
        container.innerHTML = '';
    }
}
