let zIndex = 1;
let currentFileType = null;
const gridSize = 20; // Snap-to-grid size (20px)

// Add drag-and-drop event listeners to the full-screen dropzone
const dropzone = document.getElementById('full-screen-dropzone');
dropzone.addEventListener('dragover', handleDragOver);
dropzone.addEventListener('dragleave', handleDragLeave);
dropzone.addEventListener('drop', handleDrop);

// Listen for paste events
document.addEventListener('paste', handlePaste);

// Load saved windows from localStorage
window.addEventListener('load', () => {
    const savedWindows = JSON.parse(localStorage.getItem('windows')) || [];
    savedWindows.forEach((windowData) => {
        openWindow(windowData.type, windowData.fileName, windowData.content, windowData);
    });
});

function handleDragOver(e) {
    e.preventDefault();
    dropzone.classList.add('drag-over'); // Highlight the entire screen
}

function handleDragLeave(e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over'); // Remove highlight
}

function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over'); // Remove highlight

    const files = e.dataTransfer.files; // Get dropped files
    if (files.length > 0) {
        const file = files[0];
        detectFileTypeAndOpen(file); // Detect file type and open
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    let imageFound = false;

    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            // Handle image paste
            imageFound = true;
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                openWindow('image', 'Pasted Image', event.target.result);
            };
            reader.readAsDataURL(blob);
            break; // Stop processing other items if an image is found
        }
    }

    // If no image was found, handle text paste
    if (!imageFound) {
        for (const item of items) {
            if (item.type.indexOf('text') !== -1) {
                item.getAsString((text) => {
                    openWindow('text', 'Pasted Text', text);
                });
                break; // Stop processing other items if text is found
            }
        }
    }
}

function detectFileTypeAndOpen(file) {
    const fileType = file.type.split('/')[0]; // Get file type (e.g., text, image)
    const fileExtension = file.name.split('.').pop().toLowerCase(); // Get file extension

    if (fileType === 'text' || fileExtension === 'pdf') {
        currentFileType = fileType === 'text' ? 'text' : 'pdf';
    } else if (fileType === 'image') {
        currentFileType = 'image';
    } else {
        alert('Unsupported file type.');
        return;
    }

    handleFile(file); // Open the file
}

function handleFile(file) {
    if (currentFileType === 'pdf') {
        // Use a blob URL for large PDFs
        const blobUrl = URL.createObjectURL(file);
        openWindow(currentFileType, file.name, blobUrl);
    } else {
        // For text and images, use FileReader
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target.result;
            openWindow(currentFileType, file.name, fileContent);
        };

        switch (currentFileType) {
            case 'text':
                reader.readAsText(file);
                break;
            case 'image':
                reader.readAsDataURL(file);
                break;
            default:
                alert('Unsupported file type.');
                break;
        }
    }
}

function openFilePicker(type) {
    currentFileType = type;
    const fileInput = document.getElementById('file-input');
    fileInput.accept = getAcceptAttribute(type); // Set accepted file types
    fileInput.click(); // Trigger file picker
}

function getAcceptAttribute(type) {
    switch (type) {
        case 'text':
            return '.txt,.csv,.html,.js,.css,.json'; // Common text-based formats
        case 'image':
            return '.jpg,.jpeg,.png,.gif,.bmp,.webp'; // Common image formats
        case 'pdf':
            return '.pdf'; // PDF format
        default:
            return '*'; // Allow all file types
    }
}

function handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    detectFileTypeAndOpen(file); // Detect file type and open
}

