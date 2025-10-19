import { type ProviderConfig, type ModelConfig, ProviderTypeEnum } from '@extension/storage';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatXAI } from '@langchain/xai';
import { ChatGroq } from '@langchain/groq';
import { ChatCerebras } from '@langchain/cerebras';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';
import { ChatDeepSeek } from '@langchain/deepseek';
import { createSignedFetcher } from 'aws-sigv4-fetch';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import { discoverAvailableModels, type BedrockModelInfo } from '../services/aws-model-discovery';
import { createProvisioningFiles, type ProvisioningOptions } from '../services/aws-cli-provisioning';

// Enhanced function to fetch available Bedrock models with smart discovery
export async function fetchBedrockModels(
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  },
  selectedRegion: string = 'multi-region',
  filters: {
    provider?: string;
    outputModality?: string;
    inferenceType?: string;
    customizationType?: string;
  } = {},
): Promise<string[]> {
  // Determine which regions to check
  const regions =
    selectedRegion === 'multi-region' ? ['us-west-2', 'us-east-1', 'eu-west-1', 'ap-northeast-1'] : [selectedRegion];

  const allModels = new Set<string>();

  for (const region of regions) {
    try {
      const filterStr = Object.entries(filters)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      console.log(
        `[fetchBedrockModels] Fetching models from ${region}${filterStr ? ` with filters: ${filterStr}` : ''}...`,
      );

      const signedFetch = createSignedFetcher({
        service: 'bedrock',
        region: region,
        credentials: credentials,
      });

      // Build query parameters based on filters
      const queryParams = new URLSearchParams();

      // Always include inference type filter (default to ON_DEMAND if not specified)
      queryParams.append('byInferenceType', filters.inferenceType || 'ON_DEMAND');

      // Add other filters if specified
      if (filters.provider) {
        queryParams.append('byProvider', filters.provider);
      }
      if (filters.outputModality) {
        queryParams.append('byOutputModality', filters.outputModality);
      }
      if (filters.customizationType) {
        queryParams.append('byCustomizationType', filters.customizationType);
      }

      // Fetch foundation models
      const foundationResponse = await signedFetch(
        `https://bedrock.${region}.amazonaws.com/foundation-models?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
          },
        },
      );

      if (foundationResponse.ok) {
        const foundationData = await foundationResponse.json();
        const foundationModels = foundationData.modelSummaries || [];

        foundationModels
          .filter((model: any) => model.outputModalities?.includes('TEXT') && model.modelLifecycle?.status === 'ACTIVE')
          .forEach((model: any) => {
            console.log(`[fetchBedrockModels] Found model: ${model.modelId} (status: ${model.modelLifecycle?.status})`);
            allModels.add(model.modelId);
          });
      }

      // Fetch inference profiles (cross-region models)
      try {
        const profileResponse = await signedFetch(`https://bedrock.${region}.amazonaws.com/inference-profiles`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profiles = profileData.inferenceProfileSummaries || [];

          profiles
            .filter((profile: any) => profile.status === 'ACTIVE')
            .forEach((profile: any) => {
              console.log(
                `[fetchBedrockModels] Found inference profile: ${profile.inferenceProfileId} (status: ${profile.status})`,
              );
              allModels.add(profile.inferenceProfileId);
            });
        }
      } catch (profileError) {
        console.log(`[fetchBedrockModels] Could not fetch inference profiles from ${region}:`, profileError);
        // Continue without profiles - not all regions support them
      }
    } catch (error) {
      console.log(`[fetchBedrockModels] Error fetching from ${region}:`, error);
      // Continue to next region
    }
  }

  const modelIds = Array.from(allModels).sort();
  console.log(
    `[fetchBedrockModels] Found ${modelIds.length} total unique models from ${selectedRegion === 'multi-region' ? 'multiple regions' : selectedRegion}`,
  );

  // If we found models via API, return them
  if (modelIds.length > 0) {
    return modelIds;
  }

  // If no models found via API, use smart discovery as fallback
  console.log('[fetchBedrockModels] No models found via API, using smart discovery...');
  try {
    const primaryRegion = selectedRegion === 'multi-region' ? 'us-west-2' : selectedRegion;
    const discovery = await discoverAvailableModels(credentials, primaryRegion);

    console.log(`[fetchBedrockModels] Smart discovery found ${discovery.availableModels.length} available models`);
    console.log(
      `[fetchBedrockModels] ${discovery.catalogModels.length} models in catalog, ${discovery.accessStatuses.filter(s => !s.hasAccess).length} need access`,
    );

    // Store provisioning info for later use
    if (discovery.cliCommands.length > 0) {
      console.log('[fetchBedrockModels] Generated provisioning commands for missing models');
      // Store in extension storage for UI access
      chrome.storage.local.set({
        'bedrock-provisioning-commands': discovery.cliCommands,
        'bedrock-models-needing-access': discovery.accessStatuses.filter(s => !s.hasAccess).map(s => s.modelId),
      });
    }

    // Return available models, or catalog models if none are available
    return discovery.availableModels.length > 0
      ? discovery.availableModels
      : discovery.catalogModels.map(m => m.modelId);
  } catch (error) {
    console.error('[fetchBedrockModels] Smart discovery failed:', error);

    // Final fallback to static list
    console.log('[fetchBedrockModels] Using static fallback models');
    return [
      // Claude 4.5 models (latest)
      'anthropic.claude-sonnet-4-5-20250929-v1:0',
      'anthropic.claude-haiku-4-5-20251001-v1:0',
      // Claude 4 models
      'anthropic.claude-sonnet-4-20250514-v1:0',
      'anthropic.claude-opus-4-20250514-v1:0',
      'anthropic.claude-opus-4-1-20250805-v1:0',
      // Claude 3.7 models
      'anthropic.claude-3-7-sonnet-20250219-v1:0',
      // Cross-region inference profiles for 4.5
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      // Claude 3.5 models (fallback)
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'anthropic.claude-3-5-haiku-20241022-v1:0',
      'anthropic.claude-3-opus-20240229-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
    ];
  }
}

