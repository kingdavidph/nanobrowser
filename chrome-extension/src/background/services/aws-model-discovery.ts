/**
 * AWS Bedrock Model Discovery Service
 * Automatically discovers available models from AWS documentation and provisions access
 */

import { createSignedFetcher } from 'aws-sigv4-fetch';

export interface BedrockModelInfo {
  modelId: string;
  modelName: string;
  provider: string;
  regions: string[];
  inputModalities: string[];
  outputModalities: string[];
  streamingSupported: boolean;
  requiresAccess: boolean;
  status: 'ACTIVE' | 'PREVIEW' | 'DEPRECATED';
  releaseDate?: string;
}

export interface ModelAccessStatus {
  modelId: string;
  hasAccess: boolean;
  accessStatus: 'GRANTED' | 'PENDING' | 'DENIED' | 'NOT_REQUESTED';
  canRequestAccess: boolean;
}

/**
 * Fetches the latest model information from AWS Bedrock documentation
 */
export async function fetchLatestModelCatalog(): Promise<BedrockModelInfo[]> {
  try {
    console.log('[AWS Model Discovery] Fetching latest model catalog from AWS documentation...');

    // Fetch from AWS Bedrock model documentation page
    const response = await fetch('https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html');
    const html = await response.text();

    // Parse the HTML to extract model information
    const models = parseModelCatalogFromHTML(html);

    // Enhance with additional metadata
    const enhancedModels = await enhanceModelMetadata(models);

    console.log(`[AWS Model Discovery] Found ${enhancedModels.length} models in catalog`);
    return enhancedModels;
  } catch (error) {
    console.error('[AWS Model Discovery] Failed to fetch model catalog:', error);
    return getFallbackModelCatalog();
  }
}

/**
 * Parse model information from AWS documentation HTML
 */
function parseModelCatalogFromHTML(html: string): BedrockModelInfo[] {
  const models: BedrockModelInfo[] = [];

  try {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find the model table
    const tables = doc.querySelectorAll('table');
    let modelTable: Element | null = null;

    for (const table of Array.from(tables)) {
      const headers = table.querySelectorAll('th');
      const headerText = Array.from(headers).map((h: Element) => h.textContent?.toLowerCase() || '');
      if (headerText.includes('model id') && headerText.includes('provider')) {
        modelTable = table;
        break;
      }
    }

    if (!modelTable) {
      throw new Error('Model table not found in AWS documentation');
    }

    // Parse table rows
    const rows = modelTable.querySelectorAll('tbody tr');

    for (const row of Array.from(rows)) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) continue;

      const provider = cells[0]?.textContent?.trim() || '';
      const modelName = cells[1]?.textContent?.trim() || '';
      const modelId = cells[2]?.textContent?.trim() || '';
      const regions = cells[3]?.textContent?.trim().split(/\s+/) || [];
      const inputModalities =
        cells[4]?.textContent
          ?.trim()
          .split(',')
          .map((s: string) => s.trim()) || [];
      const outputModalities =
        cells[5]?.textContent
          ?.trim()
          .split(',')
          .map((s: string) => s.trim()) || [];
      const streamingSupported = cells[6]?.textContent?.toLowerCase().includes('yes') || false;

      if (modelId && provider) {
        models.push({
          modelId,
          modelName,
          provider,
          regions: regions.filter((r: string) => r && r !== '*'),
          inputModalities,
          outputModalities,
          streamingSupported,
          requiresAccess: isModelRequiringAccess(modelId, provider),
          status: 'ACTIVE',
        });
      }
    }
  } catch (error) {
    console.error('[AWS Model Discovery] Failed to parse HTML:', error);
  }

  return models;
}

/**
 * Enhance model metadata with additional information
 */
async function enhanceModelMetadata(models: BedrockModelInfo[]): Promise<BedrockModelInfo[]> {
  return models.map(model => ({
    ...model,
    releaseDate: inferReleaseDate(model.modelId),
    requiresAccess: isModelRequiringAccess(model.modelId, model.provider),
  }));
}

/**
 * Determine if a model requires special access approval
 */
function isModelRequiringAccess(modelId: string, provider: string): boolean {
  // Claude 4+ models typically require access
  if (provider.toLowerCase().includes('anthropic')) {
    if (
      modelId.includes('claude-4') ||
      modelId.includes('claude-sonnet-4') ||
      modelId.includes('claude-opus-4') ||
      modelId.includes('claude-haiku-4')
    ) {
      return true;
    }
  }

  // Other high-end models that typically require access
  const accessRequiredPatterns = [/claude-4/, /opus-4/, /sonnet-4/, /haiku-4/, /nova-premier/, /nova-pro/];

  return accessRequiredPatterns.some(pattern => pattern.test(modelId));
}

/**
 * Infer release date from model ID
 */
