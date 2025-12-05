const OpenAI = require('openai');
const config = require('../config');

/**
 * Service for AI-powered Axie valuations
 */
class ValuationService {
  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }
  }

  /**
   * Generate an AI-powered valuation for an Axie
   * @param {Object} axie - The Axie to value
   * @param {Object} marketStats - Market statistics for similar Axies
   * @param {Array} recentSales - Recent sales data
   * @returns {Promise<Object>} Valuation result
   */
  async generateValuation(axie, marketStats, recentSales = []) {
    const analysis = this.analyzeAxieTraits(axie);
    
    // Calculate base valuation from market data
    const baseValuation = this.calculateBaseValuation(axie, marketStats, recentSales);
    
    // If OpenAI is configured, enhance with AI insights
    let aiInsights = null;
    if (this.openai) {
      aiInsights = await this.getAIInsights(axie, marketStats, analysis);
    }

    return {
      axieId: axie.id,
      estimatedValue: baseValuation.estimatedValue,
      confidence: baseValuation.confidence,
      priceRange: baseValuation.priceRange,
      analysis,
      marketComparison: {
        similarListings: marketStats?.count || 0,
        averagePrice: marketStats?.avgPrice || null,
        medianPrice: marketStats?.medianPrice || null
      },
      aiInsights,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze Axie traits and calculate quality scores
   * @param {Object} axie - The Axie to analyze
   * @returns {Object} Trait analysis
   */
  analyzeAxieTraits(axie) {
    const parts = axie.parts || [];
    
    // Calculate purity (how many parts match the Axie's class)
    const matchingParts = parts.filter(part => part.class === axie.class).length;
    const purity = (matchingParts / 6) * 100;

    // Identify valuable parts and abilities
    const valuableParts = this.identifyValuableParts(parts);
    
    // Calculate stat efficiency
    const stats = axie.stats || {};
    const totalStats = (stats.hp || 0) + (stats.speed || 0) + (stats.skill || 0) + (stats.morale || 0);
    
    // Breed count impact (lower is better for value)
    const breedScore = Math.max(0, 100 - (axie.breedCount || 0) * 15);

    return {
      purity,
      isPure: purity === 100,
      matchingParts,
      valuableParts,
      totalStats,
      breedCount: axie.breedCount || 0,
      breedScore,
      class: axie.class,
      overallScore: this.calculateOverallScore(purity, valuableParts.length, breedScore, totalStats)
    };
  }

  /**
   * Identify parts that are considered valuable in the meta
   * @param {Array} parts - Axie parts
   * @returns {Array} Valuable parts
   */
  identifyValuableParts(parts) {
    // These are commonly valuable parts in Axie meta (can be updated based on current meta)
    const valuablePartNames = [
      // Aquatic parts
      'Risky Fish', 'Nimo', 'Lam', 'Koi', 'Goldfish',
      // Beast parts
      'Ronin', 'Imp', 'Nut Cracker', 'Goda', 'Dual Blade',
      // Bird parts
      'Dark Swoop', 'Blackmail', 'Eggbomb', 'Post Fight', 'Cupid',
      // Bug parts
      'Sticky Goo', 'Buzz Buzz', 'Third Glance', 'Gravel Ant',
      // Plant parts
      'October Treat', 'Disguise', 'Leaf Bug', 'Cactus', 'Serious',
      // Reptile parts
      'Tiny Dino', 'Kotaro', 'Green Thorns', 'Snail Shell'
    ];

    return parts.filter(part => 
      valuablePartNames.some(name => 
        part.name && part.name.toLowerCase().includes(name.toLowerCase())
      )
    );
  }

  /**
   * Calculate overall quality score
   * @param {number} purity - Purity percentage
   * @param {number} valuablePartCount - Number of valuable parts
   * @param {number} breedScore - Breeding score
   * @param {number} totalStats - Total stat points
   * @returns {number} Overall score (0-100)
   */
  calculateOverallScore(purity, valuablePartCount, breedScore, totalStats) {
    // Weighted calculation
    const purityWeight = 0.3;
    const partsWeight = 0.25;
    const breedWeight = 0.25;
    const statsWeight = 0.2;

    const normalizedStats = Math.min(100, (totalStats / 164) * 100); // 164 is typical max
    const partsScore = Math.min(100, valuablePartCount * 25);

    return Math.round(
      purity * purityWeight +
      partsScore * partsWeight +
      breedScore * breedWeight +
      normalizedStats * statsWeight
    );
  }

  /**
   * Calculate base valuation from market data
   * @param {Object} axie - The Axie
   * @param {Object} marketStats - Market statistics
   * @param {Array} recentSales - Recent sales
   * @returns {Object} Base valuation
   */
  calculateBaseValuation(axie, marketStats, recentSales) {
    let estimatedValue = 0;
    let confidence = 0;

    if (!marketStats) {
      return {
        estimatedValue: null,
        confidence: 0,
        priceRange: null
      };
    }

    const analysis = this.analyzeAxieTraits(axie);
    const basePrice = marketStats.medianPrice || marketStats.avgPrice;

    if (!basePrice) {
      return {
        estimatedValue: null,
        confidence: 0,
        priceRange: null
      };
    }

    // Adjust based on quality score
    const qualityMultiplier = 0.5 + (analysis.overallScore / 100);
    estimatedValue = basePrice * qualityMultiplier;

    // Purity bonus
    if (analysis.isPure) {
      estimatedValue *= 1.3;
    }

    // Breed count adjustment
    const breedAdjustment = 1 - (axie.breedCount * 0.05);
    estimatedValue *= Math.max(0.5, breedAdjustment);

    // Valuable parts bonus
    estimatedValue *= 1 + (analysis.valuableParts.length * 0.1);

    // Calculate confidence based on data quality
    confidence = this.calculateConfidence(marketStats, recentSales);

    // Price range (±20% based on confidence)
    const variance = 0.2 * (1 - confidence / 100);
    const priceRange = {
      low: estimatedValue * (1 - variance),
      high: estimatedValue * (1 + variance)
    };

    return {
      estimatedValue: Math.round(estimatedValue * 100) / 100,
      confidence,
      priceRange: {
        low: Math.round(priceRange.low * 100) / 100,
        high: Math.round(priceRange.high * 100) / 100
      }
    };
  }

  /**
   * Calculate confidence score based on data quality
   * @param {Object} marketStats - Market statistics
   * @param {Array} recentSales - Recent sales
   * @returns {number} Confidence (0-100)
   */
  calculateConfidence(marketStats, recentSales) {
    let confidence = 50; // Base confidence

    if (marketStats) {
      // More comparable listings = higher confidence
      confidence += Math.min(25, marketStats.count * 0.5);
      
      // Lower price variance = higher confidence
      if (marketStats.avgPrice && marketStats.medianPrice) {
        const variance = Math.abs(marketStats.avgPrice - marketStats.medianPrice) / marketStats.avgPrice;
        confidence += Math.max(0, 15 - variance * 50);
      }
    }

    // Recent sales data
    if (recentSales && recentSales.length > 0) {
      confidence += Math.min(10, recentSales.length);
    }

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Get AI-enhanced insights using OpenAI
   * @param {Object} axie - The Axie
   * @param {Object} marketStats - Market statistics
   * @param {Object} analysis - Trait analysis
   * @returns {Promise<Object>} AI insights
   */
  async getAIInsights(axie, marketStats, analysis) {
    if (!this.openai) {
      return null;
    }

    try {
      const prompt = this.buildInsightPrompt(axie, marketStats, analysis);
      
      const response = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Axie Infinity market analyst. Provide concise, actionable insights about Axie valuations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const content = response.choices[0].message.content;
      
      return {
        summary: content,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting AI insights:', error.message);
      return null;
    }
  }

  /**
   * Build the prompt for AI insights
   * @param {Object} axie - The Axie
   * @param {Object} marketStats - Market statistics
   * @param {Object} analysis - Trait analysis
   * @returns {string} Prompt
   */
  buildInsightPrompt(axie, marketStats, analysis) {
    const parts = (axie.parts || []).map(p => p.name).join(', ');
    
    return `Analyze this Axie for investment potential:

Class: ${axie.class}
Parts: ${parts}
Breed Count: ${axie.breedCount || 0}
Purity: ${analysis.purity}%
Quality Score: ${analysis.overallScore}/100

Market Data:
- Similar listings: ${marketStats?.count || 'Unknown'}
- Average price: $${marketStats?.avgPrice?.toFixed(2) || 'Unknown'}
- Median price: $${marketStats?.medianPrice?.toFixed(2) || 'Unknown'}

Provide a brief (2-3 sentences) assessment of:
1. Investment potential
2. Key strengths or weaknesses
3. Buy/hold/sell recommendation`;
  }
}

module.exports = new ValuationService();