// Function to generate provisioning files for missing model access
export async function generateBedrockProvisioningFiles(
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  },
  region: string = 'us-west-2',
): Promise<{ [filename: string]: string }> {
  try {
    console.log('[generateBedrockProvisioningFiles] Generating provisioning files...');

    const discovery = await discoverAvailableModels(credentials, region);
    const modelsNeedingAccess = discovery.accessStatuses
      .filter(status => !status.hasAccess && status.canRequestAccess)
      .map(status => status.modelId);

    if (modelsNeedingAccess.length === 0) {
      console.log('[generateBedrockProvisioningFiles] No models need access provisioning');
      return {};
    }

    const options: ProvisioningOptions = {
      region,
      reason: 'Automated access request for Nanobrowser AI extension',
    };

    const files = createProvisioningFiles(modelsNeedingAccess, options);

    console.log(
      `[generateBedrockProvisioningFiles] Generated ${Object.keys(files).length} provisioning files for ${modelsNeedingAccess.length} models`,
    );

    return files;
  } catch (error) {
    console.error('[generateBedrockProvisioningFiles] Failed to generate provisioning files:', error);
    return {};
  }
}

// Custom Bedrock chat model using direct HTTP API calls
class ChatBedrock extends BaseChatModel {
  private signedFetch: any;
  private modelId: string;
  private region: string;
  private temperature: number;
  private topP: number;
  private maxTokens: number;

  constructor(args: {
    model: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    temperature: number;
    topP: number;
    maxTokens: number;
  }) {
    super({});
    this.modelId = args.model;
    this.region = args.region;
    this.temperature = args.temperature;
    this.topP = args.topP;
    this.maxTokens = args.maxTokens;

    // Create signed fetcher for AWS API calls
    this.signedFetch = createSignedFetcher({
      service: 'bedrock',
      region: args.region,
      credentials: args.credentials,
    });
  }

  _llmType(): string {
    return 'bedrock';
  }

  async _generate(messages: BaseMessage[]): Promise<any> {
    try {
      // Convert messages to Bedrock format
      const bedrockMessages = messages.map(msg => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: [{ type: 'text', text: msg.content as string }],
      }));

      // Prepare request body based on model type
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: this.topP,
        messages: bedrockMessages,
      };

      // Make API call to Bedrock
      const response = await this.signedFetch(
        `https://bedrock-runtime.${this.region}.amazonaws.com/model/${this.modelId}/invoke`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Extract content from Bedrock response
      const content = result.content?.[0]?.text || '';

      return {
        generations: [
          {
            text: content,
            message: new AIMessage(content),
          },
        ],
      };
    } catch (error: any) {
      console.error('Bedrock API call failed:', error);
      throw new Error(`Failed to call Bedrock API: ${error?.message || 'Unknown error'}`);
    }
  }
}