function openWindow(type, fileName, content, savedState = null) {
    const windowsContainer = document.getElementById('windows-container');
    const windowElement = document.createElement('div');
    windowElement.classList.add('window');
    windowElement.style.zIndex = zIndex++;

    // Apply saved state if available
    if (savedState) {
        windowElement.style.width = savedState.width;
        windowElement.style.height = savedState.height;
        windowElement.style.top = savedState.top;
        windowElement.style.left = savedState.left;
    } else {
        // Default size and position
        windowElement.style.width = '400px';
        windowElement.style.height = '300px';
        windowElement.style.top = '50px';
        windowElement.style.left = '50px';
    }

    windowElement.innerHTML = `
        <div class="window-header">
            ${fileName || type.toUpperCase()} Viewer
            <span class="minimize-btn" onclick="minimizeWindow(this.parentElement.parentElement)">🗕</span>
            <span class="maximize-btn" onclick="maximizeWindow(this.parentElement.parentElement)">🗖</span>
            <span class="hide-btn" onclick="toggleVisibility(this.parentElement.parentElement)">👁️</span>
            <span class="close-btn" onclick="this.parentElement.parentElement.remove(); saveWindowState();">×</span>
        </div>
        <div class="window-content">
            ${getContent(type, content)}
        </div>
    `;
    windowsContainer.appendChild(windowElement);

    // Bring the window to the front on interaction
    windowElement.addEventListener('mousedown', () => bringToFront(windowElement));
    makeDraggable(windowElement);

    // Save window state after opening
    saveWindowState();
}

function getContent(type, content) {
    switch (type) {
        case 'text':
            return `<textarea style="width: 100%; height: 100%;">${content}</textarea>`;
        case 'image':
            return `<img src="${content}" alt="Image" style="width: 100%; height: 100%; object-fit: contain;">`;
        case 'pdf':
            return `<iframe src="${content}" style="width: 100%; height: 100%; border: none;"></iframe>`;
        default:
            return `<p>Unsupported file format.</p>`;
    }
}

function bringToFront(windowElement) {
    windowElement.style.zIndex = zIndex++; // Bring the window to the front
}

