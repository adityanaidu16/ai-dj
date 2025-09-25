import { Ai } from '@cloudflare/ai';
import { Env, DJRequest, DJResponse, SpotifyTrack, UserSession } from './types';
import { SpotifyAPI } from './spotify';

export class AIDJ {
  private ai: Ai;
  private spotify: SpotifyAPI;
  private env: Env;

  constructor(env: Env) {
    this.ai = new Ai(env.AI);
    this.spotify = new SpotifyAPI(env);
    this.env = env;
  }

  async processRequest(request: DJRequest, session: UserSession): Promise<DJResponse> {
    // Check if user mentions a specific song and get its features
    const songContext = await this.extractSongContext(request.message);

    const systemPrompt = this.buildSystemPrompt(session);
    const userPrompt = await this.buildUserPrompt(request, session, songContext);

    const aiResponse = await this.ai.run('@cf/meta/llama-3.1-70b-instruct' as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    }) as any;

    const parsedResponse = this.parseAIResponse(aiResponse.response);

    // Check if AI is asking questions
    if (parsedResponse.type === 'question') {
      return {
        message: parsedResponse.message,
        recommendations: [],
        action: 'question' as any,
        metadata: {
          questions: parsedResponse.questions
        }
      };
    }

    // Otherwise, get recommendations
    const recommendations = await this.getRecommendations(parsedResponse);

    // Create a concise message about what we're doing
    let responseMessage = '';
    if (recommendations.length > 0) {
      responseMessage = parsedResponse.message || `I found ${recommendations.length} great tracks for you!`;
    } else {
      responseMessage = parsedResponse.message || 'Let me find some music for you...';
    }

    const response: DJResponse = {
      message: responseMessage,
      recommendations,
      action: parsedResponse.action || 'play',
      metadata: {
        mood: parsedResponse.mood,
        energy: parsedResponse.energy,
        genre: parsedResponse.genre
      }
    };

    if (parsedResponse.createPlaylist && recommendations.length > 0) {
      response.playlist = {
        id: `ai-dj-${Date.now()}`,
        name: parsedResponse.playlistName || 'AI DJ Mix',
        description: parsedResponse.playlistDescription || `AI-curated playlist based on: ${request.message}`,
        tracks: recommendations,
        uri: ''
      };
    }

    await this.updateSessionContext(session, request, response);