const maxTokens = 1024 * 4;

// Custom ChatLlama class to handle Llama API response format
class ChatLlama extends ChatOpenAI {
  constructor(args: any) {
    super(args);
  }

  // Override the _generate method to intercept and transform the response
  async _generate(messages: any[], options?: any): Promise<any> {
    try {
      // Make the request using the parent's implementation
      const response = await super._generate(messages, options);

      // Check if this is a Llama API response format in the generations
      if (response?.generations?.[0]?.text) {
        const originalText = response.generations[0].text;

        // Try to parse if it's a Llama API response format
        try {
          const parsed = JSON.parse(originalText);
          if (parsed?.completion_message?.content?.text) {
            // Transform Llama API response to standard format
            response.generations[0].text = parsed.completion_message.content.text;
            response.generations[0].message = new AIMessage(parsed.completion_message.content.text);
          }
        } catch {
          // Not JSON, use as-is
        }
      }

      return response;
    } catch (error: any) {
      console.error(`[ChatLlama] Error during API call:`, error);
      throw error;
    }
  }
}

// O series models or GPT-5 models that support reasoning
function isOpenAIReasoningModel(modelName: string): boolean {
  let modelNameWithoutProvider = modelName;
  if (modelName.startsWith('openai/')) {
    modelNameWithoutProvider = modelName.substring(7);
  }
  return (
    modelNameWithoutProvider.startsWith('o') ||
    (modelNameWithoutProvider.startsWith('gpt-5') && !modelNameWithoutProvider.startsWith('gpt-5-chat'))
  );
}

// Function to check if a model is an Anthropic Opus model
function isAnthropicOpusModel(modelName: string): boolean {
  // Extract the model name without provider prefix if present
  let modelNameWithoutProvider = modelName;
  if (modelName.startsWith('anthropic/')) {
    modelNameWithoutProvider = modelName.substring(10);
  }
  return modelNameWithoutProvider.startsWith('claude-opus');
}

function createOpenAIChatModel(
  providerConfig: ProviderConfig,
  modelConfig: ModelConfig,
  // Add optional extra fetch options for headers etc.
  extraFetchOptions: { headers?: Record<string, string> } | undefined,
): BaseChatModel {
  const args: {
    model: string;
    apiKey?: string;
    // Configuration should align with ClientOptions from @langchain/openai
    configuration?: Record<string, unknown>;
    modelKwargs?: {
      max_completion_tokens: number;
      reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
    };
    topP?: number;
    temperature?: number;
    maxTokens?: number;
  } = {
    model: modelConfig.modelName,
    apiKey: providerConfig.apiKey,
  };

  const configuration: Record<string, unknown> = {};
  if (providerConfig.baseUrl) {
    configuration.baseURL = providerConfig.baseUrl;
  }
  if (extraFetchOptions?.headers) {
    configuration.defaultHeaders = extraFetchOptions.headers;
  }
  args.configuration = configuration;

  // custom provider may have no api key
  if (providerConfig.apiKey) {
    args.apiKey = providerConfig.apiKey;
  }

  // O series models have different parameters
  if (isOpenAIReasoningModel(modelConfig.modelName)) {
    args.modelKwargs = {
      max_completion_tokens: maxTokens,
    };

    // Add reasoning_effort parameter for o-series models if specified
    if (modelConfig.reasoningEffort) {
      args.modelKwargs.reasoning_effort = modelConfig.reasoningEffort;
    }
  } else {
    args.topP = (modelConfig.parameters?.topP ?? 0.1) as number;
    args.temperature = (modelConfig.parameters?.temperature ?? 0.1) as number;
    args.maxTokens = maxTokens;
  }
  return new ChatOpenAI(args);
}

// Function to extract instance name from Azure endpoint URL
function extractInstanceNameFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const hostnameParts = parsedUrl.hostname.split('.');
    // Expecting format like instance-name.openai.azure.com
    if (hostnameParts.length >= 4 && hostnameParts[1] === 'openai' && hostnameParts[2] === 'azure') {
      return hostnameParts[0];
    }
  } catch (e) {
    console.error('Error parsing Azure endpoint URL:', e);
  }
  return null;
}

