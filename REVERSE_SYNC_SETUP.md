# Reverse Sync Setup: Iterable → GitHub

This guide explains how to set up automated syncing from Iterable to GitHub, so that when templates are updated in Iterable (e.g., URL path changes), those changes automatically sync back to your GitHub repository.

## Overview

When a template is updated in Iterable, the system will:
1. Detect the change via webhook or manual trigger
2. Fetch the updated template from Iterable
3. Update the corresponding file in GitHub
4. Commit and push the changes

## Setup Options

### Option 1: GitHub Repository Dispatch (Recommended)

This uses GitHub's `repository_dispatch` event to trigger workflows from external sources.

#### Step 1: Create a Webhook Handler

You'll need a serverless function or webhook endpoint that:
- Receives webhooks from Iterable
- Triggers GitHub Actions via `repository_dispatch`

**Example using GitHub API:**

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/rebecca-iterable/cursor_mcp_server/dispatches \
  -d '{
    "event_type": "iterable-template-updated",
    "client_payload": {
      "template_id": "20993079"
    }
  }'
```

#### Step 2: Set Up Iterable Webhook

1. Get your webhook handler URL (serverless function or webhook service)
2. Run the setup script:

```bash
export ITERABLE_API_KEY="your-api-key"
export WEBHOOK_URL="https://your-webhook-handler.com/iterable-webhook"
node scripts/setup-iterable-webhook.js
```

Or manually create the webhook in Iterable:
- Go to Settings → Webhooks
- Create new webhook
- URL: Your webhook handler endpoint
- Events: `template.email.updated`

### Option 2: Manual Trigger via GitHub Actions

You can manually trigger the sync workflow:

1. Go to **Actions** tab in your GitHub repository
2. Select "Sync Templates from Iterable to GitHub"
3. Click **Run workflow**
4. Enter the template ID
5. Click **Run workflow**

### Option 3: Scheduled Sync (Polling)

Set up a scheduled workflow that periodically checks for template updates:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

## Required Secrets

Add these secrets to your GitHub repository:

1. **ITERABLE_API_KEY**: Your Iterable API key
   - Settings → Secrets and variables → Actions
   - Add secret: `ITERABLE_API_KEY`

2. **GITHUB_TOKEN**: Automatically provided by GitHub Actions
   - No setup needed - already available as `secrets.GITHUB_TOKEN`

## Workflow Files

### `.github/workflows/sync-from-iterable.yml`

This workflow:
- Triggers on `repository_dispatch` events or manual dispatch
- Fetches the template from Iterable
- Updates the local file
- Commits and pushes changes

### `scripts/sync-from-iterable.js`

This script:
- Fetches template HTML from Iterable API
- Formats the HTML for readability
- Saves to the appropriate file in `templates/` folder
- Uses existing filename if template file already exists

## Webhook Payload Format

When Iterable sends a webhook for template updates, it typically includes:

```json
{
  "eventName": "template.email.updated",
  "templateId": 20993079,
  "templateName": "Carvana Car Recs",
  "updatedAt": "2025-12-17T01:00:00Z"
}
```

Your webhook handler should transform this into a GitHub `repository_dispatch` event:

```json
{
  "event_type": "iterable-template-updated",
  "client_payload": {
    "template_id": "20993079",
    "template_name": "Carvana Car Recs"
  }
}
```

## Testing

### Test Manual Sync

```bash
# Set environment variables
export ITERABLE_API_KEY="your-api-key"
export TEMPLATE_ID="20993079"

# Run the sync script
node scripts/sync-from-iterable.js
```

### Test via GitHub Actions

1. Go to Actions → "Sync Templates from Iterable to GitHub"
2. Click "Run workflow"
3. Enter a template ID
4. Check the workflow logs

## Webhook Handler Examples

### Using Vercel/Netlify Functions

```javascript
// api/iterable-webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { templateId } = req.body;
  
  // Trigger GitHub Action
  await fetch(`https://api.github.com/repos/rebecca-iterable/cursor_mcp_server/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event_type: 'iterable-template-updated',
      client_payload: {
        template_id: String(templateId)
      }
    })
  });
  
  res.status(200).json({ success: true });
}
```

### Using GitHub Actions with External Trigger

You can also use GitHub's `workflow_dispatch` with external API calls:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/rebecca-iterable/cursor_mcp_server/actions/workflows/sync-from-iterable.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "template_id": "20993079"
    }
  }'
```

## Troubleshooting

### Webhook Not Triggering

- Verify webhook URL is accessible
- Check Iterable webhook logs
- Ensure webhook events are enabled in Iterable

### Template Not Found

- Verify template ID exists in Iterable
- Check API key has proper permissions
- Review workflow logs for error messages

### Changes Not Committing

- Verify `GITHUB_TOKEN` has write permissions
- Check if file changes are detected
- Review git commit logs in workflow

## Security Considerations

1. **API Keys**: Store securely in GitHub Secrets
2. **Webhook Validation**: Validate webhook signatures from Iterable
3. **Rate Limiting**: Implement rate limiting for webhook endpoints
4. **Access Control**: Restrict who can trigger workflows

## Next Steps

1. Set up your webhook handler (serverless function or webhook service)
2. Configure Iterable webhook to point to your handler
3. Add required secrets to GitHub
4. Test with a template update
5. Monitor workflow runs in GitHub Actions

## Support

For issues:
1. Check GitHub Actions workflow logs
2. Verify Iterable webhook configuration
3. Test API connectivity
4. Review script error messages
