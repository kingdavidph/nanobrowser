# AWS Bedrock Smart Provisioning System

The Nanobrowser extension now includes an intelligent AWS Bedrock model discovery and provisioning system that automatically:

1. **Discovers latest models** from AWS documentation
2. **Checks access status** for your AWS account
3. **Generates provisioning scripts** to request missing model access
4. **Provides step-by-step guidance** for getting Claude 4.5 and other models

## 🚀 Key Features

### Automatic Model Discovery
- Fetches the latest model catalog from AWS Bedrock documentation
- Parses model IDs, regions, capabilities, and access requirements
- Identifies which models need special access approval

### Smart Access Detection
- Checks your current model access via AWS API
- Identifies models you can access vs. those requiring approval
- Provides fallback models when API calls fail

### One-Click Provisioning
- Generates shell scripts (Linux/Mac) and PowerShell scripts (Windows)
- Creates manual step-by-step instructions
- Includes dry-run scripts for testing

### Enhanced UI
- **"Fetch Available Models"** button - Gets currently accessible models
- **"Auto-Provision"** button - Generates provisioning scripts for missing models
- Real-time status indicators and helpful tooltips

## 🎯 How It Works

### 1. Model Discovery Process
```
AWS Documentation → Parse Model Catalog → Check Access Status → Generate Scripts
```

The system:
1. Fetches the latest model information from AWS Bedrock documentation
2. Parses model IDs, regions, and requirements
3. Checks which models your AWS account can access
4. Identifies models needing access approval (like Claude 4.5)

### 2. Smart Fallback System
If API calls fail, the system uses:
- **Primary**: Live AWS API responses
- **Secondary**: Parsed AWS documentation
- **Fallback**: Curated static model list with latest Claude 4.5 models

### 3. Provisioning File Generation
When you click "Auto-Provision", the system generates:
- `provision-bedrock-access.sh` - Bash script for Linux/Mac
- `provision-bedrock-access.ps1` - PowerShell script for Windows
- `manual-provisioning-instructions.md` - Step-by-step guide
- `dry-run-provision.sh` - Test script without making requests

## 📋 Usage Instructions

### Step 1: Configure AWS Credentials
1. Go to Nanobrowser Options → Model Settings
2. Add a Bedrock provider
3. Enter your **AWS Access Key ID** and **AWS Secret Access Key**
4. Select your preferred region

### Step 2: Discover Available Models
1. Click **"Fetch Available Models"** to see what you can currently access
2. If Claude 4.5 models are missing, proceed to Step 3

### Step 3: Auto-Provision Missing Models
1. Click **"Auto-Provision"** button
2. The system will download 4 files to help you request access
3. Choose your preferred method:

#### Option A: Automated Script (Recommended)
```bash
# Linux/Mac
chmod +x provision-bedrock-access.sh
./provision-bedrock-access.sh

# Windows PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\provision-bedrock-access.ps1
```

#### Option B: Manual Commands
Follow the instructions in `manual-provisioning-instructions.md`

### Step 4: Wait for Approval
- AWS typically approves requests within 1-24 hours
- You'll receive email notifications when approved
- Check your email and AWS Bedrock console for updates

### Step 5: Refresh Models
1. After approval, return to Nanobrowser Options
2. Click **"Fetch Available Models"** again
3. Claude 4.5 and other approved models should now appear

## 🔧 Technical Details

### Model Discovery Service
Located in `chrome-extension/src/background/services/aws-model-discovery.ts`

**Key Functions:**
- `fetchLatestModelCatalog()` - Parses AWS documentation
- `checkModelAccessStatus()` - Verifies account access
- `discoverAvailableModels()` - Combines discovery with access checking

### CLI Provisioning Service
Located in `chrome-extension/src/background/services/aws-cli-provisioning.ts`

**Key Functions:**
- `generateProvisioningScript()` - Creates bash scripts
- `generatePowerShellProvisioningScript()` - Creates PowerShell scripts
- `generateManualProvisioningInstructions()` - Creates step-by-step guides

### Enhanced Helper Functions
Updated `chrome-extension/src/background/agent/helper.ts` with:
- Smart fallback system
- Integration with discovery services
- Automatic provisioning file generation

## 🎯 Supported Models

The system automatically discovers and provisions access for:

### Claude 4.5 Models (Latest)
- `anthropic.claude-sonnet-4-5-20250929-v1:0`
- `anthropic.claude-haiku-4-5-20251001-v1:0`

### Claude 4 Models
- `anthropic.claude-sonnet-4-20250514-v1:0`
- `anthropic.claude-opus-4-20250514-v1:0`
- `anthropic.claude-opus-4-1-20250805-v1:0`

### Cross-Region Inference Profiles
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `global.anthropic.claude-sonnet-4-5-20250929-v1:0`

### Other Models
- Claude 3.7, 3.5, and 3.x models
- Amazon Nova models
- Other providers as they become available

## 🛠️ Troubleshooting

### Models Still Not Showing?
1. **Check AWS Region**: Claude 4.5 isn't available in all regions
2. **Verify Credentials**: Ensure Access Key and Secret Key are correct
3. **Check Console Logs**: Open Chrome DevTools for detailed error messages
4. **Try Different Region**: Switch to `us-west-2`, `us-east-1`, or `eu-west-1`

### Provisioning Script Errors?
1. **AWS CLI Not Installed**: Install from https://aws.amazon.com/cli/
2. **Credentials Not Configured**: Run `aws configure`
3. **Permission Denied**: Ensure your IAM user has Bedrock permissions
4. **Already Requested**: Check existing requests with `aws bedrock list-model-access-requests`

### Common IAM Permissions Needed
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:ListFoundationModels",
        "bedrock:ListModelAccessRequests",
        "bedrock:PutModelAccessRequest",
        "bedrock:GetModelAccessRequest",
        "bedrock:ListInferenceProfiles"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🔄 Future Enhancements

The smart provisioning system is designed to be extensible:

- **Real-time Status Monitoring**: Check approval status automatically
- **Batch Provisioning**: Request access for multiple providers at once
- **Custom Model Support**: Add support for custom/fine-tuned models
- **Regional Optimization**: Automatically select best regions for models
- **Cost Optimization**: Suggest most cost-effective model alternatives

## 📞 Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify your AWS credentials and permissions
3. Try the manual provisioning instructions
4. Contact AWS Support for account-specific issues

The smart provisioning system makes it easy to get access to the latest Claude 4.5 models and other advanced AI capabilities in AWS Bedrock!