// Function to check if a provider ID is an Azure provider
function isAzureProvider(providerId: string): boolean {
  return providerId === ProviderTypeEnum.AzureOpenAI || providerId.startsWith(`${ProviderTypeEnum.AzureOpenAI}_`);
}

// Function to create an Azure OpenAI chat model
function createAzureChatModel(providerConfig: ProviderConfig, modelConfig: ModelConfig): BaseChatModel {
  const temperature = (modelConfig.parameters?.temperature ?? 0.1) as number;
  const topP = (modelConfig.parameters?.topP ?? 0.1) as number;

  // Validate necessary fields first
  if (
    !providerConfig.baseUrl ||
    !providerConfig.azureDeploymentNames ||
    providerConfig.azureDeploymentNames.length === 0 ||
    !providerConfig.azureApiVersion ||
    !providerConfig.apiKey
  ) {
    throw new Error(
      'Azure configuration is incomplete. Endpoint, Deployment Name, API Version, and API Key are required. Please check settings.',
    );
  }

  // Instead of always using the first deployment name, use the model name from modelConfig
  // which contains the actual model selected in the UI
  const deploymentName = modelConfig.modelName;

  // Validate that the selected model exists in the configured deployments
  if (!providerConfig.azureDeploymentNames.includes(deploymentName)) {
    console.warn(
      `[createChatModel] Selected deployment "${deploymentName}" not found in available deployments. ` +
        `Available: ${JSON.stringify(providerConfig.azureDeploymentNames)}. Using the model anyway.`,
    );
  }

  // Extract instance name from the endpoint URL
  const instanceName = extractInstanceNameFromUrl(providerConfig.baseUrl);
  if (!instanceName) {
    throw new Error(
      `Could not extract Instance Name from Azure Endpoint URL: ${providerConfig.baseUrl}. Expected format like https://<your-instance-name>.openai.azure.com/`,
    );
  }

  // Check if the Azure deployment is using an "o" series model (GPT-4o, etc.)
  const isOSeriesModel = isOpenAIReasoningModel(deploymentName);

  // Use AzureChatOpenAI with specific parameters
  const args = {
    azureOpenAIApiInstanceName: instanceName, // Derived from endpoint
    azureOpenAIApiDeploymentName: deploymentName,
    azureOpenAIApiKey: providerConfig.apiKey,
    azureOpenAIApiVersion: providerConfig.azureApiVersion,
    // For Azure, the model name should be the deployment name itself
    model: deploymentName, // Set model = deployment name to fix Azure requests
    // For O series models, use modelKwargs instead of temperature/topP
    ...(isOSeriesModel
      ? {
          modelKwargs: {
            max_completion_tokens: maxTokens,
            // Add reasoning_effort parameter for Azure o-series models if specified
            ...(modelConfig.reasoningEffort ? { reasoning_effort: modelConfig.reasoningEffort } : {}),
          },
        }
      : {
          temperature,
          topP,
          maxTokens,
        }),
    // DO NOT pass baseUrl or configuration here
  };
  // console.log('[createChatModel] Azure args passed to AzureChatOpenAI:', args);
  return new AzureChatOpenAI(args);
}

