chrome.commands.onCommand.addListener((command) => {
  if (command === 'extract-job-data') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      
      if ((tab.url.includes('linkedin.com/jobs/collections') || tab.url.includes('linkedin.com/jobs/search')) && tab.url.includes('currentJobId=')) {
        const jobIdMatch = tab.url.match(/currentJobId=(\d+)/);
        if (jobIdMatch) {
          const jobId = jobIdMatch[1];
          const individualJobUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
          
          chrome.tabs.create({ 
            url: individualJobUrl, 
            active: false 
          }, (newTab) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (tabId === newTab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                  extractJobDataFromTab(newTab.id, true);
                }, 2000);
              }
            });
          });
        }
        return;
      }
      
      if (tab.url.includes('linkedin.com/jobs/view/')) {
        extractJobDataFromTab(tab.id, false);
        return;
      }
    });
  }
});

async function extractJobDataFromTab(tabId, closeTabAfter = false) {
  try {
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

  setTimeout(() => {
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
            if (closeTabAfter) {
              chrome.tabs.remove(tabId);
            }
          });
      } else {
        if (closeTabAfter) {
          chrome.tabs.remove(tabId);
        }
      }
    });
  }, 500);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToGoogleSheets') {
    sendToGoogleSheets(message.data)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

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
    
    return await response.text();
  } catch (error) {
    throw error;
  }
}