function makeDraggable(element) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startTop, startLeft;
    const resizeZone = 10; // 10 pixels from the edge for resizing

    // Function to update the cursor based on the mouse position
    function updateCursor(e) {
        const isLeftEdge = e.offsetX < resizeZone;
        const isRightEdge = e.offsetX > element.offsetWidth - resizeZone;
        const isTopEdge = e.offsetY < resizeZone;
        const isBottomEdge = e.offsetY > element.offsetHeight - resizeZone;

        const isTopLeftCorner = isTopEdge && isLeftEdge;
        const isTopRightCorner = isTopEdge && isRightEdge;
        const isBottomLeftCorner = isBottomEdge && isLeftEdge;
        const isBottomRightCorner = isBottomEdge && isRightEdge;

        if (isTopLeftCorner || isBottomRightCorner) {
            element.style.cursor = 'nwse-resize'; // Diagonal resize (top-left or bottom-right)
        } else if (isTopRightCorner || isBottomLeftCorner) {
            element.style.cursor = 'nesw-resize'; // Diagonal resize (top-right or bottom-left)
        } else if (isLeftEdge || isRightEdge) {
            element.style.cursor = 'ew-resize'; // Horizontal resize
        } else if (isTopEdge || isBottomEdge) {
            element.style.cursor = 'ns-resize'; // Vertical resize
        } else {
            element.style.cursor = 'move'; // Dragging
        }
    }

    // Update cursor on mouse move
    element.addEventListener('mousemove', (e) => {
        updateCursor(e);
    });

    // Reset cursor when mouse leaves the window
    element.addEventListener('mouseleave', () => {
        element.style.cursor = 'default';
    });

    element.onmousedown = (e) => {
        e.preventDefault();

        // Bring the window to the front when interacted with
        bringToFront(element);

        // Check if the mouse is near the edges or corners for resizing
        const isLeftEdge = e.offsetX < resizeZone;
        const isRightEdge = e.offsetX > element.offsetWidth - resizeZone;
        const isTopEdge = e.offsetY < resizeZone;
        const isBottomEdge = e.offsetY > element.offsetHeight - resizeZone;

        const isTopLeftCorner = isTopEdge && isLeftEdge;
        const isTopRightCorner = isTopEdge && isRightEdge;
        const isBottomLeftCorner = isBottomEdge && isLeftEdge;
        const isBottomRightCorner = isBottomEdge && isRightEdge;

        if (isLeftEdge || isRightEdge || isTopEdge || isBottomEdge || isTopLeftCorner || isTopRightCorner || isBottomLeftCorner || isBottomRightCorner) {
            // Start resizing
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = element.offsetWidth;
            startHeight = element.offsetHeight;
            startTop = element.offsetTop;
            startLeft = element.offsetLeft;

            document.onmousemove = (e) => handleResize(e, isLeftEdge, isRightEdge, isTopEdge, isBottomEdge, isTopLeftCorner, isTopRightCorner, isBottomLeftCorner, isBottomRightCorner);
        } else {
            // Start dragging
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startTop = element.offsetTop;
            startLeft = element.offsetLeft;

            document.onmousemove = (e) => handleDrag(e);
        }

        document.onmouseup = () => {
            isDragging = false;
            isResizing = false;
            document.onmousemove = null;
            document.onmouseup = null;
            element.style.cursor = 'default'; // Reset cursor when mouse is released

            // Check window visibility and update taskbar immediately
            checkWindowVisibility(element);
        };
    };

    function handleDrag(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Update the window position
        element.style.top = startTop + deltaY + "px";
        element.style.left = startLeft + deltaX + "px";
    }

    function handleResize(e, isLeftEdge, isRightEdge, isTopEdge, isBottomEdge, isTopLeftCorner, isTopRightCorner, isBottomLeftCorner, isBottomRightCorner) {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Calculate new width and height
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newTop = startTop;
        let newLeft = startLeft;

        // Handle resizing from edges
        if (isLeftEdge || isTopLeftCorner || isBottomLeftCorner) {
            newWidth -= deltaX;
            newLeft += deltaX;
        } else if (isRightEdge || isTopRightCorner || isBottomRightCorner) {
            newWidth += deltaX;
        }

        if (isTopEdge || isTopLeftCorner || isTopRightCorner) {
            newHeight -= deltaY;
            newTop += deltaY;
        } else if (isBottomEdge || isBottomLeftCorner || isBottomRightCorner) {
            newHeight += deltaY;
        }

        // Ensure minimum size
        if (newWidth > 100) {
            element.style.width = newWidth + "px";
            if (isLeftEdge || isTopLeftCorner || isBottomLeftCorner) {
                element.style.left = newLeft + "px";
            }
        }
        if (newHeight > 100) {
            element.style.height = newHeight + "px";
            if (isTopEdge || isTopLeftCorner || isTopRightCorner) {
                element.style.top = newTop + "px";
            }
        }
    }
}

function checkWindowVisibility(windowElement) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Get window position and size
    const rect = windowElement.getBoundingClientRect();
    const windowWidth = rect.width;
    const windowHeight = rect.height;
    const windowLeft = rect.left;
    const windowTop = rect.top;
    const windowRight = windowLeft + windowWidth;
    const windowBottom = windowTop + windowHeight;

    // Calculate visible area
    const visibleLeft = Math.max(0, windowLeft);
    const visibleTop = Math.max(0, windowTop);
    const visibleRight = Math.min(screenWidth, windowRight);
    const visibleBottom = Math.min(screenHeight, windowBottom);

    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;
    const visibleArea = visibleWidth * visibleHeight;

    const totalArea = windowWidth * windowHeight;

    // If less than 5% of the window is visible, minimize it
    if (visibleArea / totalArea < 0.15) {
        minimizeWindow(windowElement);
    }
}
function adjustWindowSize(windowElement) {
    const content = windowElement.querySelector('.window-content');
    if (!content) return;

    // Calculate content dimensions
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;

    // Add 10px margin on all sides
    const margin = 10;
    const newWidth = contentWidth + 2 * margin; // Left and right margins
    const newHeight = contentHeight + 2 * margin; // Top and bottom margins

    // Set window size to fit content with margins
    windowElement.style.width = newWidth + "px";
    windowElement.style.height = newHeight + "px";
}
function toggleVisibility(windowElement) {
    if (windowElement.classList.contains('hidden')) {
        windowElement.classList.remove('hidden');
        windowElement.style.height = '300px';
    } else {
        windowElement.classList.add('hidden');
        windowElement.style.height = '40px';
    }
    bringToFront(windowElement); // Bring to front when toggled
}

