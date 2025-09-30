// services/stationFilterService.ts
import { RadioStation } from "@/types/index";

// Configuration for station filtering
const FILTER_CONFIG = {
  // Minimum requirements
  MIN_BITRATE: 64, // Minimum bitrate for decent quality
  MIN_VOTES: -10, // Allow stations with few negative votes
  MAX_SSL_ERRORS: 0, // No SSL errors allowed

  // Time thresholds (in milliseconds)
  MAX_LAST_CHECK_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_LAST_OK_AGE: 14 * 24 * 60 * 60 * 1000, // 14 days

  // Supported formats and codecs
  SUPPORTED_CODECS: [
    "mp3",
    "mpeg",
    "aac",
    "ogg",
    "opus",
    "flac",
    "wav",
    "m4a",
    "webm",
    "hls",
  ],

  // Blocked/problematic patterns in URLs
  BLOCKED_URL_PATTERNS: [
    "test",
    "demo",
    "example",
    "localhost",
    "127.0.0.1",
    "broken",
    "offline",
    "maintenance",
  ],

  // Suspicious/low-quality indicators
  SUSPICIOUS_PATTERNS: [
    "listen.php",
    "proxy.php",
    "redirect.php",
    "stream.php?",
  ],

  // Preferred URL patterns (higher quality indicators)
  PREFERRED_PATTERNS: ["stream", "radio", "live", "broadcast", "audio"],
};

interface StationQualityScore {
  station: RadioStation;
  score: number;
  issues: string[];
  warnings: string[];
}

class StationFilterService {
  /**
   * Check if a station has a valid URL
   */
  private hasValidUrl(station: RadioStation): boolean {
    const url = (station.url_resolved || station.url || "").toLowerCase();

    if (!url || url.length < 10) return false;

    // Must be HTTP/HTTPS
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }

    // Check for blocked patterns
    if (
      FILTER_CONFIG.BLOCKED_URL_PATTERNS.some((pattern) =>
        url.includes(pattern)
      )
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if codec is supported
   */
  private isSupportedCodec(station: RadioStation): boolean {
    const codec = (station.codec || "").toLowerCase().trim();

    if (!codec) return true; // Allow unknown codecs (might still work)

    return FILTER_CONFIG.SUPPORTED_CODECS.includes(codec);
  }

  /**
   * Check if station has been verified recently
   */
  private isRecentlyVerified(station: RadioStation): boolean {
    const now = Date.now();

    // Check last successful check
    if (station.lastcheckoktime) {
      const lastOkTime = new Date(station.lastcheckoktime).getTime();
      if (now - lastOkTime <= FILTER_CONFIG.MAX_LAST_OK_AGE) {
        return true;
      }
    }

    // Check general last check time with OK status
    if (station.lastchecktime && station.lastcheckok === 1) {
      const lastCheckTime = new Date(station.lastchecktime).getTime();
      if (now - lastCheckTime <= FILTER_CONFIG.MAX_LAST_CHECK_AGE) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if station has acceptable quality metrics
   */
  private hasAcceptableQuality(station: RadioStation): boolean {
    // Bitrate check (allow 0 for unknown/variable bitrate streams)
    if (station.bitrate > 0 && station.bitrate < FILTER_CONFIG.MIN_BITRATE) {
      return false;
    }

    // Vote check (negative votes indicate problems)
    if (station.votes < FILTER_CONFIG.MIN_VOTES) {
      return false;
    }

    // SSL error check
    if (station.ssl_error > FILTER_CONFIG.MAX_SSL_ERRORS) {
      return false;
    }

    return true;
  }

  /**
   * Calculate quality score for ranking stations
   */
  private calculateQualityScore(station: RadioStation): StationQualityScore {
    let score = 0;
    const issues: string[] = [];
    const warnings: string[] = [];

    const url = (station.url_resolved || station.url || "").toLowerCase();

    // Base score components

    // 1. Votes and popularity (0-30 points)
    const votesScore = Math.min(Math.max(station.votes, 0), 100) * 0.2;
    const clickScore =
      Math.min(Math.log10(Math.max(station.clickcount, 1)), 5) * 4;
    score += votesScore + clickScore;

    // 2. Technical quality (0-25 points)
    if (station.bitrate >= 128) {
      score += 15;
    } else if (station.bitrate >= 96) {
      score += 10;
    } else if (station.bitrate >= 64) {
      score += 5;
    } else if (station.bitrate > 0) {
      warnings.push("Low bitrate");
    }

    // Codec bonus
    const codec = (station.codec || "").toLowerCase();
    if (codec === "mp3" || codec === "aac") {
      score += 5;
    } else if (codec === "ogg" || codec === "opus") {
      score += 4;
    } else if (codec === "flac") {
      score += 3;
    }

    // 3. Reliability (0-20 points)
    if (station.lastcheckok === 1) {
      score += 10;
      if (this.isRecentlyVerified(station)) {
        score += 10;
      } else {
        warnings.push("Not recently verified");
        score += 5;
      }
    } else {
      issues.push("Last check failed");
    }

    // SSL bonus
    if (station.ssl_error === 0 && url.startsWith("https://")) {
      score += 3;
    }

    // 4. URL quality (0-15 points)
    if (
      FILTER_CONFIG.PREFERRED_PATTERNS.some((pattern) => url.includes(pattern))
    ) {
      score += 8;
    }

    if (
      FILTER_CONFIG.SUSPICIOUS_PATTERNS.some((pattern) => url.includes(pattern))
    ) {
      score -= 5;
      warnings.push("Suspicious URL pattern");
    }

    // URL structure bonus (direct stream URLs are better)
    if (url.includes(".pls") || url.includes(".m3u")) {
      score -= 3;
      warnings.push("Playlist URL");
    }

    // 5. Metadata completeness (0-10 points)
    if (station.name && station.name.length > 3) score += 2;
    if (station.country) score += 2;
    if (station.language) score += 2;
    if (station.tags) score += 2;
    if (station.homepage) score += 2;

    return { station, score: Math.max(0, score), issues, warnings };
  }

  /**
   * Filter out completely unplayable stations
   */
  public filterPlayableStations(stations: RadioStation[]): RadioStation[] {
    return stations.filter((station) => {
      // Basic validity checks
      if (!this.hasValidUrl(station)) {
        console.debug(`❌ Filtered out station "${station.name}": Invalid URL`);
        return false;
      }

      if (!this.isSupportedCodec(station)) {
        console.debug(
          `❌ Filtered out station "${station.name}": Unsupported codec (${station.codec})`
        );
        return false;
      }

      if (!this.hasAcceptableQuality(station)) {
        console.debug(
          `❌ Filtered out station "${station.name}": Poor quality metrics`
        );
        return false;
      }

      // Must have been online at some point
      if (station.lastcheckok === 0 && !station.lastcheckoktime) {
        console.debug(
          `❌ Filtered out station "${station.name}": Never verified as working`
        );
        return false;
      }

      return true;
    });
  }

  /**
   * Rank stations by quality score
   */
  public rankStationsByQuality(
    stations: RadioStation[]
  ): StationQualityScore[] {
    return stations
      .map((station) => this.calculateQualityScore(station))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get filtered and ranked stations
   */
  public getOptimalStations(
    stations: RadioStation[],
    limit?: number
  ): RadioStation[] {
    console.log(`🔍 Filtering ${stations.length} stations...`);

    // First pass: filter out unplayable stations
    const playable = this.filterPlayableStations(stations);
    console.log(`✅ ${playable.length} stations passed basic filtering`);

    if (playable.length === 0) {
      console.warn("⚠️ No playable stations found after filtering");
      return [];
    }

    // Second pass: rank by quality
    const ranked = this.rankStationsByQuality(playable);

    // Log quality distribution for debugging
    if (process.env.NODE_ENV === "development") {
      const qualityStats = {
        excellent: ranked.filter((s) => s.score >= 60).length,
        good: ranked.filter((s) => s.score >= 40 && s.score < 60).length,
        acceptable: ranked.filter((s) => s.score >= 20 && s.score < 40).length,
        poor: ranked.filter((s) => s.score < 20).length,
      };
      console.log("📊 Quality distribution:", qualityStats);
    }

    // Apply limit if specified
    const result = limit ? ranked.slice(0, limit) : ranked;

    console.log(`🎯 Returning ${result.length} optimal stations`);
    return result.map((item) => item.station);
  }

  /**
   * Test if a station is likely to work (for real-time validation)
   */
  public async testStationPlayability(station: RadioStation): Promise<boolean> {
    try {
      const url = station.url_resolved || station.url;
      if (!url || !this.hasValidUrl(station)) return false;

      // Create a test request with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "RadioVerse/1.0",
          Accept: "audio/*,application/vnd.apple.mpegurl,*/*;q=0.1",
        },
      });

      clearTimeout(timeoutId);

      // Check response
      if (!response.ok) return false;

      const contentType = response.headers.get("content-type") || "";
      const isAudioContent =
        contentType.includes("audio/") ||
        contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegurl");

      return isAudioContent;
    } catch (error) {
      console.debug(`❌ Station test failed for "${station.name}":`, error);
      return false;
    }
  }

  /**
   * Advanced filtering with real-time validation (use sparingly due to network requests)
   */
  public async validateStationsRealtime(
    stations: RadioStation[],
    maxConcurrent: number = 5
  ): Promise<RadioStation[]> {
    console.log(`🧪 Real-time validation of ${stations.length} stations...`);

    // First apply basic filtering
    const prefiltered = this.filterPlayableStations(stations);

    if (prefiltered.length === 0) return [];

    // Batch validation to avoid overwhelming the network
    const validStations: RadioStation[] = [];

    for (let i = 0; i < prefiltered.length; i += maxConcurrent) {
      const batch = prefiltered.slice(i, i + maxConcurrent);

      const validationPromises = batch.map(async (station) => {
        const isValid = await this.testStationPlayability(station);
        return isValid ? station : null;
      });

      const results = await Promise.all(validationPromises);
      validStations.push(...results.filter((station) => station !== null));

      // Brief pause between batches to be nice to servers
      if (i + maxConcurrent < prefiltered.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(
      `✅ ${validStations.length}/${prefiltered.length} stations validated as playable`
    );
    return this.getOptimalStations(validStations);
  }

  /**
   * Get station info with quality assessment
   */
  public getStationQualityInfo(station: RadioStation): {
    station: RadioStation;
    quality: "excellent" | "good" | "acceptable" | "poor";
    score: number;
    issues: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const result = this.calculateQualityScore(station);
    const recommendations: string[] = [];

    let quality: "excellent" | "good" | "acceptable" | "poor";
    if (result.score >= 60) {
      quality = "excellent";
    } else if (result.score >= 40) {
      quality = "good";
    } else if (result.score >= 20) {
      quality = "acceptable";
      recommendations.push("Consider trying other stations for better quality");
    } else {
      quality = "poor";
      recommendations.push("This station may have playback issues");
    }

    // Add specific recommendations
    if (station.bitrate > 0 && station.bitrate < 96) {
      recommendations.push("Low bitrate may affect audio quality");
    }

    if (station.ssl_error > 0) {
      recommendations.push("SSL issues detected - playback may be unreliable");
    }

    if (!this.isRecentlyVerified(station)) {
      recommendations.push("Station not recently verified - may be offline");
    }

    return {
      station,
      quality,
      score: result.score,
      issues: result.issues,
      warnings: result.warnings,
      recommendations,
    };
  }

  /**
   * Filter stations by country with quality sorting
   */
  public getStationsByCountryOptimal(
    stations: RadioStation[],
    countryCode: string,
    limit?: number
  ): RadioStation[] {
    const countryStations = stations.filter(
      (station) =>
        station.countrycode?.toLowerCase() === countryCode.toLowerCase()
    );

    return this.getOptimalStations(countryStations, limit);
  }

  /**
   * Search stations with quality-aware ranking
   */
  public searchStationsOptimal(
    stations: RadioStation[],
    query: string,
    limit?: number
  ): RadioStation[] {
    const searchQuery = query.toLowerCase().trim();

    const matchingStations = stations.filter((station) => {
      const name = (station.name || "").toLowerCase();
      const tags = (station.tags || "").toLowerCase();
      const country = (station.country || "").toLowerCase();

      return (
        name.includes(searchQuery) ||
        tags.includes(searchQuery) ||
        country.includes(searchQuery)
      );
    });

    // Boost exact matches in scoring
    const boostedStations = matchingStations.map((station) => {
      const nameMatch = (station.name || "")
        .toLowerCase()
        .includes(searchQuery);
      const exactMatch = (station.name || "").toLowerCase() === searchQuery;

      return {
        ...station,
        // Temporary boost for search relevance
        clickcount:
          station.clickcount + (exactMatch ? 1000 : nameMatch ? 500 : 100),
      };
    });

    return this.getOptimalStations(boostedStations, limit);
  }

  /**
   * Get statistics about station quality in a collection
   */
  public getQualityStatistics(stations: RadioStation[]): {
    total: number;
    playable: number;
    qualityDistribution: {
      excellent: number;
      good: number;
      acceptable: number;
      poor: number;
    };
    averageScore: number;
    topIssues: Array<{ issue: string; count: number }>;
  } {
    const playable = this.filterPlayableStations(stations);
    const scored = this.rankStationsByQuality(playable);

    const distribution = {
      excellent: scored.filter((s) => s.score >= 60).length,
      good: scored.filter((s) => s.score >= 40 && s.score < 60).length,
      acceptable: scored.filter((s) => s.score >= 20 && s.score < 40).length,
      poor: scored.filter((s) => s.score < 20).length,
    };

    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
        : 0;

    // Collect all issues and count frequency
    const issueMap = new Map<string, number>();
    scored.forEach((s) => {
      [...s.issues, ...s.warnings].forEach((issue) => {
        issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
      });
    });

    const topIssues = Array.from(issueMap.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: stations.length,
      playable: playable.length,
      qualityDistribution: distribution,
      averageScore,
      topIssues,
    };
  }
}

// Export singleton instance
export const stationFilterService = new StationFilterService();

// Export utility functions
export const filterPlayableStations = (stations: RadioStation[]) =>
  stationFilterService.filterPlayableStations(stations);

export const getOptimalStations = (stations: RadioStation[], limit?: number) =>
  stationFilterService.getOptimalStations(stations, limit);

export const getStationQualityInfo = (station: RadioStation) =>
  stationFilterService.getStationQualityInfo(station);

export const validateStationsRealtime = (
  stations: RadioStation[],
  maxConcurrent?: number
) => stationFilterService.validateStationsRealtime(stations, maxConcurrent);

export default stationFilterService;
