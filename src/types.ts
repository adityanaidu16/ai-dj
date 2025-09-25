export interface Env {
  AI: any;
  WORKFLOWS: any;
  DJ_STATE: DurableObjectNamespace;
  USER_SESSIONS: DurableObjectNamespace;
  CACHE: KVNamespace;
  PLAYLISTS: KVNamespace;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
}

export interface DJRequest {
  userId: string;
  message: string;
  context?: {
    currentTrack?: SpotifyTrack;
    mood?: string;
    genre?: string;
    energy?: number;
  };
}

export interface DJResponse {
  message: string;
  recommendations?: SpotifyTrack[];
  playlist?: SpotifyPlaylist;
  action?: 'play' | 'queue' | 'create_playlist' | 'skip' | 'pause';
  metadata?: Record<string, any>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    id: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  preview_url?: string;
  uri: string;
  popularity: number;
  audio_features?: AudioFeatures;
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  tracks: SpotifyTrack[];
  uri: string;
}

export interface UserSession {
  userId: string;
  spotifyToken?: string;
  preferences: {
    favoriteGenres: string[];
    favoriteArtists: string[];
    energyPreference: number;
    moodHistory: string[];
  };
  listeningHistory: {
    trackId: string;
    timestamp: number;
    feedback?: 'like' | 'dislike' | 'skip';
  }[];
  currentContext?: {
    mood: string;
    activity: string;
    timeOfDay: string;
  };
}