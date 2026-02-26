import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RecommendationContext, MobilityData, Analysis, AlternativeDestination } from '@/shared/types';
import { buildRecommendationPrompt, buildAlternativesPrompt, buildMobilityAnalysisPrompt } from './recommendationPrompts';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = Number(import.meta.env.VITE_CACHE_TTL ?? 1800) * 1000;

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: string): void {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
}

function isEnabled(): boolean {
  return Boolean(API_KEY) && import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';
}

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  if (!API_KEY) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

async function generateText(prompt: string): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('Gemini API key not configured');
  const model = client.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateRecommendation(context: RecommendationContext): Promise<string> {
  if (!isEnabled()) throw new Error('Gemini service not available');
  const prompt = buildRecommendationPrompt(context);
  const cacheKey = `rec-${context.destination.id}-${context.weather.temp}-${context.weather.condition}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const result = await generateText(prompt);
  setCache(cacheKey, result);
  return result;
}

export async function analyzeMobility(data: MobilityData): Promise<Analysis> {
  if (!isEnabled()) throw new Error('Gemini service not available');
  const prompt = buildMobilityAnalysisPrompt(data);
  const result = await generateText(prompt);
  return JSON.parse(result) as Analysis;
}

export async function suggestAlternatives(destinationName: string, reason: string): Promise<AlternativeDestination[]> {
  if (!isEnabled()) throw new Error('Gemini service not available');
  const prompt = buildAlternativesPrompt(destinationName, reason);
  const cacheKey = `alt-${destinationName}`;
  const cached = getCached(cacheKey);
  if (cached) return JSON.parse(cached) as AlternativeDestination[];
  const result = await generateText(prompt);
  setCache(cacheKey, result);
  return JSON.parse(result) as AlternativeDestination[];
}

export function clearCache(): void {
  responseCache.clear();
}

export { isEnabled as isGeminiEnabled };
