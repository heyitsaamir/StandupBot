import { StandupGroup, StandupResponse, User } from "./StandupGroup";

export type Success<T> = {
  type: "success";
  data: T;
};

export type Error = {
  type: "error";
  message: string;
};

export type Result<T> = Success<T> | Error;

export class Standup {
  private standupGroups: Map<string, StandupGroup>;

  constructor() {
    this.standupGroups = new Map();
  }

  async registerGroup(
    conversationId: string,
    oneNoteLink: string,
    creator: User
  ): Promise<Result<{ message: string }>> {
    if (!oneNoteLink) {
      return {
        type: "error",
        message: "Please provide a OneNote link: !register <onenote-link>",
      };
    }

    if (this.standupGroups.has(conversationId)) {
      return {
        type: "error",
        message: "A standup group is already registered for this conversation.",
      };
    }

    const group = new StandupGroup(conversationId, oneNoteLink, [creator]);
    this.standupGroups.set(conversationId, group);
    return {
      type: "success",
      data: { message: "Standup group registered successfully!" },
    };
  }

  async addUsers(
    conversationId: string,
    users: User[]
  ): Promise<Result<{ message: string }>> {
    const group = this.validateGroup(conversationId);
    if (!group) {
      return {
        type: "error",
        message:
          "No standup group registered. Use !register <onenote-link> to create one.",
      };
    }

    if (!users.length) {
      return {
        type: "error",
        message: "Please @mention the users you want to add.",
      };
    }

    const addedUsers: string[] = [];
    users.forEach((user) => {
      if (group.addUser(user)) {
        addedUsers.push(user.name);
      }
    });

    if (addedUsers.length > 0) {
      return {
        type: "success",
        data: { message: `Added users: ${addedUsers.join(", ")}` },
      };
    }
    return {
      type: "error",
      message: "No new users were added (they might already be in the group).",
    };
  }

  async removeUsers(
    conversationId: string,
    userIds: string[]
  ): Promise<Result<{ message: string }>> {
    const group = this.validateGroup(conversationId);
    if (!group) {
      return {
        type: "error",
        message:
          "No standup group registered. Use !register <onenote-link> to create one.",
      };
    }

    if (!userIds.length) {
      return {
        type: "error",
        message: "Please @mention the users you want to remove.",
      };
    }

    const removedUsers: string[] = [];
    userIds.forEach((userId) => {
      if (group.removeUser(userId)) {
        const user = group.getUsers().find((u) => u.id === userId);
        if (user) {
          removedUsers.push(user.name);
        }
      }
    });

    if (removedUsers.length > 0) {
      return {
        type: "success",
        data: { message: `Removed users: ${removedUsers.join(", ")}` },
      };
    }
    return {
      type: "error",
      message: "No users were removed (they might not be in the group).",
    };
  }

  async startStandup(
    conversationId: string
  ): Promise<Result<{ message: string }>> {
    const group = this.validateGroup(conversationId);
    if (!group) {
      return {
        type: "error",
        message:
          "No standup group registered. Use !register <onenote-link> to create one.",
      };
    }

    if (group.isStandupActive()) {
      return {
        type: "error",
        message: "A standup is already in progress.",
      };
    }

    if (group.getUsers().length === 0) {
      return {
        type: "error",
        message: "No users in the standup group. Add users with !add @user",
      };
    }

    group.startStandup();
    return {
      type: "success",
      data: { message: "Starting standup..." },
    };
  }

  async submitResponse(
    conversationId: string,
    response: StandupResponse
  ): Promise<Result<{ message: string }>> {
    const group = this.validateGroup(conversationId);
    if (!group) {
      return {
        type: "error",
        message: "No standup group registered.",
      };
    }

    if (!response.response) {
      return {
        type: "error",
        message: "Please provide a standup update.",
      };
    }

    if (group.addResponse(response)) {
      return {
        type: "success",
        data: { message: "Your standup response has been recorded." },
      };
    }
    return {
      type: "error",
      message:
        "Could not record response. Make sure a standup is active and you haven't already responded.",
    };
  }

  async closeStandup(
    conversationId: string
  ): Promise<Result<{ message: string; summary?: string }>> {
    const group = this.validateGroup(conversationId);
    if (!group) {
      return {
        type: "error",
        message: "No standup group registered.",
      };
    }

    const responses = group.closeStandup();
    if (responses.length === 0) {
      return {
        type: "error",
        message: "No responses were recorded for this standup.",
      };
    }

    const formattedResponses = responses.map((r) => {
      const user = group.getUsers().find((u) => u.id === r.userId);
      return `**${user?.name || "Unknown User"}**:\n${r.response}\n`;
    });

    const summary = "**Standup Summary**\n\n" + formattedResponses.join("\n");
    return {
      type: "success",
      data: {
        message: "Standup closed successfully.",
        summary,
      },
    };
  }

  private validateGroup(conversationId: string): StandupGroup | null {
    return this.standupGroups.get(conversationId) || null;
  }
}
