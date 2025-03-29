export interface User {
  id: string;
  name: string;
}

export interface StandupResponse {
  userId: string;
  response: string;
  parkingLot?: string;
  timestamp: Date;
}

export class StandupGroup {
  private users: User[] = [];
  private activeResponses: StandupResponse[] = [];
  private isActive: boolean = false;

  constructor(
    public readonly conversationId: string,
    public readonly oneNoteLink: string,
    users: User[] = []
  ) {
    this.users = users;
  }

  addUser(user: User): boolean {
    if (this.users.find((u) => u.id === user.id)) {
      return false;
    }
    this.users.push(user);
    return true;
  }

  removeUser(userId: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter((u) => u.id !== userId);
    return this.users.length !== initialLength;
  }

  getUsers(): User[] {
    return [...this.users];
  }

  startStandup(): boolean {
    if (this.isActive) return false;
    this.isActive = true;
    this.activeResponses = [];
    return true;
  }

  addResponse(response: StandupResponse): boolean {
    if (!this.isActive) return false;
    if (this.activeResponses.find((r) => r.userId === response.userId))
      return false;
    this.activeResponses.push(response);
    return true;
  }

  closeStandup(): StandupResponse[] {
    if (!this.isActive) return [];
    this.isActive = false;
    const responses = [...this.activeResponses];
    this.activeResponses = [];
    return responses;
  }

  isStandupActive(): boolean {
    return this.isActive;
  }

  hasUser(userId: string): boolean {
    return this.users.some((u) => u.id === userId);
  }
}
