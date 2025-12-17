#!/usr/bin/env node

/**
 * Sync Template Script
 * 
 * This script syncs HTML templates from the templates/ folder to Iterable.
 * It detects changed template files and updates the corresponding templates in Iterable.
 * 
 * Template files should follow the naming pattern: template_{ID}_{name}.html
 * Example: template_20993079_carvana_car_recs.html
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;
const ITERABLE_API_BASE = 'https://api.iterable.com/api';
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const RESULTS_FILE = path.join(__dirname, '..', 'sync-results.json');

if (!ITERABLE_API_KEY) {
  console.error('Error: ITERABLE_API_KEY environment variable is not set');
  process.exit(1);
}

/**
 * Extract template ID from filename
 * Pattern: template_{ID}_{name}.html
 */
function extractTemplateId(filename) {
  const match = filename.match(/^template_(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get changed template files
 * In CI/CD, compares with previous commit. Locally, syncs all templates.
 */
function getChangedTemplates() {
  const isCI = process.env.CI === 'true';
  const templates = [];
  
  if (isCI && process.env.GITHUB_EVENT_NAME === 'push') {
    // In GitHub Actions, get changed files from git
    const { execSync } = require('child_process');
    try {
      const changedFiles = execSync(
        'git diff --name-only HEAD~1 HEAD -- templates/',
        { encoding: 'utf-8' }
      ).trim().split('\n').filter(Boolean);
      
      changedFiles.forEach(file => {
        if (file.endsWith('.html')) {
          const templateId = extractTemplateId(path.basename(file));
          if (templateId) {
            templates.push({
              file: path.join(__dirname, '..', file),
              templateId,
              filename: path.basename(file)
            });
          }
        }
      });
    } catch (error) {
      console.warn('Could not detect changed files, syncing all templates');
      // Fall through to sync all templates
    }
  }
  
  // If no changed files detected or running locally, sync all templates
  if (templates.length === 0) {
    const files = fs.readdirSync(TEMPLATES_DIR);
    files.forEach(filename => {
      if (filename.endsWith('.html') && filename.startsWith('template_')) {
        const templateId = extractTemplateId(filename);
        if (templateId) {
          templates.push({
            file: path.join(TEMPLATES_DIR, filename),
            templateId,
            filename
          });
        }
      }
    });
  }
  
  return templates;
}

/**
 * Read HTML content from file
 */
function readTemplateFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read template file: ${error.message}`);
  }
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
 * Update email template in Iterable
 */
async function updateTemplate(templateId, htmlContent) {
  try {
    const response = await makeIterableRequest('PUT', `/templates/email/update`, {
      templateId: templateId,
      html: htmlContent
    });
    
    return {
      success: true,
      message: 'Template updated successfully',
      response: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Failed to update template',
      error: error
    };
  }
}

/**
 * Main sync function
 */
async function syncTemplates() {
  console.log('🚀 Starting template sync to Iterable...\n');
  
  const templates = getChangedTemplates();
  
  if (templates.length === 0) {
    console.log('ℹ️  No templates found to sync.');
    return;
  }
  
  console.log(`📋 Found ${templates.length} template(s) to sync:\n`);
  templates.forEach(t => {
    console.log(`   - ${t.filename} (Template ID: ${t.templateId})`);
  });
  console.log('');
  
  const results = [];
  
  for (const template of templates) {
    console.log(`📤 Syncing ${template.filename}...`);
    
    try {
      const htmlContent = readTemplateFile(template.file);
      const result = await updateTemplate(template.templateId, htmlContent);
      
      results.push({
        templateId: template.templateId,
        filename: template.filename,
        success: result.success,
        message: result.message,
        error: result.error
      });
      
      if (result.success) {
        console.log(`   ✅ Successfully updated template ${template.templateId}\n`);
      } else {
        console.log(`   ❌ Failed to update template ${template.templateId}: ${result.message}\n`);
      }
    } catch (error) {
      results.push({
        templateId: template.templateId,
        filename: template.filename,
        success: false,
        message: error.message || 'Unknown error',
        error: error
      });
      console.log(`   ❌ Error processing ${template.filename}: ${error.message}\n`);
    }
  }
  
  // Save results to file for GitHub Actions summary
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ results }, null, 2));
  
  // Print summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('📊 Sync Summary:');
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Total: ${results.length}\n`);
  
  if (failed > 0) {
    console.log('❌ Some templates failed to sync. Check the errors above.');
    process.exit(1);
  } else {
    console.log('✨ All templates synced successfully!');
  }
}

// Run the sync
syncTemplates().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
