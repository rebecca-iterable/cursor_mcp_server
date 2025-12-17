# Automated Template Syncing Setup

This guide explains how to set up automated syncing of HTML templates from your GitHub repository to Iterable.

## Overview

When you push changes to template files in the `templates/` folder, a GitHub Actions workflow automatically:
1. Detects which templates were changed
2. Extracts the template ID from the filename
3. Updates the corresponding template in Iterable via the API

## Prerequisites

- A GitHub repository with the templates folder
- An Iterable API key with permissions to update email templates
- GitHub Actions enabled for your repository

## Setup Instructions

### 1. Add Iterable API Key to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `ITERABLE_API_KEY`
5. Value: Your Iterable API key
6. Click **Add secret**

> **Note:** You can find your API key in Iterable under **Settings** → **API Keys**

### 2. Verify Template Naming Convention

Your template files must follow this naming pattern:
```
template_{TEMPLATE_ID}_{name}.html
```

Examples:
- `template_20993079_carvana_car_recs.html` → Template ID: 20993079
- `template_20464624_nextdoor.html` → Template ID: 20464624

### 3. Test the Setup

#### Option A: Test via GitHub Actions (Recommended)

1. Make a small change to any template file in the `templates/` folder
2. Commit and push to the `main` branch:
   ```bash
   git add templates/template_20993079_carvana_car_recs.html
   git commit -m "Test template sync"
   git push origin main
   ```
3. Go to your GitHub repository → **Actions** tab
4. You should see a workflow run called "Sync Templates to Iterable"
5. Click on it to see the sync progress and results

#### Option B: Test Locally

You can also test the sync script locally:

```bash
# Set your API key as an environment variable
export ITERABLE_API_KEY="your-api-key-here"

# Run the sync script
npm run sync-templates
```

## How It Works

### Automatic Triggering

The workflow triggers automatically when:
- You push changes to the `main` branch
- The changes include files in the `templates/` folder with `.html` extension

### Manual Triggering

You can also manually trigger the workflow:
1. Go to **Actions** tab in your GitHub repository
2. Select "Sync Templates to Iterable" workflow
3. Click **Run workflow** button
4. Select the branch and click **Run workflow**

### Change Detection

- **In CI/CD (GitHub Actions):** Only changed templates are synced (compares with previous commit)
- **Manual/Local run:** All templates in the folder are synced

## Workflow Features

- ✅ Detects changed template files automatically
- ✅ Extracts template IDs from filenames
- ✅ Updates templates via Iterable API
- ✅ Provides detailed success/failure reports
- ✅ Creates GitHub Actions summary with results
- ✅ Fails the workflow if any template fails to sync

## Troubleshooting

### Workflow Not Triggering

- Ensure the workflow file is in `.github/workflows/` folder
- Check that you're pushing to the `main` branch (or update the workflow to your default branch)
- Verify the file path matches: `templates/**/*.html`

### Authentication Errors

- Verify `ITERABLE_API_KEY` is set in GitHub Secrets
- Check that the API key has permissions to update email templates
- Ensure the API key is not expired

### Template Update Failures

- Verify the template ID in the filename matches the actual template ID in Iterable
- Check that the HTML content is valid
- Ensure the template includes required elements (e.g., `{{unsubscribeUrl}}` for marketing emails)
- Review the workflow logs for detailed error messages

### Template ID Not Found

- Ensure filename follows the pattern: `template_{ID}_{name}.html`
- The ID must be numeric (e.g., `20993079`)
- Check that the template exists in your Iterable project

## File Structure

```
cursor_mcp_server/
├── .github/
│   └── workflows/
│       └── sync-templates.yml    # GitHub Actions workflow
├── scripts/
│   └── sync-templates.js          # Sync script
├── templates/
│   ├── template_20993079_carvana_car_recs.html
│   ├── template_20464624_nextdoor.html
│   └── ...
└── package.json
```

## API Requirements

The sync script uses the Iterable REST API endpoint:
```
PUT /api/templates/email/update
```

Required parameters:
- `templateId` (number): The template ID extracted from filename
- `html` (string): The HTML content from the template file

## Security Best Practices

1. **Never commit API keys** to your repository
2. Always use GitHub Secrets for sensitive credentials
3. Use API keys with minimal required permissions
4. Rotate API keys periodically
5. Review workflow logs regularly for any issues

## Support

If you encounter issues:
1. Check the GitHub Actions workflow logs
2. Review the `sync-results.json` file (created after each run)
3. Verify your Iterable API key permissions
4. Ensure template files follow the naming convention

## Next Steps

After setup:
1. Make a test change to verify everything works
2. Monitor the first few syncs to ensure reliability
3. Consider setting up notifications for failed syncs (optional)