function maximizeWindow(windowElement) {
    if (windowElement.classList.contains('maximized')) {
        windowElement.classList.remove('maximized');
        windowElement.style.width = '400px';
        windowElement.style.height = '300px';
        windowElement.style.top = '50px';
        windowElement.style.left = '50px';
    } else {
        windowElement.classList.add('maximized');
        windowElement.style.width = '100%';
        windowElement.style.height = '100%';
        windowElement.style.top = '0';
        windowElement.style.left = '0';
    }
    bringToFront(windowElement); // Bring to front when maximized
}

function minimizeWindow(windowElement) {
    if (windowElement.classList.contains('maximized')) {
        windowElement.classList.remove('maximized');
        windowElement.style.width = '400px';
        windowElement.style.height = '300px';
        windowElement.style.top = '50px';
        windowElement.style.left = '50px';
    }
    windowElement.style.display = 'none';
    addToTaskbar(windowElement);
}

function addToTaskbar(windowElement) {
    const taskbar = document.getElementById('taskbar');
    const taskbarItem = document.createElement('div');
    taskbarItem.classList.add('taskbar-item');
    taskbarItem.textContent = windowElement.querySelector('.window-header').textContent.trim();
    taskbarItem.onclick = () => restoreWindow(windowElement);
    taskbar.appendChild(taskbarItem);
}

function restoreWindow(windowElement) {
    // Bring the window back into the visible screen area
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const rect = windowElement.getBoundingClientRect();
    const windowWidth = rect.width;
    const windowHeight = rect.height;
    let windowLeft = rect.left;
    let windowTop = rect.top;

    // Adjust position if the window is out of the screen
    if (windowLeft + windowWidth < 0) {
        windowLeft = 10; // Move to the left edge with a 10px margin
    }
    if (windowLeft > screenWidth) {
        windowLeft = screenWidth - windowWidth - 10; // Move to the right edge with a 10px margin
    }
    if (windowTop + windowHeight < 0) {
        windowTop = 10; // Move to the top edge with a 10px margin
    }
    if (windowTop > screenHeight) {
        windowTop = screenHeight - windowHeight - 10; // Move to the bottom edge with a 10px margin
    }

    // Apply the new position
    windowElement.style.left = windowLeft + "px";
    windowElement.style.top = windowTop + "px";

    // Show the window
    windowElement.style.display = 'block';

    // Remove the window from the taskbar
    const taskbarItem = Array.from(document.querySelectorAll('.taskbar-item')).find(
        item => item.textContent === windowElement.querySelector('.window-header').textContent.trim()
    );
    if (taskbarItem) {
        taskbarItem.remove();
    }

    // Bring the window to the front
    bringToFront(windowElement);
}
function saveWindowState() {
    const windows = [];
    document.querySelectorAll('.window').forEach((windowElement) => {
        const windowData = {
            type: windowElement.querySelector('.window-content textarea') ? 'text' :
                  windowElement.querySelector('.window-content img') ? 'image' :
                  windowElement.querySelector('.window-content iframe') ? 'pdf' : 'unknown',
            fileName: windowElement.querySelector('.window-header').textContent.trim(),
            content: windowElement.querySelector('.window-content textarea') ? windowElement.querySelector('.window-content textarea').value :
                     windowElement.querySelector('.window-content img') ? windowElement.querySelector('.window-content img').src :
                     windowElement.querySelector('.window-content iframe') ? windowElement.querySelector('.window-content iframe').src : '',
            width: windowElement.style.width,
            height: windowElement.style.height,
            top: windowElement.style.top,
            left: windowElement.style.left,
        };
        windows.push(windowData);
    });
    localStorage.setItem('windows', JSON.stringify(windows));
}