// create a chat model based on the agent name, the model name and provider
export function createChatModel(providerConfig: ProviderConfig, modelConfig: ModelConfig): BaseChatModel {
  const temperature = (modelConfig.parameters?.temperature ?? 0.1) as number;
  const topP = (modelConfig.parameters?.topP ?? 0.1) as number;

  // Check if the provider is an Azure provider with a custom ID (e.g. azure_openai_2)
  const isAzure = isAzureProvider(modelConfig.provider);

  // If this is any type of Azure provider, handle it with the dedicated function
  if (isAzure) {
    return createAzureChatModel(providerConfig, modelConfig);
  }

  switch (modelConfig.provider) {
    case ProviderTypeEnum.OpenAI: {
      // Call helper without extra options
      return createOpenAIChatModel(providerConfig, modelConfig, undefined);
    }
    case ProviderTypeEnum.Anthropic: {
      // For Opus models, only include temperature, not topP
      const args = isAnthropicOpusModel(modelConfig.modelName)
        ? {
            model: modelConfig.modelName,
            apiKey: providerConfig.apiKey,
            maxTokens,
            temperature,
            clientOptions: {},
          }
        : {
            model: modelConfig.modelName,
            apiKey: providerConfig.apiKey,
            maxTokens,
            temperature,
            topP,
            clientOptions: {},
          };
      return new ChatAnthropic(args);
    }
    case ProviderTypeEnum.DeepSeek: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
      };
      return new ChatDeepSeek(args) as BaseChatModel;
    }
    case ProviderTypeEnum.Gemini: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
      };
      return new ChatGoogleGenerativeAI(args);
    }
    case ProviderTypeEnum.Grok: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
        maxTokens,
        configuration: {},
      };
      return new ChatXAI(args) as BaseChatModel;
    }
    case ProviderTypeEnum.Groq: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
        maxTokens,
      };
      return new ChatGroq(args);
    }
    case ProviderTypeEnum.Cerebras: {
      const args = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        temperature,
        topP,
        maxTokens,
      };
      return new ChatCerebras(args);
    }
    case ProviderTypeEnum.Ollama: {
      const args: {
        model: string;
        apiKey?: string;
        baseUrl: string;
        modelKwargs?: { max_completion_tokens: number };
        topP?: number;
        temperature?: number;
        maxTokens?: number;
        numCtx: number;
      } = {
        model: modelConfig.modelName,
        // required but ignored by ollama
        apiKey: providerConfig.apiKey === '' ? 'ollama' : providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl ?? 'http://localhost:11434',
        topP,
        temperature,
        maxTokens,
        // ollama usually has a very small context window, so we need to set a large number for agent to work
        // It was set to 128000 in the original code, but it will cause ollama reload the models frequently if you have multiple models working together
        // not sure why, but setting it to 64000 seems to work fine
        // TODO: configure the context window size in model config
        numCtx: 64000,
      };
      return new ChatOllama(args);
    }
    case ProviderTypeEnum.OpenRouter: {
      // Call the helper function, passing OpenRouter headers via the third argument
      console.log('[createChatModel] Calling createOpenAIChatModel for OpenRouter');
      return createOpenAIChatModel(providerConfig, modelConfig, {
        headers: {
          'HTTP-Referer': 'https://nanobrowser.ai',
          'X-Title': 'Nanobrowser',
        },
      });
    }
    case ProviderTypeEnum.Llama: {
      // Llama API has a different response format, use custom ChatLlama class
      const args: {
        model: string;
        apiKey?: string;
        configuration?: Record<string, unknown>;
        topP?: number;
        temperature?: number;
        maxTokens?: number;
      } = {
        model: modelConfig.modelName,
        apiKey: providerConfig.apiKey,
        topP: (modelConfig.parameters?.topP ?? 0.1) as number,
        temperature: (modelConfig.parameters?.temperature ?? 0.1) as number,
        maxTokens,
      };

      const configuration: Record<string, unknown> = {};
      if (providerConfig.baseUrl) {
        configuration.baseURL = providerConfig.baseUrl;
      }
      args.configuration = configuration;

      return new ChatLlama(args);
    }
    case ProviderTypeEnum.Bedrock: {
      // For Bedrock, we expect:
      // - apiKey: AWS Access Key ID
      // - baseUrl: AWS Secret Access Key (reusing this field for secret)
      // - modelName: The Bedrock model ID (e.g., us.anthropic.claude-sonnet-4-20250514-v1:0)

      if (!providerConfig.apiKey) {
        throw new Error('AWS Access Key ID is required for Bedrock');
      }
      if (!providerConfig.baseUrl) {
        throw new Error('AWS Secret Access Key is required for Bedrock (stored in baseUrl field)');
      }

      // Extract region from model ID if it's a cross-region inference profile
      let region = 'us-west-2'; // default region
      if (modelConfig.modelName.startsWith('us.')) {
        region = 'us-west-2'; // US cross-region profiles
      } else if (modelConfig.modelName.startsWith('eu.')) {
        region = 'eu-west-1'; // EU cross-region profiles
      } else if (modelConfig.modelName.startsWith('global.')) {
        region = 'us-east-1'; // Global profiles typically use us-east-1
      }

      const args = {
        model: modelConfig.modelName,
        region: region,
        credentials: {
          accessKeyId: providerConfig.apiKey,
          secretAccessKey: providerConfig.baseUrl, // Using baseUrl field for secret key
        },
        temperature,
        topP,
        maxTokens,
      };
      return new ChatBedrock(args);
    }
    default: {
      // by default, we think it's a openai-compatible provider
      // Pass undefined for extraFetchOptions for default/custom cases
      return createOpenAIChatModel(providerConfig, modelConfig, undefined);
    }
  }
}