    return response;
  }

  private buildSystemPrompt(session: UserSession): string {
    return `You are an AI DJ assistant that helps users discover music through Spotify.

    IMPORTANT: You must respond with a JSON object. There are two types of responses:

    1. When you need more information, ask follow-up questions:
    {
      "type": "question",
      "message": "A friendly message introducing your questions",
      "questions": [
        {
          "id": "q1",
          "question": "Your first contextually relevant question",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
        },
        {
          "id": "q2",
          "question": "Your second contextually relevant question",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
        },
        {
          "id": "q3",
          "question": "Your third contextually relevant question (optional)",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
        }
      ]
    }

    Guidelines for creating questions:
    - ALWAYS ask 2-3 questions together in ONE response (not one at a time)
    - Questions should gather different aspects of information
    - After user answers your 2-3 questions, move to recommendations immediately
    - Never ask the same or similar question twice in a conversation
    - Make questions complementary to each other
    - Examples of good 3-question sets:
      * Party: 1) What's the age group? 2) Preferred music genres? 3) How energetic (chill to wild)?
      * Workout: 1) Type of exercise? 2) Workout duration? 3) Motivational or steady rhythm?
      * Study: 1) With or without lyrics? 2) Subject (math/science vs reading/writing)? 3) Background or focus music?
    - Each question should have 3-5 clear, distinct options
    - After the user answers your questions, MUST provide recommendations

    2. When ready to provide recommendations:
    {
      "type": "recommendation",
      "message": "A brief, friendly response",
      "searchStrategy": {
        "playlists": ["search term 1 for playlists", "search term 2"],
        "tracks": ["genre/mood search terms only, NO specific songs"]
      },
      "energy": 0.0 to 1.0,
      "valence": 0.0 to 1.0,
      "mood": "mellow/chill/introspective/upbeat/energetic/melancholic/romantic/focus",
      "action": "play"
    }

    SONG REFERENCE ANALYSIS:
    When a user references a specific song (e.g., "songs like X by Y"):
    - Consider the artist's typical style and era
    - Think about the specific track's likely mood and tempo
    - Common artist vibes to consider:
      * Drake often has introspective, moody, or melodic tracks
      * Consider whether it's likely a slow ballad, mid-tempo vibe, or upbeat track
      * Don't assume all hip-hop is party music - much of it is introspective or chill

    How to create search strategies:
    - For "songs like [specific track]", think about that track's actual characteristics
    - Create diverse searches that capture different aspects:
      * Artist's genre + mood (e.g., "melodic rap", "toronto sound")
      * Similar era or movement (e.g., "2010s hip hop", "modern R&B")
      * Emotional tone (e.g., "introspective", "late night vibes", "moody")
    - Default to medium energy (0.5) and neutral-to-mellow mood unless context suggests otherwise
    - Generate 2-3 playlist searches that explore different angles
    - Generate 1-2 track searches for broader genres/moods

    IMPORTANT RULES:
    - NEVER include specific artist names, song titles, or album names in searches
    - Only use genre, mood, vibe, era, and context-based search terms
    - Let Spotify's algorithms find the best music - don't try to pick it yourself
    - Default energy should be 0.5, NOT 0.8 (unless features or context suggest otherwise)
    - Default mood should be "mellow" or "chill", NOT "party"
    - If user mentions an artist/song, understand their STYLE from the audio features
    - If user has answered questions, ALWAYS provide type: "recommendation"

    User context:
    Previous answers: ${session.currentContext?.activity || 'none'}
    Question round: ${session.currentContext?.activity ? 'User has answered questions' : 'First interaction'}
    Favorite genres: ${session.preferences.favoriteGenres.join(', ') || 'none specified'}

    CRITICAL: After 2-3 questions have been answered, you MUST provide recommendations.`;
  }

  private async extractSongContext(message: string): Promise<any> {
    // Simple pattern to detect "songs like X by Y" or "like X by Y"
    const songPattern = /(?:songs?\s+)?like\s+["']?([^"']+?)["']?\s+by\s+([^"',]+)/i;
    const match = message.match(songPattern);

    if (match) {
      const [, songName, artistName] = match;
      console.log(`Detected song reference: "${songName}" by ${artistName}`);

      try {
        // Search for the track to verify it exists
        const searchQuery = `track:${songName} artist:${artistName}`;
        const tracks = await this.spotify.searchTracks(searchQuery, 1);

        if (tracks.length > 0) {
          const track = tracks[0];
          return {
            track: {
              name: track.name,
              artist: track.artists[0].name,
              popularity: track.popularity,
              id: track.id
            }
          };
        }
      } catch (error) {
        console.error('Error getting song context:', error);
      }
    }

    return null;
  }

  private async buildUserPrompt(request: DJRequest, session: UserSession, songContext: any): Promise<string> {
    let prompt = request.message;

    // Add song context if we found it
    if (songContext) {
      prompt += `\n\nContext: User referenced "${songContext.track.name}" by ${songContext.track.artist}.`;
      prompt += `\nIMPORTANT: Analyze this song's likely characteristics and create search terms that match its vibe.`;
      prompt += `\nDo NOT default to party/high-energy unless this specific song is known to be upbeat.`;
      prompt += `\nConsider the artist's typical style and this specific track when creating search strategies.`;
    }

    // Check if this is an answer to a previous question
    const isAnswer = request.message.includes("I choose:") ||
                    request.message.match(/^(Option \d|Choice \d|\d\.)/i) ||
                    session.currentContext?.activity === 'answered_question';

    if (isAnswer) {
      // Count how many questions have been answered based on the message pattern
      const questionCount = (request.message.match(/q\d:|Option|Choice/gi) || []).length;

      if (questionCount >= 2 || request.message.toLowerCase().includes('now give me')) {
        prompt = `User has answered your questions. IMMEDIATELY provide music recommendations.\n\nUser's answers: ${request.message}\n\nIMPORTANT: You MUST respond with type: "recommendation". Do NOT ask more questions.`;
      } else {
        prompt = `User has answered some of your questions. You may ask 1-2 more questions OR provide recommendations if you have enough context.\n\nUser's answer: ${request.message}`;
      }
    }

    // Check if user is expressing frustration with questions
    if (request.message.toLowerCase().includes("just play") ||
        request.message.toLowerCase().includes("stop asking") ||
        request.message.toLowerCase().includes("no more questions")) {
      prompt = `User wants music immediately without more questions.\n\nOriginal request: ${request.message}\n\nIMPORTANT: Skip all questions and provide type: "recommendation" immediately.`;
    }

    if (request.context?.currentTrack) {
      prompt += `\nCurrently playing: ${request.context.currentTrack.name} by ${request.context.currentTrack.artists.map(a => a.name).join(', ')}`;
    }

    if (session.currentContext) {
      prompt += `\nPrevious interaction: ${session.currentContext.activity} during ${session.currentContext.timeOfDay}`;
    }

    return prompt;
  }

  private parseAIResponse(response: string | any): any {
    console.log('AI Response:', response);

    // Handle if response is already an object (Llama 3.x returns objects)
    if (typeof response === 'object' && response !== null) {
      console.log('Response is already an object');
      return this.normalizeResponse(response);
    }

    // Try to extract JSON from string response
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Parsed AI response:', parsed);
        return this.normalizeResponse(parsed);
      } catch (e) {
        console.error('Failed to parse JSON from AI response:', e);
      }
    }

    // Fallback if JSON parsing fails
    console.log('Falling back to default response');
    return {
      type: 'recommendation',
      message: 'Let me find some music for you!',
      searchStrategy: {
        playlists: ['today\'s top hits'],
        tracks: []
      },
      mood: 'neutral',
      energy: 0.5,
      valence: 0.5,
      action: 'play',
      createPlaylist: false
    };
  }

  private normalizeResponse(parsed: any): any {
    // Check if it's a question response
    if (parsed.type === 'question') {
      return {
        type: 'question',
        message: parsed.message || 'Let me ask you a few questions to find the perfect music:',
        questions: parsed.questions || []
      };
    }

    // Otherwise it's a recommendation
    return {
      type: 'recommendation',
      message: parsed.message || 'Finding music for you...',
      searchStrategy: parsed.searchStrategy || {
        playlists: ['top hits 2025'],
        tracks: []
      },
      mood: parsed.mood || 'neutral',
      energy: parsed.energy !== undefined ? parsed.energy : 0.5,
      valence: parsed.valence !== undefined ? parsed.valence : 0.5,
      action: parsed.action || 'play',
      createPlaylist: parsed.action === 'create_playlist'
    };
  }

  private async getRecommendations(
    parsedResponse: any
  ): Promise<SpotifyTrack[]> {
    try {
      console.log('Using LLM-driven search strategy:', JSON.stringify(parsedResponse.searchStrategy));

      let allTracks: SpotifyTrack[] = [];
      const searchStrategy = parsedResponse.searchStrategy || {};

      // Execute playlist searches (these usually have the best curated content)
      if (searchStrategy.playlists && searchStrategy.playlists.length > 0) {
        for (const query of searchStrategy.playlists.slice(0, 3)) {
          if (!query || query.trim() === '') continue;
          console.log(`LLM suggested playlist search: "${query}"`);
          const tracks = await this.spotify.searchAndGetPlaylistTracks(query, 15);
          allTracks.push(...tracks);
        }
      }

      // Execute track searches for variety
      if (searchStrategy.tracks && searchStrategy.tracks.length > 0) {
        for (const query of searchStrategy.tracks.slice(0, 2)) {
          if (!query || query.trim() === '') continue;
          console.log(`LLM suggested track search: "${query}"`);
          const tracks = await this.spotify.searchTracks(query, 10);
          allTracks.push(...tracks);
        }
      }

      // If LLM didn't provide good searches or we have too few tracks, add a fallback
      if (allTracks.length < 10) {
        console.log('Too few tracks from LLM strategy, adding fallback search');
        const fallbackQuery = this.getFallbackQuery(parsedResponse);
        const fallbackTracks = await this.spotify.searchAndGetPlaylistTracks(fallbackQuery, 20);
        allTracks.push(...fallbackTracks);
      }

      // Remove duplicates by track ID
      const uniqueTracks = Array.from(
        new Map(allTracks.map(t => [t.id, t])).values()
      );

      // Sort by popularity
      const sortedTracks = uniqueTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

      // Use LLM's energy level to determine quality threshold
      const popularityThreshold = this.getPopularityThreshold(parsedResponse.energy, parsedResponse.mood);

      // Filter for quality
      const qualityTracks = sortedTracks.filter(t => t.popularity > popularityThreshold);

      // Ensure we have enough tracks
      const targetCount = 20;
      const finalTracks = qualityTracks.length >= targetCount
        ? qualityTracks.slice(0, targetCount)
        : sortedTracks.slice(0, targetCount);

      console.log(`Returning ${finalTracks.length} tracks, average popularity: ${
        finalTracks.reduce((sum, t) => sum + (t.popularity || 0), 0) / finalTracks.length
      }`);

      return finalTracks;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      // Ultimate fallback
      return await this.spotify.searchAndGetPlaylistTracks('Today\'s Top Hits', 20);
    }
  }

  private getFallbackQuery(parsedResponse: any): string {
    // Let the energy and mood guide the fallback
    if (parsedResponse.energy > 0.8) {
      return 'party hits';
    } else if (parsedResponse.energy > 0.5) {
      return 'upbeat music';
    } else if (parsedResponse.mood === 'focus' || parsedResponse.mood === 'chill') {
      return 'chill vibes';
    }
    return 'top hits 2025';
  }

  private getPopularityThreshold(energy: number, mood: string): number {
    // Higher energy or party mood needs more popular tracks
    if (energy > 0.8 || mood === 'party') {
      return 60;
    } else if (energy > 0.5) {
      return 45;
    } else if (mood === 'focus' || mood === 'chill') {
      return 30; // Lower threshold for chill/focus music
    }
    return 40;
  }

  private async updateSessionContext(
    session: UserSession,
    request: DJRequest,
    response: DJResponse
  ): Promise<void> {
    if (response.metadata?.mood && !session.preferences.moodHistory.includes(response.metadata.mood)) {
      session.preferences.moodHistory.push(response.metadata.mood);
      if (session.preferences.moodHistory.length > 10) {
        session.preferences.moodHistory.shift();
      }
    }

    if (response.recommendations && response.recommendations.length > 0) {
      const timestamp = Date.now();
      response.recommendations.slice(0, 3).forEach(track => {
        session.listeningHistory.push({
          trackId: track.id,
          timestamp
        });
      });
    }

    if (request.context) {
      session.currentContext = {
        mood: response.metadata?.mood || request.context.mood || 'neutral',
        activity: session.currentContext?.activity || 'listening',
        timeOfDay: new Date().getHours() < 12 ? 'morning' :
                   new Date().getHours() < 18 ? 'afternoon' : 'evening'
      };
    }
  }
}