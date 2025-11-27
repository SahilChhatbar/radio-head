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
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  lastchangetime: string;
  lastchangetime_iso8601: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastchecktime_iso8601: string;
  lastcheckoktime: string;
  lastcheckoktime_iso8601: string;
  lastlocalchecktime: string;
  lastlocalchecktime_iso8601: string;
  clicktimestamp: string;
  clicktimestamp_iso8601: string;
  clickcount: number;
  clicktrend: number;
  ssl_error: number;
  geo_lat: number;
  geo_long: number;
  has_extended_info: boolean;
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
  message: string;
  data: RadioStation[];
  count: number;
  timestamp: string;
}

export interface RadioPlayerState {
  isPlaying: boolean;
  currentStation: RadioStation | null;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}
