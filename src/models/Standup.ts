import { PersistentStandupService } from "../services/PersistentStandupService";
import { StandupGroupManager } from "../services/StandupGroupManager";
import { IStandupStorage } from "../services/Storage";
import { createStandupCard } from "./AdaptiveCards";
import { StandupGroup } from "./StandupGroup";
import { Result, StandupResponse, User } from "./types";

export class Standup {
  private persistentService: PersistentStandupService;
  private groupManager: StandupGroupManager;
  constructor() {
    this.persistentService = new PersistentStandupService();
    this.groupManager = new StandupGroupManager(this.persistentService);
  }

  async initialize(cosmosConnectionString: string): Promise<void> {
    await this.persistentService.initialize(cosmosConnectionString);
  }

  async registerGroup(
    conversationId: string,
    storage: IStandupStorage,
    creator: User,
    tenantId: string
  ): Promise<Result<{ message: string }>> {
    const existingGroup = await this.persistentService.loadGroup(
      conversationId,
      tenantId
    );
    if (existingGroup) {
      return {
        type: "error",
        message: "A standup group is already registered for this conversation.",
      };
    }

    const group = await this.groupManager.createGroup(
      conversationId,
      storage,
      creator,
      tenantId
    );
    return {
      type: "success",
      data: { message: "Standup group registered successfully!" },
      message: "Standup group registered successfully!",
    };
  }

  async addUsers(
    conversationId: string,
    users: User[],
    tenantId: string
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId, tenantId);
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
    for (const user of users) {
      if (await group.addUser(user)) {
        addedUsers.push(user.name);
      }
    }

