import { ChatPrompt } from "@microsoft/spark.ai";
import { OpenAIChatModel } from "@microsoft/spark.openai";
import { PersistentStandupService } from "../services/PersistentStandupService";
import { StandupGroupManager } from "../services/StandupGroupManager";
import { IStandupStorage } from "../services/Storage";
import { createStandupCard } from "./AdaptiveCards";
import { StandupGroup } from "./StandupGroup";
import { Result, StandupResponse, User } from "./types";

export class Standup {
  private persistentService: PersistentStandupService;
  private groupManager: StandupGroupManager;
  private summaryChatPrompt: ChatPrompt;

  constructor() {
    this.persistentService = new PersistentStandupService();
    this.groupManager = new StandupGroupManager(this.persistentService);
    this.summaryChatPrompt = new ChatPrompt({
      instructions: `You are an expert standup summarizer. Summarize the standup responses. Categorize the responses of what was done and what is planned by each user. Then at the end of the summary, add a parking log section (if it exists), and list out the items that need to be discussed. Prioritize it by importance.
        
The format expected is:

# Standup summary
## Previous work:
### **UserName**:
  **Completed Work**:
    1. Completed work item 1
    2. Completed work item 2
  **Planned Work**:
    1. Planned work item 1
    2. Planned work item 2
# Parking Lot
  - Parking lot item 1 (by UserName)
  - Parking lot item 2 (by UserName)
        `,
      model: new OpenAIChatModel({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
      }),
    });
  }

  async initialize(cosmosConnectionString: string): Promise<void> {
    await this.persistentService.initialize(cosmosConnectionString);
  }

  async registerGroup(
    conversationId: string,
    storage: IStandupStorage,
    creator: User
  ): Promise<Result<{ message: string }>> {
    const existingGroup = await this.persistentService.loadGroup(
      conversationId
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
      creator
    );
    return {
      type: "success",
      data: { message: "Standup group registered successfully!" },
      message: "Standup group registered successfully!",
    };
  }

  async addUsers(
    conversationId: string,
    users: User[]
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId);
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
    userIds: string[]
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId);
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
    activityId?: string
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId);
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
    send?: (activity: any) => Promise<any>
  ): Promise<Result<{ message: string }>> {
    const group = await this.validateGroup(conversationId);
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
    sendSummary: boolean = true
  ): Promise<Result<{ message: string; summary?: string }>> {
    const group = await this.validateGroup(conversationId);
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

    const chatSummary = await this.summaryChatPrompt.send(
      `Generate a summary of the standup: ${JSON.stringify(formattedResponses)}`
    );
    const chatSummaryText = chatSummary.content;

    // Persist to group's storage
    const persistResult = await group.persistStandup();

    if (persistResult.type === "error") {
      const message = `Standup closed successfully, but failed to save to storage: ${persistResult.message}`;
      return {
        type: "success",
        data: {
          message,
          summary: chatSummaryText,
        },
        message,
      };
    }

    return {
      type: "success",
      data: {
        message: "Standup closed and saved successfully.",
        summary: chatSummaryText,
      },
      message: "Standup closed and saved successfully.",
    };
  }

  async validateGroup(conversationId: string): Promise<StandupGroup | null> {
    return await this.groupManager.loadGroup(conversationId);
  }

  async getGroupDetails(
    conversationId: string
  ): Promise<
    Result<{ members: User[]; isActive: boolean; storageType: string }>
  > {
    const group = await this.validateGroup(conversationId);
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
