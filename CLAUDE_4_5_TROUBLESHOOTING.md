# Claude 4.5 Models Troubleshooting Guide

If you're not seeing Claude 4.5 models (Sonnet 4.5 or Haiku 4.5) in your Bedrock configuration, here are the most common reasons and solutions:

## 1. Model Access Requirements

Claude 4.5 models require **special access** in AWS Bedrock:

- **Sonnet 4.5**: `anthropic.claude-sonnet-4-5-20250929-v1:0`
- **Haiku 4.5**: `anthropic.claude-haiku-4-5-20251001-v1:0`

### How to Request Access:
1. Go to AWS Bedrock Console
2. Navigate to "Model access" in the left sidebar
3. Find "Anthropic" models in the list
4. Request access for Claude 4.5 models specifically
5. Wait for approval (can take 1-24 hours)

## 2. Regional Availability

Claude 4.5 models are not available in all regions. Check these regions first:

**Primary regions with Claude 4.5:**
- `us-east-1` (N. Virginia)
- `us-east-2` (Ohio) 
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `eu-central-1` (Frankfurt)

**Try changing your region** in the Bedrock settings if you're using a different region.

## 3. Account Limitations

Some AWS accounts have restrictions:
- **New accounts** may need to wait 24-48 hours
- **Free tier accounts** may have limited model access
- **Organization accounts** may need admin approval

## 4. Debugging Steps

### Check Browser Console:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for Bedrock-related logs when fetching models
4. Look for messages like:
   ```
   [fetchBedrockModels] Found model: anthropic.claude-sonnet-4-5-20250929-v1:0
   [fetchBedrockModels] Found inference profile: us.anthropic.claude-sonnet-4-5-20250929-v1:0
   ```

### Test with AWS CLI:
```bash
# Test if you can access Claude 4.5 directly
aws bedrock list-foundation-models --region us-west-2 --query 'modelSummaries[?contains(modelId, `claude-sonnet-4-5`)]'
```

## 5. Fallback Models

If Claude 4.5 models are not available, the extension will show these fallback models:
- Claude 4 models (Sonnet 4, Opus 4, Opus 4.1)
- Claude 3.7 Sonnet
- Claude 3.5 models

## 6. Cross-Region Inference Profiles

Claude 4.5 models are also available as cross-region inference profiles:
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `global.anthropic.claude-sonnet-4-5-20250929-v1:0`

These may be available even if direct models aren't.

## 7. Contact Support

If none of the above works:
1. Check AWS Bedrock service health
2. Contact AWS Support for model access issues
3. Verify your AWS credentials have the correct permissions:
   - `bedrock:ListFoundationModels`
   - `bedrock:InvokeModel`
   - `bedrock:ListInferenceProfiles`