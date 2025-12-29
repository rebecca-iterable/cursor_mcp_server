#!/usr/bin/env node

/**
 * Setup Iterable Webhook for Template Updates
 * 
 * This script helps set up a webhook in Iterable that will trigger
 * GitHub Actions when templates are updated.
 * 
 * The webhook URL should point to a GitHub repository_dispatch endpoint
 * or a serverless function that triggers the GitHub Action.
 */

const https = require('https');

const ITERABLE_API_KEY = process.env.ITERABLE_API_KEY;
const ITERABLE_API_BASE = 'https://api.iterable.com/api';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // GitHub repository_dispatch URL or serverless function

/**
 * Make HTTP request to Iterable API
 */
function makeIterableRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    if (!ITERABLE_API_KEY) {
      reject(new Error('ITERABLE_API_KEY environment variable is not set'));
      return;
    }
    
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
 * Create webhook in Iterable
 */
async function createWebhook() {
  if (!WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL environment variable is not set');
  }
  
  const webhookData = {
    url: WEBHOOK_URL,
    triggers: [
      {
        eventName: 'template.email.updated',
        enabled: true
      }
    ],
    enabled: true
  };
  
  try {
    const response = await makeIterableRequest('POST', '/webhooks', webhookData);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Main function
 */
async function setupWebhook() {
  console.log('🔧 Setting up Iterable webhook for template updates...\n');
  
  if (!ITERABLE_API_KEY) {
    console.error('❌ Error: ITERABLE_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  if (!WEBHOOK_URL) {
    console.error('❌ Error: WEBHOOK_URL environment variable is not set');
    console.log('\n💡 The webhook URL should be:');
    console.log('   - GitHub repository_dispatch endpoint, OR');
    console.log('   - A serverless function that triggers GitHub Actions\n');
    process.exit(1);
  }
  
  try {
    console.log(`📡 Creating webhook pointing to: ${WEBHOOK_URL}\n`);
    const webhook = await createWebhook();
    
    console.log('✅ Webhook created successfully!');
    console.log(`   Webhook ID: ${webhook.id || 'N/A'}`);
    console.log(`   URL: ${webhook.url || WEBHOOK_URL}`);
    console.log(`   Enabled: ${webhook.enabled ? 'Yes' : 'No'}\n`);
    
    console.log('📋 Webhook will trigger on:');
    console.log('   - template.email.updated events\n');
    
  } catch (error) {
    console.error('❌ Error creating webhook:', error.message);
    if (error.data) {
      console.error('   Details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  setupWebhook().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { createWebhook, setupWebhook };