function checkWindowVisibility(windowElement) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Get window position and size
    const rect = windowElement.getBoundingClientRect();
    const windowWidth = rect.width;
    const windowHeight = rect.height;
    const windowLeft = rect.left;
    const windowTop = rect.top;
    const windowRight = windowLeft + windowWidth;
    const windowBottom = windowTop + windowHeight;

    // Calculate visible area
    const visibleLeft = Math.max(0, windowLeft);
    const visibleTop = Math.max(0, windowTop);
    const visibleRight = Math.min(screenWidth, windowRight);
    const visibleBottom = Math.min(screenHeight, windowBottom);

    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;
    const visibleArea = visibleWidth * visibleHeight;

    const totalArea = windowWidth * windowHeight;

    // If less than 5% of the window is visible, minimize it
    if (visibleArea / totalArea < 0.1) {
        minimizeWindow(windowElement);
    }
}

// Add this function to periodically check window visibility
function startWindowVisibilityCheck() {
    setInterval(() => {
        document.querySelectorAll('.window').forEach((windowElement) => {
            checkWindowVisibility(windowElement);
        });
    }, 1000); // Check every second
}

// Call this function to start the visibility check
startWindowVisibilityCheck();

function closeAllWindows() {
    document.querySelectorAll('.window').forEach((windowElement) => {
        windowElement.remove();
    });
    localStorage.removeItem('windows'); // Clear saved windows
}












// Track the order of windows
const windowsOrder = [];

// Add event listeners for Ctrl + Z and Delete
document.addEventListener('keydown', (e) => {
    // Check for Ctrl + Z (Windows/Linux) or Cmd + Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        deleteLastWindow();
    }
    // Check for Delete key
    else if (e.key === 'Delete') {
        deleteLastWindow();
    }
});

// Function to delete the last added window
function deleteLastWindow() {
    if (windowsOrder.length > 0) {
        const lastWindow = windowsOrder.pop(); // Get the last added window
        lastWindow.remove(); // Remove it from the DOM
        saveWindowState(); // Update the saved state
    }
}

// Modify the openWindow function to track window order
function openWindow(type, fileName, content, savedState = null) {
    const windowsContainer = document.getElementById('windows-container');
    const windowElement = document.createElement('div');
    windowElement.classList.add('window');
    windowElement.style.zIndex = zIndex++;

    // Apply saved state if available
    if (savedState) {
        windowElement.style.width = savedState.width;
        windowElement.style.height = savedState.height;
        windowElement.style.top = savedState.top;
        windowElement.style.left = savedState.left;
    } else {
        // Default size and position
        windowElement.style.width = '400px';
        windowElement.style.height = '300px';
        windowElement.style.top = '50px';
        windowElement.style.left = '50px';
    }

    windowElement.innerHTML = `
        <div class="window-header">
            ${fileName || type.toUpperCase()} Viewer
            <span class="minimize-btn" onclick="minimizeWindow(this.parentElement.parentElement)">🗕</span>
            <span class="maximize-btn" onclick="maximizeWindow(this.parentElement.parentElement)">🗖</span>
            <span class="hide-btn" onclick="toggleVisibility(this.parentElement.parentElement)">👁️</span>
            <span class="close-btn" onclick="this.parentElement.parentElement.remove(); saveWindowState();">×</span>
        </div>
        <div class="window-content">
            ${getContent(type, content)}
        </div>
    `;
    windowsContainer.appendChild(windowElement);

    // Track the new window
    windowsOrder.push(windowElement);

    // Bring the window to the front on interaction
    windowElement.addEventListener('mousedown', () => bringToFront(windowElement));
    makeDraggable(windowElement);

    // Save window state after opening
    saveWindowState();
}

