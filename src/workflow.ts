import { DJRequest, DJResponse, UserSession } from './types';
import { AIDJ } from './ai-dj';

export class DJWorkflow {
  async run(event: any, step: any) {
    const { request, sessionId } = event.payload;

    const session = await step.do('fetch-session', async () => {
      return await this.fetchUserSession(sessionId);
    });

    const djResponse = await step.do('process-dj-request', async () => {
      const dj = new AIDJ(this.env);
      return await dj.processRequest(request, session);
    });

    if (djResponse.action === 'create_playlist' && djResponse.playlist) {
      await step.do('save-playlist', async () => {
        await this.savePlaylist(sessionId, djResponse.playlist);
      });
    }

    await step.do('update-session', async () => {
      await this.updateUserSession(sessionId, session);
    });

    await step.do('log-interaction', async () => {
      await this.logInteraction(sessionId, request, djResponse);
    });

    return djResponse;
  }

  private async fetchUserSession(sessionId: string): Promise<UserSession> {
    const id = this.env.USER_SESSIONS.idFromName(sessionId);
    const stub = this.env.USER_SESSIONS.get(id);
    const response = await stub.fetch('https://dummy/get');
    return await response.json();
  }

  private async updateUserSession(sessionId: string, session: UserSession): Promise<void> {
    const id = this.env.USER_SESSIONS.idFromName(sessionId);
    const stub = this.env.USER_SESSIONS.get(id);
    await stub.fetch('https://dummy/update', {
      method: 'POST',
      body: JSON.stringify(session)
    });
  }

  private async savePlaylist(sessionId: string, playlist: any): Promise<void> {
    const key = `playlist:${sessionId}:${playlist.id}`;
    await this.env.PLAYLISTS.put(key, JSON.stringify(playlist), {
      expirationTtl: 86400 * 30
    });
  }

  private async logInteraction(
    sessionId: string,
    request: DJRequest,
    response: DJResponse
  ): Promise<void> {
    const log = {
      timestamp: Date.now(),
      sessionId,
      request: request.message,
      response: response.message,
      action: response.action,
      recommendationCount: response.recommendations?.length || 0
    };

    const key = `log:${sessionId}:${Date.now()}`;
    await this.env.CACHE.put(key, JSON.stringify(log), {
      expirationTtl: 86400 * 7
    });
  }
}