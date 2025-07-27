// Simple background service worker for keyboard shortcuts

chrome.commands.onCommand.addListener((command) => {
  
  if (command === 'extract-job-data') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      
      // Check if we're on a job board page with currentJobId
      if (tab.url.includes('linkedin.com/jobs/collections') && tab.url.includes('currentJobId=')) {
        // Extract job ID from URL
        const jobIdMatch = tab.url.match(/currentJobId=(\d+)/);
        if (jobIdMatch) {
          const jobId = jobIdMatch[1];
          const individualJobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
          
          // Create background tab with individual job page
          chrome.tabs.create({ 
            url: individualJobUrl, 
            active: false 
          }, (newTab) => {
            // Wait for the page to load before extracting
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (tabId === newTab.id && changeInfo.status === 'complete') {
                // Remove this listener to avoid multiple calls
                chrome.tabs.onUpdated.removeListener(listener);
                
                // Add additional delay to ensure LinkedIn content is fully loaded
                setTimeout(() => {
                  extractJobDataFromTab(newTab.id, true); // true = close tab after extraction
                }, 2000); // Wait 2 seconds after page complete
              }
            });
          });
        }
        return;
      }
      
      // Handle individual job pages (existing logic)
      if (tab.url.includes('linkedin.com/jobs/view/')) {
        extractJobDataFromTab(tab.id, false); // false = don't close tab
        return;
      }
    });
  }
});

// Helper function to extract job data from any tab
async function extractJobDataFromTab(tabId, closeTabAfter = false) {
  try {
    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  } catch (error) {
    if (closeTabAfter) {
      chrome.tabs.remove(tabId);
    }
    return;
  }

  // Add a small delay before sending message
  setTimeout(() => {
    // Extract job data
    chrome.tabs.sendMessage(tabId, { action: 'extractJobData' }, (response) => {
      if (chrome.runtime.lastError) {
        if (closeTabAfter) {
          chrome.tabs.remove(tabId);
        }
        return;
      }

      if (response && (response.title || response.company)) {
        const cleanedResponse = {
          title: response.title || '',
          company: response.company || '',
          officePresence: response.officePresence || '',
          experience: response.experience || '',
          location: response.location || '',
          applicationDate: response.applicationDate || '',
          summary: response.summary || '',
          platform: response.platform || 'LinkedIn',
          additionalDetails: response.additionalDetails || '',
          viewedOn: response.viewedOn || '',
          applicants: response.applicants || '',
          postingDate: response.postingDate || '',
          url: response.url || ''
        };
        
        // Send directly to Google Sheets
        sendToGoogleSheets(cleanedResponse)
          .then(result => {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              title: 'LinkedIn Job Logger',
              message: 'Job data sent to Google Sheets!'
            });
          })
          .catch(error => {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              title: 'LinkedIn Job Logger',
              message: 'Failed to send to Google Sheets'
            });
          })
          .finally(() => {
            // Close the background tab if requested
            if (closeTabAfter) {
              chrome.tabs.remove(tabId);
            }
          });
      } else {
        // Close the background tab if no data was extracted
        if (closeTabAfter) {
          chrome.tabs.remove(tabId);
        }
      }
    });
  }, 500); // Wait 500ms after script injection
}

// Handle Google Sheets requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToGoogleSheets') {
    
    sendToGoogleSheets(message.data)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

// Function to send data to Google Sheets
async function sendToGoogleSheets(data) {
  
  try {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value || '');
    });
    
    
    const response = await fetch('https://script.google.com/macros/s/AKfycbxfcdmmlF5lE970GZAvxsyOs_cD_AfI_2TqZxmvwgOg9NCn2pGd7wdTAcI5Ck6cMrPaXw/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.text();
    
    return result;
  } catch (error) {
    throw error;
  }
}


