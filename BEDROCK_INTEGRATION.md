# AWS Bedrock Integration for Nanobrowser

This document outlines the AWS Bedrock integration added to Nanobrowser, enabling the use of AWS Bedrock models as LLM providers.

## Overview

AWS Bedrock is now supported as a first-class LLM provider in Nanobrowser, allowing you to use Claude models and other foundation models through AWS's managed service.

## Features

- **Cross-Region Inference**: Support for cross-region inference profiles for better availability
- **Multiple Claude Models**: Support for Claude Sonnet 4, Opus 4, and other Anthropic models
- **Flexible Authentication**: Uses AWS credentials (Access Key + Secret Key)
- **Automatic Region Detection**: Automatically detects region from model ID for cross-region profiles

## Dynamic Model Discovery

The integration now **automatically fetches all available Bedrock models** using the AWS Bedrock API instead of relying on hardcoded lists. This ensures you always have access to the latest models.

### How It Works
1. Enter your AWS credentials (Access Key ID and Secret Access Key)
2. **Select your preferred region** from the dropdown:
   - **All Regions (Comprehensive)**: Queries multiple regions for maximum model coverage
   - **Specific Regions**: Choose from US, EU, or Asia Pacific regions for targeted results
3. **Configure optional filters** (mirrors AWS Bedrock API exactly):
   - **Provider**: Filter by specific providers (Anthropic, Amazon, Cohere, AI21 Labs, Meta, Mistral AI, Stability AI)
   - **Output Type**: Filter by output modality (Text, Image, Embedding)
   - **Inference Type**: Filter by inference type (On-Demand, Provisioned)
   - **Customization**: Filter by customization support (Fine Tuning, Continued Pre-training, Distillation)
4. Click the **"Fetch Available Models"** button
5. The system queries your selected region(s) with your specified filters
6. Fetches both **foundation models** and **cross-region inference profiles**
7. Models are filtered according to your criteria and sorted for easy selection

### Model Categories Discovered
- **Cross-Region Inference Profiles**: `us.*`, `eu.*`, `global.*` for better availability and capacity
- **Direct Foundation Models**: Provider-specific models like `anthropic.*`, `amazon.*`, `cohere.*`
- **All Providers**: Anthropic Claude (including 4.5 Haiku, 3.7 Sonnet), Amazon Nova, Cohere, AI21 Labs, Stability AI, and more
- **Latest Models**: Always up-to-date with newly released models across all regions
- **Regional Exclusives**: Models that may only be available in specific regions

### Fallback Models
If the API call fails, the system falls back to these known models:
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
- `anthropic.claude-3-5-sonnet-20241022-v2:0`
- `anthropic.claude-3-5-haiku-20241022-v1:0`
- `anthropic.claude-3-opus-20240229-v1:0`
- And other stable Claude models

## Configuration

### In Nanobrowser UI

1. Open Nanobrowser settings
2. Add a new LLM provider
3. Select "AWS Bedrock" as the provider type
4. Configure the following fields:
   - **Access Key**: Your AWS Access Key ID
   - **Secret Key**: Your AWS Secret Access Key
5. **Choose your region**:
   - **All Regions (Comprehensive)**: For maximum model coverage (may take longer)
   - **Specific Region**: For faster, targeted results (e.g., US West 2, EU West 1)
6. **Set optional filters** for precise model discovery:
   - **Provider**: Focus on specific AI companies (e.g., only Anthropic models)
   - **Output Type**: Filter by capability (Text for chat, Image for generation, Embedding for search)
   - **Inference Type**: Choose On-Demand (pay-per-use) or Provisioned (dedicated capacity)
   - **Customization**: Filter by fine-tuning capabilities if needed
7. Click **"Fetch Available Models"** to discover models matching your criteria
8. Select your preferred models from the precisely filtered list

### Environment Variables (Optional)

You can also set environment variables for default configuration:

```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-west-2
```

## Model ID Format

Bedrock model IDs follow specific patterns:

- **Cross-region profiles**: `{region}.{provider}.{model}-{version}`
  - Example: `us.anthropic.claude-sonnet-4-20250514-v1:0`
- **Direct models**: `{provider}.{model}-{version}`
  - Example: `anthropic.claude-sonnet-4-20250514-v1:0`

## Region Handling

The integration automatically detects the appropriate AWS region based on the model ID:

- Models starting with `us.` → `us-west-2`
- Models starting with `eu.` → `eu-west-1`  
- Models starting with `global.` → `us-east-1`
- Direct models → `us-west-2` (default)

## Agent Configuration

Bedrock models use optimized parameters for different agents:

### Planner Agent
- Temperature: 0.3
- Top P: 0.6

### Navigator Agent  
- Temperature: 0.2
- Top P: 0.5

## Implementation Details

### Dependencies
- Added `aws-sigv4-fetch` package for browser-compatible AWS API signing
- Uses direct HTTP calls to AWS Bedrock REST API instead of AWS SDK
- Custom `ChatBedrock` class that extends LangChain's `BaseChatModel`

### Provider Type
- Added `ProviderTypeEnum.Bedrock = 'bedrock'`
- Integrated into existing provider management system

### Authentication
- Uses AWS Signature Version 4 (SigV4) for API authentication
- Credentials are handled by `aws-sigv4-fetch` package
- Supports both environment variables and UI configuration
- No Node.js dependencies - fully browser compatible

## Benefits of This Implementation

1. **Browser Compatible**: No Node.js dependencies, works in Chrome extensions
2. **Direct API Access**: Uses AWS Bedrock REST API directly for better control
3. **Lightweight**: Smaller bundle size compared to full AWS SDK
4. **Secure**: Proper AWS SigV4 authentication without exposing credentials
5. **Managed Service**: No need to manage model infrastructure
6. **High Availability**: Cross-region inference provides better uptime
7. **Latest Models**: Access to newest Claude models as they're released

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify AWS credentials are correct
   - Ensure IAM user has Bedrock permissions
   - Check if the model is available in your region

2. **Model Not Found**
   - Verify the model ID is correct
   - Check if you have access to the specific model
   - Ensure the model is available in your AWS region

3. **Region Issues**
   - For cross-region profiles, ensure you're calling from a supported source region
   - Check AWS Bedrock documentation for region availability

### Required IAM Permissions

Your AWS user needs the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "*"
        }
    ]
}
```

## Next Steps

1. Install dependencies: `pnpm install`
2. Configure your AWS credentials in Nanobrowser settings
3. Select Bedrock models for your Planner and Navigator agents
4. Test the integration with a simple task

For more information about AWS Bedrock, visit the [official documentation](https://docs.aws.amazon.com/bedrock/).