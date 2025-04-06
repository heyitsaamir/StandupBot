import { StandupGroup } from "../models/StandupGroup";
import {
  CosmosStorage,
  CosmosStorageFactory,
  GroupStorageItem,
  HistoryStorageItem,
  StandupStorageItem,
  StandupSummary,
} from "./CosmosStorage";
import { IStandupStorage, NoStorage } from "./Storage";

export class PersistentStandupService {
  private storage!: CosmosStorage<string, StandupStorageItem>;

  constructor(
    private databaseName: string = "StandupDB",
    private containerName: string = "Standups"
  ) {}

  private getGroupStorageKey(group: StandupGroup): {
    id: string;
    tenantId: string;
  } {
    return {
      id: group.conversationId,
      tenantId: group.tenantId,
    };
  }

  async initialize(connectionString: string) {
    // Initialize the CosmosDB client
    CosmosStorageFactory.initialize(connectionString);

    // Get storage instance
    this.storage = await CosmosStorageFactory.getStorage<
      string,
      StandupStorageItem
    >(this.databaseName, this.containerName, "/tenantId");
  }

  async loadGroup(
    conversationId: string,
    tenantId: string
  ): Promise<StandupGroup | null> {
    // Use provided tenantId for lookup
    const key = {
      id: conversationId,
      tenantId,
    };
    const data = await this.storage.get(key.id, key.tenantId);
    if (!data || data.type !== "group") return null;

    // Create NoStorage or OneNoteStorage based on stored config
    let storage: IStandupStorage;
    if (data.storage?.type === "onenote" && data.storage.targetId) {
      // You'll need to inject the http client here
      throw new Error("OneNote storage restoration not implemented");
    } else {
      storage = new NoStorage();
    }

    // Reconstruct the group
    const group = new StandupGroup(
      conversationId,
      storage,
      data.tenantId,
      data.users || [],
      data.activeResponses || [],
      data.isActive || false,
      data.activeStandupActivityId || null
    );

    return this.wrapGroupData(group);
  }

  async saveGroup(group: StandupGroup): Promise<void> {
    const key = this.getGroupStorageKey(group);
    const [users, isActive, activeResponses, activeStandupActivityId] =
      await Promise.all([
        group.getUsers(),
        group.isStandupActive(),
        group.getActiveResponses(),
        group.getActiveStandupActivityId(),
      ]);

    const groupData: GroupStorageItem = {
      id: key.id,
      tenantId: key.tenantId,
      type: "group" as const,
      users,
      isActive,
      activeResponses,
      activeStandupActivityId,
      storage: group.storage.getStorageInfo(),
    };

    await this.storage.set(key.id, groupData);
  }

  private async wrapGroupData(group: StandupGroup): Promise<StandupGroup> {
    // Get the initial state to store in CosmosDB
    const [users, isActive, activeResponses, activeStandupActivityId] =
      await Promise.all([
        group.getUsers(),
        group.isStandupActive(),
        group.getActiveResponses(),
        group.getActiveStandupActivityId(),
      ]);

    // Create a new group with the fetched data
    return new StandupGroup(
      group.conversationId,
      group.storage,
      group.tenantId,
      users,
      activeResponses,
      isActive,
      activeStandupActivityId
    );
  }

  private isHistoryItem(
    item: StandupStorageItem | undefined
  ): item is HistoryStorageItem {
    return !!item && item.type === "history";
  }

  async addStandupHistory(
    group: StandupGroup,
    summary: StandupSummary
  ): Promise<void> {
    const key = this.getGroupStorageKey(group);
    const existingHistory = await this.storage.get(key.id, key.tenantId);

    const history: HistoryStorageItem = this.isHistoryItem(existingHistory)
      ? existingHistory
      : {
          id: key.id,
          tenantId: key.tenantId,
          type: "history" as const,
          summaries: [],
        };

    history.summaries.push(summary);
    await this.storage.set(key.id, history);
  }

  async getStandupHistory(group: StandupGroup): Promise<StandupSummary[]> {
    const key = this.getGroupStorageKey(group);
    const history = await this.storage.get(key.id, key.tenantId);
    return this.isHistoryItem(history) ? history.summaries : [];
  }
}
