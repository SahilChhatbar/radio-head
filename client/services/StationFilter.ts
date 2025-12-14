import { RadioStation } from "@/types/index";

const FILTER_CONFIG = {
  MIN_BITRATE: 64,
  MIN_VOTES: -10,
  MAX_SSL_ERRORS: 0,
  MAX_LAST_CHECK_AGE: 7 * 24 * 60 * 60 * 1000,
  MAX_LAST_OK_AGE: 14 * 24 * 60 * 60 * 1000,
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
  SUSPICIOUS_PATTERNS: ["listen.php", "proxy.php", "redirect.php", "stream.php?"],
  PREFERRED_PATTERNS: ["stream", "radio", "live", "broadcast", "audio"],
};

interface StationQualityScore {
  station: RadioStation;
  score: number;
  issues: string[];
  warnings: string[];
}

class StationFilterService {
  private parseDateToMillis(value?: string | number | null): number | null {
    if (!value) return null;
    const n = typeof value === "number" ? value : Date.parse(String(value));
    return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
  }

  private hasValidUrl(station: RadioStation): boolean {
    const url = (station.url_resolved || station.url || "").toLowerCase().trim();
    if (!url || url.length < 10) return false;
    if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
    for (const pattern of FILTER_CONFIG.BLOCKED_URL_PATTERNS) {
      if (url.includes(pattern)) return false;
    }
    return true;
  }

  private isSupportedCodec(station: RadioStation): boolean {
    const codec = (station.codec || "").toLowerCase().trim();
    if (!codec) return true;
    return FILTER_CONFIG.SUPPORTED_CODECS.includes(codec);
  }

  private isRecentlyVerified(station: RadioStation): boolean {
    const now = Date.now();
    const lastOkTime = this.parseDateToMillis(station.lastcheckoktime);
    if (lastOkTime !== null && now - lastOkTime <= FILTER_CONFIG.MAX_LAST_OK_AGE) {
      return true;
    }
    const lastCheckTime = this.parseDateToMillis(station.lastchecktime);
    if (
      lastCheckTime !== null &&
      station.lastcheckok === 1 &&
      now - lastCheckTime <= FILTER_CONFIG.MAX_LAST_CHECK_AGE
    ) {
      return true;
    }
    return false;
  }

  private hasAcceptableQuality(station: RadioStation): boolean {
    if (station.bitrate > 0 && station.bitrate < FILTER_CONFIG.MIN_BITRATE) return false;
    if (station.votes < FILTER_CONFIG.MIN_VOTES) return false;
    if ((station.ssl_error ?? 0) > FILTER_CONFIG.MAX_SSL_ERRORS) return false;
    return true;
  }

  private calculateQualityScore(station: RadioStation): StationQualityScore {
    let score = 0;
    const issues: string[] = [];
    const warnings: string[] = [];

    const url = (station.url_resolved || station.url || "").toLowerCase();

    const safeVotes = typeof station.votes === "number" ? station.votes : 0;
    const votesScore = Math.min(Math.max(safeVotes, 0), 100) * 0.2;
    const safeClicks = Math.max(Number(station.clickcount) || 1, 1);
    const clickScore = Math.min(Math.log10(safeClicks), 5) * 4;
    score += votesScore + clickScore;

    if (station.bitrate >= 128) {
      score += 15;
    } else if (station.bitrate >= 96) {
      score += 10;
    } else if (station.bitrate >= 64) {
      score += 5;
    } else if (station.bitrate > 0) {
      warnings.push("Low bitrate");
    }

    const codec = (station.codec || "").toLowerCase();
    if (codec === "mp3" || codec === "aac") {
      score += 5;
    } else if (codec === "ogg" || codec === "opus") {
      score += 4;
    } else if (codec === "flac") {
      score += 3;
    }

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

    if ((station.ssl_error ?? 0) === 0 && url.startsWith("https://")) {
      score += 3;
    }

    if (FILTER_CONFIG.PREFERRED_PATTERNS.some((pattern) => url.includes(pattern))) {
      score += 8;
    }

    if (FILTER_CONFIG.SUSPICIOUS_PATTERNS.some((pattern) => url.includes(pattern))) {
      score -= 5;
      warnings.push("Suspicious URL pattern");
    }

    if (url.includes(".pls") || url.includes(".m3u")) {
      score -= 3;
      warnings.push("Playlist URL");
    }

    if (station.name && station.name.length > 3) score += 2;
    if (station.country) score += 2;
    if (station.language) score += 2;
    if (station.tags) score += 2;
    if (station.homepage) score += 2;

    return { station, score: Math.max(0, Math.round(score * 100) / 100), issues, warnings };
  }

