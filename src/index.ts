import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, DJRequest } from './types';
import { AIDJ } from './ai-dj';
import { getHTMLContent } from './html-content';

export { UserSession, DJState } from './durable-objects';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// Serve the HTML file at root
app.get('/', (c) => {
  return c.html(getHTMLContent());
});

app.post('/api/chat', async (c) => {
  const { message, sessionId } = await c.req.json();

  if (!message || !sessionId) {
    return c.json({ error: 'Missing message or sessionId' }, 400);
  }

  try {
    const sessionDoId = c.env.USER_SESSIONS.idFromName(sessionId);
    const sessionStub = c.env.USER_SESSIONS.get(sessionDoId);

    const sessionResponse = await sessionStub.fetch('https://dummy/get');
    let session = await sessionResponse.json() as any;

    if (!session.userId) {
      session.userId = sessionId;
      await sessionStub.fetch('https://dummy/update', {
        method: 'POST',
        body: JSON.stringify(session)
      });
    }

    // Store conversation context to prevent infinite question loops
    if (message.includes("I choose:")) {
      await sessionStub.fetch('https://dummy/set-context', {
        method: 'POST',
        body: JSON.stringify({
          activity: message,
          mood: 'answered',
          timeOfDay: new Date().getHours() < 18 ? 'day' : 'night'
        })
      });
    }

    const djStateId = c.env.DJ_STATE.idFromName('global');
    const djStateStub = c.env.DJ_STATE.get(djStateId);
    await djStateStub.fetch('https://dummy/user-joined', {
      method: 'POST',
      body: JSON.stringify({ userId: sessionId })
    });

    // Process request directly without workflow
    const dj = new AIDJ(c.env);
    const djRequest: DJRequest = { userId: sessionId, message };
    const djResponse = await dj.processRequest(djRequest, session);

    // Track request statistics
    await djStateStub.fetch('https://dummy/track-request', {
      method: 'POST',
      body: JSON.stringify({
        genre: djResponse.metadata?.genre,
        mood: djResponse.metadata?.mood
      })
    });

    // Save playlist if created
    if (djResponse.action === 'create_playlist' && djResponse.playlist) {
      const key = `playlist:${sessionId}:${djResponse.playlist.id}`;
      await c.env.PLAYLISTS.put(key, JSON.stringify(djResponse.playlist), {
        expirationTtl: 86400 * 30 // 30 days
      });
    }

    // Log interaction
    const log = {
      timestamp: Date.now(),
      sessionId,
      request: djRequest.message,
      response: djResponse.message,
      action: djResponse.action,
      recommendationCount: djResponse.recommendations?.length || 0
    };
    const logKey = `log:${sessionId}:${Date.now()}`;
    await c.env.CACHE.put(logKey, JSON.stringify(log), {
      expirationTtl: 86400 * 7 // 7 days
    });

    return c.json(djResponse);
  } catch (error) {
    console.error('Error processing chat:', error);

    const dj = new AIDJ(c.env);
    const fallbackResponse = await dj.processRequest(
      { userId: sessionId, message },
      {
        userId: sessionId,
        preferences: {
          favoriteGenres: [],
          favoriteArtists: [],
          energyPreference: 5,
          moodHistory: []
        },
        listeningHistory: [],
        currentContext: undefined
      }
    );

    return c.json(fallbackResponse);
  }
});

app.post('/api/preferences', async (c) => {
  const { sessionId, type, value } = await c.req.json();

  if (!sessionId || !type || !value) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  try {
    const sessionDoId = c.env.USER_SESSIONS.idFromName(sessionId);
    const sessionStub = c.env.USER_SESSIONS.get(sessionDoId);

    await sessionStub.fetch('https://dummy/add-preference', {
      method: 'POST',
      body: JSON.stringify({ type, value })
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

app.post('/api/spotify-token', async (c) => {
  const { sessionId, token } = await c.req.json();

  if (!sessionId || !token) {
    return c.json({ error: 'Missing sessionId or token' }, 400);
  }

  try {
    const sessionDoId = c.env.USER_SESSIONS.idFromName(sessionId);
    const sessionStub = c.env.USER_SESSIONS.get(sessionDoId);

    await sessionStub.fetch('https://dummy/set-spotify-token', {
      method: 'POST',
      body: JSON.stringify({ token })
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error setting Spotify token:', error);
    return c.json({ error: 'Failed to set Spotify token' }, 500);
  }
});

app.get('/api/stats', async (c) => {
  try {
    const djStateId = c.env.DJ_STATE.idFromName('global');
    const djStateStub = c.env.DJ_STATE.get(djStateId);

    const response = await djStateStub.fetch('https://dummy/stats');
    const stats = await response.json();

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

app.get('/api/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  try {
    const sessionDoId = c.env.USER_SESSIONS.idFromName(sessionId);
    const sessionStub = c.env.USER_SESSIONS.get(sessionDoId);

    const response = await sessionStub.fetch('https://dummy/get');
    const session = await response.json();

    return c.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'AI DJ',
    timestamp: new Date().toISOString()
  });
});

export default app;