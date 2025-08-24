export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  language: string;
  votes: number;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  ssl_error: number;
  geo_lat: number;
  geo_long: number;
}

export interface RadioSearchParams {
  limit?: number;
  offset?: number;
  countrycode?: string;
  tag?: string;
  name?: string;
  language?: string;
  order?: string;
  reverse?: boolean;
}

export interface RadioApiResponse {
  success: boolean;
  data: RadioStation[];
  count: number;
  message?: string;
  error?: string;
}

export interface RadioPlayerState {
  isPlaying: boolean;
  currentStation: RadioStation | null;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface StationSelectorState {
  stations: RadioStation[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
}