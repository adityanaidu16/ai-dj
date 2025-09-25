import { DurableObject } from 'cloudflare:workers';
import { UserSession as UserSessionType } from './types';

export class UserSession extends DurableObject {
  private session: UserSessionType;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.session = this.getDefaultSession();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/get':
        return this.getSession();
      case '/update':
        return this.updateSession(request);
      case '/add-preference':
        return this.addPreference(request);
      case '/add-history':
        return this.addToHistory(request);
      case '/set-context':
        return this.setContext(request);
      case '/set-spotify-token':
        return this.setSpotifyToken(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private getDefaultSession(): UserSessionType {
    return {
      userId: '',
      spotifyToken: undefined,
      preferences: {
        favoriteGenres: [],
        favoriteArtists: [],
        energyPreference: 5,
        moodHistory: []
      },
      listeningHistory: [],
      currentContext: undefined
    };
  }

  private async getSession(): Promise<Response> {
    const stored = await this.ctx.storage.get('session');
    if (stored) {
      this.session = stored as UserSessionType;
    }
    return Response.json(this.session);
  }

  private async updateSession(request: Request): Promise<Response> {
    const update = await request.json() as UserSessionType;
    this.session = { ...this.session, ...update };
    await this.ctx.storage.put('session', this.session);
    return Response.json({ success: true });
  }

  private async addPreference(request: Request): Promise<Response> {
    const { type, value } = await request.json() as any;

    switch (type) {
      case 'genre':
        if (!this.session.preferences.favoriteGenres.includes(value)) {
          this.session.preferences.favoriteGenres.push(value);
        }
        break;
      case 'artist':
        if (!this.session.preferences.favoriteArtists.includes(value)) {
          this.session.preferences.favoriteArtists.push(value);
        }
        break;
      case 'energy':
        this.session.preferences.energyPreference = value;
        break;
    }

    await this.ctx.storage.put('session', this.session);
    return Response.json({ success: true });
  }

  private async addToHistory(request: Request): Promise<Response> {
    const entry = await request.json() as any;
    this.session.listeningHistory.push(entry);

    if (this.session.listeningHistory.length > 100) {
      this.session.listeningHistory = this.session.listeningHistory.slice(-100);
    }

    await this.ctx.storage.put('session', this.session);
    return Response.json({ success: true });
  }

  private async setContext(request: Request): Promise<Response> {
    const context = await request.json() as any;
    this.session.currentContext = context;
    await this.ctx.storage.put('session', this.session);
    return Response.json({ success: true });
  }

  private async setSpotifyToken(request: Request): Promise<Response> {
    const { token } = await request.json() as any;
    this.session.spotifyToken = token;
    await this.ctx.storage.put('session', this.session);
    return Response.json({ success: true });
  }
}

export class DJState extends DurableObject {
  private activeUsers: Set<string>;
  private globalStats: {
    totalRequests: number;
    popularGenres: Record<string, number>;
    popularMoods: Record<string, number>;
    peakHours: Record<string, number>;
  };

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.activeUsers = new Set();
    this.globalStats = {
      totalRequests: 0,
      popularGenres: {},
      popularMoods: {},
      peakHours: {}
    };
    this.loadState();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/stats':
        return this.getStats();
      case '/track-request':
        return this.trackRequest(request);
      case '/active-users':
        return this.getActiveUsers();
      case '/user-joined':
        return this.userJoined(request);
      case '/user-left':
        return this.userLeft(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async loadState(): Promise<void> {
    const stats = await this.ctx.storage.get('globalStats');
    if (stats) {
      this.globalStats = stats as any;
    }

    const users = await this.ctx.storage.get('activeUsers');
    if (users) {
      this.activeUsers = new Set(users as string[]);
    }
  }

  private async saveState(): Promise<void> {
    await this.ctx.storage.put('globalStats', this.globalStats);
    await this.ctx.storage.put('activeUsers', Array.from(this.activeUsers));
  }

  private async getStats(): Promise<Response> {
    return Response.json({
      ...this.globalStats,
      activeUsersCount: this.activeUsers.size,
      topGenres: Object.entries(this.globalStats.popularGenres)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      topMoods: Object.entries(this.globalStats.popularMoods)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    });
  }

  private async trackRequest(request: Request): Promise<Response> {
    const { genre, mood } = await request.json() as any;
    const hour = new Date().getHours().toString();

    this.globalStats.totalRequests++;

    if (genre) {
      this.globalStats.popularGenres[genre] = (this.globalStats.popularGenres[genre] || 0) + 1;
    }

    if (mood) {
      this.globalStats.popularMoods[mood] = (this.globalStats.popularMoods[mood] || 0) + 1;
    }

    this.globalStats.peakHours[hour] = (this.globalStats.peakHours[hour] || 0) + 1;

    await this.saveState();
    return Response.json({ success: true });
  }

  private async getActiveUsers(): Promise<Response> {
    return Response.json({
      count: this.activeUsers.size,
      users: Array.from(this.activeUsers)
    });
  }

  private async userJoined(request: Request): Promise<Response> {
    const { userId } = await request.json() as any;
    this.activeUsers.add(userId);
    await this.saveState();
    return Response.json({ success: true });
  }

  private async userLeft(request: Request): Promise<Response> {
    const { userId } = await request.json() as any;
    this.activeUsers.delete(userId);
    await this.saveState();
    return Response.json({ success: true });
  }
}