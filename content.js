
(() => {
  const getData = () => {
    // Wait for page to load if necessary
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptExtraction = () => {
      // More robust selectors with fallbacks
      const title = document.querySelector('h1')?.innerText?.trim() || 
                   document.querySelector('[data-job-title]')?.innerText?.trim() || 
                   document.querySelector('.jobs-unified-top-card__job-title')?.innerText?.trim() || '';
      
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText?.trim() || 
                     document.querySelector('.jobs-unified-top-card__company-name a')?.innerText?.trim() ||
                     document.querySelector('[data-company-name]')?.innerText?.trim() || '';
      
      // Extract location more precisely
      const locationElement = document.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container span') || 
                             document.querySelector('.jobs-unified-top-card__bullet') ||
                             document.querySelector('[data-job-location]');
      let location = locationElement?.innerText?.trim() || '';
      
      // Clean location by extracting only the city/country part (before posting date)
      if (location.includes('·')) {
        location = location.split('·')[0].trim();
      }
      
      const url = window.location.href;
      const today = new Date().toISOString().slice(0, 10);

      const metaBlock = document.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container')?.innerText || 
                       document.querySelector('.jobs-unified-top-card__tertiary-description-container')?.innerText || '';
      
      // Extract applicants count and posting date from combined text
      let applicants = '';
      let postingDate = '';
      
      if (metaBlock) {
        // Split by · to separate different pieces of information
        const metaParts = metaBlock.split('·').map(part => part.trim());
        
        for (const part of metaParts) {
          // Check if this part contains applicants info
          if (part.match(/\d+.*?(candidați|applicants?)/i)) {
            const applicantsMatch = part.match(/(\d+.*?candidați)/i) || part.match(/(\d+.*?applicants?)/i);
            if (applicantsMatch) {
              applicants = applicantsMatch[1].trim();
            }
          }
          // Check if this part contains posting date info
          else if (part.match(/(cu.*?în urmă|\d+.*?ago|repostat|posted)/i)) {
            const postingMatch = part.match(/(cu.*?în urmă)/i) || 
                                part.match(/(\d+.*?ago)/i) || 
                                part.match(/(repostat.*?în urmă)/i) ||
                                part.match(/(posted.*?ago)/i);
            if (postingMatch) {
              postingDate = postingMatch[1].trim();
            } else if (part.match(/(repostat|posted)/i)) {
              // If it contains "repostat" or "posted" but doesn't match the pattern, use the whole part
              postingDate = part.trim();
            }
          }
        }
      }

      // Extract experience/job type info, filtering out promotional content
      const insights = Array.from(document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight'));
      let allInsightText = insights.map(el => {
        let text = el.innerText?.trim() || '';
        // Filter out promotional LinkedIn text
        const unwantedPhrases = [
          'Promovat de client',
          'Candidații sunt analizați în mod activ',
          'Se potrivește preferințelor dvs',
          'Reactivați Premium',
          'Vedeți o comparație între dvs'
        ];
        
        // Remove unwanted promotional text
        unwantedPhrases.forEach(phrase => {
          text = text.replace(new RegExp(phrase + '.*?(?=\\n|$)', 'gi'), '');
        });
        
        // Clean up multiple spaces and newlines
        text = text.replace(/\s+/g, ' ').trim();
        return text;
      }).filter(Boolean).join(' | ');


      // Split experience and office presence
      let experience = '';
      let officePresence = '';
      
      // Look for experience level patterns (more comprehensive)
      const experiencePatterns = [
        /nivel\s+mediu\s+de\s+experiență/i,
        /nivel\s+mare\s+de\s+experiență/i,
        /nivel\s+mic\s+de\s+experiență/i,
        /nivel\s+mediu\s+de\s+experienta/i,
        /nivel\s+mare\s+de\s+experienta/i,
        /nivel\s+mic\s+de\s+experienta/i,
        /entry\s*level/i,
        /junior\s*level/i,
        /senior\s*level/i,
        /mid\s*level/i,
        /junior/i,
        /senior/i,
        /experient/i,
        /începător/i,
        /experienced/i,
        /intern/i,
        /associate/i,
        /director/i,
        /manager/i
      ];
      
      // Look for office presence patterns
      const officePatterns = [
        /regim\s+hibrid/i,
        /hibrid/i,
        /full\s*time/i,
        /part\s*time/i,
        /remote/i,
        /la\s+distanță/i,
        /la\s+distanta/i,
        /norma\s+întreagă/i,
        /norma\s+intreaga/i,
        /jumătate\s+normă/i,
        /jumatate\s+norma/i,
        /contract/i,
        /on\s*site/i,
        /office/i
      ];
      
      // Extract experience level
      for (const pattern of experiencePatterns) {
        const match = allInsightText.match(pattern);
        if (match) {
          experience = match[0];
          break;
        }
      }
      
      // Extract office presence/work arrangement
      const officeMatches = [];
      for (const pattern of officePatterns) {
        const match = allInsightText.match(pattern);
        if (match) {
          officeMatches.push(match[0]);
        }
      }
      officePresence = officeMatches.join(' ');
      
      // If no specific patterns found, use the original text but try to separate
      if (!experience && !officePresence && allInsightText) {
        const parts = allInsightText.split(' | ');
        // First part likely contains experience, second contains work arrangement
        if (parts.length >= 2) {
          experience = parts[0];
          officePresence = parts.slice(1).join(' ');
        } else {
          experience = allInsightText;
        }
      }

      // Extract skills/summary from Aptitudini section
      let summary = '';
      try {
        // First, try to extract from the insights text we already have
        if (allInsightText.includes('Aptitudini:')) {
          const aptitudiniMatch = allInsightText.match(/Aptitudini:\s*(.*?)$/i);
          if (aptitudiniMatch) {
            summary = aptitudiniMatch[1].trim();
          }
        } else {
          // Fallback: Try multiple selectors for job description
          const jobDescriptionSelectors = [
            '.jobs-description-content__text',
            '.job-details-jobs-unified-top-card__job-description',
            '.jobs-unified-top-card__job-description',
            '.jobs-description__content',
            '.jobs-box__content',
            '[data-job-description]'
          ];
          
          let jobDescriptionSection = null;
          for (const selector of jobDescriptionSelectors) {
            jobDescriptionSection = document.querySelector(selector);
            if (jobDescriptionSection) {
              break;
            }
          }
          
          if (jobDescriptionSection) {
            const fullText = jobDescriptionSection.innerText || '';
            
            // Try multiple patterns for "Aptitudini" section
            const aptitudiniPatterns = [
              /Aptitudini:\s*(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/s,
              /Aptitudini\s*(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/s,
              /Skills:\s*(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/s,
              /Cerințe:\s*(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/s,
              /Requirements:\s*(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/s
            ];
            
            for (const pattern of aptitudiniPatterns) {
              const match = fullText.match(pattern);
              if (match) {
                summary = match[1].trim();
                break;
              }
            }
          }
        }
        
        if (summary) {
          // Clean up the summary - remove extra spaces and line breaks
          summary = summary.replace(/\s+/g, ' ').trim();
          // Remove bullet points and dashes
          summary = summary.replace(/^[-•·*]\s*/gm, '');
          // Limit length to keep it manageable
          if (summary.length > 500) {
            summary = summary.substring(0, 500) + '...';
          }
        } else {
        }
      } catch (error) {
      }

      return {
        title,
        company,
        officePresence,
        experience,
        location,
        applicationDate: today,
        summary,
        platform: 'LinkedIn',
        additionalDetails: '',
        viewedOn: today,
        applicants,
        postingDate,
        url
      };
    };

    return attemptExtraction();
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'extractJobData') {
      try {
        const data = getData();
        // Validate that we got some meaningful data
        if (!data.title && !data.company) {
          // Try again after a short delay
          setTimeout(() => {
            const retryData = getData();
            sendResponse(retryData);
          }, 1000);
          return true; // Keep message channel open
        }
        sendResponse(data);
      } catch (error) {
        sendResponse(null);
      }
    } else if (msg.action === 'copyToClipboard') {
      try {
        navigator.clipboard.writeText(msg.data).then(() => {
          sendResponse({ success: true });
        }).catch(() => {
          // Fallback to execCommand
          const textArea = document.createElement('textarea');
          textArea.value = msg.data;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            sendResponse({ success: true });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
          document.body.removeChild(textArea);
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep message channel open for async response
    }
    return true; // Keep message channel open for async response
  });
})();