    if (addedUsers.length > 0) {
      const message = `Added users: ${addedUsers.join(", ")}`;
      return {
        type: "success",
        data: { message },
        message,
      };
    }
    return {
      type: "error",
      message: "No new users were added (they might already be in the group).",
    };
  }

  async removeUsers(
    conversationId: string,
    userIds: string[],
    tenantId: string
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId, tenantId);
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
    const users = await group.getUsers();
    for (const userId of userIds) {
      if (await group.removeUser(userId)) {
        const user = users.find((u: User) => u.id === userId);
        if (user) {
          removedUsers.push(user.name);
        }
      }
    }

    if (removedUsers.length > 0) {
      const message = `Removed users: ${removedUsers.join(", ")}`;
      return {
        type: "success",
        data: { message },
        message,
      };
    }
    return {
      type: "error",
      message: "No users were removed (they might not be in the group).",
    };
  }

  async startStandup(
    conversationId: string,
    tenantId: string,
    activityId?: string
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId, tenantId);
    if (!group) {
      return {
        type: "error",
        message:
          "No standup group registered. Use !register <onenote-link> to create one.",
      };
    }

    if (await group.isStandupActive()) {
      return {
        type: "error",
        message: "A standup is already in progress.",
      };
    }

    if ((await group.getUsers()).length === 0) {
      return {
        type: "error",
        message: "No users in the standup group. Add users with !add @user",
      };
    }

    await group.startStandup(activityId);
    return {
      type: "success",
      data: { message: "Starting standup..." },
      message: "Starting standup...",
    };
  }

  async submitResponse(
    conversationId: string,
    response: StandupResponse,
    tenantId: string,
    send?: (activity: any) => Promise<any>
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId, tenantId);
    if (!group) {
      return {
        type: "error",
        message: "No standup group registered.",
      };
    }

    if (!send) {
      return {
        type: "error",
        message: "No send function provided.",
      };
    }

    if (!response.completedWork || !response.plannedWork) {
      return {
        type: "error",
        message: "Please provide both completed and planned work updates.",
      };
    }

    if (await group.addResponse(response)) {
      // Update standup card with new response
      const activityId = await group.getActiveStandupActivityId();
      if (activityId) {
        const users = await group.getUsers();
        const responses = await group.getActiveResponses();
        const completedUsers = responses.map((r) => {
          const user = users.find((u) => u.id === r.userId);
          return user ? user.name : "Unknown";
        });

        // Update the original card with completed responses
        await send({
          type: "message",
          id: activityId,
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: createStandupCard(completedUsers),
            },
          ],
        });
      }

      return {
        type: "success",
        data: { message: "Your standup response has been recorded." },
        message: "Your standup response has been recorded.",
      };
    }
    return {
      type: "error",
      message:
        "Could not record response. Make sure a standup is active and you haven't already responded.",
    };
  }

  async closeStandup(
    conversationId: string,
    tenantId: string,
    sendSummary: boolean = true
  ): Promise<Result<{ message: string; summary?: string }>> {
    const group = await this.validateGroup(conversationId, tenantId);
    if (!group) {
      return {
        type: "error",
        message: "No standup group registered.",
      };
    }

    const responses = await group.closeStandup();
    if (!sendSummary) {
      return {
        type: "success",
        data: {
          message: "Standup closed successfully without sending summary",
        },
        message: "Standup closed successfully without sending summary",
      };
    }
    if (responses.length === 0) {
      return {
        type: "error",
        message: "No responses were recorded for this standup.",
      };
    }

    // Format summary for chat display
    const users = await group.getUsers();
    const formattedResponses = responses.map((r: StandupResponse) => {
      const user = users.find((u: User) => u.id === r.userId);
      return {
        userName: user ? user.name : "Unknown",
        completedWork: r.completedWork,
        plannedWork: r.plannedWork,
        parkingLot: r.parkingLot,
      };
    });

    // Build summary manually
    const summaryText = this.buildSummary(formattedResponses);

    // Persist to group's storage
    const persistResult = await group.persistStandup();

    if (persistResult.type === "error") {
      const message = `Standup closed successfully, but failed to save to storage: ${persistResult.message}`;
      return {
        type: "success",
        data: {
          message,
          summary: summaryText,
        },
        message,
      };
    }

    return {
      type: "success",
      data: {
        message: "Standup closed and saved successfully.",
        summary: summaryText,
      },
      message: "Standup closed and saved successfully.",
    };
  }

  private buildSummary(
    responses: Array<{
      userName: string;
      completedWork: string;
      plannedWork: string;
      parkingLot?: string;
    }>
  ): string {
    let summary = "# Standup summary\n";

    // Add each user's work
    responses.forEach((response, index) => {
      summary += `### **${response.userName}**:\n`;

      // Format Completed Work as a list
      summary += `  **Completed Work**:\n\n`; // Ensure two newlines before the list
      const completedItems = response.completedWork
        .split("\n")
        .filter((item) => item.trim());
      if (completedItems.length > 0) {
        completedItems.forEach((item) => {
          summary += `    - ${item.trim()}\n`;
        });
      } else {
        summary += `    - (No completed work reported)\n`; // Handle empty input
      }
      summary += "\n"; // One newline after completed work list

      // Format Planned Work as a list
      summary += `  **Planned Work**:\n\n`; // Ensure two newlines before the list
      const plannedItems = response.plannedWork
        .split("\n")
        .filter((item) => item.trim());
      if (plannedItems.length > 0) {
        plannedItems.forEach((item) => {
          summary += `    - ${item.trim()}\n`;
        });
      } else {
        summary += `    - (No planned work reported)\n`; // Handle empty input
      }

      // Add two newlines between users, except after the last one if no parking lot follows
      if (index < responses.length - 1) {
        summary += "\n\n";
      } else {
        summary += "\n"; // Only one newline if it might be followed by parking lot
      }
    });

    // Add parking lot if items exist
    const parkingLotItems = responses.flatMap(
      (r) =>
        r.parkingLot
          ?.split("\n")
          .map((item) => ({ parkingLotItem: item.trim(), user: r.userName }))
          .filter((item) => item.parkingLotItem) ?? // Filter out empty items
        []
    );

    if (parkingLotItems.length > 0) {
      summary += "\n# Parking Lot\n"; // Add extra newline before Parking Lot heading if needed
      for (const { parkingLotItem, user } of parkingLotItems) {
        summary += `  - ${parkingLotItem} (by ${user})\n`;
      }
    }

    return summary.trim(); // Trim trailing whitespace
  }

  async validateGroup(
    conversationId: string,
    tenantId: string
  ): Promise<StandupGroup | null> {
    return await this.groupManager.loadGroup(conversationId, tenantId);
  }

  async getGroupDetails(
    conversationId: string,
    tenantId: string
  ): Promise<
    Result<{ members: User[]; isActive: boolean; storageType: string }>
  > {
    const group = await this.validateGroup(conversationId, tenantId);
    if (!group) {
      return {
        type: "error",
        message:
          "No standup group registered. Use !register <onenote-link> to create one.",
      };
    }

    const members = await group.getUsers();
    const isActive = await group.isStandupActive();
    const storageType = group.storage.constructor.name.replace("Storage", "");

    return {
      type: "success",
      data: {
        members,
        isActive,
        storageType,
      },
      message: "Group details retrieved successfully",
    };
  }
}