function inferReleaseDate(modelId: string): string | undefined {
  const dateMatch = modelId.match(/(\d{8})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Check model access status for a given AWS account
 */
export async function checkModelAccessStatus(
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string,
  modelIds: string[],
): Promise<ModelAccessStatus[]> {
  const signedFetch = createSignedFetcher({
    service: 'bedrock',
    region,
    credentials,
  });

  const accessStatuses: ModelAccessStatus[] = [];

  try {
    // Get model access information
    const response = await signedFetch(`https://bedrock.${region}.amazonaws.com/model-access`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const grantedModels = new Set(data.modelAccessSummaries?.map((m: any) => m.modelId) || []);

      for (const modelId of modelIds) {
        accessStatuses.push({
          modelId,
          hasAccess: grantedModels.has(modelId),
          accessStatus: grantedModels.has(modelId) ? 'GRANTED' : 'NOT_REQUESTED',
          canRequestAccess: true,
        });
      }
    }
  } catch (error) {
    console.error('[AWS Model Discovery] Failed to check access status:', error);

    // Fallback: assume no access for models that typically require it
    for (const modelId of modelIds) {
      accessStatuses.push({
        modelId,
        hasAccess: !isModelRequiringAccess(modelId, ''),
        accessStatus: 'NOT_REQUESTED',
        canRequestAccess: true,
      });
    }
  }

  return accessStatuses;
}

/**
 * Generate AWS CLI commands to request model access
 */
export function generateAccessRequestCommands(modelIds: string[], region: string = 'us-west-2'): string[] {
  const commands: string[] = [];

  // Group models by provider for batch requests
  const modelsByProvider = new Map<string, string[]>();

  for (const modelId of modelIds) {
    const provider = modelId.split('.')[0];
    if (!modelsByProvider.has(provider)) {
      modelsByProvider.set(provider, []);
    }
    modelsByProvider.get(provider)!.push(modelId);
  }

  // Generate commands for each provider
  for (const [provider, models] of modelsByProvider) {
    const modelList = models.map(m => `"${m}"`).join(' ');
    commands.push(
      `# Request access for ${provider} models`,
      `aws bedrock put-model-access-request \\`,
      `  --region ${region} \\`,
      `  --model-ids ${modelList} \\`,
      `  --access-request-reason "Automated access request for Nanobrowser extension"`,
      '',
    );
  }

  return commands;
}

/**
 * Fallback model catalog when AWS documentation is unavailable
 */
function getFallbackModelCatalog(): BedrockModelInfo[] {
  return [
    // Claude 4.5 models
    {
      modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      modelName: 'Claude Sonnet 4.5',
      provider: 'Anthropic',
      regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-09-29',
    },
    {
      modelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
      modelName: 'Claude Haiku 4.5',
      provider: 'Anthropic',
      regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-10-01',
    },
    // Claude 4 models
    {
      modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
      modelName: 'Claude Sonnet 4',
      provider: 'Anthropic',
      regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-05-14',
    },
    {
      modelId: 'anthropic.claude-opus-4-20250514-v1:0',
      modelName: 'Claude Opus 4',
      provider: 'Anthropic',
      regions: ['us-east-1', 'us-east-2', 'us-west-2'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-05-14',
    },
    // Cross-region inference profiles
    {
      modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      modelName: 'Claude Sonnet 4.5 (US Cross-Region)',
      provider: 'Anthropic',
      regions: ['us-west-2'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-09-29',
    },
    {
      modelId: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
      modelName: 'Claude Sonnet 4.5 (EU Cross-Region)',
      provider: 'Anthropic',
      regions: ['eu-west-1'],
      inputModalities: ['Text', 'Image'],
      outputModalities: ['Text', 'Chat'],
      streamingSupported: true,
      requiresAccess: true,
      status: 'ACTIVE',
      releaseDate: '2025-09-29',
    },
  ];
}

/**
 * Smart model discovery that combines API calls with documentation
 */
export async function discoverAvailableModels(
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string = 'us-west-2',
): Promise<{
  availableModels: string[];
  catalogModels: BedrockModelInfo[];
  accessStatuses: ModelAccessStatus[];
  cliCommands: string[];
}> {
  console.log('[Smart Model Discovery] Starting comprehensive model discovery...');

  // 1. Fetch latest model catalog from AWS docs
  const catalogModels = await fetchLatestModelCatalog();

  // 2. Extract model IDs from catalog
  const catalogModelIds = catalogModels.map(m => m.modelId);

  // 3. Check access status for all catalog models
  const accessStatuses = await checkModelAccessStatus(credentials, region, catalogModelIds);

  // 4. Get actually available models via API
  const availableModels = await fetchActuallyAvailableModels(credentials, region);

  // 5. Generate CLI commands for models without access
  const modelsNeedingAccess = accessStatuses
    .filter(status => !status.hasAccess && status.canRequestAccess)
    .map(status => status.modelId);

  const cliCommands = generateAccessRequestCommands(modelsNeedingAccess, region);

  console.log(
    `[Smart Model Discovery] Found ${availableModels.length} available models, ${modelsNeedingAccess.length} need access`,
  );

  return {
    availableModels,
    catalogModels,
    accessStatuses,
    cliCommands,
  };
}

/**
 * Fetch actually available models via Bedrock API
 */
async function fetchActuallyAvailableModels(
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string,
): Promise<string[]> {
  const signedFetch = createSignedFetcher({
    service: 'bedrock',
    region,
    credentials,
  });

  const allModels = new Set<string>();

  try {
    // Fetch foundation models
    const foundationResponse = await signedFetch(`https://bedrock.${region}.amazonaws.com/foundation-models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
      },
    });

    if (foundationResponse.ok) {
      const data = await foundationResponse.json();
      const models = data.modelSummaries || [];

      models
        .filter((model: any) => model.outputModalities?.includes('TEXT') && model.modelLifecycle?.status === 'ACTIVE')
        .forEach((model: any) => allModels.add(model.modelId));
    }

    // Fetch inference profiles
    const profileResponse = await signedFetch(`https://bedrock.${region}.amazonaws.com/inference-profiles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
      },
    });

    if (profileResponse.ok) {
      const data = await profileResponse.json();
      const profiles = data.inferenceProfileSummaries || [];

      profiles
        .filter((profile: any) => profile.status === 'ACTIVE')
        .forEach((profile: any) => allModels.add(profile.inferenceProfileId));
    }
  } catch (error) {
    console.error('[Smart Model Discovery] API call failed:', error);
  }

  return Array.from(allModels).sort();
}