  public filterPlayableStations(stations: RadioStation[]): RadioStation[] {
    return stations.filter((station) => {
      if (!this.hasValidUrl(station)) return false;
      if (!this.isSupportedCodec(station)) return false;
      if (!this.hasAcceptableQuality(station)) return false;
      if (station.lastcheckok === 0 && !station.lastcheckoktime) return false;
      return true;
    });
  }

  public rankStationsByQuality(stations: RadioStation[]): StationQualityScore[] {
    return stations.map((station) => this.calculateQualityScore(station)).sort((a, b) => b.score - a.score);
  }

  public getOptimalStations(stations: RadioStation[], limit?: number): RadioStation[] {
    const playable = this.filterPlayableStations(stations);
    if (playable.length === 0) return [];
    const ranked = this.rankStationsByQuality(playable);
    const result = limit ? ranked.slice(0, limit) : ranked;
    return result.map((item) => item.station);
  }

  public async testStationPlayability(station: RadioStation): Promise<boolean> {
    const url = station.url_resolved || station.url;
    if (!url || !this.hasValidUrl(station)) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "RadioVerse/1.0",
          Accept: "audio/*,application/vnd.apple.mpegurl,*/*;q=0.1",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;
      const contentType = response.headers.get("content-type") || "";
      return (
        contentType.includes("audio/") ||
        contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegurl")
      );
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  public async validateStationsRealtime(stations: RadioStation[], maxConcurrent: number = 5): Promise<RadioStation[]> {
    const prefiltered = this.filterPlayableStations(stations);
    if (prefiltered.length === 0) return [];

    const validStations: RadioStation[] = [];
    for (let i = 0; i < prefiltered.length; i += maxConcurrent) {
      const batch = prefiltered.slice(i, i + maxConcurrent);
      const validationPromises = batch.map(async (station) => {
        const isValid = await this.testStationPlayability(station);
        return isValid ? station : null;
      });
      const results = await Promise.all(validationPromises);
      validStations.push(...results.filter((s): s is RadioStation => s !== null));
      if (i + maxConcurrent < prefiltered.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return this.getOptimalStations(validStations);
  }

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

    if (station.bitrate > 0 && station.bitrate < 96) {
      recommendations.push("Low bitrate may affect audio quality");
    }

    if ((station.ssl_error ?? 0) > 0) {
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

  public getStationsByCountryOptimal(stations: RadioStation[], countryCode: string, limit?: number): RadioStation[] {
    const countryStations = stations.filter((station) => station.countrycode?.toLowerCase() === countryCode.toLowerCase());
    return this.getOptimalStations(countryStations, limit);
  }

  public searchStationsOptimal(stations: RadioStation[], query: string, limit?: number): RadioStation[] {
    const searchQuery = query.toLowerCase().trim();
    const matchingStations = stations.filter((station) => {
      const name = (station.name || "").toLowerCase();
      const tags = (station.tags || "").toLowerCase();
      const country = (station.country || "").toLowerCase();
      return name.includes(searchQuery) || tags.includes(searchQuery) || country.includes(searchQuery);
    });

    const boostedStations = matchingStations.map((station) => {
      const nameLower = (station.name || "").toLowerCase();
      const nameMatch = nameLower.includes(searchQuery);
      const exactMatch = nameLower === searchQuery;
      return {
        ...station,
        clickcount: station.clickcount + (exactMatch ? 1000 : nameMatch ? 500 : 100),
      } as RadioStation;
    });

    return this.getOptimalStations(boostedStations, limit);
  }

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

    const averageScore = scored.length > 0 ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : 0;

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

export const stationFilterService = new StationFilterService();

export const filterPlayableStations = (stations: RadioStation[]) =>
  stationFilterService.filterPlayableStations(stations);

export const getOptimalStations = (stations: RadioStation[], limit?: number) =>
  stationFilterService.getOptimalStations(stations, limit);

export const getStationQualityInfo = (station: RadioStation) =>
  stationFilterService.getStationQualityInfo(station);

export const validateStationsRealtime = (stations: RadioStation[], maxConcurrent?: number) =>
  stationFilterService.validateStationsRealtime(stations, maxConcurrent);

export default stationFilterService;
