import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface SettingsPanelProps {
  onClose: () => void;
}

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: ["gpt-4o-mini", "gpt-3.5-turbo"],
  },
  google: {
    name: "Google",
    models: ["gemini-2.0-flash", "gemini-1.5-flash"],
  },
  groq: {
    name: "Groq",
    models: ["llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
  deepseek: {
    name: "DeepSeek",
    models: ["deepseek-chat"],
  },
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const userSettings = useQuery(api.settings.getUserSettings);
  const apiKeys = useQuery(api.settings.getApiKeys);
  
  const updateSettings = useMutation(api.settings.updateUserSettings);
  const saveApiKey = useMutation(api.settings.saveApiKey);
  const testApiKey = useAction(api.aiProviders.testApiKey);

  const [settings, setSettings] = useState({
    defaultProvider: "google",
    defaultModel: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: "",
    theme: "light",
  });

  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userSettings) {
      setSettings({
        ...userSettings,
        systemPrompt: userSettings.systemPrompt || "",
      });
    }
  }, [userSettings]);

  const handleSaveSettings = async () => {
    try {
      // Only send the fields that the mutation expects
      const settingsToSave = {
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt,
        theme: settings.theme,
      };
      
      await updateSettings(settingsToSave);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Settings save error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save settings";
      toast.error(`Failed to save settings: ${errorMessage}`);
    }
  };

  const handleSaveApiKey = async (provider: string) => {
    const apiKey = apiKeyInputs[provider];
    if (!apiKey) return;

    try {
      await saveApiKey({ provider, apiKey });
      setApiKeyInputs({ ...apiKeyInputs, [provider]: "" });
      toast.success(`${PROVIDERS[provider as keyof typeof PROVIDERS].name} API key saved`);
    } catch (error) {
      toast.error("Failed to save API key");
    }
  };

  const handleTestApiKey = async (provider: string) => {
    const apiKey = apiKeyInputs[provider];
    if (!apiKey) return;

    setTestingKeys({ ...testingKeys, [provider]: true });

    try {
      const result = await testApiKey({
        provider,
        apiKey,
        model: PROVIDERS[provider as keyof typeof PROVIDERS].models[0],
      });

      if (result.success) {
        toast.success("API key is valid");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to test API key");
    } finally {
      setTestingKeys({ ...testingKeys, [provider]: false });
    }
  };

  const hasApiKey = (provider: string) => {
    return apiKeys?.some(key => key.provider === provider && key.isActive);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        {/* API Keys Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">API Keys</h3>
          <div className="space-y-4">
            {Object.entries(PROVIDERS).map(([provider, config]) => (
              <div key={provider} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{config.name}</h4>
                  {hasApiKey(provider) && (
                    <span className="text-green-600 text-sm">✓ Configured</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={`Enter ${config.name} API key`}
                    value={apiKeyInputs[provider] || ""}
                    onChange={(e) => setApiKeyInputs({
                      ...apiKeyInputs,
                      [provider]: e.target.value
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => handleTestApiKey(provider)}
                    disabled={!apiKeyInputs[provider] || testingKeys[provider]}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {testingKeys[provider] ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => handleSaveApiKey(provider)}
                    disabled={!apiKeyInputs[provider]}
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Default Settings */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Default Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Provider</label>
              <select
                value={settings.defaultProvider}
                onChange={(e) => setSettings({
                  ...settings,
                  defaultProvider: e.target.value,
                  defaultModel: PROVIDERS[e.target.value as keyof typeof PROVIDERS].models[0]
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(PROVIDERS).map(([provider, config]) => (
                  <option key={provider} value={provider}>{config.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Model</label>
              <select
                value={settings.defaultModel}
                onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PROVIDERS[settings.defaultProvider as keyof typeof PROVIDERS].models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Temperature: {settings.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Tokens</label>
              <input
                type="number"
                min="100"
                max="4000"
                value={settings.maxTokens}
                onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
