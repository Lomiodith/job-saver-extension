
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Check if we're on a LinkedIn job page
    if (!currentTab.url.includes('linkedin.com/jobs/view/')) {
      document.getElementById('output').innerText = 'Please navigate to a LinkedIn job page first.';
      document.getElementById('copy').disabled = true;
      document.getElementById('send').disabled = true;
      return;
    }

    // Try to inject content script if it's not already loaded
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js']
    }, () => {
      // Now try to get the job data
      chrome.tabs.sendMessage(currentTab.id, { action: 'extractJobData' }, (response) => {
        if (chrome.runtime.lastError) {
          document.getElementById('output').innerText = 'Error: Could not extract job data. Try refreshing the page.';
          document.getElementById('copy').disabled = true;
          document.getElementById('send').disabled = true;
          return;
        }
        
        if (!response || (!response.title && !response.company)) {
          document.getElementById('output').innerText = 'No job data found. Make sure the page is fully loaded.';
          document.getElementById('copy').disabled = true;
          document.getElementById('send').disabled = true;
          return;
        }
      
      // Clean up the response data to match Google Sheets structure
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
      
      // Format as JSON for clipboard
      const jsonOutput = JSON.stringify(cleanedResponse, null, 2);
      
      // Display formatted version for user
      const displayOutput = Object.entries(cleanedResponse)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      document.getElementById('output').innerText = displayOutput;

        // Copy to clipboard functionality
        document.getElementById('copy').addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(jsonOutput);
            document.getElementById('copy').textContent = 'Copied!';
            setTimeout(() => {
              document.getElementById('copy').textContent = 'Copy to Clipboard';
            }, 2000);
          } catch (err) {
            // Fallback to execCommand
            const textArea = document.createElement('textarea');
            textArea.value = jsonOutput;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              document.getElementById('copy').textContent = 'Copied!';
              setTimeout(() => {
                document.getElementById('copy').textContent = 'Copy to Clipboard';
              }, 2000);
            } catch (copyErr) {
              document.getElementById('copy').textContent = 'Copy Failed';
              setTimeout(() => {
                document.getElementById('copy').textContent = 'Copy to Clipboard';
              }, 2000);
            }
            document.body.removeChild(textArea);
          }
        });
      
        // Send to Google Sheets functionality
        document.getElementById('send').addEventListener('click', async () => {
          
          document.getElementById('send').textContent = 'Sending...';
          document.getElementById('send').disabled = true;
          
          try {
            // Send message to background script to handle Google Sheets request
            chrome.runtime.sendMessage({
              action: 'sendToGoogleSheets',
              data: cleanedResponse
            }, (response) => {
              if (chrome.runtime.lastError) {
                document.getElementById('send').textContent = 'Send Failed';
                setTimeout(() => {
                  document.getElementById('send').textContent = 'Send to Google Sheet';
                  document.getElementById('send').disabled = false;
                }, 3000);
                return;
              }
              
              
              if (response && response.success) {
                document.getElementById('send').textContent = 'Sent!';
              } else {
                document.getElementById('send').textContent = 'Send Failed';
              }
              
              setTimeout(() => {
                document.getElementById('send').textContent = 'Send to Google Sheet';
                document.getElementById('send').disabled = false;
              }, 3000);
            });
            
          } catch (err) {
            document.getElementById('send').textContent = 'Send Failed';
            setTimeout(() => {
              document.getElementById('send').textContent = 'Send to Google Sheet';
              document.getElementById('send').disabled = false;
            }, 3000);
          }
        });
      });
    });
  });
});
