import { IStandupStorage } from "../services/Storage";
import { Result, StandupResponse, StandupSummary, User } from "./types";

export class StandupGroup {
  constructor(
    public readonly conversationId: string,
    public readonly storage: IStandupStorage,
    public readonly tenantId: string,
    private users: User[] = [],
    private activeResponses: StandupResponse[] = [],
    private isActive: boolean = false,
    private activeStandupActivityId: string | null = null
  ) {
    this.users = users;
  }

  async setActiveStandupActivityId(id: string) {
    this.activeStandupActivityId = id;
  }

  async getActiveStandupActivityId(): Promise<string | null> {
    return this.activeStandupActivityId;
  }

  async getActiveResponses(): Promise<StandupResponse[]> {
    return [...this.activeResponses];
  }

  async persistStandup(): Promise<Result<void>> {
    if (!this.isActive || this.activeResponses.length === 0) {
      return {
        type: "error",
        message: "No active standup to persist",
      };
    }

    const responses = [...this.activeResponses];
    const summary: StandupSummary = {
      date: new Date(),
      participants: [...this.users],
      responses: responses,
      parkingLot: responses
        .map((r) => r.parkingLot)
        .filter((item): item is string => !!item),
    };

    return await this.storage.appendStandupSummary(summary);
  }

  async addUser(user: User): Promise<boolean> {
    if (this.users.find((u) => u.id === user.id)) {
      return false;
    }
    this.users.push(user);
    return true;
  }

  async removeUser(userId: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter((u) => u.id !== userId);
    return this.users.length !== initialLength;
  }

  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async startStandup(activityId?: string): Promise<boolean> {
    if (this.isActive) return false;
    this.isActive = true;
    this.activeResponses = [];
    this.activeStandupActivityId = activityId || null;
    return true;
  }

  async addResponse(response: StandupResponse): Promise<boolean> {
    if (!this.isActive) return false;
    if (this.activeResponses.find((r) => r.userId === response.userId)) {
      // Remove existing response
      this.activeResponses = this.activeResponses.filter(
        (r) => r.userId !== response.userId
      );
    }
    this.activeResponses.push(response);
    return true;
  }

  async closeStandup(): Promise<StandupResponse[]> {
    if (!this.isActive) return [];
    this.isActive = false;
    const responses = [...this.activeResponses];
    this.activeResponses = [];
    this.activeStandupActivityId = null;
    return responses;
  }

  async isStandupActive(): Promise<boolean> {
    return this.isActive;
  }

  async hasUser(userId: string): Promise<boolean> {
    return this.users.some((u) => u.id === userId);
  }
}
