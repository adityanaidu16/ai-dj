import { Env, SpotifyTrack, AudioFeatures, SpotifyPlaylist } from './types';

export class SpotifyAPI {
  private clientId: string;
  private clientSecret: string;
  private cache: KVNamespace;

  constructor(env: Env) {
    this.clientId = env.SPOTIFY_CLIENT_ID;
    this.clientSecret = env.SPOTIFY_CLIENT_SECRET;
    this.cache = env.CACHE;
  }

  private async getAccessToken(): Promise<string> {
    console.log('Getting Spotify access token...');
    console.log('Client ID:', this.clientId);
    console.log('Client Secret (first 4 chars):', this.clientSecret?.substring(0, 4) + '...');

    const cached = await this.cache.get('spotify_access_token');
    if (cached) {
      const { token, expires } = JSON.parse(cached);
      if (Date.now() < expires) {
        console.log('Using cached token');
        return token;
      }
    }

    console.log('Fetching new token from Spotify...');
    const authString = btoa(`${this.clientId}:${this.clientSecret}`);
    console.log('Auth header prepared');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authString}`,
      },
      body: 'grant_type=client_credentials',
    });

    console.log('Token response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token fetch failed:', response.status, errorText);
      console.error('Full error response:', errorText);
      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Raw token response:', responseText.substring(0, 200));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse token response:', e);
      throw new Error('Invalid JSON response from Spotify token endpoint');
    }

    console.log('Token received, expires in:', data.expires_in);
    console.log('Token type:', data.token_type);
    console.log('Scope:', data.scope || 'No scope');

    const token = data.access_token;
    const expires = Date.now() + (data.expires_in - 60) * 1000;

    await this.cache.put(
      'spotify_access_token',
      JSON.stringify({ token, expires }),
      { expirationTtl: data.expires_in - 60 }
    );

    return token;
  }

  async searchTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
    console.log(`Searching Spotify for: "${query}" (limit: ${limit})`);

    const token = await this.getAccessToken();

    // Improve search by adding year filter and market
    const searchQuery = query;
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit * 2}&market=US`; // Get more tracks to filter
    console.log('Search URL:', url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('Search response status:', response.status);

    if (!response.ok) {
      console.error('Search failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return [];
    }

    const data = await response.json() as any;
    console.log(`Found ${data.tracks?.items?.length || 0} tracks`);

    if (!data.tracks?.items || !Array.isArray(data.tracks.items)) {
      console.error('Invalid search response format:', data);
      return [];
    }

    let tracks = data.tracks.items.map(this.formatTrack);

    // Sort by popularity to get better results
    tracks = tracks.sort((a: SpotifyTrack, b: SpotifyTrack) => (b.popularity || 0) - (a.popularity || 0));

    // Take the requested limit from the sorted tracks
    tracks = tracks.slice(0, limit);

    // Log first few track names for debugging
    if (tracks.length > 0) {
      console.log('Top tracks by popularity:', tracks.slice(0, 5).map((t: SpotifyTrack) =>
        `${t.name} by ${t.artists[0]?.name} (popularity: ${t.popularity})`));
    }

    return tracks;
  }

  async getRecommendations(params: {
    seedTracks?: string[];
    seedArtists?: string[];
    seedGenres?: string[];
    targetEnergy?: number;
    targetValence?: number;
    targetDanceability?: number;
    limit?: number;
  }): Promise<SpotifyTrack[]> {
    try {
      console.log('Getting recommendations with params:', JSON.stringify(params));

      const token = await this.getAccessToken();
      const queryParams = new URLSearchParams();

      // Ensure we have at least one seed parameter (REQUIRED by Spotify)
      if (!params.seedTracks?.length && !params.seedArtists?.length && !params.seedGenres?.length) {
        params.seedGenres = ['pop'];
        console.log('No seeds provided, using default genre: pop');
      }

      // Add seeds (max 5 combined across all types)
      let totalSeeds = 0;

      if (params.seedTracks?.length && totalSeeds < 5) {
        const tracksToAdd = Math.min(params.seedTracks.length, 5 - totalSeeds);
        queryParams.append('seed_tracks', params.seedTracks.slice(0, tracksToAdd).join(','));
        totalSeeds += tracksToAdd;
      }

      if (params.seedArtists?.length && totalSeeds < 5) {
        const artistsToAdd = Math.min(params.seedArtists.length, 5 - totalSeeds);
        queryParams.append('seed_artists', params.seedArtists.slice(0, artistsToAdd).join(','));
        totalSeeds += artistsToAdd;
      }

      if (params.seedGenres?.length && totalSeeds < 5) {
        const genresToAdd = Math.min(params.seedGenres.length, 5 - totalSeeds);
        queryParams.append('seed_genres', params.seedGenres.slice(0, genresToAdd).join(','));
        totalSeeds += genresToAdd;
      }

      // Add market parameter (try US as default)
      queryParams.append('market', 'US');

      // Add optional parameters
      if (params.targetEnergy !== undefined) {
        queryParams.append('target_energy', params.targetEnergy.toString());
      }
      if (params.targetValence !== undefined) {
        queryParams.append('target_valence', params.targetValence.toString());
      }
      if (params.targetDanceability !== undefined) {
        queryParams.append('target_danceability', params.targetDanceability.toString());
      }

      queryParams.append('limit', (params.limit || 20).toString());

      const url = `https://api.spotify.com/v1/recommendations?${queryParams}`;
      console.log('Fetching recommendations from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      console.log('Recommendations response status:', response.status);

      if (!response.ok) {
        console.error('Recommendations failed, falling back to search');

        // Fallback to search if recommendations fail
        const searchTerms: string[] = [];
        if (params.seedGenres?.length) searchTerms.push(params.seedGenres[0]);
        if (params.targetEnergy !== undefined && params.targetEnergy > 0.7) searchTerms.push('energetic');
        else if (params.targetEnergy !== undefined && params.targetEnergy < 0.3) searchTerms.push('chill');

        const searchQuery = searchTerms.join(' ') || 'music';
        return await this.searchTracks(searchQuery, params.limit || 20);
      }

      const data = await response.json() as any;
      console.log('Received', data.tracks?.length || 0, 'recommendations');

      if (data.tracks && Array.isArray(data.tracks)) {
        return data.tracks.map(this.formatTrack);
      }

      return [];
    } catch (error) {
      console.error('Error in getRecommendations:', error);
      // Fallback to search
      return await this.searchTracks('popular music', 20);
    }
  }

  async getAudioFeatures(trackIds: string[]): Promise<Record<string, AudioFeatures>> {
    try {
      if (!trackIds || trackIds.length === 0) {
        return {};
      }

      const token = await this.getAccessToken();
      const response = await fetch(
        `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to get audio features:', response.status);
        return {};
      }

      const data = await response.json() as any;
      const features: Record<string, AudioFeatures> = {};

      if (data.audio_features && Array.isArray(data.audio_features)) {
        data.audio_features.forEach((feature: any) => {
          if (feature) {
            features[feature.id] = {
              danceability: feature.danceability,
              energy: feature.energy,
              valence: feature.valence,
              tempo: feature.tempo,
              acousticness: feature.acousticness,
              instrumentalness: feature.instrumentalness,
            };
          }
        });
      }

      return features;
    } catch (error) {
      console.error('Error getting audio features:', error);
      return {};
    }
  }

  async getAvailableGenres(): Promise<string[]> {
    const token = await this.getAccessToken();
    const response = await fetch(
      'https://api.spotify.com/v1/recommendations/available-genre-seeds',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json() as any;
    return data.genres;
  }

  private formatTrack(track: any): SpotifyTrack {
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => ({ name: a.name, id: a.id })),
      album: {
        name: track.album.name,
        id: track.album.id,
        images: track.album.images,
      },
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      uri: track.uri,
      popularity: track.popularity,
    };
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    trackUris: string[],
    userToken: string
  ): Promise<SpotifyPlaylist> {
    const createResponse = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          public: false,
        }),
      }
    );

    const playlist = await createResponse.json() as any;

    if (trackUris.length > 0) {
      await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: trackUris,
          }),
        }
      );
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      tracks: [],
      uri: playlist.uri,
    };
  }

  async searchPlaylists(query: string, limit = 5): Promise<any[]> {
    console.log(`Searching for playlists: "${query}" (limit: ${limit})`);

    const token = await this.getAccessToken();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}&market=US`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Playlist search failed:', response.status);
      return [];
    }

    const data = await response.json() as any;
    console.log(`Found ${data.playlists?.items?.length || 0} playlists`);

    return data.playlists?.items || [];
  }

  async getPlaylistTracks(playlistId: string, limit = 30): Promise<SpotifyTrack[]> {
    console.log(`Getting tracks from playlist: ${playlistId}`);

    const token = await this.getAccessToken();
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&market=US`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to get playlist tracks:', response.status);
      return [];
    }

    const data = await response.json() as any;
    const tracks: SpotifyTrack[] = [];

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        if (item.track && !item.track.is_local) {
          tracks.push(this.formatTrack(item.track));
        }
      });
    }

    console.log(`Retrieved ${tracks.length} tracks from playlist`);
    return tracks;
  }

  async searchAndGetPlaylistTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
    // Search for playlists matching the query
    const playlists = await this.searchPlaylists(query, 3);

    if (playlists.length === 0) {
      console.log('No playlists found, falling back to track search');
      return await this.searchTracks(query, limit);
    }

    // Get tracks from the top playlists
    let allTracks: SpotifyTrack[] = [];
    const tracksPerPlaylist = Math.ceil(limit / playlists.length);

    for (const playlist of playlists) {
      if (!playlist || !playlist.id) {
        console.log('Skipping invalid playlist:', playlist);
        continue;
      }
      console.log(`Getting tracks from playlist: ${playlist.name || 'Unknown'} (${playlist.id})`);
      const tracks = await this.getPlaylistTracks(playlist.id, tracksPerPlaylist);
      allTracks = [...allTracks, ...tracks];
    }

    // Remove duplicates and sort by popularity
    const uniqueTracks = Array.from(
      new Map(allTracks.map(t => [t.id, t])).values()
    );

    return uniqueTracks
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, limit);
  }

  async searchArtist(query: string): Promise<any> {
    const token = await this.getAccessToken();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=1&market=US`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    return data.artists?.items?.[0] || null;
  }

  async getArtistTopTracks(artistId: string, limit = 10): Promise<SpotifyTrack[]> {
    try {
      console.log(`Getting top tracks for artist: ${artistId}`);

      const token = await this.getAccessToken();
      const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to get artist top tracks:', response.status);
        return [];
      }

      const data = await response.json() as any;
      const tracks = (data.tracks || []).slice(0, limit).map((track: any) => this.formatTrack(track));

      console.log(`Retrieved ${tracks.length} top tracks`);
      return tracks;
    } catch (error) {
      console.error('Error getting artist top tracks:', error);
      return [];
    }
  }

  async getRelatedArtists(artistId: string, limit = 5): Promise<string[]> {
    const token = await this.getAccessToken();
    const url = `https://api.spotify.com/v1/artists/${artistId}/related-artists`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as any;
    return (data.artists || []).slice(0, limit).map((a: any) => a.id);
  }
}