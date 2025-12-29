#!/usr/bin/env node

/**
 * Sync Template from Iterable to GitHub
 * 
 * This script fetches a template from Iterable and updates the corresponding
 * file in the GitHub repository.
 * 
 * Usage:
 *   TEMPLATE_ID=20993079 node scripts/sync-from-iterable.js
 * 
 * Or via webhook/repository_dispatch event
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;
const ITERABLE_API_BASE = 'https://api.iterable.com/api';
const TEMPLATE_ID = process.env.TEMPLATE_ID;
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

if (!ITERABLE_API_KEY) {
  console.error('Error: ITERABLE_API_KEY environment variable is not set');
  process.exit(1);
}

if (!TEMPLATE_ID) {
  console.error('Error: TEMPLATE_ID environment variable is not set');
  console.log('Usage: TEMPLATE_ID=20993079 node scripts/sync-from-iterable.js');
  process.exit(1);
}

/**
 * Make HTTP request to Iterable API
 */
function makeIterableRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${ITERABLE_API_BASE}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Api-Key': ITERABLE_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            reject({
              statusCode: res.statusCode,
              message: parsed.msg || parsed.message || 'Unknown error',
              data: parsed
            });
          }
        } catch (error) {
          reject({
            statusCode: res.statusCode,
            message: 'Failed to parse response',
            error: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        statusCode: 0,
        message: 'Request failed',
        error: error.message
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Get email template from Iterable
 */
async function getEmailTemplate(templateId) {
  try {
    // Use preview_email_template to get the HTML content
    const response = await makeIterableRequest('GET', `/templates/email/preview?templateId=${templateId}`);
    return response.data;
  } catch (error) {
    // Try alternative endpoint
    try {
      const response = await makeIterableRequest('GET', `/templates/email/get?templateId=${templateId}`);
      return response.data;
    } catch (error2) {
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }
}

/**
 * Format HTML for readability
 */
function formatHTML(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  // Basic formatting - add line breaks and indentation
  let formatted = html
    .replace(/>\s+</g, '>\n<')
    .replace(/<!DOCTYPE/g, '\n<!DOCTYPE')
    .replace(/<\/html>/g, '\n</html>');
  
  // Add indentation
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indented = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    
    if (trimmed.startsWith('</')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    indented.push('    '.repeat(indentLevel) + trimmed);
    
    if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.startsWith('<!--')) {
      indentLevel++;
    }
  }
  
  return indented.join('\n');
}

/**
 * Get template name for filename
 */
function getTemplateFilename(templateId, templateName = null) {
  // Try to get template name from Iterable if not provided
  const safeName = templateName 
    ? templateName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : 'template';
  
  return `template_${templateId}_${safeName}.html`;
}

/**
 * Save template to file
 */
function saveTemplate(templateId, htmlContent, templateName = null) {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
  
  // Check if template file already exists
  const existingFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => 
    f.startsWith(`template_${templateId}_`) && f.endsWith('.html')
  );
  
  let filename;
  if (existingFiles.length > 0) {
    // Use existing filename
    filename = existingFiles[0];
  } else {
    // Create new filename
    filename = getTemplateFilename(templateId, templateName);
  }
  
  const filepath = path.join(TEMPLATES_DIR, filename);
  const formattedHTML = formatHTML(htmlContent);
  
  fs.writeFileSync(filepath, formattedHTML, 'utf-8');
  console.log(`✅ Template saved to: ${filepath}`);
  
  return filepath;
}

/**
 * Main sync function
 */
async function syncTemplate() {
  console.log(`🔄 Syncing template ${TEMPLATE_ID} from Iterable to GitHub...\n`);
  
  try {
    // Get template from Iterable
    console.log(`📥 Fetching template ${TEMPLATE_ID} from Iterable...`);
    const templateData = await getEmailTemplate(TEMPLATE_ID);
    
    // Extract HTML content
    let htmlContent;
    if (typeof templateData === 'string') {
      htmlContent = templateData;
    } else if (templateData.html) {
      htmlContent = templateData.html;
    } else if (templateData.template && templateData.template.html) {
      htmlContent = templateData.template.html;
    } else {
      throw new Error('Could not extract HTML content from template response');
    }
    
    if (!htmlContent) {
      throw new Error('Template HTML content is empty');
    }
    
    console.log(`✅ Template fetched (${htmlContent.length} characters)\n`);
    
    // Get template name if available
    const templateName = templateData.name || templateData.template?.name || null;
    
    // Save to file
    const filepath = saveTemplate(TEMPLATE_ID, htmlContent, templateName);
    
    console.log(`\n✨ Template ${TEMPLATE_ID} synced successfully!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${fs.statSync(filepath).size} bytes\n`);
    
  } catch (error) {
    console.error(`❌ Error syncing template ${TEMPLATE_ID}:`, error.message);
    if (error.data) {
      console.error('   Details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the sync
syncTemplate().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
